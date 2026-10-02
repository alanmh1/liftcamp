// Which session the app runs on when the network cannot confirm one.
//
// supabase-js (auth-js 2.116) refreshes an expired access token inside
// getSession(). With no signal the refresh fails with a retryable fetch
// error, getSession() answers `session: null`, and the INITIAL_SESSION event
// carries null too, yet the session is still in storage and still good the
// moment the phone is back online. Taking that null at its word signed the
// user out (or, for a guest, tried to sign in a new one) every time the app
// opened offline after an hour. These rules keep the stored session unless
// the auth server has actually refused it.

/** The parts of a stored session the app relies on. */
export type StoredSession = {
  access_token: string;
  refresh_token: string;
  /** Epoch seconds. */
  expires_at?: number;
  user: { id: string };
};

/**
 * Where supabase-js keeps the session: `sb-<project ref>-auth-token`, the
 * ref being the first label of the project URL's host. Mirrors its default
 * (`defaultStorageKey` in SupabaseClient); the app sets no storageKey.
 */
export function supabaseStorageKey(supabaseUrl: string): string {
  return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
}

/** The stored session, when the stored value is one. */
export function parseStoredSession<S extends StoredSession = StoredSession>(raw: string | null): S | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Partial<StoredSession> | null;
    if (!s || typeof s.access_token !== "string" || typeof s.refresh_token !== "string") return null;
    if (!s.user || typeof s.user.id !== "string") return null;
    return s as S;
  } catch {
    return null;
  }
}

/** Whether an auth error is a request that got no usable answer (auth-js `AuthRetryableFetchError`). */
export function isRetryableAuthError(error: { name?: string } | null | undefined): boolean {
  return error?.name === "AuthRetryableFetchError";
}

/**
 * The session to run on after getSession() answers. Its session when it
 * has one. When it has none: the stored session if the failure was the
 * network's (retryable), since the auth server never said no; otherwise
 * none, which is a real sign-out (a refused refresh token, or nothing
 * stored).
 */
export function sessionToKeep<S>(
  loaded: { session: S | null; error: { name?: string } | null },
  stored: S | null,
): S | null {
  if (loaded.session) return loaded.session;
  if (stored && isRetryableAuthError(loaded.error)) return stored;
  return null;
}

/**
 * What an auth event means for anything that follows the signed-in user
 * (the write queue): a session to follow, a sign-out, or nothing to act on.
 * INITIAL_SESSION with null is what an expired token with no signal looks
 * like, so only SIGNED_OUT lets go of the user.
 */
export function authEventUser(event: string, session: { user: { id: string } } | null): string | null | "keep" {
  if (session) return session.user.id;
  return event === "SIGNED_OUT" ? null : "keep";
}

export const OFFLINE_SIGN_IN_MESSAGE = "You're offline. Connect to continue.";

/**
 * Messages a sign-in shows when the request never reached a server: React
 * Native's fetch, the browser's, iOS's URL loading system (Google's SDK
 * passes it through), and Google's Android SDK.
 */
const OFFLINE_PATTERNS = [
  /network request failed/i,
  /failed to fetch/i,
  /internet connection appears to be offline/i,
  /a network error occurred/i,
  /network connection was lost/i,
];

/** The message a sign-in screen shows for an error: the offline line when there was no network, else the error as it came. */
export function signInErrorText(message: string | null | undefined): string | null {
  if (!message) return null;
  return OFFLINE_PATTERNS.some((p) => p.test(message)) ? OFFLINE_SIGN_IN_MESSAGE : message;
}
