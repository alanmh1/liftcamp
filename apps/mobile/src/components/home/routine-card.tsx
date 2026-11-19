import { lastDoneLabel, type TemplateRow } from '@liftcamp/shared';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { BusyLabel } from '@/components/busy-label';
import { Skeleton, SkeletonText } from '@/components/skeleton';
import { Text } from '@/components/text';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, radius, spacing, type } from '@/theme/tokens';

/**
 * The routine Home would start next (`nextInRotation`), larger than the
 * rows under it and carrying Home's primary button. The same long-press
 * menu as a row. Home's has a Skip at the top right. The Workout tab draws
 * its Up next hero with it too, with its own eyebrow and lines, a ⋯ for the
 * menu, and a body that opens the routine.
 */
export function NextUpCard({
  template,
  program,
  lastDone,
  eyebrow = 'Next up',
  lines,
  startLabel = 'Start',
  onStart,
  onPress,
  onLongPress,
  onMore,
  onSkip,
  busy,
  disabled = false,
}: {
  template: TemplateRow;
  /** The saved routine this day belongs to, when it has one. */
  program: string | null;
  lastDone: string | null;
  eyebrow?: string;
  /** The lines under the name, each on its own row, in place of the one meta line. */
  lines?: string[];
  /** The primary button's label. Home's reads "See routine" before a first finish, when it opens the day. */
  startLabel?: string;
  onStart: () => void;
  /** A tap on the card body. */
  onPress?: () => void;
  onLongPress?: () => void;
  /** The ⋯ button, top right. Opens the same menu as the long press. */
  onMore?: () => void;
  /** The Skip button, top right: this day goes to the back of the queue. */
  onSkip?: () => void;
  busy: boolean;
  disabled?: boolean;
}) {
  const { scheme, colors: c } = useTheme();
  const meta = nextUpMeta(template, program, lastDone);
  const shown = (lines ?? [meta]).filter(Boolean);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole={onPress ? 'button' : 'summary'}
      accessibilityLabel={onPress ? `Open ${template.name}` : undefined}
      style={[styles.nextUp, cardSurface(scheme, c)]}>
      <View style={styles.nextUpHead}>
        <Text style={[type.label, styles.nextUpEyebrow, { color: c.text3 }]}>{eyebrow}</Text>
        {onSkip ? (
          <Pressable
            onPress={onSkip}
            disabled={busy || disabled}
            hitSlop={SKIP_SLOP}
            accessibilityRole="button"
            accessibilityLabel={`Skip ${template.name}`}
            accessibilityState={{ disabled: busy || disabled }}
            style={({ pressed }) => [styles.skip, pressed && styles.pressed]}>
            <Text style={[type.meta, styles.skipLabel, { color: c.accentText }]}>Skip</Text>
          </Pressable>
        ) : null}
        {onMore ? (
          <Pressable
            onPress={onMore}
            hitSlop={MORE_SLOP}
            accessibilityRole="button"
            accessibilityLabel={`More for ${template.name}`}
            style={({ pressed }) => [styles.more, styles.nextUpMore, pressed && styles.pressed]}>
            <SymbolView
              name={{ ios: 'ellipsis', android: 'more_horiz' }}
              size={17}
              weight="semibold"
              tintColor={c.text2}
              fallback={<Text style={[styles.moreGlyph, { color: c.text2 }]}>⋯</Text>}
            />
          </Pressable>
        ) : null}
      </View>
      <Text style={[type.screenTitle, styles.nextUpName, { color: c.text }]} numberOfLines={2}>
        {template.name}
      </Text>
      {shown.map((line, i) => (
        <Text key={i} style={[type.meta, { color: c.text2 }]} numberOfLines={2}>
          {line}
        </Text>
      ))}
      <Pressable
        onPress={onStart}
        disabled={busy || disabled}
        accessibilityRole="button"
        accessibilityLabel={`${startLabel} ${template.name}`}
        accessibilityState={{ busy, disabled: busy || disabled }}
        style={({ pressed }) => [styles.nextUpStart, { backgroundColor: c.accent }, pressed && styles.pressed]}>
        <BusyLabel label={startLabel} busy={busy} color="#FFFFFF" fontSize={17} />
      </Pressable>
    </Pressable>
  );
}

/** The line under a Next up name: the routine, the exercise count, when it was last done. */
function nextUpMeta(template: TemplateRow, program: string | null, lastDone: string | null): string {
  const n = template.template_exercises.length;
  return [program, `${n} ${n === 1 ? 'exercise' : 'exercises'}`, lastDoneLabel(lastDone)]
    .filter(Boolean)
    .join('  ·  ');
}

/**
 * Home's Next up, as the last row of the This week card (board HomeW2):
 * a small NEXT UP label, the name and its meta line on the left; an
 * outlined Skip pill and a solid Start pill on the right. The same actions
 * as NextUpCard: a tap on the left side opens the day when `onPress` is
 * given, a long press opens the routine menu, Skip moves Up next on.
 */
export function NextUpRow({
  template,
  program,
  lastDone,
  startLabel = 'Start',
  onStart,
  onPress,
  onLongPress,
  onSkip,
  busy,
  disabled = false,
}: {
  template: TemplateRow;
  program: string | null;
  lastDone: string | null;
  /** "See routine" before a first finish, when Start opens the day. */
  startLabel?: string;
  onStart: () => void;
  onPress?: () => void;
  onLongPress?: () => void;
  onSkip?: () => void;
  busy: boolean;
  disabled?: boolean;
}) {
  const { colors: c } = useTheme();
  const meta = nextUpMeta(template, program, lastDone);
  const off = busy || disabled;
  const play = startLabel === 'Start';
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        accessibilityRole={onPress ? 'button' : 'text'}
        accessibilityLabel={`Next up: ${template.name}. ${meta}`}
        accessibilityHint={onPress ? 'Opens the routine' : undefined}
        style={({ pressed }) => [styles.rowText, onPress && pressed && styles.pressed]}>
        <Text style={[styles.rowEyebrow, { color: c.text2 }]}>Next up</Text>
        <Text style={[styles.rowName, { color: c.text }]} numberOfLines={1}>
          {template.name}
        </Text>
        <Text style={[styles.rowMeta, { color: c.text2 }]} numberOfLines={1}>
          {meta}
        </Text>
      </Pressable>
      {onSkip ? (
        <Pressable
          onPress={onSkip}
          disabled={off}
          accessibilityRole="button"
          accessibilityLabel={`Skip ${template.name}`}
          accessibilityState={{ disabled: off }}
          style={({ pressed }) => [
            styles.pill,
            styles.skipPill,
            { borderColor: c.accentText, backgroundColor: c.surface },
            pressed && styles.pressed,
          ]}>
          <Text style={[styles.pillLabel, { color: c.accentText }]}>Skip</Text>
        </Pressable>
      ) : null}
      <Pressable
        onPress={onStart}
        disabled={off}
        accessibilityRole="button"
        accessibilityLabel={`${startLabel} ${template.name}`}
        accessibilityState={{ busy, disabled: off }}
        style={({ pressed }) => [styles.pill, styles.startPill, { backgroundColor: c.accent }, pressed && styles.pressed]}>
        {play && !busy ? (
          <SymbolView
            name={{ ios: 'play.fill', android: 'play_arrow' }}
            size={14}
            tintColor="#FFFFFF"
            fallback={null}
          />
        ) : null}
        <BusyLabel label={startLabel} busy={busy} color="#FFFFFF" fontSize={16} />
      </Pressable>
    </View>
  );
}

/** The Next up row's shape, inside the week card skeleton. */
export function NextUpRowSkeleton() {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <SkeletonText variant={styles.rowEyebrow} width="30%" />
        <SkeletonText variant={styles.rowName} width="70%" />
        <SkeletonText variant={styles.rowMeta} width="85%" />
      </View>
      <Skeleton width={84} height={PILL_HEIGHT} radius={radius.pill} />
    </View>
  );
}

/** Skip and Start: 44 pt tall, a full touch target. */
const PILL_HEIGHT = 44;

/** The Next up card's shape, while Home waits to learn whether there is a saved routine. */
export function NextUpCardSkeleton() {
  const { scheme, colors: c } = useTheme();
  return (
    <View style={[styles.nextUp, cardSurface(scheme, c)]}>
      <SkeletonText variant={type.label} width="22%" />
      <SkeletonText variant={styles.nextUpName} width="58%" />
      <SkeletonText variant={type.meta} width="72%" />
      <Skeleton height={NEXT_UP_START_HEIGHT} radius={radius.bar} style={styles.nextUpStartSkeleton} />
    </View>
  );
}

/** The Next up Start: 17pt button text inside 16pt of padding above and below. */
const NEXT_UP_START_HEIGHT = 55;

/**
 * The ⋯ button: 32 by 26 drawn, 52 by 44 to the touch. The slop reaches up
 * and right into the card's padding, and barely down.
 */
const MORE_SLOP = { top: 14, bottom: 4, left: 6, right: 14 };

/** The Skip text is small; this takes it to 44 tall, up and right into the card's padding. */
const SKIP_SLOP = { top: 14, bottom: 12, left: 12, right: 14 };

const styles = StyleSheet.create({
  more: { width: 32, height: 26, alignItems: 'center', justifyContent: 'center', marginRight: -spacing.xs },
  moreGlyph: { fontSize: 20, lineHeight: 22 },
  nextUp: { borderRadius: radius.card, padding: spacing.card, gap: spacing.xs },
  nextUpHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // The ⋯ reaches above and below the eyebrow's line, so the row keeps
  // the eyebrow's height.
  nextUpMore: { marginVertical: -6 },
  nextUpEyebrow: { flex: 1 },
  // Above and below the eyebrow's line, so the row keeps the eyebrow's height.
  skip: { marginVertical: -6 },
  skipLabel: { fontWeight: '600' },
  nextUpName: { fontSize: 20, letterSpacing: -0.4 },
  nextUpStartSkeleton: { marginTop: spacing.md },
  nextUpStart: {
    marginTop: spacing.md,
    borderRadius: radius.bar,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowText: { flex: 1, minWidth: 0, gap: 1 },
  rowEyebrow: { fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
  rowName: { fontSize: 17, fontWeight: '700' },
  rowMeta: { fontSize: 13 },
  pill: {
    height: PILL_HEIGHT,
    borderRadius: radius.pill,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  skipPill: { paddingHorizontal: 14, borderWidth: 1.5 },
  startPill: { paddingHorizontal: 16 },
  pillLabel: { fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
