import { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { Sheet, type SheetRef } from '@/components/BottomSheet';
import { Chip, settingsStyles } from '@/components/settings-ui';
import { Text } from '@/components/text';
import { useColors } from '@/theme/theme-provider';
import { spacing, type } from '@/theme/tokens';

type Value = string | number;

/**
 * A Settings picker for a short list, as chips in a bottom sheet. Used
 * where an action sheet will not do: Android's alert holds three buttons,
 * and the weekly target and equipment have four options each. Tapping a
 * chip saves through `onPick` and dismisses.
 */
export const ChoiceSheet = forwardRef<
  SheetRef,
  {
    title: string;
    options: readonly { label: string; value: Value }[];
    selected: Value | null;
    onPick: (value: Value) => void;
    /** Tabular numerals for number options, like the weekly target. */
    numeral?: boolean;
    hint?: string;
  }
>(function ChoiceSheet({ title, options, selected, onPick, numeral, hint }, ref) {
  const c = useColors();

  function pick(value: Value) {
    onPick(value);
    (ref as React.RefObject<SheetRef | null>).current?.dismiss();
  }

  return (
    <Sheet ref={ref}>
      <Text style={[styles.header, { color: c.text2 }]}>{title}</Text>
      <View style={settingsStyles.row}>
        {options.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            selected={selected === o.value}
            onPress={() => pick(o.value)}
            c={c}
            numeral={numeral}
          />
        ))}
      </View>
      {hint ? <Text style={[type.meta, styles.hint, { color: c.text2 }]}>{hint}</Text> : null}
    </Sheet>
  );
});

const styles = StyleSheet.create({
  header: { fontSize: 15, paddingBottom: spacing.md, paddingHorizontal: 4 },
  hint: { paddingTop: spacing.md, paddingHorizontal: 4 },
});
