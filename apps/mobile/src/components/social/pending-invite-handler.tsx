import { pendingInviteStep } from '@liftcamp/shared';
import { useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/components/auth-provider';
import { usePendingInvite } from '@/lib/pending-invite';

/** Codes this run already acted on, so closing a sheet does not reopen it. */
const askedToLink = new Set<string>();
const opened = new Set<string>();

/**
 * Opens a saved invite (lib/pending-invite.ts) once the user is on the
 * tabs. Mounted on Home, which is mounted whenever the tabs are, so it
 * runs only for an onboarded, signed-in user.
 *
 * - A guest gets the create-account sheet first, once per code per run.
 *   Linking keeps the invite saved, and the invite opens when the sheet
 *   closes on a signed-up account (the same user, or the account a merge
 *   switched to). "Not now" leaves it for the next launch.
 * - A signed-up user gets the invite screen, which clears the saved code
 *   once it has an answer.
 *
 * Waits while a root screen (a workout, the summary, Settings) is over the
 * tabs, so a link never covers a set being logged.
 */
export function PendingInviteHandler() {
  const { session } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const code = usePendingInvite();
  const onTabs = segments[0] === '(tabs)';
  const step = pendingInviteStep(code ?? null, {
    userId: session?.user.id ?? null,
    isGuest: !!session?.user.is_anonymous,
  });

  useEffect(() => {
    // Cleared by the invite screen: the same link tapped again opens again.
    if (code === null) opened.clear();
    if (!onTabs || !code) return;
    if (step === 'link' && !askedToLink.has(code)) {
      askedToLink.add(code);
      router.push('/link-account');
    } else if (step === 'open' && !opened.has(code)) {
      opened.add(code);
      router.push({ pathname: '/invite/[code]', params: { code } });
    }
  }, [onTabs, code, step, router]);

  return null;
}
