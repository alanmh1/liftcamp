import { muscleLabel } from "@liftcamp/shared";
import { REGION_META, REGION_MUSCLES } from "@/lib/muscle-regions";
import type { EquipmentGroup } from "@/lib/catalog-grouping";
import { submusclePageFor, type SubmusclePage as SubmusclePageData } from "@/lib/submuscle-pages";
import type { PublicRoutineSummary } from "@/lib/public-catalog.functions";
import { RoutineCard } from "@/components/routines/RoutineGrid";
import { ExerciseCard, type CardExercise } from "./ExerciseCard";
import { Breadcrumb, HubHero, HubShell, LinkBand, RowList, regionLabel } from "./HubParts";

export type StartWith = { exercise: CardExercise; note: string | null };

/** /exercises/lats and the other 13: the muscle's hub section as its own page,
 *  with authored intro copy, a "Start with" row and the list split by
 *  equipment. */
export function SubmusclePage({
  page,
  total,
  start,
  groups,
  routine,
  counts,
}: {
  page: SubmusclePageData;
  total: number;
  start: StartWith[];
  groups: EquipmentGroup[];
  routine: { summary: PublicRoutineSummary; tint: string } | null;
  counts: Record<string, number>;
}) {
  const parent = page.parent;
  const parentLabel = regionLabel(parent);
  const listName = page.h1.toLowerCase();

  return (
    <HubShell>
      <HubHero
        breadcrumb={
          <Breadcrumb items={[{ label: parentLabel, slug: parent }]} current={page.label} />
        }
        h1={page.h1}
        intro={page.intro}
        count={`${total} exercises.`}
      />

      {start.length > 0 && (
        <section aria-labelledby="start-heading" className="mx-auto max-w-7xl px-ds-lg pb-ds-2xl">
          <p className="font-label text-label uppercase tracking-widest text-primary">
            Explained in full
          </p>
          <h2
            id="start-heading"
            className="mt-ds-xs font-heading text-3xl font-extrabold tracking-tight text-foreground md:text-4xl"
          >
            Start with
          </h2>
          <ul className="mt-ds-lg grid gap-ds-md p-0 sm:grid-cols-2 lg:grid-cols-3">
            {start.map((s) => (
              <li key={s.exercise.slug}>
                <ExerciseCard exercise={s.exercise} note={s.note} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="list-heading" className="mx-auto max-w-4xl px-ds-lg pb-ds-2xl">
        <h2
          id="list-heading"
          className="font-heading text-3xl font-extrabold tracking-tight text-foreground md:text-4xl"
        >
          All {total} {listName}
        </h2>
        {groups.length > 1 && (
          <ul className="mt-ds-md flex flex-wrap gap-ds-xs p-0">
            {groups.map((g) => (
              <li key={g.key}>
                <a
                  href={`#${g.key}`}
                  className="inline-flex items-center gap-ds-xs rounded-full border border-border bg-background px-ds-md py-ds-sm font-label text-label text-foreground hover:border-primary hover:text-primary"
                >
                  {g.label}
                  <span className="font-caption text-caption tabular-nums text-muted-foreground">
                    {g.rows.length}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
        {groups.map((g) => (
          <section
            key={g.key}
            id={g.key}
            aria-labelledby={`${g.key}-heading`}
            className="mt-ds-xl scroll-mt-24"
          >
            <h3 id={`${g.key}-heading`} className="font-heading text-xl font-bold text-foreground">
              {g.label}{" "}
              <span className="font-caption text-caption font-normal tabular-nums text-muted-foreground">
                {g.rows.length}
              </span>
            </h3>
            <RowList rows={g.rows} showMuscle={false} />
          </section>
        ))}
      </section>

      {routine && (
        <section aria-labelledby="routine-heading" className="mx-auto max-w-4xl px-ds-lg pb-ds-2xl">
          <h2
            id="routine-heading"
            className="font-heading text-3xl font-extrabold tracking-tight text-foreground md:text-4xl"
          >
            A routine built around them
          </h2>
          <div className="mt-ds-lg flex max-w-sm">
            <RoutineCard routine={routine.summary} tint={routine.tint} />
          </div>
        </section>
      )}

      <LinkBand
        groups={[
          {
            id: "sibling-muscles",
            title: `Other ${parentLabel.toLowerCase()} muscles`,
            links: [
              // The parent hub's sections, so abs links to lower back too.
              ...REGION_MUSCLES[parent]
                .map(submusclePageFor)
                .filter((p) => p !== undefined && p.slug !== page.slug)
                .map((p) => ({
                  label: muscleLabel(p!.muscle),
                  slug: p!.slug,
                  count: counts[p!.slug],
                })),
              {
                label: `All ${REGION_META[parent].h1.toLowerCase()}`,
                slug: parent,
                count: counts[parent],
                primary: true,
              },
            ],
          },
        ]}
      />
    </HubShell>
  );
}
