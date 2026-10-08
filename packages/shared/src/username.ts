/**
 * Usernames, the handle printed on share cards.
 *
 * Mirrors the database: `user_profiles.username` is unique on
 * `lower(username)` and checked against this shape, so a value that passes
 * here can only fail there by being taken.
 */
export const USERNAME_RE = /^[a-z][a-z0-9_]{2,19}$/;

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

/** Lowercased and stripped to the allowed characters, as the user types. */
export function normalizeUsernameInput(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, USERNAME_MAX);
}

export function isValidUsername(name: string): boolean {
  return USERNAME_RE.test(name);
}

/**
 * The one line that says why a candidate is not allowed, or null when it
 * is. Kept short enough for an inline error under an input.
 */
export function usernameProblem(name: string): string | null {
  if (name.length < USERNAME_MIN) return `At least ${USERNAME_MIN} characters.`;
  if (!/^[a-z]/.test(name)) return "Start with a letter.";
  if (!isValidUsername(name)) return "Lowercase letters, digits and underscore only.";
  return null;
}

/**
 * The generated username: `lifter` plus 5 random digits. What a guest gets,
 * and what an account gets when it has no name. Random rather than a row
 * count, since the app cannot count rows without racing another client;
 * the caller retries on a collision.
 */
export function fallbackUsername(random: () => number = Math.random): string {
  return `lifter${Math.floor(10000 + random() * 90000)}`;
}

/** A name `fallbackUsername` made, as opposed to one the user picked. */
export function isGeneratedUsername(name: string | null | undefined): boolean {
  return !!name && /^lifter[0-9]{5}$/.test(name);
}

// ---------------------------------------------------------------------------
// From the account's name
// ---------------------------------------------------------------------------

/**
 * Accented Latin letters and the plain letter each one becomes, position by
 * position. The rename SQL (docs/username-relay-rename.sql) passes the same
 * two strings to `translate()`, since `unaccent` is not installed; a test
 * holds the two copies equal. Letters outside the table are dropped.
 */
export const ACCENTS_FROM = "àáâãäåāăąçćčďèéêëēėęěìíîïīįñńňòóôõöøōőŕřśšşťùúûüūůűųýÿžźżđł";
export const ACCENTS_TO = "aaaaaaaaacccdeeeeeeeeiiiiiinnnoooooooorrssstuuuuuuuuyyzzzdl";
/** Letters that become two. Applied before the table, in this order. */
export const LIGATURES: readonly (readonly [string, string])[] = [
  ["ß", "ss"],
  ["æ", "ae"],
  ["œ", "oe"],
  ["þ", "th"],
];

type Meta = Record<string, unknown> | null | undefined;

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** The account's name: `full_name`, else `name`, else given and family. */
export function accountName(meta: Meta): string {
  return (
    str(meta?.full_name) ||
    str(meta?.name) ||
    [str(meta?.given_name), str(meta?.family_name)].filter(Boolean).join(" ")
  );
}

/**
 * A name as a username stem: lowercased, accents mapped, everything but
 * a to z and 0 to 9 removed, leading digits dropped, at most 20 characters.
 * "José Núñez" is "josenunez". Empty when nothing usable is left.
 */
export function usernameBase(name: string): string {
  let s = name.toLowerCase();
  for (const [from, to] of LIGATURES) s = s.split(from).join(to);
  let out = "";
  for (const ch of s) {
    const i = ACCENTS_FROM.indexOf(ch);
    out += i >= 0 ? ACCENTS_TO[i] : ch;
  }
  return out
    .replace(/[^a-z0-9]/g, "")
    .replace(/^[0-9]+/, "")
    .slice(0, USERNAME_MAX);
}

/** `base` with `suffix`, the base cut so the whole fits in 20. */
function withSuffix(base: string, suffix: string): string {
  return base.slice(0, USERNAME_MAX - suffix.length) + suffix;
}

/**
 * The usernames to try for an account, in order. With a name: the stem
 * alone (when it is 3 or more), then with 2, 3, three random digits and
 * four random digits. Then three `lifter` names, which is all a guest or
 * an account with no name gets. Nothing based on a relay address is ever
 * offered; the caller tries each until one is not taken.
 */
export function usernameCandidates(
  input: { meta: Meta; emails: readonly (string | null | undefined)[]; isAnonymous: boolean },
  random: () => number = Math.random,
): string[] {
  const out: string[] = [];
  const base = input.isAnonymous ? "" : usernameBase(accountName(input.meta));
  if (base) {
    const three = String(Math.floor(100 + random() * 900));
    const four = String(Math.floor(1000 + random() * 9000));
    out.push(base, withSuffix(base, "2"), withSuffix(base, "3"), withSuffix(base, three), withSuffix(base, four));
  }
  for (let i = 0; i < 3; i++) out.push(fallbackUsername(random));
  return [...new Set(out)].filter((n) => isValidUsername(n) && !isRelayUsername(n, input.emails));
}

// ---------------------------------------------------------------------------
// Apple private relay
// ---------------------------------------------------------------------------

export const APPLE_RELAY_DOMAIN = "privaterelay.appleid.com";

/** An Apple "Hide My Email" address. */
export function isRelayEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase().endsWith(`@${APPLE_RELAY_DOMAIN}`);
}

/**
 * A relay address's local part the way an email prefix became a username
 * before 25 Sep 2026: lowercased, stripped to a to z, 0 to 9 and
 * underscore, at most 20.
 */
export function relayStem(email: string): string {
  return email.trim().toLowerCase().split("@")[0].replace(/[^a-z0-9_]/g, "").slice(0, USERNAME_MAX);
}

/** Relay stems shorter than this are too common to match on. Apple's are about 10. */
const RELAY_STEM_MIN = 6;

/**
 * Whether `username` comes from one of the account's Apple relay
 * addresses: it contains the stem, or it is the start of the stem (6 or
 * more characters) with digits after it. Pass every email the account has:
 * `auth.users.email` and each identity's. The rename SQL uses the same
 * test.
 */
export function isRelayUsername(username: string, emails: readonly (string | null | undefined)[]): boolean {
  const name = username.toLowerCase();
  const core = name.replace(/[0-9]+$/, "");
  for (const email of emails) {
    if (!isRelayEmail(email)) continue;
    const stem = relayStem(email!);
    if (stem.length < RELAY_STEM_MIN) continue;
    if (name.includes(stem)) return true;
    if (core.length >= RELAY_STEM_MIN && stem.startsWith(core)) return true;
  }
  return false;
}

/** Every email on a Supabase user: the account's and each identity's. */
export function accountEmails(user: {
  email?: string | null;
  identities?: readonly { identity_data?: Record<string, unknown> | null }[] | null;
}): string[] {
  const out = [user.email ?? ""];
  for (const i of user.identities ?? []) out.push(str(i.identity_data?.email));
  return out.filter(Boolean);
}

/** The editor's line for a relay-based name. */
export const RELAY_USERNAME_PROBLEM = "That comes from your private Apple email. Pick another.";

/**
 * Whether a link should replace the guest's username with one from the
 * name it just gained: only a generated `lifter` name (or none), so a name
 * the guest picked stays.
 */
export function replaceUsernameOnLink(current: string | null | undefined): boolean {
  return !current || isGeneratedUsername(current);
}
