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
  sudais:     "Abdur-Rahman As-Sudais",
  sghamdi:    "Saad Al-Ghamdi",
  haifa:      "Egyptian Traditional",
  turkey:     "Turkish Traditional",
};

// ─── Bundled local audio (offline-capable) ───────────────────────────────────
// Static require() calls are required so Metro bundler includes each file.
// These files live at assets/audio/azan1.mp3 … azan8.mp3.
// Metro bundler resolves require() for audio assets to a numeric ID at build time.
const ADHAN_LOCAL_ASSETS: Record<AdhanVoice, number> = {
  alafasy:    require("../assets/audio/azan1.mp3"),
  abdulbasit: require("../assets/audio/azan2.mp3"),
  madinah:    require("../assets/audio/azan3.mp3"),
  makkah:     require("../assets/audio/azan4.mp3"),
  sudais:     require("../assets/audio/azan5.mp3"),
  sghamdi:    require("../assets/audio/azan6.mp3"),
  haifa:      require("../assets/audio/azan7.mp3"),
  turkey:     require("../assets/audio/azan8.mp3"),
};

// Filenames used when referencing sounds inside notification payloads.
// Must match the entries in app.json "expo-notifications" > "sounds".
const ADHAN_SOUND_FILES: Record<AdhanVoice, string> = {
  alafasy:    "azan1.mp3",
  abdulbasit: "azan2.mp3",
  madinah:    "azan3.mp3",
  makkah:     "azan4.mp3",
  sudais:     "azan5.mp3",
  sghamdi:    "azan6.mp3",
  haifa:      "azan7.mp3",
  turkey:     "azan8.mp3",
};

const PRAYER_ORDER = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;

let currentSound: Audio.Sound | null = null;

async function configureAudioSession() {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS:      false,
      playsInSilentModeIOS:    true,
      staysActiveInBackground: false,
      shouldDuckAndroid:       false,
    });
  } catch { /* ignore on web */ }
}

/**
 * Play adhan from the bundled local asset (fully offline).
 * Falls back to nothing if loading somehow fails — no network calls made.
 */
export async function playAdhanInApp(voice: AdhanVoice, volume = 0.8): Promise<void> {
  if (Platform.OS === "web") return;

  await stopAdhan();
  await configureAudioSession();

  try {
    const source = ADHAN_LOCAL_ASSETS[voice];
    const { sound } = await Audio.Sound.createAsync(
      source,
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
 * Schedule adhan notifications at exact prayer times.
 * On native, fires even when the app is backgrounded/closed.
 * The notification sound references a bundled MP3 (configured in app.json).
 */
export async function scheduleAdhanNotifications(
  times: Record<string, Date>,
  voice: AdhanVoice,
  enabled: boolean
): Promise<void> {
  if (Platform.OS === "web") return;

  await cancelAdhanNotifications();
  if (!enabled) return;

  const now       = new Date();
  const soundFile = ADHAN_SOUND_FILES[voice];
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
        title: `🕌 أذان ${arabicNames[name] ?? name}`,
        body:  `${name} prayer time — ${voiceLabel}`,
        sound: soundFile,
        data:  { prayerName: name, type: "adhan", voice },
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

/** Play a short preview clip (first 15 s) for the settings "Test" button. */
export async function testAdhanPreview(voice: AdhanVoice, volume = 0.8): Promise<void> {
  await playAdhanInApp(voice, volume);
  setTimeout(() => stopAdhan(), 15_000);
}
