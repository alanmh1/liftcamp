import { Image } from 'expo-image';
import { View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * The streak's clay flame, in its three states. Every flame in the app
 * draws through this component (the week card's chip and rest-week token,
 * the streak sheet and the dev gallery).
 *
 * - ember: a streak is going.
 * - ice: a rest week, banked or covering last week.
 * - out: no streak.
 *
 * assets/images/streak holds the art: lossy WebP with alpha, 360 px
 * squares, all three on one shared frame so a swap never moves the shape.
 * The flame fills about 93% of the height and 65% of the width, centered,
 * the same convention as the medals. The 600 px PNG masters are in
 * assets-src/images/streak, which nothing requires, so they are not
 * bundled. Decorative: the text beside it says what it means.
 */
export type FlameVariant = 'ember' | 'ice' | 'out';

/** Static requires: Metro cannot resolve a path built at runtime. */
const ART: Record<FlameVariant, number> = {
  ember: require('../../../assets/images/streak/flame-ember.webp'),
  ice: require('../../../assets/images/streak/flame-ice.webp'),
  out: require('../../../assets/images/streak/flame-out.webp'),
};

export function Flame({
  variant,
  size,
  style,
}: {
  variant: FlameVariant;
  size: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[{ width: size, height: size }, style]}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Image
        source={ART[variant]}
        style={{ width: size, height: size }}
        contentFit="contain"
        cachePolicy="memory-disk"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}
