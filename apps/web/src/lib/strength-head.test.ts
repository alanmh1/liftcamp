import { describe, expect, it, vi } from "vitest";

// Defined by vite.config.ts at build time; vitest does not run that define.
vi.hoisted(() => {
  (globalThis as Record<string, unknown>).__LC_METADATA_BASE__ = "https://liftcamp.app";
});
import { exerciseOgPath } from "./og-images";
import { HUB_OG_EXERCISE, strengthHead } from "./strength-head";

const ogImage = (slug: string) =>
  strengthHead({
    path: "/strength-standards/x",
    title: "t",
    description: "d",
    ogExerciseSlug: slug,
    crumbs: [],
    faq: [],
  }).meta.find((m) => "property" in m && m.property === "og:image");

describe("strengthHead", () => {
  it("uses the exercise's card when it has one", () => {
    expect(ogImage("barbell-bench-press")?.content).toContain(
      "/og/exercises/barbell-bench-press.jpg",
    );
  });

  it("falls back to the hub's card for a lift with none", () => {
    expect(exerciseOgPath("standing-military-press")).toBeNull();
    expect(ogImage("standing-military-press")?.content).toContain(
      `/og/exercises/${HUB_OG_EXERCISE}.jpg`,
    );
  });
});
