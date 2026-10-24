// The browser's "Request a routine" row (docs/workout-tab-spec.md, Find a
// routine browser): an email to us with the filters already in it.

import {
  EQUIPMENT_ACCESS_LABELS,
  TRAINING_LEVEL_LABELS,
  type EquipmentAccess,
  type TrainingLevel,
} from "./templates";

export const ROUTINE_REQUEST_ADDRESS = "hello@liftcamp.app";

/** The request's body: the level and equipment picked ("Any" for none), then the line to finish. */
export function routineRequestBody(level: TrainingLevel | null, equipment: EquipmentAccess | null): string {
  return [
    `Experience · ${level ? TRAINING_LEVEL_LABELS[level] : "Any"}`,
    `Equipment · ${equipment ? EQUIPMENT_ACCESS_LABELS[equipment] : "Any"}`,
    "",
    "I'm looking for: ",
  ].join("\n");
}

/** The mailto URL for the request, subject "Routine request". */
export function routineRequestMailto(level: TrainingLevel | null, equipment: EquipmentAccess | null): string {
  const subject = encodeURIComponent("Routine request");
  const body = encodeURIComponent(routineRequestBody(level, equipment));
  return `mailto:${ROUTINE_REQUEST_ADDRESS}?subject=${subject}&body=${body}`;
}
