/**
 * Adhan Scheduler — orchestrates native AlarmManager (Android) with
 * an expo-notifications fallback for Expo Go and iOS.
 *
 * ┌────────────────────────────────────────────────────────────────────┐
 * │ LAYER 1 (Android, Development Build / APK)                        │
 * │   AlarmManager.setAlarmClock() → BroadcastReceiver               │
 * │     → ForegroundService → MediaPlayer (USAGE_ALARM)              │
 * │   Survives: Doze, battery-saver, Samsung/Xiaomi killers, reboot  │
 * ├────────────────────────────────────────────────────────────────────┤
 * │ LAYER 2 (Expo Go / iOS / fallback)                                │
 * │   expo-notifications DATE trigger + MAX-importance channel        │
 * └────────────────────────────────────────────────────────────────────┘
 *
 * IMPORTANT: TaskManager.defineTask() MUST run at module-load time (top level).
 * Import this file in _layout.tsx so the task is registered before any scheduling.
 */

import * as BackgroundFetch from "expo-background-fetch";
import * as IntentLauncher from "expo-intent-launcher";
import * as TaskManager from "expo-task-manager";
import { Alert, Platform } from "react-native";

import { AdhanAlarmModule } from "adhan-alarm";
import type { AdhanVoice } from "./storage";
import { scheduleAdhanNotifications } from "./adhanEngine";
import { setupNotificationChannels, scheduleAllPrayerReminders } from "./notifications";
import { calculatePrayerTimes, CalculationMethod } from "./prayerCalculator";
import { getSettings } from "./storage";

export const ADHAN_RESCHEDULE_TASK = "adhan-reschedule-task";

// ── "Next occurrence" map — always gives a future time for each prayer ────────

/**
 * For each prayer, returns today's time if it's still in the future,
 * otherwise tomorrow's time.  This prevents a gap where no adhan fires
 * between the last prayer of the day and the Fajr of the next day.
 */
function buildNextOccurrencePrayerMap(
  lat:    number,
  lng:    number,
  method: CalculationMethod
): Record<string, Date> {
  const today    = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayTimes = calculatePrayerTimes(lat, lng, today,    method);
  const tmrwTimes  = calculatePrayerTimes(lat, lng, tomorrow, method);

  const todayMap: Record<string, Date> = {
    Fajr: todayTimes.fajr, Dhuhr: todayTimes.dhuhr, Asr: todayTimes.asr,
    Maghrib: todayTimes.maghrib, Isha: todayTimes.isha,
  };
  const tmrwMap: Record<string, Date> = {
    Fajr: tmrwTimes.fajr, Dhuhr: tmrwTimes.dhuhr, Asr: tmrwTimes.asr,
    Maghrib: tmrwTimes.maghrib, Isha: tmrwTimes.isha,
  };

  const now    = Date.now();
  const result: Record<string, Date> = {};
  for (const name of Object.keys(todayMap)) {
    result[name] = todayMap[name].getTime() > now ? todayMap[name] : tmrwMap[name];
  }
  return result;
}

// ── Background task definition (MUST be top-level) ───────────────────────────
// Runs periodically to keep notifications / native alarms scheduled.
TaskManager.defineTask(ADHAN_RESCHEDULE_TASK, async () => {
  try {
    const settings = await getSettings();
    if (!settings.latitude || !settings.longitude) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    await setupNotificationChannels();

    const method    = (settings.calculationMethod as CalculationMethod) ?? "MWL";
    const prayerMap = buildNextOccurrencePrayerMap(
      settings.latitude,
      settings.longitude,
      method
    );

    if (settings.adhanEnabled !== false) {
      const voice = (settings.adhanVoice as AdhanVoice) ?? "abdulbasit";
      await scheduleAdhan(prayerMap, voice, true);
    }
    if (settings.notificationsEnabled !== false) {
      await scheduleAllPrayerReminders(prayerMap, settings.reminderOffsetMinutes ?? 5);
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Schedule adhan alarms for tomorrow's prayer times.
 * On Android with a Development Build → uses AlarmManager (reliable).
 * On Android with Expo Go / iOS        → uses expo-notifications (fallback).
 */
export async function scheduleAdhan(
  times:   Record<string, Date>,
  voice:   AdhanVoice,
  enabled: boolean
): Promise<void> {
  if (Platform.OS === "web") return;
  if (!enabled) {
    await cancelAdhan();
    return;
  }

  if (Platform.OS === "android" && AdhanAlarmModule.isAvailable()) {
    await scheduleNativeAlarms(times, voice);
  } else {
    // Expo Go or iOS: fall back to expo-notifications
    await scheduleAdhanNotifications(times, voice, true);
  }
}

/** Cancel all adhan alarms (both native and notification-based). */
export async function cancelAdhan(): Promise<void> {
  if (Platform.OS === "web") return;
  if (AdhanAlarmModule.isAvailable()) {
    AdhanAlarmModule.cancelAllAlarms();
  }
  // Always cancel notifications too (clears any previously scheduled ones)
  const { cancelAdhanNotifications } = await import("./adhanEngine");
  await cancelAdhanNotifications();
}

// ── Native AlarmManager scheduling ───────────────────────────────────────────

async function scheduleNativeAlarms(
  times: Record<string, Date>,
  voice: AdhanVoice
): Promise<void> {
  const PRAYER_ORDER = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;

  // Cancel existing native alarms before rescheduling
  AdhanAlarmModule.cancelAllAlarms();

  const now = Date.now();
  for (const prayer of PRAYER_ORDER) {
    const time = times[prayer];
    if (!time || time.getTime() <= now) continue;

    const ok = AdhanAlarmModule.scheduleAlarm(time.getTime(), voice, prayer);
    if (!ok) {
      // Native scheduling failed — fall back to expo-notifications for this prayer
      console.warn(`[AdhanScheduler] Native alarm failed for ${prayer} — using notification fallback`);
      await scheduleAdhanNotifications({ [prayer]: time }, voice, true);
    }
  }
}

// ── Register the background / boot task ──────────────────────────────────────

export async function registerRescheduleTask(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const already = await TaskManager.isTaskRegisteredAsync(ADHAN_RESCHEDULE_TASK);
    if (!already) {
      await BackgroundFetch.registerTaskAsync(ADHAN_RESCHEDULE_TASK, {
        minimumInterval: 6 * 60 * 60, // run every 6 hours at most
        stopOnTerminate: false,        // keep running after app is closed
        startOnBoot:     true,         // reschedule after phone reboot (Expo Go fallback path)
      });
    }
  } catch { /* ignore — some emulators don't support background fetch */ }
}

// ── Request critical Android permissions for reliable adhan ──────────────────

/**
 * Shows system dialogs to:
 *   1. Disable battery optimisation (prevents Android from killing scheduler)
 *   2. Allow exact alarms (Android 12+ / API 31+)
 *
 * Should be called once during onboarding and can be re-triggered from Settings.
 */
export async function requestCriticalPermissions(): Promise<void> {
  if (Platform.OS !== "android") return;

  await new Promise<void>((resolve) => {
    Alert.alert(
      "Enable Reliable Adhan",
      "To play Adhan on time even when your screen is off or you're using another app, " +
      "Imam needs two quick settings:\n\n" +
      "1. Disable battery optimisation (keeps alarms alive)\n" +
      "2. Allow exact alarms (fires at the exact prayer time)\n\n" +
      "Press OK to open each setting.",
      [
        { text: "Not Now", style: "cancel", onPress: () => resolve() },
        { text: "OK",                       onPress: () => resolve() },
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
