// In-app account deletion: what the confirmation says, and what the app
// clears from the device once the server has deleted the account.
//
// The deletion itself runs in the `delete-account` Edge Function
// (supabase/functions/delete-account). Every per-user table has a CASCADE
// key to auth.users, so deleting the auth user removes the rest.

/** Every key the app writes to device storage starts with this. */
export const APP_STORAGE_PREFIX = "liftcamp:";

/**
 * Keys that describe the device, not the account, and survive a deletion.
 * The theme is the only one: a person who deletes their account and starts
 * again on the same phone keeps the appearance they picked.
 */
export const DEVICE_STORAGE_KEYS: readonly string[] = ["liftcamp:theme"];

/**
 * The stored keys to remove after a deletion: every `liftcamp:` key except
 * the device ones. That covers the onboarded flag and the per-account
 * `liftcamp:onboarded:<userId>` cache, so the next launch starts onboarding
 * the way a fresh install does. Keys outside the prefix are left alone; the
 * Supabase session key is removed by signing out, not here.
 */
export function storageKeysToClear(keys: readonly string[]): string[] {
  return keys.filter((k) => k.startsWith(APP_STORAGE_PREFIX) && !DEVICE_STORAGE_KEYS.includes(k));
}

/** What the Edge Function returns on success. */
export type DeleteAccountResponse = {
  deleted: true;
  /**
   * What happened to the Apple token. `none` for an account with no Apple
   * identity; `failed` still deleted the account, and the reason is in the
   * function's logs.
   */
  apple: "none" | "revoked" | "failed";
  /**
   * The confirmation email. `skipped` for guests, Apple private relay
   * addresses and suppressed addresses; `failed` still deleted the account.
   */
  email: "sent" | "skipped" | "failed";
};

/** The body the app sends. The code comes from a fresh Apple sign-in. */
export type DeleteAccountRequest = {
  appleAuthorizationCode?: string;
};

const DELETED_DATA =
  "your profile, workouts, sets, routines, shared routine links, PR goals and usage history";

/**
 * The destructive confirmation. A guest account has nothing to sign back
 * into, and an Apple account is asked to confirm with Apple next, so the
 * body says so.
 */
export function deleteAccountConfirmation({
  anonymous,
  apple,
}: {
  anonymous: boolean;
  apple: boolean;
}): { title: string; message: string } {
  const what = anonymous
    ? `This permanently deletes this guest account and ${DELETED_DATA}.`
    : `This permanently deletes ${DELETED_DATA}.`;
  const next = apple ? " Apple will ask you to confirm next." : "";
  return {
    title: "Delete your account?",
    message: `${what} It cannot be undone.${next}`,
  };
}
