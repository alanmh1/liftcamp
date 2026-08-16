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
  /** True when a hand-written beginner block exists. Drives section ordering
   *  on the region pages and indexability on the detail pages, so the ~40
   *  authored exercises sit above the alphabetical tail. */
  has_notes: boolean;
  /** Curated synonyms, already normalized and '|' separated by norm_search().
   *  Carried into the client index so the public hub search matches the same
   *  34 rules the in-app picker does. Never re-normalize it. */
  alias_text: string | null;
  /** Frame 0 only. List rows render a static thumbnail, never the two-frame
   *  cross-fade — a chest section is ~100 rows, and animating each would mean
   *  fetching both frames for every one. The second frame stays on the detail
   *  page, where exactly one exercise is on screen. Null for the 8 rows with
   *  no imagery. */
  image_url: string | null;

// Two round trips rather than a PostgREST embed: `beginner_notes` is a
// one-to-one on a PK, and the embed shape (object vs single-element array)
// varies with how the FK is detected. 883 slugs plus ~40 ids is small enough
// that joining in JS is the boring, stable option.
async function notedExerciseIds(
  supabase: ReturnType<typeof publicClient>,
): Promise<Set<string>> {
  const { data, error } = await supabase.from("beginner_notes").select("exercise_id");
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.exercise_id));
}

export const getCatalogIndex = createServerFn({ method: "GET" }).handler(
  async (): Promise<CatalogRow[]> => {
    const supabase = publicClient();
    const [{ data, error }, noted] = await Promise.all([
      supabase
        .from("exercises")
        .select(
          "id, slug, name, equipment, level, primary_muscle, all_primary_muscles, alias_text",
        )
        .order("name"),
      notedExerciseIds(supabase),
    ]);
    if (error) throw error;
    return (data ?? []).map((r) => ({
      slug: r.slug,
      name: r.name,
      equipment: r.equipment,
      level: r.level,
      primary_muscle: r.primary_muscle,
      all_primary_muscles: r.all_primary_muscles,
      has_notes: noted.has(r.id),
      alias_text: r.alias_text,
    }));
  },
);

// Sitemap feed. Only exercises with an authored beginner block are listed,
// which is the same condition the detail route uses to decide indexability —
// a sitemap that lists noindexed URLs is a coverage error in Search Console.
export const getSitemapExerciseSlugs = createServerFn({ method: "GET" }).handler(
  async (): Promise<string[]> => {
    const supabase = publicClient();
    const noted = await notedExerciseIds(supabase);
    if (noted.size === 0) return [];
    const { data, error } = await supabase
      .from("exercises")
      .select("id, slug")
      .in("id", [...noted])
      .order("slug");
    if (error) throw error;
    return (data ?? []).map((r) => r.slug);
  },
);


// Beginner block. A row exists for ~40 of 883 exercises, so the common answer
// is null and the page renders nothing at all rather than an empty shell.
//
// substitute_exercise_ids is authored and ordered — best swap first — so the
// resolved rows are re-sorted back into the stored order after the `in` query,
// which returns them in whatever order PostgREST likes.
export type BeginnerSubstitute = { slug: string; name: string; equipment: string | null };

export type BeginnerNotes = {
  block_heading: string | null;
  starting_weight_md: string;
  form_breakdown_md: string;
  substitution_heading: string;
  substitution_md: string;
  substitutes: BeginnerSubstitute[];
};

export const getBeginnerNotes = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ exerciseId: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<BeginnerNotes | null> => {
    const supabase = publicClient();
    const { data: note, error } = await supabase
      .from("beginner_notes")
      .select(
        "block_heading, starting_weight_md, form_breakdown_md, substitution_heading, substitution_md, substitute_exercise_ids",
      )
      .eq("exercise_id", data.exerciseId)
      .maybeSingle();
    if (error) throw error;
    if (!note) return null;

    const ids = note.substitute_exercise_ids ?? [];
    let substitutes: BeginnerSubstitute[] = [];
    if (ids.length > 0) {
      const { data: rows, error: subError } = await supabase
        .from("exercises")
        .select("id, slug, name, equipment")
        .in("id", ids);
      if (subError) throw subError;
      const byId = new Map((rows ?? []).map((r) => [r.id, r]));
      substitutes = ids
        .map((id) => byId.get(id))
        .filter((r): r is NonNullable<typeof r> => !!r)
        .map(({ slug, name, equipment }) => ({ slug, name, equipment }));
    }

    return {
      block_heading: note.block_heading,
      starting_weight_md: note.starting_weight_md,
      form_breakdown_md: note.form_breakdown_md,
      substitution_heading: note.substitution_heading,
      substitution_md: note.substitution_md,
      substitutes,
    };
  });
