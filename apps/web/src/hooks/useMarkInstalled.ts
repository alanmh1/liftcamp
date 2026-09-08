import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Install state lives in the database, not localStorage: on iOS an installed
 * PWA gets its own storage partition, so a flag written inside the installed
 * app is invisible to the same site in Safari and vice versa. The user row is
 * the only context both share.
 *
 * Everything here is telemetry — it must never surface an error or block UI.
 */
export async function markInstalled(): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return;

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("pwa_installed_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (profile?.pwa_installed_at) return;

    await supabase
      .from("user_profiles")
      .update({ pwa_installed_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("pwa_installed_at", null);
  } catch {
    /* telemetry only */
  }
}

/**
 * Returns the stored install timestamp (null while unknown) and records one on
 * mount when the app is currently running standalone.
 */
export function useMarkInstalled() {
  const [installedAt, setInstalledAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const userId = data.user?.id;
        if (!userId) return;

        const { data: profile } = await supabase
          .from("user_profiles")
          .select("pwa_installed_at")
          .eq("user_id", userId)
          .maybeSingle();

        if (cancelled) return;

        if (profile?.pwa_installed_at) {
          setInstalledAt(profile.pwa_installed_at);
          return;
        }

        const standalone =
          typeof window !== "undefined" &&
          (window.matchMedia("(display-mode: standalone)").matches ||
            (navigator as unknown as { standalone?: boolean }).standalone === true);
        if (!standalone) return;

        const now = new Date().toISOString();
        await supabase
          .from("user_profiles")
          .update({ pwa_installed_at: now })
          .eq("user_id", userId)
          .is("pwa_installed_at", null);
        if (!cancelled) setInstalledAt(now);
      } catch {
        /* telemetry only */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { installedAt, markInstalled };
}
