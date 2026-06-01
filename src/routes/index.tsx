import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lift" },
      { name: "description", content: "Fast, spartan strength-training log." },
    ],
  }),
  component: Index,
});

type TemplateRow = {
  id: string;
  name: string;
  template_exercises: { exercise_id: string; position: number }[];
};

function Index() {
  const { session, loading, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login", replace: true });
  }, [session, loading, navigate]);

  const { data: libCount } = useQuery({
    queryKey: ["exercises-count"],
    enabled: !!session,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("exercises")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: templates } = useQuery({
    queryKey: ["templates"],
    enabled: !!session,
    queryFn: async (): Promise<TemplateRow[]> => {
      const { data, error } = await supabase
        .from("templates")
        .select("id, name, template_exercises(exercise_id, position)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TemplateRow[];
    },
  });

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">…</p>
      </div>
    );
  }

  const hasLibrary = (libCount ?? 0) > 0;

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24">
      <header className="px-5 pt-6 pb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl">LIFT</h1>
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-xs text-muted-foreground underline"
        >
          Sign out
        </button>
      </header>

      <main className="flex-1 px-5 pb-10 flex flex-col gap-6">
        <section>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Signed in</p>
          <p className="mt-1 text-sm">{user?.email}</p>
        </section>


        <StartWorkoutButton disabled={!hasLibrary} />
        {!hasLibrary && (
          <p className="text-xs text-muted-foreground -mt-3">
            Available once the library is imported.
          </p>
        )}
        <button
          onClick={() => navigate({ to: "/templates/new" })}
          disabled={!hasLibrary}
          className="h-12 rounded-md border border-input bg-background text-sm font-semibold disabled:opacity-40"
        >
          New Template
        </button>

        {templates && templates.length > 0 && (
          <section className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Templates</p>
            <ul className="flex flex-col gap-2">
              {templates.map((t) => (
                <li key={t.id}>
                  <TemplateCard template={t} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

function StartWorkoutButton({ disabled }: { disabled: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function start() {
    if (!user) return;
    setBusy(true);
    const hour = new Date().getHours();
    const defaultName =
      hour >= 5 && hour < 12 ? "Morning Workout" :
      hour >= 12 && hour < 17 ? "Afternoon Workout" :
      hour >= 17 && hour < 21 ? "Evening Workout" :
      "Night Workout";
    const { data, error } = await supabase
      .from("workouts")
      .insert({ user_id: user.id, name: defaultName })
      .select("id")
      .single();
    setBusy(false);
    if (error || !data) {
      console.error(error);
      return;
    }
    navigate({ to: "/workout/$workoutId", params: { workoutId: data.id } });
  }

  return (
    <button
      onClick={start}
      disabled={disabled || busy}
      className="h-14 rounded-md bg-primary text-primary-foreground text-base font-semibold disabled:opacity-40"
    >
      {busy ? "…" : "Start workout"}
    </button>
  );
}

function TemplateCard({ template }: { template: TemplateRow }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function start() {
    if (!user || busy) return;
    setBusy(true);

    const { data: workout, error: wErr } = await supabase
      .from("workouts")
      .insert({ user_id: user.id, name: template.name })
      .select("id")
      .single();
    if (wErr || !workout) {
      console.error(wErr);
      setBusy(false);
      return;
    }

    const ordered = [...template.template_exercises].sort((a, b) => a.position - b.position);

    for (let i = 0; i < ordered.length; i++) {
      const te = ordered[i];
      const { data: weData, error: weErr } = await supabase
        .from("workout_exercises")
        .insert({
          workout_id: workout.id,
          exercise_id: te.exercise_id,
          user_id: user.id,
          position: i,
        })
        .select("id")
        .single();
      if (weErr || !weData) {
        console.error(weErr);
        continue;
      }

      const { data: prior } = await supabase
        .from("workout_exercises")
        .select("id, created_at, sets(position, weight, reps)")
        .eq("user_id", user.id)
        .eq("exercise_id", te.exercise_id)
        .neq("id", weData.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const priorSets = (prior?.sets ?? []) as { position: number; weight: string; reps: number | null }[];
      const firstPrior = priorSets.length > 0
        ? [...priorSets].sort((a, b) => a.position - b.position)[0]
        : null;

      await supabase.from("sets").insert({
        workout_exercise_id: weData.id,
        user_id: user.id,
        position: 0,
        weight: firstPrior?.weight ?? "",
        reps: firstPrior?.reps ?? null,
      });
    }

    navigate({ to: "/workout/$workoutId", params: { workoutId: workout.id } });
  }

  const count = template.template_exercises.length;

  return (
    <button
      onClick={start}
      disabled={busy}
      className="w-full text-left rounded-md border border-border bg-card px-4 py-3 hover:bg-accent/40 transition-colors disabled:opacity-60"
    >
      <p className="text-sm font-semibold tracking-tight">{template.name}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {busy ? "Starting…" : `${count} exercise${count === 1 ? "" : "s"}`}
      </p>
    </button>
  );
}
