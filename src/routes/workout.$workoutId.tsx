import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Clock, Info } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { muscleColors, equipmentIcon } from "@/lib/exercise-visuals";
import { ExercisePicker } from "@/components/ExercisePicker";
import { ExerciseInfo } from "@/components/ExerciseInfo";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { coldStartSuggestion } from "@/lib/suggestions";
import { useWeightUnit } from "@/lib/weight-unit";
import { computePrSetIds } from "@/lib/pr";
import { bwModeFromValue, signedFromBw, type BwMode } from "@/lib/set-weight";

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
  head: () => ({ meta: [{ title: "Workout — RepLog" }] }),
  component: WorkoutPage,
});

type Exercise = {
  id: string;
  name: string;
  primary_muscle: string | null;
  all_primary_muscles?: string | null;
  secondary_muscles?: string | null;
  equipment?: string | null;
  ppl_day?: string | null;
  description?: string | null;
  mechanic?: string | null;
  level?: string | null;
  weight_type?: string | null;
};
type SetRow = { id: string; position: number; weight: string; weight_value: number | null; reps: number | null; completed: boolean };
type WeRow = {
  id: string;
  position: number;
  exercise_id: string;
  exercise: Exercise;
  sets: SetRow[];
};

function WorkoutName({ workoutId, name, date }: { workoutId: string; name: string; date: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setValue(name); }, [name]);
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  async function save() {
    const trimmed = value.trim();
    if (!trimmed) {
      setValue(name);
      setEditing(false);
      return;
    }
    if (trimmed !== name) {
      await supabase.from("workouts").update({ name: trimmed }).eq("id", workoutId);
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }}
        className="mt-1 w-full text-xl font-bold tracking-tight bg-transparent border-b border-primary outline-none"
      />
    );
  }

  const formattedDate = date ? new Date(date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "";
  return (
    <button
      onClick={() => setEditing(true)}
      className="mt-1 block text-left text-xl font-bold tracking-tight hover:text-primary transition-colors"
      title="Tap to edit"
    >
      {name || "Workout"} {formattedDate ? `· ${formattedDate}` : ""}
    </button>
  );
}

function WorkoutPage() {
  const { workoutId } = Route.useParams();
  const { session, loading, user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login", replace: true });
  }, [session, loading, navigate]);

  const workoutQ = useQuery({
    queryKey: ["workout", workoutId],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workouts")
        .select("id, name, workout_date, finished_at, created_at")
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
          "id, position, exercise_id, exercise:exercises(id, name, primary_muscle, equipment, mechanic, level, description, all_primary_muscles, secondary_muscles, weight_type), sets(id, position, weight, weight_value, reps, completed)",
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
    await supabase
      .from("workouts")
      .update({ finished_at: new Date().toISOString() })
      .eq("id", workoutId);
    navigate({ to: "/", replace: true });
  }

  if (loading || !session || workoutQ.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">…</p>
      </div>
    );
  }

  const finished = !!workoutQ.data?.finished_at;

  return (
    <div className="min-h-screen bg-background flex flex-col pb-32">
      <header className="px-5 pt-6 pb-4 flex items-center justify-between border-b border-border">
        <div className="min-w-0 flex-1 mr-3">
          <Link to="/" className="text-xs text-muted-foreground underline">← Home</Link>
          <WorkoutName workoutId={workoutId} name={workoutQ.data?.name ?? ""} date={workoutQ.data?.workout_date ?? ""} />
          {workoutQ.data?.created_at && (
            <ElapsedTimer startIso={workoutQ.data.created_at} endIso={workoutQ.data.finished_at ?? null} />
          )}
        </div>
        {!finished && (
          <button
            onClick={finishWorkout}
            className="h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold shrink-0"
          >
            Finish
          </button>
        )}
      </header>

      <main className="flex-1 px-5 py-5 flex flex-col gap-6">
        {(weQ.data ?? []).map((we) => (
          <ExerciseBlock
            key={we.id}
            we={we}
            onChanged={() => qc.invalidateQueries({ queryKey: ["workout-exercises", workoutId] })}
          />
        ))}

        <ExercisePicker onPick={addExercise} />
      </main>
    </div>
  );
}


function ExerciseBlock({ we, onChanged }: { we: WeRow; onChanged: () => void }) {
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
  const prIds = useMemo(() => computePrSetIds(allSetsQ.data ?? []), [allSetsQ.data]);

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
  async function updateSet(setId: string, patch: { weight?: string; weight_value?: number | null; reps?: number | null; completed?: boolean }) {
    await supabase.from("sets").update(patch).eq("id", setId);
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
    if (!confirm(`Remove ${we.exercise.name} from this workout?`)) return;
    await supabase.from("workout_exercises").delete().eq("id", we.id);
    onChanged();
  }

  const mc = muscleColors(we.exercise.primary_muscle);
  const EqIcon = equipmentIcon(we.exercise.equipment);
  const [showInfo, setShowInfo] = useState(false);

  return (
    <section className="rounded-md border border-border overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between border-b border-border bg-accent">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight truncate">{we.exercise.name}</h2>
          <div className="mt-1 flex items-center gap-2">
            {we.exercise.primary_muscle && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide"
                style={{ backgroundColor: mc.bg, color: mc.fg }}
              >
                {we.exercise.primary_muscle}
              </span>
            )}
            {we.exercise.equipment && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <EqIcon size={12} aria-hidden />
                {we.exercise.equipment}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-3">
          <button
            type="button"
            onClick={() => setShowInfo(true)}
            aria-label={`How to do ${we.exercise.name}`}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Info size={16} />
          </button>
          <button onClick={removeExercise} className="text-xs text-muted-foreground underline">
            Remove
          </button>
        </div>
      </div>
      <Drawer open={showInfo} onOpenChange={setShowInfo}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{we.exercise.name}</DrawerTitle>
          </DrawerHeader>
          <div className="mx-auto w-full max-w-md px-4 pb-6">
            <ExerciseInfo ex={we.exercise} />
          </div>
        </DrawerContent>
      </Drawer>
      <ul className="divide-y divide-border">
        {we.sets.map((s, i) => {
          const matchesPrior =
            hasHistory &&
            !s.completed &&
            s.weight === (priorWeight ?? "") &&
            s.reps === priorReps;
          return (
            <SetRowEditor
              key={s.id}
              index={i}
              set={s}
              isLast={i === we.sets.length - 1}
              weightPlaceholder={weightPlaceholder}
              lastSession={matchesPrior}
              isPr={s.completed && prIds.has(s.id)}
              onUpdate={(patch) => updateSet(s.id, patch)}
              onAddNext={addSet}
              onDelete={() => deleteSet(s.id)}
            />
          );
        })}
      </ul>
      <div className="px-4 py-3">
        <button
          onClick={addSet}
          className="text-sm font-medium underline"
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
  isLast,
  weightPlaceholder = "weight",
  lastSession = false,
  isPr = false,
  onUpdate,
  onAddNext,
  onDelete,
}: {
  index: number;
  set: SetRow;
  isLast: boolean;
  weightPlaceholder?: string;
  lastSession?: boolean;
  isPr?: boolean;
  onUpdate: (patch: { weight?: string; reps?: number | null; completed?: boolean }) => void | Promise<void>;
  onAddNext: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}) {
  const { unit } = useWeightUnit();
  const [weight, setWeight] = useState(set.weight);
  const [reps, setReps] = useState<string>(set.reps == null ? "" : String(set.reps));
  const repsRef = useRef<HTMLInputElement>(null);

  const initialWeight = useMemo(() => set.weight, [set.weight]);
  const initialReps = useMemo(() => (set.reps == null ? "" : String(set.reps)), [set.reps]);
  useEffect(() => { setWeight(initialWeight); }, [initialWeight]);
  useEffect(() => { setReps(initialReps); }, [initialReps]);

  function commitWeight() {
    if (weight !== set.weight) onUpdate({ weight });
  }
  function commitReps() {
    const parsed = reps.trim() === "" ? null : Number.parseInt(reps, 10);
    const normalized = Number.isFinite(parsed as number) ? (parsed as number) : null;
    if (normalized !== set.reps) onUpdate({ reps: normalized });
  }

  const completed = set.completed;

  return (
    <li className={`px-4 py-2 ${completed ? "bg-accent/40" : ""}`}>
      <div className="flex items-center gap-3">
      <span className="num text-sm text-muted-foreground w-6">{index + 1}</span>
      <div className="relative flex-1 min-w-0">
      <input
        type="text"
        inputMode="text"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        onBlur={commitWeight}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitWeight();
            repsRef.current?.focus();
            repsRef.current?.select();
          }
        }}
        placeholder={weightPlaceholder}
        className={`num w-full h-11 px-2 ${isBodyweight(weight) ? "" : "pr-8"} rounded-md border border-input bg-background text-base focus:outline-none focus:ring-2 focus:ring-ring ${completed ? "opacity-60" : ""}`}
      />
      {!isBodyweight(weight) && (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {unit}
        </span>
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
        className={`num w-20 h-11 px-2 rounded-md border border-input bg-background text-base focus:outline-none focus:ring-2 focus:ring-ring ${completed ? "opacity-60" : ""}`}
      />
      <button
        onClick={onDelete}
        className="text-xs text-muted-foreground underline"
        aria-label="Delete set"
      >
        ✕
      </button>
      <button
        type="button"
        onClick={() => onUpdate({ completed: !completed })}
        aria-label={completed ? "Mark set incomplete" : "Mark set complete"}
        aria-pressed={completed}
        className={`h-6 w-6 rounded border flex items-center justify-center shrink-0 transition-colors ${
          completed
            ? "bg-primary border-primary text-primary-foreground"
            : "bg-background border-input text-transparent"
        }`}
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="3 8.5 6.5 12 13 4.5" />
        </svg>
      </button>
      </div>
      {isPr && (
        <p className="mt-1 ml-9 inline-block text-[10px] font-bold uppercase tracking-wide text-pr">PR</p>
      )}
      {lastSession && !completed && (
        <p className="mt-1 ml-9 text-[10px] uppercase tracking-wide text-muted-foreground">last session</p>
      )}
    </li>
  );
}
