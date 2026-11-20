import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Text } from '@/components/text';
import { EVENTS, track } from '@/lib/analytics';
import { shareImage } from '@/lib/share-image';
import { shareToInstagramStories, shareToTikTok, useShareTargets } from '@/lib/share-targets';
import { useColors } from '@/theme/theme-provider';
import { palettes, radius, spacing } from '@/theme/tokens';

type Target = 'system' | 'instagram' | 'tiktok';

/** Where a share started, for `share_tapped`. */
export type ShareSurface = 'summary' | 'medal' | 'streak';

/** The round buttons a surface can offer, in the row's order. */
export type ShareButton = 'background' | 'stories' | 'tiktok' | 'copy' | 'more';

const ORDER: readonly ShareButton[] = ['background', 'stories', 'tiktok', 'copy', 'more'];

/** The circle's edge. */
const BUTTON = 56;
const ICON = 24;
/** How long "Workout copied" stays up. */
const TOAST_MS = 1500;

/**
 * One row of round buttons with a label under each (docs/summary-prs-spec.md,
 * section 5), in this order when offered: Background, Stories, TikTok, Copy
 * text, More.
 *
 * - Background toggles the card between light and dark (`cardBackground`).
 * - Stories sends the card to Instagram Stories, when Instagram is there
 *   (useShareTargets, iOS only).
 * - TikTok, when the app and the tiktok_share flag allow it.
 * - Copy text copies `copyText()` and shows "Workout copied".
 * - More is the system share sheet with the card and `message`.
 *
 * Every image button captures the card on tap, so nothing is rendered until
 * someone asks for it, and shows a spinner in its circle while it does.
 * `buttons` names the ones a surface wants; a button whose prop or target
 * is missing is left out.
 */
export function ShareActions({
  surface,
  buttons,
  capture,
  message,
  background,
  cardBackground,
  copyText,
  style,
}: {
  surface: ShareSurface;
  buttons: readonly ShareButton[];
  /** Renders the card at share size; null when that failed. */
  capture: () => Promise<string | null>;
  /** The line that goes with the image in the system sheet. */
  message: string;
  /** The Stories background, matched to the card. */
  background: string;
  /** For Background: the card's color now, its label, and the toggle. */
  cardBackground?: { color: string; label: string; onToggle: () => void };
  /** For Copy text: the workout as text. */
  copyText?: () => string;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const targets = useShareTargets();
  const [busy, setBusy] = useState<Target | null>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );

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

  async function onCopy() {
    if (!copyText) return;
    void track(EVENTS.shareTapped, { target: 'copy', surface });
    try {
      await Clipboard.setStringAsync(copyText());
    } catch {
      Alert.alert('Could not copy the workout.', 'Try again.');
      return;
    }
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), TOAST_MS);
  }

  const offered = (b: ShareButton): boolean => {
    if (!buttons.includes(b)) return false;
    if (b === 'background') return !!cardBackground;
    if (b === 'stories') return targets.instagram;
    if (b === 'tiktok') return targets.tiktok;
    if (b === 'copy') return !!copyText;
    return true;
  };
  const shown = ORDER.filter(offered);

  const item = (b: ShareButton) => {
    switch (b) {
      case 'background':
        return (
          <RoundButton
            key={b}
            label={cardBackground!.label}
            accessibilityLabel={`Card background, ${cardBackground!.label}`}
            fill={cardBackground!.color}
            edge={c.border}
            onPress={cardBackground!.onToggle}
            disabled={!!busy}>
            <LinesIcon color={c.text2} />
          </RoundButton>
        );
      case 'stories':
        return (
          <RoundButton
            key={b}
            label="Stories"
            accessibilityLabel="Share to Instagram Stories"
            background={<InstagramCircle />}
            busy={busy === 'instagram'}
            spinner={palettes.light.bg}
            onPress={() => void onShare('instagram')}
            disabled={!!busy}>
            <InstagramIcon />
          </RoundButton>
        );
      case 'tiktok':
        return (
          <RoundButton
            key={b}
            label="TikTok"
            accessibilityLabel="Share to TikTok"
            fill={palettes.light.text}
            busy={busy === 'tiktok'}
            spinner={palettes.light.bg}
            onPress={() => void onShare('tiktok')}
            disabled={!!busy}>
            <TikTokIcon />
          </RoundButton>
        );
      case 'copy':
        return (
          <RoundButton key={b} label="Copy text" fill={c.surface2} onPress={() => void onCopy()} disabled={!!busy}>
            <CopyIcon color={c.text} />
          </RoundButton>
        );
      case 'more':
        return (
          <RoundButton
            key={b}
            label="More"
            accessibilityLabel="More ways to share"
            fill={c.accent}
            busy={busy === 'system'}
            spinner={palettes.light.bg}
            onPress={() => void onShare('system')}
            disabled={!!busy}>
            <ShareIcon color={palettes.light.bg} />
          </RoundButton>
        );
    }
  };

  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.row, shown.length < 4 && styles.rowFew]}>{shown.map(item)}</View>
      {copied ? (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(250)}
          pointerEvents="none"
          style={[styles.toast, { backgroundColor: c.text }]}
          accessibilityLiveRegion="polite">
          <Text style={[styles.toastText, { color: c.bg }]}>Workout copied</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

function RoundButton({
  label,
  accessibilityLabel,
  fill,
  edge,
  background,
  busy = false,
  spinner,
  disabled,
  onPress,
  children,
}: {
  label: string;
  accessibilityLabel?: string;
  fill?: string;
  /** A hairline ring, for a fill that could match the screen. */
  edge?: string;
  /** Drawn behind the icon instead of a flat fill. */
  background?: ReactNode;
  busy?: boolean;
  spinner?: string;
  disabled?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ busy, disabled }}
      style={({ pressed }) => [styles.item, (pressed || (disabled && !busy)) && styles.pressed]}>
      <View
        style={[
          styles.circle,
          fill ? { backgroundColor: fill } : null,
          edge ? { borderWidth: StyleSheet.hairlineWidth, borderColor: edge } : null,
        ]}>
        {background ? <View style={StyleSheet.absoluteFill}>{background}</View> : null}
        {busy ? <ActivityIndicator color={spinner ?? c.text} /> : children}
      </View>
      <Text style={[styles.label, { color: c.text2 }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Diagonal lines, the Background button's mark. */
function LinesIcon({ color }: { color: string }) {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24">
      {[0, 6, 12].map((o) => (
        <Line key={o} x1={2 + o} y1={22} x2={12 + o} y2={2} stroke={color} strokeWidth={2} strokeLinecap="round" />
      ))}
    </Svg>
  );
}

/** Instagram's gradient, as a filled circle the size of the button. */
function InstagramCircle() {
  return (
    <Svg width={BUTTON} height={BUTTON} viewBox="0 0 56 56">
      <Defs>
        <RadialGradient id="ig" cx="30%" cy="107%" r="150%" fx="30%" fy="107%">
          <Stop offset="0" stopColor="#FDF497" />
          <Stop offset="0.05" stopColor="#FDF497" />
          <Stop offset="0.45" stopColor="#FD5949" />
          <Stop offset="0.6" stopColor="#D6249F" />
          <Stop offset="0.9" stopColor="#285AEB" />
        </RadialGradient>
      </Defs>
      <Circle cx={28} cy={28} r={28} fill="url(#ig)" />
    </Svg>
  );
}

function InstagramIcon() {
  const white = '#FFFFFF';
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24">
      <Rect x={3} y={3} width={18} height={18} rx={5.5} stroke={white} strokeWidth={2} fill="none" />
      <Circle cx={12} cy={12} r={4.2} stroke={white} strokeWidth={2} fill="none" />
      <Circle cx={17.3} cy={6.7} r={1.2} fill={white} />
    </Svg>
  );
}

function TikTokIcon() {
  return (
    <Svg width={ICON - 2} height={ICON - 2} viewBox="0 0 24 24">
      <Path
        fill="#FFFFFF"
        d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"
      />
    </Svg>
  );
}

function CopyIcon({ color }: { color: string }) {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24" fill="none">
      <Rect x={8} y={8} width={12} height={13} rx={2.5} stroke={color} strokeWidth={2} />
      <Path d="M16 5.5V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function ShareIcon({ color }: { color: string }) {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24" fill="none">
      <Path d="M12 14V3M7.5 7.5 12 3l4.5 4.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8 10.5H6.5a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-6.5a2 2 0 0 0-2-2H16" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  // Two or three buttons sit together in the middle instead of at the edges.
  rowFew: { justifyContent: 'center', gap: spacing.xl },
  item: { alignItems: 'center', gap: spacing.xs, minWidth: 64 },
  circle: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 13, fontWeight: '500' },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    top: -44,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  toastText: { fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
