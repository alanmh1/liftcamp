import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail, MailOpen, Reply } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BackLink } from "@/components/BackLink";
import { cn } from "@/lib/utils";
import { listAuthEmailInbox, type InboxItem } from "@/lib/email-inbox.functions";

export const Route = createFileRoute("/admin_/inbox")({
  head: () => ({
    meta: [
      { title: "Email inbox · LiftCamp admin" },
      {
        name: "description",
        content: "Sign-up, login and password-reset emails sent by LiftCamp.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: InboxPage,
});

const READ_KEY = "liftcamp.admin.email.read";

function loadRead(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(READ_KEY);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveRead(ids: Set<string>) {
  try {
    window.localStorage.setItem(READ_KEY, JSON.stringify([...ids].slice(-500)));
  } catch {
    /* storage unavailable — read state is a convenience, not data */
  }
}

const KIND_LABELS: Record<string, string> = {
  signup: "Sign-up confirmation",
  magiclink: "Login link",
  recovery: "Password reset",
  invite: "Invite",
  email_change: "Email change",
  reauthentication: "Verification code",
};

const EVENT_TONE: Record<string, string> = {
  sent: "bg-muted text-muted-foreground",
  rejected: "bg-destructive/10 text-destructive",
  bounced: "bg-destructive/10 text-destructive",
  complained: "bg-destructive/10 text-destructive",
  suppressed: "bg-destructive/10 text-destructive",
  rate_limited: "bg-destructive/10 text-destructive",
  unsubscribed: "bg-muted text-muted-foreground",
};

function fmtWhen(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function InboxPage() {
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

  const fetchInbox = useServerFn(listAuthEmailInbox);
  const inbox = useQuery({
    queryKey: ["admin-email-inbox"],
    enabled: isAdmin.data === true,
    queryFn: () => fetchInbox({}),
  });

  const [read, setRead] = useState<Set<string>>(new Set());
  useEffect(() => setRead(loadRead()), []);

  const [filter, setFilter] = useState<"all" | "unread">("all");

  const toggleRead = useCallback((id: string) => {
    setRead((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveRead(next);
      return next;
    });
  }, []);

  const markAllRead = useCallback((items: InboxItem[]) => {
    setRead((prev) => {
      const next = new Set(prev);
      items.forEach((i) => next.add(i.id));
      saveRead(next);
      return next;
    });
  }, []);

  const items = inbox.data?.items ?? [];
  const unreadCount = useMemo(
    () => items.filter((i) => !read.has(i.id)).length,
    [items, read],
  );
  const visible = filter === "unread" ? items.filter((i) => !read.has(i.id)) : items;

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

  return (
    <div className="px-4 pb-16 pt-4">
      <BackLink to="/admin" label="Admin" />
      <h1 className="font-display mt-3 text-3xl">Email inbox</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Sign-up, login and password-reset emails LiftCamp sent. Replies from users go to
        hello@liftcamp.app, not here.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(["all", "unread"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[13px] font-medium capitalize",
              filter === f
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border text-muted-foreground",
            )}
          >
            {f}
            {f === "unread" ? ` (${unreadCount})` : ""}
          </button>
        ))}
        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={() => markAllRead(items)}
            className="ml-auto rounded-full border border-border px-3 py-1.5 text-[13px] font-medium text-muted-foreground"
          >
            Mark all read
          </button>
        ) : null}
      </div>

      {inbox.isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading emails…</p>
      ) : inbox.isError ? (
        <p className="mt-8 text-sm text-destructive">
          Couldn't load the email log. Delivery events only exist for the published app.
        </p>
      ) : visible.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          {filter === "unread" ? "Nothing unread." : "No auth emails in the retention window yet."}
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {visible.map((item) => {
            const isRead = read.has(item.id);
            const kind = KIND_LABELS[item.kind] ?? item.kind;
            return (
              <li
                key={item.id}
                className={cn(
                  "rounded-lg border p-3",
                  isRead ? "border-border bg-card" : "border-primary/40 bg-primary/5",
                )}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => toggleRead(item.id)}
                    aria-label={isRead ? "Mark as unread" : "Mark as read"}
                    className="mt-0.5 shrink-0 text-muted-foreground"
                  >
                    {isRead ? (
                      <MailOpen className="h-4 w-4" />
                    ) : (
                      <Mail className="h-4 w-4 text-primary" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate text-sm",
                        isRead ? "text-foreground" : "font-semibold text-foreground",
                      )}
                    >
                      {item.recipient}
                    </p>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                      {kind} · {fmtWhen(item.timestamp)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[13px] font-medium",
                          EVENT_TONE[item.eventType] ?? "bg-muted text-muted-foreground",
                        )}
                      >
                        {item.status ?? item.eventType}
                      </span>
                    </div>
                  </div>

                  <a
                    href={`mailto:${encodeURIComponent(item.recipient)}?subject=${encodeURIComponent(
                      `Re: ${kind} — LiftCamp`,
                    )}`}
                    onClick={() => {
                      if (!isRead) toggleRead(item.id);
                    }}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[13px] font-medium"
                  >
                    <Reply className="h-3.5 w-3.5" />
                    Reply
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
