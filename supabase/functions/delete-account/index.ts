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
//
// Guests (anonymous users) have a real access token and no email or Apple
// identity, so they go straight from step 1 to step 4.
//
// Secrets: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the
// platform. APPLE_TEAM_ID, APPLE_KEY_ID and APPLE_PRIVATE_KEY (the full
// .p8 file, a Sign in with Apple key) are set with `supabase secrets set`.
//
// Deployed with verify_jwt off (see supabase/config.toml): the function
// checks the token itself with auth.getUser, which also confirms the user
// still exists.

import { createClient, type User } from "npm:@supabase/supabase-js@2";
import { decodeJwt, importPKCS8, SignJWT } from "npm:jose@5";

const APPLE_CLIENT_ID = "app.liftcamp.mobile";
const APPLE_AUDIENCE = "https://appleid.apple.com";

type AppleResult = "none" | "revoked" | "failed";

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

  // 4. The account. Hard delete, so the CASCADE keys fire now.
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    log("error", "delete_user_failed", { userId: user.id, reason: deleteError.message });
    return json(500, { error: "delete_failed" });
  }

  log("info", "deleted", { userId: user.id, anonymous: !!user.is_anonymous, apple });
  return json(200, { deleted: true, apple });
});
