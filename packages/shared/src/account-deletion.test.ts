import { describe, expect, it } from "vitest";

import {
  classifyAppleReauth,
  deleteAccountConfirmation,
  deleteConfirmed,
  GUEST_SESSION_KEY,
  guestFlagFor,
  shouldRecoverGuest,
  storageKeysToClear,
} from "./account-deletion";

describe("storageKeysToClear", () => {
  it("clears the onboarded flag and every per-account cache", () => {
    const keys = [
      "liftcamp:onboarded",
      "liftcamp:onboarded:9f3c0e2a-1111-4222-8333-444455556666",
      "liftcamp:onboarded:0b7d1f4e-aaaa-4bbb-8ccc-ddddeeeeffff",
    ];
    expect(storageKeysToClear(keys)).toEqual(keys);
  });

  it("clears the guest flag, so a delete never triggers a guest recovery", () => {
    expect(storageKeysToClear([GUEST_SESSION_KEY])).toEqual([GUEST_SESSION_KEY]);
  });

  it("keeps the theme", () => {
    expect(storageKeysToClear(["liftcamp:theme", "liftcamp:onboarded"])).toEqual(["liftcamp:onboarded"]);
  });

  it("leaves keys outside the prefix, including the Supabase session", () => {
    expect(
      storageKeysToClear(["sb-mnsigwjyskxfuszeegtp-auth-token", "liftcamp", "other:onboarded"]),
    ).toEqual([]);
  });

  it("does not treat a key that only starts like the theme as the theme", () => {
    expect(storageKeysToClear(["liftcamp:theme:old"])).toEqual(["liftcamp:theme:old"]);
  });
});

describe("deleteAccountConfirmation", () => {
  it("names the guest account for a guest", () => {
    const { message } = deleteAccountConfirmation({ anonymous: true, apple: false });
    expect(message).toMatch(/^This permanently deletes this guest account and your profile, workouts/);
    expect(message).toMatch(/It cannot be undone\.$/);
  });

  it("warns an Apple account about the second prompt", () => {
    const { message } = deleteAccountConfirmation({ anonymous: false, apple: true });
    expect(message).toMatch(/^This permanently deletes your profile/);
    expect(message).toMatch(/Apple will ask you to confirm next\.$/);
  });

  it("lists shared routine links, matching the privacy page", () => {
    const { message } = deleteAccountConfirmation({ anonymous: false, apple: false });
    expect(message).toContain("shared routine links");
  });

  it("uses no em dashes", () => {
    for (const anonymous of [true, false]) {
      for (const apple of [true, false]) {
        const { title, message } = deleteAccountConfirmation({ anonymous, apple });
        expect(`${title} ${message}`).not.toContain("—");
      }
    }
  });
});

describe("shouldRecoverGuest", () => {
  it("recovers a lost guest session", () => {
    expect(shouldRecoverGuest({ hasSession: false, lastWasGuest: true, recovering: false })).toBe(true);
  });

  it("leaves a real account's sign-out alone", () => {
    expect(shouldRecoverGuest({ hasSession: false, lastWasGuest: false, recovering: false })).toBe(false);
  });

  it("does nothing while signed in", () => {
    expect(shouldRecoverGuest({ hasSession: true, lastWasGuest: true, recovering: false })).toBe(false);
  });

  it("does not start a second recovery", () => {
    expect(shouldRecoverGuest({ hasSession: false, lastWasGuest: true, recovering: true })).toBe(false);
  });
});

describe("guestFlagFor", () => {
  it("sets the flag for a guest session", () => {
    expect(guestFlagFor({ user: { is_anonymous: true } })).toBe("set");
  });

  it("clears it for a real account, including a guest that just linked one", () => {
    expect(guestFlagFor({ user: { is_anonymous: false } })).toBe("clear");
    expect(guestFlagFor({ user: {} })).toBe("clear");
  });

  it("keeps it when the session is gone, so the loss can be recognized", () => {
    expect(guestFlagFor(null)).toBe("keep");
  });
});

describe("classifyAppleReauth", () => {
  it("sends the code when Apple gives one", () => {
    expect(classifyAppleReauth({ credential: { authorizationCode: "c1" } })).toEqual({ kind: "code", code: "c1" });
  });

  it("deletes without a code when Apple gives none", () => {
    expect(classifyAppleReauth({ credential: { authorizationCode: null } })).toEqual({ kind: "no-code" });
    expect(classifyAppleReauth({ credential: { authorizationCode: "" } })).toEqual({ kind: "no-code" });
  });

  it("treats the library's missing-fields rejection as no code", () => {
    const error = {
      code: "ERR_REQUEST_FAILED",
      message: "The credential returned by `signInAsync` is missing one or more required fields.",
    };
    expect(classifyAppleReauth({ error })).toEqual({ kind: "no-code" });
  });

  it("is silent only for Apple's own cancel", () => {
    expect(classifyAppleReauth({ error: { code: "ERR_REQUEST_CANCELED" } })).toEqual({ kind: "cancelled" });
  });

  it("fails every other rejection, so the app says the account was not deleted", () => {
    for (const code of [
      "ERR_REQUEST_UNKNOWN",
      "ERR_REQUEST_FAILED",
      "ERR_REQUEST_NOT_HANDLED",
      "ERR_INVALID_RESPONSE",
      "ERR_REQUEST_NOT_INTERACTIVE",
      undefined,
    ]) {
      expect(classifyAppleReauth({ error: { code, message: "x" } }).kind).toBe("failed");
    }
    expect(classifyAppleReauth({ error: null }).kind).toBe("failed");
    expect(classifyAppleReauth({ error: { code: 42 } }).kind).toBe("failed");
  });
});

describe("deleteConfirmed", () => {
  it("accepts only deleted: true", () => {
    expect(deleteConfirmed({ data: { deleted: true, apple: "failed", email: "skipped" }, error: null })).toBe(true);
  });

  it("rejects an error even with a body", () => {
    expect(deleteConfirmed({ data: { deleted: true }, error: new Error("500") })).toBe(false);
  });

  it("rejects a 2xx without a confirmed delete", () => {
    for (const data of [null, undefined, "", "ok", {}, { deleted: false }, { deleted: "true" }, { error: "delete_failed" }]) {
      expect(deleteConfirmed({ data, error: null })).toBe(false);
    }
  });
});
