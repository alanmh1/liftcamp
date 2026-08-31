import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { parseLocalDate } from "@/components/WorkoutCalendar";
import { firstNameFromMetadata, pickGreeting, dailySeed } from "@/lib/greeting";

/**
 * One line under the header. Shares the ["streak", userId] query key with
 * StreakCard, so React Query serves both from one fetch.
 */
export function HomeGreeting({ userId }: { userId: string }) {
  const { user } = useAuth();

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

  // No skeleton. A one-line greeting that flickers in is worse than one that
  // simply appears once the data is there.
  if (q.isLoading || !q.data) return null;

  const dates = q.data.map((s) => parseLocalDate(s)).filter((d): d is Date => !!d);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const latest = dates[0] ?? null;
  const daysSinceLast = latest
    ? Math.max(0, Math.round((today.getTime() - latest.getTime()) / 86400000))
    : null;

  const line = pickGreeting({
    firstName: firstNameFromMetadata(user?.user_metadata as Record<string, unknown> | undefined),
    recentWorkoutCount: dates.length,
    daysSinceLast,
    hour: new Date().getHours(),
    seed: dailySeed(userId),
  });

  return <p className="px-5 -mt-3 mb-1 text-sm text-muted-foreground">{line}</p>;
}
