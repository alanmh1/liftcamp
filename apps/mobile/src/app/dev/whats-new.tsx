import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { WhatsNewCard } from '@/components/home/whats-new-card';
import { Chip } from '@/components/settings-ui';
import { Text } from '@/components/text';
import { scrollInsetProps } from '@/lib/scroll-insets';
import { ThemeOverride, useTheme } from '@/theme/theme-provider';
import { radius, spacing, type, type ColorScheme } from '@/theme/tokens';

/**
 * Dev builds only: the What's new card on its own, whatever the account's
 * eligibility. Its buttons behave as on Home, without the seen key or the
 * analytics, which belong to `WhatsNewSlot`. Reached from Settings →
 * Developer; a production build redirects to Home.
 */
export default function WhatsNewPreview() {
  const app = useTheme();
  const [scheme, setScheme] = useState<ColorScheme>(app.scheme);
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <ThemeOverride scheme={scheme}>
      <Preview scheme={scheme} setScheme={setScheme} />
    </ThemeOverride>
  );
}

function Preview({ scheme, setScheme }: { scheme: ColorScheme; setScheme: (s: ColorScheme) => void }) {
  const { colors: c } = useTheme();
  const router = useRouter();
  const [shown, setShown] = useState(true);
  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content} {...scrollInsetProps}>
        <View style={styles.row}>
          <Chip label="Light" selected={scheme === 'light'} onPress={() => setScheme('light')} c={c} />
          <Chip label="Dark" selected={scheme === 'dark'} onPress={() => setScheme('dark')} c={c} />
        </View>
        {shown ? (
          <WhatsNewCard
            onDismiss={() => setShown(false)}
            onImport={() => {
              router.push('/import?entry=whats_new');
              setShown(false);
            }}
          />
        ) : (
          <Pressable
            onPress={() => setShown(true)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.again, { borderColor: c.border }, pressed && styles.pressed]}>
            <Text style={[type.button, { color: c.accentText }]}>Show the card again</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  again: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.bar,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  pressed: { opacity: 0.7 },
});
