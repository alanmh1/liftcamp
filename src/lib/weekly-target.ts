import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const WEEKLY_TARGET_OPTIONS = [2, 3, 4, 5, 6] as const;
export const DEFAULT_WEEKLY_TARGET = 3;

export function useWeeklyTarget() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id;

  const query = useQuery({
    queryKey: ["weekly-target", userId],
    enabled: !!userId,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("weekly_target")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data?.weekly_target ?? DEFAULT_WEEKLY_TARGET;
    },
  });

  async function setTarget(target: number) {
    if (!userId) return;
    qc.setQueryData(["weekly-target", userId], target);
    await supabase
      .from("user_profiles")
      .upsert({ user_id: userId, weekly_target: target }, { onConflict: "user_id" });
  }

  return { target: query.data ?? DEFAULT_WEEKLY_TARGET, setTarget, isLoading: query.isLoading };
}
