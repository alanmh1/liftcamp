import { describe, expect, it } from "vitest";
import { ADMIN_SOURCES, STAGES, USER_SOURCES, sourceLabel } from "./user-sources";

describe("sourceLabel", () => {
  it("labels app and admin keys", () => {
    expect(sourceLabel("reddit")).toBe("Reddit");
    expect(sourceLabel("app_review")).toBe("App Review");
  });

  it("returns null for no source and the key for an unknown one", () => {
    expect(sourceLabel(null)).toBeNull();
    expect(sourceLabel("")).toBeNull();
    expect(sourceLabel("billboard")).toBe("billboard");
  });
});

describe("source and stage lists", () => {
  it("has no key in both lists", () => {
    const app = new Set<string>(USER_SOURCES.map((s) => s.key));
    expect(ADMIN_SOURCES.filter((s) => app.has(s.key))).toEqual([]);
  });

  it("numbers the stages 0 to 5 in order", () => {
    expect(STAGES.map((s) => s.stage)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
