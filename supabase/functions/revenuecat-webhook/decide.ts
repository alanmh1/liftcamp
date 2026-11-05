// revenuecat-webhook's decisions, with no I/O: whether a request is
// authorized, which users an event touches, and what row a RevenueCat
// subscriber becomes. index.ts does the network calls and follows these
// answers. No imports, so vitest runs this file from packages/shared
// (src/revenuecat-webhook-decide.test.ts) as it is deployed.

export const ENTITLEMENT_ID = "pro";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The part of a RevenueCat webhook body this function reads. */
export type WebhookEvent = {
  id?: unknown;
  type?: unknown;
  app_user_id?: unknown;
  environment?: unknown;
  transferred_from?: unknown;
  transferred_to?: unknown;
};

/**
 * Whether the Authorization header matches the secret set on the webhook
 * in the RevenueCat dashboard. Compares every character whatever the
 * length of the match so far. An unset secret refuses everything.
 */
export function authorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || header === null) return false;
  const expected = `Bearer ${secret}`;
  let diff = header.length ^ expected.length;
  for (let i = 0; i < expected.length; i++) {
    diff |= (header.charCodeAt(i) || 0) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Supabase user ids named by an event. The app user id is the Supabase
 * auth user id, so anything else (a RevenueCat anonymous id, a typo in a
 * dashboard grant) is not a LiftCamp user and is skipped. A TRANSFER names
 * both sides, so the old owner loses Pro in the same delivery.
 */
export function usersToSync(event: WebhookEvent): string[] {
  const ids: unknown[] = [event.app_user_id];
  if (event.type === "TRANSFER") {
    if (Array.isArray(event.transferred_from)) ids.push(...event.transferred_from);
    if (Array.isArray(event.transferred_to)) ids.push(...event.transferred_to);
  }
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || !UUID.test(id)) continue;
    const lower = id.toLowerCase();
    if (!out.includes(lower)) out.push(lower);
  }
  return out;
}

/**
 * Whether a user's existing row belongs to someone else. Tester rows are
 * admin_set_entitlement's: a RevenueCat event never clears or rewrites
 * one. A tester who also buys keeps Pro in the app through the SDK.
 */
export function leaveRowAlone(existingSource: string | null | undefined): boolean {
  return existingSource === "tester";
}

/** The fields of GET /v1/subscribers/{id} that decide the row. */
export type Subscriber = {
  entitlements?: Record<
    string,
    {
      expires_date?: string | null;
      grace_period_expires_date?: string | null;
      product_identifier?: string;
    }
  >;
  subscriptions?: Record<string, { store?: string }>;
  non_subscriptions?: Record<string, Array<{ store?: string }>>;
};

export type EntitlementRow = {
  is_pro: boolean;
  source: string;
  product_id: string | null;
  expires_at: string | null;
};

const SOURCES = new Set(["app_store", "play_store", "stripe", "rc_billing", "promotional", "amazon"]);

/**
 * The user_entitlements row for a subscriber, or null when the subscriber
 * has never had Pro (nothing to write). A lapsed subscription keeps its
 * row with is_pro false, so the history of what they had stays.
 *
 * Pro now: no expiry (lifetime, open-ended grant), or the expiry or the
 * billing grace period is still ahead.
 */
export function rowFor(subscriber: Subscriber, now: Date): EntitlementRow | null {
  const ent = subscriber.entitlements?.[ENTITLEMENT_ID];
  if (!ent) return null;

  const product = ent.product_identifier ?? null;
  const expires = ent.expires_date ?? null;
  const grace = ent.grace_period_expires_date ?? null;
  const ahead = (iso: string | null) => iso !== null && Date.parse(iso) > now.getTime();
  const isPro = expires === null || ahead(expires) || ahead(grace);

  let store: string | undefined;
  if (product) {
    store = subscriber.subscriptions?.[product]?.store ?? subscriber.non_subscriptions?.[product]?.at(-1)?.store;
  }
  // A dashboard grant's product is rc_promo_<entitlement>_<duration>. Any
  // other unknown store is the App Store, the only store LiftCamp sells
  // through until Android and web billing land.
  const source =
    store && SOURCES.has(store) ? store : product?.startsWith("rc_promo") ? "promotional" : "app_store";

  // Access ends at the later of the expiry and the grace period.
  let end = expires;
  if (end !== null && grace !== null && Date.parse(grace) > Date.parse(end)) end = grace;

  return {
    is_pro: isPro,
    source,
    product_id: product,
    expires_at: end === null ? null : new Date(end).toISOString(),
  };
}
