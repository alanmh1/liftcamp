import { describe, expect, it } from "vitest";

import {
  equipmentFits,
  groupPrograms,
  planMetaLine,
  planSubtitle,
  rankPrograms,
  routineListSections,
  type TemplateRow,
} from "./templates";

let n = 0;
function row(
  program: string,
  level: string,
  equipment: string,
  days: number,
  order: number,
  extra: Partial<TemplateRow> = {},
): TemplateRow {
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
  row("Gym Full Body 2", "beginner", "gym", 2, 2),
  row("Dumbbell Basics 3", "beginner", "dumbbells", 3, 3),
  row("Bodyweight 2", "beginner", "bodyweight", 2, 4),
  row("Bands 3", "beginner", "bands", 3, 5),
  row("Intermediate UL 4", "intermediate", "gym", 4, 6),
  row("Intermediate FB 3", "intermediate", "gym", 3, 7),
  row("Hidden Advanced 3", "advanced", "gym", 3, 8, { hide_from_onboarding: true }),
];

const group = (program: string) => groupPrograms(catalog).find((g) => g.program === program)!;
const names = (sections: { programs: { program: string }[] }[]) => sections.map((s) => s.programs.map((p) => p.program));

describe("equipmentFits", () => {
  it("matches the same equipment", () => {
    expect(equipmentFits(group("Dumbbell Basics 3"), "dumbbells")).toBe(true);
    expect(equipmentFits(group("Gym Full Body 3"), "dumbbells")).toBe(false);
    expect(equipmentFits(group("Bands 3"), "bodyweight")).toBe(false);
  });
  it("lets a full gym take dumbbell and bodyweight routines, not bands", () => {
    expect(equipmentFits(group("Dumbbell Basics 3"), "gym")).toBe(true);
    expect(equipmentFits(group("Bodyweight 2"), "gym")).toBe(true);
    expect(equipmentFits(group("Bands 3"), "gym")).toBe(false);
  });
  it("filters nothing with no equipment", () => {
    expect(equipmentFits(group("Bands 3"), null)).toBe(true);
  });
});

describe("rankPrograms keepHidden", () => {
  it("drops hidden routines with no level unless asked to keep them", () => {
    const answers = { level: null, equipment: null, days: null };
    expect(rankPrograms(catalog, answers).map((g) => g.program)).not.toContain("Hidden Advanced 3");
    expect(rankPrograms(catalog, answers, { keepHidden: true }).map((g) => g.program)).toContain("Hidden Advanced 3");
  });
});

describe("routineListSections", () => {
  it("splits into the target's days and fewer, filtered by level and equipment", () => {
    const sections = routineListSections(catalog, { level: "beginner", equipment: "gym", days: 3 });
    expect(sections.map((s) => s.title)).toEqual(["Fits three days a week", "Fewer days"]);
    expect(names(sections)).toEqual([
      ["Gym Full Body 3", "Dumbbell Basics 3"],
      ["Gym Full Body 2", "Bodyweight 2"],
    ]);
  });

  it("is one Best matches section with the days chip off", () => {
    const sections = routineListSections(catalog, { level: "beginner", equipment: "dumbbells", days: null });
    expect(sections).toHaveLength(1);
    expect(sections[0]!.title).toBe("Best matches");
    expect(names(sections)).toEqual([["Dumbbell Basics 3"]]);
  });

  it("gives an experienced lifter every level, hidden routines included", () => {
    const sections = routineListSections(catalog, { level: null, equipment: "gym", days: 3, keepHidden: true });
    expect(sections[0]!.programs.map((p) => p.program)).toEqual(
      expect.arrayContaining(["Intermediate FB 3", "Hidden Advanced 3", "Gym Full Body 3"]),
    );
  });

  it("ranks on rankLevel without filtering on it", () => {
    const sections = routineListSections(catalog, { level: null, rankLevel: "intermediate", equipment: "gym", days: 3 });
    const programs = sections[0]!.programs.map((p) => p.program);
    expect(programs[0]).toBe("Intermediate FB 3");
    expect(programs).toContain("Gym Full Body 3");
  });

  it("drops an empty Fewer days section", () => {
    const sections = routineListSections(catalog, { level: "beginner", equipment: "bands", days: 3 });
    expect(sections.map((s) => s.title)).toEqual(["Fits three days a week"]);
  });

  it("is empty when nothing matches the chips", () => {
    expect(routineListSections(catalog, { level: "intermediate", equipment: "bands", days: 3 })).toEqual([]);
  });
});

describe("planSubtitle", () => {
  it("names the days and the equipment", () => {
    expect(planSubtitle(3, "gym")).toBe("Built for three days a week at a full gym.");
    expect(planSubtitle(2, "dumbbells")).toBe("Built for two days a week with dumbbells.");
    expect(planSubtitle(4, "bodyweight")).toBe("Built for four days a week with no equipment.");
    expect(planSubtitle(3, null)).toBe("Built for three days a week.");
  });
});

describe("planMetaLine", () => {
  const ex = (k: number) => Array.from({ length: k }, (_, i) => ({ exercise_id: `e${i}`, position: i }));
  const g = groupPrograms([row("Plan", "beginner", "gym", 3, 1, { template_exercises: ex(5) })])[0]!;
  it("leads with the schedule when there is one", () => {
    expect(planMetaLine(g, "Mon, Wed, Fri")).toBe("Mon, Wed, Fri · 5 exercises");
  });
  it("falls back to the routine's days a week", () => {
    expect(planMetaLine(g, null)).toBe("3 days a week · 5 exercises");
  });
});
