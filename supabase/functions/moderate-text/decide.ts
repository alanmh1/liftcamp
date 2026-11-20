// moderate-text's decisions, with no I/O: whether a request is
// authorized, what the body names, which text a row (a workout, a
// username or a comment) gives the check, what
// OpenAI's answer means, and what to write back. index.ts does the network
// calls and follows these answers. No imports, so vitest runs this file
// from packages/shared (src/moderate-text-decide.test.ts) as it is
// deployed.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ModerationTable = "workouts" | "user_profiles" | "avatars" | "workout_comments";
export type ModerationTarget = { table: ModerationTable; id: string };

/**
 * Whether the x-moderation-secret header matches MODERATION_HOOK_SECRET.
 * Compares every character whatever the length of the match so far. An
 * unset secret refuses everything.
 */
export function authorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || header === null) return false;
  let diff = header.length ^ secret.length;
  for (let i = 0; i < secret.length; i++) {
    diff |= (header.charCodeAt(i) || 0) ^ secret.charCodeAt(i);
  }
  return diff === 0;
}

/** The body's table and id, or null for anything else. Text in the body is ignored. */
export function parseTarget(body: unknown): ModerationTarget | null {
  if (!body || typeof body !== "object") return null;
  const { table, id } = body as { table?: unknown; id?: unknown };
  if (table !== "workouts" && table !== "user_profiles" && table !== "avatars" && table !== "workout_comments") {
    return null;
  }
  if (typeof id !== "string" || !UUID.test(id)) return null;
  return { table, id };
}

export type WorkoutRow = {
  id: string;
  user_id: string;
  name: string | null;
  notes: string | null;
  finished_at: string | null;
  platform: string | null;
  moderation_flagged_at: string | null;
};

/**
 * The text a workout sends: name and note joined by a newline. Null means
 * skip: the row is gone, unfinished, not made in the app (web-era notes
 * never reach friends), or has nothing to check.
 */
export function workoutText(row: WorkoutRow | null): string | null {
  if (!row || !row.finished_at) return null;
  if (row.platform !== "ios" && row.platform !== "android") return null;
  const parts = [row.name, row.notes].map((s) => (s ?? "").trim()).filter((s) => s.length > 0);
  return parts.length > 0 ? parts.join("\n") : null;
}

/** The text a username sends, underscores read as spaces. Null means skip. */
export function usernameText(username: string | null | undefined): string | null {
  const text = (username ?? "").replace(/_/g, " ").trim();
  return text.length > 0 ? text : null;
}

export type AvatarRow = {
  user_id: string;
  avatar_url: string | null;
  avatar_status: string | null;
};

/**
 * The photo address an avatars check sends, or null to skip: no profile,
 * no photo, or a photo that is not waiting for a check (already ok or
 * flagged, so an old or repeated call changes nothing).
 */
export function avatarToCheck(row: AvatarRow | null): string | null {
  if (!row || row.avatar_status !== "pending") return null;
  const url = (row.avatar_url ?? "").trim();
  return url.length > 0 ? url : null;
}

export type CommentRow = {
  id: string;
  workout_id: string;
  user_id: string;
  body: string | null;
  moderation_flagged_at: string | null;
};

/** The text a comment sends: its body. Null means skip: the comment is gone or empty. */
export function commentText(row: CommentRow | null): string | null {
  const text = (row?.body ?? "").trim();
  return text.length > 0 ? text : null;
}

/**
 * What a comment's verdict writes (docs/social-v2-spec.md, moderate-text).
 * Always `moderated_at`. Flagged: `moderation_flagged_at` too, keeping an
 * earlier flag's time. Not flagged: the flag is left alone, since only an
 * admin's dismiss clears it (comments cannot be edited). A flagged verdict
 * files a report unless one is open for the comment already.
 */
export function commentUpdate(
  row: Pick<CommentRow, "moderation_flagged_at">,
  verdict: Verdict,
  now: string,
): { moderated_at: string; moderation_flagged_at?: string } {
  return verdict.flagged
    ? { moderated_at: now, moderation_flagged_at: row.moderation_flagged_at ?? now }
    : { moderated_at: now };
}

/** The moderation input for a photo: one image_url part. */
export function imageInput(url: string): { type: "image_url"; image_url: { url: string } }[] {
  return [{ type: "image_url", image_url: { url } }];
}

/** The part of OpenAI's /v1/moderations answer this function reads. */
export type ModerationResponse = {
  results?: { flagged?: unknown; categories?: Record<string, unknown> | null }[];
};

export type Verdict = { flagged: boolean; categories: string[] };

/**
 * OpenAI's answer for a single input (a string or one image): one result. Categories are
 * the ones set to true (a category can also be null). Null when the
 * answer has no result to read.
 */
export function verdictFrom(response: ModerationResponse): Verdict | null {
  const result = response.results?.[0];
  if (!result || typeof result.flagged !== "boolean") return null;
  const categories = Object.entries(result.categories ?? {})
    .filter(([, on]) => on === true)
    .map(([name]) => name)
    .sort();
  return { flagged: result.flagged, categories };
}

/**
 * What a workout's verdict writes. `moderation_flagged_at` keeps an
 * earlier flag's time, so the first flag is the one on record, and clears
 * when the text now passes. `newlyFlagged` is the move from unflagged to
 * flagged, the only time a report is filed.
 */
export function workoutUpdate(
  row: Pick<WorkoutRow, "moderation_flagged_at">,
  verdict: Verdict,
  now: string,
): { moderated_at: string; moderation_flagged_at: string | null; newlyFlagged: boolean } {
  const was = row.moderation_flagged_at;
  return {
    moderated_at: now,
    moderation_flagged_at: verdict.flagged ? (was ?? now) : null,
    newlyFlagged: verdict.flagged && was == null,
  };
}

/**
 * Whether a failed report insert means another call already filed it: a
 * unique violation on reports_one_open_autoflag_workout,
 * reports_one_open_autoflag_username (docs/social-safety.sql, Section 7),
 * reports_one_open_autoflag_avatar (docs/profile-photos.sql, Section 5)
 * or reports_one_open_autoflag_comment (docs/social-comments.sql,
 * Section 5b; the workout index leaves comment reports out).
 * A burst of saves runs the function in parallel, and only one insert wins.
 */
export function alreadyReported(error: { code?: string } | null | undefined): boolean {
  return error?.code === "23505";
}
