// Where a link into History, a workout, an exercise, a routine or the
// routines list goes, from the tab stack the link is in.
//
// Three tabs: Home, Workout, Profile. The Workout tab's routes live under
// `/train` (a `workout` folder would collide with the root `/workout/[id]`
// modal); History is pushed on Profile's stack. Every such link asks
// `navHref`, so the stack rules live in one place.

/** The tab stack a screen sits in. Null for a screen outside the tabs. */
export type TabStack = "home" | "train" | "profile" | null;

/** The exercise screen's segments. */
export type ExerciseTab = "summary" | "history" | "howto";

export type NavTarget =
  /** The History list: the month calendar and every finished workout. */
  | { kind: "history" }
  /**
   * One finished workout's detail. `inStack` keeps it in Home's stack, for
   * a link from a screen pushed there, so Back returns to that screen.
   */
  | { kind: "workout"; id: string; inStack?: boolean }
  /**
   * One exercise's screen, opened on `tab`, Summary when left out.
   * `overWorkout` opens it over the running workout, at the root, since
   * the tab stacks sit under the workout modal.
   */
  | { kind: "exercise"; id: string; tab?: ExerciseTab; overWorkout?: boolean }
  /** The exercise library: search and the Muscle, Equipment, Level and Yours filters. */
  | { kind: "exercises" }
  /** The full program browser; `all` opens it with the filters clear. */
  | { kind: "routines"; all?: boolean }
  /** One of the user's saved routine days, by template id. */
  | { kind: "routine"; id: string }
  /** A starter routine, by its program name. */
  | { kind: "starterRoutine"; program: string }
  /** Profile's Followers list, with requests waiting on me at the top. */
  | { kind: "followers" }
  /** Profile's Following list, with the invite actions. */
  | { kind: "following" };

export type NavHref = { pathname: string; params?: Record<string, string> };

/** The segment an exercise screen opens on, from its `tab` param. */
export function exerciseTabFromParam(param: string | string[] | undefined): ExerciseTab {
  return param === "history" || param === "howto" ? param : "summary";
}

export function navHref(target: NavTarget, stack: TabStack): NavHref {
  switch (target.kind) {
    case "history":
      return { pathname: "/profile/history" };
    case "workout":
      // In the stack the link is in when that stack has the route: an
      // exercise opened from Workout keeps its workouts on Workout. Home's
      // last workout card and History's rows open on Profile, which holds
      // History. An exercise pushed on Home keeps its workouts on Home, at
      // `/session` because `/workout/[id]` is the root modal.
      if (stack === "home" && target.inStack) {
        return { pathname: "/session/[id]", params: { id: target.id } };
      }
      return stack === "train"
        ? { pathname: "/train/workout/[id]", params: { id: target.id } }
        : { pathname: "/profile/workout/[id]", params: { id: target.id } };
    case "exercise": {
      // In the stack the link is in, so Back returns to where it was tapped.
      // Outside the tabs, on Workout, where the library is.
      const pathname = target.overWorkout
        ? "/workout-exercise/[id]"
        : stack === "profile"
          ? "/profile/exercise/[id]"
          : stack === "home"
            ? "/exercise/[id]"
            : "/train/exercise/[id]";
      return { pathname, params: { id: target.id, ...(target.tab ? { tab: target.tab } : {}) } };
    }
    case "exercises":
      // Only Workout's stack has the library.
      return { pathname: "/train/exercises" };
    case "routines":
      return target.all
        ? { pathname: "/train/routines", params: { all: "1" } }
        : { pathname: "/train/routines" };
    case "routine":
      // Home and Workout each push it on their own stack, so Back returns
      // to the card it was opened from. Profile has no routine links.
      return stack === "home"
        ? { pathname: "/routine/[id]", params: { id: target.id } }
        : { pathname: "/train/routine/[id]", params: { id: target.id } };
    case "starterRoutine":
      return stack === "home"
        ? { pathname: "/program/[name]", params: { name: target.program } }
        : { pathname: "/train/program/[name]", params: { name: target.program } };
    case "followers":
      return { pathname: "/profile/followers" };
    case "following":
      return { pathname: "/profile/following" };
  }
}
