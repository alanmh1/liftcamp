// moderate-text: checks a finished workout's name and note, or a
// username, with OpenAI's moderation endpoint, and files an automatic
// report when it flags one (docs/social-v1-spec.md, Edge Function).
//
// Called only by the database: the workouts_queue_moderation and
// user_profiles_queue_moderation triggers (docs/social-safety.sql,
// Section 7) post { table, id } through pg_net for users with social on.
// The text is never in the request; the row is read here with the
// service role.
//
// Order:
//   1. POST only. Compare the x-moderation-secret header to
//      MODERATION_HOOK_SECRET in constant time. Anything else gets 401 and
//      touches nothing.
//   2. Parse { table: 'workouts' | 'user_profiles', id: uuid }; 400 if not.
//   3. No OPENAI_API_KEY: log once per instance and answer 200
//      { skipped: 'no key' }. The blocklist still applies.
//   4. Read the row. Skip (200) when there is nothing to check: a workout
//      that is gone, unfinished, not made on ios or android, or has no
//      name or note; a profile with no username.
//   5. POST https://api.openai.com/v1/moderations with
//      model omni-moderation-latest and the text as input. An error or an
//      answer with no result is logged and answers 502. pg_net does not
//      retry, so that check is simply missed.
//   6. workouts: set moderated_at, set or clear moderation_flagged_at
//      (keeping an earlier flag's time). On the move from unflagged to
//      flagged, with no open auto_flag report for the workout, file one:
//      reporter null, reason auto_flag, detail { field: 'workout',
//      categories }.
//      user_profiles: when flagged, with no open auto_flag report for the
//      user carrying the same username, file one with detail
//      { field: 'username', username, categories }. Usernames are never
//      changed here; the admin decides on /admin.
//
// Every new report emails hello@liftcamp.app from the database
// (reports_notify_admin), so nothing here sends mail.
//
// Secrets: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the
// platform. OPENAI_API_KEY (a platform.openai.com key; the moderation
// endpoint is free) and MODERATION_HOOK_SECRET (the value Section 9 of
// docs/social-safety.sql shows) are set with `supabase secrets set`.
//
// Deployed with verify_jwt off (see supabase/config.toml): pg_net sends no
// Supabase JWT, and step 1 is the check.
//   supabase functions deploy moderate-text --no-verify-jwt --project-ref mnsigwjyskxfuszeegtp

import { createClient } from "npm:@supabase/supabase-js@2";

import {
  authorized,
  parseTarget,
  usernameText,
  verdictFrom,
  workoutText,
  workoutUpdate,
  type ModerationResponse,
  type Verdict,
  type WorkoutRow,
} from "./decide.ts";

const OPENAI_MODERATIONS = "https://api.openai.com/v1/moderations";
const MODEL = "omni-moderation-latest";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Structured log line. Ids and category names only, never the text. */
function log(event: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ fn: "moderate-text", event, ...fields }));
}

let loggedNoKey = false;

async function moderate(text: string, key: string): Promise<Verdict> {
  const res = await fetch(OPENAI_MODERATIONS, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, input: text }),
  });
  if (!res.ok) throw new Error(`openai ${res.status}`);
  const verdict = verdictFrom((await res.json()) as ModerationResponse);
  if (!verdict) throw new Error("openai answer had no result");
  return verdict;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  if (!authorized(req.headers.get("x-moderation-secret"), Deno.env.get("MODERATION_HOOK_SECRET"))) {
    log("unauthorized");
    return json(401, { error: "unauthorized" });
  }

  let target;
  try {
    target = parseTarget(await req.json());
  } catch {
    target = null;
  }
  if (!target) return json(400, { error: "bad_request" });

  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) {
    if (!loggedNoKey) {
      loggedNoKey = true;
      log("no_key");
    }
    return json(200, { skipped: "no key" });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (target.table === "workouts") {
      const { data: row, error } = await admin
        .from("workouts")
        .select("id, user_id, name, notes, finished_at, platform, moderation_flagged_at")
        .eq("id", target.id)
        .maybeSingle<WorkoutRow>();
      if (error) throw new Error(`read workout: ${error.message}`);
      const text = workoutText(row);
      if (!row || text == null) return json(200, { skipped: "nothing to check" });

      let verdict: Verdict;
      try {
        verdict = await moderate(text, key);
      } catch (e) {
        log("openai_failed", { table: target.table, id: target.id, error: String(e) });
        return json(502, { error: "moderation_failed" });
      }

      const update = workoutUpdate(row, verdict, new Date().toISOString());
      const { error: writeError } = await admin
        .from("workouts")
        .update({ moderated_at: update.moderated_at, moderation_flagged_at: update.moderation_flagged_at })
        .eq("id", row.id);
      if (writeError) throw new Error(`write workout: ${writeError.message}`);

      let reported = false;
      if (update.newlyFlagged) {
        const { data: open, error: openError } = await admin
          .from("reports")
          .select("id")
          .eq("reason", "auto_flag")
          .eq("status", "open")
          .eq("target_workout_id", row.id)
          .limit(1);
        if (openError) throw new Error(`read reports: ${openError.message}`);
        if (!open || open.length === 0) {
          const { error: insertError } = await admin.from("reports").insert({
            reporter_id: null,
            target_user_id: row.user_id,
            target_workout_id: row.id,
            reason: "auto_flag",
            detail: { field: "workout", categories: verdict.categories },
          });
          if (insertError) throw new Error(`file report: ${insertError.message}`);
          reported = true;
        }
      }
      log("checked", { table: target.table, id: row.id, flagged: verdict.flagged, categories: verdict.categories, reported });
      return json(200, { flagged: verdict.flagged, reported });
    }

    const { data: profile, error } = await admin
      .from("user_profiles")
      .select("user_id, username")
      .eq("user_id", target.id)
      .maybeSingle<{ user_id: string; username: string | null }>();
    if (error) throw new Error(`read profile: ${error.message}`);
    const text = usernameText(profile?.username);
    if (!profile?.username || text == null) return json(200, { skipped: "nothing to check" });

    let verdict: Verdict;
    try {
      verdict = await moderate(text, key);
    } catch (e) {
      log("openai_failed", { table: target.table, id: target.id, error: String(e) });
      return json(502, { error: "moderation_failed" });
    }

    let reported = false;
    if (verdict.flagged) {
      const { data: open, error: openError } = await admin
        .from("reports")
        .select("id")
        .eq("reason", "auto_flag")
        .eq("status", "open")
        .eq("target_user_id", profile.user_id)
        .eq("detail->>username", profile.username)
        .limit(1);
      if (openError) throw new Error(`read reports: ${openError.message}`);
      if (!open || open.length === 0) {
        const { error: insertError } = await admin.from("reports").insert({
          reporter_id: null,
          target_user_id: profile.user_id,
          target_workout_id: null,
          reason: "auto_flag",
          detail: { field: "username", username: profile.username, categories: verdict.categories },
        });
        if (insertError) throw new Error(`file report: ${insertError.message}`);
        reported = true;
      }
    }
    log("checked", { table: target.table, id: profile.user_id, flagged: verdict.flagged, categories: verdict.categories, reported });
    return json(200, { flagged: verdict.flagged, reported });
  } catch (e) {
    log("failed", { table: target.table, id: target.id, error: String(e) });
    return json(500, { error: "failed" });
  }
});
