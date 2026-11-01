import { describe, expect, it } from "vitest";
import { strengthOutcome, validateStrengthSearch, withUnit } from "./strength-calc";

const BENCH = "d5f93fa3-b43b-4306-8081-ee5bff0d4ca6";

describe("validateStrengthSearch", () => {
  it("parses numbers from strings and drops what it cannot read", () => {
    expect(
      validateStrengthSearch({ w: "135", r: 5, bw: "abc", s: "x", u: "lb", lift: "curl" }),
    ).toEqual({ w: 135, r: 5 });
    expect(validateStrengthSearch({ s: "f", u: "kg", lift: "squat", a: "34" })).toEqual({
      s: "f",
      u: "kg",
      lift: "squat",
      a: 34,
    });
  });
});

describe("strengthOutcome", () => {
  it("gives no result until weight, reps, bodyweight and sex are filled", () => {
    expect(strengthOutcome(BENCH, { w: 135, r: 5, bw: 180 }).result).toBeNull();
    expect(strengthOutcome(BENCH, { w: 135, r: 5, s: "m" }).result).toBeNull();
  });

  it("places 135 x 5 at 180 lb as Novice, 25 lb short of Intermediate", () => {
    const { result } = strengthOutcome(BENCH, { w: 135, r: 5, bw: 180, s: "m" });
    expect(result?.level).toBe("Novice");
    expect(result?.maxLine).toBe("Estimated max 158 lb");
    expect(result?.nextLine).toBe("25 lb to Intermediate");
    expect(result!.position).toBeGreaterThan(0.2);
    expect(result!.position).toBeLessThan(0.4);
  });

  it("says Max for a single and Top level at Elite", () => {
    const { result } = strengthOutcome(BENCH, { w: 405, r: 1, bw: 180, s: "m" });
    expect(result?.maxLine).toBe("Max 405 lb");
    expect(result?.level).toBe("Elite");
    expect(result?.nextLine).toBe("Top level");
  });

  it("lowers the thresholds with age", () => {
    const young = strengthOutcome(BENCH, { w: 175, r: 1, bw: 180, s: "m" }).result!;
    const older = strengthOutcome(BENCH, { w: 175, r: 1, bw: 180, s: "m", a: 45 }).result!;
    expect(young.level).toBe("Novice");
    expect(older.level).toBe("Intermediate");
  });

  it("flags reps over 12, a bodyweight out of range and a zero weight", () => {
    const { errors, result } = strengthOutcome(BENCH, { w: 0, r: 15, bw: 600, s: "f" });
    expect(result).toBeNull();
    expect(errors.r).toBe("Use a set of 12 reps or fewer for a good estimate.");
    expect(errors.bw).toContain("70 to 500 lb");
    expect(errors.w).toBeDefined();
    expect(strengthOutcome(BENCH, { bw: 250, u: "kg" }).errors.bw).toContain("30 to 230 kg");
  });

  it("works in kg", () => {
    const { result } = strengthOutcome(BENCH, { w: 65, r: 1, bw: 82, s: "m", u: "kg" });
    expect(result?.maxLine).toBe("Max 65 kg");
    expect(result?.nextLine).toMatch(/kg to Intermediate$/);
  });
});

describe("withUnit", () => {
  it("converts weight and bodyweight and drops u for lb", () => {
    expect(withUnit({ w: 100, bw: 80, u: "kg", s: "m" }, "lb")).toEqual({
      w: 220.5,
      bw: 176.4,
      s: "m",
    });
    expect(withUnit({ w: 135 }, "kg")).toEqual({ w: 61.2, u: "kg" });
  });
});
