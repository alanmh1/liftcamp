// Checks AUTHORED_SLUGS and LINKABLE_SLUGS in
// src/components/guides/ExerciseLink.tsx against the live catalog: every
// authored slug exists and has a beginner_notes row, every noted catalog slug
// is listed, and every linkable slug exists without one. Read-only.
//
//   pnpm --filter @liftcamp/web exec tsx scripts/check-guide-links.ts
//
// Same reads and filters as check-exercise-alternatives.ts. Exits 1 on a
// problem.

import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";
import { guideLinkProblems } from "../src/lib/guide-links";

const ROOT = path.resolve(import.meta.dirname, "..");

async function main() {
  const env = { ...loadEnv("production", ROOT, ""), ...process.env };
  const url = env["SUPABASE_URL"];
  const key = env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) {
    console.error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are not set.");
    process.exit(2);
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Same filters as getSeoCatalog in src/lib/public-catalog.functions.ts.
  const [exRes, notesRes] = await Promise.all([
    supabase.from("exercises").select("id, slug").is("owner_id", null).range(0, 4999),
    supabase.from("beginner_notes").select("exercise_id"),
  ]);
  if (exRes.error) throw exRes.error;
  if (notesRes.error) throw notesRes.error;

  const noted = new Set((notesRes.data ?? []).map((n) => n.exercise_id as string));
  const rows = (exRes.data ?? []).map((e) => ({
    slug: e.slug as string,
    has_notes: noted.has(e.id as string),
  }));

  const problems = guideLinkProblems(rows);
  const withNotes = rows.filter((r) => r.has_notes).length;
  console.log(`${rows.length} catalog rows, ${withNotes} with beginner_notes.`);
  if (problems.length === 0) {
    console.log("AUTHORED_SLUGS and LINKABLE_SLUGS match the catalog.");
    return;
  }
  for (const p of problems) console.log(p);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
