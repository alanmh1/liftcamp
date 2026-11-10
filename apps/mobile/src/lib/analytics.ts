import { supabase } from '../../lib/supabase';

/**
 * Fire-and-forget `app_events` writes, modelled on the web's
 * apps/web/src/lib/analytics.ts and deliberate about the same two things:
 *
 * 1. It never calls `supabase.auth.getUser()`, which round-trips to the
 *    auth server. AuthProvider hands the user id over on every auth state
 *    change; `getSession()`, a local read, is only the fallback.
 * 2. It records no "signed up" event. The account's `created_at` is the
 *    signup time, and the funnel reads it from there.
 *
 * This runs in dev builds too. A dev user carries a `dev_user` row
 * (lib/dev-user) and `env: 'dev'` metadata, so admin_funnel() leaves it
 * out, and the rows can be watched arriving from the Simulator.
 */

export const EVENTS = {
  onboardingPage: 'onboarding_page',
  onboardingFinished: 'onboarding_finished',
  // Save on an edit of a finished workout that changed something. Props:
  // `ops`, the writes queued, and `replaced`, whether an exercise was replaced.
  workoutEdited: 'workout_edited',
  // A file from another app parsed. Props: `source`, and `entry`, where
  // /import was opened: `settings`, `onboarding`, `profile`, `history` or
  // `whats_new`.
  importStarted: 'import_started',
  // Every batch of an import went through. Props: `source`, `entry`, `workouts`
  // (inserted), `sets`, `skipped_exercises` (source names set to Skip),
  // `unit_asked` (Strong's iOS file, whose weights have no unit) and
  // `dumbbells_combined` (answered "Both together").
  importFinished: 'import_finished',
  // Home's What's new card. Props: `action`, `shown` (when the card appears),
  // `dismissed` (X or Got it) or `import` (the link), and `card`, which card
  // it was (`2026-11`).
  whatsNew: 'whats_new',
  // The paywall opened. Props: `source`, the entry point (PaywallSource in
  // shared).
  paywallViewed: 'paywall_viewed',
  // Props on the next three: `product_id` and `source`.
  purchaseStarted: 'purchase_started',
  purchaseCompleted: 'purchase_completed',
  purchaseCancelled: 'purchase_cancelled',
  // Props: `source`, `settings` or a paywall's entry point.
  restoreTapped: 'restore_tapped',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

type Props = Record<string, string | number | boolean | null>;

// Set by AuthProvider on every auth state change.
let currentUserId: string | null = null;

export function setAnalyticsUser(userId: string | null): void {
  currentUserId = userId;
}

async function resolveUserId(): Promise<string | null> {
  if (currentUserId) return currentUserId;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

/** Records an event for the signed-in user. Never throws; no user, no row. */
export async function track(name: EventName, props: Props = {}): Promise<void> {
  try {
    const userId = await resolveUserId();
    if (!userId) return;
    const { error } = await supabase.from('app_events').insert({ user_id: userId, name, props });
    if (error && __DEV__) console.warn(`[analytics] ${name} not recorded: ${error.message}`);
  } catch {
    // Best effort.
  }
}
