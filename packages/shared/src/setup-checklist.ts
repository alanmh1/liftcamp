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

export function setupTasks(input: SetupInput): SetupState {
  const tasks: SetupTask[] = [
    {
      key: "save",
      title: "Save your workouts",
      subtitle: "Add Apple or Google so they're on your next phone",
      done: !input.isAnonymous,
    },
    {
      key: "log",
      title: "Log your first workout",
      subtitle: "Any routine, or start an empty one",
      done: input.finishedCount >= 1,
    },
    {
      key: "profile",
      title: "Complete your profile",
      subtitle: "Add a few details about yourself",
      done: input.sex != null && input.birthday != null && input.bodyweight != null,
    },
    {
      key: "routine",
      title: "Save a routine",
      subtitle: "Tap Use on any starter routine",
      done: input.mineCount >= 1,
    },
    {
      key: "invite",
      title: "Invite a friend",
      subtitle: "Lifting is easier with company",
      done: input.invitedFriendAt != null,
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
