import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { canonMuscleList } from "@/lib/muscle-vocab";

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
  "id, slug, name, primary_muscle, all_primary_muscles, secondary_muscles, equipment, mechanic, force, level, category, description, image_url, image_url_2, is_unilateral";

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
  is_unilateral: boolean;
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
};

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

// The catalog changes only when content is authored, so a short TTL takes two
// Supabase round trips off the critical path of the most-visited public routes.
const CATALOG_TTL_MS = 5 * 60 * 1000;
let catalogCache: { rows: CatalogRow[]; at: number } | null = null;

// Live row count for public copy ("N exercises") so titles and descriptions
// never hardcode a figure that goes stale. Shares the catalog cache above.
export const getExerciseCount = createServerFn({ method: "GET" }).handler(
  async (): Promise<number> => {
    const supabase = publicClient();
    const { count, error } = await supabase
      .from("exercises")
      .select("id", { count: "exact", head: true });
    if (error) throw error;
    return count ?? 0;
  },
);

export const getCatalogIndex = createServerFn({ method: "GET" }).handler(
  async (): Promise<CatalogRow[]> => {
    const now = Date.now();
    if (catalogCache && now - catalogCache.at < CATALOG_TTL_MS) return catalogCache.rows;

    const supabase = publicClient();
    const [{ data, error }, noted] = await Promise.all([
      supabase
        .from("exercises")
        .select(
          "id, slug, name, equipment, level, primary_muscle, all_primary_muscles, alias_text, image_url",
        )
        .order("name"),
      notedExerciseIds(supabase),
    ]);
    if (error) throw error;
    const rows = (data ?? []).map((r) => ({
      slug: r.slug,
      name: r.name,
      equipment: r.equipment,
      level: r.level,
      primary_muscle: r.primary_muscle,
      all_primary_muscles: r.all_primary_muscles,
      has_notes: noted.has(r.id),
      alias_text: r.alias_text,
      image_url: r.image_url,
    }));
    catalogCache = { rows, at: now };
    return rows;
  },
);

// Sitemap feed. Only exercises with an authored beginner block are listed,
// which is the same condition the detail route uses to decide indexability —
// a sitemap that lists noindexed URLs is a coverage error in Search Console.
// lastmod comes from beginner_notes.updated_at: the authored block is the only
// page-specific timestamp that tracks meaningful content change.
export type SitemapExercise = { slug: string; lastmod: string };

export const getSitemapExercises = createServerFn({ method: "GET" }).handler(
  async (): Promise<SitemapExercise[]> => {
    const supabase = publicClient();
    const { data: notes, error: notesError } = await supabase
      .from("beginner_notes")
      .select("exercise_id, updated_at");
    if (notesError) throw notesError;
    if (!notes || notes.length === 0) return [];

    const updatedById = new Map(notes.map((n) => [n.exercise_id, n.updated_at]));
    const { data, error } = await supabase
      .from("exercises")
      .select("id, slug")
      .in("id", [...updatedById.keys()])
      .order("slug");
    if (error) throw error;
    return (data ?? []).map((r) => ({
      slug: r.slug,
      lastmod: new Date(updatedById.get(r.id)!).toISOString().slice(0, 10),
    }));
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

// ---------------------------------------------------------------------------
// Routines
// ---------------------------------------------------------------------------
//
// A routine is a set of `templates` rows sharing a `program` value, one row per
// day. Both functions below roll those rows up server-side so the pages ship
// finished HTML.

const ROUTINES_TTL_MS = 5 * 60 * 1000;

/** One card on /routines. Days are collapsed; the detail page has the days. */
export type PublicRoutineSummary = {
  program: string;
  programSlug: string;
  blurb: string | null;
  order: number;
  dayCount: number;
  exerciseCount: number;
  coverImageUrl: string | null;
  /** Canonical muscles, most exercises first. Capped by the caller. */
  muscles: string[];
};

export type PublicRoutineDay = {
  id: string;
  name: string;
  exercises: { id: string; slug: string; name: string; equipment: string | null }[];
};

export type PublicRoutineDetail = {
  program: string;
  programSlug: string;
  blurb: string | null;
  coverImageUrl: string | null;
  muscles: string[];
  days: PublicRoutineDay[];
};

type TemplateRowRaw = {
  id: string;
  name: string;
  program: string | null;
  program_slug: string | null;
  program_blurb: string | null;
  program_order: number | null;
  cover_image_url: string | null;
  template_exercises: { exercise_id: string; position: number }[];
};

const TEMPLATE_COLUMNS =
  "id, name, program, program_slug, program_blurb, program_order, cover_image_url, template_exercises(exercise_id, position)";

/** Muscles ranked by how many exercises in the set train them, most first.
 *  Reads all_primary_muscles so a row tagged 'quads|glutes' counts for both. */
function rankMuscles(
  exerciseIds: string[],
  byId: Map<string, { all: string | null; primary: string | null }>,
): string[] {
  const counts = new Map<string, number>();
  for (const id of exerciseIds) {
    const row = byId.get(id);
    if (!row) continue;
    for (const m of canonMuscleList(row.all || row.primary)) {
      counts.set(m, (counts.get(m) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([m]) => m);
}

let routineIndexCache: { value: PublicRoutineSummary[]; at: number } | null = null;

export const getPublicRoutines = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicRoutineSummary[]> => {
    const now = Date.now();
    if (routineIndexCache && now - routineIndexCache.at < ROUTINES_TTL_MS) {
      return routineIndexCache.value;
    }

    const supabase = publicClient();
    const { data, error } = await supabase
      .from("templates")
      .select(TEMPLATE_COLUMNS)
      .eq("is_system", true)
      .order("program_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw error;

    const rows = (data ?? []) as TemplateRowRaw[];
    const allIds = [
      ...new Set(rows.flatMap((r) => r.template_exercises.map((te) => te.exercise_id))),
    ];

    const byId = new Map<string, { all: string | null; primary: string | null }>();
    if (allIds.length > 0) {
      const { data: exRows, error: exErr } = await supabase
        .from("exercises")
        .select("id, primary_muscle, all_primary_muscles")
        .in("id", allIds);
      if (exErr) throw exErr;
      for (const e of exRows ?? []) {
        byId.set(e.id, { all: e.all_primary_muscles, primary: e.primary_muscle });
      }
    }

    const groups = new Map<string, TemplateRowRaw[]>();
    for (const r of rows) {
      const key = r.program?.trim() || "Other routines";
      const list = groups.get(key);
      if (list) list.push(r);
      else groups.set(key, [r]);
    }

    const value: PublicRoutineSummary[] = [...groups.entries()]
      .map(([program, days]) => {
        const ids = days.flatMap((d) => d.template_exercises.map((te) => te.exercise_id));
        return {
          program,
          programSlug: days.find((d) => d.program_slug)?.program_slug ?? "",
          blurb: days.find((d) => d.program_blurb)?.program_blurb ?? null,
          order: Math.min(...days.map((d) => d.program_order ?? 99)),
          dayCount: days.length,
          exerciseCount: ids.length,
          coverImageUrl: days.find((d) => d.cover_image_url)?.cover_image_url ?? null,
          muscles: rankMuscles(ids, byId),
        };
      })
      // A program with no slug has nowhere to link, so it stays off the index
      // rather than rendering a card that 404s.
      .filter((g) => g.programSlug !== "")
      .sort((a, b) => a.order - b.order || (a.program < b.program ? -1 : 1));

    routineIndexCache = { value, at: now };
    return value;
  },
);

export const getPublicRoutineBySlug = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ slug: z.string().min(1).max(80) }).parse(data))
  .handler(async ({ data }): Promise<PublicRoutineDetail | null> => {
    const supabase = publicClient();
    const { data: rows, error } = await supabase
      .from("templates")
      .select(TEMPLATE_COLUMNS)
      .eq("is_system", true)
      .eq("program_slug", data.slug)
      .order("name", { ascending: true });
    if (error) throw error;
    const days = (rows ?? []) as TemplateRowRaw[];
    if (days.length === 0) return null;

    const allIds = [
      ...new Set(days.flatMap((d) => d.template_exercises.map((te) => te.exercise_id))),
    ];
    const byId = new Map<
      string,
      {
        slug: string;
        name: string;
        equipment: string | null;
        all: string | null;
        primary: string | null;
      }
    >();
    if (allIds.length > 0) {
      const { data: exRows, error: exErr } = await supabase
        .from("exercises")
        .select("id, slug, name, equipment, primary_muscle, all_primary_muscles")
        .in("id", allIds);
      if (exErr) throw exErr;
      for (const e of exRows ?? []) {
        byId.set(e.id, {
          slug: e.slug,
          name: e.name,
          equipment: e.equipment,
          all: e.all_primary_muscles,
          primary: e.primary_muscle,
        });
      }
    }

    return {
      program: days[0]!.program ?? data.slug,
      programSlug: data.slug,
      blurb: days.find((d) => d.program_blurb)?.program_blurb ?? null,
      coverImageUrl: days.find((d) => d.cover_image_url)?.cover_image_url ?? null,
      muscles: rankMuscles(
        days.flatMap((d) => d.template_exercises.map((te) => te.exercise_id)),
        byId,
      ),
      days: days.map((d) => ({
        id: d.id,
        name: d.name,
        exercises: [...d.template_exercises]
          .sort((a, b) => a.position - b.position)
          .map((te) => {
            const e = byId.get(te.exercise_id);
            return e ? { id: te.exercise_id, ...e } : null;
          })
          .filter((e): e is NonNullable<typeof e> => !!e)
          .map((e) => ({ id: e.id, slug: e.slug, name: e.name, equipment: e.equipment })),
      })),
    };
  });

/** Slugs for the sitemap. */
export const getSitemapRoutines = createServerFn({ method: "GET" }).handler(
  async (): Promise<string[]> => {
    const routines = await getPublicRoutines();
    return routines.map((r) => r.programSlug);
  },
);


// ---------------------------------------------------------------------------
// Public exercise search, for the signed-out routine builder
// ---------------------------------------------------------------------------

export type PublicSearchExercise = {
  id: string;
  slug: string;
  name: string;
  primary_muscle: string | null;
  equipment: string | null;
};

const SEARCH_ROW_LIMIT = 60;

/** Mirrors normalizeSearch() in muscle-vocab.ts and norm_search() in Postgres.
 *  All three must agree or a query matches in one place and not another. */
function normalizeToken(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export const searchPublicExercises = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z
      .object({
        q: z.string().max(80).optional(),
        muscle: z.string().max(40).optional(),
        equipment: z.string().max(40).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<PublicSearchExercise[]> => {
    const supabase = publicClient();
    let query = supabase
      .from("exercises")
      .select("id, slug, name, primary_muscle, equipment")
      .order("name")
      .limit(SEARCH_ROW_LIMIT);

    // Each whitespace-separated token must appear in search_all. PostgREST ANDs
    // repeated .ilike calls, so "smith hip thrust" matches Smith Machine Hip
    // Thrust even though the words are not adjacent in the stored name.
    for (const raw of (data.q ?? "").split(/\s+/)) {
      const tok = normalizeToken(raw);
      if (tok) query = query.ilike("search_all", `%${tok}%`);
    }
    if (data.muscle) query = query.eq("primary_muscle", data.muscle);
    if (data.equipment) query = query.eq("equipment", data.equipment);

    const { data: rows, error } = await query;
    if (error) throw error;
    return (rows ?? []) as PublicSearchExercise[];
  });

// ---------------------------------------------------------------------------
// Social proof
// ---------------------------------------------------------------------------

/**
 * How many personal routines were created in the last seven days.
 *
 * Counted with the admin client rather than a database function: `templates` is
 * private by RLS and correctly so, and a publicly callable SECURITY DEFINER
 * function just to expose one integer is a bigger hole than it is worth. Only
 * the number leaves the server. Callers hide it when it is small — a real but
 * unimpressive count is worse than no count.
 */
export const getRoutinesBuiltThisWeek = createServerFn({ method: "GET" }).handler(
  async (): Promise<number> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count, error } = await supabaseAdmin
        .from("templates")
        .select("id", { count: "exact", head: true })
        .eq("is_system", false)
        .gte("created_at", since);
      if (error) return 0;
      return count ?? 0;
    } catch {
      return 0;
    }
  },
);
