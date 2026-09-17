import {
  matchHeading,
  routineArtByProgram,
  type EquipmentAccess,
  type ProgramGroup,
  type TemplateRow,
  type TrainingLevel,
} from '@liftcamp/shared';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { EquipmentTiles, LevelTiles } from '@/components/home/pref-tiles';
import { RoutineDetailSheet } from '@/components/home/routine-detail';
import { RoutineGrid } from '@/components/home/routine-grid';
import { Text } from '@/components/text';
import * as home from '@/data/home';
import { useColors } from '@/theme/theme-provider';
import { spacing, type } from '@/theme/tokens';

/**
 * The routines list: every system program, filtered by the same two tiles
 * onboarding asks. The filters open set to the profile's answers (or clear,
 * with `?all=1` from Home's See all, and for a user with no answers) and
 * change freely here without writing back; Profile is where the settings
 * live. Empty pairs widen the way the matcher does everywhere else. Routines
 * are the same grid and detail sheet onboarding uses; "Use routine" saves
 * every variation as the user's own and the list stays put.
 */
export default function RoutinesScreen() {
  const { session } = useAuth();
  const c = useColors();
  const { all } = useLocalSearchParams<{ all?: string }>();
  const userId = session?.user.id;

  const [system, setSystem] = useState<TemplateRow[]>([]);
  const [level, setLevel] = useState<TrainingLevel | null>(null);
  const [equipment, setEquipment] = useState<EquipmentAccess | null>(null);
  const [preset, setPreset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<ProgramGroup | null>(null);

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

  const match = useMemo(
    () => home.starterPrograms(system, { level, equipment }),
    [system, level, equipment],
  );
  // A level alone matches on level; equipment alone matches on equipment;
  // neither shows every program, because this is the full list and not the
  // beginner default Home falls back to.
  const programs = useMemo(
    () => (level || equipment ? match.programs : home.allPrograms(system).programs),
    [match, system, level, equipment],
  );
  const dayCount = programs.reduce((n, g) => n + g.templates.length, 0);
  const art = useMemo(() => routineArtByProgram(system), [system]);

  async function useRoutine(group: ProgramGroup) {
    if (!userId || busy) return;
    setBusy(true);
    const ok = await home.saveProgramCopy(userId, group);
    setBusy(false);
    if (!ok) {
      Alert.alert('Could not save that routine.', 'Try again.');
      return;
    }
    setDetail(null);
    Alert.alert('Saved', `${group.program} is in your routines on Home.`);
  }

  const why = level
    ? match.exact
      ? matchHeading(level, equipment)
      : `Nothing matches exactly. ${matchHeading(level, null)}, any equipment.`
    : equipment
      ? `Everything for ${equipment === 'gym' ? 'a full gym' : equipment === 'bodyweight' ? 'no equipment' : equipment}`
      : 'Every routine';

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={styles.filter}>
        <Text style={[type.label, { color: c.text3 }]}>Experience</Text>
        <LevelTiles value={level} onChange={setLevel} />
      </View>
      <View style={styles.filter}>
        <Text style={[type.label, { color: c.text3 }]}>Equipment</Text>
        <EquipmentTiles value={equipment} onChange={setEquipment} />
      </View>

      <Text style={[type.meta, { color: c.text2 }]}>
        {why} · {programs.length} {programs.length === 1 ? 'routine' : 'routines'}, {dayCount}{' '}
        {dayCount === 1 ? 'variation' : 'variations'}
      </Text>

      <RoutineGrid programs={programs} art={art} onOpen={setDetail} disabled={busy} />

      <RoutineDetailSheet
        group={detail}
        onClose={() => setDetail(null)}
        onUse={(g) => void useRoutine(g)}
        busy={busy}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.screen, gap: spacing.lg, paddingBottom: 48 },
  filter: { gap: spacing.sm },
});
