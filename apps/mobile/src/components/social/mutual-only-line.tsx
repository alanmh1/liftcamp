import { MUTUAL_ONLY_LINE } from '@liftcamp/shared';
import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useColors } from '@/theme/theme-provider';
import { spacing, type } from '@/theme/tokens';

/**
 * In place of the like button when the two people do not follow each
 * other (can_interact false): a muted line saying why. The feed card's
 * footer and the read-only friend workout both draw it.
 */
export function MutualOnlyLine() {
  const c = useColors();
  return (
    <View style={styles.row} accessible accessibilityLabel={MUTUAL_ONLY_LINE}>
      <SymbolView
        name={{ ios: 'person.2', android: 'group' }}
        size={18}
        tintColor={c.text2}
        fallback={<View style={styles.iconSpace} />}
      />
      <Text style={[type.meta, styles.text, { color: c.text2 }]}>{MUTUAL_ONLY_LINE}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  iconSpace: { width: 18 },
  text: { flex: 1 },
});
