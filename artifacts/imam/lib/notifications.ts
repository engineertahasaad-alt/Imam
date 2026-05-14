import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// ─── Notification handler (foreground) ───────────────────────────────────────
if (Platform.OS !== "web") {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert:  true,
        shouldPlaySound:  true,
        shouldSetBadge:   false,
        shouldShowBanner: true,
        shouldShowList:   true,
        priority:         Notifications.AndroidNotificationPriority.MAX,
      }),
    });
  } catch {
    // expo-notifications not fully supported in Expo Go on SDK 53+
  }
}

// ─── Channel IDs ──────────────────────────────────────────────────────────────
export const CHANNEL_ADHAN   = (voice: string) => `adhan_${voice}`;
export const CHANNEL_PRAYER  = "prayer_reminder";
export const CHANNEL_AZKAR   = "azkar_reminder";

// BUG FIX: Android channel sounds must be specified WITHOUT file extension.
// The files are bundled as res/raw/azan1, res/raw/azan2, etc.
const ADHAN_CHANNEL_SOUNDS: Record<string, string> = {
  alafasy:    "azan1",
  abdulbasit: "azan2",
  madinah:    "azan3",
  makkah:     "azan4",
  sudais:     "azan5",
  sghamdi:    "azan6",
  haifa:      "azan7",
  turkey:     "azan8",
};

// Prefix for prayer-reminder notifications so we can cancel them selectively
// without wiping adhan notifications (and vice-versa).
const PRAYER_NOTIFICATION_PREFIX = "prayer_";

/**
 * Create/update all Android notification channels.
 * Must be called before scheduling any notification.
 * Safe to call multiple times (idempotent).
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== "android") return;

  // ── Adhan channel per voice (sound is baked into the channel on Android) ──
  for (const [voice, soundName] of Object.entries(ADHAN_CHANNEL_SOUNDS)) {
    await Notifications.setNotificationChannelAsync(CHANNEL_ADHAN(voice), {
      name:                 `Adhan — ${voice}`,
      importance:           Notifications.AndroidImportance.MAX,
      sound:                soundName,          // no extension — Android res/raw lookup
      bypassDnd:            true,
      vibrationPattern:     [0, 400, 200, 400],
      lightColor:           "#34d399",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge:            false,
      enableLights:         true,
      enableVibrate:        true,
    }).catch(() => {});
  }

  // ── Prayer text-reminder channel (system default sound) ──
  await Notifications.setNotificationChannelAsync(CHANNEL_PRAYER, {
    name:                 "Prayer Reminders",
    importance:           Notifications.AndroidImportance.HIGH,
    sound:                "default",
    bypassDnd:            false,
    vibrationPattern:     [0, 250, 250, 250],
    lightColor:           "#34d399",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    showBadge:            false,
    enableLights:         true,
    enableVibrate:        true,
  }).catch(() => {});

  // ── Azkar channel — MAX importance for heads-up banners ──
  await Notifications.setNotificationChannelAsync(CHANNEL_AZKAR, {
    name:                 "Azkar Reminders",
    importance:           Notifications.AndroidImportance.MAX,
    sound:                null,
    bypassDnd:            false,
    vibrationPattern:     [0, 100],
    lightColor:           "#34d399",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    showBadge:            false,
    enableLights:         true,
    enableVibrate:        false,
  }).catch(() => {});
}

// ─── Permissions ──────────────────────────────────────────────────────────────

/**
 * Request notification permissions, set up channels, and return whether
 * permissions were granted. Safe to call multiple times.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;

  // Channels must exist before we check/request permissions on Android
  await setupNotificationChannels();

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync({
      android: { allowAnnouncements: true },
    });
    finalStatus = status;
  }

  return finalStatus === "granted";
}

// ─── Prayer reminder scheduling ───────────────────────────────────────────────

export async function scheduleAllPrayerReminders(
  times:         Record<string, Date>,
  offsetMinutes: number = 5
): Promise<void> {
  if (Platform.OS === "web") return;

  // BUG FIX: Cancel only prayer-prefixed notifications, NOT adhan ones.
  await cancelAllPrayerReminders();

  const now         = new Date();
  const prayerOrder = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

  for (const name of prayerOrder) {
    const time = times[name];
    if (!time) continue;

    // At prayer time
    if (time > now) {
      // BUG FIX: Do not set `sound` in content on Android — the channel sound
      // is used automatically. Setting a mismatched sound here suppresses audio.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c1: any = {
        title: `🕌 ${name} Prayer`,
        body:  `It's time for ${name} prayer.`,
        data:  { prayerName: name, type: "prayer_start" },
      };
      if (Platform.OS === "android") {
        c1.android = { channelId: CHANNEL_PRAYER };
      } else {
        c1.sound = "default";
      }
      await Notifications.scheduleNotificationAsync({
        identifier: `${PRAYER_NOTIFICATION_PREFIX}${name}_start`,
        content: c1,
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: time },
      }).catch(() => {});
    }

    // Follow-up reminder after offset minutes
    if (offsetMinutes > 0) {
      const reminderTime = new Date(time.getTime() + offsetMinutes * 60_000);
      if (reminderTime > now) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c2: any = {
          title: `⚠️ ${name} Reminder`,
          body:  `Have you prayed ${name}? ${offsetMinutes} minutes have passed.`,
          data:  { prayerName: name, type: "prayer_reminder" },
        };
        if (Platform.OS === "android") {
          c2.android = { channelId: CHANNEL_PRAYER };
        } else {
          c2.sound = "default";
        }
        await Notifications.scheduleNotificationAsync({
          identifier: `${PRAYER_NOTIFICATION_PREFIX}${name}_reminder`,
          content: c2,
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderTime },
        }).catch(() => {});
      }
    }
  }
}

/**
 * BUG FIX: Cancel only prayer-prefixed notifications.
 * Previously called cancelAllScheduledNotificationsAsync() which also wiped
 * adhan notifications, leaving users with no adhan alarms at all.
 */
export async function cancelAllPrayerReminders(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.identifier.startsWith(PRAYER_NOTIFICATION_PREFIX)) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch { /* ignore */ }
}

export async function sendImmediateNotification(
  title: string,
  body:  string
): Promise<void> {
  if (Platform.OS === "web") return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = { title, body };
  if (Platform.OS === "android") {
    c.android = { channelId: CHANNEL_PRAYER };
  } else {
    c.sound = "default";
  }
  await Notifications.scheduleNotificationAsync({ content: c, trigger: null }).catch(() => {});
}

export async function getScheduledNotifications() {
  if (Platform.OS === "web") return [];
  return Notifications.getAllScheduledNotificationsAsync();
}
