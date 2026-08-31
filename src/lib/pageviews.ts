import { supabase } from "@/integrations/supabase/client";

/**
 * First-party page view logging.
 *
 * Rows land in `page_views` (insert-only for everyone, readable only through the
 * admin-gated `admin_traffic` report). Fire-and-forget: never blocks navigation.
 *
 * "Internal" traffic is your own testing. A device is marked internal when the
 * `lc_internal` flag is set in localStorage -- toggled from the admin dashboard --
 * so the admin report can subtract it without guessing at IPs.
 */

const INTERNAL_KEY = "lc_internal";
const SESSION_KEY = "lc_session_id";
const SESSION_TS_KEY = "lc_session_ts";
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
function sessionId(): string {
  try {
    const now = Date.now();
    const last = Number(window.localStorage.getItem(SESSION_TS_KEY) ?? 0);
    const existing = window.localStorage.getItem(SESSION_KEY);
    window.localStorage.setItem(SESSION_TS_KEY, String(now));
    if (existing && now - last < SESSION_TIMEOUT_MS) return existing;
    const id = crypto.randomUUID();
    window.localStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return "anon";
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
    const { data } = await supabase.auth.getSession();
    await supabase.from("page_views").insert({
      session_id: sessionId(),
      path,
      referrer_host: referrerHost(),
      device: deviceType(),
      is_internal: isInternalDevice(),
      user_id: data.session?.user?.id ?? null,
    });
  } catch {
    // Best effort.
  }
}
