// merge-guest: moves a guest's workouts, routines and settings into the
// existing account the guest is signing in to, then deletes the guest.
// See docs/guest-merge-spec.md.
//
// Deployed with verify_jwt off (see supabase/config.toml), so the platform
// checks nothing. Every check is here, in this order:
//
//   1. Authorization: Bearer <account's access token>. auth.getUser sends it
//      to the auth server, which checks the signature, the expiry, and that
//      the user and its session still exist. Refused unless it verifies and
//      the user is not anonymous (checkTarget).
//   2. body.guestAccessToken, put to auth.getUser the same way.
//   3. decideGuest: refused if the guest's id is the caller's, or the guest
//      is not anonymous. A merge runs only when both tokens verified.
//   4. A guest token that does not verify is never merged. If it names a
//      user id, the ledger is read for that id and the caller's verified id
//      (guest_merge_record), so a retry after a lost response gets the first
//      call's answer. That lookup moves nothing.
//
// merge_guest_account repeats the checks in SQL (two different users, the
// guest anonymous, the account not) inside the transaction that moves the
// rows. decide.ts holds the decisions, tested in packages/shared.
//
// Secrets: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, from the platform.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

import {
  bearerToken,
  checkTarget,
  decideGuest,
  guestTokenFrom,
  refusalForSqlState,
  unverifiedSubject,
  type Refusal,
  type VerifiedUser,
} from "./decide.ts";

type Moved = Record<string, number | string>;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function refuse(r: Refusal): Response {
  return json(r.status, { merged: false, error: r.error });
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

/** The user a token belongs to, asked of the auth server. Null when it does not verify. */
async function verify(admin: SupabaseClient, token: string): Promise<VerifiedUser> {
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, is_anonymous: data.user.is_anonymous };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const targetToken = bearerToken(req.headers.get("Authorization"));
  if (!targetToken) return refuse({ status: 401, error: "not_signed_in" });

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    // Handled as a missing guest token.
  }
  const guestToken = guestTokenFrom(body);
  if (!guestToken) return refuse({ status: 400, error: "guest_session_invalid" });

  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. The account.
  const target = await verify(admin, targetToken);
  const targetRefusal = checkTarget(target);
  if (targetRefusal || !target) return refuse(targetRefusal ?? { status: 401, error: "not_signed_in" });

  // 2 and 3. The guest.
  const guest = await verify(admin, guestToken);
  const decision = decideGuest({
    targetId: target.id,
    guest,
    unverifiedGuestId: guest ? null : unverifiedSubject(guestToken),
  });

  if (decision.kind === "refuse") {
    log("info", decision.refusal.error, { targetId: target.id, guestId: guest?.id ?? null });
    return refuse(decision.refusal);
  }

  // 4. A retry for a guest the first call already deleted.
  if (decision.kind === "ledger") {
    const { data, error } = await admin.rpc("guest_merge_record", {
      p_guest: decision.guestId,
      p_target: decision.targetId,
    });
    const moved = !error ? (data as { moved?: Moved } | null)?.moved : undefined;
    if (moved) {
      log("info", "already_merged", { guestId: decision.guestId, targetId: decision.targetId });
      return json(200, { merged: true, status: "already_merged", moved });
    }
    if (error) {
      // Unknown, so the app tries again rather than giving up.
      log("error", "ledger_lookup_failed", { targetId: decision.targetId, reason: error.message });
      return refuse({ status: 500, error: "merge_failed" });
    }
    return refuse({ status: 401, error: "guest_session_invalid" });
  }

  // The move, in one transaction.
  const { data, error } = await admin.rpc("merge_guest_account", {
    p_guest: decision.guestId,
    p_target: decision.targetId,
  });
  if (error) {
    log("error", "merge_failed", {
      guestId: decision.guestId,
      targetId: decision.targetId,
      code: error.code,
      reason: error.message,
    });
    return refuse(refusalForSqlState(error.code));
  }

  const result = data as { status: "merged" | "already_merged"; moved: Moved };
  log("info", result.status, { guestId: decision.guestId, targetId: decision.targetId, moved: result.moved });
  return json(200, { merged: true, status: result.status, moved: result.moved });
});
