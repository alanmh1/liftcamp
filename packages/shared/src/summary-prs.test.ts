import { describe, expect, it } from "vitest";

import {
  prChip,
  prChipLabel,
  prCountLabel,
  setFiguresLabel,
  summaryPrs,
  workoutCopyText,
  type SummaryPrHistoryRow,
  type SummaryPrRow,
  type SummaryPrSet,
} from "./summary-prs";

const FINISH = "2026-11-20T18:00:00Z";
const BEFORE = "2026-11-18T18:00:00Z";
const AFTER = "2026-11-21T18:00:00Z";

let n = 0;
function set(weight_value: number | null, reps: number | null, extra: Partial<SummaryPrSet> = {}): SummaryPrSet {
  n += 1;
  return { id: `s${n}`, weight: null, weight_value, reps, completed: true, set_type: null, position: n, ...extra };
}

const standard: SummaryPrRow["exercise"] = { weight_type: "standard", set_type: null };

function row(exerciseId: string, sets: SummaryPrSet[], exercise = standard): SummaryPrRow {
  return { exerciseId, exercise, sets };
}

function past(
  exerciseId: string,
  sets: SummaryPrSet[],
  { workoutId = "w-old", finishedAt = BEFORE as string | null, exercise = standard } = {},
): SummaryPrHistoryRow {
  return { workout_id: workoutId, exercise_id: exerciseId, exercises: exercise, workouts: { finished_at: finishedAt }, sets };
}

function prs(rows: SummaryPrRow[], history: SummaryPrHistoryRow[], bodyweight: number | null = null) {
  return summaryPrs({ workoutId: "w-now", finishedAt: FINISH, rows, history, bodyweight });
}

describe("summaryPrs", () => {
  it("finds a PR over the previous best and keeps both sets", () => {
    const now = set(37.5, 10);
    const [pr] = prs([row("bench", [set(35, 10), now])], [past("bench", [set(35, 10), set(30, 12)])]);
    expect(pr.exerciseId).toBe("bench");
    expect(pr.best.setId).toBe(now.id);
    expect(pr.best).toMatchObject({ weightValue: 37.5, reps: 10 });
    expect(pr.previous).toMatchObject({ weightValue: 35, reps: 10 });
    expect(pr.chip).toEqual({ kind: "weight", amount: 2.5 });
  });

  it("gives no PR on a first session", () => {
    expect(prs([row("bench", [set(100, 5)])], [])).toEqual([]);
  });

  it("gives no PR when the best only ties the old one", () => {
    expect(prs([row("bench", [set(35, 10)])], [past("bench", [set(35, 10)])])).toEqual([]);
  });

  it("skips warm-ups and unfinished sets on both sides", () => {
    const history = [past("bench", [set(200, 5, { set_type: "warmup" }), set(50, 5)])];
    // The big warm-up and the unticked set do not count here either.
    const rows = [row("bench", [set(300, 5, { set_type: "warmup" }), set(300, 5, { completed: false }), set(55, 5)])];
    const [pr] = prs(rows, history);
    expect(pr.best.weightValue).toBe(55);
    expect(pr.previous.weightValue).toBe(50);
  });

  it("only counts workouts finished before this one, and never this one", () => {
    const rows = [row("bench", [set(60, 5)])];
    expect(prs(rows, [past("bench", [set(70, 5)], { finishedAt: AFTER })])).toEqual([]);
    expect(prs(rows, [past("bench", [set(50, 5)], { finishedAt: null })])).toEqual([]);
    expect(prs(rows, [past("bench", [set(50, 5)], { workoutId: "w-now" })])).toEqual([]);
  });

  it("shows one row per exercise, with the better of two PR sets, across two rows", () => {
    const better = set(62.5, 5);
    const result = prs([row("bench", [set(60, 5)]), row("bench", [better])], [past("bench", [set(55, 5)])]);
    expect(result).toHaveLength(1);
    expect(result[0].best.setId).toBe(better.id);
  });

  it("orders by percentage gain, then by the workout's order", () => {
    const result = prs(
      [
        row("small", [set(102, 5)]), // +2%
        row("big", [set(60, 5)]), // +20%
        row("tieA", [set(110, 5)]), // +10%
        row("tieB", [set(55, 5)]), // +10%
      ],
      [
        past("small", [set(100, 5)]),
        past("big", [set(50, 5)]),
        past("tieA", [set(100, 5)]),
        past("tieB", [set(50, 5)]),
      ],
    );
    expect(result.map((p) => p.exerciseId)).toEqual(["big", "tieA", "tieB", "small"]);
  });

  it("never PRs cardio", () => {
    const cardio = { weight_type: "standard", set_type: "cardio" };
    expect(prs([row("run", [set(10, 30)], cardio)], [past("run", [set(5, 30)], { exercise: cardio })])).toEqual([]);
  });

  it("scores bodyweight exercises on bodyweight plus the added load", () => {
    const bw = { weight_type: "bodyweight", set_type: null };
    const [pr] = prs([row("dip", [set(10, 8)], bw)], [past("dip", [set(5, 8)], { exercise: bw })], 80);
    expect(pr.best.load).toBe(90);
    expect(pr.chip).toEqual({ kind: "weight", amount: 5 });
    // With no bodyweight a bodyweight exercise has no load to score.
    expect(prs([row("dip", [set(10, 8)], bw)], [past("dip", [set(5, 8)], { exercise: bw })], null)).toEqual([]);
  });
});

describe("prChip", () => {
  it("is heavier first, then more reps at the same weight, else nothing", () => {
    expect(prChip({ load: 40, reps: 5 }, { load: 37.5, reps: 8 })).toEqual({ kind: "weight", amount: 2.5 });
    expect(prChip({ load: 40, reps: 10 }, { load: 40, reps: 8 })).toEqual({ kind: "reps", amount: 2 });
    expect(prChip({ load: 35, reps: 14 }, { load: 40, reps: 8 })).toBeNull();
  });
});

describe("labels", () => {
  it("counts PRs", () => {
    expect(prCountLabel(1)).toBe("1 PR");
    expect(prCountLabel(2)).toBe("2 PRs");
  });

  it("prints the chip in the user's unit", () => {
    expect(prChipLabel({ kind: "weight", amount: 2.5 }, "kg")).toBe("+2.5 kg");
    expect(prChipLabel({ kind: "weight", amount: 5.000000001 }, "lbs")).toBe("+5 lbs");
    expect(prChipLabel({ kind: "reps", amount: 1 }, "kg")).toBe("+1 rep");
    expect(prChipLabel({ kind: "reps", amount: 2 }, "kg")).toBe("+2 reps");
  });

  it("prints sets as the History table does", () => {
    expect(setFiguresLabel({ weight: null, weight_value: 37.5, reps: 10 }, "standard", "kg")).toBe("37.5 kg × 10");
    expect(setFiguresLabel({ weight: null, weight_value: 10, reps: 8 }, "bodyweight", "kg")).toBe("BW + 10 kg × 8");
    expect(setFiguresLabel({ weight: null, weight_value: -20, reps: 6 }, "bodyweight", "lbs")).toBe("BW − 20 lbs assist × 6");
    expect(setFiguresLabel({ weight: null, weight_value: 0, reps: 12 }, "bodyweight", "kg")).toBe("Bodyweight × 12");
  });
});

describe("workoutCopyText", () => {
  it("prints the workout in the spec's format", () => {
    const pr1 = set(37.5, 10, { position: 2 });
    const pr2 = set(30, 9, { position: 2 });
    const text = workoutCopyText({
      name: "F - Upper Body",
      dateLabel: "Friday, Nov 20",
      duration: "1h 06m",
      work: "6,794 kg",
      notes: null,
      unitLabel: "kg",
      prSetIds: new Set([pr1.id, pr2.id]),
      exercises: [
        { name: "Incline Dumbbell Bench With Palms In", weightType: "standard", cardio: false, sets: [set(35, 10, { position: 1 }), pr1] },
        { name: "Preacher Curl", weightType: "standard", cardio: false, sets: [set(27.5, 10, { position: 1 }), pr2] },
        {
          name: "Treadmill Run",
          weightType: "standard",
          cardio: true,
          sets: [{ ...set(null, null), duration_seconds: 1500, distance_meters: 5000 }],
        },
      ],
    });
    expect(text).toBe(
      [
        "F - Upper Body",
        "Friday, Nov 20 · 1h 06m · 6,794 kg",
        "",
        "Incline Dumbbell Bench With Palms In",
        "Set 1: 35 kg × 10",
        "Set 2: 37.5 kg × 10 · PR",
        "",
        "Preacher Curl",
        "Set 1: 27.5 kg × 10",
        "Set 2: 30 kg × 9 · PR",
        "",
        "Treadmill Run",
        "Set 1: 25:00 · 5 km",
        "",
        "Logged with LiftCamp · liftcamp.app",
      ].join("\n"),
    );
  });

  it("adds the note, labels warm-ups outside the set numbers, and leaves out unfinished sets and empty exercises", () => {
    const text = workoutCopyText({
      name: "Legs",
      dateLabel: "Monday, Nov 16",
      duration: "45m",
      work: "3,000 lbs",
      notes: "  Felt strong  ",
      unitLabel: "lbs",
      prSetIds: new Set(),
      exercises: [
        {
          name: "Squat",
          weightType: "standard",
          cardio: false,
          sets: [
            set(45, 8, { set_type: "warmup" }),
            set(95, 5, { set_type: "warmup" }),
            set(135, 5),
            set(155, 5, { completed: false }),
            set(145, 5),
          ],
        },
        { name: "Skipped", weightType: "standard", cardio: false, sets: [set(50, 5, { completed: false })] },
      ],
    });
    expect(text).toBe(
      [
        "Legs",
        "Monday, Nov 16 · 45m · 3,000 lbs",
        "Felt strong",
        "",
        "Squat",
        "Warm-up: 45 lbs × 8",
        "Warm-up: 95 lbs × 5",
        "Set 1: 135 lbs × 5",
        "Set 2: 145 lbs × 5",
        "",
        "Logged with LiftCamp · liftcamp.app",
      ].join("\n"),
    );
  });
});
