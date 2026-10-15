import { describe, expect, it, vi } from "vitest";

import { failedWritesKey, writeQueueKey, type Row, type SyncError, type WriteOp } from "./write-queue";
import { WriteQueue, type QueueStorage, type QueueTransport } from "./write-queue-runner";
import { E, W, ops } from "./write-queue.fixtures";

/** Device storage in memory. `delay` holds every write until released, to test ordering. */
function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage: QueueStorage = {
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => {
      data.set(k, v);
    },
  };
  return { storage, data };
}

/**
 * The three tables, with the behaviour the queue relies on: an insert is
 * ON CONFLICT (id) DO NOTHING, a missing parent is 23503, deletes cascade,
 * and an update of a missing row changes nothing.
 */
function fakeServer() {
  const tables = {
    workouts: new Map<string, Row>(),
    workout_exercises: new Map<string, Row>(),
    sets: new Map<string, Row>(),
    templates: new Map<string, Row>(),
  };
  const parentOf = {
    workouts: null,
    workout_exercises: ["workouts", "workout_id"],
    sets: ["workout_exercises", "workout_exercise_id"],
    templates: null,
  } as const;
  const sent: WriteOp[] = [];

  function cascade(table: keyof typeof tables, id: string) {
    tables[table].delete(id);
    if (table === "workouts") {
      for (const [k, r] of tables.workout_exercises) if (r.workout_id === id) cascade("workout_exercises", k);
    }
    if (table === "workout_exercises") {
      for (const [k, r] of tables.sets) if (r.workout_exercise_id === id) tables.sets.delete(k);
    }
    // workouts.template_id is ON DELETE SET NULL, as in the live schema.
    if (table === "templates") {
      for (const [k, r] of tables.workouts) if (r.template_id === id) tables.workouts.set(k, { ...r, template_id: null });
    }
  }

  function apply(op: WriteOp): SyncError | null {
    sent.push(op);
    const t = tables[op.table];
    if (op.kind === "insert") {
      const parent = parentOf[op.table];
      for (const r of op.rows) {
        if (parent && !tables[parent[0]].has(r.values[parent[1]] as string)) {
          return { status: 409, code: "23503", message: "violates foreign key constraint" };
        }
      }
      for (const r of op.rows) if (!t.has(r.id)) t.set(r.id, { ...r.values });
    } else if (op.kind === "update") {
      const row = t.get(op.id);
      if (row && (!op.onlyIfNull || row[op.onlyIfNull] == null)) t.set(op.id, { ...row, ...op.patch });
    } else {
      cascade(op.table, op.id);
    }
    return null;
  }

  return { tables, sent, apply };
}

type Mode = "online" | "offline" | "lose-response";

function setup(opts: { initial?: Record<string, string>; failWith?: (op: WriteOp) => SyncError | null } = {}) {
  const { storage, data } = memoryStorage(opts.initial);
  const server = fakeServer();
  let mode: Mode = "online";
  const transport: QueueTransport = async (op) => {
    if (mode === "offline") return { ok: false, error: { status: 0, code: "", message: "TypeError: Network request failed" } };
    const injected = opts.failWith?.(op);
    if (injected) return { ok: false, error: injected };
    const error = server.apply(op);
    if (mode === "lose-response") {
      mode = "online";
      throw new Error("response lost");
    }
    return error ? { ok: false, error } : { ok: true };
  };
  const timers: { fn: () => void; ms: number }[] = [];
  const sentOps: WriteOp[] = [];
  const failed = vi.fn();
  const queue = new WriteQueue({
    storage,
    transport,
    now: () => 1_000,
    // A fired or cancelled timer leaves the list, so `timers` is what is still pending.
    setTimer: (fn, ms) => {
      const t = {
        fn: () => {
          timers.splice(timers.indexOf(t), 1);
          fn();
        },
        ms,
      };
      timers.push(t);
      return () => {
        if (timers.includes(t)) timers.splice(timers.indexOf(t), 1);
      };
    },
    onSent: (op) => sentOps.push(op),
    onFailed: failed,
  });
  return {
    queue,
    data,
    server,
    timers,
    sentOps,
    failed,
    setMode: (m: Mode) => {
      mode = m;
    },
    stored: (userId = "u1") => JSON.parse(data.get(writeQueueKey(userId)) ?? "null"),
  };
}

describe("WriteQueue", () => {
  it("removes a saved routine and keeps the workouts done from it, unlinked", async () => {
    const t = setup();
    await t.queue.setUser("u1");
    t.server.tables.templates.set("t1", { id: "t1", user_id: "u1" });
    t.server.tables.workouts.set("w0", { id: "w0", user_id: "u1", template_id: "t1", finished_at: "2026-09-28T10:00:00Z" });
    t.setMode("offline");
    await t.queue.enqueue("u1", ops.removeTemplate("t1"));
    expect(t.server.tables.templates.has("t1")).toBe(true);
    t.setMode("online");
    await t.queue.drain();
    expect(t.server.tables.templates.has("t1")).toBe(false);
    expect(t.server.tables.workouts.get("w0")).toMatchObject({ id: "w0", template_id: null, finished_at: "2026-09-28T10:00:00Z" });
  });

  it("saves an op to the device before enqueue resolves", async () => {
    const t = setup();
    await t.queue.setUser("u1");
    t.setMode("offline");
    await t.queue.enqueue("u1", ops.workout());
    expect(t.stored().ops).toHaveLength(1);
    expect(t.stored().ops[0]).toMatchObject({ seq: 1, userId: "u1", kind: "insert" });
  });

  it("sends in order, one at a time, and empties the stored queue", async () => {
    const t = setup();
    await t.queue.setUser("u1");
    let inFlight = 0;
    let most = 0;
    const slow = new WriteQueue({
      storage: memoryStorage().storage,
      transport: async (op) => {
        inFlight += 1;
        most = Math.max(most, inFlight);
        await new Promise((r) => setTimeout(r, 1));
        t.server.apply(op);
        inFlight -= 1;
        return { ok: true };
      },
    });
    await slow.setUser("u1");
    await Promise.all([
      slow.enqueue("u1", ops.workout()),
      slow.enqueue("u1", ops.exercise()),
      slow.enqueue("u1", ops.sets(["s1", "s2"])),
    ]);
    await slow.drain();
    expect(most).toBe(1);
    expect(t.server.sent.map((o) => o.table)).toEqual(["workouts", "workout_exercises", "sets"]);
    expect(t.server.tables.sets.size).toBe(2);
  });

  it("stops at the first network failure, keeps the op, and sends nothing after it", async () => {
    const t = setup();
    await t.queue.setUser("u1");
    t.setMode("offline");
    await t.queue.enqueue("u1", ops.workout());
    await t.queue.enqueue("u1", ops.exercise());
    await t.queue.drain();
    expect(t.server.sent).toEqual([]);
    expect(t.queue.pending()).toHaveLength(2);
    expect(t.queue.status()).toMatchObject({ state: "offline", pending: 2, failingSince: 1_000 });
    expect(t.stored().ops[0].attempts).toBeGreaterThan(0);
    // One retry is scheduled, not one per failure.
    expect(t.timers).toHaveLength(1);
  });

  it("sends everything once back online, on the retry timer", async () => {
    const t = setup();
    await t.queue.setUser("u1");
    t.setMode("offline");
    await t.queue.enqueue("u1", ops.workout());
    await t.queue.enqueue("u1", ops.exercise());
    await t.queue.enqueue("u1", ops.sets(["s1"]));
    await t.queue.enqueue("u1", ops.setUpdate("s1", { reps: 5, completed: true }));
    await t.queue.enqueue("u1", ops.finish());
    await t.queue.flush();
    t.setMode("online");
    t.timers[0].fn();
    await t.queue.drain();
    expect(t.queue.status()).toMatchObject({ state: "idle", pending: 0, failingSince: null });
    expect(t.server.tables.sets.get("s1")).toMatchObject({ reps: 5, completed: true });
    expect(t.server.tables.workouts.get(W)?.finished_at).toBeTruthy();
    expect(t.stored().ops).toEqual([]);
  });

  it("backs off 2 s, 4 s, 8 s while offline, and starts again at 2 s after a success", async () => {
    const t = setup();
    await t.queue.setUser("u1");
    t.setMode("offline");
    await t.queue.enqueue("u1", ops.workout());
    await t.queue.flush();
    const waits = [t.timers[0].ms];
    for (let i = 0; i < 2; i += 1) {
      t.timers[0].fn();
      await t.queue.flush();
      waits.push(t.timers[0].ms);
    }
    expect(waits).toEqual([2000, 4000, 8000]);
    t.setMode("online");
    t.timers[0].fn();
    await t.queue.drain();
    t.setMode("offline");
    await t.queue.enqueue("u1", ops.exercise());
    await t.queue.flush();
    expect(t.timers.at(-1)?.ms).toBe(2000);
  });

  it("a lost response and a retry do not duplicate a row", async () => {
    const t = setup();
    await t.queue.setUser("u1");
    await t.queue.enqueue("u1", ops.workout());
    await t.queue.enqueue("u1", ops.exercise());
    await t.queue.drain();
    t.setMode("lose-response");
    await t.queue.enqueue("u1", ops.sets(["s1", "s2"]));
    await t.queue.flush();
    // The server has the rows, the device does not know it.
    expect(t.server.tables.sets.size).toBe(2);
    expect(t.queue.pending()).toHaveLength(1);
    t.timers[0].fn();
    await t.queue.drain();
    expect(t.server.sent.filter((o) => o.table === "sets")).toHaveLength(2);
    expect(t.server.tables.sets.size).toBe(2);
    expect(t.queue.pending()).toHaveLength(0);
  });

  it("an update whose response was lost is sent again with the same values", async () => {
    const t = setup();
    await t.queue.setUser("u1");
    await t.queue.enqueue("u1", ops.workout());
    await t.queue.enqueue("u1", ops.exercise());
    await t.queue.enqueue("u1", ops.sets(["s1"]));
    await t.queue.drain();
    t.setMode("lose-response");
    await t.queue.enqueue("u1", ops.setUpdate("s1", { reps: 8 }));
    await t.queue.flush();
    t.timers[0].fn();
    await t.queue.drain();
    expect(t.server.tables.sets.get("s1")?.reps).toBe(8);
  });

  it("offline Finish then two note edits: after reconnecting the newest note stands", async () => {
    const t = setup();
    await t.queue.setUser("u1");
    t.setMode("offline");
    await t.queue.enqueue("u1", ops.workout());
    await t.queue.enqueue("u1", ops.notes("during"));
    await t.queue.enqueue("u1", ops.finish());
    await t.queue.enqueue("u1", ops.notes("felt strong"));
    await t.queue.enqueue("u1", ops.notes("felt strong, slept badly"));
    expect(t.server.tables.workouts.size).toBe(0);

    t.setMode("online");
    await t.queue.drain();
    expect(t.server.tables.workouts.get(W)).toMatchObject({
      finished_at: "2026-09-29T18:00:00.000Z",
      notes: "felt strong, slept badly",
    });
    expect(t.server.sent.map((o) => (o.kind === "update" ? Object.keys(o.patch) : o.kind))).toEqual([
      "insert",
      ["finished_at"],
      ["notes"],
    ]);
    expect(t.queue.pending()).toHaveLength(0);
  });

  it("a finish sent again after a lost response leaves a later note alone", async () => {
    const t = setup();
    await t.queue.setUser("u1");
    await t.queue.enqueue("u1", ops.workout());
    await t.queue.drain();
    t.setMode("lose-response");
    await t.queue.enqueue("u1", ops.finish());
    await t.queue.flush();
    // The server has the finish, the device does not know it.
    t.setMode("offline");
    await t.queue.enqueue("u1", ops.notes("felt strong"));
    t.setMode("online");
    // The retry timer the failed sends left behind.
    t.timers.at(-1)?.fn();
    await t.queue.drain();
    expect(t.server.sent.map((o) => (o.kind === "update" ? Object.keys(o.patch) : o.kind))).toEqual([
      "insert",
      ["finished_at"],
      ["finished_at"],
      ["notes"],
    ]);
    expect(t.server.tables.workouts.get(W)).toMatchObject({
      finished_at: "2026-09-29T18:00:00.000Z",
      notes: "felt strong",
    });
  });

  it("moves a refused op and everything under it to the failed list, and carries on", async () => {
    // The workout was deleted on another device: its exercise insert is 23503.
    const t = setup();
    await t.queue.setUser("u1");
    t.setMode("offline");
    await t.queue.enqueue("u1", ops.exercise());
    await t.queue.enqueue("u1", ops.sets(["s1"]));
    await t.queue.enqueue("u1", ops.setUpdate("s1", { reps: 1 }));
    await t.queue.enqueue("u1", ops.workout("w2"));
    t.setMode("online");
    await t.queue.drain();
    expect(t.server.tables.workouts.has("w2")).toBe(true);
    expect(t.queue.pending()).toEqual([]);
    const failedList = JSON.parse(t.data.get(failedWritesKey("u1"))!);
    expect(failedList.map((f: { op: WriteOp }) => f.op.table)).toEqual(["workout_exercises", "sets"]);
    expect(failedList[0].error.code).toBe("23503");
    expect(t.failed).toHaveBeenCalledTimes(1);
    expect(t.queue.status().failed).toBe(2);
    // The dependent set insert was never sent.
    expect(t.server.sent.map((o) => o.table)).toEqual(["workout_exercises", "workouts"]);
  });

  it("treats an RLS refusal as permanent and an expired token as worth retrying", async () => {
    const rls = setup({ failWith: () => ({ status: 403, code: "42501", message: "row-level security" }) });
    await rls.queue.setUser("u1");
    await rls.queue.enqueue("u1", ops.workout());
    await rls.queue.drain();
    expect(rls.queue.status()).toMatchObject({ pending: 0, failed: 1 });

    const jwt = setup({ failWith: () => ({ status: 401, code: "PGRST303", message: "JWT expired" }) });
    await jwt.queue.setUser("u1");
    await jwt.queue.enqueue("u1", ops.workout());
    await jwt.queue.drain();
    expect(jwt.queue.status()).toMatchObject({ state: "retrying", pending: 1, failed: 0 });
  });

  it("gives up on a server error after ten tries, but never on the network", async () => {
    const t = setup({ failWith: () => ({ status: 500, code: "XX000", message: "internal" }) });
    await t.queue.setUser("u1");
    await t.queue.enqueue("u1", ops.workout());
    await t.queue.flush();
    for (let i = 0; i < 20 && t.queue.pending().length > 0; i += 1) {
      t.timers[0]?.fn();
      await t.queue.flush();
    }
    expect(t.queue.status()).toMatchObject({ pending: 0, failed: 1 });

    const off = setup();
    await off.queue.setUser("u1");
    off.setMode("offline");
    await off.queue.enqueue("u1", ops.workout());
    for (let i = 0; i < 30; i += 1) {
      off.timers[0]?.fn();
      await off.queue.flush();
    }
    expect(off.queue.status()).toMatchObject({ pending: 1, failed: 0 });
  });

  it("never gives up on an expired token, however many sends it fails", async () => {
    // What PostgREST answers a request whose JWT expired between the
    // session check and the send, and what a missing session looks like.
    for (const error of [
      { status: 401, code: "PGRST303", message: "JWT expired" },
      { status: 401, code: "", message: "JWT expired" },
      { status: 0, code: "NO_SESSION", message: "No session for this user" },
    ]) {
      const t = setup({ failWith: () => error });
      await t.queue.setUser("u1");
      await t.queue.enqueue("u1", ops.workout());
      for (let i = 0; i < 40; i += 1) {
        t.timers[0]?.fn();
        await t.queue.flush();
      }
      expect(t.queue.status()).toMatchObject({ state: "retrying", pending: 1, failed: 0 });
      expect(t.failed).not.toHaveBeenCalled();
    }
  });

  it("shares one run between overlapping flush calls", async () => {
    let calls = 0;
    const q = new WriteQueue({
      storage: memoryStorage().storage,
      transport: async () => {
        calls += 1;
        await new Promise((r) => setTimeout(r, 1));
        return { ok: true };
      },
    });
    await q.setUser("u1");
    await q.enqueue("u1", ops.workout());
    const a = q.flush();
    const b = q.flush();
    expect(a).toBe(b);
    await Promise.all([a, b]);
    expect(calls).toBe(1);
  });

  it("sends an op queued mid-run in the same run", async () => {
    let release: () => void = () => {};
    const sent: string[] = [];
    const q = new WriteQueue({
      storage: memoryStorage().storage,
      transport: async (op) => {
        if (sent.length === 0) await new Promise<void>((r) => (release = r));
        sent.push(op.table);
        return { ok: true };
      },
    });
    await q.setUser("u1");
    await q.enqueue("u1", ops.workout());
    const run = q.flush();
    await q.enqueue("u1", ops.exercise());
    release();
    await run;
    expect(sent).toEqual(["workouts", "workout_exercises"]);
    expect(q.pending()).toEqual([]);
  });

  it("does not fold an update into the insert being sent", async () => {
    let release: () => void = () => {};
    const bodies: unknown[] = [];
    const q = new WriteQueue({
      storage: memoryStorage().storage,
      transport: async (op) => {
        if (bodies.length === 0) await new Promise<void>((r) => (release = r));
        bodies.push(op.kind === "insert" ? op.rows[0].values : op.kind === "update" ? op.patch : null);
        return { ok: true };
      },
    });
    await q.setUser("u1");
    await q.enqueue("u1", ops.sets(["s1"]));
    const run = q.flush();
    await q.enqueue("u1", ops.setUpdate("s1", { reps: 7 }));
    release();
    await run;
    expect(bodies).toEqual([expect.objectContaining({ reps: null }), { reps: 7 }]);
  });

  it("picks up where it left off after a restart", async () => {
    const first = setup();
    await first.queue.setUser("u1");
    first.setMode("offline");
    await first.queue.enqueue("u1", ops.workout());
    await first.queue.enqueue("u1", ops.exercise());
    await first.queue.flush();

    // A new runner over the same storage: the app was killed and reopened.
    const reopened = setup({ initial: Object.fromEntries(first.data) });
    await reopened.queue.setUser("u1");
    expect(reopened.queue.pending().map((o) => o.seq)).toEqual([1, 2]);
    await reopened.queue.enqueue("u1", ops.sets(["s1"]));
    expect(reopened.queue.pending().map((o) => o.seq)).toEqual([1, 2, 3]);
    await reopened.queue.drain();
    expect(reopened.server.tables.sets.has("s1")).toBe(true);
  });

  it("never sends one user's ops for another", async () => {
    const t = setup();
    await t.queue.setUser("guest");
    t.setMode("offline");
    await t.queue.enqueue("guest", ops.workout("guest-w"));
    await t.queue.flush();
    t.setMode("online");
    await t.queue.setUser("u1");
    await t.queue.enqueue("u1", ops.workout());
    await t.queue.drain();
    expect(t.server.sent.map((o) => o.userId)).toEqual(["u1"]);
    expect(t.stored("guest").ops).toHaveLength(1);
    // And refuses a write for a user who is not signed in.
    expect(await t.queue.enqueue("guest", ops.workout("late"))).toBe(false);
  });

  it("saves the last send of a user being switched away from under that user", async () => {
    let release: () => void = () => {};
    const { storage, data } = memoryStorage();
    const q = new WriteQueue({
      storage,
      transport: async () => {
        await new Promise<void>((r) => (release = r));
        return { ok: true };
      },
    });
    await q.setUser("a");
    await q.enqueue("a", ops.workout());
    const switching = q.setUser("b");
    release();
    await switching;
    expect(JSON.parse(data.get(writeQueueKey("a"))!).ops).toEqual([]);
    expect(data.get(writeQueueKey("b"))).toBeUndefined();
  });

  it("sets an unreadable queue aside and starts empty", async () => {
    const t = setup({ initial: { [writeQueueKey("u1")]: "{not json" } });
    await t.queue.setUser("u1");
    expect(t.queue.pending()).toEqual([]);
    const kept = [...t.data.entries()].find(([k]) => k.startsWith(`${writeQueueKey("u1")}:unreadable:`));
    expect(kept?.[1]).toBe("{not json");
  });

  it("tells listeners how many writes are waiting", async () => {
    const t = setup();
    await t.queue.setUser("u1");
    const seen: number[] = [];
    t.queue.subscribe((s) => seen.push(s.pending));
    t.setMode("offline");
    await t.queue.enqueue("u1", ops.workout());
    await t.queue.flush();
    t.setMode("online");
    await t.queue.drain();
    expect(seen[0]).toBe(1);
    expect(seen.at(-1)).toBe(0);
  });

  it("reports whether a workout still has writes waiting", async () => {
    const t = setup();
    await t.queue.setUser("u1");
    t.setMode("offline");
    await t.queue.enqueue("u1", ops.setUpdate("s1", { reps: 1 }, E, W));
    expect(t.queue.hasPendingFor(W)).toBe(true);
    expect(await t.queue.drain()).toBe(false);
  });
});

describe("WriteQueue hold and adopt (guest merge)", () => {
  it("hold waits for the op in flight and sends nothing more until release", async () => {
    let answer: () => void = () => {};
    const sent: string[] = [];
    const { storage } = memoryStorage();
    const q = new WriteQueue({
      storage,
      transport: async (op) => {
        sent.push(op.kind === "insert" ? op.rows[0].id : op.id);
        if (sent.length === 1) await new Promise<void>((r) => (answer = r));
        return { ok: true };
      },
    });
    await q.setUser("g");
    await q.enqueue("g", ops.workout("a"));
    const holding = q.hold();
    let held = false;
    void holding.then(() => (held = true));
    await Promise.resolve();
    expect(held).toBe(false);
    answer();
    await holding;
    await q.enqueue("g", ops.workout("b"));
    await q.flush();
    expect(sent).toEqual(["a"]);
    q.release();
    await q.drain();
    expect(sent).toEqual(["a", "b"]);
  });

  it("adopt puts the guest's ops first, with the account's id in every row, and empties the guest's keys", async () => {
    const t = setup();
    t.setMode("offline");
    await t.queue.setUser("guest");
    await t.queue.enqueue("guest", {
      kind: "insert",
      table: "workouts",
      rows: [{ id: "gw", parents: [], values: { id: "gw", user_id: "guest" } }],
    });
    await t.queue.enqueue("guest", ops.setUpdate("s1", { reps: 5 }));
    await t.queue.flush();
    await t.queue.setUser("acct");
    await t.queue.enqueue("acct", {
      kind: "insert",
      table: "workouts",
      rows: [{ id: "aw", parents: [], values: { id: "aw", user_id: "acct" } }],
    });
    await t.queue.flush();

    expect(await t.queue.adopt("guest")).toBe(2);

    const pending = t.queue.pending();
    expect(pending.map((o) => (o.kind === "insert" ? o.rows[0].id : o.id))).toEqual(["gw", "s1", "aw"]);
    expect(pending.every((o) => o.userId === "acct")).toBe(true);
    const first = pending[0];
    expect(first.kind === "insert" && first.rows[0].values.user_id).toBe("acct");
    // Numbered on from the account's queue, never reused.
    const seqs = pending.map((o) => o.seq);
    expect(new Set(seqs).size).toBe(3);
    expect(Math.min(...seqs)).toBeGreaterThan(1);
    expect(t.stored("acct").ops).toHaveLength(3);
    expect(t.stored("guest")).toEqual({ nextSeq: 1, ops: [] });
    expect(JSON.parse(t.data.get(failedWritesKey("guest"))!)).toEqual([]);

    t.setMode("online");
    await t.queue.drain();
    expect(t.server.tables.workouts.get("gw")?.user_id).toBe("acct");
  });

  it("adopt moves the guest's failed writes ahead of the account's", async () => {
    const guestFailed = [{ op: { ...ops.workout("x"), seq: 1, userId: "guest", enqueuedAt: 0, attempts: 1 }, error: { status: 403, code: "42501", message: "rls" }, at: 5 }];
    const acctFailed = [{ op: { ...ops.workout("y"), seq: 1, userId: "acct", enqueuedAt: 0, attempts: 1 }, error: { status: 403, code: "42501", message: "rls" }, at: 9 }];
    const t = setup({
      initial: {
        [failedWritesKey("guest")]: JSON.stringify(guestFailed),
        [failedWritesKey("acct")]: JSON.stringify(acctFailed),
      },
    });
    await t.queue.setUser("acct");
    await t.queue.adopt("guest");
    const all = JSON.parse(t.data.get(failedWritesKey("acct"))!) as { op: WriteOp; at: number }[];
    expect(all.map((f) => f.at)).toEqual([5, 9]);
    expect(all.every((f) => f.op.userId === "acct")).toBe(true);
    expect(t.queue.status().failed).toBe(2);
  });

  it("adopt with nothing stored for the guest changes nothing", async () => {
    const t = setup();
    await t.queue.setUser("acct");
    expect(await t.queue.adopt("guest")).toBe(0);
    expect(t.data.has(writeQueueKey("guest"))).toBe(false);
    expect(await t.queue.adopt("acct")).toBe(0);
  });

  it("adopt run twice adds the ops once", async () => {
    const t = setup();
    t.setMode("offline");
    await t.queue.setUser("guest");
    await t.queue.enqueue("guest", ops.workout("gw"));
    await t.queue.flush();
    await t.queue.setUser("acct");
    await t.queue.adopt("guest");
    await t.queue.adopt("guest");
    expect(t.queue.pending()).toHaveLength(1);
  });
});
