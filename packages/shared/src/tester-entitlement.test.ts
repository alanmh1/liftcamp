import { describe, expect, it } from "vitest";

import {
  entitlementActive,
  entitlementAfterRead,
  entitlementOnUser,
  parseEntitlementCache,
  testerProKey,
} from "./tester-entitlement";

const NOW = Date.parse("2026-10-03T12:00:00Z");

describe("entitlementActive", () => {
  it("is false with no row", () => {
    expect(entitlementActive(null, NOW)).toBe(false);
    expect(entitlementActive(undefined, NOW)).toBe(false);
  });

  it("is false when is_pro is false, whatever the expiry", () => {
    expect(entitlementActive({ is_pro: false, expires_at: null }, NOW)).toBe(false);
    expect(entitlementActive({ is_pro: false, expires_at: "2027-01-01T00:00:00Z" }, NOW)).toBe(false);
  });

  it("is true with no expiry", () => {
    expect(entitlementActive({ is_pro: true, expires_at: null }, NOW)).toBe(true);
  });

  it("is true before the expiry and false at or after it", () => {
    expect(entitlementActive({ is_pro: true, expires_at: "2026-10-03T12:00:01Z" }, NOW)).toBe(true);
    expect(entitlementActive({ is_pro: true, expires_at: "2026-10-03T12:00:00Z" }, NOW)).toBe(false);
    expect(entitlementActive({ is_pro: true, expires_at: "2026-10-01T00:00:00Z" }, NOW)).toBe(false);
  });

  it("is false for an expiry that does not parse", () => {
    expect(entitlementActive({ is_pro: true, expires_at: "soon" }, NOW)).toBe(false);
  });
});

describe("parseEntitlementCache", () => {
  it("round-trips a row", () => {
    const row = { is_pro: true, expires_at: "2027-01-01T00:00:00Z" };
    expect(parseEntitlementCache(JSON.stringify(row))).toEqual(row);
    expect(parseEntitlementCache(JSON.stringify({ is_pro: true, expires_at: null }))).toEqual({
      is_pro: true,
      expires_at: null,
    });
  });

  it("is null for nothing, junk and the wrong shape", () => {
    expect(parseEntitlementCache(null)).toBeNull();
    expect(parseEntitlementCache("")).toBeNull();
    expect(parseEntitlementCache("{")).toBeNull();
    expect(parseEntitlementCache("true")).toBeNull();
    expect(parseEntitlementCache(JSON.stringify({ is_pro: "yes", expires_at: null }))).toBeNull();
    expect(parseEntitlementCache(JSON.stringify({ is_pro: true, expires_at: 5 }))).toBeNull();
  });
});

describe("entitlementAfterRead", () => {
  const cached = { is_pro: true, expires_at: null };

  it("keeps the cached grant on a failed read", () => {
    expect(entitlementAfterRead({ ok: false }, cached)).toEqual(cached);
  });

  it("stays without a grant on a failed read with nothing cached", () => {
    const row = entitlementAfterRead({ ok: false }, null);
    expect(row).toBeNull();
    expect(entitlementActive(row, NOW)).toBe(false);
  });

  it("clears the cached grant when a successful read finds no row", () => {
    expect(entitlementAfterRead({ ok: true, row: null }, cached)).toBeNull();
  });

  it("takes the row a successful read returned over the cache", () => {
    const row = { is_pro: true, expires_at: "2027-01-01T00:00:00Z" };
    expect(entitlementAfterRead({ ok: true, row }, cached)).toEqual(row);
  });

  it("still closes a cached grant past its expiry, offline", () => {
    const expired = { is_pro: true, expires_at: "2026-10-01T00:00:00Z" };
    expect(entitlementActive(entitlementAfterRead({ ok: false }, expired), NOW)).toBe(false);
  });
});

describe("entitlementOnUser", () => {
  const held = { userId: "a", row: { is_pro: true, expires_at: null } };

  it("keeps everything for the same user", () => {
    expect(entitlementOnUser(held, { userId: "a", isGuest: false })).toEqual({ state: held, dropCacheFor: null });
  });

  it("clears the grant and drops the old cache when the user changes", () => {
    expect(entitlementOnUser(held, { userId: "b", isGuest: false })).toEqual({
      state: { userId: "b", row: null },
      dropCacheFor: "a",
    });
  });

  it("clears the grant and drops the cache on sign-out", () => {
    expect(entitlementOnUser(held, { userId: null, isGuest: false })).toEqual({
      state: { userId: null, row: null },
      dropCacheFor: "a",
    });
  });

  it("holds nobody for a guest", () => {
    expect(entitlementOnUser(held, { userId: "g", isGuest: true })).toEqual({
      state: { userId: null, row: null },
      dropCacheFor: "a",
    });
    const none = { userId: null, row: null };
    expect(entitlementOnUser(none, { userId: "g", isGuest: true })).toEqual({ state: none, dropCacheFor: null });
  });

  it("starts a guest who links an account from no grant, with nothing to drop", () => {
    const none = { userId: null, row: null };
    expect(entitlementOnUser(none, { userId: "g", isGuest: false })).toEqual({
      state: { userId: "g", row: null },
      dropCacheFor: null,
    });
  });
});

describe("testerProKey", () => {
  it("is per user under the app prefix", () => {
    expect(testerProKey("abc")).toBe("liftcamp:tester-pro:abc");
  });
});
