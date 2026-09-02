import { supabase } from "@/integrations/supabase/client";

/**
 * A signed-out visitor's scratch workout.
 *
 * The conversion problem on the public exercise pages is that the CTA asks for
 * an account before the reader has done anything. This lets them log real sets
 * first — held only in localStorage, no account, no network — and then the ask
 * changes from "sign up" to "keep what you already made". On first sign-in the
 * draft is replayed into a real workout by claimTrialLog().
 */

const KEY = "liftcamp:trial-log";

export type TrialSet = { weight: string; reps: string };

export type TrialLog = {
  exerciseId: string;
  exerciseName: string;
  exerciseSlug: string;
  sets: TrialSet[];
  updatedAt: number;
};

export function readTrialLog(): TrialLog | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TrialLog;
    if (!parsed?.exerciseId || !Array.isArray(parsed.sets)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeTrialLog(log: TrialLog) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(log));
  } catch {
    /* private mode, quota — the widget still works for the session */
  }
}

export function clearTrialLog() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Sets with at least a rep count. Empty rows are scratch, not data. */
export function meaningfulSets(log: TrialLog | null): TrialSet[] {
  if (!log) return [];
  return log.sets.filter((s) => s.reps.trim() !== "" || s.weight.trim() !== "");
}

/**
 * Replays a draft into a real workout owned by the user. Returns the workout id,
 * or null if there was nothing to claim or the write failed. Failure is quiet on
 * purpose: this runs right after sign-in, and an error toast there would read as
 * "your account is broken" rather than "a scratch log didn't transfer".
 */
export async function claimTrialLog(userId: string): Promise<string | null> {
  const log = readTrialLog();
  const sets = meaningfulSets(log);
  if (!log || sets.length === 0) {
    clearTrialLog();
    return null;
  }

  const { data: workout, error: wErr } = await supabase
    .from("workouts")
    .insert({ user_id: userId, name: log.exerciseName })
    .select("id")
    .single();
  if (wErr || !workout) {
    console.error(wErr);
    return null;
  }

  const { data: we, error: weErr } = await supabase
    .from("workout_exercises")
    .insert({
      workout_id: workout.id,
      exercise_id: log.exerciseId,
      user_id: userId,
      position: 0,
    })
    .select("id")
    .single();
  if (weErr || !we) {
    console.error(weErr);
    return null;
  }

  const rows = sets.map((s, i) => {
    const value = Number.parseFloat(s.weight);
    return {
      workout_exercise_id: we.id,
      user_id: userId,
      position: i,
      weight: s.weight.trim(),
      weight_value: Number.isFinite(value) ? value : null,
      reps: s.reps.trim() === "" ? null : Number.parseInt(s.reps, 10) || null,
      completed: true,
    };
  });
  const { error: sErr } = await supabase.from("sets").insert(rows);
  if (sErr) {
    console.error(sErr);
    return null;
  }

  clearTrialLog();
  return workout.id as string;
}
