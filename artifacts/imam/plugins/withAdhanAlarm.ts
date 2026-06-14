/**
 * withAdhanAlarm — Expo Config Plugin
 *
 * Patches AndroidManifest.xml to register:
 *   • AdhanAlarmReceiver     — receives AlarmManager intents at prayer time
 *   • AdhanBootReceiver      — restores alarms after reboot / app update
 *   • AdhanForegroundService — plays full adhan audio as a protected service
 *   • FloatingAzkarService   — renders azkar overlay above all apps (SYSTEM_ALERT_WINDOW)
 *
 * Applied in app.json under "plugins".
 * Runs during `expo prebuild` / EAS Build.
 */

import type { ConfigPlugin } from "expo/config-plugins";
import { withAndroidManifest, AndroidConfig } from "expo/config-plugins";

const withAdhanAlarm: ConfigPlugin = (config) =>
  withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    const app = AndroidConfig.Manifest.getMainApplication(manifest);
    if (!app) return cfg;

    if (!app.receiver) app.receiver = [];
    if (!app.service)  app.service  = [];

    // ── AdhanAlarmReceiver ────────────────────────────────────────────────────
    // Fired by AlarmManager at exact prayer time.
    // exported=false: only the system (AlarmManager) can send this intent.
    upsert(app.receiver as any[], ".adhan.AdhanAlarmReceiver", {
      $: {
        "android:name":     ".adhan.AdhanAlarmReceiver",
        "android:exported": "false",
        "android:enabled":  "true",
      },
      "intent-filter": [{
        action: [{ $: { "android:name": "com.imam.app.ADHAN_ALARM" } }],
      }],
    });

    // ── AdhanBootReceiver ─────────────────────────────────────────────────────
    // Listens for BOOT_COMPLETED, Samsung/HTC fast-boot, and MY_PACKAGE_REPLACED.
    // exported=true: system broadcasts require exported=true on Android 12+.
    upsert(app.receiver as any[], ".adhan.AdhanBootReceiver", {
      $: {
        "android:name":     ".adhan.AdhanBootReceiver",
        "android:exported": "true",
        "android:enabled":  "true",
      },
      "intent-filter": [{
        $: { "android:priority": "999" },
        action: [
          { $: { "android:name": "android.intent.action.BOOT_COMPLETED" } },
          { $: { "android:name": "android.intent.action.QUICKBOOT_POWERON" } },
          { $: { "android:name": "com.htc.intent.action.QUICKBOOT_POWERON" } },
          { $: { "android:name": "android.intent.action.MY_PACKAGE_REPLACED" } },
        ],
      }],
    });

    // ── AdhanForegroundService ────────────────────────────────────────────────
    // Plays full-length adhan audio (3-5 min) in a protected foreground service.
    // foregroundServiceType=mediaPlayback: required for background audio on Android 10+.
    upsert(app.service as any[], ".adhan.AdhanForegroundService", {
      $: {
        "android:name":                  ".adhan.AdhanForegroundService",
        "android:exported":              "false",
        "android:foregroundServiceType": "mediaPlayback",
        "android:stopWithTask":          "false",
      },
    });

    // ── FloatingAzkarService ──────────────────────────────────────────────────
    // Shows azkar text above all apps using WindowManager TYPE_APPLICATION_OVERLAY.
    // Requires SYSTEM_ALERT_WINDOW permission (declared in app.json permissions).
    // foregroundServiceType=specialUse: required for overlay services on Android 14+.
    upsert(app.service as any[], ".adhan.FloatingAzkarService", {
      $: {
        "android:name":                  ".adhan.FloatingAzkarService",
        "android:exported":              "false",
        "android:foregroundServiceType": "specialUse",
        "android:stopWithTask":          "false",
      },
      "property": [{
        $: {
          "android:name":  "android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE",
          "android:value": "floating azkar overlay",
        },
      }],
    });

    return cfg;
  });

/** Replace an entry by android:name if it already exists, otherwise push. */
function upsert(arr: any[], name: string, entry: any) {
  const idx = arr.findIndex((x) => x.$?.["android:name"] === name);
  if (idx >= 0) arr[idx] = entry;
  else arr.push(entry);
}

export default withAdhanAlarm;
