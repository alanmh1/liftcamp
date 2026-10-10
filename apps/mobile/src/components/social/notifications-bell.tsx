import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { useNavHref } from '@/components/tab-layout';
import { Text } from '@/components/text';
import { useInbox } from '@/lib/inbox';
import { useColors } from '@/theme/theme-provider';

/**
 * Home's bell, a plain icon left of the "+ Workout" or "Resume" pill, drawn
 * only with social on. Opens the inbox. The dot shows while anything in it
 * is newer than this device last saw (lib/inbox.ts). It replaces the
 * Profile tab's badge and Home's requests line.
 */
export function NotificationsBell() {
  const c = useColors();
  const router = useRouter();
  const navHref = useNavHref();
  const { session } = useAuth();
  const { unseen } = useInbox(session?.user.id ?? null);

  return (
    <Pressable
      onPress={() => router.push(navHref({ kind: 'inbox' }))}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={unseen ? 'Notifications, new' : 'Notifications'}
      style={({ pressed }) => [styles.bell, pressed && styles.pressed]}>
      <SymbolView
        name={{ ios: 'bell', android: 'notifications' }}
        size={24}
        tintColor={c.text}
        fallback={<Text style={{ color: c.text, fontSize: 20 }}>🔔</Text>}
      />
      {unseen ? <View style={[styles.dot, { backgroundColor: c.accent, borderColor: c.bg }]} /> : null}
    </Pressable>
  );
}

const DOT = 10;

const styles = StyleSheet.create({
  bell: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  dot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
  },
  pressed: { opacity: 0.6 },
});
