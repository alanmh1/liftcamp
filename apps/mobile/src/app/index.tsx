import { CANONICAL_MUSCLES } from '@liftcamp/shared';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/components/auth-provider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { runRlsCheck, type RlsCheck } from '@/lib/rls-check';

/** Plate blue, from the Chalk design system. */
const ACCENT = '#1B5FA8';

/**
 * Phase 5a smoke screen. It proves three things: Metro resolves
 * `@liftcamp/shared`, the anonymous session reaches the client, and RLS lets
 * that session write and read its own row. Replaced by the active workout
 * screen in Phase 6.
 */
export default function HomeScreen() {
  const { session, signOut } = useAuth();
  const [check, setCheck] = useState<RlsCheck>({ status: 'running' });

  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setCheck({ status: 'running' });
    runRlsCheck(userId).then((result) => {
      if (!cancelled) setCheck(result);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <ThemedView style={styles.headerText}>
            <ThemedText type="title">Signed in</ThemedText>
            <ThemedText type="code" style={styles.userId}>
              {userId ?? 'no session'}
            </ThemedText>
            {session?.user.is_anonymous ? (
              <ThemedText type="small">anonymous account</ThemedText>
            ) : null}
          </ThemedView>
          <Pressable
            accessibilityRole="button"
            onPress={signOut}
            style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}>
            <Text style={styles.signOutLabel}>Sign out</Text>
          </Pressable>
        </ThemedView>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <ThemedView type="backgroundElement" style={styles.panel}>
            <ThemedText type="smallBold">RLS check</ThemedText>
            {check.status === 'running' ? (
              <ThemedText type="small">running…</ThemedText>
            ) : (
              check.lines.map((line) => (
                <ThemedText
                  key={line}
                  type="small"
                  style={check.status === 'failed' ? styles.error : undefined}>
                  {check.status === 'failed' ? '✗ ' : '✓ '}
                  {line}
                </ThemedText>
              ))
            )}
          </ThemedView>

          <ThemedText type="smallBold">
            {CANONICAL_MUSCLES.length} canonical muscles, from @liftcamp/shared
          </ThemedText>

          {CANONICAL_MUSCLES.map((muscle, i) => (
            <ThemedView key={muscle} type="backgroundElement" style={styles.row}>
              <ThemedText type="code" style={styles.index}>
                {String(i + 1).padStart(2, '0')}
              </ThemedText>
              <ThemedText>{muscle}</ThemedText>
            </ThemedView>
          ))}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  headerText: {
    flexShrink: 1,
    gap: Spacing.one,
  },
  userId: {
    fontSize: 11,
  },
  signOut: {
    borderColor: ACCENT,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  signOutLabel: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
  scroll: {
    alignSelf: 'stretch',
  },
  scrollContent: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  panel: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  index: {
    minWidth: 28,
  },
  error: {
    color: '#B3261E',
  },
});
