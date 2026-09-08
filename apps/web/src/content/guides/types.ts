import type { ReactNode } from "react";

/** Front matter for a guide. Lives beside the prose as a typed export rather
 *  than YAML: no MDX toolchain, no Vite plugin, and the embeds below are React
 *  components that import normally instead of being wired into an MDX scope.
 *  Revisit if this ever passes ~20 guides. */
export type GuideMeta = {
  slug: string;
  title: string;
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
};

export type Guide = {
  meta: GuideMeta;
  Body: () => ReactNode;
};
