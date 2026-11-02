import type { ReactNode } from "react";
import { PRIMARY_TINT, SECONDARY_TINT } from "@liftcamp/shared";
import { MuscleDiagram, type DiagramMuscles } from "./MuscleDiagram";
import { EXERCISE_ART_HEIGHT, EXERCISE_ART_WIDTH } from "@/lib/exercise-art";

/**
 * Top of an exercise page: breadcrumb, name, muscle chips and equipment on the
 * left; the movement and the body diagrams on the right. The breadcrumb and
 * the animation are passed in so the route keeps owning their markup.
 *
 * When `art` is set (a Squatch render from lib/exercise-art.ts) it takes the
 * whole right column and the animation and diagrams are not rendered.
 */
export function DetailHeader({
  breadcrumb,
  name,
  primary,
  secondary,
  equipment,
  animation,
  muscles,
  art = null,
}: {
  breadcrumb: ReactNode;
  name: string;
  /** Display labels, already through muscleLabel(). */
  primary: string[];
  secondary: string[];
  equipment: string | null;
  animation: ReactNode;
  muscles: DiagramMuscles;
  art?: string | null;
}) {
  return (
    <header className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-40 -top-48 h-[520px] w-[520px] rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-pr/25 blur-3xl" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-ds-xl px-ds-lg pb-ds-2xl pt-ds-lg lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:pt-ds-xl">
        <div>
          {breadcrumb}

          <h1 className="mt-ds-md font-display text-5xl font-extrabold leading-none tracking-tight text-foreground md:text-6xl xl:text-display">
            {name}
          </h1>

          {(primary.length > 0 || secondary.length > 0) && (
            <ul aria-label="Muscles worked" className="mt-ds-lg flex flex-wrap gap-ds-sm p-0">
              {primary.map((m) => (
                <li
                  key={`p-${m}`}
                  className="rounded-full bg-accent px-ds-sm py-ds-xs font-caption text-caption text-accent-foreground"
                >
                  {m}
                </li>
              ))}
              {secondary.map((m) => (
                <li
                  key={`s-${m}`}
                  className="rounded-full bg-muted px-ds-sm py-ds-xs font-caption text-caption text-foreground"
                >
                  {m}
                </li>
              ))}
            </ul>
          )}

          {equipment && (
            <p className="mt-ds-md font-body text-body text-muted-foreground">
              <span className="font-label text-label text-foreground">Equipment</span>
              <span aria-hidden className="mx-ds-sm text-border">
                /
              </span>
              <span>{equipment}</span>
            </p>
          )}
        </div>

        {art ? (
          <div className="overflow-hidden rounded-xl border border-border shadow-sm">
            <img
              src={art}
              alt={`${name}, demonstrated`}
              width={EXERCISE_ART_WIDTH}
              height={EXERCISE_ART_HEIGHT}
              sizes="(min-width: 1024px) 55vw, 100vw"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="block aspect-[16/9] h-auto w-full object-cover"
            />
          </div>
        ) : (
          <div className="grid items-start gap-ds-md sm:grid-cols-2">
            <div className="overflow-hidden rounded-xl">{animation}</div>

            <figure className="m-0 flex flex-col rounded-xl border border-border bg-[radial-gradient(circle_at_50%_40%,var(--background),var(--muted))] p-ds-md">
              <div className="mx-auto w-full max-w-[280px]">
                <MuscleDiagram muscles={muscles} labels eager />
              </div>
              <figcaption className="mt-ds-sm flex flex-wrap items-center justify-center gap-ds-md border-t border-border pt-ds-sm">
                <span className="inline-flex items-center gap-ds-xs font-caption text-caption text-foreground">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: PRIMARY_TINT }}
                  />
                  Main muscle
                </span>
                <span className="inline-flex items-center gap-ds-xs font-caption text-caption text-foreground">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: SECONDARY_TINT }}
                  />
                  Also working
                </span>
              </figcaption>
            </figure>
          </div>
        )}
      </div>
    </header>
  );
}
