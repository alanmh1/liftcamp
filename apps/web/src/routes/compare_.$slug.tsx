import { createFileRoute, notFound } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import {
  ContentHero,
  ContentSection,
  ContentShell,
  CtaBand,
  DataTable,
  LinkRows,
  Paragraphs,
} from "@/components/content/ContentParts";
import { FaqSection, sectionHeading } from "@/components/strength/StrengthParts";
import { contentHead } from "@/lib/content-head";
import { COMPARE_CHECKED, comparePageFor, liftCampColumn, pageSources } from "@/lib/compare-pages";

// /compare/<slug> for the four pages in docs/compare-pages.json, through
// lib/compare-pages.ts. Copy verbatim. Any other slug 404s; there is no
// /compare index, so the breadcrumb is LiftCamp then the page.

export const Route = createFileRoute("/compare_/$slug")({
  loader: ({ params }) => {
    if (!comparePageFor(params.slug)) throw notFound();
    return { slug: params.slug };
  },
  head: ({ loaderData }) => {
    const page = loaderData ? comparePageFor(loaderData.slug) : undefined;
    if (!page) return {};
    return contentHead({
      path: page.path,
      title: page.title,
      description: page.description,
      crumb: page.h1,
      faq: page.faq,
    });
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-[660px] px-5 py-16">
      <p className="text-[15px] text-muted-foreground">That page doesn’t exist.</p>
    </div>
  ),
  component: ComparePage,
});

function ComparePage() {
  const { slug } = Route.useLoaderData();
  const page = comparePageFor(slug)!;
  const sources = pageSources(page);

  return (
    <ContentShell>
      <ContentHero h1={page.h1} lead={page.lead} />
      <main className="flex-1 px-4 pb-16 sm:px-5">
        <div className="mx-auto w-full max-w-[1080px]">
          <div className="max-w-[760px]">
            <DataTable
              caption={page.h1}
              columns={page.table.columns}
              rows={page.table.rows}
              highlight={liftCampColumn(page)}
              firstColumnWidth="w-[26%]"
            />

            {page.sections.map((s) => (
              <ContentSection key={s.id} id={s.id} heading={s.heading}>
                <Paragraphs items={s.body} />
              </ContentSection>
            ))}

            {page.links && <LinkRows links={page.links} />}

            <FaqSection items={page.faq} />

            <section className="mt-12" aria-labelledby="sources-heading">
              <h2 id="sources-heading" className={sectionHeading}>
                Sources
              </h2>
              <ul className="mt-4 space-y-2 p-0">
                {sources.map((s) => (
                  <li key={s.url} className="text-[15px]">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="nofollow noopener"
                      className="inline-flex items-start gap-1.5 font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {s.label}
                      <ExternalLink aria-hidden className="mt-1 h-3.5 w-3.5 shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[15px] text-muted-foreground">
                Prices checked {COMPARE_CHECKED}
              </p>
            </section>
          </div>

          <CtaBand heading="Try LiftCamp free on iPhone" campaign={`compare_${page.slug}`} />
        </div>
      </main>
    </ContentShell>
  );
}
