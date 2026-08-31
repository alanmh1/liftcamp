import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseLocalDate } from "@/components/WorkoutCalendar";
import { supportingLine, dailySeed } from "@/lib/greeting";

/**
 * Supporting line under the header greeting. Shares the ["streak", userId]
 * query key with StreakCard, so React Query serves both from one fetch.
 */
export function HomeGreeting({ userId }: { userId: string }) {
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

  // Reserve the line's height while loading so the cards below don't jump.
  if (q.isLoading || !q.data) return <div className="h-5" />;

  const dates = q.data.map((s) => parseLocalDate(s)).filter((d): d is Date => !!d);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const latest = dates[0] ?? null;
  const daysSinceLast = latest
    ? Math.max(0, Math.round((today.getTime() - latest.getTime()) / 86400000))
    : null;

  const line = supportingLine({
    recentWorkoutCount: dates.length,
    daysSinceLast,
    seed: dailySeed(userId),
  });

  return <p className="text-sm text-muted-foreground">{line}</p>;
}
