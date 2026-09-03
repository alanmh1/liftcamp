import { Plus, Trash2 } from "lucide-react";
import { equipmentIcon, formatEquipmentLabel } from "@/lib/exercise-visuals";
import { loggedSets, type DraftExercise, type DraftSet } from "@/lib/draft-routine";

/**
 * The trial session on the public builder.
 *
 * A visitor who has just built a plan is at their most persuadable, and the
 * honest way to show what LiftCamp does is to let them actually use it. Sets
 * live in the same localStorage draft as the routine, so signing up keeps both:
 * the plan becomes a template and the session becomes a logged workout.
 */
export function DraftSession({
  exercises,
  onChange,
}: {
  exercises: DraftExercise[];
  onChange: (next: DraftExercise[]) => void;
}) {
  function update(i: number, sets: DraftSet[]) {
    onChange(exercises.map((ex, idx) => (idx === i ? { ...ex, sets } : ex)));
  }

  function setField(i: number, j: number, field: keyof DraftSet, value: string) {
    const sets = [...(exercises[i]?.sets ?? [])];
    const row = sets[j] ?? { weight: "", reps: "" };
    sets[j] = { ...row, [field]: value };
    update(i, sets);
  }

  return (
    <div className="flex flex-col gap-4">
      {exercises.map((ex, i) => {
        const sets = ex.sets ?? [];
        const Icon = equipmentIcon(ex.equipment);
        return (
          <div key={ex.id} className="rounded-xl border border-border bg-secondary/50 p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background">
                <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold">{ex.name}</p>
                {ex.equipment && (
                  <p className="text-[12px] text-muted-foreground">
                    {formatEquipmentLabel(ex.equipment)}
                  </p>
                )}
              </div>
            </div>

            {sets.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-[12px] font-semibold text-muted-foreground">
                  <span className="w-5">#</span>
                  <span className="flex-1">Weight</span>
                  <span className="flex-1">Reps</span>
                  <span className="w-8" />
                </div>
                {sets.map((s, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <span className="w-5 text-[13px] font-semibold text-muted-foreground">
                      {j + 1}
                    </span>
                    <input
                      value={s.weight}
                      onChange={(e) => setField(i, j, "weight", e.target.value)}
                      inputMode="decimal"
                      placeholder="—"
                      aria-label={`Weight for set ${j + 1} of ${ex.name}`}
                      className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-[16px] outline-none focus:border-primary"
                    />
                    <input
                      value={s.reps}
                      onChange={(e) => setField(i, j, "reps", e.target.value)}
                      inputMode="numeric"
                      placeholder="—"
                      aria-label={`Reps for set ${j + 1} of ${ex.name}`}
                      className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-[16px] outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => update(i, sets.filter((_, idx) => idx !== j))}
                      aria-label={`Remove set ${j + 1} of ${ex.name}`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => update(i, [...sets, { weight: "", reps: "" }])}
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-[13px] font-semibold text-primary"
            >
              <Plus className="h-4 w-4" aria-hidden />
              {sets.length === 0 ? "Log a set" : "Add set"}
            </button>

            {loggedSets(ex).length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {loggedSets(ex).length} set{loggedSets(ex).length === 1 ? "" : "s"} saved on this
                device.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
