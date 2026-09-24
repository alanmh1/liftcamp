import { useMemo } from "react";
import { setVolume } from "@liftcamp/shared";
import { useWeightUnit } from "@/lib/weight-unit";
import { useBodyweight } from "@/lib/use-bodyweight";
import { parseLocalDate } from "@/components/WorkoutCalendar";

type RecapWorkout = {
  id: string;
  workout_date: string;
  created_at: string;
  finished_at: string | null;
  workout_exercises: Array<{
    exercises: {
      id: string;
      name: string;
      equipment: string | null;
      weight_type: string | null;
      is_unilateral: boolean | null;
    } | null;
    sets: Array<{ weight: string; weight_value: number | null; reps: number | null; completed: boolean }>;
  }>;
};

function startOfWeek(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (copy.getDay() + 6) % 7; // Monday-first
  copy.setDate(copy.getDate() - day);
  return copy;
}

/**
 * "This week so far" summary: sessions, sets, volume and minutes trained,
 * with a comparison against the previous week so progress is visible at a
 * glance.
 */
export function WeeklyRecap({ workouts }: { workouts: RecapWorkout[] }) {
  const { unit } = useWeightUnit();
  const bodyweight = useBodyweight();

  const stats = useMemo(() => {
    const thisWeek = startOfWeek(new Date());
    const lastWeek = new Date(thisWeek);
    lastWeek.setDate(lastWeek.getDate() - 7);

    function summarize(from: Date, to: Date) {
      let sessions = 0;
      let sets = 0;
      let volume = 0;
      let minutes = 0;
      for (const w of workouts) {
        const d = parseLocalDate(w.workout_date);
        if (!d || d < from || d >= to) continue;
        sessions += 1;
        if (w.finished_at) {
          const ms = new Date(w.finished_at).getTime() - new Date(w.created_at).getTime();
          if (Number.isFinite(ms) && ms > 0) minutes += Math.round(ms / 60000);
        }
        for (const we of w.workout_exercises ?? []) {
          for (const s of we.sets ?? []) {
            if (!s.completed) continue;
            sets += 1;
            volume += setVolume(s, we.exercises, bodyweight);
          }
        }
      }
      return { sessions, sets, volume, minutes };
    }

    const next = new Date(thisWeek);
    next.setDate(next.getDate() + 7);
    return { current: summarize(thisWeek, next), previous: summarize(lastWeek, thisWeek) };
  }, [workouts, bodyweight]);

  const { current, previous } = stats;
  if (current.sessions === 0 && previous.sessions === 0) return null;

  const volumeDelta =
    previous.volume > 0 ? Math.round(((current.volume - previous.volume) / previous.volume) * 100) : null;

  return (
    <section className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">This week</p>
        {volumeDelta != null && current.volume > 0 && (
          <span
            className={`text-[13px] font-semibold ${volumeDelta >= 0 ? "text-pr" : "text-muted-foreground"}`}
          >
            {volumeDelta >= 0 ? "+" : ""}
            {volumeDelta}% volume vs last week
          </span>
        )}
      </div>
      <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
        <Stat label="sessions" value={current.sessions} />
        <Stat label="sets" value={current.sets} />
        <Stat label={`${unit} vol`} value={Math.round(current.volume).toLocaleString()} />
        <Stat label="minutes" value={current.minutes} />
      </dl>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dd className="num text-lg font-semibold tabular-nums">{value}</dd>
      <dt className="text-[13px] uppercase tracking-wide text-muted-foreground">{label}</dt>
    </div>
  );
}
