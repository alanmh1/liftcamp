/**
 * Which background slot each card in a grid takes, from a palette of
 * `slots` colours.
 *
 * Two rules. Cards that show the same art key never share a slot, so two
 * cards with the same picture still look different. Cards next to each
 * other in the grid order never share a slot. When both cannot hold, the
 * same-art rule wins and two neighbours may match.
 *
 * Beyond the rules, the walk avoids a slot used two or three places back,
 * since those are the cards stacked above in a two- or three-column grid.
 * That is a preference only: the column count is the browser's, and the
 * grid order is all this sees.
 *
 * The walk goes in the order given and tries slots lowest cost first,
 * then the slot used least so far (so all six colours show up, not the
 * first four on repeat), then the lower slot, backing up when a card has
 * no slot left. No randomness, so the same cards in the same order get
 * the same slots on every render.
 */

export type TintCard = { id: string; art: string };

/** A card outside the grid (a hero) that already holds a slot. It counts toward the same-art rule only. */
export type PinnedTint = { art: string; slot: number };

/** Positions back a card looks for the preference: the card above it in two and three columns. */
const STACKED = [2, 3] as const;

/** Upper bound on backtracking steps per pass, so an impossible pass gives up instead of exploring every assignment. */
const STEP_BUDGET = 50_000;

export function assignCardTints(
  cards: readonly TintCard[],
  slots: number,
  pinned: readonly PinnedTint[] = [],
): Map<string, number> {
  // First pass holds both rules. If that fails, neighbours become a strong
  // preference and only the art rule holds. If even that fails (more cards
  // share one picture than there are slots), every rule is a cost.
  return (
    walk(cards, slots, pinned, { neighbours: true, art: true }) ??
    walk(cards, slots, pinned, { neighbours: false, art: true }) ??
    walk(cards, slots, pinned, { neighbours: false, art: false })!
  );
}

function walk(
  cards: readonly TintCard[],
  slots: number,
  pinned: readonly PinnedTint[],
  hard: { neighbours: boolean; art: boolean },
): Map<string, number> | null {
  const out: number[] = [];
  let steps = 0;

  // A slot's cost for card i given cards 0..i-1: 0 when nothing objects,
  // or null when a hard rule forbids it.
  const cost = (i: number, slot: number): number | null => {
    let c = 0;
    const art = cards[i]!.art;
    const sameArt =
      pinned.some((p) => p.art === art && p.slot === slot) ||
      out.some((s, j) => s === slot && cards[j]!.art === art);
    if (sameArt) {
      if (hard.art) return null;
      c += 1000;
    }
    if (i > 0 && out[i - 1] === slot) {
      if (hard.neighbours) return null;
      c += 100;
    }
    for (const back of STACKED) if (i - back >= 0 && out[i - back] === slot) c += 1;
    return c;
  };

  const place = (i: number): boolean => {
    if (i === cards.length) return true;
    const options: { slot: number; c: number; uses: number }[] = [];
    for (let slot = 0; slot < slots; slot++) {
      const c = cost(i, slot);
      if (c !== null) options.push({ slot, c, uses: out.filter((s) => s === slot).length });
    }
    options.sort((a, b) => a.c - b.c || a.uses - b.uses || a.slot - b.slot);
    for (const { slot } of options) {
      if (++steps > STEP_BUDGET) return false;
      out[i] = slot;
      if (place(i + 1)) return true;
    }
    out.length = i;
    return false;
  };

  if (!place(0)) return null;
  return new Map(cards.map((card, i) => [card.id, out[i]!]));
}
