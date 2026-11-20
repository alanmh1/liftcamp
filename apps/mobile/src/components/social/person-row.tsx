import { socialHandle, socialInitials } from '@liftcamp/shared';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { settingsStyles } from '@/components/settings-ui';
import { Text } from '@/components/text';
import { useAvatar } from '@/lib/avatars';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

/**
 * Another person: their profile photo when they have one we may show
 * (docs/profile-photos-spec.md), over their initials in a tinted circle.
 * The initials stay underneath while the photo loads, when there is none,
 * and if it fails to load, so nothing moves when it arrives. Nothing comes
 * from their auth metadata (docs/social-spec.md, Avatars).
 *
 * `userId` looks the photo up through `useAvatars`; `url` passes one
 * already known.
 */
export function InitialsAvatar({
  username,
  size,
  userId,
  url,
}: {
  username: string | null;
  size: number;
  userId?: string | null;
  url?: string | null;
}) {
  const c = useColors();
  const looked = useAvatar(url ? null : userId);
  const photo = url ?? looked;
  const [failed, setFailed] = useState<string | null>(null);
  const circle = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View
      style={[styles.center, circle, { backgroundColor: c.accentSoft, overflow: 'hidden' }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Text style={{ color: c.accentText, fontSize: Math.round(size * 0.38), fontWeight: '600' }}>
        {socialInitials(username)}
      </Text>
      {photo && failed !== photo ? (
        <Image
          source={{ uri: photo }}
          style={[StyleSheet.absoluteFill, circle]}
          contentFit="cover"
          transition={150}
          onError={() => setFailed(photo)}
          accessibilityIgnoresInvertColors
        />
      ) : null}
    </View>
  );
}

/** "@will", or a stand-in for an account with no username. */
export function handle(username: string | null): string {
  return socialHandle(username);
}

/**
 * One person in a list: avatar, handle and an optional second line, then
 * whatever the list puts on the right (buttons), then the ⋯ menu when
 * `onMenu` is set. With `onPress`, the avatar and text open something
 * (their profile, or what the row is about); the buttons keep their own
 * taps.
 */
export function PersonRow({
  username,
  userId,
  detail,
  actions,
  onMenu,
  onPress,
  pressHint,
}: {
  username: string | null;
  /** Looks up their photo; initials without it. */
  userId?: string | null;
  detail?: string;
  actions?: ReactNode;
  onMenu?: () => void;
  onPress?: () => void;
  pressHint?: string;
}) {
  const c = useColors();
  const who = (
    <>
      <InitialsAvatar username={username} userId={userId} size={40} />
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
    </>
  );
  return (
    <View style={styles.row}>
      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityHint={pressHint ?? 'Opens their profile'}
          style={({ pressed }) => [styles.who, pressed && settingsStyles.pressed]}>
          {who}
        </Pressable>
      ) : (
        who
      )}
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
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
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
