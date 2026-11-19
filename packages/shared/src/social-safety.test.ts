import { describe, expect, it } from "vitest";

import {
  communityRulesKey,
  noteWarningAfter,
  parseCommunityRulesCache,
  REPORT_LIMIT_MESSAGE,
  REPORT_REASONS,
  reportErrorMessage,
  shouldCheckNote,
  usernameRetryable,
} from "./social-safety";

describe("REPORT_REASONS", () => {
  it("offers the four reasons file_report accepts, in order", () => {
    expect(REPORT_REASONS.map((r) => r.key)).toEqual(["inappropriate", "harassment", "spam", "other"]);
  });
});

describe("reportErrorMessage", () => {
  it("puts the daily limit in the app's words", () => {
    expect(reportErrorMessage({ code: "54000", message: "Too many reports today. Try again tomorrow." })).toBe(
      REPORT_LIMIT_MESSAGE,
    );
  });
  it("shows any other refusal as the server said it", () => {
    expect(
      reportErrorMessage({ code: "42501", message: "You can only report people you're connected to." }),
    ).toBe("You can only report people you're connected to.");
    expect(reportErrorMessage({ message: "Could not reach LiftCamp." })).toBe("Could not reach LiftCamp.");
  });
});

describe("usernameRetryable", () => {
  it("moves on from a taken or blocked name", () => {
    expect(usernameRetryable("23505")).toBe(true);
    expect(usernameRetryable("23514")).toBe(true);
  });
  it("stops on anything else", () => {
    expect(usernameRetryable("42501")).toBe(false);
    expect(usernameRetryable(undefined)).toBe(false);
    expect(usernameRetryable(null)).toBe(false);
  });
});

describe("shouldCheckNote", () => {
  const base = { socialOn: true, isGuest: false, offline: false, note: "Felt good" };
  it("checks a signed-up social user's note online", () => {
    expect(shouldCheckNote(base)).toBe(true);
  });
  it("skips social off, guests, offline and empty notes", () => {
    expect(shouldCheckNote({ ...base, socialOn: false })).toBe(false);
    expect(shouldCheckNote({ ...base, isGuest: true })).toBe(false);
    expect(shouldCheckNote({ ...base, offline: true })).toBe(false);
    expect(shouldCheckNote({ ...base, note: "   " })).toBe(false);
  });
});

describe("noteWarningAfter", () => {
  it("shows on a refusal and clears on a pass", () => {
    expect(noteWarningAfter(false, { note: "x", allowed: false })).toBe(true);
    expect(noteWarningAfter(true, { note: "x", allowed: true })).toBe(false);
  });
  it("keeps the current state when the check never answered", () => {
    expect(noteWarningAfter(true, { note: "x", allowed: null })).toBe(true);
    expect(noteWarningAfter(false, { note: "x", allowed: null })).toBe(false);
  });
  it("clears for an empty note", () => {
    expect(noteWarningAfter(true, { note: "", allowed: null })).toBe(false);
  });
});

describe("community rules cache", () => {
  it("is keyed per user under the app prefix", () => {
    expect(communityRulesKey("u1")).toBe("liftcamp:community-rules:u1");
  });
  it("reads any stored time as accepted", () => {
    expect(parseCommunityRulesCache("2026-11-19T12:00:00.000Z")).toBe(true);
    expect(parseCommunityRulesCache(null)).toBe(false);
    expect(parseCommunityRulesCache("")).toBe(false);
  });
});
