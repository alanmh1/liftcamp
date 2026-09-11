import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/components/auth-provider';
import { getWeeklyTarget, setWeeklyTarget, WEEKLY_TARGET_OPTIONS } from '@/data/home';
import { useTheme, THEME_SETTINGS } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

/**
 * Profile: weekly target, theme, account. Units, PR goals and the
 * consecutive-weeks streak arrive with their own specs.
 *
 * Account is a placeholder until Phase 5b: an anonymous user sees that their
 * data is on this device only, and a sign-out for testing.
 */
export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const { colors: c, setting, setSetting } = useTheme();
  const userId = session?.user.id;

  const [target, setTarget] = useState<number | null>(null);
  useEffect(() => {
    if (userId) getWeeklyTarget(userId).then(setTarget);
  }, [userId]);

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
                <Chip key={n} label={`${n}`} selected={target === n} onPress={() => pickTarget(n)} c={c} mono />
              ))}
            </View>
            <Text style={[type.meta, { color: c.text2 }]}>Workouts per week.</Text>
          </Section>

          <Section title="Theme" c={c}>
            <View style={styles.row}>
              {THEME_SETTINGS.map((s) => (
                <Chip key={s} label={s} selected={setting === s} onPress={() => setSetting(s)} c={c} />
              ))}
            </View>
          </Section>

          <Section title="Account" c={c}>
            <Text style={[type.meta, { color: c.text2 }]}>
              {session?.user.is_anonymous
                ? 'Your workouts live on this account. Sign-in arrives soon so you can keep them across devices.'
                : session?.user.email ?? 'Signed in'}
            </Text>
            <Pressable
              onPress={signOut}
              style={({ pressed }) => [
                styles.signOut,
                { borderColor: c.border },
                pressed && styles.pressed,
              ]}>
              <Text style={[type.button, { color: c.danger }]}>Sign out</Text>
            </Pressable>
          </Section>
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
  mono,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  c: ReturnType<typeof useTheme>['colors'];
  mono?: boolean;
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
          mono ? type.setNumeral : type.button,
          { color: selected ? c.accentText : c.text, textTransform: mono ? undefined : 'capitalize' },
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
  signOut: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.bar,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  pressed: { opacity: 0.7 },
});
