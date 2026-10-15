import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { ExerciseThumb } from '@/components/exercise-media';
import { Text } from '@/components/text';
import type { WorkoutExercise } from '@/data/workouts';
import { useTheme } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

const ROW_H = 64;
const ROW_GAP = 8;
const STRIDE = ROW_H + ROW_GAP;
/** Within this many points of the list's top or bottom edge, it scrolls. */
const EDGE = 72;
/** Points per frame while in the edge zone. */
const SCROLL_SPEED = 6;
const LIFT_SCALE = 1.03;

/**
 * Drag-to-reorder for the workout's exercises.
 *
 * Long-press anywhere on a row to pick it up; drag; release to drop. Rows are
 * a fixed height, so where a dragged row will land is arithmetic on its
 * offset, and every other row's shift is a pure function of (from, to, i).
 * Nothing is persisted here: the caller receives the final order from
 * `onDone` and writes once.
 *
 * Presented as a React Native Modal, so GestureHandlerRootView and
 * SafeAreaProvider are re-established inside it, the same as the picker.
 */
export function ReorderModal({
  visible,
  exercises,
  onDone,
}: {
  visible: boolean;
  exercises: WorkoutExercise[];
  onDone: (ordered: WorkoutExercise[]) => void;
}) {
  const { colors: c } = useTheme();
  const [order, setOrder] = useState<WorkoutExercise[]>(exercises);
  const [dragging, setDragging] = useState(false);

  // Fresh copy of the live order each time the sheet opens.
  useEffect(() => {
    if (visible) setOrder(exercises);
  }, [visible, exercises]);

  // Shared drag state. `from` is the index being dragged (-1 for none), `dragY`
  // its offset from where it started, in content coordinates.
  const from = useSharedValue(-1);
  const dragY = useSharedValue(0);
  // How far auto-scroll has slid the content under the finger this drag.
  // dragY is always finger translation plus this, so the row tracks the
  // finger whether the offset came from the finger or the scroll.
  const scrollAdjust = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const viewportH = useSharedValue(0);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const count = order.length;
  const contentH = count * STRIDE - ROW_GAP + spacing.screen * 2;

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  // Auto-scroll runs every frame while a row is held in an edge zone, not
  // only while the finger moves. The same delta is added to dragY so the row
  // stays under the finger as the content slides beneath it.
  useFrameCallback(() => {
    if (from.value < 0 || viewportH.value === 0) return;
    const fingerY = from.value * STRIDE + dragY.value - scrollY.value + ROW_H / 2;
    const maxScroll = Math.max(0, contentH - viewportH.value);
    let delta = 0;
    if (fingerY < EDGE) delta = -SCROLL_SPEED;
    else if (fingerY > viewportH.value - EDGE) delta = SCROLL_SPEED;
    if (delta === 0) return;
    const next = Math.min(maxScroll, Math.max(0, scrollY.value + delta));
    const applied = next - scrollY.value;
    if (applied === 0) return;
    scrollY.value = next;
    dragY.value += applied;
    scrollAdjust.value += applied;
    scrollTo(scrollRef, 0, next, false);
  });

  function commitMove(fromIndex: number, toIndex: number) {
    setDragging(false);
    if (fromIndex === toIndex) return;
    setOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => onDone(order)}>
      <GestureHandlerRootView style={styles.fill}>
        <SafeAreaProvider>
          <View style={[styles.fill, { backgroundColor: c.bg }]}>
            <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
              <View style={styles.header}>
                <Text style={[type.screenTitle, { color: c.text }]}>Reorder exercises</Text>
                <Pressable onPress={() => onDone(order)} hitSlop={10} accessibilityRole="button">
                  <Text style={[type.button, { color: c.accentText }]}>Done</Text>
                </Pressable>
              </View>
              <Text style={[type.meta, styles.hint, { color: c.text2 }]}>
                Hold a row to pick it up, then drag.
              </Text>

              <Animated.ScrollView
                ref={scrollRef}
                onScroll={onScroll}
                scrollEventThrottle={16}
                scrollEnabled={!dragging}
                onLayout={(e: LayoutChangeEvent) => {
                  viewportH.value = e.nativeEvent.layout.height;
                }}
                contentContainerStyle={{ height: contentH, paddingTop: spacing.screen }}
                showsVerticalScrollIndicator={false}>
                {order.map((we, index) => (
                  <Row
                    key={we.id}
                    we={we}
                    index={index}
                    count={count}
                    from={from}
                    dragY={dragY}
                    scrollAdjust={scrollAdjust}
                    onPickUp={() => setDragging(true)}
                    onDrop={commitMove}
                  />
                ))}
              </Animated.ScrollView>
            </SafeAreaView>
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </Modal>
  );
}

function Row({
  we,
  index,
  count,
  from,
  dragY,
  scrollAdjust,
  onPickUp,
  onDrop,
}: {
  we: WorkoutExercise;
  index: number;
  count: number;
  from: SharedValue<number>;
  dragY: SharedValue<number>;
  scrollAdjust: SharedValue<number>;
  onPickUp: () => void;
  onDrop: (from: number, to: number) => void;
}) {
  const { scheme, colors: c } = useTheme();

  const pan = Gesture.Pan()
    .activateAfterLongPress(250)
    .onStart(() => {
      from.value = index;
      dragY.value = 0;
      scrollAdjust.value = 0;
      runOnJS(onPickUp)();
    })
    .onUpdate((e) => {
      dragY.value = e.translationY + scrollAdjust.value;
    })
    .onEnd(() => {
      const slot = Math.round((from.value * STRIDE + dragY.value) / STRIDE);
      const to = Math.max(0, Math.min(count - 1, slot));
      const f = from.value;
      from.value = -1;
      dragY.value = 0;
      scrollAdjust.value = 0;
      runOnJS(onDrop)(f, to);
    })
    .onFinalize(() => {
      // Reached without onEnd only when the gesture was cancelled (a call, a
      // system gesture). Put the row back where it was.
      if (from.value === index) {
        from.value = -1;
        dragY.value = 0;
        scrollAdjust.value = 0;
        runOnJS(onDrop)(index, index);
      }
    });

  const style = useAnimatedStyle(() => {
    const active = from.value === index;
    if (active) {
      return {
        zIndex: 10,
        transform: [{ translateY: dragY.value }, { scale: LIFT_SCALE }],
        shadowOpacity: 0.18,
      };
    }
    if (from.value < 0) {
      return { zIndex: 0, transform: [{ translateY: withTiming(0, { duration: 150 }) }, { scale: 1 }], shadowOpacity: 0 };
    }
    // Where the dragged row would land right now.
    const slot = Math.max(0, Math.min(count - 1, Math.round((from.value * STRIDE + dragY.value) / STRIDE)));
    let shift = 0;
    if (from.value < slot && index > from.value && index <= slot) shift = -STRIDE;
    else if (from.value > slot && index >= slot && index < from.value) shift = STRIDE;
    return {
      zIndex: 0,
      transform: [{ translateY: withTiming(shift, { duration: 150 }) }, { scale: 1 }],
      shadowOpacity: 0,
    };
  });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          styles.row,
          {
            top: index * STRIDE + spacing.screen,
            backgroundColor: c.surface,
            borderColor: scheme === 'dark' ? c.border : 'transparent',
          },
          style,
        ]}>
        <ExerciseThumb exercise={we.exercise} size={44} />
        <Text style={[type.exerciseName, styles.name, { color: c.text }]} numberOfLines={2}>
          {we.exercise.name}
        </Text>
        <SymbolView
          name={{ ios: 'line.3.horizontal', android: 'drag_handle' }}
          size={20}
          tintColor={c.text3}
          fallback={<Text style={[styles.handleFallback, { color: c.text3 }]}>≡</Text>}
        />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md,
  },
  hint: { paddingHorizontal: spacing.screen, paddingBottom: spacing.sm },
  row: {
    position: 'absolute',
    left: spacing.screen,
    right: spacing.screen,
    height: ROW_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.bar,
    borderWidth: 1,
    shadowColor: '#221F1B',
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  name: { flex: 1 },
  handleFallback: { fontSize: 22 },
});
