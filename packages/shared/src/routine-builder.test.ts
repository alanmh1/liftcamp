import { describe, expect, it } from "vitest";

import {
  builderChanged,
  builderEntriesFrom,
  canSaveRoutine,
  isTakenRoutineName,
  newBuilderEntry,
  rotationAfter,
  rotationList,
  routineEntriesFrom,
  stepSets,
} from "./routine-builder";

const r = (id: string) => ({ id });

describe("stepSets", () => {
  it("holds the stepper to 1 to 10", () => {
    expect(stepSets(3, 1)).toBe(4);
    expect(stepSets(1, -1)).toBe(1);
    expect(stepSets(10, 1)).toBe(10);
  });
});

describe("routineEntriesFrom", () => {
  it("trims reps and stores blank as null", () => {
    expect(
      routineEntriesFrom([
        { exerciseId: "a", sets: 4, reps: " 10 " },
        { exerciseId: "b", sets: 3, reps: "   " },
        { exerciseId: "c", sets: 3, reps: "8 each" },
      ]),
    ).toEqual([
      { exerciseId: "a", targetSets: 4, targetReps: "10" },
      { exerciseId: "b", targetSets: 3, targetReps: null },
      { exerciseId: "c", targetSets: 3, targetReps: "8 each" },
    ]);
  });
});

describe("builderEntriesFrom", () => {
  it("orders by position and fills a missing set target with 3", () => {
    expect(
      builderEntriesFrom([
        { exercise_id: "b", position: 1, target_sets: null, target_reps: "30s" },
        { exercise_id: "a", position: 0, target_sets: 5, target_reps: null },
        { exercise_id: "c", position: 2, target_sets: 12, target_reps: "8-12" },
      ]),
    ).toEqual([
      { exerciseId: "a", sets: 5, reps: "" },
      { exerciseId: "b", sets: 3, reps: "30s" },
      { exerciseId: "c", sets: 10, reps: "8-12" },
    ]);
  });
});

describe("canSaveRoutine", () => {
  it("needs a name and an exercise", () => {
    expect(canSaveRoutine("  ", [newBuilderEntry("a")])).toBe(false);
    expect(canSaveRoutine("Hotel legs", [])).toBe(false);
    expect(canSaveRoutine("Hotel legs", [newBuilderEntry("a")])).toBe(true);
  });
});

describe("builderChanged", () => {
  const initial = { name: "Legs", entries: [{ exerciseId: "a", sets: 3, reps: "10" }] };
  it("ignores whitespace-only differences", () => {
    expect(builderChanged(initial, { name: " Legs ", entries: [{ exerciseId: "a", sets: 3, reps: "10 " }] })).toBe(
      false,
    );
  });
  it("sees a name, target, order or exercise change", () => {
    expect(builderChanged(initial, { ...initial, name: "Leg day" })).toBe(true);
    expect(builderChanged(initial, { ...initial, entries: [{ exerciseId: "a", sets: 4, reps: "10" }] })).toBe(true);
    expect(builderChanged(initial, { ...initial, entries: [...initial.entries, newBuilderEntry("b")] })).toBe(true);
    const two = { name: "X", entries: [newBuilderEntry("a"), newBuilderEntry("b")] };
    expect(builderChanged(two, { name: "X", entries: [two.entries[1], two.entries[0]] })).toBe(true);
  });
  it("counts a new routine as changed once anything is added", () => {
    const blank = { name: "", entries: [] };
    expect(builderChanged(blank, blank)).toBe(false);
    expect(builderChanged(blank, { name: "", entries: [newBuilderEntry("a")] })).toBe(true);
  });
});

describe("isTakenRoutineName", () => {
  it("matches trimmed, any case, and never a blank name", () => {
    expect(isTakenRoutineName(" push day ", ["Push Day"])).toBe(true);
    expect(isTakenRoutineName("Pull", ["Push Day"])).toBe(false);
    expect(isTakenRoutineName("  ", ["", "Push"])).toBe(false);
  });
});

describe("rotationAfter", () => {
  const rotation = ["a", "b", "c", "d", "e"].map(r);
  it("starts after Up next and wraps, without Up next", () => {
    expect(rotationAfter(rotation, "c").map((t) => t.id)).toEqual(["d", "e", "a", "b"]);
    expect(rotationAfter(rotation, "e").map((t) => t.id)).toEqual(["a", "b", "c", "d"]);
    expect(rotationAfter(rotation, "a").map((t) => t.id)).toEqual(["b", "c", "d", "e"]);
  });
  it("is the rotation as it is with no Up next", () => {
    expect(rotationAfter(rotation, null)).toEqual(rotation);
    expect(rotationAfter(rotation, "zz")).toEqual(rotation);
  });
  it("is empty when Up next is the only routine", () => {
    expect(rotationAfter([r("a")], "a")).toEqual([]);
  });
});

describe("rotationList", () => {
  const after = ["a", "b", "c", "d", "e"].map(r);
  const others = ["x", "y"].map(r);

  it("shows three collapsed, with Show all counting every routine", () => {
    const list = rotationList(after, others, false);
    expect(list.rotation.map((t) => t.id)).toEqual(["a", "b", "c"]);
    expect(list.others).toEqual([]);
    expect(list.total).toBe(7);
    expect(list.toggle).toBe(true);
  });

  it("shows the rest of the rotation, then the others, expanded", () => {
    const list = rotationList(after, others, true);
    expect(list.rotation).toEqual(after);
    expect(list.others).toEqual(others);
  });

  it("has no toggle when three or fewer and nothing out of the rotation", () => {
    const list = rotationList(after.slice(0, 3), [], false);
    expect(list.toggle).toBe(false);
    expect(rotationList(after.slice(0, 3), [], true).others).toEqual([]);
  });

  it("with only Up next in the rotation, holds the others behind Show all", () => {
    const list = rotationList([], others, false);
    expect(list.rotation).toEqual([]);
    expect(list.toggle).toBe(true);
    expect(list.total).toBe(2);
    expect(rotationList([], others, true).others).toEqual(others);
  });

  it("is empty with nothing after Up next and nothing out of it", () => {
    const list = rotationList([], [], false);
    expect(list.rotation).toEqual([]);
    expect(list.toggle).toBe(false);
  });
});
