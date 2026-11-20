import type { Database } from "@liftcamp/shared";

/**
 * The /admin Reports queue's rules (docs/social-v1-spec.md, Web): which
 * reports a pill shows, how a reason reads, which actions a report offers,
 * and the 24-hour clock. The section in routes/admin.tsx draws these.
 */

export type ReportRow = Database["public"]["Functions"]["admin_list_reports"]["Returns"][number];

export type ReportFilter = "open" | "resolved" | "all";

export const REPORT_FILTERS: { key: ReportFilter; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "resolved", label: "Resolved" },
  { key: "all", label: "All" },
];

/** admin_list_reports' p_status for a pill. Resolved reads everything and filters here. */
export function statusParam(filter: ReportFilter): "open" | null {
  return filter === "open" ? "open" : null;
}

/** The rows a pill shows, oldest first so the 24-hour clock reads top down. */
export function filterReports(rows: readonly ReportRow[], filter: ReportFilter): ReportRow[] {
  const kept =
    filter === "open"
      ? rows.filter((r) => r.status === "open")
      : filter === "resolved"
        ? rows.filter((r) => r.status === "dismissed" || r.status === "actioned")
        : [...rows];
  return kept.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** An open report filed more than a day ago. */
export function overDue(row: Pick<ReportRow, "status" | "created_at">, now: number): boolean {
  return row.status === "open" && now - Date.parse(row.created_at) > DAY_MS;
}

type Detail = { field?: unknown; username?: unknown; avatar_url?: unknown; categories?: unknown };

function detailOf(row: Pick<ReportRow, "detail">): Detail {
  const d = row.detail;
  return d && typeof d === "object" && !Array.isArray(d) ? (d as Detail) : {};
}

/** The categories the moderation check flagged, from `detail`. */
export function flaggedCategories(row: Pick<ReportRow, "detail">): string[] {
  const c = detailOf(row).categories;
  return Array.isArray(c) ? c.filter((x): x is string => typeof x === "string") : [];
}

/** For an auto-flagged username: the name the check saw, which may since have changed. */
export function flaggedUsername(row: Pick<ReportRow, "reason" | "detail">): string | null {
  if (row.reason !== "auto_flag") return null;
  const d = detailOf(row);
  return d.field === "username" && typeof d.username === "string" ? d.username : null;
}

/** For an auto-flagged profile photo: the photo the check saw, which may since have changed. */
export function flaggedAvatar(row: Pick<ReportRow, "reason" | "detail">): string | null {
  if (row.reason !== "auto_flag") return null;
  const d = detailOf(row);
  return d.field === "avatar" && typeof d.avatar_url === "string" ? d.avatar_url : null;
}

/**
 * "Auto-flag" for the moderation check's reports ("Auto-flag: profile
 * photo" for a photo), otherwise the reason capitalised.
 */
export function reasonLabel(reason: string, detail?: ReportRow["detail"]): string {
  if (reason === "auto_flag") {
    return flaggedAvatar({ reason, detail: detail ?? null }) ? "Auto-flag: profile photo" : "Auto-flag";
  }
  return reason.charAt(0).toUpperCase() + reason.slice(1);
}

export type ReportAction =
  | "dismiss"
  | "hide_workout"
  | "reset_username"
  | "remove_photo"
  | "remove_follow"
  | "disable_social";

export const ACTION_LABELS: Record<ReportAction, string> = {
  dismiss: "Dismiss",
  hide_workout: "Hide workout",
  reset_username: "Reset username",
  remove_photo: "Remove photo",
  remove_follow: "Remove follow",
  disable_social: "Disable social",
};

/** Every action asks to confirm except Dismiss. */
export function needsConfirm(action: ReportAction): boolean {
  return action !== "dismiss";
}

/**
 * The actions an open report offers, in button order. A resolved report
 * offers none. Remove photo needs `hasPhoto`: the target has a photo an
 * admin has not removed (see `hasPhoto`).
 */
export function reportActions(
  row: Pick<
    ReportRow,
    "status" | "target_workout_id" | "workout_hidden" | "target_user_id" | "reporter_id"
  >,
  hasPhoto = false,
): ReportAction[] {
  if (row.status !== "open") return [];
  const out: ReportAction[] = ["dismiss"];
  if (row.target_workout_id && !row.workout_hidden) out.push("hide_workout");
  if (row.target_user_id) out.push("reset_username");
  if (row.target_user_id && hasPhoto) out.push("remove_photo");
  if (row.reporter_id) out.push("remove_follow");
  if (row.target_user_id) out.push("disable_social");
  return out;
}

/** Unhide shows on any report, open or not, whose workout is hidden. */
export function canUnhide(row: Pick<ReportRow, "target_workout_id" | "workout_hidden">): boolean {
  return !!row.target_workout_id && row.workout_hidden;
}

/** A reported person's photo, from admin_user_avatar (docs/profile-photos.sql, Section 6). */
export type UserAvatar = {
  avatar_url: string | null;
  avatar_status: string | null;
  avatar_hidden: boolean;
  avatar_removed_at: string | null;
};

/** Whether the person has a photo an admin could still remove. */
export function hasPhoto(avatar: UserAvatar | null | undefined): boolean {
  return !!avatar?.avatar_url && !avatar.avatar_removed_at;
}

/**
 * Small text beside the photo when friends do not see it: removed by an
 * admin, hidden by its owner, flagged, or waiting for the check. Null when
 * it shows (ok) or there is no photo.
 */
export function avatarStatusLabel(avatar: UserAvatar | null | undefined): string | null {
  if (!avatar?.avatar_url) return null;
  if (avatar.avatar_removed_at) return "removed";
  if (avatar.avatar_hidden) return "hidden by user";
  if (avatar.avatar_status === "flagged") return "flagged";
  if (avatar.avatar_status !== "ok") return "pending";
  return null;
}
