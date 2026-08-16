import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { formatEquipmentLabel } from "@/lib/exercise-visuals";
import { muscleLabel, type CanonicalMuscle } from "@/lib/muscle-vocab";
import {
  REGIONS,
  REGION_META,
  muscleAnchor,
  type Region,
} from "@/lib/muscle-regions";
import type { MuscleSection } from "@/lib/catalog-grouping";

// One-line, plain-language description per muscle. Beginner copy, not anatomy.
const MUSCLE_BLURB: Readonly<Record<CanonicalMuscle, string>> = {
  chest: "The muscles across the front of your ribcage. Everything that pushes a weight away from you.",
  lats: "The broad muscles down the sides of your back. Everything that pulls a weight toward you or pulls you toward a bar.",
  "upper back": "Between and around your shoulder blades. Rows and pulls that finish with your elbows behind you.",
  "lower back": "The muscles running either side of your spine. Hinges, extensions and anything that resists rounding.",
  traps: "From your neck out to your shoulders. Shrugs, carries and anything heavy held in your hands.",
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

const PAGE_SIZE = 8;

function titleCase(v: string | null) {
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : null;
}

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
  const label = region.charAt(0).toUpperCase() + region.slice(1);
  const others = REGIONS.filter((r) => r !== region);
  // 6e rail density: 1-4 anchors keep two cards with dividers; 5+ merge into a
  // single tighter card with the other regions inline below a hairline. Legs is
  // the only page over the line today.
  const dense = sections.length >= 5;

  return (
    <div
      className="min-h-dvh bg-background"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      <div className="mx-auto grid max-w-[1080px] gap-10 px-5 py-10 lg:grid-cols-[minmax(0,1fr)_240px]">

        <main>
          <nav aria-label="Breadcrumb" className="text-[13px] text-muted-foreground">
            <Link to="/exercises" className="underline-offset-4 hover:underline">
              Exercises
            </Link>
            <span aria-hidden> › </span>
            <span aria-current="page">{label}</span>
          </nav>

          <h1 className="mt-2 text-3xl font-bold tracking-tight lg:text-4xl">{meta.h1}</h1>
          <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground lg:text-base">
            {meta.intro}
          </p>
          <p className="mt-2 text-[13px] text-muted-foreground lg:text-sm">
            {total} exercises across {sections.length}{" "}
            {sections.length === 1 ? "section" : "sections"}.
          </p>

          {/* Chips jump to the sections below. They do not filter, so there is no
              empty-result state and the page stays one crawlable document. */}
          <ul className="mt-5 flex flex-wrap gap-2 p-0">
            {sections.map((s) => (
              <li key={s.muscle}>
                <a
                  href={`#${muscleAnchor(s.muscle)}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3.5 py-2 text-sm font-semibold lg:text-[15px] text-secondary-foreground"
                >
                  {muscleLabel(s.muscle)}
                  <span className="font-mono text-[12px] font-medium opacity-70">
                    {s.rows.length}
                  </span>
                </a>
              </li>
            ))}
          </ul>

          {sections.map((s) => (
            <Section key={s.muscle} section={s} />
          ))}
        </main>

        <aside className="hidden lg:block">
          <div className="sticky top-6">
            {dense ? (
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  On this page
                </p>
                <ul className="mt-2 p-0">
                  {sections.map((s) => (
                    <li key={s.muscle}>
                      <a
                        href={`#${muscleAnchor(s.muscle)}`}
                        className="flex items-center justify-between py-2 text-[15px] hover:underline"
                      >
                        <span>{muscleLabel(s.muscle)}</span>
                        <span className="font-mono text-[13px] text-muted-foreground">
                          {s.rows.length}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
                <div className="my-3 h-px bg-border" />
                <ul className="flex flex-wrap gap-x-3 gap-y-1 p-0 text-[15px]">
                  {others.map((r) => (
                    <li key={r}>
                      <Link
                        to="/exercises/$slug"
                        params={{ slug: r }}
                        className="text-muted-foreground hover:underline"
                      >
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    On this page
                  </p>
                  <ul className="mt-2 divide-y divide-border p-0">
                    {sections.map((s) => (
                      <li key={s.muscle}>
                        <a
                          href={`#${muscleAnchor(s.muscle)}`}
                          className="flex items-center justify-between py-[9px] text-[15px] hover:underline"
                        >
                          <span>{muscleLabel(s.muscle)}</span>
                          <span className="font-mono text-[13px] text-muted-foreground">
                            {s.rows.length}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-3 rounded-xl border border-border p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Other muscle groups
                  </p>
                  <ul className="mt-2 divide-y divide-border p-0">
                    {others.map((r) => (
                      <li key={r}>
                        <Link
                          to="/exercises/$slug"
                          params={{ slug: r }}
                          className="block py-[9px] text-[15px] hover:underline"
                        >
                          {r.charAt(0).toUpperCase() + r.slice(1)}{" "}
                          <span className="font-mono text-[13px] text-muted-foreground">
                            {counts[r]}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

// Every row is in the server-rendered HTML. The overflow is hidden with
// `display:none`, not unmounted: a crawler never clicks "Show all", so slicing
// the array left 76 of 84 chest links with no path in from anywhere. Hidden
// links are still discovered and followed.
function Section({ section }: { section: MuscleSection }) {
  const [expanded, setExpanded] = useState(false);
  const collapsed = !expanded && section.rows.length > PAGE_SIZE;

  return (
    <section id={muscleAnchor(section.muscle)} className="mt-10 scroll-mt-6">
      <div className="flex items-baseline gap-2">
        <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">{muscleLabel(section.muscle)}</h2>
        <span className="font-mono text-[13px] text-muted-foreground">{section.rows.length}</span>
      </div>
      <p className="mt-1 max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground lg:text-base">
        {MUSCLE_BLURB[section.muscle]}
      </p>

      {section.rows.length === 0 ? (
        <p className="mt-3 text-[15px] text-muted-foreground">Nothing here yet.</p>
      ) : (
        <>
          <ul className="mt-3 p-0">
            {section.rows.map((row, i) => (
              <li
                key={row.slug}
                className={
                  collapsed && i >= PAGE_SIZE ? "hidden" : "border-b border-border"
                }
              >
                {/* Metadata drops to its own line below the name on phones —
                    at 390px it used to crowd or wrap against the name — and
                    sits inline on the right from `lg` up, where there is room. */}
                <Link
                  to="/exercises/$slug"
                  params={{ slug: row.slug }}
                  className="flex items-center gap-3 py-3 text-[15px] lg:py-3.5 lg:text-base"
                >
                  <span className="min-w-0 flex-1 lg:flex lg:items-baseline lg:justify-between lg:gap-3">
                    <span className="block font-medium">{row.name}</span>
                    <span className="mt-0.5 block text-[13px] text-muted-foreground lg:mt-0 lg:shrink-0 lg:text-sm">
                      {[row.equipment && formatEquipmentLabel(row.equipment), titleCase(row.level)]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span aria-hidden className="text-muted-foreground">
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {collapsed && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="mt-3 h-9 rounded-lg border border-border px-4 text-[15px] font-medium"
            >
              Show all {section.rows.length}
            </button>
          )}
        </>
      )}
    </section>
  );
}
