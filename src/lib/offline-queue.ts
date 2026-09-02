// Offline write outbox.
//
// The app is a gym app: signal in a basement gym is unreliable, and losing a
// logged set because the network dropped for ten seconds is the worst possible
// failure. Every set write goes through here.
//
// HOW IT WORKS
// ------------
// Each mutation is described declaratively (table + op + payload) and attempted
// immediately. If the attempt fails for a *network* reason, it is appended to a
// localStorage queue and retried on `online`, on visibility change, and on a
// slow interval. Rows carry client-generated UUIDs, so inserts are replayed as
// upserts and a double-flush cannot duplicate a set.
//
// Server-side rejections (RLS, validation) are NOT queued — retrying those
// forever would be a silent data-loss trap. They surface to the caller.

export type QueuedOp =
  | { op: "insert"; table: string; values: Record<string, unknown> }
  | { op: "update"; table: string; values: Record<string, unknown>; matchId: string }
  | { op: "delete"; table: string; matchId: string };

export type QueuedMutation = QueuedOp & { qid: string; queuedAt: number };

const KEY = "liftcamp.outbox.v1";

type Listener = (pending: number) => void;
const listeners = new Set<Listener>();

function emit() {
  const n = read().length;
  for (const l of listeners) l(n);
}

export function subscribeToOutbox(l: Listener): () => void {
  listeners.add(l);
  l(read().length);
  return () => listeners.delete(l);
}

export function read(): QueuedMutation[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedMutation[]) : [];
  } catch {
    return [];
  }
}

function write(items: QueuedMutation[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* quota or private mode — the in-flight attempt already happened */
  }
  emit();
}

export function enqueue(op: QueuedOp) {
  const items = read();

  // Collapse repeated edits to the same row: only the latest values matter.
  if (op.op === "update") {
    const i = items.findIndex(
      (m) => m.op === "update" && m.table === op.table && m.matchId === op.matchId,
    );
    if (i !== -1) {
      const prev = items[i] as Extract<QueuedMutation, { op: "update" }>;
      items[i] = { ...prev, values: { ...prev.values, ...op.values }, queuedAt: Date.now() };
      write(items);
      return;
    }
  }

  items.push({ ...op, qid: crypto.randomUUID(), queuedAt: Date.now() });
  write(items);
}

/** A network failure, as opposed to the server saying no. */
function isOffline(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /fetch|network|load failed|timeout|Failed to fetch/i.test(msg);
}

type SupabaseLike = {
  from: (table: string) => {
    upsert: (v: Record<string, unknown>) => Promise<{ error: unknown }>;
    update: (v: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: unknown }> };
    delete: () => { eq: (c: string, v: string) => Promise<{ error: unknown }> };
  };
};

async function apply(client: SupabaseLike, op: QueuedOp): Promise<void> {
  let error: unknown = null;
  if (op.op === "insert") ({ error } = await client.from(op.table).upsert(op.values));
  else if (op.op === "update")
    ({ error } = await client.from(op.table).update(op.values).eq("id", op.matchId));
  else ({ error } = await client.from(op.table).delete().eq("id", op.matchId));
  if (error) throw error;
}

/**
 * Run a write now, or queue it if the device is offline. Returns true when the
 * write landed on the server, false when it was queued for later.
 */
export async function runOrQueue(client: SupabaseLike, op: QueuedOp): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    enqueue(op);
    return false;
  }
  try {
    await apply(client, op);
    return true;
  } catch (err) {
    if (isOffline(err)) {
      enqueue(op);
      return false;
    }
    throw err;
  }
}

let flushing = false;

/** Drain the outbox oldest-first. Stops at the first network failure. */
export async function flushOutbox(client: SupabaseLike): Promise<number> {
  if (flushing) return 0;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return 0;
  flushing = true;
  let synced = 0;
  try {
    let items = read();
    while (items.length > 0) {
      const [next, ...rest] = items;
      try {
        await apply(client, next);
      } catch (err) {
        if (isOffline(err)) break;
        // Server rejected it. Dropping is the only way not to wedge the queue;
        // the row simply never existed, and the next fetch shows the truth.
        console.warn("[outbox] dropping rejected mutation", next, err);
      }
      items = rest;
      write(items);
      synced += 1;
    }
  } finally {
    flushing = false;
  }
  return synced;
}
