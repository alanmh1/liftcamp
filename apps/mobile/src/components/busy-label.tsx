import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { type } from '@/theme/tokens';

/**
 * A button label that turns into a spinner without the button changing size.
 *
 * The text stays in layout at opacity 0 while busy, which is what holds the
 * resting width; the indicator sits absolutely centred over it. Small is
 * 20pt and a 13 to 14pt label's line box is about 18pt, so it is scaled down
 * to read as label-sized without touching the button's height.
 *
 * The label centres itself inside its own box, both ways. Measured on the
 * Simulator (11 Nov 2026), the text box came out about 25% larger than the
 * glyphs it drew, and with no lineHeight or textAlign iOS draws at the box's
 * top left, so every Start sat about 2 to 3 pt high and 5 pt left. An
 * explicit lineHeight makes the box height exact (iOS centres the glyphs in
 * it), and textAlign centre absorbs any spare width.
 */
export function BusyLabel({
  label,
  busy,
  color,
  fontSize = 13,
}: {
  label: string;
  busy: boolean;
  color: string;
  fontSize?: number;
}) {
  return (
    <View style={styles.wrap}>
      <Text
        style={[type.button, styles.text, { color, fontSize, lineHeight: labelLineHeight(fontSize) }, busy && styles.hidden]}
        numberOfLines={1}>
        {label}
      </Text>
      {busy ? <ActivityIndicator size="small" color={color} style={styles.spinner} /> : null}
    </View>
  );
}

/**
 * Outfit's natural line box: hhea ascent 1000 and descent 260 per 1000
 * units, so 1.26 em, rounded up to a whole point. 14 pt gives 18, 17 gives
 * 22. Keeping it at the natural height leaves the caps' centre within a
 * quarter point of the box's centre.
 */
export function labelLineHeight(fontSize: number): number {
  return Math.ceil(fontSize * 1.26);
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  // Android: drop the extra font padding so the box is the line height.
  text: { textAlign: 'center', includeFontPadding: false, textAlignVertical: 'center' },
  hidden: { opacity: 0 },
  spinner: { position: 'absolute', transform: [{ scale: 0.8 }] },
});
