import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Moves exercise images off raw.githubusercontent.com into Supabase Storage.
//
// A server function rather than an Edge Function, matching the rest of this
// codebase. Admin-gated the same way listAuthEmailInbox is: the auth
// middleware puts a user-scoped client on context, and current_user_is_admin
// decides. supabaseAdmin does the writes because Storage uploads and the
// exercises update both need to bypass RLS.
//
// Time-budgeted, not count-budgeted. It works until the budget is up, then
// reports what is left, so a request never dies mid-upload. Call it again
// while rows_left is above zero.

const BUCKET = "exercise-images";
const SOURCE_HOST = "raw.githubusercontent.com";
/** Comfortably inside a serverless request timeout, with room for the
 *  in-flight upload and the response. */
const BUDGET_MS = 50_000;
const MAX_RETRIES = 2;

export type MigrateResult = {
  rows_remaining_at_start: number;
  rows_processed: number;
  images_moved: number;
  images_failed: number;
  rows_left: number;
  seconds: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url: string): Promise<Uint8Array | null> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return new Uint8Array(await res.arrayBuffer());
      // The upstream file is gone. Retrying will not bring it back.
      if (res.status === 404) return null;
    } catch {
      // Network blip. Fall through to the backoff.
    }
    await sleep(400 * attempt);
  }
  return null;
}

async function moveOne(
  slug: string,
  url: string,
  index: 0 | 1,
): Promise<string | null> {
  const bytes = await fetchWithRetry(url);
  if (!bytes) return null;

  // Path comes from the slug, so a retry overwrites the same object rather
  // than piling up duplicates.
  const path = `${slug}-${index}.jpg`;
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, {
    contentType: "image/jpeg",
    cacheControl: "31536000",
    upsert: true,
  });
  if (error) return null;

  return supabaseAdmin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export const migrateExerciseImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MigrateResult> => {
    const { data: isAdmin, error: roleError } =
      await context.supabase.rpc("current_user_is_admin");
    if (roleError) throw roleError;
    if (isAdmin !== true) throw new Response("Forbidden", { status: 403 });

    const startedAt = Date.now();

    const { data: rows, error } = await supabaseAdmin
      .from("exercises")
      .select("id, slug, image_url, image_url_2")
      .or(`image_url.like.%${SOURCE_HOST}%,image_url_2.like.%${SOURCE_HOST}%`)
      .order("slug");
    if (error) throw error;

    const total = rows?.length ?? 0;
    let processed = 0;
    let moved = 0;
    let failed = 0;

    for (const row of rows ?? []) {
      if (Date.now() - startedAt > BUDGET_MS) break;

      const patch: { image_url?: string; image_url_2?: string } = {};

      if (row.image_url?.includes(SOURCE_HOST)) {
        const next = await moveOne(row.slug, row.image_url, 0);
        if (next) patch["image_url"] = next;
        else failed++;
      }

      if (row.image_url_2?.includes(SOURCE_HOST)) {
        const next = await moveOne(row.slug, row.image_url_2, 1);
        if (next) patch["image_url_2"] = next;
        else failed++;
      }

      // Only the columns that actually moved. A row where one image 404s keeps
      // its working GitHub URL for the other rather than going blank.
      if (Object.keys(patch).length > 0) {
        const { error: upErr } = await supabaseAdmin
          .from("exercises")
          .update(patch)
          .eq("id", row.id);
        if (!upErr) moved += Object.keys(patch).length;
      }

      processed++;
    }

    return {
      rows_remaining_at_start: total,
      rows_processed: processed,
      images_moved: moved,
      images_failed: failed,
      rows_left: total - processed,
      seconds: Math.round((Date.now() - startedAt) / 1000),
    };
  });
