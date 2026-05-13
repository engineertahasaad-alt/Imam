/**
 * Azkar Overlay — Core Service
 * Isolated module. Does NOT interact with prayer or adhan systems.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DailyZikr {
  id: string;
  arabicText: string;
  englishText: string;
  repeatCount: number;
  category: "morning" | "evening";
}

export interface AzkarSettings {
  enabled: boolean;
  frequencyMinutes: number;
  displaySeconds: number;
  opacity: number;
  fontSize: "small" | "medium" | "large";
  position: "left" | "right";
  vibration: boolean;
  backgroundNotifications: boolean;
  morningReminderEnabled: boolean;
  morningReminderHour: number;
  morningReminderMinute: number;
  eveningReminderEnabled: boolean;
  eveningReminderHour: number;
  eveningReminderMinute: number;
}

// ── Daily Completion Record ────────────────────────────────────────────────────

export interface DailyCompletionRecord {
  date: string;
  morning: boolean;
  evening: boolean;
}

const COMPLETION_KEY = "@azkar/completion_v1";

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function loadDailyCompletion(): Promise<DailyCompletionRecord> {
  const today = todayString();
  try {
    const raw = await AsyncStorage.getItem(COMPLETION_KEY);
    if (!raw) return { date: today, morning: false, evening: false };
    const parsed: DailyCompletionRecord = JSON.parse(raw);
    if (parsed.date !== today) return { date: today, morning: false, evening: false };
    return parsed;
  } catch {
    return { date: today, morning: false, evening: false };
  }
}

export async function markCategoryComplete(
  category: "morning" | "evening"
): Promise<DailyCompletionRecord> {
  const current = await loadDailyCompletion();
  const updated: DailyCompletionRecord = {
    ...current,
    [category]: true,
  };
  await AsyncStorage.setItem(COMPLETION_KEY, JSON.stringify(updated));
  return updated;
}

export interface Zikr {
  arabic: string;
  transliteration: string;
  translation: string;
}

export function dailyZikrToZikr(dz: DailyZikr): Zikr {
  return {
    arabic: dz.arabicText,
    transliteration: "",
    translation: dz.englishText,
  };
}

// ── Morning & Evening Azkar Content ──────────────────────────────────────────

export const MORNING_AZKAR: DailyZikr[] = [
  {
    id: "m1",
    arabicText: "رَضِيتُ بِاللَّهِ رَبًّا، وَبِالإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ نَبِيًّا",
    englishText: "I am pleased with Allah as my Lord, with Islam as my religion, and with Muhammad ﷺ as my Prophet",
    repeatCount: 3,
    category: "morning",
  },
  {
    id: "m2",
    arabicText: "اللَّهُمَّ إِنِّي أَصْبَحْتُ أُشْهِدُكَ، وَأُشْهِدُ حَمَلَةَ عَرْشِكَ، وَمَلَائِكَتَكَ، وَجَمِيعَ خَلْقِكَ، أَنَّكَ أَنْتَ اللَّهُ لَا إِلَهَ إِلَّا أَنْتَ، وَأَنَّ مُحَمَّدًا عَبْدُكَ وَرَسُولُكَ",
    englishText: "O Allah, I have entered the morning calling You to witness, the bearers of Your Throne, Your angels, and all creation, that You are Allah — none worthy of worship but You alone — and that Muhammad is Your servant and Messenger",
    repeatCount: 4,
    category: "morning",
  },
  {
    id: "m3",
    arabicText: "اللَّهُمَّ مَا أَصْبَحَ بِي مِنْ نِعْمَةٍ أَوْ بِأَحَدٍ مِنْ خَلْقِكَ، فَمِنْكَ وَحْدَكَ لَا شَرِيكَ لَكَ، فَلَكَ الْحَمْدُ وَلَكَ الشُّكْرُ",
    englishText: "O Allah, whatever blessing I or any of Your creation have this morning is from You alone, You have no partner. All praise is Yours and all thanks are Yours",
    repeatCount: 1,
    category: "morning",
  },
  {
    id: "m4",
    arabicText: "حَسْبِيَ اللَّهُ لَا إِلَهَ إِلَّا هُوَ عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ",
    englishText: "Allah is sufficient for me. There is no god but He. I have placed my trust in Him. He is the Lord of the Magnificent Throne",
    repeatCount: 7,
    category: "morning",
  },
  {
    id: "m5",
    arabicText: "بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ",
    englishText: "In the Name of Allah, with Whose Name nothing on earth or in the heavens can cause harm, and He is the All-Hearing, the All-Knowing",
    repeatCount: 3,
    category: "morning",
  },
  {
    id: "m6",
    arabicText: "اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ النُّشُورُ",
    englishText: "O Allah, by You we have entered the morning, by You we enter the evening, by You we live and die, and to You is the resurrection",
    repeatCount: 1,
    category: "morning",
  },
  {
    id: "m7",
    arabicText: "اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ",
    englishText: "O Allah, You are my Lord. None worthy of worship but You. You created me and I am Your slave. I keep Your covenant as best I can. I seek refuge in You from the evil of what I have done. I acknowledge Your favour upon me and acknowledge my sin, so forgive me — none forgives sins but You",
    repeatCount: 1,
    category: "morning",
  },
  {
    id: "m8",
    arabicText: "أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ",
    englishText: "We have entered the morning and all sovereignty belongs to Allah. Praise be to Allah. None worthy of worship but Allah alone, with no partner. To Him belongs dominion and praise, and He is over all things Capable",
    repeatCount: 1,
    category: "morning",
  },
  {
    id: "m9",
    arabicText: "اللَّهُ لَا إِلَهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ، لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ، لَهُ مَا فِي السَّمَوَاتِ وَمَا فِي الأَرْضِ، مَنْ ذَا الَّذِي يَشْفَعُ عِنْدَهُ إِلَّا بِإِذْنِهِ",
    englishText: "Ayat Al-Kursi — Allah: there is no god but He, the Living, the Eternal. Neither slumber nor sleep overtakes Him. To Him belongs all in the heavens and earth. Who can intercede with Him except by His permission?",
    repeatCount: 1,
    category: "morning",
  },
  {
    id: "m10",
    arabicText: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ",
    englishText: "Glory and praise be to Allah",
    repeatCount: 100,
    category: "morning",
  },
];

export const EVENING_AZKAR: DailyZikr[] = [
  {
    id: "e1",
    arabicText: "رَضِيتُ بِاللَّهِ رَبًّا، وَبِالإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ نَبِيًّا",
    englishText: "I am pleased with Allah as my Lord, with Islam as my religion, and with Muhammad ﷺ as my Prophet",
    repeatCount: 3,
    category: "evening",
  },
  {
    id: "e2",
    arabicText: "اللَّهُمَّ إِنِّي أَمْسَيْتُ أُشْهِدُكَ، وَأُشْهِدُ حَمَلَةَ عَرْشِكَ، وَمَلَائِكَتَكَ، وَجَمِيعَ خَلْقِكَ، أَنَّكَ أَنْتَ اللَّهُ لَا إِلَهَ إِلَّا أَنْتَ، وَأَنَّ مُحَمَّدًا عَبْدُكَ وَرَسُولُكَ",
    englishText: "O Allah, I have entered the evening calling You to witness, the bearers of Your Throne, Your angels, and all creation, that You are Allah — none worthy of worship but You alone — and that Muhammad is Your servant and Messenger",
    repeatCount: 4,
    category: "evening",
  },
  {
    id: "e3",
    arabicText: "اللَّهُمَّ مَا أَمْسَى بِي مِنْ نِعْمَةٍ أَوْ بِأَحَدٍ مِنْ خَلْقِكَ، فَمِنْكَ وَحْدَكَ لَا شَرِيكَ لَكَ، فَلَكَ الْحَمْدُ وَلَكَ الشُّكْرُ",
    englishText: "O Allah, whatever blessing I or any of Your creation have this evening is from You alone, You have no partner. All praise is Yours and all thanks are Yours",
    repeatCount: 1,
    category: "evening",
  },
  {
    id: "e4",
    arabicText: "حَسْبِيَ اللَّهُ لَا إِلَهَ إِلَّا هُوَ عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ",
    englishText: "Allah is sufficient for me. There is no god but He. I have placed my trust in Him. He is the Lord of the Magnificent Throne",
    repeatCount: 7,
    category: "evening",
  },
  {
    id: "e5",
    arabicText: "بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ",
    englishText: "In the Name of Allah, with Whose Name nothing on earth or in the heavens can cause harm, and He is the All-Hearing, the All-Knowing",
    repeatCount: 3,
    category: "evening",
  },
  {
    id: "e6",
    arabicText: "اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ الْمَصِيرُ",
    englishText: "O Allah, by You we have entered the evening, by You we enter the morning, by You we live and die, and to You is the final return",
    repeatCount: 1,
    category: "evening",
  },
  {
    id: "e7",
    arabicText: "اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ",
    englishText: "O Allah, You are my Lord. None worthy of worship but You. You created me and I am Your slave. I keep Your covenant as best I can. I seek refuge in You from the evil of what I have done. I acknowledge Your favour and acknowledge my sin, so forgive me — none forgives sins but You",
    repeatCount: 1,
    category: "evening",
  },
  {
    id: "e8",
    arabicText: "أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ",
    englishText: "We have entered the evening and all sovereignty belongs to Allah. Praise be to Allah. None worthy of worship but Allah alone, with no partner. To Him belongs dominion and praise, and He is over all things Capable",
    repeatCount: 1,
    category: "evening",
  },
  {
    id: "e9",
    arabicText: "اللَّهُ لَا إِلَهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ، لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ، لَهُ مَا فِي السَّمَوَاتِ وَمَا فِي الأَرْضِ",
    englishText: "Ayat Al-Kursi — Allah: there is no god but He, the Living, the Eternal. Neither slumber nor sleep overtakes Him. To Him belongs all in the heavens and earth",
    repeatCount: 1,
    category: "evening",
  },
  {
    id: "e10",
    arabicText: "اللَّهُمَّ قِنِي عَذَابَكَ يَوْمَ تَبْعَثُ عِبَادَكَ",
    englishText: "O Allah, protect me from Your punishment on the Day You resurrect Your servants",
    repeatCount: 3,
    category: "evening",
  },
  {
    id: "e11",
    arabicText: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ",
    englishText: "Glory and praise be to Allah",
    repeatCount: 100,
    category: "evening",
  },
];

// ── Built-in Azkar Content ────────────────────────────────────────────────────

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
    arabic: "اللَّهُ أَكْبَرُ",
    transliteration: "Allāhu Akbar",
    translation: "Allah is the Greatest",
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
  morningReminderEnabled: false,
  morningReminderHour: 6,
  morningReminderMinute: 30,
  eveningReminderEnabled: false,
  eveningReminderHour: 17,
  eveningReminderMinute: 30,
};

// ── Storage keys ──────────────────────────────────────────────────────────────

const SETTINGS_KEY     = "@azkar/settings_v1";
const HISTORY_KEY      = "@azkar/history_v1";
const CUSTOM_AZKAR_KEY = "@azkar/custom_v1";
const REPEAT_BUFFER    = 4;

const VALID_FONT_SIZES = new Set<AzkarSettings["fontSize"]>(["small", "medium", "large"]);
const VALID_POSITIONS  = new Set<AzkarSettings["position"]>(["left", "right"]);

function sanitizeAzkarSettings(raw: Partial<AzkarSettings>): AzkarSettings {
  return {
    ...DEFAULT_AZKAR_SETTINGS,
    ...raw,
    fontSize: VALID_FONT_SIZES.has(raw.fontSize as AzkarSettings["fontSize"])
      ? (raw.fontSize as AzkarSettings["fontSize"])
      : DEFAULT_AZKAR_SETTINGS.fontSize,
    position: VALID_POSITIONS.has(raw.position as AzkarSettings["position"])
      ? (raw.position as AzkarSettings["position"])
      : DEFAULT_AZKAR_SETTINGS.position,
    frequencyMinutes: typeof raw.frequencyMinutes === "number" && raw.frequencyMinutes > 0
      ? raw.frequencyMinutes
      : DEFAULT_AZKAR_SETTINGS.frequencyMinutes,
    displaySeconds: typeof raw.displaySeconds === "number" && raw.displaySeconds > 0
      ? raw.displaySeconds
      : DEFAULT_AZKAR_SETTINGS.displaySeconds,
    opacity: typeof raw.opacity === "number"
      ? Math.max(0.1, Math.min(1, raw.opacity))
      : DEFAULT_AZKAR_SETTINGS.opacity,
    morningReminderHour: typeof raw.morningReminderHour === "number"
      ? Math.max(0, Math.min(23, raw.morningReminderHour))
      : DEFAULT_AZKAR_SETTINGS.morningReminderHour,
    morningReminderMinute: typeof raw.morningReminderMinute === "number"
      ? Math.max(0, Math.min(59, raw.morningReminderMinute))
      : DEFAULT_AZKAR_SETTINGS.morningReminderMinute,
    eveningReminderHour: typeof raw.eveningReminderHour === "number"
      ? Math.max(0, Math.min(23, raw.eveningReminderHour))
      : DEFAULT_AZKAR_SETTINGS.eveningReminderHour,
    eveningReminderMinute: typeof raw.eveningReminderMinute === "number"
      ? Math.max(0, Math.min(59, raw.eveningReminderMinute))
      : DEFAULT_AZKAR_SETTINGS.eveningReminderMinute,
  };
}

export async function loadAzkarSettings(): Promise<AzkarSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_AZKAR_SETTINGS };
    return sanitizeAzkarSettings(JSON.parse(raw));
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

// ── Custom azkar CRUD ─────────────────────────────────────────────────────────

export async function loadCustomAzkar(): Promise<Zikr[]> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_AZKAR_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveCustomAzkar(azkar: Zikr[]): Promise<void> {
  await AsyncStorage.setItem(CUSTOM_AZKAR_KEY, JSON.stringify(azkar));
}

export async function addCustomZikr(zikr: Zikr): Promise<Zikr[]> {
  const current = await loadCustomAzkar();
  const updated = [...current, zikr];
  await saveCustomAzkar(updated);
  return updated;
}

export async function deleteCustomZikr(index: number): Promise<Zikr[]> {
  const current = await loadCustomAzkar();
  const updated = current.filter((_, i) => i !== index);
  await saveCustomAzkar(updated);
  return updated;
}

// ── Smart rotation (includes custom azkar) ────────────────────────────────────

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
  const customAzkar = await loadCustomAzkar();
  const allAzkar    = [...AZKAR, ...customAzkar];

  const history  = await loadHistory();
  const excluded = new Set(history.slice(-REPEAT_BUFFER));
  const pool     = allAzkar
    .map((_, i) => i)
    .filter((i) => !excluded.has(i));

  const candidates = pool.length > 0 ? pool : allAzkar.map((_, i) => i);
  const chosen     = candidates[Math.floor(Math.random() * candidates.length)];
  const newHistory = [...history, chosen].slice(-(REPEAT_BUFFER * 3));
  await saveHistory(newHistory);
  return allAzkar[chosen];
}

// ── Soft vibration (opt-in) ───────────────────────────────────────────────────

export function azkarSoftVibrate(): void {
  if (Platform.OS === "web") return;
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch { /* ignore */ }
}

// ── Background notification scheduling ───────────────────────────────────────

const AZKAR_PREFIX   = "azkar_bg_";
const SCHEDULE_AHEAD = 10;

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

// ── Daily Reminder Notifications ──────────────────────────────────────────────

const REMINDER_MORNING_ID = "azkar_reminder_morning";
const REMINDER_EVENING_ID = "azkar_reminder_evening";

export async function scheduleDailyReminders(
  settings: AzkarSettings
): Promise<void> {
  if (Platform.OS === "web") return;
  await cancelDailyReminders();

  if (settings.morningReminderEnabled) {
    await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_MORNING_ID,
      content: {
        title: "ورد الصباح 🌤️",
        body: "حان وقت أذكار الصباح",
        data: { route: "/azkar-morning", type: "daily_reminder" },
        sound: undefined,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: settings.morningReminderHour,
        minute: settings.morningReminderMinute,
      },
    }).catch(() => {});
  }

  if (settings.eveningReminderEnabled) {
    await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_EVENING_ID,
      content: {
        title: "ورد المساء 🌙",
        body: "حان وقت أذكار المساء",
        data: { route: "/azkar-evening", type: "daily_reminder" },
        sound: undefined,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: settings.eveningReminderHour,
        minute: settings.eveningReminderMinute,
      },
    }).catch(() => {});
  }
}

export async function cancelDailyReminders(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_MORNING_ID).catch(() => {});
    await Notifications.cancelScheduledNotificationAsync(REMINDER_EVENING_ID).catch(() => {});
  } catch { /* ignore */ }
}
