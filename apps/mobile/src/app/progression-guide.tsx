import { progressionGuide } from '@liftcamp/shared';
import { Redirect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useWeightUnit } from '@/components/unit-provider';
import { openProgressiveOverloadGuide } from '@/lib/open-guide';
import { useProgressionGate } from '@/lib/pro';
import { SCROLL_END_PADDING, scrollInsetProps } from '@/lib/scroll-insets';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, pressedFlat, radius, spacing, type } from '@/theme/tokens';

/**
 * How progression works, in plain words, pushed from the progression
 * sheet's link with the native header and back button. Pro only, like the
 * sheet: every route can be opened by deep link (liftcamp://progression-guide),
 * so with the gate shut it redirects to Home and shows nothing. Ends with
 * a link to the site's full Progressive Overload guide.
 *
 * Everything comes from `progressionGuide` in shared, built from the rules
 * the engine uses, in the user's unit. Nothing is fetched, so it opens
 * offline.
 */
export default function ProgressionGuideScreen() {
  const { scheme, colors: c } = useTheme();
  const { unit } = useWeightUnit();
  const open = useProgressionGate();
  const sections = progressionGuide(unit);

  if (!open) return <Redirect href="/" />;

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
      <Pressable
        onPress={openProgressiveOverloadGuide}
        accessibilityRole="link"
        style={({ pressed }) => [styles.link, cardSurface(scheme, c), pressed && [styles.pressed, pressedFlat]]}>
        <Text style={[type.button, styles.linkLabel, { color: c.accentText }]}>Read the full guide</Text>
        <Text style={[styles.chevron, { color: c.text3 }]}>›</Text>
      </Pressable>
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
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  linkLabel: { flex: 1 },
  chevron: { fontSize: 22, lineHeight: 24 },
  pressed: { opacity: 0.7 },
});
