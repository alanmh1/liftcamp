import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BackLink } from "@/components/BackLink";
import { cn } from "@/lib/utils";
import { isInternalDevice, setInternalDevice } from "@/lib/pageviews";
import {
  SortableHeader,
  relativeTime,
  useSortedRows,
  useTableSort,
} from "@/components/admin/SortableHeader";
import { useServerFn } from "@tanstack/react-start";
import { FeatureFlagsSection } from "@/components/admin/FeatureFlagsSection";
import { ADMIN_SOURCES, STAGES, USER_SOURCES, sourceLabel } from "@liftcamp/shared";
import {
  migrateExerciseImages,
  type MigrateResult,
} from "@/lib/migrate-images.functions";


export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin · LiftCamp" },
      { name: "description", content: "Internal LiftCamp usage dashboard." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

type Overview = {
  total_users: number;
  new_users_7d: number;
  new_users_30d: number;
  active_7d: number;
  active_30d: number;
  // The same counts split by account type. A guest is is_anonymous or has no
  // email, the same rule admin_users() filters on.
  signed_up_users: number;
  guest_users: number;
  new_signed_up_7d: number;
  new_guests_7d: number;
  new_signed_up_30d: number;
  new_guests_30d: number;
  active_signed_up_7d: number;
  active_guests_7d: number;
  active_signed_up_30d: number;
  active_guests_30d: number;
  total_workouts: number;
  finished_workouts: number;
  workouts_7d: number;
  total_sets: number;
  completed_sets: number;
  distinct_exercises: number;
  failed_starts_7d: number;
  top_exercises: { name: string; slug: string; uses: number; users: number }[];
  daily: { day: string; workouts: number; users: number }[];
  recent_failures: { created_at: string; props: Record<string, unknown> }[];
};

type Traffic = {
  pageviews: number;
  visitors: number;
  internal_pageviews: number;
  excluded?: { automated: number; internal: number };
  daily: { day: string; pageviews: number; visitors: number }[];
  top_pages: { path: string; views: number; visitors: number }[];
  top_sources: { source: string; visits: number }[];
  campaigns: { source: string; visits: number; views: number }[];
  devices: { device: string; visits: number }[];
};

/** Engagement with the public routine pages and the builder. Kept separate
 *  from Traffic because most of it is anonymous: app_events is RLS-scoped to a
 *  signed-in user, so page_views is the only signal for a stranger reading a
 *  routine page or filling in the builder. */
type Routines = {
  index_views: number;
  index_visitors: number;
  detail_views: number;
  detail_visitors: number;
  builder_views: number;
  builder_visitors: number;
  builder_signups: number;
  routines_saved: number;
  routines_saved_total: number;
  routines_shared: number;
  system_routine_starts: number;
  daily: { day: string; index_views: number; builder_views: number; detail_views: number }[];
  top_routines: { path: string; views: number; visitors: number }[];
  routine_starts: { template: string; is_system: boolean; starts: number; users: number }[];
};


/** What admin_funnel() returns (docs/funnel-admin.sql). */
type Funnel = {
  since: string;
  installs: { total: number; recorded_from: string | null };
  cohort: {
    accounts: number;
    guests: number;
    onboarded: number;
    started_workout: number;
    logged_set: number;
    finished_workout: number;
    second_workout: number;
    signed_up: number;
    week2_eligible: number;
    week2_return: number;
    median_hours_open_to_first: number | null;
  };
  onboarding: {
    target: number;
    prefs: number;
    routines: number;
    finished_routine: number;
    finished_skip: number;
    recorded_from: string | null;
  };
  daily: { day: string; installs: number; accounts: number }[];
};

/** One row of admin_people() (docs/funnel-people.sql). */
type PersonRow = {
  user_id: string;
  email: string | null;
  kind: string;
  is_team: boolean;
  joined_at: string;
  source: string | null;
  source_detail: string | null;
  source_set_by: string | null;
  stage: number;
  routines: number;
  workouts: number;
  finished: number;
  sets_done: number;
  last_seen: string | null;
  platform: string | null;
  app_version: string | null;
};

/** The App Store launch. admin_funnel() defaults to it; People passes it. */
const LAUNCH = "2026-10-13T00:00:00Z";

const DAY_MS = 24 * 60 * 60 * 1000;

function fmtDate(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

/** Footnote under the daily chart telling you what the numbers left out. */
function ExcludedNote({ excluded }: { excluded?: { automated: number; internal: number } }) {
  const parts: string[] = [];
  if (excluded?.automated) parts.push(`${excluded.automated.toLocaleString()} automated sessions`);
  if (excluded?.internal) parts.push(`${excluded.internal.toLocaleString()} internal sessions`);
  if (parts.length === 0) return null;
  return (
    <p className="mt-2 text-[13px] text-muted-foreground">Excluded {parts.join(" and ")}.</p>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-display mt-1 text-2xl leading-none">{value}</p>
      {hint ? <p className="mt-1 text-[13px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/**
 * The app shell caps every route at 480px, which is right for the phone-first
 * product and wrong for a dashboard. Rather than touch the shared layout, the
 * admin route breaks out of it to the viewport and re-bounds itself at 1600px.
 * overflow-x-hidden keeps the 100vw breakout from producing a page-level
 * sideways scrollbar on platforms with classic scrollbars.
 */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="max-w-[100vw] overflow-x-hidden"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      <div className="mx-auto w-full max-w-[1600px] px-4 pb-16 pt-4 sm:px-6">{children}</div>
    </div>
  );
}

type EntitlementRow = {
  email: string;
  user_id: string;
  is_pro: boolean;
  source: string;
  expires_at: string | null;
  updated_at: string;
};

/** The end of a picked calendar day in the admin's own time zone, as an ISO instant. */
function endOfDay(date: string): string {
  return new Date(`${date}T23:59:59`).toISOString();
}

/**
 * Tester Pro grants. Lists every user_entitlements row and grants or
 * revokes a tester's row by email through admin_set_entitlement, which
 * does its own admin check and refuses to touch a purchased or promotional
 * row. Whatever the function raises is shown as is.
 */
function ProAccessSection() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [expiry, setExpiry] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const grants = useQuery({
    queryKey: ["admin-entitlements"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_entitlements");
      if (error) throw error;
      return (data ?? []) as EntitlementRow[];
    },
  });

  async function setEntitlement(target: string, isPro: boolean, expiresAt: string | null) {
    setBusy(isPro ? "grant" : target);
    setError(null);
    const { error } = await supabase.rpc("admin_set_entitlement", {
      p_email: target,
      p_is_pro: isPro,
      // Left out for no expiry: the parameter defaults to null in SQL, and
      // the generated type takes a string or nothing.
      ...(expiresAt ? { p_expires_at: expiresAt } : {}),
    });
    setBusy(null);
    if (error) {
      setError(error.message);
      return false;
    }
    await queryClient.invalidateQueries({ queryKey: ["admin-entitlements"] });
    return true;
  }

  async function onGrant(e: React.FormEvent) {
    e.preventDefault();
    const ok = await setEntitlement(email.trim(), true, expiry ? endOfDay(expiry) : null);
    if (ok) {
      setEmail("");
      setExpiry("");
    }
  }

  const now = Date.now();

  return (
    <section className="mt-8">
      <h2 className="font-display text-xl">Pro access</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Tester grants open Pro progression in any build. Purchases are listed but managed in RevenueCat.
      </p>

      <form onSubmit={onGrant} className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-[13px] text-muted-foreground">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tester@example.com"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 text-[13px] text-muted-foreground">
          Expires (optional)
          <input
            type="date"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <button
          type="submit"
          disabled={busy !== null || email.trim() === ""}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy === "grant" ? "Granting…" : "Grant Pro"}
        </button>
      </form>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <div className="mt-3 w-full max-w-full overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-secondary text-left text-[13px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Source</th>
              <th className="px-3 py-2 font-medium">Expires</th>
              <th className="px-3 py-2 font-medium">Updated</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {grants.isLoading ? (
              <tr className="border-t border-border">
                <td colSpan={5} className="px-3 py-2 text-muted-foreground">Loading…</td>
              </tr>
            ) : grants.error ? (
              <tr className="border-t border-border">
                <td colSpan={5} className="px-3 py-2 text-destructive">{(grants.error as Error).message}</td>
              </tr>
            ) : (grants.data ?? []).length === 0 ? (
              <tr className="border-t border-border">
                <td colSpan={5} className="px-3 py-2 text-muted-foreground">No grants yet.</td>
              </tr>
            ) : (
              (grants.data ?? []).map((g) => {
                const expired = g.expires_at != null && Date.parse(g.expires_at) <= now;
                const tester = g.source === "tester";
                return (
                  <tr key={g.user_id} className="border-t border-border">
                    <td className="px-3 py-2">
                      {g.email}
                      {!g.is_pro && <span className="ml-2 text-[13px] text-muted-foreground">not Pro</span>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{g.source}</td>
                    <td className={cn("px-3 py-2", expired ? "text-destructive" : "text-muted-foreground")}>
                      {g.expires_at ? `${fmtDate(g.expires_at)}${expired ? " (expired)" : ""}` : "No expiry"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground" title={new Date(g.updated_at).toLocaleString()}>
                      {relativeTime(g.updated_at)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => void setEntitlement(g.email, false, null)}
                        disabled={busy !== null || !tester}
                        title={tester ? undefined : "Not a tester grant. Manage it in RevenueCat."}
                        className="rounded-md border border-input px-3 py-1 text-[13px] disabled:opacity-50"
                      >
                        {busy === g.email ? "Revoking…" : "Revoke"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type UserSummary = {
  user_id: string;
  email: string;
  username: string | null;
  created_at: string;
  workout_count: number;
  last_workout_at: string | null;
  entitlement_source: string | null;
  is_admin: boolean;
};

type DeleteUserResult = {
  user_id: string;
  email: string;
  username: string | null;
  workouts_deleted: number;
};

const SMALL_NUMBERS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
];

/** A count inside a sentence: spelled out under 10, digits from 10 up. */
function countWords(n: number, noun: string): string {
  const num = n >= 0 && n < 10 ? SMALL_NUMBERS[n] : n.toLocaleString();
  return `${num} ${noun}${n === 1 ? "" : "s"}`;
}

/** Capitalises the first letter, for a count that opens a sentence. */
function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Deletes a signed-up account. Looks it up by email through
 * admin_user_summary, then deletes it through admin_delete_user once the
 * admin has typed its username (its email when it has none). Both functions
 * do their own admin check, and admin_delete_user refuses your own account,
 * an admin, and anyone with Pro from a purchase. Whatever they raise is
 * shown as is.
 */
function DeleteUserSection() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [summary, setSummary] = useState<UserSummary | null>(null);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState<"lookup" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // What has to be typed: the username, or the email for an account without one.
  const confirmTarget = summary ? (summary.username ?? summary.email) : "";
  const confirmMatches =
    confirmTarget !== "" && confirm.trim().toLowerCase() === confirmTarget.trim().toLowerCase();

  async function onLookup(e: React.FormEvent) {
    e.preventDefault();
    setBusy("lookup");
    setError(null);
    setDone(null);
    setSummary(null);
    setConfirm("");
    const { data, error } = await supabase.rpc("admin_user_summary", { p_email: email.trim() });
    setBusy(null);
    if (error) {
      setError(error.message);
      return;
    }
    setSummary(data as UserSummary);
  }

  async function onDelete() {
    if (!summary || !confirmMatches) return;
    setBusy("delete");
    setError(null);
    const { data, error } = await supabase.rpc("admin_delete_user", {
      p_email: summary.email,
      p_confirm_username: confirm.trim(),
    });
    setBusy(null);
    if (error) {
      setError(error.message);
      return;
    }
    const result = data as DeleteUserResult;
    setEmail("");
    setSummary(null);
    setConfirm("");
    setDone(
      `Deleted ${result.username ?? result.email}. ${capitalise(countWords(result.workouts_deleted, "workout"))} removed.`,
    );
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-entitlements"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-people"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
    ]);
  }

  return (
    <section className="mt-8">
      <h2 className="font-display text-xl">Delete user</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Deletes a signed-up account and everything it owns. Admins and purchased Pro are refused
        here.
      </p>

      <form
        onSubmit={onLookup}
        className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4"
      >
        <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-[13px] text-muted-foreground">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="someone@example.com"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <button
          type="submit"
          disabled={busy !== null || email.trim() === ""}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy === "lookup" ? "Looking up…" : "Look up"}
        </button>
      </form>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      {done && <p className="mt-3 text-sm text-muted-foreground">{done}</p>}

      {summary && (
        <div className="mt-3 rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{summary.username ?? "No username"}</span>
            {summary.is_admin && (
              <span className="rounded-md border border-input px-2 py-0.5 text-[13px] text-muted-foreground">
                Admin
              </span>
            )}
          </div>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="min-w-0 break-all">{summary.email}</dd>
            <dt className="text-muted-foreground">Joined</dt>
            <dd>{fmtDate(summary.created_at)}</dd>
            <dt className="text-muted-foreground">Workouts</dt>
            <dd>
              <span className="tabular-nums">{summary.workout_count.toLocaleString()}</span>
              {summary.last_workout_at && (
                <span className="ml-2 text-muted-foreground">
                  last on {fmtDate(summary.last_workout_at)}
                </span>
              )}
            </dd>
            <dt className="text-muted-foreground">Pro</dt>
            <dd>{summary.entitlement_source ?? "None"}</dd>
          </dl>

          <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4">
            <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-[13px] text-muted-foreground">
              {summary.username ? "Type the username to confirm" : "Type the email to confirm"}
              <input
                type="text"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
            <button
              type="button"
              onClick={() => void onDelete()}
              disabled={busy !== null || !confirmMatches}
              className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground disabled:opacity-50"
            >
              {busy === "delete" ? "Deleting…" : "Delete user"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/** A pill toggle in the style of the page's day range control. */
function Pills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-input text-[13px]">
      {options.map((opt, i) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={cn(
            "px-3 py-1.5",
            i > 0 && "border-l border-input",
            value === opt.key ? "bg-accent font-semibold" : "text-muted-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** A count as a share of the one before it, or an en dash when that is 0. */
function pctOf(n: number, prev: number): string {
  return prev > 0 ? `${Math.round((n / prev) * 100)}%` : "–";
}

type FunnelRange = "launch" | "30" | "7";

const FUNNEL_RANGES: { key: FunnelRange; label: string }[] = [
  { key: "launch", label: "Since launch" },
  { key: "30", label: "30 days" },
  { key: "7", label: "7 days" },
];

/**
 * Where new users drop off, from admin_funnel(). Installs and onboarding
 * pages come from app events that start with the build that sends them;
 * the workout stages come from the workout tables and cover the whole range.
 */
function FunnelSection() {
  const [range, setRange] = useState<FunnelRange>("launch");

  const funnel = useQuery({
    queryKey: ["admin-funnel", range],
    queryFn: async () => {
      // Since launch is the function's own default, so it gets null.
      const since =
        range === "launch" ? null : new Date(Date.now() - Number(range) * DAY_MS).toISOString();
      const { data, error } = await supabase.rpc("admin_funnel", { _since: since });
      if (error) throw error;
      return data as unknown as Funnel;
    },
  });

  const f = funnel.data;

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl">Funnel</h2>
        <Pills options={FUNNEL_RANGES} value={range} onChange={setRange} />
      </div>

      {funnel.error ? (
        <p className="mt-4 text-sm text-destructive">
          Could not load the funnel: {(funnel.error as Error).message}
        </p>
      ) : funnel.isLoading || !f ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading funnel…</p>
      ) : (
        <FunnelBody f={f} />
      )}
    </section>
  );
}

function FunnelBody({ f }: { f: Funnel }) {
  const c = f.cohort;
  const o = f.onboarding;
  const stages: [string, number][] = [
    ["Opened the app", f.installs.total],
    ["Tapped Get started", c.accounts],
    ["Finished onboarding", c.onboarded],
    ["Started a workout", c.started_workout],
    ["Logged a set", c.logged_set],
    ["Finished a workout", c.finished_workout],
    ["Second workout", c.second_workout],
  ];
  const finished = o.finished_routine + o.finished_skip;
  const pages: [string, number, string | null][] = [
    ["Welcome", f.installs.total, null],
    ["Weekly target", o.target, null],
    ["Level and equipment", o.prefs, null],
    ["Routine picks", o.routines, null],
    ["Finished", finished, `${o.finished_routine} chose a routine, ${o.finished_skip} skipped`],
  ];
  const median = c.median_hours_open_to_first;

  return (
    <>
      <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Stages</h3>
          <StageTable rows={stages.map(([label, n]) => ({ label, n }))} />
          <div className="mt-2 space-y-0.5 text-[13px] text-muted-foreground">
            <p>
              Week 2 return: <span className="tabular-nums">{c.week2_return}</span> of{" "}
              <span className="tabular-nums">{c.week2_eligible}</span> eligible
            </p>
            {median != null && (
              <p>
                Median open to first workout:{" "}
                <span className="tabular-nums">
                  {median < 10 ? median.toFixed(1) : Math.round(median)}
                </span>{" "}
                h
              </p>
            )}
            <p>
              <span className="tabular-nums">{c.signed_up}</span> of{" "}
              <span className="tabular-nums">{c.accounts}</span> accounts have a sign-in
            </p>
          </div>
        </div>

        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Onboarding dropoff</h3>
          <StageTable rows={pages.map(([label, n, sub]) => ({ label, n, sub }))} />
        </div>
      </div>

      <div className="mt-4 h-56 w-full rounded-lg border border-border bg-card p-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={f.daily}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            <XAxis
              dataKey="day"
              tickFormatter={(d: string) => fmtDate(d)}
              tick={{ fontSize: 11 }}
              minTickGap={24}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
            <Tooltip
              labelFormatter={(d) => fmtDate(String(d))}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="installs" name="Installs" fill="var(--primary)" radius={[3, 3, 0, 0]} />
            <Bar
              dataKey="accounts"
              name="New accounts"
              fill="var(--chip-gold-fg)"
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-2 text-[13px] text-muted-foreground">
        Installs {recordedFrom(f.installs.recorded_from)}. Onboarding pages{" "}
        {recordedFrom(o.recorded_from)}. Workout stages cover the whole range.
      </p>
    </>
  );
}

/** When an event-backed count starts, for the caveat under the funnel. */
function recordedFrom(from: string | null): string {
  return from
    ? `recorded from ${fmtDate(from)}`
    : "not recorded yet; ships with the next app update";
}

/** Stage, count, and the share of the row above, for the funnel's two tables. */
function StageTable({ rows }: { rows: { label: string; n: number; sub?: string | null }[] }) {
  return (
    <div className="mt-2 w-full max-w-full overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[320px] text-sm">
        <thead className="bg-secondary text-left text-[13px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Stage</th>
            <th className="px-3 py-2 text-right font-medium">Count</th>
            <th className="px-3 py-2 text-right font-medium">Of previous</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.label} className="border-t border-border">
              <td className="px-3 py-2">
                {r.label}
                {r.sub && <p className="text-[13px] text-muted-foreground">{r.sub}</p>}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{r.n.toLocaleString()}</td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                {i === 0 ? "" : pctOf(r.n, rows[i - 1].n)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type PeopleRange = "launch" | "all";

const PEOPLE_RANGES: { key: PeopleRange; label: string }[] = [
  { key: "launch", label: "Since launch" },
  { key: "all", label: "All time" },
];

const KIND_LABELS: Record<string, string> = {
  guest: "Guest",
  email: "Email",
  apple: "Apple",
  google: "Google",
};

const CHIP = "inline-flex items-center rounded-md border px-2 py-0.5 text-[13px] whitespace-nowrap";

/** Stages 0 and 1 muted, 2 and 3 plain, 4 and 5 in the accent. */
function stageChipClass(stage: number): string {
  if (stage >= 4)
    return cn(CHIP, "border-transparent bg-accent text-accent-foreground font-semibold");
  if (stage >= 2) return cn(CHIP, "border-input text-foreground");
  return cn(CHIP, "border-input text-muted-foreground");
}

/** "ios 1.1.0 (18)", or blank with no workout to read it from. */
function appLabel(r: PersonRow): string {
  return [r.platform, r.app_version].filter(Boolean).join(" ");
}

/**
 * Every account, guests included, with how far each got and where it came
 * from. Stages and counts come from admin_people(); the source is the
 * person's own answer or an admin tag, set here through admin_set_source.
 */
function PeopleSection() {
  const queryClient = useQueryClient();
  const [range, setRange] = useState<PeopleRange>("launch");
  const [showTeam, setShowTeam] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const people = useQuery({
    queryKey: ["admin-people", range],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_people", {
        _since: range === "launch" ? LAUNCH : null,
      });
      if (error) throw error;
      return (data ?? []) as PersonRow[];
    },
  });

  const all = people.data ?? [];
  const visible = showTeam ? all : all.filter((r) => !r.is_team);
  const hiddenTeam = all.length - visible.length;

  const sort = useTableSort<
    | "who"
    | "source"
    | "joined_at"
    | "stage"
    | "workouts"
    | "sets_done"
    | "finished"
    | "last_seen"
    | "app"
  >({ key: "joined_at", dir: "desc" });
  const rows = useSortedRows(visible, sort.sort, {
    who: (r) => r.email ?? `Guest ${r.user_id}`,
    source: (r) => sourceLabel(r.source),
    joined_at: (r) => new Date(r.joined_at),
    stage: (r) => r.stage,
    workouts: (r) => r.workouts,
    sets_done: (r) => r.sets_done,
    finished: (r) => r.finished,
    last_seen: (r) => (r.last_seen ? new Date(r.last_seen) : null),
    app: (r) => appLabel(r) || null,
  });

  async function onSaved() {
    setEditing(null);
    await queryClient.invalidateQueries({ queryKey: ["admin-people"] });
  }

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl">People</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Pills options={PEOPLE_RANGES} value={range} onChange={setRange} />
          <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <input
              type="checkbox"
              checked={showTeam}
              onChange={(e) => setShowTeam(e.target.checked)}
            />
            Show team
          </label>
        </div>
      </div>

      {people.error ? (
        <p className="mt-4 text-sm text-destructive">
          Could not load people: {(people.error as Error).message}
        </p>
      ) : people.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading people…</p>
      ) : (
        <>
          {/* Cumulative: each count is everyone at or past that stage. */}
          <p className="mt-3 text-[13px] text-muted-foreground">
            {STAGES.map((st, i) => (
              <span key={st.key}>
                {i > 0 && " · "}
                {st.label}{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {visible.filter((r) => r.stage >= st.stage).length}
                </span>
              </span>
            ))}
          </p>

          <div className="mt-2 w-full max-w-full overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[1080px] text-sm">
              <thead className="bg-secondary text-left text-[13px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <SortableHeader label="Who" sortKey="who" sort={sort.sort} onSort={sort.toggle} />
                  <SortableHeader
                    label="Source"
                    sortKey="source"
                    sort={sort.sort}
                    onSort={sort.toggle}
                  />
                  <SortableHeader
                    label="Joined"
                    sortKey="joined_at"
                    sort={sort.sort}
                    onSort={sort.toggle}
                  />
                  <SortableHeader
                    label="Stage"
                    sortKey="stage"
                    sort={sort.sort}
                    onSort={sort.toggle}
                  />
                  <SortableHeader
                    label="Workouts"
                    sortKey="workouts"
                    sort={sort.sort}
                    onSort={sort.toggle}
                    align="right"
                  />
                  <SortableHeader
                    label="Sets done"
                    sortKey="sets_done"
                    sort={sort.sort}
                    onSort={sort.toggle}
                    align="right"
                  />
                  <SortableHeader
                    label="Finished"
                    sortKey="finished"
                    sort={sort.sort}
                    onSort={sort.toggle}
                    align="right"
                  />
                  <SortableHeader
                    label="Last seen"
                    sortKey="last_seen"
                    sort={sort.sort}
                    onSort={sort.toggle}
                  />
                  <SortableHeader label="App" sortKey="app" sort={sort.sort} onSort={sort.toggle} />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr className="border-t border-border">
                    <td colSpan={9} className="px-3 py-2 text-muted-foreground">
                      No accounts in this range.
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.user_id} className="border-t border-border align-top">
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {r.kind === "guest" || !r.email ? (
                          <span>
                            Guest{" "}
                            <span className="font-mono text-[13px] text-muted-foreground">
                              {r.user_id.slice(0, 8)}
                            </span>
                          </span>
                        ) : (
                          <span className="break-all">{r.email}</span>
                        )}
                        <span className={cn(CHIP, "border-input text-muted-foreground")}>
                          {KIND_LABELS[r.kind] ?? r.kind}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {editing === r.user_id ? (
                        <SourceEditor row={r} onCancel={() => setEditing(null)} onSaved={onSaved} />
                      ) : r.source ? (
                        <button
                          type="button"
                          onClick={() => setEditing(r.user_id)}
                          title={
                            r.source_detail
                              ? `${r.source_set_by === "user" ? "said" : "tagged"}: ${r.source_detail}`
                              : undefined
                          }
                          className={cn(CHIP, "border-input text-foreground hover:bg-accent")}
                        >
                          {sourceLabel(r.source)}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditing(r.user_id)}
                          className="whitespace-nowrap text-[13px] text-muted-foreground underline-offset-2 hover:underline"
                        >
                          Set source
                        </button>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {fmtDate(r.joined_at)}
                    </td>
                    <td className="px-3 py-2">
                      <span className={stageChipClass(r.stage)}>
                        {STAGES[r.stage]?.label ?? r.stage}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.workouts}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.sets_done}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.finished}</td>
                    <td
                      className={cn(
                        "whitespace-nowrap px-3 py-2",
                        r.last_seen ? "text-foreground" : "text-muted-foreground",
                      )}
                      title={r.last_seen ? new Date(r.last_seen).toLocaleString() : undefined}
                    >
                      {relativeTime(r.last_seen)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-[13px] text-muted-foreground tabular-nums">
                      {appLabel(r)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!showTeam && hiddenTeam > 0 && (
            <p className="mt-2 text-[13px] text-muted-foreground">
              {hiddenTeam.toLocaleString()} team {hiddenTeam === 1 ? "row" : "rows"} hidden
            </p>
          )}
        </>
      )}
    </section>
  );
}

/** The inline Source editor: app sources then admin ones, an optional note. */
function SourceEditor({
  row,
  onCancel,
  onSaved,
}: {
  row: PersonRow;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const [source, setSource] = useState<string>(row.source ?? USER_SOURCES[0].key);
  const [detail, setDetail] = useState(row.source_detail ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: string | null) {
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("admin_set_source", {
      p_user_id: row.user_id,
      p_source: next,
      p_detail: next && detail.trim() ? detail.trim() : null,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    await onSaved();
  }

  return (
    <div className="flex min-w-[220px] flex-col gap-2">
      <select
        value={source}
        onChange={(e) => setSource(e.target.value)}
        className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
      >
        <optgroup label="In the app">
          {USER_SOURCES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </optgroup>
        <optgroup label="Admin">
          {ADMIN_SOURCES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </optgroup>
      </select>
      <input
        type="text"
        value={detail}
        maxLength={200}
        onChange={(e) => setDetail(e.target.value)}
        placeholder="note, optional"
        className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void save(source)}
          disabled={busy}
          className="rounded-md bg-primary px-3 py-1 text-[13px] font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-md border border-input px-3 py-1 text-[13px] disabled:opacity-50"
        >
          Cancel
        </button>
        {row.source && (
          <button
            type="button"
            onClick={() => void save(null)}
            disabled={busy}
            className="ml-auto text-[13px] text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
          >
            Clear
          </button>
        )}
      </div>
      {error && <p className="text-[13px] text-destructive">{error}</p>}
    </div>
  );
}
function AdminPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [user, loading, navigate]);

  const isAdmin = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("current_user_is_admin");
      if (error) throw error;
      return data === true;
    },
  });

  // One range control drives both the workouts chart and the traffic panels, so
  // the two are never read side by side over different windows.
  const [days, setDays] = useState(30);
  const [excludeInternal, setExcludeInternal] = useState(true);
  const [anonymousOnly, setAnonymousOnly] = useState(false);
  const [internalDevice, setInternalDeviceState] = useState(false);
  useEffect(() => setInternalDeviceState(isInternalDevice()), []);

  // Manual, click-per-batch image migration. Not in a query on purpose: it
  // must only run when the button is pressed.
  const runMigration = useServerFn(migrateExerciseImages);
  const [migrationBusy, setMigrationBusy] = useState(false);
  const [migrationResult, setMigrationResult] = useState<MigrateResult | null>(null);
  const [migrationError, setMigrationError] = useState<string | null>(null);
  const onMigrate = async () => {
    setMigrationBusy(true);
    setMigrationError(null);
    try {
      setMigrationResult(await runMigration());
    } catch (e) {
      setMigrationError(e instanceof Error ? e.message : String(e));
    } finally {
      setMigrationBusy(false);
    }
  };

  const overview = useQuery({
    queryKey: ["admin-overview", days],
    enabled: isAdmin.data === true,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_overview", { _days: days });
      if (error) throw error;
      return data as unknown as Overview;
    },
  });

  const traffic = useQuery({
    queryKey: ["admin-traffic", days, excludeInternal, anonymousOnly],
    enabled: isAdmin.data === true,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_traffic", {
        _days: days,
        _exclude_internal: excludeInternal,
        _anonymous_only: anonymousOnly,
      });
      if (error) throw error;
      return data as unknown as Traffic;
    },
  });

  const routines = useQuery({
    queryKey: ["admin-routines", days, excludeInternal],
    enabled: isAdmin.data === true,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_routines", {
        _days: days,
        _exclude_internal: excludeInternal,
      });
      if (error) throw error;
      return data as unknown as Routines;
    },
  });


  // Per-table sort state. Defaults match what each table showed before.
  const pagesSort = useTableSort<"path" | "views" | "visitors">({ key: "views", dir: "desc" });
  const sourcesSort = useTableSort<"source" | "visits">({ key: "visits", dir: "desc" });
  const campaignsSort = useTableSort<"source" | "visits" | "views">({ key: "visits", dir: "desc" });
  const topPages = useSortedRows(traffic.data?.top_pages ?? [], pagesSort.sort, {
    path: (r) => r.path,
    views: (r) => r.views,
    visitors: (r) => r.visitors,
  });
  const topSources = useSortedRows(traffic.data?.top_sources ?? [], sourcesSort.sort, {
    source: (r) => r.source,
    visits: (r) => r.visits,
  });
  const campaigns = useSortedRows(traffic.data?.campaigns ?? [], campaignsSort.sort, {
    source: (r) => r.source,
    visits: (r) => r.visits,
    views: (r) => r.views,
  });
  if (loading || isAdmin.isLoading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  }

  if (isAdmin.data !== true) {
    return (
      <div className="p-6">
        <BackLink to="/" label="Home" />
        <h1 className="font-display mt-4 text-2xl">Not available</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This page is limited to LiftCamp admins.
        </p>
      </div>
    );
  }

  const o = overview.data;

  return (
    <Shell>
      <BackLink to="/" label="Home" />

      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <h1 className="font-display text-3xl">Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">Usage across every LiftCamp account.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex overflow-hidden rounded-md border border-input text-[13px]">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={cn(
                  "px-3 py-1.5",
                  d !== 7 && "border-l border-input",
                  days === d ? "bg-accent font-semibold" : "text-muted-foreground",
                )}
              >
                {d}d
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <input
              type="checkbox"
              checked={excludeInternal}
              onChange={(e) => setExcludeInternal(e.target.checked)}
            />
            Exclude my traffic
          </label>
          <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <input
              type="checkbox"
              checked={anonymousOnly}
              onChange={(e) => setAnonymousOnly(e.target.checked)}
            />
            Anonymous only
          </label>
        </div>
      </div>

      {overview.isLoading || !o ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading stats…</p>
      ) : (
        <>
          {/* Signed-up and guest tiles sit in matching columns at lg, so each
              guest number is directly under its signed-up counterpart. */}
          <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Accounts" value={o.signed_up_users} hint={`+${o.new_signed_up_7d} in 7d · signed up`} />
            <Stat
              label="Active 7d"
              value={o.active_signed_up_7d}
              hint={`${o.active_signed_up_30d} in 30d · signed up`}
            />
            <Stat label="New accounts 30d" value={o.new_signed_up_30d} hint="Signed up" />
            <Stat label="Workouts" value={o.total_workouts} hint={`${o.workouts_7d} in 7d`} />
            <Stat label="Guests" value={o.guest_users} hint={`+${o.new_guests_7d} in 7d`} />
            <Stat label="Active guests 7d" value={o.active_guests_7d} hint={`${o.active_guests_30d} in 30d`} />
            <Stat label="New guests 30d" value={o.new_guests_30d} />
            <Stat
              label="Finished"
              value={o.finished_workouts}
              hint={
                o.total_workouts
                  ? `${Math.round((o.finished_workouts / o.total_workouts) * 100)}% completion`
                  : undefined
              }
            />
            <Stat label="Sets logged" value={o.total_sets} hint={`${o.completed_sets} completed`} />
            <Stat label="Exercises used" value={o.distinct_exercises} />
            <Stat
              label="Failed starts 7d"
              value={o.failed_starts_7d}
              hint={o.failed_starts_7d > 0 ? "See log below" : "All clear"}
            />
          </section>

          <section className="mt-8">
            <h2 className="font-display text-xl">Workouts, last {days} days</h2>
            <div className="mt-3 h-56 w-full rounded-lg border border-border bg-card p-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={o.daily}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tickFormatter={(d: string) => fmtDate(d)}
                    tick={{ fontSize: 11 }}
                    minTickGap={24}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                  <Tooltip
                    labelFormatter={(d) => fmtDate(String(d))}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Bar dataKey="workouts" fill="var(--primary)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <FunnelSection />

          <section className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl">Site traffic</h2>
              <p className="text-[13px] text-muted-foreground">
                Last {days} days
                {anonymousOnly ? " · sessions never linked to an account" : ""}
              </p>
            </div>

            <label className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground">
              <input
                type="checkbox"
                checked={internalDevice}
                onChange={(e) => {
                  setInternalDevice(e.target.checked);
                  setInternalDeviceState(e.target.checked);
                }}
              />
              Mark this device as mine (its visits get flagged internal)
            </label>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Your own traffic also covers any session signed in with an admin account, whole
              sessions, not just single views.
            </p>

            {traffic.error ? (
              <p className="mt-4 text-sm text-destructive">
                Could not load traffic: {(traffic.error as Error).message}
              </p>
            ) : traffic.isLoading || !traffic.data ? (
              <p className="mt-4 text-sm text-muted-foreground">Loading traffic…</p>

            ) : (
              <>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Stat label="Visitors" value={traffic.data.visitors} hint={`last ${days}d`} />
                  <Stat label="Page views" value={traffic.data.pageviews} />
                  <Stat
                    label="Your own views"
                    value={traffic.data.internal_pageviews}
                    hint={excludeInternal ? "excluded above" : "included above"}
                  />
                </div>

                <div className="mt-3 h-56 w-full rounded-lg border border-border bg-card p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={traffic.data.daily}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                      <XAxis
                        dataKey="day"
                        tickFormatter={(d: string) => fmtDate(d)}
                        tick={{ fontSize: 11 }}
                        minTickGap={24}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                      <Tooltip
                        labelFormatter={(d) => fmtDate(String(d))}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Bar dataKey="visitors" fill="var(--primary)" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <ExcludedNote excluded={traffic.data.excluded} />

                <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold">Top pages</h3>
                    <div className="mt-2 w-full max-w-full overflow-x-auto rounded-lg border border-border">
                      <table className="w-full min-w-[360px] text-sm">
                        <thead className="bg-secondary text-[13px] uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <SortableHeader label="Path" sortKey="path" sort={pagesSort.sort} onSort={pagesSort.toggle} />
                            <SortableHeader label="Views" sortKey="views" sort={pagesSort.sort} onSort={pagesSort.toggle} align="right" />
                            <SortableHeader label="Visitors" sortKey="visitors" sort={pagesSort.sort} onSort={pagesSort.toggle} align="right" />
                          </tr>
                        </thead>
                        <tbody>
                          {topPages.map((p) => (
                            <tr key={p.path} className="border-t border-border">
                              <td className="max-w-[240px] truncate px-3 py-2">{p.path}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{p.views}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{p.visitors}</td>
                            </tr>
                          ))}
                          {topPages.length === 0 && (
                            <tr className="border-t border-border">
                              <td colSpan={3} className="px-3 py-2 text-sm text-muted-foreground">No views yet.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold">Sources</h3>
                    <div className="mt-2 w-full max-w-full overflow-x-auto rounded-lg border border-border">
                      <table className="w-full min-w-[260px] text-sm">
                        <thead className="bg-secondary text-[13px] uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <SortableHeader label="Source" sortKey="source" sort={sourcesSort.sort} onSort={sourcesSort.toggle} />
                            <SortableHeader label="Visits" sortKey="visits" sort={sourcesSort.sort} onSort={sourcesSort.toggle} align="right" />
                          </tr>
                        </thead>
                        <tbody>
                          {topSources.map((s) => (
                            <tr key={s.source} className="border-t border-border">
                              <td className="max-w-[240px] truncate px-3 py-2">{s.source}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{s.visits}</td>
                            </tr>
                          ))}
                          {topSources.length === 0 && (
                            <tr className="border-t border-border">
                              <td colSpan={2} className="px-3 py-2 text-sm text-muted-foreground">No visits yet.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <h3 className="mt-4 text-sm font-semibold">Campaigns</h3>
                    <div className="mt-2 w-full max-w-full overflow-x-auto rounded-lg border border-border">
                      <table className="w-full min-w-[320px] text-sm">
                        <thead className="bg-secondary text-[13px] uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <SortableHeader label="Campaign" sortKey="source" sort={campaignsSort.sort} onSort={campaignsSort.toggle} />
                            <SortableHeader label="Visits" sortKey="visits" sort={campaignsSort.sort} onSort={campaignsSort.toggle} align="right" />
                            <SortableHeader label="Views" sortKey="views" sort={campaignsSort.sort} onSort={campaignsSort.toggle} align="right" />
                          </tr>
                        </thead>
                        <tbody>
                          {campaigns.map((c) => (
                            <tr key={c.source} className="border-t border-border">
                              <td className="max-w-[240px] truncate px-3 py-2">{c.source}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{c.visits}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{c.views}</td>
                            </tr>
                          ))}
                          {campaigns.length === 0 && (
                            <tr className="border-t border-border">
                              <td colSpan={3} className="px-3 py-2 text-sm text-muted-foreground">
                                No tagged visits yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <h3 className="mt-4 text-sm font-semibold">Devices</h3>
                    <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
                      {traffic.data.devices.map((d) => (
                        <li key={d.device} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                          <span className="capitalize">{d.device}</span>
                          <span className="text-muted-foreground tabular-nums">{d.visits}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </>
            )}
          </section>

          {/* Routines and builder. Most of this audience never signs in, so the
              numbers come from page_views rather than app_events. */}
          <section className="mt-8">
            <h2 className="font-display text-xl">Routines & builder</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Public routine pages and the builder, over the same window. Mostly signed-out
              traffic, so these are sessions and views, not accounts.
            </p>

            {routines.isLoading && (
              <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
            )}
            {routines.error && (
              <p className="mt-3 text-sm text-destructive">
                {(routines.error as Error).message}
              </p>
            )}

            {routines.data && (
              <>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Stat
                    label="Routines index"
                    value={routines.data.index_views}
                    hint={`${routines.data.index_visitors} visitors`}
                  />
                  <Stat
                    label="Routine pages"
                    value={routines.data.detail_views}
                    hint={`${routines.data.detail_visitors} visitors`}
                  />
                  <Stat
                    label="Builder"
                    value={routines.data.builder_views}
                    hint={`${routines.data.builder_visitors} visitors · ${routines.data.builder_signups} later signed in`}
                  />
                  <Stat
                    label="Routines saved"
                    value={routines.data.routines_saved}
                    hint={`${routines.data.routines_saved_total} all time · ${routines.data.routines_shared} shared`}
                  />
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Stat
                    label="Built-in routines started"
                    value={routines.data.system_routine_starts}
                    hint="Workouts started from a starter routine"
                  />
                  <Stat
                    label="Builder → account"
                    value={
                      routines.data.builder_visitors > 0
                        ? `${Math.round(
                            (routines.data.builder_signups / routines.data.builder_visitors) * 100,
                          )}%`
                        : "—"
                    }
                    hint="Builder sessions that ended up signed in"
                  />
                </div>

                <div className="mt-4 h-56 w-full rounded-lg border border-border bg-card p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={routines.data.daily}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="index_views" stackId="a" fill="var(--primary)" name="Index" />
                      <Bar dataKey="detail_views" stackId="a" fill="var(--chip-blue-fg)" name="Routine pages" />
                      <Bar dataKey="builder_views" stackId="a" fill="var(--chip-gold-fg)" name="Builder" />

                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-semibold">Most viewed routine pages</h3>
                    <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
                      {routines.data.top_routines.length === 0 && (
                        <li className="px-3 py-2 text-sm text-muted-foreground">No views yet.</li>
                      )}
                      {routines.data.top_routines.map((r) => (
                        <li
                          key={r.path}
                          className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                        >
                          <span className="min-w-0 truncate">{r.path}</span>
                          <span className="shrink-0 text-muted-foreground tabular-nums">
                            {r.views} views · {r.visitors} visitors
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold">Routines started in the app</h3>
                    <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
                      {routines.data.routine_starts.length === 0 && (
                        <li className="px-3 py-2 text-sm text-muted-foreground">
                          No routine starts in this window.
                        </li>
                      )}
                      {routines.data.routine_starts.map((r) => (
                        <li
                          key={`${r.template}-${String(r.is_system)}`}
                          className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                        >
                          <span className="min-w-0 truncate">
                            {r.template}
                            {r.is_system && (
                              <span className="ml-2 text-[13px] text-muted-foreground">built-in</span>
                            )}
                          </span>
                          <span className="shrink-0 text-muted-foreground tabular-nums">
                            {r.starts} starts · {r.users} users
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </>
            )}
          </section>


          <PeopleSection />

          <ProAccessSection />

          <FeatureFlagsSection />

          <DeleteUserSection />

          <section className="mt-8">
            <h2 className="font-display text-xl">Most used exercises</h2>
            <ol className="mt-3 divide-y divide-border rounded-lg border border-border">
              {o.top_exercises.map((e, i) => (
                <li key={e.slug} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="mr-2 text-muted-foreground tabular-nums">{i + 1}</span>
                    {e.name}
                  </span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {e.uses} uses · {e.users} users
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-8">
            <h2 className="font-display text-xl">Image migration</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Moves exercise images from GitHub into storage, one time-boxed batch per click.
              Click again while rows_left is above zero.
            </p>
            <div className="mt-3 rounded-lg border border-border bg-card p-4">
              <button
                type="button"
                onClick={onMigrate}
                disabled={migrationBusy}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {migrationBusy ? "Migrating…" : "Run a batch"}
              </button>
              {migrationError && (
                <p className="mt-3 text-sm text-destructive">{migrationError}</p>
              )}
              {migrationResult && (
                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-[13px]">
                  {JSON.stringify(migrationResult, null, 2)}
                </pre>
              )}
            </div>
          </section>

          {o.recent_failures.length > 0 && (
            <section className="mt-8">
              <h2 className="font-display text-xl">Recent failed workout starts</h2>
              <ul className="mt-3 space-y-2">
                {o.recent_failures.map((f, i) => (
                  <li key={i} className="rounded-lg border border-border bg-card p-3 text-[13px]">
                    <p className="text-muted-foreground">{new Date(f.created_at).toLocaleString()}</p>
                    <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words">
                      {JSON.stringify(f.props, null, 2)}
                    </pre>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </Shell>
  );
}
