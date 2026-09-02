import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useWeightUnit } from "@/lib/weight-unit";
import { useBodyweight } from "@/lib/use-bodyweight";
import { formatSetWeight, effectiveLoad } from "@/lib/set-weight";
import { oneRepMaxNumeric } from "@/lib/one-rep-max";
import { Skeleton } from "@/components/ui/skeleton";
import { parseLocalDate } from "@/components/WorkoutCalendar";

type PastSet = {
  position: number;
  weight: string;
  weight_value: number | null;
  reps: number | null;
  completed: boolean;
};

type PastSession = {
  id: string;
  created_at: string;
  workouts: { id: string; workout_date: string; finished_at: string | null } | null;
  sets: PastSet[];
};

/**
 * Last few logged sessions for one exercise, so the lifter can see what they
 * did before deciding what to load now. Read-only.
 */
export function ExerciseHistory({
  exerciseId,
  weightType,
  limit = 5,
}: {
  exerciseId: string;
  weightType?: string | null;
  limit?: number;
}) {
  const { user } = useAuth();
  const { unit } = useWeightUnit();
  const bodyweight = useBodyweight();

  const q = useQuery({
    enabled: !!user && !!exerciseId,
    queryKey: ["exercise-history", user?.id, exerciseId, limit],
    queryFn: async (): Promise<PastSession[]> => {
      const { data, error } = await supabase
        .from("workout_exercises")
        .select(
          "id, created_at, workouts!inner(id, workout_date, finished_at), sets(position, weight, weight_value, reps, completed)",
        )
        .eq("user_id", user!.id)
        .eq("exercise_id", exerciseId)
        .not("workouts.finished_at", "is", null)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as PastSession[];
    },
  });

  if (q.isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-12 w-full rounded-md" />
        <Skeleton className="h-12 w-full rounded-md" />
      </div>
    );
  }

  const sessions = (q.data ?? []).filter((s) => (s.sets ?? []).some((x) => x.completed));

  if (sessions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No completed sets logged for this exercise yet.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {sessions.map((s) => {
        const sets = (s.sets ?? [])
          .filter((x) => x.completed)
          .sort((a, b) => a.position - b.position);
        let best: number | null = null;
        for (const set of sets) {
          const orm = oneRepMaxNumeric(
            effectiveLoad(set, { weight_type: weightType ?? null }, bodyweight),
            set.reps,
          );
          if (orm != null && (best == null || orm > best)) best = orm;
        }
        const d = s.workouts?.workout_date ? parseLocalDate(s.workouts.workout_date) : null;
        return (
          <li key={s.id} className="rounded-md border border-border bg-card px-3 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs font-semibold">
                {d
                  ? d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                  : "Earlier session"}
              </p>
              {best != null && (
                <span className="shrink-0 text-[12px] text-muted-foreground">
                  est. 1RM <span className="num">{Math.round(best * 10) / 10}</span> {unit}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {sets
                .map((set) => `${formatSetWeight(set, weightType, unit)} × ${set.reps ?? "—"}`)
                .join("  ·  ")}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
