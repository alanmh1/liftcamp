import type { ReactNode } from "react";
import { muscleNamesToSlugs } from "@/lib/muscle-map";
import { canonMuscleList, muscleLabel } from "@/lib/muscle-vocab";
import { BodyDiagram } from "@/components/BodyDiagram";
import { formatEquipmentLabel } from "@/lib/exercise-visuals";
import { ExerciseAnimation } from "@/components/ExerciseAnimation";
import { parseSteps, splitStepParts } from "@/lib/exercise-steps";

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

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h4>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

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
    canonMuscleList(ex.all_primary_muscles || ex.primary_muscle)
      .map(muscleLabel)
      .join(", ") || "—";
  const secondaryText = canonMuscleList(ex.secondary_muscles).map(muscleLabel).join(", ") || "—";
  const bodyData = [
    { name: "primary", muscles: primarySlugs, frequency: 2 },
    { name: "secondary", muscles: secondarySlugs, frequency: 1 },
  ].filter((entry) => entry.muscles.length > 0);

  const steps = parseSteps(ex.description);

  return (
    <div className="space-y-4">
      <ExerciseAnimation imageUrl={ex.image_url} imageUrl2={ex.image_url_2} alt={ex.name} />
      <div className="mx-auto flex w-full max-w-[260px] justify-center gap-3">
        <div className="flex-1">
          <BodyDiagram type="anterior" data={bodyData} />
        </div>
        <div className="flex-1">
          <BodyDiagram type="posterior" data={bodyData} />
        </div>
      </div>

      <div className="space-y-2">
        <SectionHeading>Muscles worked</SectionHeading>
        <div className="space-y-1">
          <MetaRow label="Primary" value={primaryText} />
          <MetaRow label="Secondary" value={secondaryText} />
          <MetaRow
            label="Equipment"
            value={ex.equipment ? formatEquipmentLabel(ex.equipment) : "—"}
          />
        </div>
      </div>

      {ex.is_unilateral && (
        <p className="rounded-md bg-muted px-2 py-1.5 text-sm text-muted-foreground">
          Log this one per side. 10 reps means 10 on each side.
        </p>
      )}

      {steps.length > 0 && (
        <div className="space-y-2">
          <SectionHeading>How to perform</SectionHeading>
          <ol className="space-y-3">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                  {i + 1}
                </span>
                <div className="flex-1 space-y-1 leading-relaxed">
                  {splitStepParts(step).map((part, j) => (
                    <p key={j} className="leading-relaxed">
                      {part.label && (
                        <span className="font-semibold text-foreground">{part.label}: </span>
                      )}
                      <span className="text-muted-foreground">{part.text}</span>
                    </p>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
