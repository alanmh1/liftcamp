// Repeating a finished workout: what the new workout is called and which
// routine day it counts as.

/** A finished workout to repeat, as Home's Last workout card and the history detail have it. */
export type RepeatSource = {
  name: string | null;
  /** `workouts.template_id`. Missing on a Home cache written before Repeat carried it. */
  templateId?: string | null;
};

/**
 * The new workout's name and `template_id`. It keeps the source's routine
 * day, so Last time, the routine's targets and Next up treat it as that
 * day. A day with a delete still in the queue is dropped: the delete is
 * sent first and the workout's insert would then be refused for good
 * (23503), losing the workout.
 */
export function repeatStart(
  source: RepeatSource,
  removedTemplateIds: ReadonlySet<string>,
): { name: string; templateId: string | null } {
  const templateId = source.templateId ?? null;
  return {
    name: source.name?.trim() || "Workout",
    templateId: templateId && !removedTemplateIds.has(templateId) ? templateId : null,
  };
}
