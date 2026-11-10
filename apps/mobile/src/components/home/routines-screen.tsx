import {
  EQUIPMENT_ACCESS,
  EQUIPMENT_ACCESS_LABELS,
  matchHeading,
  ROUTINE_REQUEST_ADDRESS,
  routineArtByProgram,
  routineRequestMailto,
  TRAINING_LEVEL_LABELS,
  TRAINING_LEVELS,
  type EquipmentAccess,
  type TemplateRow,
  type TrainingLevel,
} from '@liftcamp/shared';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { EQUIPMENT_ART } from '@/components/home/pref-tiles';
import { RoutineGrid, RoutineGridSkeleton } from '@/components/home/routine-grid';
import { Reveal, SkeletonText } from '@/components/skeleton';
import { useNavHref } from '@/components/tab-layout';
import { Text } from '@/components/text';
import * as home from '@/data/home';
import { SCROLL_END_PADDING, scrollInsetProps } from '@/lib/scroll-insets';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, pressedFlat, radius, spacing, tabular, type } from '@/theme/tokens';

/**
 * The routines browser, See all from Find a routine (docs/workout-tab-spec.md,
 * Find a routine browser): every system routine, filtered by experience
 * (a segmented control) and equipment (a row of icon chips). The filters
 * open set to the profile's answers (or clear, with `?all=1`, and for a
 * user with no answers) and change freely here without writing back;
 * Profile is where the settings live. Tapping the selected segment or chip
 * again clears it. Empty pairs widen the way the matcher does everywhere
 * else.
 *
 * Under the match line, the grid of routine tiles; a tile pushes the
 * routine's detail, whose Use routine saves it. After the grid, a row to
 * ask us for a routine that is not here, by email with the filters in it.
 *
 * Pushed on Workout's stack.
 */
export function RoutinesScreen() {
  const { session } = useAuth();
  const { scheme, colors: c } = useTheme();
  const router = useRouter();
  const navHref = useNavHref();
  const { all } = useLocalSearchParams<{ all?: string }>();
  const userId = session?.user.id;

  // Null until the routines are read; from the session cache when Home
  // already read them, so a return visit renders at once.
  const [system, setSystem] = useState<TemplateRow[] | null>(() => home.peekSystemTemplates() ?? null);
  const [level, setLevel] = useState<TrainingLevel | null>(null);
  const [equipment, setEquipment] = useState<EquipmentAccess | null>(null);
  const [preset, setPreset] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const [rows, prefs] = await Promise.all([home.getSystemTemplates(), home.getTrainingPrefs(userId)]);
    setSystem(rows);
    // Pre-set once per visit, so a filter the user changed survives a refocus.
    if (!preset) {
      setPreset(true);
      if (all !== '1') {
        setLevel(prefs.level);
        setEquipment(prefs.equipment);
      }
    }
  }, [userId, all, preset]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // The grid is ready once the routines are in and the filters hold the
  // profile's answers, so it never shows the unfiltered list first.
  const ready = system != null && (preset || all === '1');

  const match = useMemo(
    () => home.starterPrograms(system ?? [], { level, equipment }),
    [system, level, equipment],
  );
  // A level alone matches on level; equipment alone matches on equipment;
  // neither shows every program, because this is the full list and not the
  // beginner default Home falls back to.
  const programs = useMemo(
    () => (level || equipment ? match.programs : home.allPrograms(system ?? []).programs),
    [match, system, level, equipment],
  );
  const dayCount = programs.reduce((n, g) => n + g.templates.length, 0);
  const art = useMemo(() => routineArtByProgram(system ?? []), [system]);

  const why = level
    ? matchHeading(level, equipment, match)
    : equipment
      ? `Everything for ${equipment === 'gym' ? 'a full gym' : equipment === 'bodyweight' ? 'no equipment' : equipment}`
      : 'Every routine';
  const counts =
    programs.length === 0
      ? 'No routines match yet'
      : `${programs.length} ${programs.length === 1 ? 'routine' : 'routines'}, ${dayCount} ${dayCount === 1 ? 'workout' : 'workouts'}`;

  /** Opens the mailto, or offers the address to copy when no mail app is set up. */
  async function requestRoutine() {
    const url = routineRequestMailto(level, equipment);
    const canMail = await Linking.canOpenURL('mailto:').catch(() => false);
    if (canMail) {
      try {
        await Linking.openURL(url);
        return;
      } catch {
        // No mail app took it; offer the address instead.
      }
    }
    Alert.alert('Request a routine', `Email ${ROUTINE_REQUEST_ADDRESS} with the routine you want.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Copy', onPress: () => void Clipboard.setStringAsync(ROUTINE_REQUEST_ADDRESS) },
    ]);
  }

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.content} {...scrollInsetProps}>
      <View style={styles.filter}>
        <Text style={[type.label, { color: c.text3 }]}>Experience</Text>
        <View style={[styles.segments, { backgroundColor: c.surface2 }]}>
          {TRAINING_LEVELS.map((l) => {
            const selected = level === l;
            return (
              <Pressable
                key={l}
                onPress={() => setLevel(selected ? null : l)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.segment, selected && [cardSurface(scheme, c), styles.segmentOn]]}>
                <Text
                  numberOfLines={1}
                  style={[type.meta, styles.segmentText, { color: selected ? c.text : c.text2 }]}>
                  {TRAINING_LEVEL_LABELS[l]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.filter}>
        <Text style={[type.label, { color: c.text3 }]}>Equipment</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroller}
          contentContainerStyle={styles.chips}>
          {EQUIPMENT_ACCESS.map((eq) => {
            const selected = equipment === eq;
            return (
              <Pressable
                key={eq}
                onPress={() => setEquipment(selected ? null : eq)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: selected ? c.accentSoft : c.surface2,
                    borderColor: selected ? c.accent : 'transparent',
                  },
                  pressed && styles.pressed,
                ]}>
                <Image
                  source={EQUIPMENT_ART[eq]}
                  style={styles.chipArt}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  accessibilityIgnoresInvertColors
                />
                <Text style={[type.meta, styles.chipText, { color: selected ? c.accentText : c.text }]}>
                  {EQUIPMENT_ACCESS_LABELS[eq]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <Reveal
        ready={ready}
        skeleton={
          <View style={styles.results}>
            <SkeletonText variant={type.meta} width="70%" />
            <RoutineGridSkeleton count={6} />
          </View>
        }>
        <View style={styles.results}>
          <Text style={[type.meta, styles.matchLine, { color: c.text2 }]}>
            {why} · {counts}
          </Text>

          {/* With a level picked, the line above names it. */}
          <RoutineGrid
            programs={programs}
            art={art}
            onOpen={(g) => router.push(navHref({ kind: 'starterRoutine', program: g.program }))}
            namedLevel={level}
          />
        </View>
      </Reveal>

      <Pressable
        onPress={() => void requestRoutine()}
        accessibilityRole="button"
        accessibilityLabel="Request a routine"
        accessibilityHint="Opens an email to LiftCamp"
        style={({ pressed }) => [styles.request, cardSurface(scheme, c), pressed && [styles.pressed, pressedFlat]]}>
        <View style={[styles.requestIcon, { backgroundColor: c.accentSoft }]}>
          <SymbolView
            name={{ ios: 'envelope', android: 'mail' }}
            size={17}
            weight="semibold"
            tintColor={c.accentText}
            fallback={<Text style={[styles.requestGlyph, { color: c.accentText }]}>✉</Text>}
          />
        </View>
        <View style={styles.requestText}>
          <Text style={[type.exerciseName, { color: c.text }]}>Don&apos;t see the routine you want?</Text>
          <Text style={[type.meta, { color: c.text2 }]}>Request it and we&apos;ll build it</Text>
        </View>
        <SymbolView
          name={{ ios: 'chevron.right', android: 'chevron_right' }}
          size={13}
          weight="semibold"
          tintColor={c.text3}
          fallback={<Text style={[styles.chevron, { color: c.text3 }]}>›</Text>}
        />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.screen, gap: spacing.lg, paddingBottom: SCROLL_END_PADDING },
  filter: { gap: spacing.sm },
  // The segmented control: a sunken track, the selected segment raised.
  segments: { flexDirection: 'row', borderRadius: radius.pill, padding: 3 },
  segment: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
  },
  // A raised segment keeps the track's shape: no dark-mode card border.
  segmentOn: { borderWidth: 0 },
  segmentText: { fontSize: 14, fontWeight: '600' },
  // Edge to edge, like the program row, so the last chip scrolls to the edge.
  chipScroller: { marginHorizontal: -spacing.screen },
  chips: { gap: spacing.sm, paddingHorizontal: spacing.screen },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    paddingLeft: spacing.xs,
    paddingRight: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipArt: { width: 28, height: 28 },
  chipText: { fontSize: 14, fontWeight: '600' },
  results: { gap: spacing.lg },
  matchLine: tabular,
  request: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.card,
    padding: spacing.card,
  },
  requestIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  requestGlyph: { fontSize: 16, lineHeight: 20 },
  requestText: { flex: 1, gap: 2 },
  chevron: { fontSize: 20, lineHeight: 22 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
