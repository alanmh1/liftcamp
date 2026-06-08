import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { useWeightUnit } from "@/lib/weight-unit";
import { oneRepMaxNumeric } from "@/lib/one-rep-max";
import { effectiveLoad } from "@/lib/set-weight";
import { useBodyweight } from "@/lib/use-bodyweight";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";

export const Route = createFileRoute("/progress")({
  head: () => ({
    meta: [
      { title: "Progress — RepLog" },
      { name: "description", content: "Estimated 1RM over time per exercise." },
    ],
  }),
  component: ProgressPage,
});

const COLOR_BG = "#0E0F12";
const COLOR_LINE = "#FF4D1F";
const COLOR_GRID = "#2A2C33";
const COLOR_MUTED = "#8C8D94";
const COLOR_PR = "#3DD68C";

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


function ProgressPage() {
  const { session, loading, user } = useAuth();
  const navigate = useNavigate();
  const { unit } = useWeightUnit();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login", replace: true });
  }, [session, loading, navigate]);

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [metric, setMetric] = useState<"orm" | "best" | "volume">("orm");


  const exercisesQ = useQuery({
    enabled: !!user,
    queryKey: ["progress-exercises", user?.id],
    queryFn: async (): Promise<LoggedExercise[]> => {
      const { data, error } = await supabase
        .from("workout_exercises")
        .select("exercise_id, exercises(id, name, weight_type)")
        .eq("user_id", user!.id);
      if (error) throw error;
      const map = new Map<string, LoggedExercise>();
      for (const row of (data ?? []) as Array<{ exercise_id: string; exercises: { id: string; name: string; weight_type: string | null } | null }>) {
        if (row.exercises) map.set(row.exercises.id, { id: row.exercises.id, name: row.exercises.name, weight_type: row.exercises.weight_type });
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
    type Agg = { date: string; created_at: string; orm: number; best: number; volume: number; any: boolean };
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
        volume: 0,
        any: false,
      };
      if (orm != null && orm > cur.orm) cur.orm = orm;
      if (load > cur.best) cur.best = load;
      cur.volume += vol;
      cur.any = true;
      byWorkout.set(w.id, cur);
    }

    const sorted = [...byWorkout.values()]
      .filter((p) => p.any)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));

    let runningOrm = -Infinity;
    let runningBest = -Infinity;
    return sorted.map((p) => {
      const ormVal = Number.isFinite(p.orm) ? Math.round(p.orm * 10) / 10 : null;
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
        volume: volVal,
        isPrOrm,
        isPrBest,
      };
    });
  }, [setsQ.data, selectedExercise, bodyweight]);

  const metricMeta = {
    orm: { label: `Est. 1RM (${unit})`, short: "Est. 1RM", tooltipLabel: "1RM", unitSuffix: unit },
    best: { label: `Best Set (${unit})`, short: "Best Set", tooltipLabel: "Best", unitSuffix: unit },
    volume: { label: `Volume (${unit})`, short: "Total Volume", tooltipLabel: "Volume", unitSuffix: unit },
  }[metric];


  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">…</p>
      </div>
    );
  }

  const selectedName = (exercisesQ.data ?? []).find((e) => e.id === selectedId)?.name ?? null;

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24">
      <header className="px-5 pt-6 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Progress</h1>
        <p className="mt-1 text-xs text-muted-foreground">Estimated 1RM over time.</p>
      </header>

      <main className="flex-1 px-5 flex flex-col gap-4">
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

            {setsQ.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : chartData.length < 2 ? (
              <p className="text-sm text-muted-foreground">Log at least 2 sessions to see your progress</p>
            ) : (
              <div
                className="rounded-md border border-border p-3"
                style={{ backgroundColor: COLOR_BG }}
              >
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={COLOR_GRID} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="label"
                        stroke={COLOR_MUTED}
                        tick={{ fill: COLOR_MUTED, fontSize: 11 }}
                        tickLine={{ stroke: COLOR_GRID }}
                        axisLine={{ stroke: COLOR_GRID }}
                      />
                      <YAxis
                        stroke={COLOR_MUTED}
                        tick={{ fill: COLOR_MUTED, fontSize: 11 }}
                        tickLine={{ stroke: COLOR_GRID }}
                        axisLine={{ stroke: COLOR_GRID }}
                        label={{
                          value: `1RM (${unit})`,
                          angle: -90,
                          position: "insideLeft",
                          fill: COLOR_MUTED,
                          fontSize: 11,
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: COLOR_BG,
                          border: `1px solid ${COLOR_GRID}`,
                          color: COLOR_MUTED,
                          fontSize: 12,
                        }}
                        labelStyle={{ color: COLOR_MUTED }}
                        formatter={(value: number) => [`${value} ${unit}`, "1RM"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="orm"
                        stroke={COLOR_LINE}
                        strokeWidth={2}
                        dot={{ fill: COLOR_LINE, r: 3 }}
                        activeDot={{ r: 5 }}
                        isAnimationActive={false}
                      />
                      {chartData.map((p, i) =>
                        p.isPr ? (
                          <ReferenceDot
                            key={i}
                            x={p.label}
                            y={p.orm}
                            r={5}
                            fill={COLOR_PR}
                            stroke={COLOR_PR}
                            isFront
                          />
                        ) : null,
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
