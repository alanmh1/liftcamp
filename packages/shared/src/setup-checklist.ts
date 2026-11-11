import { APP_STORAGE_PREFIX } from "./account-deletion";

/**
 * The setup checklist on Home: five first-week tasks, each worked out from
 * data the app already has, except the invite and the hide, which are
 * timestamps on `user_profiles`.
 *
 * Every user has all five, so the header's "N of M" never changes its M.
 * A guest's first task is the account: "Create a free account", since a
 * guest can finish one workout and needs an account to start the next
 * (start-gate.ts). From the first finished workout it is promoted, with
 * its own button, until the account is linked. A signed-in account has it
 * done, as "Save your workouts".
 */

export type SetupTaskKey = "save" | "log" | "profile" | "routine" | "invite";

export type SetupTask = {
  key: SetupTaskKey;
  title: string;
  subtitle: string;
  done: boolean;
  /**
   * The save task for a guest who has finished a workout: tinted, with its
   * own button, because those workouts now exist on one phone only.
   */
  promoted: boolean;
};

export type SetupInput = {
  /** From the session, not the database. */
  isAnonymous: boolean;
  finishedCount: number;
  /** The user's own templates. */
  mineCount: number;
  sex: string | null;
  /** YYYY-MM-DD. */
  birthday: string | null;
  bodyweight: number | null;
  invitedFriendAt: string | null;
  /** Counts only while the invite is the only task left; see setupCardMode. */
  setupHiddenAt: string | null;
};

export type SetupState = {
  /**
   * All five, in a fixed order, so a finished task keeps its place and the
   * total never changes. "Do your first workout" is always there, even
   * beside Home's Next up card, and starts the same routine day that card
   * does.
   */
  tasks: SetupTask[];
  doneCount: number;
  /** Always 5. */
  total: number;
  allDone: boolean;
  /**
   * "Invite a friend" is the only task not done. The one state in which the
   * card offers Hide, and the only one a hide applies to.
   */
  canHide: boolean;
};

/** The account ask's title for a guest: the checklist task, before and after the first workout, and Home's row. */
export const CREATE_ACCOUNT_TITLE = "Create a free account";

/** Under it once the guest has a finished workout: the checklist's promoted row and Home's row. */
export const NEXT_WORKOUT_LINE = "Needed to log your next workout";

/** Whether a guest has anything to save yet. Home's save row and task both wait for it. */
export function shouldOfferSave(input: { isAnonymous: boolean; finishedCount: number }): boolean {
  return input.isAnonymous && input.finishedCount >= 1;
}

export function setupTasks(input: SetupInput): SetupState {
  const promoteSave = shouldOfferSave(input);
  const save: SetupTask = promoteSave
    ? {
        key: "save",
        title: CREATE_ACCOUNT_TITLE,
        subtitle: NEXT_WORKOUT_LINE,
        done: false,
        promoted: true,
      }
    : input.isAnonymous
      ? {
          key: "save",
          title: CREATE_ACCOUNT_TITLE,
          subtitle: "Keep training after your first workout",
          done: false,
          promoted: false,
        }
      : {
          key: "save",
          title: "Save your workouts",
          subtitle: "Add Apple or Google so they're on your next phone",
          done: true,
          promoted: false,
        };
  const task = (t: Omit<SetupTask, "promoted">): SetupTask => ({ ...t, promoted: false });
  const tasks: SetupTask[] = [
    save,
    task({
      key: "log",
      title: "Do your first workout",
      subtitle: input.mineCount >= 1 ? "Start the next day of your routine" : "Pick a routine to start with",
      done: input.finishedCount >= 1,
    }),
    task({
      key: "profile",
      title: "Complete your profile",
      subtitle: "Add a few details about yourself",
      done: input.sex != null && input.birthday != null && input.bodyweight != null,
    }),
    task({
      key: "routine",
      title: "Save a routine",
      subtitle: "Tap Use on any starter routine",
      done: input.mineCount >= 1,
    }),
    task({
      key: "invite",
      title: "Invite a friend",
      subtitle: "Lifting is easier with company",
      done: input.invitedFriendAt != null,
    }),
  ];
  const doneCount = tasks.filter((t) => t.done).length;
  const undone = tasks.filter((t) => !t.done);
  return {
    tasks,
    doneCount,
    total: tasks.length,
    allDone: undone.length === 0,
    canHide: undone.length === 1 && undone[0].key === "invite",
  };
}

/** Device storage key: this user has seen the finished checklist. Under the app prefix, so account deletion clears it. */
export function setupCompletedSeenKey(userId: string): string {
  return `${APP_STORAGE_PREFIX}setup-completed-seen:${userId}`;
}

/** How Home shows the checklist: not at all, with its tasks, or finished ("All done"). */
export type SetupCardMode = "hidden" | "open" | "done";

/**
 * The checklist stays on Home until every task is done, then stays,
 * finished, for the rest of the app session in which its last task
 * ticked, and is gone from the next launch.
 *
 * - Only the invite left and the user hid the card: hidden. A hide counts
 *   in that state only, so if another task unticks later (the last
 *   routine removed) the card comes back.
 * - Any other task not done: open, even after a finish was seen.
 * - All done after a hide: hidden.
 * - All done and already shown finished this session: done.
 * - All done and never seen finished on this phone: done, and the caller
 *   records it as seen, so the next launch hides it.
 * - All done and seen on an earlier launch: hidden. While that is still
 *   being read (undefined), hidden too, so the card cannot flash.
 */
export function setupCardMode(
  setup: SetupState,
  input: { setupHiddenAt: string | null; completionSeen: boolean | undefined; doneShownThisSession: boolean },
): SetupCardMode {
  const hidden = input.setupHiddenAt != null;
  if (!setup.allDone) return hidden && setup.canHide ? "hidden" : "open";
  if (hidden) return "hidden";
  if (input.doneShownThisSession || input.completionSeen === false) return "done";
  return "hidden";
}

/** Routine id to the ISO time of its Skip on Home's card. Kept on the phone. */
export type UpNextSkips = Record<string, string>;

/** Device storage key for the skips. Under the app prefix, so account deletion clears it. */
export function upNextSkipKey(userId: string): string {
  return `${APP_STORAGE_PREFIX}upnext-skip:${userId}`;
}

/** The stored skips. Anything unreadable counts as none: a skip is only a preference. */
export function parseUpNextSkips(raw: string | null): UpNextSkips {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((e): e is [string, string] => typeof e[1] === "string"),
    );
  } catch {
    return {};
  }
}

type SkippableDay = { id: string; lastDone: string | null; lastDoneAt?: string | null };

function timeOf(at: string | null | undefined): number {
  return at ? Date.parse(at) : -Infinity;
}

function finishTime(t: SkippableDay): number {
  return timeOf(t.lastDoneAt ?? t.lastDone);
}

/** The day ranked at its skip, unless a later finish has replaced the skip. */
function withStandingSkip<T extends SkippableDay>(t: T, skips: UpNextSkips): T {
  return timeOf(skips[t.id]) > finishTime(t) ? { ...t, lastDoneAt: skips[t.id] } : t;
}

type RotationFields = {
  id: string;
  /** Missing on a Home cache written before the column: counts as in. */
  in_rotation?: boolean | null;
  rotation_position?: number | null;
  created_at?: string | null;
};

/**
 * The saved routines Up next goes through, in the user's order:
 * `in_rotation` on, by `rotation_position`, then `created_at`. A row with
 * no position (an old cache) goes after the positioned ones.
 */
export function rotationRoutines<T extends RotationFields>(days: T[]): T[] {
  return days
    .filter((t) => t.in_rotation !== false)
    .sort((a, b) => {
      const pa = a.rotation_position ?? Number.MAX_SAFE_INTEGER;
      const pb = b.rotation_position ?? Number.MAX_SAFE_INTEGER;
      if (pa !== pb) return pa - pb;
      const ca = a.created_at ?? "";
      const cb = b.created_at ?? "";
      return ca < cb ? -1 : ca > cb ? 1 : 0;
    });
}

/**
 * The saved routines out of the rotation, most recently done first. Never
 * done goes last, newest saved first among those.
 */
export function otherRoutines<T extends RotationFields & SkippableDay>(days: T[]): T[] {
  return days
    .filter((t) => t.in_rotation === false)
    .sort((a, b) => {
      const fa = finishTime(a);
      const fb = finishTime(b);
      if (fa !== fb) return fb - fa;
      const ca = a.created_at ?? "";
      const cb = b.created_at ?? "";
      return ca > cb ? -1 : ca < cb ? 1 : 0;
    });
}

/**
 * The routine Up next offers: the one after the routine done last, in
 * rotation order, wrapping from the end to the start. `rotation` is
 * `rotationRoutines`' output.
 *
 * - "Done last" is the latest finish, or the latest standing Skip: a Skip
 *   counts as done at the moment it was tapped, until a later finish of
 *   that routine replaces it. So Skip moves Up next one step on.
 * - Nothing done or skipped yet: the first routine.
 * - Empty rotation: null.
 *
 * A routine out of the rotation is not in `rotation`, so a workout done
 * from it leaves Up next where it was.
 */
export function nextInRotation<T extends SkippableDay>(rotation: T[], skips: UpNextSkips): T | null {
  if (rotation.length === 0) return null;
  let last = -1;
  let lastAt = -Infinity;
  rotation.forEach((t, i) => {
    const at = finishTime(withStandingSkip(t, skips));
    if (at > lastAt) {
      lastAt = at;
      last = i;
    }
  });
  return rotation[(last + 1) % rotation.length];
}
