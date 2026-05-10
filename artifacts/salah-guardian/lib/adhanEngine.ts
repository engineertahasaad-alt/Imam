import { Audio, AVPlaybackStatus } from "expo-av";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { AdhanVoice } from "./storage";

export { AdhanVoice };

export const ADHAN_VOICE_LABELS: Record<AdhanVoice, string> = {
  alafasy:    "Mishary Rashid Alafasy",
  abdulbasit: "Abdul Basit Abd us-Samad",
  madinah:    "Madinah (Al-Masjid An-Nabawi)",
  makkah:     "Makkah (Al-Masjid Al-Haram)",
};

/**
 * Remote adhan audio URLs used for in-app foreground playback.
 * For a fully offline native build, replace these with:
 *   require("../assets/audio/adhan_alafasy.mp3")  etc.
 */
const ADHAN_REMOTE_URLS: Record<AdhanVoice, string> = {
  alafasy:    "https://www.islamcan.com/audio/adhan/azan1.mp3",
  abdulbasit: "https://www.islamcan.com/audio/adhan/azan2.mp3",
  madinah:    "https://www.islamcan.com/audio/adhan/azan3.mp3",
  makkah:     "https://www.islamcan.com/audio/adhan/azan4.mp3",
};

const PRAYER_ORDER = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;

let currentSound: Audio.Sound | null = null;

async function configureAudioSession() {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS:          false,
      playsInSilentModeIOS:        true,
      staysActiveInBackground:     false,
      shouldDuckAndroid:           false,
    });
  } catch { /* ignore on web */ }
}

/**
 * Play adhan audio in the foreground (app is open).
 * Stops any currently playing adhan first.
 */
export async function playAdhanInApp(voice: AdhanVoice, volume = 0.8): Promise<void> {
  if (Platform.OS === "web") return;

  await stopAdhan();
  await configureAudioSession();

  try {
    const url = ADHAN_REMOTE_URLS[voice];
    const { sound } = await Audio.Sound.createAsync(
      { uri: url },
      { shouldPlay: true, volume: Math.max(0, Math.min(1, volume)) }
    );
    currentSound = sound;
    sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
        currentSound = null;
      }
    });
  } catch (err) {
    console.warn("[AdhanEngine] playAdhanInApp error:", err);
  }
}

/** Stop any in-app adhan currently playing. */
export async function stopAdhan(): Promise<void> {
  if (!currentSound) return;
  try {
    await currentSound.stopAsync();
    await currentSound.unloadAsync();
  } catch { /* ignore */ }
  currentSound = null;
}

/** Returns true if adhan is currently playing. */
export function isAdhanPlaying(): boolean {
  return currentSound !== null;
}

// ─── Notification-based adhan scheduling ─────────────────────────────────────

const ADHAN_NOTIFICATION_PREFIX = "adhan_";

/**
 * Schedule adhan notification at exact prayer times.
 * On native, this fires even when the app is backgrounded/closed.
 * Custom notification sounds can be added in a native build via
 * android/app/src/main/res/raw/adhan_<voice>.mp3
 * and ios/<AppName>/adhan_<voice>.caf
 */
export async function scheduleAdhanNotifications(
  times: Record<string, Date>,
  voice: AdhanVoice,
  enabled: boolean
): Promise<void> {
  if (Platform.OS === "web") return;

  await cancelAdhanNotifications();
  if (!enabled) return;

  const now = new Date();
  const voiceLabel = ADHAN_VOICE_LABELS[voice];

  const arabicNames: Record<string, string> = {
    Fajr: "الفجر", Dhuhr: "الظهر", Asr: "العصر",
    Maghrib: "المغرب", Isha: "العشاء",
  };

  for (const name of PRAYER_ORDER) {
    const time = times[name];
    if (!time || time <= now) continue;

    await Notifications.scheduleNotificationAsync({
      identifier: `${ADHAN_NOTIFICATION_PREFIX}${name}`,
      content: {
        title:  `🕌 أذان ${arabicNames[name] ?? name}`,
        body:   `${name} prayer time — ${voiceLabel}`,
        sound:  true,
        data:   { prayerName: name, type: "adhan", voice },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: time,
      },
    }).catch(() => {});
  }
}

/** Cancel all scheduled adhan notifications. */
export async function cancelAdhanNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.identifier.startsWith(ADHAN_NOTIFICATION_PREFIX)) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch { /* ignore */ }
}

/** Play a short preview clip (first 15s) for the settings "Test" button. */
export async function testAdhanPreview(voice: AdhanVoice, volume = 0.8): Promise<void> {
  await playAdhanInApp(voice, volume);
  setTimeout(() => stopAdhan(), 15_000);
}
