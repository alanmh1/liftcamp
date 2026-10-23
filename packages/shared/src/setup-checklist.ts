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

/**
 * The routine day "Do your first workout" starts. Groups and their days
 * arrive in Home's order. Null when there are no routines.
 *
 * - Nothing done yet: the first day of the first routine.
 * - Last done in a multi-day routine: the day after the last one done in
 *   that routine, wrapping to the first.
 * - Last done in a routine of one (a routine built by hand or saved from a
 *   workout): the least recently done routine of one. A routine of one
 *   never done comes first, in list order; otherwise the one whose last
 *   finish is oldest. Five standalone routines done one a day then rotate
 *   like a week, and a skipped day is offered next.
 */
export function nextRoutineDay<T extends { lastDone: string | null; lastDoneAt?: string | null }>(
  groups: { templates: T[] }[],
): T | null {
  // The finish time when there is one, so two days done on the same date
  // still have an order; the date alone otherwise.
  const doneAt = (t: T) => t.lastDoneAt ?? t.lastDone;
  let latest: { group: number; day: number; at: string } | null = null;
  groups.forEach((g, group) =>
    g.templates.forEach((t, day) => {
      const at = doneAt(t);
      if (at && (!latest || at > latest.at)) latest = { group, day, at };
    }),
  );
  if (!latest) return groups.find((g) => g.templates.length > 0)?.templates[0] ?? null;
  const { group, day } = latest as { group: number; day: number };
  const days = groups[group].templates;
  if (days.length > 1) return days[(day + 1) % days.length];

  const singles = groups.filter((g) => g.templates.length === 1).map((g) => g.templates[0]);
  const neverDone = singles.find((t) => !doneAt(t));
  if (neverDone) return neverDone;
  let stalest = singles[0];
  for (const t of singles) {
    if ((doneAt(t) as string) < (doneAt(stalest) as string)) stalest = t;
  }
  return stalest;
}
