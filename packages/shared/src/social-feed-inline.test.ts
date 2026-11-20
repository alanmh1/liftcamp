import { describe, expect, it } from "vitest";

import { likedBy, readLikers, type Liker } from "./social";
import { readRecentComments, viewAllCommentsLine } from "./social-comments";

const will: Liker = { user_id: "u-will", username: "will" };
const ann: Liker = { user_id: "u-ann", username: "ann" };
const bo: Liker = { user_id: "u-bo", username: "bo" };

const text = (s: { given: boolean; count: number }, likers: Liker[]) => likedBy(s, likers)?.label ?? null;

describe("likedBy", () => {
  it("hides the line with no kudos", () => {
    expect(likedBy({ given: false, count: 0 }, [])).toBeNull();
    expect(likedBy({ given: false, count: 0 }, [will])).toBeNull();
  });

  it("names the viewer when they gave kudos", () => {
    expect(text({ given: true, count: 1 }, [])).toBe("Liked by you");
    expect(text({ given: true, count: 2 }, [will])).toBe("Liked by you and @will");
    expect(text({ given: true, count: 4 }, [will, ann, bo])).toBe("Liked by you and 3 others");
    // One other nobody may name.
    expect(text({ given: true, count: 2 }, [])).toBe("Liked by you and 1 other");
  });

  it("names the newest liker otherwise, with the rest counted", () => {
    expect(text({ given: false, count: 1 }, [will])).toBe("Liked by @will");
    expect(text({ given: false, count: 2 }, [will, ann])).toBe("Liked by @will and 1 other");
    expect(text({ given: false, count: 4 }, [will, ann, bo])).toBe("Liked by @will and 3 others");
  });

  it("counts people when none can be named", () => {
    expect(text({ given: false, count: 1 }, [])).toBe("Liked by 1 person");
    expect(text({ given: false, count: 3 }, [])).toBe("Liked by 3 people");
  });

  it("bolds usernames only", () => {
    const line = likedBy({ given: true, count: 2 }, [will])!;
    expect(line.parts.filter((p) => p.bold).map((p) => p.text)).toEqual(["@will"]);
    const theirs = likedBy({ given: false, count: 5 }, [will])!;
    expect(theirs.parts.filter((p) => p.bold).map((p) => p.text)).toEqual(["@will"]);
  });

  it("shows up to 3 avatars, the viewer's first when they gave kudos", () => {
    expect(likedBy({ given: true, count: 4 }, [will, ann, bo])).toMatchObject({ you: true, avatars: [will, ann] });
    expect(likedBy({ given: false, count: 4 }, [will, ann, bo])).toMatchObject({ you: false, avatars: [will, ann, bo] });
  });

  it("changes at once with the tap", () => {
    // Read: someone else liked it. Tap: the viewer joins.
    expect(text({ given: false, count: 1 }, [will])).toBe("Liked by @will");
    expect(text({ given: true, count: 2 }, [will])).toBe("Liked by you and @will");
    // Taking it back on a workout only the viewer liked hides the line.
    expect(likedBy({ given: false, count: 0 }, [])).toBeNull();
  });
});

describe("readLikers", () => {
  it("keeps valid rows, at most 3", () => {
    expect(readLikers({ likers: [will, { username: "x" }, null, ann, bo, { user_id: "u-4", username: "d" }] })).toEqual([
      will,
      ann,
      bo,
    ]);
    expect(readLikers({ likers: [{ user_id: "u", username: 5 }] })).toEqual([{ user_id: "u", username: null }]);
  });

  it("reads missing or odd values as none", () => {
    expect(readLikers({})).toEqual([]);
    expect(readLikers({ likers: "nope" })).toEqual([]);
  });
});

describe("readRecentComments", () => {
  const row = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    user_id: "u1",
    username: "will",
    body: "Nice",
    created_at: "2026-11-20T10:00:00Z",
    mine: false,
    ...extra,
  });

  it("keeps valid rows in order, the last 2", () => {
    expect(readRecentComments({ recent_comments: [row("a"), row("b")] }).map((c) => c.id)).toEqual(["a", "b"]);
    expect(readRecentComments({ recent_comments: [row("a"), row("b"), row("c")] }).map((c) => c.id)).toEqual(["b", "c"]);
  });

  it("drops rows missing what the card draws", () => {
    expect(readRecentComments({ recent_comments: [row("a", { body: null }), row("b", { user_id: 1 }), row("c")] })).toHaveLength(1);
  });

  it("reads mine and a missing username", () => {
    const [c] = readRecentComments({ recent_comments: [row("a", { mine: true, username: null })] });
    expect(c.mine).toBe(true);
    expect(c.username).toBeNull();
  });

  it("reads missing or odd values as none", () => {
    expect(readRecentComments({})).toEqual([]);
    expect(readRecentComments({ recent_comments: {} })).toEqual([]);
  });
});

describe("viewAllCommentsLine", () => {
  it("shows only past the 2 the card shows", () => {
    expect(viewAllCommentsLine(0)).toBeNull();
    expect(viewAllCommentsLine(2)).toBeNull();
    expect(viewAllCommentsLine(3)).toBe("View all 3 comments");
  });
});
