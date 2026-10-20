import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  CHAIR_EXERCISES,
  constraintOf,
  DIP_STATION_EXERCISES,
  FALLBACK_IMAGE,
  mostConstrainedFirst,
  pickRoutineImages,
  PULL_UP_BAR_EXERCISES,
  ROUTINE_ART_OVERRIDES,
  ROUTINE_IMAGE_KEYS,
  ROUTINE_IMAGES,
  routineArtByProgram,
  type RoutineForArt,
} from "./routine-art";
import type { TemplateRow } from "./templates";

const ex = (equipment: string | null, primary_muscle: string | null, exercise_id?: string) => ({
  equipment,
  primary_muscle,
  exercise_id,
});

const legDay = (id: string): RoutineForArt => ({
  id,
  exercises: [ex("barbell", "quads"), ex("machine", "hamstrings"), ex("machine", "quads"), ex("machine", "calves")],
});
const pushDay: RoutineForArt = {
  id: "push",
  exercises: [ex("barbell", "chest"), ex("dumbbell", "shoulders"), ex("cable", "triceps"), ex("dumbbell", "chest")],
};
const bodyweight: RoutineForArt = {
  id: "bw",
  exercises: [ex("body only", "chest"), ex("body only", "quads"), ex("body only", "abs")],
};
const bands: RoutineForArt = {
  id: "bands",
  exercises: [ex("bands", "chest"), ex("bands", "lats"), ex("bands", "glutes")],
};

describe("pickRoutineImages", () => {
  it("gives a leg day a leg machine", () => {
    expect(pickRoutineImages([legDay("legs")]).get("legs")).toBe("leg-press");
  });

  it("gives a push day the bench", () => {
    // barbell and dumbbell cover 3 of 4, push covers 4 of 4.
    expect(pickRoutineImages([pushDay]).get("push")).toBe("adjustable-bench");
  });

  it("gives a second leg day a different leg image", () => {
    const art = pickRoutineImages([legDay("a"), legDay("b")]);
    expect(art.get("a")).toBe("leg-press");
    expect(art.get("b")).toBe("leg-curl");
    expect(art.get("a")).not.toBe(art.get("b"));
  });

  it("gives a bodyweight routine the mat", () => {
    expect(pickRoutineImages([bodyweight]).get("bw")).toBe("bodyweight-mat");
  });

  it("gives a bands routine the bands", () => {
    expect(pickRoutineImages([bands]).get("bands")).toBe("resistance-bands");
  });

  it("falls back to dumbbells for an empty routine, without reserving it", () => {
    const art = pickRoutineImages([
      { id: "empty", exercises: [] },
      { id: "db", exercises: [ex("dumbbell", "chest"), ex("dumbbell", "biceps")] },
    ]);
    expect(art.get("empty")).toBe(FALLBACK_IMAGE);
    expect(art.get("db")).toBe("adjustable-bench");
  });

  it("never changes an earlier routine's image when one is appended", () => {
    const before = pickRoutineImages([legDay("a"), pushDay]);
    const after = pickRoutineImages([legDay("a"), pushDay, legDay("c"), bands]);
    for (const [id, key] of before) expect(after.get(id)).toBe(key);
  });

  it("reuses the best image rather than taking a poor unused one", () => {
    // Four leg days: leg-press, leg-curl, then power-rack (barbell legs),
    // then the fourth has only weak unused options and reuses leg-press.
    const art = pickRoutineImages([legDay("a"), legDay("b"), legDay("c"), legDay("d")]);
    expect(art.get("c")).toBe("power-rack");
    expect(art.get("d")).toBe("leg-press");
  });
});

describe("the second barbell and dumbbell images", () => {
  const barbellOnly = (id: string): RoutineForArt => ({
    id,
    exercises: [ex("barbell", "chest"), ex("barbell", "lats"), ex("barbell", "abs")],
  });
  const dumbbellOnly = (id: string): RoutineForArt => ({
    id,
    exercises: [ex("dumbbell", "chest"), ex("dumbbell", "lats"), ex("dumbbell", "abs")],
  });

  it("lists every key in the scoring table exactly once", () => {
    expect(ROUTINE_IMAGES.map((i) => i.key).sort()).toEqual([...ROUTINE_IMAGE_KEYS].sort());
    for (const key of ["dumbbell-rack", "light-dumbbells", "weight-plates", "loaded-barbell"]) {
      expect(ROUTINE_IMAGE_KEYS).toContain(key);
    }
  });

  it("loses the tie to the first image, then takes the next routine", () => {
    // Plain barbell work, no focus: barbell, then the plates, then the loaded bar.
    const bar = pickRoutineImages([barbellOnly("a"), barbellOnly("b"), barbellOnly("c")]);
    expect([bar.get("a"), bar.get("b"), bar.get("c")]).toEqual(["barbell", "weight-plates", "loaded-barbell"]);
    // The three dumbbell images score 0.8 (0.6 plus 0.5 focus); the bench
    // scores 0.73 (push 1 of 3), so it comes fourth.
    const db = pickRoutineImages(["a", "b", "c", "d"].map(dumbbellOnly));
    expect([db.get("a"), db.get("b"), db.get("c"), db.get("d")]).toEqual([
      "dumbbells",
      "dumbbell-rack",
      "light-dumbbells",
      "adjustable-bench",
    ]);
  });

  it("never gives a barbell image to a dumbbell routine or the reverse", () => {
    const art = pickRoutineImages([barbellOnly("bb"), dumbbellOnly("db")]);
    expect(["dumbbell-rack", "light-dumbbells"]).not.toContain(art.get("bb"));
    expect(["weight-plates", "loaded-barbell"]).not.toContain(art.get("db"));
  });
});

describe("mostConstrainedFirst", () => {
  it("orders by constraint, then created_at, then id", () => {
    const a = { ...legDay("a"), createdAt: "2026-01-02", tieId: "a" };
    const b = { ...legDay("b"), createdAt: "2026-01-01", tieId: "b" };
    // Spread across four kinds of equipment, so many images score close to its best.
    const loose = {
      id: "loose",
      createdAt: "2026-01-01",
      tieId: "z",
      exercises: [ex("dumbbell", "chest"), ex("kettlebells", "lats"), ex("barbell", "quads"), ex("cable", "abs")],
    };
    const bandsFirst = { ...bands, createdAt: "2026-01-03", tieId: "c" };
    const order = mostConstrainedFirst([a, loose, bandsFirst, b]).map((r) => r.id);
    expect(order[0]).toBe("bands");
    expect(order.indexOf("b")).toBeLessThan(order.indexOf("a"));
    expect(order[order.length - 1]).toBe("loose");
  });
});

describe("routineArtByProgram", () => {
  const row = (
    id: string,
    program: string,
    created_at: string,
    exercises: ReturnType<typeof ex>[],
    facts: { level?: string; equipment?: string; program_slug?: string } = {},
  ) => ({
    id,
    name: `${program} A`,
    program,
    created_at,
    level: facts.level ?? "beginner",
    equipment: facts.equipment ?? "gym",
    program_slug: facts.program_slug ?? null,
    template_exercises: exercises.map((e, position) => ({
      exercise_id: e.exercise_id ?? `${id}-${position}`,
      position,
      exercises: e,
    })),
  });

  it("never repeats an image inside a level and equipment group while eligible images remain", () => {
    // Five gym intermediate programs; the group has far more than five
    // images scoring within 40% of each routine's best.
    const rows = [
      row("t1", "Legs", "2026-01-01", legDay("x").exercises as ReturnType<typeof ex>[], { level: "intermediate" }),
      row("t2", "Push", "2026-01-02", pushDay.exercises as ReturnType<typeof ex>[], { level: "intermediate" }),
      row("t3", "Legs 2", "2026-01-03", legDay("y").exercises as ReturnType<typeof ex>[], { level: "intermediate" }),
      row("t4", "Push 2", "2026-01-04", pushDay.exercises as ReturnType<typeof ex>[], { level: "intermediate" }),
      row("t5", "Legs 3", "2026-01-05", legDay("z").exercises as ReturnType<typeof ex>[], { level: "intermediate" }),
    ];
    const art = routineArtByProgram(rows);
    expect(new Set(art.values()).size).toBe(5);
  });

  it("lets images repeat across groups", () => {
    const rows = [
      row("t1", "Beginner Legs", "2026-01-01", legDay("x").exercises as ReturnType<typeof ex>[], { level: "beginner" }),
      row("t2", "Advanced Legs", "2026-01-02", legDay("y").exercises as ReturnType<typeof ex>[], { level: "advanced" }),
    ];
    const art = routineArtByProgram(rows);
    expect(art.get("Beginner Legs")).toBe("leg-press");
    expect(art.get("Advanced Legs")).toBe("leg-press");
  });

  it("prefers the pull-up bar when pull-ups, chin-ups and dips are a fifth of the routine", () => {
    const [pullUps, chinUp, dipsChest] = PULL_UP_BAR_EXERCISES as [string, string, string, ...string[]];
    // 3 of 15, exactly 20%: the bar over the mat, even alone in its group.
    const barHeavy = [
      ex("body only", "lats", pullUps),
      ex("body only", "chest", dipsChest),
      ex("body only", "lats", chinUp),
      ...Array.from({ length: 12 }, () => ex("body only", "quads")),
    ];
    const art = routineArtByProgram([row("t1", "Calisthenics", "2026-01-01", barHeavy, { equipment: "bodyweight" })]);
    expect(art.get("Calisthenics")).toBe("pull-up-bar");
  });

  it("keeps the mat when pull-ups, chin-ups and dips are under a fifth", () => {
    const chinUp = PULL_UP_BAR_EXERCISES[1]!;
    // 2 of 18, about 11%: not eligible for the bar even with the mat free.
    const light = [
      ex("body only", "lats", chinUp),
      ex("body only", "triceps", PULL_UP_BAR_EXERCISES[3]!),
      ...Array.from({ length: 16 }, () => ex("body only", "quads")),
    ];
    const rows = [
      row("t1", "Bodyweight Only", "2026-01-01", light, { equipment: "bodyweight" }),
      row("t2", "Second", "2026-01-02", light, { equipment: "bodyweight" }),
    ];
    const art = routineArtByProgram(rows);
    expect(art.get("Bodyweight Only")).toBe("bodyweight-mat");
    expect(art.get("Second")).not.toBe("pull-up-bar");
  });

  it("never gives the pull-up bar to a routine without a pull-up, chin-up or dip", () => {
    const noBar = [ex("body only", "chest"), ex("body only", "quads")];
    const rows = [
      row("t1", "A", "2026-01-01", noBar, { equipment: "bodyweight" }),
      row("t2", "B", "2026-01-02", noBar, { equipment: "bodyweight" }),
      row("t3", "C", "2026-01-03", noBar, { equipment: "bodyweight" }),
    ];
    for (const key of routineArtByProgram(rows).values()) expect(key).not.toBe("pull-up-bar");
  });

  it("walks most constrained first, ties by created_at, whatever order the rows arrive in", () => {
    const rows = [
      row("t1", "Legs", "2026-01-01", legDay("x").exercises as ReturnType<typeof ex>[]),
      row("t2", "Push", "2026-01-02", pushDay.exercises as ReturnType<typeof ex>[]),
      row("t3", "Legs 2", "2026-01-03", legDay("y").exercises as ReturnType<typeof ex>[]),
    ];
    const full = routineArtByProgram(rows);
    // The two leg days tie on constraint, so created_at decides: Legs first.
    expect(full.get("Legs")).toBe("leg-press");
    expect(full.get("Legs 2")).toBe("leg-curl");
    // The app runs this over the full list and looks each card up in the
    // result, so a filtered grid shows the same image; the map itself must
    // not depend on the order the rows were fetched in.
    const reversed = routineArtByProgram([...rows].reverse());
    for (const [program, key] of full) expect(reversed.get(program)).toBe(key);
  });

  it("lets a more constrained routine pick before an earlier, looser one", () => {
    // A bands routine accepts one image; the earlier mixed routine accepts several.
    const mixed = [ex("bands", "chest"), ex("dumbbell", "lats"), ex("cable", "quads"), ex("barbell", "abs")];
    const rows = [
      row("t1", "Mixed", "2026-01-01", mixed),
      row("t2", "Bands", "2026-01-02", bands.exercises as ReturnType<typeof ex>[]),
    ];
    expect(constraintOf({ id: "b", exercises: bands.exercises })).toBeLessThan(constraintOf({ id: "m", exercises: mixed }));
    const art = routineArtByProgram(rows);
    expect(art.get("Bands")).toBe("resistance-bands");
    expect(art.get("Mixed")).not.toBe("resistance-bands");
  });

  it("gives a routine built around dips the dip station at a tenth", () => {
    const [dipsChest, dipsTriceps] = DIP_STATION_EXERCISES as [string, string, ...string[]];
    // 2 of 20 on the dip list, none on the bar list beyond the dips: 10%.
    const dips = [
      ex("body only", "chest", dipsChest),
      ex("body only", "triceps", dipsTriceps),
      ...Array.from({ length: 18 }, () => ex("body only", "quads")),
    ];
    const art = routineArtByProgram([row("t1", "Dips", "2026-01-01", dips, { equipment: "bodyweight" })]);
    expect(art.get("Dips")).toBe("dip-station");
  });

  it("counts Ring Dips toward the dip station though it is equipment other", () => {
    const ringDips = DIP_STATION_EXERCISES[4]!;
    const rows = [ex("other", "triceps", ringDips), ...Array.from({ length: 9 }, () => ex("body only", "quads"))];
    expect(routineArtByProgram([row("t1", "Rings", "2026-01-01", rows, { equipment: "bodyweight" })]).get("Rings")).toBe(
      "dip-station",
    );
  });

  it("gives a routine a fifth on a bench, box or step the chair, and not under a fifth", () => {
    const chair = (n: number, of: number) => [
      ...CHAIR_EXERCISES.slice(0, n).map((id) => ex("body only", "chest", id)),
      ...Array.from({ length: of - n }, () => ex("body only", "quads")),
    ];
    expect(routineArtByProgram([row("t1", "Chair", "2026-01-01", chair(3, 15), { equipment: "bodyweight" })]).get("Chair")).toBe(
      "chair",
    );
    expect(routineArtByProgram([row("t1", "Floor", "2026-01-01", chair(2, 15), { equipment: "bodyweight" })]).get("Floor")).toBe(
      "bodyweight-mat",
    );
  });

  it("takes an override before scoring, without reserving it in the group", () => {
    const bar = PULL_UP_BAR_EXERCISES.slice(0, 4).map((id) => ex("body only", "lats", id));
    const rows = [
      row("t1", "Bodyweight Push / Pull / Legs", "2026-01-01", bar, { equipment: "bodyweight", program_slug: "bodyweight-push-pull-legs" }),
      row("t2", "Other", "2026-01-02", bar, { equipment: "bodyweight", program_slug: "other" }),
    ];
    const art = routineArtByProgram(rows);
    expect(art.get("Bodyweight Push / Pull / Legs")).toBe("dip-station");
    expect(art.get("Other")).toBe("pull-up-bar");
  });
});

describe("routineArtByProgram on the live system templates", () => {
  // Every system template with its exercises, from the live database on
  // 15 Oct 2026, after Bodyweight Push / Pull / Legs moved to advanced
  // (94 templates, 491 exercise rows). Refresh it when the
  // system routines change.
  const rows: TemplateRow[] = JSON.parse(readFileSync(resolve(__dirname, "__fixtures__/system-templates.json"), "utf8"));
  const art = routineArtByProgram(rows);

  it("gives the beginner bodyweight routines the mat, the bar and the chair", () => {
    // Four routines, three eligible images: the two with no bar, dip or
    // chair exercises share the mat.
    expect(art.get("Bodyweight Only")).toBe("bodyweight-mat");
    expect(art.get("Two Day Bodyweight Full Body")).toBe("bodyweight-mat");
    expect(art.get("Bodyweight Upper / Lower")).toBe("pull-up-bar");
    expect(art.get("Travel Bodyweight Full Body")).toBe("chair");
  });

  it("gives intermediate Calisthenics the bar and advanced Push / Pull / Legs the dip station", () => {
    // Each is alone in its pool. Push / Pull / Legs ties the bar with the
    // dip station and takes the dip station from ROUTINE_ART_OVERRIDES.
    expect(art.get("Calisthenics Full Body")).toBe("pull-up-bar");
    expect(art.get("Bodyweight Push / Pull / Legs")).toBe("dip-station");
  });

  it("gives each overridden program its fixed image", () => {
    const programBySlug = new Map(rows.filter((r) => r.program_slug).map((r) => [r.program_slug!, r.program!]));
    for (const [slug, key] of Object.entries(ROUTINE_ART_OVERRIDES)) {
      expect(programBySlug.has(slug)).toBe(true);
      expect(art.get(programBySlug.get(slug)!)).toBe(key);
    }
    expect(art.get("Dumbbell Only")).toBe("dumbbell-rack");
    expect(art.get("Two Day Dumbbell Full Body")).toBe("light-dumbbells");
    expect(art.get("Bro Split")).toBe("weight-plates");
    expect(art.get("Volume, Light, Heavy")).toBe("loaded-barbell");
  });
});
