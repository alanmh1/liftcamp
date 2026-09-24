import { describe, expect, it } from "vitest";

import { defaultBirthday, formatBirthday, isoFromLocalDate, latestBirthday, localDateFromIso } from "./birthday";

describe("birthday dates", () => {
  it("round trips local dates without a timezone shift", () => {
    const d = localDateFromIso("1983-11-10")!;
    expect(d.getFullYear()).toBe(1983);
    expect(d.getMonth()).toBe(10);
    expect(d.getDate()).toBe(10);
    expect(isoFromLocalDate(d)).toBe("1983-11-10");
  });

  it("formats like Nov 10, 1983", () => {
    expect(formatBirthday("1983-11-10")).toBe("Nov 10, 1983");
    expect(formatBirthday(null)).toBeNull();
    expect(formatBirthday("garbage")).toBeNull();
  });

  it("stops the picker at 13 years ago and opens 30 years back", () => {
    const now = new Date(2026, 8, 24);
    expect(isoFromLocalDate(latestBirthday(now))).toBe("2013-09-24");
    expect(isoFromLocalDate(defaultBirthday(now))).toBe("1996-01-01");
  });
});
