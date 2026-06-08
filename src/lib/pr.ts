import { oneRepMaxNumeric } from "./one-rep-max";
import { numericWeight } from "./set-weight";

type SetLike = {
  id: string;
  weight: string | null;
  weight_value?: number | null;
  reps: number | null;
  created_at?: string | null;
};

export function computePrSetIds(sets: SetLike[]): Set<string> {
  const sorted = [...sets].sort((a, b) =>
    (a.created_at ?? "").localeCompare(b.created_at ?? ""),
  );
  let max = -Infinity;
  const prs = new Set<string>();
  for (const s of sorted) {
    const w = numericWeight({ weight: s.weight, weight_value: s.weight_value ?? null });
    const orm = oneRepMaxNumeric(w, s.reps);
    if (orm == null) continue;
    if (orm > max) {
      prs.add(s.id);
      max = orm;
    }
  }
  return prs;
}
