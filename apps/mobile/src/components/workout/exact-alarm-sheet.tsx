import { forwardRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Sheet, type SheetRef } from '@/components/BottomSheet';
import { Text } from '@/components/text';
import { openExactAlarmSettings } from '@/lib/exact-alarms';
import { useColors } from '@/theme/theme-provider';
import { palettes, radius, spacing, type } from '@/theme/tokens';

/**
 * Android 14+, once per install: asks for the exact alarm setting so the
 * rest alert fires when the rest ends (lib/exact-alarms). The workout
 * screen presents it when a rest starts and records that it was shown.
 */
export const ExactAlarmSheet = forwardRef<SheetRef>(function ExactAlarmSheet(_props, ref) {
  const c = useColors();
  function dismiss() {
    (ref as React.RefObject<SheetRef | null>).current?.dismiss();
  }
  return (
    <Sheet ref={ref}>
      <Text style={[type.exerciseName, styles.centered, { color: c.text }]} accessibilityRole="header">
        Get rest alerts on time
      </Text>
      <Text style={[type.meta, styles.body, styles.centered, { color: c.text }]}>
        Android needs one more setting so the alert fires right when rest ends.
      </Text>
      <Pressable
        onPress={() => {
          dismiss();
          void openExactAlarmSettings();
        }}
        accessibilityRole="button"
        style={({ pressed }) => [styles.button, { backgroundColor: c.accent }, pressed && styles.pressed]}>
        <Text style={[type.button, { color: palettes.light.bg }]}>Open settings</Text>
      </Pressable>
      <Pressable
        onPress={dismiss}
        accessibilityRole="button"
        style={({ pressed }) => [styles.notNow, pressed && styles.pressed]}>
        <Text style={[type.button, { color: c.accentText }]}>Not now</Text>
      </Pressable>
    </Sheet>
  );
});

const styles = StyleSheet.create({
  // Shows information only, so it centres (apps/mobile/CLAUDE.md, Sheets).
  centered: { textAlign: 'center' },
  body: { paddingTop: spacing.sm, paddingBottom: spacing.sm },
  button: {
    alignSelf: 'stretch',
    marginTop: spacing.md,
    borderRadius: radius.bar,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  notNow: { alignSelf: 'stretch', height: 44, marginTop: spacing.xs, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
});
