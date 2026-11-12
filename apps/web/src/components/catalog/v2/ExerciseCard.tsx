import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { formatEquipmentLabel, muscleLabel } from "@liftcamp/shared";
import type { CatalogRow } from "@/lib/public-catalog.functions";
import { rowMuscles } from "@/lib/catalog-grouping";
import { MuscleDiagram } from "./MuscleDiagram";
import { LevelChip } from "./LevelChip";
import { EXERCISE_ART_HEIGHT, EXERCISE_ART_WIDTH, exerciseArtUrl } from "@/lib/exercise-art";

export type CardExercise = Pick<
  CatalogRow,
  | "slug"
  | "name"
  | "equipment"
  | "level"
  | "image_url"
  | "primary_muscle"
  | "all_primary_muscles"
  | "secondary_muscles"
>;

/** One exercise as a library card: art or muscle diagram, name, equipment and
 *  level. The library's "Explained in full" strip and the "Start with" row on
 *  the sub-muscle pages both draw it. `note` is a line of body copy under the
 *  name, the starting-weight sentence on the sub-muscle pages. */
export function ExerciseCard({
  exercise,
  note,
  fallbackMuscle,
}: {
  exercise: CardExercise;
  note?: string | null;
  /** Chip label when the row has no canonical muscle. Without it the chip is
   *  left out, as in the library. */
  fallbackMuscle?: string;
}) {
  const target = rowMuscles(exercise)[0];
  const chip = target ? muscleLabel(target) : fallbackMuscle;
  const art = exerciseArtUrl(exercise.slug);
  return (
    <Link
      to="/exercises/$slug"
      params={{ slug: exercise.slug }}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-shadow hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* The Squatch render when the slug has one (lib/exercise-art.ts),
          the muscle diagram until it does. */}
      <div
        className={
          art
            ? "relative aspect-[16/9] overflow-hidden bg-muted"
            : "relative bg-[radial-gradient(circle_at_50%_40%,var(--background),var(--muted))] px-ds-xl pb-ds-sm pt-ds-xl"
        }
      >
        {art ? (
          <img
            src={art}
            alt=""
            width={EXERCISE_ART_WIDTH}
            height={EXERCISE_ART_HEIGHT}
            sizes="(min-width: 1280px) 300px, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-150 motion-safe:group-hover:scale-[1.03]"
          />
        ) : (
          <MuscleDiagram muscles={exercise} />
        )}
        {chip && (
          <span className="absolute left-ds-sm top-ds-sm rounded-full bg-popover/90 px-ds-sm py-ds-xs font-caption text-caption text-muted-foreground shadow-sm">
            {chip}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-ds-md">
        <h3 className="flex items-start justify-between gap-ds-sm font-heading text-xl font-bold text-card-foreground group-hover:text-primary">
          {exercise.name}
          <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
        </h3>
        {note && <p className="mt-ds-xs font-body text-body text-muted-foreground">{note}</p>}
        <div className="mt-auto flex flex-wrap gap-ds-xs pt-ds-md">
          {exercise.equipment && (
            <span className="rounded-full bg-accent px-ds-sm py-ds-xs font-caption text-caption text-accent-foreground">
              {formatEquipmentLabel(exercise.equipment)}
            </span>
          )}
          <LevelChip level={exercise.level} />
        </div>
      </div>
    </Link>
  );
}
