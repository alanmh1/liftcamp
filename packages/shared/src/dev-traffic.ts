// Keeping dev and Simulator traffic out of analytics and the new-user email
// (docs/dev-traffic-filter.sql). The rules live here so both apps and the
// tests read the same ones; each app supplies its own inputs.

export type BuildEnv = "dev" | "prod";

/**
 * A dev build is a debug build (`__DEV__`) or any build on a Simulator or
 * emulator, Release config included. A Release build on a real phone
 * (TestFlight, a tester's preview APK) cannot be told from a store install
 * in JS and counts as prod; the team's emails already leave those out.
 */
export function isDevBuildFrom(input: { dev: boolean; isDevice: boolean }): boolean {
  return input.dev || !input.isDevice;
}

/**
 * User metadata for a sign-in that can create an account. Supabase stores
 * it in `auth.users.raw_user_meta_data`, where `notify_admin_new_user`
 * skips `env = 'dev'` and `dev_user_ids()` reads it.
 */
export function signInMeta(dev: boolean, platform: string): { env: BuildEnv; platform: string } {
  return { env: dev ? "dev" : "prod", platform };
}

/** How close `created_at` and `last_sign_in_at` are on a user that was just made. */
const NEW_USER_WINDOW_MS = 60_000;

/**
 * Whether the sign-in that returned this user also created it. Supabase
 * sets `created_at` and `last_sign_in_at` together on a new user and moves
 * only `last_sign_in_at` on later sign-ins. Both are server times, so the
 * phone's clock does not matter.
 */
export function isNewUser(user: { created_at?: string | null; last_sign_in_at?: string | null }): boolean {
  if (!user.created_at || !user.last_sign_in_at) return false;
  const created = Date.parse(user.created_at);
  const signedIn = Date.parse(user.last_sign_in_at);
  if (Number.isNaN(created) || Number.isNaN(signedIn)) return false;
  return Math.abs(signedIn - created) < NEW_USER_WINDOW_MS;
}

/**
 * Web hosts whose page views are the team's own: local dev servers and
 * Vercel preview deployments. The production hosts (liftcamp.app, www) are
 * not internal, and neither is `liftcamp.vercel.app`, the production
 * deployment's own alias.
 */
export function isInternalHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "127.0.0.1" || host === "[::1]" || host === "::1" || host === "0.0.0.0") return true;
  if (host.endsWith(".vercel.app")) return host !== "liftcamp.vercel.app";
  return false;
}
