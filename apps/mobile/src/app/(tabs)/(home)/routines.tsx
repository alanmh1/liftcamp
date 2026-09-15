import { matchHeading, type EquipmentAccess, type TemplateRow, type TrainingLevel } from '@liftcamp/shared';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { EquipmentTiles, LevelTiles } from '@/components/home/pref-tiles';
import { RoutineCard } from '@/components/home/routine-card';
import { Text } from '@/components/text';
import * as home from '@/data/home';
import { useColors } from '@/theme/theme-provider';
import { spacing, type } from '@/theme/tokens';

/**
 * The routines list: every system program, filtered by the same two tiles
 * onboarding asks. The filters open set to the profile's answers (or clear,
 * with `?all=1` from Home's See all, and for a user with no answers) and
 * change freely here without writing back; Profile is where the settings
 * live. Empty pairs widen the way the matcher does everywhere else.
 */
export default function RoutinesScreen() {
  const { session } = useAuth();
  const c = useColors();
  const router = useRouter();
  const { all } = useLocalSearchParams<{ all?: string }>();
  const userId = session?.user.id;

  const [system, setSystem] = useState<TemplateRow[]>([]);
  const [level, setLevel] = useState<TrainingLevel | null>(null);
  const [equipment, setEquipment] = useState<EquipmentAccess | null>(null);
  const [preset, setPreset] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

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
  // neither shows every program including those flagged off onboarding,
  // because this is the full list.
  const programs = useMemo(
    () => (level || equipment ? match.programs : home.starterPrograms(system, { level: null, equipment: null }).programs),
    [match, system, level, equipment],
  );
  const dayCount = programs.reduce((n, g) => n + g.templates.length, 0);

  async function run(key: string, fn: (uid: string) => Promise<string | null>) {
    if (!userId || busy) return;
    setBusy(key);
    const id = await fn(userId);
    setBusy(null);
    if (id) router.push({ pathname: '/workout/[id]', params: { id } });
    else Alert.alert('Could not start that workout.', 'Try again.');
  }

  async function save(t: TemplateRow) {
    if (!userId || busy) return;
    setBusy(`save:${t.id}`);
    const id = await home.saveTemplateCopy(userId, t);
    setBusy(null);
    if (id) Alert.alert('Saved', `${t.name} is in your routines on Home.`);
    else Alert.alert('Could not save that routine.', 'Try again.');
  }

  const why = level
    ? match.exact
      ? matchHeading(level, equipment)
      : `Nothing matches exactly. ${matchHeading(level, null)}, any equipment.`
    : equipment
      ? `Everything for ${equipment === 'gym' ? 'a full gym' : equipment === 'bodyweight' ? 'no equipment' : equipment}`
      : 'Every program';

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={styles.filter}>
        <Text style={[type.label, { color: c.text3 }]}>Level</Text>
        <LevelTiles value={level} onChange={setLevel} />
      </View>
      <View style={styles.filter}>
        <Text style={[type.label, { color: c.text3 }]}>Equipment</Text>
        <EquipmentTiles value={equipment} onChange={setEquipment} />
      </View>

      <Text style={[type.meta, { color: c.text2 }]}>
        {why} · {programs.length} {programs.length === 1 ? 'program' : 'programs'}, {dayCount}{' '}
        {dayCount === 1 ? 'day' : 'days'}
      </Text>

      {programs.map((g) => (
        <View key={g.program} style={styles.program}>
          <View>
            <Text style={[type.label, { color: c.text3 }]}>{g.program}</Text>
            {g.blurb ? <Text style={[type.meta, { color: c.text2 }]}>{g.blurb}</Text> : null}
          </View>
          {g.templates.map((t) => (
            <RoutineCard
              key={t.id}
              template={t}
              primaryLabel="Use"
              onPrimary={() => void run(t.id, (uid) => home.startFromTemplate(uid, t))}
              secondaryLabel="Save a copy"
              onSecondary={() => void save(t)}
              busy={busy === t.id}
              disabled={busy !== null}
            />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.screen, gap: spacing.lg, paddingBottom: 48 },
  filter: { gap: spacing.sm },
  program: { gap: spacing.sm },
});
