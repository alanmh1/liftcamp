import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  GUEST_MERGE_PREFIX,
  classifyMergeResponse,
  guestKeysToRemove,
  guestMergeKey,
  mergeStep,
  mergedLine,
  parsePendingMerge,
  rekeyDeviceWorkout,
  tokenExpired,
  type MergeMoved,
  type MergeTrigger,
  type PendingMerge,
  type TokenPair,
} from '@liftcamp/shared';
import { createClient, type Session } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { DEVICE_WORKOUT_PREFIX } from '@/data/device-workout';
import { invalidateScanCache } from '@/data/scan-cache';
import { writeQueue } from '@/data/write-queue';
import { readStoredSession, supabase } from '../../lib/supabase';

/**
 * Moving a guest's data into the existing account they sign in to
 * (docs/guest-merge-spec.md). The rules and their tests are in shared
 * (guest-merge.ts); this runs them against the phone and the server.
 *
 * The phone stays signed in as the guest until the server has merged:
 *
 * 1. The sign-in code signs in to the existing account on a throwaway
 *    client, so the app's own session (the guest's) does not change.
 * 2. `mergeIntoExisting` saves a record (`liftcamp:guest-merge:<guestId>`),
 *    holds the write queue, and calls merge-guest with both access tokens.
 * 3. On success: the guest's device copies are rewritten to the account,
 *    the app switches to the account's session, the guest's queue is
 *    adopted by the account's, and the guest's keys and the record go.
 * 4. On failure nothing is lost: the guest's rows stay on the server and
 *    its writes on the phone. The caller offers Try again, or Sign in now
 *    (`deferMerge`), which switches to the account and keeps the guest's
 *    tokens for a retry on launch and foreground.
 */

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

/** A request with no answer by then counts as no signal. */
const CALL_TIMEOUT_MS = 15_000;

export type MergeResult =
  | { kind: 'merged'; moved: MergeMoved }
  | { kind: 'failed'; guestId: string; stuck: boolean; error: string };

/**
 * A client that keeps its session in memory and never refreshes on its
 * own. For signing in to the existing account without touching the app's
 * session, and for refreshing tokens held in a record.
 */
export function throwawayClient() {
  return createClient(URL, KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'liftcamp-throwaway',
    },
  });
}

function pairOf(session: Pick<Session, 'access_token' | 'refresh_token' | 'expires_at'>): TokenPair {
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at ?? null,
  };
}

async function save(record: PendingMerge): Promise<void> {
  await AsyncStorage.setItem(guestMergeKey(record.guestId), JSON.stringify(record));
}

async function load(guestId: string): Promise<PendingMerge | null> {
  try {
    return parsePendingMerge(await AsyncStorage.getItem(guestMergeKey(guestId)));
  } catch {
    return null;
  }
}

/** Every merge record on the phone. */
export async function pendingMerges(): Promise<PendingMerge[]> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(GUEST_MERGE_PREFIX));
    if (keys.length === 0) return [];
    const out: PendingMerge[] = [];
    for (const [, raw] of await AsyncStorage.multiGet(keys)) {
      const r = parsePendingMerge(raw);
      if (r) out.push(r);
    }
    return out;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// What the screens hear
// ---------------------------------------------------------------------------

type MergeEvent = { type: 'merged'; line: string | null } | { type: 'changed' };
const listeners = new Set<(e: MergeEvent) => void>();

/** The last merge's line, until Home shows it or it goes stale. */
let notice: { line: string; at: number } | null = null;
const NOTICE_FRESH_MS = 30_000;

function emit(e: MergeEvent) {
  for (const l of listeners) l(e);
}

export function subscribeGuestMerge(listener: (e: MergeEvent) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The line to show once on Home, if a merge just landed. */
export function takeMergedNotice(): string | null {
  const n = notice;
  notice = null;
  return n && Date.now() - n.at < NOTICE_FRESH_MS ? n.line : null;
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

/** A fresh pair for a held one, or the held one when the refresh fails. */
async function refreshed(pair: TokenPair, force = false): Promise<TokenPair> {
  if (!force && !tokenExpired(pair, Date.now())) return pair;
  const { data, error } = await throwawayClient().auth.refreshSession({ refresh_token: pair.refresh_token });
  if (error || !data.session) return pair;
  return pairOf(data.session);
}

/**
 * The guest's access token for the call. In `merging` the app's own session
 * is the guest's, kept fresh by auth-js. In `deferred` it is the record's,
 * refreshed here and saved before use: a refresh token is good once, so the
 * rotated one must not be lost.
 */
async function guestToken(record: PendingMerge, force: boolean): Promise<{ token: string; record: PendingMerge }> {
  if (record.stage === 'merging') {
    if (force) await supabase.auth.refreshSession();
    const { data } = await supabase.auth.getSession();
    return { token: data.session?.access_token ?? '', record };
  }
  const pair = record.guestSession!;
  const next = await refreshed(pair, force);
  if (next === pair) return { token: pair.access_token, record };
  const updated = { ...record, guestSession: next };
  await save(updated);
  return { token: next.access_token, record: updated };
}

/** The account's access token for the call: the record's in `merging`, the app's in `deferred`. */
async function targetToken(record: PendingMerge, force: boolean): Promise<{ token: string; record: PendingMerge }> {
  if (record.stage === 'deferred') {
    if (force) await supabase.auth.refreshSession();
    const { data } = await supabase.auth.getSession();
    return { token: data.session?.access_token ?? '', record };
  }
  const pair = record.targetSession!;
  const next = await refreshed(pair, force);
  if (next === pair) return { token: pair.access_token, record };
  const updated = { ...record, targetSession: next };
  await save(updated);
  return { token: next.access_token, record: updated };
}

// ---------------------------------------------------------------------------
// The call
// ---------------------------------------------------------------------------

async function callMergeGuest(target: string, guest: string): Promise<{ status: number | null; body: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
  try {
    const res = await fetch(`${URL}/functions/v1/merge-guest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${target}`, apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestAccessToken: guest }),
      signal: controller.signal,
    });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // A body that is not JSON (a gateway page) classifies by status alone.
    }
    return { status: res.status, body };
  } catch {
    return { status: null, body: null };
  } finally {
    clearTimeout(timer);
  }
}

/** Calls merge-guest, refreshing both tokens once if either did not verify. */
async function callWithRecord(record: PendingMerge) {
  let r = record;
  let result = { kind: 'retry' as const, error: 'no_response', moved: null } as ReturnType<typeof classifyMergeResponse>;
  for (const force of [false, true]) {
    const t = await targetToken(r, force);
    r = t.record;
    const g = await guestToken(r, force);
    r = g.record;
    result = classifyMergeResponse(await callMergeGuest(t.token, g.token));
    if (result.kind !== 'refresh') break;
  }
  // Two refusals of a token in a row: it is not coming back.
  if (result.kind === 'refresh') result = { ...result, kind: 'stuck' };
  return { result, record: r };
}

/** Reported once per record, as whoever the phone is signed in as. Ids and codes only. */
async function reportStuck(record: PendingMerge, error: string) {
  const stored = await readStoredSession();
  if (!stored) return;
  void supabase.from('app_events').insert({
    user_id: stored.user.id,
    name: 'guest_merge_failed',
    props: { guest_id: record.guestId, target_id: record.targetId, stage: record.stage, error },
  });
}

// ---------------------------------------------------------------------------
// After the server has merged
// ---------------------------------------------------------------------------

/** The guest's device copies of workouts now belong to the account. */
async function rekeyDeviceWorkouts(guestId: string, targetId: string): Promise<void> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(DEVICE_WORKOUT_PREFIX));
    if (keys.length === 0) return;
    const pairs: [string, string][] = [];
    for (const [k, raw] of await AsyncStorage.multiGet(keys)) {
      const next = rekeyDeviceWorkout(raw, guestId, targetId);
      if (next) pairs.push([k, next]);
    }
    if (pairs.length > 0) await AsyncStorage.multiSet(pairs);
  } catch {
    // A copy left on the guest's id is ignored; the server read has the workout.
  }
}

/**
 * The phone is on the account: hand it the guest's queue, drop the guest's
 * keys and the record. Safe to run again after a crash part way.
 */
async function finish(record: PendingMerge): Promise<void> {
  if (writeQueue.userId !== record.targetId) await writeQueue.setUser(record.targetId);
  await writeQueue.adopt(record.guestId);
  try {
    const remove = guestKeysToRemove(await AsyncStorage.getAllKeys(), record.guestId);
    await AsyncStorage.multiRemove([...remove, guestMergeKey(record.guestId)]);
  } catch {
    // Leftover guest caches are never read again: the guest id is gone.
  }
  invalidateScanCache();
  emit({ type: 'changed' });
}

/** Switches the app to the account's held session. False when that failed. */
async function switchToTarget(record: PendingMerge): Promise<boolean> {
  const pair = record.targetSession;
  if (!pair) return false;
  const { error } = await supabase.auth.setSession({
    access_token: pair.access_token,
    refresh_token: pair.refresh_token,
  });
  if (error) {
    if (__DEV__) console.warn(`[guest-merge] could not switch to the account: ${error.message}`);
    return false;
  }
  return true;
}

function announce(moved: MergeMoved) {
  const line = mergedLine(moved);
  notice = line ? { line, at: Date.now() } : null;
  emit({ type: 'merged', line });
}

// ---------------------------------------------------------------------------
// Running a record
// ---------------------------------------------------------------------------

/**
 * Guests with work under way. The sign-in's own attempt and the runner
 * that SIGNED_IN starts would otherwise both adopt the same queue.
 */
const active = new Map<string, Promise<unknown>>();

function exclusive<T>(guestId: string, work: () => Promise<T>): Promise<T> {
  const before = active.get(guestId) ?? Promise.resolve();
  const next = before.catch(() => undefined).then(work);
  const tail = next.catch(() => undefined);
  active.set(guestId, tail);
  void tail.then(() => {
    if (active.get(guestId) === tail) active.delete(guestId);
  });
  return next;
}

/**
 * One attempt at a `merging` or `deferred` record: hold the queue, call the
 * server, and on success finish on the phone. In `merging` that includes
 * the switch to the account.
 */
async function attempt(start: PendingMerge): Promise<MergeResult> {
  await writeQueue.hold();
  try {
    const { result, record } = await callWithRecord(start);
    if (result.kind !== 'done') {
      const stuck = result.kind === 'stuck';
      const next: PendingMerge = {
        ...record,
        attempts: record.attempts + 1,
        lastError: result.error,
        stuck: record.stuck || stuck,
      };
      await save(next);
      if (stuck && !record.stuck) void reportStuck(next, result.error);
      emit({ type: 'changed' });
      if (__DEV__) console.log(`[guest-merge] ${result.kind}: ${result.error}`);
      return { kind: 'failed', guestId: record.guestId, stuck, error: result.error };
    }

    // Merged on the server. The device copies first, so the account sees
    // them the moment it is switched to.
    await rekeyDeviceWorkouts(record.guestId, record.targetId);
    const merged: PendingMerge = { ...record, stage: 'merged', lastError: null, stuck: false };
    await save(merged);
    if (__DEV__) console.log('[guest-merge] merged', result.moved);
    if (record.stage === 'merging' && !(await switchToTarget(merged))) {
      // Kept as `merged`: launch, foreground and the auth provider switch
      // from the record. The rows are already safe in the account.
      announce(result.moved ?? {});
      return { kind: 'merged', moved: result.moved ?? {} };
    }
    await finish(merged);
    announce(result.moved ?? {});
    return { kind: 'merged', moved: result.moved ?? {} };
  } finally {
    writeQueue.release();
  }
}

/**
 * Called by the sign-in code when the identity belongs to another account,
 * with that account's session from a throwaway sign-in. The app is still
 * signed in as the guest.
 */
export async function mergeIntoExisting(target: Session): Promise<MergeResult> {
  const stored = await readStoredSession();
  if (!stored?.user.is_anonymous || stored.user.id === target.user.id) {
    // Nothing to merge from. Behave as a plain sign-in.
    await supabase.auth.setSession({ access_token: target.access_token, refresh_token: target.refresh_token });
    return { kind: 'merged', moved: {} };
  }
  const record: PendingMerge = {
    guestId: stored.user.id,
    targetId: target.user.id,
    stage: 'merging',
    targetSession: pairOf(target),
    guestSession: null,
    createdAt: Date.now(),
    attempts: 0,
    lastError: null,
    stuck: false,
  };
  await save(record);
  return exclusive(record.guestId, () => attempt(record));
}

/** Try again, from the alert or Settings. */
export async function retryMerge(guestId: string): Promise<MergeResult | null> {
  const record = await load(guestId);
  if (!record) return null;
  return run(record, 'manual');
}

/**
 * "Sign in now": switch to the account and leave the merge for later. The
 * guest's tokens are read from the app's session at this moment, the only
 * time they can be: once switched, nothing refreshes them but the merge.
 * A failed switch puts the record back as it was, still on the guest.
 */
export async function deferMerge(guestId: string): Promise<boolean> {
  return exclusive(guestId, async () => {
    const record = await load(guestId);
    const stored = await readStoredSession();
    if (!record || record.stage !== 'merging' || stored?.user.id !== guestId) return false;
    const deferred: PendingMerge = { ...record, stage: 'deferred', guestSession: pairOf(stored) };
    await save(deferred);
    if (await switchToTarget(deferred)) {
      emit({ type: 'changed' });
      return true;
    }
    await save(record);
    return false;
  });
}

function run(record: PendingMerge, trigger: MergeTrigger): Promise<MergeResult | null> {
  return exclusive(record.guestId, async () => {
    // Read again inside the lock: the work before may have moved it on.
    const current = await load(record.guestId);
    return current ? step(current, trigger) : null;
  });
}

async function step(record: PendingMerge, trigger: MergeTrigger): Promise<MergeResult | null> {
  const stored = await readStoredSession();
  const step = mergeStep(record, { userId: stored?.user.id ?? null }, trigger);
  if (step === 'merge-as-guest' || step === 'merge-deferred') return attempt(record);
  if (step === 'set-session') {
    if (await switchToTarget(record)) await finish(record);
    return null;
  }
  if (step === 'finish') {
    await finish(record);
    return null;
  }
  return null;
}

let running: Promise<void> | null = null;

/** Works through every record on the phone. One run at a time. */
export function runPendingMerges(trigger: MergeTrigger): Promise<void> {
  if (!running) {
    running = (async () => {
      for (const record of await pendingMerges()) {
        try {
          await run(record, trigger);
        } catch (e) {
          if (__DEV__) console.warn('[guest-merge] run failed', e);
        }
      }
    })().finally(() => {
      running = null;
    });
  }
  return running;
}

/**
 * For the auth provider, when the session is lost: a merged record means
 * the lost session was the deleted guest, and the account's session is
 * here to switch to. True when it switched, so no new guest is signed in.
 */
export async function switchAfterLostGuest(): Promise<boolean> {
  for (const record of await pendingMerges()) {
    if (record.stage !== 'merged') continue;
    const switched = await exclusive(record.guestId, async () => {
      // The attempt that merged may have switched and finished meanwhile.
      const current = await load(record.guestId);
      if (!current) return (await readStoredSession())?.user.id === record.targetId;
      if (current.stage !== 'merged' || !(await switchToTarget(current))) return false;
      await finish(current);
      return true;
    });
    if (switched) return true;
  }
  return false;
}

// Launch, foreground, and every sign-in. Deferred like the write queue's
// listener: supabase-js asks that the callback not call back into the client.
void readStoredSession().then(() => runPendingMerges('launch'));
AppState.addEventListener('change', (state) => {
  if (state === 'active') void runPendingMerges('foreground');
});
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_IN') setTimeout(() => void runPendingMerges('sign-in'), 0);
});
