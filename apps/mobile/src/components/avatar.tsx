import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useColors } from '@/theme/theme-provider';

type Meta = Record<string, unknown> | undefined;

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/**
 * The account's photo, from Google's `avatar_url` then `picture`. Apple
 * does not share a photo, so Apple, email and guest accounts get initials.
 */
export function avatarUrl(meta: Meta): string | null {
  return str(meta?.avatar_url) ?? str(meta?.picture);
}

/** Two initials from the full name, else the username's first letter. */
export function avatarInitials(meta: Meta, username: string | null): string {
  const name = str(meta?.full_name) ?? str(meta?.name);
  if (name) {
    return name
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
  return username?.[0]?.toUpperCase() ?? '';
}

/**
 * A circular photo, or initials in a tinted circle. A photo that fails to
 * load falls back to the initials too.
 */
export function Avatar({ meta, username, size }: { meta: Meta; username: string | null; size: number }) {
  const c = useColors();
  const url = avatarUrl(meta);
  const [failed, setFailed] = useState(false);
  const circle = { width: size, height: size, borderRadius: size / 2 };

  if (url && !failed) {
    return (
      <Image
        source={{ uri: url }}
        style={[circle, { backgroundColor: c.accentSoft }]}
        contentFit="cover"
        transition={150}
        onError={() => setFailed(true)}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={[circle, styles.center, { backgroundColor: c.accentSoft }]}>
      <Text style={{ color: c.accentText, fontSize: Math.round(size * 0.38), fontWeight: '600' }}>
        {avatarInitials(meta, username)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
