import { socialInitials } from '@liftcamp/shared';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { settingsStyles } from '@/components/settings-ui';
import { Text } from '@/components/text';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

/**
 * Another person, drawn from their username only: initials in a tinted
 * circle. No photo and nothing from their auth metadata
 * (docs/social-spec.md, Avatars).
 */
export function InitialsAvatar({ username, size }: { username: string | null; size: number }) {
  const c = useColors();
  return (
    <View
      style={[styles.center, { width: size, height: size, borderRadius: size / 2, backgroundColor: c.accentSoft }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Text style={{ color: c.accentText, fontSize: Math.round(size * 0.38), fontWeight: '600' }}>
        {socialInitials(username)}
      </Text>
    </View>
  );
}

/** "@will", or a stand-in for an account with no username. */
export function handle(username: string | null): string {
  return username ? `@${username}` : 'A LiftCamp member';
}

/**
 * One person in a list: avatar, handle and an optional second line, then
 * whatever the list puts on the right (buttons), then the ⋯ menu when
 * `onMenu` is set.
 */
export function PersonRow({
  username,
  detail,
  actions,
  onMenu,
}: {
  username: string | null;
  detail?: string;
  actions?: ReactNode;
  onMenu?: () => void;
}) {
  const c = useColors();
  return (
    <View style={styles.row}>
      <InitialsAvatar username={username} size={40} />
      <View style={styles.text}>
        <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
          {handle(username)}
        </Text>
        {detail ? (
          <Text style={[type.meta, { color: c.text2 }]} numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      {actions}
      {onMenu ? (
        <Pressable
          onPress={onMenu}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`More for ${handle(username)}`}
          style={({ pressed }) => [styles.menu, pressed && settingsStyles.pressed]}>
          <SymbolView
            name={{ ios: 'ellipsis', android: 'more_horiz' }}
            size={20}
            tintColor={c.text2}
            fallback={<Text style={{ color: c.text2, fontSize: 20 }}>⋯</Text>}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

/** A small pill button for a row: filled for the main action, outlined otherwise. */
export function RowButton({
  label,
  onPress,
  primary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        primary ? { backgroundColor: c.accent } : { borderColor: c.border, borderWidth: 1 },
        (pressed || disabled) && settingsStyles.pressed,
      ]}>
      <Text style={[type.button, { fontSize: 14, color: primary ? '#FFFFFF' : c.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.card,
    paddingVertical: spacing.sm,
  },
  text: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '500' },
  menu: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  button: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    minHeight: 32,
    justifyContent: 'center',
  },
});
