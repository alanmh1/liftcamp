import { Platform, type TextStyle } from 'react-native';

/**
 * Chalk, remapped for two modes. From docs/active-workout-spec.md.
 *
 * Rules that the values alone do not carry:
 * - Accent means tappable. Green (`success`) marks a done set. Nothing
 *   decorative is blue, except `ice` below.
 * - Gold appears only on PR marks. Never on buttons, never on charts. The
 *   medals' metal is the art's own and is not UI gold.
 * - Ember (`streak` and its family) means the week streak. It appears
 *   nowhere else.
 * - Ice means a rest week, and is the cold end of the week's heat scale
 *   (packages/shared heat.ts). It is a light sky blue, never `accent`, and
 *   never on a tappable control. It is the one decorative blue, and it
 *   stays inside the streak.
 */

export type ColorScheme = 'light' | 'dark';

export type Palette = {
  bg: string;
  surface: string;
  surface2: string;
  inputFill: string;
  border: string;
  text: string;
  text2: string;
  text3: string;
  accent: string;
  accentText: string;
  accentSoft: string;
  gold: string;
  goldDeep: string;
  /** Destructive actions only. iOS system red, per mode. */
  danger: string;
  /**
   * Tip, Note and Caution asides in exercise steps. Amber, deliberately not
   * `gold`: gold is reserved for personal records and nothing else.
   */
  tip: string;
  /** A set row's check box before it is ticked: fill, border and faint glyph. */
  checkFill: string;
  checkBorder: string;
  checkGlyph: string;
  /** A done set: the ticked box and the set badge. White glyphs on it. */
  success: string;
  /** The full-width band behind a done set row. */
  successTint: string;
  /** Hairline between set rows that are not done. */
  divider: string;
  /**
   * Where the workout progress bar's fill starts, at nothing done. It
   * deepens to `accent` as exercises finish. Light is the mock's start;
   * dark is a slate blue that reads on the dark track and still gains
   * strength toward accent.
   */
  progressStart: string;
  /**
   * The week streak, docs/week-card-v2-spec.md. Ember: the hit border, the
   * at-risk ring, filled ticks.
   */
  streak: string;
  /** Streak text on its soft fills: the chip, the medal row's urgent line. */
  streakText: string;
  /** The count on a hit week and the streak sheet's big number. */
  streakBig: string;
  /** The streak chip's fill and the celebration glow. */
  streakSoft: string;
  /** The week card's fill while the streak is at risk. */
  streakRiskBg: string;
  /** The medal week card's fill and the active streak sheet's. */
  streakHitBg: string;
  /** A rest week, and the cold end of the heat scale. */
  ice: string;
  /** Rest-week token text and the protected sheet's number. */
  iceText: string;
  /** The rest-week token and ice chip fill. */
  iceSoft: string;
  /** The week card's fill on a rest-week Monday and the protected sheet's. */
  iceBg: string;
  /** The week card's border on a rest-week Monday. */
  iceBorder: string;
  /** The streak chip's fill with no streak. */
  noStreakSoft: string;
};

export const palettes: Record<ColorScheme, Palette> = {
  light: {
    bg: '#FDFCFB',
    surface: '#FFFFFF',
    surface2: '#F1EDE7',
    inputFill: '#F6F3EE',
    border: '#DCD6CD',
    text: '#221F1B',
    text2: '#6B655D',
    text3: '#9A948B',
    accent: '#1B5FA8',
    accentText: '#1B5FA8',
    accentSoft: '#E3EDF9',
    gold: '#F5D272',
    goldDeep: '#D9B24C',
    danger: '#FF3B30',
    tip: '#B8860B',
    checkFill: '#FFFFFF',
    checkBorder: '#DDD7CC',
    checkGlyph: '#D3CCBF',
    success: '#2E8A57',
    successTint: '#EAF4EC',
    divider: '#EFEBE4',
    progressStart: '#B9CCEA',
    streak: '#F2602B',
    streakText: '#B33C0C',
    streakBig: '#D9480F',
    streakSoft: '#FFE7D9',
    streakRiskBg: '#FFF6EF',
    streakHitBg: '#FFF1E6',
    ice: '#4FAEE8',
    iceText: '#1B5FA8',
    iceSoft: '#E4F2FC',
    iceBg: '#F3F9FE',
    iceBorder: '#BFDDF5',
    noStreakSoft: '#F1EDE6',
  },
  dark: {
    bg: '#221F1B',
    surface: '#2C2823',
    surface2: '#37322C',
    inputFill: '#221F1B',
    border: '#3F3933',
    text: '#FDFCFB',
    text2: '#A8A29A',
    text3: '#7A746C',
    accent: '#1B5FA8',
    accentText: '#7FB0EE',
    accentSoft: '#26406A',
    gold: '#F5D272',
    goldDeep: '#D9B24C',
    danger: '#FF453A',
    tip: '#F0B94A',
    checkFill: '#221F1B',
    checkBorder: '#4A443D',
    checkGlyph: '#5C564E',
    success: '#2E8A57',
    successTint: '#1F3326',
    divider: '#35302A',
    progressStart: '#4A6283',
    streak: '#FF6A33',
    streakText: '#FF9466',
    streakBig: '#FF7A45',
    streakSoft: '#3B2218',
    streakRiskBg: '#33241B',
    streakHitBg: '#36231A',
    ice: '#4FAEE8',
    iceText: '#8ECBF5',
    iceSoft: '#1E3346',
    iceBg: '#24303A',
    iceBorder: '#2F4D66',
    noStreakSoft: '#37322C',
  },
};

/** Screen edge is 20, card interior is 14. Everything else is derived. */
export const spacing = {
  screen: 20,
  card: 14,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const radius = {
  card: 20,
  bar: 14,
  input: 10,
  pill: 999,
} as const;

/**
 * Outfit, loaded in the root layout, for every piece of text including the
 * numbers. One family name per weight, because that is how expo-font
 * registers a Google Font; `fontFamilyFor` picks the face for a
 * `fontWeight`, and `@/components/text` applies it.
 */
export const font = {
  regular: 'Outfit_400Regular',
  medium: 'Outfit_500Medium',
  semibold: 'Outfit_600SemiBold',
  bold: 'Outfit_700Bold',
} as const;

export function fontFamilyFor(weight: TextStyle['fontWeight']): string {
  const w = weight == null ? 400 : weight === 'bold' ? 700 : weight === 'normal' ? 400 : Number(weight);
  if (w >= 700) return font.bold;
  if (w >= 600) return font.semibold;
  if (w >= 500) return font.medium;
  return font.regular;
}

/**
 * Outfit's digits are proportional by default (a 1 is half the width of a
 * 0), so anything that lines numbers up in a column asks for the tabular
 * set. The font ships them: every digit is 590 units in every weight.
 */
export const tabular = { fontVariant: ['tabular-nums'] } as const satisfies TextStyle;

/** The type scale. Weights resolve to Outfit faces through `fontFamilyFor`. */
export const type = {
  screenTitle: { fontSize: 24, fontWeight: '700', letterSpacing: -0.48 },
  exerciseName: { fontSize: 17, fontWeight: '600' },
  setNumeral: { fontSize: 18, fontWeight: '500', ...tabular },
  prevNumeral: { fontSize: 13, fontWeight: '400', ...tabular },
  restTime: { fontSize: 15, fontWeight: '500', ...tabular },
  meta: { fontSize: 13, fontWeight: '400' },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  button: { fontSize: 15, fontWeight: '600' },
} as const;

/**
 * Cards on light get a soft shadow. Cards on dark get a border and no shadow,
 * because a shadow on a near-black background reads as nothing.
 */
export function cardSurface(scheme: ColorScheme, p: Palette) {
  if (scheme === 'dark') {
    return { backgroundColor: p.surface, borderWidth: 1, borderColor: p.border };
  }
  return {
    backgroundColor: p.surface,
    shadowColor: '#221F1B',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  };
}

/**
 * Android draws an elevated view's shadow under the whole view, and shows
 * it through any part that is not opaque. A card at reduced opacity (a
 * press state, a fade) then shows a grey slab behind its content. Two fixes,
 * both nothing on iOS:
 *
 * - `pressedFlat`, added to a press style, drops the card's elevation for
 *   as long as it is pressed and translucent.
 * - `flattenAlpha`, spread on a view whose opacity is below 1 (or fades)
 *   around elevated cards, composites the view as one layer before the
 *   opacity is applied, so each card covers its own shadow as on iOS.
 */
export const pressedFlat = Platform.OS === 'android' ? { elevation: 0 } : null;
export const flattenAlpha = Platform.OS === 'android' ? { needsOffscreenAlphaCompositing: true } : {};

/**
 * A row in a list. Same surface as `cardSurface` with no shadow: stacked
 * rows sit `spacing.sm` apart, and an 8pt blur at that spacing lands on the
 * neighbouring rows instead of lifting each one.
 */
export function listSurface(scheme: ColorScheme, p: Palette) {
  if (scheme === 'dark') {
    return { backgroundColor: p.surface, borderWidth: 1, borderColor: p.border };
  }
  return { backgroundColor: p.surface };
}

/**
 * The set grid's fixed columns. Previous, weight and reps split what is left
 * in equal thirds (`flex: 1` each). The done column is unlabelled.
 */
export const COLUMNS = { set: 40, done: 40 } as const;
