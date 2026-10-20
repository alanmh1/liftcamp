import { describe, expect, it } from "vitest";

import { assignCardTints, type TintCard } from "./card-tints";

const cards = (...arts: string[]): TintCard[] => arts.map((art, i) => ({ id: `c${i}`, art }));
const slotsOf = (list: TintCard[], map: Map<string, number>) => list.map((c) => map.get(c.id));

describe("assignCardTints", () => {
  it("never gives neighbours the same slot", () => {
    const list = cards(...Array.from({ length: 30 }, (_, i) => `art${i % 7}`));
    const slots = slotsOf(list, assignCardTints(list, 6));
    for (let i = 1; i < slots.length; i++) expect(slots[i]).not.toBe(slots[i - 1]);
  });

  it("never gives two cards with the same art the same slot", () => {
    // Six dumbbell cards spread through the grid, as the live routines have.
    const arts = ["bench", "db", "plates", "db", "press", "db", "db", "mat", "bands", "db", "rack", "db", "bar"];
    const list = cards(...arts);
    const map = assignCardTints(list, 6);
    const dumbbellSlots = list.filter((c) => c.art === "db").map((c) => map.get(c.id));
    expect(new Set(dumbbellSlots).size).toBe(6);
  });

  it("counts a pinned hero toward the same-art rule", () => {
    const list = cards("bench", "mat", "bench");
    const map = assignCardTints(list, 6, [{ art: "bench", slot: 0 }]);
    expect(map.get("c0")).not.toBe(0);
    expect(map.get("c2")).not.toBe(0);
    expect(map.get("c0")).not.toBe(map.get("c2"));
  });

  it("lets the same-art rule win when both cannot hold", () => {
    // Two slots: a and b must differ, the two a cards must differ, so the
    // third card matches its neighbour.
    const list = cards("a", "b", "a");
    const slots = slotsOf(list, assignCardTints(list, 2));
    expect(slots[0]).not.toBe(slots[2]);
    expect(slots[1]).toBe(slots[2]);
  });

  it("avoids the slot two and three back when it can", () => {
    const list = cards(...Array.from({ length: 12 }, (_, i) => `art${i}`));
    const slots = slotsOf(list, assignCardTints(list, 6));
    for (let i = 3; i < slots.length; i++) {
      expect(slots[i]).not.toBe(slots[i - 2]);
      expect(slots[i]).not.toBe(slots[i - 3]);
    }
  });

  it("uses every slot rather than repeating the first few", () => {
    const list = cards(...Array.from({ length: 12 }, (_, i) => `art${i}`));
    const slots = slotsOf(list, assignCardTints(list, 6));
    expect(new Set(slots).size).toBe(6);
  });

  it("gives the same slots for the same input, every time", () => {
    const list = cards("a", "b", "a", "c", "a", "d", "b", "b", "e");
    const first = assignCardTints(list, 6);
    for (let n = 0; n < 5; n++) expect(assignCardTints(list, 6)).toEqual(first);
  });

  it("still returns a slot for every card when more cards share an art than there are slots", () => {
    const list = cards("a", "a", "a", "a");
    const map = assignCardTints(list, 3);
    expect(map.size).toBe(4);
    for (const slot of map.values()) expect(slot).toBeGreaterThanOrEqual(0);
  });
});
