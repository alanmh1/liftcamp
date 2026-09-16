import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useColors } from '@/theme/theme-provider';
import { spacing, type } from '@/theme/tokens';

/**
 * The beginner notes' markdown, which across every row in the table is
 * plain paragraphs separated by a blank line and nothing else (checked
 * 16 Sep 2026). So this is a split on blank lines, and it stays that way
 * until the content grows a construct that needs more.
 */
export function Paragraphs({ text }: { text: string }) {
  const c = useColors();
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
  return (
    <View style={styles.wrap}>
      {paragraphs.map((p, i) => (
        <Text key={i} style={[type.meta, styles.paragraph, { color: c.text }]}>
          {p}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  paragraph: { fontSize: 15, lineHeight: 22 },
});
