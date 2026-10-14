import type { LiveActivityFactory } from 'expo-widgets';

/**
 * What the workout's Live Activity shows. Everything is formatted on the
 * app side (lib/live-activity), so the layout does no unit logic.
 */
export type WorkoutActivityProps = {
  workoutId: string;
  exerciseName: string;
  /** 1-based; 0 when the exercise has no sets. */
  setIndex: number;
  setCount: number;
  /**
   * "90 lbs × 8", "BW × 12"; null with nothing typed and no last session.
   * During a rest, the set coming up (with `upNext`).
   */
  setLine: string | null;
  /** During a rest: the set and exercise are the ones coming up, and the banner says "UP NEXT". */
  upNext?: boolean;
  /** "Last time 85 × 8"; null for a first session. */
  lastLine: string | null;
  /**
   * The set line says the same weight and reps as `lastLine`, so the lock
   * screen leaves `lastLine` off. Missing on an activity started before it
   * existed, which reads as false.
   */
  lastLineRepeats?: boolean;
  /** Epoch ms the running rest ends; null between rests. */
  restEndsAt: number | null;
  /** Epoch ms the running rest started, for the progress bar; null between rests. */
  restStartsAt?: number | null;
  /**
   * The app icon in the app group container (lib/island-icon), drawn left
   * of the island's leading content. Null or missing draws no icon.
   */
  iconUri?: string | null;
};

/**
 * Live Activities are iOS only. The layout lives in workout-activity.ios.tsx,
 * which Metro picks on iOS; everywhere else there is no activity, and
 * nothing loads expo-widgets or the SwiftUI views.
 */
export const workoutActivity: LiveActivityFactory<WorkoutActivityProps> | null = null;
