import { useEffect, useState } from "react";
import { AppStoreBadge } from "@/components/AppStoreBadge";
import { isIOSDevice } from "@/lib/ios";

/**
 * Login page, iPhone and iPad only: the native app is the better place to
 * sign in. Replaces the old Add to Home Screen steps. Hidden until hydration
 * so the server markup matches the first client render.
 */
export function AppStoreHint() {
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setIos(isIOSDevice());
  }, []);

  if (!ios) return null;

  return (
    <div className="mt-4 flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-4 py-4 text-center">
      <p className="m-0 text-sm font-semibold">LiftCamp is on the App Store</p>
      <AppStoreBadge height={44} campaign="login" />
      <p className="m-0 text-[13px] text-muted-foreground">
        Sign in there with the same account and your workouts come with you.
      </p>
    </div>
  );
}
