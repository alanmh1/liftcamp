import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
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




type UserRow = {
  user_id: string;
  email: string;
  joined_at: string;
  workouts: number;
  finished: number;
  sets: number;
  last_active: string | null;
};

function fmtDate(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" });
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-display mt-1 text-2xl leading-none">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
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

  const overview = useQuery({
    queryKey: ["admin-overview", days],
    enabled: isAdmin.data === true,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_overview", { _days: days });
      if (error) throw error;
      return data as unknown as Overview;
    },
  });

  const users = useQuery({
    queryKey: ["admin-users"],
    enabled: isAdmin.data === true,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_users");
      if (error) throw error;
      return (data ?? []) as UserRow[];
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


      if (error) throw error;
      return data as unknown as Traffic;
    },
  });

  // Per-table sort state. Defaults match what each table showed before.
  const pagesSort = useTableSort<"path" | "views" | "visitors">({ key: "views", dir: "desc" });
  const sourcesSort = useTableSort<"source" | "visits">({ key: "visits", dir: "desc" });
  const campaignsSort = useTableSort<"source" | "visits" | "views">({ key: "visits", dir: "desc" });
  const usersSort = useTableSort<"email" | "joined_at" | "workouts" | "finished" | "sets" | "last_active">({
    key: "joined_at",
    dir: "desc",
  });

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
  const userRows = useSortedRows(users.data ?? [], usersSort.sort, {
    email: (r) => r.email,
    joined_at: (r) => (r.joined_at ? new Date(r.joined_at) : null),
    workouts: (r) => r.workouts,
    finished: (r) => r.finished,
    sets: (r) => r.sets,
    last_active: (r) => (r.last_active ? new Date(r.last_active) : null),
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
          <Link
            to="/admin/inbox"
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium"
          >
            Email inbox
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex overflow-hidden rounded-md border border-input text-xs">
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
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={excludeInternal}
              onChange={(e) => setExcludeInternal(e.target.checked)}
            />
            Exclude my traffic
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
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
          <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Accounts" value={o.total_users} hint={`+${o.new_users_7d} in 7d`} />
            <Stat label="Active 7d" value={o.active_7d} hint={`${o.active_30d} in 30d`} />
            <Stat label="Workouts" value={o.total_workouts} hint={`${o.workouts_7d} in 7d`} />
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
            <Stat label="New accounts 30d" value={o.new_users_30d} />
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

          <section className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl">Site traffic</h2>
              <p className="text-xs text-muted-foreground">
                Last {days} days
                {anonymousOnly ? " · sessions never linked to an account" : ""}
              </p>
            </div>

            <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
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

                <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold">Top pages</h3>
                    <div className="mt-2 w-full max-w-full overflow-x-auto rounded-lg border border-border">
                      <table className="w-full min-w-[360px] text-sm">
                        <thead className="bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
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
                        <thead className="bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
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
                        <thead className="bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
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


          <section className="mt-8">
            <h2 className="font-display text-xl">Per account</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Signed-up accounts only — the anonymous filter does not apply here.
            </p>
            <div className="mt-3 w-full max-w-full overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <SortableHeader label="Email" sortKey="email" sort={usersSort.sort} onSort={usersSort.toggle} />
                    <SortableHeader label="Joined" sortKey="joined_at" sort={usersSort.sort} onSort={usersSort.toggle} />
                    <SortableHeader label="Workouts" sortKey="workouts" sort={usersSort.sort} onSort={usersSort.toggle} align="right" />
                    <SortableHeader label="Finished" sortKey="finished" sort={usersSort.sort} onSort={usersSort.toggle} align="right" />
                    <SortableHeader label="Sets" sortKey="sets" sort={usersSort.sort} onSort={usersSort.toggle} align="right" />
                    <SortableHeader label="Last seen" sortKey="last_active" sort={usersSort.sort} onSort={usersSort.toggle} />
                  </tr>
                </thead>
                <tbody>
                  {userRows.map((u) => (
                    <tr key={u.user_id} className="border-t border-border">
                      <td className="px-3 py-2">{u.email}</td>
                      <td className="px-3 py-2 text-muted-foreground">{fmtDate(u.joined_at)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{u.workouts}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{u.finished}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{u.sets}</td>
                      <td
                        className={cn(
                          "whitespace-nowrap px-3 py-2",
                          u.last_active ? "text-foreground" : "text-muted-foreground",
                        )}
                        title={u.last_active ? new Date(u.last_active).toLocaleString() : undefined}
                      >
                        {relativeTime(u.last_active)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

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

          {o.recent_failures.length > 0 && (
            <section className="mt-8">
              <h2 className="font-display text-xl">Recent failed workout starts</h2>
              <ul className="mt-3 space-y-2">
                {o.recent_failures.map((f, i) => (
                  <li key={i} className="rounded-lg border border-border bg-card p-3 text-xs">
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
