import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeOut, useReducedMotion } from 'react-native-reanimated';
import Svg, { Line, Path, Rect } from 'react-native-svg';

import { subscribeWeekCelebration, weekCelebratedThisLaunch } from '@/components/home/week-card';
import { Text } from '@/components/text';
import { markWhatsNewSeen, shouldOfferWhatsNew } from '@/data/whats-new';
import { ensureRestAlertPermission } from '@/lib/rest-alert';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, radius, spacing, type } from '@/theme/tokens';

/**
 * What's new in 1.1, once, on Home, for iOS users who logged a workout on
 * 1.0 (data/whats-new.ts has the rule). It never shows while a workout is
 * in progress or on a launch the week card celebrates; either holds it
 * until the next launch. Dismissing writes the key first, then the card
 * fades out and Home slides what is below it up. No haptic.
 *
 * Home renders `WhatsNewSlot` keyed by the user, right after the Resume
 * card.
 */

export const WHATS_NEW_EXIT_MS = 180;
const BUTTON_H = 48;
const DISMISS_HIT = 44;
const ICON = 24;
/** Close to the SF Symbols the tab bar draws at its regular weight. */
const STROKE = 1.75;

// Set once a hold reason appears; cleared only by a new launch.
let heldThisLaunch = false;

export function WhatsNewSlot({
  userId,
  workoutOpen,
  weekReady,
  onShownChange,
}: {
  userId: string;
  /** Undefined until Home knows; true while a workout is in progress. */
  workoutOpen: boolean | undefined;
  /** The week card is drawn, so its celebration check has started. */
  weekReady: boolean;
  /** When the card appears and goes, so Home can animate what is below it. */
  onShownChange?: (shown: boolean) => void;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    onShownChange?.(shown);
  }, [shown, onShownChange]);
  // One offer per mount; the slot is keyed by the user.
  const offered = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // A workout in progress or the week's celebration, now or later this
  // launch, holds the card until the next one.
  if (workoutOpen && shown) setShown(false);
  useEffect(() => {
    if (workoutOpen) heldThisLaunch = true;
  }, [workoutOpen]);
  useEffect(
    () =>
      subscribeWeekCelebration(() => {
        heldThisLaunch = true;
        setShown(false);
      }),
    [],
  );

  useEffect(() => {
    if (offered.current || heldThisLaunch || workoutOpen !== false || !weekReady) return;
    offered.current = true;
    void (async () => {
      if (!(await shouldOfferWhatsNew(userId))) return;
      // After the read, so the week card's check for this launch has run.
      if (await weekCelebratedThisLaunch()) heldThisLaunch = true;
      if (mounted.current && !heldThisLaunch) setShown(true);
    })();
  }, [userId, workoutOpen, weekReady]);

  async function dismiss() {
    await markWhatsNewSeen();
    setShown(false);
  }

  return shown ? <WhatsNewCard onDismiss={() => void dismiss()} /> : null;
}

type Permission = Notifications.PermissionStatus | 'unknown';

export function WhatsNewCard({ onDismiss }: { onDismiss: () => void }) {
  const { scheme, colors: c } = useTheme();
  const reduceMotion = useReducedMotion();
  const busy = useRef(false);

  // Read once, when the card mounts. The button's place is held until then.
  const [permission, setPermission] = useState<Permission | null>(null);
  useEffect(() => {
    let live = true;
    Notifications.getPermissionsAsync().then(
      (p) => {
        if (live) setPermission(p.status);
      },
      () => {
        if (live) setPermission('unknown');
      },
    );
    return () => {
      live = false;
    };
  }, []);

  function once(fn: () => Promise<void> | void) {
    return async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        await fn();
      } catch {
        // The card goes either way.
      }
      onDismiss();
    };
  }

  const turnOn = once(() => ensureRestAlertPermission());
  const openSettings = once(() => Linking.openSettings());
  const gotIt = once(() => {});

  const undetermined = permission === Notifications.PermissionStatus.UNDETERMINED;
  const denied = permission === Notifications.PermissionStatus.DENIED;

  return (
    <Animated.View
      exiting={reduceMotion ? undefined : FadeOut.duration(WHATS_NEW_EXIT_MS)}
      style={[styles.card, cardSurface(scheme, c)]}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={[type.label, { color: c.text3 }]}>New in 1.1</Text>
          <Text style={[type.exerciseName, { color: c.text }]} accessibilityRole="header">
            {"What's new in LiftCamp"}
          </Text>
        </View>
        <Pressable
          onPress={gotIt}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}>
          <Svg width={14} height={14} viewBox="0 0 14 14">
            <Path d="M2 2l10 10M12 2L2 12" stroke={c.text3} strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </Pressable>
      </View>

      <View style={styles.rows}>
        <Row
          icon={<TabBarIcon color={c.text} />}
          title="A simpler tab bar"
          body="History now lives in Profile. Routines and the Exercise library are under Workout."
        />
        <Row
          icon={<PhoneIcon color={c.text} />}
          title="Rest alerts on your lock screen"
          body="Your workout shows on the lock screen, and you'll get a buzz when rest is up, even with your phone in your pocket."
        />
      </View>

      {permission == null ? (
        <View style={styles.button} />
      ) : undetermined ? (
        <Pressable
          onPress={turnOn}
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, { backgroundColor: c.accent }, pressed && styles.pressed]}>
          <Text style={[type.button, styles.filledLabel]}>Turn on rest alerts</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={denied ? openSettings : gotIt}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.button,
            styles.outline,
            { borderColor: c.accent },
            pressed && styles.pressed,
          ]}>
          <Text style={[type.button, { color: c.accentText }]}>{denied ? 'Open Settings' : 'Got it'}</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

function Row({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  const { colors: c } = useTheme();
  return (
    <View style={styles.row} accessible accessibilityLabel={`${title}. ${body}`}>
      <View style={[styles.iconWell, { backgroundColor: c.surface2 }]}>{icon}</View>
      <View style={styles.rowText}>
        <Text style={[type.meta, styles.rowTitle, { color: c.text }]}>{title}</Text>
        <Text style={[type.meta, { color: c.text2 }]}>{body}</Text>
      </View>
    </View>
  );
}

const stroke = (color: string) =>
  ({ stroke: color, strokeWidth: STROKE, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }) as const;

/** A screen with its tab bar: a divider near the bottom and three tabs. */
function TabBarIcon({ color }: { color: string }) {
  const s = stroke(color);
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24">
      <Rect x={3.5} y={3.5} width={17} height={17} rx={3.5} {...s} />
      <Line x1={3.5} y1={15} x2={20.5} y2={15} {...s} />
      <Line x1={8} y1={17.75} x2={8} y2={17.75} {...s} strokeWidth={2.25} />
      <Line x1={12} y1={17.75} x2={12} y2={17.75} {...s} strokeWidth={2.25} />
      <Line x1={16} y1={17.75} x2={16} y2={17.75} {...s} strokeWidth={2.25} />
    </Svg>
  );
}

/** A phone with a notification on its lock screen. */
function PhoneIcon({ color }: { color: string }) {
  const s = stroke(color);
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24">
      <Rect x={6} y={2.5} width={12} height={19} rx={2.75} {...s} />
      <Rect x={8.5} y={7} width={7} height={3.5} rx={1.25} {...s} />
      <Line x1={10.5} y1={18.5} x2={13.5} y2={18.5} {...s} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    padding: spacing.card,
    gap: spacing.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headText: { flex: 1, gap: spacing.xs },
  // 44 pt to tap, pulled into the card's corner so the glyph sits on the
  // padding line.
  dismiss: {
    width: DISMISS_HIT,
    height: DISMISS_HIT,
    marginTop: -spacing.md,
    marginRight: -spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rows: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  iconWell: {
    width: 40,
    height: 40,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  button: {
    height: BUTTON_H,
    borderRadius: radius.bar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outline: { borderWidth: 1.5 },
  filledLabel: { color: '#FFFFFF' },
  pressed: { opacity: 0.8 },
});
