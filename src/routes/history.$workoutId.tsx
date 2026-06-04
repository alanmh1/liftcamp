import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

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
  const { session, loading } = useAuth();
  const navigate = useNavigate();

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
          "id, name, workout_date, created_at, finished_at, workout_exercises(id, position, exercises(name), sets(id, position, weight, reps))"
        )
        .eq("id", workoutId)
        .single();
      if (error) throw error;
      return data;
    },
  });

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
    exercises: { name: string } | null;
    sets: Array<{ id: string; position: number; weight: string; reps: number | null }>;
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
                          className="grid grid-cols-[2rem_1fr_1fr] gap-2 text-sm tabular-nums"
                        >
                          <span className="text-muted-foreground">{i + 1}</span>
                          <span>{s.weight || "—"}</span>
                          <span>{s.reps ?? "—"} reps</span>
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
