/**
 * When a request last got no response at all. Every Supabase request goes
 * through `trackedFetch` (see lib/supabase.ts), so a screen that reads
 * several things can tell "no signal" from an empty answer: the reads
 * return their empty defaults either way, but only one of them should
 * replace what the screen already shows.
 */
let lastFailureAt = 0;
/** When a request last got any response, error statuses included. */
let lastResponseAt = 0;

/** Whether a request has failed for want of a response since `since` (epoch ms). */
export function networkFailedSince(since: number): boolean {
  return lastFailureAt >= since;
}

/**
 * Whether the latest request got no response: a failure with no answered
 * request after it. False before any request has failed.
 */
export function networkOffline(): boolean {
  return lastFailureAt > lastResponseAt;
}

export const trackedFetch: typeof fetch = async (input, init) => {
  try {
    const res = await fetch(input, init);
    lastResponseAt = Date.now();
    return res;
  } catch (e) {
    lastFailureAt = Date.now();
    throw e;
  }
};
