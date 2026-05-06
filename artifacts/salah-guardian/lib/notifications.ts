import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;

  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === "granted";
}

export async function scheduleAllPrayerReminders(
  times: Record<string, Date>,
  offsetMinutes = 5
): Promise<void> {
  if (Platform.OS === "web") return;

  await cancelAllPrayerReminders();
  const now = new Date();

  const prayerOrder = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

  for (const name of prayerOrder) {
    const time = times[name];
    if (!time) continue;

    // Soft reminder: at prayer time
    const softTime = new Date(time);
    if (softTime > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `🕌 ${name} Prayer`,
          body: `It's time for ${name} prayer.`,
          sound: true,
          data: { prayerName: name, type: "prayer_start" },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: softTime,
        },
      }).catch(() => {});
    }

    // Reminder: after offset minutes
    if (offsetMinutes > 0) {
      const reminderTime = new Date(
        time.getTime() + offsetMinutes * 60000
      );
      if (reminderTime > now) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `⚠️ ${name} Reminder`,
            body: `Have you prayed ${name}? ${offsetMinutes} minutes have passed.`,
            sound: true,
            data: { prayerName: name, type: "prayer_reminder" },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: reminderTime,
          },
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
  body: string
): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null,
  }).catch(() => {});
}

export async function getScheduledNotifications() {
  if (Platform.OS === "web") return [];
  return Notifications.getAllScheduledNotificationsAsync();
}
