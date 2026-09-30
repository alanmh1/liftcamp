import { describe, expect, it } from "vitest";

import { EMPTY_LOCAL_HOME, mergeHomePending, type LocalHomeState } from "./home-pending";

type P = { id: string; createdAt: string };
type L = { id: string; finishedAt: string };

const NOTHING: LocalHomeState<P, L> = EMPTY_LOCAL_HOME;

const server = {
  inProgress: { id: "w1", createdAt: "2026-09-29T10:00:00Z" } as P | null,
  streakDates: ["2026-09-28"],
  finishedCount: 7,
  last: { id: "old", finishedAt: "2026-09-28T19:00:00Z" } as L | null,
  profile: { weeklyTarget: 5 },
};

function local(over: Partial<LocalHomeState<P, L>>): LocalHomeState<P, L> {
  return { ...EMPTY_LOCAL_HOME, ...over };
}

describe("mergeHomePending", () => {
  it("changes nothing with nothing on the phone", () => {
    expect(mergeHomePending(server, NOTHING)).toEqual(server);
  });

  it("drops saved routines removed on the phone, and leaves a part still loading alone", () => {
    const mine = [{ id: "t1" }, { id: "t2" }, { id: "t3" }];
    const removed = local({ removedTemplateIds: ["t1", "t3"] });
    expect(mergeHomePending({ ...server, mine }, removed).mine).toEqual([{ id: "t2" }]);
    expect(mergeHomePending({ ...server, mine: [{ id: "t1" }] }, removed).mine).toEqual([]);
    expect(mergeHomePending(server, removed)).toEqual(server);
  });

  it("drops the Resume card for a workout finished on the phone, and counts it this week", () => {
    const merged = mergeHomePending(
      server,
      local({ endedIds: ["w1"], finished: [{ id: "w1", date: "2026-09-29" }] }),
    );
    expect(merged.inProgress).toBeNull();
    expect(merged.streakDates).toEqual(["2026-09-28", "2026-09-29"]);
    expect(merged.finishedCount).toBe(8);
  });

  it("drops the Resume card for a workout discarded on the phone, without counting it", () => {
    const merged = mergeHomePending(server, local({ endedIds: ["w1"] }));
    expect(merged.inProgress).toBeNull();
    expect(merged.finishedCount).toBe(7);
  });

  it("shows a workout started on the phone that the server does not have", () => {
    const started = { id: "w2", createdAt: "2026-09-29T11:00:00Z" };
    expect(mergeHomePending({ ...server, inProgress: null }, local({ unfinished: started })).inProgress).toBe(started);
    // Newer than the server's: the phone's.
    expect(mergeHomePending(server, local({ unfinished: started })).inProgress).toBe(started);
    // Older: the server's.
    const older = { id: "w0", createdAt: "2026-09-29T09:00:00Z" };
    expect(mergeHomePending(server, local({ unfinished: older })).inProgress).toBe(server.inProgress);
  });

  it("shows the finish not yet synced as the last workout when it is newer", () => {
    const mine = { id: "w1", finishedAt: "2026-09-29T11:00:00Z" };
    expect(mergeHomePending(server, local({ lastFinished: mine })).last).toBe(mine);
    const stale = { id: "w0", finishedAt: "2026-09-27T11:00:00Z" };
    expect(mergeHomePending(server, local({ lastFinished: stale })).last).toBe(server.last);
    expect(mergeHomePending({ ...server, last: null }, local({ lastFinished: stale })).last).toBe(stale);
  });

  it("leaves parts still loading undefined", () => {
    const merged = mergeHomePending(
      {} as typeof server,
      local({ finished: [{ id: "w1", date: "2026-09-29" }], unfinished: { id: "w2", createdAt: "x" } }),
    );
    expect(merged.inProgress).toBeUndefined();
    expect(merged.streakDates).toBeUndefined();
    expect(merged.finishedCount).toBeUndefined();
    expect(merged.last).toBeUndefined();
  });

  it("keeps parts it does not know about", () => {
    expect(mergeHomePending(server, local({ endedIds: ["w1"] })).profile).toEqual({ weeklyTarget: 5 });
  });
});
