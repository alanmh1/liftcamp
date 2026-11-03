import { describe, expect, it } from "vitest";

import { isDevBuildFrom, isInternalHost, isNewUser, signInMeta } from "./dev-traffic";

describe("isDevBuildFrom", () => {
  it("is dev for a debug build on a phone", () => {
    expect(isDevBuildFrom({ dev: true, isDevice: true })).toBe(true);
  });
  it("is dev for a Release build on the Simulator", () => {
    expect(isDevBuildFrom({ dev: false, isDevice: false })).toBe(true);
  });
  it("is dev for a debug build on the Simulator", () => {
    expect(isDevBuildFrom({ dev: true, isDevice: false })).toBe(true);
  });
  it("is prod for a Release build on a phone", () => {
    expect(isDevBuildFrom({ dev: false, isDevice: true })).toBe(false);
  });
});

describe("signInMeta", () => {
  it("tags a dev build", () => {
    expect(signInMeta(true, "ios")).toEqual({ env: "dev", platform: "ios" });
  });
  it("tags a prod build", () => {
    expect(signInMeta(false, "android")).toEqual({ env: "prod", platform: "android" });
  });
});

describe("isNewUser", () => {
  it("is new when created and signed in together", () => {
    expect(
      isNewUser({ created_at: "2026-11-03T10:00:00.000Z", last_sign_in_at: "2026-11-03T10:00:00.412Z" }),
    ).toBe(true);
  });
  it("is not new on a later sign-in", () => {
    expect(
      isNewUser({ created_at: "2026-10-01T10:00:00Z", last_sign_in_at: "2026-11-03T10:00:00Z" }),
    ).toBe(false);
  });
  it("is not new two minutes later", () => {
    expect(
      isNewUser({ created_at: "2026-11-03T10:00:00Z", last_sign_in_at: "2026-11-03T10:02:00Z" }),
    ).toBe(false);
  });
  it("is not new without both times", () => {
    expect(isNewUser({ created_at: "2026-11-03T10:00:00Z" })).toBe(false);
    expect(isNewUser({ created_at: null, last_sign_in_at: null })).toBe(false);
    expect(isNewUser({ created_at: "nope", last_sign_in_at: "nope" })).toBe(false);
  });
});

describe("isInternalHost", () => {
  it.each(["localhost", "LOCALHOST", "app.localhost", "127.0.0.1", "[::1]", "0.0.0.0"])("%s is internal", (h) => {
    expect(isInternalHost(h)).toBe(true);
  });
  it.each(["liftcamp-git-dev-traffic-filter-alan.vercel.app", "liftcamp-abc123.vercel.app"])(
    "preview %s is internal",
    (h) => {
      expect(isInternalHost(h)).toBe(true);
    },
  );
  it.each(["liftcamp.app", "www.liftcamp.app", "liftcamp.vercel.app", "liftcamp.vercel.app.", "vercel.app.evil.com"])(
    "%s is not internal",
    (h) => {
      expect(isInternalHost(h)).toBe(false);
    },
  );
});
