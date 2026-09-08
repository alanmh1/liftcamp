import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./auth-context";
import { supabase } from "@/integrations/supabase/client";

export function useBodyweight(): number | null {
  const { user } = useAuth();
  const q = useQuery({
    enabled: !!user,
    queryKey: ["user-bodyweight", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("bodyweight")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      const v = data?.bodyweight;
      return v == null ? null : Number(v);
    },
  });
  const v = q.data;
  return v == null || !Number.isFinite(v) ? null : v;
}
