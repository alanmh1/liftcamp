import { describe, expect, it } from "vitest";

import { computePrSetIds } from "./pr";
import {
  bySetPosition,
  countedSets,
  countedTotals,
  isCountedSet,
  isWarmupSet,
  nextSetPosition,
  restoredSetPosition,
  setBadges,
  workingSetCount,
} from "./working-sets";

const SQUAT = { id: "85495e85-bd72-445d-a6c8-5961f17ec2e5", equipment: "barbell", weight_type: "standard", is_unilateral: false };

const set = (weight_value: number, reps: number, set_type: string | null = null, completed = true) => ({
  weight: "",
  weight_value,
  reps,
  completed,
  set_type,
});

// Two warm-ups ahead of three working sets, as Pro generates them.
const SESSION = [set(45, 10, "warmup"), set(95, 5, "warmup"), set(135, 5), set(135, 5), set(135, 5, null, false)];

describe("isWarmupSet", () => {
  it("is true only for set_type warmup", () => {
    expect(isWarmupSet({ set_type: "warmup" })).toBe(true);
    expect(isWarmupSet({ set_type: null })).toBe(false);
    expect(isWarmupSet({ set_type: "normal" })).toBe(false);
    expect(isWarmupSet({})).toBe(false);
  });
});

describe("countedSets", () => {
  it("keeps completed working sets and drops warm-ups and unticked rows", () => {
    expect(countedSets(SESSION)).toEqual([SESSION[2], SESSION[3]]);
    expect(isCountedSet(SESSION[0])).toBe(false);
    expect(isCountedSet(SESSION[4])).toBe(false);
  });

  it("treats a null list as empty", () => {
    expect(countedSets(null)).toEqual([]);
  });
});

describe("countedTotals", () => {
  it("counts volume and sets over working sets only: 2 x 135 x 5 is 1,350", () => {
    expect(countedTotals([{ exercise: SQUAT, sets: SESSION }], null)).toEqual({ volume: 1350, sets: 2 });
  });

  it("is zero for a workout of warm-ups only", () => {
    expect(countedTotals([{ exercise: SQUAT, sets: [set(45, 10, "warmup")] }], null)).toEqual({ volume: 0, sets: 0 });
  });
});

describe("workingSetCount", () => {
  it("counts every row that is not a warm-up, done or not", () => {
    expect(workingSetCount(SESSION)).toBe(3);
    expect(workingSetCount(undefined)).toBe(0);
  });
});

describe("bySetPosition", () => {
  it("orders by position, then by when a row was added", () => {
    const rows = [
      { id: "c", position: 2, created_at: "2026-11-01T18:00:00Z" },
      { id: "b", position: 1, created_at: "2026-11-01T18:15:00Z" },
      { id: "a", position: 1, created_at: "2026-11-01T18:05:00Z" },
    ];
    expect([...rows].sort(bySetPosition).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});

describe("nextSetPosition", () => {
  const rows = (...positions: number[]) => positions.map((position) => ({ position }));

  it("is 0 on an empty card", () => {
    expect(nextSetPosition([])).toBe(0);
  });

  it("is the count on a card with no gaps", () => {
    expect(nextSetPosition(rows(0, 1, 2))).toBe(3);
  });

  it("clears the highest position after a delete", () => {
    // 0, 1, 2 lost row 0: the row count of 2 would repeat the last row.
    expect(nextSetPosition(rows(1, 2))).toBe(3);
  });

  it("clears duplicates already saved", () => {
    expect(nextSetPosition(rows(1, 1, 2))).toBe(3);
  });
});

describe("restoredSetPosition", () => {
  const rows = (...positions: number[]) => positions.map((position) => ({ position }));

  it("keeps a position nothing has taken", () => {
    expect(restoredSetPosition(rows(0, 2), 1)).toBe(1);
  });

  it("goes to the end when a set added since took it", () => {
    // 0, 1, 2 lost row 2, Add set took 2, then undo.
    expect(restoredSetPosition(rows(0, 1, 2), 2)).toBe(3);
  });
});

describe("setBadges", () => {
  it("shows W for warm-ups and numbers working sets from 1 after them", () => {
    expect(setBadges(SESSION)).toEqual(["W", "W", "1", "2", "3"]);
  });

  it("numbers untyped sets 1, 2, 3", () => {
    expect(setBadges([{}, { set_type: null }, { set_type: "normal" }])).toEqual(["1", "2", "3"]);
  });
});

describe("computePrSetIds", () => {
  const withId = (id: string, weight_value: number, reps: number, set_type: string | null = null) => ({
    id,
    weight: "",
    weight_value,
    reps,
    set_type,
  });

  it("never marks a warm-up and never lets one raise the bar", () => {
    // The warm-up's 1RM is higher than the working set's, and comes first.
    const prs = computePrSetIds([withId("w", 200, 8, "warmup"), withId("a", 180, 5)], SQUAT, null);
    expect([...prs]).toEqual(["a"]);
  });
});
