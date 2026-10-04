// Where a link into History, a workout, an exercise or the routines list
// goes, from the tab layout and the tab stack the link is in. The spec is
// docs/social-spec.md, "Links into hidden tabs".
//
// A hidden native tab cannot be navigated to at all, so no screen
// hard-codes a tab path: every such link asks `navHref`.
//
// Four tabs (no social flag): Home, History, Exercises, Profile, as today.
// Three tabs (social flag): Home, Workout, Profile. The Workout tab's
// routes live under `/train` (a `workout` folder would collide with the
// root `/workout/[id]` modal); History is pushed on Profile's stack.

import { tabsAtLaunch } from "./social";

/** Which tab bar this launch drew. See `tabsAtLaunch`. */
export type TabLayout = "three" | "four";

/**
 * The layout the tabs draw when they mount, or null while this user's
 * device cache is still being read (an AsyncStorage read, never
 * supabase-js). Signed out and guests have no social, so four tabs at
 * once. The tabs keep what they drew until they next mount.
 */
export function layoutAtMount(input: {
  userId: string | null;
  isGuest: boolean;
  /** The user whose cache the store has read, if any. */
  readFor: string | null;
  cached: boolean | null;
}): TabLayout | null {
  if (!input.userId || input.isGuest) return "four";
  if (input.readFor !== input.userId) return null;
  return tabsAtLaunch(input.cached);
}

/** The tab stack a screen sits in. Null for a screen outside the tabs. */
export type TabStack = "home" | "history" | "exercises" | "train" | "profile" | null;

export type NavTarget =
  /** The History list: the month calendar and every finished workout. */
  | { kind: "history" }
  /** One finished workout's detail. */
  | { kind: "workout"; id: string }
  /** One exercise's screen. */
  | { kind: "exercise"; id: string }
  /** The full program browser; `all` opens it with the filters clear. */
  | { kind: "routines"; all?: boolean };

export type NavHref = { pathname: string; params?: Record<string, string> };

export function navHref(target: NavTarget, layout: TabLayout, stack: TabStack): NavHref {
  if (layout === "four") {
    switch (target.kind) {
      case "history":
        return { pathname: "/history" };
      case "workout":
        // An exercise's sessions open the workout over the exercise, so
        // Back returns to it. Everything else opens it on History.
        return stack === "exercises"
          ? { pathname: "/exercises/workout/[id]", params: { id: target.id } }
          : { pathname: "/history/[id]", params: { id: target.id } };
      case "exercise":
        return { pathname: "/exercises/[id]", params: { id: target.id } };
      case "routines":
        return routines("/routines", target.all);
    }
  }

  switch (target.kind) {
    case "history":
      return { pathname: "/profile/history" };
    case "workout":
      // In the stack the link is in when that stack has the route: an
      // exercise opened from Workout keeps its workouts on Workout. Home's
      // last workout card and History's rows open on Profile, which holds
      // History.
      return stack === "train"
        ? { pathname: "/train/workout/[id]", params: { id: target.id } }
        : { pathname: "/profile/workout/[id]", params: { id: target.id } };
    case "exercise":
      // Profile's PR and strength rows open the exercise on Profile, so
      // Back returns there. Anywhere else, on Workout, where the library is.
      return stack === "profile"
        ? { pathname: "/profile/exercise/[id]", params: { id: target.id } }
        : { pathname: "/train/exercise/[id]", params: { id: target.id } };
    case "routines":
      return routines("/train/routines", target.all);
  }
}

function routines(pathname: string, all: boolean | undefined): NavHref {
  return all ? { pathname, params: { all: "1" } } : { pathname };
}
