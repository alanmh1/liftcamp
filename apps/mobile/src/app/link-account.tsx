import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useAuth } from '@/components/auth-provider';

import { SignInScreen } from '@/components/sign-in-screen';
import { presentMergeFailure } from '@/lib/guest-merge-alert';

/**
 * "Create a free account": the sign-in screen in link mode, presented as a page
 * sheet over the tabs for an anonymous user. On success the identity is
 * attached to the current account and the session updates in place, so the
 * Home row and Profile button that open this disappear on their own.
 */
export default function LinkAccountScreen() {
  const router = useRouter();
  const { session } = useAuth();

  // Set once a sign-in completes here, so the stale-session guard below does
  // not fire a second back() when the linked session arrives non-anonymous.
  const finished = useRef(false);

  // Pop when there is a screen underneath; otherwise go to the tabs root. A
  // bare back() with nothing to pop throws "GO_BACK was not handled", which
  // is what happens when this route is the first thing mounted after a
  // session change rather than something pushed from Home.
  function leave() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  // Only an anonymous session has anything to link. If a stale navigation
  // lands here with a real account, leave before the buttons can be tapped;
  // the provider module refuses too, but this keeps the screen from showing.
  const anonymous = !!session?.user.is_anonymous;
  useEffect(() => {
    if (session && !anonymous && !finished.current) leave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, anonymous]);

  if (!anonymous) return null;

  return (
    <SignInScreen
      mode="link"
      dismissLabel="Not now"
      onDismiss={leave}
      onDone={(outcome) => {
        finished.current = true;
        leave();
        // The identity was already someone's account. The guest's data was
        // moved into it and the app switched over; Home says so. Only a
        // merge that did not go through needs a word here.
        if (outcome.ok && outcome.existingAccount && outcome.merge) presentMergeFailure(outcome.merge);
      }}
    />
  );
}
