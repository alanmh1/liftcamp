// delete-account: deletes the calling user's account, for the in-app
// "Delete account" button (App Store guideline 5.1.1(v)).
//
// Order:
//   1. Verify the caller's access token with the auth server. The user id
//      comes from that token and nowhere else, so a caller can only ever
//      delete themselves.
//   2. If the account has an Apple identity, revoke its token with Apple,
//      using the one-time authorization code from a fresh Apple sign-in on
//      the device. A failure here is logged and the delete goes ahead: the
//      person asked for their account to be deleted.
//   3. Delete the rows keyed by email, which no foreign key can reach:
//      email_send_log and email_unsubscribe_tokens. suppressed_emails is
//      kept on purpose, so a bounced or complained address is never mailed
//      again.
//   4. auth.admin.deleteUser. Every per-user public table has an ON DELETE
//      CASCADE key to auth.users, so this removes the rest.
//   5. The RevenueCat customer, so no purchase history stays with
//      RevenueCat under a deleted id. Skipped when REVENUECAT_SECRET_KEY is
//      not set; a failure is logged and the delete still succeeds. Apple
//      keeps billing an active subscription until the person cancels it;
//      the app says so in the confirmation.
//   6. A confirmation email through Resend, to the address captured before
//      the delete. Skipped for guests, Apple private relay addresses and
//      suppressed addresses. A failed send is logged; the account is
//      already gone, so the response still reports success.
//
// Guests (anonymous users) have a real access token and no email or Apple
// identity, so they go from step 1 straight to steps 4 and 5.
//
// Secrets: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the
// platform. APPLE_TEAM_ID, APPLE_KEY_ID and APPLE_PRIVATE_KEY (the full
// .p8 file, a Sign in with Apple key), RESEND_API_KEY and
// REVENUECAT_SECRET_KEY (a v1 secret API key, shared with
// revenuecat-webhook) are set with `supabase secrets set`.
//
// Deployed with verify_jwt off (see supabase/config.toml): the function
// checks the token itself with auth.getUser, which also confirms the user
// still exists.

import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";
import { decodeJwt, importPKCS8, SignJWT } from "npm:jose@5";

import { DELETED_HTML, DELETED_SUBJECT, DELETED_TEXT } from "./email.ts";

const APPLE_CLIENT_ID = "app.liftcamp.mobile";
const APPLE_AUDIENCE = "https://appleid.apple.com";

// The same sender as the auth emails. Replies go to the inbox someone
// reads, since the email asks anyone who did not delete the account to
// reply.
const EMAIL_FROM = "LiftCamp <noreply@liftcamp.app>";
const EMAIL_REPLY_TO = "hello@liftcamp.app";
const APPLE_RELAY_DOMAIN = "@privaterelay.appleid.com";

type AppleResult = "none" | "revoked" | "failed";
type EmailResult = "sent" | "skipped" | "failed";
type RevenueCatResult = "deleted" | "skipped" | "failed";

/** Deletes the RevenueCat customer whose app user id is this user's id. */
async function deleteRevenueCatCustomer(userId: string): Promise<RevenueCatResult> {
  const key = Deno.env.get("REVENUECAT_SECRET_KEY");
  if (!key) return "skipped";
  try {
    const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${key}` },
    });
    // 404: never opened the app on a build with RevenueCat.
    if (res.ok || res.status === 404) return "deleted";
    log("error", "revenuecat_delete_failed", { userId, status: res.status });
    return "failed";
  } catch (e) {
    log("error", "revenuecat_delete_failed", { userId, reason: (e as Error).message });
    return "failed";
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Structured log line. User ids only; never the email. */
function log(level: "info" | "error", event: string, fields: Record<string, unknown>) {
  const line = JSON.stringify({ fn: "delete-account", event, ...fields });
  if (level === "error") console.error(line);
  else console.log(line);
}

function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

/**
 * The client secret Apple's token endpoints expect: an ES256 JWT signed
 * with the Sign in with Apple key. Short-lived, since it is used at once.
 */
async function appleClientSecret(): Promise<string> {
  // `supabase secrets set` keeps real newlines, but a value pasted with
  // literal \n sequences is common enough to accept too.
  const pem = env("APPLE_PRIVATE_KEY").replace(/\\n/g, "\n");
  const key = await importPKCS8(pem, "ES256");
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: env("APPLE_KEY_ID") })
    .setIssuer(env("APPLE_TEAM_ID"))
    .setSubject(APPLE_CLIENT_ID)
    .setAudience(APPLE_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(key);
}

async function appleForm(path: string, fields: Record<string, string>): Promise<Response> {
  return fetch(`${APPLE_AUDIENCE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
  });
}

/**
 * Swaps the authorization code for a refresh token, then revokes it.
 * Revoking the refresh token ends the app's grant for that Apple ID, which
 * is what Apple asks for on account deletion.
 *
 * The code is checked against the account's own Apple identity: the id
 * token Apple returns with the refresh token carries the Apple user id
 * (`sub`), and it must match the one Supabase stored. A code from a
 * different Apple ID on the same phone is not revoked.
 */
async function revokeApple(userId: string, appleSub: string, code: string | undefined): Promise<AppleResult> {
  if (!code) {
    log("error", "apple_revoke_failed", { userId, reason: "no authorization code from the app" });
    return "failed";
  }
  try {
    const clientSecret = await appleClientSecret();

    const tokenRes = await appleForm("/auth/token", {
      client_id: APPLE_CLIENT_ID,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
    });
    if (!tokenRes.ok) {
      log("error", "apple_revoke_failed", {
        userId,
        reason: "token exchange",
        status: tokenRes.status,
        body: await tokenRes.text(),
      });
      return "failed";
    }
    const tokens = (await tokenRes.json()) as { refresh_token?: string; id_token?: string };

    // Straight from Apple over TLS, so decoding without verifying is enough
    // to read who it is for.
    const sub = tokens.id_token ? decodeJwt(tokens.id_token).sub : undefined;
    if (sub !== appleSub) {
      log("error", "apple_revoke_failed", { userId, reason: "code belongs to a different Apple ID" });
      return "failed";
    }
    if (!tokens.refresh_token) {
      log("error", "apple_revoke_failed", { userId, reason: "no refresh token in the exchange" });
      return "failed";
    }

    const revokeRes = await appleForm("/auth/revoke", {
      client_id: APPLE_CLIENT_ID,
      client_secret: clientSecret,
      token: tokens.refresh_token,
      token_type_hint: "refresh_token",
    });
    if (!revokeRes.ok) {
      log("error", "apple_revoke_failed", {
        userId,
        reason: "revoke",
        status: revokeRes.status,
        body: await revokeRes.text(),
      });
      return "failed";
    }
    return "revoked";
  } catch (e) {
    log("error", "apple_revoke_failed", { userId, reason: (e as Error).message });
    return "failed";
  }
}

/**
 * Where to send the confirmation, or null to skip. Read before the delete,
 * since the address goes with the user. Guests have no email; an Apple
 * private relay address forwards only while the Apple grant stands, and
 * the grant was just revoked; a suppressed address is never mailed.
 */
async function confirmationAddress(
  admin: SupabaseClient,
  user: User,
): Promise<string | null> {
  const email = user.email?.trim().toLowerCase();
  if (!email || user.is_anonymous) return null;
  if (email.endsWith(APPLE_RELAY_DOMAIN)) return null;
  const { data, error } = await admin.from("suppressed_emails").select("id").eq("email", email).limit(1);
  if (error) {
    // Unknown means do not send.
    log("error", "suppression_check_failed", { userId: user.id, reason: error.message });
    return null;
  }
  return data.length > 0 ? null : email;
}

async function sendConfirmation(userId: string, to: string): Promise<EmailResult> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
        // A retried request for the same user sends one email.
        "Idempotency-Key": `account-deleted/${userId}`,
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        reply_to: EMAIL_REPLY_TO,
        to: [to],
        subject: DELETED_SUBJECT,
        html: DELETED_HTML,
        text: DELETED_TEXT,
      }),
    });
    if (!res.ok) {
      log("error", "confirmation_email_failed", { userId, status: res.status, body: await res.text() });
      return "failed";
    }
    return "sent";
  } catch (e) {
    log("error", "confirmation_email_failed", { userId, reason: (e as Error).message });
    return "failed";
  }
}

/** The Apple user id Supabase stored for this account, if it has one. */
function appleSubject(user: User): string | null {
  const identity = user.identities?.find((i) => i.provider === "apple");
  if (!identity) return null;
  const sub = identity.identity_data?.sub;
  return typeof sub === "string" && sub ? sub : identity.id;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "not_signed_in" });

  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Who is asking. getUser asks the auth server, so an expired, forged or
  // already-deleted user's token fails here.
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json(401, { error: "not_signed_in" });
  const user = auth.user;

  let body: { appleAuthorizationCode?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // An empty body is fine for accounts without Apple.
  }
  const code = typeof body.appleAuthorizationCode === "string" ? body.appleAuthorizationCode : undefined;

  // 2. Apple.
  const appleSub = appleSubject(user);
  const apple: AppleResult = appleSub ? await revokeApple(user.id, appleSub, code) : "none";

  // 3. Email-keyed rows. Both spellings, since the log keeps whatever
  // address a send went to and auth stores it lowercased.
  if (user.email) {
    const emails = [...new Set([user.email, user.email.toLowerCase()])];
    const sendLog = await admin.from("email_send_log").delete().in("recipient_email", emails);
    const tokens = await admin.from("email_unsubscribe_tokens").delete().in("email", emails);
    const failed = sendLog.error ?? tokens.error;
    if (failed) {
      log("error", "email_rows_failed", { userId: user.id, reason: failed.message });
      return json(500, { error: "delete_failed" });
    }
  }

  // For step 5, while the user still exists.
  const confirmTo = await confirmationAddress(admin, user);

  // 4. The account. Hard delete, so the CASCADE keys fire now.
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    log("error", "delete_user_failed", { userId: user.id, reason: deleteError.message });
    return json(500, { error: "delete_failed" });
  }

  // 5. RevenueCat.
  const revenuecat = await deleteRevenueCatCustomer(user.id);

  // 6. Confirmation.
  const email: EmailResult = confirmTo ? await sendConfirmation(user.id, confirmTo) : "skipped";

  log("info", "deleted", { userId: user.id, anonymous: !!user.is_anonymous, apple, revenuecat, email });
  return json(200, { deleted: true, apple, email });
});
