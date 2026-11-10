import { useState, type ReactNode } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/text';
import { EVENTS, track } from '@/lib/analytics';
import { shareImage } from '@/lib/share-image';
import { shareToInstagramStories, shareToTikTok, useShareTargets } from '@/lib/share-targets';
import { useColors } from '@/theme/theme-provider';
import { palettes, radius, spacing, type } from '@/theme/tokens';

type Target = 'system' | 'instagram' | 'tiktok';

/** Where a share started, for `share_tapped`. */
export type ShareSurface = 'summary' | 'medal' | 'streak';

/**
 * The share buttons under a card: Share (the system sheet) on its row, with
 * Instagram Stories and TikTok under it when those apps are there
 * (useShareTargets). Every button captures the card on tap, as Share always
 * has, so nothing is rendered until someone asks for it.
 */
export function ShareActions({
  surface,
  capture,
  message,
  background,
  beside,
  style,
}: {
  surface: ShareSurface;
  /** Renders the card at share size; null when that failed. */
  capture: () => Promise<string | null>;
  /** The line that goes with the image in the system sheet. */
  message: string;
  /** The Stories background, matched to the card. */
  background: string;
  /** Shares Share's row, as the guest's Create account does. */
  beside?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const targets = useShareTargets();
  const [busy, setBusy] = useState<Target | null>(null);

  async function onShare(target: Target) {
    if (busy) return;
    void track(EVENTS.shareTapped, { target, surface });
    setBusy(target);
    const uri = await capture();
    setBusy(null);
    if (!uri) {
      Alert.alert('Could not make the image.', 'Try again.');
      return;
    }
    if (target === 'system') {
      await shareImage(uri, message);
    } else if (target === 'instagram') {
      const opened = await shareToInstagramStories(uri, background).catch(() => false);
      if (!opened) Alert.alert('Could not open Instagram.', 'Try again.');
    } else {
      // Not awaited: TikTok may never come back, and the buttons must not wait.
      void shareToTikTok(uri)
        .catch(() => ({ status: 'failed' as const, errorCode: undefined, shareState: undefined }))
        .then((result) => {
          if (result.status === 'denied') {
            Alert.alert('Photos access is off.', 'TikTok opens your card from Photos. Turn access on in Settings.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Settings', onPress: () => void Linking.openSettings() },
            ]);
          } else if (result.status === 'failed') {
            const detail = __DEV__ ? `Error ${result.errorCode}, state ${result.shareState}.` : 'Try again.';
            Alert.alert('TikTok could not take the image.', detail);
          }
        });
    }
  }

  const label = (target: Target, text: string) => (busy === target ? 'Preparing…' : text);

  return (
    <View style={[styles.actions, style]}>
      <View style={styles.row}>
        <Pressable
          onPress={() => void onShare('system')}
          disabled={!!busy}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: c.accent },
            (pressed || !!busy) && styles.pressed,
          ]}>
          <Text style={[type.button, { color: palettes.light.bg }]}>{label('system', 'Share')}</Text>
        </Pressable>
        {beside}
      </View>
      {targets.instagram || targets.tiktok ? (
        <View style={styles.row}>
          {targets.instagram ? (
            <Pressable
              onPress={() => void onShare('instagram')}
              disabled={!!busy}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: c.accentSoft },
                (pressed || !!busy) && styles.pressed,
              ]}>
              <Text style={[type.button, { color: c.accentText }]} numberOfLines={1}>
                {label('instagram', 'Share on Instagram')}
              </Text>
            </Pressable>
          ) : null}
          {targets.tiktok ? (
            <Pressable
              onPress={() => void onShare('tiktok')}
              disabled={!!busy}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: c.accentSoft },
                (pressed || !!busy) && styles.pressed,
              ]}>
              <Text style={[type.button, { color: c.accentText }]} numberOfLines={1}>
                {label('tiktok', 'TikTok')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm, alignSelf: 'stretch' },
  row: { flexDirection: 'row', gap: spacing.md },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.bar,
    paddingVertical: spacing.lg,
  },
  pressed: { opacity: 0.7 },
});
