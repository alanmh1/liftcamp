// The offline write queue's runner: keeps one user's queue on the device,
// sends it in order, and retries until the server has every op.
//
// Storage, the network and the clock are passed in, so this runs the same
// under vitest as on a phone. The mobile app wires AsyncStorage and the
// Supabase client in apps/mobile/src/data/write-queue.ts.

import {
  EMPTY_QUEUE,
  MAX_SERVER_ATTEMPTS,
  addOp,
  classifySyncError,
  failedWritesKey,
  hasPendingFor,
  parseQueueState,
  retryDelayMs,
  splitOnFailure,
  writeQueueKey,
  type QueueState,
  type SyncError,
  type SyncErrorKind,
  type WriteOp,
  type WriteOpBody,
} from "./write-queue";
import { prependOps, rekeyFailed, rekeyOps } from "./guest-merge";

export type QueueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

/** Sends one op. Resolves with the outcome; a throw counts as a network failure. */
export type QueueTransport = (op: WriteOp) => Promise<{ ok: true } | { ok: false; error: SyncError }>;

export type FailedWrite = { op: WriteOp; error: SyncError; at: number };

export type SyncState =
  /** Nothing waiting. */
  | "idle"
  /** Sending. */
  | "syncing"
  /** The last send got no response. Waiting to try again. */
  | "offline"
  /** The last send failed for another reason worth retrying. Waiting to try again. */
  | "retrying";

export type SyncStatus = {
  state: SyncState;
  /** Ops waiting to be sent. */
  pending: number;
  /** Writes given up on for this user, kept on the device. */
  failed: number;
  /** Epoch ms of the first failure in the current run of failures, or null. */
  failingSince: number | null;
};

/** At most this many failed writes are kept on the device, newest last. */
const MAX_FAILED_KEPT = 200;

export type WriteQueueOptions = {
  storage: QueueStorage;
  transport: QueueTransport;
  now?: () => number;
  /** Schedules a retry. Returns a cancel function. */
  setTimer?: (fn: () => void, ms: number) => () => void;
  /** After the server confirms an op. The app clears its read caches here. */
  onSent?: (op: WriteOp) => void;
  /** After ops are given up on and moved to the failed list. */
  onFailed?: (failed: FailedWrite[]) => void;
};

export class WriteQueue {
  private storage: QueueStorage;
  private transport: QueueTransport;
  private now: () => number;
  private setTimer: (fn: () => void, ms: number) => () => void;
  private onSent?: (op: WriteOp) => void;
  private onFailed?: (failed: FailedWrite[]) => void;

  private userIdValue: string | null = null;
  private state: QueueState = EMPTY_QUEUE;
  /**
   * Whose queue `state` is. Trails `userIdValue` while a switch waits for
   * the previous user's last send, so that send is saved to the right key.
   */
  private stateOwner: string | null = null;
  private failedCount = 0;
  /** Resolves once the current user's queue has been read from storage. */
  private loading: Promise<void> = Promise.resolve();
  /** Every storage write, in order, so a later snapshot can never land first. */
  private writes: Promise<void> = Promise.resolve();
  private running: Promise<void> | null = null;
  private inFlightSeq: number | null = null;
  private failuresInARow = 0;
  private failingSince: number | null = null;
  private syncState: SyncState = "idle";
  private cancelRetry: (() => void) | null = null;
  private listeners = new Set<(status: SyncStatus) => void>();
  /** While above zero, nothing is sent (hold, adopt). */
  private holds = 0;

  constructor(options: WriteQueueOptions) {
    this.storage = options.storage;
    this.transport = options.transport;
    this.now = options.now ?? Date.now;
    this.setTimer =
      options.setTimer ??
      ((fn, ms) => {
        const t = setTimeout(fn, ms);
        return () => clearTimeout(t);
      });
    this.onSent = options.onSent;
    this.onFailed = options.onFailed;
  }

  get userId(): string | null {
    return this.userIdValue;
  }

  /**
   * Switches to a user's queue, or with null to none. Waits for a send in
   * progress, which belongs to the previous user, before switching. Another
   * user's ops stay on the device, untouched, until that user is back.
   */
  async setUser(userId: string | null): Promise<void> {
    if (userId === this.userIdValue) return this.loading;
    this.userIdValue = userId;
    this.loading = (async () => {
      await this.running;
      await this.writes;
      this.cancelRetry?.();
      this.cancelRetry = null;
      this.failuresInARow = 0;
      this.failingSince = null;
      this.state = EMPTY_QUEUE;
      this.stateOwner = null;
      this.failedCount = 0;
      if (userId) {
        this.state = await this.read(userId);
        this.stateOwner = userId;
        this.failedCount = (await this.readFailed(userId)).length;
      }
      this.syncState = "idle";
      this.emit();
    })();
    return this.loading;
  }

  /** The ops still waiting, oldest first. */
  pending(): readonly WriteOp[] {
    return this.state.ops;
  }

  /** Whether anything queued is about `id` or a row under it. */
  hasPendingFor(id: string): boolean {
    return hasPendingFor(this.state.ops, id);
  }

  status(): SyncStatus {
    return {
      state: this.state.ops.length === 0 ? "idle" : this.syncState,
      pending: this.state.ops.length,
      failed: this.failedCount,
      failingSince: this.failingSince,
    };
  }

  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Queues a write for `userId` and resolves once it is saved on the
   * device, then starts sending. A write for a user other than the current
   * one is refused: it could only be a stale screen after a sign-out.
   */
  async enqueue(userId: string, body: WriteOpBody): Promise<boolean> {
    await this.loading;
    if (userId !== this.userIdValue) return false;
    this.state = addOp(this.state, body, { userId, now: this.now(), inFlightSeq: this.inFlightSeq });
    await this.persist();
    this.emit();
    void this.flush();
    return true;
  }

  /**
   * Sends everything it can. One run at a time: a call while one is going
   * returns that run. Stops at the first failure worth retrying and
   * schedules the next attempt.
   */
  flush(): Promise<void> {
    if (!this.running) {
      this.running = this.run().finally(() => {
        this.running = null;
      });
    }
    return this.running;
  }

  /** Flushes and reports whether the queue is empty afterwards. */
  async drain(): Promise<boolean> {
    await this.loading;
    // A run already going may have stopped on a failure before this call;
    // after it, one fresh attempt, not the retry timer's.
    await this.running;
    await this.flush();
    // An op queued during the run is sent by that run, so one pass is enough.
    return this.state.ops.length === 0;
  }

  /**
   * Stops sending, and resolves once the op in flight (if any) has its
   * answer. Ops can still be queued. Every hold needs a release.
   */
  async hold(): Promise<void> {
    this.holds += 1;
    this.cancelRetry?.();
    this.cancelRetry = null;
    await this.running;
  }

  /** Ends a hold; the last one starts sending again. */
  release(): void {
    this.holds = Math.max(0, this.holds - 1);
    if (this.holds === 0) void this.flush();
  }

  /**
   * Takes another user's stored queue and failed list into the current
   * user's: the guest's, once the server has moved the guest's rows to this
   * account. Their ops go first, with the user id swapped in every row; the
   * other user's keys are emptied. Returns how many ops moved.
   *
   * A crash between the two writes leaves the ops in both queues, which
   * only means they are sent twice, and every op is safe to send twice.
   */
  async adopt(fromUserId: string): Promise<number> {
    await this.loading;
    const toUserId = this.userIdValue;
    if (!toUserId || toUserId === fromUserId) return 0;
    await this.hold();
    try {
      const theirs = await this.read(fromUserId);
      const theirFailed = await this.readFailed(fromUserId);
      if (theirs.ops.length === 0 && theirFailed.length === 0) return 0;
      if (theirs.ops.length > 0) {
        this.state = prependOps(this.state, rekeyOps(theirs.ops, fromUserId, toUserId));
        await this.persist();
      }
      if (theirFailed.length > 0) {
        const all = [...rekeyFailed(theirFailed, fromUserId, toUserId), ...(await this.readFailed(toUserId))].slice(
          -MAX_FAILED_KEPT,
        );
        await this.chainWrite(failedWritesKey(toUserId), JSON.stringify(all));
        this.failedCount = all.length;
      }
      await this.chainWrite(writeQueueKey(fromUserId), JSON.stringify(EMPTY_QUEUE));
      await this.chainWrite(failedWritesKey(fromUserId), "[]");
      this.emit();
      return theirs.ops.length;
    } finally {
      this.release();
    }
  }

  /** The writes given up on for the current user. */
  async failedWrites(): Promise<FailedWrite[]> {
    await this.loading;
    return this.userIdValue ? this.readFailed(this.userIdValue) : [];
  }

  private async run(): Promise<void> {
    await this.loading;
    this.cancelRetry?.();
    this.cancelRetry = null;
    const userId = this.userIdValue;
    while (userId && userId === this.userIdValue && this.holds === 0) {
      const op = this.state.ops[0];
      if (!op) break;
      this.syncState = "syncing";
      this.emit();

      this.inFlightSeq = op.seq;
      let result: Awaited<ReturnType<QueueTransport>>;
      try {
        result = await this.transport(op);
      } catch (e) {
        result = { ok: false, error: { status: 0, code: "", message: String(e) } };
      }
      this.inFlightSeq = null;

      if (result.ok) {
        this.state = { ...this.state, ops: this.state.ops.filter((o) => o.seq !== op.seq) };
        this.failuresInARow = 0;
        this.failingSince = null;
        await this.persist();
        this.onSent?.(op);
        continue;
      }

      const kind = classifySyncError(result.error);
      const attempts = op.attempts + 1;
      if (kind === "permanent" || (kind === "server" && attempts >= MAX_SERVER_ATTEMPTS)) {
        await this.giveUp({ ...op, attempts }, result.error);
        continue;
      }
      this.retryLater(op, attempts, kind);
      await this.persist();
      break;
    }
    if (this.state.ops.length === 0) {
      this.syncState = "idle";
      this.failuresInARow = 0;
      this.failingSince = null;
    }
    this.emit();
  }

  private retryLater(op: WriteOp, attempts: number, kind: SyncErrorKind) {
    this.state = {
      ...this.state,
      ops: this.state.ops.map((o) => (o.seq === op.seq ? { ...o, attempts } : o)),
    };
    this.failuresInARow += 1;
    this.failingSince ??= this.now();
    this.syncState = kind === "network" ? "offline" : "retrying";
    this.cancelRetry = this.setTimer(() => {
      this.cancelRetry = null;
      void this.flush();
    }, retryDelayMs(this.failuresInARow));
  }

  private async giveUp(op: WriteOp, error: SyncError) {
    const { keep, dropped } = splitOnFailure(this.state.ops, op);
    const at = this.now();
    const failed = dropped.map((d) => ({ op: d, error, at }));
    // The failed list first: a crash between the two writes then leaves the
    // op in both places, which only means it is tried once more.
    const userId = op.userId;
    const all = [...(await this.readFailed(userId)), ...failed].slice(-MAX_FAILED_KEPT);
    await this.chainWrite(failedWritesKey(userId), JSON.stringify(all));
    this.failedCount = all.length;
    this.state = { ...this.state, ops: keep };
    await this.persist();
    this.onFailed?.(failed);
  }

  /** Saves the current queue. Resolves once this snapshot, and every earlier one, is written. */
  private persist(): Promise<void> {
    const owner = this.stateOwner;
    if (!owner) return this.writes;
    return this.chainWrite(writeQueueKey(owner), JSON.stringify(this.state));
  }

  private chainWrite(key: string, value: string): Promise<void> {
    // The value is captured now; the write waits for the ones before it.
    const write = this.writes.then(() => this.storage.setItem(key, value));
    this.writes = write.catch(() => undefined);
    return write;
  }

  private async read(userId: string): Promise<QueueState> {
    const key = writeQueueKey(userId);
    let raw: string | null = null;
    try {
      raw = await this.storage.getItem(key);
    } catch {
      return EMPTY_QUEUE;
    }
    const parsed = parseQueueState(raw);
    if (parsed) return parsed;
    // Unreadable. Kept under another key for a look later, never dropped silently.
    await this.chainWrite(`${key}:unreadable:${this.now()}`, raw ?? "");
    await this.chainWrite(key, JSON.stringify(EMPTY_QUEUE));
    return EMPTY_QUEUE;
  }

  private async readFailed(userId: string): Promise<FailedWrite[]> {
    try {
      const raw = await this.storage.getItem(failedWritesKey(userId));
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      return Array.isArray(parsed) ? (parsed as FailedWrite[]) : [];
    } catch {
      return [];
    }
  }

  private emit() {
    const status = this.status();
    for (const l of this.listeners) l(status);
  }
}
