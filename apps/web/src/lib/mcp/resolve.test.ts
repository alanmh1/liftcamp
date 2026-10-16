import { describe, expect, it } from "vitest";
import { STRENGTH_EXERCISES, STRENGTH_STANDARDS } from "@liftcamp/shared";
import { AMBIGUOUS_LIMIT, resolveExercise, resolveLift } from "./resolve";
import { ex } from "./fixtures.test-helpers";

const name = (input: string) => {
  const id = resolveLift(input);
  return id ? STRENGTH_STANDARDS[id]!.name : null;
};

describe("resolveLift", () => {
  it.each([
    ["squat", "Barbell Squat"],
    ["Back squat", "Barbell Squat"],
    ["squats", "Barbell Squat"],
    ["bench", "Barbell Bench Press"],
    ["Bench press", "Barbell Bench Press"],
    ["barbell bench press", "Barbell Bench Press"],
    ["deadlift", "Barbell Deadlift"],
    ["deadlifts", "Barbell Deadlift"],
    ["OHP", "Standing Military Press"],
    ["overhead press", "Standing Military Press"],
    ["military press", "Standing Military Press"],
    ["row", "Bent Over Barbell Row"],
    ["Bent-over row", "Bent Over Barbell Row"],
    ["RDL", "Romanian Deadlift"],
    ["romanian deadlift", "Romanian Deadlift"],
    ["lat pulldown", "Wide-Grip Lat Pulldown"],
    ["Wide-Grip Lat Pulldown", "Wide-Grip Lat Pulldown"],
    ["deadlfit", "Barbell Deadlift"],
    ["romanain deadlift", "Romanian Deadlift"],
  ])("%s is %s", (input, expected) => {
    expect(name(input)).toBe(expected);
  });

  it("resolves every standard name as written", () => {
    for (const id of STRENGTH_EXERCISES) {
      expect(resolveLift(STRENGTH_STANDARDS[id]!.name)).toBe(id);
    }
  });

  it.each([
    "dumbbell bench press",
    "DB shoulder press",
    "front squat",
    "goblet squat",
    "incline bench",
    "leg press",
    "curl",
    "pull-up",
  ])("%s has no level", (input) => {
    expect(resolveLift(input)).toBeNull();
  });
});

describe("resolveExercise", () => {
  const index = [
    ex("Barbell Bench Press", { has_notes: true }),
    ex("Dumbbell Bench Press"),
    ex("Close-Grip Barbell Bench Press"),
    ex("Decline Barbell Bench Press"),
    ex("Incline Dumbbell Bench Press"),
    ex("Smith Machine Bench Press"),
    ex("Romanian Deadlift", {
      alias_text: "deadlift|rdl|romaniandeadlift",
      primary_muscle: "hamstrings",
    }),
    ex("Dumbbell Romanian Deadlift", {
      alias_text: "dbrdl|rdl|romaniandeadlift",
      primary_muscle: "hamstrings",
    }),
    ex("Pullups", { alias_text: "pullup|chinup" }),
    ex("Smith Machine Hip Thrust"),
  ];

  it("matches an exact slug, and a name written as a slug", () => {
    expect(resolveExercise(index, "romanian-deadlift")).toMatchObject({
      kind: "match",
      exercise: { name: "Romanian Deadlift" },
    });
    expect(resolveExercise(index, "Romanian deadlift")).toMatchObject({
      kind: "match",
      exercise: { name: "Romanian Deadlift" },
    });
  });

  it("matches an exact name ignoring case before any partial match", () => {
    expect(resolveExercise(index, "BARBELL BENCH PRESS")).toMatchObject({
      kind: "match",
      exercise: { name: "Barbell Bench Press" },
    });
  });

  it("lists up to five candidates when a partial name is ambiguous, authored first", () => {
    const res = resolveExercise(index, "bench press");
    expect(res.kind).toBe("ambiguous");
    if (res.kind !== "ambiguous") return;
    expect(res.candidates).toHaveLength(AMBIGUOUS_LIMIT);
    expect(res.candidates[0]!.name).toBe("Barbell Bench Press");
  });

  it("is ambiguous on an alias several rows share", () => {
    const res = resolveExercise(index, "rdl");
    expect(res.kind).toBe("ambiguous");
    if (res.kind !== "ambiguous") return;
    expect(res.candidates.map((e) => e.name).sort()).toEqual([
      "Dumbbell Romanian Deadlift",
      "Romanian Deadlift",
    ]);
  });

  it("matches a unique alias", () => {
    expect(resolveExercise(index, "chin-up")).toMatchObject({
      kind: "match",
      exercise: { name: "Pullups" },
    });
  });

  it("matches every word in search_all when no name or alias does", () => {
    expect(resolveExercise(index, "smith thrust")).toMatchObject({
      kind: "match",
      exercise: { name: "Smith Machine Hip Thrust" },
    });
  });

  it("says none when nothing matches", () => {
    expect(resolveExercise(index, "zercher carry")).toEqual({ kind: "none" });
  });
});
