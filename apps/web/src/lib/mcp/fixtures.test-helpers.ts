import type { TemplateRow } from "@liftcamp/shared";
import type { Catalog, ExerciseDetail, ExerciseNote, IndexExercise } from "./catalog";

let n = 0;
export function ex(name: string, extra: Partial<IndexExercise> = {}): IndexExercise {
  n += 1;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return {
    id: `e${n}`,
    slug,
    name,
    equipment: "barbell",
    level: "beginner",
    mechanic: "compound",
    primary_muscle: "chest",
    alias_text: null,
    search_all: name.toLowerCase().replace(/[^a-z0-9]+/g, ""),
    has_notes: false,
    ...extra,
  };
}

export function day(
  program: string,
  slug: string,
  name: string,
  facts: { level: string; equipment: string; days: number; order: number; position: number },
  exercises: [string, number | null, string | null][],
): TemplateRow {
  n += 1;
  return {
    id: `t${n}`,
    name,
    is_system: true,
    program,
    program_slug: slug,
    program_blurb: `${program} blurb.`,
    program_order: facts.order,
    position: facts.position,
    level: facts.level,
    equipment: facts.equipment,
    days_per_week: facts.days,
    template_exercises: exercises.map(([exName, sets, reps], i) => ({
      exercise_id: `${slug}-${i}`,
      position: exercises.length - i, // stored out of order on purpose
      target_sets: sets,
      target_reps: reps,
      exercises: { name: exName, equipment: "dumbbell", primary_muscle: "chest" },
    })),
  };
}

export function fakeCatalog(
  index: IndexExercise[],
  opts: {
    routines?: TemplateRow[];
    details?: Record<string, Partial<ExerciseDetail>>;
    notes?: Record<string, ExerciseNote>;
  } = {},
): Catalog {
  return {
    routineRows: async () => opts.routines ?? [],
    exerciseIndex: async () => index,
    exerciseDetail: async (id) => {
      const row = index.find((e) => e.id === id);
      if (!row) return null;
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        primary_muscle: row.primary_muscle,
        all_primary_muscles: row.primary_muscle,
        secondary_muscles: null,
        equipment: row.equipment,
        level: row.level,
        description: `Do the ${row.name}.`,
        image_url: `https://img.test/${row.slug}.jpg`,
        ...opts.details?.[id],
      };
    },
    beginnerNote: async (id) => opts.notes?.[id] ?? null,
  };
}
