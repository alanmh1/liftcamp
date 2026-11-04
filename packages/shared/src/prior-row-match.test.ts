import { describe, expect, it } from "vitest";

import { computePrSetIds, setsInLoggedOrder } from "./pr";
import { priorForRow, priorSetForRow } from "./prior-session";
import { formatLastLine } from "./set-focus";
import { setPlaceholder, type PlaceholderSource } from "./set-placeholder";
import { setBadges, WARMUP_SET_TYPE, WORKING_SET_TYPE } from "./working-sets";

const WARM = { set_type: WARMUP_SET_TYPE };
const WORK = { set_type: null };

const prior = (weight_value: number, reps: number, set_type: string | null = null) => ({
  weight_value,
  reps,
  set_type,
});

describe("priorSetForRow", () => {
  it("gives a warm-up row nothing when the last session had no warm-up", () => {
    // The report: W, then 1, against last session's 77.3 x 13 and 59.1 x 22.
    const last = [prior(77.3, 13), prior(59.1, 22)];
    const rows = [WARM, WORK, WORK];
    expect(priorSetForRow(last, rows, 0)).toBeNull();
    expect(priorSetForRow(last, rows, 1)).toEqual(last[0]);
    expect(priorSetForRow(last, rows, 2)).toEqual(last[1]);
  });

  it("gives a warm-up row the last session's warm-up", () => {
    const last = [prior(40, 8, "warmup"), prior(80, 8), prior(85, 6)];
    const rows = [WARM, WORK, WORK];
    expect(priorSetForRow(last, rows, 0)).toEqual(last[0]);
    expect(priorSetForRow(last, rows, 1)).toEqual(last[1]);
    expect(priorSetForRow(last, rows, 2)).toEqual(last[2]);
  });

  it("ignores a warm-up the last session had when this one has none", () => {
    const last = [prior(40, 8, "warmup"), prior(80, 8), prior(85, 6)];
    const rows = [WORK, WORK];
    expect(priorSetForRow(last, rows, 0)).toEqual(last[1]);
    expect(priorSetForRow(last, rows, 1)).toEqual(last[2]);
  });

  it("matches warm-ups to warm-ups in order and repeats the last past the end", () => {
    const last = [prior(20, 8, "warmup"), prior(40, 5, "warmup"), prior(80, 8)];
    const rows = [WARM, WARM, WARM, WORK];
    expect(priorSetForRow(last, rows, 0)).toEqual(last[0]);
    expect(priorSetForRow(last, rows, 1)).toEqual(last[1]);
    expect(priorSetForRow(last, rows, 2)).toEqual(last[1]);
    expect(priorSetForRow(last, rows, 3)).toEqual(last[2]);
  });

  it("repeats the last working set past the end of the working sets", () => {
    const last = [prior(40, 8, "warmup"), prior(80, 8)];
    const rows = [WARM, WORK, WORK, WORK];
    expect(priorSetForRow(last, rows, 3)).toEqual(last[1]);
  });

  it("gives a working row nothing when the last session logged only warm-ups", () => {
    expect(priorSetForRow([prior(40, 8, "warmup")], [WORK], 0)).toBeNull();
  });

  it("gives nothing with no last session", () => {
    expect(priorSetForRow([], [WARM, WORK], 0)).toBeNull();
    expect(priorSetForRow([], [WARM, WORK], 1)).toBeNull();
  });

  it("treats untyped and normal alike, and a row marked mid-list keeps the rest in step", () => {
    const last = [prior(80, 8), prior(85, 6, "normal"), prior(90, 4)];
    const rows = [WORK, WARM, { set_type: WORKING_SET_TYPE }, WORK];
    expect(setBadges(rows)).toEqual(["1", "W", "2", "3"]);
    expect(priorSetForRow(last, rows, 0)).toEqual(last[0]);
    expect(priorSetForRow(last, rows, 1)).toBeNull();
    expect(priorSetForRow(last, rows, 2)).toEqual(last[1]);
    expect(priorSetForRow(last, rows, 3)).toEqual(last[2]);
  });

  it("moves with a row switched to a working set", () => {
    const last = [prior(77.3, 13), prior(59.1, 22)];
    const rows = [{ set_type: WORKING_SET_TYPE }, WORK];
    expect(setBadges(rows)).toEqual(["1", "2"]);
    expect(priorSetForRow(last, rows, 0)).toEqual(last[0]);
    expect(priorSetForRow(last, rows, 1)).toEqual(last[1]);
  });
});

describe("priorForRow", () => {
  it("feeds the Live Activity's last line the matched set", () => {
    const last = [prior(77.3, 13), prior(59.1, 22)];
    const exercise = { weight_type: "standard", equipment: "cable" };
    const rows = [WARM, WORK];
    const warm = priorForRow(last, rows, 0);
    expect(formatLastLine(warm.sets, warm.index, "kg", exercise)).toBeNull();
    const first = priorForRow(last, rows, 1);
    expect(formatLastLine(first.sets, first.index, "kg", exercise)).toBe("Last time 77.3 kg × 13");
  });
});

describe("setPlaceholder with warm-up rows", () => {
  const blank = (set_type: string | null = null): PlaceholderSource => ({ weight_value: null, reps: null, set_type });

  it("never fills a warm-up row from a working set of the last session", () => {
    const input = { sets: [blank("warmup"), blank()], prior: [prior(77.3, 13), prior(59.1, 22)] };
    expect(setPlaceholder(input, 0).weight).toBeNull();
    expect(setPlaceholder(input, 1).weight?.value).toBe(77.3);
    expect(setPlaceholder(input, 1).reps).toBe(13);
  });

  it("fills a warm-up row from the last session's warm-up", () => {
    const input = { sets: [blank("warmup"), blank()], prior: [prior(40, 8, "warmup"), prior(80, 8)] };
    expect(setPlaceholder(input, 0).weight?.value).toBe(40);
    expect(setPlaceholder(input, 1).weight?.value).toBe(80);
  });

  it("does not carry a logged warm-up down to a working row, with no suggestion", () => {
    const input = {
      sets: [{ weight_value: 40, reps: 8, set_type: "warmup" }, blank()],
      prior: [prior(80, 8)],
    };
    expect(setPlaceholder(input, 1).weight?.value).toBe(80);
    expect(setPlaceholder(input, 1).reps).toBe(8);
  });

  it("does not carry a logged working set down to a warm-up row below it", () => {
    const input = { sets: [{ weight_value: 80, reps: 8 }, blank("warmup")], prior: [] };
    expect(setPlaceholder(input, 1).weight).toBeNull();
  });

  it("still carries a working set down to the working row below", () => {
    const input = { sets: [blank("warmup"), { weight_value: 80, reps: 8 }, blank()], prior: [] };
    expect(setPlaceholder(input, 2).weight?.value).toBe(80);
  });
});

describe("setsInLoggedOrder", () => {
  const row = (id: string, position: number, created_at: string, weight_value: number, reps: number) => ({
    id,
    position,
    created_at,
    weight: "",
    weight_value,
    reps,
  });

  it("walks a switched warm-up row first, as the workout screen does", () => {
    // The warm-up row was inserted 2 s after the row below it.
    const sets = [row("below", 1, "2026-11-04T09:28:38Z", 100, 8), row("switched", 0, "2026-11-04T09:28:40Z", 90, 8)];
    expect([...computePrSetIds(setsInLoggedOrder(sets))]).toEqual(["switched", "below"]);
  });

  it("keeps every set and leaves one workout's sets ahead of the next", () => {
    const earlier = setsInLoggedOrder([row("a", 0, "2026-10-28T09:00:00Z", 100, 5)]);
    const later = setsInLoggedOrder([row("b", 1, "2026-11-04T09:00:00Z", 90, 5), row("c", 0, "2026-11-04T09:00:02Z", 95, 5)]);
    expect(later.map((s) => s.id)).toEqual(["c", "b"]);
    expect([...computePrSetIds([...later, ...earlier])]).toEqual(["a"]);
  });

  it("copes with no timestamps", () => {
    expect(setsInLoggedOrder([{ position: 0 }])).toEqual([{ position: 0, created_at: null }]);
  });
});
