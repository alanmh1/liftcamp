import type { ReactNode } from "react";

/** Front matter for a guide. Lives beside the prose as a typed export rather
 *  than YAML: no MDX toolchain, no Vite plugin, and the embeds below are React
 *  components that import normally instead of being wired into an MDX scope.
 *  Revisit if this ever passes ~20 guides. */
export type GuideMeta = {
  slug: string;
  title: string;
  /** Optional <title> override, for when the headline runs past ~49 characters
   *  and " | LiftCamp" would push the tag over 60. The headline (h1, JSON-LD,
   *  hub card) keeps title. */
  seoTitle?: string;
  /** One line under the title on the hub card and in the article header. */
  dek: string;
  /** <meta name="description">. Written separately from the dek: one is for a
   *  reader already on the page, the other is for a stranger in a SERP. */
  description: string;
  category: "Getting started" | "Programming" | "Technique";
  published: string;
  /** Set on every meaningful edit. Rendered next to the byline and emitted as
   *  dateModified. Fitness content that looks stale gets skipped. */
  updated: string;
  readMinutes: number;
  /** Anchor list for the table of contents. Authored, not scraped from the
   *  DOM: the article is a component tree, not a markdown string, so there is
   *  nothing to parse at build time. id must match the <Section id>. */
  toc: { id: string; label: string }[];
  /** Unpublished guides render at their URL for preview but stay out of the
   *  hub, the sitemap, and the index. Same shape as the has_notes rule on
   *  exercises: one flag, one mechanism. */
  draft?: boolean;
  /** Optional FAQ. Rendered in the body with <Faq> and emitted as FAQPage
   *  JSON-LD by the route from this one list. Plain text answers only. */
  faq?: { q: string; a: string }[];
  /** Optional hero image, also used as the social share image. Files are found
   *  by slug, not listed here: /guides/<slug>.webp (transparent, 2400x1260) is
   *  shown in the article header, and /guides/<slug>-og.png (flat, 1200x630)
   *  is the og:image and twitter:image. Both live in public/guides/. A guide
   *  without this field renders exactly as before and keeps the site default
   *  og-image.png.
   *
   *  fill: the image has its own full background (a gradient, say) and should
   *  cover its container edge to edge, instead of sitting padded and contained
   *  over the tinted tile. */
  hero?: { alt: string; fill?: boolean };
};

export type Guide = {
  meta: GuideMeta;
  Body: () => ReactNode;
};
