import { describe, expect, it } from "vitest";

import { storageKeysToClear } from "./account-deletion";
import {
  classifyMergeResponse,
  guestKeysToRemove,
  guestMergeKey,
  mergeStep,
  mergedLine,
  parsePendingMerge,
  prependOps,
  rekeyDeviceWorkout,
  rekeyFailed,
  rekeyOps,
  tokenExpired,
  type PendingMerge,
} from "./guest-merge";
import type { WriteOp } from "./write-queue";

const G = "guest-id";
const A = "acct-id";
const tokens = { access_token: "a", refresh_token: "r", expires_at: 2_000 };

function record(over: Partial<PendingMerge> = {}): PendingMerge {
  return {
    guestId: G,
    targetId: A,
    stage: "merging",
    targetSession: tokens,
    guestSession: null,
    createdAt: 1,
    attempts: 0,
    lastError: null,
    stuck: false,
    ...over,
  };
}

function insert(seq: number, userId: string, id: string, rowUser = userId): WriteOp {
  return {
    kind: "insert",
    table: "workouts",
    rows: [{ id, parents: [], values: { id, user_id: rowUser } }],
    seq,
    userId,
    enqueuedAt: 0,
    attempts: 0,
  };
}

function update(seq: number, userId: string, id: string): WriteOp {
  return { kind: "update", table: "sets", id, parents: [], patch: { reps: 5 }, seq, userId, enqueuedAt: 0, attempts: 0 };
}

describe("parsePendingMerge", () => {
  it("reads back what was stored", () => {
    const r = record({ stage: "deferred", guestSession: tokens, attempts: 2, lastError: "http_500" });
    expect(parsePendingMerge(JSON.stringify(r))).toEqual(r);
  });
  it("refuses missing, unreadable or malformed records", () => {
    expect(parsePendingMerge(null)).toBeNull();
    expect(parsePendingMerge("{oops")).toBeNull();
    expect(parsePendingMerge(JSON.stringify({ ...record(), stage: "done" }))).toBeNull();
    expect(parsePendingMerge(JSON.stringify({ ...record(), guestId: 1 }))).toBeNull();
    expect(parsePendingMerge(JSON.stringify({ ...record(), targetSession: { access_token: "a" } }))).toBeNull();
  });
});

describe("tokenExpired", () => {
  it("counts a token inside the margin as expired", () => {
    expect(tokenExpired({ ...tokens, expires_at: 100 }, 100_000 - 30_000, 60)).toBe(true);
    expect(tokenExpired({ ...tokens, expires_at: 100 }, 100_000 - 90_000, 60)).toBe(false);
  });
  it("treats no tokens as expired and no expiry as fresh", () => {
    expect(tokenExpired(null, 0)).toBe(true);
    expect(tokenExpired({ ...tokens, expires_at: null }, 0)).toBe(false);
  });
});

describe("mergeStep", () => {
  it("merges as the guest while the phone is still the guest", () => {
    expect(mergeStep(record(), { userId: G }, "sign-in")).toBe("merge-as-guest");
  });
  it("waits in `merging` when someone else is signed in, or nothing is held", () => {
    expect(mergeStep(record(), { userId: A }, "launch")).toBe("wait");
    expect(mergeStep(record(), { userId: null }, "launch")).toBe("wait");
    expect(mergeStep(record({ targetSession: null }), { userId: G }, "launch")).toBe("wait");
  });
  it("merges from the account in `deferred`, with the guest's tokens", () => {
    expect(mergeStep(record({ stage: "deferred", guestSession: tokens }), { userId: A }, "foreground")).toBe(
      "merge-deferred",
    );
    expect(mergeStep(record({ stage: "deferred", guestSession: null }), { userId: A }, "foreground")).toBe("wait");
    expect(mergeStep(record({ stage: "deferred", guestSession: tokens }), { userId: G }, "foreground")).toBe("wait");
  });
  it("switches to the account once merged, from the deleted guest or from nothing", () => {
    expect(mergeStep(record({ stage: "merged" }), { userId: G }, "launch")).toBe("set-session");
    expect(mergeStep(record({ stage: "merged" }), { userId: null }, "launch")).toBe("set-session");
    expect(mergeStep(record({ stage: "merged", targetSession: null }), { userId: G }, "launch")).toBe("wait");
  });
  it("finishes once the phone is on the account", () => {
    expect(mergeStep(record({ stage: "merged" }), { userId: A }, "sign-in")).toBe("finish");
  });
  it("never acts for a third account", () => {
    for (const stage of ["merging", "merged", "deferred"] as const) {
      expect(mergeStep(record({ stage, guestSession: tokens }), { userId: "someone-else" }, "launch")).toBe("wait");
    }
  });
  it("tries a refused merge again only at launch or by hand", () => {
    const stuck = record({ stage: "deferred", guestSession: tokens, stuck: true });
    expect(mergeStep(stuck, { userId: A }, "foreground")).toBe("wait");
    expect(mergeStep(stuck, { userId: A }, "sign-in")).toBe("wait");
    expect(mergeStep(stuck, { userId: A }, "launch")).toBe("merge-deferred");
    expect(mergeStep(stuck, { userId: A }, "manual")).toBe("merge-deferred");
    // A merge the server already did still finishes, stuck or not.
    expect(mergeStep({ ...stuck, stage: "merged" }, { userId: A }, "foreground")).toBe("finish");
  });
});

describe("classifyMergeResponse", () => {
  it("is done when merged, now or before", () => {
    const moved = { workouts: 1 };
    expect(classifyMergeResponse({ status: 200, body: { merged: true, status: "merged", moved } })).toEqual({
      kind: "done",
      error: "",
      moved,
    });
    expect(classifyMergeResponse({ status: 200, body: { merged: true, status: "already_merged" } }).kind).toBe("done");
  });
  it("refreshes on a token that did not verify", () => {
    expect(classifyMergeResponse({ status: 401, body: { merged: false, error: "guest_session_invalid" } })).toEqual({
      kind: "refresh",
      error: "guest_session_invalid",
      moved: null,
    });
    expect(classifyMergeResponse({ status: 401, body: { error: "not_signed_in" } }).kind).toBe("refresh");
  });
  it("is stuck on a refusal", () => {
    expect(classifyMergeResponse({ status: 403, body: { error: "refused" } }).kind).toBe("stuck");
    expect(classifyMergeResponse({ status: 403, body: { error: "not_a_guest" } }).kind).toBe("stuck");
    expect(classifyMergeResponse({ status: 410, body: { error: "guest_gone" } }).kind).toBe("stuck");
    expect(classifyMergeResponse({ status: 400, body: { error: "same_account" } }).kind).toBe("stuck");
  });
  it("retries on no answer, a server error, or an answer it cannot read", () => {
    expect(classifyMergeResponse({ status: null, body: null })).toEqual({ kind: "retry", error: "no_response", moved: null });
    expect(classifyMergeResponse({ status: 500, body: { error: "merge_failed" } }).kind).toBe("retry");
    expect(classifyMergeResponse({ status: 502, body: "Bad gateway" })).toEqual({ kind: "retry", error: "http_502", moved: null });
    expect(classifyMergeResponse({ status: 200, body: { merged: false } }).kind).toBe("retry");
  });
});

describe("rekeyOps", () => {
  it("swaps the guest's id in userId and in inserted rows", () => {
    const out = rekeyOps([insert(1, G, "w"), update(2, G, "s")], G, A);
    expect(out.map((o) => o.userId)).toEqual([A, A]);
    expect(out[0].kind === "insert" && out[0].rows[0].values.user_id).toBe(A);
    expect(out[1].kind === "update" && out[1].patch).toEqual({ reps: 5 });
  });
  it("leaves another user's ops, and rows without the guest's id, alone", () => {
    const other = insert(1, "x", "w");
    expect(rekeyOps([other], G, A)[0]).toBe(other);
    const odd = rekeyOps([insert(1, G, "w", "someone")], G, A)[0];
    expect(odd.kind === "insert" && odd.rows[0].values.user_id).toBe("someone");
  });
  it("is the same the second time", () => {
    const once = rekeyOps([insert(1, G, "w")], G, A);
    expect(rekeyOps(once, G, A)).toEqual(once);
  });
  it("rekeys failed writes the same way", () => {
    const out = rekeyFailed([{ op: insert(1, G, "w"), error: { status: 403, code: "42501", message: "" }, at: 3 }], G, A);
    expect(out[0].op.userId).toBe(A);
    expect(out[0].at).toBe(3);
  });
});

describe("prependOps", () => {
  it("puts the guest's ops first, numbered on from the account's next seq", () => {
    const target = { nextSeq: 7, ops: [insert(5, A, "a"), insert(6, A, "b")] };
    const out = prependOps(target, [insert(1, A, "g1"), insert(2, A, "g2")]);
    expect(out.ops.map((o) => (o.kind === "insert" ? o.rows[0].id : ""))).toEqual(["g1", "g2", "a", "b"]);
    expect(out.ops.map((o) => o.seq)).toEqual([7, 8, 9, 10]);
    expect(out.nextSeq).toBe(11);
  });
  it("changes nothing with no guest ops", () => {
    const target = { nextSeq: 3, ops: [insert(2, A, "a")] };
    expect(prependOps(target, [])).toBe(target);
  });
});

describe("guestKeysToRemove", () => {
  it("removes the guest's caches and queue keys, and nothing else", () => {
    const keys = [
      `liftcamp:home:${G}`,
      `liftcamp:unit:${G}`,
      `liftcamp:username:${G}`,
      `liftcamp:onboarded:${G}`,
      `liftcamp:signup-due:${G}`,
      `liftcamp:setup-completed-seen:${G}`,
      `liftcamp:medals-synced:${G}`,
      `liftcamp:queue:${G}`,
      `liftcamp:queue-failed:${G}`,
      `liftcamp:home:${A}`,
      `liftcamp:queue:${A}`,
      `liftcamp:queue:${G}:unreadable:123`,
      "liftcamp:workout:w1",
      "liftcamp:rest:w1",
      "liftcamp:theme",
      "liftcamp:onboarded",
      guestMergeKey(G),
    ];
    expect(guestKeysToRemove(keys, G)).toEqual(keys.slice(0, 9));
  });
});

describe("rekeyDeviceWorkout", () => {
  it("swaps the user id in the guest's copy and keeps the rest", () => {
    const raw = JSON.stringify({ userId: G, unit: "kg", savedAt: 1, workout: { id: "w1" } });
    expect(JSON.parse(rekeyDeviceWorkout(raw, G, A)!)).toEqual({ userId: A, unit: "kg", savedAt: 1, workout: { id: "w1" } });
  });
  it("leaves another user's copy, and unreadable ones, alone", () => {
    expect(rekeyDeviceWorkout(JSON.stringify({ userId: A }), G, A)).toBeNull();
    expect(rekeyDeviceWorkout("{nope", G, A)).toBeNull();
    expect(rekeyDeviceWorkout(null, G, A)).toBeNull();
  });
});

describe("mergedLine", () => {
  it("says how many workouts moved", () => {
    expect(mergedLine({ workouts: 1 })).toBe("Your workout from this phone is in your account.");
    expect(mergedLine({ workouts: 3 })).toBe("Your 3 workouts from this phone are in your account.");
  });
  it("says nothing when no workout moved", () => {
    expect(mergedLine({ workouts: 0 })).toBeNull();
    expect(mergedLine({})).toBeNull();
    expect(mergedLine(null)).toBeNull();
  });
});

describe("account deletion", () => {
  it("clears a pending merge with the other app keys", () => {
    expect(storageKeysToClear([guestMergeKey(G)])).toEqual([guestMergeKey(G)]);
  });
});
