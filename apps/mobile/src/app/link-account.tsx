import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { SignInScreen } from '@/components/sign-in-screen';

/**
 * "Save your workouts": the sign-in screen in link mode, presented as a page
 * sheet over the tabs for an anonymous user. On success the identity is
 * attached to the current account and the session updates in place, so the
 * Home row and Profile button that open this disappear on their own.
 */
export default function LinkAccountScreen() {
  const router = useRouter();

  return (
    <SignInScreen
      mode="link"
      dismissLabel="Not now"
      onDismiss={() => router.back()}
      onDone={(outcome) => {
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
