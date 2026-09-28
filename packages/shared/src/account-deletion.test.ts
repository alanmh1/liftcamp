import { describe, expect, it } from "vitest";

import { deleteAccountConfirmation, storageKeysToClear } from "./account-deletion";

describe("storageKeysToClear", () => {
  it("clears the onboarded flag and every per-account cache", () => {
    const keys = [
      "liftcamp:onboarded",
      "liftcamp:onboarded:9f3c0e2a-1111-4222-8333-444455556666",
      "liftcamp:onboarded:0b7d1f4e-aaaa-4bbb-8ccc-ddddeeeeffff",
    ];
    expect(storageKeysToClear(keys)).toEqual(keys);
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
