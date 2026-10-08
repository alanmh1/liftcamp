// Where a link into History, a workout, an exercise or the routines list
// goes, from the tab stack the link is in.
//
// Three tabs: Home, Workout, Profile. The Workout tab's routes live under
// `/train` (a `workout` folder would collide with the root `/workout/[id]`
// modal); History is pushed on Profile's stack. Every such link asks
// `navHref`, so the stack rules live in one place.

/** The tab stack a screen sits in. Null for a screen outside the tabs. */
export type TabStack = "home" | "train" | "profile" | null;

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

export function navHref(target: NavTarget, stack: TabStack): NavHref {
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
      return target.all
        ? { pathname: "/train/routines", params: { all: "1" } }
        : { pathname: "/train/routines" };
  }
}
