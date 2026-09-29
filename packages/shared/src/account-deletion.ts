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

/**
 * Set while the session on this device belongs to a guest (anonymous)
 * account. A guest that loses its session, because the account was
 * removed by the empty-guest cleanup or its refresh token was otherwise
 * rejected, has no way back in, so the app signs in a fresh guest instead
 * of showing sign-in. The flag is how the app knows the lost session was a
 * guest's: by the time `SIGNED_OUT` fires, the session is already gone.
 *
 * Under the `liftcamp:` prefix, so deleting an account and Start fresh
 * clear it before they sign out, and neither triggers a recovery.
 */
export const GUEST_SESSION_KEY = "liftcamp:guest-session";

/**
 * Whether to sign in a fresh guest: there is no session, the last one on
 * this device was a guest's, and a recovery is not already running.
 */
export function shouldRecoverGuest({
  hasSession,
  lastWasGuest,
  recovering,
}: {
  hasSession: boolean;
  lastWasGuest: boolean;
  recovering: boolean;
}): boolean {
  return !hasSession && lastWasGuest && !recovering;
}

/** What the app does with the guest flag for a session it has just seen. */
export function guestFlagFor(session: { user: { is_anonymous?: boolean } } | null): "set" | "clear" | "keep" {
  if (!session) return "keep";
  return session.user.is_anonymous ? "set" : "clear";
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

/** What the app shows whenever a delete did not go through. */
export const NOT_DELETED_TITLE = "Your account was not deleted";

/**
 * The fresh Apple sign-in before deleting an Apple account, reduced to
 * what the delete does next:
 * - `code`: send it, so the server can revoke the Apple token.
 * - `no-code`: Apple signed in but gave no code. Delete anyway; the server
 *   logs the revoke as not done.
 * - `cancelled`: the person closed Apple's sheet. Stop, silently.
 * - `failed`: anything else. Stop and say the account was not deleted.
 */
export type AppleReauth =
  | { kind: "code"; code: string }
  | { kind: "no-code" }
  | { kind: "cancelled" }
  | { kind: "failed"; message: string };

/**
 * expo-apple-authentication's `signInAsync` rejects with this code and
 * message when Apple's credential lacks the authorization code, identity
 * token or user (checked in its JS wrapper, 57.0.2). Of the three only the
 * code can plausibly be missing, so this counts as `no-code`.
 */
const MISSING_FIELDS_CODE = "ERR_REQUEST_FAILED";
const MISSING_FIELDS_MESSAGE = "missing one or more required fields";

export function classifyAppleReauth(
  result:
    | { credential: { authorizationCode?: string | null } }
    | { error: { code?: unknown; message?: unknown } | null | undefined },
): AppleReauth {
  if ("credential" in result) {
    const code = result.credential.authorizationCode;
    return typeof code === "string" && code ? { kind: "code", code } : { kind: "no-code" };
  }
  const code = typeof result.error?.code === "string" ? result.error.code : undefined;
  const message = typeof result.error?.message === "string" ? result.error.message : "";
  // Only Apple's own cancel is silent. Every other rejection is a failure.
  if (code === "ERR_REQUEST_CANCELED") return { kind: "cancelled" };
  if (code === MISSING_FIELDS_CODE && message.includes(MISSING_FIELDS_MESSAGE)) return { kind: "no-code" };
  return { kind: "failed", message: message || "Apple sign-in failed." };
}

/**
 * The function's answer, reduced to deleted or not. Only a body that says
 * `deleted: true` counts: an error, a missing body, or any other shape
 * means the account may still exist, and the app must say so.
 */
export function deleteConfirmed(response: { data: unknown; error: unknown }): boolean {
  if (response.error) return false;
  const data = response.data as { deleted?: unknown } | null | undefined;
  return !!data && typeof data === "object" && data.deleted === true;
}

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
