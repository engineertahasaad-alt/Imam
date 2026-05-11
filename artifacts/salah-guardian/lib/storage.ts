import AsyncStorage from "@react-native-async-storage/async-storage";

export type CalculationMethodKey =
  | "MWL"
  | "ISNA"
  | "Egypt"
  | "Makkah"
  | "Karachi"
  | "Gulf";

export type AdhanVoice =
  | "alafasy"
  | "abdulbasit"
  | "madinah"
  | "makkah"
  | "sudais"
  | "sghamdi"
  | "haifa"
  | "turkey";

export interface AppSettings {
  hasCompletedOnboarding: boolean;
  calculationMethod: CalculationMethodKey;
  latitude?: number;
  longitude?: number;
  cityName?: string;
  notificationsEnabled: boolean;
  reminderOffsetMinutes: number;
  theme: "dark" | "light" | "system";
  madhab: "shafi" | "hanafi";
  vibrationEnabled: boolean;
  /** 1 = very stable (fewer false positives), 5 = very responsive */
  sensitivity: number;
  /** Global prayer time adjustment in minutes (±30) */
  prayerTimeOffsetMinutes: number;
  /** Controls haptic pulse intensity/count */
  vibrationStrength: "low" | "medium" | "high";
  /** Adhan feature */
  adhanEnabled: boolean;
  adhanVoice: AdhanVoice;
  adhanVolume: number;
  /** Invalid posture alerts */
  invalidPostureAlerts: boolean;
  /** User's preferred name for personalized greeting */
  userName?: string;
  /** UI language */
  language?: "en" | "ar";
}

export interface PrayerRecord {
  id: string;
  prayerName: string;
  date: string;
  scheduledTime: number;
  detected: boolean;
  detectedAt?: number;
  confidence?: number;
  rakaatCount?: number;
  durationMs?: number;
  manuallyConfirmed?: boolean;
}

export interface CalibrationData {
  standing: [number, number, number];
  ruku: [number, number, number];
  sujood: [number, number, number];
  sitting: [number, number, number];
  calibratedAt: number;
  pocketSide: "left" | "right" | "unknown";
}

const KEYS = {
  SETTINGS: "@salah_guardian:settings",
  PRAYERS_PREFIX: "@salah_guardian:prayer:",
  CALIBRATION: "@salah_guardian:calibration",
};

function defaultSettings(): AppSettings {
  return {
    hasCompletedOnboarding: false,
    calculationMethod: "MWL",
    notificationsEnabled: true,
    reminderOffsetMinutes: 5,
    theme: "system",
    madhab: "shafi",
    vibrationEnabled: true,
    sensitivity: 3,
    prayerTimeOffsetMinutes: 0,
    vibrationStrength: "high",
    adhanEnabled: false,
    adhanVoice: "alafasy",
    adhanVolume: 0.8,
    invalidPostureAlerts: true,
  };
}

// ─── Settings ───────────────────────────────────────────────────────────────

export async function getSettings(): Promise<AppSettings> {
  try {
    const data = await AsyncStorage.getItem(KEYS.SETTINGS);
    if (!data) return defaultSettings();
    return { ...defaultSettings(), ...JSON.parse(data) };
  } catch {
    return defaultSettings();
  }
}

export async function saveSettings(
  settings: Partial<AppSettings>
): Promise<void> {
  const current = await getSettings();
  await AsyncStorage.setItem(
    KEYS.SETTINGS,
    JSON.stringify({ ...current, ...settings })
  );
}

// ─── Prayer Records ──────────────────────────────────────────────────────────

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getTodayString(): string {
  return formatDate(new Date());
}

function prayerKey(date: string, prayerName: string): string {
  return `${KEYS.PRAYERS_PREFIX}${date}:${prayerName}`;
}

export async function savePrayerRecord(record: PrayerRecord): Promise<void> {
  await AsyncStorage.setItem(
    prayerKey(record.date, record.prayerName),
    JSON.stringify(record)
  );
}

export async function getPrayerRecord(
  date: string,
  prayerName: string
): Promise<PrayerRecord | null> {
  const data = await AsyncStorage.getItem(prayerKey(date, prayerName));
  return data ? JSON.parse(data) : null;
}

export async function getPrayersForDate(
  date: string
): Promise<PrayerRecord[]> {
  const allKeys = await AsyncStorage.getAllKeys();
  const prefix = `${KEYS.PRAYERS_PREFIX}${date}:`;
  const prayerKeys = allKeys.filter((k) => k.startsWith(prefix));
  if (prayerKeys.length === 0) return [];
  const items = await AsyncStorage.multiGet(prayerKeys);
  return items
    .map(([, val]) => (val ? JSON.parse(val) : null))
    .filter(Boolean) as PrayerRecord[];
}

export async function getPrayersForRange(
  startDate: string,
  days: number
): Promise<Record<string, PrayerRecord[]>> {
  const allKeys = await AsyncStorage.getAllKeys();
  const results: Record<string, PrayerRecord[]> = {};

  const dates: string[] = [];
  const start = new Date(startDate);
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(formatDate(d));
  }

  for (const date of dates) {
    const prefix = `${KEYS.PRAYERS_PREFIX}${date}:`;
    const prayerKeys = allKeys.filter((k) => k.startsWith(prefix));
    if (prayerKeys.length > 0) {
      const items = await AsyncStorage.multiGet(prayerKeys);
      results[date] = items
        .map(([, val]) => (val ? JSON.parse(val) : null))
        .filter(Boolean) as PrayerRecord[];
    } else {
      results[date] = [];
    }
  }

  return results;
}

// ─── Calibration ─────────────────────────────────────────────────────────────

export async function saveCalibration(data: CalibrationData): Promise<void> {
  await AsyncStorage.setItem(KEYS.CALIBRATION, JSON.stringify(data));
}

export async function getCalibration(): Promise<CalibrationData | null> {
  const data = await AsyncStorage.getItem(KEYS.CALIBRATION);
  return data ? JSON.parse(data) : null;
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export async function calculateStreak(): Promise<number> {
  const today = new Date();
  let streak = 0;
  let date = new Date(today);
  date.setDate(date.getDate() - 1);

  for (let i = 0; i < 365; i++) {
    const dateStr = formatDate(date);
    const prayers = await getPrayersForDate(dateStr);
    const detected = prayers.filter((p) => p.detected).length;

    if (detected >= 3) {
      streak++;
      date.setDate(date.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

export async function getWeeklyStats(): Promise<
  Array<{ date: string; detected: number; total: number }>
> {
  const today = new Date();
  const stats: Array<{ date: string; detected: number; total: number }> = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = formatDate(d);
    const prayers = await getPrayersForDate(dateStr);
    stats.push({
      date: dateStr,
      detected: prayers.filter((p) => p.detected).length,
      total: 5,
    });
  }

  return stats;
}

export const PRAYER_NAMES = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;
export type PrayerName = (typeof PRAYER_NAMES)[number];
