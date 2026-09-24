import { describe, expect, it } from "vitest";

import { setupTasks, type SetupInput } from "./setup-checklist";

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

const doneKeys = (input: SetupInput) => setupTasks(input).tasks.filter((t) => t.done).map((t) => t.key);

describe("setupTasks", () => {
  it("has nothing done for a fresh anonymous user, and shows the card", () => {
    const s = setupTasks(fresh);
    expect(s.tasks.map((t) => t.key)).toEqual(["save", "log", "profile", "routine", "invite"]);
    expect(s.doneCount).toBe(0);
    expect(s.total).toBe(5);
    expect(s.visible).toBe(true);
  });

  it("counts task 1 done for a user who is not anonymous", () => {
    expect(doneKeys({ ...fresh, isAnonymous: false })).toEqual(["save"]);
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
    const task = setupTasks(fresh).tasks[2];
    expect(task.title).toBe("Complete your profile");
    expect(task.subtitle).toBe("Add a few details about yourself");
  });

  it("ticks the workout, routine and invite tasks from their data", () => {
    expect(doneKeys({ ...fresh, finishedCount: 1, mineCount: 2, invitedFriendAt: "2026-09-24T10:00:00Z" })).toEqual([
      "log",
      "routine",
      "invite",
    ]);
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
