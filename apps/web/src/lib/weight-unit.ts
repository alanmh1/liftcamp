import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { reportSaveError } from "@/lib/save-error";

export type WeightUnit = "kg" | "lb";

export function useWeightUnit() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id;

  const query = useQuery({
    queryKey: ["weight-unit", userId],
    enabled: !!userId,
    queryFn: async (): Promise<WeightUnit> => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("weight_unit")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        await supabase.from("user_profiles").insert({ user_id: userId!, weight_unit: "lb" });
        return "lb";
      }
      return (data.weight_unit as WeightUnit) ?? "lb";
    },
  });

  async function setUnit(unit: WeightUnit) {
    if (!userId) return;
    const prev = query.data;
    qc.setQueryData(["weight-unit", userId], unit);
    const { error } = await supabase
      .from("user_profiles")
      .upsert({ user_id: userId, weight_unit: unit }, { onConflict: "user_id" });
    if (await reportSaveError(error, "your unit preference")) {
      qc.setQueryData(["weight-unit", userId], prev);
    }
  }

  return { unit: (query.data ?? "lb") as WeightUnit, setUnit };
}

export function isBodyweight(weight: string | null | undefined): boolean {
  return !!weight && weight.trim().toLowerCase().includes("body");
}
