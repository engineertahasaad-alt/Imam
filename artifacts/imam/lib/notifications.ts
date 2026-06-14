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
        priority: Notifications.AndroidNotificationPriority.MAX,
      }),
    });
  } catch {
    // expo-notifications not fully supported in Expo Go on SDK 53+
  }
}

// ─── Channel IDs ──────────────────────────────────────────────────────────────
const CHANNEL_VERSION = "v3";
export const CHANNEL_ADHAN  = (voice: string) => `adhan_${voice}_${CHANNEL_VERSION}`;
export const CHANNEL_PRAYER = "prayer_reminder_v3";
export const CHANNEL_AZKAR  = "azkar_reminder_v3";

// Android channel sounds without file extension (res/raw/azan2, etc.)
// azan1 (Alafasy) has been removed — files start from azan2.
const ADHAN_CHANNEL_SOUNDS: Record<string, string> = {
  abdulbasit: "azan2",
  madinah:    "azan3",
  makkah:     "azan4",
  sudais:     "azan5",
  sghamdi:    "azan6",
  haifa:      "azan7",
  turkey:     "azan8",
};

// ─── Permission request ───────────────────────────────────────────────────────

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

// ─── Channel setup ────────────────────────────────────────────────────────────

export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    // Adhan channels — one per voice with dedicated sound
    for (const [voice, sound] of Object.entries(ADHAN_CHANNEL_SOUNDS)) {
      await Notifications.setNotificationChannelAsync(CHANNEL_ADHAN(voice), {
        name:        `Adhan — ${voice}`,
        importance:  Notifications.AndroidImportance.MAX,
        sound:       sound,
        vibrationPattern: [0, 250, 250, 250],
        enableVibrate: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd:   true,
      });
    }
    // Prayer reminder channel
    await Notifications.setNotificationChannelAsync(CHANNEL_PRAYER, {
      name:        "Prayer Reminders",
      importance:  Notifications.AndroidImportance.HIGH,
      sound:       "default",
      vibrationPattern: [0, 250, 250, 250],
      enableVibrate: true,
    });
    // Azkar channel
    await Notifications.setNotificationChannelAsync(CHANNEL_AZKAR, {
      name:       "Azkar Reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound:      "default",
    });
  } catch {
    // ignore — Expo Go doesn't support all channel options
  }
}

// ─── Prayer reminders ─────────────────────────────────────────────────────────

const PRAYER_NAMES = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;

/** Cancel all prayer reminder notifications. */
export async function cancelAllPrayerReminders(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const ids = scheduled
      .filter((n) => n.identifier.startsWith("prayer_"))
      .map((n) => n.identifier);
    await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
  } catch {
    // ignore
  }
}

/**
 * Schedule prayer reminder notifications for the given prayer times.
 * @param prayerMap  Map of prayer name → Date
 * @param offsetMin  Minutes before prayer time to fire the reminder
 */
export async function scheduleAllPrayerReminders(
  prayerMap: Record<string, Date>,
  offsetMin = 10
): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await cancelAllPrayerReminders();
    await setupNotificationChannels();

    const now = Date.now();
    for (const name of PRAYER_NAMES) {
      const time = prayerMap[name];
      if (!time) continue;
      const fireAt = time.getTime() - offsetMin * 60_000;
      if (fireAt <= now) continue;

      await Notifications.scheduleNotificationAsync({
        identifier: `prayer_${name}_${fireAt}`,
        content: {
          title: `🕌 ${name} in ${offsetMin} minutes`,
          body:  "Time to prepare for prayer",
          sound: "default",
          priority: Notifications.AndroidNotificationPriority.HIGH,
          ...(Platform.OS === "android" ? { channelId: CHANNEL_PRAYER } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(fireAt),
        },
      });
    }
  } catch {
    // expo-notifications not fully supported in Expo Go
  }
}

// ─── Debug helpers ────────────────────────────────────────────────────────────

/** Return all currently scheduled notifications. */
export async function getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  try {
    return await Notifications.getAllScheduledNotificationsAsync();
  } catch {
    return [];
  }
}

/** Fire an immediate test notification. */
export async function sendImmediateNotification(title: string, body: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: "default" },
      trigger: null,
    });
  } catch {
    // ignore
  }
}
