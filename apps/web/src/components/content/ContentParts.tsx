import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { AppStoreBadge } from "@/components/AppStoreBadge";
import { CatalogHeader } from "@/components/catalog/CatalogHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { sectionHeading } from "@/components/strength/StrengthParts";
import { cn } from "@/lib/utils";
import { PageGlow } from "@/components/PageGlow";

// The pieces the plate calculator and the comparison pages share, on the
// Highland layout of the strength standards pages: full-bleed shell with the
// site header and footer, the hero with two soft blobs, 1080px column,
// section headings, a table that fits a phone, link rows and the plate blue
// CTA band.

export function ContentShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex min-h-dvh flex-col bg-background"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      <CatalogHeader />
      {children}
      <SiteFooter />
    </div>
  );
}

export function ContentHero({ h1, lead }: { h1: string; lead: string }) {
  return (
    <header className="relative overflow-hidden">
      <PageGlow />
      <div className="relative mx-auto w-full max-w-[1080px] px-4 pb-8 pt-12 sm:px-5 sm:pt-16 lg:pb-10 lg:pt-20">
        <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">{h1}</h1>
        <p className="mt-3 max-w-[72ch] text-[16px] leading-relaxed text-muted-foreground lg:text-[17px]">
          {lead}
        </p>
      </div>
    </header>
  );
}

export function ContentSection({
  id,
  heading,
  children,
}: {
  id: string;
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-12" id={id} aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className={sectionHeading}>
        {heading}
      </h2>
      {children}
    </section>
  );
}

export function Paragraphs({ items }: { items: readonly string[] }) {
  return (
    <>
      {items.map((p) => (
        <p key={p} className="mt-4 text-[16px] leading-relaxed text-foreground/80 lg:text-[17px]">
          {p}
        </p>
      ))}
    </>
  );
}

const th = "bg-muted/60 px-3 py-2.5 align-bottom text-[13px] font-semibold text-foreground";
const td = "border-t border-border px-3 py-2.5 align-top";

/**
 * A real table that fits a phone: fixed layout at full width, so long cells
 * wrap instead of pushing the page sideways. `highlight` is a column index
 * to tint, the LiftCamp column on the comparison pages. Column 0 is the row
 * header. An empty header cell is announced as nothing, which is what the
 * label column of a comparison wants.
 */
export function DataTable({
  caption,
  captionVisible = false,
  columns,
  rows,
  highlight,
  firstColumnWidth,
}: {
  caption: string;
  captionVisible?: boolean;
  columns: readonly string[];
  rows: readonly (readonly string[])[];
  highlight?: number;
  /** Tailwind width class for the row header column, e.g. "w-[28%]". */
  firstColumnWidth?: string;
}) {
  const tint = (i: number) => i === highlight && "bg-primary/[0.06]";
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-border">
      <table className="w-full table-fixed border-collapse text-left text-[14px] leading-snug tabular-nums sm:text-[15px]">
        <caption
          className={cn(
            captionVisible
              ? "caption-top border-b border-border bg-background px-3 py-2.5 text-left text-[15px] font-semibold text-foreground"
              : "sr-only",
          )}
        >
          {caption}
        </caption>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th
                key={i}
                scope="col"
                className={cn(
                  th,
                  i === 0 && firstColumnWidth,
                  i === highlight && "bg-primary/10 text-primary",
                )}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]}>
              {row.map((cell, i) =>
                i === 0 ? (
                  <th key={i} scope="row" className={cn(td, "break-words font-semibold", tint(i))}>
                    {cell}
                  </th>
                ) : (
                  <td key={i} className={cn(td, "break-words text-foreground/85", tint(i))}>
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Rows of internal links, the look of "Other lifts". Plain anchors: the
 *  hrefs come from JSON, not from the typed route tree. */
export function LinkRows({ links }: { links: readonly { label: string; href: string }[] }) {
  return (
    <ul className="mt-4 border-t border-border p-0">
      {links.map((l) => (
        <li key={l.href} className="border-b border-border">
          <a
            href={l.href}
            className="flex items-center gap-3 py-3 text-[16px] font-medium hover:text-primary"
          >
            <span className="min-w-0 flex-1">{l.label}</span>
            <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
          </a>
        </li>
      ))}
    </ul>
  );
}

/** The plate blue band other public pages close on, with its own campaign. */
export function CtaBand({
  heading,
  body,
  campaign,
}: {
  heading: string;
  body?: string;
  campaign: string;
}) {
  return (
    <div className="relative mt-12 overflow-hidden rounded-2xl bg-primary px-6 py-10 text-primary-foreground sm:px-10 sm:py-12">
      <div className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-primary-foreground/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-primary-foreground/10 blur-3xl" />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between sm:gap-10">
        <div className="max-w-[46ch]">
          <h2 className="text-[28px] font-bold leading-tight tracking-[-0.02em]">{heading}</h2>
          {body && (
            <p className="mt-3 text-base leading-relaxed text-primary-foreground/85">{body}</p>
          )}
        </div>
        <div className="shrink-0">
          <AppStoreBadge tone="white" height={48} campaign={campaign} />
        </div>
      </div>
    </div>
  );
}
