import { describe, expect, it } from "vitest";
import {
  atRoutineCap,
  planLabel,
  purchasesStep,
  resolvePlan,
  resolvePro,
  shouldCarryGuestPurchase,
  type RcEntitlement,
} from "./pro-entitlement";

const NOW = Date.parse("2026-11-05T12:00:00Z");
const FUTURE = "2026-12-12T12:00:00Z";
const PAST = "2026-10-01T12:00:00Z";

describe("resolvePro", () => {
  it("a tester row grants Pro", () => {
    const rows = [{ is_pro: true, expires_at: null, source: "tester" }];
    expect(resolvePro({ rcActive: [], rows, now: NOW })).toBe(true);
  });
  it("a promotional lifetime row grants Pro", () => {
    const rows = [{ is_pro: true, expires_at: null, source: "promotional", product_id: "rc_promo_pro_lifetime" }];
    expect(resolvePro({ rcActive: [], rows, now: NOW })).toBe(true);
  });
  it("an expired purchase row does not", () => {
    const rows = [{ is_pro: true, expires_at: PAST, source: "app_store", product_id: "pro_yearly" }];
    expect(resolvePro({ rcActive: [], rows, now: NOW })).toBe(false);
  });
  it("a row with is_pro false does not", () => {
    expect(resolvePro({ rcActive: [], rows: [{ is_pro: false, expires_at: FUTURE }], now: NOW })).toBe(false);
  });
  it("RevenueCat active with no row grants Pro", () => {
    expect(resolvePro({ rcActive: ["pro"], rows: [], now: NOW })).toBe(true);
  });
  it("RevenueCat inactive with an active row grants Pro", () => {
    expect(resolvePro({ rcActive: [], rows: [{ is_pro: true, expires_at: FUTURE }], now: NOW })).toBe(true);
  });
  it("Android, with no RevenueCat, follows the rows", () => {
    expect(resolvePro({ rcActive: null, rows: [{ is_pro: true, expires_at: null }], now: NOW })).toBe(true);
    expect(resolvePro({ rcActive: null, rows: [], now: NOW })).toBe(false);
  });
  it("another entitlement id is not Pro", () => {
    expect(resolvePro({ rcActive: ["gold"], rows: [], now: NOW })).toBe(false);
  });
});

const rc = (over: Partial<RcEntitlement>): RcEntitlement => ({
  productIdentifier: "pro_yearly",
  periodType: "NORMAL",
  expirationDate: FUTURE,
  willRenew: true,
  ...over,
});

describe("resolvePlan and planLabel", () => {
  const label = (args: Parameters<typeof resolvePlan>[0]) => {
    const plan = resolvePlan(args);
    return plan ? planLabel(plan) : null;
  };
  it("names a renewing yearly plan", () => {
    expect(label({ rc: rc({}), row: null, now: NOW })).toBe("Yearly, renews 12 Dec 2026");
  });
  it("names a monthly plan that will not renew", () => {
    expect(label({ rc: rc({ productIdentifier: "pro_monthly", willRenew: false }), row: null, now: NOW })).toBe(
      "Monthly, ends 12 Dec 2026",
    );
  });
  it("names a trial without the year", () => {
    expect(label({ rc: rc({ periodType: "TRIAL", expirationDate: "2026-11-12T12:00:00Z" }), row: null, now: NOW })).toBe(
      "Free trial, ends 12 Nov",
    );
  });
  it("names lifetime", () => {
    const plan = resolvePlan({
      rc: rc({ productIdentifier: "pro_lifetime", expirationDate: null, willRenew: false }),
      row: null,
      now: NOW,
    });
    expect(plan?.lifetime).toBe(true);
    expect(plan && planLabel(plan)).toBe("Lifetime");
  });
  it("names a tester row, with or without an expiry", () => {
    expect(label({ rc: null, row: { is_pro: true, expires_at: null, source: "tester" }, now: NOW })).toBe("Tester");
    expect(label({ rc: null, row: { is_pro: true, expires_at: FUTURE, source: "tester" }, now: NOW })).toBe("Tester");
  });
  it("prefers RevenueCat over a tester row", () => {
    expect(label({ rc: rc({}), row: { is_pro: true, expires_at: null, source: "tester" }, now: NOW })).toBe(
      "Yearly, renews 12 Dec 2026",
    );
  });
  it("says until when only a purchase row is known", () => {
    const row = { is_pro: true, expires_at: FUTURE, source: "app_store", product_id: "pro_yearly" };
    expect(label({ rc: null, row, now: NOW })).toBe("Yearly, until 12 Dec 2026");
  });
  it("has no plan without Pro", () => {
    expect(resolvePlan({ rc: null, row: { is_pro: true, expires_at: PAST }, now: NOW })).toBeNull();
    expect(resolvePlan({ rc: null, row: null, now: NOW })).toBeNull();
  });
});

describe("atRoutineCap", () => {
  it("stops the fourth, and anyone already over", () => {
    expect(atRoutineCap(2)).toBe(false);
    expect(atRoutineCap(3)).toBe(true);
    expect(atRoutineCap(5)).toBe(true);
  });
});

describe("purchasesStep", () => {
  const fresh = { configured: false, sdkUser: null, current: null };
  const on = { configured: true, sdkUser: "a", current: "a" };
  it("configures with the first user, and waits while signed out", () => {
    expect(purchasesStep(fresh, "a")).toEqual({ kind: "configure", userId: "a" });
    expect(purchasesStep(fresh, null)).toEqual({ kind: "none" });
  });
  it("does nothing for the same user", () => {
    expect(purchasesStep(on, "a")).toEqual({ kind: "none" });
  });
  it("logs in a different user: a sign-in, a switch, a guest merge", () => {
    expect(purchasesStep(on, "b")).toEqual({ kind: "logIn", userId: "b" });
  });
  it("never logs out: a sign-out only clears", () => {
    expect(purchasesStep(on, null)).toEqual({ kind: "clear" });
  });
  it("logs in the fresh guest after a sign-out or a deletion", () => {
    expect(purchasesStep({ configured: true, sdkUser: "a", current: null }, "guest")).toEqual({
      kind: "logIn",
      userId: "guest",
    });
  });
  it("refreshes when the same user signs back in", () => {
    expect(purchasesStep({ configured: true, sdkUser: "a", current: null }, "a")).toEqual({
      kind: "refresh",
      userId: "a",
    });
  });
  it("tries a login again when the last one failed offline", () => {
    expect(purchasesStep({ configured: true, sdkUser: "a", current: "b" }, "b")).toEqual({ kind: "logIn", userId: "b" });
  });
});

describe("shouldCarryGuestPurchase", () => {
  const base = { previousUserId: "g", previousWasGuest: true, nextUserId: "a", nextIsPro: false };
  it("carries a guest into a free account", () => {
    expect(shouldCarryGuestPurchase(base)).toBe(true);
  });
  it("skips an account already Pro", () => {
    expect(shouldCarryGuestPurchase({ ...base, nextIsPro: true })).toBe(false);
  });
  it("never moves a purchase between two real accounts", () => {
    expect(shouldCarryGuestPurchase({ ...base, previousWasGuest: false })).toBe(false);
  });
});
