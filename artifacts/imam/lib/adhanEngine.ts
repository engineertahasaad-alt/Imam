import { Audio, AVPlaybackStatus } from "expo-av";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { AdhanVoice } from "./storage";
import { CHANNEL_ADHAN, setupNotificationChannels } from "./notifications";

export { AdhanVoice };

export const ADHAN_VOICE_LABELS: Record<string, string> = {
  alafasy: "Mishary Rashid Alafasy",
  abdulbasit: "Abdul Basit Abd us-Samad",
  madinah: "Madinah (Al-Masjid An-Nabawi)",
  makkah: "Makkah (Al-Masjid Al-Haram)",
  sudais: "Abdur-Rahman As-Sudais",
  sghamdi: "Saad Al-Ghamdi",
  haifa: "Egyptian Traditional",
  turkey: "Turkish Traditional",
};

// ─── Bundled local audio (fully offline) ─────────────────────────────────────
// Static require() so Metro bundler includes each file at build time.
const ADHAN_LOCAL_ASSETS: Record<string, any> = {
  alafasy: require("../assets/audio/azan1.mp3"),
  abdulbasit: require("../assets/audio/azan2.mp3"),
  madinah: require("../assets/audio/azan3.mp3"),
  makkah: require("../assets/audio/azan4.mp3"),
  sudais: require("../assets/audio/azan5.mp3"),
  sghamdi: require("../assets/audio/azan6.mp3"),
  haifa: require("../assets/audio/azan7.mp3"),
  turkey: require("../assets/audio/azan8.mp3"),
};

// Filenames used in notification payloads — must match app.json sounds array.
const ADHAN_SOUND_FILES: Record<string, string> = {
  alafasy: "azan1.mp3",
  abdulbasit: "azan2.mp3",
  madinah: "azan3.mp3",
  makkah: "azan4.mp3",
  sudais: "azan5.mp3",
  sghamdi: "azan6.mp3",
  haifa: "azan7.mp3",