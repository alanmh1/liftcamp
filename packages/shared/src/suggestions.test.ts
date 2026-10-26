import { describe, expect, it } from "vitest";

import { coldStartAdvice } from "./suggestions";

describe("coldStartAdvice", () => {
  it("says bodyweight for a body-only exercise", () => {
    expect(coldStartAdvice({ equipment: "body only", mechanic: "compound", level: "beginner" })).toBe(
      "Just your bodyweight. Log the reps you did.",
    );
  });

  it("says twelve clean reps for an isolation exercise", () => {
    expect(coldStartAdvice({ equipment: "dumbbell", mechanic: "isolation", level: "beginner" })).toBe(
      "Pick a weight you can do twelve clean reps with. If the last two feel easy, go up one step on the next set.",
    );
  });

  it("says start light for a beginner compound", () => {
    expect(coldStartAdvice({ equipment: "barbell", mechanic: "compound", level: "beginner" })).toMatch(
      /^Start with the empty bar or the lightest dumbbells/,
    );
  });

  it("says work up to six hard reps for an intermediate or advanced compound", () => {
    const line = "Work up over a couple of sets to a weight that makes six reps hard.";
    expect(coldStartAdvice({ equipment: "barbell", mechanic: "compound", level: "intermediate" })).toBe(line);
    expect(coldStartAdvice({ equipment: "barbell", mechanic: "compound", level: "Advanced " })).toBe(line);
  });

  it("falls back to the beginner compound line", () => {
    const beginner = coldStartAdvice({ mechanic: "compound", level: "beginner" });
    expect(coldStartAdvice({})).toBe(beginner);
    expect(coldStartAdvice({ mechanic: "compound", level: null })).toBe(beginner);
    expect(coldStartAdvice({ mechanic: null, level: "expert", equipment: "machine" })).toBe(beginner);
  });

  it("gives cardio nothing", () => {
    expect(coldStartAdvice({ set_type: "cardio", equipment: "machine" })).toBeNull();
  });
});
