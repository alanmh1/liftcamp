import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Settings writes are RLS-scoped to auth.uid(). When a session can no longer be
 * refreshed the write is rejected and, without this, the UI silently kept the
 * optimistic value. Surface the failure and end the dead session so the user
 * gets sent back through sign-in instead of saving into the void.
 */
export async function reportSaveError(
  error: { message?: string; code?: string } | null,
  what: string,
): Promise<boolean> {
  if (!error) return false;

  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    toast.error("Your session expired. Please sign in again.");
    await supabase.auth.signOut();
    return true;
  }

  toast.error(`Couldn't save ${what}. Please try again.`);
  return true;
}
