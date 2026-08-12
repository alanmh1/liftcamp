import { createFileRoute, Link, Outlet, useNavigate, useMatchRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Repeat2 } from "lucide-react";
import { WeeklyRecap } from "@/components/WeeklyRecap";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { EVENTS, track } from "@/lib/analytics";
import { BottomNav } from "@/components/BottomNav";
import { WorkoutCalendar, parseLocalDate } from "@/components/WorkoutCalendar";
import { Skeleton } from "@/components/ui/skeleton";
import { effectiveLoad } from "@/lib/set-weight";
import { useWeightUnit } from "@/lib/weight-unit";
import { useBodyweight } from "@/lib/use-bodyweight";

type HistoryRow = {
  id: string;
  name: string | null;
  workout_date: string;
  created_at: string;
  finished_at: string | null;
  workout_exercises: Array<{
    position: number;
    exercise_id: string;
    exercises: { name: string; weight_type: string | null } | null;
    sets: Array<{ position: number; weight: string; weight_value: number | null; reps: number | null; completed: boolean }>;
  }>;
};


export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "History — LiftCamp" },
      { name: "description", content: "Review your finished workouts on a calendar, with sets, volume and weekly recaps." },
      { property: "og:title", content: "History — LiftCamp" },
      { property: "og:description", content: "Review your finished workouts on a calendar, with sets, volume and weekly recaps." },
      { property: "og:url", content: "https://liftcamp.lovable.app/history" },
    ],
    links: [{ rel: "canonical", href: "https://liftcamp.lovable.app/history" }],
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
  const { unit } = useWeightUnit();
  const bodyweight = useBodyweight();

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
        .select(
          "id, name, workout_date, created_at, finished_at, workout_exercises(position, exercise_id, exercises(name, weight_type), sets(position, weight, weight_value, reps, completed))",
        )
        .eq("user_id", userId!)
        .not("finished_at", "is", null)
        .order("finished_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as HistoryRow[];
    },
  });

  if (loading || !session) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">…</p>
      </div>
    );
  }

  if (onChild) {
    return <Outlet />;
  }

  // Tapping a day in the calendar jumps straight to that day's workout.
  function openDay(day: Date) {
    const rows = q.data ?? [];
    const match = rows.find((w) => {
      const d = parseLocalDate(w.workout_date);
      return d != null && d.toDateString() === day.toDateString();
    });
    if (match) navigate({ to: "/history/$workoutId", params: { workoutId: match.id } });
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col pb-24">
      <header className="px-5 pt-6 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">History</h1>
        <p className="mt-1 text-xs text-muted-foreground">Your finished workouts.</p>
      </header>
      <main className="flex-1 px-5 pb-6">
        {q.isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        ) : !q.data || q.data.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
            <p className="text-sm font-medium">No finished workouts yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Finish a session and it'll show up here with your stats.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <WeeklyRecap workouts={q.data} />
            <WorkoutCalendar dates={q.data.map((w) => w.workout_date)} onSelectDay={openDay} />
            <ul className="flex flex-col gap-3">
              {q.data.map((w) => (
                <li key={w.id}>
                  <HistoryCard w={w} unit={unit} bodyweight={bodyweight} userId={userId!} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
      {children}
    </span>
  );
}

function HistoryCard({
  w,
  unit,
  bodyweight,
  userId,
}: {
  w: HistoryRow;
  unit: string;
  bodyweight: number | null;
  userId: string;
}) {
  const navigate = useNavigate();
  const [repeating, setRepeating] = useState(false);
  const exs = (w.workout_exercises ?? [])
    .slice()
    .sort((a, b) => a.position - b.position);
  const names = exs.map((we) => we.exercises?.name).filter(Boolean) as string[];
  const exList = names.join(", ");
  const truncated = exList.length > 90 ? exList.slice(0, 87) + "…" : exList;
  const duration = w.finished_at ? formatDuration(w.created_at, w.finished_at) : "";
  const title = w.name?.trim() || "Workout";

  let volume = 0;
  let setCount = 0;
  for (const we of exs) {
    for (const s of we.sets ?? []) {
      if (!s.completed) continue;
      setCount += 1;
      const load = effectiveLoad(s, we.exercises, bodyweight);
      if (load != null && s.reps) volume += load * s.reps;
    }
  }

  // Duplicate this session into a fresh workout: same exercises, same set
  // count, weights and reps carried over as (uncompleted) starting points.
  async function repeat(e: React.MouseEvent) {
    e.preventDefault();
    if (repeating) return;
    setRepeating(true);
    try {
      const { data: workout, error } = await supabase
        .from("workouts")
        .insert({ user_id: userId, name: w.name })
        .select("id")
        .single();
      if (error || !workout) throw error ?? new Error("no workout");

      for (const [i, we] of exs.entries()) {
        const { data: newWe } = await supabase
          .from("workout_exercises")
          .insert({
            workout_id: workout.id,
            exercise_id: we.exercise_id,
            user_id: userId,
            position: i,
          })
          .select("id")
          .single();
        if (!newWe) continue;
        const prior = (we.sets ?? []).slice().sort((a, b) => a.position - b.position);
        const rows = (prior.length > 0 ? prior : [{ position: 0, weight: "", weight_value: null, reps: null }]).map(
          (s, idx) => ({
            workout_exercise_id: newWe.id,
            user_id: userId,
            position: idx,
            weight: s.weight ?? "",
            weight_value: s.weight_value,
            reps: s.reps,
          }),
        );
        await supabase.from("sets").insert(rows);
        void track(EVENTS.workoutStarted, { source: "repeat" });
      }
      navigate({ to: "/workout/$workoutId", params: { workoutId: workout.id } });
    } catch (err) {
      console.error(err);
      toast.error("Couldn't repeat that workout. Try again.");
      setRepeating(false);
    }
  }

  return (
    <div className="relative">
    <Link
      to="/history/$workoutId"
      params={{ workoutId: w.id }}
      className="block rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate pr-24 text-sm font-semibold">
          {title} ·{" "}
          {(parseLocalDate(w.workout_date) ?? new Date(w.workout_date)).toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {duration && <Chip>{duration}</Chip>}
        <Chip>
          {exs.length} exercise{exs.length === 1 ? "" : "s"}
        </Chip>
        <Chip>
          {setCount} set{setCount === 1 ? "" : "s"}
        </Chip>
        {volume > 0 && (
          <Chip>
            <span className="num">{Math.round(volume).toLocaleString()}</span> {unit} volume
          </Chip>
        )}
      </div>
      {truncated && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{truncated}</p>}
    </Link>
    <button
      type="button"
      onClick={repeat}
      disabled={repeating}
      aria-label={`Repeat ${title}`}
      className="absolute right-3 top-2.5 inline-flex h-8 items-center gap-1 rounded-full bg-secondary px-2.5 text-[11px] font-semibold text-secondary-foreground transition-colors hover:bg-muted disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Repeat2 className="h-3.5 w-3.5" aria-hidden />
      {repeating ? "…" : "Repeat"}
    </button>
    </div>
  );
}

