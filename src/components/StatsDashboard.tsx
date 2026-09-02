import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Dumbbell, Flame, CalendarCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useWeightUnit } from "@/lib/weight-unit";
import { useBodyweight } from "@/lib/use-bodyweight";
import { effectiveLoad, setVolume } from "@/lib/set-weight";
import { oneRepMaxNumeric } from "@/lib/one-rep-max";
import { VOLUME_MILESTONES, WORKOUT_MILESTONES } from "@/lib/milestones";
import { Skeleton } from "@/components/ui/skeleton";

type Row = {
  weight: string;
  weight_value: number | null;
  reps: number | null;
  workout_exercises: {
    exercise_id: string;
    exercises: { name: string; weight_type: string | null; is_unilateral: boolean | null } | null;
    workouts: { id: string; workout_date: string; created_at: string; finished_at: string | null } | null;
  } | null;
};

type PrRow = {
  exerciseId: string;
  name: string;
  orm: number;
  load: number;
  reps: number | null;
  date: string;
  volume: number;
  sets: number;
};

const PR_PAGE = 8;

/**
 * Lifetime dashboard: totals, all-time PR per lift, and the volume milestone
 * ladder. Complements the home-screen PR goal, which only tracks one target.
 */
export function StatsDashboard() {
  const { user } = useAuth();
  const { unit } = useWeightUnit();
  const bodyweight = useBodyweight();
  const [showAllPrs, setShowAllPrs] = useState(false);

  const q = useQuery({
    enabled: !!user,
    queryKey: ["stats-dashboard", user?.id],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("sets")
        .select(
          "weight, weight_value, reps, workout_exercises!inner(exercise_id, exercises(name, weight_type, is_unilateral), workouts!inner(id, workout_date, created_at, finished_at))",
        )
        .eq("user_id", user!.id)
        .eq("completed", true)
        .not("workout_exercises.workouts.finished_at", "is", null);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const stats = useMemo(() => {
    const rows = q.data ?? [];
    const workouts = new Set<string>();
    const byExercise = new Map<string, PrRow>();
    let totalVolume = 0;
    let totalSets = 0;

    for (const r of rows) {
      const we = r.workout_exercises;
      const w = we?.workouts;
      const ex = we?.exercises;
      if (!we || !w || !ex) continue;
      workouts.add(w.id);
      totalSets += 1;
      const vol = setVolume(r, ex, bodyweight);
      totalVolume += vol;

      const load = effectiveLoad(r, ex, bodyweight);
      const orm = oneRepMaxNumeric(load, r.reps);
      const cur = byExercise.get(we.exercise_id);
      const next: PrRow = cur ?? {
        exerciseId: we.exercise_id,
        name: ex.name,
        orm: 0,
        load: 0,
        reps: null,
        date: w.workout_date,
        volume: 0,
        sets: 0,
      };
      next.volume += vol;
      next.sets += 1;
      if (orm != null && load != null && orm > next.orm) {
        next.orm = orm;
        next.load = load;
        next.reps = r.reps;
        next.date = w.workout_date;
      }
      byExercise.set(we.exercise_id, next);
    }

    const prs = [...byExercise.values()].sort((a, b) => b.orm - a.orm || b.volume - a.volume);
    return {
      workouts: workouts.size,
      totalSets,
      totalVolume,
      prs,
      lifts: byExercise.size,
    };
  }, [q.data, bodyweight]);

  if (q.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  if (!q.data || stats.workouts === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
        <p className="text-sm font-medium">No finished workouts yet.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Your totals, PRs and volume milestones show up here after your first session.
        </p>
      </div>
    );
  }

  const nextWorkoutTarget = WORKOUT_MILESTONES.find((m) => m > stats.workouts) ?? null;
  const visiblePrs = showAllPrs ? stats.prs : stats.prs.slice(0, PR_PAGE);

  return (
    <div className="flex flex-col gap-4">
      <section className="grid grid-cols-2 gap-3">
        <Stat
          icon={<CalendarCheck className="h-4 w-4" aria-hidden />}
          label="Workouts"
          value={stats.workouts.toLocaleString()}
          hint={nextWorkoutTarget ? `${nextWorkoutTarget - stats.workouts} to ${nextWorkoutTarget}` : "Milestone maxed"}
        />
        <Stat
          icon={<Flame className="h-4 w-4" aria-hidden />}
          label={`Volume (${unit})`}
          value={Math.round(stats.totalVolume).toLocaleString()}
          hint={`${stats.totalSets.toLocaleString()} sets logged`}
        />
        <Stat
          icon={<Dumbbell className="h-4 w-4" aria-hidden />}
          label="Lifts trained"
          value={stats.lifts.toLocaleString()}
          hint="Distinct exercises"
        />
        <Stat
          icon={<Trophy className="h-4 w-4" aria-hidden />}
          label="Top est. 1RM"
          value={stats.prs[0] ? `${Math.round(stats.prs[0].orm)}` : "—"}
          hint={stats.prs[0]?.name ?? "No PRs yet"}
        />
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">PRs by lift</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          All-time best set per exercise, ranked by estimated one-rep max.
        </p>
        {stats.prs.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">Log a weighted set to see PRs here.</p>
        ) : (
          <>
            <ul className="mt-3 flex flex-col divide-y divide-border">
              {visiblePrs.map((p) => (
                <li key={p.exerciseId} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      <span className="num">{Math.round(p.load * 10) / 10}</span> {unit}
                      {p.reps ? ` × ${p.reps}` : ""} · {new Date(p.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold">
                      <span className="num">{Math.round(p.orm)}</span> {unit}
                    </p>
                    <p className="text-[11px] text-muted-foreground">est. 1RM</p>
                  </div>
                </li>
              ))}
            </ul>
            {stats.prs.length > PR_PAGE && (
              <button
                type="button"
                onClick={() => setShowAllPrs((v) => !v)}
                className="mt-3 h-9 w-full rounded-md bg-secondary text-xs font-semibold text-secondary-foreground transition-colors hover:bg-muted"
              >
                {showAllPrs ? "Show top 8" : `Show all ${stats.prs.length} lifts`}
              </button>
            )}
          </>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Volume milestones</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Total weight moved across every completed set.
        </p>
        <ul className="mt-3 flex flex-col gap-3">
          {VOLUME_MILESTONES.map((m) => {
            const pct = Math.max(0, Math.min(100, (stats.totalVolume / m) * 100));
            const done = stats.totalVolume >= m;
            return (
              <li key={m}>
                <div className="flex items-center justify-between text-xs">
                  <span className={done ? "font-semibold text-foreground" : "text-muted-foreground"}>
                    <span className="num">{m.toLocaleString()}</span> {unit}
                  </span>
                  <span className={done ? "font-semibold text-primary" : "text-muted-foreground"}>
                    {done ? "Reached" : `${Math.floor(pct)}%`}
                  </span>
                </div>
                <div
                  className="mt-1 h-2 w-full overflow-hidden rounded-full bg-secondary"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.floor(pct)}
                  aria-label={`Progress toward ${m.toLocaleString()} ${unit} lifted`}
                >
                  <div
                    className={"h-full rounded-full " + (done ? "bg-primary" : "bg-primary/50")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1 text-xl font-bold tracking-tight">
        <span className="num">{value}</span>
      </p>
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
