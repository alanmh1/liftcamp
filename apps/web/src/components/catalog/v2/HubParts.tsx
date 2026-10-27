import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { CatalogRow } from "@/lib/public-catalog.functions";
import { CatalogHeader } from "@/components/catalog/CatalogHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ListRow } from "./ExerciseList";

// The pieces the region, equipment and sub-muscle pages share, cut from the
// /exercises library page so all three sit on the Highland design: the hero
// with its two soft blobs, the bordered list of library rows, and the muted
// band of link chips the library's Browse section uses.

/** Full-bleed page with the site header and footer. */
export function HubShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex min-h-dvh flex-col bg-background"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      <CatalogHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

export type Crumb = { label: string; slug?: string };

/** Visible breadcrumb. Items with a slug link to /exercises/<slug>; the first
 *  item is always /exercises. Matches the BreadcrumbList JSON-LD item for item. */
export function Breadcrumb({ items, current }: { items: Crumb[]; current: string }) {
  const link = "underline-offset-4 hover:underline";
  return (
    <nav aria-label="Breadcrumb" className="font-caption text-caption text-muted-foreground">
      <Link to="/exercises" className={link}>
        Exercises
      </Link>
      {items.map((c) => (
        <span key={c.label}>
          <span aria-hidden> › </span>
          <Link to="/exercises/$slug" params={{ slug: c.slug! }} className={link}>
            {c.label}
          </Link>
        </span>
      ))}
      <span aria-hidden> › </span>
      <span aria-current="page">{current}</span>
    </nav>
  );
}

/** Breadcrumb, H1 and intro, on the library hero's background. */
export function HubHero({
  breadcrumb,
  h1,
  intro,
  count,
  children,
}: {
  breadcrumb: ReactNode;
  h1: string;
  intro: readonly string[];
  /** The line under the intro, e.g. "39 exercises." */
  count: string;
  children?: ReactNode;
}) {
  return (
    <header className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-40 -top-48 h-[520px] w-[520px] rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-pr/25 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-ds-lg pb-ds-xl pt-ds-lg md:pt-ds-xl">
        {breadcrumb}
        <h1 className="mt-ds-md font-display text-5xl font-extrabold leading-none tracking-tight text-foreground md:text-6xl">
          {h1}
        </h1>
        {intro.map((p, i) => (
          <p
            key={i}
            className="mt-ds-md max-w-2xl font-body text-xl leading-relaxed text-muted-foreground"
          >
            {p}
          </p>
        ))}
        <p className="mt-ds-md font-caption text-caption tabular-nums text-muted-foreground">
          {count}
        </p>
        {children}
      </div>
    </header>
  );
}

/** Every row, no collapse: a crawler never clicks "Show all". */
export function RowList({ rows, showMuscle = true }: { rows: CatalogRow[]; showMuscle?: boolean }) {
  return (
    <ul className="mt-ds-sm divide-y divide-border overflow-hidden rounded-lg border border-border p-0">
      {rows.map((row) => (
        <ListRow key={row.slug} row={row} showMuscle={showMuscle} />
      ))}
    </ul>
  );
}

export type ChipLink = { label: string; slug: string; count?: number; primary?: boolean };

/** A muted band of link chips, the library Browse section's look. */
export function LinkBand({
  groups,
}: {
  groups: { id: string; title: string; links: ChipLink[] }[];
}) {
  return (
    <section className="border-t border-border bg-muted/60 py-ds-2xl">
      <div className="mx-auto max-w-7xl space-y-ds-xl px-ds-lg">
        {groups.map((g) => (
          <div key={g.id}>
            <h2
              id={g.id}
              className="font-heading text-2xl font-extrabold tracking-tight text-foreground md:text-3xl"
            >
              {g.title}
            </h2>
            <ul aria-labelledby={g.id} className="mt-ds-md flex flex-wrap gap-ds-sm p-0">
              {g.links.map((l) => (
                <li key={l.slug}>
                  <Link
                    to="/exercises/$slug"
                    params={{ slug: l.slug }}
                    className={
                      l.primary
                        ? "inline-flex items-center gap-ds-xs rounded-full bg-primary px-ds-md py-ds-sm font-label text-label text-primary-foreground hover:bg-primary/90"
                        : "inline-flex items-center gap-ds-xs rounded-full border border-border bg-background px-ds-md py-ds-sm font-label text-label text-foreground hover:border-primary hover:text-primary"
                    }
                  >
                    {l.label}
                    {l.count !== undefined && (
                      <span
                        className={
                          l.primary
                            ? "font-caption text-caption tabular-nums text-primary-foreground/75"
                            : "font-caption text-caption tabular-nums text-muted-foreground"
                        }
                      >
                        {l.count}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

export function regionLabel(region: string): string {
  return region.charAt(0).toUpperCase() + region.slice(1);
}
