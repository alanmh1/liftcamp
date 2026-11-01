import { describe, expect, it } from "vitest";
import { STRENGTH_EXERCISES, STRENGTH_STANDARDS } from "@liftcamp/shared";
import {
  closestBodyweight,
  HUB,
  liftAnswer,
  liftFaq,
  referenceLoad,
  referenceRow,
  STRENGTH_PAGES,
  strengthPages,
  TABLE_BODYWEIGHTS,
  tableHeading,
} from "./strength-pages";

describe("strength pages", () => {
  it("has exactly the exercise ids in STRENGTH_EXERCISES", () => {
    const ids = strengthPages().map((p) => p.exerciseId);
    expect([...ids].sort()).toEqual([...STRENGTH_EXERCISES].sort());
  });

  it("has a standard for every page", () => {
    for (const p of strengthPages()) expect(STRENGTH_STANDARDS[p.exerciseId], p.slug).toBeDefined();
  });

  it("keys pages by slug", () => {
    for (const p of strengthPages()) expect(STRENGTH_PAGES[p.slug]).toBe(p);
  });

  it("writes reference loads in both units, each rounded on its own", () => {
    const bench = STRENGTH_PAGES["bench-press"]!;
    expect(referenceLoad(bench.exerciseId, "male", 0)).toBe("135 lb (60 kg)");
    expect(referenceLoad(bench.exerciseId, "male", 1)).toBe("180 lb (80 kg)");
    expect(referenceLoad(bench.exerciseId, "female", 0)).toBe("55 lb (25 kg)");
    expect(liftAnswer(bench)).toContain("a Novice bench press starts at 135 lb (60 kg)");
  });

  it("puts the beginner question first and the two shared questions last", () => {
    const faq = liftFaq(STRENGTH_PAGES.squat!);
    expect(faq).toHaveLength(4);
    expect(faq[0]!.q).toBe("How much should a beginner squat?");
    expect(faq[0]!.a).toContain("anything under 180 lb");
    expect(faq[3]!.q).toBe("Where do these numbers come from?");
    expect(HUB.faq).toHaveLength(4);
  });

  it("drops Standards from the table heading", () => {
    expect(tableHeading(STRENGTH_PAGES["bench-press"]!, "female")).toBe(
      "Bench Press standards for women",
    );
  });

  it("has the table rows the spec lists", () => {
    expect(TABLE_BODYWEIGHTS.male.lb).toEqual([120, 140, 160, 180, 200, 220, 240, 260, 280]);
    expect(TABLE_BODYWEIGHTS.female.lb).toEqual([100, 120, 140, 160, 180, 200, 220, 240]);
    expect(TABLE_BODYWEIGHTS.male.kg).toEqual([55, 65, 75, 85, 95, 105, 115, 125]);
    expect(TABLE_BODYWEIGHTS.female.kg).toEqual([45, 55, 65, 75, 85, 95, 105]);
  });

  it("finds the closest row", () => {
    expect(closestBodyweight(TABLE_BODYWEIGHTS.male.lb, 187)).toBe(180);
    expect(closestBodyweight(TABLE_BODYWEIGHTS.male.lb, 400)).toBe(280);
    expect(closestBodyweight(TABLE_BODYWEIGHTS.male.lb, null)).toBeNull();
  });

  it("puts no colon or em dash in the copy", () => {
    const copy = [
      ...strengthPages().flatMap((p) => [
        p.intro2,
        p.q2.a,
        liftAnswer(p),
        ...liftFaq(p).map((f) => f.a),
      ]),
      ...HUB.intro,
      ...HUB.faq.map((f) => f.a),
    ];
    for (const c of copy) {
      expect(c).not.toContain("—");
      expect(c).not.toContain(":");
    }
  });

  it("gives the hub's kg Novice and Intermediate for bench the bench page's answer block kg figures", () => {
    const bench = STRENGTH_PAGES["bench-press"]!;
    // In order: 82 kg, man Novice, man Intermediate, 64 kg, woman Novice, woman Intermediate.
    const kg = [...liftAnswer(bench).matchAll(/\(([\d.]+) kg\)/g)].map((m) => Number(m[1]));
    expect(kg).toHaveLength(6);
    const men = referenceRow(bench.exerciseId, "male", "kg")!;
    const women = referenceRow(bench.exerciseId, "female", "kg")!;
    expect([82, men[0], men[1], 64, women[0], women[1]]).toEqual(kg);
  });
});
