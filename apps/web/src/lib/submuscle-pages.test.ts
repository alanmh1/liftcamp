import { describe, expect, it } from "vitest";
import { CANONICAL_MUSCLES } from "@liftcamp/shared";
import { SUBMUSCLE_PAGES, submusclePageFor, submusclePages } from "./submuscle-pages";
import {
  MUSCLE_REGION,
  MUSCLE_SLUG_REDIRECTS,
  REGIONS,
  REGION_MUSCLES,
  muscleAnchor,
} from "./muscle-regions";
import { EQUIPMENT_PAGES } from "./equipment-pages";

describe("submuscle pages", () => {
  it("covers every muscle except the two hubs and neck", () => {
    const without = CANONICAL_MUSCLES.filter((m) => !submusclePageFor(m));
    expect(without.sort()).toEqual(["chest", "neck", "shoulders"]);
    expect(submusclePages()).toHaveLength(14);
  });

  it("uses the hub anchor as the slug, so one string is both", () => {
    for (const p of submusclePages()) expect(p.slug).toBe(muscleAnchor(p.muscle));
  });

  it("claims no region, equipment or redirect slug", () => {
    for (const slug of Object.keys(SUBMUSCLE_PAGES)) {
      expect(REGIONS as readonly string[]).not.toContain(slug);
      expect(EQUIPMENT_PAGES[slug]).toBeUndefined();
      expect(MUSCLE_SLUG_REDIRECTS[slug]).toBeUndefined();
    }
  });

  it("parents each page on the region its breadcrumb names, with a section there", () => {
    for (const p of submusclePages()) {
      expect(p.parent).toBe(MUSCLE_REGION[p.muscle]);
      expect(REGION_MUSCLES[p.parent]).toContain(p.muscle);
    }
    expect(SUBMUSCLE_PAGES["lower-back"]!.parent).toBe("back");
  });

  it("has two intro paragraphs, a start row and a count in the description", () => {
    for (const p of submusclePages()) {
      expect(p.intro).toHaveLength(2);
      expect(p.start.length).toBeGreaterThan(0);
      expect(p.description(39)).toMatch(/^39 /);
      expect(p.intro.join(" ")).not.toMatch(/—/);
    }
  });
});
