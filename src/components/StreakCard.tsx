import { useQuery } from "@tanstack/react-query";
import { Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWeeklyTarget } from "@/lib/weekly-target";
import { parseLocalDate } from "@/components/WorkoutCalendar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - dow);
  return x;
}

function weekKey(d: Date): string {
  const s = startOfWeek(d);
  return `${s.getFullYear()}-${s.getMonth()}-${s.getDate()}`;
}

/**
 * Habit loop: this week's progress toward the user's target, the days already
 * trained, and how many consecutive weeks they've hit the target.
 */
export function StreakCard({ userId }: { userId: string }) {
  const { target } = useWeeklyTarget();

  const q = useQuery({
    queryKey: ["streak", userId],
    queryFn: async (): Promise<string[]> => {
      const since = new Date();
      since.setDate(since.getDate() - 7 * 26);
      const { data, error } = await supabase
        .from("workouts")
        .select("workout_date")
        .eq("user_id", userId)
        .not("finished_at", "is", null)
        .gte("workout_date", since.toISOString().slice(0, 10))
        .order("workout_date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => r.workout_date as string);
    },
  });

  if (q.isLoading) return <Skeleton className="h-[92px] w-full rounded-lg" />;

  const dates = (q.data ?? [])
    .map((s) => parseLocalDate(s))
    .filter((d): d is Date => !!d);

  const thisWeekStart = startOfWeek(new Date());
  const trainedDays = new Set<number>();
  const perWeek = new Map<string, number>();
  for (const d of dates) {
    perWeek.set(weekKey(d), (perWeek.get(weekKey(d)) ?? 0) + 1);
    if (d >= thisWeekStart) trainedDays.add((d.getDay() + 6) % 7);
  }

  const thisWeekCount = perWeek.get(weekKey(new Date())) ?? 0;

  // Consecutive weeks meeting target, walking backwards. The current week only
  // counts once it's met, so an in-progress week never breaks the streak.
  let streak = 0;
  const cursor = new Date(thisWeekStart);
  if (thisWeekCount >= target) streak += 1;
  cursor.setDate(cursor.getDate() - 7);
  while ((perWeek.get(weekKey(cursor)) ?? 0) >= target) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 7);
  }

  const pct = Math.min(100, target > 0 ? (thisWeekCount / target) * 100 : 0);
  const hit = thisWeekCount >= target;

  return (
    <section
      aria-label="Weekly training target"
      className={cn(
        "rounded-lg border px-4 py-3 transition-colors",
        // Gold is the achievement colour, so hitting the weekly target earns a
        // gold hairline rather than staying a neutral card with a badge.
        hit ? "border-pr" : "border-border",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">
          This week{" "}
          <span className="num text-muted-foreground">
            {thisWeekCount}/{target}
          </span>
        </p>
        {streak > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-pr px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-pr-foreground">
            <Flame className="h-3 w-3" aria-hidden />
            {streak} week{streak === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            "h-full rounded-full transition-[width]",
            hit ? "bg-pr" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>


      <div className="mt-2.5 flex items-center gap-1.5">
        {DAY_LABELS.map((label, i) => (
          <span
            key={i}
            aria-hidden
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium",
              trainedDays.has(i)
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground",
            )}
          >
            {label}
          </span>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {thisWeekCount >= target
            ? "Target hit"
            : `${target - thisWeekCount} to go`}
        </span>
      </div>
    </section>
  );
}
