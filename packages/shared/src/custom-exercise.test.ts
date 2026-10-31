import { describe, expect, it } from "vitest";

import {
  canCreateCustom,
  classifyCustomExerciseError,
  customExerciseErrorCopy,
  customUsageLine,
  draftProblem,
  draftToRow,
  EMPTY_DRAFT,
  parseCustomExerciseStatus,
  rowToDraft,
  tidyCustomName,
  trackTypeOf,
  type CustomExerciseDraft,
} from "./custom-exercise";

const ids = { id: "11111111-1111-4111-8111-111111111111", ownerId: "u1" };

const draft: CustomExerciseDraft = {
  name: "  Wide   grip row ",
  primaryMuscle: "upper back",
  secondaryMuscles: ["lats", "upper back", "biceps"],
  equipment: "cable",
  trackType: "weighted",
  unilateral: false,
};

describe("draftToRow", () => {
  it("tidies the name, drops the primary from the secondaries and marks a compound", () => {
    const row = draftToRow(draft, ids);
    expect(row.name).toBe("Wide grip row");
    expect(row.primary_muscle).toBe("upper back");
    expect(row.secondary_muscles).toBe("lats|biceps");
    expect(row.mechanic).toBe("compound");
    expect(row.weight_type).toBe("standard");
    expect(row.set_type).toBeNull();
    expect(row.owner_id).toBe("u1");
  });

  it("is an isolation with no secondaries and a null string, not an empty one", () => {
    const row = draftToRow({ ...draft, secondaryMuscles: ["upper back"] }, ids);
    expect(row.secondary_muscles).toBeNull();
    expect(row.mechanic).toBe("isolation");
  });

  it("maps the three tracking types", () => {
    expect(draftToRow({ ...draft, trackType: "bodyweight" }, ids)).toMatchObject({
      weight_type: "bodyweight",
      set_type: null,
    });
    expect(draftToRow({ ...draft, trackType: "timed" }, ids)).toMatchObject({
      weight_type: "standard",
      set_type: "cardio",
    });
  });

  it("refuses a draft with no primary muscle", () => {
    expect(() => draftToRow({ ...draft, primaryMuscle: null }, ids)).toThrow();
  });
});

describe("rowToDraft", () => {
  it("round-trips a row", () => {
    const row = draftToRow(draft, ids);
    const back = rowToDraft(row);
    expect(back).toEqual({
      name: "Wide grip row",
      primaryMuscle: "upper back",
      secondaryMuscles: ["lats", "biceps"],
      equipment: "cable",
      trackType: "weighted",
      unilateral: false,
    });
  });

  it("reads tracking from the columns", () => {
    expect(trackTypeOf({ weight_type: "bodyweight", set_type: null })).toBe("bodyweight");
    expect(trackTypeOf({ weight_type: "standard", set_type: "cardio" })).toBe("timed");
    expect(trackTypeOf({ weight_type: "standard", set_type: null })).toBe("weighted");
    expect(trackTypeOf({})).toBe("weighted");
  });
});

describe("draftProblem", () => {
  it("wants a name of at least two characters, then a muscle", () => {
    expect(draftProblem(EMPTY_DRAFT)).toBe("Give it a name.");
    expect(draftProblem({ ...EMPTY_DRAFT, name: " a " })).toBe("Give it a name.");
    expect(draftProblem({ ...EMPTY_DRAFT, name: "ab" })).toBe("Pick the main muscle it works.");
    expect(draftProblem({ ...EMPTY_DRAFT, name: "ab", primaryMuscle: "abs" })).toBeNull();
  });

  it("caps the name at 60", () => {
    expect(draftProblem({ ...EMPTY_DRAFT, name: "x".repeat(61), primaryMuscle: "abs" })).toMatch(/under 60/);
    expect(draftProblem({ ...EMPTY_DRAFT, name: "x".repeat(60), primaryMuscle: "abs" })).toBeNull();
  });

  it("tidies before measuring", () => {
    expect(tidyCustomName("  a \n b  ")).toBe("a b");
  });
});

describe("status", () => {
  it("parses the RPC shape and nothing else", () => {
    expect(parseCustomExerciseStatus({ enabled: true, pro: false, used: 2, limit: 5, member: true })).toEqual({
      enabled: true,
      pro: false,
      used: 2,
      limit: 5,
    });
    expect(parseCustomExerciseStatus(null)).toBeNull();
    expect(parseCustomExerciseStatus({ enabled: "yes" })).toBeNull();
    expect(parseCustomExerciseStatus("{}")).toBeNull();
  });

  it("gates creation on the flag, then the cap unless Pro", () => {
    expect(canCreateCustom(null)).toBe(false);
    expect(canCreateCustom({ enabled: false, pro: true, used: 0, limit: 5 })).toBe(false);
    expect(canCreateCustom({ enabled: true, pro: false, used: 4, limit: 5 })).toBe(true);
    expect(canCreateCustom({ enabled: true, pro: false, used: 5, limit: 5 })).toBe(false);
    expect(canCreateCustom({ enabled: true, pro: true, used: 50, limit: 5 })).toBe(true);
    expect(canCreateCustom({ enabled: true, pro: false, used: 0, limit: 0 })).toBe(false);
  });

  it("writes the usage line for free users only", () => {
    expect(customUsageLine({ enabled: true, pro: false, used: 3, limit: 5 })).toBe("3 of 5 used");
    expect(customUsageLine({ enabled: true, pro: true, used: 3, limit: 5 })).toBeNull();
  });
});

describe("classifyCustomExerciseError", () => {
  it("reads the trigger's three refusals", () => {
    expect(classifyCustomExerciseError({ code: "P0001", message: "custom_exercise_off" })).toEqual({ kind: "off" });
    expect(classifyCustomExerciseError({ code: "P0001", message: "custom_exercise_limit: 5" })).toEqual({
      kind: "limit",
      limit: 5,
    });
    expect(classifyCustomExerciseError({ code: "P0001", message: "custom_exercise_invalid: pick a primary muscle" })).toEqual({
      kind: "invalid",
      detail: "pick a primary muscle",
    });
  });

  it("treats a transport failure as offline and anything else as unknown", () => {
    expect(classifyCustomExerciseError({ code: "", message: "TypeError: Network request failed" })).toEqual({
      kind: "offline",
    });
    expect(classifyCustomExerciseError(null)).toEqual({ kind: "offline" });
    expect(classifyCustomExerciseError({ code: "42501", message: "new row violates row-level security" })).toEqual({
      kind: "unknown",
      message: "new row violates row-level security",
    });
  });

  it("has copy for each kind, with no colons", () => {
    for (const e of [
      { kind: "off" as const },
      { kind: "limit" as const, limit: 5 },
      { kind: "invalid" as const, detail: "weight type" },
      { kind: "offline" as const },
      { kind: "unknown" as const, message: "x" },
    ]) {
      const copy = customExerciseErrorCopy(e);
      expect(copy.length).toBeGreaterThan(0);
      expect(copy).not.toContain(":");
    }
    expect(customExerciseErrorCopy({ kind: "limit", limit: 5 })).toBe("You've used your 5 free custom exercises.");
  });
});
