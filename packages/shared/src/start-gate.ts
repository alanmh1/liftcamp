import { APP_STORAGE_PREFIX } from "./account-deletion";

// A guest (anonymous session) can finish one workout. Starting another
// needs an account. Pure decisions here; the app owns the sheet, the
// signal check and the stored flag.

/** Finished workouts a guest may have before a start asks for an account. */
export const GUEST_WORKOUT_LIMIT = 1;

/**
 * What a tap on any start does:
 * - `start`: start it.
 * - `sign-up`: start nothing; show the create-account sheet, and start
 *   once an account is linked.
 * - `start-offline`: a guest who would be asked, or may be, with no signal
 *   to sign up with. Start anyway, since nobody is held up mid-gym for
 *   want of signal, and flag the sheet for Home once they are back online
 *   (signUpDueOnHome).
 */
export type StartGate = "start" | "sign-up" | "start-offline";

export function startGate(input: {
  isAnonymous: boolean;
  /** Opening a workout already in progress. Never gated. */
  resuming: boolean;
  /** The server answered the finished count just now. */
  online: boolean;
  /**
   * Finished workouts, the phone's unsynced finishes included. Null when
   * nothing is known (no signal and nothing cached).
   */
  finishedCount: number | null;
}): StartGate {
  if (input.resuming || !input.isAnonymous) return "start";
  const known = input.finishedCount;
  if (known != null && known < GUEST_WORKOUT_LIMIT) return "start";
  return input.online ? "sign-up" : "start-offline";
}

/**
 * The workout a start would leave behind: the newest of those in progress
 * found on the phone and on the server, or null. Every start checks this
 * first and offers Resume, so tapping a routine with one already open
 * never makes a second workout in progress.
 */
export function newestOpenWorkout<T extends { id: string; createdAt: string }>(
  ...found: (T | null | undefined)[]
): T | null {
  let newest: T | null = null;
  for (const w of found) if (w && (!newest || w.createdAt > newest.createdAt)) newest = w;
  return newest;
}

/** How old an unfinished workout is before it stops being in progress: Home's Resume window. */
export const OPEN_WORKOUT_MS = 24 * 60 * 60 * 1000;

type StaleCandidate = {
  createdAt: string;
  finishedAt?: string | null;
  sets: readonly {
    completed: boolean;
    weight_value?: number | null;
    reps?: number | null;
    duration_seconds?: number | null;
    distance_meters?: number | null;
    incline_percent?: number | null;
  }[];
};

/**
 * An unfinished workout a start discards without asking: older than the
 * Resume window, with no set ticked and nothing typed. A start seeds every
 * box empty (the gray values are placeholders), so any value in a set was
 * typed or copied by Add set. A workout someone opened to read days ago is
 * not something to resume.
 */
export function isStaleUntouched(w: StaleCandidate, now: number = Date.now()): boolean {
  if (w.finishedAt) return false;
  const created = Date.parse(w.createdAt);
  if (!Number.isFinite(created) || now - created <= OPEN_WORKOUT_MS) return false;
  return w.sets.every(
    (s) =>
      !s.completed &&
      s.weight_value == null &&
      s.reps == null &&
      s.duration_seconds == null &&
      s.distance_meters == null &&
      s.incline_percent == null,
  );
}

/**
 * Whether Home shows the create-account sheet on its own: a guest started
 * a workout offline that the gate would have stopped (the flag), and that
 * workout is over. Two or more finished means it was a second workout; a
 * guest whose offline workout turned out to be the first is not asked.
 */
export function signUpDueOnHome(input: {
  flagged: boolean;
  isAnonymous: boolean;
  online: boolean;
  inProgress: boolean;
  finishedCount: number;
}): boolean {
  return (
    input.flagged &&
    input.isAnonymous &&
    input.online &&
    !input.inProgress &&
    input.finishedCount > GUEST_WORKOUT_LIMIT
  );
}

/** Device storage key for that flag. Under the app prefix, so account deletion clears it. */
export function signUpDueKey(userId: string): string {
  return `${APP_STORAGE_PREFIX}signup-due:${userId}`;
}
