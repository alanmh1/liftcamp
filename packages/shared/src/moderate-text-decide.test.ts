import { describe, expect, it } from "vitest";

import {
  alreadyReported,
  authorized,
  avatarToCheck,
  imageInput,
  parseTarget,
  usernameText,
  verdictFrom,
  workoutText,
  workoutUpdate,
  type WorkoutRow,
} from "../../../supabase/functions/moderate-text/decide";

// The moderate-text Edge Function's decisions. It deploys with verify_jwt
// off, so `authorized` is the only check on a request.

const ID = "11111111-1111-4111-8111-111111111111";
const NOW = "2026-11-19T12:00:00.000Z";
const EARLIER = "2026-11-18T09:00:00.000Z";

function row(over: Partial<WorkoutRow> = {}): WorkoutRow {
  return {
    id: ID,
    user_id: ID,
    name: "Push day",
    notes: "Felt strong",
    finished_at: NOW,
    platform: "ios",
    moderation_flagged_at: null,
    ...over,
  };
}

describe("authorized", () => {
  it("accepts the exact secret", () => {
    expect(authorized("s3cret", "s3cret")).toBe(true);
  });
  it("refuses anything else", () => {
    expect(authorized("s3cre", "s3cret")).toBe(false);
    expect(authorized("s3cretx", "s3cret")).toBe(false);
    expect(authorized("Bearer s3cret", "s3cret")).toBe(false);
    expect(authorized(null, "s3cret")).toBe(false);
    expect(authorized("", "s3cret")).toBe(false);
  });
  it("refuses everything when the secret is unset", () => {
    expect(authorized("", undefined)).toBe(false);
    expect(authorized("", "")).toBe(false);
  });
});

describe("parseTarget", () => {
  it("reads the two tables and a uuid", () => {
    expect(parseTarget({ table: "workouts", id: ID })).toEqual({ table: "workouts", id: ID });
    expect(parseTarget({ table: "user_profiles", id: ID })).toEqual({ table: "user_profiles", id: ID });
    expect(parseTarget({ table: "avatars", id: ID })).toEqual({ table: "avatars", id: ID });
  });
  it("drops any text sent along", () => {
    expect(parseTarget({ table: "workouts", id: ID, text: "ignored" })).toEqual({ table: "workouts", id: ID });
  });
  it("refuses other tables, bad ids and non-objects", () => {
    expect(parseTarget({ table: "sets", id: ID })).toBeNull();
    expect(parseTarget({ table: "workouts", id: "abc" })).toBeNull();
    expect(parseTarget({ table: "workouts" })).toBeNull();
    expect(parseTarget(null)).toBeNull();
    expect(parseTarget("workouts")).toBeNull();
  });
});

describe("workoutText", () => {
  it("joins name and note with a newline", () => {
    expect(workoutText(row())).toBe("Push day\nFelt strong");
  });
  it("sends whichever one is there", () => {
    expect(workoutText(row({ notes: "" }))).toBe("Push day");
    expect(workoutText(row({ name: null, notes: "  sore  " }))).toBe("sore");
  });
  it("skips a gone, unfinished, web-made or empty workout", () => {
    expect(workoutText(null)).toBeNull();
    expect(workoutText(row({ finished_at: null }))).toBeNull();
    expect(workoutText(row({ platform: "web" }))).toBeNull();
    expect(workoutText(row({ platform: null }))).toBeNull();
    expect(workoutText(row({ name: " ", notes: null }))).toBeNull();
  });
  it("takes android as well as ios", () => {
    expect(workoutText(row({ platform: "android" }))).toBe("Push day\nFelt strong");
  });
});

describe("usernameText", () => {
  it("reads underscores as spaces", () => {
    expect(usernameText("big_lift_99")).toBe("big lift 99");
  });
  it("skips no username", () => {
    expect(usernameText(null)).toBeNull();
    expect(usernameText("___")).toBeNull();
  });
});

describe("verdictFrom", () => {
  it("lists the categories set to true, sorted", () => {
    expect(
      verdictFrom({
        results: [
          {
            flagged: true,
            categories: { violence: true, harassment: true, sexual: false, illicit: null },
          },
        ],
      }),
    ).toEqual({ flagged: true, categories: ["harassment", "violence"] });
  });
  it("reads an unflagged answer", () => {
    expect(verdictFrom({ results: [{ flagged: false, categories: { hate: false } }] })).toEqual({
      flagged: false,
      categories: [],
    });
  });
  it("is null with no result to read", () => {
    expect(verdictFrom({})).toBeNull();
    expect(verdictFrom({ results: [] })).toBeNull();
    expect(verdictFrom({ results: [{ categories: {} }] })).toBeNull();
  });
});

describe("workoutUpdate", () => {
  it("flags an unflagged workout and asks for a report", () => {
    expect(workoutUpdate({ moderation_flagged_at: null }, { flagged: true, categories: ["hate"] }, NOW)).toEqual({
      moderated_at: NOW,
      moderation_flagged_at: NOW,
      newlyFlagged: true,
    });
  });
  it("keeps the first flag's time and files nothing new", () => {
    expect(workoutUpdate({ moderation_flagged_at: EARLIER }, { flagged: true, categories: [] }, NOW)).toEqual({
      moderated_at: NOW,
      moderation_flagged_at: EARLIER,
      newlyFlagged: false,
    });
  });
  it("clears the flag when the text now passes", () => {
    expect(workoutUpdate({ moderation_flagged_at: EARLIER }, { flagged: false, categories: [] }, NOW)).toEqual({
      moderated_at: NOW,
      moderation_flagged_at: null,
      newlyFlagged: false,
    });
  });
});

describe("alreadyReported", () => {
  it("reads a unique violation as another call's report", () => {
    expect(alreadyReported({ code: "23505" })).toBe(true);
  });
  it("treats any other failure as a real error", () => {
    expect(alreadyReported({ code: "42501" })).toBe(false);
    expect(alreadyReported({})).toBe(false);
    expect(alreadyReported(null)).toBe(false);
  });
});

describe("avatarToCheck", () => {
  const URL = "https://lh3.googleusercontent.com/a/abc=s96-c";
  it("checks a pending photo", () => {
    expect(avatarToCheck({ user_id: ID, avatar_url: URL, avatar_status: "pending" })).toBe(URL);
  });
  it("skips a missing profile or photo", () => {
    expect(avatarToCheck(null)).toBeNull();
    expect(avatarToCheck({ user_id: ID, avatar_url: null, avatar_status: "pending" })).toBeNull();
    expect(avatarToCheck({ user_id: ID, avatar_url: "  ", avatar_status: "pending" })).toBeNull();
  });
  it("skips a photo already checked", () => {
    expect(avatarToCheck({ user_id: ID, avatar_url: URL, avatar_status: "ok" })).toBeNull();
    expect(avatarToCheck({ user_id: ID, avatar_url: URL, avatar_status: "flagged" })).toBeNull();
    expect(avatarToCheck({ user_id: ID, avatar_url: URL, avatar_status: null })).toBeNull();
  });
});

describe("imageInput", () => {
  it("sends one image_url part", () => {
    expect(imageInput("https://x.test/p.jpg")).toEqual([
      { type: "image_url", image_url: { url: "https://x.test/p.jpg" } },
    ]);
  });
});
