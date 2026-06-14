import { Audio, AVPlaybackStatus } from "expo-av";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { AdhanVoice } from "./storage";
import { CHANNEL_ADHAN, setupNotificationChannels } from "./notifications";

export { AdhanVoice };

export const ADHAN_VOICE_LABELS: Record<string, string> = {
  alafasy:    "Mishary Rashid Alafasy",
  abdulbasit: "Abdul Basit Abd us-Samad",
  madinah:    "Madinah (Al-Masjid An-Nabawi)",
  makkah:     "Makkah (Al-Masjid Al-Haram)",
  sudais:     "Abdur-Rahman As-Sudais",
  sghamdi:    "Saad Al-Ghamdi",
  haifa:      "Egyptian Traditional",
  turkey:     "Turkish Traditional",
};

// ─── Bundled local audio (fully offline) ─────────────────────────────────────
const ADHAN_LOCAL_ASSETS: Record<string, any> = {
  alafasy:    require("../assets/audio/azan1.mp3"),
  abdulbasit: require("../assets/audio/azan2.mp3"),
  madinah:    require("../assets/audio/azan3.mp3"),
  makkah:     require("../assets/audio/azan4.mp3"),
  sudais:     require("../assets/audio/azan5.mp3"),
  sghamdi:    require("../assets/audio/azan6.mp3"),
  haifa:      require("../assets/audio/azan7.mp3"),
  turkey:     require("../assets/audio/azan8.mp3"),
};

// Filenames used in notification payloads — must match app.json sounds array.
const ADHAN_SOUND_FILES: Record<string, string> = {
  alafasy:    "azan1.mp3",
  abdulbasit: "azan2.mp3",
  madinah:    "azan3.mp3",
  makkah:     "azan4.mp3",
  sudais:     "azan5.mp3",
  sghamdi:    "azan6.mp3",
  haifa:      "azan7.mp3",
  turkey:     "azan8.mp3",
};

// ─── In-app audio playback (expo-av) ─────────────────────────────────────────

let currentSound: Audio.Sound | null = null;

/** Play the adhan audio inside the app (foreground). */
export async function playAdhanInApp(voice: AdhanVoice, volume = 1.0): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await stopAdhan();
    await Audio.setAudioModeAsync({
      allowsRecordingIOS:       false,
      playsInSilentModeIOS:     true,
      staysActiveInBackground:  false,
      shouldDuckAndroid:        false,
    });
    const asset  = ADHAN_LOCAL_ASSETS[voice] ?? ADHAN_LOCAL_ASSETS.alafasy;
    const { sound } = await Audio.Sound.createAsync(asset, { shouldPlay: true, volume });
    currentSound = sound;
    sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
        currentSound = null;
      }
    });
  } catch {
    // Graceful no-op if audio unavailable
  }
}

/** Stop any currently playing adhan audio. */
export async function stopAdhan(): Promise<void> {
  if (!currentSound) return;
  try {
    await currentSound.stopAsync();
    await currentSound.unloadAsync();
  } catch {
    // ignore
  } finally {
    currentSound = null;
  }
}

/** Play a short preview of the selected adhan voice (first 10 seconds). */
export async function testAdhanPreview(voice: AdhanVoice, volume = 1.0): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await stopAdhan();
    await Audio.setAudioModeAsync({
      allowsRecordingIOS:       false,
      playsInSilentModeIOS:     true,
      staysActiveInBackground:  false,
      shouldDuckAndroid:        false,
    });
    const asset = ADHAN_LOCAL_ASSETS[voice] ?? ADHAN_LOCAL_ASSETS.alafasy;
    const { sound } = await Audio.Sound.createAsync(asset, { shouldPlay: true, volume });
    currentSound = sound;
    // Auto-stop after 10 seconds for preview
    setTimeout(async () => {
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
        if (currentSound === sound) currentSound = null;
      } catch {
        // ignore
      }
    }, 10_000);
  } catch {
    // Graceful no-op
  }
}

// ─── Notification-based scheduling (Expo Go / iOS fallback) ──────────────────

const PRAYER_ORDER = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;

/**
 * Schedule expo-notifications for each prayer time using the adhan sound.
 * Used as fallback when native AlarmManager is unavailable (Expo Go / iOS).
 */
export async function scheduleAdhanNotifications(
  times:    Record<string, Date>,
  voice:    AdhanVoice,
  _fallback = false
): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await setupNotificationChannels();
    const channelId = CHANNEL_ADHAN(voice);
    const soundFile = ADHAN_SOUND_FILES[voice] ?? "azan1.mp3";
    const now = Date.now();

    for (const prayer of PRAYER_ORDER) {
      const time = times[prayer];
      if (!time || time.getTime() <= now) continue;

      await Notifications.scheduleNotificationAsync({
        content: {
          title:     `🕌 ${prayer} Prayer`,
          body:      "Time for prayer — Allahu Akbar",
          sound:     soundFile,
          priority:  Notifications.AndroidNotificationPriority.MAX,
          data:      { prayer, voice },
          ...(Platform.OS === "android" ? { channelId } : {}),
        },
        trigger: {
          type:  Notifications.SchedulableTriggerInputTypes.DATE,
          date:  time,
        },
      });
    }
  } catch {
    // expo-notifications not fully supported in Expo Go
  }
}

/** Cancel all notification-based adhan alerts. */
export async function cancelAdhanNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const adhanIds  = scheduled
      .filter((n) => n.content.data?.["prayer"] !== undefined)
      .map((n) => n.identifier);
    await Promise.all(adhanIds.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
  } catch {
    // ignore
  }
}
