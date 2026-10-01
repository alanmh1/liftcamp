import { progressionGuide } from '@liftcamp/shared';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useWeightUnit } from '@/components/unit-provider';
import { SCROLL_END_PADDING, scrollInsetProps } from '@/lib/scroll-insets';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, radius, spacing, type } from '@/theme/tokens';

/**
 * How progression works, in plain words, pushed from the progression
 * sheet's link with the native header and back button. Free to read; only
 * the Pro sheet links here for now.
 *
 * Everything comes from `progressionGuide` in shared, built from the rules
 * the engine uses, in the user's unit. Nothing is fetched, so it opens
 * offline.
 */
export default function ProgressionGuideScreen() {
  const { scheme, colors: c } = useTheme();
  const { unit } = useWeightUnit();
  const sections = progressionGuide(unit);

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={styles.content}
      {...scrollInsetProps}>
      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={[styles.title, { color: c.text }]}>{section.title}</Text>
          {section.paragraphs.map((p) => (
            <Text key={p} style={[styles.paragraph, { color: c.text2 }]}>
              {p}
            </Text>
          ))}
          {section.steps ? (
            <View style={[styles.steps, cardSurface(scheme, c)]}>
              {section.steps.map((step, i) => (
                <View
                  key={step.label}
                  style={[
                    styles.step,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
                  ]}>
                  <View style={styles.stepText}>
                    <Text style={[type.button, { color: c.text }]}>{step.label}</Text>
                    {step.detail ? (
                      <Text style={[type.prevNumeral, { color: c.text2 }]}>{step.detail}</Text>
                    ) : null}
                  </View>
                  <Text style={[type.prevNumeral, styles.stepValue, { color: c.accentText }]}>{step.value}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {section.after?.map((p) => (
            <Text key={p} style={[styles.paragraph, { color: c.text2 }]}>
              {p}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.screen, gap: spacing.xl, paddingBottom: SCROLL_END_PADDING },
  section: { gap: spacing.sm },
  title: { fontSize: 19, fontWeight: '700' },
  paragraph: { fontSize: 16, lineHeight: 23 },
  steps: { borderRadius: radius.card, paddingHorizontal: spacing.lg, marginVertical: spacing.xs },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  stepText: { flex: 1, gap: 2 },
  stepValue: { fontSize: 15, fontWeight: '600' },
});
