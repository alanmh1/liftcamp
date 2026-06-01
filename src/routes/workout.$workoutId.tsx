import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/workout/$workoutId")({
  head: () => ({ meta: [{ title: "Workout — Lift" }] }),
  component: WorkoutPage,
});

type Exercise = { id: string; name: string; primary_muscle: string | null };
type SetRow = { id: string; position: number; weight: string; reps: number | null };
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

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login", replace: true });
  }, [session, loading, navigate]);

  const workoutQ = useQuery({
    queryKey: ["workout", workoutId],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workouts")
        .select("id, workout_date, finished_at")
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
          "id, position, exercise_id, exercise:exercises(id, name, primary_muscle), sets(id, position, weight, reps)",
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
      .select("id, created_at, sets(position, weight, reps)")
      .eq("user_id", user.id)
      .eq("exercise_id", ex.id)
      .neq("id", weData.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const priorSets = (prior?.sets ?? []) as { position: number; weight: string; reps: number | null }[];
    const seedSets = priorSets.length > 0
      ? [...priorSets].sort((a, b) => a.position - b.position)
      : [{ position: 0, weight: "", reps: null }];

    await supabase.from("sets").insert(
      seedSets.map((s) => ({
        workout_exercise_id: weData.id,
        user_id: user.id,
        position: s.position,
        weight: s.weight ?? "",
        reps: s.reps,
      })),
    );

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
        <div>
          <Link to="/" className="text-xs text-muted-foreground underline">← Home</Link>
          <h1 className="mt-1 text-xl font-bold tracking-tight">
            Workout · <span className="num">{workoutQ.data?.workout_date}</span>
          </h1>
        </div>
        {!finished && (
          <button
            onClick={finishWorkout}
            className="h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold"
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

function ExercisePicker({ onPick }: { onPick: (ex: Exercise) => void | Promise<void> }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: results } = useQuery({
    queryKey: ["exercise-search", q],
    enabled: q.trim().length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercises")
        .select("id, name, primary_muscle")
        .ilike("name", `%${q.trim()}%`)
        .order("name")
        .limit(15);
      if (error) throw error;
      return data as Exercise[];
    },
  });

  async function pick(ex: Exercise) {
    setBusy(true);
    await onPick(ex);
    setBusy(false);
    setQ("");
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Add exercise…"
        disabled={busy}
        className="w-full h-12 px-3 rounded-md border border-input bg-background text-base focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {open && q.trim().length > 0 && (
        <ul className="absolute left-0 right-0 top-full mt-1 z-10 max-h-72 overflow-auto rounded-md border border-border bg-card shadow">
          {(results ?? []).length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">No matches.</li>
          ) : (
            (results ?? []).map((ex) => (
              <li key={ex.id}>
                <button
                  type="button"
                  onClick={() => pick(ex)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between"
                >
                  <span>{ex.name}</span>
                  {ex.primary_muscle && (
                    <span className="text-xs text-muted-foreground">{ex.primary_muscle}</span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function ExerciseBlock({ we, onChanged }: { we: WeRow; onChanged: () => void }) {
  const { user } = useAuth();

  async function updateSet(setId: string, patch: { weight?: string; reps?: number | null }) {
    await supabase.from("sets").update(patch).eq("id", setId);
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

  return (
    <section className="rounded-md border border-border">
      <div className="px-4 py-3 flex items-center justify-between border-b border-border">
        <div>
          <h2 className="text-base font-semibold tracking-tight">{we.exercise.name}</h2>
          {we.exercise.primary_muscle && (
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{we.exercise.primary_muscle}</p>
          )}
        </div>
        <button onClick={removeExercise} className="text-xs text-muted-foreground underline">
          Remove
        </button>
      </div>
      <ul className="divide-y divide-border">
        {we.sets.map((s, i) => (
          <SetRowEditor
            key={s.id}
            index={i}
            set={s}
            isLast={i === we.sets.length - 1}
            onUpdate={(patch) => updateSet(s.id, patch)}
            onAddNext={addSet}
            onDelete={() => deleteSet(s.id)}
          />
        ))}
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
  onUpdate,
  onAddNext,
  onDelete,
}: {
  index: number;
  set: SetRow;
  isLast: boolean;
  onUpdate: (patch: { weight?: string; reps?: number | null }) => void | Promise<void>;
  onAddNext: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}) {
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

  return (
    <li className="px-4 py-2 flex items-center gap-3">
      <span className="num text-sm text-muted-foreground w-6">{index + 1}</span>
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
        placeholder="weight"
        className="num flex-1 min-w-0 h-11 px-2 rounded-md border border-input bg-background text-base focus:outline-none focus:ring-2 focus:ring-ring"
      />
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
        className="num w-20 h-11 px-2 rounded-md border border-input bg-background text-base focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <button
        onClick={onDelete}
        className="text-xs text-muted-foreground underline"
        aria-label="Delete set"
      >
        ✕
      </button>
    </li>
  );
}
