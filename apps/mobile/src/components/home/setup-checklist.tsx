import type { SetupState, SetupTask, SetupTaskKey } from '@liftcamp/shared';
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Text } from '@/components/text';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, radius, spacing, type } from '@/theme/tokens';

const CIRCLE = 22;

/**
 * "Get set up" on Home: five first-week tasks and a progress bar. Finished
 * tasks stay in their place, dimmed, so the list never jumps. `finished`
 * swaps the list for a short done state, shown only on the visit where the
 * last task was ticked.
 */
export function SetupChecklist({
  setup,
  finished,
  onTask,
  onHide,
}: {
  setup: SetupState;
  finished: boolean;
  onTask: (key: SetupTaskKey) => void;
  onHide: () => void;
}) {
  const { scheme, colors: c } = useTheme();

  if (finished) {
    return (
      <View style={[styles.card, styles.finished, cardSurface(scheme, c)]}>
        <Check c={c} />
        <View style={styles.finishedText}>
          <Text style={[type.exerciseName, { color: c.text }]}>You're all set</Text>
          <Text style={[type.meta, { color: c.text2 }]}>Nice work. Your first week starts now.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, cardSurface(scheme, c)]}>
      <View style={styles.head}>
        <Text style={[type.exerciseName, { color: c.text }]}>Get set up</Text>
        <Pressable onPress={onHide} hitSlop={10} accessibilityRole="button" accessibilityLabel="Hide setup">
          <Text style={[type.button, { color: c.accentText, fontSize: 14 }]}>Hide</Text>
        </Pressable>
      </View>

      <View style={styles.progress}>
        <Text style={[type.meta, { color: c.text2 }]}>
          {setup.doneCount} of {setup.total} done
        </Text>
        <ProgressBar fraction={setup.doneCount / setup.total} c={c} />
      </View>

      <View>
        {setup.tasks.map((task) => (
          <TaskRow key={task.key} task={task} onPress={() => onTask(task.key)} c={c} />
        ))}
      </View>
    </View>
  );
}

type Colors = ReturnType<typeof useTheme>['colors'];

/** 6 pt, full width, the fill easing to its new length when the count changes. */
function ProgressBar({ fraction, c }: { fraction: number; c: Colors }) {
  const width = useSharedValue(fraction);
  useEffect(() => {
    width.value = withTiming(fraction, { duration: 400 });
  }, [fraction, width]);
  const fill = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  return (
    <View
      style={[styles.track, { backgroundColor: c.border }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}>
      <Animated.View style={[styles.fill, { backgroundColor: c.accent }, fill]} />
    </View>
  );
}

function Check({ c }: { c: Colors }) {
  return (
    <View style={[styles.circle, { backgroundColor: c.accent, borderColor: c.accent }]}>
      <SymbolView
        name="checkmark"
        size={12}
        weight="bold"
        tintColor="#FFFFFF"
        fallback={<Text style={styles.checkFallback}>✓</Text>}
      />
    </View>
  );
}

function TaskRow({ task, onPress, c }: { task: SetupTask; onPress: () => void; c: Colors }) {
  if (task.done) {
    return (
      <View style={styles.row} accessibilityLabel={`${task.title}, done`}>
        <Check c={c} />
        <Text style={[type.meta, styles.title, { color: c.text3 }]}>{task.title}</Text>
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint={task.subtitle}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={[styles.circle, { borderColor: c.border }]} />
      <View style={styles.text}>
        <Text style={[type.meta, styles.title, { color: c.text }]}>{task.title}</Text>
        <Text style={[type.meta, { color: c.text2 }]}>{task.subtitle}</Text>
      </View>
      <SymbolView
        name="chevron.right"
        size={14}
        tintColor={c.text3}
        fallback={<Text style={[styles.chevron, { color: c.text3 }]}>›</Text>}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, padding: spacing.card, gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progress: { gap: spacing.sm },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkFallback: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  text: { flex: 1, gap: 1 },
  title: { fontSize: 15, fontWeight: '600' },
  chevron: { fontSize: 20, lineHeight: 22 },
  finished: { flexDirection: 'row', alignItems: 'center' },
  finishedText: { flex: 1, gap: 2 },
  pressed: { opacity: 0.7 },
});
