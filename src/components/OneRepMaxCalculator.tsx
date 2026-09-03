import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calculator, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWeightUnit } from "@/lib/weight-unit";
import { useBodyweight } from "@/lib/use-bodyweight";
import { effectiveLoad } from "@/lib/set-weight";
import {
  MAX_TRAINING_AGE,
  MIN_TRAINING_AGE,
  estimateOneRepMax,
  formulaEstimates,
  loadForReps,
  roundLoad,
  trainingAgeLabel,
  type TrainedSet,
} from "@/lib/one-rep-max-model";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";

type WeRow = {
  exercise_id: string;
  exercises: { name: string; weight_type: string | null } | null;
  workouts: { workout_date: string } | null;
  sets: { weight: string | null; weight_value: number | null; reps: number | null; completed: boolean }[] | null;
};

type Lift = { id: string; name: string; sets: TrainedSet[] };

/**
 * Estimates a true 1RM from the sets the user has actually logged, averaging
 * five rep-max formulas and correcting for training age.
 */
export function OneRepMaxCalculator({
  userId,
  trainingAge,
  setTrainingAge,
  onUseAsGoal,
}: {
  userId: string;
  trainingAge: number;
  setTrainingAge: (n: number) => void;
  onUseAsGoal?: (exerciseId: string, name: string, suggested: number) => void;
}) {
  const { unit } = useWeightUnit();
  const bodyweight = useBodyweight();
  const [picked, setPicked] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["orm-calc-lifts", userId],
    queryFn: async (): Promise<WeRow[]> => {
      const { data, error } = await supabase
        .from("workout_exercises")
        .select(
          "exercise_id, exercises(name, weight_type), workouts(workout_date), sets(weight, weight_value, reps, completed)",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(400);
      if (error) throw error;
      return (data ?? []) as unknown as WeRow[];
    },
  });

  const lifts = useMemo<Lift[]>(() => {
    const map = new Map<string, Lift>();
    for (const we of q.data ?? []) {
      const name = we.exercises?.name;
      if (!name) continue;
      const lift = map.get(we.exercise_id) ?? { id: we.exercise_id, name, sets: [] };
      for (const s of we.sets ?? []) {
        if (!s.completed || s.reps == null) continue;
        const load = effectiveLoad(s, { weight_type: we.exercises?.weight_type ?? null }, bodyweight);
        if (load == null || load <= 0) continue;
        lift.sets.push({ load, reps: s.reps, date: we.workouts?.workout_date ?? null });
      }
      map.set(we.exercise_id, lift);
    }
    return [...map.values()].filter((l) => l.sets.length > 0).sort((a, b) => b.sets.length - a.sets.length);
  }, [q.data, bodyweight]);

  const current = lifts.find((l) => l.id === picked) ?? lifts[0] ?? null;
  const estimate = current ? estimateOneRepMax(current.sets, trainingAge) : null;

  if (q.isLoading) return <Skeleton className="h-40 w-full rounded-lg" />;

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">1RM calculator</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Built from your logged sets — five formulas averaged, then adjusted for how long
            you've been training.
          </p>
        </div>
        <span className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
          <Calculator className="h-3.5 w-3.5" aria-hidden />
        </span>
      </div>

      {!current ? (
        <p className="mt-3 text-[13px] text-muted-foreground">
          Log a few completed sets with weight and reps and your estimate shows up here.
        </p>
      ) : (
        <>
          <label className="mt-3 block text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
            Lift
            <select
              value={current.id}
              onChange={(e) => setPicked(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-md border border-border bg-background px-2 text-sm font-medium normal-case tracking-normal text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {lifts.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                Training age
              </p>
              <p className="text-[12px] text-muted-foreground">{trainingAgeLabel(trainingAge)}</p>
            </div>
            <Slider
              className="mt-3"
              value={[trainingAge]}
              min={MIN_TRAINING_AGE}
              max={MAX_TRAINING_AGE}
              step={0.5}
              onValueChange={(v) => setTrainingAge(v[0] ?? 0)}
              aria-label="Years of consistent training"
            />
            <p className="mt-2 text-[12px] text-muted-foreground">
              Newer lifters hold fewer reps at a given percentage of their max, so higher-rep
              sets get trimmed. Past five years the estimate uses the textbook curve.
            </p>
          </div>

          {estimate && (
            <>
              <div className="mt-4 rounded-lg bg-secondary/60 px-3 py-3">
                <p className="text-2xl font-bold tracking-tight">
                  <span className="num">{roundLoad(estimate.value)}</span>{" "}
                  <span className="text-sm font-medium text-muted-foreground">{unit} est. 1RM</span>
                </p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  From your best set: <span className="num">{roundLoad(estimate.from.load)}</span>{" "}
                  {unit} × <span className="num">{estimate.from.reps}</span>
                  {estimate.from.date ? ` on ${estimate.from.date}` : ""} ·{" "}
                  {estimate.confidence} confidence
                </p>
                {estimate.confidence !== "high" && (
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    A set of 5 reps or fewer would tighten this up.
                  </p>
                )}
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2">
                {[3, 5, 8, 10].map((r) => (
                  <div key={r} className="rounded-md border border-border px-2 py-2 text-center">
                    <p className="text-sm font-semibold">
                      <span className="num">{Math.round(loadForReps(estimate.value, r))}</span>
                    </p>
                    <p className="text-[12px] text-muted-foreground">×{r}</p>
                  </div>
                ))}
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer text-[12px] font-medium text-muted-foreground">
                  Formula breakdown
                </summary>
                <ul className="mt-2 space-y-1">
                  {Object.entries(formulaEstimates(estimate.from.load, estimate.from.reps)).map(
                    ([name, v]) => (
                      <li key={name} className="flex justify-between text-[12px] text-muted-foreground">
                        <span>{name}</span>
                        <span className="num">{roundLoad(v)}</span>
                      </li>
                    ),
                  )}
                </ul>
              </details>

              {onUseAsGoal && (
                <button
                  type="button"
                  onClick={() =>
                    onUseAsGoal(current.id, current.name, Math.round(estimate.value * 1.05))
                  }
                  className="mt-3 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-md bg-secondary px-3 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Target className="h-4 w-4" aria-hidden />
                  Set a goal from this ({Math.round(estimate.value * 1.05)} {unit})
                </button>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
