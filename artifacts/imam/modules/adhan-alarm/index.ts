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
  startFloatingService(azkarJson: string): void;
  stopFloatingService(): void;
  canDrawOverlays(): boolean;
}

let _native: NativeAdhanAlarmModule | null = null;

if (Platform.OS === "android") {
  try {
    // requireNativeModule throws in Expo Go — caught gracefully below.
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

  /**
   * Start the FloatingAzkarService with a list of zikr texts.
   * The service shows a draggable overlay above all apps.
   * Requires SYSTEM_ALERT_WINDOW permission (Draw Over Apps).
   * @param azkarTexts Array of Arabic zikr strings to cycle through.
   */
  startFloatingService: (azkarTexts: string[]): void => {
    if (!_native) return;
    try {
      _native.startFloatingService(JSON.stringify(azkarTexts));
      console.log("[AdhanAlarm] FloatingAzkarService started");
    } catch (e) {
      console.warn("[AdhanAlarm] startFloatingService error:", e);
    }
  },

  /** Stop the FloatingAzkarService overlay. */
  stopFloatingService: (): void => {
    if (!_native) return;
    try { _native.stopFloatingService(); } catch { /* ignore */ }
  },

  /**
   * Returns true if the app has SYSTEM_ALERT_WINDOW permission
   * (required to show floating overlay above other apps).
   */
  canDrawOverlays: (): boolean => {
    if (!_native) return false;
    try { return _native.canDrawOverlays(); } catch { return false; }
  },
};
