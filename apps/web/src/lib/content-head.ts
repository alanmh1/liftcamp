// Head tags for a hand-written public page that is not a guide: the plate
// calculator and the comparison pages. Title and description verbatim,
// canonical on the clean path, og tags with the site's default image (set
// in __root), and JSON-LD: BreadcrumbList, FAQPage from the list the page
// renders, and a WebPage with the Organization publisher. Same shapes as
// strength-head.ts.

import { ORGANIZATION_ID, ORGANIZATION_SAME_AS } from "./brand";

const SITE = "https://liftcamp.app";

export function contentHead({
  path,
  title,
  description,
  crumb,
  faq,
}: {
  path: string;
  title: string;
  description: string;
  /** The page's name in the BreadcrumbList, after "LiftCamp". */
  crumb: string;
  faq: readonly { q: string; a: string }[];
}) {
  const url = `${SITE}${path}`;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:type", content: "website" },
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
            { "@type": "ListItem", position: 2, name: crumb, item: url },
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
