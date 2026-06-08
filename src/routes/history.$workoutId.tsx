import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { computePrSetIds } from "@/lib/pr";
import { formatSetWeight } from "@/lib/set-weight";
import { useWeightUnit } from "@/lib/weight-unit";

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
    meta: [{ title: "Workout — RepLog" }],
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
          "id, name, workout_date, created_at, finished_at, workout_exercises(id, position, exercise_id, exercises(name), sets(id, position, weight, reps, completed))"
        )
        .eq("id", workoutId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const allSetsQ = useQuery({
    enabled: !!session && !!user,
    queryKey: ["all-sets", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sets")
        .select("id, weight, reps, created_at, workout_exercises!inner(exercise_id)")
        .eq("user_id", user!.id)
        .eq("completed", true);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; weight: string; reps: number | null; created_at: string; workout_exercises: { exercise_id: string } }>;
    },
  });

  const prSetIds = useMemo(() => {
    const all = allSetsQ.data ?? [];
    const byExercise = new Map<string, typeof all>();
    for (const s of all) {
      const ex = s.workout_exercises.exercise_id;
      if (!byExercise.has(ex)) byExercise.set(ex, []);
      byExercise.get(ex)!.push(s);
    }
    const result = new Set<string>();
    for (const sets of byExercise.values()) {
      for (const id of computePrSetIds(sets)) result.add(id);
    }
    return result;
  }, [allSetsQ.data]);

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-5 pt-6 pb-4">
        <Link
          to="/history"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden /> Back
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">
          {w?.name?.trim() || "Workout"}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {w?.workout_date ? new Date(w.workout_date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : ""}
        </p>
        {w?.created_at && w?.finished_at && (
          <p className="mt-0.5 text-xs text-muted-foreground">{formatDuration(w.created_at, w.finished_at)}</p>
        )}
      </header>
      <main className="flex-1 px-5 pb-10">
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : exercises.length === 0 ? (
          <p className="text-sm text-muted-foreground">No exercises logged.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {exercises.map((we) => {
              const sets = we.sets.slice().sort((a, b) => a.position - b.position);
              const wt = we.exercises?.weight_type ?? "standard";
              return (
                <li key={we.id} className="rounded-lg border border-border bg-card px-4 py-2">
                  <p className="text-sm font-semibold">{we.exercises?.name ?? "Exercise"}</p>
                  {sets.length === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">No sets logged.</p>
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
                            <span className="text-[10px] font-bold uppercase tracking-wide text-pr">PR</span>
                          ) : <span />}
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
