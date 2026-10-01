// merge-guest: moves a guest's workouts, routines and settings into the
// existing account the guest just signed in to, then deletes the guest.
// See docs/guest-merge-spec.md.
//
// The caller proves control of both accounts:
//   - Authorization: Bearer <the account's access token>, the session the
//     app holds now.
//   - body.guestAccessToken: the guest's access token, kept on the phone
//     from before the sign-in switched sessions, refreshed by the app if it
//     has expired.
// Both are checked with the auth server (auth.getUser), which also confirms
// the user and its session still exist. The guest must be anonymous and
// the account must not be.
//
// The move is one SQL function, public.merge_guest_account, in one
// transaction: every row, the ledger entry and the guest's deletion commit
// together or not at all.
//
// Retries. A response lost after a successful merge leaves the app holding
// a guest token for a user that no longer exists, so getUser refuses it.
// Then the guest id is read from the token without verifying it, and only
// used to look up the ledger (public.guest_merge_record) for this exact
// pair. That lookup never moves anything and only answers about the
// caller's own, verified account.
//
// Secrets: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, from the platform.
// Deployed with verify_jwt off (see supabase/config.toml): the function
// checks both tokens itself.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { decodeJwt } from "npm:jose@5";

type Moved = Record<string, number | string>;

/** What the app gets back. */
type MergeResponse =
  | { merged: true; status: "merged" | "already_merged"; moved: Moved }
  | {
      merged: false;
      error:
        | "not_signed_in"
        | "account_is_guest"
        | "guest_session_invalid"
        | "not_a_guest"
        | "same_account"
        | "refused"
        | "guest_gone"
        | "merge_failed";
    };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(status: number, body: MergeResponse | { error: string }): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Structured log line. User ids only. */
function log(level: "info" | "error", event: string, fields: Record<string, unknown>) {
  const line = JSON.stringify({ fn: "merge-guest", event, ...fields });
  if (level === "error") console.error(line);
  else console.log(line);
}

function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

/** The `sub` of a token, unverified, when it is a user id. */
function unverifiedSubject(token: string): string | null {
  try {
    const sub = decodeJwt(token).sub;
    return typeof sub === "string" && UUID.test(sub) ? sub : null;
  } catch {
    return null;
  }
}

/** The ledger entry for this pair, or null. Never merges. */
async function priorMerge(admin: SupabaseClient, guestId: string, targetId: string): Promise<Moved | null> {
  const { data, error } = await admin.rpc("guest_merge_record", { p_guest: guestId, p_target: targetId });
  if (error) {
    log("error", "ledger_lookup_failed", { guestId, targetId, reason: error.message });
    return null;
  }
  const row = data as { moved?: Moved } | null;
  return row?.moved ?? null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const targetToken = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!targetToken) return json(401, { merged: false, error: "not_signed_in" });

  let body: { guestAccessToken?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // Handled below as a missing token.
  }
  const guestToken = typeof body.guestAccessToken === "string" ? body.guestAccessToken : "";
  if (!guestToken) return json(400, { merged: false, error: "guest_session_invalid" });

  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. The account the guest signed in to.
  const { data: targetAuth, error: targetError } = await admin.auth.getUser(targetToken);
  if (targetError || !targetAuth.user) return json(401, { merged: false, error: "not_signed_in" });
  const target = targetAuth.user;
  if (target.is_anonymous) return json(403, { merged: false, error: "account_is_guest" });

  // 2. The guest.
  const { data: guestAuth, error: guestError } = await admin.auth.getUser(guestToken);
  if (guestError || !guestAuth.user) {
    // Either expired (the app refreshes and calls again) or already merged
    // and deleted. Only the ledger can say which, for this pair.
    const guestId = unverifiedSubject(guestToken);
    const moved = guestId ? await priorMerge(admin, guestId, target.id) : null;
    if (moved) {
      log("info", "already_merged", { guestId, targetId: target.id });
      return json(200, { merged: true, status: "already_merged", moved });
    }
    log("info", "guest_session_invalid", { guestId, targetId: target.id, reason: guestError?.message });
    return json(401, { merged: false, error: "guest_session_invalid" });
  }
  const guest = guestAuth.user;
  if (!guest.is_anonymous) return json(403, { merged: false, error: "not_a_guest" });
  if (guest.id === target.id) return json(400, { merged: false, error: "same_account" });

  // 3. The move, in one transaction.
  const { data, error } = await admin.rpc("merge_guest_account", { p_guest: guest.id, p_target: target.id });
  if (error) {
    // Codes raised by the function: 42501 refused (wrong pair, not a guest,
    // a role), P0002 a user is gone, 55000 rows left that have no rule.
    const code = error.code ?? "";
    log("error", "merge_failed", { guestId: guest.id, targetId: target.id, code, reason: error.message });
    if (code === "42501") return json(403, { merged: false, error: "refused" });
    if (code === "P0002") return json(410, { merged: false, error: "guest_gone" });
    return json(500, { merged: false, error: "merge_failed" });
  }

  const result = data as { status: "merged" | "already_merged"; moved: Moved };
  log("info", result.status, { guestId: guest.id, targetId: target.id, moved: result.moved });
  return json(200, { merged: true, status: result.status, moved: result.moved });
});
