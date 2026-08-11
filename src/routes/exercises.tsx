import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { ExercisePicker } from "@/components/ExercisePicker";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/exercises")({
  head: () => ({
    meta: [
      { title: "Exercises — LiftCamp" },
      { name: "description", content: "Browse the full exercise library." },
    ],
  }),
  component: ExercisesPage,
});

function ExercisesPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login", replace: true });
  }, [session, loading, navigate]);

  if (loading || !session) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">…</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col pb-24">
      <header className="px-5 pt-6 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Exercises</h1>
        <p className="mt-1 text-xs text-muted-foreground">Browse the full library.</p>
      </header>
      <main className="flex-1 px-5 pb-6">
        <ExercisePicker mode="browse" />
      </main>
      <BottomNav />
    </div>
  );
}
