import { supabase } from "@/integrations/supabase/client";

/**
 * Lightweight first-party funnel instrumentation.
 *
 * Events are written to `app_events` (RLS-scoped to the signed-in user).
 * Tracking is fire-and-forget: it must never block or break a user action.
 */

export const EVENTS = {
  signedUp: "signed_up",
  routineChosen: "routine_chosen",
  workoutStarted: "workout_started",
  setLogged: "set_logged",
  workoutFinished: "workout_finished",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

type Props = Record<string, string | number | boolean | null>;

/** Records an event. Never throws. */
export async function track(name: EventName, props: Props = {}): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return;
    await supabase.from("app_events").insert({ user_id: userId, name, props });
  } catch {
    // Instrumentation is best-effort.
  }
}

// Avoids a round-trip for repeat calls in the same session.
const seenOnce = new Set<string>();

/** Records an event only if this user has never recorded it before. */
export async function trackOnce(name: EventName, props: Props = {}): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return;
    const key = `${userId}:${name}`;
    if (seenOnce.has(key)) return;
    // Reserve immediately so concurrent callers in the same session (auth
    // listener + session hydration) cannot both pass the existence check.
    seenOnce.add(key);

    const { count } = await supabase
      .from("app_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("name", name);
    if ((count ?? 0) > 0) return;

    await supabase.from("app_events").insert({ user_id: userId, name, props });
  } catch {
    // Instrumentation is best-effort.
  }
}

export interface FunnelStep {
  label: string;
  reached: boolean;
  at: string | null;
}

/**
 * The four first-run numbers: signed up, chose a routine, logged a first set,
 * finished a first workout.
 */
export async function loadFunnel(userId: string): Promise<FunnelStep[]> {
  const { data, error } = await supabase
    .from("app_events")
    .select("name, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as { name: string; created_at: string }[];
  const firstOf = (name: string) => rows.find((r) => r.name === name)?.created_at ?? null;

  const steps: [string, string | null][] = [
    ["Signed up", firstOf(EVENTS.signedUp)],
    ["Chose a routine", firstOf(EVENTS.routineChosen)],
    ["Logged first set", firstOf(EVENTS.setLogged)],
    ["Finished first workout", firstOf(EVENTS.workoutFinished)],
  ];

  return steps.map(([label, at]) => ({ label, at, reached: at != null }));
}
