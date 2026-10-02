import { describe, expect, it } from "vitest";

import {
  entitlementActive,
  entitlementAfterRead,
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
  it("takes the row a successful read returned, or none", () => {
    expect(entitlementAfterRead({ ok: true, row: null })).toBeNull();
    const row = { is_pro: true, expires_at: "2027-01-01T00:00:00Z" };
    expect(entitlementAfterRead({ ok: true, row })).toEqual(row);
  });

  it("is null on a failed read: fail closed", () => {
    expect(entitlementAfterRead({ ok: false })).toBeNull();
  });
});

describe("testerProKey", () => {
  it("is per user under the app prefix", () => {
    expect(testerProKey("abc")).toBe("liftcamp:tester-pro:abc");
  });
});
