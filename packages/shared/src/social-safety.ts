import { APP_STORAGE_PREFIX } from "./account-deletion";

/**
 * Social safety rules shared by the app (docs/social-v1-spec.md, Branch 2):
 * report reasons and errors, the community rules cache, the username
 * blocklist error, and the note warning.
 */

export const CONTACT_EMAIL = "hello@liftcamp.app";
export const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}`;
export const COMMUNITY_RULES_URL = "https://liftcamp.app/terms#community";

/** The four reasons a person can pick. `auto_flag` is the server's alone. */
export type ReportReason = "inappropriate" | "harassment" | "spam" | "other";

export const REPORT_REASONS: readonly { key: ReportReason; label: string }[] = [
  { key: "inappropriate", label: "Inappropriate" },
  { key: "harassment", label: "Harassment" },
  { key: "spam", label: "Spam" },
  { key: "other", label: "Other" },
];

export const REPORT_THANKS = "Thanks. We review every report within 24 hours.";
export const REPORT_LIMIT_MESSAGE = "You've sent a lot of reports today. Try again tomorrow.";

/** file_report's 10-a-day limit (SQLSTATE 54000). */
export const REPORT_LIMIT_CODE = "54000";

/** The line a failed report shows: the limit in the app's words, anything else as the server said it. */
export function reportErrorMessage(error: { code?: string; message: string }): string {
  return error.code === REPORT_LIMIT_CODE ? REPORT_LIMIT_MESSAGE : error.message;
}

/** The blocklist trigger on user_profiles.username (docs/social-safety.sql, Section 2). */
export const USERNAME_BLOCKED_CODE = "23514";
export const USERNAME_BLOCKED_MESSAGE = "That username isn't allowed. Pick another.";

/**
 * Whether an automatic username write moves on to the next candidate:
 * taken (23505) or on the blocklist (23514). Anything else stops.
 */
export function usernameRetryable(code: string | null | undefined): boolean {
  return code === "23505" || code === USERNAME_BLOCKED_CODE;
}

export const NOTE_HIDDEN_WARNING = "Friends won't see this note. It has words we don't allow in shared posts.";

/**
 * Whether to ask the server about a note when its sheet closes: social on,
 * signed up, online, and something to check.
 */
export function shouldCheckNote(input: {
  socialOn: boolean;
  isGuest: boolean;
  offline: boolean;
  note: string;
}): boolean {
  return input.socialOn && !input.isGuest && !input.offline && input.note.trim().length > 0;
}

/**
 * The note warning after a check: shown when the server said no, hidden
 * when it said yes or the note is empty, unchanged when the check never
 * answered (offline, an error), so a dropped signal neither shows nor
 * clears it.
 */
export function noteWarningAfter(
  shown: boolean,
  input: { note: string; allowed: boolean | null },
): boolean {
  if (input.note.trim().length === 0) return false;
  if (input.allowed === null) return shown;
  return !input.allowed;
}

/** The per-user device cache of community_rules_accepted_at. */
export function communityRulesKey(userId: string): string {
  return `${APP_STORAGE_PREFIX}community-rules:${userId}`;
}

/** Accepted once means accepted for good on this device. */
export function parseCommunityRulesCache(raw: string | null): boolean {
  return raw != null && raw.length > 0;
}
