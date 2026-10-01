import { describe, expect, it } from "vitest";

import {
  DUMBBELL_LADDER_KG,
  DUMBBELL_LADDER_LB,
  FINE_DUMBBELL_LADDER_LB,
  canShowProgression,
  classifySets,
  formatSuggestedSet,
  formatSuggestedWeight,
  loadRuleFor,
  nextOnLadder,
  nextTimeLabel,
  parseRepTarget,
  placeholderSuggestions,
  sessionResult,
  snapToStep,
  suggestProgression,
  progressionChip,
  progressionSheet,
  suggestionToWrite,
  type HistorySession,
  type HistorySet,
  type Progression,
  type ProgressionExercise,
  type ProgressionInput,
} from "./progression";
import { KG_PER_LB } from "./units";

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
const pushUp = exercise({ equipment: "body only" });
const pullUp = exercise({ equipment: "body only", weight_type: "bodyweight", primary_muscle: "lats" });

/** `[weight, reps]` pairs, in lb unless `unit` says otherwise. */
const sets = (pairs: [number | null, number | null][], unit = "lb"): HistorySet[] =>
  pairs.map(([weight_value, reps]) => ({ weight_value, reps, weight_unit: unit }));

let n = 0;
const session = (date: string, s: HistorySet[]): HistorySession => ({ workoutId: `w${(n += 1)}`, date, sets: s });

const input = (over: Partial<ProgressionInput>): ProgressionInput => ({
  exercise: bench,
  history: [],
  unit: "lb",
  target: { sets: 3, reps: "8-10" },
  setCount: 3,
  today: "2026-10-01",
  ...over,
});

const weights = (p: Progression) => p.sets.map((s) => s.weight?.value ?? null);
const reps = (p: Progression) => p.sets.map((s) => s.reps);

describe("parseRepTarget", () => {
  it("reads ranges", () => {
    expect(parseRepTarget("8-10")).toEqual({ kind: "range", low: 8, high: 10 });
    expect(parseRepTarget("10-12 each")).toEqual({ kind: "range", low: 10, high: 12 });
    expect(parseRepTarget(" 6 - 8 ")).toEqual({ kind: "range", low: 6, high: 8 });
  });

  it("reads fixed counts", () => {
    expect(parseRepTarget("5")).toEqual({ kind: "fixed", reps: 5 });
    expect(parseRepTarget("8 each")).toEqual({ kind: "fixed", reps: 8 });
  });

  it("reads timed targets", () => {
    expect(parseRepTarget("30s")).toEqual({ kind: "timed" });
    expect(parseRepTarget("45s")).toEqual({ kind: "timed" });
    expect(parseRepTarget("45 sec")).toEqual({ kind: "timed" });
  });

  it("is null for nothing or no leading number", () => {
    expect(parseRepTarget(null)).toBeNull();
    expect(parseRepTarget("")).toBeNull();
    expect(parseRepTarget("AMRAP")).toBeNull();
  });
});

describe("loadRuleFor", () => {
  it("adds 10 lb to a lower-body barbell compound and 5 lb to the rest", () => {
    expect(loadRuleFor(squat, "lb")).toEqual({ kind: "linear", step: 10 });
    expect(loadRuleFor(exercise({ primary_muscle: "lower back" }), "lb")).toEqual({ kind: "linear", step: 10 });
    expect(loadRuleFor(bench, "lb")).toEqual({ kind: "linear", step: 5 });
    expect(loadRuleFor(exercise({ primary_muscle: "quads", mechanic: "isolation" }), "lb")).toEqual({
      kind: "linear",
      step: 5,
    });
  });

  it("uses 5 kg and 2.5 kg for the same lifts in kg", () => {
    expect(loadRuleFor(squat, "kg")).toEqual({ kind: "linear", step: 5 });
    expect(loadRuleFor(bench, "kg")).toEqual({ kind: "linear", step: 2.5 });
  });

  it("treats the EZ bar and the Smith machine as barbells", () => {
    expect(loadRuleFor(exercise({ equipment: "e-z curl bar", mechanic: "isolation", primary_muscle: "biceps" }), "lb")).toEqual({
      kind: "linear",
      step: 5,
    });
    expect(loadRuleFor(exercise({ equipment: "smith machine", primary_muscle: "quads" }), "lb")).toEqual({
      kind: "linear",
      step: 10,
    });
  });

  it("maps machine, cable, kettlebell, body only and the rest", () => {
    expect(loadRuleFor(exercise({ equipment: "machine" }), "lb")).toEqual({ kind: "linear", step: 10 });
    expect(loadRuleFor(exercise({ equipment: "machine" }), "kg")).toEqual({ kind: "linear", step: 5 });
    expect(loadRuleFor(exercise({ equipment: "cable" }), "lb")).toEqual({ kind: "linear", step: 5 });
    expect(loadRuleFor(exercise({ equipment: "cable" }), "kg")).toEqual({ kind: "linear", step: 2.5 });
    expect(loadRuleFor(exercise({ equipment: "kettlebells" }), "lb").kind).toBe("ladder");
    expect(loadRuleFor(pushUp, "lb")).toEqual({ kind: "reps", capped: false });
    expect(loadRuleFor(exercise({ equipment: "bands" }), "lb")).toEqual({ kind: "reps", capped: true });
    expect(loadRuleFor(exercise({ equipment: "other" }), "lb")).toEqual({ kind: "reps", capped: true });
    expect(loadRuleFor(exercise({ equipment: "foam roll" }), "lb")).toEqual({ kind: "none" });
    expect(loadRuleFor(exercise({ equipment: null }), "lb")).toEqual({ kind: "none" });
  });

  it("gives bodyweight-type exercises the bodyweight rule", () => {
    expect(loadRuleFor(pullUp, "lb")).toEqual({ kind: "bodyweight", step: 5 });
    expect(loadRuleFor(pullUp, "kg")).toEqual({ kind: "bodyweight", step: 2.5 });
  });

  it("gives timed exercises no rule", () => {
    expect(loadRuleFor(exercise({ id: "57c7550a-4a9f-4caa-a783-7ce8b38ec9f4", weight_type: "bodyweight" }), "lb")).toEqual({
      kind: "none",
    });
  });

  it("takes the dumbbell ladder as an input, defaulting by unit", () => {
    expect(loadRuleFor(dumbbellPress, "lb")).toEqual({ kind: "ladder", ladder: DUMBBELL_LADDER_LB });
    expect(loadRuleFor(dumbbellPress, "kg")).toEqual({ kind: "ladder", ladder: DUMBBELL_LADDER_KG });
    expect(loadRuleFor(dumbbellPress, "lb", FINE_DUMBBELL_LADDER_LB)).toEqual({
      kind: "ladder",
      ladder: FINE_DUMBBELL_LADDER_LB,
    });
  });
});

describe("nextOnLadder", () => {
  it("goes to the next value from a ladder value", () => {
    expect(nextOnLadder(15, DUMBBELL_LADDER_LB)).toBe(20);
    expect(nextOnLadder(5, DUMBBELL_LADDER_LB)).toBe(8);
  });

  it("goes to the next ladder value above an off-ladder weight", () => {
    expect(nextOnLadder(17.5, DUMBBELL_LADDER_LB)).toBe(20);
    expect(nextOnLadder(22.5, DUMBBELL_LADDER_LB)).toBe(25);
  });

  it("keeps the 2.5 lb steps on the fine ladder", () => {
    expect(nextOnLadder(15, FINE_DUMBBELL_LADDER_LB)).toBe(17.5);
    expect(nextOnLadder(17.5, FINE_DUMBBELL_LADDER_LB)).toBe(20);
  });

  it("continues past the top", () => {
    expect(nextOnLadder(25, DUMBBELL_LADDER_LB)).toBe(30);
    expect(nextOnLadder(27.5, DUMBBELL_LADDER_LB)).toBe(30);
    expect(nextOnLadder(50, DUMBBELL_LADDER_LB)).toBe(55);
  });

  it("starts at the bottom for a weight below it", () => {
    expect(nextOnLadder(3, DUMBBELL_LADDER_LB)).toBe(5);
  });

  it("walks the kg ladder", () => {
    expect(nextOnLadder(10, DUMBBELL_LADDER_KG)).toBe(12.5);
    expect(nextOnLadder(15, DUMBBELL_LADDER_KG)).toBe(17.5);
    expect(nextOnLadder(9, DUMBBELL_LADDER_KG)).toBe(10);
  });
});

describe("snapToStep", () => {
  it("rounds to the nearest step without float noise", () => {
    expect(snapToStep(121.5, 5)).toBe(120);
    expect(snapToStep(63.73, 2.5)).toBe(62.5);
    expect(snapToStep(0.1 + 0.2, 0.1)).toBe(0.3);
  });
});

describe("classifySets", () => {
  const loads = (...l: (number | null)[]) => l.map((load) => ({ load }));

  it("marks lighter sets before the first top set as warmups", () => {
    expect(classifySets(loads(45, 95, 135, 135, 135))).toEqual(["warmup", "warmup", "working", "working", "working"]);
  });

  it("counts lighter sets after the top set as back-off sets", () => {
    expect(classifySets(loads(185, 155, 155))).toEqual(["working", "working", "working"]);
  });

  it("keeps a ramp set within 90% of the top", () => {
    expect(classifySets(loads(60, 65, 70))).toEqual(["warmup", "working", "working"]);
  });

  it("works every set at one weight", () => {
    expect(classifySets(loads(100, 100, 100))).toEqual(["working", "working", "working"]);
  });

  it("works every set with no positive load", () => {
    expect(classifySets(loads(null, null))).toEqual(["working", "working"]);
    expect(classifySets(loads(-40, -20))).toEqual(["working", "working"]);
  });

  it("uses set_type when present and the heuristic for untyped sets", () => {
    expect(
      classifySets([
        { load: 135, set_type: "warmup" },
        { load: 185, set_type: "normal" },
        { load: 185, set_type: "failure" },
        { load: 135, set_type: "drop" },
      ]),
    ).toEqual(["warmup", "working", "working", "drop"]);
    // A typed drop set does not set the top load for the heuristic.
    expect(
      classifySets([
        { load: 100 },
        { load: 135 },
        { load: 200, set_type: "drop" },
      ]),
    ).toEqual(["warmup", "working", "drop"]);
  });
});

describe("sessionResult", () => {
  const r = (...reps: number[]) => reps.map((x) => ({ reps: x }));
  const range = { low: 8, high: 10 };

  it("reads top, in-range and miss", () => {
    expect(sessionResult(r(10, 10, 10), range)).toBe("top");
    expect(sessionResult(r(10, 9, 8), range)).toBe("in-range");
    expect(sessionResult(r(10, 9, 7), range)).toBe("miss");
  });

  it("is incomplete with fewer sets than expected", () => {
    expect(sessionResult(r(10, 10), range, 3)).toBe("incomplete");
    expect(sessionResult(r(6, 6), range, 3)).toBe("incomplete");
  });
});

describe("suggestProgression: double progression", () => {
  it("adds weight and resets reps when every set reaches the top", () => {
    const p = suggestProgression(input({ history: [session("2026-09-28", sets([[70, 10], [70, 10], [70, 10]]))] }));
    expect(p.outcome).toBe("increase");
    expect(weights(p)).toEqual([75, 75, 75]);
    expect(reps(p)).toEqual([8, 8, 8]);
    expect(p.reason).toBe("up 5 from last time");
  });

  it("holds the weight and adds a rep per set within the range", () => {
    const p = suggestProgression(input({ history: [session("2026-09-28", sets([[70, 10], [70, 9], [70, 8]]))] }));
    expect(p.outcome).toBe("add-reps");
    expect(weights(p)).toEqual([70, 70, 70]);
    expect(reps(p)).toEqual([10, 10, 9]);
    expect(p.reason).toBe("same weight, beat last time's reps");
  });

  it("adds 10 to a squat", () => {
    const p = suggestProgression(
      input({ exercise: squat, history: [session("2026-09-28", sets([[135, 10], [135, 10], [135, 10]]))] }),
    );
    expect(weights(p)).toEqual([145, 145, 145]);
    expect(p.reason).toBe("up 10 from last time");
  });

  it("adds weight when a fixed target is hit", () => {
    const p = suggestProgression(
      input({ target: { sets: 3, reps: "5" }, history: [session("2026-09-28", sets([[95, 5], [95, 5], [95, 5]]))] }),
    );
    expect(p.outcome).toBe("increase");
    expect(weights(p)).toEqual([100, 100, 100]);
    expect(reps(p)).toEqual([5, 5, 5]);
  });

  it("holds when a fixed target is missed", () => {
    const p = suggestProgression(
      input({ target: { sets: 3, reps: "5" }, history: [session("2026-09-28", sets([[95, 5], [95, 5], [95, 4]]))] }),
    );
    expect(p.outcome).toBe("hold");
    expect(weights(p)).toEqual([95, 95, 95]);
    expect(reps(p)).toEqual([5, 5, 5]);
    expect(p.reason).toBe("same weight, aim for 5 reps");
  });

  it("uses 8-12 with no routine target", () => {
    const inRange = suggestProgression(
      input({ target: null, history: [session("2026-09-28", sets([[70, 10], [70, 10], [70, 10]]))] }),
    );
    expect(inRange.outcome).toBe("add-reps");
    expect(reps(inRange)).toEqual([11, 11, 11]);
    const top = suggestProgression(
      input({ target: null, history: [session("2026-09-28", sets([[70, 12], [70, 12], [70, 12]]))] }),
    );
    expect(top.outcome).toBe("increase");
    expect(reps(top)).toEqual([8, 8, 8]);
  });

  it("raises a dumbbell to the next ladder weight", () => {
    const p = suggestProgression(
      input({ exercise: dumbbellPress, history: [session("2026-09-28", sets([[17.5, 10], [17.5, 10], [17.5, 10]]))] }),
    );
    expect(weights(p)).toEqual([20, 20, 20]);
    expect(p.reason).toBe("up 2.5 from last time");
  });

  it("uses a passed dumbbell ladder", () => {
    const p = suggestProgression(
      input({
        exercise: dumbbellPress,
        dumbbellLadder: FINE_DUMBBELL_LADDER_LB,
        history: [session("2026-09-28", sets([[15, 10], [15, 10], [15, 10]]))],
      }),
    );
    expect(weights(p)).toEqual([17.5, 17.5, 17.5]);
  });

  it("raises each back-off set from its own weight", () => {
    const p = suggestProgression(
      input({ target: { sets: 3, reps: "5" }, history: [session("2026-09-28", sets([[185, 5], [155, 8], [155, 8]]))] }),
    );
    expect(p.sets.map((s) => s.role)).toEqual(["working", "working", "working"]);
    expect(weights(p)).toEqual([190, 160, 160]);
  });
});

describe("suggestProgression: deload", () => {
  const miss = (date: string, w = 100) => session(date, sets([[w, 8], [w, 7], [w, 6]]));

  it("holds below three misses", () => {
    const p = suggestProgression(input({ history: [miss("2026-09-28"), miss("2026-09-25")] }));
    expect(p.outcome).toBe("hold");
    expect(p.missStreak).toBe(2);
    expect(weights(p)).toEqual([100, 100, 100]);
  });

  it("drops about 10% after three misses at one weight", () => {
    const p = suggestProgression(input({ history: [miss("2026-09-28"), miss("2026-09-25"), miss("2026-09-22")] }));
    expect(p.outcome).toBe("deload");
    expect(p.missStreak).toBe(3);
    expect(weights(p)).toEqual([90, 90, 90]);
    expect(reps(p)).toEqual([8, 8, 8]);
    expect(p.reason).toBe("lighter after 3 sessions short of 8");
  });

  it("snaps the deload to the step", () => {
    const p = suggestProgression(
      input({ history: [miss("2026-09-28", 135), miss("2026-09-25", 135), miss("2026-09-22", 135)] }),
    );
    expect(weights(p)).toEqual([120, 120, 120]);
  });

  it("deloads a dumbbell to the ladder weight below", () => {
    const p = suggestProgression(
      input({
        exercise: dumbbellPress,
        history: [miss("2026-09-28", 20), miss("2026-09-25", 20), miss("2026-09-22", 20)],
      }),
    );
    expect(weights(p)).toEqual([15, 15, 15]);
  });

  it("resets after a session that did not miss", () => {
    const ok = session("2026-09-25", sets([[100, 9], [100, 8], [100, 8]]));
    const p = suggestProgression(input({ history: [miss("2026-09-28"), ok, miss("2026-09-22"), miss("2026-09-19")] }));
    expect(p.missStreak).toBe(1);
    expect(p.outcome).toBe("hold");
  });

  it("resets on a weight change", () => {
    const p = suggestProgression(
      input({ history: [miss("2026-09-28", 105), miss("2026-09-25", 105), miss("2026-09-22", 100)] }),
    );
    expect(p.missStreak).toBe(2);
    expect(p.outcome).toBe("hold");
  });

  it("does not count a partial session as a miss", () => {
    const partial = session("2026-09-28", sets([[100, 6], [100, 5]]));
    const p = suggestProgression(input({ history: [partial, miss("2026-09-25"), miss("2026-09-22")] }));
    expect(p.outcome).toBe("hold");
    expect(p.reason).toBe("same as last time");
    expect(weights(p)).toEqual([100, 100, 100]);
  });

  it("skips a partial session in the streak without resetting it", () => {
    // Oldest to newest: miss, miss, partial, miss.
    const partial = session("2026-09-25", sets([[100, 6], [100, 5]]));
    const p = suggestProgression(
      input({ history: [miss("2026-09-28"), partial, miss("2026-09-22"), miss("2026-09-19")] }),
    );
    expect(p.missStreak).toBe(3);
    expect(p.outcome).toBe("deload");
    expect(weights(p)).toEqual([90, 90, 90]);
  });

  it("still ends the streak at a partial session at another weight", () => {
    const partial = session("2026-09-25", sets([[95, 6], [95, 5]]));
    const p = suggestProgression(
      input({ history: [miss("2026-09-28"), partial, miss("2026-09-22"), miss("2026-09-19")] }),
    );
    expect(p.missStreak).toBe(1);
    expect(p.outcome).toBe("hold");
  });

  it("ignores drop sets in the miss count", () => {
    const withDrop = (date: string): HistorySession =>
      session(date, [
        ...sets([[100, 8], [100, 8], [100, 8]]),
        { weight_value: 70, reps: 4, weight_unit: "lb", set_type: "drop" },
      ]);
    const p = suggestProgression(
      input({ setCount: 4, history: [withDrop("2026-09-28"), withDrop("2026-09-25"), withDrop("2026-09-22")] }),
    );
    expect(p.missStreak).toBe(0);
    expect(p.outcome).toBe("add-reps");
    expect(p.sets[3]).toEqual({
      position: 3,
      role: "drop",
      weight: { value: 70, stored: null },
      reps: 4,
      last: { weight: { value: 70, stored: null }, reps: 4 },
    });
  });
});

describe("suggestProgression: units", () => {
  it("holds a weight logged in lb at its exact stored value for a kg user", () => {
    const p = suggestProgression(
      input({ unit: "kg", history: [session("2026-09-28", sets([[225, 9], [225, 8], [225, 8]], "lb"))] }),
    );
    expect(p.outcome).toBe("add-reps");
    expect(p.sets[0].weight?.value).toBeCloseTo(225 * KG_PER_LB, 6);
    expect(p.sets[0].weight?.stored).toEqual({ weight_value: 225, weight_unit: "lb" });
  });

  it("lands an increase after a unit switch on the kg step", () => {
    const p = suggestProgression(
      input({ unit: "kg", history: [session("2026-09-28", sets([[135, 10], [135, 10], [135, 10]], "lb"))] }),
    );
    expect(p.outcome).toBe("increase");
    expect(weights(p)).toEqual([62.5, 62.5, 62.5]);
    expect(p.sets[0].weight?.stored).toBeNull();
    expect(p.reason).toBe("up from 135 lbs last time");
  });

  it("names kg when a lb user's last session was in kg", () => {
    const p = suggestProgression(
      input({ history: [session("2026-09-28", sets([[60, 10], [60, 10], [60, 10]], "kg"))] }),
    );
    expect(p.reason).toBe("up from 60 kg last time");
    expect(weights(p)).toEqual([135, 135, 135]);
  });

  it("treats one weight logged in both units as the same weight", () => {
    const kg = 225 * KG_PER_LB;
    const mixed: HistorySession = session("2026-09-28", [
      { weight_value: 225, reps: 8, weight_unit: "lb" },
      { weight_value: kg, reps: 7, weight_unit: "kg" },
      { weight_value: 225, reps: 6, weight_unit: "lb" },
    ]);
    const p = suggestProgression(input({ history: [mixed] }));
    expect(p.sets.map((s) => s.role)).toEqual(["working", "working", "working"]);
    expect(p.sets[1].weight?.value).toBeCloseTo(225, 6);
  });

  it("adds an exact step in the user's unit", () => {
    const p = suggestProgression(
      input({ unit: "kg", history: [session("2026-09-28", sets([[40, 10], [40, 10], [40, 10]], "kg"))] }),
    );
    expect(weights(p)).toEqual([42.5, 42.5, 42.5]);
    expect(p.reason).toBe("up 2.5 from last time");
  });
});

describe("suggestProgression: warmups", () => {
  it("repeats warmups and progresses the working sets", () => {
    const p = suggestProgression(
      input({
        target: { sets: 3, reps: "5" },
        setCount: 5,
        history: [session("2026-09-28", sets([[45, 10], [95, 5], [135, 5], [135, 5], [135, 5]]))],
      }),
    );
    expect(p.sets.map((s) => s.role)).toEqual(["warmup", "warmup", "working", "working", "working"]);
    expect(weights(p)).toEqual([45, 95, 140, 140, 140]);
    expect(reps(p)).toEqual([10, 5, 5, 5, 5]);
  });

  it("leaves warmups out of the result", () => {
    const p = suggestProgression(
      input({ setCount: 4, history: [session("2026-09-28", sets([[45, 3], [100, 10], [100, 10], [100, 10]]))] }),
    );
    expect(p.outcome).toBe("increase");
  });
});

describe("suggestProgression: bodyweight", () => {
  it("adds a rep per set to a body-only exercise, with no weight", () => {
    const p = suggestProgression(
      input({ exercise: pushUp, history: [session("2026-09-28", sets([[null, 12], [null, 10], [null, 9]]))] }),
    );
    expect(p.outcome).toBe("add-reps");
    expect(weights(p)).toEqual([null, null, null]);
    expect(reps(p)).toEqual([13, 11, 10]);
    expect(p.reason).toBe("1 more rep than last time");
  });

  it("adds load to a weighted bodyweight set", () => {
    const p = suggestProgression(
      input({ exercise: pullUp, history: [session("2026-09-28", sets([[10, 10], [10, 10], [10, 10]]))] }),
    );
    expect(weights(p)).toEqual([15, 15, 15]);
    expect(p.reason).toBe("up 5 from last time");
  });

  it("takes assist away, down to none, then adds reps", () => {
    const assisted = suggestProgression(
      input({ exercise: pullUp, history: [session("2026-09-28", sets([[-20, 10], [-20, 10], [-20, 10]]))] }),
    );
    expect(weights(assisted)).toEqual([-15, -15, -15]);
    expect(assisted.reason).toBe("5 less assist than last time");

    const nearly = suggestProgression(
      input({ exercise: pullUp, history: [session("2026-09-28", sets([[-2.5, 10], [-2.5, 10], [-2.5, 10]]))] }),
    );
    expect(weights(nearly)).toEqual([0, 0, 0]);

    const unassisted = suggestProgression(
      input({ exercise: pullUp, history: [session("2026-09-28", sets([[0, 10], [0, 10], [0, 10]]))] }),
    );
    expect(unassisted.outcome).toBe("add-reps");
    expect(weights(unassisted)).toEqual([0, 0, 0]);
    expect(reps(unassisted)).toEqual([11, 11, 11]);
  });

  it("caps reps for bands and holds at the top", () => {
    const band = exercise({ equipment: "bands" });
    const climbing = suggestProgression(
      input({ exercise: band, history: [session("2026-09-28", sets([[null, 9], [null, 8], [null, 8]]))] }),
    );
    expect(reps(climbing)).toEqual([10, 9, 9]);
    const top = suggestProgression(
      input({ exercise: band, history: [session("2026-09-28", sets([[null, 10], [null, 10], [null, 10]]))] }),
    );
    expect(top.outcome).toBe("hold");
    expect(reps(top)).toEqual([10, 10, 10]);
    expect(top.reason).toBe("Top of range. Try a harder band");
  });

  it("says what to change at the top of the range for balls and other", () => {
    const atTop = (equipment: string) =>
      suggestProgression(
        input({
          exercise: exercise({ equipment }),
          history: [session("2026-09-28", sets([[10, 10], [10, 10], [10, 10]]))],
        }),
      );
    expect(atTop("medicine ball").reason).toBe("Top of range. Try a heavier ball");
    expect(atTop("medicine ball").outcome).toBe("hold");
    expect(weights(atTop("medicine ball"))).toEqual([10, 10, 10]);
    expect(atTop("exercise ball").reason).toBe("Top of range. Try a harder variation");
    expect(atTop("other").reason).toBe("Top of range. Try a harder variation");
  });

  it("holds a partial band session without the top-of-range line", () => {
    const p = suggestProgression(
      input({
        exercise: exercise({ equipment: "bands" }),
        history: [session("2026-09-28", sets([[null, 10], [null, 10]]))],
      }),
    );
    expect(p.reason).toBe("same as last time");
  });
});

describe("suggestProgression: history shape", () => {
  it("is first-session with no history", () => {
    expect(suggestProgression(input({ history: [] }))).toEqual({
      outcome: "first-session",
      sets: [],
      reason: "",
      missStreak: 0,
      basis: null,
      detail: null,
    });
  });

  it("skips a newest session with nothing usable", () => {
    const empty = session("2026-09-28", sets([[null, 10], [100, null]]));
    const older = session("2026-09-25", sets([[100, 10], [100, 10], [100, 10]]));
    const p = suggestProgression(input({ history: [empty, older] }));
    expect(p.basis?.workoutId).toBe(older.workoutId);
    expect(weights(p)).toEqual([105, 105, 105]);
  });

  it("holds after more than four weeks off", () => {
    const p = suggestProgression(
      input({ history: [session("2026-08-20", sets([[100, 10], [100, 10], [100, 10]]))] }),
    );
    expect(p.outcome).toBe("hold");
    expect(weights(p)).toEqual([100, 100, 100]);
    expect(reps(p)).toEqual([10, 10, 10]);
    expect(p.reason).toBe("same as last time, 6 weeks off");
  });

  it("is unsupported for a timed target, a timed exercise, no equipment rule and no exercise row", () => {
    const history = [session("2026-09-28", sets([[0, 30], [0, 30]]))];
    expect(suggestProgression(input({ target: { sets: 3, reps: "30s" }, history })).outcome).toBe("unsupported");
    expect(
      suggestProgression(
        input({ exercise: exercise({ id: "57c7550a-4a9f-4caa-a783-7ce8b38ec9f4", weight_type: "bodyweight" }), history }),
      ).outcome,
    ).toBe("unsupported");
    expect(suggestProgression(input({ exercise: exercise({ equipment: "foam roll" }), history })).outcome).toBe(
      "unsupported",
    );
    expect(suggestProgression(input({ exercise: null, history })).outcome).toBe("unsupported");
  });

  it("repeats the last set for extra rows", () => {
    const p = suggestProgression(
      input({ target: { sets: 2, reps: "8-10" }, setCount: 4, history: [session("2026-09-28", sets([[70, 10], [70, 9]]))] }),
    );
    expect(p.sets.map((s) => s.position)).toEqual([0, 1, 2, 3]);
    expect(weights(p)).toEqual([70, 70, 70, 70]);
    expect(reps(p)).toEqual([10, 10, 10, 10]);
  });

  it("uses last session's row count when setCount is 0", () => {
    const p = suggestProgression(input({ setCount: 0, history: [session("2026-09-28", sets([[70, 9], [70, 9]]))], target: null }));
    expect(p.sets).toHaveLength(2);
  });
});

describe("canShowProgression", () => {
  it("needs both the flag and Pro", () => {
    expect(canShowProgression({ flagOn: true, isPro: true })).toBe(true);
    expect(canShowProgression({ flagOn: true, isPro: false })).toBe(false);
    expect(canShowProgression({ flagOn: false, isPro: true })).toBe(false);
    expect(canShowProgression({ flagOn: false, isPro: false })).toBe(false);
  });
});

describe("reason strings", () => {
  it("are short and follow the house style", () => {
    const h = (pairs: [number | null, number | null][], unit = "lb") => [session("2026-09-28", sets(pairs, unit))];
    const miss = (d: string) => session(d, sets([[100, 8], [100, 7], [100, 6]]));
    const reasons = [
      suggestProgression(input({ history: h([[70, 10], [70, 10], [70, 10]]) })).reason,
      suggestProgression(input({ history: h([[70, 9], [70, 9], [70, 9]]) })).reason,
      suggestProgression(input({ history: h([[70, 9], [70, 7], [70, 6]]) })).reason,
      suggestProgression(input({ history: [miss("2026-09-28"), miss("2026-09-25"), miss("2026-09-22")] })).reason,
      suggestProgression(input({ history: h([[70, 9], [70, 9]]) })).reason,
      suggestProgression(input({ unit: "kg", history: h([[225, 10], [225, 10], [225, 10]]) })).reason,
      suggestProgression(input({ exercise: pushUp, history: h([[null, 10]]) })).reason,
      suggestProgression(input({ exercise: pullUp, history: h([[-20, 10], [-20, 10], [-20, 10]]) })).reason,
      suggestProgression(input({ history: [session("2026-06-01", sets([[70, 9]]))] })).reason,
      ...["bands", "medicine ball", "exercise ball", "other"].map(
        (equipment) =>
          suggestProgression(input({ exercise: exercise({ equipment }), history: h([[null, 10], [null, 10], [null, 10]]) }))
            .reason,
      ),
    ];
    for (const r of reasons) {
      expect(r.length).toBeGreaterThan(0);
      expect(r.length).toBeLessThan(40);
      expect(r).not.toMatch(/[—–]/);
    }
  });
});

describe("labels", () => {
  const p = (sets: Progression["sets"], reason = "up 5 from last time"): Progression => ({
    outcome: "increase",
    sets,
    reason,
    missStreak: 0,
    basis: { workoutId: "w", date: "2026-09-28" },
    detail: { why: "increase", rule: "linear", range: { low: 8, high: 10 }, weeksOff: null, lastWorkingSets: 3 },
  });
  const s = (
    position: number,
    value: number | null,
    reps: number,
    role: "working" | "warmup" | "drop" = "working",
  ): Progression["sets"][number] => ({
    position,
    role,
    weight: value == null ? null : { value, stored: null },
    reps,
    last: null,
  });

  it("formats weight left and reps right, and reps alone with no weight", () => {
    expect(formatSuggestedSet(s(0, 75, 8), "standard", "lb")).toBe("75 × 8");
    expect(formatSuggestedSet(s(0, null, 11), "standard", "lb")).toBe("11 reps");
    expect(formatSuggestedSet(s(0, 225 * KG_PER_LB, 8), "standard", "kg")).toBe("102.1 × 8");
  });

  it("prints bodyweight loads as BW", () => {
    expect(formatSuggestedWeight({ value: 0, stored: null }, "bodyweight", "lb")).toBe("BW");
    expect(formatSuggestedWeight({ value: 10, stored: null }, "bodyweight", "lb")).toBe("BW+10");
    expect(formatSuggestedWeight({ value: -15, stored: null }, "bodyweight", "lb")).toBe("BW−15");
    expect(formatSuggestedWeight(null, "bodyweight", "lb")).toBeNull();
  });

  it("sums up next time from the working sets", () => {
    expect(nextTimeLabel(p([s(0, 45, 10, "warmup"), s(1, 75, 8), s(2, 75, 8)]), "standard", "lb")).toBe("75 × 8");
    expect(nextTimeLabel(p([s(0, 70, 10), s(1, 70, 10), s(2, 70, 9)]), "standard", "lb")).toBe("70 × 10, 10, 9");
    expect(nextTimeLabel(p([s(0, 190, 5), s(1, 160, 5)]), "standard", "lb")).toBe("190 × 5");
    expect(nextTimeLabel(p([s(0, null, 13), s(1, null, 11)]), "standard", "lb")).toBe("13, 11 reps");
    expect(nextTimeLabel(p([s(0, 45, 10, "warmup")]), "standard", "lb")).toBeNull();
  });

  it("maps a progression to placeholder sources", () => {
    const stored = { weight_value: 225, weight_unit: "lb" as const };
    const prog = p([{ position: 0, role: "working", weight: { value: 102.058, stored }, reps: 9, last: null }, s(1, null, 11)]);
    expect(placeholderSuggestions(prog)).toEqual([
      { weight_value: 102.058, reps: 9, stored, warmup: false },
      { weight_value: null, reps: 11, stored: null, warmup: false },
    ]);
    expect(placeholderSuggestions(null)).toEqual([]);
    expect(placeholderSuggestions(p([s(0, 45, 10, "warmup"), s(1, 135, 5)])).map((x) => x.warmup)).toEqual([true, false]);
  });
});

describe("suggestionToWrite", () => {
  const set = (weight: { value: number; stored: { weight_value: number; weight_unit: "lb" | "kg" } | null } | null, reps: number) => ({
    position: 0,
    role: "working" as const,
    weight,
    reps,
    last: null,
  });

  it("writes a new weight in the user's unit", () => {
    expect(suggestionToWrite(set({ value: 62.5, stored: null }, 8), "kg")).toEqual({
      suggested_weight_value: 62.5,
      suggested_weight_unit: "kg",
      suggested_reps: 8,
    });
  });

  it("writes a held weight as it is stored", () => {
    const stored = { weight_value: 225, weight_unit: "lb" as const };
    expect(suggestionToWrite(set({ value: 225 * KG_PER_LB, stored }, 9), "kg")).toEqual({
      suggested_weight_value: 225,
      suggested_weight_unit: "lb",
      suggested_reps: 9,
    });
  });

  it("writes no weight for a reps-only suggestion", () => {
    expect(suggestionToWrite(set(null, 11), "lb")).toEqual({
      suggested_weight_value: null,
      suggested_weight_unit: null,
      suggested_reps: 11,
    });
  });

  it("is null with no suggestion", () => {
    expect(suggestionToWrite(null, "lb")).toBeNull();
    expect(suggestionToWrite(undefined, "lb")).toBeNull();
  });

  it("matches what a held tick writes, through the placeholder", () => {
    // A Pro tick on an empty row logs the placeholder, which carries the
    // same stored weight, so weightToWrite and suggestionToWrite agree.
    const stored = { weight_value: 225, weight_unit: "lb" as const };
    const p = suggestProgression(
      input({ unit: "kg", history: [session("2026-09-28", sets([[225, 9], [225, 8], [225, 8]], "lb"))] }),
    );
    const [placeholder] = placeholderSuggestions(p);
    expect(placeholder.stored).toEqual(stored);
    expect(suggestionToWrite(p.sets[0], "kg")).toMatchObject({ suggested_weight_value: 225, suggested_weight_unit: "lb" });
  });
});

describe("progressionChip", () => {
  const h = (pairs: [number | null, number | null][], unit = "lb", date = "2026-09-28") => [session(date, sets(pairs, unit))];
  const chip = (over: Partial<ProgressionInput>) => {
    const i = input(over);
    return progressionChip(suggestProgression(i), i.exercise ?? { equipment: null }, i.unit);
  };

  it("shows the actual step on an increase", () => {
    expect(chip({ history: h([[70, 10], [70, 10], [70, 10]]) })).toEqual({
      tone: "up",
      icon: "up",
      label: "+5 lbs",
      short: "all 3 sets hit 10",
    });
    expect(chip({ exercise: squat, history: h([[135, 10], [135, 10], [135, 10]]) })?.label).toBe("+10 lbs");
    expect(chip({ unit: "kg", history: h([[40, 10], [40, 10], [40, 10]], "kg") })?.label).toBe("+2.5 kg");
    expect(chip({ exercise: dumbbellPress, history: h([[17.5, 10], [17.5, 10], [17.5, 10]]) })?.label).toBe("+2.5 lbs");
  });

  it("shows less assist on an assisted bodyweight increase", () => {
    expect(chip({ exercise: pullUp, history: h([[-20, 10], [-20, 10], [-20, 10]]) })?.label).toBe("−5 lbs assist");
  });

  it("counts reps gained", () => {
    expect(chip({ history: h([[70, 9], [70, 9], [70, 9]]) })).toEqual({
      tone: "up",
      icon: "up",
      label: "+1 rep",
      short: "beat last time",
    });
    // The plural, from a progression asking two more than last time.
    const two: Progression = {
      outcome: "add-reps",
      sets: [{ position: 0, role: "working", weight: { value: 70, stored: null }, reps: 10, last: { weight: { value: 70, stored: null }, reps: 8 } }],
      reason: "same weight, beat last time's reps",
      missStreak: 0,
      basis: null,
      detail: { why: "beat-reps", rule: "linear", range: { low: 8, high: 12 }, weeksOff: null, lastWorkingSets: 3 },
    };
    expect(progressionChip(two, bench, "lb")?.label).toBe("+2 reps");
    expect(chip({ exercise: pushUp, history: h([[null, 12], [null, 10], [null, 9]]) })?.label).toBe("+1 rep");
  });

  it("is neutral for a hold, a partial session and a layoff", () => {
    expect(chip({ history: h([[70, 9], [70, 7], [70, 6]]) })).toMatchObject({ tone: "neutral", icon: "equal", label: "Same weight" });
    expect(chip({ history: h([[70, 9], [70, 9]]) })).toMatchObject({ tone: "neutral", label: "Same weight", short: "repeat last time" });
    expect(chip({ history: h([[70, 9], [70, 9], [70, 9]], "lb", "2026-08-20") })).toEqual({
      tone: "neutral",
      icon: "equal",
      label: "Welcome back",
      short: "6 weeks off",
    });
  });

  it("is a neutral down chip for a deload", () => {
    const miss = (d: string) => session(d, sets([[100, 8], [100, 7], [100, 6]]));
    expect(chip({ history: [miss("2026-09-28"), miss("2026-09-25"), miss("2026-09-22")] })).toEqual({
      tone: "neutral",
      icon: "down",
      label: "Deload",
      short: "3 misses in a row",
    });
  });

  it("names the change at the top of a reps-only range", () => {
    const top = h([[null, 10], [null, 10], [null, 10]]);
    expect(chip({ exercise: exercise({ equipment: "bands" }), history: top })?.label).toBe("Harder band");
    expect(chip({ exercise: exercise({ equipment: "medicine ball" }), history: top })?.label).toBe("Heavier ball");
    expect(chip({ exercise: exercise({ equipment: "other" }), history: top })?.label).toBe("Harder variation");
  });

  it("is null for first-session and unsupported", () => {
    expect(chip({ history: [] })).toBeNull();
    expect(chip({ exercise: exercise({ equipment: "foam roll" }), history: h([[null, 10]]) })).toBeNull();
  });

  it("keeps labels short and in the house style", () => {
    const all = [
      chip({ history: h([[70, 10], [70, 10], [70, 10]]) }),
      chip({ history: h([[70, 9], [70, 9], [70, 9]]) }),
      chip({ history: h([[70, 9], [70, 7], [70, 6]]) }),
      chip({ history: h([[70, 9], [70, 9], [70, 9]], "lb", "2026-08-20") }),
    ];
    for (const c of all) {
      expect(c).not.toBeNull();
      expect(`${c!.label} · ${c!.short}`.length).toBeLessThan(32);
      expect(`${c!.label}${c!.short}`).not.toMatch(/[—–]/);
    }
  });
});

describe("progressionSheet", () => {
  const sheet = (over: Partial<ProgressionInput>) => {
    const i = input(over);
    return progressionSheet(suggestProgression(i), i.exercise ?? { equipment: null, weight_type: null }, i.unit);
  };

  it("explains beating last time's reps, with the table and the bar", () => {
    const s = sheet({ target: { sets: 3, reps: "8-12" }, history: [session("2026-09-28", sets([[70, 9], [70, 9], [70, 9]]))] });
    expect(s).toMatchObject({ kicker: "TODAY'S PROGRESSION", title: "1 more rep than last time" });
    expect(s?.body).toContain("When every set reaches 12, the weight goes up.");
    expect(s?.rows).toEqual([
      { set: "1", last: "70 × 9", today: "70 × 10", changed: true },
      { set: "2", last: "70 × 9", today: "70 × 10", changed: true },
      { set: "3", last: "70 × 9", today: "70 × 10", changed: true },
    ]);
    expect(s?.progress).toEqual({ label: "Reps until the next weight jump, 10 of 12", value: 10, max: 12 });
  });

  it("marks an earned weight jump", () => {
    const s = sheet({ history: [session("2026-09-28", sets([[70, 10], [70, 10], [70, 10]]))] });
    expect(s?.title).toBe("Up 5 lbs from last time");
    expect(s?.body).toContain("All 3 sets reached 10 reps last time");
    // The title already says it, so no bar.
    expect(s?.progress).toBeNull();
    expect(s?.rows[0]).toEqual({ set: "1", last: "70 × 10", today: "75 × 8", changed: true });
  });

  it("labels warmups and leaves rows past last session blank on the left", () => {
    const s = sheet({
      target: { sets: 3, reps: "5" },
      setCount: 4,
      history: [session("2026-09-28", sets([[45, 10], [135, 5], [135, 5]]))],
    });
    expect(s?.rows.map((r) => r.set)).toEqual(["W", "1", "2", "3"]);
    expect(s?.rows[0]).toMatchObject({ last: "45 × 10", today: "45 × 10", changed: false });
    expect(s?.rows[3].last).toBe("—");
  });

  it("has no bar without a weight to jump to", () => {
    expect(sheet({ exercise: pushUp, history: [session("2026-09-28", sets([[null, 10]]))] })?.progress).toBeNull();
    const miss = (d: string) => session(d, sets([[100, 8], [100, 7], [100, 6]]));
    const deload = sheet({ history: [miss("2026-09-28"), miss("2026-09-25"), miss("2026-09-22")] });
    expect(deload?.title).toBe("Lighter after 3 short sessions");
    expect(deload?.progress).toBeNull();
  });

  it("writes every title and body in the house style", () => {
    const h = (pairs: [number | null, number | null][], date = "2026-09-28") => [session(date, sets(pairs))];
    const miss = (d: string) => session(d, sets([[100, 8], [100, 7], [100, 6]]));
    const all = [
      sheet({ history: h([[70, 10], [70, 10], [70, 10]]) }),
      sheet({ history: h([[70, 9], [70, 9], [70, 9]]) }),
      sheet({ history: h([[70, 9], [70, 7], [70, 6]]) }),
      sheet({ history: h([[70, 9], [70, 9]]) }),
      sheet({ history: h([[70, 9], [70, 9], [70, 9]], "2026-08-20") }),
      sheet({ history: [miss("2026-09-28"), miss("2026-09-25"), miss("2026-09-22")] }),
      sheet({ exercise: pushUp, history: h([[null, 10]]) }),
      sheet({ exercise: pullUp, history: h([[-20, 10], [-20, 10], [-20, 10]]) }),
      sheet({ exercise: exercise({ equipment: "bands" }), history: h([[null, 10], [null, 10], [null, 10]]) }),
    ];
    for (const s of all) {
      expect(s).not.toBeNull();
      expect(`${s!.title} ${s!.body}`).not.toMatch(/[—–]|prevent|injur/i);
    }
  });
});

describe("cut-short sessions", () => {
  const rows = (date: string, done: [number, number][], planned: number): HistorySession => ({
    ...session(date, sets(done)),
    plannedSets: planned,
  });

  it("holds after one set at the top when the routine targets 3", () => {
    const p = suggestProgression(
      input({ target: { sets: 3, reps: "8-12" }, history: [session("2026-09-28", sets([[70, 15]]))] }),
    );
    expect(p.outcome).toBe("hold");
    expect(p.detail?.why).toBe("partial");
    expect(weights(p)).toEqual([70, 70, 70]);
  });

  it("holds after one ticked set of three rows with no routine target", () => {
    // The Simulator case: Cable Iron Cross, 70 × 15 ticked, two rows left.
    const p = suggestProgression(input({ exercise: exercise({ equipment: "cable" }), target: null, history: [rows("2026-09-28", [[70, 15]], 3)] }));
    expect(p.outcome).toBe("hold");
    expect(p.detail?.why).toBe("partial");
  });

  it("still increases when every row was ticked", () => {
    const p = suggestProgression(input({ target: null, history: [rows("2026-09-28", [[70, 12], [70, 12], [70, 12]], 3)] }));
    expect(p.outcome).toBe("increase");
  });

  it("counts ticked warmups as done rows", () => {
    const p = suggestProgression(
      input({
        target: { sets: 3, reps: "5" },
        setCount: 5,
        history: [rows("2026-09-28", [[45, 10], [95, 5], [135, 5], [135, 5], [135, 5]], 5)],
      }),
    );
    expect(p.outcome).toBe("increase");
  });

  it("takes the same count two sessions running as the user's normal", () => {
    // The routine has 3 rows; the user ticks 2, both at the top, twice in a row.
    const p = suggestProgression(
      input({
        target: { sets: 3, reps: "8-12" },
        history: [rows("2026-09-28", [[70, 12], [70, 12]], 3), rows("2026-09-25", [[70, 12], [70, 12]], 3)],
      }),
    );
    expect(p.outcome).toBe("increase");
    expect(weights(p)).toEqual([75, 75, 75]);
  });

  it("is still partial when the count drops from the session before", () => {
    const p = suggestProgression(
      input({
        target: { sets: 3, reps: "8-12" },
        history: [rows("2026-09-28", [[70, 12]], 3), rows("2026-09-25", [[70, 12], [70, 12], [70, 12]], 3)],
      }),
    );
    expect(p.outcome).toBe("hold");
    expect(p.detail?.why).toBe("partial");
  });

  it("keeps a cut-short session neutral in the miss streak", () => {
    const miss = (d: string) => session(d, sets([[100, 8], [100, 7], [100, 6]]));
    const p = suggestProgression(
      input({ history: [miss("2026-09-28"), rows("2026-09-25", [[100, 6]], 3), miss("2026-09-22"), miss("2026-09-19")] }),
    );
    expect(p.outcome).toBe("deload");
    expect(p.missStreak).toBe(3);
  });

  it("never says every set in its copy", () => {
    const one = suggestProgression(input({ target: null, history: [rows("2026-09-28", [[70, 12]], 1)] }));
    expect(one.outcome).toBe("increase");
    const sheet = progressionSheet(one, bench, "lb");
    expect(sheet?.body).toContain("Your set reached 12 reps last time");
    expect(progressionChip(one, bench, "lb")?.short).toBe("your set hit 12");
    const band = suggestProgression(
      input({ exercise: exercise({ equipment: "bands" }), history: [session("2026-09-28", sets([[null, 10], [null, 10]]))], target: { sets: 2, reps: "8-10" } }),
    );
    for (const p of [one, band]) {
      const s = progressionSheet(p, exercise({ equipment: "bands" }), "lb");
      expect(`${s?.title} ${s?.body}`).not.toMatch(/every set reached|on every set/i);
    }
  });
});
