import { describe, expect, it } from "vitest";

import { programMatches, rankPrograms, type TemplateRow } from "./templates";

let n = 0;
function row(program: string, level: string, equipment: string, days: number, order: number, extra: Partial<TemplateRow> = {}): TemplateRow {
  n += 1;
  return {
    id: `t${n}`,
    name: `${program} A`,
    program,
    program_order: order,
    level,
    equipment,
    days_per_week: days,
    template_exercises: [],
    ...extra,
  };
}

const catalog: TemplateRow[] = [
  row("Gym Full Body 3", "beginner", "gym", 3, 1),
  row("Gym Upper Lower 4", "beginner", "gym", 4, 2),
  row("Dumbbell Basics 3", "beginner", "dumbbells", 3, 3),
  row("Gym Full Body 2", "beginner", "gym", 2, 4),
  row("PPL 6", "intermediate", "gym", 6, 5),
  row("Intermediate UL 4", "intermediate", "gym", 4, 6),
  row("Advanced Strength 4", "advanced", "gym", 4, 7),
  row("Hidden Beginner", "beginner", "gym", 3, 8, { hide_from_onboarding: true }),
];
const names = (rows: TemplateRow[], answers: Parameters<typeof rankPrograms>[1]) =>
  rankPrograms(rows, answers).map((g) => g.program);

describe("rankPrograms", () => {
  it("puts the exact level, equipment and days match first", () => {
    expect(names(catalog, { level: "beginner", equipment: "gym", days: 4 })[0]).toBe("Gym Upper Lower 4");
    expect(names(catalog, { level: "beginner", equipment: "gym", days: 2 })[0]).toBe("Gym Full Body 2");
  });

  it("ranks level over equipment, and equipment over days", () => {
    const ranked = names(catalog, { level: "beginner", equipment: "dumbbells", days: 4 });
    // The dumbbell beginner routine beats gym beginner routines with the right days.
    expect(ranked[0]).toBe("Dumbbell Basics 3");
    // Every beginner routine comes before every other level.
    const beginners = catalog.filter((t) => t.level === "beginner").map((t) => t.program!);
    const lastBeginner = Math.max(...beginners.map((p) => ranked.indexOf(p)));
    const firstOther = Math.min(
      ...catalog.filter((t) => t.level !== "beginner").map((t) => ranked.indexOf(t.program!)),
    );
    expect(lastBeginner).toBeLessThan(firstOther);
  });

  it("orders the same fit by nearest days, then the catalog order", () => {
    expect(names(catalog, { level: "beginner", equipment: "gym", days: 3 }).slice(0, 3)).toEqual([
      "Gym Full Body 3",
      "Hidden Beginner",
      "Gym Upper Lower 4",
    ]);
  });

  it("falls back to the nearest level when none is exact", () => {
    const rows = catalog.filter((t) => t.level !== "intermediate");
    // Intermediate asked for: beginner and advanced are both one step away,
    // so equipment and days decide.
    expect(names(rows, { level: "intermediate", equipment: "gym", days: 4 })[0]).toBe("Gym Upper Lower 4");
  });

  it("ranks an unanswered level as beginner and drops hidden programs", () => {
    const ranked = names(catalog, { level: null, equipment: null, days: 3 });
    expect(ranked[0]).toBe("Gym Full Body 3");
    expect(ranked).not.toContain("Hidden Beginner");
  });

  it("keeps hidden programs once a level is answered", () => {
    expect(names(catalog, { level: "beginner", equipment: "gym", days: 3 })).toContain("Hidden Beginner");
  });

  it("does not rank on days when there is no answer", () => {
    expect(names(catalog, { level: "beginner", equipment: "gym", days: null }).slice(0, 2)).toEqual([
      "Gym Full Body 3",
      "Gym Upper Lower 4",
    ]);
  });
});

describe("programMatches", () => {
  const [top] = rankPrograms(catalog, { level: "beginner", equipment: "dumbbells", days: 3 });
  it("is true for an exact level and equipment match", () => {
    expect(programMatches(top, { level: "beginner", equipment: "dumbbells" })).toBe(true);
  });
  it("is false when equipment differs", () => {
    expect(programMatches(top, { level: "beginner", equipment: "gym" })).toBe(false);
  });
  it("ignores an unanswered axis", () => {
    expect(programMatches(top, { level: null, equipment: null })).toBe(true);
    expect(programMatches(undefined, { level: null, equipment: null })).toBe(false);
  });
});
