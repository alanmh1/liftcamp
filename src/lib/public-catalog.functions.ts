import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

// Public catalog reads. No auth middleware, no bearer token, no admin client:
// these run during SSR and (later) prerender, where there is no session at all.
// The publishable key hits PostgREST as `anon`, so the anon SELECT policies
// added in the public-catalog migration are the only thing granting access —
// user-owned templates and every user-data table stay invisible by construction.
function publicClient() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

// Explicit column list rather than `*`: the public pages should ship only the
// catalog fields they render, even though every column on `exercises` is
// world-safe today.
const EXERCISE_COLUMNS =
  "id, slug, name, primary_muscle, all_primary_muscles, secondary_muscles, equipment, mechanic, force, level, category, description, image_url, image_url_2";

export type PublicExercise = {
  id: string;
  slug: string;
  name: string;
  primary_muscle: string | null;
  all_primary_muscles: string | null;
  secondary_muscles: string | null;
  equipment: string | null;
  mechanic: string | null;
  force: string | null;
  level: string | null;
  category: string;
  description: string | null;
  image_url: string | null;
  image_url_2: string | null;
};

export const getPublicExerciseBySlug = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ slug: z.string().min(1).max(120) }).parse(data))
  .handler(async ({ data }): Promise<PublicExercise | null> => {
    const supabase = publicClient();
    const { data: row, error } = await supabase
      .from("exercises")
      .select(EXERCISE_COLUMNS)
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw error;
    return (row as PublicExercise | null) ?? null;
  });

// Legacy-id lookup: only used to 301 the pre-slug UUID URLs onto their slug.
export const getPublicExerciseSlugById = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<string | null> => {
    const supabase = publicClient();
    const { data: row, error } = await supabase
      .from("exercises")
      .select("slug")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    return (row as { slug: string } | null)?.slug ?? null;
  });

// Whole-catalog index for the hub and the six region pages. 883 rows of five
// short columns is a single small round trip, and grouping in JS keeps the
// region map in one place (src/lib/muscle-regions.ts) instead of splitting it
// across six SQL filters.
export type CatalogRow = {
  slug: string;
  name: string;
  equipment: string | null;
  level: string | null;
  primary_muscle: string | null;
  all_primary_muscles: string | null;
};

export const getCatalogIndex = createServerFn({ method: "GET" }).handler(
  async (): Promise<CatalogRow[]> => {
    const supabase = publicClient();
    const { data, error } = await supabase
      .from("exercises")
      .select("slug, name, equipment, level, primary_muscle, all_primary_muscles")
      .order("name");
    if (error) throw error;
    return (data ?? []) as CatalogRow[];
  },
);
