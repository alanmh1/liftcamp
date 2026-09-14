import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

import { useAuth } from '@/components/auth-provider';

import { SignInScreen } from '@/components/sign-in-screen';

/**
 * "Save your workouts": the sign-in screen in link mode, presented as a page
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

  // Only an anonymous session has anything to link. If a stale navigation
  // lands here with a real account, leave before the buttons can be tapped;
  // the provider module refuses too, but this keeps the screen from showing.
  const anonymous = !!session?.user.is_anonymous;
  useEffect(() => {
    if (session && !anonymous && !finished.current && router.canGoBack()) router.back();
  }, [session, anonymous, router]);

  if (!anonymous) return null;

  return (
    <SignInScreen
      mode="link"
      dismissLabel="Not now"
      onDismiss={() => router.back()}
      onDone={(outcome) => {
        finished.current = true;
        router.back();
        if (outcome.ok && outcome.existingAccount) {
          // The identity was already someone's account. We signed into it;
          // the guest session's rows stay with the guest user. Moving them
          // needs a database function, so say so rather than pretend.
          Alert.alert(
            'Signed in to your existing account',
            'Workouts from the guest session were not moved to it.',
          );
        }
      }}
    />
  );
}
