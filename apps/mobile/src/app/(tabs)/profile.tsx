import {
  EQUIPMENT_ACCESS,
  EQUIPMENT_ACCESS_LABELS,
  TRAINING_LEVEL_LABELS,
  TRAINING_LEVELS,
} from '@liftcamp/shared';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/components/auth-provider';
import { useOnboarding } from '@/components/onboarding-provider';
import { Text } from '@/components/text';
import {
  getTrainingPrefs,
  getWeeklyTarget,
  setTrainingPrefs,
  setWeeklyTarget,
  WEEKLY_TARGET_OPTIONS,
  type TrainingPrefs,
} from '@/data/home';
import { useTheme, THEME_SETTINGS } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

/**
 * Profile: weekly target, level and equipment, theme, account. Units, PR
 * goals and the consecutive-weeks streak arrive with their own specs.
 */

const PROVIDER_LABELS: Record<string, string> = { apple: 'Apple', google: 'Google' };

/**
 * Which third-party identity a signed-in user has. Read from `identities`
 * rather than `app_metadata.provider`, because an account that started
 * anonymous and was linked keeps `anonymous` as its first provider.
 */
function providerLabel(user: { identities?: { provider: string }[] } | undefined): string | null {
  const real = user?.identities?.map((i) => i.provider).filter((p) => p !== 'anonymous') ?? [];
  const labels = real.map((p) => PROVIDER_LABELS[p] ?? p[0].toUpperCase() + p.slice(1));
  return labels.length > 0 ? labels.join(' and ') : null;
}
export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const { colors: c, setting, setSetting } = useTheme();
  const { reset: resetOnboarding } = useOnboarding();
  const router = useRouter();
  const userId = session?.user.id;
  const anonymous = !!session?.user.is_anonymous;

  const [target, setTarget] = useState<number | null>(null);
  const [prefs, setPrefs] = useState<TrainingPrefs>({ level: null, equipment: null });
  useEffect(() => {
    if (!userId) return;
    getWeeklyTarget(userId).then(setTarget);
    getTrainingPrefs(userId).then(setPrefs);
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
          <Text style={[type.screenTitle, { color: c.text }]}>Profile</Text>

          <Section title="Weekly target" c={c}>
            <View style={styles.row}>
              {WEEKLY_TARGET_OPTIONS.map((n) => (
                <Chip key={n} label={`${n}`} selected={target === n} onPress={() => pickTarget(n)} c={c} numeral />
              ))}
            </View>
            <Text style={[type.meta, { color: c.text2 }]}>Workouts per week.</Text>
          </Section>

          <Section title="Level" c={c}>
            <View style={styles.row}>
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
            <View style={styles.row}>
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
              Level and equipment pick the starter routines Home suggests.
            </Text>
          </Section>

          <Section title="Theme" c={c}>
            <View style={styles.row}>
              {THEME_SETTINGS.map((s) => (
                <Chip key={s} label={s} selected={setting === s} onPress={() => setSetting(s)} c={c} />
              ))}
            </View>
          </Section>

          <Section title="Account" c={c}>
            {anonymous ? (
              <>
                <Text style={[type.meta, { color: c.text2 }]}>
                  Your workouts are saved on this device only. They are not tied to an
                  account yet, so a new phone or a reinstall starts from nothing.
                </Text>
                <Pressable
                  onPress={() => router.push('/link-account')}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.primary,
                    { backgroundColor: c.accent },
                    pressed && styles.pressed,
                  ]}>
                  <Text style={[type.button, { color: '#FFFFFF' }]}>Save your workouts</Text>
                </Pressable>
              </>
            ) : (
              <View style={styles.identity}>
                <Text style={[type.meta, { color: c.text, fontSize: 15 }]}>
                  {session?.user.email ?? 'Signed in'}
                </Text>
                {providerLabel(session?.user) ? (
                  <Text style={[type.meta, { color: c.text2 }]}>
                    Signed in with {providerLabel(session?.user)}
                  </Text>
                ) : null}
              </View>
            )}
            <Pressable
              onPress={signOut}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.signOut,
                { borderColor: c.border },
                pressed && styles.pressed,
              ]}>
              <Text style={[type.button, { color: c.danger }]}>Sign out</Text>
            </Pressable>
          </Section>

          {/* Dev builds only. The onboarded flag lives in AsyncStorage and
              survives sign-out, so without this the flow can only be
              retested by reinstalling. Clears the two answers too, so the
              flow starts from the unmatched state a new user is in. */}
          {__DEV__ ? (
            <Section title="Developer" c={c}>
              <Pressable
                onPress={async () => {
                  if (userId) await setTrainingPrefs(userId, { level: null, equipment: null });
                  await resetOnboarding();
                }}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.signOut,
                  { borderColor: c.border },
                  pressed && styles.pressed,
                ]}>
                <Text style={[type.button, { color: c.text }]}>Reset onboarding</Text>
              </Pressable>
              <Text style={[type.meta, { color: c.text2 }]}>
                Forgets that first launch ran and clears level and equipment. Keeps the
                account and its workouts.
              </Text>
            </Section>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Section({
  title,
  c,
  children,
}: {
  title: string;
  c: ReturnType<typeof useTheme>['colors'];
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={[type.label, { color: c.text3 }]}>{title}</Text>
      {children}
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
  c,
  numeral,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  c: ReturnType<typeof useTheme>['colors'];
  numeral?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? c.accentSoft : c.surface2,
          borderColor: selected ? c.accent : 'transparent',
        },
      ]}>
      <Text
        style={[
          numeral ? type.setNumeral : type.button,
          { color: selected ? c.accentText : c.text, textTransform: numeral ? undefined : 'capitalize' },
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.xl, paddingBottom: 48 },
  section: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    minWidth: 56,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.bar,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  identity: { gap: 2 },
  primary: {
    alignSelf: 'flex-start',
    borderRadius: radius.bar,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  signOut: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.bar,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  pressed: { opacity: 0.7 },
});
