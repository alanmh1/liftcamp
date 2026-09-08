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
