/**
 * Chalk, remapped for two modes. From docs/active-workout-spec.md.
 *
 * Rules that the values alone do not carry:
 * - Accent means tappable or done. Nothing decorative is blue.
 * - Gold appears only on PR marks. Never on buttons, never on charts.
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
  danger: string;
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
    danger: '#B3261E',
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
    danger: '#F2B8B5',
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

/** DM Mono, loaded in the root layout. Numbers in the logging UI only. */
export const mono = {
  regular: 'DMMono_400Regular',
  medium: 'DMMono_500Medium',
} as const;

/**
 * The type scale. `fontFamily: undefined` means the system font, which is
 * SF Pro on iOS and Roboto on Android.
 */
export const type = {
  screenTitle: { fontSize: 24, fontWeight: '700', letterSpacing: -0.48 },
  exerciseName: { fontSize: 17, fontWeight: '600' },
  setNumeral: { fontFamily: mono.medium, fontSize: 18 },
  prevNumeral: { fontFamily: mono.regular, fontSize: 13 },
  restTime: { fontFamily: mono.medium, fontSize: 15 },
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
 * Set grid columns, authored at a 393pt screen and scaled to whatever width
 * the card actually has. The done column is unlabelled.
 */
export const COLUMNS = { set: 32, previous: 104, weight: 84, reps: 60, done: 36 } as const;
export const COLUMNS_BASE_WIDTH = Object.values(COLUMNS).reduce((a, b) => a + b, 0);
