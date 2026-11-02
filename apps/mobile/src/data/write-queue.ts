import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DraftBuffer,
  WriteQueue,
  authEventUser,
  pendingWorkoutDeletes,
  type FailedWrite,
  type SyncError,
  type WriteOp,
  type WriteOpBody,
} from '@liftcamp/shared';
import { AppState } from 'react-native';

import { clearDeviceWorkout } from '@/data/device-workout';
import { invalidateScanCache } from '@/data/scan-cache';
import { accessTokenExpired, readStoredSession, supabase } from '../../lib/supabase';

/**
 * The device's write queue for workouts, sets and exercises. Every write in
 * workouts.ts goes through here: it is saved on the phone first, then sent
 * one op at a time, in order, until the server has it. With no signal the
 * ops wait on the device, across an app kill, and go out when the phone is
 * back online. The rules and the runner live in @liftcamp/shared
 * (write-queue.ts, write-queue-runner.ts), with their tests.
 *
 * It follows the signed-in user: each user's queue is its own AsyncStorage
 * key (`liftcamp:queue:<userId>`), so a queue never sends as someone else,
 * and account deletion clears it with the other `liftcamp:` keys.
 *
 * It sends when a write is queued, when the app comes to the foreground,
 * when the session changes or refreshes, and on a retry timer (2 s doubling
 * to 30 s) after a failure.
 */

/** A request with no answer by then is treated as no signal. */
const SEND_TIMEOUT_MS = 15_000;

/** How long Finish, and a start, wait for the server before going on without it. */
const CONFIRM_WAIT_MS = 8_000;

type Result = { ok: true } | { ok: false; error: SyncError };

/** What the queue's transport sends for an op. Every one is safe to send twice. */
function request(op: WriteOp) {
  // The ops are built in workouts.ts with the columns each table takes; the
  // generated types cannot follow a table chosen at run time.
  const table = supabase.from(op.table as 'sets');
  if (op.kind === 'insert') {
    return table.upsert(op.rows.map((r) => r.values) as never, { onConflict: 'id', ignoreDuplicates: true });
  }
  if (op.kind === 'update') {
    const q = table.update(op.patch as never).eq('id', op.id);
    // Finish: only while the workout is still unfinished, so the first finish wins.
    return op.onlyIfNull ? q.is(op.onlyIfNull as 'note', null) : q;
  }
  return table.delete().eq('id', op.id);
}

/** auth-js refreshes a token this close to expiry before any request (EXPIRY_MARGIN_MS). */
const REFRESH_MARGIN_S = 90;

async function send(op: WriteOp): Promise<Result> {
  // Only ever as the op's own user, and only with a token that will not
  // need refreshing first. Read from storage rather than getSession(),
  // which waits on auth-js's initialization: with an expired token and no
  // signal that is about 20 s of refresh retries, and Finish waits on this
  // send. An expired token waits instead (a retry, never a failure), and
  // the TOKEN_REFRESHED event sends everything once it is fresh.
  const session = await readStoredSession();
  if (session?.user.id !== op.userId || accessTokenExpired(session, REFRESH_MARGIN_S)) {
    return { ok: false, error: { status: 0, code: 'NO_SESSION', message: 'No fresh session for this user' } };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const { error, status } = await request(op).abortSignal(controller.signal);
    if (!error) return { ok: true };
    return { ok: false, error: { status, code: error.code ?? '', message: error.message } };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A write the server refused for good. Kept on the device under
 * `liftcamp:queue-failed:<userId>`, and reported to `app_events` so it is
 * visible without the phone. Best effort: the report is not queued.
 */
function reportFailed(failed: FailedWrite[]) {
  for (const { op, error } of failed) {
    if (__DEV__) console.warn(`[write-queue] gave up on ${op.kind} ${op.table}: ${error.code} ${error.message}`);
    void supabase.from('app_events').insert({
      user_id: op.userId,
      name: 'write_failed',
      props: {
        table: op.table,
        kind: op.kind,
        ids: op.kind === 'insert' ? op.rows.map((r) => r.id) : [op.id],
        code: error.code,
        status: error.status,
        message: error.message,
        attempts: op.attempts,
      },
    });
  }
}

export const writeQueue = new WriteQueue({
  storage: AsyncStorage,
  transport: send,
  onSent: (op) => {
    // A read cache built before this op landed may be missing it.
    invalidateScanCache();
    // The server now has how the workout ended; the phone's copy is done.
    if (op.table === 'workouts' && (op.kind === 'delete' || (op.kind === 'update' && op.patch.finished_at))) {
      void clearDeviceWorkout(op.id);
    }
  },
  onFailed: reportFailed,
});

supabase.auth.onAuthStateChange((event, session) => {
  // Only a sign-out lets go of the user: a null INITIAL_SESSION is also an
  // expired token with no signal, and its writes must stay queued for it.
  // Every event with a session sends, TOKEN_REFRESHED included, so writes
  // held while the token was expired go out as soon as it is fresh.
  const userId = authEventUser(event, session);
  if (userId === 'keep') return;
  // Deferred: supabase-js asks that the callback not call back into the
  // client, and the first send reads the session.
  setTimeout(() => {
    void writeQueue.setUser(userId).then(() => {
      if (userId) void writeQueue.flush();
    });
  }, 0);
});

AppState.addEventListener('change', (state) => {
  if (state === 'active') void writeQueue.flush();
});

// At launch, from the stored session, so writes held from an earlier run
// load and start sending without waiting for an auth event. With an expired
// token and no signal no event comes until the refresh gets through.
void readStoredSession().then((stored) => {
  if (!stored || writeQueue.userId != null) return;
  void writeQueue.setUser(stored.user.id).then(() => writeQueue.flush());
});

/** Points the queue at `userId` if the auth listener has not yet. */
async function followUser(userId: string): Promise<void> {
  if (writeQueue.userId !== userId) await writeQueue.setUser(userId);
}

/**
 * Queues a write and resolves once it is saved on the phone. False only
 * when it could not be saved (the device refused the write), which the
 * callers treat the way they treated a failed request before the queue.
 */
export async function enqueueWrite(userId: string, body: WriteOpBody): Promise<boolean> {
  // Editing a finished workout: its writes wait in the draft for Save.
  if (draft && draft.userId === userId && draft.buffer.capture(body, draft.workoutId)) return true;
  return queueWrite(userId, body);
}

async function queueWrite(userId: string, body: WriteOpBody): Promise<boolean> {
  try {
    await followUser(userId);
    return await writeQueue.enqueue(userId, body);
  } catch (e) {
    if (__DEV__) console.warn('[write-queue] could not save a write', e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Draft: editing a finished workout
// ---------------------------------------------------------------------------

/**
 * The open edit, if any. While it is open, every write about its workout
 * is held here instead of queued, so Cancel can drop them and the server
 * never sees one. Save queues them in the order they were made, and the
 * queue's merging folds the per-keystroke updates together from there.
 * In memory only: an app kill mid-edit loses the edit, as Cancel would.
 */
let draft: {
  userId: string;
  workoutId: string;
  buffer: DraftBuffer;
  /** Device writes outside the queue, run after Save. One per key; the latest wins. */
  afterSave: Map<string, () => Promise<void>>;
} | null = null;

/** Opens a draft for `workoutId`. Replaces any draft left open. */
export function beginDraft(userId: string, workoutId: string): void {
  draft = { userId, workoutId, buffer: new DraftBuffer(), afterSave: new Map() };
}

/**
 * Holds a write that does not go through the queue (a device cache, say)
 * until Save, when a draft is open for `workoutId`. False when no such
 * draft is open: the caller runs it now. A later call with the same `key`
 * replaces the earlier one, so only the last note typed is remembered.
 */
export function deferUntilSave(workoutId: string, key: string, run: () => Promise<void>): boolean {
  if (!draft || draft.workoutId !== workoutId) return false;
  draft.afterSave.set(key, run);
  return true;
}

/** Queues every write the draft holds, in order, closes it, and returns how many. */
export async function commitDraft(): Promise<number> {
  const open = draft;
  draft = null;
  if (!open) return 0;
  const bodies = open.buffer.bodies();
  for (const body of bodies) await queueWrite(open.userId, body);
  // A read cache built before these were queued would show the old workout.
  if (bodies.length > 0) invalidateScanCache();
  await Promise.all([...open.afterSave.values()].map((run) => run().catch(() => undefined)));
  return bodies.length;
}

/** Drops the draft and everything it holds. */
export function discardDraft(): void {
  draft = null;
}

/** Whether the open draft holds any write. */
export function draftHasChanges(): boolean {
  return (draft?.buffer.size ?? 0) > 0;
}

/** The writes the open draft holds, in order. Empty with no draft. */
export function draftBodies(): WriteOpBody[] {
  return draft?.buffer.bodies() ?? [];
}

/** The workout the open draft is for, or null. */
export function draftWorkoutId(): string | null {
  return draft?.workoutId ?? null;
}

/** The writes still on the phone for `userId`, oldest first. */
export async function pendingWrites(userId: string): Promise<readonly WriteOp[]> {
  await followUser(userId);
  return writeQueue.pending();
}

/**
 * Workouts deleted on the phone whose delete has not reached the server.
 * Every read of finished workouts leaves them out, so History, the
 * calendar, the week card and streak, Profile, the exercise screens and
 * the PR scan drop a deleted workout at once, online or not. Device
 * storage only.
 */
export async function deletedWorkoutIds(userId: string): Promise<string[]> {
  return pendingWorkoutDeletes(await pendingWrites(userId));
}

/** A PostgREST list for `.not('id', 'in', ...)`. Ids are uuids, so nothing needs quoting. */
export function idList(ids: readonly string[]): string {
  return `(${ids.join(',')})`;
}

/**
 * Sends what is waiting, and resolves when the queue is empty, stuck on a
 * failure, or after `ms`, whichever comes first. The queue carries on
 * sending either way.
 */
export async function sendNow(ms = CONFIRM_WAIT_MS): Promise<void> {
  await Promise.race([writeQueue.drain(), new Promise((resolve) => setTimeout(resolve, ms))]);
}

/**
 * Sends what is waiting and reports whether the server now has everything
 * about `id` (a workout, or a row in one), waiting at most `ms`.
 */
export async function syncedWithin(id: string, ms = CONFIRM_WAIT_MS): Promise<boolean> {
  await sendNow(ms);
  return !writeQueue.hasPendingFor(id);
}
