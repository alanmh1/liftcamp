// Who has Pro, what plan they are on, and what the RevenueCat SDK has to do
// when the signed-in user changes. Pure rules; the SDK calls live in
// apps/mobile/src/lib/purchases.ts and the row read in lib/tester-pro.ts.
//
// The RevenueCat app user id is always the Supabase auth user id, guests
// included. RevenueCat's own anonymous ids are never used, so logOut is
// never called: it would mint one.

import { entitlementActive, type EntitlementRow } from "./tester-entitlement";

/** The one entitlement every Pro product unlocks. */
export const PRO_ENTITLEMENT = "pro";

export const PRO_PRODUCT_YEARLY = "pro_yearly";
export const PRO_PRODUCT_MONTHLY = "pro_monthly";
export const PRO_PRODUCT_LIFETIME = "pro_lifetime";

/** Custom routines a free account can have. Pro is unlimited. */
export const FREE_CUSTOM_ROUTINES = 3;

/**
 * Whether a free account has used its custom routines. `used` counts
 * routines the user built or saved themselves: their own rows with no
 * program_slug. A saved copy of a built-in program never counts, because
 * every routine LiftCamp ships stays free. Anyone already over the cap
 * keeps what they have and only stops adding.
 */
export function atRoutineCap(used: number): boolean {
  return used >= FREE_CUSTOM_ROUTINES;
}

/**
 * Whether the user has Pro at `now`. Either source is enough: `pro` among
 * RevenueCat's active entitlement ids, or a user_entitlements row with
 * is_pro and no expiry or one still ahead. Android has no RevenueCat, so
 * there `rcActive` is empty and the rows decide.
 */
export function resolvePro(args: {
  rcActive: readonly string[] | null | undefined;
  rows: readonly EntitlementRow[];
  now: number;
}): boolean {
  if (args.rcActive?.includes(PRO_ENTITLEMENT)) return true;
  return args.rows.some((row) => entitlementActive(row, args.now));
}

/** The fields of RevenueCat's EntitlementInfo the plan reads. */
export type RcEntitlement = {
  productIdentifier: string;
  periodType: string;
  expirationDate: string | null;
  willRenew: boolean;
};

export type ProPlan = {
  productId: string | null;
  inTrial: boolean;
  /** When the plan renews or ends. Null for lifetime. */
  expiresAt: string | null;
  /** Null when only the server row is known, which does not carry it. */
  willRenew: boolean | null;
  lifetime: boolean;
  tester: boolean;
};

/**
 * The plan Settings shows, or null without Pro. RevenueCat knows the most,
 * so it wins; a row stands in on Android and until the SDK answers.
 */
export function resolvePlan(args: {
  rc: RcEntitlement | null | undefined;
  row: EntitlementRow | null | undefined;
  now: number;
}): ProPlan | null {
  const { rc, row, now } = args;
  if (rc) {
    return {
      productId: rc.productIdentifier,
      inTrial: rc.periodType === "TRIAL",
      expiresAt: rc.expirationDate,
      willRenew: rc.willRenew,
      lifetime: rc.expirationDate === null,
      tester: false,
    };
  }
  if (!row || !entitlementActive(row, now)) return null;
  const tester = row.source === "tester";
  return {
    productId: row.product_id ?? null,
    inTrial: false,
    expiresAt: row.expires_at,
    willRenew: null,
    lifetime: !tester && row.expires_at === null,
    tester,
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayMonth(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Settings' value: "Yearly, renews 12 Dec 2026", "Free trial, ends 12 Nov", "Lifetime", "Tester". */
export function planLabel(plan: ProPlan): string {
  if (plan.tester) return "Tester";
  if (plan.lifetime || plan.expiresAt === null) return "Lifetime";
  const end = new Date(plan.expiresAt);
  if (plan.inTrial) return `Free trial, ends ${dayMonth(end)}`;
  const name =
    plan.productId === PRO_PRODUCT_YEARLY ? "Yearly" : plan.productId === PRO_PRODUCT_MONTHLY ? "Monthly" : "Pro";
  const verb = plan.willRenew === null ? "until" : plan.willRenew ? "renews" : "ends";
  return `${name}, ${verb} ${dayMonth(end)} ${end.getFullYear()}`;
}

export type PurchasesStep =
  | { kind: "none" }
  /** Signed out: nobody's Pro shows, and the SDK waits on its last user. */
  | { kind: "clear" }
  | { kind: "configure"; userId: string }
  /** The SDK is already on this user: read their state again. */
  | { kind: "refresh"; userId: string }
  | { kind: "logIn"; userId: string };

/**
 * What the SDK has to do when the signed-in user changes. `sdkUser` is the
 * id the SDK is on, which outlasts a sign-out, and `current` the user the
 * app last asked for. A sign-out calls nothing: the next session, a guest
 * or an account, logs in over it.
 */
export function purchasesStep(
  state: { configured: boolean; sdkUser: string | null; current: string | null },
  next: string | null,
): PurchasesStep {
  if (next === state.current && (next === null || next === state.sdkUser)) return { kind: "none" };
  if (!next) return { kind: "clear" };
  if (!state.configured) return { kind: "configure", userId: next };
  if (next === state.sdkUser) return { kind: "refresh", userId: next };
  return { kind: "logIn", userId: next };
}

/**
 * Whether to send the device's App Store receipt under the new user right
 * after a switch, so a purchase made as a guest follows them into the
 * account they signed in to.
 *
 * Only from a guest straight into a real account. RevenueCat does not alias
 * two custom ids, so without this the purchase would stay on the guest,
 * which the merge deletes. With restore behavior "Transfer to new App User
 * ID" the sync moves it and the TRANSFER webhook writes the account's row.
 * Skipped when the account is already Pro, and never between two real
 * accounts: switching accounts on one phone must not move a purchase.
 *
 * Never into a guest either. Start fresh goes from one guest to a new one,
 * and a sync there posts the device's App Store receipt under the new
 * guest, which transfers whatever that Apple ID owns (a sandbox lifetime
 * purchase made on another account, say) and makes a fresh guest Pro.
 */
export function shouldCarryGuestPurchase(args: {
  previousUserId: string | null;
  previousWasGuest: boolean;
  nextUserId: string | null;
  nextIsGuest: boolean;
  nextIsPro: boolean;
}): boolean {
  const { previousUserId, previousWasGuest, nextUserId, nextIsGuest, nextIsPro } = args;
  if (!previousUserId || !nextUserId || previousUserId === nextUserId) return false;
  if (nextIsGuest) return false;
  return previousWasGuest && !nextIsPro;
}
