import { describe, expect, it } from "vitest";

import {
  rankSimilarRoutines,
  similarRoutineInbound,
  similarRoutinePicks,
  type SimilarRoutineInput,
} from "./similar-routines";

const r = (
  slug: string,
  order: number,
  daysPerWeek: number,
  equipment: string,
): SimilarRoutineInput => ({
  slug,
  order,
  daysPerWeek,
  equipment: [equipment],
});

// The system routines as of 1 Nov 2026: slug, program_order, days a week,
// templates.equipment.
const CATALOG: SimilarRoutineInput[] = [
  r("full-body-3-day", 1, 3, "Gym"),
  r("upper-lower-split", 2, 4, "Gym"),
  r("push-pull-legs", 3, 3, "Gym"),
  r("5x5-strength", 4, 3, "Gym"),
  r("bro-split", 5, 5, "Gym"),
  r("push-pull-legs-6-day", 6, 6, "Gym"),
  r("machines-only-workout", 7, 3, "Gym"),
  r("dumbbell-only-workout", 8, 3, "Dumbbells"),
  r("bodyweight-workout-plan", 9, 3, "Bodyweight"),
  r("glute-workout-plan", 10, 3, "Gym"),
  r("upper-lower-beginner", 11, 4, "Gym"),
  r("push-pull-legs-beginner", 12, 3, "Gym"),
  r("dumbbell-upper-lower", 13, 4, "Dumbbells"),
  r("dumbbell-push-pull-legs", 14, 3, "Dumbbells"),
  r("phul", 15, 4, "Gym"),
  r("full-body-with-bands", 16, 3, "Bands"),
  r("upper-lower-push-pull-legs", 17, 5, "Gym"),
  r("torso-limbs", 18, 4, "Gym"),
  r("volume-light-heavy", 19, 3, "Gym"),
  r("tiered-strength", 20, 4, "Gym"),
  r("dumbbell-full-body", 21, 3, "Dumbbells"),
  r("calisthenics-full-body", 22, 3, "Bodyweight"),
  r("bands-upper-lower", 23, 4, "Bands"),
  r("dumbbell-push-pull-legs-6-day", 24, 6, "Dumbbells"),
  r("two-day-full-body", 25, 2, "Gym"),
  r("two-day-dumbbell-full-body", 26, 2, "Dumbbells"),
  r("two-day-bodyweight-full-body", 27, 2, "Bodyweight"),
  r("bodyweight-upper-lower", 28, 4, "Bodyweight"),
  r("bodyweight-push-pull-legs", 29, 3, "Bodyweight"),
  r("travel-bodyweight-full-body", 30, 3, "Bodyweight"),
  r("arnold-split", 40, 6, "Gym"),
];

describe("rankSimilarRoutines", () => {
  it("excludes the current routine", () => {
    const current = CATALOG[0]!;
    expect(
      rankSimilarRoutines(current, CATALOG).map((x) => x.slug),
    ).not.toContain(current.slug);
  });

  it("puts the same days per week first", () => {
    const current = r("x", 5, 4, "Gym");
    const all = [
      current,
      r("three", 5, 3, "Gym"),
      r("four", 50, 4, "Dumbbells"),
    ];
    expect(rankSimilarRoutines(current, all).map((x) => x.slug)).toEqual([
      "four",
      "three",
    ]);
  });

  it("then prefers shared equipment", () => {
    const current = r("x", 5, 3, "Gym");
    const all = [current, r("db", 6, 3, "Dumbbells"), r("gym", 30, 3, "Gym")];
    expect(rankSimilarRoutines(current, all).map((x) => x.slug)).toEqual([
      "gym",
      "db",
    ]);
  });

  it("counts every shared equipment label", () => {
    const current = {
      slug: "x",
      order: 5,
      daysPerWeek: 3,
      equipment: ["Barbell", "Cable"],
    };
    const all = [
      current,
      { slug: "one", order: 6, daysPerWeek: 3, equipment: ["Barbell"] },
      {
        slug: "two",
        order: 20,
        daysPerWeek: 3,
        equipment: ["Barbell", "Cable"],
      },
    ];
    expect(rankSimilarRoutines(current, all).map((x) => x.slug)).toEqual([
      "two",
      "one",
    ]);
  });

  it("then takes the nearest program_order, the lower one on a tie", () => {
    const current = r("x", 10, 3, "Gym");
    const all = [
      current,
      r("far", 20, 3, "Gym"),
      r("above", 11, 3, "Gym"),
      r("below", 9, 3, "Gym"),
    ];
    expect(rankSimilarRoutines(current, all).map((x) => x.slug)).toEqual([
      "below",
      "above",
      "far",
    ]);
  });

  it("does not depend on input order", () => {
    const current = CATALOG[5]!;
    const forward = rankSimilarRoutines(current, CATALOG).map((x) => x.slug);
    const backward = rankSimilarRoutines(current, [...CATALOG].reverse()).map(
      (x) => x.slug,
    );
    expect(backward).toEqual(forward);
  });
});

describe("similarRoutinePicks", () => {
  const picks = similarRoutinePicks(CATALOG);

  it("gives every routine three picks, none of them itself, no repeats", () => {
    for (const routine of CATALOG) {
      const list = picks.get(routine.slug)!;
      expect(list).toHaveLength(3);
      expect(list).not.toContain(routine.slug);
      expect(new Set(list).size).toBe(3);
    }
  });

  it("links every routine from at least one other routine page", () => {
    const inbound = similarRoutineInbound(picks);
    for (const routine of CATALOG)
      expect(inbound.get(routine.slug)).toBeGreaterThan(0);
  });

  it("keeps the plain ranking where no repair is needed", () => {
    expect(picks.get("arnold-split")).toEqual([
      "push-pull-legs-6-day",
      "dumbbell-push-pull-legs-6-day",
      "two-day-full-body",
    ]);
    expect(picks.get("push-pull-legs")).toEqual([
      "5x5-strength",
      "full-body-3-day",
      "machines-only-workout",
    ]);
  });

  it("repairs the two routines the plain ranking leaves unlinked", () => {
    const linkedFrom = (slug: string) =>
      [...picks]
        .filter(([, list]) => list.includes(slug))
        .map(([host]) => host);
    expect(linkedFrom("dumbbell-upper-lower").length).toBeGreaterThan(0);
    expect(linkedFrom("full-body-with-bands").length).toBeGreaterThan(0);
  });

  it("is the same whatever order the catalog arrives in", () => {
    const reversed = similarRoutinePicks([...CATALOG].reverse());
    for (const routine of CATALOG) {
      expect(reversed.get(routine.slug)).toEqual(picks.get(routine.slug));
    }
  });

  it("handles a catalog smaller than the count", () => {
    const small = similarRoutinePicks([
      r("a", 1, 3, "Gym"),
      r("b", 2, 3, "Gym"),
    ]);
    expect(small.get("a")).toEqual(["b"]);
    expect(small.get("b")).toEqual(["a"]);
  });
});
