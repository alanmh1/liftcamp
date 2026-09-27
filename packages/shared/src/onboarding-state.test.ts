import { describe, expect, it } from "vitest";

import { resolveAccountOnboarded, shouldCacheOnboarded, type OnboardingCheck } from "./onboarding-state";

const ok = (level: string | null): OnboardingCheck => ({ status: "ok", level });
const error: OnboardingCheck = { status: "error" };

describe("resolveAccountOnboarded", () => {
  it("trusts the per-account cache without a check", () => {
    expect(resolveAccountOnboarded({ cached: true, deviceFlag: true, check: null })).toBe(true);
  });

  it("keeps a cached yes even if a later check errors", () => {
    expect(resolveAccountOnboarded({ cached: true, deviceFlag: true, check: error })).toBe(true);
  });

  it("follows the server when the check succeeds", () => {
    expect(resolveAccountOnboarded({ cached: false, deviceFlag: true, check: ok("beginner") })).toBe(true);
    // No row or a null level: an account that never onboarded, such as a
    // new Google identity on an install that has onboarded before.
    expect(resolveAccountOnboarded({ cached: false, deviceFlag: true, check: ok(null) })).toBe(false);
  });

  it("never routes to onboarding on an error when the device has onboarded", () => {
    expect(resolveAccountOnboarded({ cached: false, deviceFlag: true, check: error })).toBe(true);
  });

  it("falls back to the device flag on an error", () => {
    expect(resolveAccountOnboarded({ cached: false, deviceFlag: false, check: error })).toBe(false);
  });
});

describe("shouldCacheOnboarded", () => {
  it("caches only a confirmed yes", () => {
    expect(shouldCacheOnboarded(ok("intermediate"))).toBe(true);
    expect(shouldCacheOnboarded(ok(null))).toBe(false);
    expect(shouldCacheOnboarded(error)).toBe(false);
    expect(shouldCacheOnboarded(null)).toBe(false);
  });
});
