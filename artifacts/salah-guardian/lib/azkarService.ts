/**
 * Azkar Overlay — Core Service
 * Isolated module. Does NOT interact with prayer or adhan systems.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AzkarSettings {
  enabled: boolean;
  frequencyMinutes: number;
  displaySeconds: number;
  opacity: number;
  fontSize: "small" | "medium" | "large";
  position: "left" | "right";
  vibration: boolean;
  backgroundNotifications: boolean;
}

export interface Zikr {
  arabic: string;
  transliteration: string;
  translation: string;
}

// ── Azkar Content ─────────────────────────────────────────────────────────────

export const AZKAR: Zikr[] = [
  {
    arabic: "سُبْحَانَ اللَّهِ",
    transliteration: "Subhāna Allah",
    translation: "Glory be to Allah",
  },
  {
    arabic: "الْحَمْدُ لِلَّهِ",
    transliteration: "Alhamdulillāh",
    translation: "All praise is due to Allah",
  },
  {
    arabic: "لَا إِلَهَ إِلَّا اللَّهُ",
    transliteration: "Lā ilāha illallāh",
    translation: "There is no god but Allah",
  },
  {
    arabic: "أَسْتَغْفِرُ اللَّهَ",
    transliteration: "Astaghfirullāh",
    translation: "I seek forgiveness from Allah",
  },
  {
    arabic: "اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ",
    transliteration: "Allāhumma ṣalli wa sallim 'alā nabiyyinā Muḥammad",
    translation: "O Allah, send blessings upon our Prophet Muhammad",
  },
  {
    arabic: "اللَّهُ أَكْبَرُ",
    transliteration: "Allāhu Akbar",
    translation: "Allah is the Greatest",
  },
  {
    arabic: "لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ",
    transliteration: "Lā ḥawla wa lā quwwata illā billāh",
    translation: "No power except with Allah",
  },
  {
    arabic: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ",
    transliteration: "Subḥāna Allāhi wa biḥamdih",
    translation: "Glory and praise be to Allah",
  },
  {
    arabic: "سُبْحَانَ اللَّهِ الْعَظِيمِ",
    transliteration: "Subḥāna Allāhil Aẓīm",
    translation: "Glory be to Allah, the Magnificent",
  },
  {
    arabic: "اللَّهُمَّ اغْفِرْ لِي",
    transliteration: "Allāhumma-ghfir lī",
    translation: "O Allah, forgive me",
  },
  {
    arabic: "حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ",
    transliteration: "Ḥasbunallāhu wa ni'mal wakīl",
    translation: "Allah suffices us — He is the best Guardian",
  },
  {
    arabic: "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً",
    transliteration: "Rabbanā ātinā fid-dunyā ḥasanah wa fil-ākhirati ḥasanah",
    translation: "Our Lord, grant us good in this world and in the Hereafter",
  },
  {
    arabic: "بِسْمِ اللَّهِ تَوَكَّلْتُ عَلَى اللَّهِ",
    transliteration: "Bismillāhi tawakkaltu 'alallāh",
    translation: "In the name of Allah, I put my trust in Allah",
  },
  {
    arabic: "اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي",
    transliteration: "Allāhumma innaka 'afuwwun tuḥibbul 'afwa fa'fu 'annī",
    translation: "O Allah, You are Forgiving and love forgiveness, so forgive me",
  },
];

// ── Defaults ──────────────────────────────────────────────────────────────────

export const DEFAULT_AZKAR_SETTINGS: AzkarSettings = {
  enabled: false,
  frequencyMinutes: 15,
  displaySeconds: 6,
  opacity: 0.97,
  fontSize: "medium",
  position: "right",
  vibration: false,
  backgroundNotifications: true,
};

// ── Storage (separate namespace from prayer storage) ──────────────────────────

const SETTINGS_KEY = "@azkar/settings_v1";
const HISTORY_KEY  = "@azkar/history_v1";
const REPEAT_BUFFER = 4; // avoid repeating last N azkar

export async function loadAzkarSettings(): Promise<AzkarSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_AZKAR_SETTINGS };
    return { ...DEFAULT_AZKAR_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_AZKAR_SETTINGS };
  }
}

export async function saveAzkarSettings(
  partial: Partial<AzkarSettings>
): Promise<AzkarSettings> {
  const current = await loadAzkarSettings();
  const updated  = { ...current, ...partial };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  return updated;
}

// ── Smart rotation ────────────────────────────────────────────────────────────

async function loadHistory(): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveHistory(h: number[]): Promise<void> {
  try {
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(h));
  } catch { /* ignore */ }
}

export async function pickNextZikr(): Promise<Zikr> {
  const history  = await loadHistory();
  const excluded = new Set(history.slice(-REPEAT_BUFFER));
  const pool     = AZKAR
    .map((_, i) => i)
    .filter((i) => !excluded.has(i));

  const candidates = pool.length > 0 ? pool : AZKAR.map((_, i) => i);
  const chosen     = candidates[Math.floor(Math.random() * candidates.length)];
  const newHistory = [...history, chosen].slice(-(REPEAT_BUFFER * 3));
  await saveHistory(newHistory);
  return AZKAR[chosen];
}

// ── Soft vibration (opt-in) ───────────────────────────────────────────────────

export function azkarSoftVibrate(): void {
  if (Platform.OS === "web") return;
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch { /* ignore */ }
}

// ── Background notification scheduling ───────────────────────────────────────

const AZKAR_PREFIX = "azkar_bg_";
const SCHEDULE_AHEAD = 10; // schedule N notifications ahead

export async function scheduleAzkarNotifications(
  settings: AzkarSettings
): Promise<void> {
  if (Platform.OS === "web") return;

  await cancelAzkarNotifications();
  if (!settings.enabled || !settings.backgroundNotifications) return;

  const intervalMs = settings.frequencyMinutes * 60 * 1000;
  const now        = Date.now();

  for (let i = 1; i <= SCHEDULE_AHEAD; i++) {
    const zikr   = await pickNextZikr();
    const fireAt = new Date(now + i * intervalMs);

    await Notifications.scheduleNotificationAsync({
      identifier: `${AZKAR_PREFIX}${i}`,
      content: {
        title: "🤲 ذكر",
        body:  `${zikr.arabic}\n${zikr.transliteration}`,
        data:  { type: "azkar" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
      },
    }).catch(() => {});
  }
}

export async function cancelAzkarNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of all) {
      if (n.identifier.startsWith(AZKAR_PREFIX)) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch { /* ignore */ }
}
