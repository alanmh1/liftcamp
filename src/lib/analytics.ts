import { supabase } from "@/integrations/supabase/client";

/**
 * Lightweight first-party funnel instrumentation.
 *
 * Events are written to `app_events` (RLS-scoped to the signed-in user).
 * Tracking is fire-and-forget: it must never block or break a user action.
 *
 * TWO THINGS THIS FILE IS DELIBERATE ABOUT
 * ----------------------------------------
 * 1. It never calls `supabase.auth.getUser()`. That method round-trips to the
 *    auth server to validate the token. `set_logged` fires on every completed
 *    set -- the hottest path in the app, often on gym wifi -- so paying for a
 *    network call just to learn who is signed in was doubling the cost of
 *    logging a set. The id is cached here by AuthProvider instead.
 *
 * 2. It does not record a "signed up" event. Every session detection fired one,
 *    so for any account that predates this instrumentation the event carried
 *    the date the code shipped rather than the date the user joined -- it was
 *    really "first seen". The true signup time is already on the auth user
 *    (`user.created_at`), so the funnel reads it from there.
 */

export const EVENTS = {
  routineChosen: "routine_chosen",
  workoutStarted: "workout_started",
  workoutStartFailed: "workout_start_failed",
  setLogged: "set_logged",
  workoutFinished: "workout_finished",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

type Props = Record<string, string | number | boolean | null>;

// Set by AuthProvider on every auth state change. Module-level so `track()` is
// synchronous up to the insert itself.
let currentUserId: string | null = null;

export function setAnalyticsUser(userId: string | null): void {
  currentUserId = userId;
}

/** Resolves the signed-in user id without hitting the network.
 *  `getSession()` reads from local storage; `getUser()` would not. */
async function resolveUserId(): Promise<string | null> {
  if (currentUserId) return currentUserId;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

/** Records an event. Never throws. */
export async function track(name: EventName, props: Props = {}): Promise<void> {
  try {
    const userId = await resolveUserId();
    if (!userId) return;
    await supabase.from("app_events").insert({ user_id: userId, name, props });
  } catch {
    // Instrumentation is best-effort.
  }
}

/**
 * Records a failed attempt to create a workout.
 *
 * Starting a workout is the app's primary action, so when it fails silently
 * there is nothing to diagnose from. This captures the PostgREST error shape
 * (code / message / details / hint) alongside where the attempt came from.
 * Best-effort like every other event: if the failure was itself an auth or
 * connectivity problem, this insert may fail too, and that is acceptable.
 */
export function trackWorkoutStartFailed(source: string, error: unknown): void {
  const e = (error ?? {}) as {
    code?: string; message?: string; details?: string; hint?: string; status?: number;
  };
  void track(EVENTS.workoutStartFailed, {
    source,
    code: e.code ?? null,
    message: (e.message ?? String(error ?? "unknown")).slice(0, 500),
    details: e.details ?? null,
    hint: e.hint ?? null,
    status: e.status ?? null,
    online: typeof navigator === "undefined" ? null : navigator.onLine,
  });
}

export interface FunnelStep {
  label: string;
  reached: boolean;
  at: string | null;
}

/**
 * The four first-run milestones.
 *
 * Four of them are DERIVED FROM REAL DATA rather than from events, because
 * events only exist from the moment instrumentation shipped: an account with
 * fifty logged workouts would otherwise show "Logged first set" unchecked until
 * it logged another one. Derived state is also immune to an event insert that
 * failed on bad signal.
 *
 * "Chose a routine" is the exception -- `workouts` has no template reference, so
 * there is nothing in the data to derive it from. It stays event-backed, which
 * means it can under-report for accounts that predate instrumentation. That is
 * the honest failure direction: it under-claims rather than over-claims.
 *
 * @param accountCreatedAt `user.created_at` from the Supabase auth user.
 */
export async function loadFunnel(
  userId: string,
  accountCreatedAt: string | null,
): Promise<FunnelStep[]> {
  const [routineEvent, firstSet, firstFinished] = await Promise.all([
    supabase
      .from("app_events")
      .select("created_at")
      .eq("user_id", userId)
      .eq("name", EVENTS.routineChosen)
      .order("created_at", { ascending: true })
      .limit(1),
    supabase
      .from("sets")
      .select("created_at")
      .eq("user_id", userId)
      .eq("completed", true)
      .order("created_at", { ascending: true })
      .limit(1),
    supabase
      .from("workouts")
      .select("finished_at")
      .eq("user_id", userId)
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: true })
      .limit(1),
  ]);

  const steps: [string, string | null][] = [
    ["Signed up", accountCreatedAt],
    ["Chose a routine", routineEvent.data?.[0]?.created_at ?? null],
    ["Logged first set", firstSet.data?.[0]?.created_at ?? null],
    ["Finished first workout", firstFinished.data?.[0]?.finished_at ?? null],
  ];

  return steps.map(([label, at]) => ({ label, at, reached: at != null }));
}
