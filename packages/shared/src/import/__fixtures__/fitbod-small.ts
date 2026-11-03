/**
 * A hand-made Fitbod export, no real user data. Newest session first, the
 * way Fitbod writes it. What each session tests:
 *
 * - 30 Oct 18:00 UTC: a warm-up, dumbbell rows with multiplier 2, a long kg
 *   decimal and leading spaces, a quoted note with a comma, a treadmill row
 *   with incline 6 and one at 60 (capped to 50), a plank hold.
 * - 30 Oct 08:00 UTC: a second session the same day. Dumbbell split squats
 *   with multiplier 4, bodyweight push-ups at 0 kg.
 * - 28 Oct: only "Mystery Move", which is skipped, so the session empties.
 * - 27 Oct: a date already logged in LiftCamp.
 * - 26 Oct: a start already imported.
 */
export const FITBOD_SMALL = [
  "Date,Exercise,Reps,Weight(kg),Duration(s),Distance(m),Incline,Resistance,isWarmup,Note,multiplier",
  "2026-10-30 18:00:00 +0000,Dumbbell Bench Press, 10, 10.0,0,0,0,,true,,2",
  '2026-10-30 18:00:00 +0000,Dumbbell Bench Press, 8, 22.679618500000001,0,0,0,,false,"Felt strong, add weight",2',
  "2026-10-30 18:00:00 +0000,Dumbbell Bench Press, 8, 22.679618500000001,0,0,0,,false,,2",
  "2026-10-30 18:00:00 +0000,Running - Treadmill,0,0,600,1500.0, 6.0,,false,,0",
  "2026-10-30 18:00:00 +0000,Running - Treadmill,0,0,300,700,60,,false,,0",
  "2026-10-30 18:00:00 +0000,Plank,0,0,60,0,0,,false,,0",
  "2026-10-30 08:00:00 +0000,Dumbbell Bulgarian Split Squat, 10, 12.5,0,0,0,,false,,4",
  "2026-10-30 08:00:00 +0000,Push Up, 15, 0,0,0,0,,false,,1",
  "2026-10-30 08:00:00 +0000,Dumbbell Bulgarian Split Squat, 10, 12.5,0,0,0,,false,,4",
  "2026-10-28 10:00:00 +0000,Mystery Move, 12, 20,0,0,0,,false,,1",
  "2026-10-28 10:00:00 +0000,Mystery Move, 12, 20,0,0,0,,false,,1",
  "2026-10-27 10:00:00 +0000,Dumbbell Bench Press, 8, 20,0,0,0,,false,,2",
  "2026-10-26 10:00:00 +0000,Push Up, 12, 0,0,0,0,,false,,1",
  "",
].join("\r\n");

export const CATALOG = [
  { id: "db-bench", name: "Dumbbell Bench Press", weight_type: "standard", set_type: null, has_incline: false, alias_text: null },
  { id: "treadmill", name: "Treadmill Run", weight_type: "standard", set_type: "cardio", has_incline: true, alias_text: "treadmill" },
  { id: "plank", name: "Plank Hold", weight_type: "standard", set_type: null, has_incline: false, alias_text: "plank" },
  {
    id: "bss",
    name: "Bulgarian Split Squat",
    weight_type: "standard",
    set_type: null,
    has_incline: false,
    alias_text: "splitsquat|dumbbellbulgariansplitsquat",
  },
  { id: "pushup", name: "Push-Up", weight_type: "bodyweight", set_type: null, has_incline: false, alias_text: "pressup" },
];

export const MAP = [
  { source_name: "Running - Treadmill", exercise_id: "treadmill", close: false },
  { source_name: "Plank", exercise_id: "plank", close: true },
  { source_name: "Gone Exercise", exercise_id: "not-in-catalog", close: false },
];
