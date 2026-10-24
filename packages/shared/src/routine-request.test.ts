import { describe, expect, it } from "vitest";

import { routineRequestBody, routineRequestMailto } from "./routine-request";

describe("routineRequestBody", () => {
  it("names the level and equipment picked", () => {
    expect(routineRequestBody("intermediate", "gym")).toBe(
      "Experience · Intermediate\nEquipment · Gym\n\nI'm looking for: ",
    );
  });

  it("says Any for a filter left clear", () => {
    expect(routineRequestBody(null, "bands")).toBe("Experience · Any\nEquipment · Bands\n\nI'm looking for: ");
    expect(routineRequestBody("advanced", null)).toBe("Experience · Advanced\nEquipment · Any\n\nI'm looking for: ");
  });
});

describe("routineRequestMailto", () => {
  it("addresses us with the subject and the body encoded", () => {
    const url = routineRequestMailto("beginner", "dumbbells");
    expect(url.startsWith("mailto:hello@liftcamp.app?subject=Routine%20request&body=")).toBe(true);
    const body = decodeURIComponent(url.split("&body=")[1]);
    expect(body).toBe(routineRequestBody("beginner", "dumbbells"));
  });
});
