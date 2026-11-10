// The tester Pro grant: a user_entitlements row the app reads for itself,
// written only by admin_set_entitlement (supabase/migrations/
// 20261003120000_tester_entitlements.sql). Pure rules here; the read, the
// cache and the refetch live in apps/mobile/src/lib/tester-pro.ts.

import { APP_STORAGE_PREFIX } from "./account-deletion";

/** The columns of the signed-in user's row the app reads. */
export type EntitlementRow = {
  is_pro: boolean;
  expires_at: string | null;
  /** 'tester', or the store RevenueCat reports. Absent on a row cached by an older build. */
  source?: string | null;
  product_id?: string | null;
};

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

/**
 * The row to hold when a user has several: the key is (user_id, source),
 * so a tester who buys has two. Only is_pro rows, then the later expiry
 * (none beats any date), then a store's row over a tester's. Holding the
 * longest-lasting row keeps `entitlementActive` right with no signal.
 */
export function pickEntitlementRow(rows: readonly EntitlementRow[]): EntitlementRow | null {
  const end = (r: EntitlementRow) => (r.expires_at == null ? Infinity : Date.parse(r.expires_at));
  let best: EntitlementRow | null = null;
  for (const row of rows) {
    if (!row.is_pro) continue;
    const later = !best || end(row) > end(best);
    const tie = !!best && end(row) === end(best) && best.source === "tester";
    if (later || tie) best = row;
  }
  return best;
}

/** Reads a cached row back, or null for anything that is not one. */
export function parseEntitlementCache(raw: string | null): EntitlementRow | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object") return null;
    const { is_pro, expires_at, source, product_id } = v as Record<string, unknown>;
    if (typeof is_pro !== "boolean") return null;
    if (expires_at !== null && typeof expires_at !== "string") return null;
    return {
      is_pro,
      expires_at,
      ...(typeof source === "string" ? { source } : {}),
      ...(typeof product_id === "string" ? { product_id } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * What a read of the row leaves the app with. A successful read decides:
 * its row, or none when it found none. A failed read (no signal, a
 * timeout, a server error) keeps the row this device cached for the same
 * user, so a tester keeps Pro in a gym with no signal; with nothing cached
 * it is no Pro. Expiry is still checked on every render
 * (`entitlementActive`), so a cached grant past its expiry closes offline.
 */
export function entitlementAfterRead(
  read: { ok: true; row: EntitlementRow | null } | { ok: false },
  cached: EntitlementRow | null,
): EntitlementRow | null {
  return read.ok ? read.row : cached;
}

/** Whose grant the app holds, and the row it holds for them. */
export type EntitlementState = { userId: string | null; row: EntitlementRow | null };

/**
 * The state when the signed-in user may have changed, and whose device
 * cache to drop. Signed out or a guest holds nobody. A different user
 * starts with no row. Either way the previous user's cache is dropped, so
 * one account's grant never shows for another; the same user keeps
 * everything.
 */
export function entitlementOnUser(
  state: EntitlementState,
  next: { userId: string | null; isGuest: boolean },
): { state: EntitlementState; dropCacheFor: string | null } {
  const userId = next.userId && !next.isGuest ? next.userId : null;
  if (userId === state.userId) return { state, dropCacheFor: null };
  return { state: { userId, row: null }, dropCacheFor: state.userId };
}
