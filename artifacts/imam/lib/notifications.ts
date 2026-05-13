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

// Sound file names must match the filenames bundled in app.json
const ADHAN_CHANNEL_SOUNDS: Record<string, string> = {
  alafasy:    "azan1.mp3",
  abdulbasit: "azan2.mp3",
  madinah:    "azan3.mp3",
  makkah:     "azan4.mp3",
  sudais:     "azan5.mp3",
  sghamdi:    "azan6.mp3",
  haifa:      "azan7.mp3",
  turkey:     "azan8.mp3",
};

/**
 * Create/update all Android notification channels.
 * Must be called before scheduling any notification.
 * Safe to call multiple times (idempotent).
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== "android") return;

  // ── Adhan channel per voice (sound is baked into the channel on Android) ──
  for (const [voice, soundFile] of Object.entries(ADHAN_CHANNEL_SOUNDS)) {
    await Notifications.setNotificationChannelAsync(CHANNEL_ADHAN(voice), {
      name:                 `Adhan — ${voice}`,
      importance:           Notifications.AndroidImportance.MAX,
      sound:                soundFile,
      bypassDnd:            true,
      vibrationPattern:     [0, 400, 200, 400],
      lightColor:           "#34d399",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge:            false,
      enableLights:         true,
      enableVibrate:        true,
    }).catch(() => {});
  }

  // ── Prayer text-reminder channel (no custom sound — uses system default) ──
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

  // ── Azkar channel — MAX importance so it shows as a heads-up banner
  //    over any app (the closest thing to "floating over other apps" in
  //    managed Expo without a native module) ──────────────────────────────────
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

  await cancelAllPrayerReminders();
  const now          = new Date();
  const prayerOrder  = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

  for (const name of prayerOrder) {
    const time = times[name];
    if (!time) continue;

    // At prayer time
    if (time > now) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c1: any = { title: `🕌 ${name} Prayer`, body: `It's time for ${name} prayer.`, sound: "default", data: { prayerName: name, type: "prayer_start" } };
      if (Platform.OS === "android") c1.android = { channelId: CHANNEL_PRAYER };
      await Notifications.scheduleNotificationAsync({
        content: c1,
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: time },
      }).catch(() => {});
    }

    // Follow-up after offset minutes
    if (offsetMinutes > 0) {
      const reminderTime = new Date(time.getTime() + offsetMinutes * 60_000);
      if (reminderTime > now) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c2: any = { title: `⚠️ ${name} Reminder`, body: `Have you prayed ${name}? ${offsetMinutes} minutes have passed.`, sound: "default", data: { prayerName: name, type: "prayer_reminder" } };
        if (Platform.OS === "android") c2.android = { channelId: CHANNEL_PRAYER };
        await Notifications.scheduleNotificationAsync({
          content: c2,
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderTime },
        }).catch(() => {});
      }
    }
  }
}

export async function cancelAllPrayerReminders(): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function sendImmediateNotification(
  title: string,
  body:  string
): Promise<void> {
  if (Platform.OS === "web") return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = { title, body, sound: "default" };
  if (Platform.OS === "android") c.android = { channelId: CHANNEL_PRAYER };
  await Notifications.scheduleNotificationAsync({ content: c, trigger: null }).catch(() => {});
}

export async function getScheduledNotifications() {
  if (Platform.OS === "web") return [];
  return Notifications.getAllScheduledNotificationsAsync();
}
