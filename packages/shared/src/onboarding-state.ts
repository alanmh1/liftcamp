/**
 * Whether a signed-in account has finished onboarding, decided from what
 * the app knows at launch. The mobile OnboardingProvider feeds it; kept
 * pure here so every branch is tested.
 *
 * The real signal is `user_profiles.training_level`, which onboarding
 * writes on page 3: a missing row or a null level means not onboarded.
 * Reading it is a network call, so a confirmed yes is cached per account
 * on the device, and a cold start with the cache set never waits on it.
 */

/** The account read. `error` covers a failed request, including no signal. */
export type OnboardingCheck = { status: "ok"; level: string | null } | { status: "error" };

export function resolveAccountOnboarded({
  cached,
  deviceFlag,
  check,
}: {
  /** The per-account cache. Only a confirmed yes is ever written. */
  cached: boolean;
  /** The install-wide "finished onboarding once" flag. */
  deviceFlag: boolean;
  /** The account read, or null when it was not needed. */
  check: OnboardingCheck | null;
}): boolean {
  if (cached) return true;
  if (check?.status === "ok") return check.level != null;
  // No answer from the server. An error must never send someone who has
  // onboarded back through the flow, so fall back to what the device knows.
  // The account read only runs with the device flag set, so in practice
  // this is true.
  return deviceFlag;
}

/** Whether to write the per-account cache after a check: only on a confirmed yes. */
export function shouldCacheOnboarded(check: OnboardingCheck | null): boolean {
  return check?.status === "ok" && check.level != null;
}
