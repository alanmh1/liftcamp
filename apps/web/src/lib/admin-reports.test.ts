import { describe, expect, it } from "vitest";
import {
  avatarStatusLabel,
  canUnhide,
  flaggedAvatar,
  hasPhoto,
  filterReports,
  flaggedCategories,
  flaggedUsername,
  needsConfirm,
  overDue,
  reasonLabel,
  reportActions,
  statusParam,
  type ReportRow,
} from "./admin-reports";

const NOW = Date.parse("2026-11-19T12:00:00Z");

function row(over: Partial<ReportRow> = {}): ReportRow {
  return {
    id: "r1",
    reporter_id: "u1",
    reporter_email: "a@example.com",
    reporter_username: "alan",
    target_user_id: "u2",
    target_email: "b@example.com",
    target_username: "bea",
    target_workout_id: "w1",
    workout_name: "Push",
    workout_note: "note",
    workout_hidden: false,
    workout_flagged: false,
    reason: "harassment",
    detail: null,
    status: "open",
    created_at: "2026-11-19T10:00:00Z",
    resolved_at: null,
    ...over,
  };
}

describe("statusParam", () => {
  it("asks the server for open only on the Open pill", () => {
    expect(statusParam("open")).toBe("open");
    expect(statusParam("resolved")).toBeNull();
    expect(statusParam("all")).toBeNull();
  });
});

describe("filterReports", () => {
  const rows = [
    row({ id: "c", status: "actioned", created_at: "2026-11-19T09:00:00Z" }),
    row({ id: "a", status: "open", created_at: "2026-11-18T09:00:00Z" }),
    row({ id: "b", status: "dismissed", created_at: "2026-11-17T09:00:00Z" }),
  ];
  it("keeps open, resolved or every report, oldest first", () => {
    expect(filterReports(rows, "open").map((r) => r.id)).toEqual(["a"]);
    expect(filterReports(rows, "resolved").map((r) => r.id)).toEqual(["b", "c"]);
    expect(filterReports(rows, "all").map((r) => r.id)).toEqual(["b", "a", "c"]);
  });
});

describe("overDue", () => {
  it("marks open reports older than a day", () => {
    expect(overDue(row({ created_at: "2026-11-18T11:00:00Z" }), NOW)).toBe(true);
    expect(overDue(row({ created_at: "2026-11-18T13:00:00Z" }), NOW)).toBe(false);
  });
  it("never marks a resolved report", () => {
    expect(overDue(row({ status: "dismissed", created_at: "2026-11-01T00:00:00Z" }), NOW)).toBe(
      false,
    );
  });
});

describe("auto-flag detail", () => {
  it("reads categories and the flagged username", () => {
    const r = row({
      reason: "auto_flag",
      reporter_id: null,
      detail: { field: "username", username: "bad_name", categories: ["hate", 3, "harassment"] },
    });
    expect(flaggedCategories(r)).toEqual(["hate", "harassment"]);
    expect(flaggedUsername(r)).toBe("bad_name");
    expect(reasonLabel(r.reason)).toBe("Auto-flag");
  });
  it("has no username for a workout flag or a user report", () => {
    expect(
      flaggedUsername(row({ reason: "auto_flag", detail: { field: "workout", categories: [] } })),
    ).toBeNull();
    expect(flaggedUsername(row({ detail: { field: "username", username: "x" } }))).toBeNull();
    expect(flaggedCategories(row({ detail: ["odd"] }))).toEqual([]);
  });
  it("capitalises user reasons", () => {
    expect(reasonLabel("spam")).toBe("Spam");
  });
});

describe("reportActions", () => {
  it("offers every action on an open report with a reporter and a workout", () => {
    expect(reportActions(row())).toEqual([
      "dismiss",
      "hide_workout",
      "reset_username",
      "remove_follow",
      "disable_social",
    ]);
  });
  it("drops Hide workout without a workout or once hidden", () => {
    expect(reportActions(row({ target_workout_id: null }))).not.toContain("hide_workout");
    expect(reportActions(row({ workout_hidden: true }))).not.toContain("hide_workout");
  });
  it("drops Remove follow on an auto-flag", () => {
    expect(reportActions(row({ reason: "auto_flag", reporter_id: null }))).not.toContain(
      "remove_follow",
    );
  });
  it("offers Remove photo only when the target has a photo", () => {
    expect(reportActions(row(), true)).toEqual([
      "dismiss",
      "hide_workout",
      "reset_username",
      "remove_avatar",
      "remove_follow",
      "disable_social",
    ]);
    expect(reportActions(row({ target_user_id: null }), true)).not.toContain("remove_avatar");
  });
  it("offers nothing on a resolved report", () => {
    expect(reportActions(row({ status: "actioned" }))).toEqual([]);
  });
  it("confirms every action but Dismiss", () => {
    expect(needsConfirm("dismiss")).toBe(false);
    expect(needsConfirm("hide_workout")).toBe(true);
    expect(needsConfirm("disable_social")).toBe(true);
  });
});

describe("canUnhide", () => {
  it("shows on any report whose workout is hidden", () => {
    expect(canUnhide(row({ workout_hidden: true, status: "actioned" }))).toBe(true);
    expect(canUnhide(row({ workout_hidden: false }))).toBe(false);
    expect(canUnhide(row({ target_workout_id: null, workout_hidden: true }))).toBe(false);
  });
});

describe("profile photos", () => {
  const URL = "https://lh3.googleusercontent.com/a/x=s96-c";
  const avatar = (over = {}) => ({
    avatar_url: URL,
    avatar_status: "ok",
    avatar_hidden: false,
    avatar_removed_at: null,
    ...over,
  });

  it("reads an auto-flagged photo", () => {
    const r = row({
      reason: "auto_flag",
      reporter_id: null,
      detail: { field: "avatar", avatar_url: URL, categories: ["sexual"] },
    });
    expect(flaggedAvatar(r)).toBe(URL);
    expect(reasonLabel(r.reason, r.detail)).toBe("Auto-flag: profile photo");
    expect(flaggedAvatar(row({ detail: { field: "avatar", avatar_url: URL } }))).toBeNull();
    expect(reasonLabel("auto_flag", { field: "username", username: "x" })).toBe("Auto-flag");
  });

  it("knows when there is a photo to remove", () => {
    expect(hasPhoto(avatar())).toBe(true);
    expect(hasPhoto(avatar({ avatar_url: null }))).toBe(false);
    expect(hasPhoto(avatar({ avatar_removed_at: "2026-11-20T00:00:00Z" }))).toBe(false);
    expect(hasPhoto(null)).toBe(false);
  });

  it("labels a photo friends do not see", () => {
    expect(avatarStatusLabel(avatar())).toBeNull();
    expect(avatarStatusLabel(avatar({ avatar_status: "pending" }))).toBe("pending");
    expect(avatarStatusLabel(avatar({ avatar_status: "flagged" }))).toBe("flagged");
    expect(avatarStatusLabel(avatar({ avatar_hidden: true }))).toBe("hidden by user");
    expect(avatarStatusLabel(avatar({ avatar_removed_at: "2026-11-20T00:00:00Z" }))).toBe("removed");
    expect(avatarStatusLabel(avatar({ avatar_url: null }))).toBeNull();
  });
});
