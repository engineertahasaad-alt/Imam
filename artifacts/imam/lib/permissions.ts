/**
 * Centralized permission management for Imam app.
 * Covers all permissions needed for reliable Adhan playback.
 */

import * as IntentLauncher from "expo-intent-launcher";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { Linking, Platform } from "react-native";

export type PermStatus = "granted" | "denied" | "unknown";

export interface CheckedPermissions {
  notifications: PermStatus;
  location:      PermStatus;
}

/** Check the permissions we can actually query in managed Expo. */
export async function checkPermissions(): Promise<CheckedPermissions> {
  if (Platform.OS === "web") return { notifications: "unknown", location: "unknown" };

  const [notif, loc] = await Promise.all([
    Notifications.getPermissionsAsync().catch(() => ({ status: "unknown" as const })),
    Location.getForegroundPermissionsAsync().catch(() => ({ status: "unknown" as const })),
  ]);

  const resolve = (s: string): PermStatus =>
    s === "granted" ? "granted" : s === "denied" ? "denied" : "unknown";

  return { notifications: resolve(notif.status), location: resolve(loc.status) };
}

/** Request notification permission from the OS prompt. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status } = await Notifications.requestPermissionsAsync({
    android: { allowAnnouncements: true },
  });
  return status === "granted";
}

/** Request foreground location permission from the OS prompt. */
export async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === "granted";
}

// ─── Android deep-link helpers ────────────────────────────────────────────────

/** Open the system notification settings for this app. */
export async function openNotificationSettings(): Promise<void> {
  if (Platform.OS === "android") {
    try {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.APP_NOTIFICATION_SETTINGS,
        { extra: { "android.provider.extra.APP_PACKAGE": "com.imam.app" } }
      );
      return;
    } catch { /* fall through */ }
  }
  Linking.openSettings().catch(() => {});
}

/**
 * Open the exact-alarm settings page (Android 12+ / API 31+).
 * Without this, prayer notifications may fire minutes late.
 */
export async function openExactAlarmSettings(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await IntentLauncher.startActivityAsync(
      "android.settings.REQUEST_SCHEDULE_EXACT_ALARM",
      { data: "package:com.imam.app" }
    );
  } catch {
    try {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
        { data: "package:com.imam.app" }
      );
    } catch { /* ignore */ }
  }
}

/**
 * Open the battery optimisation exemption dialog.
 * This prevents Android's Doze mode from blocking adhan alarms.
 */
export async function openBatteryOptimizationSettings(): Promise<void> {
  if (Platform.OS !== "android") return;
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
    } catch { /* ignore on very old Android */ }
  }
}

/**
 * Open the "Display over other apps" settings page.
 * Allows azkar floating alerts to appear over any active app.
 */
export async function openOverlaySettings(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await IntentLauncher.startActivityAsync(
      "android.settings.action.MANAGE_OVERLAY_PERMISSION",
      { data: "package:com.imam.app" }
    );
  } catch {
    try {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
        { data: "package:com.imam.app" }
      );
    } catch { /* ignore */ }
  }
}

/** Open the device location / GPS settings. */
export async function openLocationSettings(): Promise<void> {
  if (Platform.OS === "android") {
    try {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.LOCATION_SOURCE_SETTINGS
      );
      return;
    } catch { /* fall through */ }
  }
  Linking.openSettings().catch(() => {});
}
