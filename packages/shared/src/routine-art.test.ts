import { describe, expect, it } from "vitest";

import { FALLBACK_IMAGE, pickRoutineImages, routineArtByProgram, type RoutineForArt } from "./routine-art";

const ex = (equipment: string | null, primary_muscle: string | null) => ({ equipment, primary_muscle });

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

describe("routineArtByProgram", () => {
  const row = (id: string, program: string, created_at: string, exercises: ReturnType<typeof ex>[]) => ({
    id,
    name: `${program} A`,
    program,
    created_at,
    template_exercises: exercises.map((e, position) => ({ exercise_id: `${id}-${position}`, position, exercises: e })),
  });

  it("walks by created_at whatever order the rows arrive in", () => {
    const rows = [
      row("t1", "Legs", "2026-01-01", legDay("x").exercises as ReturnType<typeof ex>[]),
      row("t2", "Push", "2026-01-02", pushDay.exercises as ReturnType<typeof ex>[]),
      row("t3", "Legs 2", "2026-01-03", legDay("y").exercises as ReturnType<typeof ex>[]),
    ];
    const full = routineArtByProgram(rows);
    expect(full.get("Legs")).toBe("leg-press");
    expect(full.get("Legs 2")).toBe("leg-curl");
    // The app runs this over the full list and looks each card up in the
    // result, so a filtered grid shows the same image; the map itself must
    // not depend on the order the rows were fetched in.
    const reversed = routineArtByProgram([...rows].reverse());
    for (const [program, key] of full) expect(reversed.get(program)).toBe(key);
  });
});
