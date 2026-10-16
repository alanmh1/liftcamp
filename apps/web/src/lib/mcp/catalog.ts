import { createClient } from "@supabase/supabase-js";
import type { Database, TemplateRow } from "@liftcamp/shared";

/**
 * Catalog reads for the MCP tools. Same client as public-catalog.functions.ts:
 * the publishable key, so PostgREST runs as `anon` and the public-catalog
 * SELECT policies are the only thing granting access. No user table is read.
 *
 * The tools take a `Catalog` rather than a client, so tests hand them
 * fixtures and never reach the network.
 */

/** One row of the exercise index the resolvers search. */
export type IndexExercise = {
  id: string;
  slug: string;
  name: string;
  equipment: string | null;
  level: string | null;
  /** "compound" or "isolation"; null on about 90 rows. */
  mechanic: string | null;
  primary_muscle: string | null;
  /** Normalized synonyms, '|' separated, from norm_search(). */
  alias_text: string | null;
  /** Generated: normalized name plus aliases. */
  search_all: string | null;
  has_notes: boolean;
};

/** The guide fields for one exercise. Never the GIF columns: the ExerciseDB
 *  licence allows them in-app only, behind auth. */
export type ExerciseDetail = {
  id: string;
  slug: string;
  name: string;
  primary_muscle: string | null;
  all_primary_muscles: string | null;
  secondary_muscles: string | null;
  equipment: string | null;
  level: string | null;
  description: string | null;
  image_url: string | null;
};

export type ExerciseNote = {
  starting_weight_md: string;
  form_breakdown_md: string;
  substitution_md: string;
  /** Authored order, best swap first. */
  substitute_exercise_ids: string[];
};

export interface Catalog {
  /** System templates with their exercises joined, as rankPrograms reads them. */
  routineRows(): Promise<TemplateRow[]>;
  exerciseIndex(): Promise<IndexExercise[]>;
  exerciseDetail(id: string): Promise<ExerciseDetail | null>;
  beginnerNote(exerciseId: string): Promise<ExerciseNote | null>;
}

function publicClient() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

/** Same TTL as CATALOG_TTL_MS in public-catalog.functions.ts. */
const CATALOG_TTL_MS = 5 * 60 * 1000;

let routineCache: { rows: TemplateRow[]; at: number } | null = null;
let indexCache: { rows: IndexExercise[]; at: number } | null = null;

const TEMPLATE_COLUMNS =
  "id, name, is_system, program, program_slug, program_blurb, program_order, hide_from_onboarding, level, days_per_week, equipment, position, created_at, template_exercises(exercise_id, position, target_sets, target_reps, exercises(name, equipment, primary_muscle))";

export const supabaseCatalog: Catalog = {
  async routineRows() {
    const now = Date.now();
    if (routineCache && now - routineCache.at < CATALOG_TTL_MS) return routineCache.rows;
    const { data, error } = await publicClient()
      .from("templates")
      .select(TEMPLATE_COLUMNS)
      .eq("is_system", true)
      .order("program_order", { ascending: true })
      .order("position", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });
    if (error) throw error;
    // Through unknown: the generated types predate the template_exercises to
    // exercises foreign key, as in public-catalog.functions.ts.
    const rows = (data ?? []) as unknown as TemplateRow[];
    routineCache = { rows, at: now };
    return rows;
  },

  async exerciseIndex() {
    const now = Date.now();
    if (indexCache && now - indexCache.at < CATALOG_TTL_MS) return indexCache.rows;
    const supabase = publicClient();
    const [{ data, error }, { data: notes, error: notesError }] = await Promise.all([
      supabase
        .from("exercises")
        .select(
          "id, slug, name, equipment, level, mechanic, primary_muscle, alias_text, search_all",
        )
        .order("name")
        // Explicit range: without one PostgREST stops at its default 1,000 rows,
        // and the catalog (898 rows in Sep 2026) would truncate without an error.
        .range(0, 4999),
      supabase.from("beginner_notes").select("exercise_id"),
    ]);
    if (error) throw error;
    if (notesError) throw notesError;
    const noted = new Set((notes ?? []).map((n) => n.exercise_id));
    const rows: IndexExercise[] = (data ?? []).map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      equipment: r.equipment,
      level: r.level,
      mechanic: r.mechanic,
      primary_muscle: r.primary_muscle,
      alias_text: r.alias_text,
      search_all: r.search_all,
      has_notes: noted.has(r.id),
    }));
    indexCache = { rows, at: now };
    return rows;
  },

  async exerciseDetail(id) {
    const { data, error } = await publicClient()
      .from("exercises")
      .select(
        "id, slug, name, primary_muscle, all_primary_muscles, secondary_muscles, equipment, level, description, image_url",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as ExerciseDetail | null) ?? null;
  },

  async beginnerNote(exerciseId) {
    const { data, error } = await publicClient()
      .from("beginner_notes")
      .select("starting_weight_md, form_breakdown_md, substitution_md, substitute_exercise_ids")
      .eq("exercise_id", exerciseId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { ...data, substitute_exercise_ids: data.substitute_exercise_ids ?? [] };
  },
};
