import { describe, expect, it } from "vitest";

import { repeatStart } from "./repeat-start";

const NONE = new Set<string>();

describe("repeatStart", () => {
  it("keeps the source's routine day", () => {
    expect(repeatStart({ name: "Pull", templateId: "t-pull" }, NONE)).toEqual({ name: "Pull", templateId: "t-pull" });
  });

  it("starts a workout with no routine day when the source had none", () => {
    expect(repeatStart({ name: "Arms", templateId: null }, NONE)).toEqual({ name: "Arms", templateId: null });
  });

  it("treats a cached source without the field as no routine day", () => {
    expect(repeatStart({ name: "Legs" }, NONE)).toEqual({ name: "Legs", templateId: null });
  });

  it("drops a routine day whose delete is still queued", () => {
    expect(repeatStart({ name: "Push", templateId: "t-push" }, new Set(["t-push"]))).toEqual({
      name: "Push",
      templateId: null,
    });
  });

  it("keeps the day when a different routine is being removed", () => {
    expect(repeatStart({ name: "Push", templateId: "t-push" }, new Set(["t-legs"])).templateId).toBe("t-push");
  });

  it("names an unnamed or blank workout Workout, trimmed otherwise", () => {
    expect(repeatStart({ name: null, templateId: null }, NONE).name).toBe("Workout");
    expect(repeatStart({ name: "   ", templateId: null }, NONE).name).toBe("Workout");
    expect(repeatStart({ name: "  Pull ", templateId: null }, NONE).name).toBe("Pull");
  });
});
