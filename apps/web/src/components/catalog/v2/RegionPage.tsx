import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { muscleLabel, type CanonicalMuscle } from "@liftcamp/shared";
import { REGIONS, REGION_META, REGION_FAQ, muscleAnchor, type Region } from "@/lib/muscle-regions";
import type { MuscleSection } from "@/lib/catalog-grouping";
import { submusclePageFor } from "@/lib/submuscle-pages";
import { Breadcrumb, HubHero, HubShell, LinkBand, RowList, regionLabel } from "./HubParts";

// One-line, plain-language description per muscle. Beginner copy, not anatomy.
const MUSCLE_BLURB: Readonly<Record<CanonicalMuscle, string>> = {
  chest:
    "The muscles across the front of your ribcage. Everything that pushes a weight away from you.",
  lats: "The broad muscles down the sides of your back. Everything that pulls a weight toward you or pulls you toward a bar.",
  "upper back":
    "Between and around your shoulder blades. Rows and pulls that finish with your elbows behind you.",
  "lower back":
    "The muscles running either side of your spine. Hinges, extensions and anything that resists rounding.",
  traps:
    "From your neck out to your shoulders. Shrugs, carries and anything heavy held in your hands.",
  shoulders: "The caps on the outside of your arms. Presses overhead and raises out to the side.",
  neck: "Direct neck work. A small section, mostly useful for contact sports.",
  biceps: "The front of your upper arm. Every curl and most pulling movements.",
  triceps: "The back of your upper arm. Extensions, dips and every press.",
  forearms: "Wrists, grip and the muscles below your elbow. Carries, holds and curls.",
  quads: "The front of your thighs. Every squat, lunge and press.",
  hamstrings: "The back of your thighs. Hinges, curls and deadlift variations.",
  glutes: "Your hips and backside. Thrusts, bridges, hinges and deep squats.",
  calves: "Below the knee, at the back. Raises with straight or bent legs.",
  adductors: "Inner thigh. Movements that pull your legs toward the midline.",
  abductors: "Outer hip. Movements that push your legs away from the midline.",
  abs: "The front of your midsection. Crunches, bracing and anti-rotation work.",
};

/** A muscle hub: /exercises/back and the other five. One anchored section
 *  per muscle; a muscle with its own page links its heading there. */
export function RegionPage({
  region,
  sections,
  total,
  counts,
}: {
  region: Region;
  sections: MuscleSection[];
  total: number;
  counts: Record<Region, number>;
}) {
  const meta = REGION_META[region];
  const label = regionLabel(region);
  const multi = sections.length > 1;

  return (
    <HubShell>
      <HubHero
        breadcrumb={<Breadcrumb items={[]} current={label} />}
        h1={meta.h1}
        intro={[meta.intro]}
        count={`${total} exercises across ${sections.length} ${sections.length === 1 ? "section" : "sections"}.`}
      >
        {/* Chips jump to the sections below. They do not filter, so there is
            no empty-result state and the page stays one crawlable document. */}
        {multi && (
          <ul className="mt-ds-lg flex flex-wrap gap-ds-xs p-0">
            {sections.map((s) => (
              <li key={s.muscle}>
                <a
                  href={`#${muscleAnchor(s.muscle)}`}
                  className="inline-flex items-center gap-ds-xs rounded-full border border-border bg-background px-ds-md py-ds-sm font-label text-label text-foreground hover:border-primary hover:text-primary"
                >
                  {muscleLabel(s.muscle)}
                  <span className="font-caption text-caption tabular-nums text-muted-foreground">
                    {s.rows.length}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </HubHero>

      <div className="mx-auto max-w-4xl px-ds-lg pb-ds-2xl">
        {sections.map((s) => (
          <Section key={s.muscle} section={s} />
        ))}

        <section id="faq" aria-labelledby="faq-heading" className="mt-ds-2xl scroll-mt-24">
          <h2
            id="faq-heading"
            className="font-heading text-3xl font-extrabold tracking-tight text-foreground md:text-4xl"
          >
            Common questions about {label.toLowerCase()} training
          </h2>
          <dl className="mt-ds-md">
            {REGION_FAQ[region].map((item) => (
              <div key={item.q} className="border-b border-border py-ds-md">
                <dt className="font-heading text-xl font-bold text-foreground">{item.q}</dt>
                <dd className="mt-ds-xs font-body text-body text-muted-foreground">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <LinkBand
        groups={[
          {
            id: "other-regions",
            title: "Other muscle groups",
            links: REGIONS.filter((r) => r !== region).map((r) => ({
              label: regionLabel(r),
              slug: r,
              count: counts[r],
            })),
          },
        ]}
      />
    </HubShell>
  );
}

function Section({ section }: { section: MuscleSection }) {
  const page = submusclePageFor(section.muscle);
  const name = muscleLabel(section.muscle);
  return (
    <section id={muscleAnchor(section.muscle)} className="mt-ds-2xl scroll-mt-24">
      <div className="flex flex-wrap items-baseline justify-between gap-ds-sm">
        <h2 className="font-heading text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
          {page ? (
            <Link
              to="/exercises/$slug"
              params={{ slug: page.slug }}
              className="decoration-2 underline-offset-[6px] hover:text-primary hover:underline"
            >
              {name}
            </Link>
          ) : (
            name
          )}{" "}
          <span className="font-caption text-caption font-normal tabular-nums text-muted-foreground">
            {section.rows.length}
          </span>
        </h2>
        {page && (
          <Link
            to="/exercises/$slug"
            params={{ slug: page.slug }}
            className="inline-flex items-center gap-ds-xs font-label text-label text-primary hover:underline"
          >
            {page.h1} <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
        )}
      </div>
      <p className="mt-ds-xs max-w-2xl font-body text-body text-muted-foreground">
        {MUSCLE_BLURB[section.muscle]}
      </p>

      {section.rows.length === 0 ? (
        <p className="mt-ds-sm font-body text-body text-muted-foreground">Nothing here yet.</p>
      ) : (
        <RowList rows={section.rows} showMuscle={false} />
      )}
    </section>
  );
}
