import {
  EQUIPMENT_ACCESS,
  EQUIPMENT_ACCESS_LABELS,
  TRAINING_LEVEL_LABELS,
  TRAINING_LEVELS,
} from '@liftcamp/shared';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/components/auth-provider';
import { Avatar } from '@/components/avatar';
import { Chip, Section, settingsStyles } from '@/components/settings-ui';
import { Text } from '@/components/text';
import {
  getTrainingPrefs,
  getUsername,
  getWeeklyTarget,
  setTrainingPrefs,
  setWeeklyTarget,
  WEEKLY_TARGET_OPTIONS,
  type TrainingPrefs,
} from '@/data/home';
import { useColors } from '@/theme/theme-provider';
import { spacing, type } from '@/theme/tokens';

/**
 * Profile: weekly target, level and equipment. Everything else (body,
 * units, theme, username, account) is in Settings, behind the gear.
 */
export default function ProfileScreen() {
  const { session } = useAuth();
  const c = useColors();
  const router = useRouter();
  const userId = session?.user.id;

  const [target, setTarget] = useState<number | null>(null);
  const [prefs, setPrefs] = useState<TrainingPrefs>({ level: null, equipment: null });
  // Only for the initials fallback when the account has no photo.
  const [username, setUsername] = useState<string | null>(null);
  useEffect(() => {
    if (!userId) return;
    getWeeklyTarget(userId).then(setTarget);
    getTrainingPrefs(userId).then(setPrefs);
    getUsername(userId).then(setUsername);
  }, [userId]);

  // Level and equipment drive which starter programs Home and the routines
  // list show. Tap to change; there is no way back to "not answered", since
  // that state only means the question was never asked.
  const pickPrefs = useCallback(
    (next: Partial<TrainingPrefs>) => {
      if (!userId) return;
      setPrefs((p) => ({ ...p, ...next }));
      void setTrainingPrefs(userId, next);
    },
    [userId],
  );

  const pickTarget = useCallback(
    (n: number) => {
      if (!userId) return;
      setTarget(n);
      void setWeeklyTarget(userId, n);
    },
    [userId],
  );

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <SafeAreaView style={styles.fill} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.titleRow}>
            <Text style={[type.screenTitle, styles.title, { color: c.text }]}>Profile</Text>
            <Avatar meta={session?.user.user_metadata} username={username} size={40} />
            <Pressable
              onPress={() => router.push('/settings')}
              accessibilityRole="button"
              accessibilityLabel="Settings"
              style={({ pressed }) => [styles.gear, pressed && settingsStyles.pressed]}>
              <SymbolView
                name="gearshape"
                size={22}
                tintColor={c.text2}
                fallback={<Text style={[styles.gearFallback, { color: c.text2 }]}>⚙</Text>}
              />
            </Pressable>
          </View>

          <Section title="Weekly target" c={c}>
            <View style={settingsStyles.row}>
              {WEEKLY_TARGET_OPTIONS.map((n) => (
                <Chip key={n} label={`${n}`} selected={target === n} onPress={() => pickTarget(n)} c={c} numeral />
              ))}
            </View>
            <Text style={[type.meta, { color: c.text2 }]}>Workouts per week.</Text>
          </Section>

          <Section title="Experience" c={c}>
            <View style={settingsStyles.row}>
              {TRAINING_LEVELS.map((l) => (
                <Chip
                  key={l}
                  label={TRAINING_LEVEL_LABELS[l]}
                  selected={prefs.level === l}
                  onPress={() => pickPrefs({ level: l })}
                  c={c}
                />
              ))}
            </View>
          </Section>

          <Section title="Equipment" c={c}>
            <View style={settingsStyles.row}>
              {EQUIPMENT_ACCESS.map((e) => (
                <Chip
                  key={e}
                  label={EQUIPMENT_ACCESS_LABELS[e]}
                  selected={prefs.equipment === e}
                  onPress={() => pickPrefs({ equipment: e })}
                  c={c}
                />
              ))}
            </View>
            <Text style={[type.meta, { color: c.text2 }]}>
              Experience and equipment pick the starter routines Home suggests.
            </Text>
          </Section>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.xl, paddingBottom: 48 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1 },
  // 44 pt square, the minimum iOS hit target.
  gear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -spacing.sm },
  gearFallback: { fontSize: 22 },
});
