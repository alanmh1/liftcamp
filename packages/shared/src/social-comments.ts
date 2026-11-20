/**
 * Comments on a finished workout (docs/social-v2-spec.md, Branch 3:
 * social-comments; database contract docs/social-comments.sql).
 *
 * Mutual follows and the workout's owner can read and write them. Delete
 * only, no edit: the author or the workout's owner can delete one. 500
 * characters, 30 an hour, enforced by add_comment.
 */

/** add_comment refuses anything longer. */
export const COMMENT_MAX = 500;

/** One row of workout_comments(p_workout), oldest first. */
export type CommentRow = {
  id: string;
  user_id: string;
  username: string | null;
  body: string;
  created_at: string;
  /** The viewer wrote it. */
  mine: boolean;
  /** The viewer wrote it or owns the workout. */
  can_delete: boolean;
};

/**
 * One of a feed row's recent_comments (docs/social-feed-inline.sql): the
 * latest 2 the viewer may see, oldest of the two first, body cut at 280.
 */
export type RecentComment = {
  id: string;
  user_id: string;
  username: string | null;
  body: string;
  created_at: string;
  /** The viewer wrote it. */
  mine: boolean;
};

/** Comments a feed card shows under its actions. */
export const RECENT_COMMENTS = 2;

/**
 * recent_comments on a social_feed row or social_workout, checked: rows
 * without an id, author, body or time are dropped, and at most the last 2
 * are kept. [] when missing (before that SQL) or not an array.
 */
export function readRecentComments(row: { recent_comments?: unknown }): RecentComment[] {
  const raw = row.recent_comments;
  if (!Array.isArray(raw)) return [];
  const out: RecentComment[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.user_id !== "string") continue;
    if (typeof o.body !== "string" || typeof o.created_at !== "string") continue;
    out.push({
      id: o.id,
      user_id: o.user_id,
      username: typeof o.username === "string" ? o.username : null,
      body: o.body,
      created_at: o.created_at,
      mine: o.mine === true,
    });
  }
  return out.slice(-RECENT_COMMENTS);
}

/** "View all 5 comments", only when there are more than the card shows. */
export function viewAllCommentsLine(count: number): string | null {
  return count > RECENT_COMMENTS ? `View all ${count} comments` : null;
}

/** One row of social_comment_inbox(): someone else's comment on one of my workouts. */
export type CommentInboxRow = {
  comment_id: string;
  workout_id: string;
  workout_name: string | null;
  user_id: string;
  username: string | null;
  /** The first 140 characters. */
  body: string;
  created_at: string;
};

/** add_comment's blocklist refusal (SQLSTATE 23514). */
export const COMMENT_BLOCKED_CODE = "23514";
export const COMMENT_BLOCKED_MESSAGE = "Keep it friendly. That comment has words we don't allow.";
/** add_comment's 30-an-hour limit (SQLSTATE 54000). */
export const COMMENT_LIMIT_CODE = "54000";
export const COMMENT_LIMIT_MESSAGE = "You're commenting a lot. Try again in a bit.";

/**
 * The line a failed send shows under the composer: the blocklist and the
 * rate limit in the app's words, anything else as the data layer gave it
 * (the server's sentence for a known refusal, the offline line otherwise).
 */
export function commentErrorMessage(error: { code?: string; message: string }): string {
  if (error.code === COMMENT_BLOCKED_CODE) return COMMENT_BLOCKED_MESSAGE;
  if (error.code === COMMENT_LIMIT_CODE) return COMMENT_LIMIT_MESSAGE;
  return error.message;
}

/** The text to send, trimmed, or null when there is nothing to send or it is too long. */
export function commentToSend(draft: string): string | null {
  const body = draft.trim();
  if (body.length === 0 || body.length > COMMENT_MAX) return null;
  return body;
}

export type CommentAction = "report" | "block" | "delete";

/**
 * The ⋯ menu on a comment. Someone else's comment gets Report and Block;
 * Delete joins when the viewer owns the workout. The viewer's own comment
 * gets Delete only.
 */
export function commentActions(row: Pick<CommentRow, "mine" | "can_delete">): CommentAction[] {
  if (row.mine) return ["delete"];
  const actions: CommentAction[] = ["report", "block"];
  if (row.can_delete) actions.push("delete");
  return actions;
}

/** The list after blocking `userId`: their comments go at once, before the re-read. */
export function withoutAuthor<T extends Pick<CommentRow, "user_id">>(rows: readonly T[], userId: string): T[] {
  return rows.filter((r) => r.user_id !== userId);
}

/** "1 comment", "3 comments", for the screen reader. */
export function commentCountLabel(count: number): string {
  return `${count} ${count === 1 ? "comment" : "comments"}`;
}

/** The own workout detail's row. "Comments" with none yet. */
export function commentsRowLabel(count: number): string {
  return count === 0 ? "Comments" : commentCountLabel(count);
}

/** The comment count on a social_feed row or social_workout; 0 when missing or unreadable. */
export function readCommentCount(row: { comment_count?: unknown }): number {
  const n = Number(row.comment_count);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** A comment cut for one inbox line, on a word where it can be. */
export function commentSnippet(body: string, max = 60): string {
  const flat = body.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
