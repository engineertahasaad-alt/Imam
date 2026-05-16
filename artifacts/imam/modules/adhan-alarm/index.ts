/**
 * AdhanAlarm — JS interface for the native Android AlarmManager module.
 *
 * ACTIVE IN:  EAS Development Build / Release APK
 * INACTIVE IN: Expo Go  →  adhanScheduler falls back to expo-notifications automatically.
 *
 * To build a Development Build:
 *   npm install -g eas-cli
 *   eas build --profile development --platform android
 *   Install the generated APK on your device.
 */

import { Platform } from "react-native";

interface NativeAdhanAlarmModule {
  scheduleAlarm(epochMillis: number, voice: string, prayer: string): boolean;
  cancelAlarm(prayer: string): void;
  cancelAllAlarms(): void;
  canScheduleExactAlarms(): boolean;
}

let _native: NativeAdhanAlarmModule | null = null;

if (Platform.OS === "android") {
  try {
    // requireNativeModule throws in Expo Go — caught gracefully below.
    // Typed manually to avoid importing expo-modules-core types in this sub-package.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rnm = require("expo-modules-core") as {
      requireNativeModule: <T>(name: string) => T;
    };
    _native = rnm.requireNativeModule<NativeAdhanAlarmModule>("AdhanAlarm");
    console.log("[AdhanAlarm] Native module loaded ✓");
  } catch {
    console.log("[AdhanAlarm] Native module unavailable — expo-notifications fallback active");
  }
}

export const AdhanAlarmModule = {
  /** True only inside a Development Build or Release APK, not in Expo Go. */
  isAvailable: (): boolean => _native !== null,

  /**
   * Schedule adhan alarm at exactEpochMs using AlarmManager.setAlarmClock().
   * Bypasses Doze, battery saver, and OEM restrictions.
   * Returns true on success.
   */
  scheduleAlarm: (epochMillis: number, voice: string, prayer: string): boolean => {
    if (!_native) return false;
    try {
      const ok = _native.scheduleAlarm(epochMillis, voice, prayer);
      console.log(`[AdhanAlarm] scheduleAlarm ${prayer} → ${ok ? "OK" : "FAILED"}`);
      return ok;
    } catch (e) {
      console.warn("[AdhanAlarm] scheduleAlarm error:", e);
      return false;
    }
  },

  cancelAlarm: (prayer: string): void => {
    if (!_native) return;
    try { _native.cancelAlarm(prayer); } catch { /* ignore */ }
  },

  cancelAllAlarms: (): void => {
    if (!_native) return;
    try {
      _native.cancelAllAlarms();
      console.log("[AdhanAlarm] All native alarms cancelled");
    } catch { /* ignore */ }
  },

  canScheduleExactAlarms: (): boolean => {
    if (!_native) return false;
    try { return _native.canScheduleExactAlarms(); } catch { return false; }
  },
};
