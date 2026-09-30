import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  WriteQueue,
  authEventUser,
  type FailedWrite,
  type SyncError,
  type WriteOp,
  type WriteOpBody,
} from '@liftcamp/shared';
import { AppState } from 'react-native';

import { clearDeviceWorkout } from '@/data/device-workout';
import { invalidateScanCache } from '@/data/scan-cache';
import { supabase } from '../../lib/supabase';

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

async function send(op: WriteOp): Promise<Result> {
  // Only ever as the op's own user. Signed out, or a session that could not
  // refresh, waits rather than sending as the anon role, which RLS refuses.
  const { data } = await supabase.auth.getSession();
  if (data.session?.user.id !== op.userId) {
    return { ok: false, error: { status: 0, code: 'NO_SESSION', message: 'No session for this user' } };
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
  try {
    await followUser(userId);
    return await writeQueue.enqueue(userId, body);
  } catch (e) {
    if (__DEV__) console.warn('[write-queue] could not save a write', e);
    return false;
  }
}

/** The writes still on the phone for `userId`, oldest first. */
export async function pendingWrites(userId: string): Promise<readonly WriteOp[]> {
  await followUser(userId);
  return writeQueue.pending();
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
