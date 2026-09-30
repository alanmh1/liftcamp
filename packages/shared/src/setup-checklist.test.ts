import { describe, expect, it } from "vitest";

import {
  nextRoutineDay,
  saveWorkoutsTitle,
  setupCardMode,
  setupCompletedSeenKey,
  setupTasks,
  shouldOfferSave,
  UNSAVED_WORKOUTS_LINE,
  type SetupInput,
} from "./setup-checklist";

const fresh: SetupInput = {
  isAnonymous: true,
  finishedCount: 0,
  mineCount: 0,
  sex: null,
  birthday: null,
  bodyweight: null,
  invitedFriendAt: null,
  setupHiddenAt: null,
};

const keys = (input: SetupInput) => setupTasks(input).tasks.map((t) => t.key);
const doneKeys = (input: SetupInput) => setupTasks(input).tasks.filter((t) => t.done).map((t) => t.key);

describe("setupTasks", () => {
  it("starts a fresh guest on the first workout, with no save task yet", () => {
    const s = setupTasks(fresh);
    expect(s.tasks.map((t) => t.key)).toEqual(["log", "profile", "routine", "invite"]);
    expect(s.tasks[0].title).toBe("Do your first workout");
    expect(s.doneCount).toBe(0);
    expect(s.total).toBe(4);
    expect(s.visible).toBe(true);
  });

  it("keeps the first workout when there is a routine (Home's Next up card shows)", () => {
    expect(keys({ ...fresh, mineCount: 1 })).toEqual(["log", "profile", "routine", "invite"]);
    expect(keys({ ...fresh, finishedCount: 1, mineCount: 1 })).toEqual(["save", "log", "profile", "routine", "invite"]);
    expect(doneKeys({ ...fresh, mineCount: 1 })).not.toContain("log");
    expect(doneKeys({ ...fresh, finishedCount: 1, mineCount: 1 })).toContain("log");
  });

  it("points the first workout at the routine when there is one", () => {
    expect(setupTasks(fresh).tasks[0].subtitle).toBe("Pick a routine to start with");
    expect(setupTasks({ ...fresh, mineCount: 2 }).tasks[0].subtitle).toBe("Start the next day of your routine");
  });

  it("adds the save task, first and promoted, once a guest has finished a workout", () => {
    const one = setupTasks({ ...fresh, finishedCount: 1 });
    expect(one.tasks.map((t) => t.key)).toEqual(["save", "log", "profile", "routine", "invite"]);
    expect(one.tasks[0]).toMatchObject({
      title: "Save your workout",
      subtitle: "Your workouts are only on this phone",
      done: false,
      promoted: true,
    });
    expect(one.total).toBe(5);
    expect(one.doneCount).toBe(1);
    expect(setupTasks({ ...fresh, finishedCount: 3 }).tasks[0].title).toBe("Save your 3 workouts");
  });

  it("counts save done for an account that is not a guest, whatever it has logged", () => {
    expect(keys({ ...fresh, isAnonymous: false })[0]).toBe("save");
    expect(doneKeys({ ...fresh, isAnonymous: false })).toEqual(["save"]);
    const s = setupTasks({ ...fresh, isAnonymous: false, finishedCount: 4 });
    expect(s.tasks[0]).toMatchObject({ title: "Save your workouts", done: true, promoted: false });
  });

  it("never promotes any other task", () => {
    const guest = setupTasks({ ...fresh, finishedCount: 2 });
    expect(guest.tasks.slice(1).every((t) => !t.promoted)).toBe(true);
    expect(setupTasks(fresh).tasks.every((t) => !t.promoted)).toBe(true);
  });

  it("needs sex, birthday and bodyweight for the profile task", () => {
    expect(doneKeys({ ...fresh, sex: "male" })).toEqual([]);
    expect(doneKeys({ ...fresh, birthday: "1990-05-01" })).toEqual([]);
    expect(doneKeys({ ...fresh, bodyweight: 80 })).toEqual([]);
    expect(doneKeys({ ...fresh, sex: "female", bodyweight: 65 })).toEqual([]);
    expect(doneKeys({ ...fresh, sex: "male", birthday: "1990-05-01" })).toEqual([]);
    expect(doneKeys({ ...fresh, birthday: "1990-05-01", bodyweight: 80 })).toEqual([]);
    expect(doneKeys({ ...fresh, sex: "female", birthday: "1990-05-01", bodyweight: 65 })).toEqual(["profile"]);
  });

  it("names the profile task", () => {
    const task = setupTasks(fresh).tasks.find((t) => t.key === "profile")!;
    expect(task.title).toBe("Complete your profile");
    expect(task.subtitle).toBe("Add a few details about yourself");
  });

  it("ticks the workout, routine and invite tasks from their data", () => {
    expect(
      doneKeys({ ...fresh, isAnonymous: false, finishedCount: 1, mineCount: 2, invitedFriendAt: "2026-09-24T10:00:00Z" }),
    ).toEqual(["save", "log", "routine", "invite"]);
  });

  it("is hidden once hidden, whatever is done", () => {
    expect(setupTasks({ ...fresh, setupHiddenAt: "2026-09-24T10:00:00Z" }).visible).toBe(false);
  });

  it("is hidden once all five are done", () => {
    const s = setupTasks({
      isAnonymous: false,
      finishedCount: 3,
      mineCount: 1,
      sex: "male",
      birthday: "1990-05-01",
      bodyweight: 80,
      invitedFriendAt: "2026-09-24T10:00:00Z",
      setupHiddenAt: null,
    });
    expect(s.doneCount).toBe(5);
    expect(s.allDone).toBe(true);
    expect(s.visible).toBe(false);
  });
});

describe("shouldOfferSave and the save copy", () => {
  it("offers only to a guest with a finished workout", () => {
    expect(shouldOfferSave({ isAnonymous: true, finishedCount: 0 })).toBe(false);
    expect(shouldOfferSave({ isAnonymous: true, finishedCount: 1 })).toBe(true);
    expect(shouldOfferSave({ isAnonymous: false, finishedCount: 5 })).toBe(false);
  });

  it("counts the workouts", () => {
    expect(saveWorkoutsTitle(1)).toBe("Save your workout");
    expect(saveWorkoutsTitle(2)).toBe("Save your 2 workouts");
    expect(saveWorkoutsTitle(3)).toBe("Save your 3 workouts");
    expect(saveWorkoutsTitle(12)).toBe("Save your 12 workouts");
    expect(UNSAVED_WORKOUTS_LINE).toBe("Your workouts are only on this phone");
  });
});

describe("nextRoutineDay", () => {
  const day = (id: string, lastDone: string | null = null) => ({ id, lastDone });

  it("is null with no routines", () => {
    expect(nextRoutineDay([])).toBeNull();
    expect(nextRoutineDay([{ templates: [] }])).toBeNull();
  });

  it("starts the first day of the first routine when nothing is done", () => {
    expect(nextRoutineDay([{ templates: [day("a1"), day("a2")] }, { templates: [day("b1")] }])?.id).toBe("a1");
  });

  it("goes to the day after the last one done, in that routine", () => {
    const groups = [
      { templates: [day("a1", "2026-09-20"), day("a2")] },
      { templates: [day("b1", "2026-09-25"), day("b2"), day("b3")] },
    ];
    expect(nextRoutineDay(groups)?.id).toBe("b2");
  });

  it("wraps from the last day to the first", () => {
    const groups = [{ templates: [day("a1", "2026-09-20"), day("a2", "2026-09-22"), day("a3", "2026-09-24")] }];
    expect(nextRoutineDay(groups)?.id).toBe("a1");
  });
});

describe("setupCardMode", () => {
  const allDone = setupTasks({
    ...fresh,
    isAnonymous: false,
    finishedCount: 1,
    mineCount: 1,
    sex: "male",
    birthday: "1990-01-01",
    bodyweight: 80,
    invitedFriendAt: "2026-09-20T10:00:00Z",
  });
  const open = setupTasks(fresh);
  const ctx = { setupHiddenAt: null, completionSeen: false, doneShownThisSession: false };

  it("keeps the card open while any task is not done, even after a finish was seen", () => {
    expect(setupCardMode(open, ctx)).toBe("open");
    expect(setupCardMode(open, { ...ctx, completionSeen: true })).toBe("open");
    expect(setupCardMode(open, { ...ctx, doneShownThisSession: true })).toBe("open");
  });

  it("shows the finished card the session the last task ticks, and for the rest of it", () => {
    expect(allDone.allDone).toBe(true);
    expect(setupCardMode(allDone, ctx)).toBe("done");
    // Recorded as seen on showing; the session keeps it up.
    expect(setupCardMode(allDone, { ...ctx, completionSeen: true, doneShownThisSession: true })).toBe("done");
  });

  it("hides a finished card on the next launch, and while the flag is still being read", () => {
    expect(setupCardMode(allDone, { ...ctx, completionSeen: true })).toBe("hidden");
    expect(setupCardMode(allDone, { ...ctx, completionSeen: undefined })).toBe("hidden");
  });

  it("hides the card the user hid, finished or not", () => {
    const hidden = { ...ctx, setupHiddenAt: "2026-09-21T10:00:00Z" };
    expect(setupCardMode(open, hidden)).toBe("hidden");
    expect(setupCardMode(allDone, { ...hidden, doneShownThisSession: true })).toBe("hidden");
  });

  it("keys the seen flag per user under the app prefix", () => {
    expect(setupCompletedSeenKey("u1")).toBe("liftcamp:setup-completed-seen:u1");
  });
});
