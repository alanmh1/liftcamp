import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { normalizeInviteCode, type Database } from "@liftcamp/shared";

// The /i invite page, read during SSR with no session. invite_landing is the
// one social function anon may call: it answers the inviter's username for an
// exact code, and only when the inviter has social on. Nothing else about
// them, and no way to list codes.
function publicClient() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export type InviteLanding = {
  /** Null when the path cannot be an invite code. */
  code: string | null;
  /** Null for an unknown code, an inviter without social, or a failed read. */
  username: string | null;
};

export const getInviteLanding = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ code: z.string().max(64) }).parse(data))
  .handler(async ({ data }): Promise<InviteLanding> => {
    const code = normalizeInviteCode(data.code);
    if (!code) return { code: null, username: null };

    // A failed read still shows the code and the Open button; the app
    // checks the code itself.
    const { data: rows, error } = await publicClient().rpc("invite_landing", { p_code: code });
    if (error) return { code, username: null };
    return { code, username: rows?.[0]?.username ?? null };
  });
