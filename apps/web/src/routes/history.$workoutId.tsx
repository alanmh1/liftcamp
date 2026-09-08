import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { computePrSetIds } from "@/lib/pr";
import { formatSetWeight, effectiveLoad } from "@liftcamp/shared";
import { oneRepMaxNumeric } from "@/lib/one-rep-max";
import { useWeightUnit } from "@/lib/weight-unit";
import { useBodyweight } from "@/lib/use-bodyweight";
import { WorkoutName } from "@/components/WorkoutName";
import { WorkoutNotes } from "@/components/WorkoutNotes";
import { BackLink } from "@/components/BackLink";
import { Skeleton } from "@/components/ui/skeleton";
import { parseLocalDate } from "@/components/WorkoutCalendar";



function formatDuration(startIso: string, endIso: string) {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!isFinite(ms) || ms <= 0) return "0m";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export const Route = createFileRoute("/history/$workoutId")({
  head: () => ({
    meta: [
      { title: "Workout — LiftCamp" },
      { name: "description", content: "A read-only view of a logged workout: exercises, sets, reps, weights and PRs." },
      { property: "og:title", content: "Workout — LiftCamp" },
      { property: "og:description", content: "A read-only view of a logged workout: exercises, sets, reps, weights and PRs." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HistoryDetailPage,
});

function HistoryDetailPage() {
  const { workoutId } = Route.useParams();
  const { session, loading, user } = useAuth();
  const navigate = useNavigate();
  const { unit } = useWeightUnit();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login", replace: true });
  }, [session, loading, navigate]);

  const q = useQuery({
    enabled: !!session,
    queryKey: ["history", workoutId],
    queryFn: async () => {
    const { data, error } = await supabase
        .from("workouts")
        .select(
          "id, name, workout_date, created_at, finished_at, notes, workout_exercises(id, position, exercise_id, exercises(name, weight_type), sets(id, position, weight, weight_value, reps, completed))"
        )
        .eq("id", workoutId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const bodyweight = useBodyweight();

  const allSetsQ = useQuery({
    enabled: !!session && !!user,
    queryKey: ["all-sets", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sets")
        .select("id, weight, weight_value, reps, created_at, workout_exercises!inner(exercise_id, exercises(weight_type))")
        .eq("user_id", user!.id)
        .eq("completed", true);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; weight: string; weight_value: number | null; reps: number | null; created_at: string; workout_exercises: { exercise_id: string; exercises: { weight_type: string | null } | null } }>;
    },
  });

  const prSetIds = useMemo(() => {
    const all = allSetsQ.data ?? [];
    const byExercise = new Map<string, { weight_type: string | null; sets: typeof all }>();
    for (const s of all) {
      const ex = s.workout_exercises.exercise_id;
      const wt = s.workout_exercises.exercises?.weight_type ?? null;
      if (!byExercise.has(ex)) byExercise.set(ex, { weight_type: wt, sets: [] });
      byExercise.get(ex)!.sets.push(s);
    }
    const result = new Set<string>();
    for (const { weight_type, sets } of byExercise.values()) {
      for (const id of computePrSetIds(sets, { weight_type }, bodyweight)) result.add(id);
    }
    return result;
  }, [allSetsQ.data, bodyweight]);


  if (loading || !session) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">…</p>
      </div>
    );
  }

  const w = q.data;
  const exercises = ((w?.workout_exercises ?? []) as Array<{
    id: string;
    position: number;
    exercise_id: string;
    exercises: { name: string; weight_type: string | null } | null;
    sets: Array<{ id: string; position: number; weight: string; weight_value: number | null; reps: number | null; completed: boolean }>;
  }>)
    .slice()
    .sort((a, b) => a.position - b.position);

  // Header stats for the session.
  let totalVolume = 0;
  let totalSets = 0;
  let prCount = 0;
  for (const we of exercises) {
    for (const s of we.sets) {
      if (!s.completed) continue;
      totalSets += 1;
      if (prSetIds.has(s.id)) prCount += 1;
      const load = effectiveLoad(s, we.exercises, bodyweight);
      if (load != null && s.reps) totalVolume += load * s.reps;
    }
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <header className="px-5 pt-4 pb-4">
        <BackLink to="/history" label="History" />
        <WorkoutName
          workoutId={workoutId}
          name={w?.name ?? ""}
          className="mt-2 text-2xl font-bold tracking-tight"
        />
        <p className="mt-1 text-[13px] text-muted-foreground">
          {(() => {
            const d = w?.workout_date ? parseLocalDate(w.workout_date) : null;
            const date = d
              ? d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
              : "";
            const dur = w?.created_at && w?.finished_at ? formatDuration(w.created_at, w.finished_at) : "";
            return [date, dur].filter(Boolean).join(" · ");
          })()}
        </p>
        {!q.isLoading && exercises.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Chip>
              {exercises.length} exercise{exercises.length === 1 ? "" : "s"}
            </Chip>
            <Chip>
              {totalSets} set{totalSets === 1 ? "" : "s"}
            </Chip>
            {totalVolume > 0 && (
              <Chip>
                <span className="num">{Math.round(totalVolume).toLocaleString()}</span> {unit} volume
              </Chip>
            )}
            {prCount > 0 && (
              <span className="rounded-full bg-pr px-2 py-0.5 text-[13px] font-bold uppercase tracking-wide text-pr-foreground">
                {prCount} PR{prCount === 1 ? "" : "s"}
              </span>
            )}
          </div>
        )}
      </header>
      <main className="flex-1 px-5 pb-10 flex flex-col gap-4">
        {!q.isLoading && (
          <WorkoutNotes
            workoutId={workoutId}
            value={w?.notes ?? ""}
            invalidateKeys={[["history", workoutId], ["history"]]}
          />
        )}
        {q.isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ) : exercises.length === 0 ? (
          <p className="text-sm text-muted-foreground">No exercises logged.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {exercises.map((we) => {
              const sets = we.sets.slice().sort((a, b) => a.position - b.position);
              const wt = we.exercises?.weight_type ?? "standard";
              let bestOrm: number | null = null;
              for (const s of sets) {
                if (!s.completed) continue;
                const orm = oneRepMaxNumeric(effectiveLoad(s, we.exercises, bodyweight), s.reps);
                if (orm != null && (bestOrm == null || orm > bestOrm)) bestOrm = orm;
              }
              return (
                <li key={we.id} className="rounded-lg border border-border bg-card px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{we.exercises?.name ?? "Exercise"}</p>
                    {bestOrm != null && (
                      <span className="shrink-0 text-[13px] text-muted-foreground">
                        est. 1RM <span className="num">{Math.round(bestOrm * 10) / 10}</span> {unit}
                      </span>
                    )}
                  </div>
                  {sets.length === 0 ? (
                    <p className="mt-2 text-[13px] text-muted-foreground">No sets logged.</p>
                  ) : (
                    <ul className="mt-2 flex flex-col gap-1">
                      {sets.map((s, i) => (
                        <li
                          key={s.id}
                          className="grid grid-cols-[2rem_1fr_1fr_auto] gap-2 text-sm tabular-nums items-center"
                        >
                          <span className="text-muted-foreground">{i + 1}</span>
                          <span>{formatSetWeight(s, wt, unit)}</span>
                          <span>{s.reps ?? "—"} reps</span>
                          {prSetIds.has(s.id) ? (
                            <span className="rounded-full bg-pr px-1.5 py-0.5 text-[13px] font-bold uppercase tracking-wide text-pr-foreground">
                              PR
                            </span>
                          ) : (
                            <span />
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-secondary px-2 py-0.5 text-[13px] font-medium text-secondary-foreground">
      {children}
    </span>
  );
}

