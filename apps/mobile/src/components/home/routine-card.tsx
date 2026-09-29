import type { TemplateRow } from '@liftcamp/shared';
import { Pressable, StyleSheet, View } from 'react-native';

import { BusyLabel } from '@/components/busy-label';
import { Skeleton, SkeletonCircle, SkeletonText } from '@/components/skeleton';
import { Text } from '@/components/text';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, radius, spacing, type } from '@/theme/tokens';

function lastDoneLabel(iso: string | null): string {
  if (!iso) return 'Not done yet';
  const days = Math.round((Date.now() - new Date(`${iso}T00:00:00`).getTime()) / 86_400_000);
  if (days <= 0) return 'Done today';
  if (days === 1) return 'Done yesterday';
  if (days < 7) return `Done ${days} days ago`;
  const weeks = Math.round(days / 7);
  return `Done ${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
}

/**
 * One routine as a card. The primary action sits on the card; the secondary
 * action is either Save a copy (starter) or a long-press menu (yours), per the
 * spec. Tap on the card body is the preview, which has no screen yet, so it
 * is a no-op until the routine editor lands.
 */
export function RoutineCard({
  template,
  lastDone,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  onLongPress,
  busy,
  disabled = false,
}: {
  template: TemplateRow;
  lastDone?: string | null;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  onLongPress?: () => void;
  /** This card is the one starting. Shows the spinner. */
  busy: boolean;
  /** Some card is starting. Blocks a second start without changing the look. */
  disabled?: boolean;
}) {
  const { scheme, colors: c } = useTheme();
  const n = template.template_exercises.length;

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="button"
      style={[styles.card, cardSurface(scheme, c)]}>
      <View style={styles.text}>
        <Text style={[type.exerciseName, { color: c.text }]} numberOfLines={1}>
          {template.name}
        </Text>
        <Text style={[type.meta, { color: c.text2 }]}>
          {n} {n === 1 ? 'exercise' : 'exercises'}
          {lastDone !== undefined ? `  ·  ${lastDoneLabel(lastDone)}` : ''}
        </Text>
      </View>
      <View style={styles.actions}>
        {secondaryLabel && onSecondary ? (
          <Pressable
            onPress={onSecondary}
            disabled={busy || disabled}
            style={({ pressed }) => [styles.secondary, { borderColor: c.border }, (pressed || busy) && styles.pressed]}>
            <Text style={[type.button, { color: c.text2, fontSize: 13 }]}>{secondaryLabel}</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onPrimary}
          disabled={busy || disabled}
          accessibilityState={{ busy, disabled: busy || disabled }}
          style={({ pressed }) => [styles.primary, { backgroundColor: c.accent }, pressed && styles.pressed]}>
          <BusyLabel label={primaryLabel} busy={busy} color="#FFFFFF" />
        </Pressable>
      </View>
    </Pressable>
  );
}

/**
 * The routine day Home would start next (`nextRoutineDay`), larger than the
 * rows under it and carrying Home's primary button. The same long-press
 * menu as a row.
 */
export function NextUpCard({
  template,
  program,
  lastDone,
  onStart,
  onLongPress,
  busy,
  disabled = false,
}: {
  template: TemplateRow;
  /** The saved routine this day belongs to, when it has one. */
  program: string | null;
  lastDone: string | null;
  onStart: () => void;
  onLongPress?: () => void;
  busy: boolean;
  disabled?: boolean;
}) {
  const { scheme, colors: c } = useTheme();
  const n = template.template_exercises.length;
  const meta = [program, `${n} ${n === 1 ? 'exercise' : 'exercises'}`, lastDoneLabel(lastDone)]
    .filter(Boolean)
    .join('  ·  ');
  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="summary"
      style={[styles.nextUp, cardSurface(scheme, c)]}>
      <Text style={[type.label, { color: c.text3 }]}>Next up</Text>
      <Text style={[type.screenTitle, styles.nextUpName, { color: c.text }]} numberOfLines={2}>
        {template.name}
      </Text>
      <Text style={[type.meta, { color: c.text2 }]} numberOfLines={2}>
        {meta}
      </Text>
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

/** A Start pill: 15pt button text inside 8pt of padding above and below. */
const PRIMARY_HEIGHT = 35;

/** A routine card's shape before Home's routines load: name, count, Start. */
export function RoutineCardSkeleton({ nameWidth }: { nameWidth: `${number}%` }) {
  const { scheme, colors: c } = useTheme();
  return (
    <View style={[styles.card, cardSurface(scheme, c)]}>
      <View style={styles.text}>
        <SkeletonText variant={type.exerciseName} width={nameWidth} />
        <SkeletonText variant={type.meta} width="50%" />
      </View>
      <Skeleton width={58} height={PRIMARY_HEIGHT} radius={radius.pill} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.card,
    padding: spacing.card,
  },
  text: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  primary: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondary: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  nextUp: { borderRadius: radius.card, padding: spacing.card, gap: spacing.xs },
  nextUpName: { fontSize: 20, letterSpacing: -0.4 },
  nextUpStart: {
    marginTop: spacing.md,
    borderRadius: radius.bar,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  pressed: { opacity: 0.7 },
});
