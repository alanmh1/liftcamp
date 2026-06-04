import { oneRepMax } from "./one-rep-max";

type SetLike = { id: string; weight: string; reps: number | null; created_at?: string | null };

export function computePrSetIds(sets: SetLike[]): Set<string> {
  const sorted = [...sets].sort((a, b) =>
    (a.created_at ?? "").localeCompare(b.created_at ?? ""),
  );
  let max = -Infinity;
  const prs = new Set<string>();
  for (const s of sorted) {
    const orm = oneRepMax(s.weight, s.reps);
    if (orm == null) continue;
    if (orm > max) {
      prs.add(s.id);
      max = orm;
    }
  }
  return prs;
}
