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
//
// Status: the free-exercise-db migration this was written for is complete --
// zero rows match SOURCE_HOST, so a call today is a no-op. It is kept for the
// next time catalog imagery arrives from an external host, which is why the
// file type is now detected rather than assumed (it used to hardcode jpeg).

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

type Fetched = { bytes: Uint8Array; contentType: string | null };

async function fetchWithRetry(url: string): Promise<Fetched | null> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        return {
          bytes: new Uint8Array(await res.arrayBuffer()),
          contentType: res.headers.get("content-type"),
        };
      }
      // The upstream file is gone. Retrying will not bring it back.
      if (res.status === 404) return null;
    } catch {
      // Network blip. Fall through to the backoff.
    }
    await sleep(400 * attempt);
  }
  return null;
}

type ImageType = { ext: string; mime: string };

const BY_MIME: Record<string, ImageType> = {
  "image/jpeg": { ext: "jpg", mime: "image/jpeg" },
  "image/jpg": { ext: "jpg", mime: "image/jpeg" },
  "image/png": { ext: "png", mime: "image/png" },
  "image/gif": { ext: "gif", mime: "image/gif" },
  "image/webp": { ext: "webp", mime: "image/webp" },
  "image/avif": { ext: "avif", mime: "image/avif" },
};

const starts = (b: Uint8Array, sig: number[], at = 0) =>
  sig.every((byte, i) => b[at + i] === byte);

/** Magic bytes first, because they are the only signal that cannot lie. A CDN
 *  will happily serve a GIF as application/octet-stream, and a URL extension is
 *  just a string someone typed. Header and URL are fallbacks for formats not
 *  listed here. Guessing wrong writes a file browsers refuse to render, so the
 *  order matters more than it looks. */
function detectImageType(bytes: Uint8Array, contentType: string | null, url: string): ImageType {
  if (starts(bytes, [0xff, 0xd8, 0xff])) return BY_MIME["image/jpeg"]!;
  if (starts(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return BY_MIME["image/png"]!;
  if (starts(bytes, [0x47, 0x49, 0x46, 0x38])) return BY_MIME["image/gif"]!;
  // RIFF....WEBP -- the four size bytes sit between the two markers.
  if (starts(bytes, [0x52, 0x49, 0x46, 0x46]) && starts(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return BY_MIME["image/webp"]!;
  }
  // ....ftypavif
  if (starts(bytes, [0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66], 4)) {
    return BY_MIME["image/avif"]!;
  }

  const header = (contentType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (BY_MIME[header]) return BY_MIME[header]!;

  const ext = url.split("?")[0]?.split("#")[0]?.split(".").pop()?.toLowerCase() ?? "";
  const byExt = Object.values(BY_MIME).find((t) => t.ext === (ext === "jpeg" ? "jpg" : ext));
  if (byExt) return byExt;

  // Unrecognised. jpeg is the historical default and every catalog image to
  // date has been one, so it is the least surprising thing to fall back to.
  return BY_MIME["image/jpeg"]!;
}

async function moveOne(
  slug: string,
  url: string,
  index: 0 | 1,
): Promise<string | null> {
  const fetched = await fetchWithRetry(url);
  if (!fetched) return null;

  const { ext, mime } = detectImageType(fetched.bytes, fetched.contentType, url);

  // Path comes from the slug, so a retry overwrites the same object rather
  // than piling up duplicates. Note the extension is part of the path: moving
  // a row from one format to another leaves the old object behind rather than
  // replacing it, so a format change wants a sweep of the bucket afterwards.
  const path = `${slug}-${index}.${ext}`;
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, fetched.bytes, {
    contentType: mime,
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
