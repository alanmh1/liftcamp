import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  activityBackgroundTint,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  monospacedDigit,
  multilineTextAlignment,
  opacity,
  padding,
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
 * "Rest time's up". The countdown is primary text: never accent, never gold.
 *
 * Colors. The lock screen banner follows the system appearance with the
 * Chalk tokens of each mode and sets its own background tint. The Dynamic
 * Island is always black, whatever the appearance, so its regions use
 * fixed colors: white, and white at 60% for secondary text. Plate blue is
 * 3.2:1 on black, under 4.5:1, so the island's countdown stays white.
 * Contrast: banner text 16.0:1 in both modes, banner secondary 5.6:1
 * (light) and 6.5:1 (dark); island white 21:1, island secondary 7.4:1.
 */
function WorkoutActivity(props: WorkoutActivityProps, environment: LiveActivityEnvironment) {
  'widget';
  const dark = environment.colorScheme === 'dark';
  // Lock screen: Chalk paper and graphite, with the secondary text of each mode.
  const bg = dark ? '#221F1B' : '#FDFCFB';
  const text = dark ? '#FDFCFB' : '#221F1B';
  const text2 = dark ? '#A8A29A' : '#6B655D';
  // Dynamic Island: always black, so fixed white; secondary text adds opacity(0.6).
  const island = '#FFFFFF';

  const hasSets = props.setCount > 0;
  const setLabel = hasSets ? `Set ${props.setIndex} of ${props.setCount}` : null;
  const shortLabel = hasSets ? `${props.setIndex}/${props.setCount}` : '–';
  const resting = props.restEndsAt != null;
  const restUp = resting && environment.isStale === true;

  /** The countdown, or "Rest time's up" once it passes, in `color`. */
  function rest(color: string, size: number, width?: number) {
    if (restUp) {
      return (
        <Text modifiers={[font({ size: Math.min(size, 17), weight: 'semibold' }), foregroundStyle(color), lineLimit(1)]}>
          Rest time's up
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

  const line = [setLabel, props.setLine].filter((part) => part != null).join(' · ');

  const banner = (
    <HStack modifiers={[padding({ all: 16 }), activityBackgroundTint(bg)]}>
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
  );

  return {
    banner,
    compactLeading: (
      <Text modifiers={[font({ size: 15, weight: 'semibold' }), monospacedDigit(), foregroundStyle(island)]}>
        {shortLabel}
      </Text>
    ),
    compactTrailing: resting ? (
      rest(island, 15, 48)
    ) : (
      <Text modifiers={[font({ size: 15 }), monospacedDigit(), foregroundStyle(island), lineLimit(1)]}>
        {props.setLine ?? ''}
      </Text>
    ),
    minimal: resting ? (
      rest(island, 13, 36)
    ) : (
      <Text modifiers={[font({ size: 13, weight: 'semibold' }), monospacedDigit(), foregroundStyle(island)]}>
        {shortLabel}
      </Text>
    ),
    expandedLeading: setLabel ? (
      <Text modifiers={[font({ size: 15, weight: 'semibold' }), monospacedDigit(), foregroundStyle(island)]}>
        {setLabel}
      </Text>
    ) : null,
    expandedCenter: (
      <Text modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle(island), lineLimit(1)]}>
        {props.exerciseName}
      </Text>
    ),
    expandedTrailing: resting ? (
      rest(island, 22, 80)
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
