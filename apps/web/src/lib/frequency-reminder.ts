import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWeeklyTarget } from "@/lib/weekly-target";

const ENABLED_KEY = "liftcamp:frequency-reminder";
const DISMISS_KEY = "liftcamp:frequency-reminder-dismissed";

function localKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Monday-start week boundaries in local time. */
export function currentWeek(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  // Monday = 0 … Sunday = 6, so a Wednesday leaves 5 days including today.
  const daysLeft = 7 - ((now.getDay() + 6) % 7);
  return { start, end, daysLeft };
}

export function reminderMessage(remaining: number, daysLeft: number): string {
  if (remaining <= 0) return "";
  if (remaining > daysLeft) {
    return `${remaining} session${remaining === 1 ? "" : "s"} left but only ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Get one in today.`;
  }
  if (daysLeft <= 2) {
    return `${remaining} more session${remaining === 1 ? "" : "s"} before the week resets.`;
  }
  return `${remaining} more session${remaining === 1 ? "" : "s"} to hit your weekly goal.`;
}

/**
 * Nudges the user toward their weekly frequency goal. The reminder is
 * opt-out (stored locally) and can be snoozed for the rest of the day, so a
 * dismissed card comes back tomorrow rather than never.
 */
export function useFrequencyReminder(userId: string | undefined) {
  const { target } = useWeeklyTarget();
  const [enabled, setEnabledState] = useState(true);
  const [dismissedOn, setDismissedOn] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setEnabledState(window.localStorage.getItem(ENABLED_KEY) !== "off");
    setDismissedOn(window.localStorage.getItem(DISMISS_KEY));
  }, []);

  const setEnabled = useCallback((on: boolean) => {
    setEnabledState(on);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ENABLED_KEY, on ? "on" : "off");
    }
  }, []);

  const { start, end, daysLeft } = currentWeek();

  const q = useQuery({
    enabled: !!userId,
    queryKey: ["frequency-reminder", userId, localKey(start)],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from("workouts")
        .select("workout_date")
        .eq("user_id", userId!)
        .not("finished_at", "is", null)
        .gte("workout_date", localKey(start))
        .lt("workout_date", localKey(end));
      if (error) throw error;
      return new Set((data ?? []).map((w) => w.workout_date)).size;
    },
  });

  const done = q.data ?? 0;
  const remaining = Math.max(0, target - done);
  const dismissedToday = dismissedOn === localKey(new Date());

  const dismiss = useCallback(() => {
    const key = localKey(new Date());
    setDismissedOn(key);
    if (typeof window !== "undefined") window.localStorage.setItem(DISMISS_KEY, key);
  }, []);

  return {
    enabled,
    setEnabled,
    target,
    done,
    remaining,
    daysLeft,
    dismiss,
    dismissedToday,
    isLoading: q.isLoading,
    show: enabled && !dismissedToday && !q.isLoading && remaining > 0,
    message: reminderMessage(remaining, daysLeft),
  };
}
