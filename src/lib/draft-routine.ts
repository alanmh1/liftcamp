import { supabase } from "@/integrations/supabase/client";

/**
 * A signed-out visitor's routine draft.
 *
 * Same shape of problem the trial log solves on the exercise pages: the CTA
 * asks for an account before the reader has done anything. This lets them build
 * a real routine first, held only in localStorage with no account and no
 * network, so the ask changes from "sign up" to "keep what you already made".
 * On first sign-in the draft is replayed into a real template by
 * claimDraftRoutine().
 */

const KEY = "liftcamp:draft-routine";

export type DraftExercise = { id: string; name: string; equipment: string | null };

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

/**
 * Replays a draft into a real template owned by the user. Returns the template
 * id, or null if there was nothing to claim or the write failed. Failure is
 * quiet on purpose: this runs right after sign-in, and an error toast there
 * would read as "your account is broken" rather than "a draft didn't transfer".
 */
export async function claimDraftRoutine(userId: string): Promise<string | null> {
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

  clearDraftRoutine();
  return tpl.id as string;
}
