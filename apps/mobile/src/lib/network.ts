/**
 * When a request last got no response at all. Every Supabase request goes
 * through `trackedFetch` (see lib/supabase.ts), so a screen that reads
 * several things can tell "no signal" from an empty answer: the reads
 * return their empty defaults either way, but only one of them should
 * replace what the screen already shows.
 */
let lastFailureAt = 0;

/** Whether a request has failed for want of a response since `since` (epoch ms). */
export function networkFailedSince(since: number): boolean {
  return lastFailureAt >= since;
}

export const trackedFetch: typeof fetch = async (input, init) => {
  try {
    return await fetch(input, init);
  } catch (e) {
    lastFailureAt = Date.now();
    throw e;
  }
};
