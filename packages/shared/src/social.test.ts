import { describe, expect, it } from "vitest";

import {
  afterBlock,
  feedCursor,
  feedPrCount,
  feedVisible,
  filterFeed,
  followButton,
  hasUnseenKudos,
  inviteCodeFromUrl,
  inviteLink,
  kudosSeenKey,
  kudosSeenValue,
  normalizeInviteCode,
  parseSocialCache,
  pendingInviteValue,
  readPendingInvite,
  requestExpired,
  showFollowBack,
  socialAfterRead,
  socialCacheKey,
  socialCacheValue,
  socialFlagOn,
  socialInitials,
  splitFollows,
  socialAtMount,
  toggleKudos,
  waitingRequestCount,
  type FeedItem,
  type FollowRow,
} from "./social";

const NOW = Date.parse("2026-10-04T12:00:00Z");
const DAY = 86_400_000;
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

const ME = "me";
const WILL = "will";
const SAM = "sam";

function row(follower: string, followee: string, status: FollowRow["status"], requestedBy: string, ageDays = 1): FollowRow {
  return {
    follower_id: follower,
    followee_id: followee,
    other_id: follower === ME ? followee : follower,
    other_username: null,
    status,
    requested_by: requestedBy,
    created_at: iso(ageDays * DAY),
    accepted_at: status === "accepted" ? iso(ageDays * DAY) : null,
  };
}

describe("the flag", () => {
  it("is on with a grant or the global switch, for members only", () => {
    expect(socialFlagOn({ enabledForAll: false, state: "granted", member: true })).toBe(true);
    expect(socialFlagOn({ enabledForAll: true, state: null, member: true })).toBe(true);
    expect(socialFlagOn({ enabledForAll: false, state: null, member: true })).toBe(false);
    expect(socialFlagOn({ enabledForAll: true, state: "granted", member: false })).toBe(false);
  });

  it("lets a revoke win over a grant and the switch", () => {
    expect(socialFlagOn({ enabledForAll: true, state: "revoked", member: true })).toBe(false);
  });

  it("caches per user under the app prefix", () => {
    expect(socialCacheKey("u1")).toBe("liftcamp:social:u1");
    expect(parseSocialCache(socialCacheValue(true))).toBe(true);
    expect(parseSocialCache(socialCacheValue(false))).toBe(false);
    expect(parseSocialCache(null)).toBeNull();
    expect(parseSocialCache("yes")).toBeNull();
  });

  it("keeps the cached answer when the read fails, and is off with nothing cached", () => {
    expect(socialAfterRead({ ok: true, on: false }, true)).toBe(false);
    expect(socialAfterRead({ ok: false }, true)).toBe(true);
    expect(socialAfterRead({ ok: false }, null)).toBe(false);
  });
});

describe("socialAtMount", () => {
  it("is off at once when signed out or a guest", () => {
    expect(socialAtMount({ userId: null, isGuest: false, readFor: null, cached: null })).toBe(false);
    expect(socialAtMount({ userId: "u1", isGuest: true, readFor: null, cached: null })).toBe(false);
    expect(socialAtMount({ userId: "u1", isGuest: true, readFor: "u1", cached: true })).toBe(false);
  });

  it("waits for the user's own cache", () => {
    expect(socialAtMount({ userId: "u1", isGuest: false, readFor: null, cached: null })).toBeNull();
    expect(socialAtMount({ userId: "u1", isGuest: false, readFor: "u2", cached: true })).toBeNull();
  });

  it("takes the cached answer, off when there is none", () => {
    expect(socialAtMount({ userId: "u1", isGuest: false, readFor: "u1", cached: true })).toBe(true);
    expect(socialAtMount({ userId: "u1", isGuest: false, readFor: "u1", cached: false })).toBe(false);
    expect(socialAtMount({ userId: "u1", isGuest: false, readFor: "u1", cached: null })).toBe(false);
  });
});

describe("follows", () => {
  it("splits followers, following, requests waiting on me, and requests I sent", () => {
    const rows = [
      row(WILL, ME, "accepted", WILL),
      row(ME, WILL, "accepted", ME),
      row(SAM, ME, "pending", SAM), // Sam asks to follow me: mine to approve
      row(ME, "kim", "pending", ME), // I asked to follow Kim
      row("lee", ME, "pending", ME), // I let Lee follow me: Lee approves
      row(ME, "ana", "pending", "ana"), // Ana lets me follow her: mine to approve
    ];
    const lists = splitFollows(rows, ME, NOW);
    expect(lists.followers.map((r) => r.other_id)).toEqual([WILL]);
    expect(lists.following.map((r) => r.other_id)).toEqual([WILL]);
    expect(lists.requests.map((r) => r.other_id)).toEqual([SAM, "ana"]);
    expect(lists.sent.map((r) => r.other_id)).toEqual(["kim", "lee"]);
    expect(waitingRequestCount(rows, ME, NOW)).toBe(2);
  });

  it("drops pending requests past 30 days, never accepted follows", () => {
    expect(requestExpired(row(SAM, ME, "pending", SAM, 31), NOW)).toBe(true);
    expect(requestExpired(row(SAM, ME, "pending", SAM, 29), NOW)).toBe(false);
    expect(requestExpired(row(SAM, ME, "accepted", SAM, 400), NOW)).toBe(false);
    expect(splitFollows([row(SAM, ME, "pending", SAM, 31)], ME, NOW).requests).toEqual([]);
  });

  it("reads the button as Follow, Requested or Following", () => {
    expect(followButton([], ME, WILL, NOW)).toBe("follow");
    expect(followButton([row(ME, WILL, "pending", ME)], ME, WILL, NOW)).toBe("requested");
    expect(followButton([row(ME, WILL, "accepted", ME)], ME, WILL, NOW)).toBe("following");
    // Only my direction counts: Will following me is not me following Will.
    expect(followButton([row(WILL, ME, "accepted", WILL)], ME, WILL, NOW)).toBe("follow");
    expect(followButton([row(ME, WILL, "pending", ME, 31)], ME, WILL, NOW)).toBe("follow");
  });

  it("offers Follow back once they follow me and I have not asked", () => {
    expect(showFollowBack([row(WILL, ME, "accepted", WILL)], ME, WILL, NOW)).toBe(true);
    expect(showFollowBack([row(WILL, ME, "accepted", WILL), row(ME, WILL, "pending", ME)], ME, WILL, NOW)).toBe(false);
    expect(showFollowBack([row(WILL, ME, "pending", WILL)], ME, WILL, NOW)).toBe(false);
  });

  it("removes every follow between the two on a block, both directions, any state", () => {
    const rows = [
      row(ME, WILL, "accepted", ME),
      row(WILL, ME, "pending", WILL),
      row(ME, SAM, "accepted", ME),
    ];
    expect(afterBlock(rows, ME, WILL).map((r) => r.other_id)).toEqual([SAM]);
    expect(afterBlock(rows, WILL, ME).map((r) => r.other_id)).toEqual([SAM]);
  });
});

describe("kudos", () => {
  it("toggles on and off, never below zero", () => {
    expect(toggleKudos({ given: false, count: 2 })).toEqual({ given: true, count: 3 });
    expect(toggleKudos({ given: true, count: 3 })).toEqual({ given: false, count: 2 });
    expect(toggleKudos({ given: true, count: 0 })).toEqual({ given: false, count: 0 });
  });

  it("shows the unseen dot when the count rose since this device last showed it", () => {
    expect(kudosSeenKey("u1")).toBe("liftcamp:kudos-seen:u1");
    expect(hasUnseenKudos("w1", 0, null)).toBe(false);
    expect(hasUnseenKudos("w1", 1, null)).toBe(true);
    expect(hasUnseenKudos("w1", 2, kudosSeenValue("w1", 2))).toBe(false);
    expect(hasUnseenKudos("w1", 3, kudosSeenValue("w1", 2))).toBe(true);
    // A new last workout starts unseen.
    expect(hasUnseenKudos("w2", 1, kudosSeenValue("w1", 5))).toBe(true);
    expect(hasUnseenKudos("w1", 1, "not json")).toBe(true);
  });
});

describe("feed", () => {
  const ctx = { me: ME, now: NOW, following: new Set([WILL, SAM]), blocked: new Set<string>() };
  function item(over: Partial<FeedItem> = {}): FeedItem {
    return {
      workout_id: "w1",
      user_id: WILL,
      username: "will",
      name: "Push",
      workout_date: "2026-10-03",
      created_at: iso(DAY + 3_600_000),
      finished_at: iso(DAY),
      completed_sets: 12,
      pr_count: 2,
      kudos_count: 0,
      kudos_given: false,
      ...over,
    };
  }

  it("keeps a followed person's finished workout from the last 14 days", () => {
    expect(feedVisible(item(), ctx)).toBe(true);
  });

  it("leaves out my own, unfinished, old, empty, unfollowed and blocked workouts", () => {
    expect(feedVisible(item({ user_id: ME }), ctx)).toBe(false);
    expect(feedVisible(item({ finished_at: null }), ctx)).toBe(false);
    expect(feedVisible(item({ finished_at: iso(15 * DAY) }), ctx)).toBe(false);
    expect(feedVisible(item({ completed_sets: 0 }), ctx)).toBe(false);
    expect(feedVisible(item({ user_id: "kim" }), ctx)).toBe(false);
    expect(feedVisible(item(), { ...ctx, blocked: new Set([WILL]) })).toBe(false);
  });

  it("filters a held list after an unfollow, keeping order", () => {
    const items = [item({ workout_id: "a" }), item({ workout_id: "b", user_id: SAM }), item({ workout_id: "c" })];
    const after = filterFeed(items, { ...ctx, following: new Set([SAM]) });
    expect(after.map((i) => i.workout_id)).toEqual(["b"]);
  });

  it("hides the PR stat when pr_count was never written, and shows zero", () => {
    expect(feedPrCount({ pr_count: null })).toBeNull();
    expect(feedPrCount({ pr_count: 0 })).toBe(0);
    expect(feedPrCount({ pr_count: 3 })).toBe(3);
  });

  it("pages from the last item's finished_at", () => {
    expect(feedCursor([])).toBeNull();
    expect(feedCursor([item({ finished_at: "2026-10-03T10:00:00.000Z" }), item({ finished_at: "2026-10-02T10:00:00.000Z" })])).toBe(
      "2026-10-02T10:00:00.000Z",
    );
  });
});

describe("invite codes", () => {
  it("normalizes a typed code and refuses the confusable letters", () => {
    expect(normalizeInviteCode("abcd efgh")).toBe("ABCDEFGH");
    expect(normalizeInviteCode("ABCD-2345")).toBe("ABCD2345");
    expect(normalizeInviteCode("ABCDEFG")).toBeNull();
    expect(normalizeInviteCode("ABCDEFGO")).toBeNull();
    expect(normalizeInviteCode("ABCDEFG0")).toBeNull();
    expect(normalizeInviteCode("ABCDEFGI")).toBeNull();
    expect(normalizeInviteCode("ABCDEFG1")).toBeNull();
  });

  it("reads the code from the scheme link and the web link", () => {
    expect(inviteCodeFromUrl("liftcamp://invite/ABCD2345")).toBe("ABCD2345");
    expect(inviteCodeFromUrl("liftcamp://invite/abcd2345?x=1")).toBe("ABCD2345");
    expect(inviteCodeFromUrl(inviteLink("ABCD2345"))).toBe("ABCD2345");
    expect(inviteCodeFromUrl("https://www.liftcamp.app/i/ABCD2345")).toBe("ABCD2345");
    expect(inviteCodeFromUrl("https://evil.example/i/ABCD2345")).toBeNull();
    expect(inviteCodeFromUrl("liftcamp://progression-guide")).toBeNull();
  });

  it("keeps a saved invite for 7 days", () => {
    const saved = pendingInviteValue("ABCD2345", NOW);
    expect(readPendingInvite(saved, NOW + 6 * DAY)).toBe("ABCD2345");
    expect(readPendingInvite(saved, NOW + 8 * DAY)).toBeNull();
    expect(readPendingInvite(null, NOW)).toBeNull();
    expect(readPendingInvite("{}", NOW)).toBeNull();
    expect(readPendingInvite(pendingInviteValue("bad", NOW), NOW)).toBeNull();
  });
});

describe("initials", () => {
  it("takes up to two parts of the username", () => {
    expect(socialInitials("will_gaske")).toBe("WG");
    expect(socialInitials("lifter77915")).toBe("L");
    expect(socialInitials("alan")).toBe("A");
    expect(socialInitials("a_b_c")).toBe("AB");
    expect(socialInitials(null)).toBe("?");
    expect(socialInitials("")).toBe("?");
  });
});
