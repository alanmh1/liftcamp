/**
 * Tile colours for the routine cards on /routines.
 *
 * Program-level, not day-level: every day inside a program shares one colour so
 * a three-day routine reads as one set on the page. The colour comes from the
 * program's position in the sorted list rather than from program_order, because
 * order values are sparse and hand-assigned (1, 2, 3, 4, 5, 10, 40) and would
 * collide under a modulo. Position guarantees adjacent programs never match.
 *
 * The palette is the IWF competition plate set the Chalk system already borrows
 * from, plus graphite and chrome to extend it past five. Every pair is at least
 * 4.5:1 against its foreground.
 */

export type TileAccent = { bg: string; fg: string };

const PALETTE: TileAccent[] = [
  { bg: "#1B5FA8", fg: "#FFFFFF" }, // plate blue, 6.46:1
  { bg: "#9C3028", fg: "#FFFFFF" }, // plate red, 7.32:1
  { bg: "#1F6B45", fg: "#FFFFFF" }, // plate green, 6.47:1
  { bg: "#F5D272", fg: "#221F1B" }, // plate gold, 11.21:1
  { bg: "#2F6F7A", fg: "#FFFFFF" }, // teal, 5.71:1
  { bg: "#7A3B63", fg: "#FFFFFF" }, // plum, 7.97:1
  { bg: "#221F1B", fg: "#FDFCFB" }, // graphite, 16.01:1
  { bg: "#C9C3B8", fg: "#221F1B" }, // chrome, 9.36:1
];

export function tileAccent(index: number): TileAccent {
  return PALETTE[((index % PALETTE.length) + PALETTE.length) % PALETTE.length];
}
