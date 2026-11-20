import { palettes } from '@/theme/tokens';

/** The summary share cards' two backgrounds, picked with the Background button. */
export type CardTheme = 'light' | 'dark';

/**
 * The share cards' colors. Images for social, so they follow the
 * Background choice, never the app's theme. Every text color here is at
 * least 4.5:1 on the card, and the gold text on gold-soft too.
 */
export type CardPalette = {
  card: string;
  text: string;
  muted: string;
  /** The thumbnail and letter tile's square. */
  thumb: string;
  divider: string;
  /** Gold as text: the PR label, the new set, the chip's figure. */
  gold: string;
  /** The chip's background. */
  goldSoft: string;
  /** Solid gold for the "★ PR" pill and the label's circle. */
  goldFill: string;
  /** Dark brown on goldFill. */
  onGold: string;
  accent: string;
};

const GOLD = palettes.light.gold;
const ON_GOLD = '#3D2C05';

export const CARD_PALETTES: Record<CardTheme, CardPalette> = {
  light: {
    card: '#FFFFFF',
    text: palettes.light.text,
    muted: '#6B6560',
    thumb: '#F4F1EC',
    divider: '#EFEAE3',
    gold: '#8A6417',
    goldSoft: '#F7EFD9',
    goldFill: GOLD,
    onGold: ON_GOLD,
    accent: '#1B5FA8',
  },
  dark: {
    card: '#1F1D1A',
    text: '#F4F1EC',
    muted: '#ADA59C',
    thumb: '#2E2B27',
    divider: '#36322D',
    gold: '#E3B957',
    goldSoft: '#3A3020',
    goldFill: GOLD,
    onGold: ON_GOLD,
    accent: '#8DB8EC',
  },
};
