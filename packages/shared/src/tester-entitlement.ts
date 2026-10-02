// The tester Pro grant: a user_entitlements row the app reads for itself,
// written only by admin_set_entitlement (supabase/migrations/
// 20261003120000_tester_entitlements.sql). Pure rules here; the read, the
// cache and the refetch live in apps/mobile/src/lib/tester-pro.ts.

import { APP_STORAGE_PREFIX } from "./account-deletion";

/** The columns of the signed-in user's row the app reads. */
export type EntitlementRow = { is_pro: boolean; expires_at: string | null };

/** The per-user device cache of that row, under the app's `liftcamp:` prefix. */
export function testerProKey(userId: string): string {
  return `${APP_STORAGE_PREFIX}tester-pro:${userId}`;
}

/**
 * Whether a row gives Pro at `now`: is_pro, and no expiry or one still
 * ahead. No row, or an expiry that does not parse, is no Pro.
 */
export function entitlementActive(row: EntitlementRow | null | undefined, now: number): boolean {
  if (!row || row.is_pro !== true) return false;
  if (row.expires_at == null) return true;
  const end = Date.parse(row.expires_at);
  return Number.isFinite(end) && end > now;
}

/** Reads a cached row back, or null for anything that is not one. */
export function parseEntitlementCache(raw: string | null): EntitlementRow | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object") return null;
    const { is_pro, expires_at } = v as Record<string, unknown>;
    if (typeof is_pro !== "boolean") return null;
    if (expires_at !== null && typeof expires_at !== "string") return null;
    return { is_pro, expires_at };
  } catch {
    return null;
  }
}

/**
 * What a read of the row leaves the app with: the row it returned, or none.
 * A failed read (no signal, a server error) is no Pro, cached row or not:
 * the cache only answers while the read is on its way.
 */
export function entitlementAfterRead(
  read: { ok: true; row: EntitlementRow | null } | { ok: false },
): EntitlementRow | null {
  return read.ok ? read.row : null;
}
