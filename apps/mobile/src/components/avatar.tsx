import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
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

/** The display name the account carries, if any. */
function metaName(meta: Meta): string | null {
  return str(meta?.full_name) ?? str(meta?.name);
}

/** Two initials from the full name, else the username's first letter. */
export function avatarInitials(meta: Meta, username: string | null): string {
  const name = metaName(meta);
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
 * load falls back to the initials too. A guest with no display name gets a
 * neutral person instead: the lifter username is generated, so its first
 * letter would read as a name the person never gave.
 */
export function Avatar({
  meta,
  username,
  size,
  guest = false,
}: {
  meta: Meta;
  username: string | null;
  size: number;
  /** An anonymous account. */
  guest?: boolean;
}) {
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
  if (guest && !metaName(meta)) {
    return (
      <View
        style={[circle, styles.center, { backgroundColor: c.accentSoft }]}
        accessible
        accessibilityRole="image"
        accessibilityLabel="Guest">
        <SymbolView
          name="person.fill"
          size={Math.round(size * 0.46)}
          tintColor={c.accentText}
          fallback={<Text style={{ color: c.accentText, fontSize: Math.round(size * 0.42) }}>👤</Text>}
        />
      </View>
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
