import { describe, expect, it } from "vitest";

import { formatDateLabel } from "./date-label";

describe("formatDateLabel", () => {
  it("leaves the year off in the current year", () => {
    expect(formatDateLabel("2026-11-20", { now: 2026 })).toBe("Nov 20");
    expect(formatDateLabel("2026-11-20", { weekday: "short", now: 2026 })).toBe("Fri, Nov 20");
  });

  it("adds the year when it is not the current one", () => {
    expect(formatDateLabel("2024-12-06", { weekday: "short", now: 2026 })).toBe("Fri, Dec 6, 2024");
    expect(formatDateLabel("2027-01-04", { now: 2026 })).toBe("Jan 4, 2027");
  });

  it("spells out the weekday and month on request", () => {
    expect(formatDateLabel("2024-12-06", { weekday: "long", month: "long", now: 2026 })).toBe(
      "Friday, December 6, 2024",
    );
    expect(formatDateLabel("2026-09-09", { weekday: "long", month: "long", now: new Date(2026, 5, 1) })).toBe(
      "Wednesday, September 9",
    );
  });

  it("reads a timestamp by its date and returns junk unchanged", () => {
    expect(formatDateLabel("2025-03-02T23:30:00Z", { now: 2026 })).toBe("Mar 2, 2025");
    expect(formatDateLabel("", { now: 2026 })).toBe("");
  });
});
