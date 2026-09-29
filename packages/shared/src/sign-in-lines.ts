// The subtitle on the signed-out sign-in screen: one of these, picked at
// random each time the screen appears and never the line shown last time.

export const SIGN_IN_LINES = [
  "Sign in to pick up where you left off.",
  "Welcome back. Your next workout is waiting.",
  "Good to see you again. Sign in to pick up where you left off.",
  "Welcome back. Sign in and keep going.",
  "Back for more? Sign in and let's get to it.",
  "Every workout adds up. Sign in to keep building.",
  "Showing up is the hard part. You're already here.",
  "The weights missed you.",
  "Your barbell's been waiting. Sign in to get back to it.",
  "Rest day's over. Sign in and let's go.",
] as const;

/**
 * Where the app remembers the last line's index. Under the `liftcamp:`
 * prefix, so deleting an account and Start fresh clear it with the rest.
 */
export const SIGN_IN_LINE_KEY = "liftcamp:signin-line";

/**
 * A random index into `SIGN_IN_LINES`, never `last`. `last` is whatever was
 * stored: null, or anything that is not a valid index, means no rule to
 * follow. `random` is Math.random unless a test passes its own.
 */
export function pickSignInLine(last: number | null, random: () => number = Math.random): number {
  const n = SIGN_IN_LINES.length;
  const r = Math.min(Math.max(random(), 0), 1 - Number.EPSILON);
  if (last == null || !Number.isInteger(last) || last < 0 || last >= n) return Math.floor(r * n);
  // Pick among the other n - 1 lines, then step over `last`.
  const i = Math.floor(r * (n - 1));
  return i >= last ? i + 1 : i;
}

/** The stored value read back: an index, or null for anything else. */
export function parseSignInLine(stored: string | null): number | null {
  if (stored == null) return null;
  const n = Number(stored);
  return Number.isInteger(n) ? n : null;
}
