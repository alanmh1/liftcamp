import { describe, expect, it } from "vitest";

import { exerciseTabFromParam, navHref, type TabStack } from "./nav-targets";

const STACKS: TabStack[] = ["home", "train", "profile", null];

describe("navHref", () => {
  it("puts History on Profile", () => {
    expect(navHref({ kind: "history" }, "home")).toEqual({ pathname: "/profile/history" });
  });

  it("opens a workout in the stack it was tapped in when that stack has one", () => {
    expect(navHref({ kind: "workout", id: "w1" }, "train").pathname).toBe("/train/workout/[id]");
    expect(navHref({ kind: "workout", id: "w1" }, "profile").pathname).toBe("/profile/workout/[id]");
    // Home's last workout card.
    expect(navHref({ kind: "workout", id: "w1" }, "home")).toEqual({
      pathname: "/profile/workout/[id]",
      params: { id: "w1" },
    });
  });

  it("keeps a workout opened from an exercise on Home in Home's stack", () => {
    expect(navHref({ kind: "workout", id: "w1", inStack: true }, "home")).toEqual({
      pathname: "/session/[id]",
      params: { id: "w1" },
    });
    expect(navHref({ kind: "workout", id: "w1", inStack: true }, "train").pathname).toBe("/train/workout/[id]");
    expect(navHref({ kind: "workout", id: "w1", inStack: true }, "profile").pathname).toBe("/profile/workout/[id]");
  });

  it("opens an exercise in the stack it was tapped in, and on Workout outside the tabs", () => {
    expect(navHref({ kind: "exercise", id: "e1" }, "profile")).toEqual({
      pathname: "/profile/exercise/[id]",
      params: { id: "e1" },
    });
    expect(navHref({ kind: "exercise", id: "e1" }, "train").pathname).toBe("/train/exercise/[id]");
    expect(navHref({ kind: "exercise", id: "e1" }, "home").pathname).toBe("/exercise/[id]");
    expect(navHref({ kind: "exercise", id: "e1" }, null).pathname).toBe("/train/exercise/[id]");
  });

  it("opens an exercise over the workout at the root, with its tab", () => {
    expect(navHref({ kind: "exercise", id: "e1", tab: "history", overWorkout: true }, null)).toEqual({
      pathname: "/workout-exercise/[id]",
      params: { id: "e1", tab: "history" },
    });
  });

  it("carries an exercise's tab from every stack, and sends none by default", () => {
    for (const stack of STACKS) {
      expect(navHref({ kind: "exercise", id: "e1", tab: "history" }, stack).params).toEqual({
        id: "e1",
        tab: "history",
      });
      expect(navHref({ kind: "exercise", id: "e1" }, stack).params).toEqual({ id: "e1" });
    }
  });

  it("sends the exercise library to Workout from every stack", () => {
    for (const stack of STACKS) {
      expect(navHref({ kind: "exercises" }, stack)).toEqual({ pathname: "/train/exercises" });
    }
  });

  it("sends the routines list to Workout's program browser", () => {
    expect(navHref({ kind: "routines" }, "home")).toEqual({ pathname: "/train/routines" });
    expect(navHref({ kind: "routines", all: true }, "profile")).toEqual({
      pathname: "/train/routines",
      params: { all: "1" },
    });
  });

  it("sends Followers and Following to Profile's stack from every stack", () => {
    for (const stack of STACKS) {
      expect(navHref({ kind: "followers" }, stack)).toEqual({ pathname: "/profile/followers" });
      expect(navHref({ kind: "following" }, stack)).toEqual({ pathname: "/profile/following" });
    }
  });

  it("opens a routine on Home's stack from Home, otherwise on Workout", () => {
    expect(navHref({ kind: "routine", id: "t1" }, "home")).toEqual({
      pathname: "/routine/[id]",
      params: { id: "t1" },
    });
    expect(navHref({ kind: "routine", id: "t1" }, "train")).toEqual({
      pathname: "/train/routine/[id]",
      params: { id: "t1" },
    });
    expect(navHref({ kind: "starterRoutine", program: "PHUL" }, "home")).toEqual({
      pathname: "/program/[name]",
      params: { name: "PHUL" },
    });
    for (const stack of ["train", "profile", null] as const) {
      expect(navHref({ kind: "starterRoutine", program: "PHUL" }, stack)).toEqual({
        pathname: "/train/program/[name]",
        params: { name: "PHUL" },
      });
    }
  });

  it("only targets the Workout and Profile stacks, besides routines and exercises", () => {
    for (const stack of STACKS) {
      for (const kind of ["history", "workout", "exercises", "routines", "followers", "following"] as const) {
        const href = navHref(kind === "workout" ? { kind, id: "x" } : { kind }, stack);
        expect(href.pathname.startsWith("/train/") || href.pathname.startsWith("/profile/")).toBe(true);
      }
    }
  });
});

describe("exerciseTabFromParam", () => {
  it("opens on Summary without a param", () => {
    expect(exerciseTabFromParam(undefined)).toBe("summary");
  });

  it("takes the tabs it knows and falls back to Summary for anything else", () => {
    expect(exerciseTabFromParam("history")).toBe("history");
    expect(exerciseTabFromParam("howto")).toBe("howto");
    expect(exerciseTabFromParam("summary")).toBe("summary");
    expect(exerciseTabFromParam("nope")).toBe("summary");
    expect(exerciseTabFromParam(["history"])).toBe("summary");
  });
});
