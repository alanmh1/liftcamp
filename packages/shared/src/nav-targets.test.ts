import { describe, expect, it } from "vitest";

import { layoutAtMount, navHref, type TabStack } from "./nav-targets";

const STACKS: TabStack[] = ["home", "history", "exercises", "train", "profile", null];

describe("navHref, four tabs", () => {
  it("keeps today's paths", () => {
    expect(navHref({ kind: "history" }, "four", "home")).toEqual({ pathname: "/history" });
    expect(navHref({ kind: "workout", id: "w1" }, "four", "home")).toEqual({
      pathname: "/history/[id]",
      params: { id: "w1" },
    });
    expect(navHref({ kind: "workout", id: "w1" }, "four", "history")).toEqual({
      pathname: "/history/[id]",
      params: { id: "w1" },
    });
    expect(navHref({ kind: "exercise", id: "e1" }, "four", "profile")).toEqual({
      pathname: "/exercises/[id]",
      params: { id: "e1" },
    });
    expect(navHref({ kind: "routines" }, "four", "profile")).toEqual({ pathname: "/routines" });
    expect(navHref({ kind: "routines", all: true }, "four", "home")).toEqual({
      pathname: "/routines",
      params: { all: "1" },
    });
  });

  it("opens a workout from an exercise over the exercise", () => {
    expect(navHref({ kind: "workout", id: "w1" }, "four", "exercises")).toEqual({
      pathname: "/exercises/workout/[id]",
      params: { id: "w1" },
    });
  });

  it("never targets the Workout tab or Profile's pushed routes", () => {
    for (const stack of STACKS) {
      for (const kind of ["history", "workout", "exercise", "routines"] as const) {
        const href = navHref(kind === "history" || kind === "routines" ? { kind } : { kind, id: "x" }, "four", stack);
        expect(href.pathname.startsWith("/train")).toBe(false);
        expect(href.pathname.startsWith("/profile")).toBe(false);
      }
    }
  });
});

describe("navHref, three tabs", () => {
  it("puts History on Profile", () => {
    expect(navHref({ kind: "history" }, "three", "home")).toEqual({ pathname: "/profile/history" });
  });

  it("opens a workout in the stack it was tapped in when that stack has one", () => {
    expect(navHref({ kind: "workout", id: "w1" }, "three", "train").pathname).toBe("/train/workout/[id]");
    expect(navHref({ kind: "workout", id: "w1" }, "three", "profile").pathname).toBe("/profile/workout/[id]");
    // Home's last workout card.
    expect(navHref({ kind: "workout", id: "w1" }, "three", "home")).toEqual({
      pathname: "/profile/workout/[id]",
      params: { id: "w1" },
    });
  });

  it("opens an exercise on Profile from Profile, otherwise on Workout", () => {
    expect(navHref({ kind: "exercise", id: "e1" }, "three", "profile")).toEqual({
      pathname: "/profile/exercise/[id]",
      params: { id: "e1" },
    });
    expect(navHref({ kind: "exercise", id: "e1" }, "three", "train").pathname).toBe("/train/exercise/[id]");
    expect(navHref({ kind: "exercise", id: "e1" }, "three", "home").pathname).toBe("/train/exercise/[id]");
  });

  it("sends the routines list to Workout's program browser", () => {
    expect(navHref({ kind: "routines" }, "three", "home")).toEqual({ pathname: "/train/routines" });
    expect(navHref({ kind: "routines", all: true }, "three", "profile")).toEqual({
      pathname: "/train/routines",
      params: { all: "1" },
    });
  });

  it("never targets the hidden History or Exercises tabs", () => {
    for (const stack of STACKS) {
      for (const kind of ["history", "workout", "exercise", "routines"] as const) {
        const href = navHref(kind === "history" || kind === "routines" ? { kind } : { kind, id: "x" }, "three", stack);
        expect(href.pathname.startsWith("/history")).toBe(false);
        expect(href.pathname.startsWith("/exercises")).toBe(false);
        // Home's routines route is in a visible tab, but the spec moves it.
        expect(href.pathname).not.toBe("/routines");
      }
    }
  });
});

describe("layoutAtMount", () => {
  it("draws four tabs at once when signed out or a guest", () => {
    expect(layoutAtMount({ userId: null, isGuest: false, readFor: null, cached: null })).toBe("four");
    expect(layoutAtMount({ userId: "u1", isGuest: true, readFor: null, cached: null })).toBe("four");
    expect(layoutAtMount({ userId: "u1", isGuest: true, readFor: "u1", cached: true })).toBe("four");
  });

  it("waits for the user's own cache", () => {
    expect(layoutAtMount({ userId: "u1", isGuest: false, readFor: null, cached: null })).toBeNull();
    expect(layoutAtMount({ userId: "u1", isGuest: false, readFor: "u2", cached: true })).toBeNull();
  });

  it("takes the cached answer, four when there is none", () => {
    expect(layoutAtMount({ userId: "u1", isGuest: false, readFor: "u1", cached: true })).toBe("three");
    expect(layoutAtMount({ userId: "u1", isGuest: false, readFor: "u1", cached: false })).toBe("four");
    expect(layoutAtMount({ userId: "u1", isGuest: false, readFor: "u1", cached: null })).toBe("four");
  });
});
