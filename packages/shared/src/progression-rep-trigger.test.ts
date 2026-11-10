import { describe, expect, it } from "vitest";

import {
  progressionChip,
  progressionSheet,
  sessionResult,
  suggestProgression,
  type HistorySet,
  type HistorySession,
  type Progression,
  type ProgressionExercise,
  type ProgressionInput,
} from "./progression";

const exercise = (over: Partial<ProgressionExercise> = {}): ProgressionExercise => ({
  id: "ex",
  equipment: "barbell",
  weight_type: "standard",
  mechanic: "compound",
  primary_muscle: "chest",
  is_unilateral: false,
  ...over,
});

const bench = exercise();
const squat = exercise({ primary_muscle: "quads" });
const dumbbellPress = exercise({ equipment: "dumbbell" });

/** `[weight, reps]` pairs in lb. */
const sets = (pairs: [number | null, number][]): HistorySet[] =>
  pairs.map(([weight_value, reps]) => ({ weight_value, reps, weight_unit: "lb" }));

let n = 0;
const session = (date: string, s: HistorySet[]): HistorySession => ({ workoutId: `w${(n += 1)}`, date, sets: s });

const input = (over: Partial<ProgressionInput>): ProgressionInput => ({
  exercise: bench,
  history: [],
  unit: "lb",
  target: { sets: 2, reps: "7" },
  setCount: 2,
  today: "2026-11-10",
  ...over,
});

const working = (p: Progression) => p.sets.filter((s) => s.role === "working");
const weights = (p: Progression) => working(p).map((s) => s.weight?.value ?? null);
const reps = (p: Progression) => working(p).map((s) => s.reps);
const brief = (p: Progression) => ({
  outcome: p.outcome,
  why: p.detail?.why,
  reason: p.reason,
  sets: p.sets.map((s) => `${s.role} ${s.weight?.value ?? "-"} x ${s.reps}`),
});

describe("sessionResult with a rep trigger", () => {
  it("reads only the first working set", () => {
    expect(sessionResult([{ reps: 14 }, { reps: 9 }], { low: 7, high: 7 }, 3, 13)).toBe("top");
    expect(sessionResult([{ reps: 13 }], { low: 7, high: 7 }, 0, 13)).toBe("top");
    expect(sessionResult([{ reps: 12 }, { reps: 20 }], { low: 7, high: 7 }, 0, 13)).toBe("in-range");
  });

  it("is unchanged without one", () => {
    expect(sessionResult([{ reps: 9 }, { reps: 9 }], { low: 7, high: 7 })).toBe("top");
    expect(sessionResult([{ reps: 9 }, { reps: 9 }], { low: 7, high: 7 }, 0, null)).toBe("top");
  });
});

describe("rep trigger", () => {
  const twoSets = (a: number, b: number) => [session("2026-11-05", sets([[100, a], [100, b]]))];

  it("bumps when set 1 is above the trigger, whatever set 2 did", () => {
    const p = suggestProgression(input({ history: twoSets(14, 9), repTrigger: 13 }));
    expect(p.outcome).toBe("increase");
    expect(weights(p)).toEqual([105, 105]);
  });

  it("bumps at exactly the trigger", () => {
    const p = suggestProgression(input({ history: twoSets(13, 13), repTrigger: 13 }));
    expect(p.outcome).toBe("increase");
    expect(weights(p)).toEqual([105, 105]);
  });

  it("holds below the trigger, even with every set over the routine's 7", () => {
    const p = suggestProgression(input({ history: twoSets(12, 12), repTrigger: 13 }));
    expect(p.outcome).toBe("hold");
    expect(p.detail?.why).toBe("below-trigger");
    expect(weights(p)).toEqual([100, 100]);
  });

  it("never lowers the weight from low reps", () => {
    const p = suggestProgression(input({ history: twoSets(3, 2), repTrigger: 13 }));
    expect(weights(p)).toEqual([100, 100]);
  });

  it("ignores warm-ups, typed and untyped", () => {
    const history = [
      session("2026-11-05", [
        { weight_value: 45, reps: 15, weight_unit: "lb", set_type: "warmup" },
        { weight_value: 60, reps: 15, weight_unit: "lb" },
        ...sets([[100, 10], [100, 14]]),
      ]),
    ];
    const p = suggestProgression(input({ history, repTrigger: 13, warmups: false }));
    expect(p.outcome).toBe("hold");
    expect(p.detail?.firstSetReps).toBe(10);
  });

  it("ignores a fixed 5 target and a range", () => {
    const history = [session("2026-11-05", sets([[200, 13], [200, 13], [200, 13], [200, 13], [200, 13]]))];
    const five = suggestProgression(input({ exercise: squat, history, target: { sets: 5, reps: "5" }, setCount: 5, repTrigger: 13 }));
    expect(weights(five)).toEqual([210, 210, 210, 210, 210]);
    const low = [session("2026-11-05", sets([[200, 6], [200, 6], [200, 6], [200, 6], [200, 6]]))];
    const held = suggestProgression(input({ exercise: squat, history: low, target: { sets: 5, reps: "5" }, setCount: 5, repTrigger: 13 }));
    expect(held.outcome).toBe("hold");
    const range = suggestProgression(input({ history: twoSets(13, 8), target: { sets: 2, reps: "8-10" }, repTrigger: 13 }));
    expect(range.outcome).toBe("increase");
  });

  it("uses a custom trigger", () => {
    expect(suggestProgression(input({ history: twoSets(10, 6), repTrigger: 10 })).outcome).toBe("increase");
    expect(suggestProgression(input({ history: twoSets(9, 6), repTrigger: 10 })).outcome).toBe("hold");
  });

  it("aims each set at last session's reps, at the new weight or the same one", () => {
    expect(reps(suggestProgression(input({ history: twoSets(14, 9), repTrigger: 13 })))).toEqual([14, 9]);
    expect(reps(suggestProgression(input({ history: twoSets(11, 8), repTrigger: 13 })))).toEqual([11, 8]);
  });

  it("moves a dumbbell up the ladder", () => {
    const history = [session("2026-11-05", sets([[25, 13], [25, 10]]))];
    const p = suggestProgression(input({ exercise: dumbbellPress, history, repTrigger: 13 }));
    expect(weights(p)).toEqual([30, 30]);
  });

  it("bumps after a short session", () => {
    const history = [{ ...session("2026-11-05", sets([[100, 14]])), plannedSets: 3 }];
    const p = suggestProgression(input({ history, target: { sets: 3, reps: "7" }, setCount: 3, repTrigger: 13 }));
    expect(p.outcome).toBe("increase");
  });

  it("never deloads from low reps", () => {
    const miss = (d: string) => session(d, sets([[100, 10], [100, 4]]));
    const history = [miss("2026-11-05"), miss("2026-11-01"), miss("2026-10-28"), miss("2026-10-24")];
    const p = suggestProgression(input({ history, repTrigger: 13 }));
    expect(p.outcome).toBe("hold");
    expect(p.missStreak).toBe(0);
    expect(weights(p)).toEqual([100, 100]);
    // The same history without the trigger deloads, as before.
    expect(suggestProgression(input({ history })).outcome).toBe("deload");
  });

  it("still bumps when set 1 hits the trigger after three short sessions", () => {
    const miss = (d: string) => session(d, sets([[100, 14], [100, 4]]));
    const history = [miss("2026-11-05"), miss("2026-11-01"), miss("2026-10-28")];
    expect(suggestProgression(input({ history, repTrigger: 13 })).outcome).toBe("increase");
  });

  it("keeps the layoff hold after four weeks off", () => {
    const history = [session("2026-09-01", sets([[100, 14], [100, 9]]))];
    const p = suggestProgression(input({ history, repTrigger: 13 }));
    expect(p.detail?.why).toBe("layoff");
    expect(weights(p)).toEqual([100, 100]);
  });

  it("explains itself in the chip and the sheet", () => {
    const up = suggestProgression(input({ history: twoSets(14, 9), repTrigger: 13 }));
    expect(progressionChip(up, bench, "lb")?.short).toBe("first set hit 14");
    const upSheet = progressionSheet(up, bench, "lb");
    expect(upSheet?.title).toBe("Add 5 more lbs than last time");
    expect(upSheet?.body).toBe(
      "Your first working set hit 14 reps last time. When you hit 13 or more reps, move the weight up next time, aiming for last time's rep count at the new weight.",
    );
    const hold = suggestProgression(input({ history: twoSets(11, 9), repTrigger: 13 }));
    expect(progressionChip(hold, bench, "lb")).toEqual({ tone: "neutral", icon: "equal", label: "Same weight", short: "aim for 13 on set 1" });
    const sheet = progressionSheet(hold, bench, "lb");
    expect(sheet?.title).toBe("Same weight, aim for 13 reps");
    expect(sheet?.progress).toMatchObject({ valueText: "11 of 13 reps", value: 11, max: 13 });
  });
});

describe("trigger null matches the double progression", () => {
  const cases: [string, ProgressionInput][] = [
    [
      "5x5 all fives",
      input({ exercise: squat, target: { sets: 5, reps: "5" }, setCount: 5, history: [session("2026-11-05", sets([[200, 5], [200, 5], [200, 5], [200, 5], [200, 5]]))] }),
    ],
    [
      "5x5 one short",
      input({ exercise: squat, target: { sets: 5, reps: "5" }, setCount: 5, history: [session("2026-11-05", sets([[200, 5], [200, 5], [200, 5], [200, 4], [200, 3]]))] }),
    ],
    ["7 target, 9 reps", input({ history: [session("2026-11-05", sets([[100, 9], [100, 9]]))] })],
    [
      "8-10 range mid",
      input({ target: { sets: 3, reps: "8-10" }, setCount: 3, history: [session("2026-11-05", sets([[100, 10], [100, 9], [100, 8]]))] }),
    ],
    [
      "8-10 range top",
      input({ target: { sets: 3, reps: "8-10" }, setCount: 3, history: [session("2026-11-05", sets([[100, 10], [100, 10], [100, 10]]))] }),
    ],
  ];

  it.each(cases)("%s", (_, base) => {
    const before = brief(suggestProgression(base));
    expect(brief(suggestProgression({ ...base, repTrigger: null }))).toEqual(before);
    expect(before).toMatchSnapshot();
  });
});
