import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
  devices: { device: string; visits: number }[];
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

  const overview = useQuery({
    queryKey: ["admin-overview"],
    enabled: isAdmin.data === true,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_overview");
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
    <div className="px-4 pb-16 pt-4">
      <BackLink to="/" label="Home" />
      <h1 className="font-display mt-3 text-3xl">Admin</h1>
      <p className="mt-1 text-sm text-muted-foreground">Usage across every LiftCamp account.</p>

      {overview.isLoading || !o ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading stats…</p>
      ) : (
        <>
          <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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
            <h2 className="font-display text-xl">Workouts, last 30 days</h2>
            <div className="mt-3 h-56 rounded-lg border border-border bg-card p-3">
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
            <h2 className="font-display text-xl">Per account</h2>
            <div className="mt-3 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Joined</th>
                    <th className="px-3 py-2 text-right font-medium">Workouts</th>
                    <th className="px-3 py-2 text-right font-medium">Finished</th>
                    <th className="px-3 py-2 text-right font-medium">Sets</th>
                    <th className="px-3 py-2 font-medium">Last active</th>
                  </tr>
                </thead>
                <tbody>
                  {(users.data ?? []).map((u) => (
                    <tr key={u.user_id} className="border-t border-border">
                      <td className="px-3 py-2">{u.email}</td>
                      <td className="px-3 py-2 text-muted-foreground">{fmtDate(u.joined_at)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{u.workouts}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{u.finished}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{u.sets}</td>
                      <td
                        className={cn(
                          "px-3 py-2",
                          u.last_active ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {fmtDate(u.last_active)}
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
                  <span className="truncate">
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
    </div>
  );
}
