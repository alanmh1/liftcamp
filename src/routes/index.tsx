import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BottomNav } from "@/components/BottomNav";
import logoAsset from "@/assets/replog-logo.svg.asset.json";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import {
  generateWorkout,
  musclesForDay,
  DAY_TYPES,
  type DayType,
  type CandidateExercise,
} from "@/lib/generate-workout";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RepLog" },
      { name: "description", content: "Fast, spartan strength-training log." },
    ],
  }),
  component: Index,
});

type TemplateRow = {
  id: string;
  name: string;
  is_system?: boolean;
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
    queryKey: ["templates", user?.id],
    enabled: !!session && !!user,
    queryFn: async (): Promise<TemplateRow[]> => {
      const { data, error } = await supabase
        .from("templates")
        .select("id, name, is_system, template_exercises(exercise_id, position)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TemplateRow[];
    },
  });

  const { data: systemTemplates } = useQuery({
    queryKey: ["system-templates"],
    enabled: !!session,
    queryFn: async (): Promise<TemplateRow[]> => {
      const { data, error } = await supabase
        .from("templates")
        .select("id, name, is_system, template_exercises(exercise_id, position)")
        .eq("is_system", true)
        .order("name", { ascending: true });
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
      <header className="px-5 pt-6 pb-4 flex items-center gap-2">
        <img src={logoAsset.url} alt="" className="h-8 w-8" />
        <h1 className="font-display text-2xl">Start Workout</h1>
      </header>

      <main className="flex-1 px-5 pb-10 flex flex-col gap-6">



        <StartWorkoutButton disabled={!hasLibrary} />
        {!hasLibrary && (
          <p className="text-xs text-muted-foreground -mt-3">
            Available once the library is imported.
          </p>
        )}
        <GenerateWorkoutPanel disabled={!hasLibrary} />
        <button
          onClick={() => navigate({ to: "/templates/new" })}
          disabled={!hasLibrary}
          className="h-12 rounded-md border border-input bg-background text-sm font-semibold text-center px-4 disabled:opacity-40"
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

        {systemTemplates && systemTemplates.length > 0 && (
          <Collapsible defaultOpen={false}>
            <CollapsibleTrigger
              className={cn(
                "flex w-full items-center justify-between py-2 text-xs uppercase tracking-wide text-muted-foreground cursor-pointer [&[data-state=open]>svg]:rotate-180",
              )}
            >
              <span>Starter Templates</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="flex flex-col gap-2">
                {systemTemplates.map((t) => (
                  <li key={t.id}>
                    <SystemTemplateCard template={t} />
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
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
      className="h-14 rounded-md bg-primary text-primary-foreground text-base font-semibold text-center px-4 disabled:opacity-40"
    >
      {busy ? "…" : "Start workout"}
    </button>
  );
}

function GenerateWorkoutPanel({ disabled }: { disabled: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<DayType | null>(null);

  async function go(day: DayType) {
    if (!user || busy) return;
    setBusy(day);
    const id = await generateAndStartWorkout(user.id, day);
    if (!id) {
      setBusy(null);
      return;
    }
    navigate({ to: "/workout/$workoutId", params: { workoutId: id } });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className="h-12 rounded-md border border-input bg-background text-sm font-semibold px-4 disabled:opacity-40 flex items-center justify-center gap-2"
        aria-expanded={open}
      >
        Generate workout
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-2">
          {DAY_TYPES.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => go(d.value)}
              disabled={busy !== null}
              className="h-11 rounded-md border border-border bg-card text-sm font-semibold hover:bg-accent/40 transition-colors disabled:opacity-50"
            >
              {busy === d.value ? "Generating…" : d.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


async function populateWorkoutExercises(
  userId: string,
  workoutId: string,
  exerciseIds: string[],
): Promise<void> {
  const { coldStartSuggestion } = await import("@/lib/suggestions");

  for (let i = 0; i < exerciseIds.length; i++) {
    const exerciseId = exerciseIds[i];
    const { data: weData, error: weErr } = await supabase
      .from("workout_exercises")
      .insert({
        workout_id: workoutId,
        exercise_id: exerciseId,
        user_id: userId,
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
      .select("id, created_at, sets(position, weight, weight_value, reps)")
      .eq("user_id", userId)
      .eq("exercise_id", exerciseId)
      .neq("id", weData.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const priorSets = (prior?.sets ?? []) as { position: number; weight: string; weight_value: number | null; reps: number | null }[];

    if (priorSets.length > 0) {
      const sorted = [...priorSets].sort((a, b) => a.position - b.position);
      const mostRecent = sorted[sorted.length - 1];
      const rows = sorted.map((_, idx) => ({
        workout_exercise_id: weData.id,
        user_id: userId,
        position: idx,
        weight: mostRecent.weight ?? "",
        weight_value: mostRecent.weight_value ?? null,
        reps: mostRecent.reps ?? null,
      }));
      await supabase.from("sets").insert(rows);
    } else {
      const { data: exRow } = await supabase
        .from("exercises")
        .select("mechanic, level, equipment")
        .eq("id", exerciseId)
        .maybeSingle();
      const sugg = coldStartSuggestion(exRow ?? {});
      const rows = Array.from({ length: sugg.sets }, (_, idx) => ({
        workout_exercise_id: weData.id,
        user_id: userId,
        position: idx,
        weight: "",
        reps: sugg.reps,
      }));
      await supabase.from("sets").insert(rows);
    }
  }
}

async function startWorkoutFromTemplate(
  userId: string,
  template: TemplateRow,
): Promise<string | null> {
  const { data: workout, error: wErr } = await supabase
    .from("workouts")
    .insert({ user_id: userId, name: template.name })
    .select("id")
    .single();
  if (wErr || !workout) {
    console.error(wErr);
    return null;
  }

  const ordered = [...template.template_exercises].sort((a, b) => a.position - b.position);
  await populateWorkoutExercises(userId, workout.id, ordered.map((te) => te.exercise_id));
  return workout.id;
}

async function generateAndStartWorkout(
  userId: string,
  day: DayType,
): Promise<string | null> {
  const { data: pool, error: poolErr } = await supabase
    .from("exercises")
    .select("id, name, primary_muscle, mechanic, equipment, level")
    .in("primary_muscle", musclesForDay(day))
    .limit(500);
  if (poolErr || !pool || pool.length === 0) {
    console.error(poolErr);
    return null;
  }

  const { data: history } = await supabase
    .from("workout_exercises")
    .select("exercise_id")
    .eq("user_id", userId)
    .limit(2000);
  const trainedIds = new Set((history ?? []).map((h) => h.exercise_id));

  const picks = generateWorkout(day, pool as CandidateExercise[], { trainedIds });
  if (picks.length === 0) return null;

  const label = DAY_TYPES.find((d) => d.value === day)?.label ?? "Workout";
  const { data: workout, error: wErr } = await supabase
    .from("workouts")
    .insert({ user_id: userId, name: `${label} Workout` })
    .select("id")
    .single();
  if (wErr || !workout) {
    console.error(wErr);
    return null;
  }

  await populateWorkoutExercises(userId, workout.id, picks.map((p) => p.id));
  return workout.id;
}

function TemplateCard({ template }: { template: TemplateRow }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function start() {
    if (!user || busy) return;
    setBusy(true);
    const id = await startWorkoutFromTemplate(user.id, template);
    if (!id) {
      setBusy(false);
      return;
    }
    navigate({ to: "/workout/$workoutId", params: { workoutId: id } });
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

function SystemTemplateCard({ template }: { template: TemplateRow }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<"use" | "dup" | null>(null);

  async function use() {
    if (!user || busy) return;
    setBusy("use");
    const id = await startWorkoutFromTemplate(user.id, template);
    if (!id) {
      setBusy(null);
      return;
    }
    navigate({ to: "/workout/$workoutId", params: { workoutId: id } });
  }

  async function duplicate() {
    if (!user || busy) return;
    setBusy("dup");
    const { data: tpl, error: tplErr } = await supabase
      .from("templates")
      .insert({ user_id: user.id, name: template.name, is_system: false })
      .select("id")
      .single();
    if (tplErr || !tpl) {
      console.error(tplErr);
      setBusy(null);
      return;
    }
    const ordered = [...template.template_exercises].sort((a, b) => a.position - b.position);
    if (ordered.length > 0) {
      const rows = ordered.map((te, i) => ({
        template_id: tpl.id,
        exercise_id: te.exercise_id,
        user_id: user.id,
        position: i,
      }));
      const { error: teErr } = await supabase.from("template_exercises").insert(rows);
      if (teErr) {
        console.error(teErr);
        setBusy(null);
        return;
      }
    }
    queryClient.invalidateQueries({ queryKey: ["templates", user.id] });
    navigate({ to: "/" });
  }

  const count = template.template_exercises.length;

  return (
    <div className="rounded-md border border-border bg-card px-4 py-3">
      <p className="text-sm font-semibold tracking-tight">{template.name}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {count} exercise{count === 1 ? "" : "s"}
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={use}
          disabled={busy !== null}
          className="flex-1 h-9 rounded-md border border-input bg-background text-xs font-semibold disabled:opacity-40"
        >
          {busy === "use" ? "…" : "Use"}
        </button>
        <button
          onClick={duplicate}
          disabled={busy !== null}
          className="flex-1 h-9 rounded-md border border-input bg-background text-xs font-semibold disabled:opacity-40"
        >
          {busy === "dup" ? "…" : "Duplicate"}
        </button>
      </div>
    </div>
  );
}
