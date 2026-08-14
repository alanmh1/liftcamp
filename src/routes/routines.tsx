import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { BackLink } from "@/components/BackLink";
import { Skeleton } from "@/components/ui/skeleton";
import { SystemTemplateCard } from "@/components/SystemTemplateCard";
import { groupPrograms, type TemplateRow } from "@/lib/templates";
import { canonMuscle } from "@/lib/muscle-vocab";

export const Route = createFileRoute("/routines")({
  head: () => ({
    meta: [
      { title: "Built-in Routines — LiftCamp" },
      {
        name: "description",
        content:
          "Browse every built-in LiftCamp routine, from push/pull/legs to the Arnold Split, and start one in a tap.",
      },
      { property: "og:title", content: "Built-in Routines — LiftCamp" },
      {
        property: "og:description",
        content:
          "Browse every built-in LiftCamp routine, from push/pull/legs to the Arnold Split, and start one in a tap.",
      },
      { property: "og:url", content: "https://liftcamp.app/routines" },
    ],
    links: [{ rel: "canonical", href: "https://liftcamp.app/routines" }],
  }),
  component: RoutinesPage,
});

type MuscleMap = Record<string, string[]>;

function RoutinesPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login", replace: true });
  }, [session, loading, navigate]);

  // Every system template, including hide_from_onboarding ones — that flag
  // only governs the home screen's Starter routines section.
  const { data: templates, isPending } = useQuery({
    queryKey: ["all-system-templates"],
    enabled: !!session,
    queryFn: async (): Promise<TemplateRow[]> => {
      const { data, error } = await supabase
        .from("templates")
        .select(
          "id, name, is_system, program, program_blurb, program_order, hide_from_onboarding, template_exercises(exercise_id, position)",
        )
        .eq("is_system", true)
        .order("program_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TemplateRow[];
    },
  });

  const exerciseIds = [
    ...new Set((templates ?? []).flatMap((t) => t.template_exercises.map((te) => te.exercise_id))),
  ];

  const { data: muscleByExercise } = useQuery({
    queryKey: ["system-template-muscles", exerciseIds.length],
    enabled: exerciseIds.length > 0,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase
        .from("exercises")
        .select("id, primary_muscle")
        .in("id", exerciseIds);
      if (error) throw error;
      return Object.fromEntries(
        (data ?? []).map((e) => [e.id, canonMuscle(e.primary_muscle ?? "")]),
      );
    },
  });

  const musclesFor: MuscleMap = {};
  for (const t of templates ?? []) {
    const seen: string[] = [];
    for (const te of t.template_exercises) {
      const m = muscleByExercise?.[te.exercise_id];
      if (m && !seen.includes(m)) seen.push(m);
    }
    musclesFor[t.id] = seen;
  }

  const programs = groupPrograms(templates ?? []);

  if (loading || !session) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">…</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col pb-28">
      <header className="px-5 pt-4 pb-4">
        <BackLink to="/" label="Home" />
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Routines</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Every built-in program. Use one as-is, or duplicate it to make it yours.
        </p>
      </header>

      <main className="flex-1 px-5 pb-10 flex flex-col gap-6">
        {isPending ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-28 w-full rounded-lg" />
            <Skeleton className="h-28 w-full rounded-lg" />
            <Skeleton className="h-28 w-full rounded-lg" />
          </div>
        ) : programs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No built-in routines yet.</p>
        ) : (
          programs.map((g) => (
            <section key={g.program} className="flex flex-col gap-2">
              <div>
                <h2 className="text-base font-semibold tracking-tight">{g.program}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {g.templates.length} day{g.templates.length === 1 ? "" : "s"}
                  {g.blurb ? ` — ${g.blurb}` : ""}
                </p>
              </div>
              <ul className="flex flex-col gap-2">
                {g.templates.map((t) => (
                  <li key={t.id}>
                    <SystemTemplateCard template={t} muscles={musclesFor[t.id]} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </main>
      <BottomNav />
    </div>
  );
}
