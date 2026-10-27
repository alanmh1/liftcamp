import { createServerFn } from "@tanstack/react-start";
import { APP_STORE_ID } from "@liftcamp/shared";

// The App Store's own rating for LiftCamp, from the public iTunes lookup. The
// homepage shows it and puts it in SoftwareApplication.aggregateRating; Google
// requires the rating in the markup to be visible on the page, so both read
// this one value. Never hard-code a rating.

export type AppStoreRating = { average: number; count: number };

/** Revalidate window. The homepage HTML is cached for 5 minutes at the edge
 *  (src/server.ts), well inside this. */
const RATING_TTL_MS = 24 * 60 * 60 * 1000;
/** A failed lookup is retried sooner, so one bad response does not hide the
 *  rating for a day. */
const FAILURE_TTL_MS = 10 * 60 * 1000;
const LOOKUP_TIMEOUT_MS = 3000;

let ratingCache: { value: AppStoreRating | null; until: number } | null = null;

async function lookup(): Promise<AppStoreRating | null> {
  const res = await fetch(`https://itunes.apple.com/lookup?id=${APP_STORE_ID}&country=us`, {
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as {
    results?: { averageUserRating?: number; userRatingCount?: number }[];
  };
  const app = body.results?.[0];
  const average = app?.averageUserRating;
  const count = app?.userRatingCount;
  if (typeof average !== "number" || typeof count !== "number" || count <= 0) return null;
  return { average, count };
}

/** Null when the lookup fails or the app has no ratings: callers then omit
 *  the rating everywhere. */
export const getAppStoreRating = createServerFn({ method: "GET" }).handler(
  async (): Promise<AppStoreRating | null> => {
    const now = Date.now();
    if (ratingCache && now < ratingCache.until) return ratingCache.value;
    let value: AppStoreRating | null = null;
    try {
      value = await lookup();
    } catch (error) {
      console.error("App Store lookup failed", error);
    }
    ratingCache = { value, until: now + (value ? RATING_TTL_MS : FAILURE_TTL_MS) };
    return value;
  },
);
