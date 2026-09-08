import { Link } from "@tanstack/react-router";
import { AUTHORED_SLUGS, type GuideLinkSlug } from "./ExerciseLink";

/** Block-level exercise embed. Same row shape as CatalogSearch and RegionPage
 *  on purpose: a third list row in the codebase would drift from the other two
 *  inside a month. Name and equipment are passed in rather than fetched, so a
 *  guide stays a static component tree with no loader. */
export function ExerciseList({
  items,
}: {
  items: { slug: GuideLinkSlug; name: string; note: string }[];
}) {
  return (
    <ul className="mt-6 p-0">
      {items.map((it) => (
        <li key={it.slug} className="border-b border-border">
          <Link
            to="/exercises/$slug"
            params={{ slug: it.slug }}
            className="flex items-center gap-3 py-3 text-[15px] lg:text-base"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{it.name}</span>
              <span className="mt-0.5 block text-[13px] text-muted-foreground lg:text-sm">
                {it.note}
              </span>
            </span>
            <span aria-hidden className="text-muted-foreground">
              ›
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export const AUTHORED_SET: ReadonlySet<string> = new Set(AUTHORED_SLUGS);
