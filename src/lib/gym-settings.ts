import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useWeightUnit } from "@/lib/weight-unit";
import {
  DEFAULT_BAR,
  defaultInventory,
  inventoryPlates,
  type PlateInventory,
} from "@/lib/plate-math";
import { reportSaveError } from "@/lib/save-error";

/**
 * The lifter's bar weight and plate inventory, used by the plate calculator.
 * Falls back to standard commercial-gym equipment when unset.
 */
export function useGymSettings() {
  const { user } = useAuth();
  const { unit } = useWeightUnit();
  const qc = useQueryClient();
  const userId = user?.id;

  const q = useQuery({
    enabled: !!userId,
    queryKey: ["gym-settings", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("bar_weight, plate_inventory")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return {
        bar_weight: data?.bar_weight == null ? null : Number(data.bar_weight),
        plate_inventory: (data?.plate_inventory ?? null) as PlateInventory | null,
      };
    },
  });

  const bar =
    q.data?.bar_weight != null && Number.isFinite(q.data.bar_weight)
      ? q.data.bar_weight
      : DEFAULT_BAR[unit];
  const inventory = q.data?.plate_inventory ?? defaultInventory(unit);
  const plates = inventoryPlates(inventory, unit);
  const isCustom = !!(q.data?.bar_weight != null || q.data?.plate_inventory);

  async function save(patch: { bar_weight?: number | null; plate_inventory?: PlateInventory | null }) {
    if (!userId) return;
    const prev = q.data;
    qc.setQueryData(["gym-settings", userId], {
      bar_weight: patch.bar_weight !== undefined ? patch.bar_weight : (q.data?.bar_weight ?? null),
      plate_inventory:
        patch.plate_inventory !== undefined
          ? patch.plate_inventory
          : (q.data?.plate_inventory ?? null),
    });
    const { error } = await supabase
      .from("user_profiles")
      .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
    if (await reportSaveError(error, "your gym equipment")) {
      qc.setQueryData(["gym-settings", userId], prev);
      return;
    }
    qc.invalidateQueries({ queryKey: ["gym-settings", userId] });
  }

  return { unit, bar, inventory, plates, isCustom, save, loading: q.isLoading };
}
