import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronRight, Play, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EVENTS, track } from "@/lib/analytics";

type InProgressRow = {
  id: string;
  name: string | null;
  workout_date: string;
  created_at: string;
  finished_at: string | null;
  workout_exercises: Array<{
    exercise_id: string;
    position: number | null;
    exercises: { name: string; primary_muscle: string | null } | null;
    sets: Array<{ reps: number | null; weight_value: number | null; completed: boolean }>;
  }>;
};

function startedAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 2) return "Started just now";
  if (mins < 60) return `Started ${mins} minutes ago`;
  const hours = Math.round(mins / 60);
  if (hours === 1) return "Started an hour ago";
  if (hours < 24) return `Started ${hours} hours ago`;
  return "Started yesterday";
}

/**
 * Sets persist immediately, so a workout abandoned mid-session is fully intact
 * but invisible everywhere (every other surface filters to finished workouts).
 * This card is the only way back to it. Limited to the last 24 hours: older
 * unfinished workouts are abandoned, not interrupted.
 */
export function ResumeWorkoutCard({ userId }: { userId: string }) {
  const navigate = useNavigate();

  const q = useQuery({
    queryKey: ["in-progress-workout", userId],
    queryFn: async (): Promise<InProgressRow | null> => {
      const { data, error } = await supabase
        .from("workouts")
        .select(
          "id, name, workout_date, created_at, finished_at, workout_exercises(exercise_id, position, exercises(name, primary_muscle), sets(reps, weight_value, completed))",
        )
        .eq("user_id", userId)
        .is("finished_at", null)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as InProgressRow) ?? null;
    },
  });

  if (q.isLoading) {
    return <Skeleton className="h-[70px] w-full rounded-lg" />;
  }

  const w = q.data;
  if (!w) return null;

  const exercises = w.workout_exercises ?? [];
  let setCount = 0;
  for (const we of exercises) {
    for (const s of we.sets ?? []) {
      if (s.completed) setCount += 1;
    }
  }
  // Opened and immediately left: nothing to resume, so stay quiet.
  if (setCount === 0) return null;

  function resume() {
    if (!w) return;
    void track(EVENTS.workoutStarted, { source: "resume" });
    navigate({ to: "/workout/$workoutId", params: { workoutId: w.id } });
  }

  return (
    <button
      type="button"
      onClick={resume}
      className="flex w-full items-center gap-3 rounded-lg border-2 border-primary bg-primary/10 px-4 py-3 text-left transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Play className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="truncate text-sm font-semibold">{w.name?.trim() || "Workout"}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{startedAgo(w.created_at)}</span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {exercises.length} exercise{exercises.length === 1 ? "" : "s"} · {setCount} set
          {setCount === 1 ? "" : "s"} logged
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-0.5 text-sm font-semibold text-primary">
        Resume
        <ChevronRight className="h-4 w-4" aria-hidden />
      </span>
    </button>
  );
}
