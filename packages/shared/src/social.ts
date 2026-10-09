// Social v0 rules, pure. The spec is docs/social-spec.md and the server side
// is supabase/migrations/20261004120000_social_schema.sql: the server
// decides who may see and do what, and these rules shape what the app
// shows from what the server returned, and what it keeps on the device.

import { APP_STORAGE_PREFIX } from "./account-deletion";

const DAY_MS = 86_400_000;

// ---------------------------------------------------------------------------
// The flag
// ---------------------------------------------------------------------------

export const SOCIAL_FLAG = "social";

export type FlagState = "granted" | "revoked" | null;

/**
 * Whether social is on, the way private.social_on decides it: a revoke
 * wins over everything, then the global switch or a grant turns it on.
 * The app asks the server (social_access); this is the same rule, for the
 * admin page and the tests.
 */
export function socialFlagOn(input: { enabledForAll: boolean; state: FlagState; member: boolean }): boolean {
  if (!input.member) return false;
  if (input.state === "revoked") return false;
  return input.enabledForAll || input.state === "granted";
}

/** The per-user device cache of social_access(), read before the tabs draw. */
export function socialCacheKey(userId: string): string {
  return `${APP_STORAGE_PREFIX}social:${userId}`;
}

/** A cached answer back, or null for anything that is not one. */
export function parseSocialCache(raw: string | null): boolean | null {
  if (raw === "1") return true;
  if (raw === "0") return false;
  return null;
}

export function socialCacheValue(on: boolean): string {
  return on ? "1" : "0";
}

/**
 * What a read of social_access() leaves the app with. A successful read
 * decides. A failed read keeps what this device cached for the same user,
 * so social surfaces do not change with the signal; with nothing cached it
 * is off.
 */
export function socialAfterRead(read: { ok: true; on: boolean } | { ok: false }, cached: boolean | null): boolean {
  return read.ok ? read.on : (cached ?? false);
}

/**
 * Whether this run shows social surfaces (Home's feed slot, follows, the
 * feed), or null while this user's device cache is still being read (an
 * AsyncStorage read, never supabase-js). The cached answer is taken once
 * per user per run and kept; a fresh read that disagrees updates the cache
 * and shows on the next launch. Signed out, a guest, or nothing cached is
 * off.
 */
export function socialAtMount(input: {
  userId: string | null;
  isGuest: boolean;
  /** The user whose cache the store has read, if any. */
  readFor: string | null;
  cached: boolean | null;
}): boolean | null {
  if (!input.userId || input.isGuest) return false;
  if (input.readFor !== input.userId) return null;
  return input.cached === true;
}

// ---------------------------------------------------------------------------
// Follows
// ---------------------------------------------------------------------------

export type FollowStatus = "pending" | "accepted";

/** One row of list_follows(). */
export type FollowRow = {
  follower_id: string;
  followee_id: string;
  other_id: string;
  other_username: string | null;
  status: FollowStatus;
  requested_by: string;
  created_at: string;
  accepted_at: string | null;
};

/** Days a pending request lives before the nightly job deletes it. */
export const REQUEST_DAYS = 30;

/** Whether a pending request is past its 30 days at `now` (epoch ms). */
export function requestExpired(row: Pick<FollowRow, "status" | "created_at">, now: number): boolean {
  if (row.status !== "pending") return false;
  const at = Date.parse(row.created_at);
  return Number.isFinite(at) && now - at > REQUEST_DAYS * DAY_MS;
}

export type FollowLists = {
  /** People who follow me, accepted. */
  followers: FollowRow[];
  /** People I follow, accepted. */
  following: FollowRow[];
  /** Requests waiting on me to approve: someone else started them. */
  requests: FollowRow[];
  /** Requests I started that are still pending, in either direction. */
  sent: FollowRow[];
};

/**
 * list_follows() rows split for Profile. A request belongs to whoever did
 * not start it: a Follow from someone else is theirs to start and mine to
 * approve, and so is a "Let them follow you" they sent me. Rows past 30
 * days are dropped, as the nightly job will drop them.
 */
export function splitFollows(rows: readonly FollowRow[], me: string, now: number): FollowLists {
  const out: FollowLists = { followers: [], following: [], requests: [], sent: [] };
  for (const r of rows) {
    if (requestExpired(r, now)) continue;
    if (r.status === "accepted") {
      if (r.followee_id === me) out.followers.push(r);
      if (r.follower_id === me) out.following.push(r);
    } else if (r.requested_by === me) {
      out.sent.push(r);
    } else {
      out.requests.push(r);
    }
  }
  return out;
}

/** The follow button on a person: Follow, Requested or Following. */
export type FollowButton = "follow" | "requested" | "following";

export function followButton(rows: readonly FollowRow[], me: string, other: string, now: number): FollowButton {
  const mine = rows.find((r) => r.follower_id === me && r.followee_id === other && !requestExpired(r, now));
  if (!mine) return "follow";
  return mine.status === "accepted" ? "following" : "requested";
}

/**
 * Follow back, after approving `other`'s request to follow me: shown when
 * they now follow me and I neither follow nor have asked to follow them.
 */
export function showFollowBack(rows: readonly FollowRow[], me: string, other: string, now: number): boolean {
  const theyFollow = rows.some((r) => r.follower_id === other && r.followee_id === me && r.status === "accepted");
  return theyFollow && followButton(rows, me, other, now) === "follow";
}

/** Whether `rows` has any follow between the two, either direction. */
function between(r: Pick<FollowRow, "follower_id" | "followee_id">, a: string, b: string): boolean {
  return (r.follower_id === a && r.followee_id === b) || (r.follower_id === b && r.followee_id === a);
}

/**
 * The rows left after `blocker` blocks `blocked`: every follow between
 * them goes, both directions, pending or accepted, as block_user does.
 */
export function afterBlock<R extends Pick<FollowRow, "follower_id" | "followee_id">>(
  rows: readonly R[],
  blocker: string,
  blocked: string,
): R[] {
  return rows.filter((r) => !between(r, blocker, blocked));
}

/**
 * Home's line above the feed while requests wait on me, or null with none.
 * One request names the person and what they asked; more name the newest
 * and count the rest.
 */
export function requestsLine(requests: readonly FollowRow[], me: string): string | null {
  const first = requests[0];
  if (!first) return null;
  const who = first.other_username ? `@${first.other_username}` : "Someone";
  if (requests.length === 1) {
    return first.follower_id === me ? `${who} wants you to follow them` : `${who} wants to follow you`;
  }
  const rest = requests.length - 1;
  return `${who} and ${rest} ${rest === 1 ? "other" : "others"} sent you requests`;
}

/** Requests waiting on me, for the Profile badge and Home's line. */
export function waitingRequestCount(rows: readonly FollowRow[], me: string, now: number): number {
  return splitFollows(rows, me, now).requests.length;
}

// ---------------------------------------------------------------------------
// Kudos
// ---------------------------------------------------------------------------

export type KudosState = { given: boolean; count: number };

/** The optimistic state after a tap, before toggle_kudos answers. */
export function toggleKudos(state: KudosState): KudosState {
  return state.given
    ? { given: false, count: Math.max(0, state.count - 1) }
    : { given: true, count: state.count + 1 };
}

/** Last-seen kudos count on this device, for the unseen dot on Home. */
export function kudosSeenKey(userId: string): string {
  return `${APP_STORAGE_PREFIX}kudos-seen:${userId}`;
}

/**
 * Whether the last workout card shows the unseen dot: its kudos count is
 * above the count this device last showed for that workout.
 */
export function hasUnseenKudos(workoutId: string, count: number, seenRaw: string | null): boolean {
  if (count <= 0) return false;
  const seen = parseKudosSeen(seenRaw);
  if (!seen || seen.workoutId !== workoutId) return true;
  return count > seen.count;
}

export function kudosSeenValue(workoutId: string, count: number): string {
  return JSON.stringify({ workoutId, count });
}

function parseKudosSeen(raw: string | null): { workoutId: string; count: number } | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object") return null;
    const { workoutId, count } = v as Record<string, unknown>;
    if (typeof workoutId !== "string" || typeof count !== "number" || !Number.isFinite(count)) return null;
    return { workoutId, count };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------------

/** Days of workouts the feed shows. */
export const FEED_DAYS = 14;
export const FEED_PAGE = 20;

/** One row of social_feed(). */
export type FeedItem = {
  workout_id: string;
  user_id: string;
  username: string | null;
  name: string | null;
  workout_date: string;
  created_at: string;
  finished_at: string | null;
  completed_sets: number;
  pr_count: number | null;
  kudos_count: number;
  kudos_given: boolean;
};

/**
 * Whether an item belongs in the feed, the rules social_feed applies:
 * someone else's finished workout from the last 14 days with a completed
 * set, from a person I follow and have not blocked either way. The server
 * already filters; the app runs this over the list it holds after a block,
 * an unfollow or a remove, so the item goes without a refetch.
 */
export function feedVisible(
  item: FeedItem,
  ctx: { me: string; now: number; following: ReadonlySet<string>; blocked: ReadonlySet<string> },
): boolean {
  if (item.user_id === ctx.me) return false;
  if (!item.finished_at) return false;
  const at = Date.parse(item.finished_at);
  if (!Number.isFinite(at) || ctx.now - at > FEED_DAYS * DAY_MS) return false;
  if (item.completed_sets <= 0) return false;
  if (!ctx.following.has(item.user_id)) return false;
  return !ctx.blocked.has(item.user_id);
}

export function filterFeed(
  items: readonly FeedItem[],
  ctx: { me: string; now: number; following: ReadonlySet<string>; blocked: ReadonlySet<string> },
): FeedItem[] {
  return items.filter((i) => feedVisible(i, ctx));
}

/** The PR stat on a feed item, or null to hide it (workouts before pr_count was written). */
export function feedPrCount(item: Pick<FeedItem, "pr_count">): number | null {
  return item.pr_count == null ? null : item.pr_count;
}

/** The `p_before` cursor for the next page: the last item's finished_at. */
export function feedCursor(items: readonly FeedItem[]): string | null {
  return items.length > 0 ? (items[items.length - 1].finished_at ?? null) : null;
}

// ---------------------------------------------------------------------------
// Invite codes and links
// ---------------------------------------------------------------------------

/** Eight characters, no 0, O, 1 or I. The server's CHECK is the same set. */
export const INVITE_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;

/**
 * A typed or pasted code, uppercased with spaces and dashes taken out, or
 * null when it cannot be a code.
 */
export function normalizeInviteCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, "");
  return INVITE_CODE_PATTERN.test(code) ? code : null;
}

/** The share link for a code. */
export function inviteLink(code: string): string {
  return `https://liftcamp.app/i/${code}`;
}

/**
 * The code in an invite link: `liftcamp://invite/<code>` (the Open in
 * LiftCamp button) or `https://liftcamp.app/i/<code>`, with or without www.
 * Null for anything else.
 */
export function inviteCodeFromUrl(url: string): string | null {
  const m =
    /^liftcamp:\/\/invite\/([^/?#]+)/i.exec(url) ??
    /^https:\/\/(?:www\.)?liftcamp\.app\/i\/([^/?#]+)/i.exec(url);
  return m ? normalizeInviteCode(decodeURIComponent(m[1])) : null;
}

/**
 * The share sheet's text for an invite. The link is in the message itself:
 * Android's share sheet drops `url`, so a link passed only there is lost.
 */
export function inviteMessage(code: string): string {
  return `Train with me on LiftCamp: ${inviteLink(code)}`;
}

/**
 * The code in a link the app was opened with: the full URL, as the
 * system hands it over, or the bare path `/invite/<code>` that a router
 * may pass instead. Null for anything else.
 */
export function inviteCodeFromPath(path: string): string | null {
  const fromUrl = inviteCodeFromUrl(path);
  if (fromUrl) return fromUrl;
  const m = /^\/?invite\/([^/?#]+)/i.exec(path);
  return m ? normalizeInviteCode(decodeURIComponent(m[1])) : null;
}

/** Device-level, so it survives onboarding, sign-in and guest linking. */
export const PENDING_INVITE_KEY = `${APP_STORAGE_PREFIX}pending-invite`;
/** A saved invite that waits longer than this is dropped. */
export const PENDING_INVITE_DAYS = 7;

export function pendingInviteValue(code: string, now: number): string {
  return JSON.stringify({ code, savedAt: now });
}

/** The saved invite's code, or null when there is none, it is malformed, or it is past 7 days. */
export function readPendingInvite(raw: string | null, now: number): string | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object") return null;
    const { code, savedAt } = v as Record<string, unknown>;
    if (typeof code !== "string" || typeof savedAt !== "number") return null;
    if (now - savedAt > PENDING_INVITE_DAYS * DAY_MS || savedAt > now + DAY_MS) return null;
    return normalizeInviteCode(code);
  } catch {
    return null;
  }
}

/**
 * What to do with a saved invite now. Nothing without one or while signed
 * out; a guest is asked to create an account first, since guests cannot
 * follow or be followed; a signed-up user opens it.
 */
export type PendingInviteStep = "none" | "link" | "open";

export function pendingInviteStep(
  code: string | null,
  session: { userId: string | null; isGuest: boolean },
): PendingInviteStep {
  if (!code || !session.userId) return "none";
  return session.isGuest ? "link" : "open";
}

// ---------------------------------------------------------------------------
// The invite screen
// ---------------------------------------------------------------------------

/** One row of invite_preview(): the inviter and where the two stand. */
export type InvitePreview = {
  user_id: string;
  username: string | null;
  /** My follow of the inviter. */
  i_follow: FollowStatus | null;
  /** The inviter's follow of me. */
  follows_me: FollowStatus | null;
};

/** "Let them follow you": not sent, waiting on the inviter, or done. */
export type LetFollowButton = "offer" | "offered" | "following";

export type InviteScreen =
  | { kind: "loading" }
  /** The read failed; the saved invite is kept for another try. */
  | { kind: "error" }
  /** Social is off for me: "Friends are coming soon". */
  | { kind: "coming-soon" }
  /** Unknown or reset code, my own, an inviter without social, or a block. */
  | { kind: "not-found" }
  | { kind: "ready"; preview: InvitePreview; follow: FollowButton; letFollow: LetFollowButton };

/**
 * The invite screen from its two reads: `social_access()` asked live
 * (undefined while it runs, null when it failed), then invite_preview()
 * (undefined while it runs, null when it failed, [] for no row). The live
 * read, not the launch latch: a guest who links on the way here has
 * nothing latched for this run.
 */
export function inviteScreenState(input: {
  socialOn: boolean | null | undefined;
  preview: readonly InvitePreview[] | null | undefined;
}): InviteScreen {
  if (input.socialOn === undefined) return { kind: "loading" };
  if (input.socialOn === null) return { kind: "error" };
  if (!input.socialOn) return { kind: "coming-soon" };
  if (input.preview === undefined) return { kind: "loading" };
  if (input.preview === null) return { kind: "error" };
  const preview = input.preview[0];
  if (!preview) return { kind: "not-found" };
  return {
    kind: "ready",
    preview,
    follow: preview.i_follow === "accepted" ? "following" : preview.i_follow === "pending" ? "requested" : "follow",
    letFollow:
      preview.follows_me === "accepted" ? "following" : preview.follows_me === "pending" ? "offered" : "offer",
  };
}

export type InviteDirection = "follow" | "let_follow";

/** The invite screen's one button and the checkbox under it. */
export type InviteAction = {
  label: string;
  /** What one tap sends, in order. Empty when nothing is left to send. */
  sends: InviteDirection[];
  /** "Let them follow you too": shown while it can go with Follow. */
  checkbox: boolean;
  /** Where the other direction stands, when the checkbox is not shown. */
  note: string | null;
};

/**
 * One Follow button, with "Let them follow you too" checked by default
 * under it. Checked, one tap sends both requests; unchecked, only the
 * follow. Once the follow is sent, the button offers whatever is left.
 */
export function inviteAction(follow: FollowButton, letFollow: LetFollowButton, alsoLetFollow: boolean): InviteAction {
  const theirSide =
    letFollow === "following"
      ? "They already follow you."
      : letFollow === "offered"
        ? "They can follow you once they accept."
        : null;
  if (follow === "follow") {
    const checkbox = letFollow === "offer";
    return {
      label: "Follow",
      sends: checkbox && alsoLetFollow ? ["follow", "let_follow"] : ["follow"],
      checkbox,
      note: theirSide,
    };
  }
  const mySide = follow === "following" ? "You follow them." : "You asked to follow them.";
  if (letFollow === "offer") {
    return { label: "Let them follow you", sends: ["let_follow"], checkbox: false, note: mySide };
  }
  return { label: follow === "following" ? "Following" : "Requested", sends: [], checkbox: false, note: theirSide };
}

/**
 * The preview after a request_follow() answer, so the buttons change
 * without a second read. The server answers with the row's status:
 * 'accepted' when the request met one the inviter had already sent.
 */
export function afterInviteRequest(
  preview: InvitePreview,
  direction: InviteDirection,
  status: FollowStatus,
): InvitePreview {
  return direction === "follow" ? { ...preview, i_follow: status } : { ...preview, follows_me: status };
}

// ---------------------------------------------------------------------------
// Other people's avatars
// ---------------------------------------------------------------------------

/**
 * Initials for another person, from their username only: the first letter
 * of up to two parts split on underscores and digits ("will_gaske" is WG,
 * "lifter77915" is L). "?" without a username.
 */
export function socialInitials(username: string | null | undefined): string {
  const parts = (username ?? "").split(/[_\d]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}
