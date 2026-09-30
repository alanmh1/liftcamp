import { APP_STORAGE_PREFIX } from "./account-deletion";

/**
 * The setup checklist on Home: five first-week tasks, each worked out from
 * data the app already has, except the invite and the hide, which are
 * timestamps on `user_profiles`.
 *
 * Every user has all five, so the header's "N of M" never changes its M.
 * A guest with no finished workout sees the save task waiting, muted and
 * not tappable ("After your first workout"): there is nothing to save yet.
 * From the first finished workout it is the promoted save task, with the
 * count, until the account is linked. A signed-in account has it done.
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
  /** The save task for a guest with nothing finished yet: shown muted, not tappable, not done. */
  waiting: boolean;
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

/** "Save your workout" for one, then "Save your 2 workouts", "Save your 12 workouts". */
export function saveWorkoutsTitle(count: number): string {
  return count === 1 ? "Save your workout" : `Save your ${count} workouts`;
}

/** Under the count, wherever a guest is asked to save. */
export const UNSAVED_WORKOUTS_LINE = "Your workouts are only on this phone";

/** Whether a guest has anything to save yet. Home's save row and task both wait for it. */
export function shouldOfferSave(input: { isAnonymous: boolean; finishedCount: number }): boolean {
  return input.isAnonymous && input.finishedCount >= 1;
}

export function setupTasks(input: SetupInput): SetupState {
  const promoteSave = shouldOfferSave(input);
  const save: SetupTask = promoteSave
    ? {
        key: "save",
        title: saveWorkoutsTitle(input.finishedCount),
        subtitle: UNSAVED_WORKOUTS_LINE,
        done: false,
        promoted: true,
        waiting: false,
      }
    : input.isAnonymous
      ? {
          // Nothing to save before the first workout: shown, so the total
          // is five from the start, but muted and not tappable.
          key: "save",
          title: "Save your workouts",
          subtitle: "After your first workout",
          done: false,
          promoted: false,
          waiting: true,
        }
      : {
          key: "save",
          title: "Save your workouts",
          subtitle: "Add Apple or Google so they're on your next phone",
          done: true,
          promoted: false,
          waiting: false,
        };
  const task = (t: Omit<SetupTask, "promoted" | "waiting">): SetupTask => ({ ...t, promoted: false, waiting: false });
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
 * The routine day "Do your first workout" starts: in the routine trained
 * most recently, the day after the last one done (wrapping to the first);
 * with nothing done yet, the first day of the first routine. Groups and
 * their days arrive in Home's order. Null when there are no routines.
 */
export function nextRoutineDay<T extends { lastDone: string | null }>(groups: { templates: T[] }[]): T | null {
  let latest: { group: number; day: number; at: string } | null = null;
  groups.forEach((g, group) =>
    g.templates.forEach((t, day) => {
      if (t.lastDone && (!latest || t.lastDone > latest.at)) latest = { group, day, at: t.lastDone };
    }),
  );
  if (!latest) return groups.find((g) => g.templates.length > 0)?.templates[0] ?? null;
  const { group, day } = latest as { group: number; day: number };
  const days = groups[group].templates;
  return days[(day + 1) % days.length];
}
