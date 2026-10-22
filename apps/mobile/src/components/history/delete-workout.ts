import { Alert } from 'react-native';

import { deleteWorkout } from '@/data/workouts';

/**
 * Asks before deleting a finished workout, then queues the delete. True
 * once the phone has the delete; false on Cancel, or when it could not be
 * saved, which says so. A History row's swipe and the detail screen's
 * menu both come through here.
 */
export function confirmDeleteWorkout(userId: string, workoutId: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Delete workout?',
      "This removes the workout and its sets. It can't be undone.",
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteWorkout(userId, workoutId).then((ok) => {
              if (!ok) Alert.alert("Couldn't delete the workout.", 'Try again.');
              resolve(ok);
            });
          },
        },
      ],
      // Android: a tap outside the alert is a Cancel.
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
