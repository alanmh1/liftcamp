// Moving a guest's data into the existing account it signs in to. The
// server half is the merge-guest Edge Function and merge_guest_account
// (docs/guest-merge.sql); this is the app's half: the record kept on the
// phone while a merge is under way, what to do with it next, and how the
// guest's queued writes and device keys are handed to the account.
//
// Pure functions over plain data. The mobile app owns storage, the
// Supabase calls and the screens (apps/mobile/src/lib/guest-merge.ts).

import { APP_STORAGE_PREFIX } from "./account-deletion";
import { failedWritesKey, writeQueueKey, type QueueState, type WriteOp } from "./write-queue";
import type { FailedWrite } from "./write-queue-runner";

/** A session's tokens, as much of it as the merge needs to keep. */
export type TokenPair = {
  access_token: string;
  refresh_token: string;
  /** Epoch seconds, as supabase-js stores it. */
  expires_at: number | null;
};

/**
 * Where a merge is.
 * - `merging`: the phone is still signed in as the guest; the account's
 *   session came from a throwaway sign-in and is held here.
 * - `merged`: the server has moved everything and deleted the guest; the
 *   phone still has to switch to the account's session.
 * - `deferred`: the person chose to sign in before the merge went through.
 *   The phone is on the account; the guest's tokens are held here so the
 *   merge can be tried again.
 */
export type GuestMergeStage = "merging" | "merged" | "deferred";

export type PendingMerge = {
  guestId: string;
  targetId: string;
  stage: GuestMergeStage;
  /** The account's tokens, until the phone has switched to them. */
  targetSession: TokenPair | null;
  /** The guest's tokens, once the phone has switched away from the guest. */
  guestSession: TokenPair | null;
  /** Epoch ms. */
  createdAt: number;
  attempts: number;
  lastError: string | null;
  /** The server refused for good. Tried again only at launch or by hand. */
  stuck: boolean;
};

export const GUEST_MERGE_PREFIX = `${APP_STORAGE_PREFIX}guest-merge:`;

/** Device storage key for a guest's merge. Under the app prefix, so account deletion clears it. */
export function guestMergeKey(guestId: string): string {
  return `${GUEST_MERGE_PREFIX}${guestId}`;
}

const STAGES: readonly GuestMergeStage[] = ["merging", "merged", "deferred"];

function isTokenPair(v: unknown): v is TokenPair {
  if (!v || typeof v !== "object") return false;
  const t = v as Record<string, unknown>;
  return (
    typeof t.access_token === "string" &&
    typeof t.refresh_token === "string" &&
    (t.expires_at === null || typeof t.expires_at === "number")
  );
}

/** A stored record, or null when it is missing or unreadable. */
export function parsePendingMerge(raw: string | null): PendingMerge | null {
  if (!raw) return null;
  try {
    const r = JSON.parse(raw) as Record<string, unknown>;
    if (typeof r.guestId !== "string" || typeof r.targetId !== "string") return null;
    if (!STAGES.includes(r.stage as GuestMergeStage)) return null;
    if (r.targetSession != null && !isTokenPair(r.targetSession)) return null;
    if (r.guestSession != null && !isTokenPair(r.guestSession)) return null;
    return {
      guestId: r.guestId,
      targetId: r.targetId,
      stage: r.stage as GuestMergeStage,
      targetSession: (r.targetSession as TokenPair | undefined) ?? null,
      guestSession: (r.guestSession as TokenPair | undefined) ?? null,
      createdAt: typeof r.createdAt === "number" ? r.createdAt : 0,
      attempts: typeof r.attempts === "number" ? r.attempts : 0,
      lastError: typeof r.lastError === "string" ? r.lastError : null,
      stuck: r.stuck === true,
    };
  } catch {
    return null;
  }
}

/** Whether a token runs out within `marginS` seconds. A pair with no expiry counts as fresh. */
export function tokenExpired(pair: TokenPair | null, nowMs: number, marginS = 60): boolean {
  if (!pair) return true;
  return pair.expires_at != null && pair.expires_at * 1000 <= nowMs + marginS * 1000;
}

/**
 * What to do with a record, given who the phone is signed in as.
 * - `merge-as-guest`: call the server while the phone is still the guest.
 * - `merge-deferred`: call the server from the account, with the held guest tokens.
 * - `set-session`: the server is done; switch the phone to the account.
 * - `finish`: the phone is on the account; hand over the queue and keys.
 * - `wait`: nothing now. Someone else is signed in, or a refused merge
 *   waits for a launch or a tap.
 */
export type MergeStep = "merge-as-guest" | "merge-deferred" | "set-session" | "finish" | "wait";

export type MergeTrigger = "launch" | "foreground" | "sign-in" | "manual";

export function mergeStep(
  record: PendingMerge,
  current: { userId: string | null },
  trigger: MergeTrigger,
): MergeStep {
  const me = current.userId;
  if (record.stage === "merged") {
    if (me === record.targetId) return "finish";
    // On the deleted guest, or signed out: the account's session is all
    // there is to go to.
    if ((me === record.guestId || me === null) && record.targetSession) return "set-session";
    return "wait";
  }
  if (record.stuck && trigger !== "launch" && trigger !== "manual") return "wait";
  if (record.stage === "merging") {
    return me === record.guestId && record.targetSession ? "merge-as-guest" : "wait";
  }
  // deferred
  return me === record.targetId && record.guestSession ? "merge-deferred" : "wait";
}

/** What merge-guest answered, as the app acts on it. */
export type MergeResponseKind =
  /** Merged now, or by an earlier call. */
  | "done"
  /** A token did not verify. Refresh both and try once more. */
  | "refresh"
  /** No answer, or a failure worth trying again. */
  | "retry"
  /** Refused for good. Kept on the phone and reported. */
  | "stuck";

export type MergeMoved = Record<string, number | string>;

export function classifyMergeResponse(response: { status: number | null; body: unknown }): {
  kind: MergeResponseKind;
  error: string;
  moved: MergeMoved | null;
} {
  const body = (response.body && typeof response.body === "object" ? response.body : {}) as {
    merged?: unknown;
    error?: unknown;
    moved?: unknown;
  };
  const error = typeof body.error === "string" ? body.error : response.status == null ? "no_response" : `http_${response.status}`;
  if (response.status === 200 && body.merged === true) {
    const moved = body.moved && typeof body.moved === "object" ? (body.moved as MergeMoved) : {};
    return { kind: "done", error: "", moved };
  }
  if (response.status === 401) return { kind: "refresh", error, moved: null };
  if (response.status === 400 || response.status === 403 || response.status === 410) {
    return { kind: "stuck", error, moved: null };
  }
  return { kind: "retry", error, moved: null };
}

// ---------------------------------------------------------------------------
// Handing the guest's device state to the account
// ---------------------------------------------------------------------------

/** The ops with the guest's user id swapped for the account's, in `userId` and every inserted row. */
export function rekeyOps(ops: readonly WriteOp[], fromUserId: string, toUserId: string): WriteOp[] {
  return ops.map((op) => {
    if (op.userId !== fromUserId) return op;
    if (op.kind !== "insert") return { ...op, userId: toUserId };
    return {
      ...op,
      userId: toUserId,
      rows: op.rows.map((r) =>
        r.values.user_id === fromUserId ? { ...r, values: { ...r.values, user_id: toUserId } } : r,
      ),
    };
  });
}

/** The same, for writes given up on. */
export function rekeyFailed(failed: readonly FailedWrite[], fromUserId: string, toUserId: string): FailedWrite[] {
  return failed.map((f) => ({ ...f, op: rekeyOps([f.op], fromUserId, toUserId)[0] }));
}

/**
 * The guest's ops ahead of the account's, numbered on from the account's
 * next seq so no number is reused. Ahead, because they are older: a set
 * logged by the account into the guest's workout must not reach the server
 * before the rows it hangs off.
 */
export function prependOps(target: QueueState, guestOps: readonly WriteOp[]): QueueState {
  if (guestOps.length === 0) return target;
  let seq = target.nextSeq;
  const ops = [...guestOps, ...target.ops].map((op) => ({ ...op, seq: seq++ }));
  return { nextSeq: seq, ops };
}

/** The per-user device keys a merge leaves behind for the guest, under their `liftcamp:<name>:` prefix. */
const PER_USER_KEYS = [
  "home",
  "unit",
  "username",
  "onboarded",
  "signup-due",
  "setup-completed-seen",
  "medals-synced",
] as const;

/**
 * Of the keys on the device, the guest's own caches to remove once the
 * account has its data, plus the guest's emptied queue keys. The device
 * copies of workouts (`liftcamp:workout:<id>`) carry the user id inside and
 * are rewritten instead, and nothing else is touched.
 */
export function guestKeysToRemove(keys: readonly string[], guestId: string): string[] {
  const doomed = new Set<string>([
    ...PER_USER_KEYS.map((name) => `${APP_STORAGE_PREFIX}${name}:${guestId}`),
    writeQueueKey(guestId),
    failedWritesKey(guestId),
  ]);
  return keys.filter((k) => doomed.has(k));
}

/**
 * A stored device workout copy with the guest's id swapped for the
 * account's, or null when it is not the guest's (or not readable).
 */
export function rekeyDeviceWorkout(raw: string | null, fromUserId: string, toUserId: string): string | null {
  if (!raw) return null;
  try {
    const copy = JSON.parse(raw) as { userId?: unknown };
    if (copy.userId !== fromUserId) return null;
    return JSON.stringify({ ...copy, userId: toUserId });
  } catch {
    return null;
  }
}

/** The quiet line on Home after a merge, or null when no workout moved. */
export function mergedLine(moved: MergeMoved | null): string | null {
  const n = typeof moved?.workouts === "number" ? moved.workouts : 0;
  if (n <= 0) return null;
  return n === 1
    ? "Your workout from this phone is in your account."
    : `Your ${n} workouts from this phone are in your account.`;
}
