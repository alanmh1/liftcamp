import { splitStepParts } from '@liftcamp/shared';
import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/components/text';
import { useColors } from '@/theme/theme-provider';
import { spacing, tabular, type } from '@/theme/tokens';

/**
 * The numbered "how to" steps of an exercise, with Tip, Note and Caution
 * asides marked by the amber icon. Rendered by the info sheet and by the
 * exercise screen's How to segment, so the two read the same.
 */
export function ExerciseSteps({ steps }: { steps: string[] }) {
  const c = useColors();
  return (
    <View style={styles.steps}>
      {steps.map((step, i) => (
        <View key={i} style={styles.step}>
          <Text style={[type.prevNumeral, styles.stepNumber, { color: c.text3 }]}>{i + 1}</Text>
          <View style={styles.stepText}>
            {splitStepParts(step).map((part, j) => (
              <View key={j} style={styles.part}>
                {part.label ? <TipIcon color={c.tip} /> : null}
                <Text style={[type.meta, styles.partText, { color: c.text }]}>
                  {part.label ? <Text style={styles.stepLabel}>{part.label}: </Text> : null}
                  {part.text}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Marks a Tip, Note or Caution aside. Amber `tip` token, never gold. */
function TipIcon({ color }: { color: string }) {
  return (
    <SymbolView
      name="lightbulb"
      size={16}
      tintColor={color}
      style={styles.tipIcon}
      fallback={
        <Svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={styles.tipIcon}>
          <Path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
          <Path d="M9 18h6" />
          <Path d="M10 22h4" />
        </Svg>
      }
    />
  );
}

const styles = StyleSheet.create({
  steps: { gap: spacing.md, paddingTop: 2 },
  step: { flexDirection: 'row', gap: spacing.md },
  stepNumber: { width: 18, textAlign: 'right', lineHeight: 22, fontWeight: '700', ...tabular },
  stepText: { flex: 1, gap: 4 },
  part: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  partText: { flex: 1, fontSize: 15, lineHeight: 22 },
  stepLabel: { fontWeight: '700' },
  tipIcon: { marginTop: 3 },
});
