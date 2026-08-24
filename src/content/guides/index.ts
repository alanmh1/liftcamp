import type { Guide, GuideMeta } from "./types";
import * as pickingYourStartingWeight from "./picking-your-starting-weight";
import * as beginnerFullBodyWorkout from "./beginner-full-body-workout";
import * as whatToDoWhenTheMachineIsTaken from "./what-to-do-when-the-machine-is-taken";
import * as benchPressHurtsShoulders from "./bench-press-hurts-shoulders";

/** Every guide, in display order. Adding one is two lines: an import and an
 *  entry. No loader, no database, no build step. */
const ALL: Guide[] = [
  // Order is display order. The first entry is the featured card on /guides,
  // so the widest-intent guide leads.
  { meta: beginnerFullBodyWorkout.meta, Body: beginnerFullBodyWorkout.Body },
  { meta: pickingYourStartingWeight.meta, Body: pickingYourStartingWeight.Body },
  { meta: whatToDoWhenTheMachineIsTaken.meta, Body: whatToDoWhenTheMachineIsTaken.Body },
];

/** Published guides only. Drafts still render at their own URL for preview but
 *  never appear on the hub, in the sitemap, or in related links -- same shape
 *  as the has_notes rule on exercise pages: one flag, one mechanism. */
export const GUIDES: Guide[] = ALL.filter((g) => !g.meta.draft);

export function getGuide(slug: string): Guide | undefined {
  return ALL.find((g) => g.meta.slug === slug);
}

export function guideMetas(): GuideMeta[] {
  return GUIDES.map((g) => g.meta);
}

/** Sitemap feed. Drafts excluded; unlike exercises there is no other condition,
 *  because a guide is authored by definition. */
export function publishedGuideSlugs(): string[] {
  return GUIDES.map((g) => g.meta.slug);
}
