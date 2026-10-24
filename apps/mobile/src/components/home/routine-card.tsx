import { lastDoneLabel, type TemplateRow } from '@liftcamp/shared';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { BusyLabel } from '@/components/busy-label';
import { Skeleton, SkeletonText } from '@/components/skeleton';
import { Text } from '@/components/text';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, radius, spacing, type } from '@/theme/tokens';

/**
 * The routine day Home would start next (`nextRoutineDay`), larger than the
 * rows under it and carrying Home's primary button. The same long-press
 * menu as a row. The Workout tab draws its Up next hero with it too, with
 * its own eyebrow and lines, a ⋯ for the menu, and a body that opens the
 * routine.
 */
export function NextUpCard({
  template,
  program,
  lastDone,
  eyebrow = 'Next up',
  lines,
  onStart,
  onPress,
  onLongPress,
  onMore,
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
  onStart: () => void;
  /** A tap on the card body. */
  onPress?: () => void;
  onLongPress?: () => void;
  /** The ⋯ button, top right. Opens the same menu as the long press. */
  onMore?: () => void;
  busy: boolean;
  disabled?: boolean;
}) {
  const { scheme, colors: c } = useTheme();
  const n = template.template_exercises.length;
  const meta = [program, `${n} ${n === 1 ? 'exercise' : 'exercises'}`, lastDoneLabel(lastDone)]
    .filter(Boolean)
    .join('  ·  ');
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
        accessibilityLabel={`Start ${template.name}`}
        accessibilityState={{ busy, disabled: busy || disabled }}
        style={({ pressed }) => [styles.nextUpStart, { backgroundColor: c.accent }, pressed && styles.pressed]}>
        <BusyLabel label="Start" busy={busy} color="#FFFFFF" fontSize={17} />
      </Pressable>
    </Pressable>
  );
}

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

const styles = StyleSheet.create({
  more: { width: 32, height: 26, alignItems: 'center', justifyContent: 'center', marginRight: -spacing.xs },
  moreGlyph: { fontSize: 20, lineHeight: 22 },
  nextUp: { borderRadius: radius.card, padding: spacing.card, gap: spacing.xs },
  nextUpHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // The ⋯ reaches above and below the eyebrow's line, so the row keeps
  // the eyebrow's height.
  nextUpMore: { marginVertical: -6 },
  nextUpEyebrow: { flex: 1 },
  nextUpName: { fontSize: 20, letterSpacing: -0.4 },
  nextUpStartSkeleton: { marginTop: spacing.md },
  nextUpStart: {
    marginTop: spacing.md,
    borderRadius: radius.bar,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  pressed: { opacity: 0.7 },
});
