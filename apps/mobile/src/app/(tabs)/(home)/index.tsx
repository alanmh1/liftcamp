import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/components/auth-provider';
import { startAdHocWorkout } from '@/data/workouts';
import { useTheme } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

export default function HomeScreen() {
  const { session, signOut } = useAuth();
  const { colors: c, setting, setSetting } = useTheme();
  const router = useRouter();
  const [starting, setStarting] = useState(false);

  async function onStart() {
    if (!session) return;
    setStarting(true);
    const id = await startAdHocWorkout(session.user.id);
    setStarting(false);
    if (id) router.push({ pathname: '/workout/[id]', params: { id } });
  }

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.top}>
          <Text style={[type.screenTitle, { color: c.text }]}>LiftCamp</Text>
          <Pressable onPress={signOut} hitSlop={8}>
            <Text style={[type.meta, { color: c.text2 }]}>Sign out</Text>
          </Pressable>
        </View>

        <View style={styles.center}>
          <Pressable
            onPress={() => void onStart()}
            disabled={starting}
            style={({ pressed }) => [
              styles.start,
              { backgroundColor: c.accent },
              pressed && styles.pressed,
            ]}>
            {starting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={[type.button, styles.startLabel]}>Start workout</Text>
            )}
          </Pressable>
        </View>

        {/* Theme setting. It belongs in a settings screen; it lives here until
            there is one. */}
        <View style={styles.themeRow}>
          {(['light', 'dark', 'auto'] as const).map((s) => (
            <Pressable
              key={s}
              onPress={() => setSetting(s)}
              style={[
                styles.themeChip,
                {
                  backgroundColor: setting === s ? c.accentSoft : c.surface2,
                  borderColor: setting === s ? c.accent : 'transparent',
                },
              ]}>
              <Text style={[type.label, { color: setting === s ? c.accentText : c.text2 }]}>
                {s}
              </Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: spacing.screen },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  center: { flex: 1, justifyContent: 'center' },
  start: {
    borderRadius: radius.bar,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  startLabel: { color: '#FFFFFF', fontSize: 17 },
  pressed: { opacity: 0.8 },
  themeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    paddingBottom: spacing.lg,
  },
  themeChip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
});
