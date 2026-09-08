import { supabase } from "@/integrations/supabase/client";

/** Where shared links point. Absolute so a copied link works off-device. */
export const SHARE_ORIGIN = "https://liftcamp.app";

const PENDING_KEY = "liftcamp:pending-routine";

function newToken(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 14);
}

export function shareUrl(token: string): string {
  return `${SHARE_ORIGIN}/r/${token}`;
}

/**
 * Returns the unlisted link for a template, minting a token the first time.
 * Sharing is opt-in per routine: without a token the row stays private.
 */
export async function ensureShareLink(templateId: string): Promise<string | null> {
  const { data: existing, error } = await supabase
    .from("templates")
    .select("share_token")
    .eq("id", templateId)
    .maybeSingle();
  if (error) return null;
  if (existing?.share_token) return shareUrl(existing.share_token);

  const token = newToken();
  const { error: upErr } = await supabase
    .from("templates")
    .update({ share_token: token, shared_at: new Date().toISOString() })
    .eq("id", templateId);
  if (upErr) return null;
  return shareUrl(token);
}

/** Native share sheet where available, clipboard otherwise. */
export async function shareLink(url: string, title: string): Promise<"shared" | "copied" | null> {
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title, text: `${title} — a routine on LiftCamp`, url });
      return "shared";
    }
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return null;
  }
}

/** Token stashed while a visitor signs up, replayed once they have a session. */
export function setPendingRoutine(token: string) {
  try {
    localStorage.setItem(PENDING_KEY, token);
  } catch {
    /* private mode */
  }
}

export function readPendingRoutine(): string | null {
  try {
    return localStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}

export function clearPendingRoutine() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}
