/**
 * The setup checklist on Home: first-week tasks, each worked out from data
 * the app already has, except the invite and the hide, which are
 * timestamps on `user_profiles`.
 *
 * A guest with no finished workout is not asked to save anything yet:
 * there is nothing to save. Their first task is the first workout. From
 * the first finished workout the save task appears at the top, with the
 * count, and stays until the account is linked.
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
  setupHiddenAt: string | null;
};

export type SetupState = {
  /**
   * In a fixed order, so a finished task keeps its place. Five, or four
   * for a guest with no finished workout, who has no save task yet.
   */
  tasks: SetupTask[];
  doneCount: number;
  total: number;
  allDone: boolean;
  /** False once the user hid the card or finished every task. */
  visible: boolean;
};

/** "Save your 1 workout", "Save your 3 workouts". */
export function saveWorkoutsTitle(count: number): string {
  return `Save your ${count} ${count === 1 ? "workout" : "workouts"}`;
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
      }
    : {
        key: "save",
        title: "Save your workouts",
        subtitle: "Add Apple or Google so they're on your next phone",
        done: !input.isAnonymous,
        promoted: false,
      };
  const tasks: SetupTask[] = [
    // A guest with nothing finished has nothing to save yet.
    ...(input.isAnonymous && !promoteSave ? [] : [save]),
    {
      key: "log",
      title: "Do your first workout",
      subtitle: input.mineCount >= 1 ? "Start the next day of your routine" : "Pick a routine to start with",
      done: input.finishedCount >= 1,
      promoted: false,
    },
    {
      key: "profile",
      title: "Complete your profile",
      subtitle: "Add a few details about yourself",
      done: input.sex != null && input.birthday != null && input.bodyweight != null,
      promoted: false,
    },
    {
      key: "routine",
      title: "Save a routine",
      subtitle: "Tap Use on any starter routine",
      done: input.mineCount >= 1,
      promoted: false,
    },
    {
      key: "invite",
      title: "Invite a friend",
      subtitle: "Lifting is easier with company",
      done: input.invitedFriendAt != null,
      promoted: false,
    },
  ];
  const doneCount = tasks.filter((t) => t.done).length;
  const allDone = doneCount === tasks.length;
  return {
    tasks,
    doneCount,
    total: tasks.length,
    allDone,
    visible: input.setupHiddenAt == null && !allDone,
  };
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
