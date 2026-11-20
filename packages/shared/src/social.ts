// Social v0 rules, pure. The spec is docs/social-spec.md and the server side
// is supabase/migrations/20261004120000_social_schema.sql: the server
// decides who may see and do what, and these rules shape what the app
// shows from what the server returned, and what it keeps on the device.

import { APP_STORAGE_PREFIX } from "./account-deletion";
import { commentSnippet, type CommentInboxRow } from "./social-comments";
import { convertWeight, type WeightUnit } from "./units";

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

// ---------------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------------

/** Days of workouts the following feed shows. A person's profile has no limit. */
export const FEED_DAYS = 14;
export const FEED_PAGE = 20;
/** A person's recent workouts on their profile screen, per page. */
export const PROFILE_PAGE = 10;
/** Exercise rows a feed card lists before "+N more exercises". */
export const CARD_EXERCISES = 3;

/** One exercise on a feed card: its completed sets, and whether it held a PR. */
export type FeedExercise = {
  workout_exercise_id: string;
  exercise_id: string;
  name: string;
  /** Completed sets. Exercises with none are left out by the server. */
  sets: number;
  /** Null when the owner's phone did not know (workouts before social-feed, or no PR baselines). */
  pr: boolean | null;
};

/** One row of social_feed(). */
export type FeedItem = {
  workout_id: string;
  user_id: string;
  username: string | null;
  name: string | null;
  /** The workout note, only on workouts made in the app; null otherwise. */
  note: string | null;
  workout_date: string;
  created_at: string;
  finished_at: string | null;
  completed_sets: number;
  /** In `volume_unit`, from the owner's phone at finish. Null before social-feed. */
  volume: number | null;
  volume_unit: string | null;
  pr_count: number | null;
  exercises: FeedExercise[];
  kudos_count: number;
  kudos_given: boolean;
  /**
   * Comments the viewer can see (docs/social-comments.sql), 0 without a
   * mutual follow. Missing before that SQL runs.
   */
  comment_count?: number;
  /**
   * A mutual follow (docs/social-safety.sql): likes, and comments later,
   * need one. Missing before that SQL runs, when anyone who can see a
   * workout could like it, so missing reads as true (canInteract).
   */
  can_interact?: boolean;
};

/** Whether the viewer may like a workout: false only when the server said so. */
export function canInteract(row: { can_interact?: boolean | null }): boolean {
  return row.can_interact !== false;
}

/** The muted line in place of the like button without a mutual follow. */
export const MUTUAL_ONLY_LINE = "You can like and comment once you follow each other.";

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

/** The next page's cursor: the last item's finished_at and id, the server's sort key. */
export type FeedCursor = { before: string; beforeId: string };

export function feedCursor(items: readonly FeedItem[]): FeedCursor | null {
  const last = items[items.length - 1];
  return last?.finished_at ? { before: last.finished_at, beforeId: last.workout_id } : null;
}

/**
 * A page appended to what is held, without repeats: a workout that moved
 * between pages (a kudos changes nothing, but a refresh can) shows once.
 */
export function appendFeedPage(held: readonly FeedItem[], page: readonly FeedItem[]): FeedItem[] {
  const seen = new Set(held.map((i) => i.workout_id));
  return [...held, ...page.filter((i) => !seen.has(i.workout_id))];
}

/** An item with its kudos state replaced, for the optimistic tap and the server's answer. */
export function withKudos<T extends { workout_id: string; kudos_count: number; kudos_given: boolean }>(
  items: readonly T[],
  workoutId: string,
  state: KudosState,
): T[] {
  return items.map((i) => (i.workout_id === workoutId ? { ...i, kudos_count: state.count, kudos_given: state.given } : i));
}

/** The card's exercise rows: the first three, and how many are left for "+N more exercises". */
export function cardExercises<T>(exercises: readonly T[], max = CARD_EXERCISES): { shown: T[]; more: number } {
  if (exercises.length <= max) return { shown: [...exercises], more: 0 };
  return { shown: exercises.slice(0, max), more: exercises.length - max };
}

export function moreExercisesLine(more: number): string | null {
  return more > 0 ? `+${more} more ${more === 1 ? "exercise" : "exercises"}` : null;
}

/** "4 sets", the card row's count. */
export function setCountLabel(sets: number): string {
  return `${sets} ${sets === 1 ? "set" : "sets"}`;
}

/**
 * The owner's volume in the viewer's unit, or null to hide the stat
 * (workouts finished before the phone wrote it).
 */
export function feedVolume(
  item: Pick<FeedItem, "volume" | "volume_unit">,
  viewerUnit: WeightUnit,
): number | null {
  if (item.volume == null || !Number.isFinite(item.volume)) return null;
  const from: WeightUnit = item.volume_unit === "kg" ? "kg" : "lb";
  return convertWeight(item.volume, from, viewerUnit);
}

/** The note as the card shows it: trimmed, or null to leave the line out. */
export function feedNote(note: string | null | undefined): string | null {
  const t = (note ?? "").trim();
  return t ? t : null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Local midnight of the day `ms` falls on. */
function dayStart(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * How long ago, in the device's time zone: "now" under a minute, "5m",
 * "3h" earlier today, "Yesterday", a weekday within the last week ("Tue"),
 * then "Oct 2", with the year when it is not this year ("Oct 2, 2025").
 */
export function timeAgo(iso: string, now: number): string {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return "";
  const diff = Math.max(0, now - at);
  const today = dayStart(now);
  const day = dayStart(at);
  if (diff < 60_000) return "now";
  if (day === today) return diff < 3_600_000 ? `${Math.floor(diff / 60_000)}m` : `${Math.floor(diff / 3_600_000)}h`;
  const days = Math.round((today - day) / DAY_MS);
  if (days === 1) return "Yesterday";
  const d = new Date(at);
  if (days < 7) return WEEKDAYS[d.getDay()];
  const md = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() === new Date(now).getFullYear() ? md : `${md}, ${d.getFullYear()}`;
}

// ---------------------------------------------------------------------------
// The notifications inbox
// ---------------------------------------------------------------------------

/** Days of kudos and accepted follows the inbox shows. Requests show until answered. */
export const INBOX_DAYS = 30;

/** One row of social_kudos_inbox(): one person's kudos on one of my workouts. */
export type KudosInboxRow = {
  workout_id: string;
  workout_name: string | null;
  user_id: string;
  username: string | null;
  created_at: string;
};

export type InboxItem =
  /** Someone asked to follow me, or offered to let me follow them. */
  | { kind: "request"; key: string; at: string; row: FollowRow }
  /** A request I started was approved: I follow them, or they follow me. */
  | { kind: "accepted"; key: string; at: string; row: FollowRow }
  /** Kudos on one of my workouts, one item per workout, newest giver first. */
  | {
      kind: "kudos";
      key: string;
      at: string;
      workoutId: string;
      workoutName: string | null;
      people: { userId: string; username: string | null }[];
    }
  /** Someone else's comment on one of my workouts, one item per comment. */
  | {
      kind: "comment";
      key: string;
      at: string;
      commentId: string;
      workoutId: string;
      workoutName: string | null;
      userId: string;
      username: string | null;
      body: string;
    };

export type Inbox = {
  /** Waiting on me, newest first. Stay until answered. */
  requests: InboxItem[];
  /** Kudos, comments and accepted follows from the last 30 days, newest first. */
  activity: InboxItem[];
};

const byNewest = (a: { at: string }, b: { at: string }) => b.at.localeCompare(a.at);

/**
 * The inbox from the reads it is built from: list_follows() rows (the
 * same rows Profile holds), social_kudos_inbox() and
 * social_comment_inbox(). No notifications table: every item is a row
 * that already exists.
 *
 * - Requests: pending rows someone else started, not expired. list_follows
 *   already hides the ones I declined.
 * - Accepted: accepted rows I started, timed by accepted_at, which both
 *   respond_follow and open_follow set to the moment of approval.
 * - Kudos: grouped per workout, timed by the newest kudos on it.
 * - Comments: one item each, from someone else, in the last 30 days.
 */
export function inboxItems(
  followRows: readonly FollowRow[],
  kudosRows: readonly KudosInboxRow[],
  me: string,
  now: number,
  commentRows: readonly CommentInboxRow[] = [],
): Inbox {
  const requests: InboxItem[] = [];
  const activity: InboxItem[] = [];
  const cutoff = now - INBOX_DAYS * DAY_MS;

  for (const r of followRows) {
    if (requestExpired(r, now)) continue;
    const key = `${r.follower_id}:${r.followee_id}`;
    if (r.status === "pending" && r.requested_by !== me) {
      requests.push({ kind: "request", key: `request:${key}`, at: r.created_at, row: r });
    } else if (r.status === "accepted" && r.requested_by === me && r.accepted_at) {
      const at = Date.parse(r.accepted_at);
      if (Number.isFinite(at) && at >= cutoff) {
        activity.push({ kind: "accepted", key: `accepted:${key}`, at: r.accepted_at, row: r });
      }
    }
  }

  const byWorkout = new Map<string, KudosInboxRow[]>();
  for (const k of kudosRows) {
    if (k.user_id === me) continue;
    const at = Date.parse(k.created_at);
    if (!Number.isFinite(at) || at < cutoff) continue;
    const list = byWorkout.get(k.workout_id) ?? [];
    list.push(k);
    byWorkout.set(k.workout_id, list);
  }
  for (const [workoutId, list] of byWorkout) {
    const sorted = [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
    activity.push({
      kind: "kudos",
      key: `kudos:${workoutId}`,
      at: sorted[0].created_at,
      workoutId,
      workoutName: sorted[0].workout_name,
      people: sorted.map((k) => ({ userId: k.user_id, username: k.username })),
    });
  }

  for (const r of commentRows) {
    if (r.user_id === me) continue;
    const at = Date.parse(r.created_at);
    if (!Number.isFinite(at) || at < cutoff) continue;
    activity.push({
      kind: "comment",
      key: `comment:${r.comment_id}`,
      at: r.created_at,
      commentId: r.comment_id,
      workoutId: r.workout_id,
      workoutName: r.workout_name,
      userId: r.user_id,
      username: r.username,
      body: r.body,
    });
  }

  return { requests: requests.sort(byNewest), activity: activity.sort(byNewest) };
}

/** "@will", or a stand-in for an account with no username. */
export function socialHandle(username: string | null | undefined): string {
  return username ? `@${username}` : "A LiftCamp member";
}

/** The sentence for an inbox item. No colons, no dashes. */
export function inboxLine(item: InboxItem, me: string): string {
  if (item.kind === "request") {
    const who = socialHandle(item.row.other_username);
    return item.row.follower_id === me ? `${who} offered to let you follow them` : `${who} wants to follow you`;
  }
  if (item.kind === "accepted") {
    const who = socialHandle(item.row.other_username);
    return item.row.follower_id === me ? `${who} accepted your follow request` : `${who} now follows you`;
  }
  const what = item.workoutName?.trim() || "your workout";
  if (item.kind === "comment") {
    return `${socialHandle(item.username)} commented on ${what}, “${commentSnippet(item.body)}”`;
  }
  const [first, second] = item.people;
  const rest = item.people.length - 1;
  const who =
    rest === 0
      ? socialHandle(first.username)
      : rest === 1
        ? `${socialHandle(first.username)} and ${socialHandle(second.username)}`
        : `${socialHandle(first.username)} and ${rest} others`;
  return `${who} gave kudos on ${what}`;
}

/** When this device last opened the inbox, for the bell's dot. Per device, like the queue. */
export function inboxSeenKey(userId: string): string {
  return `${APP_STORAGE_PREFIX}inbox-seen:${userId}`;
}

export function inboxSeenValue(at: number): string {
  return String(Math.floor(at));
}

/** The stored last-seen time, or null for nothing or anything unreadable. */
export function parseInboxSeen(raw: string | null): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * The bell's dot: anything in the inbox newer than this device last saw,
 * requests included. A request seen once no longer lights it, though it
 * stays at the top until it is answered. Never opened: any item at all.
 */
export function hasUnseenInbox(inbox: Inbox, seen: number | null): boolean {
  const all = [...inbox.requests, ...inbox.activity];
  if (seen == null) return all.length > 0;
  return all.some((i) => {
    const at = Date.parse(i.at);
    return Number.isFinite(at) && at > seen;
  });
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
