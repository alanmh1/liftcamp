import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Model from "react-body-highlighter";
import { supabase } from "@/integrations/supabase/client";
import { muscleColors, equipmentIcon } from "@/lib/exercise-visuals";
import { muscleNamesToSlugs } from "@/lib/muscle-map";

export type PickerExercise = {
  id: string;
  name: string;
  primary_muscle: string | null;
  all_primary_muscles?: string | null;
  secondary_muscles?: string | null;
  equipment?: string | null;
  ppl_day?: string | null;
  description?: string | null;
};

type Props =
  | { mode?: "pick"; onPick: (ex: PickerExercise) => void | Promise<void> }
  | { mode: "browse"; onPick?: never };

export function ExercisePicker(props: Props) {
  const mode = props.mode ?? "pick";
  const isBrowse = mode === "browse";

  const [q, setQ] = useState("");
  const [day, setDay] = useState("");
  const [muscle, setMuscle] = useState("");
  const [equipment, setEquipment] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: facets } = useQuery({
    queryKey: ["exercise-facets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercises")
        .select("primary_muscle, equipment, ppl_day")
        .limit(2000);
      if (error) throw error;
      const muscles = new Set<string>();
      const equipments = new Set<string>();
      const days = new Set<string>();
      for (const r of data as { primary_muscle: string | null; equipment: string | null; ppl_day: string | null }[]) {
        if (r.primary_muscle) muscles.add(r.primary_muscle);
        if (r.equipment) equipments.add(r.equipment);
        if (r.ppl_day) days.add(r.ppl_day);
      }
      return {
        muscles: [...muscles].sort(),
        equipments: [...equipments].sort(),
        days: [...days].sort(),
      };
    },
  });

  const hasFilter = q.trim().length > 0 || !!day || !!muscle || !!equipment;
  // In browse mode we always show results (no filter = full library).
  const shouldQuery = isBrowse || hasFilter;

  const { data: results } = useQuery({
    queryKey: ["exercise-search", mode, q, day, muscle, equipment],
    enabled: shouldQuery,
    queryFn: async () => {
      let query = supabase
        .from("exercises")
        .select("id, name, primary_muscle, secondary_muscles, equipment, ppl_day, description")
        .order("name")
        .limit(isBrowse ? 200 : 30);
      if (q.trim()) query = query.ilike("name", `%${q.trim()}%`);
      if (day) query = query.eq("ppl_day", day);
      if (muscle) query = query.eq("primary_muscle", muscle);
      if (equipment) query = query.eq("equipment", equipment);
      const { data, error } = await query;
      if (error) throw error;
      return data as PickerExercise[];
    },
  });

  async function handleRowClick(ex: PickerExercise) {
    if (isBrowse) {
      setExpandedId((cur) => (cur === ex.id ? null : ex.id));
      return;
    }
    setBusyId(ex.id);
    await props.onPick!(ex);
    setBusyId(null);
    setQ("");
    setExpandedId(null);
  }

  const baseSelect =
    "h-9 px-2 rounded-md border bg-background text-xs flex-1 min-w-0 focus:outline-none focus:ring-2 focus:ring-ring";
  const activeSelect = "border-primary ring-2 ring-primary/30 text-primary bg-accent";
  const idleSelect = "border-input";
  const sel = (v: string) => `${baseSelect} ${v ? activeSelect : idleSelect}`;

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={isBrowse ? "Search exercises…" : "Add exercise…"}
        className="w-full h-12 px-3 rounded-md border border-input bg-background text-base focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="flex gap-2">
        <select value={day} onChange={(e) => setDay(e.target.value)} className={sel(day)}>
          <option value="">Any day</option>
          {facets?.days.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={muscle} onChange={(e) => setMuscle(e.target.value)} className={sel(muscle)}>
          <option value="">Any muscle</option>
          {facets?.muscles.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={equipment} onChange={(e) => setEquipment(e.target.value)} className={sel(equipment)}>
          <option value="">Any equipment</option>
          {facets?.equipments.map((eq) => <option key={eq} value={eq}>{eq}</option>)}
        </select>
      </div>

      {shouldQuery && (
        <ul className="rounded-md border border-border bg-card divide-y divide-border max-h-[70vh] overflow-auto">
          {(results ?? []).length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">No matches.</li>
          ) : (
            (results ?? []).map((ex) => {
              const open = expandedId === ex.id;
              const mc = muscleColors(ex.primary_muscle);
              const EqIcon = equipmentIcon(ex.equipment);
              return (
                <li key={ex.id}>
                  <div className="flex items-stretch">
                    <button
                      type="button"
                      onClick={() => handleRowClick(ex)}
                      disabled={busyId === ex.id}
                      className="flex-1 min-w-0 text-left px-3 py-2 hover:bg-muted disabled:opacity-50"
                    >
                      <div className="text-sm truncate">{ex.name}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        {ex.primary_muscle && (
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide"
                            style={{ backgroundColor: mc.bg, color: mc.fg }}
                          >
                            {ex.primary_muscle}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 truncate">
                          <EqIcon size={12} aria-hidden />
                          {ex.equipment ?? "—"}
                        </span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedId(open ? null : ex.id)}
                      aria-label={open ? "Hide details" : "Show details"}
                      className="px-3 text-xs text-muted-foreground hover:bg-muted border-l border-border"
                    >
                      {open ? "−" : "i"}
                    </button>
                  </div>
                  {open && (
                    <div className="px-3 py-2 bg-muted/40 text-xs space-y-1">
                      <div><span className="text-muted-foreground">Primary:</span> {ex.primary_muscle ?? "—"}</div>
                      <div><span className="text-muted-foreground">Secondary:</span> {ex.secondary_muscles || "—"}</div>
                      <div><span className="text-muted-foreground">Equipment:</span> {ex.equipment ?? "—"}</div>
                      {ex.description && (
                        <ol className="pt-1 list-decimal list-inside space-y-0.5">
                          {ex.description
                            .split(/\r?\n/)
                            .map((s) => s.trim())
                            .filter(Boolean)
                            .map((step, i) => (
                              <li key={i} className="leading-relaxed">{step}</li>
                            ))}
                        </ol>
                      )}
                    </div>
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
