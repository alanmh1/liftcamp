import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { type } from '@/theme/tokens';

/**
 * A button label that turns into a spinner without the button changing size.
 *
 * The text stays in layout at opacity 0 while busy, which is what holds the
 * resting width; the indicator sits absolutely centred over it. Small is
 * 20pt and a 13 to 14pt label's line box is about 18pt, so it is scaled down
 * to read as label-sized without touching the button's height.
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
      <Text style={[type.button, { color, fontSize }, busy && styles.hidden]} numberOfLines={1}>
        {label}
      </Text>
      {busy ? <ActivityIndicator size="small" color={color} style={styles.spinner} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  hidden: { opacity: 0 },
  spinner: { position: 'absolute', transform: [{ scale: 0.8 }] },
});
