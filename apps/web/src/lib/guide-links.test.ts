import { describe, expect, it } from "vitest";
import { AUTHORED_SLUGS, LINKABLE_SLUGS } from "@/components/guides/ExerciseLink";
import { guideLinkProblems } from "./guide-links";

describe("guideLinkProblems", () => {
  const rows = [
    { slug: "a", has_notes: true },
    { slug: "b", has_notes: true },
    { slug: "c", has_notes: false },
  ];

  it("passes when authored is every noted slug and linkable has none", () => {
    expect(guideLinkProblems(rows, ["a", "b"], ["c"])).toEqual([]);
  });

  it("flags an authored slug without notes, a missing one, and a noted one left out", () => {
    expect(guideLinkProblems(rows, ["a", "c", "z"], [])).toEqual([
      "AUTHORED_SLUGS: c has no beginner_notes row",
      "AUTHORED_SLUGS: z is not in the catalog",
      "AUTHORED_SLUGS: missing b, which has notes",
    ]);
  });

  it("flags a linkable slug that gained notes", () => {
    expect(guideLinkProblems(rows, ["a", "b"], ["b"])).toEqual([
      "LINKABLE_SLUGS: b now has notes, move it to AUTHORED_SLUGS",
    ]);
  });

  it("flags an unsorted authored list", () => {
    expect(guideLinkProblems(rows, ["b", "a"], [])).toEqual(["AUTHORED_SLUGS is not sorted"]);
  });
});

describe("the lists in ExerciseLink", () => {
  it("are sorted, unique and disjoint", () => {
    expect([...AUTHORED_SLUGS]).toEqual([...AUTHORED_SLUGS].sort());
    expect(new Set(AUTHORED_SLUGS).size).toBe(AUTHORED_SLUGS.length);
    const authored = new Set<string>(AUTHORED_SLUGS);
    expect(LINKABLE_SLUGS.filter((s) => authored.has(s))).toEqual([]);
  });
});
