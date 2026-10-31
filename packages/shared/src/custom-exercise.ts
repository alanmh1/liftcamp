import type { CanonicalMuscle } from "./muscle-vocab";

/**
 * Custom exercises: a user's own rows in `exercises`, marked by `owner_id`.
 * The rules the sheet, the data layer and the Create row share. The
 * database contract is docs/custom-exercises.sql: the trigger there owns
 * the slug, the cap and the shape, so this file only has to send the
 * columns it reads and understand the errors it raises.
 */

/** How a custom exercise is logged. Fixed once it has a set (Hevy's rule). */
export type TrackType = "weighted" | "bodyweight" | "timed";

export const TRACK_TYPES: { key: TrackType; label: string }[] = [
  { key: "weighted", label: "Weight and reps" },
  { key: "bodyweight", label: "Bodyweight reps" },
  { key: "timed", label: "Time" },
];

/** The equipment values a custom exercise may carry (the catalog's check constraint). */
export const CUSTOM_EQUIPMENT = [
  "barbell",
  "dumbbell",
  "cable",
  "machine",
  "smith machine",
  "kettlebells",
  "e-z curl bar",
  "bands",
  "body only",
  "medicine ball",
  "exercise ball",
  "other",
] as const;

export type CustomExerciseDraft = {
  name: string;
  primaryMuscle: CanonicalMuscle | null;
  secondaryMuscles: CanonicalMuscle[];
  equipment: string | null;
  trackType: TrackType;
  unilateral: boolean;
};

export const EMPTY_DRAFT: CustomExerciseDraft = {
  name: "",
  primaryMuscle: null,
  secondaryMuscles: [],
  equipment: null,
  trackType: "weighted",
  unilateral: false,
};

export const CUSTOM_NAME_MIN = 2;
export const CUSTOM_NAME_MAX = 60;

/** The row columns the app sends. Everything else the trigger fills or nulls. */
export type CustomExerciseRow = {
  id: string;
  owner_id: string;
  name: string;
  primary_muscle: string;
  secondary_muscles: string | null;
  equipment: string | null;
  weight_type: "standard" | "bodyweight";
  set_type: "cardio" | null;
  is_unilateral: boolean;
  mechanic: "compound" | "isolation";
};

/** Collapses runs of whitespace and trims, the same as the trigger. */
export function tidyCustomName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/** Why a draft can't be saved yet, or null. */
export function draftProblem(d: CustomExerciseDraft): string | null {
  const name = tidyCustomName(d.name);
  if (name.length < CUSTOM_NAME_MIN) return "Give it a name.";
  if (name.length > CUSTOM_NAME_MAX) return `Keep the name under ${CUSTOM_NAME_MAX} characters.`;
  if (!d.primaryMuscle) return "Pick the main muscle it works.";
  return null;
}

export function trackTypeOf(row: { weight_type?: string | null; set_type?: string | null }): TrackType {
  if (row.set_type === "cardio") return "timed";
  if (row.weight_type === "bodyweight") return "bodyweight";
  return "weighted";
}

/** The insert or update body for a draft. `id` and `owner_id` come from the caller. */
export function draftToRow(d: CustomExerciseDraft, ids: { id: string; ownerId: string }): CustomExerciseRow {
  if (!d.primaryMuscle) throw new Error("draftToRow: primary muscle required");
  const secondaries = d.secondaryMuscles.filter((m) => m !== d.primaryMuscle);
  return {
    id: ids.id,
    owner_id: ids.ownerId,
    name: tidyCustomName(d.name),
    primary_muscle: d.primaryMuscle,
    secondary_muscles: secondaries.length > 0 ? secondaries.join("|") : null,
    equipment: d.equipment,
    weight_type: d.trackType === "bodyweight" ? "bodyweight" : "standard",
    set_type: d.trackType === "timed" ? "cardio" : null,
    is_unilateral: d.unilateral,
    mechanic: secondaries.length > 0 ? "compound" : "isolation",
  };
}

/** The draft an existing row edits from. */
export function rowToDraft(row: {
  name: string;
  primary_muscle: string | null;
  secondary_muscles: string | null;
  equipment: string | null;
  weight_type?: string | null;
  set_type?: string | null;
  is_unilateral: boolean;
}): CustomExerciseDraft {
  return {
    name: row.name,
    primaryMuscle: (row.primary_muscle as CanonicalMuscle | null) ?? null,
    secondaryMuscles: (row.secondary_muscles ?? "")
      .split("|")
      .map((s) => s.trim())
      .filter((s): s is CanonicalMuscle => s.length > 0),
    equipment: row.equipment,
    trackType: trackTypeOf(row),
    unilateral: row.is_unilateral,
  };
}

export type CustomExerciseStatus = {
  /** The flag is on for this user (signed up, not revoked, switch or grant). */
  enabled: boolean;
  pro: boolean;
  /** Live (not deleted) custom exercises they have. */
  used: number;
  /** The free cap. Pro ignores it. */
  limit: number;
};

/** Parses `custom_exercise_status()` (or its cached copy). Null for anything malformed. */
export function parseCustomExerciseStatus(raw: unknown): CustomExerciseStatus | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.enabled !== "boolean" || typeof r.pro !== "boolean") return null;
  if (typeof r.used !== "number" || typeof r.limit !== "number") return null;
  return { enabled: r.enabled, pro: r.pro, used: r.used, limit: r.limit };
}

/** Whether this user can create one more right now, by the app's own count. */
export function canCreateCustom(s: CustomExerciseStatus | null): boolean {
  if (!s || !s.enabled) return false;
  return s.pro || s.used < s.limit;
}

export type CustomExerciseError =
  | { kind: "off" }
  | { kind: "limit"; limit: number }
  | { kind: "invalid"; detail: string }
  | { kind: "offline" }
  | { kind: "unknown"; message: string };

/**
 * Reads the trigger's refusals (docs/custom-exercises.sql, section 4) out
 * of a PostgREST error. The message's first word is the kind; the limit
 * error carries the cap after the colon.
 */
export function classifyCustomExerciseError(err: { code?: string | null; message?: string | null } | null): CustomExerciseError {
  const message = err?.message ?? "";
  if (message.startsWith("custom_exercise_off")) return { kind: "off" };
  if (message.startsWith("custom_exercise_limit")) {
    const n = Number(message.split(":")[1]?.trim());
    return { kind: "limit", limit: Number.isFinite(n) ? n : 0 };
  }
  if (message.startsWith("custom_exercise_invalid")) {
    return { kind: "invalid", detail: message.split(":").slice(1).join(":").trim() };
  }
  if (!err || err.code === "" || /network|fetch|abort/i.test(message)) return { kind: "offline" };
  return { kind: "unknown", message };
}

/** The line the sheet shows for an error. */
export function customExerciseErrorCopy(e: CustomExerciseError): string {
  switch (e.kind) {
    case "off":
      return "Custom exercises are turned off right now.";
    case "limit":
      return `You've used your ${e.limit} free custom exercises.`;
    case "invalid":
      return e.detail ? `Couldn't save that. ${capitalise(e.detail)}.` : "Couldn't save that.";
    case "offline":
      return "You're offline. Try again when you have signal.";
    default:
      return "Couldn't save that. Try again.";
  }
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The Create row's meta line under the cap, or null for Pro. */
export function customUsageLine(s: CustomExerciseStatus): string | null {
  if (s.pro) return null;
  return `${s.used} of ${s.limit} used`;
}

export function isCustomExercise(e: { owner_id?: string | null }): boolean {
  return e.owner_id != null;
}
