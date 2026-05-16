/**
 * withAdhanAlarm — Expo Config Plugin
 *
 * Patches AndroidManifest.xml to register:
 *   • AdhanAlarmReceiver  — receives AlarmManager intents at prayer time
 *   • AdhanBootReceiver   — restores alarms after reboot / app update
 *   • AdhanForegroundService — plays full adhan audio as a protected service
 *
 * Applied in app.json under "plugins".
 * Runs during `expo prebuild` / EAS Build.
 */

const { withAndroidManifest, AndroidConfig } = require("expo/config-plugins");

const withAdhanAlarm = (config) =>
  withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    const app = AndroidConfig.Manifest.getMainApplication(manifest);
    if (!app) return cfg;

    if (!app.receiver) app.receiver = [];
    if (!app.service)  app.service  = [];

    // ── AdhanAlarmReceiver ────────────────────────────────────────────────────
    upsert(app.receiver, ".adhan.AdhanAlarmReceiver", {
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
    upsert(app.receiver, ".adhan.AdhanBootReceiver", {
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
    upsert(app.service, ".adhan.AdhanForegroundService", {
      $: {
        "android:name":                  ".adhan.AdhanForegroundService",
        "android:exported":              "false",
        "android:foregroundServiceType": "mediaPlayback",
        "android:stopWithTask":          "false",
      },
    });

    return cfg;
  });

/** Replace an entry by android:name if it already exists, otherwise push. */
function upsert(arr, name, entry) {
  const idx = arr.findIndex((x) => x.$?.["android:name"] === name);
  if (idx >= 0) arr[idx] = entry;
  else arr.push(entry);
}

module.exports = withAdhanAlarm;
