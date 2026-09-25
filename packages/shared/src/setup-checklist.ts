/**
 * The setup checklist on Home: five first-week tasks, each worked out from
 * data the app already has, except the invite and the hide, which are
 * timestamps on `user_profiles`.
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
  /** Always all five, in order, so a finished task keeps its place. */
  tasks: SetupTask[];
  doneCount: number;
  total: number;
  allDone: boolean;
  /** False once the user hid the card or finished every task. */
  visible: boolean;
};

/** "1 workout only reachable from this phone", "3 workouts ...". */
export function unsavedWorkoutsLine(count: number): string {
  return `${count} ${count === 1 ? "workout" : "workouts"} only reachable from this phone`;
}

export function setupTasks(input: SetupInput): SetupState {
  const promoteSave = input.isAnonymous && input.finishedCount >= 1;
  const tasks: SetupTask[] = [
    {
      key: "save",
      title: "Save your workouts",
      subtitle: promoteSave
        ? unsavedWorkoutsLine(input.finishedCount)
        : "Add Apple or Google so they're on your next phone",
      done: !input.isAnonymous,
      promoted: promoteSave,
    },
    {
      key: "log",
      title: "Log your first workout",
      subtitle: "Any routine, or start an empty one",
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
