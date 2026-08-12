import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Dumbbell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWeightUnit } from "@/lib/weight-unit";
import { useBodyweight } from "@/lib/use-bodyweight";
import { effectiveLoad } from "@/lib/set-weight";
import { parseLocalDate } from "@/components/WorkoutCalendar";
import { Skeleton } from "@/components/ui/skeleton";
import { muscleLabel } from "@/lib/muscle-vocab";

type LastWorkoutRow = {
  id: string;
  name: string | null;
  workout_date: string;
  created_at: string;
  finished_at: string | null;
  workout_exercises: Array<{
    exercises: { name: string; primary_muscle: string | null; weight_type: string | null } | null;
    sets: Array<{ weight: string; weight_value: number | null; reps: number | null; completed: boolean }>;
  }>;
};

function relativeDay(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  if (!d) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Reward loop for returning users: the home screen opens with what you did last
// time, not a blank slate.
export function LastWorkoutCard({ userId }: { userId: string }) {
  const { unit } = useWeightUnit();
  const bodyweight = useBodyweight();

  const q = useQuery({
    queryKey: ["last-workout", userId],
    queryFn: async (): Promise<LastWorkoutRow | null> => {
      const { data, error } = await supabase
        .from("workouts")
        .select(
          "id, name, workout_date, created_at, finished_at, workout_exercises(exercises(name, primary_muscle, weight_type), sets(weight, weight_value, reps, completed))",
        )
        .eq("user_id", userId)
        .not("finished_at", "is", null)
        .order("finished_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as LastWorkoutRow) ?? null;
    },
  });

  if (q.isLoading) {
    return <Skeleton className="h-[86px] w-full rounded-lg" />;
  }
  const w = q.data;
  if (!w) return null;

  const exercises = w.workout_exercises ?? [];
  let volume = 0;
  let setCount = 0;
  const muscles = new Set<string>();
  for (const we of exercises) {
    if (we.exercises?.primary_muscle) muscles.add(muscleLabel(we.exercises.primary_muscle));
    for (const s of we.sets ?? []) {
      if (!s.completed) continue;
      setCount += 1;
      const load = effectiveLoad(s, we.exercises, bodyweight);
      if (load != null && s.reps) volume += load * s.reps;
    }
  }

  const focus = [...muscles].slice(0, 3).join(" · ");

  return (
    <Link
      to="/history/$workoutId"
      params={{ workoutId: w.id }}
      className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Dumbbell className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="truncate text-sm font-semibold">{w.name?.trim() || "Workout"}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{relativeDay(w.workout_date)}</span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {exercises.length} exercise{exercises.length === 1 ? "" : "s"} · {setCount} set
          {setCount === 1 ? "" : "s"}
          {volume > 0 ? ` · ${Math.round(volume).toLocaleString()} ${unit}` : ""}
          {focus ? ` · ${focus}` : ""}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
