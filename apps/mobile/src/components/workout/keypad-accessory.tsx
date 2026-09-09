import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

export type EditField = 'weight' | 'reps';

/**
 * The bar that sits above the numeric keypad: two steppers and Done.
 *
 * Rendered at screen level and positioned with the keyboard height rather than
 * iOS's InputAccessoryView, because Android has no equivalent and one code
 * path is easier to keep honest than two.
 */
export function KeypadAccessory({
  field,
  onStep,
  onDone,
}: {
  field: EditField | null;
  onStep: (delta: number) => void;
  onDone: () => void;
}) {
  const c = useColors();
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (!field || height === 0) return null;

  const step = field === 'weight' ? 2.5 : 1;
  const label = (d: number) => `${d > 0 ? '+' : '−'}${Math.abs(d)}`;

  return (
    <View
      style={[
        styles.bar,
        { bottom: height, backgroundColor: c.surface2, borderTopColor: c.border },
      ]}>
      {[-step, step].map((d) => (
        <Pressable
          key={d}
          onPress={() => onStep(d)}
          style={({ pressed }) => [
            styles.stepper,
            { backgroundColor: c.surface, borderColor: c.border },
            pressed && styles.pressed,
          ]}>
          <Text style={[type.button, { color: c.text }]}>{label(d)}</Text>
        </Pressable>
      ))}

      <View style={styles.spacer} />

      <Pressable
        onPress={onDone}
        style={({ pressed }) => [
          styles.done,
          { backgroundColor: c.accent },
          pressed && styles.pressed,
        ]}>
        <Text style={[type.button, { color: '#FFFFFF' }]}>Done</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  stepper: {
    minWidth: 64,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.input,
    paddingVertical: spacing.sm,
  },
  done: {
    borderRadius: radius.input,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  spacer: { flex: 1 },
  pressed: { opacity: 0.7 },
});
