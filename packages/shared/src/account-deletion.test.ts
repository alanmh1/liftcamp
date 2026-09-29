import { describe, expect, it } from "vitest";

import {
  deleteAccountConfirmation,
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
