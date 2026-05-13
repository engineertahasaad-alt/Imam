/**
 * Adhan Scheduler — Background task + critical Android permissions
 *
 * Three reliability layers:
 * 1. Notification channels (MAX importance, bypassDnd) — fires sound on any app state
 * 2. Background fetch task (startOnBoot) — reschedules after phone reboot or app kill
 * 3. Battery optimization + exact alarm permissions — prevents Android from blocking alarms
 *
 * IMPORTANT: TaskManager.defineTask() MUST run at module-load time (top level).
 * Import this file in _layout.tsx so the task is registered before any scheduling.
 */

import * as BackgroundFetch from "expo-background-fetch";
import * as IntentLauncher from "expo-intent-launcher";
import * as TaskManager from "expo-task-manager";
import { Alert, Platform } from "react-native";

import { scheduleAdhanNotifications } from "./adhanEngine";
import { setupNotificationChannels, scheduleAllPrayerReminders } from "./notifications";
import { calculatePrayerTimes, CalculationMethod } from "./prayerCalculator";
import { getSettings } from "./storage";

export const ADHAN_RESCHEDULE_TASK = "adhan-reschedule-task";

// ── Background task definition (MUST be top-level) ───────────────────────────
// Runs after phone reboot and periodically to keep notifications scheduled.
TaskManager.defineTask(ADHAN_RESCHEDULE_TASK, async () => {
  try {
    const settings = await getSettings();
    if (!settings.latitude || !settings.longitude) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    await setupNotificationChannels();

    const times = calculatePrayerTimes(
      settings.latitude,
      settings.longitude,
      new Date(),
      (settings.calculationMethod as CalculationMethod) ?? "MWL"
    );

    const prayerMap = {
      Fajr:    times.fajr,
      Dhuhr:   times.dhuhr,
      Asr:     times.asr,
      Maghrib: times.maghrib,
      Isha:    times.isha,
    };

    if (settings.adhanEnabled !== false) {
      await scheduleAdhanNotifications(prayerMap, (settings.adhanVoice as any) ?? "abdulbasit", true);
    }
    if (settings.notificationsEnabled !== false) {
      await scheduleAllPrayerReminders(prayerMap, settings.reminderOffsetMinutes ?? 5);
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ── Register the background/boot task ────────────────────────────────────────
export async function registerRescheduleTask(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const already = await TaskManager.isTaskRegisteredAsync(ADHAN_RESCHEDULE_TASK);
    if (!already) {
      await BackgroundFetch.registerTaskAsync(ADHAN_RESCHEDULE_TASK, {
        minimumInterval: 6 * 60 * 60, // run every 6 hours at most
        stopOnTerminate: false,        // keep running after app is closed
        startOnBoot:     true,         // reschedule after phone reboot
      });
    }
  } catch { /* ignore — some emulators don't support background fetch */ }
}

// ── Request critical Android permissions for reliable adhan ──────────────────
/**
 * Shows two Android system dialogs:
 *  1. "Disable battery optimisation" — prevents Android from killing alarm scheduler
 *  2. "Allow exact alarms" (Android 12+) — ensures prayer notifications fire on time
 *
 * Should be called once during onboarding and can be re-triggered from Settings.
 */
export async function requestCriticalPermissions(): Promise<void> {
  if (Platform.OS !== "android") return;

  // Step 1 — Battery optimisation dialog
  // Appears as a system dialog: "Allow Imam to always run in the background?"
  await new Promise<void>((resolve) => {
    Alert.alert(
      "Enable Reliable Adhan",
      "To play Adhan on time even when your screen is off or you're using another app, Imam needs two quick settings:\n\n" +
      "1. Disable battery optimisation (keeps alarms alive)\n" +
      "2. Allow exact alarms (fires at the exact prayer time)\n\n" +
      "Press OK to open each setting.",
      [
        { text: "Not Now", style: "cancel", onPress: () => resolve() },
        { text: "OK", onPress: () => resolve() },
      ]
    );
  });

  // Battery optimization exemption
  try {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
      { data: "package:com.imam.app" }
    );
  } catch {
    // Fallback: open general battery settings
    try {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS
      );
    } catch { /* ignore on older Android */ }
  }

  // Exact alarm permission (Android 12+ / API 31+)
  try {
    await IntentLauncher.startActivityAsync(
      "android.settings.REQUEST_SCHEDULE_EXACT_ALARM",
      { data: "package:com.imam.app" }
    );
  } catch { /* not required on Android < 12 */ }
}
