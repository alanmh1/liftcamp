/**
 * Usernames, the handle printed on share cards.
 *
 * Mirrors the database: `user_profiles.username` is unique on
 * `lower(username)` and checked against this shape, so a value that passes
 * here can only fail there by being taken.
 */
export const USERNAME_RE = /^[a-z][a-z0-9_]{2,19}$/;

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

/** Lowercased and stripped to the allowed characters, as the user types. */
export function normalizeUsernameInput(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, USERNAME_MAX);
}

export function isValidUsername(name: string): boolean {
  return USERNAME_RE.test(name);
}

/**
 * The one line that says why a candidate is not allowed, or null when it
 * is. Kept short enough for an inline error under an input.
 */
export function usernameProblem(name: string): string | null {
  if (name.length < USERNAME_MIN) return `At least ${USERNAME_MIN} characters.`;
  if (!/^[a-z]/.test(name)) return "Start with a letter.";
  if (!isValidUsername(name)) return "Lowercase letters, digits and underscore only.";
  return null;
}

/**
 * The username an email suggests, by the backfill's rules: the local part,
 * lowercased, stripped to the allowed characters, cut to 20. Null when that
 * leaves nothing usable, or when there is no email (an anonymous user).
 */
export function usernameFromEmail(email: string | null | undefined): string | null {
  const local = (email ?? "").split("@")[0] ?? "";
  const base = normalizeUsernameInput(local);
  return isValidUsername(base) ? base : null;
}

/**
 * `lifter` plus digits, the fallback the backfill used. Random rather than
 * a row count, since the app cannot count rows without racing another
 * client; the caller retries on a collision.
 */
export function fallbackUsername(): string {
  return `lifter${Math.floor(10000 + Math.random() * 90000)}`;
}
