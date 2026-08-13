import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { muscleColors, equipmentIcon, formatEquipmentLabel } from "@/lib/exercise-visuals";
import { CANONICAL_MUSCLES, muscleLabel, normalizeSearch } from "@/lib/muscle-vocab";
import { ExerciseInfo } from "@/components/ExerciseInfo";
import { ExerciseAnimation } from "@/components/ExerciseAnimation";

export type PickerExercise = {
  id: string;
  name: string;
  primary_muscle: string | null;
  all_primary_muscles?: string | null;
  secondary_muscles?: string | null;
  equipment?: string | null;
  ppl_day?: string | null;
  description?: string | null;
  image_url?: string | null;
  image_url_2?: string | null;
};

type Props =
  | { mode?: "pick"; onPick: (ex: PickerExercise) => void | Promise<void> }
  | { mode: "browse"; onPick?: never };

// Row cap per query. Previously 30 in pick mode, which silently truncated any
// filter matching more than 30 rows: selecting "quads" (147 rows) returned the
// first 30 by name and hid everything after, including Leg Extensions. The cap
// still exists to bound the payload, but the UI now says when it has been hit.
const ROW_LIMIT = 100;

export function ExercisePicker(props: Props) {
  const mode = props.mode ?? "pick";
  const isBrowse = mode === "browse";

  const [q, setQ] = useState("");
  const [day, setDay] = useState("");
  const [muscle, setMuscle] = useState("");
  const [equipment, setEquipment] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Equipment and day options are still derived from the catalog because their
  // vocabularies are open-ended. Muscle options are NOT: they come from the
  // canonical list, so a stray value in the data can never again appear as a
  // second, near-duplicate dropdown option.
  const { data: facets } = useQuery({
    queryKey: ["exercise-facets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercises")
        .select("equipment, ppl_day")
        .limit(2000);
      if (error) throw error;
      const equipments = new Set<string>();
      const days = new Set<string>();
      for (const r of data as { equipment: string | null; ppl_day: string | null }[]) {
        if (r.equipment) equipments.add(r.equipment);
        if (r.ppl_day) days.add(r.ppl_day);
      }
      return {
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
        .select(
          "id, name, primary_muscle, all_primary_muscles, secondary_muscles, equipment, ppl_day, description, image_url, image_url_2",
          { count: "exact" },
        )
        .order("name")
        .limit(ROW_LIMIT);
      // Match against search_text (the name, lowercased and punctuation-stripped)
      // OR alias_text (curated synonyms, same normalization, '|' separated).
      //
      // search_text alone handles "pull up" / "pull-up" finding "Pullups".
      // alias_text handles the cases where the stored name is simply a different
      // word from what people type -- free-exercise-db calls the chest fly
      // "Butterfly", so "chest fly", "pec deck" and "pec flyes" all miss without it.
      //
      // Aliases are declared in public.exercise_synonym_rules and materialized by
      // rebuild_exercise_aliases(); nothing here needs to change to add one.
      const nq = normalizeSearch(q);
      if (nq) {
        const pattern = `%${nq}%`;
        query = query.or(`search_text.ilike.${pattern},alias_text.ilike.${pattern}`);
      }
      if (day) query = query.eq("ppl_day", day);
      if (muscle) query = query.eq("primary_muscle", muscle);
      if (equipment) query = query.eq("equipment", equipment);
      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: data as PickerExercise[], total: count ?? data.length };
    },
  });

  const rows = results?.rows ?? [];
  const total = results?.total ?? 0;
  const truncated = total > rows.length;

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
          {CANONICAL_MUSCLES.map((m) => <option key={m} value={m}>{muscleLabel(m)}</option>)}
        </select>
        <select value={equipment} onChange={(e) => setEquipment(e.target.value)} className={sel(equipment)}>
          <option value="">Any equipment</option>
          {facets?.equipments.map((eq) => <option key={eq} value={eq}>{formatEquipmentLabel(eq)}</option>)}
        </select>
      </div>

      {shouldQuery && (
        <ul className="rounded-md border border-border bg-card divide-y divide-border max-h-[70vh] overflow-auto">
          {rows.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">No matches.</li>
          ) : (
            <>
              {rows.map((ex) => {
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
                        className="flex-1 min-w-0 text-left px-3 py-2 hover:bg-muted disabled:opacity-50 flex items-center gap-2.5"
                      >
                        <ExerciseAnimation
                          imageUrl={ex.image_url}
                          alt={ex.name}
                          animated={false}
                          loading="lazy"
                          className="w-12 shrink-0"
                          fallback={
                            <div className="w-12 shrink-0 aspect-[3/2] rounded-sm bg-muted flex items-center justify-center">
                              <EqIcon size={14} className="text-muted-foreground" aria-hidden />
                            </div>
                          }
                        />
                        <div className="min-w-0 flex-1">
                        <div className="text-sm truncate">{ex.name}</div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          {ex.primary_muscle && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide"
                              style={{ backgroundColor: mc.bg, color: mc.fg }}
                            >
                              {muscleLabel(ex.primary_muscle)}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 truncate">
                            <EqIcon size={12} aria-hidden />
                            {ex.equipment ? formatEquipmentLabel(ex.equipment) : "—"}
                          </span>
                        </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedId(open ? null : ex.id)}
                        aria-label={open ? "Hide details" : "Show details"}
                        className="px-3 text-xs text-muted-foreground hover:bg-muted border-l border-border"
                      >
                        {open ? "−" : <Info size={14} />}
                      </button>
                    </div>
                    {open && (
                      <div className="px-3 py-2 bg-muted/40">
                        <ExerciseInfo ex={ex} />
                      </div>
                    )}
                  </li>
                );
              })}
              {truncated && (
                <li className="px-3 py-2 text-xs text-muted-foreground bg-muted/40">
                  Showing {rows.length} of {total}. Type to narrow your search.
                </li>
              )}
            </>
          )}
        </ul>
      )}
    </div>
  );
}
