// Checks that every base and swap slug on the /exercises/<base>/alternatives
// pages exists in the live catalog and has a beginner_notes row. Read-only.
//
//   pnpm --filter @liftcamp/web exec tsx scripts/check-exercise-alternatives.ts
//
// The public catalog functions (getSeoCatalog) are TanStack Start server
// functions and only run inside the Start runtime, so this makes the same two
// reads getSeoCatalog does, with the same publishable key and filters, and
// hands the rows to the same rule the unit test covers. Exits 1 on a problem.

import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";
import { alternativesProblems } from "../src/lib/exercise-alternatives";

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
    supabase.from("beginner_notes").select("exercise_id, starting_weight_md"),
  ]);
  if (exRes.error) throw exRes.error;
  if (notesRes.error) throw notesRes.error;

  const notes = new Map((notesRes.data ?? []).map((n) => [n.exercise_id, n.starting_weight_md]));
  const exercises = (exRes.data ?? []).map((e) => ({
    slug: e.slug as string,
    starting_weight_md: (notes.get(e.id) as string | undefined) ?? null,
  }));

  const problems = alternativesProblems(exercises);
  console.log(`${exercises.length} catalog rows, ${notes.size} with beginner_notes.`);
  if (problems.length === 0) {
    console.log("Every base and swap slug exists and has beginner_notes.");
    return;
  }
  for (const p of problems) console.log(p);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
