import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  canonMuscleList,
  FALLBACK_IMAGE,
  routineArtByProgram,
  type Database,
  type RoutineImageKey,
  type TemplateRow,
} from "@liftcamp/shared";
import {
  equipmentGroup,
  resolveDifficulty,
  templateEquipmentLabel,
} from "@/lib/routine-prescription";
import { latestDay } from "@/lib/dates";
import { FALLBACK_TINT, routineTints } from "@/lib/routine-tints";

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
  "id, slug, name, primary_muscle, all_primary_muscles, secondary_muscles, equipment, mechanic, force, level, category, description, image_url, image_url_2, gif_url, gif_url_sm, is_unilateral, created_at, updated_at";

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
  gif_url: string | null;
  gif_url_sm: string | null;
  is_unilateral: boolean;
  created_at: string;
  updated_at: string;
};

export const getPublicExerciseBySlug = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ slug: z.string().min(1).max(120) }).parse(data))
  .handler(async ({ data }): Promise<PublicExercise | null> => {
    const supabase = publicClient();
    const { data: row, error } = await supabase
      .from("exercises")
      .select(EXERCISE_COLUMNS)
      .is("owner_id", null)
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
      .is("owner_id", null)
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
  /** Drives the "Also working" tint on the hub and detail body diagrams. */
  secondary_muscles: string | null;
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
      .select("id", { count: "exact", head: true })
      .is("owner_id", null);
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
          "id, slug, name, equipment, level, primary_muscle, all_primary_muscles, secondary_muscles, alias_text, image_url",
        )
        .is("owner_id", null)
        .order("name")
        // Explicit range: without one PostgREST stops at its default 1,000 rows,
        // and the catalog (898 rows in Sep 2026) would truncate without an error.
        .range(0, 4999),
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
      secondary_muscles: r.secondary_muscles,
      has_notes: noted.has(r.id),
      alias_text: r.alias_text,
      image_url: r.image_url,
    }));
    catalogCache = { rows, at: now };
    return rows;
  },
);

// ---------------------------------------------------------------------------
// SEO feed: /sitemap.xml and /llms.txt
// ---------------------------------------------------------------------------
//
// Everything both generated files need, in one cached read, so the URL list
// and the llms.txt lists come from the same rows and cannot disagree.
//
// A page's date is the latest updated_at of the rows it renders, each kept by
// a trigger: an exercise page is max(exercises.updated_at,
// beginner_notes.updated_at), a hub is max(exercises.updated_at) over the
// exercises on it, a routine is max(templates.updated_at,
// template_exercises.updated_at) over its days.

export type SeoExercise = {
  slug: string;
  name: string;
  equipment: string | null;
  primary_muscle: string | null;
  all_primary_muscles: string | null;
  /** YYYY-MM-DD, exercises.updated_at alone. Hubs date from this. */
  updated: string;
  /** YYYY-MM-DD, max(exercises.updated_at, beginner_notes.updated_at). The
   *  exercise page's own date. */
  lastmod: string;
  /** beginner_notes.starting_weight_md, or null when the row has no notes
   *  (and so is noindex). */
  starting_weight_md: string | null;
};

export type SeoRoutine = {
  slug: string;
  program: string;
  blurb: string | null;
  /** Raw templates.level and templates.equipment ("beginner", "gym"). */
  level: string | null;
  equipment: string | null;
  /** YYYY-MM-DD. */
  lastmod: string;
};

export type SeoCatalog = { exercises: SeoExercise[]; routines: SeoRoutine[] };

const SEO_TTL_MS = 5 * 60 * 1000;
let seoCache: { value: SeoCatalog; at: number } | null = null;

export const getSeoCatalog = createServerFn({ method: "GET" }).handler(
  async (): Promise<SeoCatalog> => {
    const now = Date.now();
    if (seoCache && now - seoCache.at < SEO_TTL_MS) return seoCache.value;

    const supabase = publicClient();
    const [exRes, notesRes, tplRes, routines] = await Promise.all([
      supabase
        .from("exercises")
        .select("id, slug, name, equipment, primary_muscle, all_primary_muscles, updated_at")
        .is("owner_id", null)
        .order("name")
        .range(0, 4999),
      supabase.from("beginner_notes").select("exercise_id, updated_at, starting_weight_md"),
      supabase
        .from("templates")
        .select("program_slug, program_blurb, level, equipment, updated_at, template_exercises(updated_at)")
        .eq("is_system", true),
      getPublicRoutines(),
    ]);
    if (exRes.error) throw exRes.error;
    if (notesRes.error) throw notesRes.error;
    if (tplRes.error) throw tplRes.error;

    const notes = new Map((notesRes.data ?? []).map((n) => [n.exercise_id, n]));
    const exercises: SeoExercise[] = (exRes.data ?? []).map((e) => {
      const note = notes.get(e.id);
      return {
        slug: e.slug,
        name: e.name,
        equipment: e.equipment,
        primary_muscle: e.primary_muscle,
        all_primary_muscles: e.all_primary_muscles,
        updated: latestDay(e.updated_at),
        lastmod: latestDay(e.updated_at, note?.updated_at),
        starting_weight_md: note?.starting_weight_md ?? null,
      };
    });

    // Through unknown for the same reason as TEMPLATE_COLUMNS: the generated
    // types do not know the template_exercises embed's updated_at.
    const tplRows = (tplRes.data ?? []) as unknown as {
      program_slug: string | null;
      program_blurb: string | null;
      level: string | null;
      equipment: string | null;
      updated_at: string;
      template_exercises: { updated_at: string | null }[];
    }[];
    const bySlug = new Map<string, typeof tplRows>();
    for (const r of tplRows) {
      if (!r.program_slug) continue;
      bySlug.set(r.program_slug, [...(bySlug.get(r.program_slug) ?? []), r]);
    }
    // getPublicRoutines decides which programs have a page and their order.
    const seoRoutines: SeoRoutine[] = routines.map((r) => {
      const days = bySlug.get(r.programSlug) ?? [];
      return {
        slug: r.programSlug,
        program: r.program,
        blurb: r.blurb,
        level: days.find((d) => d.level)?.level ?? null,
        equipment: days.find((d) => d.equipment)?.equipment ?? null,
        lastmod: latestDay(
          ...days.flatMap((d) => [d.updated_at, ...d.template_exercises.map((te) => te.updated_at)]),
        ),
      };
    });

    const value = { exercises, routines: seoRoutines };
    seoCache = { value, at: now };
    return value;
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
  /** Last edit of the authored block. */
  updated_at: string;
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
        "updated_at, block_heading, starting_weight_md, form_breakdown_md, substitution_heading, substitution_md, substitute_exercise_ids",
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
        .is("owner_id", null)
        .in("id", ids);
      if (subError) throw subError;
      const byId = new Map((rows ?? []).map((r) => [r.id, r]));
      substitutes = ids
        .map((id) => byId.get(id))
        .filter((r): r is NonNullable<typeof r> => !!r)
        .map(({ slug, name, equipment }) => ({ slug, name, equipment }));
    }

    return {
      updated_at: note.updated_at,
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
  /** `templates.days_per_week`, falling back to the number of template days.
   *  The two differ: Full Body A/B is two templates run three days a week. */
  daysPerWeek: number;
  /** "Beginner" | "Intermediate" | "Advanced", from `templates.level` with the
   *  slug and day-count heuristic as the fallback. */
  level: string;
  exerciseCount: number;
  coverImageUrl: string | null;
  /** Equipment illustration, from routineArtByProgram over the full system
   *  list, so a program shows the same picture here and in the app. */
  art: RoutineImageKey;
  /** Canonical muscles, most exercises first. Capped by the caller. */
  muscles: string[];
  /** Equipment chips for the index filters: `templates.equipment` when set,
   *  otherwise the distinct groups derived from the exercises. */
  equipment: string[];
};

export type PublicRoutineExercise = {
  id: string;
  slug: string;
  name: string;
  equipment: string | null;
  /** `template_exercises.target_sets` and `target_reps`, null when unset. */
  targetSets: number | null;
  targetReps: string | null;
};

export type PublicRoutineDay = {
  id: string;
  name: string;
  exercises: PublicRoutineExercise[];
};

export type PublicRoutineDetail = {
  program: string;
  programSlug: string;
  blurb: string | null;
  coverImageUrl: string | null;
  art: RoutineImageKey;
  daysPerWeek: number;
  level: string;
  /** `templates.equipment` as a label ("Gym", "Dumbbells"), or null. */
  equipment: string | null;
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
  level: string | null;
  days_per_week: number | null;
  equipment: string | null;
  /** Training order of the day within its routine, from 1. */
  position: number | null;
  created_at: string;
  template_exercises: {
    exercise_id: string;
    position: number;
    target_sets: number | null;
    target_reps: string | null;
    /** Joined across template_exercises_exercise_id_fkey; the routine art reads these. */
    exercises: { equipment: string | null; primary_muscle: string | null } | null;
  }[];
};

// The same shape mobile's TEMPLATE_FIELDS selects (apps/mobile/src/data/home.ts),
// plus cover_image_url, so routineArtByProgram sees identical inputs on both.
const TEMPLATE_COLUMNS =
  "id, name, program, program_slug, program_blurb, program_order, cover_image_url, level, days_per_week, equipment, position, created_at, template_exercises(exercise_id, position, target_sets, target_reps, exercises(equipment, primary_muscle))";

/** Program name to image key, walked over every system template exactly as
 *  the app does, so a filtered index and the detail page agree with mobile. */
function artByProgram(rows: TemplateRowRaw[]): Map<string, RoutineImageKey> {
  return routineArtByProgram(rows as unknown as TemplateRow[]);
}

/** The program-level facts live on every day's template row; take the first
 *  day that has each one filled in. */
function programFacts(days: TemplateRowRaw[], slug: string) {
  const daysPerWeek = days.find((d) => d.days_per_week != null)?.days_per_week ?? days.length;
  const level = resolveDifficulty(days.find((d) => d.level)?.level, slug, daysPerWeek);
  const equipment = templateEquipmentLabel(days.find((d) => d.equipment)?.equipment);
  return { daysPerWeek, level, equipment };
}

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
/** Exercise id to the slugs of the system routines that use it, in program
 *  order. Filled by getPublicRoutines from the same read, so it shares that
 *  cache's lifetime. */
let routinesByExercise: Map<string, string[]> = new Map();

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
      .order("position", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });
    if (error) throw error;

    // Through unknown: the generated Database types predate the
    // template_exercises to exercises foreign key, so they do not know the
    // embed. Mobile casts the same way.
    const rows = (data ?? []) as unknown as TemplateRowRaw[];
    const allIds = [
      ...new Set(rows.flatMap((r) => r.template_exercises.map((te) => te.exercise_id))),
    ];

    const byId = new Map<
      string,
      { all: string | null; primary: string | null; equipment: string | null }
    >();
    if (allIds.length > 0) {
      const { data: exRows, error: exErr } = await supabase
        .from("exercises")
        .select("id, primary_muscle, all_primary_muscles, equipment")
        .is("owner_id", null)
        .in("id", allIds);
      if (exErr) throw exErr;
      for (const e of exRows ?? []) {
        byId.set(e.id, {
          all: e.all_primary_muscles,
          primary: e.primary_muscle,
          equipment: e.equipment,
        });
      }
    }

    const groups = new Map<string, TemplateRowRaw[]>();
    for (const r of rows) {
      const key = r.program?.trim() || "Other routines";
      const list = groups.get(key);
      if (list) list.push(r);
      else groups.set(key, [r]);
    }
    const art = artByProgram(rows);

    const value: PublicRoutineSummary[] = [...groups.entries()]
      .map(([program, days]) => {
        const ids = days.flatMap((d) => d.template_exercises.map((te) => te.exercise_id));
        const programSlug = days.find((d) => d.program_slug)?.program_slug ?? "";
        const facts = programFacts(days, programSlug);
        return {
          program,
          programSlug,
          blurb: days.find((d) => d.program_blurb)?.program_blurb ?? null,
          order: Math.min(...days.map((d) => d.program_order ?? 99)),
          daysPerWeek: facts.daysPerWeek,
          level: facts.level,
          exerciseCount: ids.length,
          coverImageUrl: days.find((d) => d.cover_image_url)?.cover_image_url ?? null,
          art: art.get(program) ?? FALLBACK_IMAGE,
          muscles: rankMuscles(ids, byId),
          equipment: facts.equipment
            ? [facts.equipment]
            : [
                ...new Set(
                  ids
                    .map((id) => equipmentGroup(byId.get(id)?.equipment))
                    .filter((g): g is NonNullable<typeof g> => !!g),
                ),
              ].sort(),
        };
      })
      // A program with no slug has nowhere to link, so it stays off the index
      // rather than rendering a card that 404s.
      .filter((g) => g.programSlug !== "")
      .sort((a, b) => a.order - b.order || (a.program < b.program ? -1 : 1));

    const byExercise = new Map<string, string[]>();
    for (const routine of value) {
      const days = groups.get(routine.program) ?? [];
      for (const id of new Set(days.flatMap((d) => d.template_exercises.map((te) => te.exercise_id)))) {
        byExercise.set(id, [...(byExercise.get(id) ?? []), routine.programSlug]);
      }
    }
    routinesByExercise = byExercise;
    routineIndexCache = { value, at: now };
    return value;
  },
);

/** The system routines that include an exercise, in program_order, at most
 *  `limit`. For the "Routines that use this exercise" section on its page. */
export const getRoutinesForExercise = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z.object({ exerciseId: z.string().uuid(), limit: z.number().int().min(1).max(50) }).parse(data),
  )
  .handler(async ({ data }): Promise<(PublicRoutineSummary & { tint: string })[]> => {
    const all = await getPublicRoutines();
    const slugs = new Set(routinesByExercise.get(data.exerciseId) ?? []);
    // Tints over the full list, so each card keeps the pastel it has on /routines.
    const tints = routineTints(all);
    return all
      .filter((r) => slugs.has(r.programSlug))
      .slice(0, data.limit)
      .map((r) => ({ ...r, tint: tints.get(r.programSlug) ?? FALLBACK_TINT }));
  });

export const getPublicRoutineBySlug = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ slug: z.string().min(1).max(80) }).parse(data))
  .handler(async ({ data }): Promise<PublicRoutineDetail | null> => {
    const supabase = publicClient();
    const { data: rows, error } = await supabase
      .from("templates")
      .select(TEMPLATE_COLUMNS)
      .eq("is_system", true)
      .eq("program_slug", data.slug)
      // Training order, the same ordering groupPrograms uses on mobile.
      .order("position", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });
    if (error) throw error;
    const days = (rows ?? []) as unknown as TemplateRowRaw[];
    if (days.length === 0) return null;

    // The picker walks the whole system list, since a program's image
    // depends on its neighbours; the index has that list cached.
    const art =
      (await getPublicRoutines()).find((r) => r.programSlug === data.slug)?.art ?? FALLBACK_IMAGE;

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
        .is("owner_id", null)
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
      art,
      ...programFacts(days, data.slug),
      muscles: rankMuscles(
        days.flatMap((d) => d.template_exercises.map((te) => te.exercise_id)),
        byId,
      ),
      days: days.map((d) => ({
        id: d.id,
        name: d.name,
        exercises: [...d.template_exercises]
          .sort((a, b) => a.position - b.position)
          .map((te): PublicRoutineExercise | null => {
            const e = byId.get(te.exercise_id);
            if (!e) return null;
            return {
              id: te.exercise_id,
              slug: e.slug,
              name: e.name,
              equipment: e.equipment,
              targetSets: te.target_sets,
              targetReps: te.target_reps,
            };
          })
          .filter((e): e is PublicRoutineExercise => !!e),
      })),
    };
  });

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
      .is("owner_id", null)
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
