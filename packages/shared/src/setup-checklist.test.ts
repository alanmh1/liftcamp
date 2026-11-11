import { describe, expect, it } from "vitest";

import {
  nextInRotation,
  otherRoutines,
  parseUpNextSkips,
  rotationRoutines,
  upNextSkipKey,
  setupCardMode,
  setupCompletedSeenKey,
  setupTasks,
  shouldOfferSave,
  CREATE_ACCOUNT_TITLE,
  NEXT_WORKOUT_LINE,
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
  it("gives a fresh guest all five, the account task first", () => {
    const s = setupTasks(fresh);
    expect(s.tasks.map((t) => t.key)).toEqual(["save", "log", "profile", "routine", "invite"]);
    expect(s.tasks[0]).toMatchObject({
      title: "Create a free account",
      subtitle: "Keep training after your first workout",
      done: false,
      promoted: false,
    });
    expect(s.tasks[1].title).toBe("Do your first workout");
    expect(s.doneCount).toBe(0);
    expect(s.total).toBe(5);
  });

  it("keeps the total at five in every state, so only the done count moves", () => {
    const states: SetupInput[] = [
      fresh,
      { ...fresh, finishedCount: 1 },
      { ...fresh, finishedCount: 4, mineCount: 2 },
      { ...fresh, isAnonymous: false },
      { ...fresh, isAnonymous: false, finishedCount: 9, invitedFriendAt: "2026-09-24T10:00:00Z" },
    ];
    for (const input of states) expect(setupTasks(input).total).toBe(5);
  });

  it("keeps the first workout when there is a routine (Home's Next up card shows)", () => {
    expect(keys({ ...fresh, mineCount: 1 })).toEqual(["save", "log", "profile", "routine", "invite"]);
    expect(keys({ ...fresh, finishedCount: 1, mineCount: 1 })).toEqual(["save", "log", "profile", "routine", "invite"]);
    expect(doneKeys({ ...fresh, mineCount: 1 })).not.toContain("log");
    expect(doneKeys({ ...fresh, finishedCount: 1, mineCount: 1 })).toContain("log");
  });

  it("points the first workout at the routine when there is one", () => {
    const log = (input: SetupInput) => setupTasks(input).tasks.find((t) => t.key === "log")!;
    expect(log(fresh).subtitle).toBe("Pick a routine to start with");
    expect(log({ ...fresh, mineCount: 2 }).subtitle).toBe("Start the next day of your routine");
  });

  it("promotes the save task once a guest has finished a workout", () => {
    const one = setupTasks({ ...fresh, finishedCount: 1 });
    expect(one.tasks.map((t) => t.key)).toEqual(["save", "log", "profile", "routine", "invite"]);
    expect(one.tasks[0]).toMatchObject({
      title: "Create a free account",
      subtitle: "Needed to log your next workout",
      done: false,
      promoted: true,
    });
    expect(one.total).toBe(5);
    expect(one.doneCount).toBe(1);
    expect(setupTasks({ ...fresh, finishedCount: 3 }).tasks[0].title).toBe("Create a free account");
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

  it("offers Hide only when the invite is the only task left", () => {
    const allButInvite: SetupInput = {
      ...fresh,
      isAnonymous: false,
      finishedCount: 2,
      mineCount: 1,
      sex: "male",
      birthday: "1990-05-01",
      bodyweight: 80,
    };
    expect(setupTasks(allButInvite).canHide).toBe(true);
    expect(setupTasks({ ...allButInvite, mineCount: 0 }).canHide).toBe(false);
    expect(setupTasks({ ...allButInvite, invitedFriendAt: "2026-09-24T10:00:00Z" }).canHide).toBe(false);
    expect(setupTasks(fresh).canHide).toBe(false);
    // A guest has the save task left too.
    expect(setupTasks({ ...allButInvite, isAnonymous: true }).canHide).toBe(false);
  });

  it("is all done once all five are done", () => {
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
    expect(s.canHide).toBe(false);
  });
});

describe("shouldOfferSave and the save copy", () => {
  it("offers only to a guest with a finished workout", () => {
    expect(shouldOfferSave({ isAnonymous: true, finishedCount: 0 })).toBe(false);
    expect(shouldOfferSave({ isAnonymous: true, finishedCount: 1 })).toBe(true);
    expect(shouldOfferSave({ isAnonymous: false, finishedCount: 5 })).toBe(false);
  });

  it("asks for a free account, for the next workout", () => {
    expect(CREATE_ACCOUNT_TITLE).toBe("Create a free account");
    expect(NEXT_WORKOUT_LINE).toBe("Needed to log your next workout");
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

  it("honours a hide only while the invite is the only task left", () => {
    const hidden = { ...ctx, setupHiddenAt: "2026-09-21T10:00:00Z" };
    const onlyInvite = setupTasks({
      ...fresh,
      isAnonymous: false,
      finishedCount: 1,
      mineCount: 1,
      sex: "male",
      birthday: "1990-01-01",
      bodyweight: 80,
    });
    expect(setupCardMode(onlyInvite, hidden)).toBe("hidden");
    expect(setupCardMode(onlyInvite, ctx)).toBe("open");
    // The last routine removed: two tasks left, and the card is back.
    const routineGone = setupTasks({ ...fresh, isAnonymous: false, finishedCount: 1, sex: "male", birthday: "1990-01-01", bodyweight: 80 });
    expect(setupCardMode(routineGone, hidden)).toBe("open");
    expect(setupCardMode(open, hidden)).toBe("open");
    expect(setupCardMode(allDone, { ...hidden, doneShownThisSession: true })).toBe("hidden");
  });

  it("keys the seen flag per user under the app prefix", () => {
    expect(setupCompletedSeenKey("u1")).toBe("liftcamp:setup-completed-seen:u1");
  });
});

describe("up next skips in storage", () => {
  it("keys on the user under the app prefix", () => {
    expect(upNextSkipKey("u1")).toBe("liftcamp:upnext-skip:u1");
  });

  it("reads a stored map", () => {
    expect(parseUpNextSkips('{"a":"2026-11-02T09:00:00.000Z"}')).toEqual({ a: "2026-11-02T09:00:00.000Z" });
  });

  it("counts anything else as no skips", () => {
    expect(parseUpNextSkips(null)).toEqual({});
    expect(parseUpNextSkips("not json")).toEqual({});
    expect(parseUpNextSkips("[1]")).toEqual({});
    expect(parseUpNextSkips('{"a":3}')).toEqual({});
  });
});

describe("the rotation", () => {
  // Tester Justin's five routines of one day, in his order, with his real
  // last finishes (UTC). The order differs from when he saved them.
  const routine = (
    id: string,
    position: number,
    lastDoneAt: string | null,
    extra: { in_rotation?: boolean; created_at?: string } = {},
  ) => ({
    id,
    rotation_position: position,
    in_rotation: true,
    created_at: "2026-10-23T06:17:38Z",
    lastDone: lastDoneAt ? lastDoneAt.slice(0, 10) : null,
    lastDoneAt,
    ...extra,
  });
  const justin = () => [
    routine("F", 4, "2026-11-06T10:27:19Z"),
    routine("Th", 3, "2026-10-29T10:40:52Z"),
    routine("W", 2, "2026-11-04T10:33:42Z"),
    routine("T", 1, "2026-11-10T10:24:35Z"),
    routine("M", 0, "2026-11-09T10:48:13Z"),
  ];
  const next = (days: ReturnType<typeof routine>[], skips: Record<string, string> = {}) =>
    nextInRotation(rotationRoutines(days), skips)?.id ?? null;
  const finish = (days: ReturnType<typeof routine>[], id: string, at: string) =>
    days.map((d) => (d.id === id ? { ...d, lastDone: at.slice(0, 10), lastDoneAt: at } : d));
  const skipW = { W: "2026-11-11T08:00:00Z" };

  it("puts the rotation in the user's order", () => {
    expect(rotationRoutines(justin()).map((d) => d.id)).toEqual(["M", "T", "W", "Th", "F"]);
  });

  it("a. with no skips, offers the routine after the one done last", () => {
    expect(next(justin())).toBe("W");
  });

  it("b. a skip moves Up next one step on", () => {
    expect(next(justin(), skipW)).toBe("Th");
  });

  it("c. finishing the next routine after a skip moves on from it", () => {
    expect(next(finish(justin(), "Th", "2026-11-12T10:30:00Z"), skipW)).toBe("F");
  });

  it("d. wraps from the last routine to the first", () => {
    const days = finish(finish(justin(), "Th", "2026-11-12T10:30:00Z"), "F", "2026-11-13T10:30:00Z");
    expect(next(days, skipW)).toBe("M");
  });

  it("e. a workout from a routine out of the rotation leaves Up next where it was", () => {
    const days = [
      ...justin(),
      routine("Bands", 5, "2026-11-11T10:19:27Z", { in_rotation: false }),
    ];
    expect(next(days)).toBe("W");
  });

  it("f. ignores a skip older than that routine's latest finish", () => {
    // Taken at face value the skip would rank T as done on 1 Nov, and M
    // (9 Nov) would be done last.
    expect(next(justin(), { T: "2026-11-01T09:00:00Z" })).toBe("W");
  });

  it("g. is null with an empty rotation", () => {
    expect(nextInRotation([], {})).toBeNull();
    expect(next([routine("Bands", 0, null, { in_rotation: false })])).toBeNull();
  });

  it("starts at the first routine when nothing is done", () => {
    expect(next(justin().map((d) => ({ ...d, lastDone: null, lastDoneAt: null })))).toBe("M");
  });

  it("offers the only routine again in a rotation of one", () => {
    expect(next([routine("M", 0, "2026-11-09T10:48:13Z")])).toBe("M");
  });

  it("breaks a position tie by when the routine was saved", () => {
    const days = [
      routine("B", 0, null, { created_at: "2026-11-02T00:00:00Z" }),
      routine("A", 0, null, { created_at: "2026-11-01T00:00:00Z" }),
    ];
    expect(rotationRoutines(days).map((d) => d.id)).toEqual(["A", "B"]);
  });

  it("counts a row with no in_rotation (an old cache) as in", () => {
    const { in_rotation: _drop, ...old } = routine("M", 0, null);
    expect(rotationRoutines([old]).map((d) => d.id)).toEqual(["M"]);
  });

  it("lists routines out of the rotation most recently done first, never done last", () => {
    const days = [
      routine("Old", 9, "2026-10-01T09:00:00Z", { in_rotation: false }),
      routine("Never", 9, null, { in_rotation: false }),
      routine("Recent", 9, "2026-11-10T09:00:00Z", { in_rotation: false }),
      routine("M", 0, "2026-11-11T09:00:00Z"),
    ];
    expect(otherRoutines(days).map((d) => d.id)).toEqual(["Recent", "Old", "Never"]);
  });
});
