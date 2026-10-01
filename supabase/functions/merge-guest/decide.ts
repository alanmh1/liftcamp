// merge-guest's decisions, with no I/O: which request is refused, which
// merges, and which only reads the ledger. index.ts does the network calls
// and follows these answers. No imports, so vitest runs this file from
// packages/shared (src/merge-guest-decide.test.ts) as it is deployed.

/** A user as auth.getUser returned it, or null when the token did not verify. */
export type VerifiedUser = { id: string; is_anonymous?: boolean } | null;

export type MergeError =
  | "not_signed_in"
  | "account_is_guest"
  | "guest_session_invalid"
  | "not_a_guest"
  | "same_account"
  | "refused"
  | "guest_gone"
  | "merge_failed";

export type Refusal = { status: number; error: MergeError };

/** The bearer token from an Authorization header, or null. */
export function bearerToken(header: string | null | undefined): string | null {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header ?? "");
  return match ? match[1] : null;
}

/** The guest token from the request body, or null. */
export function guestTokenFrom(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const token = (body as { guestAccessToken?: unknown }).guestAccessToken;
  return typeof token === "string" && token.length > 0 ? token : null;
}

/**
 * The caller: the account the guest signed in to. Must verify, and must not
 * be a guest itself. Null means go on.
 */
export function checkTarget(target: VerifiedUser): Refusal | null {
  if (!target) return { status: 401, error: "not_signed_in" };
  if (target.is_anonymous) return { status: 403, error: "account_is_guest" };
  return null;
}

/**
 * What to do once both tokens have been put to the auth server.
 * - `merge`: both verified, the guest is anonymous, and they are two users.
 * - `ledger`: the guest token did not verify but names a user id. Only a
 *   ledger lookup for this exact pair may follow, never a merge.
 * - `refuse`: answer with this.
 */
export type GuestDecision =
  | { kind: "merge"; guestId: string; targetId: string }
  | { kind: "ledger"; guestId: string; targetId: string }
  | { kind: "refuse"; refusal: Refusal };

export function decideGuest(input: {
  targetId: string;
  guest: VerifiedUser;
  /** The guest token's `sub`, read without verifying. */
  unverifiedGuestId: string | null;
}): GuestDecision {
  const { targetId, guest, unverifiedGuestId } = input;
  if (!guest) {
    if (unverifiedGuestId && unverifiedGuestId !== targetId) {
      return { kind: "ledger", guestId: unverifiedGuestId, targetId };
    }
    return { kind: "refuse", refusal: { status: 401, error: "guest_session_invalid" } };
  }
  // Before the anonymous check, so a caller who sends its own token twice
  // is told exactly that.
  if (guest.id === targetId) return { kind: "refuse", refusal: { status: 400, error: "same_account" } };
  if (!guest.is_anonymous) return { kind: "refuse", refusal: { status: 403, error: "not_a_guest" } };
  return { kind: "merge", guestId: guest.id, targetId };
}

/** The answer for an error raised by merge_guest_account, by SQLSTATE. */
export function refusalForSqlState(code: string | null | undefined): Refusal {
  if (code === "42501") return { status: 403, error: "refused" };
  if (code === "P0002") return { status: 410, error: "guest_gone" };
  return { status: 500, error: "merge_failed" };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64UrlToText(input: string): string | null {
  const s = input.replace(/-/g, "+").replace(/_/g, "/");
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of s) {
    if (ch === "=") break;
    const v = B64.indexOf(ch);
    if (v < 0) return null;
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  try {
    return decodeURIComponent(bytes.map((b) => `%${b.toString(16).padStart(2, "0")}`).join(""));
  } catch {
    return null;
  }
}

/**
 * A JWT's `sub` when it is a user id, read WITHOUT checking the signature.
 * Only for the ledger lookup, which never moves anything.
 */
export function unverifiedSubject(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const text = base64UrlToText(parts[1]);
  if (!text) return null;
  try {
    const sub = (JSON.parse(text) as { sub?: unknown }).sub;
    return typeof sub === "string" && UUID.test(sub) ? sub : null;
  } catch {
    return null;
  }
}
