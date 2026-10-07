import { HStack, Image, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  activityBackgroundTint,
  clipShape,
  clipped,
  font,
  foregroundStyle,
  frame,
  labelsHidden,
  lineLimit,
  monospacedDigit,
  multilineTextAlignment,
  opacity,
  padding,
  progressViewStyle,
  resizable,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

// Type only: at runtime on iOS this path is this file.
import type { WorkoutActivityProps } from './workout-activity';

/**
 * The lock screen banner and the Dynamic Island.
 *
 * The 'widget' directive turns this function into a string that the widget
 * extension evaluates in its own JS runtime, where every @expo/ui SwiftUI
 * view and modifier is a global. So it may use nothing from outside its own
 * body: the Chalk colors and the helpers are written inline here. The
 * imports above are for types and for the app's typecheck only.
 *
 * The rest countdown is a SwiftUI timer text, so it runs with the app
 * suspended. Once the rest's end passes, the system marks the activity
 * stale (staleDate is the rest's end) and the countdown's place reads
 * "Rest time's up". On the lock screen the countdown is primary text; in
 * the compact island it is the island accent. Never gold.
 *
 * During a rest the banner shows the set coming up (setLine arrives as
 * "135 lbs × 12 · Up next · set 3 of 3") and a thin bar along its bottom
 * that empties as the rest runs down. The bar is a SwiftUI timer progress
 * view, so like the countdown it moves with the app closed. Its built-in
 * time label is hidden (labelsHidden, then clipped to the bar's height in
 * case a label still draws below it).
 *
 * The island's leading views start with the app icon, 18 pt compact and
 * 22 pt expanded, with the iOS icon's corner rounding. It is read from the
 * app group container by path (props.iconUri), so it is not bundled in the
 * extension; with no path it is left out.
 *
 * Colors. The lock screen banner follows the system appearance with the
 * Chalk tokens of each mode and sets its own background tint. The Dynamic
 * Island is always black, whatever the appearance, so its regions use
 * fixed colors: white, and white at 60% for secondary text. The compact
 * and minimal rest countdowns, and the "Go" that replaces the countdown in
 * every island view once the rest is up, are #7FB0EE, the dark mode's
 * accent text color: 9.35:1 on black (plate blue itself is 3.2:1). The
 * expanded countdown stays white. "Rest time's up" is too wide for the
 * island; the lock screen keeps it.
 * Contrast: banner text 16.0:1 in both modes, banner secondary 5.6:1
 * (light) and 6.5:1 (dark); island white 21:1, island secondary 7.4:1.
 * The rest bar is plate blue on paper (6.3:1) and #7FB0EE on graphite
 * (7.3:1).
 */
function WorkoutActivity(props: WorkoutActivityProps, environment: LiveActivityEnvironment) {
  'widget';
  const dark = environment.colorScheme === 'dark';
  // Lock screen: Chalk paper and graphite, with the secondary text of each mode.
  const bg = dark ? '#221F1B' : '#FDFCFB';
  const text = dark ? '#FDFCFB' : '#221F1B';
  const text2 = dark ? '#A8A29A' : '#6B655D';
  // The rest bar: Chalk accent, and the dark mode's accent text color.
  const accent = dark ? '#7FB0EE' : '#1B5FA8';
  // Dynamic Island: always black, so fixed white; secondary text adds opacity(0.6).
  const island = '#FFFFFF';
  // The island accent: Chalk's dark-mode accent text color, 9.35:1 on black.
  const islandAccent = '#7FB0EE';

  const hasSets = props.setCount > 0;
  const setLabel = hasSets ? `Set ${props.setIndex} of ${props.setCount}` : null;
  const shortLabel = hasSets ? `${props.setIndex}/${props.setCount}` : '–';
  const resting = props.restEndsAt != null;
  const restUp = resting && environment.isStale === true;

  /** The app icon at `size` points, or null without one. */
  function icon(size: number) {
    if (!props.iconUri) return null;
    return (
      <Image
        uiImage={props.iconUri}
        modifiers={[resizable(), frame({ width: size, height: size }), clipShape('roundedRectangle', size * 0.2237)]}
      />
    );
  }

  /** The countdown in `color`, or `upLabel` in `upColor` once it passes. */
  function rest(color: string, size: number, width?: number, upLabel = "Rest time's up", upColor = color) {
    if (restUp) {
      return (
        <Text modifiers={[font({ size: Math.min(size, 17), weight: 'semibold' }), foregroundStyle(upColor), lineLimit(1)]}>
          {upLabel}
        </Text>
      );
    }
    return (
      <Text
        timerInterval={{ lower: new Date(), upper: new Date(props.restEndsAt as number) }}
        countsDown
        modifiers={[
          font({ size, weight: 'semibold' }),
          monospacedDigit(),
          foregroundStyle(color),
          multilineTextAlignment('trailing'),
          ...(width != null ? [frame({ width })] : []),
        ]}
      />
    );
  }

  // An up-next line carries its own set number.
  const line = props.upNext ? props.setLine : [setLabel, props.setLine].filter((part) => part != null).join(' · ');
  const bar = resting && !restUp && props.restStartsAt != null;

  const banner = (
    <VStack spacing={0} modifiers={[activityBackgroundTint(bg)]}>
      <HStack modifiers={[padding(bar ? { top: 16, leading: 16, trailing: 16, bottom: 12 } : { all: 16 })]}>
        <VStack alignment="leading" spacing={4}>
          <Text modifiers={[font({ size: 17, weight: 'semibold' }), foregroundStyle(text), lineLimit(1)]}>
            {props.exerciseName}
          </Text>
          {line ? (
            <Text modifiers={[font({ size: 15 }), monospacedDigit(), foregroundStyle(text2), lineLimit(1)]}>{line}</Text>
          ) : null}
        </VStack>
        <Spacer />
        {resting ? (
          rest(text, 34, 110)
        ) : props.lastLine && !props.lastLineRepeats ? (
          <Text modifiers={[font({ size: 15 }), monospacedDigit(), foregroundStyle(text2), lineLimit(1)]}>
            {props.lastLine}
          </Text>
        ) : null}
      </HStack>
      {bar ? (
        <ProgressView
          timerInterval={{ lower: new Date(props.restStartsAt as number), upper: new Date(props.restEndsAt as number) }}
          countsDown
          modifiers={[
            progressViewStyle('linear'),
            tint(accent),
            labelsHidden(),
            frame({ height: 4 }),
            clipped(),
            padding({ leading: 16, trailing: 16, bottom: 12 }),
          ]}
        />
      ) : null}
    </VStack>
  );

  return {
    banner,
    compactLeading: (
      <HStack spacing={4}>
        {icon(18)}
        {resting ? (
          <Text modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle(island), opacity(0.6)]}>Rest</Text>
        ) : (
          <Text modifiers={[font({ size: 15, weight: 'semibold' }), monospacedDigit(), foregroundStyle(island)]}>
            {shortLabel}
          </Text>
        )}
      </HStack>
    ),
    compactTrailing: resting ? (
      rest(islandAccent, 15, 48, 'Go')
    ) : (
      <Text modifiers={[font({ size: 15 }), monospacedDigit(), foregroundStyle(island), lineLimit(1)]}>
        {props.setLine ?? ''}
      </Text>
    ),
    minimal: resting ? (
      rest(islandAccent, 13, 36, 'Go')
    ) : (
      <Text modifiers={[font({ size: 13, weight: 'semibold' }), monospacedDigit(), foregroundStyle(island)]}>
        {shortLabel}
      </Text>
    ),
    expandedLeading: (
      <HStack spacing={6}>
        {icon(22)}
        {setLabel ? (
          <Text modifiers={[font({ size: 15, weight: 'semibold' }), monospacedDigit(), foregroundStyle(island)]}>
            {setLabel}
          </Text>
        ) : null}
      </HStack>
    ),
    expandedCenter: (
      <Text modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle(island), lineLimit(1)]}>
        {props.exerciseName}
      </Text>
    ),
    expandedTrailing: resting ? (
      rest(island, 22, 80, 'Go', islandAccent)
    ) : (
      <Text modifiers={[font({ size: 15 }), monospacedDigit(), foregroundStyle(island), lineLimit(1)]}>
        {props.setLine ?? ''}
      </Text>
    ),
    expandedBottom: props.lastLine ? (
      <Text modifiers={[font({ size: 15 }), monospacedDigit(), foregroundStyle(island), opacity(0.6), lineLimit(1)]}>
        {props.lastLine}
      </Text>
    ) : null,
  };
}

/** Registers the layout with the widget extension on creation. */
export const workoutActivity = createLiveActivity<WorkoutActivityProps>('WorkoutActivity', WorkoutActivity);
