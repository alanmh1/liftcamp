import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

/**
 * The local ExactAlarms module (android/.../ExactAlarmsModule.kt). Android
 * only; null on iOS and in a binary built before the module existed.
 */
const ExactAlarms = requireOptionalNativeModule<{ canScheduleExactAlarms(): boolean }>('ExactAlarms');

/**
 * Whether a scheduled notification fires on time. True on iOS, below
 * Android 12 (exact alarms need no permission there), and where the
 * module is missing; on Android 12+ the answer of
 * AlarmManager.canScheduleExactAlarms(), which follows the user's
 * "Alarms & reminders" setting for the app.
 */
export function canScheduleExactAlarms(): boolean {
  if (Platform.OS !== 'android' || (Platform.Version as number) < 31 || !ExactAlarms) return true;
  try {
    return ExactAlarms.canScheduleExactAlarms();
  } catch {
    return true;
  }
}
