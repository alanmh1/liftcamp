import { describe, expect, it } from "vitest";

import {
  ageFactor,
  ageFromBirthday,
  hasStrengthLevel,
  roundLoadNearest,
  roundLoadUp,
  STRENGTH_EXERCISES,
  STRENGTH_STANDARDS,
  strengthBarPosition,
  strengthLevel,
  strengthThresholds,
} from "./strength-standards";

const SQUAT = "85495e85-bd72-445d-a6c8-5961f17ec2e5";
const DB_BENCH = "05510482-9385-455f-85b4-96aef279939c";
const DB_SHOULDER = "6db0743b-b1be-4071-b663-af358c7f47bb";
const LEG_PRESS = "00000000-0000-0000-0000-000000000000";

describe("strengthThresholds", () => {
  it("gives an 80 kg male the table multiples of 80", () => {
    const t = strengthThresholds(SQUAT, "male", 80, 30)!;
    expect(t[0]).toBeCloseTo(80);
    expect(t[1]).toBeCloseTo(120);
    expect(t[2]).toBeCloseTo(160);
    expect(t[3]).toBeCloseTo(200);
  });

  it("scales by bodyweight: a 60 kg lifter's thresholds are lower in kg and higher as a multiple", () => {
    const at80 = strengthThresholds(SQUAT, "male", 80, 30)!;
    const at60 = strengthThresholds(SQUAT, "male", 60, 30)!;
    for (let i = 0; i < 4; i++) {
      expect(at60[i]).toBeLessThan(at80[i]);
      expect(at60[i] / 60).toBeGreaterThan(at80[i] / 80);
    }
  });

  it("lowers every threshold by 13% at age 55", () => {
    const young = strengthThresholds(SQUAT, "male", 80, 30)!;
    const older = strengthThresholds(SQUAT, "male", 80, 55)!;
    for (let i = 0; i < 4; i++) expect(older[i]).toBeCloseTo(young[i] * 0.87);
  });

  it("treats no birth year as age factor 1", () => {
    expect(strengthThresholds(SQUAT, "female", 65, null)).toEqual(strengthThresholds(SQUAT, "female", 65, 30));
  });

  it("returns null for unsupported ids and for sex that is not male or female", () => {
    expect(strengthThresholds(LEG_PRESS, "male", 80, 30)).toBeNull();
    expect(strengthThresholds(SQUAT, "other", 80, 30)).toBeNull();
    expect(strengthThresholds(SQUAT, null, 80, 30)).toBeNull();
  });

  it("keeps the dumbbell presses in the table but off", () => {
    expect(STRENGTH_STANDARDS[DB_BENCH]).toBeDefined();
    expect(STRENGTH_STANDARDS[DB_SHOULDER]).toBeDefined();
    expect(hasStrengthLevel(DB_BENCH)).toBe(false);
    expect(hasStrengthLevel(DB_SHOULDER)).toBe(false);
    expect(strengthThresholds(DB_BENCH, "male", 80, 30)).toBeNull();
    expect(STRENGTH_EXERCISES).toHaveLength(7);
  });
});

describe("strengthLevel", () => {
  it("puts an 80 kg male with a 120 kg squat at Intermediate, 40 kg from Advanced", () => {
    const t = strengthThresholds(SQUAT, "male", 80, 30)!;
    const l = strengthLevel(120, t);
    expect(l.level).toBe("Intermediate");
    expect(l.index).toBe(2);
    expect(l.next).toBe("Advanced");
    expect(l.toNext).toBeCloseTo(40);
  });

  it("is Beginner below Novice and Elite with no next at the top", () => {
    const t = strengthThresholds(SQUAT, "male", 80, 30)!;
    expect(strengthLevel(50, t)).toMatchObject({ level: "Beginner", index: 0, next: "Novice" });
    expect(strengthLevel(250, t)).toEqual({ level: "Elite", index: 4, next: null, toNext: null });
  });
});

describe("strengthBarPosition", () => {
  const t = [80, 120, 160, 200] as const;

  it("runs Beginner from 0 to Novice", () => {
    expect(strengthBarPosition(0, t)).toBe(0);
    expect(strengthBarPosition(40, t)).toBeCloseTo(0.1);
  });

  it("sits proportionally inside a segment", () => {
    expect(strengthBarPosition(140, t)).toBeCloseTo(0.5);
  });

  it("fills the Elite segment once reached", () => {
    expect(strengthBarPosition(200, t)).toBe(1);
    expect(strengthBarPosition(300, t)).toBe(1);
  });
});

describe("rounding and age", () => {
  it("rounds thresholds to the nearest 5 lbs or 2.5 kg and gaps up", () => {
    expect(roundLoadNearest(176.4, "lb")).toBe(175);
    expect(roundLoadNearest(101.3, "kg")).toBe(102.5);
    expect(roundLoadUp(21, "lb")).toBe(25);
    expect(roundLoadUp(25, "lb")).toBe(25);
    expect(roundLoadUp(0.4, "kg")).toBe(2.5);
  });

  it("maps ages to factors", () => {
    expect(ageFactor(15)).toBe(0.85);
    expect(ageFactor(45)).toBe(0.95);
    expect(ageFactor(65)).toBe(0.78);
    expect(ageFactor(80)).toBe(0.7);
  });

  it("counts whole years from a birthday", () => {
    const now = new Date(2026, 8, 24); // 24 Sep 2026, local time
    expect(ageFromBirthday("1983-11-10", now)).toBe(42);
    expect(ageFromBirthday("1983-09-24", now)).toBe(43);
    expect(ageFromBirthday("1983-09-25", now)).toBe(42);
    expect(ageFromBirthday(null, now)).toBeNull();
    expect(ageFromBirthday("not a date", now)).toBeNull();
  });
});
