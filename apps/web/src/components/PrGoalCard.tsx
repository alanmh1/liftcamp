import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Target, Pencil, Trophy, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useWeightUnit } from "@/lib/weight-unit";
import { useBodyweight } from "@/lib/use-bodyweight";
import { effectiveLoad, oneRepMaxNumeric } from "@liftcamp/shared";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";

type GoalRow = {
  id: string;
  exercise_id: string;
  target_weight: number;
  achieved_at: string | null;
  exercises: { id: string; name: string; weight_type: string | null } | null;
};

type SetRow = {
  weight: string | null;
  weight_value: number | null;
  reps: number | null;
  completed: boolean;
};

export function PrGoalCard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { unit } = useWeightUnit();
  const bodyweight = useBodyweight();
  const [open, setOpen] = useState(false);

  const goalQuery = useQuery({
    queryKey: ["pr-goal", userId],
    queryFn: async (): Promise<GoalRow | null> => {
      const { data, error } = await supabase
        .from("pr_goals")
        .select("id, exercise_id, target_weight, achieved_at, exercises(id, name, weight_type)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as GoalRow) ?? null;
    },
  });

  const goal = goalQuery.data ?? null;
  const exerciseId = goal?.exercise_id;

  // Progress is measured against the best estimated 1RM (Epley), so a heavy
  // triple counts toward a one-rep-max target instead of being ignored.
  const bestQuery = useQuery({
    enabled: !!exerciseId,
    queryKey: ["pr-goal-best", userId, exerciseId],
    queryFn: async (): Promise<number | null> => {
      const { data, error } = await supabase
        .from("workout_exercises")
        .select("sets(weight, weight_value, reps, completed)")
        .eq("user_id", userId)
        .eq("exercise_id", exerciseId!)
        .limit(500);
      if (error) throw error;
      let best: number | null = null;
      for (const we of (data ?? []) as unknown as { sets: SetRow[] | null }[]) {
        for (const s of we.sets ?? []) {
          if (!s.completed) continue;
          const load = effectiveLoad(
            s,
            { weight_type: goal?.exercises?.weight_type ?? null },
            bodyweight,
          );
          if (load == null) continue;
          const orm = oneRepMaxNumeric(load, s.reps) ?? load;
          if (best == null || orm > best) best = orm;
        }
      }
      return best;
    },
  });

  const best = bestQuery.data ?? null;
  const target = goal?.target_weight ?? null;
  const reached = best != null && target != null && best >= target;

  // Stamp the goal the first time it is hit so the card can celebrate it.
  useEffect(() => {
    if (!goal || !reached || goal.achieved_at) return;
    void supabase
      .from("pr_goals")
      .update({ achieved_at: new Date().toISOString() })
      .eq("id", goal.id)
      .then(() => qc.invalidateQueries({ queryKey: ["pr-goal", userId] }));
  }, [goal, reached, qc, userId]);

  const remove = useMutation({
    mutationFn: async () => {
      if (!goal) return;
      const { error } = await supabase.from("pr_goals").delete().eq("id", goal.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pr-goal", userId] });
      toast.success("Goal cleared");
    },
    onError: () => toast.error("Couldn't clear that goal"),
  });

  if (goalQuery.isLoading) return <Skeleton className="h-24 w-full rounded-lg" />;

  const pct =
    best != null && target ? Math.max(0, Math.min(100, Math.round((best / target) * 100))) : 0;

  return (
    <section className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-start gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          {reached ? (
            <Trophy className="h-4 w-4" aria-hidden />
          ) : (
            <Target className="h-4 w-4" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-tight">1RM goal</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {goal
              ? goal.exercises?.name ?? "Exercise"
              : "Set a target 1RM and watch it get closer."}
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-md bg-secondary px-3 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {goal ? <Pencil className="h-3.5 w-3.5" aria-hidden /> : null}
              {goal ? "Edit" : "Set goal"}
            </button>
          </DialogTrigger>
          <DialogContent className="max-h-[85dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{goal ? "Edit 1RM goal" : "Set a 1RM goal"}</DialogTitle>
              <DialogDescription>
                Pick a lift and the estimated 1RM you're chasing. Progress uses your best
                estimated 1RM from completed sets.
              </DialogDescription>
            </DialogHeader>
            <GoalForm
              userId={userId}
              unit={unit}
              initial={goal}
              onDone={() => {
                setOpen(false);
                qc.invalidateQueries({ queryKey: ["pr-goal", userId] });
                qc.invalidateQueries({ queryKey: ["pr-goal-best", userId] });
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {goal && (
        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold">
              {best != null ? `${round(best)} ${unit} est. 1RM` : "No sets yet"}
              <span className="text-muted-foreground font-normal">
                {" "}
                / {round(goal.target_weight)} {unit}
              </span>
            </p>
            <p className="text-[13px] text-muted-foreground">{pct}%</p>
          </div>
          <Progress value={pct} className="mt-2 h-2" />
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[13px] text-muted-foreground">
              {reached
                ? "Goal reached — time to raise the bar."
                : best != null
                  ? `${round(goal.target_weight - best)} ${unit} to go`
                  : "Log a set on this lift to start tracking."}
            </p>
            <button
              type="button"
              onClick={() => remove.mutate()}
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Clear
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function round(n: number) {
  return Math.round(n * 10) / 10;
}

function GoalForm({
  userId,
  unit,
  initial,
  onDone,
}: {
  userId: string;
  unit: string;
  initial: GoalRow | null;
  onDone: () => void;
}) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(
    initial?.exercises ? { id: initial.exercises.id, name: initial.exercises.name } : null,
  );
  const [weight, setWeight] = useState(initial ? String(initial.target_weight) : "");

  const results = useQuery({
    enabled: q.trim().length >= 2,
    queryKey: ["pr-goal-search", q.trim()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercises")
        .select("id, name")
        .ilike("name", `%${q.trim()}%`)
        .order("name")
        .limit(15);
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const target = Number.parseFloat(weight);
      if (!picked || !Number.isFinite(target) || target <= 0) {
        throw new Error("Pick a lift and enter a target weight.");
      }
      const { error } = await supabase.from("pr_goals").upsert(
        {
          user_id: userId,
          exercise_id: picked.id,
          target_weight: target,
          achieved_at: null,
        },
        { onConflict: "user_id,exercise_id" },
      );
      if (error) throw error;
      if (initial && initial.exercise_id !== picked.id) {
        await supabase.from("pr_goals").delete().eq("id", initial.id);
      }
    },
    onSuccess: () => {
      toast.success("Goal saved");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't save that goal"),
  });

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="micro text-muted-foreground" htmlFor="pr-goal-exercise">
          Exercise
        </label>
        <Input
          id="pr-goal-exercise"
          value={picked ? picked.name : q}
          placeholder="Search exercises…"
          onChange={(e) => {
            setPicked(null);
            setQ(e.target.value);
          }}
          className="mt-1"
        />
        {!picked && (results.data?.length ?? 0) > 0 && (
          <ul className="mt-2 max-h-48 overflow-y-auto rounded-md border border-border">
            {results.data!.map((ex) => (
              <li key={ex.id}>
                <button
                  type="button"
                  onClick={() => {
                    setPicked(ex);
                    setQ("");
                  }}
                  className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-accent/40"
                >
                  {ex.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <label className="micro text-muted-foreground" htmlFor="pr-goal-weight">
          Target est. 1RM ({unit})
        </label>
        <Input
          id="pr-goal-weight"
          inputMode="decimal"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder={`e.g. 225`}
          className="mt-1"
        />
      </div>

      <button
        type="button"
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="h-11 rounded-lg bg-primary text-primary-foreground text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {save.isPending ? "Saving…" : "Save goal"}
      </button>
    </div>
  );
}
