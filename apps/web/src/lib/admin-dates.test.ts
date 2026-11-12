import { describe, expect, it } from "vitest";
import { parseDay, toAdminDate } from "./admin-dates";

describe("parseDay", () => {
  it("returns the local midnight of the given day", () => {
    const d = parseDay("2026-11-01");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 10, 1]);
    expect([d.getHours(), d.getMinutes()]).toEqual([0, 0]);
  });

  it("handles month and year ends", () => {
    const d = parseDay("2026-12-31");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 11, 31]);
  });

  it("rejects anything that is not a bare day", () => {
    expect(() => parseDay("2026-11-01T00:00:00Z")).toThrow();
  });
});

describe("toAdminDate", () => {
  it("treats a bare day as local midnight", () => {
    expect(toAdminDate("2026-11-01").getDate()).toBe(1);
  });

  it("parses a full timestamp as given", () => {
    expect(toAdminDate("2026-11-01T12:00:00Z").getTime()).toBe(Date.UTC(2026, 10, 1, 12));
  });
});
