package app.liftcamp.exactalarms

import android.app.AlarmManager
import android.content.Context
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Whether this app may schedule exact alarms. expo-notifications schedules
 * a notification with an exact alarm only when this is true (Android 12+),
 * and otherwise with an inexact one that can fire late.
 */
class ExactAlarmsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExactAlarms")

    Function("canScheduleExactAlarms") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return@Function true
      val context = appContext.reactContext ?: return@Function true
      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
        ?: return@Function true
      alarmManager.canScheduleExactAlarms()
    }
  }
}
