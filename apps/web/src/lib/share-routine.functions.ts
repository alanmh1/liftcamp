import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

// Unlisted routine links. Read with the publishable key so this runs during SSR
// with no session: the anon SELECT policies only expose templates that carry a
// share token, so nothing else in a user's account is reachable from here.
function publicClient() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export type SharedRoutineExercise = {
  id: string;
  name: string;
  slug: string | null;
  primary_muscle: string | null;
};

export type SharedRoutine = {
  name: string;
  exercises: SharedRoutineExercise[];
};

export const getSharedRoutine = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ token: z.string().min(6).max(64) }).parse(data))
  .handler(async ({ data }): Promise<SharedRoutine | null> => {
    const supabase = publicClient();

    const { data: tpl, error } = await supabase
      .from("templates")
      .select("id, name, template_exercises(exercise_id, position)")
      .eq("share_token", data.token)
      .maybeSingle();
    if (error) throw error;
    if (!tpl) return null;

    const ordered = [...(tpl.template_exercises ?? [])].sort((a, b) => a.position - b.position);
    const ids = ordered.map((te) => te.exercise_id);
    if (ids.length === 0) return { name: tpl.name, exercises: [] };

    const { data: rows, error: exErr } = await supabase
      .from("exercises")
      .select("id, name, slug, primary_muscle")
      .in("id", ids);
    if (exErr) throw exErr;

    const byId = new Map((rows ?? []).map((r) => [r.id, r]));
    const exercises = ids
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((r) => ({
        id: r!.id,
        name: r!.name,
        slug: r!.slug ?? null,
        primary_muscle: r!.primary_muscle ?? null,
      }));

    return { name: tpl.name, exercises };
  });
