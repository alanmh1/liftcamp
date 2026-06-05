import { createFileRoute, Link, Outlet, useNavigate, useMatchRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { WorkoutCalendar, parseLocalDate } from "@/components/WorkoutCalendar";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "History — RepLog" },
      { name: "description", content: "Your finished workouts." },
    ],
  }),
  component: HistoryPage,
});

function formatDuration(startIso: string, endIso: string) {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!isFinite(ms) || ms <= 0) return "0m";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function HistoryPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const matchRoute = useMatchRoute();
  const onChild = !!matchRoute({ to: "/history/$workoutId" });

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login", replace: true });
  }, [session, loading, navigate]);

  const userId = session?.user.id;

  const q = useQuery({
    enabled: !!userId,
    queryKey: ["history", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workouts")
        .select("id, name, workout_date, created_at, finished_at, workout_exercises(position, exercises(name))")
        .eq("user_id", userId!)
        .not("finished_at", "is", null)
        .order("finished_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">…</p>
      </div>
    );
  }

  if (onChild) {
    return <Outlet />;
  }


  return (
    <div className="min-h-screen bg-background flex flex-col pb-24">
      <header className="px-5 pt-6 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">History</h1>
        <p className="mt-1 text-xs text-muted-foreground">Your finished workouts.</p>
      </header>
      <main className="flex-1 px-5 pb-6">
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !q.data || q.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No finished workouts yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <WorkoutCalendar dates={q.data.map((w) => w.workout_date)} />
            <ul className="flex flex-col gap-3">
            {q.data.map((w) => {
              const exs = ((w.workout_exercises ?? []) as Array<{ position: number; exercises: { name: string } | null }>)
                .slice()
                .sort((a, b) => a.position - b.position)
                .map((we) => we.exercises?.name)
                .filter(Boolean) as string[];
              const exList = exs.join(", ");
              const truncated = exList.length > 90 ? exList.slice(0, 87) + "…" : exList;
              const duration = w.finished_at ? formatDuration(w.created_at, w.finished_at) : "";
              const title = w.name?.trim() || "Workout";
              return (
                <li key={w.id}>
                  <Link
                    to="/history/$workoutId"
                    params={{ workoutId: w.id }}
                    className="block rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-accent/40"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold truncate">
                        {title} · {(parseLocalDate(w.workout_date) ?? new Date(w.workout_date)).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
                      </p>
                      <span className="text-xs text-muted-foreground shrink-0">{duration}</span>
                    </div>
                    {truncated && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{truncated}</p>
                    )}
                  </Link>
                </li>
              );
            })}
            </ul>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
