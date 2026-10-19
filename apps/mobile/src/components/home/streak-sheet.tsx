import {
  medalCabinet,
  medalEarnsFromDates,
  medalProgress,
  nextMedalRung,
  proseCount,
  proseNumber,
  type CabinetRung,
  type WeekCardState,
} from '@liftcamp/shared';
import { SymbolView } from 'expo-symbols';
import { forwardRef, useImperativeHandle, useMemo, useRef, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Sheet, type SheetRef } from '@/components/BottomSheet';
import { Medal } from '@/components/medals/medal';
import { FIRST_MEDAL_BODY, FIRST_MEDAL_TITLE } from '@/components/streak/medal-row';
import { Flame, type FlameVariant } from '@/components/streak/flame';
import { DayRow, RestToken, restWeekShowing } from '@/components/streak/streak-parts';
import { Text } from '@/components/text';
import { useColors } from '@/theme/theme-provider';
import { palettes, spacing, tabular, type, type Palette } from '@/theme/tokens';

export type StreakSheetHandle = {
  present: () => void;
  dismiss: () => void;
};

/** Active: a streak is going. Protected: last week's rest week kept it. None: no streak. */
export type StreakSheetVariant = 'active' | 'protected' | 'none';

export function streakSheetVariant(state: WeekCardState): StreakSheetVariant {
  if (restWeekShowing(state)) return 'protected';
  return state.streak.current >= 1 ? 'active' : 'none';
}

const PROTECTED_LINE =
  'Your rest week covered last week, so the streak held. Hit four more weeks in a row to bank another.';

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function look(variant: StreakSheetVariant, c: Palette) {
  switch (variant) {
    case 'protected':
      return { fill: c.iceBg, number: c.iceText, label: c.iceText, text: 'week streak, safe', flame: 'ice' as FlameVariant };
    case 'none':
      return { fill: c.surface2, number: c.text3, label: c.text2, text: 'week streak', flame: 'out' as FlameVariant };
    default:
      return { fill: c.streakHitBg, number: c.streakBig, label: c.streakText, text: 'week streak', flame: 'ember' as FlameVariant };
  }
}

/**
 * The streak sheet, opened from the week card's chip (and its "Open
 * streak" action). The spec is docs/week-card-v2-spec.md ("The streak
 * sheet").
 *
 * Its fill follows the variant: streakHitBg while a streak is going,
 * iceBg the week after a rest week kept it, surface2 with none. On it: a
 * top row (Share, the rest-week token, Close), the streak as a big number
 * beside the clay flame, then panels on `surface`: This week with the day
 * row, the medals (earned, the next, the two after), or, with no streak,
 * the streak that ended or the first-medal text. Last, Start a workout (or
 * Resume workout) through Home's start.
 *
 * Draws from the card's state and the same dates, with no reads of its
 * own: the medals are medalCabinet over medalEarnsFromDates. The next
 * medal is medalProgress's, the one the card names, so the two agree.
 */
export const StreakSheet = forwardRef<
  StreakSheetHandle,
  {
    state: WeekCardState | null;
    /** Finished workout dates, as the week card gets them. */
    dates: readonly string[];
    /** Places the week; defaults to now, as on Home. */
    today?: Date;
    /** Opens the streak card preview. Without it there is no Share. */
    onShare?: () => void;
    onSeeAllMedals: () => void;
    /** "Start a workout" or "Resume workout". Runs after the sheet closes. */
    primary: { label: string; onPress: () => void; disabled?: boolean };
  }
>(function StreakSheet({ state, dates, today, onShare, onSeeAllMedals, primary }, ref) {
  const c = useColors();
  const sheet = useRef<SheetRef>(null);

  useImperativeHandle(ref, () => ({
    present: () => sheet.current?.present(),
    dismiss: () => sheet.current?.dismiss(),
  }));

  const target = state?.target ?? 0;
  const current = state?.streak.current ?? 0;
  const cabinet = useMemo(
    () => medalCabinet(medalEarnsFromDates(dates, target, today), current),
    [dates, target, today, current],
  );

  if (!state) return <Sheet ref={sheet}>{null}</Sheet>;

  const variant = streakSheetVariant(state);
  const v = look(variant, c);
  const progress = medalProgress(state);
  const close = () => sheet.current?.dismiss();

  const thisWeek = (
    <Panel>
      <View style={styles.panelHead}>
        <Text style={[styles.panelTitle, { color: c.text }]}>This week</Text>
        <Text style={[styles.panelMeta, { color: c.text2 }]}>
          {state.done} of {state.target}
        </Text>
      </View>
      <DayRow state={state} dates={dates} today={today} />
      <View style={[styles.hairline, { backgroundColor: c.divider }]} />
      <Text style={[styles.body, { color: progress.urgent && variant === 'active' ? c.streakText : c.text2 }]}>
        {variant === 'protected' ? PROTECTED_LINE : progress.line}
      </Text>
    </Panel>
  );

  // The two highest earned, lowest first; the next; the two after it.
  const earned = [...cabinet.earned].sort((a, b) => b.weeks - a.weeks).slice(0, 2).reverse();
  const after1 = nextMedalRung(progress.next);
  const after2 = nextMedalRung(after1);
  const medals = (
    <Panel>
      <View style={styles.panelHead}>
        <Text style={[styles.panelTitle, { color: c.text }]}>Medals</Text>
        <Pressable
          onPress={() => {
            close();
            onSeeAllMedals();
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="See all medals"
          style={({ pressed }) => pressed && styles.pressed}>
          <Text style={[type.button, { color: c.accentText }]}>See all</Text>
        </Pressable>
      </View>
      <View style={styles.medalRow}>
        {earned.map((r) => (
          <EarnedMedal key={r.weeks} rung={r} />
        ))}
        <View style={styles.medalCell}>
          <Medal weeks={progress.next} size={72} variant="locked" />
          <Text style={[styles.medalCaption, styles.toGo, { color: c.streakText }]}>{progress.toGo} to go</Text>
        </View>
        {[after1, after2].map((w) => (
          <View key={w} style={[styles.medalCell, styles.far]}>
            <Medal weeks={w} size={48} variant="locked" />
          </View>
        ))}
      </View>
    </Panel>
  );

  const lost = state.streak.resetLastWeekFrom;
  const ended =
    lost > 0 ? (
      <Panel>
        <Text style={[styles.body, { color: c.text2 }]}>
          Your {proseNumber(lost)}-week streak ended last week. {cap(proseCount(state.target, 'workout'))} this week
          starts a new one, and your medals stay yours.
        </Text>
        {cabinet.earned.length > 0 ? (
          <View style={styles.medalWrap}>
            {cabinet.earned.map((r) => (
              <EarnedMedal key={r.weeks} rung={r} />
            ))}
          </View>
        ) : null}
      </Panel>
    ) : (
      <Panel>
        <View style={styles.firstRow}>
          <View style={styles.firstText}>
            <Text style={[styles.panelTitle, { color: c.text }]}>{FIRST_MEDAL_TITLE}</Text>
            <Text style={[styles.body, { color: c.text3 }]}>{FIRST_MEDAL_BODY}</Text>
          </View>
          <Medal weeks={progress.next} size={72} variant="locked" />
        </View>
      </Panel>
    );

  return (
    <Sheet ref={sheet} scroll backgroundColor={v.fill}>
      <View style={styles.body0}>
        <View style={styles.top}>
          {onShare && current > 0 ? (
            <IconButton
              icon={{ ios: 'square.and.arrow.up', android: 'share' }}
              fallback="↑"
              label="Share streak"
              onPress={() => {
                close();
                onShare();
              }}
            />
          ) : null}
          <View style={styles.spacer} />
          <RestToken count={state.streak.restBanked ? 1 : 0} />
          <IconButton icon={{ ios: 'xmark', android: 'close' }} fallback="×" label="Close" onPress={close} />
        </View>

        <View
          style={styles.hero}
          accessible
          accessibilityLabel={`${current} ${v.text}`}>
          <View style={styles.heroText}>
            <Text style={[styles.number, { color: v.number }]}>{current}</Text>
            <Text style={[styles.heroLabel, { color: v.label }]}>{v.text}</Text>
          </View>
          <Flame variant={v.flame} size={112} />
        </View>

        {variant === 'none' ? ended : thisWeek}
        {variant === 'active' ? medals : null}

        <Pressable
          onPress={() => {
            close();
            primary.onPress();
          }}
          disabled={primary.disabled}
          accessibilityRole="button"
          accessibilityLabel={primary.label}
          style={({ pressed }) => [styles.primary, { backgroundColor: c.accent }, (pressed || primary.disabled) && styles.pressed]}>
          <Text style={[type.button, styles.primaryLabel]}>{primary.label}</Text>
        </Pressable>
      </View>
    </Sheet>
  );
});

function Panel({ children }: { children: ReactNode }) {
  const c = useColors();
  return <View style={[styles.panel, { backgroundColor: c.surface }]}>{children}</View>;
}

/** An earned rung at 56 pt, "Earned" under it, or "×3" when earned more than once. */
function EarnedMedal({ rung }: { rung: CabinetRung }) {
  const c = useColors();
  return (
    <View style={styles.medalCell}>
      <Medal weeks={rung.weeks} size={56} />
      <Text style={[styles.medalCaption, { color: c.text3 }]}>{rung.count > 1 ? `×${rung.count}` : 'Earned'}</Text>
    </View>
  );
}

function IconButton({
  icon,
  fallback,
  label,
  onPress,
}: {
  icon: ComponentProps<typeof SymbolView>['name'];
  fallback: string;
  label: string;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.icon, { backgroundColor: c.surface }, pressed && styles.pressed]}>
      <SymbolView
        name={icon}
        size={16}
        weight="semibold"
        tintColor={c.text2}
        fallback={<Text style={[styles.iconGlyph, { color: c.text2 }]}>{fallback}</Text>}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body0: { gap: spacing.md, paddingTop: spacing.xs },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  spacer: { flex: 1 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  iconGlyph: { fontSize: 18, fontWeight: '600' },
  hero: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroText: { flexShrink: 1 },
  number: { fontSize: 72, lineHeight: 80, fontWeight: '700', letterSpacing: -1.5, ...tabular },
  heroLabel: { fontSize: 20, fontWeight: '700' },
  panel: { borderRadius: 18, padding: spacing.card, gap: spacing.md },
  panelHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  panelTitle: { fontSize: 15, fontWeight: '700' },
  panelMeta: { fontSize: 15, fontWeight: '600', ...tabular },
  hairline: { height: StyleSheet.hairlineWidth },
  body: { fontSize: 14 },
  medalRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  medalWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  medalCell: { alignItems: 'center', gap: 4 },
  medalCaption: { fontSize: 12, fontWeight: '600', ...tabular },
  toGo: { fontWeight: '700' },
  far: { opacity: 0.3, paddingBottom: 20 },
  firstRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  firstText: { flex: 1, gap: 4 },
  primary: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  primaryLabel: { color: palettes.light.bg, fontSize: 17 },
  pressed: { opacity: 0.7 },
});
