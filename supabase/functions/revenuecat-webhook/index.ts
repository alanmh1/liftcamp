// revenuecat-webhook: keeps public.user_entitlements in step with
// RevenueCat, for server code and RLS. The app reads the SDK directly for
// instant state; this table is what lets a web purchase unlock mobile
// later, and what any server-side Pro check reads.
//
// Order:
//   1. Check the Authorization header against REVENUECAT_WEBHOOK_AUTH, the
//      value set on the webhook in the RevenueCat dashboard. Anything else
//      gets 401 and touches nothing.
//   2. Look the event id up in revenuecat_webhook_events. Already processed
//      means a retry or a duplicate: answer 200 and stop.
//   3. For every Supabase user the event names (both sides of a TRANSFER),
//      read the subscriber from RevenueCat's REST API and write the row
//      that state gives. RevenueCat recommends this over rebuilding state
//      from each event: it is the same shape for every event type, and
//      events that arrive out of order cannot leave a stale row.
//   4. Mark the event processed.
//
// Any failure in 3 answers 500 and leaves processed_at null, so
// RevenueCat retries (5 times, 5 to 80 minutes apart) and the retry does
// the whole sync again. Writing the row is idempotent, so a repeat is
// harmless.
//
// A user who no longer exists (deleted account, merged guest) is skipped:
// the row would have been removed by the cascade anyway. So is a user with
// a tester row, which belongs to admin_set_entitlement (docs/pro-billing.md).
//
// Secrets: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the
// platform. REVENUECAT_WEBHOOK_AUTH (any long random string, also pasted
// into the dashboard) and REVENUECAT_SECRET_KEY (a v1 secret API key,
// sk_...) are set with `supabase secrets set`.
//
// Deployed with verify_jwt off (see supabase/config.toml): RevenueCat
// sends no Supabase JWT, and step 1 is the check.

import { createClient } from "npm:@supabase/supabase-js@2";

import { authorized, leaveRowAlone, rowFor, usersToSync, type Subscriber, type WebhookEvent } from "./decide.ts";

const RC_API = "https://api.revenuecat.com/v1/subscribers/";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Structured log line. Ids only. */
function log(event: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ fn: "revenuecat-webhook", event, ...fields }));
}

async function fetchSubscriber(userId: string, key: string): Promise<Subscriber> {
  const res = await fetch(RC_API + encodeURIComponent(userId), {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`revenuecat ${res.status}`);
  const body = (await res.json()) as { subscriber?: Subscriber };
  return body.subscriber ?? {};
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  if (!authorized(req.headers.get("Authorization"), Deno.env.get("REVENUECAT_WEBHOOK_AUTH"))) {
    log("unauthorized");
    return json(401, { error: "unauthorized" });
  }

  const rcKey = Deno.env.get("REVENUECAT_SECRET_KEY");
  if (!rcKey) {
    log("misconfigured", { missing: "REVENUECAT_SECRET_KEY" });
    return json(500, { error: "misconfigured" });
  }

  let event: WebhookEvent;
  try {
    const body = (await req.json()) as { event?: WebhookEvent };
    event = body.event ?? {};
  } catch {
    return json(400, { error: "bad_json" });
  }
  if (typeof event.id !== "string" || typeof event.type !== "string") {
    return json(400, { error: "no_event_id" });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: seen, error: seenError } = await admin
    .from("revenuecat_webhook_events")
    .select("processed_at")
    .eq("event_id", event.id)
    .maybeSingle();
  if (seenError) {
    log("ledger_read_failed", { id: event.id, code: seenError.code });
    return json(500, { error: "ledger_read_failed" });
  }
  if (seen?.processed_at) {
    log("duplicate", { id: event.id, type: event.type });
    return json(200, { ok: true, duplicate: true });
  }

  const { error: ledgerError } = await admin.from("revenuecat_webhook_events").upsert(
    {
      event_id: event.id,
      type: event.type,
      app_user_id: typeof event.app_user_id === "string" ? event.app_user_id : null,
      environment: typeof event.environment === "string" ? event.environment : null,
    },
    { onConflict: "event_id", ignoreDuplicates: true },
  );
  if (ledgerError) {
    log("ledger_write_failed", { id: event.id, code: ledgerError.code });
    return json(500, { error: "ledger_write_failed" });
  }

  // The dashboard's "Send test event" uses a made-up user: nothing to sync.
  const users = event.type === "TEST" ? [] : usersToSync(event);
  const now = new Date();

  for (const userId of users) {
    const { data: existing, error: existingError } = await admin
      .from("user_entitlements")
      .select("source")
      .eq("user_id", userId)
      .maybeSingle();
    if (existingError) {
      log("entitlement_read_failed", { id: event.id, user: userId, code: existingError.code });
      return json(500, { error: "entitlement_read_failed" });
    }
    if (leaveRowAlone(existing?.source)) {
      log("tester_row_kept", { id: event.id, type: event.type, user: userId });
      continue;
    }

    let subscriber: Subscriber;
    try {
      subscriber = await fetchSubscriber(userId, rcKey);
    } catch (e) {
      log("revenuecat_read_failed", { id: event.id, user: userId, error: (e as Error).message });
      return json(500, { error: "revenuecat_read_failed" });
    }

    const row = rowFor(subscriber, now);
    if (!row) {
      // Never had Pro. Clear a row left over from a transfer away, if any.
      const { error } = await admin
        .from("user_entitlements")
        .update({ is_pro: false, updated_at: now.toISOString() })
        .eq("user_id", userId);
      if (error) {
        log("entitlement_write_failed", { id: event.id, user: userId, code: error.code });
        return json(500, { error: "entitlement_write_failed" });
      }
      log("synced", { id: event.id, type: event.type, user: userId, is_pro: false, row: "none" });
      continue;
    }

    const { error } = await admin
      .from("user_entitlements")
      .upsert({ user_id: userId, ...row, updated_at: now.toISOString() }, { onConflict: "user_id" });
    if (error?.code === "23503") {
      // No such auth user any more.
      log("user_gone", { id: event.id, user: userId });
      continue;
    }
    if (error) {
      log("entitlement_write_failed", { id: event.id, user: userId, code: error.code });
      return json(500, { error: "entitlement_write_failed" });
    }
    log("synced", { id: event.id, type: event.type, user: userId, is_pro: row.is_pro, product: row.product_id });
  }

  if (users.length === 0) log("no_users", { id: event.id, type: event.type });

  const { error: doneError } = await admin
    .from("revenuecat_webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("event_id", event.id);
  if (doneError) {
    // The rows are written; a retry rewrites the same rows.
    log("ledger_mark_failed", { id: event.id, code: doneError.code });
    return json(500, { error: "ledger_mark_failed" });
  }

  return json(200, { ok: true, users: users.length });
});
