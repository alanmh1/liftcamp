import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useWeightUnit } from "@/lib/weight-unit";
import { oneRepMaxNumeric } from "@/lib/one-rep-max";
import { effectiveLoad } from "@/lib/set-weight";
import { useBodyweight } from "@/lib/use-bodyweight";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";
import { LineChart as LineIcon, BarChart3 } from "lucide-react";

type ChartPoint = {
  label: string;
  orm: number | null;
  best: number | null;
  bestReps: number | null;
  volume: number;
  setCount: number;
  isPrOrm: boolean;
  isPrBest: boolean;
};

const COLOR_LINE = "var(--primary)";
const COLOR_GRID = "var(--border)";
const COLOR_MUTED = "var(--muted-foreground)";
const COLOR_PR = "var(--pr)";

type LoggedExercise = { id: string; name: string; weight_type: string | null };
type SetWithWorkout = {
  weight: string;
  weight_value: number | null;
  reps: number | null;
  workout_exercises: {
    exercise_id: string;
    workouts: { id: string; workout_date: string; created_at: string } | null;
  };
};

// Progress charts, rendered inside the History screen's "Progress" tab.
export function ProgressView() {
  const { user } = useAuth();
  const { unit } = useWeightUnit();

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [metric, setMetric] = useState<"orm" | "best" | "volume">("orm");
  const [chartType, setChartType] = useState<"line" | "bar">("line");


  const exercisesQ = useQuery({
    enabled: !!user,
    queryKey: ["progress-exercises", user?.id],
    queryFn: async (): Promise<LoggedExercise[]> => {
      // Only exercises with at least one completed set inside a finished
      // workout: an abandoned or empty session shouldn't populate the picker.
      const { data, error } = await supabase
        .from("sets")
        .select(
          "workout_exercises!inner(exercise_id, exercises(id, name, weight_type), workouts!inner(finished_at))",
        )
        .eq("user_id", user!.id)
        .eq("completed", true)
        .not("workout_exercises.workouts.finished_at", "is", null);
      if (error) throw error;
      const rows = (data ?? []) as unknown as Array<{
        workout_exercises: {
          exercises: { id: string; name: string; weight_type: string | null } | null;
        } | null;
      }>;
      const map = new Map<string, LoggedExercise>();
      for (const row of rows) {
        const ex = row.workout_exercises?.exercises;
        if (ex) map.set(ex.id, { id: ex.id, name: ex.name, weight_type: ex.weight_type });
      }
      return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    },

  });


  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = exercisesQ.data ?? [];
    if (!q) return list;
    return list.filter((e) => e.name.toLowerCase().includes(q));
  }, [exercisesQ.data, query]);

  const setsQ = useQuery({
    enabled: !!user && !!selectedId,
    queryKey: ["progress-sets", user?.id, selectedId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sets")
        .select("weight, weight_value, reps, workout_exercises!inner(exercise_id, workouts(id, workout_date, created_at))")
        .eq("user_id", user!.id)
        .eq("completed", true)
        .eq("workout_exercises.exercise_id", selectedId!);
      if (error) throw error;
      return (data ?? []) as unknown as SetWithWorkout[];
    },
  });

  const bodyweight = useBodyweight();
  const selectedExercise = useMemo(
    () => (exercisesQ.data ?? []).find((e) => e.id === selectedId) ?? null,
    [exercisesQ.data, selectedId],
  );

  const chartData = useMemo(() => {
    const sets = setsQ.data ?? [];
    type Agg = {
      date: string;
      created_at: string;
      orm: number;
      best: number;
      bestReps: number | null;
      volume: number;
      sets: number;
      any: boolean;
    };
    const byWorkout = new Map<string, Agg>();
    for (const s of sets) {
      const w = s.workout_exercises.workouts;
      if (!w) continue;
      const load = effectiveLoad(
        { weight: s.weight, weight_value: s.weight_value },
        selectedExercise,
        bodyweight,
      );
      if (load == null) continue;
      const orm = oneRepMaxNumeric(load, s.reps);
      const reps = s.reps ?? 0;
      const vol = reps > 0 ? load * reps : 0;
      const cur = byWorkout.get(w.id) ?? {
        date: w.workout_date,
        created_at: w.created_at,
        orm: -Infinity,
        best: -Infinity,
        bestReps: null,
        volume: 0,
        sets: 0,
        any: false,
      };
      if (orm != null && orm > cur.orm) cur.orm = orm;
      if (load > cur.best) {
        cur.best = load;
        cur.bestReps = s.reps;
      }
      cur.volume += vol;
      cur.sets += 1;
      cur.any = true;
      byWorkout.set(w.id, cur);
    }

    const sorted = [...byWorkout.values()]
      .filter((p) => p.any)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));

    let runningOrm = -Infinity;
    let runningBest = -Infinity;
    return sorted.map((p) => {
      const ormVal = Number.isFinite(p.orm) ? Math.round(p.orm) : null;
      const bestVal = Number.isFinite(p.best) ? Math.round(p.best * 10) / 10 : null;
      const volVal = Math.round(p.volume * 10) / 10;
      const isPrOrm = ormVal != null && p.orm > runningOrm;
      if (isPrOrm) runningOrm = p.orm;
      const isPrBest = bestVal != null && p.best > runningBest;
      if (isPrBest) runningBest = p.best;
      return {
        label: new Date(p.date).toLocaleDateString(),
        orm: ormVal,
        best: bestVal,
        bestReps: p.bestReps,
        volume: volVal,
        setCount: p.sets,
        isPrOrm,
        isPrBest,
      };
    });
  }, [setsQ.data, selectedExercise, bodyweight]);

  // Headline trend: latest session versus the first one on record.
  const trend = useMemo(() => {
    if (chartData.length < 2) return null;
    const key = metric;
    const first = chartData[0][key];
    const last = chartData[chartData.length - 1][key];
    if (first == null || last == null || first === 0) return null;
    const delta = last - first;
    const pct = Math.round((delta / first) * 100);
    return { delta: Math.round(delta * 10) / 10, pct, sessions: chartData.length };
  }, [chartData, metric]);


  const metricMeta = {
    orm: { label: `Est. 1RM (${unit})`, short: "Est. 1RM", tooltipLabel: "1RM", unitSuffix: unit },
    best: { label: `Best Set (${unit})`, short: "Best Set", tooltipLabel: "Best", unitSuffix: unit },
    volume: { label: `Volume (${unit})`, short: "Total Volume", tooltipLabel: "Volume", unitSuffix: unit },
  }[metric];


  const selectedName = (exercisesQ.data ?? []).find((e) => e.id === selectedId)?.name ?? null;

  // Explicit numeric y-domain: recharts' function-based domain produced
  // nonsense ticks (e.g. 99999996) once combined with allowDecimals={false}.
  const yDomain = useMemo<[number, number]>(() => {
    const vals = chartData
      .map((p) => (metric === "orm" ? p.orm : metric === "best" ? p.best : p.volume))
      .filter((v): v is number => v != null && Number.isFinite(v));
    if (!vals.length) return [0, 1];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = Math.max(1, (max - min || max) * 0.1);
    return [Math.max(0, Math.floor(min - pad)), Math.ceil(max + pad)];
  }, [chartData, metric]);

  const renderTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload?: unknown }> }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload as ChartPoint;
    const value = metric === "orm" ? p.orm : metric === "best" ? p.best : p.volume;
    const isPr = metric === "orm" ? p.isPrOrm : metric === "best" ? p.isPrBest : false;
    return (
      <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
        <p className="font-semibold">{p.label}</p>
        <p className="mt-1">
          {metricMeta.tooltipLabel}: <span className="num">{value ?? "—"}</span> {metricMeta.unitSuffix}
        </p>
        {metric !== "volume" && p.best != null && (
          <p className="text-muted-foreground">
            Top set: <span className="num">{p.best}</span> {unit}
            {p.bestReps ? ` × ${p.bestReps}` : ""}
          </p>
        )}
        <p className="text-muted-foreground">{p.setCount} sets logged</p>
        {isPr && (
          <p className="mt-1 inline-block rounded-full bg-pr px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-pr-foreground">
            PR
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises you've logged…"
          className="h-11 px-3 rounded-md border border-input bg-background text-base focus:outline-none focus:ring-2 focus:ring-ring"
        />

        {!selectedId && (
          <ul className="flex flex-col divide-y divide-border rounded-md border border-border overflow-hidden">
            {(exercisesQ.data ?? []).length === 0 ? (
              <li className="px-4 py-6 text-sm text-muted-foreground">No logged exercises yet.</li>
            ) : filtered.length === 0 ? (
              <li className="px-4 py-6 text-sm text-muted-foreground">No matches.</li>
            ) : (
              filtered.map((ex) => (
                <li key={ex.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(ex.id)}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-accent"
                  >
                    {ex.name}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}

        {selectedId && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold truncate">{selectedName}</h2>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="text-xs text-muted-foreground underline shrink-0 ml-3"
              >
                Change
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="inline-flex self-start rounded-md border border-border overflow-hidden text-xs">
              {([
                ["orm", "Est. 1RM"],
                ["best", "Best Set"],
                ["volume", "Total Volume"],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMetric(key)}
                  className={`px-3 h-8 ${
                    metric === key
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="inline-flex self-start rounded-md border border-border overflow-hidden text-xs">
              {([
                ["line", "Line", LineIcon],
                ["bar", "Bar", BarChart3],
              ] as const).map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  aria-label={`${label} chart`}
                  aria-pressed={chartType === key}
                  onClick={() => setChartType(key)}
                  className={`px-2.5 h-8 flex items-center gap-1 ${
                    chartType === key
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
            </div>

            {trend && (
              <p className="text-xs text-muted-foreground">
                {trend.delta >= 0 ? "Up" : "Down"}{" "}
                <span className={trend.delta >= 0 ? "font-semibold text-primary" : "font-semibold text-destructive"}>
                  {trend.delta >= 0 ? "+" : ""}
                  <span className="num">{trend.delta}</span> {unit} ({trend.pct >= 0 ? "+" : ""}
                  {trend.pct}%)
                </span>{" "}
                across {trend.sessions} sessions.
              </p>
            )}

            {setsQ.isLoading ? (
              <Skeleton className="h-72 w-full rounded-md" />
            ) : chartData.length < 2 ? (
              <p className="text-sm text-muted-foreground">Log at least 2 sessions to see your progress</p>
            ) : (
              <div className="rounded-md border border-border bg-card p-3">

                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {chartType === "line" ? (
                    <LineChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={COLOR_GRID} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="label"
                        stroke={COLOR_MUTED}
                        tick={{ fill: COLOR_MUTED, fontSize: 11, fontFamily: "Space Mono, monospace" }}
                        tickLine={{ stroke: COLOR_GRID }}
                        axisLine={{ stroke: COLOR_GRID }}
                      />
                      <YAxis
                        stroke={COLOR_MUTED}
                        tick={{ fill: COLOR_MUTED, fontSize: 11, fontFamily: "Space Mono, monospace" }}
                        tickLine={{ stroke: COLOR_GRID }}
                        axisLine={{ stroke: COLOR_GRID }}
                        domain={yDomain}
                        allowDecimals={false}
                        tickFormatter={(v: number) => String(Math.round(v))}
                        label={{
                          value: metricMeta.label,
                          angle: -90,
                          position: "insideLeft",
                          fill: COLOR_MUTED,
                          fontSize: 11,
                        }}
                      />
                      <Tooltip cursor={{ stroke: COLOR_GRID }} content={renderTooltip} />

                      <Line
                        type="monotone"
                        dataKey={metric}
                        stroke={COLOR_LINE}
                        strokeWidth={2}
                        dot={{ fill: COLOR_LINE, r: 3 }}
                        activeDot={{ r: 5 }}
                        isAnimationActive={false}
                        connectNulls
                      />
                      {metric !== "volume" &&
                        chartData.map((p, i) => {
                          const isPr = metric === "orm" ? p.isPrOrm : p.isPrBest;
                          const y = metric === "orm" ? p.orm : p.best;
                          if (!isPr || y == null) return null;
                          return (
                            <ReferenceDot
                              key={i}
                              x={p.label}
                              y={y}
                              r={5}
                              fill={COLOR_PR}
                              stroke={COLOR_PR}
                              isFront
                            />
                          );
                        })}
                    </LineChart>
                    ) : (
                    <BarChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={COLOR_GRID} strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="label"
                        stroke={COLOR_MUTED}
                        tick={{ fill: COLOR_MUTED, fontSize: 11, fontFamily: "Space Mono, monospace" }}
                        tickLine={{ stroke: COLOR_GRID }}
                        axisLine={{ stroke: COLOR_GRID }}
                      />
                      <YAxis
                        stroke={COLOR_MUTED}
                        tick={{ fill: COLOR_MUTED, fontSize: 11, fontFamily: "Space Mono, monospace" }}
                        tickLine={{ stroke: COLOR_GRID }}
                        axisLine={{ stroke: COLOR_GRID }}
                        allowDecimals={false}
                        tickFormatter={(v: number) => String(Math.round(v))}
                        label={{
                          value: metricMeta.label,
                          angle: -90,
                          position: "insideLeft",
                          fill: COLOR_MUTED,
                          fontSize: 11,
                        }}
                      />
                      <Tooltip cursor={{ fill: COLOR_GRID, fillOpacity: 0.25 }} content={renderTooltip} />
                      <Bar dataKey={metric} radius={[3, 3, 0, 0]} isAnimationActive={false}>
                        {chartData.map((p, i) => {
                          const isPr =
                            metric === "orm" ? p.isPrOrm : metric === "best" ? p.isPrBest : false;
                          return <Cell key={i} fill={isPr ? COLOR_PR : COLOR_LINE} />;
                        })}
                      </Bar>
                    </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </section>

        )}
    </div>
  );
}

