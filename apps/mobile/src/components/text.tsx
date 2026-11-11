import type { Ref } from 'react';
import {
  Text as RNText,
  TextInput as RNTextInput,
  StyleSheet,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  useWindowDimensions,
} from 'react-native';

import { fontFamilyFor } from '@/theme/tokens';

/**
 * `Text` and `TextInput` in Outfit.
 *
 * React Native resolves `fontWeight` against the system font only. A custom
 * face loaded through expo-font is one family name per weight, and pairing
 * it with a `fontWeight` gets you the wrong face on iOS and a synthesised
 * bold on Android. These wrappers read the weight out of the style, swap in
 * the matching Outfit family, and drop the weight, so the rest of the app
 * keeps writing `fontWeight: '600'` and gets Outfit SemiBold.
 *
 * An explicit `fontFamily` in the style wins, which is the escape hatch for
 * a glyph that has to come from the system font.
 *
 * Both also cap Dynamic Type at `MAX_FONT_SCALE`.
 */
/**
 * The largest Dynamic Type multiplier any text takes. In React Native's
 * table, iOS's largest standard size (Larger Accessibility Sizes off) is
 * 1.353 and the accessibility sizes reach 3.571. A caller's own
 * `maxFontSizeMultiplier` wins, so a chart label can stay at 1.
 */
export const MAX_FONT_SCALE = 1.3;

/**
 * The scale text is drawn at: the system's, capped. React Native scales a
 * numeric `lineHeight` by the same amount, so a box sized in lines (two
 * lines reserved for a name) multiplies its height by this to keep up.
 */
export function useFontScale(): number {
  return Math.min(useWindowDimensions().fontScale, MAX_FONT_SCALE);
}

function inOutfit(style: StyleProp<TextStyle>): TextStyle {
  const flat = StyleSheet.flatten(style) ?? {};
  const { fontWeight, fontFamily, ...rest } = flat;
  return { ...rest, fontFamily: fontFamily ?? fontFamilyFor(fontWeight) };
}

export function Text({ style, ...props }: TextProps & { ref?: Ref<RNText> }) {
  return (
    <RNText {...props} maxFontSizeMultiplier={props.maxFontSizeMultiplier ?? MAX_FONT_SCALE} style={inOutfit(style)} />
  );
}

/**
 * iOS draws TextInput text and placeholders with wide tracking unless
 * letterSpacing is set ("S e a r c h", "6 5"). Zero is the default; a
 * caller's letterSpacing comes after it and wins.
 */
const inputDefaults: TextStyle = { letterSpacing: 0 };

export function TextInput({ style, ...props }: TextInputProps & { ref?: Ref<RNTextInput> }) {
  return (
    <RNTextInput
      {...props}
      maxFontSizeMultiplier={props.maxFontSizeMultiplier ?? MAX_FONT_SCALE}
      style={inOutfit([inputDefaults, style])}
    />
  );
}

/** The native instance types, so `useRef<TextInput>` keeps working. */
export type Text = RNText;
export type TextInput = RNTextInput;
