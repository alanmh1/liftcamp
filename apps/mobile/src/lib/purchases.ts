import {
  PRO_ENTITLEMENT,
  purchasesStep,
  shouldCarryGuestPurchase,
  trialDays,
  type PaywallPlan,
  type PaywallPlanKind,
  type RcEntitlement,
} from '@liftcamp/shared';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';

import { useAuth } from '@/components/auth-provider';

/**
 * RevenueCat, and the state the rest of the app reads through lib/pro.ts.
 *
 * iOS only. On Android, and in a build without
 * EXPO_PUBLIC_REVENUECAT_IOS_KEY, the SDK is never required or configured:
 * every call here is a no-op and Pro comes only from user_entitlements.
 * The type import above is erased at build time. A dev client built before
 * the SDK was added has no native module; the require or the calls fail
 * and leave this state empty.
 *
 * The app user id is the Supabase user id, guests included, so linking an
 * account on the same id needs no call. `PurchasesSync` follows the
 * session: configure with the first user, then logIn on any change (a
 * sign-in, an account switch, a guest merge, the fresh guest after a
 * sign-out or a deletion). logOut is never called; it would mint a
 * RevenueCat anonymous id. What to do when is `purchasesStep` in shared.
 *
 * Nothing on the way to Home's first frame waits on this. The state stays
 * empty until the SDK answers for the current user and empties again the
 * moment the user changes, so one account's purchase never shows for
 * another. The SDK answers from its own disk cache first, so a Pro user
 * stays Pro with no signal.
 */

const API_KEY = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY : undefined;

/** Whether this build can talk to RevenueCat at all. */
export const purchasesAvailable = !!API_KEY;

type Sdk = typeof import('react-native-purchases');

let sdkModule: Sdk | null | undefined;

function loadSdk(): Sdk | null {
  if (!API_KEY) return null;
  if (sdkModule === undefined) {
    try {
      sdkModule = require('react-native-purchases') as Sdk;
    } catch (e) {
      log('no native module', e);
      sdkModule = null;
    }
  }
  return sdkModule;
}

function log(message: string, e?: unknown) {
  if (__DEV__) console.log(`[purchases] ${message}${e ? `: ${(e as Error).message ?? e}` : ''}`);
}

export type PurchasesState = {
  activeEntitlementIds: readonly string[];
  /** The `pro` entitlement while it is active. */
  entitlement: RcEntitlement | null;
};

const EMPTY: PurchasesState = { activeEntitlementIds: [], entitlement: null };

let state: PurchasesState = EMPTY;
const listeners = new Set<() => void>();

function setState(next: PurchasesState) {
  if (JSON.stringify(next) === JSON.stringify(state)) return;
  state = next;
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The current user's RevenueCat state. Empty on Android and until the SDK answers. */
export function usePurchasesState(): PurchasesState {
  return useSyncExternalStore(subscribe, () => state);
}

let configured = false;
/** The id the SDK is on, which outlasts a sign-out. */
let sdkUser: string | null = null;
/** The user the app last asked for. */
let current: string | null = null;
// The last signed-in user and whether it was a guest, kept across a
// sign-out gap, for `shouldCarryGuestPurchase`.
let lastUser: string | null = null;
let lastWasGuest = false;
// Identity calls run one at a time, in order.
let queue: Promise<void> = Promise.resolve();

function enqueue(work: () => Promise<void>): Promise<void> {
  queue = queue.then(work, work);
  return queue;
}

function apply(info: CustomerInfo) {
  // An answer for a user the app has moved on from is for nobody.
  if (!current || sdkUser !== current) return;
  const active = info.entitlements.active;
  const pro = active[PRO_ENTITLEMENT];
  setState({
    activeEntitlementIds: Object.keys(active),
    entitlement: pro
      ? {
          productIdentifier: pro.productIdentifier,
          periodType: pro.periodType,
          expirationDate: pro.expirationDate,
          willRenew: pro.willRenew,
        }
      : null,
  });
}

async function runIdentify(userId: string | null, guest: boolean): Promise<void> {
  const sdk = loadSdk();
  if (!sdk) return;
  const Purchases = sdk.default;
  const step = purchasesStep({ configured, sdkUser, current }, userId);
  if (step.kind === 'none') {
    if (userId) lastWasGuest = guest;
    return;
  }

  const previous = lastUser;
  const previousWasGuest = lastWasGuest;
  if (userId !== current) setState(EMPTY);
  current = userId;
  if (userId) {
    lastUser = userId;
    lastWasGuest = guest;
  }

  try {
    switch (step.kind) {
      case 'clear':
        return;
      case 'configure':
        Purchases.configure({ apiKey: API_KEY!, appUserID: step.userId });
        Purchases.addCustomerInfoUpdateListener(apply);
        configured = true;
        sdkUser = step.userId;
        apply(await Purchases.getCustomerInfo());
        return;
      case 'refresh':
        apply(await Purchases.getCustomerInfo());
        return;
      case 'logIn': {
        const { customerInfo } = await Purchases.logIn(step.userId);
        sdkUser = step.userId;
        apply(customerInfo);
        const carry = shouldCarryGuestPurchase({
          previousUserId: previous,
          previousWasGuest,
          nextUserId: step.userId,
          nextIsPro: PRO_ENTITLEMENT in customerInfo.entitlements.active,
        });
        if (carry) {
          // A purchase made as the guest follows them into this account.
          // The listener picks up the result; the TRANSFER webhook writes
          // the account's row.
          await Purchases.syncPurchases();
          log('synced purchases after a guest switch');
        }
        return;
      }
    }
  } catch (e) {
    // A failed logIn leaves sdkUser behind `current`; the next foreground tries again.
    log(`${step.kind} failed`, e);
  }
}

function refreshOnForeground() {
  void enqueue(async () => {
    if (!configured || !current) return;
    if (sdkUser !== current) {
      await runIdentify(current, lastWasGuest);
      return;
    }
    try {
      apply(await loadSdk()!.default.getCustomerInfo());
    } catch (e) {
      log('refresh failed', e);
    }
  });
}

if (API_KEY) {
  AppState.addEventListener('change', (next) => {
    if (next === 'active') refreshOnForeground();
  });
}

/**
 * Keeps RevenueCat on the signed-in user. Mounted once, inside
 * AuthProvider; renders nothing and holds nothing up.
 */
export function PurchasesSync() {
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? null;
  const guest = !!session?.user.is_anonymous;
  useEffect(() => {
    if (loading) return;
    void enqueue(() => runIdentify(userId, guest));
  }, [userId, guest, loading]);
  return null;
}

export type PaywallOffer = {
  metadata: Record<string, unknown>;
  plans: PaywallPlan[];
};

const packages = new Map<PaywallPlanKind, PurchasesPackage>();

/** The default offering as the paywall shows it, or null when it cannot be read. */
export async function loadPaywallOffer(): Promise<PaywallOffer | null> {
  const sdk = loadSdk();
  if (!sdk || !configured) return null;
  const Purchases = sdk.default;
  try {
    const offerings = await Purchases.getOfferings();
    const offering = offerings.all.default ?? offerings.current;
    if (!offering) return null;

    let days: number | null = null;
    if (offering.annual) {
      const product = offering.annual.product;
      const eligibility = await Purchases.checkTrialOrIntroductoryPriceEligibility([product.identifier]).catch(
        () => null,
      );
      const eligible =
        eligibility?.[product.identifier]?.status ===
        sdk.INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE;
      days = eligible ? trialDays(product.introPrice) : null;
    }

    packages.clear();
    const plans: PaywallPlan[] = [];
    const add = (kind: PaywallPlanKind, pkg: PurchasesPackage | null, trial: number | null) => {
      if (!pkg) return;
      packages.set(kind, pkg);
      plans.push({
        kind,
        productId: pkg.product.identifier,
        priceString: pkg.product.priceString,
        price: pkg.product.price,
        currencyCode: pkg.product.currencyCode,
        trialDays: trial,
      });
    };
    add('annual', offering.annual, days);
    add('monthly', offering.monthly, null);
    add('lifetime', offering.lifetime, null);
    return { metadata: offering.metadata ?? {}, plans };
  } catch (e) {
    log('offerings failed', e);
    return null;
  }
}

export type PurchaseOutcome =
  | { kind: 'purchased' }
  | { kind: 'cancelled' }
  /** Ask to Buy or a held payment: nothing failed, and Pro arrives through the listener. */
  | { kind: 'pending' }
  | { kind: 'failed' };

/** Buys a plan from the offer `loadPaywallOffer` last returned. */
export async function purchasePlan(kind: PaywallPlanKind): Promise<PurchaseOutcome> {
  const sdk = loadSdk();
  const pkg = packages.get(kind);
  if (!sdk || !pkg) return { kind: 'failed' };
  try {
    const { customerInfo } = await sdk.default.purchasePackage(pkg);
    apply(customerInfo);
    return { kind: 'purchased' };
  } catch (e) {
    const err = e as { userCancelled?: boolean | null; code?: string };
    const codes = sdk.PURCHASES_ERROR_CODE;
    if (err.userCancelled || err.code === codes.PURCHASE_CANCELLED_ERROR) return { kind: 'cancelled' };
    if (err.code === codes.PAYMENT_PENDING_ERROR) return { kind: 'pending' };
    log('purchase failed', e);
    return { kind: 'failed' };
  }
}

export type RestoreOutcome = { ok: true; isPro: boolean } | { ok: false };

/** Restore purchases, from the paywall and Settings. */
export async function restorePurchases(): Promise<RestoreOutcome> {
  const sdk = loadSdk();
  if (!sdk || !configured) return { ok: false };
  try {
    const info = await sdk.default.restorePurchases();
    apply(info);
    return { ok: true, isPro: PRO_ENTITLEMENT in info.entitlements.active };
  } catch (e) {
    log('restore failed', e);
    return { ok: false };
  }
}

/** Apple's subscription sheet; the App Store's page when the sheet cannot open. */
export async function showManageSubscriptions(): Promise<void> {
  try {
    await loadSdk()?.default.showManageSubscriptions();
  } catch (e) {
    log('manage subscriptions failed', e);
    await Linking.openURL('https://apps.apple.com/account/subscriptions').catch(() => {});
  }
}
