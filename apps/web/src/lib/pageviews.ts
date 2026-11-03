import { isInternalHost } from "@liftcamp/shared";

import { supabase } from "@/integrations/supabase/client";

/**
 * First-party page view logging.
 *
 * Rows land in `page_views` (insert-only for everyone, readable only through the
 * admin-gated `admin_traffic` report). Fire-and-forget: never blocks navigation.
 *
 * "Internal" traffic is your own testing. A device is marked internal when the
 * `lc_internal` flag is set in localStorage -- toggled from the admin dashboard --
 * so the admin report can subtract it without guessing at IPs. Views on a
 * local dev server or a Vercel preview deployment (`isInternalHost`) are
 * internal whatever the flag says; the flag itself (and the /admin toggle
 * that reads it) is left alone.
 */

const INTERNAL_KEY = "lc_internal";
const SESSION_KEY = "lc_session_id";
const SESSION_TS_KEY = "lc_session_ts";
const UTM_KEY = "lc_utm_source";
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const DEDUPE_MS = 2000;

export function isInternalDevice(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(INTERNAL_KEY) === "1";
  } catch {
    return false;
  }
}

export function setInternalDevice(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.setItem(INTERNAL_KEY, "1");
    else window.localStorage.removeItem(INTERNAL_KEY);
  } catch {
    // ignore
  }
}

/** Per-session id stored in localStorage with a timestamp, so sessions roll over after inactivity. */
function sessionInfo(): { id: string; isNew: boolean } {
  try {
    const now = Date.now();
    const last = Number(window.localStorage.getItem(SESSION_TS_KEY) ?? 0);
    const existing = window.localStorage.getItem(SESSION_KEY);
    window.localStorage.setItem(SESSION_TS_KEY, String(now));
    if (existing && now - last < SESSION_TIMEOUT_MS) return { id: existing, isNew: false };
    const id = crypto.randomUUID();
    window.localStorage.setItem(SESSION_KEY, id);
    return { id, isNew: true };
  } catch {
    return { id: "anon", isNew: false };
  }
}

/**
 * Campaign tag from the current URL, normalised so the admin report groups
 * cleanly. Anything outside a-z, 0-9, dot, dash and underscore is rejected
 * rather than cleaned, since a malformed tag is a typo in a QR code and should
 * look like one in the report.
 */
function utmFromUrl(): string | null {
  try {
    const raw = new URLSearchParams(window.location.search).get("utm_source");
    if (!raw) return null;
    const v = raw.trim().toLowerCase().slice(0, 64);
    if (!v) return null;
    return /^[a-z0-9._-]+$/.test(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * The campaign for this session. A tag in the URL wins and is remembered for
 * the rest of the session, so a visitor who lands on a tagged link and then
 * navigates on still has every row attributed. A new session clears it.
 */
function utmSource(isNewSession: boolean): string | null {
  try {
    if (isNewSession) window.localStorage.removeItem(UTM_KEY);
    const fresh = utmFromUrl();
    if (fresh) {
      window.localStorage.setItem(UTM_KEY, fresh);
      return fresh;
    }
    return window.localStorage.getItem(UTM_KEY);
  } catch {
    return utmFromUrl();
  }
}

function referrerHost(): string | null {
  try {
    if (!document.referrer) return null;
    const url = new URL(document.referrer);
    if (url.host === window.location.host) return null;
    return url.host;
  } catch {
    return null;
  }
}

function deviceType(): string {
  if (typeof window === "undefined") return "unknown";
  return window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop";
}

let lastPath: string | null = null;
let lastAt = 0;

export async function trackPageView(path: string): Promise<void> {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (path === lastPath && now - lastAt < DEDUPE_MS) return;
  lastPath = path;
  lastAt = now;
  try {
    const session = sessionInfo();
    const { data } = await supabase.auth.getSession();
    await supabase.from("page_views").insert({
      session_id: session.id,
      path,
      referrer_host: referrerHost(),
      device: deviceType(),
      is_internal: isInternalDevice() || isInternalHost(window.location.hostname),
      user_id: data.session?.user?.id ?? null,
      utm_source: utmSource(session.isNew),
      // Classification happens in Postgres (is_bot_user_agent), so the pattern
      // can change without a redeploy.
      user_agent: typeof navigator === "undefined" ? null : navigator.userAgent,
    });
  } catch {
    // Best effort.
  }
}
