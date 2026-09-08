import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { effectiveLoad } from "@liftcamp/shared";
import { useBodyweight } from "@/lib/use-bodyweight";
import {
  DEFAULT_TRAINING_AGE,
  estimateOneRepMax,
  type TrainedSet,
} from "@liftcamp/shared";

const TRAINING_AGE_KEY = "liftcamp:training-age";
const REMINDER_KEY = "liftcamp:strength-goal-reminder";
const DISMISS_KEY = "liftcamp:strength-goal-dismissed";

function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Years of consistent training, stored locally — it only tunes the estimate. */
export function useTrainingAge() {
  const [years, setYears] = useState(DEFAULT_TRAINING_AGE);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(TRAINING_AGE_KEY);
    const n = raw == null ? NaN : Number.parseFloat(raw);
    if (Number.isFinite(n)) setYears(n);
  }, []);

  const set = useCallback((n: number) => {
    setYears(n);
    if (typeof window !== "undefined") window.localStorage.setItem(TRAINING_AGE_KEY, String(n));
  }, []);

  return { trainingAge: years, setTrainingAge: set };
}

export type StrengthGoal = {
  id: string;
  exerciseId: string;
  name: string;
  weightType: string | null;
  target: number;
  achievedAt: string | null;
  /** Best training-age adjusted 1RM estimate for this lift. */
  best: number | null;
  bestReps: number | null;
  lastTrained: string | null;
  pct: number;
  reached: boolean;
};

type GoalRow = {
  id: string;
  exercise_id: string;
  target_weight: number;
  achieved_at: string | null;
  exercises: { id: string; name: string; weight_type: string | null } | null;
};

type WeRow = {
  exercise_id: string;
  workouts: { workout_date: string } | null;
  sets: { weight: string | null; weight_value: number | null; reps: number | null; completed: boolean }[] | null;
};

/**
 * Every strength goal the user has set, each measured against the multi-formula
 * 1RM estimate for that lift.
 */
export function useStrengthGoals(userId: string | undefined, trainingAge: number) {
  const qc = useQueryClient();
  const bodyweight = useBodyweight();

  const goalsQuery = useQuery({
    enabled: !!userId,
    queryKey: ["strength-goals", userId],
    queryFn: async (): Promise<GoalRow[]> => {
      const { data, error } = await supabase
        .from("pr_goals")
        .select("id, exercise_id, target_weight, achieved_at, exercises(id, name, weight_type)")
        .eq("user_id", userId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as GoalRow[];
    },
  });

  const exerciseIds = (goalsQuery.data ?? []).map((g) => g.exercise_id);

  const setsQuery = useQuery({
    enabled: !!userId && exerciseIds.length > 0,
    queryKey: ["strength-goal-sets", userId, [...exerciseIds].sort().join(",")],
    queryFn: async (): Promise<WeRow[]> => {
      const { data, error } = await supabase
        .from("workout_exercises")
        .select("exercise_id, workouts(workout_date), sets(weight, weight_value, reps, completed)")
        .eq("user_id", userId!)
        .in("exercise_id", exerciseIds)
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as WeRow[];
    },
  });

  const weightTypes = new Map<string, string | null>(
    (goalsQuery.data ?? []).map((g) => [g.exercise_id, g.exercises?.weight_type ?? null]),
  );
  const byExercise = new Map<string, { sets: TrainedSet[]; last: string | null }>();
  for (const we of setsQuery.data ?? []) {
    const entry = byExercise.get(we.exercise_id) ?? { sets: [], last: null };
    const date = we.workouts?.workout_date ?? null;
    for (const s of we.sets ?? []) {
      if (!s.completed) continue;
      const load = effectiveLoad(s, { weight_type: weightTypes.get(we.exercise_id) ?? null }, bodyweight);
      if (load == null || s.reps == null) continue;
      entry.sets.push({ load, reps: s.reps, date });
      if (date && (!entry.last || date > entry.last)) entry.last = date;
    }
    byExercise.set(we.exercise_id, entry);
  }

  const goals: StrengthGoal[] = (goalsQuery.data ?? []).map((g) => {
    const entry = byExercise.get(g.exercise_id);
    const est = entry ? estimateOneRepMax(entry.sets, trainingAge) : null;
    const best = est?.value ?? null;
    const pct = best != null && g.target_weight > 0
      ? Math.max(0, Math.min(100, Math.round((best / g.target_weight) * 100)))
      : 0;
    return {
      id: g.id,
      exerciseId: g.exercise_id,
      name: g.exercises?.name ?? "Exercise",
      weightType: g.exercises?.weight_type ?? null,
      target: g.target_weight,
      achievedAt: g.achieved_at,
      best,
      bestReps: est?.from.reps ?? null,
      lastTrained: entry?.last ?? null,
      pct,
      reached: best != null && best >= g.target_weight,
    };
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["strength-goals", userId] });
    qc.invalidateQueries({ queryKey: ["strength-goal-sets", userId] });
    qc.invalidateQueries({ queryKey: ["pr-goal", userId] });
  };

  const save = useMutation({
    mutationFn: async (input: { exerciseId: string; target: number; id?: string }) => {
      if (!userId) throw new Error("Not signed in");
      if (!Number.isFinite(input.target) || input.target <= 0) {
        throw new Error("Enter a target weight.");
      }
      if (input.id) {
        const { error } = await supabase
          .from("pr_goals")
          .update({ target_weight: input.target, achieved_at: null })
          .eq("id", input.id);
        if (error) throw error;
        return;
      }
      const existing = (goalsQuery.data ?? []).find((g) => g.exercise_id === input.exerciseId);
      if (existing) {
        const { error } = await supabase
          .from("pr_goals")
          .update({ target_weight: input.target, achieved_at: null })
          .eq("id", existing.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("pr_goals").insert({
        user_id: userId,
        exercise_id: input.exerciseId,
        target_weight: input.target,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pr_goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    goals,
    isLoading: goalsQuery.isLoading || (exerciseIds.length > 0 && setsQuery.isLoading),
    save,
    remove,
  };
}

function daysSince(date: string | null): number | null {
  if (!date) return null;
  const then = new Date(`${date}T00:00:00`);
  if (Number.isNaN(then.getTime())) return null;
  return Math.floor((Date.now() - then.getTime()) / 86_400_000);
}

export function strengthReminderMessage(goal: StrengthGoal, stale: number | null): string {
  const remaining = Math.max(0, goal.target - (goal.best ?? 0));
  if (goal.best == null) return `Log a set of ${goal.name} to start tracking your goal.`;
  if (stale == null || stale >= 999) return `${goal.name} is waiting — ${Math.round(remaining)} to go.`;
  return `${goal.name}: ${Math.round(remaining)} off your target, and it's been ${stale} day${stale === 1 ? "" : "s"} since you trained it.`;
}

const STALE_DAYS = 7;

/**
 * Nudge toward a strength goal that hasn't been trained lately. Opt-out and
 * snoozed for the day, matching the frequency reminder.
 */
export function useStrengthGoalReminder(userId: string | undefined) {
  const { trainingAge } = useTrainingAge();
  const { goals, isLoading } = useStrengthGoals(userId, trainingAge);
  const [enabled, setEnabledState] = useState(true);
  const [dismissedOn, setDismissedOn] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setEnabledState(window.localStorage.getItem(REMINDER_KEY) !== "off");
    setDismissedOn(window.localStorage.getItem(DISMISS_KEY));
  }, []);

  const setEnabled = useCallback((on: boolean) => {
    setEnabledState(on);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(REMINDER_KEY, on ? "on" : "off");
    }
  }, []);

  const dismiss = useCallback(() => {
    const key = dayKey();
    setDismissedOn(key);
    if (typeof window !== "undefined") window.localStorage.setItem(DISMISS_KEY, key);
  }, []);

  const open = goals.filter((g) => !g.reached);
  const candidate =
    open
      .map((g) => ({ goal: g, stale: daysSince(g.lastTrained) }))
      .filter((x) => x.stale == null || x.stale >= STALE_DAYS)
      .sort((a, b) => (b.stale ?? 999) - (a.stale ?? 999))[0] ?? null;

  return {
    enabled,
    setEnabled,
    dismiss,
    dismissedToday: dismissedOn === dayKey(),
    goal: candidate?.goal ?? null,
    stale: candidate?.stale ?? null,
    openCount: open.length,
    show:
      enabled &&
      dismissedOn !== dayKey() &&
      !isLoading &&
      !!candidate,
    message: candidate ? strengthReminderMessage(candidate.goal, candidate.stale) : "",
  };
}
