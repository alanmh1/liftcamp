import { supabase } from "@/integrations/supabase/client";

/**
 * A signed-out visitor's routine draft.
 *
 * Same shape of problem the trial log solves on the exercise pages: the CTA
 * asks for an account before the reader has done anything. This lets them build
 * a real routine first — and, since pass two, log a real session against it —
 * held only in localStorage with no account and no network, so the ask changes
 * from "sign up" to "keep what you already made". On first sign-in the draft is
 * replayed into a real template (and a real workout, if they logged one) by
 * claimDraftRoutine().
 */

const KEY = "liftcamp:draft-routine";

export type DraftSet = { weight: string; reps: string };

export type DraftExercise = {
  id: string;
  name: string;
  equipment: string | null;
  /** Sets logged in the trial session. Absent on a routine that was only built. */
  sets?: DraftSet[];
};

export type DraftRoutine = {
  name: string;
  exercises: DraftExercise[];
  updatedAt: number;
};

export function readDraftRoutine(): DraftRoutine | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftRoutine;
    if (!Array.isArray(parsed?.exercises)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeDraftRoutine(draft: DraftRoutine) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    /* private mode, quota — the builder still works for the session */
  }
}

export function clearDraftRoutine() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** A draft worth claiming has at least one exercise. A name alone is scratch. */
export function isClaimable(draft: DraftRoutine | null): boolean {
  return !!draft && draft.exercises.length > 0;
}

/** Sets with something in them. Empty rows are scratch, not data. */
export function loggedSets(ex: DraftExercise): DraftSet[] {
  return (ex.sets ?? []).filter((s) => s.reps.trim() !== "" || s.weight.trim() !== "");
}

/** True once the visitor has logged anything against the draft. */
export function hasLoggedSets(draft: DraftRoutine | null): boolean {
  return !!draft && draft.exercises.some((ex) => loggedSets(ex).length > 0);
}

export type ClaimResult = { templateId: string; workoutId: string | null };

/**
 * Replays a draft into a real template owned by the user, plus a real workout
 * when they logged sets in the trial session. Returns null if there was nothing
 * to claim or the write failed. Failure is quiet on purpose: this runs right
 * after sign-in, and an error toast there would read as "your account is
 * broken" rather than "a draft didn't transfer".
 */
export async function claimDraftRoutine(userId: string): Promise<ClaimResult | null> {
  const draft = readDraftRoutine();
  if (!isClaimable(draft) || !draft) {
    clearDraftRoutine();
    return null;
  }

  const name = draft.name.trim() || "My routine";
  const { data: tpl, error: tplErr } = await supabase
    .from("templates")
    .insert({ user_id: userId, name, is_system: false })
    .select("id")
    .single();
  if (tplErr || !tpl) {
    console.error(tplErr);
    return null;
  }

  const rows = draft.exercises.map((ex, i) => ({
    template_id: tpl.id,
    exercise_id: ex.id,
    user_id: userId,
    position: i,
  }));
  const { error: teErr } = await supabase.from("template_exercises").insert(rows);
  if (teErr) {
    console.error(teErr);
    return null;
  }

  const workoutId = await claimDraftWorkout(userId, draft, name);

  clearDraftRoutine();
  return { templateId: tpl.id as string, workoutId };
}

/**
 * Turns the trial session into a real, finished-looking workout. Separate from
 * the template write so a failure here still leaves the routine saved — losing
 * the plan would be the worse of the two.
 */
async function claimDraftWorkout(
  userId: string,
  draft: DraftRoutine,
  name: string,
): Promise<string | null> {
  const withSets = draft.exercises
    .map((ex) => ({ ex, sets: loggedSets(ex) }))
    .filter((e) => e.sets.length > 0);
  if (withSets.length === 0) return null;

  const { data: workout, error: wErr } = await supabase
    .from("workouts")
    .insert({ user_id: userId, name })
    .select("id")
    .single();
  if (wErr || !workout) {
    console.error(wErr);
    return null;
  }

  for (const [i, { ex, sets }] of withSets.entries()) {
    const { data: we, error: weErr } = await supabase
      .from("workout_exercises")
      .insert({ workout_id: workout.id, exercise_id: ex.id, user_id: userId, position: i })
      .select("id")
      .single();
    if (weErr || !we) {
      console.error(weErr);
      continue;
    }

    const rows = sets.map((s, j) => {
      const value = Number.parseFloat(s.weight);
      return {
        workout_exercise_id: we.id,
        user_id: userId,
        position: j,
        weight: s.weight.trim(),
        weight_value: Number.isFinite(value) ? value : null,
        reps: s.reps.trim() === "" ? null : Number.parseInt(s.reps, 10) || null,
        completed: true,
      };
    });
    const { error: sErr } = await supabase.from("sets").insert(rows);
    if (sErr) console.error(sErr);
  }

  return workout.id as string;
}
