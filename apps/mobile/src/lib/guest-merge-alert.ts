import { Alert } from 'react-native';

import { deferMerge, retryMerge, type MergeResult } from '@/lib/guest-merge';

/**
 * What a guest sees when signing in to an existing account and the merge
 * did not go through. The app is still on the guest, with nothing lost.
 * Try again reruns the merge; Sign in now switches to the account and
 * leaves the merge to retry on launch and foreground. A success says
 * nothing here: Home shows its line.
 */
export function presentMergeFailure(result: MergeResult): void {
  if (result.kind !== 'failed') return;
  const { title, message } = result.stuck
    ? {
        title: "Your guest workouts couldn't be added",
        message: "They're still saved on this phone. Write to hello@liftcamp.app and we'll move them.",
      }
    : {
        title: "Your guest workouts weren't added yet",
        message: "They're saved on this phone. Try again now, or LiftCamp will try again next time you open it.",
      };
  Alert.alert(title, message, [
    {
      text: 'Sign in now',
      onPress: () => {
        void deferMerge(result.guestId).then((switched) => {
          if (!switched) {
            Alert.alert("Couldn't sign in", 'Check your connection and try again.');
          }
        });
      },
    },
    {
      text: 'Try again',
      style: 'cancel',
      onPress: () => {
        void retryMerge(result.guestId).then((again) => {
          if (again) presentMergeFailure(again);
        });
      },
    },
  ]);
}
