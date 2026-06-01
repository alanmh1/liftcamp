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
        <h1 className="text-2xl font-bold tracking-tight">LIFT</h1>
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

        <section className="rounded-md border border-border p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Exercise library</p>
          <p className="mt-1 num text-2xl">{libCount ?? "…"} <span className="text-sm text-muted-foreground font-sans">exercises</span></p>
          {!hasLibrary && (
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Library is empty. Import <code className="num">workout_exercise_library.csv</code> into
              the <code className="num">exercises</code> table from the backend dashboard,
              then come back and the suggestion engine will have something to draw from.
            </p>
          )}
        </section>

        <StartWorkoutButton disabled={!hasLibrary} />
        {!hasLibrary && (
          <p className="text-xs text-muted-foreground -mt-3">
            Available once the library is imported.
          </p>
        )}
      </main>
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
