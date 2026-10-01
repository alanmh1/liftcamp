import { describe, expect, it } from "vitest";

import {
  bearerToken,
  checkTarget,
  decideGuest,
  guestTokenFrom,
  refusalForSqlState,
  unverifiedSubject,
} from "../../../supabase/functions/merge-guest/decide";

// The merge-guest Edge Function's decisions. The function deploys with
// verify_jwt off, so these are the only checks between a request and a merge.

const TARGET = "11111111-1111-4111-8111-111111111111";
const GUEST = "22222222-2222-4222-8222-222222222222";

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function base64Url(text: string): string {
  const bytes = Array.from(unescape(encodeURIComponent(text)), (ch) => ch.charCodeAt(0));
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += B64[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += B64[n & 63];
  }
  return out;
}

/** An unsigned token with these claims. The signature is never read here. */
function jwt(claims: Record<string, unknown>): string {
  return `${base64Url(JSON.stringify({ alg: "ES256", typ: "JWT" }))}.${base64Url(JSON.stringify(claims))}.sig`;
}

describe("bearerToken", () => {
  it("reads a bearer token", () => {
    expect(bearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
    expect(bearerToken("bearer abc")).toBe("abc");
  });
  it("refuses anything else", () => {
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken("")).toBeNull();
    expect(bearerToken("Basic abc")).toBeNull();
    expect(bearerToken("Bearer ")).toBeNull();
    expect(bearerToken("Bearer a b")).toBeNull();
  });
});

describe("guestTokenFrom", () => {
  it("reads the guest token", () => {
    expect(guestTokenFrom({ guestAccessToken: "t" })).toBe("t");
  });
  it("refuses a missing, empty or non-string token", () => {
    expect(guestTokenFrom(null)).toBeNull();
    expect(guestTokenFrom({})).toBeNull();
    expect(guestTokenFrom({ guestAccessToken: "" })).toBeNull();
    expect(guestTokenFrom({ guestAccessToken: 42 })).toBeNull();
    expect(guestTokenFrom("guestAccessToken")).toBeNull();
  });
});

describe("checkTarget", () => {
  it("refuses a caller whose token did not verify", () => {
    expect(checkTarget(null)).toEqual({ status: 401, error: "not_signed_in" });
  });
  it("refuses a guest as the account", () => {
    expect(checkTarget({ id: TARGET, is_anonymous: true })).toEqual({ status: 403, error: "account_is_guest" });
  });
  it("lets a full account through", () => {
    expect(checkTarget({ id: TARGET, is_anonymous: false })).toBeNull();
    expect(checkTarget({ id: TARGET })).toBeNull();
  });
});

describe("decideGuest", () => {
  it("merges when the guest verified, is anonymous and is another user", () => {
    expect(
      decideGuest({ targetId: TARGET, guest: { id: GUEST, is_anonymous: true }, unverifiedGuestId: null }),
    ).toEqual({ kind: "merge", guestId: GUEST, targetId: TARGET });
  });

  it("refuses the caller's own id as the guest", () => {
    expect(
      decideGuest({ targetId: TARGET, guest: { id: TARGET, is_anonymous: true }, unverifiedGuestId: null }),
    ).toEqual({ kind: "refuse", refusal: { status: 400, error: "same_account" } });
    expect(
      decideGuest({ targetId: TARGET, guest: { id: TARGET, is_anonymous: false }, unverifiedGuestId: null }),
    ).toEqual({ kind: "refuse", refusal: { status: 400, error: "same_account" } });
  });

  it("refuses a guest token that belongs to a full account", () => {
    expect(
      decideGuest({ targetId: TARGET, guest: { id: GUEST, is_anonymous: false }, unverifiedGuestId: null }),
    ).toEqual({ kind: "refuse", refusal: { status: 403, error: "not_a_guest" } });
    expect(decideGuest({ targetId: TARGET, guest: { id: GUEST }, unverifiedGuestId: null })).toEqual({
      kind: "refuse",
      refusal: { status: 403, error: "not_a_guest" },
    });
  });

  it("never merges on a guest token that did not verify, only reads the ledger", () => {
    expect(decideGuest({ targetId: TARGET, guest: null, unverifiedGuestId: GUEST })).toEqual({
      kind: "ledger",
      guestId: GUEST,
      targetId: TARGET,
    });
  });

  it("refuses an unverified token with no user id, or the caller's own", () => {
    expect(decideGuest({ targetId: TARGET, guest: null, unverifiedGuestId: null })).toEqual({
      kind: "refuse",
      refusal: { status: 401, error: "guest_session_invalid" },
    });
    expect(decideGuest({ targetId: TARGET, guest: null, unverifiedGuestId: TARGET })).toEqual({
      kind: "refuse",
      refusal: { status: 401, error: "guest_session_invalid" },
    });
  });
});

describe("refusalForSqlState", () => {
  it("maps the function's raised codes", () => {
    expect(refusalForSqlState("42501")).toEqual({ status: 403, error: "refused" });
    expect(refusalForSqlState("P0002")).toEqual({ status: 410, error: "guest_gone" });
  });
  it("treats anything else as a failure worth retrying", () => {
    expect(refusalForSqlState("55000")).toEqual({ status: 500, error: "merge_failed" });
    expect(refusalForSqlState("22023")).toEqual({ status: 500, error: "merge_failed" });
    expect(refusalForSqlState(undefined)).toEqual({ status: 500, error: "merge_failed" });
  });
});

describe("unverifiedSubject", () => {
  it("reads a user id sub", () => {
    expect(unverifiedSubject(jwt({ sub: GUEST, is_anonymous: true }))).toBe(GUEST);
  });
  it("returns null for a sub that is not a user id", () => {
    expect(unverifiedSubject(jwt({ sub: "service_role" }))).toBeNull();
    expect(unverifiedSubject(jwt({ sub: 7 }))).toBeNull();
    expect(unverifiedSubject(jwt({}))).toBeNull();
  });
  it("returns null for anything that is not a token", () => {
    expect(unverifiedSubject("")).toBeNull();
    expect(unverifiedSubject("a.b")).toBeNull();
    expect(unverifiedSubject("a.!!!.c")).toBeNull();
    expect(unverifiedSubject(`a.${base64Url("not json")}.c`)).toBeNull();
  });
});
