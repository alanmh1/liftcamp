import {
  ageFromBirthday,
  convertWeight,
  hasStrengthLevel,
  roundLoadNearest,
  roundLoadUp,
  STRENGTH_LEVELS,
  strengthBarPosition,
  strengthLevel,
  strengthThresholds,
} from '@liftcamp/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Sheet, type SheetRef } from '@/components/BottomSheet';
import { useAuth } from '@/components/auth-provider';
import { Text } from '@/components/text';
import { useWeightUnit } from '@/components/unit-provider';
import { getBodyProfile, type BodyProfile } from '@/data/home';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, radius, spacing, type } from '@/theme/tokens';

const MARKER = 14;

/**
 * Strength level on the exercise Summary, after Records. It places the
 * estimated max Records shows on five levels for the user's sex,
 * bodyweight and age, so the two numbers never disagree. Renders nothing
 * for an exercise without standards.
 *
 * The body profile is read on focus, so coming back from Settings with a
 * bodyweight or sex filled in updates the section.
 *
 * Every level uses the accent. A Beginner is where everyone starts, so
 * nothing here is red, and the "to next level" line carries the section.
 */
export function StrengthLevelSection({
  exerciseId,
  estimatedMax,
}: {
  exerciseId: string;
  /** The Records estimated max, in the user's unit. Null before any completed set. */
  estimatedMax: number | null;
}) {
  const { session } = useAuth();
  const router = useRouter();
  const { scheme, colors: c } = useTheme();
  const { unit, label } = useWeightUnit();
  const userId = session?.user.id;
  const supported = hasStrengthLevel(exerciseId);
  const infoRef = useRef<SheetRef>(null);

  const [body, setBody] = useState<BodyProfile | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!userId || !supported) return;
      let cancelled = false;
      getBodyProfile(userId).then((b) => {
        if (!cancelled) setBody(b);
      });
      return () => {
        cancelled = true;
      };
    }, [userId, supported]),
  );

  if (!supported || !body) return null;

  const openSettings = () => router.push('/settings');

  let content: React.ReactNode;
  if (body.sex === 'other') {
    content = (
      <>
        <Text style={[type.meta, { color: c.text2 }]}>
          Strength levels use male and female lifting data, so they don't show for Other.
        </Text>
        <Pressable onPress={openSettings} accessibilityRole="button" hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={[type.button, { color: c.accentText }]}>Change in Settings</Text>
        </Pressable>
      </>
    );
  } else if (body.sex == null || body.bodyweight == null) {
    content = (
      <>
        <Text style={[type.exerciseName, { color: c.text }]}>See how your lifts compare</Text>
        <Text style={[type.meta, { color: c.text2 }]}>
          Add your bodyweight and sex in Settings. It takes 10 seconds.
        </Text>
        <Pressable
          onPress={openSettings}
          accessibilityRole="button"
          style={({ pressed }) => [styles.primary, { backgroundColor: c.accent }, pressed && styles.pressed]}>
          <Text style={[type.button, { color: '#FFFFFF' }]}>Add details</Text>
        </Pressable>
      </>
    );
  } else {
    // Bodyweight is stored in the profile's unit, which is the current one.
    const bodyweightKg = convertWeight(body.bodyweight, unit, 'kg');
    const thresholds = strengthThresholds(exerciseId, body.sex, bodyweightKg, ageFromBirthday(body.birthday));
    if (!thresholds) return null;
    const maxKg = estimatedMax == null ? null : convertWeight(estimatedMax, unit, 'kg');
    const level = maxKg == null ? null : strengthLevel(maxKg, thresholds);
    const position = maxKg == null ? null : strengthBarPosition(maxKg, thresholds);
    const inUnit = (kg: number) => convertWeight(kg, 'kg', unit);

    content = (
      <>
        {level ? (
          <Text style={[type.screenTitle, { color: c.accentText }]}>{level.level}</Text>
        ) : null}

        <View style={styles.barWrap}>
          <View style={styles.bar}>
            {STRENGTH_LEVELS.map((name, i) => (
              <View
                key={name}
                style={[styles.segment, { backgroundColor: level && i < level.index ? c.accent : c.accentSoft }]}
              />
            ))}
          </View>
          {position != null ? (
            <View
              style={[
                styles.marker,
                { left: `${position * 100}%`, backgroundColor: c.accent, borderColor: c.surface },
              ]}
            />
          ) : null}
        </View>

        <Text style={[type.meta, { color: c.text, fontSize: 15 }]}>
          {level == null
            ? 'Log a set to see your level.'
            : level.next == null || level.toNext == null
              ? 'Top level. Nice work.'
              : `${roundLoadUp(inUnit(level.toNext), unit)} ${label} to ${level.next}`}
        </Text>

        <View style={styles.table}>
          {thresholds.map((kg, i) => {
            const current = level != null && level.index === i + 1;
            const color = current ? c.text : c.text2;
            const weight = current ? ('600' as const) : ('400' as const);
            return (
              <View key={STRENGTH_LEVELS[i + 1]} style={styles.tableRow}>
                <Text style={[type.meta, { color, fontSize: 15, fontWeight: weight }]}>{STRENGTH_LEVELS[i + 1]}</Text>
                <Text style={[type.restTime, { color, fontWeight: weight }]}>
                  {roundLoadNearest(inUnit(kg), unit)} {label}
                </Text>
              </View>
            );
          })}
        </View>
      </>
    );
  }

  return (
    <View style={[styles.card, cardSurface(scheme, c)]}>
      <View style={styles.titleRow}>
        <Text style={[type.label, { color: c.text3 }]}>Strength level</Text>
        <Pressable onPress={() => infoRef.current?.present()} hitSlop={10} accessibilityRole="button" accessibilityLabel="About strength level">
          <SymbolView
            name={{ ios: 'info.circle', android: 'info' }}
            size={16}
            tintColor={c.text3}
            fallback={<Text style={[type.meta, { color: c.text3 }]}>ⓘ</Text>}
          />
        </Pressable>
      </View>
      {content}

      <Sheet ref={infoRef}>
        <Text style={[type.exerciseName, styles.sheetCentered, { color: c.text }]}>Strength level</Text>
        <Text style={[type.meta, styles.sheetBody, styles.sheetCentered, { color: c.text }]}>
          Your strength level compares your estimated max with lifters of the same sex, bodyweight
          and age. Most people spend their first year between Beginner and Intermediate, and moving
          up one level is real progress.
        </Text>
        <Text style={[type.meta, styles.sheetBody, styles.sheetCentered, { color: c.text }]}>
          These levels are LiftCamp's own estimates. Use them to track your own progress, not to
          compare against a coach's numbers.
        </Text>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, padding: spacing.card, gap: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  primary: {
    alignSelf: 'flex-start',
    borderRadius: radius.bar,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  // Tall enough for the marker, which overhangs the bar top and bottom.
  barWrap: { height: MARKER, justifyContent: 'center' },
  bar: { flexDirection: 'row', gap: 3, height: 8 },
  segment: { flex: 1, borderRadius: radius.pill },
  marker: {
    position: 'absolute',
    width: MARKER,
    height: MARKER,
    borderRadius: MARKER / 2,
    borderWidth: 2,
    marginLeft: -MARKER / 2,
  },
  table: { gap: spacing.xs },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetBody: { fontSize: 15, lineHeight: 22, paddingTop: spacing.sm },
  // The info sheet shows information only, so it centres (apps/mobile/CLAUDE.md, Sheets).
  sheetCentered: { textAlign: 'center' },
  pressed: { opacity: 0.7 },
});
