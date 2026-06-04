// 1RM helpers using Epley formula: 1RM = weight * (1 + reps/30)
export function parseWeight(weight: string | null | undefined): number | null {
  if (!weight) return null;
  const m = weight.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number.parseFloat(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function oneRepMax(weight: string | null | undefined, reps: number | null | undefined): number | null {
  const w = parseWeight(weight);
  if (w == null || reps == null || reps <= 0) return null;
  return w * (1 + reps / 30);
}
