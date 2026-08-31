// Home-screen greeting. Reads only data the home screen already has in the
// React Query cache, so it costs no extra network round trip.
//
// The weekly count lives in StreakCard directly below this line, so nothing
// here repeats "2 of 3 this week".

const NAME_MAX = 20;

/**
 * First name from Supabase auth metadata. Google OAuth populates full_name and
 * name; email/password signup populates neither, so those users get null and
 * the greeting drops the name rather than calling them "alanmh".
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

export type GreetingState = {
  firstName: string | null;
  /** Finished workouts in the last 26 weeks. */
  recentWorkoutCount: number;
  /** Whole days since the last finished workout, or null if there is none. */
  daysSinceLast: number | null;
  /** Local hour, 0-23. */
  hour: number;
  /** Stable per-user, per-day seed. */
  seed: number;
};

function withName(line: string, name: string | null): string {
  return name ? line.replace("{name}", `, ${name}`) : line.replace("{name}", "");
}

const FIRST_TIME = [
  "Your first session is 3 exercises and about 25 minutes.",
  "Pick a routine and we'll set the starting weights.",
];

const SECOND_SESSION = [
  "Session 2 is the same movements with a little more weight.",
  "Same lifts as last time. Add a little weight where the last set felt easy.",
];

const TIPS = [
  "Warm up on the first set. It still counts.",
  "Log the set before you rest. Easier to remember.",
  "Rest 2 to 3 minutes between heavy sets.",
  "If the last rep looked clean, add weight next time.",
  "Same lifts, slightly more weight. That's the whole plan.",
];

function greetingsForHour(hour: number): string[] {
  if (hour < 12) return ["Morning{name}.", "Up early{name}."];
  if (hour < 17) return ["Afternoon{name}.", "Good time to train{name}."];
  return ["Evening{name}.", "Still time today{name}."];
}

export function pickGreeting(s: GreetingState): string {
  const pick = <T,>(arr: T[]): T => arr[s.seed % arr.length];

  if (s.recentWorkoutCount === 0) {
    const hello = withName(pick(greetingsForHour(s.hour)), s.firstName);
    return `${hello} ${pick(FIRST_TIME)}`;
  }

  if (s.recentWorkoutCount === 1) {
    return withName(pick(SECOND_SESSION), s.firstName).trim();
  }

  if (s.daysSinceLast != null && s.daysSinceLast >= 10) {
    return `${s.daysSinceLast} days off. Start about 10% lighter than where you left off.`;
  }

  if (s.daysSinceLast === 0) {
    return withName("Already trained today{name}. Rest counts too.", s.firstName);
  }

  const hello = withName(pick(greetingsForHour(s.hour)), s.firstName);
  return `${hello} ${pick(TIPS)}`;
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
