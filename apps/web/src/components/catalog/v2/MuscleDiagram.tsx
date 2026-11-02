import { bodyHighlights } from "@liftcamp/shared";
import { BodyDiagram } from "@/components/BodyDiagram";
import type { CatalogRow } from "@/lib/public-catalog.functions";

export type DiagramMuscles = Pick<
  CatalogRow,
  "primary_muscle" | "all_primary_muscles" | "secondary_muscles"
>;

/** The regions to light for one exercise: primary from all_primary_muscles,
 *  falling back to primary_muscle, and secondary from secondary_muscles. */
export function diagramHighlights(m: DiagramMuscles) {
  return bodyHighlights([m.all_primary_muscles, m.primary_muscle], m.secondary_muscles);
}

/** Front and back clay figures with the worked muscles painted in. Every
 *  row in the catalog gets one: the layers come from the muscle columns, so
 *  no per-exercise image files are needed. */
export function MuscleDiagram({
  muscles,
  labels = false,
  eager = false,
}: {
  muscles: DiagramMuscles;
  labels?: boolean;
  /** Load at once, for a diagram at the top of the page. */
  eager?: boolean;
}) {
  const highlights = diagramHighlights(muscles);
  return (
    <div className="grid h-full w-full grid-cols-2 items-center gap-ds-xs">
      <div className="flex min-h-0 flex-col items-center">
        <BodyDiagram type="anterior" highlights={highlights} eager={eager} />
        {labels && (
          <span className="mt-ds-xs text-center font-caption text-caption text-muted-foreground">
            Front
          </span>
        )}
      </div>
      <div className="flex min-h-0 flex-col items-center">
        <BodyDiagram type="posterior" highlights={highlights} eager={eager} />
        {labels && (
          <span className="mt-ds-xs text-center font-caption text-caption text-muted-foreground">
            Back
          </span>
        )}
      </div>
    </div>
  );
}
