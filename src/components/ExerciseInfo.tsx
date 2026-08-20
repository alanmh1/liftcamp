import { muscleNamesToSlugs } from "@/lib/muscle-map";
import { canonMuscleList, muscleLabel } from "@/lib/muscle-vocab";
import { BodyDiagram } from "@/components/BodyDiagram";
import { formatEquipmentLabel } from "@/lib/exercise-visuals";
import { ExerciseAnimation } from "@/components/ExerciseAnimation";

// Shape this panel needs. Both the catalog rows and in-workout exercises
// satisfy it as long as the query fetches all_primary_muscles,
// secondary_muscles, and description.
export type ExerciseInfoData = {
  name?: string;
  primary_muscle?: string | null;
  all_primary_muscles?: string | null;
  secondary_muscles?: string | null;
  equipment?: string | null;
  description?: string | null;
  image_url?: string | null;
  image_url_2?: string | null;
  is_unilateral?: boolean | null;
};

// Muscle-highlight body diagrams (front + back), primary/secondary/equipment
// text, and numbered instruction steps. Background/padding-agnostic so each
// consumer can wrap it (inline expand in the picker, drawer in a workout).
export function ExerciseInfo({ ex }: { ex: ExerciseInfoData }) {
  // Prefer the full primary-muscle list; fall back to the single primary_muscle
  // so the primary still highlights even when all_primary_muscles is empty.
  const primarySlugs = (() => {
    const fromAll = muscleNamesToSlugs(ex.all_primary_muscles);
    return fromAll.length > 0 ? fromAll : muscleNamesToSlugs(ex.primary_muscle);
  })();
  const secondarySlugs = muscleNamesToSlugs(ex.secondary_muscles);

  // Display strings go through the canonical vocabulary too, not just the body
  // diagram. Rendering the raw column here is how "quadriceps" and "middle
  // back" kept surfacing in the UI after the data had already been collapsed.
  const primaryText =
    canonMuscleList(ex.all_primary_muscles || ex.primary_muscle).map(muscleLabel).join(", ") || "—";
  const secondaryText = canonMuscleList(ex.secondary_muscles).map(muscleLabel).join(", ") || "—";
  const bodyData = [
    { name: "primary", muscles: primarySlugs, frequency: 2 },
    { name: "secondary", muscles: secondarySlugs, frequency: 1 },
  ].filter((entry) => entry.muscles.length > 0);

  return (
    <div className="text-xs space-y-2">
      <ExerciseAnimation
        imageUrl={ex.image_url}
        imageUrl2={ex.image_url_2}
        alt={ex.name}
      />
      <div className="mx-auto flex w-full max-w-[260px] justify-center gap-3">
        <div className="flex-1">
          <BodyDiagram type="anterior" data={bodyData} />
        </div>
        <div className="flex-1">
          <BodyDiagram type="posterior" data={bodyData} />
        </div>
      </div>
      <div>
        <span className="text-muted-foreground">Primary:</span>{" "}
        {primaryText}
      </div>
      <div>
        <span className="text-muted-foreground">Secondary:</span>{" "}
        {secondaryText}
      </div>
      <div>
        <span className="text-muted-foreground">Equipment:</span> {ex.equipment ? formatEquipmentLabel(ex.equipment) : "—"}
      </div>
      {ex.is_unilateral && (
        <p className="rounded-md bg-muted px-2 py-1.5 text-muted-foreground">
          Log this one per side. 10 reps means 10 on each side.
        </p>
      )}
      {ex.description && (
        <ol className="pt-1 list-decimal list-inside space-y-0.5">
          {ex.description
            .split(/\r?\n/)
            .map((s) => s.trim())
            .filter(Boolean)
            .map((step, i) => (
              <li key={i} className="leading-relaxed">
                {step}
              </li>
            ))}
        </ol>
      )}
    </div>
  );
}
