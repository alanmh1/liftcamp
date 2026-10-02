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
