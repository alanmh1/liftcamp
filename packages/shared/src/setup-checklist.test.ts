import { describe, expect, it } from "vitest";

import {
  nextRoutineDay,
  parseUpNextSkips,
  upNextDay,
  upNextSkipKey,
  routinesByStaleness,
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
  it("orders two days done on the same date by when they finished", () => {
    const at = (id: string, lastDoneAt: string) => ({ id, lastDone: "2026-09-30", lastDoneAt });
    const groups = [
      { templates: [at("a1", "2026-09-30T21:36:49Z"), at("a2", "2026-09-30T17:00:00Z"), day("a3")] },
    ];
    expect(nextRoutineDay(groups)?.id).toBe("a2");
  });

  describe("routines of one", () => {
    // A routine saved from a workout or built by hand: a group of one.
    const done = (id: string, lastDoneAt: string | null = null) => ({
      id,
      lastDone: lastDoneAt ? lastDoneAt.slice(0, 10) : null,
      lastDoneAt,
    });
    const one = (t: ReturnType<typeof done>) => ({ templates: [t] });

    it("offers the stalest, never the one just done", () => {
      // Newest first, the way Home lists them; F done Friday, A on Monday.
      const groups = [
        one(done("f", "2026-10-23T18:00:00Z")),
        one(done("e", "2026-10-22T18:00:00Z")),
        one(done("d", "2026-10-21T18:00:00Z")),
        one(done("a", "2026-10-19T18:00:00Z")),
        one(done("b", "2026-10-20T18:00:00Z")),
      ];
      expect(nextRoutineDay(groups)?.id).toBe("a");
    });

    it("offers a routine never done before any done one", () => {
      const groups = [
        one(done("a", "2026-10-19T18:00:00Z")),
        one(done("new")),
        one(done("b", "2026-10-23T18:00:00Z")),
        one(done("new2")),
      ];
      expect(nextRoutineDay(groups)?.id).toBe("new");
    });

    it("keeps the day after in a multi-day routine done last", () => {
      const groups = [
        one(done("s1", "2026-10-10T18:00:00Z")),
        { templates: [done("a1", "2026-10-21T18:00:00Z"), done("a2", "2026-10-23T18:00:00Z"), done("a3")] },
        one(done("s2")),
      ];
      expect(nextRoutineDay(groups)?.id).toBe("a3");
    });

    it("picks among routines of one only when one of them was done last", () => {
      const groups = [
        { templates: [done("a1", "2026-10-01T18:00:00Z"), done("a2")] },
        one(done("s1", "2026-10-23T18:00:00Z")),
        one(done("s2", "2026-10-15T18:00:00Z")),
        one(done("s3", "2026-10-20T18:00:00Z")),
      ];
      expect(nextRoutineDay(groups)?.id).toBe("s2");
    });
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

describe("routinesByStaleness", () => {
  const day = (
    id: string,
    lastDoneAt: string | null = null,
    extra: { position?: number | null; name?: string; lastDone?: string | null; program?: string | null } = {},
  ) => ({
    id,
    name: extra.name ?? id,
    program: extra.program ?? null,
    position: extra.position ?? null,
    lastDone: extra.lastDone !== undefined ? extra.lastDone : lastDoneAt ? lastDoneAt.slice(0, 10) : null,
    lastDoneAt,
  });
  const ids = (days: Parameters<typeof routinesByStaleness>[0]) => routinesByStaleness(days).map((d) => d.id);

  it("is empty with no routines", () => {
    expect(routinesByStaleness([])).toEqual([]);
  });

  it("puts the longest since done first", () => {
    const days = [
      day("fri", "2026-10-23T18:00:00Z"),
      day("mon", "2026-10-19T18:00:00Z"),
      day("wed", "2026-10-21T18:00:00Z"),
    ];
    expect(ids(days)).toEqual(["mon", "wed", "fri"]);
  });

  it("puts a day never done before every day done", () => {
    const days = [day("old", "2026-01-02T18:00:00Z"), day("new"), day("recent", "2026-10-22T18:00:00Z")];
    expect(ids(days)).toEqual(["new", "old", "recent"]);
  });

  it("orders two days done on the same date by when they finished", () => {
    const days = [day("evening", "2026-09-30T21:36:49Z"), day("morning", "2026-09-30T07:00:00Z")];
    expect(ids(days)).toEqual(["morning", "evening"]);
  });

  it("uses the date when a cached row has no finish time", () => {
    const days = [
      day("cachedLater", null, { lastDone: "2026-10-20" }),
      day("timed", "2026-10-18T18:00:00Z"),
      day("cachedEarlier", null, { lastDone: "2026-10-15" }),
    ];
    expect(ids(days)).toEqual(["cachedEarlier", "timed", "cachedLater"]);
  });

  it("keeps training order across a routine just copied, none done", () => {
    const days = [
      day("c", null, { position: 3, name: "Legs", program: "PPL" }),
      day("a", null, { position: 1, name: "Push", program: "PPL" }),
      day("b", null, { position: 2, name: "Pull", program: "PPL" }),
    ];
    expect(ids(days)).toEqual(["a", "b", "c"]);
  });

  it("within a routine, breaks a tie with no position by name, after the positioned days", () => {
    const days = [
      day("zed", null, { name: "Zed", program: "Mixed" }),
      day("alpha", null, { name: "Alpha", program: "Mixed" }),
      day("second", null, { position: 2, name: "Second", program: "Mixed" }),
    ];
    expect(ids(days)).toEqual(["second", "alpha", "zed"]);
  });

  it("does not stay inside the routine done last, as Next up does", () => {
    // Arnold Split day 1 done last, its day 2 never done: Next up offers
    // day 2. A routine of one left for three weeks is staler than day 1
    // and comes after day 2 only because day 2 was never done.
    const days = [
      day("arnold1", "2026-10-22T18:00:00Z", { position: 1 }),
      day("arnold2", null, { position: 2 }),
      day("single", "2026-10-01T18:00:00Z"),
    ];
    expect(ids(days)).toEqual(["arnold2", "single", "arnold1"]);
  });

  it("keeps a routine's days together when two are copied and none done", () => {
    // Newest first, as getUserTemplates lists them: PPL copied after UL.
    const days = [
      day("ppl-pull", null, { position: 2, name: "Pull", program: "PPL" }),
      day("ul-upper", null, { position: 1, name: "Upper", program: "Upper / Lower" }),
      day("ppl-push", null, { position: 1, name: "Push", program: "PPL" }),
      day("ul-lower", null, { position: 2, name: "Lower", program: "Upper / Lower" }),
    ];
    expect(ids(days)).toEqual(["ppl-push", "ppl-pull", "ul-upper", "ul-lower"]);
  });

  it("keeps a day of its own in its place between two routines, none done", () => {
    const days = [
      day("ppl-push", null, { position: 1, name: "Push", program: "PPL" }),
      day("solo", null, { name: "My leg day" }),
      day("ul-lower", null, { position: 2, name: "Lower", program: "Upper / Lower" }),
      day("ppl-pull", null, { position: 2, name: "Pull", program: "PPL" }),
      day("ul-upper", null, { position: 1, name: "Upper", program: "Upper / Lower" }),
    ];
    expect(ids(days)).toEqual(["ppl-push", "ppl-pull", "solo", "ul-upper", "ul-lower"]);
  });

  it("joins an older copy to its routine by name", () => {
    // Saved before copies carried `program`: "Bro Split · Chest".
    const days = [
      day("bro-back", null, { name: "Bro Split · Back" }),
      day("solo", null, { name: "Arms" }),
      day("bro-chest", null, { name: "Bro Split · Chest", program: "Bro Split" }),
    ];
    expect(ids(days)).toEqual(["bro-back", "bro-chest", "solo"]);
  });

  it("leaves the input array as it was", () => {
    const days = [day("b", "2026-10-22T18:00:00Z"), day("a", "2026-10-01T18:00:00Z")];
    routinesByStaleness(days);
    expect(days.map((d) => d.id)).toEqual(["b", "a"]);
  });
});

describe("upNextDay", () => {
  const done = (id: string, lastDoneAt: string | null = null) => ({
    id,
    lastDone: lastDoneAt ? lastDoneAt.slice(0, 10) : null,
    lastDoneAt,
  });
  const one = (t: ReturnType<typeof done>) => ({ templates: [t] });
  /** A skip a minute apart from the last, all after every finish below. */
  const at = (minute: number) => `2026-11-02T09:${String(minute).padStart(2, "0")}:00.000Z`;
  /** Skips whatever is offered, `times` times, and lists what came up. */
  const cycle = (groups: { templates: ReturnType<typeof done>[] }[], times: number) => {
    const skips: Record<string, string> = {};
    const offered: string[] = [];
    for (let i = 0; i < times; i += 1) {
      const id = upNextDay(groups, skips)!.id;
      offered.push(id);
      skips[id] = at(i);
    }
    return offered;
  };

  it("is nextRoutineDay with no skips", () => {
    const groups = [{ templates: [done("a1", "2026-10-20T18:00:00Z"), done("a2")] }, one(done("b"))];
    expect(upNextDay(groups, {})?.id).toBe(nextRoutineDay(groups)?.id);
    expect(upNextDay([], {})).toBeNull();
  });

  it("brings up the next routine when the top one is skipped", () => {
    const groups = [
      one(done("a", "2026-10-19T18:00:00Z")),
      one(done("b", "2026-10-20T18:00:00Z")),
      one(done("c", "2026-10-21T18:00:00Z")),
    ];
    expect(upNextDay(groups, {})?.id).toBe("a");
    expect(upNextDay(groups, { a: at(0) })?.id).toBe("b");
  });

  it("brings up the next day of a routine when its day is skipped", () => {
    const groups = [{ templates: [done("a1", "2026-10-19T18:00:00Z"), done("a2"), done("a3")] }];
    expect(upNextDay(groups, {})?.id).toBe("a2");
    expect(upNextDay(groups, { a2: at(0) })?.id).toBe("a3");
  });

  it("returns the caller's own day, with its real last done", () => {
    const a = done("a", "2026-10-19T18:00:00Z");
    const b = done("b", "2026-10-20T18:00:00Z");
    const groups = [one(a), one(b)];
    expect(upNextDay(groups, { b: at(1), a: at(0) })).toBe(a);
  });

  it("treats a skip then a finish as a finish", () => {
    const finished = [
      one(done("a", "2026-11-02T18:00:00Z")),
      one(done("b", "2026-10-20T18:00:00Z")),
      one(done("c", "2026-10-21T18:00:00Z")),
    ];
    expect(upNextDay(finished, { a: at(0) })?.id).toBe(upNextDay(finished, {})?.id);

    const days = [{ templates: [done("a1", "2026-11-02T18:00:00Z"), done("a2"), done("a3")] }];
    expect(upNextDay(days, { a1: at(0) })?.id).toBe("a2");
  });

  it("compares a finish with a skip by time, whatever the format", () => {
    // Postgres writes +00:00, the phone writes Z.
    const groups = [one(done("a", "2026-11-02T09:00:30.000000+00:00")), one(done("b", "2026-10-20T18:00:00Z"))];
    expect(upNextDay(groups, { b: at(1) })?.id).toBe("a");
  });

  it("cycles through every routine of one", () => {
    const groups = [
      one(done("a", "2026-10-19T18:00:00Z")),
      one(done("b", "2026-10-20T18:00:00Z")),
      one(done("c")),
    ];
    expect(cycle(groups, 6)).toEqual(["c", "a", "b", "c", "a", "b"]);
  });

  it("cycles through every day of one routine", () => {
    const groups = [{ templates: [done("a1"), done("a2"), done("a3")] }];
    expect(cycle(groups, 6)).toEqual(["a1", "a2", "a3", "a1", "a2", "a3"]);
  });

  it("leaves the routine done last once its days are skipped, and reaches every day", () => {
    const groups = [
      { templates: [done("a1", "2026-10-21T18:00:00Z"), done("a2")] },
      { templates: [done("b1", "2026-10-19T18:00:00Z"), done("b2")] },
      one(done("c", "2026-10-20T18:00:00Z")),
    ];
    const offered = cycle(groups, 10);
    expect(new Set(offered.slice(0, 5))).toEqual(new Set(["a1", "a2", "b1", "b2", "c"]));
    expect(offered.slice(5)).toEqual(offered.slice(0, 5));
  });

  it("starts again from a finish", () => {
    const groups = [one(done("a", "2026-11-02T18:00:00Z")), one(done("b", "2026-10-20T18:00:00Z")), one(done("c"))];
    // b and c were skipped before a was finished, and c most recently.
    expect(upNextDay(groups, { b: at(0), c: at(1) })?.id).toBe("b");
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
