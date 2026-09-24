import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@liftcamp/shared";

// Unlisted routine links. Read with the publishable key so this runs during SSR
// with no session. get_shared_template returns a routine only for its exact
// token, so shared routines can be opened but never listed.
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

    const { data: row, error } = await supabase.rpc("get_shared_template", {
      p_token: data.token,
    });
    if (error) throw error;
    if (!row) return null;

    // Exercises arrive in template order with the fields this page needs.
    const routine = row as unknown as SharedRoutine;
    return {
      name: routine.name,
      exercises: (routine.exercises ?? []).map((e) => ({
        id: e.id,
        name: e.name,
        slug: e.slug ?? null,
        primary_muscle: e.primary_muscle ?? null,
      })),
    };
  });
