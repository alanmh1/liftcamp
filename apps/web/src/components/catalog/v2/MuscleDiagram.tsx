import { BodyDiagram } from "@/components/BodyDiagram";
import { muscleNamesToSlugs } from "@/lib/muscle-map";
import type { CatalogRow } from "@/lib/public-catalog.functions";

export type DiagramMuscles = Pick<
  CatalogRow,
  "primary_muscle" | "all_primary_muscles" | "secondary_muscles"
>;

/** BodyDiagram's input for one exercise: primary muscles at frequency 2,
 *  secondary at 1. Same rule as the in-app ExerciseInfo sheet. */
export function diagramData(m: DiagramMuscles) {
  const fromAll = muscleNamesToSlugs(m.all_primary_muscles);
  const primary = fromAll.length > 0 ? fromAll : muscleNamesToSlugs(m.primary_muscle);
  return [
    { name: "primary", muscles: primary, frequency: 2 },
    { name: "secondary", muscles: muscleNamesToSlugs(m.secondary_muscles), frequency: 1 },
  ].filter((entry) => entry.muscles.length > 0);
}

/** Front and back clay figures with the worked muscles tinted. Every row in
 *  the catalog gets one: the masks come from the muscle columns, so no
 *  per-exercise image files are needed. */
export function MuscleDiagram({
  muscles,
  labels = false,
}: {
  muscles: DiagramMuscles;
  labels?: boolean;
}) {
  const data = diagramData(muscles);
  return (
    <div className="grid h-full w-full grid-cols-2 items-center gap-ds-xs">
      <div className="flex min-h-0 flex-col items-center">
        <BodyDiagram type="anterior" data={data} />
        {labels && (
          <span className="mt-ds-xs text-center font-caption text-caption text-muted-foreground">
            Front
          </span>
        )}
      </div>
      <div className="flex min-h-0 flex-col items-center">
        <BodyDiagram type="posterior" data={data} />
        {labels && (
          <span className="mt-ds-xs text-center font-caption text-caption text-muted-foreground">
            Back
          </span>
        )}
      </div>
    </div>
  );
}
