// Head tags for the strength standards pages: title, description, canonical
// on the clean path (never the calculator's params), og tags, and JSON-LD
// (BreadcrumbList, FAQPage from the list the page renders, WebPage with the
// Organization publisher).

import { ORGANIZATION_ID, ORGANIZATION_SAME_AS } from "./brand";
import { metadataUrl } from "./metadata-base";
import { exerciseOgPath, OG_HEIGHT, OG_WIDTH } from "./og-images";
import type { FaqItem } from "./strength-pages";

const SITE = "https://liftcamp.app";

/** The hub's og:image is the squat's exercise card. */
export const HUB_OG_EXERCISE = "barbell-squat";

export function strengthHead({
  path,
  title,
  description,
  ogExerciseSlug,
  crumbs,
  faq,
}: {
  path: string;
  title: string;
  description: string;
  ogExerciseSlug: string;
  /** After "LiftCamp": each crumb's name and path. */
  crumbs: { name: string; path: string }[];
  faq: readonly FaqItem[];
}) {
  const url = `${SITE}${path}`;
  // A lift with no exercise card (overhead press today) takes the hub's.
  const ogPath = exerciseOgPath(ogExerciseSlug) ?? exerciseOgPath(HUB_OG_EXERCISE);
  const image = ogPath ? metadataUrl(ogPath) : null;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:type", content: "website" },
      ...(image
        ? [
            { property: "og:image", content: image },
            { property: "og:image:width", content: String(OG_WIDTH) },
            { property: "og:image:height", content: String(OG_HEIGHT) },
            { name: "twitter:image", content: image },
            { name: "twitter:card", content: "summary_large_image" },
          ]
        : []),
    ],
    links: [{ rel: "canonical", href: url }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "LiftCamp", item: SITE },
            ...crumbs.map((c, i) => ({
              "@type": "ListItem",
              position: i + 2,
              name: c.name,
              item: `${SITE}${c.path}`,
            })),
          ],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: title,
          description,
          url,
          ...(image ? { image } : {}),
          publisher: {
            "@type": "Organization",
            "@id": ORGANIZATION_ID,
            name: "LiftCamp",
            url: SITE,
            sameAs: ORGANIZATION_SAME_AS,
          },
        }),
      },
    ],
  };
}
