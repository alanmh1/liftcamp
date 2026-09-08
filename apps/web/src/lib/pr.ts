import { oneRepMaxNumeric } from "@liftcamp/shared";
import { effectiveLoad } from "@liftcamp/shared";

type SetLike = {
  id: string;
  weight: string | null;
  weight_value?: number | null;
  reps: number | null;
  created_at?: string | null;
};

export function computePrSetIds(
  sets: SetLike[],
  exercise?: { weight_type?: string | null } | null,
  bodyweight?: number | null,
): Set<string> {
  const sorted = [...sets].sort((a, b) =>
    (a.created_at ?? "").localeCompare(b.created_at ?? ""),
  );
  let max = -Infinity;
  const prs = new Set<string>();
  for (const s of sorted) {
    const w = effectiveLoad(
      { weight: s.weight, weight_value: s.weight_value ?? null },
      exercise ?? null,
      bodyweight ?? null,
    );
    const orm = oneRepMaxNumeric(w, s.reps);
    if (orm == null) continue;
    if (orm > max) {
      prs.add(s.id);
      max = orm;
    }
  }
  return prs;
}
