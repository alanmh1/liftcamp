import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeOut, useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { subscribeWeekCelebration, weekCelebratedThisLaunch } from '@/components/home/week-card';
import { Text } from '@/components/text';
import { markWhatsNewSeen, shouldOfferWhatsNew, WHATS_NEW_CARD } from '@/data/whats-new';
import { EVENTS, track } from '@/lib/analytics';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, radius, spacing, type } from '@/theme/tokens';

/**
 * What's new for November 2026, once, on Home, for accounts with a workout
 * logged in the app before the cutoff (data/whats-new.ts has the rule). It
 * never shows while a workout is in progress or on a launch the week card
 * celebrates; either holds it until the next launch. Dismissing writes the
 * key first, then the card fades out and Home slides what is below it up.
 * No haptic.
 *
 * Home renders `WhatsNewSlot` keyed by the user, right after the Resume
 * card. The slot owns the seen key and the analytics, so the developer
 * preview (app/dev/whats-new.tsx) draws `WhatsNewCard` without either.
 */

export const WHATS_NEW_EXIT_MS = 180;
const BUTTON_H = 48;
const DISMISS_HIT = 44;
const ICON = 24;
/** Close to the SF Symbols the tab bar draws at its regular weight. */
const STROKE = 1.75;

// Set once a hold reason appears; cleared only by a new launch.
let heldThisLaunch = false;

function trackCard(action: 'shown' | 'dismissed' | 'import') {
  void track(EVENTS.whatsNew, { action, card: WHATS_NEW_CARD });
}

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
  const router = useRouter();
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
      if (mounted.current && !heldThisLaunch) {
        setShown(true);
        trackCard('shown');
      }
    })();
  }, [userId, workoutOpen, weekReady]);

  async function dismiss() {
    await markWhatsNewSeen();
    trackCard('dismissed');
    setShown(false);
  }

  async function openImport() {
    await markWhatsNewSeen();
    trackCard('import');
    router.push('/import?entry=whats_new');
    setShown(false);
  }

  return shown ? <WhatsNewCard onDismiss={() => void dismiss()} onImport={() => void openImport()} /> : null;
}

export function WhatsNewCard({ onDismiss, onImport }: { onDismiss: () => void; onImport: () => void }) {
  const { scheme, colors: c } = useTheme();
  const reduceMotion = useReducedMotion();
  const busy = useRef(false);

  // The card is on its way out after any tap, so only the first one counts.
  function once(fn: () => void) {
    return () => {
      if (busy.current) return;
      busy.current = true;
      fn();
    };
  }

  const gotIt = once(onDismiss);
  const importWorkouts = once(onImport);

  return (
    <Animated.View
      exiting={reduceMotion ? undefined : FadeOut.duration(WHATS_NEW_EXIT_MS)}
      style={[styles.card, cardSurface(scheme, c)]}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={[type.label, { color: c.text3 }]}>New this month</Text>
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
          icon={<ImportIcon color={c.text} />}
          title="Bring your history"
          body="Coming from Fitbod, Strong or Hevy? Your workouts and PRs come with you.">
          <Pressable
            onPress={importWorkouts}
            accessibilityRole="link"
            hitSlop={spacing.sm}
            style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
            <Text style={[type.meta, styles.linkLabel, { color: c.accentText }]}>Import workouts</Text>
            <Svg width={7} height={12} viewBox="0 0 7 12">
              <Path
                d="M1 1l5 5-5 5"
                stroke={c.accentText}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          </Pressable>
        </Row>
        <Row
          icon={<PencilIcon color={c.text} />}
          title="Fix a past workout"
          body="Open a finished workout and choose Edit to change a weight, the reps or the exercise."
        />
        <Row
          icon={<PlusCircleIcon color={c.text} />}
          title="Add your own exercises"
          body="Can't find one in the library? Tap New and make it yourself."
        />
        <Row
          icon={<SyncIcon color={c.text} />}
          title="Keep your routine current"
          body="Swapped an exercise mid-workout? Save the change to your routine when you finish."
        />
      </View>

      <Pressable
        onPress={gotIt}
        accessibilityRole="button"
        style={({ pressed }) => [styles.button, styles.outline, { borderColor: c.accent }, pressed && styles.pressed]}>
        <Text style={[type.button, { color: c.accentText }]}>Got it</Text>
      </Pressable>
    </Animated.View>
  );
}

function Row({
  icon,
  title,
  body,
  children,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  /** Under the body. Outside the accessible text, so VoiceOver can reach it. */
  children?: ReactNode;
}) {
  const { colors: c } = useTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.iconWell, { backgroundColor: c.surface2 }]}>{icon}</View>
      <View style={styles.rowContent}>
        <View style={styles.rowText} accessible accessibilityLabel={`${title}. ${body}`}>
          <Text style={[type.meta, styles.rowTitle, { color: c.text }]}>{title}</Text>
          <Text style={[type.meta, { color: c.text2 }]}>{body}</Text>
        </View>
        {children}
      </View>
    </View>
  );
}

const stroke = (color: string) =>
  ({ stroke: color, strokeWidth: STROKE, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }) as const;

/** A tray with an arrow coming down into it. */
function ImportIcon({ color }: { color: string }) {
  const s = stroke(color);
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24">
      <Path d="M4 14v4.5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V14" {...s} />
      <Line x1={12} y1={3.5} x2={12} y2={14.5} {...s} />
      <Path d="M7.5 10 12 14.5 16.5 10" {...s} />
    </Svg>
  );
}

/** A pencil, point down to the left. */
function PencilIcon({ color }: { color: string }) {
  const s = stroke(color);
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24">
      <Path d="M15.6 4.6a2.33 2.33 0 0 1 3.3 3.3L7.7 19.1l-4.25.95.95-4.25Z" {...s} />
      <Line x1={13.4} y1={6.8} x2={16.7} y2={10.1} {...s} />
    </Svg>
  );
}

/** A plus in a circle. */
function PlusCircleIcon({ color }: { color: string }) {
  const s = stroke(color);
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={8.5} {...s} />
      <Line x1={12} y1={8} x2={12} y2={16} {...s} />
      <Line x1={8} y1={12} x2={16} y2={12} {...s} />
    </Svg>
  );
}

/** Two curved arrows chasing each other. */
function SyncIcon({ color }: { color: string }) {
  const s = stroke(color);
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24">
      <Path d="M20 11a8 8 0 0 0-14.3-4L3.5 9" {...s} />
      <Path d="M3.5 4.5V9H8" {...s} />
      <Path d="M4 13a8 8 0 0 0 14.3 4l2.2-2" {...s} />
      <Path d="M20.5 19.5V15H16" {...s} />
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
  rowContent: { flex: 1, gap: spacing.xs },
  rowText: { gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  link: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: spacing.xs },
  linkLabel: { fontWeight: '600' },
  button: {
    height: BUTTON_H,
    borderRadius: radius.bar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outline: { borderWidth: 1.5 },
  pressed: { opacity: 0.8 },
});
