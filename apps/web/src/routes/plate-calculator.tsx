import { createFileRoute } from "@tanstack/react-router";
import {
  ContentHero,
  ContentSection,
  ContentShell,
  CtaBand,
  DataTable,
  LinkRows,
  Paragraphs,
} from "@/components/content/ContentParts";
import { FaqSection } from "@/components/strength/StrengthParts";
import { PlateCalculator } from "@/components/tools/PlateCalculator";
import { contentHead } from "@/lib/content-head";
import { PLATE_CALCULATOR as PAGE } from "@/lib/plate-calculator";

// /plate-calculator. Copy from docs/plate-calculator.json, verbatim, through
// lib/plate-calculator.ts. The calculator renders its default (135 lb on a
// 45 lb bar) on the server, so the answer is in the HTML before hydration.

export const Route = createFileRoute("/plate-calculator")({
  head: () =>
    contentHead({
      path: PAGE.path,
      title: PAGE.title,
      description: PAGE.description,
      crumb: PAGE.h1,
      faq: PAGE.faq,
    }),
  component: PlateCalculatorPage,
});

function PlateCalculatorPage() {
  return (
    <ContentShell>
      <ContentHero h1={PAGE.h1} lead={PAGE.lead} />
      <main className="flex-1 px-4 pb-16 sm:px-5">
        <div className="mx-auto w-full max-w-[1080px]">
          <div className="max-w-[760px]">
            <PlateCalculator defaultTarget={PAGE.defaultTarget} />

            {PAGE.sections.map((s) => (
              <ContentSection key={s.id} id={s.id} heading={s.heading}>
                <Paragraphs items={s.body} />
                {s.tables && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {s.tables.map((t) => (
                      <DataTable
                        key={t.caption}
                        caption={t.caption}
                        captionVisible
                        columns={t.columns}
                        rows={t.rows}
                      />
                    ))}
                  </div>
                )}
                {s.after && <Paragraphs items={s.after} />}
                {s.links && <LinkRows links={s.links} />}
              </ContentSection>
            ))}

            <FaqSection items={PAGE.faq} />
          </div>

          <CtaBand heading={PAGE.cta.label} body={PAGE.cta.body} campaign={PAGE.cta.campaign} />
        </div>
      </main>
    </ContentShell>
  );
}
