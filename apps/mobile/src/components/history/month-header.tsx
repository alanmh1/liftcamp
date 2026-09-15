import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useColors } from '@/theme/theme-provider';
import { spacing, type } from '@/theme/tokens';

/**
 * "September" for a month of this year, "November 2025" for any other. The
 * rows under it carry the day, so the header carries only the month.
 */
export function monthTitle(yearMonth: string, now = new Date()): string {
  const d = new Date(`${yearMonth}-01T00:00:00`);
  const month = d.toLocaleDateString(undefined, { month: 'long' });
  return d.getFullYear() === now.getFullYear() ? month : `${month} ${d.getFullYear()}`;
}

export function MonthHeader({ title }: { title: string }) {
  const c = useColors();
  return (
    <View style={[styles.wrap, { backgroundColor: c.bg }]}>
      <Text style={[type.label, { color: c.text3 }]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: spacing.lg, paddingBottom: spacing.sm },
});
