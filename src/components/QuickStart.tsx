import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EVENTS, track, trackWorkoutStartFailed } from "@/lib/analytics";
import { useAuth } from "@/lib/auth-context";
import { coldStartSuggestion } from "@/lib/suggestions";
import { toast } from "sonner";

// Cold-start helper: three staple lifts a brand-new user can tap to get a
// workout going without learning the picker first.
//
// Tokens are matched against exercises.search_text (lowercased, punctuation
// stripped) -- NOT the raw name, which is the same failure mode as the Pullups
// search bug. Raw-name matching happens to work for today's catalog names, but
// it breaks the moment a name is hyphenated or reordered ("Bench-Press
// (Barbell)", "Bench Press, Barbell"), and when it breaks this card silently
// renders nothing for exactly the brand-new users it exists to serve.
//
// Keep tokens short and punctuation-free so they survive catalog renames.
const QUICK_LIFTS: ReadonlyArray<{ token: string }> = [
  { token: "benchpress" },
  { token: "barbellsquat" },
  { token: "barbellrow" },
  { token: "deadlift" },
];

type QuickExercise = {
  id: string;
  name: string;
  mechanic: string | null;
  level: string | null;
  equipment: string | null;
  search_text: string | null;
};

export function QuickStart() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);

  const q = useQuery({
    enabled: !!user,
    queryKey: ["quick-start-exercises"],
    queryFn: async (): Promise<QuickExercise[]> => {
      // One round trip instead of four sequential ones -- this renders on the
      // very first screen a new user sees, so latency here is first-impression
      // latency.
      const { data } = await supabase
        .from("exercises")
        .select("id, name, mechanic, level, equipment, search_text")
        .or(QUICK_LIFTS.map((l) => `search_text.ilike.*${l.token}*`).join(","))
        .limit(200);

      const rows = (data ?? []) as QuickExercise[];
      const found: QuickExercise[] = [];

      for (const { token } of QUICK_LIFTS) {
        const matches = rows
          .filter((r) => (r.search_text ?? "").includes(token))
          .filter((r) => !found.some((f) => f.id === r.id))
          // Shortest name wins: the plainest variant ("Barbell Squat") over a
          // qualified one ("Barbell Squat To Box"). localeCompare breaks ties
          // so the same three lifts appear on every render and every device.
          .sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name));
        if (matches[0]) found.push(matches[0]);
      }

      return found.slice(0, 3);
    },
  });

  // Only useful before the first session — hide once there's real history.
  const hasHistory = useQuery({
    enabled: !!user,
    queryKey: ["has-history", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("workouts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .not("finished_at", "is", null);
      return (count ?? 0) > 0;
    },
  });

  const exercises = q.data ?? [];
  if (hasHistory.data !== false || exercises.length === 0) return null;

  async function quickLog(ex: QuickExercise) {
    if (!user || busy) return;
    setBusy(ex.id);
    const { data: workout, error } = await supabase
      .from("workouts")
      .insert({ user_id: user.id, name: "First Workout" })
      .select("id")
      .single();
    if (error || !workout) {
      trackWorkoutStartFailed("quick_start", error);
      setBusy(null);
      toast.error("Couldn't start that workout. Try again.");
      return;
    }
    const { data: we } = await supabase
      .from("workout_exercises")
      .insert({ workout_id: workout.id, exercise_id: ex.id, user_id: user.id, position: 0 })
      .select("id")
      .single();
    if (we) {
      const sugg = coldStartSuggestion(ex);
      await supabase.from("sets").insert(
        Array.from({ length: sugg.sets }, (_, i) => ({
          workout_exercise_id: we.id,
          user_id: user.id,
          position: i,
          weight: "",
          reps: sugg.reps,
        })),
      );
    }
    void track(EVENTS.routineChosen, { template: ex.name, is_system: false });
    void track(EVENTS.workoutStarted, { source: "quick_start" });
    navigate({ to: "/workout/$workoutId", params: { workoutId: workout.id } });
  }

  return (
    <section className="rounded-lg border border-dashed border-border bg-card px-4 py-3">
      <p className="text-sm font-semibold">New here? Log your first lift</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Tap a staple movement and we'll set up the sets for you.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {exercises.map((ex) => (
          <button
            key={ex.id}
            type="button"
            onClick={() => quickLog(ex)}
            disabled={busy !== null}
            className="h-10 rounded-full bg-secondary px-3 text-xs font-semibold text-secondary-foreground transition-colors hover:bg-muted disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {busy === ex.id ? "Starting…" : ex.name}
          </button>
        ))}
      </div>
    </section>
  );
}
