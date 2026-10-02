import { describe, expect, it } from "vitest";

import { progressionGuide } from "./progression-guide";

const text = (unit: "lb" | "kg") =>
  progressionGuide(unit)
    .flatMap((s) => [s.title, ...s.paragraphs, ...(s.after ?? []), ...(s.steps ?? []).flatMap((x) => [x.label, x.detail ?? "", x.value])])
    .join("\n");

describe("progressionGuide", () => {
  it("has the five sections in order", () => {
    expect(progressionGuide("lb").map((s) => s.title)).toEqual([
      "Your rep range",
      "Add reps first",
      "Then add weight",
      "Missed reps",
      "Coming back after a break",
    ]);
  });

  it("shows the real steps in lbs", () => {
    const steps = progressionGuide("lb").find((s) => s.steps)?.steps ?? [];
    expect(steps.map((s) => [s.label, s.value])).toEqual([
      ["Barbell", "+5 lbs"],
      ["Barbell, lower body", "+10 lbs"],
      ["Dumbbell", "Next size up"],
      ["Machine", "+10 lbs"],
      ["Cable", "+5 lbs"],
    ]);
    expect(steps[2].detail).toBe("5, 8, 10, 12, 15, 20, 25, then every 5 lbs");
  });

  it("shows the real steps in kg", () => {
    const steps = progressionGuide("kg").find((s) => s.steps)?.steps ?? [];
    expect(steps.map((s) => s.value)).toEqual(["+2.5 kg", "+5 kg", "Next size up", "+5 kg", "+2.5 kg"]);
    expect(steps[2].detail).toBe("2, 4, 6, 8, 10, 12.5, 15, then every 2.5 kg");
  });

  it("takes its numbers from the rules", () => {
    const t = text("lb");
    expect(t).toContain("like 8 to 12");
    expect(t).toContain("Miss 3 sessions in a row");
    expect(t).toContain("about 10% less");
    expect(t).toContain("more than 4 weeks");
    expect(t).toContain("comes down 5 lbs at a time");
  });

  it("follows the house style", () => {
    for (const unit of ["lb", "kg"] as const) {
      const t = text(unit);
      expect(t).not.toMatch(/[—–]/);
      expect(t).not.toMatch(/prevent|injur|delve|leverage|seamless|robust|crucial|unlock|empower/i);
    }
  });
});
