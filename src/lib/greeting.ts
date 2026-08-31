// Home-screen header greeting and its supporting line.
//
// The heading is computed synchronously from the clock and the user's auth
// metadata, so it renders on first paint with no query and no layout shift.
// Only the supporting line waits on workout data.
//
// The weekly count lives in StreakCard directly below, so nothing here repeats
// "2 of 3 this week".

const NAME_MAX = 20;

/**
 * First name from Supabase auth metadata. Google OAuth populates full_name and
 * name; email/password signup populates neither, so those users get null and
 * the heading drops the name rather than calling them "alanmh".
 */
export function firstNameFromMetadata(meta: Record<string, unknown> | null | undefined): string | null {
  const raw =
    (typeof meta?.full_name === "string" && meta.full_name) ||
    (typeof meta?.name === "string" && meta.name) ||
    (typeof meta?.given_name === "string" && meta.given_name) ||
    "";
  const first = raw.trim().split(/\s+/)[0] ?? "";
  if (!first) return null;
  if (first.length > NAME_MAX) return null;
  // Reject anything that looks like a handle or email local-part.
  if (/[0-9@._]/.test(first)) return null;
  if (!/\p{L}/u.test(first)) return null;
  return first;
}

/**
 * The h1. Replaces the old static "Start Workout".
 */
export function headerGreeting(firstName: string | null, hour: number): string {
  const part = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
  return firstName ? `${part}, ${firstName}` : `Good ${part.toLowerCase()}`;
}

export type SupportingState = {
  /** Finished workouts in the last 26 weeks. */
  recentWorkoutCount: number;
  /** Whole days since the last finished workout, or null if there is none. */
  daysSinceLast: number | null;
  /** Stable per-user, per-day seed. */
  seed: number;
};

const FIRST_TIME = [
  "Your first session is 3 exercises and about 25 minutes.",
  "Pick a routine and we'll set the starting weights.",
];

const SECOND_SESSION = [
  "Session 2 is the same lifts with a little more weight.",
  "Same lifts as last time. Add weight where the last set felt easy.",
];

const TIPS = [
  "Warm up on the first set. It still counts.",
  "Log the set before you rest. Easier to remember.",
  "Rest 2 to 3 minutes between heavy sets.",
  "If the last rep looked clean, add weight next time.",
  "Same lifts, slightly more weight. That's the plan.",
];

export function supportingLine(s: SupportingState): string {
  const pick = <T,>(arr: T[]): T => arr[s.seed % arr.length];

  if (s.recentWorkoutCount === 0) return pick(FIRST_TIME);
  if (s.recentWorkoutCount === 1) return pick(SECOND_SESSION);
  if (s.daysSinceLast != null && s.daysSinceLast >= 10) {
    return `${s.daysSinceLast} days off. Start about 10% lighter than where you left off.`;
  }
  if (s.daysSinceLast === 0) return "Already trained today. Rest counts too.";
  return pick(TIPS);
}

/**
 * Stable seed from user id + local date. Same line all day, new line tomorrow,
 * and no reshuffle when the user navigates back to the home screen.
 */
export function dailySeed(userId: string, now: Date = new Date()): number {
  const day = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const key = `${userId}:${day}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
