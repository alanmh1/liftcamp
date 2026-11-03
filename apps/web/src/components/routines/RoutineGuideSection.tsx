import { ArrowRight } from "lucide-react";
import type { RoutineSection } from "@/lib/routine-copy";

/** One guide section of a routine page: an H2 anchored on the section id,
 *  body paragraphs, the table, the after paragraphs, then a row of links.
 *  The H2, card border and pill match the rest of the routine page. */
export function RoutineGuideSection({
  section,
  className = "",
}: {
  section: RoutineSection;
  className?: string;
}) {
  const { id, heading, body, table, after, links } = section;
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className={`scroll-mt-16 ${className}`}>
      <h2
        id={`${id}-heading`}
        className="border-b border-border pb-4 text-[28px] font-bold leading-tight tracking-[-0.02em] text-foreground"
      >
        {heading}
      </h2>
      <Paragraphs items={body} className="mt-5" />

      {/* No min-width and no scroll box: two or three short columns wrap
          inside a phone screen, so the page never scrolls sideways. */}
      {table && (
        <div className="mt-5 max-w-[640px] overflow-hidden rounded-lg border border-border shadow-sm shadow-foreground/5">
          <table className="w-full border-collapse text-left text-[15px]">
            <thead>
              <tr>
                {table.columns.map((c) => (
                  <th
                    key={c}
                    scope="col"
                    className="bg-muted/60 px-3 py-2.5 align-bottom text-[13px] font-semibold text-foreground"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, r) => (
                <tr key={`${id}-row-${r}`}>
                  {row.map((cell, c) =>
                    c === 0 ? (
                      <th
                        key={c}
                        scope="row"
                        className="border-t border-border px-3 py-2.5 font-semibold text-foreground"
                      >
                        {cell}
                      </th>
                    ) : (
                      <td
                        key={c}
                        className={`border-t border-border px-3 py-2.5 ${
                          cell === "Rest" ? "text-muted-foreground" : "text-foreground"
                        }`}
                      >
                        {cell}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {after && <Paragraphs items={after} className="mt-5" />}

      {links && links.length > 0 && (
        <ul className="mt-5 flex flex-wrap gap-2">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-background px-4 py-1.5 text-[13px] font-semibold text-primary transition-colors hover:border-primary/50 hover:bg-accent"
              >
                {l.label}
                <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Paragraphs({ items, className }: { items: string[]; className: string }) {
  return (
    <div className={`flex max-w-[68ch] flex-col gap-3 ${className}`}>
      {items.map((p) => (
        <p key={p} className="text-[16px] leading-relaxed text-foreground">
          {p}
        </p>
      ))}
    </div>
  );
}
