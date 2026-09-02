import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Admin-only view over Lovable's managed email delivery log. These are
// OUTBOUND auth emails (sign-up, login link, password reset) — there is no
// inbound mailbox, so "read" state is local to the admin and "reply" opens the
// admin's own mail client addressed to the recipient.

export type InboxItem = {
  id: string;
  timestamp: string;
  recipient: string;
  eventType: string;
  status: string | null;
  kind: string;
};

// The auth webhook labels each send with its action type; those labels come
// back as tags on the delivery event.
const AUTH_KINDS = new Set([
  "signup",
  "magiclink",
  "recovery",
  "invite",
  "email_change",
  "reauthentication",
]);

const KIND_FALLBACK = "other";

export const listAuthEmailInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ items: InboxItem[]; historyStartsAt: string | null }> => {
    const { data: isAdmin, error } = await context.supabase.rpc("current_user_is_admin");
    if (error) throw error;
    if (isAdmin !== true) throw new Response("Forbidden", { status: 403 });

    const { listEmailLogs } = await import("@lovable.dev/email-js");
    const res = await listEmailLogs(
      { limit: 100 },
      { apiKey: process.env["LOVABLE_API_KEY"]! },
    );

    const items: InboxItem[] = res.data
      .map((e) => {
        const kind = (e.tags ?? []).find((t) => AUTH_KINDS.has(t)) ?? KIND_FALLBACK;
        return {
          id: e.message_id ?? `${e.timestamp}|${e.recipient}|${e.event_type}`,
          timestamp: e.timestamp,
          recipient: e.recipient,
          eventType: e.event_type,
          status: e.status ?? null,
          kind,
        };
      })
      .filter((i) => i.kind !== KIND_FALLBACK);

    return { items, historyStartsAt: res.history_starts_at ?? null };
  });
