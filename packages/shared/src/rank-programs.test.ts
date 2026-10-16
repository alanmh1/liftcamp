import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { matchHeading, matchPrograms, programMatches, rankPrograms, type TemplateRow } from "./templates";

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

  it("ranks a dumbbell match first, and equipment over days", () => {
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

describe("bodyweight on the live system templates", () => {
  // The system templates from the live database on 15 Oct 2026; see
  // routine-art.test.ts.
  const live: TemplateRow[] = JSON.parse(readFileSync(resolve(__dirname, "__fixtures__/system-templates.json"), "utf8"));
  const top = (answers: Parameters<typeof rankPrograms>[1], n: number) => names(live, answers).slice(0, n);
  const matched = (level: Parameters<typeof matchPrograms>[1], equipment: Parameters<typeof matchPrograms>[2]) =>
    matchPrograms(live, level, equipment);

  it("gives a beginner the bodyweight routine for their days", () => {
    expect(top({ level: "beginner", equipment: "bodyweight", days: 2 }, 1)).toEqual(["Two Day Bodyweight Full Body"]);
    expect(top({ level: "beginner", equipment: "bodyweight", days: 3 }, 2)).toEqual([
      "Bodyweight Only",
      "Travel Bodyweight Full Body",
    ]);
    expect(top({ level: "beginner", equipment: "bodyweight", days: 4 }, 1)).toEqual(["Bodyweight Upper / Lower"]);
  });

  it("lists every beginner bodyweight routine before any gym one", () => {
    const ranked = top({ level: "beginner", equipment: "bodyweight", days: 3 }, 4);
    expect(new Set(ranked)).toEqual(
      new Set(["Bodyweight Only", "Travel Bodyweight Full Body", "Two Day Bodyweight Full Body", "Bodyweight Upper / Lower"]),
    );
    const m = matched("beginner", "bodyweight");
    expect(m.exact).toBe(true);
    expect(m.programs.map((g) => g.program)).toEqual([
      "Bodyweight Only",
      "Two Day Bodyweight Full Body",
      "Bodyweight Upper / Lower",
      "Travel Bodyweight Full Body",
    ]);
  });

  it("gives an intermediate the intermediate bodyweight routines", () => {
    expect(top({ level: "intermediate", equipment: "bodyweight", days: 3 }, 2)).toEqual([
      "Calisthenics Full Body",
      "Bodyweight Push / Pull / Legs",
    ]);
    const m = matched("intermediate", "bodyweight");
    expect(m.exact).toBe(true);
    expect(m.programs.map((g) => g.program)).toEqual(["Calisthenics Full Body", "Bodyweight Push / Pull / Legs"]);
  });

  it("gives an advanced lifter with only bodyweight the intermediate bodyweight routines, not a gym one", () => {
    // Both are intermediate and three days, so the catalog order decides.
    expect(top({ level: "advanced", equipment: "bodyweight", days: 3 }, 2)).toEqual([
      "Calisthenics Full Body",
      "Bodyweight Push / Pull / Legs",
    ]);
    expect(top({ level: "advanced", equipment: "bodyweight", days: 5 }, 2)).toEqual([
      "Calisthenics Full Body",
      "Bodyweight Push / Pull / Legs",
    ]);
    const m = matched("advanced", "bodyweight");
    expect(m).toMatchObject({ exact: false, fallbackLevel: "intermediate" });
    expect(m.programs.map((g) => g.program)).toEqual(["Calisthenics Full Body", "Bodyweight Push / Pull / Legs"]);
    expect(matchHeading("advanced", "bodyweight", m)).toBe("Nothing matches exactly. For intermediates with no equipment");
  });

  it("keeps level first for a gym lifter", () => {
    const ranked = names(live, { level: "advanced", equipment: "gym", days: 5 });
    const levels = ranked.map((p) => live.find((t) => t.program === p)!.level);
    expect(levels.slice(0, 3)).toEqual(["advanced", "advanced", "advanced"]);
  });
});

describe("matchHeading", () => {
  it("names the level and equipment on an exact match", () => {
    expect(matchHeading("beginner", "bodyweight")).toBe("For beginners with no equipment");
    expect(matchHeading("beginner", "bodyweight", { exact: true })).toBe("For beginners with no equipment");
  });
  it("says any equipment when the match widened on equipment", () => {
    expect(matchHeading("advanced", "bands", { exact: false, fallbackLevel: null })).toBe(
      "Nothing matches exactly. For advanced lifters, any equipment",
    );
  });
});
