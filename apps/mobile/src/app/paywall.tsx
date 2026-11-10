import {
  PAYWALL_DEFAULTS,
  billedLine,
  paywallCopy,
  paywallCta,
  paywallSubtitle,
  perMonthPrice,
  planRowCopy,
  preselectedPlan,
  type PaywallCopy,
  type PaywallPlan,
  type PaywallPlanKind,
} from '@liftcamp/shared';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LiftCampMark } from '@/components/liftcamp-mark';
import { Text } from '@/components/text';
import { EVENTS, track } from '@/lib/analytics';
import { syncServerPro } from '@/lib/pro';
import { useProLaunched } from '@/lib/pro-launched';
import { loadPaywallOffer, purchasePlan, restorePurchases, type PaywallOffer } from '@/lib/purchases';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, palettes, radius, spacing, tabular, type } from '@/theme/tokens';

const TERMS_URL = 'https://liftcamp.app/terms';
const PRIVACY_URL = 'https://liftcamp.app/privacy';
/** Below this the hero goes, so the plans need no scrolling on an iPhone SE (667 pt). */
const HERO_MIN_HEIGHT = 760;

/**
 * The Pro paywall. A modal, iOS only, opened by `useProUpsell`.
 *
 * Copy and the preselected plan come from the default offering's metadata
 * (`paywallCopy` in shared); every price comes from StoreKit. The bottom
 * block never scrolls: the button, the full charge and renewal terms for
 * the selected plan, Restore purchases and the Terms and Privacy links are
 * always on screen, whatever the height of the phone or the text size.
 * Apple requires that. In a plan row the billed amount is the large figure
 * and the monthly equivalent the small line under it, so the monthly figure
 * never hides the actual charge.
 *
 * A cancelled purchase says nothing. A completed one dismisses, and the
 * gate behind it opens in place because `usePro` follows the SDK.
 */
export default function PaywallRoute() {
  const launched = useProLaunched();
  if (Platform.OS !== 'ios' || !launched) return <Redirect href="/" />;
  return <PaywallScreen />;
}

function PaywallScreen() {
  const { scheme, colors: c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { source: sourceParam } = useLocalSearchParams<{ source?: string }>();
  const source = sourceParam ?? 'unknown';

  const [offer, setOffer] = useState<PaywallOffer | null | undefined>(undefined);
  const [selected, setSelected] = useState<PaywallPlanKind | null>(null);
  const [busy, setBusy] = useState<'purchase' | 'restore' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const viewed = useRef(false);
  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    void track(EVENTS.paywallViewed, { source });
  }, [source]);

  async function load() {
    setOffer(undefined);
    const next = await loadPaywallOffer();
    setOffer(next);
    if (next) setSelected(preselectedPlan(next.plans, paywallCopy(next.metadata))?.kind ?? null);
  }
  useEffect(() => {
    void load();
  }, []);

  const copy = paywallCopy(offer?.metadata);
  const plans = offer?.plans ?? [];
  const plan = plans.find((p) => p.kind === selected) ?? null;
  const annual = plans.find((p) => p.kind === 'annual');
  const perMonth = annual ? perMonthPrice(annual.price, annual.currencyCode) : null;

  function dismiss() {
    if (router.canGoBack()) router.back();
  }

  async function buy() {
    if (!plan || busy) return;
    const props = { product_id: plan.productId, source };
    setBusy('purchase');
    setError(null);
    void track(EVENTS.purchaseStarted, props);
    const outcome = await purchasePlan(plan.kind);
    setBusy(null);
    if (outcome.kind === 'purchased') {
      void track(EVENTS.purchaseCompleted, props);
      syncServerPro();
      dismiss();
    } else if (outcome.kind === 'cancelled') {
      void track(EVENTS.purchaseCancelled, props);
    } else if (outcome.kind === 'pending') {
      Alert.alert('Waiting for approval', 'Pro turns on once the purchase is approved.');
    } else {
      setError('The purchase did not go through. You have not been charged. Try again.');
    }
  }

  async function restore() {
    if (busy) return;
    setBusy('restore');
    setError(null);
    void track(EVENTS.restoreTapped, { source });
    const outcome = await restorePurchases();
    setBusy(null);
    if (!outcome.ok) {
      setError('Could not reach the App Store. Try again.');
    } else if (outcome.isPro) {
      syncServerPro();
      dismiss();
    } else {
      Alert.alert('Nothing to restore', 'No LiftCamp Pro purchase was found for this Apple ID.');
    }
  }

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {height >= HERO_MIN_HEIGHT ? (
          <View style={styles.hero}>
            <LiftCampMark size={96} />
          </View>
        ) : null}
        <Text style={[type.screenTitle, styles.centered, { color: c.text }]}>{copy.title}</Text>
        {offer ? (
          <Text style={[styles.subtitle, styles.centered, { color: c.text2 }]}>
            {paywallSubtitle(copy.subtitle, perMonth)}
          </Text>
        ) : null}

        <View style={styles.bullets}>
          {copy.bullets.map((b) => (
            <View key={b} style={styles.bullet}>
              <SymbolView
                name={{ ios: 'checkmark', android: 'check' }}
                size={15}
                weight="bold"
                tintColor={c.accentText}
                style={styles.check}
              />
              <Text style={[styles.bulletText, { color: c.text }]}>{b}</Text>
            </View>
          ))}
        </View>

        {offer === undefined ? (
          <ActivityIndicator style={styles.loading} color={c.text3} />
        ) : offer === null || plans.length === 0 ? (
          <View style={styles.loading}>
            <Text style={[type.meta, styles.centered, { color: c.text2 }]}>
              Could not load the plans. Check your connection.
            </Text>
            <Pressable onPress={() => void load()} accessibilityRole="button" hitSlop={10}>
              <Text style={[type.button, styles.centered, { color: c.accentText }]}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.plans}>
            {plans.map((p) => (
              <PlanRow
                key={p.kind}
                plan={p}
                selected={p.kind === selected}
                onPress={() => setSelected(p.kind)}
                surface={cardSurface(scheme, c)}
              />
            ))}
          </View>
        )}

        <Text style={[type.meta, styles.centered, { color: c.text2 }]}>{PAYWALL_DEFAULTS.footnote}</Text>
      </ScrollView>

      <Footer
        plan={plan}
        copy={copy}
        busy={busy}
        error={error}
        bottom={insets.bottom}
        onBuy={() => void buy()}
        onRestore={() => void restore()}
      />

      <Pressable
        onPress={dismiss}
        accessibilityRole="button"
        accessibilityLabel="Close"
        hitSlop={12}
        style={({ pressed }) => [styles.close, { backgroundColor: c.surface2 }, pressed && styles.pressed]}>
        <SymbolView name={{ ios: 'xmark', android: 'close' }} size={14} weight="bold" tintColor={c.text2} />
      </Pressable>
    </View>
  );
}

function PlanRow({
  plan,
  selected,
  onPress,
  surface,
}: {
  plan: PaywallPlan;
  selected: boolean;
  onPress: () => void;
  surface: ReturnType<typeof cardSurface>;
}) {
  const c = useTheme().colors;
  const row = planRowCopy(plan);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={[row.label, row.figure, row.detail, row.tag].filter(Boolean).join(', ')}
      style={({ pressed }) => [
        styles.plan,
        surface,
        { borderWidth: 2, borderColor: selected ? c.accent : c.border },
        pressed && styles.pressed,
      ]}>
      <View style={styles.planLeft}>
        <Text style={[styles.planLabel, { color: c.text }]}>{row.label}</Text>
        {row.tag ? (
          <View style={[styles.tag, { backgroundColor: c.accentSoft }]}>
            <Text style={[styles.tagText, { color: c.accentText }]}>{row.tag}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.planRight}>
        <Text style={[styles.planFigure, { color: c.text }]}>{row.figure}</Text>
        {row.detail ? <Text style={[styles.planDetail, { color: c.text }]}>{row.detail}</Text> : null}
      </View>
    </Pressable>
  );
}

function Footer({
  plan,
  copy,
  busy,
  error,
  bottom,
  onBuy,
  onRestore,
}: {
  plan: PaywallPlan | null;
  copy: PaywallCopy;
  busy: 'purchase' | 'restore' | null;
  error: string | null;
  bottom: number;
  onBuy: () => void;
  onRestore: () => void;
}) {
  const c = useTheme().colors;
  return (
    <View style={[styles.footer, { borderColor: c.border, paddingBottom: Math.max(bottom, spacing.md) }]}>
      {error ? <Text style={[type.meta, styles.centered, { color: c.danger }]}>{error}</Text> : null}
      <Pressable
        onPress={onBuy}
        disabled={!plan || busy !== null}
        accessibilityRole="button"
        accessibilityState={{ disabled: !plan || busy !== null, busy: busy === 'purchase' }}
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: c.accent },
          (pressed || !plan) && styles.pressed,
        ]}>
        {busy === 'purchase' ? (
          <ActivityIndicator color={palettes.light.bg} />
        ) : (
          <Text style={[type.button, { color: palettes.light.bg }]}>{plan ? paywallCta(plan, copy) : 'Continue'}</Text>
        )}
      </Pressable>
      {plan ? <Text style={[styles.billed, styles.centered, { color: c.text }]}>{billedLine(plan)}</Text> : null}
      <View style={styles.links}>
        <Pressable onPress={onRestore} disabled={busy !== null} accessibilityRole="button" hitSlop={8}>
          {busy === 'restore' ? (
            <ActivityIndicator color={c.text3} />
          ) : (
            <Text style={[styles.link, { color: c.text2 }]}>Restore purchases</Text>
          )}
        </Pressable>
        <Pressable onPress={() => void Linking.openURL(TERMS_URL)} accessibilityRole="link" hitSlop={8}>
          <Text style={[styles.link, { color: c.text2 }]}>Terms of Use</Text>
        </Pressable>
        <Pressable onPress={() => void Linking.openURL(PRIVACY_URL)} accessibilityRole="link" hitSlop={8}>
          <Text style={[styles.link, { color: c.text2 }]}>Privacy Policy</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { paddingHorizontal: spacing.screen, paddingTop: spacing.xl, paddingBottom: spacing.md, gap: spacing.md },
  hero: { width: 96, height: 96, alignSelf: 'center' },
  centered: { textAlign: 'center' },
  subtitle: { fontSize: 15, marginTop: -spacing.sm },
  bullets: { gap: spacing.xs + 2 },
  bullet: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  check: { width: 16, height: 16 },
  bulletText: { flex: 1, fontSize: 14 },
  loading: { minHeight: 176, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  plans: { gap: spacing.sm },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: radius.bar,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    minHeight: 52,
  },
  planLeft: { flexShrink: 1, gap: spacing.xs, alignItems: 'flex-start' },
  planLabel: { fontSize: 15, fontWeight: '600' },
  tag: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  tagText: { fontSize: 12, fontWeight: '600' },
  planRight: { alignItems: 'flex-end' },
  planFigure: { fontSize: 17, fontWeight: '600', ...tabular },
  planDetail: { fontSize: 14, ...tabular },
  footer: {
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cta: { borderRadius: radius.bar, paddingVertical: spacing.lg, alignItems: 'center', minHeight: 52 },
  billed: { fontSize: 15, fontWeight: '500' },
  links: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 24 },
  link: { fontSize: 13 },
  close: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
});
