import { describe, expect, it } from "vitest";

import {
  afterBlock,
  afterInviteRequest,
  inviteAction,
  inviteCodeFromPath,
  inviteMessage,
  inviteScreenState,
  pendingInviteStep,
  type InvitePreview,
  feedCursor,
  feedVisible,
  filterFeed,
  followButton,
  inviteCodeFromUrl,
  inviteLink,
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
  appendFeedPage,
  cardExercises,
  feedNote,
  feedVolume,
  hasUnseenInbox,
  inboxItems,
  inboxLine,
  inboxSeenKey,
  inboxSeenValue,
  moreExercisesLine,
  setCountLabel,
  canInteract,
  parseInboxSeen,
  socialHandle,
  timeAgo,
  withKudos,
  type FeedItem,
  type KudosInboxRow,
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

});

describe("feed", () => {
  const ctx = { me: ME, now: NOW, following: new Set([WILL, SAM]), blocked: new Set<string>() };
  function item(over: Partial<FeedItem> = {}): FeedItem {
    return {
      workout_id: "w1",
      user_id: WILL,
      username: "will",
      name: "Push",
      note: null,
      workout_date: "2026-10-03",
      created_at: iso(DAY + 3_600_000),
      finished_at: iso(DAY),
      completed_sets: 12,
      volume: 1000,
      volume_unit: "kg",
      pr_count: 2,
      exercises: [],
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

  it("pages from the last item's finished_at and id", () => {
    expect(feedCursor([])).toBeNull();
    expect(
      feedCursor([
        item({ workout_id: "a", finished_at: "2026-10-03T10:00:00.000Z" }),
        item({ workout_id: "b", finished_at: "2026-10-02T10:00:00.000Z" }),
      ]),
    ).toEqual({ before: "2026-10-02T10:00:00.000Z", beforeId: "b" });
  });

  it("appends a page without repeating a workout already held", () => {
    const held = [item({ workout_id: "a" }), item({ workout_id: "b" })];
    const page = [item({ workout_id: "b" }), item({ workout_id: "c" })];
    expect(appendFeedPage(held, page).map((i) => i.workout_id)).toEqual(["a", "b", "c"]);
  });

  it("puts a kudos state on one item only", () => {
    const items = [item({ workout_id: "a" }), item({ workout_id: "b" })];
    const after = withKudos(items, "b", { given: true, count: 4 });
    expect(after.map((i) => [i.kudos_given, i.kudos_count])).toEqual([
      [false, 0],
      [true, 4],
    ]);
  });

  it("shows the owner's volume in the viewer's unit, and hides it when never written", () => {
    expect(feedVolume({ volume: 100, volume_unit: "kg" }, "kg")).toBe(100);
    expect(feedVolume({ volume: 100, volume_unit: "kg" }, "lb")).toBeCloseTo(220.462, 2);
    expect(feedVolume({ volume: 220.462, volume_unit: "lb" }, "kg")).toBeCloseTo(100, 2);
    expect(feedVolume({ volume: null, volume_unit: null }, "lb")).toBeNull();
  });

  it("lists five exercises, then how many more", () => {
    expect(cardExercises([1, 2, 3])).toEqual({ shown: [1, 2, 3], more: 0 });
    expect(cardExercises([1, 2, 3, 4, 5])).toEqual({ shown: [1, 2, 3, 4, 5], more: 0 });
    expect(cardExercises([1, 2, 3, 4, 5, 6, 7, 8])).toEqual({ shown: [1, 2, 3, 4, 5], more: 3 });
    expect(moreExercisesLine(3)).toBe("+3 more exercises");
    expect(moreExercisesLine(1)).toBe("+1 more exercise");
    expect(moreExercisesLine(0)).toBeNull();
    expect(setCountLabel(4)).toBe("4 sets");
    expect(setCountLabel(1)).toBe("1 set");
  });

  it("lets the viewer like unless the server says there is no mutual follow", () => {
    expect(canInteract({ can_interact: true })).toBe(true);
    expect(canInteract({ can_interact: false })).toBe(false);
    // Before docs/social-safety.sql runs the field is missing.
    expect(canInteract({})).toBe(true);
  });

  it("leaves out an empty note", () => {
    expect(feedNote(null)).toBeNull();
    expect(feedNote("   ")).toBeNull();
    expect(feedNote("  Felt strong. ")).toBe("Felt strong.");
  });
});

describe("time ago", () => {
  // Local times, so the day boundaries are the device's.
  const now = new Date(2026, 9, 10, 15, 0).getTime(); // Sat 10 Oct 2026, 3 PM
  const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m, d, h, min).toISOString();

  it("reads minutes and hours today", () => {
    expect(timeAgo(at(2026, 9, 10, 14, 59, ), now)).toBe("1m");
    expect(timeAgo(new Date(now - 20_000).toISOString(), now)).toBe("now");
    expect(timeAgo(at(2026, 9, 10, 14, 15), now)).toBe("45m");
    expect(timeAgo(at(2026, 9, 10, 9, 0), now)).toBe("6h");
  });

  it("reads yesterday, then weekdays, then dates", () => {
    expect(timeAgo(at(2026, 9, 9, 23, 30), now)).toBe("Yesterday");
    expect(timeAgo(at(2026, 9, 6), now)).toBe("Tue");
    expect(timeAgo(at(2026, 9, 2), now)).toBe("Oct 2");
    expect(timeAgo(at(2025, 11, 30), now)).toBe("Dec 30, 2025");
  });

  it("treats a time a little ahead of the clock as now", () => {
    expect(timeAgo(new Date(now + 30_000).toISOString(), now)).toBe("now");
    expect(timeAgo("not a date", now)).toBe("");
  });
});

describe("inbox", () => {
  const named = (r: FollowRow, name: string): FollowRow => ({ ...r, other_username: name });
  const kudos = (workout: string, user: string, hoursAgo: number, name: string | null = "Push"): KudosInboxRow => ({
    workout_id: workout,
    workout_name: name,
    user_id: user,
    username: user,
    created_at: iso(hoursAgo * 3_600_000),
  });

  it("puts requests waiting on me at the top, newest first", () => {
    const inbox = inboxItems(
      [
        named(row(WILL, ME, "pending", WILL, 3), "will"),
        named(row(ME, SAM, "pending", SAM, 1), "sam"), // Sam lets me follow them
        row(ME, "kim", "pending", ME, 1), // mine, waiting on Kim
        row("old", ME, "pending", "old", 31), // expired
      ],
      [],
      ME,
      NOW,
    );
    expect(inbox.requests.map((i) => (i.kind === "request" ? i.row.other_id : ""))).toEqual([SAM, WILL]);
    expect(inbox.activity).toEqual([]);
    expect(inboxLine(inbox.requests[0], ME)).toBe("@sam offered to let you follow them");
    expect(inboxLine(inbox.requests[1], ME)).toBe("@will wants to follow you");
  });

  it("shows a request I started once it is accepted, timed by accepted_at", () => {
    const mine = { ...named(row(ME, WILL, "accepted", ME, 5), "will"), accepted_at: iso(2 * DAY) };
    const offer = { ...named(row(SAM, ME, "accepted", ME, 5), "sam"), accepted_at: iso(DAY) };
    const theirs = named(row(WILL, ME, "accepted", WILL, 1), "will"); // I approved it: not news
    const old = { ...row("kim", ME, "accepted", ME, 60), accepted_at: iso(31 * DAY) };
    const inbox = inboxItems([mine, offer, theirs, old], [], ME, NOW);
    expect(inbox.activity.map((i) => i.key)).toEqual([`accepted:${SAM}:${ME}`, `accepted:${ME}:${WILL}`]);
    expect(inboxLine(inbox.activity[0], ME)).toBe("@sam now follows you");
    expect(inboxLine(inbox.activity[1], ME)).toBe("@will accepted your follow request");
  });

  it("groups kudos per workout, timed by the newest, naming the newest giver", () => {
    const inbox = inboxItems(
      [],
      [kudos("w1", WILL, 5), kudos("w1", SAM, 1), kudos("w2", WILL, 3, null), kudos("w1", "kim", 2), kudos("w3", ME, 1)],
      ME,
      NOW,
    );
    expect(inbox.activity.map((i) => i.key)).toEqual(["kudos:w1", "kudos:w2"]);
    expect(inbox.activity[0].at).toBe(iso(3_600_000));
    expect(inboxLine(inbox.activity[0], ME)).toBe("@sam and 2 others gave kudos on Push");
    expect(inboxLine(inbox.activity[1], ME)).toBe("@will gave kudos on your workout");
    const two = inboxItems([], [kudos("w1", WILL, 2), kudos("w1", SAM, 1)], ME, NOW);
    expect(inboxLine(two.activity[0], ME)).toBe("@sam and @will gave kudos on Push");
  });

  it("drops kudos older than 30 days", () => {
    expect(inboxItems([], [kudos("w1", WILL, 31 * 24)], ME, NOW).activity).toEqual([]);
  });

  it("lights the dot for anything newer than last seen, requests included", () => {
    const inbox = inboxItems([named(row(WILL, ME, "pending", WILL, 2), "will")], [kudos("w1", SAM, 5)], ME, NOW);
    expect(hasUnseenInbox(inbox, null)).toBe(true);
    expect(hasUnseenInbox(inbox, NOW - 6 * 3_600_000)).toBe(true);
    // Seen after both: the waiting request no longer lights it.
    expect(hasUnseenInbox(inbox, NOW - 3_600_000)).toBe(false);
    expect(hasUnseenInbox({ requests: [], activity: [] }, null)).toBe(false);
  });

  it("stores last seen per user and reads back only a number", () => {
    expect(inboxSeenKey("u1")).toBe("liftcamp:inbox-seen:u1");
    expect(parseInboxSeen(inboxSeenValue(NOW))).toBe(NOW);
    expect(parseInboxSeen("nope")).toBeNull();
    expect(parseInboxSeen(null)).toBeNull();
  });

  it("names someone without a username", () => {
    expect(socialHandle(null)).toBe("A LiftCamp member");
    expect(socialHandle("will")).toBe("@will");
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

describe("invite links in the app", () => {
  it("puts the link in the share message text", () => {
    expect(inviteMessage("ABCD2345")).toContain("https://liftcamp.app/i/ABCD2345");
  });

  it("reads the code from the URL the system hands over or a bare path", () => {
    expect(inviteCodeFromPath("liftcamp://invite/abcd-2345")).toBe("ABCD2345");
    expect(inviteCodeFromPath("https://liftcamp.app/i/ABCD2345")).toBe("ABCD2345");
    expect(inviteCodeFromPath("/invite/ABCD2345")).toBe("ABCD2345");
    expect(inviteCodeFromPath("invite/ABCD2345")).toBe("ABCD2345");
    expect(inviteCodeFromPath("/invite/nope")).toBeNull();
    expect(inviteCodeFromPath("/workout/abc")).toBeNull();
    expect(inviteCodeFromPath("liftcamp://workout/abc")).toBeNull();
  });

  it("asks a guest to sign up first and opens it for a member", () => {
    expect(pendingInviteStep(null, { userId: ME, isGuest: false })).toBe("none");
    expect(pendingInviteStep("ABCD2345", { userId: null, isGuest: false })).toBe("none");
    expect(pendingInviteStep("ABCD2345", { userId: ME, isGuest: true })).toBe("link");
    expect(pendingInviteStep("ABCD2345", { userId: ME, isGuest: false })).toBe("open");
  });
});

describe("invite screen", () => {
  const preview = (i: InvitePreview["i_follow"], them: InvitePreview["follows_me"]): InvitePreview => ({
    user_id: WILL,
    username: "will",
    i_follow: i,
    follows_me: them,
  });

  it("waits for the live flag read, then the preview", () => {
    expect(inviteScreenState({ socialOn: undefined, preview: undefined })).toEqual({ kind: "loading" });
    expect(inviteScreenState({ socialOn: true, preview: undefined })).toEqual({ kind: "loading" });
  });

  it("says coming soon without the flag, whatever the preview", () => {
    expect(inviteScreenState({ socialOn: false, preview: undefined })).toEqual({ kind: "coming-soon" });
    expect(inviteScreenState({ socialOn: false, preview: [preview(null, null)] })).toEqual({ kind: "coming-soon" });
  });

  it("tells a failed read from a code that does not work", () => {
    expect(inviteScreenState({ socialOn: null, preview: undefined })).toEqual({ kind: "error" });
    expect(inviteScreenState({ socialOn: true, preview: null })).toEqual({ kind: "error" });
    expect(inviteScreenState({ socialOn: true, preview: [] })).toEqual({ kind: "not-found" });
  });

  it("labels both buttons from where the two stand", () => {
    const fresh = inviteScreenState({ socialOn: true, preview: [preview(null, null)] });
    expect(fresh).toMatchObject({ kind: "ready", follow: "follow", letFollow: "offer" });
    const sent = inviteScreenState({ socialOn: true, preview: [preview("pending", "pending")] });
    expect(sent).toMatchObject({ kind: "ready", follow: "requested", letFollow: "offered" });
    const done = inviteScreenState({ socialOn: true, preview: [preview("accepted", "accepted")] });
    expect(done).toMatchObject({ kind: "ready", follow: "following", letFollow: "following" });
  });

  it("sends both from one Follow tap while the box is checked", () => {
    expect(inviteAction("follow", "offer", true)).toEqual({
      label: "Follow",
      sends: ["follow", "let_follow"],
      checkbox: true,
      note: null,
    });
    expect(inviteAction("follow", "offer", false).sends).toEqual(["follow"]);
  });

  it("hides the box once the other direction is sent or done", () => {
    expect(inviteAction("follow", "offered", true)).toMatchObject({
      sends: ["follow"],
      checkbox: false,
      note: "They can follow you once they accept.",
    });
    expect(inviteAction("follow", "following", true)).toMatchObject({ checkbox: false, note: "They already follow you." });
  });

  it("offers what is left after the follow", () => {
    expect(inviteAction("requested", "offer", false)).toEqual({
      label: "Let them follow you",
      sends: ["let_follow"],
      checkbox: false,
      note: "You asked to follow them.",
    });
    expect(inviteAction("requested", "offered", true)).toMatchObject({ label: "Requested", sends: [] });
    expect(inviteAction("following", "following", true)).toMatchObject({ label: "Following", sends: [] });
  });

  it("applies a request's answer to the side it was sent for", () => {
    const p = preview(null, null);
    expect(afterInviteRequest(p, "follow", "pending")).toMatchObject({ i_follow: "pending", follows_me: null });
    expect(afterInviteRequest(p, "let_follow", "accepted")).toMatchObject({ i_follow: null, follows_me: "accepted" });
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
