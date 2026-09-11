import type { TemplateRow } from '@liftcamp/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
}: {
  template: TemplateRow;
  lastDone?: string | null;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  onLongPress?: () => void;
  busy: boolean;
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
            disabled={busy}
            style={({ pressed }) => [styles.secondary, { borderColor: c.border }, (pressed || busy) && styles.pressed]}>
            <Text style={[type.button, { color: c.text2, fontSize: 13 }]}>{secondaryLabel}</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onPrimary}
          disabled={busy}
          style={({ pressed }) => [styles.primary, { backgroundColor: c.accent }, (pressed || busy) && styles.pressed]}>
          <Text style={[type.button, { color: '#FFFFFF', fontSize: 13 }]}>{busy ? '…' : primaryLabel}</Text>
        </Pressable>
      </View>
    </Pressable>
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
  },
  secondary: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pressed: { opacity: 0.7 },
});
