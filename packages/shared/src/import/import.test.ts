import { describe, expect, it } from "vitest";

import { CATALOG, FITBOD_SMALL, MAP } from "./__fixtures__/fitbod-small";
import { parseCsv } from "./csv";
import { fitbodDateToIso, parseFitbod, type FitbodRow } from "./fitbod";
import { matchExercises } from "./match";
import { buildImportPlan, importBatches, importTag, type ImportChoice } from "./plan";

describe("parseCsv", () => {
  it("splits plain rows on LF and CRLF", () => {
    expect(parseCsv("a,b\nc,d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
    expect(parseCsv("a,b\r\nc,d\r\n")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("keeps commas, line breaks and doubled quotes inside quotes", () => {
    expect(parseCsv('x,"one, two","say ""hi""","line\nbreak"\n')).toEqual([
      ["x", "one, two", 'say "hi"', "line\nbreak"],
    ]);
  });

  it("drops a BOM, a trailing newline and blank lines", () => {
    expect(parseCsv("﻿a,b\n\nc,d\n")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("keeps empty fields", () => {
    expect(parseCsv("a,,c,\n")).toEqual([["a", "", "c", ""]]);
  });

  it("returns nothing for empty text", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

describe("parseFitbod", () => {
  it("refuses a file whose header is not Fitbod's", () => {
    expect(parseFitbod("Date,Exercise,Reps\n2026-10-30 18:00:00 +0000,Squat,5\n")).toEqual({
      ok: false,
      reason: "header",
    });
    expect(parseFitbod("Workout #,Date,Exercise Name\n")).toEqual({ ok: false, reason: "header" });
  });

  it("calls a header with no rows empty", () => {
    const header = FITBOD_SMALL.split("\r\n")[0];
    expect(parseFitbod(header)).toEqual({ ok: false, reason: "empty" });
    expect(parseFitbod("")).toEqual({ ok: false, reason: "empty" });
  });

  it("parses every row, trimmed, with zeros kept", () => {
    const parsed = parseFitbod(FITBOD_SMALL);
    if (!parsed.ok) throw new Error("expected ok");
    expect(parsed.rows).toHaveLength(13);
    expect(parsed.rows[0]).toEqual({
      startedAt: "2026-10-30T18:00:00.000Z",
      exercise: "Dumbbell Bench Press",
      reps: 10,
      weightKg: 10,
      durationS: 0,
      distanceM: 0,
      incline: 0,
      warmup: true,
      note: null,
    });
    // Long kg decimal rounded, quoted note with a comma kept whole.
    expect(parsed.rows[1]).toMatchObject({ weightKg: 22.68, reps: 8, warmup: false, note: "Felt strong, add weight" });
    // Treadmill: time, meters and incline, leading space on the incline.
    expect(parsed.rows[3]).toMatchObject({ durationS: 600, distanceM: 1500, incline: 6, reps: 0, weightKg: 0 });
    // Hold: no reps, a duration.
    expect(parsed.rows[5]).toMatchObject({ exercise: "Plank", reps: 0, durationS: 60 });
  });

  it("accepts the header with a BOM", () => {
    expect(parseFitbod(`﻿${FITBOD_SMALL}`).ok).toBe(true);
  });

  it("leaves out a row with no exercise or an unreadable date", () => {
    const header = FITBOD_SMALL.split("\r\n")[0];
    const text = [
      header,
      "not a date,Squat,5,100,0,0,0,,false,,1",
      "2026-10-30 18:00:00 +0000,,5,100,0,0,0,,false,,1",
      "2026-10-30 18:00:00 +0000,Squat,5,100,0,0,0,,false,,1",
    ].join("\n");
    const parsed = parseFitbod(text);
    expect(parsed.ok && parsed.rows.map((r) => r.exercise)).toEqual(["Squat"]);
  });
});

describe("fitbodDateToIso", () => {
  it("reads the offset", () => {
    expect(fitbodDateToIso("2026-10-30 18:00:00 +0000")).toBe("2026-10-30T18:00:00.000Z");
    expect(fitbodDateToIso("2026-10-30 18:00:00 -0700")).toBe("2026-10-31T01:00:00.000Z");
    expect(fitbodDateToIso("30/10/2026")).toBeNull();
  });
});

function rows(): FitbodRow[] {
  const parsed = parseFitbod(FITBOD_SMALL);
  if (!parsed.ok) throw new Error("expected ok");
  return parsed.rows;
}

describe("matchExercises", () => {
  it("uses the map, then the normalized name, then an alias, in first-appearance order", () => {
    const matches = matchExercises(
      rows().map((r) => r.exercise),
      MAP,
      CATALOG,
    );
    expect(matches).toEqual([
      { name: "Dumbbell Bench Press", sets: 4, exerciseId: "db-bench", close: false },
      { name: "Running - Treadmill", sets: 2, exerciseId: "treadmill", close: false },
      { name: "Plank", sets: 1, exerciseId: "plank", close: true },
      { name: "Dumbbell Bulgarian Split Squat", sets: 2, exerciseId: "bss", close: false },
      { name: "Push Up", sets: 2, exerciseId: "pushup", close: false },
      { name: "Mystery Move", sets: 2, exerciseId: null, close: false },
    ]);
  });

  it("falls through a map row whose exercise is not in the catalog", () => {
    const [m] = matchExercises(["Gone Exercise"], MAP, CATALOG);
    expect(m).toEqual({ name: "Gone Exercise", sets: 1, exerciseId: null, close: false });
  });

  it("prefers a name match over another exercise's alias", () => {
    const catalog = [
      { id: "a", name: "Other", alias_text: "pushup" },
      { id: "b", name: "Push Up" },
    ];
    expect(matchExercises(["Push-up"], [], catalog)[0].exerciseId).toBe("b");
  });
});

const CHOICES: Record<string, ImportChoice> = {
  "Dumbbell Bench Press": "db-bench",
  "Running - Treadmill": "treadmill",
  Plank: "plank",
  "Dumbbell Bulgarian Split Squat": "bss",
  "Push Up": "pushup",
  "Mystery Move": "skip",
};

const utcDate = (iso: string) => iso.slice(0, 10);

function plan(overrides: Partial<Parameters<typeof buildImportPlan>[3]> = {}, choices = CHOICES) {
  return buildImportPlan(rows(), choices, CATALOG, {
    source: "fitbod",
    existingDates: new Set(["2026-10-27"]),
    importedStarts: new Set(["2026-10-26T10:00:00+00:00"]),
    localDate: utcDate,
    ...overrides,
  });
}

describe("buildImportPlan", () => {
  it("makes one workout per session, two on the same day", () => {
    const { workouts } = plan();
    expect(workouts.map((w) => [w.created_at, w.workout_date])).toEqual([
      ["2026-10-30T18:00:00.000Z", "2026-10-30"],
      ["2026-10-30T08:00:00.000Z", "2026-10-30"],
    ]);
    expect(workouts[0].notes).toBe("Imported from Fitbod");
  });

  it("keeps exercise and set order, with weights per dumbbell and the multiplier ignored", () => {
    const [evening, morning] = plan().workouts;
    expect(evening.exercises.map((e) => e.exercise_id)).toEqual(["db-bench", "treadmill", "plank"]);
    expect(evening.exercises[0].sets).toEqual([
      { weight: 10, unit: "kg", reps: 10, duration: null, distance: null, incline: null, set_type: "warmup", note: null },
      {
        weight: 22.68,
        unit: "kg",
        reps: 8,
        duration: null,
        distance: null,
        incline: null,
        set_type: null,
        note: "Felt strong, add weight",
      },
      { weight: 22.68, unit: "kg", reps: 8, duration: null, distance: null, incline: null, set_type: null, note: null },
    ]);
    expect(morning.exercises.map((e) => e.exercise_id)).toEqual(["bss", "pushup"]);
    expect(morning.exercises[0].sets.map((s) => [s.weight, s.reps])).toEqual([
      [12.5, 10],
      [12.5, 10],
    ]);
  });

  it("gives cardio time, distance and a capped incline, and no weight or reps", () => {
    const treadmill = plan().workouts[0].exercises[1].sets;
    expect(treadmill).toEqual([
      { weight: null, unit: null, reps: null, duration: 600, distance: 1500, incline: 6, set_type: null, note: null },
      { weight: null, unit: null, reps: null, duration: 300, distance: 700, incline: 50, set_type: null, note: null },
    ]);
  });

  it("drops the incline for cardio without one", () => {
    const catalog = CATALOG.map((e) => (e.id === "treadmill" ? { ...e, has_incline: false } : e));
    const p = buildImportPlan(rows(), CHOICES, catalog, {
      source: "fitbod",
      existingDates: new Set(),
      importedStarts: new Set(),
      localDate: utcDate,
    });
    expect(p.workouts[0].exercises[1].sets.map((s) => s.incline)).toEqual([null, null]);
  });

  it("keeps a hold's duration with no weight or reps", () => {
    expect(plan().workouts[0].exercises[2].sets).toEqual([
      { weight: null, unit: null, reps: null, duration: 60, distance: null, incline: null, set_type: null, note: null },
    ]);
  });

  it("logs a bodyweight exercise at 0 kg so it counts for PRs", () => {
    expect(plan().workouts[1].exercises[1].sets).toEqual([
      { weight: 0, unit: "kg", reps: 15, duration: null, distance: null, incline: null, set_type: null, note: null },
    ]);
  });

  it("estimates the finish from sets and cardio time, between 15 and 120 minutes", () => {
    const [evening, morning] = plan().workouts;
    // 6 sets x 150 s + 900 s of cardio = 1,800 s.
    expect(evening.finished_at).toBe("2026-10-30T18:30:00.000Z");
    // 3 sets x 150 s = 450 s, raised to 15 minutes.
    expect(morning.finished_at).toBe("2026-10-30T08:15:00.000Z");

    const long: FitbodRow[] = Array.from({ length: 60 }, () => ({ ...rows()[1] }));
    const [w] = buildImportPlan(long, CHOICES, CATALOG, {
      source: "fitbod",
      existingDates: new Set(),
      importedStarts: new Set(),
      localDate: utcDate,
    }).workouts;
    expect(w.finished_at).toBe("2026-10-30T20:00:00.000Z");
  });

  it("summarises what is in and what is left out", () => {
    expect(plan().summary).toEqual({
      workouts: 2,
      sets: 9,
      firstDate: "2026-10-30",
      lastDate: "2026-10-30",
      skippedLoggedDates: 1,
      alreadyImported: 1,
      setsLeftOut: 2,
      skippedExercises: 1,
    });
  });

  it("drops a session left empty by skipped exercises", () => {
    const { workouts } = plan();
    expect(workouts.some((w) => w.workout_date === "2026-10-28")).toBe(false);
  });

  it("takes every session when nothing is logged or imported", () => {
    const { summary } = plan({ existingDates: new Set(), importedStarts: new Set() });
    expect(summary).toMatchObject({ workouts: 4, firstDate: "2026-10-26", lastDate: "2026-10-30" });
  });

  it("dates a workout by the device's local date", () => {
    // Ten hours behind UTC: the 08:00 UTC session is the 29th locally.
    const behind = (iso: string) => new Date(new Date(iso).getTime() - 10 * 3600 * 1000).toISOString().slice(0, 10);
    const { workouts } = plan({ localDate: behind });
    expect(workouts.map((w) => w.workout_date)).toEqual(["2026-10-30", "2026-10-29"]);
  });

  it("treats a name with no choice as skipped", () => {
    const { "Push Up": _, ...rest } = CHOICES;
    const { summary } = plan({}, rest);
    expect(summary).toMatchObject({ sets: 8, setsLeftOut: 3, skippedExercises: 2 });
  });

  it("imports nothing when everything is skipped", () => {
    const all = Object.fromEntries(Object.keys(CHOICES).map((k) => [k, "skip" as const]));
    expect(plan({}, all).summary).toMatchObject({ workouts: 0, sets: 0, firstDate: null, lastDate: null });
  });
});

describe("importBatches and importTag", () => {
  it("splits into batches of 50", () => {
    const items = Array.from({ length: 306 }, (_, i) => i);
    expect(importBatches(items).map((b) => b.length)).toEqual([50, 50, 50, 50, 50, 50, 6]);
    expect(importBatches([])).toEqual([]);
  });

  it("tags Fitbod imports fitbod-csv", () => {
    expect(importTag("fitbod")).toBe("fitbod-csv");
  });
});
