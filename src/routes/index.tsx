import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { EVENTS, track, trackWorkoutStartFailed } from "@/lib/analytics";
import { useQuery } from "@tanstack/react-query";
import { BottomNav } from "@/components/BottomNav";
import { Landing } from "@/components/Landing";

import { LastWorkoutCard } from "@/components/LastWorkoutCard";
import { ResumeWorkoutCard } from "@/components/ResumeWorkoutCard";
import { StreakCard } from "@/components/StreakCard";
import { PrGoalCard } from "@/components/PrGoalCard";
import { StrengthGoalNudge } from "@/components/StrengthGoalNudge";
import { FrequencyNudge } from "@/components/FrequencyNudge";
import { QuickStart } from "@/components/QuickStart";
import { InstallNudge } from "@/components/InstallNudge";

import { Skeleton } from "@/components/ui/skeleton";
import logoAsset from "@/assets/replog-logo.svg.asset.json";
import { ChevronDown, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { populateWorkoutExercises } from "@/lib/start-workout";
import { SystemTemplateCard } from "@/components/SystemTemplateCard";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { HomeGreeting } from "@/components/HomeGreeting";
import { firstNameFromMetadata, headerGreeting } from "@/lib/greeting";
import { GuidedTour } from "@/components/GuidedTour";
import { groupPrograms, type TemplateRow } from "@/lib/templates";
import { TemplateCard } from "@/components/TemplateCard";
import { getExerciseCount } from "@/lib/public-catalog.functions";



import {
  PushIcon,
  PullIcon,
  LegsIcon,
  FullBodyIcon,
} from "@/components/icons/DayIcons";
import {
  generateWorkout,
  musclesForDay,
  GENERATOR_CATEGORIES,
  DAY_TYPES,
  type DayType,
  type CandidateExercise,
} from "@/lib/generate-workout";

export const Route = createFileRoute("/")({
  // The exercise count in the description is live data, not a constant — the
  // last hardcoded figure went stale within weeks.
  loader: async () => ({ exerciseCount: await getExerciseCount() }),
  head: ({ loaderData }) => {
    const count = loaderData?.exerciseCount ?? 886;
    const title = "Free Workout Tracker and Exercise Library | LiftCamp";
    const description = `Log your sets, spot your PRs, and pick your next workout from ${count} exercises. Built for people in their first six months of lifting. Free, nothing to install.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: "https://liftcamp.app/" },
        { property: "og:image", content: "https://liftcamp.app/og-image.png" },
        { name: "twitter:image", content: "https://liftcamp.app/og-image.png" },
      ],
      links: [
        { rel: "canonical", href: "https://liftcamp.app/" },
        // Work Sans and IBM Plex Mono are used by Landing only. Declared here
        // rather than in the root so the other ~910 pages do not block on a
        // font request for type they never render.
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap",
        },
      ],
    };
  },

  component: Index,
});



function Index() {
  const { session, loading, user } = useAuth();
  const navigate = useNavigate();


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
          "id, name, is_system, program, program_blurb, program_order, hide_from_onboarding, template_exercises(exercise_id, position)",
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

  if (!loading && !session) {
    return <Landing />;
  }

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
  // Escape hatch for previewing the onboarding tour on an existing account: /?tour=1
  const forceTour =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("tour");
  // Programs flagged hide_from_onboarding never appear in Starter routines,
  // regardless of how long the account has existed.
  const programs = groupPrograms((systemTemplates ?? []).filter((t) => !t.hide_from_onboarding));

  const starterRoutines = programs.length > 0 && (
    <Collapsible
      defaultOpen={isNewUser}
      data-tour="routines"
      className="rounded-lg border border-border bg-card"
    >
      <CollapsibleTrigger
        className={cn(
          "flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer",
          "transition-colors hover:bg-accent/40 rounded-lg",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "[&[data-state=open]]:rounded-b-none [&[data-state=open]>span>svg]:rotate-180",
        )}
      >
        <span className="flex flex-col">
          <span className="text-sm font-semibold tracking-tight">Starter routines</span>
          <span className="mt-0.5 text-[13px] text-muted-foreground">
            {programs.length} proven program{programs.length === 1 ? "" : "s"} — tap to browse
          </span>
        </span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <ChevronDown className="h-4 w-4 transition-transform duration-200" />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4">
        {isNewUser && (
          <p className="mb-3 text-sm text-muted-foreground">
            New here? Pick one program and repeat it week to week — the weight going up is the
            progress.
          </p>
        )}

        <div className="flex flex-col gap-5">
          {programs.map((g) => (
            <section key={g.program} className="flex flex-col gap-2">
              <div>
                <p className="text-sm font-semibold tracking-tight">{g.program}</p>
                {g.blurb && <p className="mt-0.5 text-[13px] text-muted-foreground">{g.blurb}</p>}
              </div>
              <ul className="flex flex-col gap-2">
                {g.templates.map((t) => (
                  <li key={t.id}>
                    <SystemTemplateCard template={t} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );


  return (
    <div className="min-h-dvh bg-background flex flex-col pb-28">
      <header className="px-5 pt-6 pb-4 flex items-start gap-2">
        <img src={logoAsset.url} alt="" className="h-8 w-8" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl">
            {headerGreeting(
              firstNameFromMetadata(user?.user_metadata as Record<string, unknown> | undefined),
              new Date().getHours(),
            )}
          </h1>
          <div className="min-h-10">
            {user && <HomeGreeting userId={user.id} />}
          </div>
        </div>
        <Link
          to="/profile"
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Profile"
        >
          <User className="h-5 w-5" aria-hidden />
        </Link>
      </header>

      <main className="flex-1 px-5 pb-10 flex flex-col gap-6">
        {user && <OnboardingChecklist userId={user.id} />}
        {user && <StreakCard userId={user.id} />}
        {user && <FrequencyNudge userId={user.id} />}
        {user && <PrGoalCard userId={user.id} />}
        {user && <StrengthGoalNudge userId={user.id} />}
        {user && <ResumeWorkoutCard userId={user.id} />}
        {user && <LastWorkoutCard userId={user.id} />}
        {user && <QuickStart />}
        {user && <InstallNudge />}

        {isNewUser && starterRoutines}


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
            <GenerateWorkoutPanel disabled={false} />
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
            <Link
              to="/routines"
              className="inline-flex h-9 items-center self-start rounded-md px-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Browse all routines →
            </Link>
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

        {!isNewUser && starterRoutines}

      </main>
      <BottomNav />
      <GuidedTour enabled={isNewUser || forceTour} />
    </div>
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

const DAY_ICON: Record<DayType, typeof PushIcon> = {
  push: PushIcon,
  pull: PullIcon,
  legs: LegsIcon,
  full: FullBodyIcon,
};

const DAY_ICON_HEIGHT: Record<DayType, number> = {
  push: 30,
  pull: 30,
  legs: 40,
  full: 40,
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
      <p className="mt-0.5 text-[13px] text-muted-foreground">
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
              "flex h-14 items-center gap-2 rounded-lg pl-3 pr-3 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              DAY_TINT[d.value],
            )}
          >
            <span className="flex w-12 shrink-0 justify-center">
              {(() => {
                const Icon = DAY_ICON[d.value];
                return <Icon height={DAY_ICON_HEIGHT[d.value]} />;
              })()}
            </span>
            <span className="whitespace-nowrap leading-tight">
              {busy === d.value ? "Generating…" : d.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
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
    trackWorkoutStartFailed("generated", wErr);
    console.error(wErr);
    return null;
  }

  void track(EVENTS.routineChosen, { template: `${label} (generated)`, is_system: false });
  void track(EVENTS.workoutStarted, { source: "generated" });

  await populateWorkoutExercises(userId, workout.id, picks.map((p) => p.id));
  return workout.id;
}


