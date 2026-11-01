import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import type { GuideMeta } from "@/content/guides/types";

/** Guide cards, title over dek, the card the routine page's Read next section
 *  uses. Plain links, crawlable without JavaScript. */
export function GuideCardLinks({
  guides,
}: {
  guides: Pick<GuideMeta, "slug" | "title" | "dek">[];
}) {
  return (
    <ul className="mt-6 grid grid-cols-1 gap-4 p-0 sm:grid-cols-3">
      {guides.map((g) => (
        <li key={g.slug} className="flex">
          <Link
            to="/guides/$slug"
            params={{ slug: g.slug }}
            className="group flex w-full flex-col rounded-lg border border-border bg-background p-4 shadow-sm shadow-foreground/5 transition-[box-shadow,border-color] hover:border-primary/40 hover:shadow-lg hover:shadow-foreground/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-lg font-bold leading-snug text-foreground">{g.title}</p>
              <ArrowUpRight
                aria-hidden
                className="mt-1 h-4 w-4 shrink-0 text-foreground/50 group-hover:text-primary"
              />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{g.dek}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
