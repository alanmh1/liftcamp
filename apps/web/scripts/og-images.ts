// Writes the 1200x630 link-card images for exercise and routine pages, and
// src/lib/og-images.json, the list of what exists (read by src/lib/og-images.ts).
//
//   public/og/exercises/<slug>.jpg   from public/exercise-art/<slug>.webp
//   public/og/routines/<slug>.jpg    the routine's equipment art on its pastel
//
// Runs before every build (package.json "build"), so new art is picked up.
// The output is committed, so link previews work without this step. A file
// that already exists is rewritten only when its source is newer.
//
// Routines need the database: the art key and pastel are computed over the
// whole system routine list, exactly as getPublicRoutines and routineTints
// do. Without SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY, or when the read
// fails, the routine images are left as they are and the manifest keeps the
// routines it already lists.
//
//   pnpm --filter @liftcamp/web exec tsx scripts/og-images.ts

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { loadEnv } from "vite";
import type { RoutineImageKey, TemplateRow } from "@liftcamp/shared";
// @liftcamp/shared has no "type": "module", so tsx loads it as CommonJS and
// Node exposes its exports only as the default export.
import * as sharedNs from "@liftcamp/shared";

const shared = (sharedNs as unknown as { default?: typeof sharedNs }).default ?? sharedNs;
const { FALLBACK_IMAGE, HERO_TINT_SLOT, routineArtByProgram, routineTintSlots } = shared;

const ROOT = path.resolve(import.meta.dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const MANIFEST = path.join(ROOT, "src/lib/og-images.json");

const WIDTH = 1200;
const HEIGHT = 630;
const QUALITY = 82;
/** Wordmark width and its inset from the bottom-right corner. */
const MARK_WIDTH = 168;
const MARK_INSET = 36;

/** Must match BEST_FIRST_SLUG and ROUTINE_TINTS in src/lib/routine-tints.ts. */
const HERO_SLUG = "full-body-3-day";
const TINT_NAMES = ["sky", "mint", "peach", "lavender", "butter", "sand"] as const;

type Manifest = { exercises: string[]; routines: string[] };

function readManifest(): Manifest {
  try {
    return JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest;
  } catch {
    return { exercises: [], routines: [] };
  }
}

/** True when `out` is missing or older than any of `sources`. */
function stale(out: string, sources: string[]): boolean {
  if (!existsSync(out)) return true;
  const built = statSync(out).mtimeMs;
  return sources.some((s) => statSync(s).mtimeMs > built);
}

let markCache: Buffer | null = null;
async function wordmark(): Promise<Buffer> {
  markCache ??= await sharp(path.join(PUBLIC, "liftcamp-wordmark.png"))
    .resize({ width: MARK_WIDTH })
    .png()
    .toBuffer();
  return markCache;
}

async function withMark(base: sharp.Sharp, out: string): Promise<void> {
  const mark = await wordmark();
  const { height: markHeight = 0 } = await sharp(mark).metadata();
  await base
    .composite([
      { input: mark, left: WIDTH - MARK_WIDTH - MARK_INSET, top: HEIGHT - markHeight - MARK_INSET },
    ])
    .jpeg({ quality: QUALITY, mozjpeg: true })
    .toFile(out);
}

async function exerciseImages(): Promise<string[]> {
  const dir = path.join(PUBLIC, "exercise-art");
  const outDir = path.join(PUBLIC, "og/exercises");
  mkdirSync(outDir, { recursive: true });
  const slugs = readdirSync(dir)
    .filter((f) => f.endsWith(".webp"))
    .map((f) => f.slice(0, -".webp".length))
    .sort();
  for (const slug of slugs) {
    const src = path.join(dir, `${slug}.webp`);
    const out = path.join(outDir, `${slug}.jpg`);
    if (!stale(out, [src])) continue;
    // The art is 16:9 with its own background, so covering 1200x630 trims
    // about 22px from the top and bottom and keeps the figure centred.
    await withMark(sharp(src).resize(WIDTH, HEIGHT, { fit: "cover", position: "centre" }), out);
    console.log(`og: ${path.relative(ROOT, out)}`);
  }
  return slugs;
}

/** The light-theme pastel hexes from styles.css, in slot order. */
function tintHexes(): string[] {
  const css = readFileSync(path.join(ROOT, "src/styles.css"), "utf8");
  return TINT_NAMES.map((name) => {
    // The first definition is the light theme's.
    const m = css.match(new RegExp(`--tint-${name}:\\s*(#[0-9A-Fa-f]{6})`));
    if (!m) throw new Error(`--tint-${name} not found in styles.css`);
    return m[1]!;
  });
}

type RoutineArt = { slug: string; art: RoutineImageKey; tint: string };

/** Each public routine's art key and pastel, computed the way the site does. */
async function routineArt(): Promise<RoutineArt[] | null> {
  const env = { ...loadEnv("production", ROOT, ""), ...process.env };
  const url = env["SUPABASE_URL"];
  const key = env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return null;

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Same columns and order as TEMPLATE_COLUMNS and getPublicRoutines in
  // src/lib/public-catalog.functions.ts.
  const { data, error } = await supabase
    .from("templates")
    .select(
      "id, name, program, program_slug, program_blurb, program_order, cover_image_url, level, days_per_week, equipment, position, created_at, template_exercises(exercise_id, position, target_sets, target_reps, exercises(equipment, primary_muscle))",
    )
    .eq("is_system", true)
    .order("program_order", { ascending: true })
    .order("position", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as unknown as (TemplateRow & {
    program: string | null;
    program_slug: string | null;
    program_order: number | null;
  })[];

  const art = routineArtByProgram(rows);
  const programs = new Map<string, { slug: string; order: number }>();
  for (const r of rows) {
    const program = r.program?.trim() || "Other routines";
    const seen = programs.get(program);
    programs.set(program, {
      slug: seen?.slug || r.program_slug || "",
      order: Math.min(seen?.order ?? 99, r.program_order ?? 99),
    });
  }
  const routines = [...programs.entries()]
    .filter(([, p]) => p.slug !== "")
    .sort((a, b) => a[1].order - b[1].order || (a[0] < b[0] ? -1 : 1))
    .map(([program, p]) => ({ slug: p.slug, art: art.get(program) ?? FALLBACK_IMAGE }));

  const hexes = tintHexes();
  const slots = routineTintSlots(
    routines.map((r) => ({ slug: r.slug, art: r.art })),
    { heroSlug: HERO_SLUG, slots: hexes.length },
  );
  return routines.map((r) => ({
    ...r,
    tint: hexes[slots.get(r.slug) ?? HERO_TINT_SLOT]!,
  }));
}

async function routineImages(previous: string[]): Promise<string[]> {
  let routines: RoutineArt[] | null = null;
  try {
    routines = await routineArt();
  } catch (error) {
    // A failed read must not fail the deploy; the committed cards stand.
    console.warn("og: routine read failed, routine images left as they are", error);
    return previous;
  }
  if (!routines) {
    console.warn("og: no Supabase env, routine images left as they are");
    return previous;
  }
  const outDir = path.join(PUBLIC, "og/routines");
  mkdirSync(outDir, { recursive: true });
  const artHeight = Math.round(HEIGHT * 0.85);
  for (const r of routines) {
    const src = path.join(PUBLIC, "equipment", `${r.art}.webp`);
    const out = path.join(outDir, `${r.slug}.jpg`);
    // The art and tint depend on the whole list, so routine cards are always
    // rewritten; there are about 30 and each takes milliseconds.
    const art = await sharp(src).resize({ height: artHeight }).png().toBuffer();
    const { width: artWidth = 0 } = await sharp(art).metadata();
    const base = sharp({
      create: { width: WIDTH, height: HEIGHT, channels: 3, background: r.tint },
    }).composite([
      {
        input: art,
        left: Math.round((WIDTH - artWidth) / 2),
        top: Math.round((HEIGHT - artHeight) / 2),
      },
    ]);
    // composite() replaces earlier composites, so flatten the art first.
    await withMark(sharp(await base.png().toBuffer()), out);
  }
  console.log(`og: ${routines.length} routine cards`);
  return routines.map((r) => r.slug).sort();
}

const previous = readManifest();
const manifest: Manifest = {
  exercises: await exerciseImages(),
  routines: await routineImages(previous.routines),
};
writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
