import { describe, expect, it } from "vitest";

import {
  OFFLINE_SIGN_IN_MESSAGE,
  authEventUser,
  parseStoredSession,
  sessionToKeep,
  signInErrorText,
  supabaseStorageKey,
} from "./auth-session";

const stored = { access_token: "old", refresh_token: "r1", expires_at: 1, user: { id: "u1" } };
const fresh = { ...stored, access_token: "new", expires_at: 9_999_999_999 };
const retryable = { name: "AuthRetryableFetchError", message: "Network request failed", status: 0 };
const refused = { name: "AuthApiError", message: "Invalid Refresh Token: Refresh Token Not Found", status: 400 };

describe("sessionToKeep", () => {
  it("keeps the stored session when the refresh failed for want of a network", () => {
    expect(sessionToKeep({ session: null, error: retryable }, stored)).toBe(stored);
  });

  it("signs out when the auth server refused the refresh", () => {
    expect(sessionToKeep({ session: null, error: refused }, stored)).toBeNull();
  });

  it("signs out when nothing is stored, whatever the error", () => {
    expect(sessionToKeep({ session: null, error: retryable }, null)).toBeNull();
    expect(sessionToKeep({ session: null, error: null }, null)).toBeNull();
  });

  it("signs out when getSession answered no session without an error (storage was cleared)", () => {
    expect(sessionToKeep({ session: null, error: null }, stored)).toBeNull();
  });

  it("takes getSession's session when it has one, such as a refreshed token", () => {
    expect(sessionToKeep({ session: fresh, error: null }, stored)).toBe(fresh);
  });
});

describe("authEventUser", () => {
  it("follows a session from any event", () => {
    expect(authEventUser("TOKEN_REFRESHED", fresh)).toBe("u1");
    expect(authEventUser("INITIAL_SESSION", fresh)).toBe("u1");
  });

  it("lets go of the user only on a sign-out", () => {
    expect(authEventUser("SIGNED_OUT", null)).toBeNull();
    expect(authEventUser("INITIAL_SESSION", null)).toBe("keep");
  });
});

describe("parseStoredSession", () => {
  it("reads a stored session", () => {
    expect(parseStoredSession(JSON.stringify(stored))).toEqual(stored);
  });

  it.each([null, "", "{", "null", "{}", JSON.stringify({ ...stored, user: null }), JSON.stringify({ ...stored, refresh_token: 1 })])(
    "rejects %s",
    (raw) => {
      expect(parseStoredSession(raw)).toBeNull();
    },
  );
});

describe("supabaseStorageKey", () => {
  it("is supabase-js's default key for the project", () => {
    expect(supabaseStorageKey("https://mnsigwjyskxfuszeegtp.supabase.co")).toBe("sb-mnsigwjyskxfuszeegtp-auth-token");
  });
});

describe("signInErrorText", () => {
  it.each([
    "Network request failed",
    "TypeError: Failed to fetch",
    "The Internet connection appears to be offline.",
    "A network error occurred.",
    "The network connection was lost.",
  ])("says offline for %s", (message) => {
    expect(signInErrorText(message)).toBe(OFFLINE_SIGN_IN_MESSAGE);
  });

  it("passes other errors through, and nothing as nothing", () => {
    expect(signInErrorText("Email rate limit exceeded")).toBe("Email rate limit exceeded");
    expect(signInErrorText(null)).toBeNull();
  });
});
