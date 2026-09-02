import { cloneElement, isValidElement, useMemo, useState } from "react";
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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

type TrendMetric = "workouts" | "prs" | "volume";

const TREND_META: Record<TrendMetric, { label: string; hint: string }> = {
  workouts: { label: "Workouts", hint: "Finished sessions per month." },
  prs: { label: "PRs", hint: "New all-time bests set each month." },
  volume: { label: "Volume", hint: "Total weight moved each month." },
};

/**
 * Lifetime dashboard: totals, all-time PR per lift, and the volume milestone
 * ladder. Complements the home-screen PR goal, which only tracks one target.
 */
export function StatsDashboard() {
  const { user } = useAuth();
  const { unit } = useWeightUnit();
  const bodyweight = useBodyweight();
  const [showAllPrs, setShowAllPrs] = useState(false);
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("workouts");

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
    const workoutDates = new Map<string, string>();
    const byExercise = new Map<string, PrRow>();
    let totalVolume = 0;
    let totalSets = 0;

    for (const r of rows) {
      const we = r.workout_exercises;
      const w = we?.workouts;
      const ex = we?.exercises;
      if (!we || !w || !ex) continue;
      workouts.add(w.id);
      workoutDates.set(w.id, w.workout_date);
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

    // Monthly trend. PRs are counted chronologically: a set only scores when it
    // beats that lift's previous all-time best, so the very first time you log
    // an exercise doesn't inflate the count.
    const sorted = [...rows]
      .filter((r) => r.workout_exercises?.workouts && r.workout_exercises.exercises)
      .sort((a, b) =>
        (a.workout_exercises!.workouts!.created_at ?? "").localeCompare(
          b.workout_exercises!.workouts!.created_at ?? "",
        ),
      );

    type Bucket = { key: string; label: string; workouts: Set<string>; prs: number; volume: number };
    const buckets = new Map<string, Bucket>();
    const bestSoFar = new Map<string, number>();

    for (const r of sorted) {
      const we = r.workout_exercises!;
      const w = we.workouts!;
      const ex = we.exercises!;
      const d = new Date(w.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const bucket =
        buckets.get(key) ??
        ({
          key,
          label: d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
          workouts: new Set<string>(),
          prs: 0,
          volume: 0,
        } as Bucket);
      bucket.workouts.add(w.id);
      bucket.volume += setVolume(r, ex, bodyweight);

      const load = effectiveLoad(r, ex, bodyweight);
      const orm = oneRepMaxNumeric(load, r.reps);
      if (orm != null) {
        const prev = bestSoFar.get(we.exercise_id);
        if (prev != null && orm > prev) bucket.prs += 1;
        if (prev == null || orm > prev) bestSoFar.set(we.exercise_id, orm);
      }
      buckets.set(key, bucket);
    }

    const trend = [...buckets.values()]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((b) => ({
        label: b.label,
        workouts: b.workouts.size,
        prs: b.prs,
        volume: Math.round(b.volume),
      }));

    // Weekly frequency. Weeks start Monday and are keyed by local date so a
    // workout logged Sunday night lands in the week it happened.
    const weekCounts = new Map<string, number>();
    for (const date of workoutDates.values()) {
      const [y, m, d] = date.split("-").map(Number);
      if (!y || !m || !d) continue;
      const day = new Date(y, m - 1, d);
      const shift = (day.getDay() + 6) % 7; // Monday = 0
      day.setDate(day.getDate() - shift);
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
      weekCounts.set(key, (weekCounts.get(key) ?? 0) + 1);
    }

    const now = new Date();
    const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    thisMonday.setDate(thisMonday.getDate() - ((thisMonday.getDay() + 6) % 7));
    const weekKey = (offset: number) => {
      const d = new Date(thisMonday);
      d.setDate(d.getDate() - offset * 7);
      return {
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
        start: d,
      };
    };

    const recent = Array.from({ length: 12 }, (_, i) => weekKey(11 - i)).map(({ key, start }) => ({
      key,
      start,
      count: weekCounts.get(key) ?? 0,
    }));

    const thisWeek = recent[recent.length - 1]?.count ?? 0;
    const lastWeek = recent[recent.length - 2]?.count ?? 0;
    // Average only over weeks since the first logged session, excluding the
    // in-progress current week so a Monday doesn't drag the average down.
    const sortedWeeks = [...weekCounts.keys()].sort();
    const firstWeek = sortedWeeks[0] ?? null;
    const completed = recent.slice(0, -1).filter((w) => !firstWeek || w.key >= firstWeek);
    const avgPerWeek = completed.length
      ? completed.reduce((s, w) => s + w.count, 0) / completed.length
      : thisWeek;

    return {
      workouts: workouts.size,
      totalSets,
      totalVolume,
      prs,
      lifts: byExercise.size,
      trend,
      recentWeeks: recent,
      thisWeek,
      lastWeek,
      avgPerWeek,
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
          tone="blue"
          label="Workouts"
          value={stats.workouts.toLocaleString()}
          hint={nextWorkoutTarget ? `${nextWorkoutTarget - stats.workouts} to ${nextWorkoutTarget}` : "Milestone maxed"}
        />
        <Stat
          icon={<Flame className="h-4 w-4" aria-hidden />}
          tone="coral"
          label={`Volume (${unit})`}
          value={Math.round(stats.totalVolume).toLocaleString()}
          hint={`${stats.totalSets.toLocaleString()} sets logged`}
        />
        <Stat
          icon={<Dumbbell className="h-4 w-4" aria-hidden />}
          tone="blue"
          label="Lifts trained"
          value={stats.lifts.toLocaleString()}
          hint="Distinct exercises"
        />
        <Stat
          icon={<Trophy className="h-4 w-4" aria-hidden />}
          tone="gold"
          label="Top est. 1RM"
          value={stats.prs[0] ? `${Math.round(stats.prs[0].orm)}` : "—"}
          hint={stats.prs[0]?.name ?? "No PRs yet"}
        />
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Training frequency</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              How often you lift, and how it tracks against your weekly goal.
            </p>
          </div>
          <span
            className={`inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md ${TONE_CLASSES.gold.bg} ${TONE_CLASSES.gold.fg}`}
          >
            <Repeat className="h-3.5 w-3.5" aria-hidden />
          </span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          <div>
            <p className="text-xl font-bold tracking-tight">
              <span className="num">{Math.round(stats.avgPerWeek * 10) / 10}</span>
            </p>
            <p className="text-[12px] text-muted-foreground">Avg days / week</p>
          </div>
          <div>
            <p className="text-xl font-bold tracking-tight">
              <span className="num">{stats.thisWeek}</span>
              <span className="text-sm font-medium text-muted-foreground">/{weeklyTarget}</span>
            </p>
            <p className="text-[12px] text-muted-foreground">This week</p>
          </div>
          <div>
            <p className="text-xl font-bold tracking-tight">
              <span className="num">{goalStreak}</span>
            </p>
            <p className="text-[12px] text-muted-foreground">
              Week{goalStreak === 1 ? "" : "s"} at goal
            </p>
          </div>
        </div>

        <div
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.floor(weekPct)}
          aria-label={`Progress toward ${weeklyTarget} sessions this week`}
        >
          <div
            className={"h-full rounded-full " + (stats.thisWeek >= weeklyTarget ? "bg-primary" : "bg-primary/50")}
            style={{ width: `${weekPct}%` }}
          />
        </div>
        <p className="mt-1.5 text-[12px] text-muted-foreground">
          {stats.thisWeek >= weeklyTarget
            ? "Goal hit for this week — anything else is a bonus."
            : `${weeklyTarget - stats.thisWeek} more session${weeklyTarget - stats.thisWeek === 1 ? "" : "s"} to hit your goal.`}
          {" "}Last week: <span className="num">{stats.lastWeek}</span>.
        </p>

        <div className="mt-4">
          <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
            Last 12 weeks
          </p>
          <ul className="mt-2 flex items-end gap-1" aria-hidden>
            {stats.recentWeeks.map((w) => {
              const h = Math.max(6, Math.min(40, (w.count / Math.max(weeklyTarget, 1)) * 32));
              return (
                <li
                  key={w.key}
                  className={
                    "flex-1 rounded-sm " + (w.count >= weeklyTarget ? "bg-primary" : w.count > 0 ? "bg-primary/40" : "bg-secondary")
                  }
                  style={{ height: `${h}px` }}
                  title={`${w.count} session${w.count === 1 ? "" : "s"}`}
                />
              );
            })}
          </ul>
        </div>

        <div className="mt-4">
          <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
            Weekly goal
          </p>
          <div role="group" aria-label="Weekly training goal" className="mt-2 grid grid-cols-5 gap-1 rounded-lg bg-secondary p-1">
            {WEEKLY_TARGET_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={weeklyTarget === n}
                onClick={() => void setWeeklyTarget(n)}
                className={
                  "h-8 rounded-md text-xs font-semibold transition-colors " +
                  (weeklyTarget === n
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {n}×
              </button>
            ))}
          </div>
        </div>
      </section>


      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Trend by month</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{TREND_META[trendMetric].hint}</p>
          </div>
        </div>
        <div role="tablist" aria-label="Trend metric" className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-secondary p-1">
          {(["workouts", "prs", "volume"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={trendMetric === k}
              onClick={() => setTrendMetric(k)}
              className={
                "h-8 rounded-md text-xs font-semibold transition-colors " +
                (trendMetric === k
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {TREND_META[k].label}
            </button>
          ))}
        </div>
        {stats.trend.length < 2 ? (
          <p className="mt-4 text-xs text-muted-foreground">
            One month of history so far — the trend chart fills in as you keep logging.
          </p>
        ) : (
          <div className="mt-3 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.trend} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [
                    `${value.toLocaleString()}${trendMetric === "volume" ? ` ${unit}` : ""}`,
                    TREND_META[trendMetric].label,
                  ]}
                />
                <Bar dataKey={trendMetric} fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
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
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      <span className="num">{Math.round(p.load * 10) / 10}</span> {unit}
                      {p.reps ? ` × ${p.reps}` : ""} · {new Date(p.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold">
                      <span className="num">{Math.round(p.orm)}</span> {unit}
                    </p>
                    <p className="text-[12px] text-muted-foreground">est. 1RM</p>
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

type Tone = "blue" | "gold" | "coral";

const TONE_CLASSES: Record<
  Tone,
  { bg: string; fg: string }
> = {
  blue: { bg: "bg-chip-blue-bg", fg: "text-chip-blue-fg" },
  gold: { bg: "bg-chip-gold-bg", fg: "text-chip-gold-fg" },
  coral: { bg: "bg-chip-coral-bg", fg: "text-chip-coral-fg" },
};

function Stat({
  icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  tone: Tone;
  label: string;
  value: string;
  hint: string;
}) {
  const chip = TONE_CLASSES[tone];
  const chipIcon = isValidElement(icon)
    ? cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "h-3.5 w-3.5" })
    : icon;
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <span
          className={`inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md ${chip.bg} ${chip.fg}`}
        >
          {chipIcon}
        </span>
        <span className="text-[12px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1 text-xl font-bold tracking-tight">
        <span className="num">{value}</span>
      </p>
      <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{hint}</p>
    </div>
  );
}
