// The offline write queue's rules: what an op is, how a new op folds into
// the ones already waiting, which errors are worth retrying, and what else
// has to fail when an op fails for good.
//
// Pure functions over plain data. The runner in write-queue-runner.ts owns
// storage, timing and the network; the mobile app owns the Supabase calls.
//
// Every workout write is an op against workouts, workout_exercises or sets,
// and removing a saved routine is a delete of its `templates` rows (their
// template_exercises cascade on the server). Every op is safe to send
// twice: an insert is `ON CONFLICT (id) DO NOTHING` on a client-generated
// id, an update sets absolute values, and a delete of a row already gone
// changes nothing. The queue sends ops one at a time in the
// order they were made, so replaying the op at the head after a lost
// response can never overtake a later write.

import { APP_STORAGE_PREFIX } from "./account-deletion";

export type QueueTable = "workouts" | "workout_exercises" | "sets" | "templates";

/** Column values as the database takes them. */
export type Row = Record<string, unknown>;

/**
 * One row of an insert. `parents` lists the ids of every row it hangs off,
 * nearest last (a set: its workout, then its exercise row), so a delete of
 * any of them can find it. `meta` rides along for the pending overlay and is
 * never sent: an exercise row carries its exercise's display fields there,
 * which a screen reloaded before the sync needs to draw the card.
 */
export type InsertRow = { id: string; parents: string[]; values: Row; meta?: Row };

export type WriteOpBody =
  | { kind: "insert"; table: QueueTable; rows: InsertRow[] }
  | {
      kind: "update";
      table: QueueTable;
      id: string;
      parents: string[];
      patch: Row;
      /**
       * Only apply while this column is still null. Finish uses it on
       * `finished_at`, so the first device to finish a workout wins. Never
       * merged with another update.
       */
      onlyIfNull?: string;
      meta?: Row;
    }
  | { kind: "delete"; table: QueueTable; id: string; parents: string[] };

export type WriteOp = WriteOpBody & {
  /** Queue order. Never reused, including across restarts. */
  seq: number;
  userId: string;
  /** Epoch ms. */
  enqueuedAt: number;
  /** Failed sends so far. */
  attempts: number;
};

export type QueueState = { nextSeq: number; ops: WriteOp[] };

export const EMPTY_QUEUE: QueueState = { nextSeq: 1, ops: [] };

/** Device storage key for a user's queue. Under the app prefix, so account deletion clears it. */
export function writeQueueKey(userId: string): string {
  return `${APP_STORAGE_PREFIX}queue:${userId}`;
}

/** Device storage key for a user's writes that failed for good. */
export function failedWritesKey(userId: string): string {
  return `${APP_STORAGE_PREFIX}queue-failed:${userId}`;
}

/** Whether an op writes, changes or removes the row `id`. */
function targets(op: WriteOpBody, id: string): boolean {
  return op.kind === "insert" ? op.rows.some((r) => r.id === id) : op.id === id;
}

/** Whether an op writes a row under `id`, or is itself about `id`. */
function touches(op: WriteOpBody, id: string): boolean {
  if (op.kind === "insert") return op.rows.some((r) => r.id === id || r.parents.includes(id));
  return op.id === id || op.parents.includes(id);
}

/** The op with every row about `id`, or under it, taken out. Null when nothing is left. */
function without(op: WriteOp, id: string): WriteOp | null {
  if (op.kind !== "insert") return touches(op, id) ? null : op;
  const rows = op.rows.filter((r) => r.id !== id && !r.parents.includes(id));
  if (rows.length === op.rows.length) return op;
  return rows.length > 0 ? { ...op, rows } : null;
}

/**
 * Adds an op to the queue, folding it into what is already waiting where
 * that sends less and ends in the same database state.
 *
 * - An update merges into the last queued update of the same row, or into
 *   the row's queued insert, as long as nothing in between deleted it.
 * - A delete of a row whose insert has not been sent removes that insert and
 *   everything queued after it under the row, and sends nothing.
 * - A delete of a row already on the server drops the queued updates to it
 *   and any queued rows under it, then queues the delete.
 *
 * The op being sent right now (`inFlightSeq`) is never changed: the server
 * may already have it.
 */
export function addOp(
  state: QueueState,
  body: WriteOpBody,
  ctx: { userId: string; now: number; inFlightSeq: number | null },
): QueueState {
  const op = { ...body, seq: state.nextSeq, userId: ctx.userId, enqueuedAt: ctx.now, attempts: 0 } as WriteOp;
  const next: QueueState = { nextSeq: state.nextSeq + 1, ops: state.ops };
  const locked = (o: WriteOp) => o.seq === ctx.inFlightSeq;

  if (body.kind === "update" && !body.onlyIfNull) {
    for (let i = state.ops.length - 1; i >= 0; i -= 1) {
      const prior = state.ops[i];
      if (prior.table !== body.table || !targets(prior, body.id)) continue;
      if (locked(prior)) break;
      if (prior.kind === "update" && !prior.onlyIfNull) {
        const merged: WriteOp = {
          ...prior,
          patch: { ...prior.patch, ...body.patch },
          ...(prior.meta || body.meta ? { meta: { ...prior.meta, ...body.meta } } : {}),
        };
        return { ...next, ops: replaceAt(state.ops, i, merged) };
      }
      if (prior.kind === "insert") {
        const rows = prior.rows.map((r) =>
          r.id === body.id
            ? {
                ...r,
                values: { ...r.values, ...body.patch },
                ...(r.meta || body.meta ? { meta: { ...r.meta, ...body.meta } } : {}),
              }
            : r,
        );
        return { ...next, ops: replaceAt(state.ops, i, { ...prior, rows }) };
      }
      break;
    }
    return { ...next, ops: [...state.ops, op] };
  }

  if (body.kind === "delete") {
    const insertAt = findLastIndex(
      state.ops,
      (o) => o.kind === "insert" && o.table === body.table && targets(o, body.id),
    );
    const unsent = insertAt >= 0 && !locked(state.ops[insertAt]);
    if (unsent) {
      // Never reached the server: everything from its insert on that is
      // about it goes, and so does this delete. Ops before the insert stay,
      // which keeps a delete-then-restore-then-delete as one delete.
      const ops = [
        ...state.ops.slice(0, insertAt),
        ...state.ops
          .slice(insertAt)
          .map((o) => without(o, body.id))
          .filter((o): o is WriteOp => o != null),
      ];
      return { ...next, ops };
    }
    // On the server, or on its way: updates to it and rows under it are
    // moot once it is gone. Earlier deletes are harmless and kept.
    const ops = state.ops
      .map((o) => {
        if (locked(o) || o.kind === "delete") return o;
        return without(o, body.id);
      })
      .filter((o): o is WriteOp => o != null);
    return { ...next, ops: [...ops, op] };
  }

  return { ...next, ops: [...state.ops, op] };
}

function replaceAt<T>(list: T[], i: number, value: T): T[] {
  const copy = list.slice();
  copy[i] = value;
  return copy;
}

function findLastIndex<T>(list: T[], pred: (t: T) => boolean): number {
  for (let i = list.length - 1; i >= 0; i -= 1) if (pred(list[i])) return i;
  return -1;
}

/** Whether anything queued is about `id` or a row under it. */
export function hasPendingFor(ops: readonly WriteOp[], id: string): boolean {
  return ops.some((o) => touches(o, id));
}

/**
 * Workouts with a delete still waiting in the queue: a discard, or a
 * finished workout deleted from History. Reads leave these out, so the
 * workout is gone from every screen before the delete reaches the server.
 * A delete that swallowed an unsent insert is not here, and need not be:
 * the server never had that workout.
 */
export function pendingWorkoutDeletes(ops: readonly WriteOp[]): string[] {
  return ops.flatMap((o) => (o.kind === "delete" && o.table === "workouts" ? [o.id] : []));
}

// ---------------------------------------------------------------------------
// Failures
// ---------------------------------------------------------------------------

/** What a failed send reports. The shape of a PostgREST error plus the HTTP status. */
export type SyncError = { status: number; code: string; message: string };

/**
 * - `network`: no response at all. Retried forever: the phone is offline.
 * - `auth`: no usable session, or the token expired. Retried forever; the
 *   session refreshes, or the user signs back in.
 * - `server`: the server answered but may answer differently later.
 *   Retried, then given up on after MAX_SERVER_ATTEMPTS.
 * - `permanent`: the database refused the row (a missing parent, a CHECK,
 *   RLS). Sending it again cannot help.
 */
export type SyncErrorKind = "network" | "auth" | "server" | "permanent";

/** Server errors tried this many times before the op is given up on. */
export const MAX_SERVER_ATTEMPTS = 10;

/**
 * Postgres error classes that describe the moment, not the row: connection
 * trouble, a serialization or deadlock rollback, resource limits, a
 * cancelled statement, a system error.
 */
const TRANSIENT_SQLSTATE_CLASSES = ["08", "40", "53", "57", "58"];

export function classifySyncError(error: SyncError): SyncErrorKind {
  const { status, code } = error;
  if (code === "NO_SESSION") return "auth";
  if (status === 0) return "network";
  if (status === 401 || /^PGRST30\d$/.test(code)) return "auth";
  // PostgREST could not reach the database.
  if (/^PGRST00\d$/.test(code)) return "server";
  if (code.length === 5 && TRANSIENT_SQLSTATE_CLASSES.includes(code.slice(0, 2))) return "server";
  if (status === 408 || status === 429 || status >= 500) return "server";
  return "permanent";
}

/** Wait before the next attempt: 2 s, 4 s, 8 s, 16 s, then 30 s for good. */
export function retryDelayMs(failuresInARow: number): number {
  return Math.min(2000 * 2 ** Math.max(0, failuresInARow - 1), 30_000);
}

/**
 * Splits the queue when `failed` (its head) fails for good. Everything later
 * that depends on a row `failed` would have created goes with it: those
 * would only fail the same way, one request at a time. Transitive, so a
 * failed workout insert takes its exercises and their sets.
 */
export function splitOnFailure(ops: readonly WriteOp[], failed: WriteOp): { keep: WriteOp[]; dropped: WriteOp[] } {
  const dead = new Set<string>(failed.kind === "insert" ? failed.rows.map((r) => r.id) : []);
  const keep: WriteOp[] = [];
  const dropped: WriteOp[] = [failed];
  for (const op of ops) {
    if (op.seq === failed.seq) continue;
    if (op.kind === "insert") {
      const lost = op.rows.filter((r) => dead.has(r.id) || r.parents.some((p) => dead.has(p)));
      if (lost.length === 0) {
        keep.push(op);
        continue;
      }
      for (const r of lost) dead.add(r.id);
      dropped.push({ ...op, rows: lost });
      if (lost.length < op.rows.length) keep.push({ ...op, rows: op.rows.filter((r) => !lost.includes(r)) });
      continue;
    }
    if (dead.has(op.id) || op.parents.some((p) => dead.has(p))) dropped.push(op);
    else keep.push(op);
  }
  return { keep, dropped };
}

/**
 * Parses a stored queue. Anything unreadable is null, and the runner sets
 * the raw value aside rather than lose it.
 */
export function parseQueueState(raw: string | null): QueueState | null {
  if (raw == null) return EMPTY_QUEUE;
  try {
    const parsed = JSON.parse(raw) as Partial<QueueState> | null;
    if (!parsed || typeof parsed.nextSeq !== "number" || !Array.isArray(parsed.ops)) return null;
    const ok = parsed.ops.every(
      (o) =>
        o != null &&
        typeof o.seq === "number" &&
        typeof o.userId === "string" &&
        (o.kind === "insert" ? Array.isArray(o.rows) : o.kind === "update" || o.kind === "delete"),
    );
    return ok ? { nextSeq: parsed.nextSeq, ops: parsed.ops } : null;
  } catch {
    return null;
  }
}
