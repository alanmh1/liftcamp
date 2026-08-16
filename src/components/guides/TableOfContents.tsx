import type { GuideMeta } from "@/content/guides/types";

/** Sticky rail on desktop, plain list under the intro on mobile. Rendered from
 *  authored meta.toc rather than scraped headings: the article is a component
 *  tree, so there is no markdown string to parse. */
export function TableOfContents({ toc }: { toc: GuideMeta["toc"] }) {
  if (toc.length === 0) return null;
  return (
    <nav aria-label="On this page">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        On this page
      </p>
      <ul className="mt-2 space-y-1.5 p-0">
        {toc.map((t) => (
          <li key={t.id}>
            <a href={`#${t.id}`} className="text-[14px] text-muted-foreground hover:text-foreground">
              {t.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
