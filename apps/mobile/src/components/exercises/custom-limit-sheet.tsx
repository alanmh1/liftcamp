import { forwardRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Sheet, type SheetRef } from '@/components/BottomSheet';
import { Text } from '@/components/text';
import { useColors } from '@/theme/theme-provider';
import { palettes, radius, spacing, type } from '@/theme/tokens';

/**
 * What a free user sees at the custom exercise cap. With `onUpgrade`
 * (useProUpsell says Pro can be bought here) it offers the upgrade.
 * Deleting a custom exercise frees a slot either way.
 */
export const CustomLimitSheet = forwardRef<
  SheetRef,
  {
    limit: number;
    /** Opens the paywall. Absent while Pro is not on sale here. */
    onUpgrade?: () => void;
  }
>(function CustomLimitSheet({ limit, onUpgrade }, ref) {
  const c = useColors();
  function dismiss() {
    (ref as React.RefObject<SheetRef | null>).current?.dismiss();
  }
  return (
    <Sheet ref={ref}>
      <Text style={[type.exerciseName, styles.centered, { color: c.text }]}>You've used your free custom exercises</Text>
      <Text style={[type.meta, styles.body, styles.centered, { color: c.text }]}>
        Free accounts can create {limit}. Delete one to make room
        {onUpgrade ? ', or upgrade to Pro for unlimited.' : '.'}
      </Text>
      {onUpgrade ? (
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
          onUpgrade ? { borderColor: c.border, borderWidth: 1 } : { backgroundColor: c.accent },
          pressed && styles.pressed,
        ]}>
        <Text style={[type.button, { color: onUpgrade ? c.text : palettes.light.bg }]}>Done</Text>
      </Pressable>
    </Sheet>
  );
});

const styles = StyleSheet.create({
  // Shows information only, so it centres (apps/mobile/CLAUDE.md, Sheets).
  centered: { textAlign: 'center' },
  body: { paddingTop: spacing.sm, paddingBottom: spacing.sm },
  button: {
    marginTop: spacing.md,
    borderRadius: radius.bar,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  pressed: { opacity: 0.7 },
});
