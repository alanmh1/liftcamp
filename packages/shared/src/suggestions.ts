export type ColdStartSuggestion = {
  sets: number;
  reps: number;
  placeholder: string;
};

export function coldStartSuggestion(ex: {
  mechanic?: string | null;
  level?: string | null;
  equipment?: string | null;
}): ColdStartSuggestion {
  const equipment = (ex.equipment ?? "").trim().toLowerCase();
  const mechanic = (ex.mechanic ?? "").trim().toLowerCase();
  const level = (ex.level ?? "").trim().toLowerCase();

  if (equipment === "body only") {
    return { sets: 3, reps: 10, placeholder: "Bodyweight" };
  }
  if (mechanic === "isolation") {
    return { sets: 3, reps: 12, placeholder: "Moderate weight" };
  }
  if (mechanic === "compound") {
    if (level === "beginner") {
      return { sets: 3, reps: 10, placeholder: "Start light" };
    }
    if (level === "intermediate" || level === "advanced") {
      return { sets: 4, reps: 6, placeholder: "Work up to a challenging weight" };
    }
  }
  return { sets: 3, reps: 10, placeholder: "weight" };
}

/**
 * The generic starting-weight paragraph for an exercise with no beginner
 * note, by the same categories as `coldStartSuggestion`. The info sheet's
 * Starting weight section shows it. Null for cardio, which gets no section.
 */
export function coldStartAdvice(ex: {
  mechanic?: string | null;
  level?: string | null;
  equipment?: string | null;
  set_type?: string | null;
}): string | null {
  if ((ex.set_type ?? "").trim().toLowerCase() === "cardio") return null;
  const equipment = (ex.equipment ?? "").trim().toLowerCase();
  const mechanic = (ex.mechanic ?? "").trim().toLowerCase();
  const level = (ex.level ?? "").trim().toLowerCase();

  if (equipment === "body only") {
    return "Just your bodyweight. Log the reps you did.";
  }
  if (mechanic === "isolation") {
    return "Pick a weight you can do twelve clean reps with. If the last two feel easy, go up one step on the next set.";
  }
  if (mechanic === "compound" && (level === "intermediate" || level === "advanced")) {
    return "Work up over a couple of sets to a weight that makes six reps hard.";
  }
  return "Start with the empty bar or the lightest dumbbells, do the set, and add weight when ten reps feel easy. Light and clean beats heavy and sloppy on day one.";
}
