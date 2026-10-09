import { describe, expect, it } from "vitest";

import { navHref, type TabStack } from "./nav-targets";

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

  it("opens an exercise on Profile from Profile, otherwise on Workout", () => {
    expect(navHref({ kind: "exercise", id: "e1" }, "profile")).toEqual({
      pathname: "/profile/exercise/[id]",
      params: { id: "e1" },
    });
    expect(navHref({ kind: "exercise", id: "e1" }, "train").pathname).toBe("/train/exercise/[id]");
    expect(navHref({ kind: "exercise", id: "e1" }, "home").pathname).toBe("/train/exercise/[id]");
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

  it("only targets the Workout and Profile stacks", () => {
    for (const stack of STACKS) {
      for (const kind of ["history", "workout", "exercise", "exercises", "routines"] as const) {
        const href = navHref(
          kind === "history" || kind === "exercises" || kind === "routines" ? { kind } : { kind, id: "x" },
          stack,
        );
        expect(href.pathname.startsWith("/train/") || href.pathname.startsWith("/profile/")).toBe(true);
      }
    }
  });
});
