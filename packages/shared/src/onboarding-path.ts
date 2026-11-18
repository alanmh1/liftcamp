// Which onboarding pages someone sees, in order (docs/onboarding-fork-spec.md,
// New page order). The pager renders only these, so a swipe can never land
// on a page from the other path. Pure; the mobile onboarding route renders it.

/** The logical pages. Every one but the welcome is also its `onboarding_page` event name. */
export type OnboardingPage = "welcome" | "fork" | "schedule" | "prefs" | "start" | "routines";

/** The answer to "Have you lifted before?". */
export type OnboardingFork = "new" | "experienced";

/** `onboarding_finished`'s `path`. */
export type OnboardingPathName = OnboardingFork | "returning";

export function onboardingPathName(returning: boolean, fork: OnboardingFork | null): OnboardingPathName | null {
  return returning ? "returning" : fork;
}

/**
 * The pages rendered now.
 *
 * - Returning (an account with finished workouts): schedule, prefs,
 *   routines. No welcome, fork or start page.
 * - Fork not answered: the welcome and the fork only, so nothing past the
 *   fork can be swiped to.
 * - New: welcome, fork, schedule, prefs, routines.
 * - Experienced: welcome, fork, schedule, start, and prefs and routines
 *   only once Pick a routine has been chosen.
 */
export function onboardingPages({
  returning,
  fork,
  pickRoutine,
}: {
  returning: boolean;
  fork: OnboardingFork | null;
  /** The start page's Pick a routine was tapped. */
  pickRoutine: boolean;
}): OnboardingPage[] {
  if (returning) return ["schedule", "prefs", "routines"];
  if (!fork) return ["welcome", "fork"];
  if (fork === "new") return ["welcome", "fork", "schedule", "prefs", "routines"];
  return pickRoutine
    ? ["welcome", "fork", "schedule", "start", "prefs", "routines"]
    : ["welcome", "fork", "schedule", "start"];
}

/**
 * How many dots to draw: the current path's length. Before the fork is
 * answered, and on the experienced path before its last choice, the dots
 * count the longest the path can still be, so they do not grow mid-flow
 * when a page is added.
 */
export function onboardingDotCount(args: Parameters<typeof onboardingPages>[0]): number {
  if (args.returning) return 3;
  if (!args.fork || args.fork === "new") return 5;
  return args.pickRoutine ? 6 : 4;
}

/** The level the fork answer saves to `training_level`. */
export function forkTrainingLevel(fork: OnboardingFork): "beginner" | "intermediate" {
  return fork === "new" ? "beginner" : "intermediate";
}
