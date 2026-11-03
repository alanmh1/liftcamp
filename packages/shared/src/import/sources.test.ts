import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { FITBOD_SMALL } from "./__fixtures__/fitbod-small";
import { detectDelimiter } from "./csv";
import { detectSource, parseImportFile } from "./detect";
import { hevyDateToIso, parseHevy } from "./hevy";
import type { ImportRow } from "./row";
import { parseStrong, strongDateToIso, strongDurationToSeconds } from "./strong";

const fixture = (name: string) => readFileSync(resolve(__dirname, "__fixtures__", name), "utf8");

const STRONG_IOS = fixture("strong-ios.csv");
const STRONG_ANDROID = fixture("strong-android.csv");
const STRONG_CURRENT = fixture("strong-current.csv");
const HEVY_KG = fixture("hevy-kg.csv");
const HEVY_LBS = fixture("hevy-lbs.csv");

/** Local wall time to ISO, the way the parsers build it. */
const local = (y: number, mo: number, d: number, h: number, mi: number, s = 0) =>
  new Date(y, mo - 1, d, h, mi, s).toISOString();

function ok(p: ReturnType<typeof parseStrong> | ReturnType<typeof parseHevy>) {
  if (!p.ok) throw new Error(`expected ok, got ${p.reason}`);
  return p;
}

function byExercise(rows: ImportRow[], name: string): ImportRow[] {
  return rows.filter((r) => r.exercise === name);
}

describe("detectDelimiter", () => {
  it("picks a semicolon only when the first line has more of them", () => {
    expect(detectDelimiter(STRONG_ANDROID)).toBe(";");
    expect(detectDelimiter(STRONG_CURRENT)).toBe(";");
    expect(detectDelimiter(STRONG_IOS)).toBe(",");
    expect(detectDelimiter(HEVY_KG)).toBe(",");
  });
});

describe("parseStrong", () => {
  it("parses every variant", () => {
    expect(ok(parseStrong(STRONG_IOS)).variant).toBe("ios");
    expect(ok(parseStrong(STRONG_ANDROID)).variant).toBe("android");
    expect(ok(parseStrong(STRONG_CURRENT)).variant).toBe("current");
  });

  it("knows the unit except in the iOS file", () => {
    const ios = ok(parseStrong(STRONG_IOS));
    expect(ios.unitKnown).toBe(false);
    expect(ios.rows.every((r) => r.unit === null)).toBe(true);
    expect(ok(parseStrong(STRONG_ANDROID)).unitKnown).toBe(true);
    const current = ok(parseStrong(STRONG_CURRENT));
    expect(current.unitKnown).toBe(true);
    expect(byExercise(current.rows, "Bench Press (Barbell)").map((r) => [r.weight, r.unit])).toEqual([
      [40, "kg"],
      [80, "kg"],
    ]);
  });

  it("reads Android's per-row units, kgs included, and leaves an empty one null", () => {
    const { rows } = ok(parseStrong(STRONG_ANDROID));
    expect(byExercise(rows, "Overhead Press (Barbell)").map((r) => r.unit)).toEqual(["lb", "lb"]);
    expect(byExercise(rows, "Squat (Barbell)")[0]).toMatchObject({ weight: 100, unit: "kg", reps: 5 });
    expect(byExercise(rows, "Pull Up")[0]).toMatchObject({ weight: 0, unit: null, reps: 8 });
    // 3 mi. of cycling, 720 s.
    expect(byExercise(rows, "Cycling (Indoor)")[0]).toMatchObject({
      weight: null,
      reps: null,
      distanceM: 4828.03,
      durationS: 720,
    });
  });

  it("makes W a warm-up, keeps D and F as working sets, and drops Rest Timer rows", () => {
    const { rows } = ok(parseStrong(STRONG_IOS));
    expect(rows).toHaveLength(12);
    const bench = byExercise(rows, "Bench Press (Barbell)");
    expect(bench.map((r) => [r.warmup, r.weight, r.reps])).toEqual([
      [true, 95, 8],
      [false, 185, 5],
      [false, 185, 5],
    ]);
    expect(byExercise(rows, "Incline Bench Press (Dumbbell)").map((r) => r.warmup)).toEqual([false, false]);
    expect(byExercise(rows, "Squat (Barbell)").map((r) => r.warmup)).toEqual([false, false]);
    expect(ok(parseStrong(STRONG_CURRENT)).rows[0].warmup).toBe(true);
  });

  it("groups by Date and Workout Name, with local wall times", () => {
    const { rows } = ok(parseStrong(STRONG_IOS));
    expect(new Set(rows.map((r) => r.sessionKey)).size).toBe(3);
    expect(rows[0]).toMatchObject({
      startedAt: local(2025, 3, 4, 18, 30, 12),
      workoutName: "Push Day",
      workoutNote: "Felt good, slept well",
      note: null,
    });
    expect(bench(rows)[2].note).toBe("Paused reps");
  });

  it("reads durations, and falls back on 264h 1m and on zero", () => {
    const ios = ok(parseStrong(STRONG_IOS)).rows;
    expect(ios[0].finishedAt).toBe(local(2025, 3, 4, 19, 35, 12)); // 1h 5m
    expect(byExercise(ios, "Squat (Barbell)")[0].finishedAt).toBe(local(2025, 3, 6, 7, 40, 44)); // 38min
    expect(byExercise(ios, "Deadlift (Barbell)")[0].finishedAt).toBeNull(); // 264h 1m
    expect(ok(parseStrong(STRONG_ANDROID)).rows[0].finishedAt).toBe(local(2024, 2, 16, 18, 38, 8)); // 58m
    const current = ok(parseStrong(STRONG_CURRENT)).rows;
    expect(current[0].finishedAt).toBe(local(2025, 4, 29, 13, 0, 0)); // 3600 s
    expect(current[current.length - 1].finishedAt).toBeNull(); // 0 s

    expect(strongDurationToSeconds("1h 5m")).toBe(3900);
    expect(strongDurationToSeconds("38min")).toBe(2280);
    expect(strongDurationToSeconds("55m")).toBe(3300);
    expect(strongDurationToSeconds("2h")).toBe(7200);
    expect(strongDurationToSeconds("")).toBeNull();
    expect(strongDurationToSeconds("soon")).toBeNull();
  });

  it("keeps a hold's seconds, and iOS distance as km flagged unknown", () => {
    const { rows } = ok(parseStrong(STRONG_IOS));
    expect(byExercise(rows, "Plank")[0]).toMatchObject({ weight: 0, reps: 0, durationS: 60 });
    expect(byExercise(rows, "Running (Treadmill)")[0]).toMatchObject({
      distanceM: 1500,
      distanceUnknown: true,
      durationS: 900,
    });
    expect(byExercise(rows, "Bench Press (Barbell)")[0].distanceM).toBe(0);
  });

  it("reads Distance (meters) as meters", () => {
    const { rows } = ok(parseStrong(STRONG_CURRENT));
    const row = byExercise(rows, "Rowing Machine")[0];
    expect(row).toMatchObject({ distanceM: 2000, durationS: 480, weight: null, reps: null });
    expect(row.distanceUnknown).toBeUndefined();
  });

  it("rounds reps like 10.0", () => {
    const text = "Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps\n2025-01-01 10:00:00,A,1h,Squat,1,100,10.0\n";
    expect(ok(parseStrong(text)).rows[0].reps).toBe(10);
  });

  it("refuses a header without Date, Exercise Name and Set Order, and a file with no sets", () => {
    expect(parseStrong("title,start_time\n")).toEqual({ ok: false, reason: "header" });
    expect(parseStrong(FITBOD_SMALL)).toEqual({ ok: false, reason: "header" });
    expect(parseStrong(STRONG_IOS.split("\n")[0])).toEqual({ ok: false, reason: "empty" });
    expect(parseStrong("")).toEqual({ ok: false, reason: "empty" });
  });

  it("reads Weight (lbs) as lb", () => {
    const text = STRONG_CURRENT.replace('"Weight (kg)"', '"Weight (lbs)"');
    expect(ok(parseStrong(text)).rows[0]).toMatchObject({ weight: 40, unit: "lb" });
  });

  it("reads dates as local wall time only", () => {
    expect(strongDateToIso("2025-03-04 18:30:12")).toBe(local(2025, 3, 4, 18, 30, 12));
    expect(strongDateToIso("2025-02-30 10:00:00")).toBeNull();
    expect(strongDateToIso("04/03/2025")).toBeNull();
  });
});

function bench(rows: ImportRow[]) {
  return byExercise(rows, "Bench Press (Barbell)");
}

describe("parseHevy", () => {
  it("parses both files, with the unit from the header", () => {
    const kg = ok(parseHevy(HEVY_KG));
    expect(kg).toMatchObject({ variant: "hevy", unitKnown: true });
    expect(kg.rows).toHaveLength(10);
    expect(kg.rows.every((r) => r.unit === "kg")).toBe(true);
    const lbs = ok(parseHevy(HEVY_LBS));
    expect(lbs.rows.every((r) => r.unit === "lb")).toBe(true);
    expect(lbs.rows[1]).toMatchObject({ weight: 230, reps: 6 });
  });

  it("reads both date formats, PM included, and the real finish", () => {
    const kg = ok(parseHevy(HEVY_KG)).rows;
    expect(kg[0]).toMatchObject({ startedAt: local(2025, 10, 14, 18, 5), finishedAt: local(2025, 10, 14, 19, 20) });
    const lbs = ok(parseHevy(HEVY_LBS)).rows;
    expect(lbs[0]).toMatchObject({ startedAt: local(2025, 6, 8, 20, 13), finishedAt: local(2025, 6, 8, 21, 22) });
    expect(lbs[4].startedAt).toBe(local(2025, 6, 10, 6, 2));

    expect(hevyDateToIso("Jun 8, 2025, 12:05 AM")).toBe(local(2025, 6, 8, 0, 5));
    expect(hevyDateToIso("Jun 8, 2025, 12:05 PM")).toBe(local(2025, 6, 8, 12, 5));
    expect(hevyDateToIso("2025-06-08T12:05:00Z")).toBeNull();
  });

  it("refuses a file whose dates parse in neither format", () => {
    const text = HEVY_KG.replace(/14 Oct 2025, 18:05/g, "2025-10-14T18:05").replace(/16 Oct 2025, 07:30/g, "yesterday");
    expect(parseHevy(text)).toEqual({ ok: false, reason: "empty" });
  });

  it("estimates when the end is missing, before the start or over 6 hours", () => {
    const missing = HEVY_KG.replace(/"16 Oct 2025, 08:10"/, '""');
    expect(ok(parseHevy(missing)).rows[9].finishedAt).toBeNull();
    const early = HEVY_KG.replace(/"16 Oct 2025, 08:10"/, '"16 Oct 2025, 07:00"');
    expect(ok(parseHevy(early)).rows[9].finishedAt).toBeNull();
    const long = HEVY_KG.replace(/"16 Oct 2025, 08:10"/, '"16 Oct 2025, 14:00"');
    expect(ok(parseHevy(long)).rows[9].finishedAt).toBeNull();
  });

  it("keeps the doubled quotes in the description as the workout note", () => {
    const { rows } = ok(parseHevy(HEVY_KG));
    expect(rows[0].workoutNote).toBe('Felt strong, "easy" day');
    expect(rows[0].workoutName).toBe("Push day");
    expect(rows[9].workoutNote).toBeNull();
  });

  it("puts exercise_notes on the exercise's first set only", () => {
    const { rows } = ok(parseHevy(HEVY_KG));
    expect(bench(rows).map((r) => r.note)).toEqual(["Pause on chest", null, null]);
  });

  it("marks warm-ups only, and leaves an empty weight null", () => {
    const { rows } = ok(parseHevy(HEVY_KG));
    expect(bench(rows).map((r) => r.warmup)).toEqual([true, false, false]);
    expect(byExercise(rows, "Incline Bench Press (Dumbbell)").map((r) => r.warmup)).toEqual([false, false]);
    expect(byExercise(rows, "Pull Up")[0]).toMatchObject({ weight: null, reps: 10 });
    expect(byExercise(rows, "Pull Up (Weighted)")[0]).toMatchObject({ weight: 10, reps: 6 });
  });

  it("converts distance_km and distance_miles to meters", () => {
    expect(byExercise(ok(parseHevy(HEVY_KG)).rows, "Running")[0]).toMatchObject({ distanceM: 5200, durationS: 1680 });
    expect(byExercise(ok(parseHevy(HEVY_LBS)).rows, "Treadmill")[0]).toMatchObject({ distanceM: 2414.02, durationS: 1200 });
  });

  it("refuses another app's header", () => {
    expect(parseHevy(STRONG_IOS)).toEqual({ ok: false, reason: "header" });
    expect(parseHevy("")).toEqual({ ok: false, reason: "empty" });
  });
});

describe("detectSource", () => {
  it("names all five files and the Fitbod fixture", () => {
    expect(detectSource(FITBOD_SMALL)).toBe("fitbod");
    expect(detectSource(`﻿${FITBOD_SMALL}`)).toBe("fitbod");
    expect(detectSource(STRONG_IOS)).toBe("strong");
    expect(detectSource(STRONG_ANDROID)).toBe("strong");
    expect(detectSource(STRONG_CURRENT)).toBe("strong");
    expect(detectSource(HEVY_KG)).toBe("hevy");
    expect(detectSource(HEVY_LBS)).toBe("hevy");
  });

  it("names nothing for another file", () => {
    expect(detectSource("name,email\nA,a@example.com\n")).toBeNull();
    expect(detectSource("")).toBeNull();
  });

  it("parses with the detected source's parser", () => {
    expect(parseImportFile(HEVY_KG)).toMatchObject({ source: "hevy", unitKnown: true });
    expect(parseImportFile(STRONG_IOS)).toMatchObject({ source: "strong", variant: "ios", unitKnown: false });
    expect(parseImportFile(FITBOD_SMALL)).toMatchObject({ source: "fitbod", unitKnown: true });
    expect(parseImportFile("name,email\n")).toBeNull();
  });
});
