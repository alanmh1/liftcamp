import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BottomNav } from "@/components/BottomNav";
import { LastWorkoutCard } from "@/components/LastWorkoutCard";
import { StreakCard } from "@/components/StreakCard";
import { QuickStart } from "@/components/QuickStart";
import { Skeleton } from "@/components/ui/skeleton";
import logoAsset from "@/assets/replog-logo.svg.asset.json";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { toast } from "sonner";


import {
  generateWorkout,
  musclesForDay,
  GENERATOR_CATEGORIES,
  DAY_TYPES,
  type DayType,
  type CandidateExercise,
} from "@/lib/generate-workout";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LiftCamp" },
      { name: "description", content: "Log workouts fast, track sets and PRs, and know exactly what to lift next — a simple strength-training tracker built for the gym." },
      { property: "og:url", content: "https://liftcamp.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://liftcamp.lovable.app/" }],
  }),
  component: Index,
});

type TemplateRow = {
  id: string;
  name: string;
  is_system?: boolean;
  program?: string | null;
  program_blurb?: string | null;
  program_order?: number | null;
  template_exercises: { exercise_id: string; position: number }[];
};

type ProgramGroup = {
  program: string;
  blurb: string | null;
  order: number;
  templates: TemplateRow[];
};

function groupPrograms(rows: TemplateRow[]): ProgramGroup[] {
  const map = new Map<string, ProgramGroup>();
  for (const t of rows) {
    const program = t.program?.trim() || "Other routines";
    let g = map.get(program);
    if (!g) {
      g = { program, blurb: t.program_blurb ?? null, order: t.program_order ?? 99, templates: [] };
      map.set(program, g);
    }
    if (!g.blurb && t.program_blurb) g.blurb = t.program_blurb;
    g.order = Math.min(g.order, t.program_order ?? 99);
    g.templates.push(t);
  }
  return [...map.values()]
    .map((g) => ({ ...g, templates: g.templates.sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => a.order - b.order || a.program.localeCompare(b.program));
}


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
        .select(
          "id, name, is_system, program, program_blurb, program_order, template_exercises(exercise_id, position)",
        )
        .eq("is_system", true)
        .order("program_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TemplateRow[];
    },
  });

  const { data: workoutCount } = useQuery({
    queryKey: ["workout-count", user?.id],
    enabled: !!session && !!user,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("workouts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .not("finished_at", "is", null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  if (loading || !session) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">…</p>
      </div>
    );
  }

  const hasLibrary = (libCount ?? 0) > 0;
  const libraryPending = libCount === undefined;
  const isNewUser = workoutCount === 0 && (templates?.length ?? 0) === 0;
  const programs = groupPrograms(systemTemplates ?? []);


  return (
    <div className="min-h-dvh bg-background flex flex-col pb-28">
      <header className="px-5 pt-6 pb-4 flex items-center gap-2">
        <img src={logoAsset.url} alt="" className="h-8 w-8" />
        <h1 className="font-display text-2xl">Start Workout</h1>
      </header>

      <main className="flex-1 px-5 pb-10 flex flex-col gap-6">
        {user && <StreakCard userId={user.id} />}
        {user && <LastWorkoutCard userId={user.id} />}
        {user && <QuickStart />}

        {libraryPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-14 w-full rounded-lg" />
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
            </div>
          </div>
        ) : !hasLibrary ? (
          <div className="rounded-lg border border-dashed border-border bg-card px-4 py-6 text-center">
            <p className="text-sm font-semibold">Your exercise library is empty</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Once exercises are imported you can start, generate, and save workouts here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <StartWorkoutButton disabled={false} />
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => navigate({ to: "/templates/new" })}
                className="h-12 rounded-lg bg-secondary text-secondary-foreground text-sm font-semibold px-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                New template
              </button>
              <Link
                to="/exercises"
                className="flex h-12 items-center justify-center rounded-lg bg-secondary text-secondary-foreground text-sm font-semibold px-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Browse exercises
              </Link>
            </div>
            <GenerateWorkoutPanel disabled={false} />
          </div>
        )}

        {templates && templates.length > 0 && (
          <section className="flex flex-col gap-2">
            <p className="micro text-muted-foreground">Templates</p>
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
                "flex min-h-11 w-full items-center justify-between py-2 micro text-muted-foreground cursor-pointer [&[data-state=open]>svg]:rotate-180",
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
      className="h-14 rounded-lg bg-primary text-primary-foreground text-base font-semibold text-center px-4 disabled:opacity-40"
    >
      {busy ? "…" : "Start workout"}
    </button>
  );
}

// Day-type tints reuse the muscle-chip families, so a Pull day reads the same
// blue here as its exercises do in the picker.
const DAY_TINT: Record<DayType, string> = {
  push: "bg-day-push text-day-push-foreground",
  pull: "bg-day-pull text-day-pull-foreground",
  legs: "bg-day-legs text-day-legs-foreground",
  full: "bg-day-full text-day-full-foreground",
};

function GenerateWorkoutPanel({ disabled }: { disabled: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<DayType | null>(null);

  async function go(day: DayType) {
    if (!user || busy) return;
    setBusy(day);
    const id = await generateAndStartWorkout(user.id, day);
    if (!id) {
      setBusy(null);
      toast.error("Couldn't generate that workout. Try another day type.");
      return;
    }
    navigate({ to: "/workout/$workoutId", params: { workoutId: id } });
  }


  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-sm font-semibold">Generate a workout</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Pick a day and we'll build it from your library.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {DAY_TYPES.map((d) => (
          <button
            key={d.value}
            type="button"
            onClick={() => go(d.value)}
            disabled={disabled || busy !== null}
            className={cn(
              "h-11 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              DAY_TINT[d.value],
            )}
          >
            {busy === d.value ? "Generating…" : d.label}
          </button>
        ))}
      </div>
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
    .in("category", [...GENERATOR_CATEGORIES])
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
    toast.success(`"${template.name}" copied to your templates.`);
    setBusy(null);
  }

  const count = template.template_exercises.length;

  return (
    <div className="rounded-lg bg-secondary px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold tracking-tight">{template.name}</p>
        <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-foreground">
          Built-in
        </span>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {count} exercise{count === 1 ? "" : "s"}
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={use}
          disabled={busy !== null}
          className="flex-1 h-11 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {busy === "use" ? "…" : "Use"}
        </button>
        <button
          onClick={duplicate}
          disabled={busy !== null}
          className="flex-1 h-11 rounded-md border border-input bg-background text-sm font-semibold disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {busy === "dup" ? "…" : "Duplicate"}
        </button>
      </div>

    </div>
  );
}
