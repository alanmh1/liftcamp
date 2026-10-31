import { forwardRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Sheet, type SheetRef } from '@/components/BottomSheet';
import { Text } from '@/components/text';
import { PRO_LAUNCHED } from '@/lib/pro';
import { useColors } from '@/theme/theme-provider';
import { palettes, radius, spacing, type } from '@/theme/tokens';

/**
 * What a free user sees at the custom exercise cap. Until Pro can be
 * bought (PRO_LAUNCHED), it says Pro is coming; after, it offers the
 * upgrade. Deleting a custom exercise frees a slot either way.
 */
export const CustomLimitSheet = forwardRef<
  SheetRef,
  {
    limit: number;
    /** Opens the paywall. Only read once PRO_LAUNCHED is true. */
    onUpgrade?: () => void;
  }
>(function CustomLimitSheet({ limit, onUpgrade }, ref) {
  const c = useColors();
  function dismiss() {
    (ref as React.RefObject<SheetRef | null>).current?.dismiss();
  }
  return (
    <Sheet ref={ref}>
      <Text style={[type.exerciseName, { color: c.text }]}>You've used your free custom exercises</Text>
      <Text style={[type.meta, styles.body, { color: c.text }]}>
        Free accounts can create {limit}. Delete one to make room
        {PRO_LAUNCHED ? ', or upgrade to Pro for unlimited.' : '.'}
      </Text>
      {PRO_LAUNCHED ? null : (
        <Text style={[type.meta, styles.body, { color: c.text2 }]}>
          Pro is coming soon with unlimited custom exercises.
        </Text>
      )}
      {PRO_LAUNCHED && onUpgrade ? (
        <Pressable
          onPress={() => {
            dismiss();
            onUpgrade();
          }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, { backgroundColor: c.accent }, pressed && styles.pressed]}>
          <Text style={[type.button, { color: palettes.light.bg }]}>Upgrade to Pro</Text>
        </Pressable>
      ) : null}
      <Pressable
        onPress={dismiss}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.button,
          PRO_LAUNCHED && onUpgrade ? { borderColor: c.border, borderWidth: 1 } : { backgroundColor: c.accent },
          pressed && styles.pressed,
        ]}>
        <Text style={[type.button, { color: PRO_LAUNCHED && onUpgrade ? c.text : palettes.light.bg }]}>Done</Text>
      </Pressable>
    </Sheet>
  );
});

const styles = StyleSheet.create({
  body: { paddingTop: spacing.sm, paddingBottom: spacing.sm },
  button: {
    marginTop: spacing.md,
    borderRadius: radius.bar,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  pressed: { opacity: 0.7 },
});
