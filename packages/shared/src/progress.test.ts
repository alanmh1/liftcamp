import { describe, expect, it } from "vitest";

import {
  addDays,
  buildProgressIndex,
  draftFromChoice,
  draftLabel,
  estimatedMaxTrend,
  formatPerWeek,
  gainPercentLabel,
  gapTip,
  markPrSets,
  musclesWorked,
  musclesWorkedLabel,
  newBestsLabel,
  prTimeline,
  rangeDayEnabled,
  rangeDays,
  rangeFor,
  rangeLabel,
  rangeRowCells,
  setsBand,
  shortcutRange,
  sinceStarted,
  strengthGains,
  strengthProgress,
  tapRangeDay,
  togglePin,
  trendSelection,
  weeklySetsByGroup,
  weightedExercisesByUse,
  type ProgressScanRow,
} from "./progress";

// Tuesday 17 Nov 2026.
const TODAY = new Date(2026, 10, 17);

const SQUAT = "85495e85-bd72-445d-a6c8-5961f17ec2e5";
const DEADLIFT = "034ebb98-56b3-4073-a726-1709d14b4455";

type Ex = NonNullable<ProgressScanRow["exercises"]>;
const ex = (id: string, name: string, primary: string, extra: Partial<Ex> = {}): Ex => ({
  id,
  name,
  equipment: "barbell",
  weight_type: "standard",
  is_unilateral: false,
  set_type: null,
  primary_muscle: primary,
  ...extra,
});

const squat = ex(SQUAT, "Barbell Squat", "quads");
const deadlift = ex(DEADLIFT, "Barbell Deadlift", "lower back");
const curl = ex("curl", "Dumbbell Curl", "biceps", { equipment: "dumbbell" });
const pullup = ex("pullup", "Pullups", "lats", { equipment: "body only", weight_type: "bodyweight" });
const run = ex("run", "Treadmill", "quads", { equipment: "machine", set_type: "cardio" });
const calf = ex("calf", "Calf Raise", "calves", { equipment: "machine" });

let seq = 0;
function row(
  exercise: Ex,
  date: string,
  sets: [number | null, number | null][],
  { finished = true, workout = `w-${date}`, warmups = 0, incomplete = 0 } = {},
): ProgressScanRow {
  const out: ProgressScanRow["sets"] = [];
  let position = 0;
  for (let i = 0; i < warmups; i += 1) {
    out.push(set(20, 5, position++, date, "warmup"));
  }
  for (const [w, r] of sets) out.push(set(w, r, position++, date));
  for (let i = 0; i < incomplete; i += 1) out.push({ ...set(999, 1, position++, date), completed: false });
  return {
    workout_id: workout,
    exercise_id: exercise.id,
    exercises: exercise,
    workouts: { workout_date: date, finished_at: finished ? `${date}T12:00:00Z` : null },
    sets: out,
  };
}
function set(weight: number | null, reps: number | null, position: number, date: string, setType: string | null = null) {
  seq += 1;
  return {
    id: `s${seq}`,
    weight: weight == null ? "" : String(weight),
    weight_value: weight,
    reps,
    completed: true,
    created_at: `${date}T10:00:00Z`,
    position,
    set_type: setType,
  };
}

describe("rangeFor", () => {
  it("counts day presets inclusive of today", () => {
    expect(rangeFor("7D", TODAY)).toEqual({ start: "2026-11-11", end: "2026-11-17", preset: "7D" });
    expect(rangeDays(rangeFor("30D", TODAY))).toBe(30);
  });

  it("starts month presets the day after the same date back", () => {
    expect(rangeFor("1M", TODAY).start).toBe("2026-10-18");
    expect(rangeFor("3M", TODAY).start).toBe("2026-08-18");
    expect(rangeFor("6M", TODAY).start).toBe("2026-05-18");
    expect(rangeFor("1Y", TODAY).start).toBe("2025-11-18");
  });

  it("holds a month preset to a short month's last day", () => {
    expect(rangeFor("1M", new Date(2026, 2, 31)).start).toBe("2026-03-01");
  });

  it("runs All from the first workout, or today without one", () => {
    expect(rangeFor("All", TODAY, "2026-06-02").start).toBe("2026-06-02");
    expect(rangeFor("All", TODAY, null).start).toBe("2026-11-17");
  });

  it("orders a custom range", () => {
    expect(rangeFor({ start: "2026-11-10", end: "2026-11-03" }, TODAY)).toEqual({
      start: "2026-11-03",
      end: "2026-11-10",
      preset: null,
    });
  });
});

describe("rangeLabel", () => {
  it("names presets", () => {
    expect(rangeLabel(rangeFor("30D", TODAY), TODAY)).toBe("Last 30 days");
    expect(rangeLabel(rangeFor("All", TODAY), TODAY)).toBe("All time");
  });
  it("prints a custom range, with the year only outside this one", () => {
    expect(rangeLabel({ start: "2026-08-25", end: "2026-11-17", preset: null }, TODAY)).toBe("Aug 25 to Nov 17");
    expect(rangeLabel({ start: "2025-12-03", end: "2026-01-05", preset: null }, TODAY)).toBe("Dec 3, 2025 to Jan 5");
  });
});

describe("custom range selection", () => {
  it("sets start, then end, then starts over", () => {
    let d = tapRangeDay({ start: null, end: null }, "2026-11-10");
    expect(d).toEqual({ start: "2026-11-10", end: null });
    d = tapRangeDay(d, "2026-11-14");
    expect(d).toEqual({ start: "2026-11-10", end: "2026-11-14" });
    d = tapRangeDay(d, "2026-11-01");
    expect(d).toEqual({ start: "2026-11-01", end: null });
  });

  it("swaps when the second tap is earlier", () => {
    expect(tapRangeDay({ start: "2026-11-10", end: null }, "2026-11-03")).toEqual({
      start: "2026-11-03",
      end: "2026-11-10",
    });
  });

  it("allows one day as a range", () => {
    expect(tapRangeDay({ start: "2026-11-10", end: null }, "2026-11-10")).toEqual({
      start: "2026-11-10",
      end: "2026-11-10",
    });
  });

  it("disables days after today and before the first workout", () => {
    expect(rangeDayEnabled("2026-11-18", TODAY, null)).toBe(false);
    expect(rangeDayEnabled("2026-11-17", TODAY, null)).toBe(true);
    expect(rangeDayEnabled("2026-05-31", TODAY, "2026-06-01")).toBe(false);
    expect(rangeDayEnabled("2026-06-01", TODAY, "2026-06-01")).toBe(true);
  });

  it("labels the draft with its day count", () => {
    expect(draftLabel({ start: "2026-11-03", end: "2026-11-17" }, TODAY)).toBe("Nov 3 to Nov 17 · 15 days");
    expect(draftLabel({ start: "2026-11-03", end: "2026-11-03" }, TODAY)).toBe("Nov 3 · 1 day");
    expect(draftLabel({ start: null, end: null }, TODAY)).toBe("Pick a start date");
  });

  it("opens on the applied custom range", () => {
    expect(draftFromChoice("30D")).toEqual({ start: null, end: null });
    expect(draftFromChoice({ start: "2026-11-01", end: "2026-11-05" })).toEqual({ start: "2026-11-01", end: "2026-11-05" });
  });

  it("applies shortcuts", () => {
    expect(shortcutRange("last7", TODAY, null)).toEqual({ start: "2026-11-11", end: "2026-11-17" });
    expect(shortcutRange("thisMonth", TODAY, null)).toEqual({ start: "2026-11-01", end: "2026-11-17" });
    expect(shortcutRange("lastMonth", TODAY, null)).toEqual({ start: "2026-10-01", end: "2026-10-31" });
    expect(shortcutRange("lastMonth", new Date(2026, 0, 9), null)).toEqual({ start: "2025-12-01", end: "2025-12-31" });
    expect(shortcutRange("all", TODAY, "2026-03-04")).toEqual({ start: "2026-03-04", end: "2026-11-17" });
  });

  it("rounds the band at its ends and where a row wraps", () => {
    const week = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"];
    const cells = rangeRowCells(week, { start: "2026-11-11", end: "2026-11-20" });
    expect(cells.map((c) => c.inBand)).toEqual([false, false, true, true, true, true, true]);
    expect(cells[2]).toMatchObject({ isStart: true, roundLeft: true, roundRight: false });
    expect(cells[6]).toMatchObject({ roundRight: true, isEnd: false });
    // No band until both ends are set.
    expect(rangeRowCells(week, { start: "2026-11-11", end: null }).some((c) => c.inBand)).toBe(false);
  });

  it("stops the band at a month's blank cells", () => {
    const week = ["2026-11-30", null, null, null, null, null, null];
    const cells = rangeRowCells(week, { start: "2026-11-20", end: "2026-12-05" });
    expect(cells[0]).toMatchObject({ inBand: true, roundLeft: true, roundRight: true });
    expect(cells[1].inBand).toBe(false);
  });
});

describe("markPrSets", () => {
  it("marks rising estimated maxes across finished and unfinished workouts, completed sets only", () => {
    const rows = [
      row(squat, "2026-11-01", [[100, 5]]),
      row(squat, "2026-11-03", [[90, 5]], { incomplete: 1 }),
      row(squat, "2026-11-05", [[110, 5]], { finished: false }),
    ];
    const { prSetIds } = markPrSets(rows, null);
    const ids = rows.flatMap((r) => r.sets!.filter((s) => s.completed && s.weight_value !== 999).map((s) => s.id));
    expect([...prSetIds].sort()).toEqual([ids[0], ids[2]].sort());
  });
});

describe("buildProgressIndex", () => {
  it("keeps finished workouts and counted sets only", () => {
    const rows = [
      row(squat, "2026-11-01", [[100, 5]], { warmups: 2, incomplete: 1 }),
      row(squat, "2026-11-03", [[120, 5]], { finished: false }),
    ];
    const index = buildProgressIndex(rows, null, "lb");
    expect(index.setDays).toHaveLength(1);
    expect(index.exercises.get(SQUAT)?.sessions).toHaveLength(1);
    expect(index.workoutDates).toEqual(["2026-11-01"]);
    expect(index.firstWorkoutDate).toBe("2026-11-01");
  });

  it("marks only weight-charted exercises as weighted", () => {
    const index = buildProgressIndex(
      [
        row(squat, "2026-11-01", [[100, 5]]),
        row(pullup, "2026-11-01", [[0, 8]]),
        row(run, "2026-11-01", [[null, 600]]),
      ],
      180,
      "lb",
    );
    expect(index.exercises.get(SQUAT)?.weighted).toBe(true);
    expect(index.exercises.get("pullup")?.weighted).toBe(false);
    expect(index.exercises.get("run")?.weighted).toBe(false);
  });

  it("puts PRs and plate milestones on the timeline, newest first", () => {
    const index = buildProgressIndex(
      [
        row(deadlift, "2026-10-01", [[95, 5]]),
        row(deadlift, "2026-10-08", [[135, 3]]),
        row(deadlift, "2026-10-15", [[135, 1]]),
        row(deadlift, "2026-10-22", [[235, 1]]),
      ],
      null,
      "lb",
    );
    expect(index.timeline.map((e) => [e.date, e.milestone])).toEqual([
      ["2026-10-22", "First 225 lb deadlift"],
      // 135 × 1 is no PR after 135 × 3 and no new milestone.
      ["2026-10-08", "First 135 lb deadlift"],
      ["2026-10-01", null],
    ]);
  });

  it("adds a milestone set that is no PR", () => {
    const index = buildProgressIndex(
      [row(squat, "2026-10-01", [[125, 10]]), row(squat, "2026-10-08", [[135, 1]])],
      null,
      "lb",
    );
    expect(index.timeline[0]).toMatchObject({ date: "2026-10-08", milestone: "First 135 lb squat" });
  });

  it("uses kg milestones in kg", () => {
    const index = buildProgressIndex([row(squat, "2026-10-01", [[61.235, 5]])], null, "kg");
    expect(index.timeline[0].milestone).toBe("First 60 kg squat");
  });

  it("marks the first squat at bodyweight when bodyweight is known", () => {
    const index = buildProgressIndex(
      [row(squat, "2026-10-01", [[115, 5]]), row(squat, "2026-10-08", [[130, 5]])],
      128,
      "lb",
    );
    expect(index.timeline[0].milestone).toBe("First squat at bodyweight, 130 lb");
    const none = buildProgressIndex([row(squat, "2026-10-08", [[130, 5]])], null, "lb");
    expect(none.timeline[0].milestone).toBeNull();
  });

  it("gives no plate milestones off the barbell", () => {
    const index = buildProgressIndex([row(curl, "2026-10-01", [[140, 5]])], null, "lb");
    expect(index.timeline[0].milestone).toBeNull();
  });
});

describe("prTimeline", () => {
  it("filters to the range", () => {
    const index = buildProgressIndex(
      [row(squat, "2026-09-01", [[100, 5]]), row(squat, "2026-11-10", [[110, 5]])],
      null,
      "lb",
    );
    expect(prTimeline(index, rangeFor("30D", TODAY)).map((e) => e.date)).toEqual(["2026-11-10"]);
    expect(prTimeline(index, rangeFor("All", TODAY, index.firstWorkoutDate))).toHaveLength(2);
  });
});

describe("musclesWorked", () => {
  // 7 days: one week, so sets equal sets a week.
  const range = rangeFor("7D", TODAY);

  it("lights 10 or more a week as primary and fewer as secondary", () => {
    const sets = Array.from({ length: 10 }, (): [number, number] => [100, 5]);
    const index = buildProgressIndex(
      [row(squat, "2026-11-12", sets), row(curl, "2026-11-12", [[20, 10], [20, 10]])],
      null,
      "lb",
    );
    const m = musclesWorked(index, range);
    expect(m.highlights.primary).toEqual(["front_quads"]);
    expect(m.highlights.secondary).toEqual(["front_biceps"]);
    expect(m.perWeek.front_quads).toBe(10);
    expect(m.highlights.primaryMuscles).toEqual(["quads"]);
    expect(m.trained).toEqual(["biceps", "quads"]);
  });

  it("averages over the range's weeks", () => {
    const index = buildProgressIndex([row(squat, "2026-11-12", [[100, 5], [100, 5], [100, 5]])], null, "lb");
    const m = musclesWorked(index, { start: "2026-11-04", end: "2026-11-17" });
    expect(m.perWeek.front_quads).toBe(1.5);
  });

  it("lights every region of a muscle", () => {
    const row1 = row(ex("row", "Row", "upper back"), "2026-11-12", [[100, 5]]);
    const m = musclesWorked(buildProgressIndex([row1], null, "lb"), range);
    expect(m.highlights.secondary.sort()).toEqual(["back_lats", "back_traps"]);
  });

  it("says it in words", () => {
    expect(musclesWorkedLabel({ trained: ["chest", "back", "quads"], untrained: ["calves"] })).toBe(
      "Muscles worked. Trained chest, back and quads. Not trained calves.",
    );
    expect(musclesWorkedLabel({ trained: [], untrained: ["calves"] })).toBe(
      "Muscles worked. Nothing trained in this range.",
    );
  });
});

describe("weeklySetsByGroup", () => {
  it("groups back muscles and leaves forearms out", () => {
    const index = buildProgressIndex(
      [
        row(deadlift, "2026-11-12", [[100, 5], [100, 5]]),
        row(ex("lat", "Pulldown", "lats", { equipment: "cable" }), "2026-11-12", [[100, 5]]),
        row(ex("fa", "Wrist Curl", "forearms"), "2026-11-12", [[20, 5]]),
      ],
      null,
      "lb",
    );
    const rows = weeklySetsByGroup(index, rangeFor("7D", TODAY));
    expect(rows).toHaveLength(10);
    expect(rows.find((r) => r.group === "back")?.perWeek).toBe(3);
    expect(rows.reduce((n, r) => n + r.perWeek, 0)).toBe(3);
  });

  it("bands the counts", () => {
    expect(setsBand(9.9)).toBe("under");
    expect(setsBand(10)).toBe("in");
    expect(setsBand(20)).toBe("in");
    expect(setsBand(21)).toBe("over");
    expect(formatPerWeek(0)).toBe("0");
    expect(formatPerWeek(4.29)).toBe("4.3");
    expect(formatPerWeek(12.6)).toBe("13");
  });
});

describe("gapTip", () => {
  const twoWeeks = [row(squat, "2026-11-03", [[100, 5]], { workout: "a" }), row(squat, "2026-11-12", [[100, 5]], { workout: "b" })];

  it("names the first untrained group in order", () => {
    const tip = gapTip(buildProgressIndex(twoWeeks, null, "lb"), rangeFor("30D", TODAY), TODAY);
    expect(tip?.group).toBe("hamstrings");
    expect(tip?.muscle).toBe("hamstrings");
    expect(tip?.exercises[0].name).toBe("Dumbbell Romanian Deadlift");
  });

  it("skips groups trained in the last 14 days", () => {
    const rows = [
      ...twoWeeks,
      row(ex("rdl", "RDL", "hamstrings"), "2026-11-12", [[100, 5]], { workout: "b" }),
      row(ex("ht", "Hip Thrust", "glutes"), "2026-11-12", [[100, 5]], { workout: "b" }),
      // 15 days back: outside the 14.
      row(calf, "2026-11-02", [[100, 5]], { workout: "c" }),
    ];
    expect(gapTip(buildProgressIndex(rows, null, "lb"), rangeFor("30D", TODAY), TODAY)?.group).toBe("calves");
  });

  it("needs workouts in two different weeks of the last 28 days", () => {
    const sameWeek = [row(squat, "2026-11-16", [[100, 5]], { workout: "a" }), row(squat, "2026-11-17", [[100, 5]], { workout: "b" })];
    expect(gapTip(buildProgressIndex(sameWeek, null, "lb"), rangeFor("30D", TODAY), TODAY)).toBeNull();
  });

  it("needs a range of 7 days or more", () => {
    const index = buildProgressIndex(twoWeeks, null, "lb");
    expect(gapTip(index, { start: "2026-11-12", end: "2026-11-17" }, TODAY)).toBeNull();
  });

  it("says nothing when every group is covered", () => {
    const groups = ["hamstrings", "glutes", "calves", "lats", "chest", "shoulders", "quads"];
    const rows = [...twoWeeks, ...groups.map((g) => row(ex(g, g, g), "2026-11-12", [[10, 5]], { workout: "b" }))];
    expect(gapTip(buildProgressIndex(rows, null, "lb"), rangeFor("30D", TODAY), TODAY)).toBeNull();
  });
});

describe("strengthProgress", () => {
  const t = [100, 150, 200, 250] as const;
  it("fills within the current level", () => {
    expect(strengthProgress(125, t)).toEqual({ level: "Novice", next: "Intermediate", fill: 0.5, toNextKg: 25 });
    expect(strengthProgress(50, t)).toMatchObject({ level: "Beginner", fill: 0.5 });
  });
  it("is full at Elite", () => {
    expect(strengthProgress(300, t)).toEqual({ level: "Elite", next: null, fill: 1, toNextKg: null });
  });
});

describe("sinceStarted", () => {
  it("takes the most-logged weighted exercises with three sessions", () => {
    const rows = [
      row(squat, "2026-09-01", [[95, 5], [100, 5]]),
      row(squat, "2026-09-08", [[110, 5]]),
      row(squat, "2026-09-15", [[105, 5]]),
      row(squat, "2026-09-22", [[120, 3]]),
      row(curl, "2026-09-01", [[20, 10]]),
      row(curl, "2026-09-08", [[25, 10]]),
      row(pullup, "2026-09-01", [[0, 8]]),
      row(pullup, "2026-09-08", [[0, 8]]),
      row(pullup, "2026-09-15", [[0, 8]]),
    ];
    const out = sinceStarted(buildProgressIndex(rows, 180, "lb"));
    expect(out).toEqual([
      { exerciseId: SQUAT, name: "Barbell Squat", first: 100, best: 120, gain: 20, series: [100, 110, 105, 120], sessions: 4 },
    ]);
  });

  it("holds at four", () => {
    const rows = ["a", "b", "c", "d", "e"].flatMap((id) =>
      ["2026-09-01", "2026-09-08", "2026-09-15"].map((d) => row(ex(id, id, "chest"), d, [[50, 5]])),
    );
    expect(sinceStarted(buildProgressIndex(rows, null, "lb"))).toHaveLength(4);
  });
});

describe("trends", () => {
  const rows = [
    row(squat, "2026-07-01", [[100, 1]]),
    row(squat, "2026-09-01", [[90, 1]]),
    row(squat, "2026-09-08", [[110, 1]]),
    row(squat, "2026-09-15", [[105, 1]]),
    row(squat, "2026-09-22", [[120, 1]]),
    row(deadlift, "2026-09-01", [[200, 1]]),
    row(deadlift, "2026-09-08", [[200, 1]]),
    row(deadlift, "2026-09-15", [[190, 1]]),
    row(curl, "2026-09-01", [[20, 1]]),
    row(curl, "2026-09-08", [[22, 1]]),
  ];
  const index = buildProgressIndex(rows, null, "lb");
  const range = { start: "2026-08-20", end: "2026-11-17" };
  const E1 = 1 + 1 / 30;

  it("steps the running max, seeded from before the range", () => {
    const t = estimatedMaxTrend(index, SQUAT, range)!;
    // A single scores weight × (1 + 1/30) through oneRepMaxNumeric.
    expect(t.points.map((p) => Math.round(p.value / E1))).toEqual([100, 110, 110, 120]);
    expect(t.start / E1).toBeCloseTo(100);
    expect(t.end / E1).toBeCloseTo(120);
    expect(t.gain / E1).toBeCloseTo(20);
    expect(t.gainPercent).toBeCloseTo(0.2);
    expect(t.newBests).toBe(2);
  });

  it("starts from the first session in range with nothing before", () => {
    const t = estimatedMaxTrend(index, DEADLIFT, range)!;
    expect(t.start / E1).toBeCloseTo(200);
    expect(t.gainPercent).toBe(0);
    expect(t.newBests).toBe(0);
    expect(gainPercentLabel(t.gainPercent)).toBe("No change");
  });

  it("is null without a session in range", () => {
    expect(estimatedMaxTrend(index, SQUAT, { start: "2026-10-01", end: "2026-11-17" })).toBeNull();
    expect(estimatedMaxTrend(index, "missing", range)).toBeNull();
  });

  it("picks exercises with three sessions in range, most first", () => {
    expect(trendSelection(index, range)).toEqual({ ids: [SQUAT, DEADLIFT], pinned: false });
  });

  it("uses pins, in order, when there are any", () => {
    expect(trendSelection(index, range, ["curl", "gone", SQUAT])).toEqual({ ids: ["curl", SQUAT], pinned: true });
  });

  it("sorts gains largest first", () => {
    const trends = [DEADLIFT, SQUAT, "curl"].map((id) => estimatedMaxTrend(index, id, range)!);
    expect(strengthGains(trends).map((t) => t.exerciseId)).toEqual([SQUAT, "curl", DEADLIFT]);
    expect(gainPercentLabel(0.2)).toBe("+20%");
  });

  it("lists weighted exercises most-logged first", () => {
    expect(weightedExercisesByUse(index).map((e) => e.id)).toEqual([SQUAT, DEADLIFT, "curl"]);
  });

  it("holds pins at four", () => {
    expect(togglePin(["a", "b", "c", "d"], "e")).toEqual(["a", "b", "c", "d"]);
    expect(togglePin(["a", "b"], "a")).toEqual(["b"]);
    expect(togglePin(["a"], "b")).toEqual(["a", "b"]);
  });

  it("labels new bests", () => {
    expect(newBestsLabel(0)).toBe("No new bests");
    expect(newBestsLabel(1)).toBe("1 new best");
    expect(newBestsLabel(6)).toBe("6 new bests");
  });
});

describe("addDays", () => {
  it("crosses months and years", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});
