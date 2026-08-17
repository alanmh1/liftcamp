import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Clock, Info, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { EVENTS, track } from "@/lib/analytics";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { inferWorkoutName, isDefaultWorkoutName } from "@/lib/infer-workout-name";
import { muscleColors, equipmentIcon, formatEquipmentLabel } from "@/lib/exercise-visuals";
import { usesPlates } from "@/lib/plate-math";
import { PlateBreakdown } from "@/components/PlateBreakdown";
import { muscleLabel } from "@/lib/muscle-vocab";
import { WorkoutNotes } from "@/components/WorkoutNotes";
import { ExercisePicker } from "@/components/ExercisePicker";
import { ExerciseInfo } from "@/components/ExerciseInfo";
import { BackLink } from "@/components/BackLink";
import { RestTimer } from "@/components/RestTimer";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { coldStartSuggestion } from "@/lib/suggestions";
import { useWeightUnit } from "@/lib/weight-unit";
import { computePrSetIds } from "@/lib/pr";
import { bwModeFromValue, signedFromBw, effectiveLoad, type BwMode } from "@/lib/set-weight";
import { oneRepMaxNumeric } from "@/lib/one-rep-max";

import { WorkoutName } from "@/components/WorkoutName";
import { useBodyweight } from "@/lib/use-bodyweight";
import { haptic } from "@/lib/haptics";
import { ExerciseHistory } from "@/components/ExerciseHistory";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { defaultRestSeconds } from "@/lib/rest-timer-prefs";
import { workoutMilestone, volumeMilestone } from "@/lib/milestones";
import { effectiveLoad as effLoad } from "@/lib/set-weight";



function ElapsedTimer({ startIso, endIso }: { startIso: string; endIso: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (endIso) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [endIso]);
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : now;
  const total = Math.max(0, Math.floor((end - start) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  const text = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  return (
    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
      <Clock className="h-3.5 w-3.5" />
      <span className="num tabular-nums">{text}</span>
    </div>
  );
}

export const Route = createFileRoute("/workout/$workoutId")({
  head: () => ({
    meta: [
      { title: "Workout — LiftCamp" },
      { name: "description", content: "Log sets, reps and weight during an active workout, with rest timers and PR alerts." },
      { property: "og:title", content: "Workout — LiftCamp" },
      { property: "og:description", content: "Log sets, reps and weight during an active workout, with rest timers and PR alerts." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WorkoutPage,
});

type Exercise = {
  id: string;
  name: string;
  primary_muscle: string | null;
  all_primary_muscles?: string | null;
  secondary_muscles?: string | null;
  image_url?: string | null;
  image_url_2?: string | null;
  equipment?: string | null;
  ppl_day?: string | null;
  description?: string | null;
  mechanic?: string | null;
  level?: string | null;
  weight_type?: string | null;
};
type SetRow = { id: string; position: number; weight: string; weight_value: number | null; reps: number | null; completed: boolean; note: string | null };
type WeRow = {
  id: string;
  position: number;
  exercise_id: string;
  exercise: Exercise;
  sets: SetRow[];
};


function WorkoutPage() {
  const { workoutId } = Route.useParams();
  const { session, loading, user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { unit } = useWeightUnit();
  const bodyweight = useBodyweight();


  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login", replace: true });
  }, [session, loading, navigate]);

  const workoutQ = useQuery({
    queryKey: ["workout", workoutId],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workouts")
        .select("id, name, workout_date, finished_at, created_at, notes")
        .eq("id", workoutId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const weQ = useQuery({
    queryKey: ["workout-exercises", workoutId],
    enabled: !!session,
    queryFn: async (): Promise<WeRow[]> => {
      const { data, error } = await supabase
        .from("workout_exercises")
        .select(
          "id, position, exercise_id, exercise:exercises(id, name, primary_muscle, equipment, mechanic, level, description, all_primary_muscles, secondary_muscles, weight_type, image_url, image_url_2), sets(id, position, weight, weight_value, reps, completed, note)",
        )
        .eq("workout_id", workoutId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data as unknown as WeRow[]).map((w) => ({
        ...w,
        sets: [...w.sets].sort((a, b) => a.position - b.position),
      }));
    },
  });

  // Reorder exercises within the workout. Positions are rewritten for the whole
  // list so duplicate/legacy positions self-heal.
  async function moveExercise(index: number, dir: -1 | 1) {
    const list = weQ.data ?? [];
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];

    qc.setQueryData(["workout-exercises", workoutId], next);

    await Promise.all(
      next.map((w, i) =>
        supabase.from("workout_exercises").update({ position: i }).eq("id", w.id),
      ),
    );
    qc.invalidateQueries({ queryKey: ["workout-exercises", workoutId] });
  }

  async function addExercise(ex: Exercise) {
    if (!user) return;
    const nextPos = (weQ.data?.length ?? 0);
    const { data: weData, error: weErr } = await supabase
      .from("workout_exercises")
      .insert({
        workout_id: workoutId,
        exercise_id: ex.id,
        user_id: user.id,
        position: nextPos,
      })
      .select("id")
      .single();
    if (weErr || !weData) {
      console.error(weErr);
      return;
    }

    const { data: prior } = await supabase
      .from("workout_exercises")
      .select("id, created_at, sets(position, weight, weight_value, reps)")
      .eq("user_id", user.id)
      .eq("exercise_id", ex.id)
      .neq("id", weData.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const priorSets = (prior?.sets ?? []) as { position: number; weight: string; weight_value: number | null; reps: number | null }[];
    const firstPrior = priorSets.length > 0
      ? [...priorSets].sort((a, b) => a.position - b.position)[0]
      : null;

    await supabase.from("sets").insert({
      workout_exercise_id: weData.id,
      user_id: user.id,
      position: 0,
      weight: firstPrior?.weight ?? "",
      weight_value: firstPrior?.weight_value ?? null,
      reps: firstPrior?.reps ?? null,
    });

    qc.invalidateQueries({ queryKey: ["workout-exercises", workoutId] });
  }

  async function finishWorkout() {
    const update: { finished_at: string; name?: string } = {
      finished_at: new Date().toISOString(),
    };

    // Only ever rename a workout the user hasn't named themselves.
    if (isDefaultWorkoutName(workoutQ.data?.name)) {
      const inferred = inferWorkoutName(
        (weQ.data ?? []).map((w) => w.exercise?.primary_muscle),
      );
      if (inferred) update.name = inferred;
    }

    await supabase.from("workouts").update(update).eq("id", workoutId);
    qc.invalidateQueries({ queryKey: ["history", user?.id] });
    qc.invalidateQueries({ queryKey: ["last-workout", user?.id] });
    void track(EVENTS.workoutFinished, {});
    haptic([15, 40, 15]);
    toast.success(`${update.name ?? workoutQ.data?.name ?? "Workout"} saved.`);
    void celebrateMilestones();
    navigate({ to: "/", replace: true });

  }

  // Round-number celebrations: total workouts logged, and lifetime volume.
  async function celebrateMilestones() {
    if (!user) return;
    try {
      const { count } = await supabase
        .from("workouts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("finished_at", "is", null);

      const wm = workoutMilestone(count ?? 0);
      if (wm) {
        haptic([20, 60, 20]);
        toast.success(wm.title, { description: wm.description });
      }

      const { data: allSets } = await supabase
        .from("sets")
        .select("weight, weight_value, reps, workout_exercises!inner(exercise_id, exercises(weight_type))")
        .eq("user_id", user.id)
        .eq("completed", true);

      let total = 0;
      for (const s of (allSets ?? []) as Array<{
        weight: string;
        weight_value: number | null;
        reps: number | null;
        workout_exercises: { exercises: { weight_type: string | null } | null };
      }>) {
        const load = effLoad(s, s.workout_exercises?.exercises ?? null, bodyweight);
        if (load != null && s.reps) total += load * s.reps;
      }

      let justNow = 0;
      for (const we of weQ.data ?? []) {
        for (const s of we.sets) {
          if (!s.completed) continue;
          const load = effLoad(s, we.exercise, bodyweight);
          if (load != null && s.reps) justNow += load * s.reps;
        }
      }

      const vm = volumeMilestone(total - justNow, total, unit);
      if (vm) toast.success(vm.title, { description: vm.description });
    } catch (err) {
      console.error(err);
    }
  }

  // Discard the workout entirely so it never appears in history. The workout_exercises
  // -> sets foreign keys are both ON DELETE CASCADE, so deleting the workout row is
  // sufficient; there are no orphans to clean up by hand.
  async function cancelWorkout() {
    const { error } = await supabase.from("workouts").delete().eq("id", workoutId);
    if (error) {
      console.error(error);
      toast.error("Couldn't cancel the workout. Please try again.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["history", user?.id] });
    toast("Workout discarded.");
    navigate({ to: "/", replace: true });
  }

  if (loading || !session || workoutQ.isLoading) {
    return (
      <div className="min-h-dvh bg-background px-5 pt-6">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="mt-3 h-8 w-48" />
        <Skeleton className="mt-6 h-40 w-full rounded-md" />
        <Skeleton className="mt-4 h-40 w-full rounded-md" />
      </div>
    );
  }

  const finished = !!workoutQ.data?.finished_at;
  const storedName = workoutQ.data?.name ?? "";
  // While the session is live and still carrying an auto-generated name, show
  // the name the workout will actually be saved under.
  const namePreview =
    !finished && isDefaultWorkoutName(storedName)
      ? inferWorkoutName((weQ.data ?? []).map((w) => w.exercise?.primary_muscle))
      : null;

  return (
    <div className="min-h-dvh bg-background flex flex-col pb-32">
      <header className="px-5 pt-4 pb-4 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <BackLink to="/" label="Home" />
            <WorkoutName
              workoutId={workoutId}
              name={storedName}
              date={workoutQ.data?.workout_date ?? ""}
              className="mt-1 text-xl font-bold tracking-tight"
            />
            {namePreview && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Will save as “{namePreview}” unless you rename it.
              </p>
            )}
            {workoutQ.data?.created_at && (
              <ElapsedTimer startIso={workoutQ.data.created_at} endIso={workoutQ.data.finished_at ?? null} />
            )}
          </div>
          {!finished && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="h-11 shrink-0 rounded-md border border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-destructive hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  Cancel
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel this workout?</AlertDialogTitle>
                  <AlertDialogDescription>
                    It won't be saved to your history, and this can't be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep going</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={cancelWorkout}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Discard workout
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </header>

      <main className="flex-1 px-5 py-5 flex flex-col gap-6">
        {weQ.isLoading ? (
          <>
            <Skeleton className="h-40 w-full rounded-md" />
            <Skeleton className="h-40 w-full rounded-md" />
          </>
        ) : (
          (weQ.data ?? []).map((we, i, arr) => (
            <ExerciseBlock
              key={we.id}
              we={we}
              canMoveUp={i > 0}
              canMoveDown={i < arr.length - 1}
              onMoveUp={() => moveExercise(i, -1)}
              onMoveDown={() => moveExercise(i, 1)}
              onChanged={() => qc.invalidateQueries({ queryKey: ["workout-exercises", workoutId] })}
            />
          ))
        )}

        <WorkoutNotes
          workoutId={workoutId}
          value={workoutQ.data?.notes ?? ""}
          invalidateKeys={[["workout", workoutId], ["history", workoutId]]}
        />

        <ExercisePicker onPick={addExercise} />
      </main>

      {!finished && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto w-full max-w-[480px] px-5 py-3">
            <button
              onClick={finishWorkout}
              className="h-12 w-full rounded-lg bg-primary text-base font-semibold text-primary-foreground transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Finish workout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}



function ExerciseBlock({
  we,
  onChanged,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
}: {
  we: WeRow;
  onChanged: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const { user } = useAuth();

  const priorQ = useQuery({
    queryKey: ["prior-set", user?.id, we.exercise_id, we.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("workout_exercises")
        .select("id, created_at, sets(position, weight, weight_value, reps)")
        .eq("user_id", user!.id)
        .eq("exercise_id", we.exercise_id)
        .neq("id", we.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const sets = ((data?.sets ?? []) as { position: number; weight: string; weight_value: number | null; reps: number | null }[])
        .sort((a, b) => a.position - b.position);
      const last = sets.length > 0 ? sets[sets.length - 1] : null;
      return last;
    },
  });

  const allSetsQ = useQuery({
    queryKey: ["exercise-sets", user?.id, we.exercise_id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sets")
        .select("id, weight, weight_value, reps, completed, created_at, workout_exercises!inner(exercise_id)")
        .eq("user_id", user!.id)
        .eq("completed", true)
        .eq("workout_exercises.exercise_id", we.exercise_id);
      if (error) throw error;
      return (data ?? []) as { id: string; weight: string; weight_value: number | null; reps: number | null; created_at: string }[];
    },
  });
  const bodyweight = useBodyweight();
  const prIds = useMemo(
    () => computePrSetIds(allSetsQ.data ?? [], we.exercise, bodyweight),
    [allSetsQ.data, we.exercise, bodyweight],
  );


  const priorWeight = priorQ.data?.weight ?? null;
  const priorWeightValue = priorQ.data?.weight_value ?? null;
  const priorReps = priorQ.data?.reps ?? null;
  const hasHistory = !!priorQ.data;
  const cold = useMemo(
    () => coldStartSuggestion({
      mechanic: we.exercise.mechanic,
      level: we.exercise.level,
      equipment: we.exercise.equipment,
    }),
    [we.exercise.mechanic, we.exercise.level, we.exercise.equipment],
  );
  const weightPlaceholder = hasHistory
    ? (priorWeightValue != null ? String(Math.abs(priorWeightValue)) : (priorWeight || "weight"))
    : cold.placeholder;

  const qc2 = useQueryClient();
  const { unit } = useWeightUnit();
  const [restKey, setRestKey] = useState(0);

  function bestPriorOrm(excludeId: string): number {
    let max = -Infinity;
    for (const s of allSetsQ.data ?? []) {
      if (s.id === excludeId) continue;
      const orm = oneRepMaxNumeric(
        effectiveLoad({ weight: s.weight, weight_value: s.weight_value }, we.exercise, bodyweight),
        s.reps,
      );
      if (orm != null && orm > max) max = orm;
    }
    return max;
  }

  async function updateSet(setId: string, patch: { weight?: string; weight_value?: number | null; reps?: number | null; completed?: boolean; note?: string | null }) {
    await supabase.from("sets").update(patch).eq("id", setId);

    if (patch.completed === true) {
      void track(EVENTS.setLogged, { exercise: we.exercise.name });
      haptic();
      setRestKey((k) => k + 1);
      const s = we.sets.find((x) => x.id === setId);
      if (s) {
        const orm = oneRepMaxNumeric(
          effectiveLoad({ weight: s.weight, weight_value: s.weight_value }, we.exercise, bodyweight),
          s.reps,
        );
        if (orm != null && orm > bestPriorOrm(setId)) {
          haptic([20, 50, 20]);
          toast.success(`New PR — ${we.exercise.name}`, {
            description: `Est. 1RM ${Math.round(orm * 10) / 10} ${unit}`,
          });
        }
      }
    }

    qc2.invalidateQueries({ queryKey: ["exercise-sets", user?.id, we.exercise_id] });
    onChanged();
  }

  async function addSet() {
    if (!user) return;
    const last = we.sets[we.sets.length - 1];
    const nextPos = (last?.position ?? -1) + 1;
    await supabase.from("sets").insert({
      workout_exercise_id: we.id,
      user_id: user.id,
      position: nextPos,
      weight: last?.weight ?? "",
      weight_value: last?.weight_value ?? null,
      reps: last?.reps ?? null,
    });
    onChanged();
  }

  async function deleteSet(setId: string) {
    await supabase.from("sets").delete().eq("id", setId);
    onChanged();
  }

  async function removeExercise() {
    await supabase.from("workout_exercises").delete().eq("id", we.id);
    toast(`${we.exercise.name} removed.`);
    onChanged();
  }

  // Ghosted "last session" values the user can tap to copy into the set.
  const priorLabel =
    hasHistory && (priorWeightValue != null || priorReps != null)
      ? `${priorWeightValue != null ? `${Math.abs(priorWeightValue)} ${unit}` : "—"} × ${priorReps ?? "—"}`
      : null;

  const mc = muscleColors(we.exercise.primary_muscle);
  const EqIcon = equipmentIcon(we.exercise.equipment);
  const [showInfo, setShowInfo] = useState(false);


  return (
    <section className="rounded-md border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-accent">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowInfo(true)}
            className="min-w-0 flex-1 text-left text-base font-semibold leading-snug tracking-tight underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {we.exercise.name}
          </button>
          <div className="flex items-center shrink-0 -mr-2 -mt-2">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={!canMoveUp}
              aria-label={`Move ${we.exercise.name} up`}
              className="inline-flex h-11 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground disabled:opacity-25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronUp size={18} />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={!canMoveDown}
              aria-label={`Move ${we.exercise.name} down`}
              className="inline-flex h-11 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground disabled:opacity-25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronDown size={18} />
            </button>
            <button
              type="button"
              onClick={() => setShowInfo(true)}
              aria-label={`How to do ${we.exercise.name}`}
              className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Info size={18} />
            </button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  aria-label={`Remove ${we.exercise.name}`}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Trash2 size={16} />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove {we.exercise.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Its sets in this workout will be deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={removeExercise}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
          <div className="flex min-w-0 items-center gap-2">
            {we.exercise.primary_muscle && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide"
                style={{ backgroundColor: mc.bg, color: mc.fg }}
              >
                {muscleLabel(we.exercise.primary_muscle)}
              </span>
            )}
            {we.exercise.equipment && (
              <span className="inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                <EqIcon size={12} className="shrink-0" aria-hidden />
                <span className="truncate">{formatEquipmentLabel(we.exercise.equipment)}</span>
              </span>
            )}
          </div>
          <RestTimer autoKey={restKey} exerciseId={we.exercise_id} defaultSeconds={defaultRestSeconds(we.exercise)} />
        </div>
      </div>

      <Drawer open={showInfo} onOpenChange={setShowInfo}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{we.exercise.name}</DrawerTitle>
          </DrawerHeader>
          <div className="mx-auto w-full max-w-md px-4 pb-6">
            <Tabs defaultValue="how">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="how">How to</TabsTrigger>
                <TabsTrigger value="history">Your history</TabsTrigger>
              </TabsList>
              <TabsContent value="how" className="mt-3">
                <ExerciseInfo ex={we.exercise} />
              </TabsContent>
              <TabsContent value="history" className="mt-3">
                <ExerciseHistory
                  exerciseId={we.exercise_id}
                  weightType={we.exercise.weight_type}
                />
              </TabsContent>
            </Tabs>
          </div>
        </DrawerContent>
      </Drawer>
      <ul className="divide-y divide-border">
        {we.sets.map((s, i) => {
          const matchesPrior =
            hasHistory &&
            !s.completed &&
            (s.weight_value ?? null) === priorWeightValue &&
            s.reps === priorReps;
          const empty = s.weight_value == null && s.reps == null;
          return (
            <SetRowEditor
              key={s.id}
              index={i}
              set={s}
              weightType={we.exercise.weight_type ?? "standard"}
              equipment={we.exercise.equipment ?? null}
              isLast={i === we.sets.length - 1}
              weightPlaceholder={weightPlaceholder}
              lastSession={matchesPrior}
              isPr={s.completed && prIds.has(s.id)}
              priorLabel={!s.completed && empty && priorLabel ? priorLabel : null}
              onApplyPrior={() =>
                updateSet(s.id, { weight_value: priorWeightValue, reps: priorReps })
              }
              onUpdate={(patch) => updateSet(s.id, patch)}
              onAddNext={addSet}
              onDelete={() => deleteSet(s.id)}
            />
          );
        })}
      </ul>

      <div className="px-4 py-3">
        {/* Pill, not a text link: this is the most-tapped control in a workout
            and a bare label is a small target with sweaty hands. */}
        <button
          onClick={addSet}
          className="inline-flex h-11 w-full items-center justify-center rounded-full bg-secondary px-4 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          + Add set
        </button>
      </div>
    </section>
  );
}

function SetRowEditor({
  index,
  set,
  weightType,
  equipment = null,
  isLast,
  weightPlaceholder = "weight",
  lastSession = false,
  isPr = false,
  priorLabel = null,
  onApplyPrior,
  onUpdate,
  onAddNext,
  onDelete,
}: {
  index: number;
  set: SetRow;
  weightType: string;
  equipment?: string | null;
  isLast: boolean;
  weightPlaceholder?: string;
  lastSession?: boolean;
  isPr?: boolean;
  priorLabel?: string | null;
  onApplyPrior?: () => void | Promise<void>;
  onUpdate: (patch: { weight?: string; weight_value?: number | null; reps?: number | null; completed?: boolean; note?: string | null }) => void | Promise<void>;
  onAddNext: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;

}) {
  const { unit } = useWeightUnit();
  const isBw = weightType === "bodyweight";

  const initialMode: BwMode = isBw ? bwModeFromValue(set.weight_value) : "added";
  const [bwMode, setBwMode] = useState<BwMode>(initialMode);
  const initialMag =
    set.weight_value != null ? String(Math.abs(set.weight_value)) : "";
  const [magnitude, setMagnitude] = useState<string>(initialMag);
  const [reps, setReps] = useState<string>(set.reps == null ? "" : String(set.reps));
  const repsRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setBwMode(isBw ? bwModeFromValue(set.weight_value) : "added");
  }, [isBw, set.weight_value]);
  useEffect(() => {
    setMagnitude(set.weight_value != null ? String(Math.abs(set.weight_value)) : "");
  }, [set.weight_value]);
  useEffect(() => {
    setReps(set.reps == null ? "" : String(set.reps));
  }, [set.reps]);

  function parseMag(): number {
    const n = Number.parseFloat(magnitude);
    return Number.isFinite(n) ? n : 0;
  }

  function commitWeightValue(nextValue: number | null) {
    if (nextValue === (set.weight_value ?? null)) return;
    onUpdate({ weight_value: nextValue });
  }

  function commitStandard() {
    const trimmed = magnitude.trim();
    if (trimmed === "") {
      commitWeightValue(null);
    } else {
      const n = Number.parseFloat(trimmed);
      commitWeightValue(Number.isFinite(n) ? n : null);
    }
  }

  function commitBw(nextMode: BwMode, nextMag: number) {
    commitWeightValue(signedFromBw(nextMode, nextMag));
  }

  function selectMode(next: BwMode) {
    setBwMode(next);
    if (next === "body") {
      setMagnitude("");
      commitBw("body", 0);
    } else {
      commitBw(next, parseMag());
    }
  }

  function commitReps() {
    const parsed = reps.trim() === "" ? null : Number.parseInt(reps, 10);
    const normalized = Number.isFinite(parsed as number) ? (parsed as number) : null;
    if (normalized !== set.reps) onUpdate({ reps: normalized });
  }

  const completed = set.completed;
  const showMag = !isBw || bwMode !== "body";
  const magLabel = isBw ? (bwMode === "assist" ? "assist" : "added") : unit;

  return (
    <li className={`px-4 py-2 ${completed ? "bg-accent/40" : ""}`}>
      {isBw && (
        <div className="mb-2 ml-6 inline-flex rounded-md border border-input overflow-hidden text-[11px] uppercase tracking-wide">
          {(["assist", "body", "added"] as BwMode[]).map((m) => {
            const label = m === "assist" ? "Assisted" : m === "body" ? "Bodyweight" : "Weighted";
            const active = bwMode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => selectMode(m)}
                className={`px-2 h-7 font-semibold transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-1.5">
      <span className="num text-sm text-muted-foreground w-4 shrink-0">{index + 1}</span>
      <div className="relative flex-1 min-w-0">
      {showMag ? (
        <>
          <input
            type="number"
            inputMode="decimal"
            value={magnitude}
            onChange={(e) => setMagnitude(e.target.value)}
            onBlur={() => (isBw ? commitBw(bwMode, parseMag()) : commitStandard())}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (isBw) commitBw(bwMode, parseMag());
                else commitStandard();
                repsRef.current?.focus();
                repsRef.current?.select();
              }
            }}
            placeholder={weightPlaceholder}
            className={`num w-full h-11 pl-2 pr-7 rounded-md border border-input bg-background text-lg font-semibold tracking-tight !text-left focus:outline-none focus:ring-2 focus:ring-ring ${completed ? "opacity-60" : ""}`}
          />
          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
            {magLabel}
          </span>

        </>
      ) : (
        <div className="h-11 px-2 flex items-center text-sm text-muted-foreground italic">
          bodyweight
        </div>
      )}
      </div>
      <span className="text-muted-foreground text-sm">×</span>
      <input
        ref={repsRef}
        type="number"
        inputMode="numeric"
        min={0}
        value={reps}
        onChange={(e) => setReps(e.target.value)}
        onBlur={commitReps}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitReps();
            if (isLast) onAddNext();
          }
        }}
        placeholder="reps"
        className={`num w-14 shrink-0 h-11 px-1 rounded-md border border-input bg-background text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-ring ${completed ? "opacity-60" : ""}`}

      />
      <button
        onClick={onDelete}
        className="inline-flex h-11 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Delete set"
      >
        ✕
      </button>
      <button
        type="button"
        onClick={() => onUpdate({ completed: !completed })}
        aria-label={completed ? "Mark set incomplete" : "Mark set complete"}
        aria-pressed={completed}
        className={`h-11 w-9 shrink-0 rounded-md flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          completed ? "text-primary-foreground" : "text-transparent"
        }`}
      >
        <span
          className={`flex h-7 w-7 items-center justify-center rounded border transition-colors ${
            completed ? "bg-primary border-primary" : "bg-background border-input"
          }`}
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="3 8.5 6.5 12 13 4.5" />
          </svg>
        </span>
      </button>
      </div>
      <div className="ml-6 flex flex-wrap items-center gap-2">
        {isPr && (
          <span className="mt-1 inline-block rounded-full bg-pr px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-pr-foreground">
            PR
          </span>
        )}
        {lastSession && !completed && (
          <span className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">last session</span>
        )}
        {priorLabel && onApplyPrior && (
          <button
            type="button"
            onClick={() => onApplyPrior()}
            className="mt-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Last: <span className="num">{priorLabel}</span> · tap to use
          </button>
        )}
        {usesPlates(equipment) && set.weight_value != null && set.weight_value > 0 && (
          <PlateBreakdown target={set.weight_value} />
        )}
        <SetNote value={set.note} onSave={(v) => onUpdate({ note: v })} />
      </div>

    </li>
  );
}


// Optional short note attached to a single set ("felt heavy", "paused", ...).
function SetNote({ value, onSave }: { value: string | null; onSave: (v: string | null) => void | Promise<void> }) {
  const [open, setOpen] = useState(!!value);
  const [text, setText] = useState(value ?? "");

  useEffect(() => {
    setText(value ?? "");
    if (value) setOpen(true);
  }, [value]);

  function commit() {
    const next = text.trim() === "" ? null : text.trim();
    if (next !== (value ?? null)) onSave(next);
    if (next === null) setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        + Note
      </button>
    );
  }

  return (
    <input
      type="text"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
      placeholder="Note (e.g. felt heavy)"
      aria-label="Set note"
      className="mt-1 h-8 w-full max-w-[260px] rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
    />
  );
}
