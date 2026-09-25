import { describe, expect, it } from "vitest";

import { fallbackUsername, isValidUsername } from "./username";

describe("fallbackUsername", () => {
  it("is lifter plus 5 digits, and passes the database's shape check", () => {
    for (let i = 0; i < 200; i++) {
      const name = fallbackUsername();
      expect(name).toMatch(/^lifter[1-9][0-9]{4}$/);
      expect(isValidUsername(name)).toBe(true);
    }
  });
});
