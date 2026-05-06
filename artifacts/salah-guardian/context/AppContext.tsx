import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";

import {
  CALCULATION_METHODS,
  CalculationMethod,
  PrayerTimes,
  PRAYER_NAMES_EN,
  calculatePrayerTimes,
  getCurrentAndNextPrayer,
} from "@/lib/prayerCalculator";
import {
  AppSettings,
  CalibrationData,
  PrayerRecord,
  PRAYER_NAMES,
  calculateStreak,
  formatDate,
  getCalibration,
  getPrayersForDate,
  getSettings,
  getWeeklyStats,
  saveCalibration,
  savePrayerRecord,
  saveSettings,
  getTodayString,
} from "@/lib/storage";
import {
  requestNotificationPermissions,
  scheduleAllPrayerReminders,
} from "@/lib/notifications";

export interface PrayerStatus {
  name: string;
  arabic: string;
  time: Date;
  detected: boolean;
  confidence?: number;
  rakaatCount?: number;
}

export interface WeeklyStat {
  date: string;
  day: string;
  detected: number;
  total: number;
}

interface AppContextType {
  settings: AppSettings;
  updateSettings: (s: Partial<AppSettings>) => Promise<void>;
  isLoading: boolean;

  todayTimes: PrayerTimes | null;
  prayerStatuses: PrayerStatus[];
  currentPrayer: string;
  nextPrayer: string;
  nextPrayerTime: Date | null;
  timeRemaining: number;
  refreshPrayerTimes: () => void;

  streak: number;
  todayDetectedCount: number;
  weeklyStats: WeeklyStat[];

  markPrayerDetected: (
    prayerName: string,
    confidence: number,
    rakaatCount: number,
    durationMs: number
  ) => Promise<void>;
  markPrayerManual: (prayerName: string) => Promise<void>;

  calibration: CalibrationData | null;
  saveCalibrationData: (data: CalibrationData) => Promise<void>;

  completeOnboarding: (lat: number, lng: number, city: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

const ARABIC: Record<string, string> = {
  Fajr: "الفجر",
  Dhuhr: "الظهر",
  Asr: "العصر",
  Maghrib: "المغرب",
  Isha: "العشاء",
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>({
    hasCompletedOnboarding: false,
    calculationMethod: "MWL",
    notificationsEnabled: true,
    reminderOffsetMinutes: 5,
    theme: "system",
    madhab: "shafi",
    vibrationEnabled: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [todayTimes, setTodayTimes] = useState<PrayerTimes | null>(null);
  const [prayerStatuses, setPrayerStatuses] = useState<PrayerStatus[]>([]);
  const [currentPrayer, setCurrentPrayer] = useState("");
  const [nextPrayer, setNextPrayer] = useState("");
  const [nextPrayerTime, setNextPrayerTime] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [streak, setStreak] = useState(0);
  const [todayDetectedCount, setTodayDetectedCount] = useState(0);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStat[]>([]);
  const [calibration, setCalibration] = useState<CalibrationData | null>(null);

  const todayTimesRef = useRef<PrayerTimes | null>(null);
  todayTimesRef.current = todayTimes;

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const times = todayTimesRef.current;
      if (times) {
        const info = getCurrentAndNextPrayer(times);
        setCurrentPrayer(info.current);
        setNextPrayer(info.next);
        setNextPrayerTime(info.nextTime);
        setTimeRemaining(info.timeRemaining);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  async function loadInitialData() {
    setIsLoading(true);
    try {
      const [s, cal] = await Promise.all([getSettings(), getCalibration()]);
      setSettings(s);
      setCalibration(cal);

      if (s.latitude && s.longitude) {
        const times = computeTimes(
          s.latitude,
          s.longitude,
          s.calculationMethod as CalculationMethod,
          s.reminderOffsetMinutes,
          s.notificationsEnabled
        );
        setTodayTimes(times);
        const info = getCurrentAndNextPrayer(times);
        setCurrentPrayer(info.current);
        setNextPrayer(info.next);
        setNextPrayerTime(info.nextTime);
        setTimeRemaining(info.timeRemaining);
        await refreshStatuses(times);
      }

      const [st, ws] = await Promise.all([
        calculateStreak(),
        loadWeeklyStats(),
      ]);
      setStreak(st);
      setWeeklyStats(ws);
    } catch (e) {
      console.warn("loadInitialData error:", e);
    } finally {
      setIsLoading(false);
    }
  }

  function computeTimes(
    lat: number,
    lng: number,
    method: CalculationMethod,
    reminderOffset: number,
    notificationsEnabled: boolean
  ): PrayerTimes {
    const times = calculatePrayerTimes(lat, lng, new Date(), method);

    if (Platform.OS !== "web" && notificationsEnabled) {
      scheduleAllPrayerReminders(
        {
          Fajr: times.fajr,
          Dhuhr: times.dhuhr,
          Asr: times.asr,
          Maghrib: times.maghrib,
          Isha: times.isha,
        },
        reminderOffset
      ).catch(() => {});
    }

    return times;
  }

  async function refreshStatuses(times?: PrayerTimes) {
    const t = times ?? todayTimesRef.current;
    if (!t) return;

    const today = getTodayString();
    const records = await getPrayersForDate(today);
    const detected = records.filter((r) => r.detected).length;
    setTodayDetectedCount(detected);

    const statuses: PrayerStatus[] = PRAYER_NAMES_EN.map((name) => {
      const record = records.find((r) => r.prayerName === name);
      const timeKey = name.toLowerCase() as keyof PrayerTimes;
      return {
        name,
        arabic: ARABIC[name] ?? "",
        time: t[timeKey] as Date,
        detected: record?.detected ?? false,
        confidence: record?.confidence,
        rakaatCount: record?.rakaatCount,
      };
    });

    setPrayerStatuses(statuses);
  }

  async function loadWeeklyStats(): Promise<WeeklyStat[]> {
    const raw = await getWeeklyStats();
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return raw.map((s) => ({
      ...s,
      day: days[new Date(s.date + "T12:00:00").getDay()],
    }));
  }

  const refreshPrayerTimes = useCallback(() => {
    if (settings.latitude && settings.longitude) {
      const times = computeTimes(
        settings.latitude,
        settings.longitude,
        settings.calculationMethod as CalculationMethod,
        settings.reminderOffsetMinutes,
        settings.notificationsEnabled
      );
      setTodayTimes(times);
      refreshStatuses(times);
    }
  }, [settings]);

  async function updateSettings(newSettings: Partial<AppSettings>) {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    await saveSettings(newSettings);

    if (
      newSettings.latitude !== undefined ||
      newSettings.longitude !== undefined ||
      newSettings.calculationMethod !== undefined
    ) {
      if (updated.latitude && updated.longitude) {
        const times = computeTimes(
          updated.latitude,
          updated.longitude,
          updated.calculationMethod as CalculationMethod,
          updated.reminderOffsetMinutes,
          updated.notificationsEnabled
        );
        setTodayTimes(times);
        await refreshStatuses(times);
      }
    }
  }

  async function markPrayerDetected(
    prayerName: string,
    confidence: number,
    rakaatCount: number,
    durationMs: number
  ) {
    const today = getTodayString();
    const times = todayTimesRef.current;
    const timeKey = prayerName.toLowerCase() as keyof PrayerTimes;
    const scheduledTime =
      times && times[timeKey]
        ? (times[timeKey] as Date).getTime()
        : Date.now();

    const record: PrayerRecord = {
      id: `${today}_${prayerName}_${Date.now()}`,
      prayerName,
      date: today,
      scheduledTime,
      detected: true,
      detectedAt: Date.now(),
      confidence,
      rakaatCount,
      durationMs,
    };

    await savePrayerRecord(record);
    await refreshStatuses();
    const [st, ws] = await Promise.all([
      calculateStreak(),
      loadWeeklyStats(),
    ]);
    setStreak(st);
    setWeeklyStats(ws);
  }

  async function markPrayerManual(prayerName: string) {
    await markPrayerDetected(prayerName, 1.0, 0, 0);
  }

  async function saveCalibrationData(data: CalibrationData) {
    await saveCalibration(data);
    setCalibration(data);
  }

  async function completeOnboarding(lat: number, lng: number, city: string) {
    const updated: Partial<AppSettings> = {
      hasCompletedOnboarding: true,
      latitude: lat,
      longitude: lng,
      cityName: city,
    };
    const newSettings = { ...settings, ...updated };
    setSettings(newSettings);
    await saveSettings(updated);

    if (Platform.OS !== "web") {
      await requestNotificationPermissions();
    }

    const times = computeTimes(
      lat,
      lng,
      newSettings.calculationMethod as CalculationMethod,
      newSettings.reminderOffsetMinutes,
      newSettings.notificationsEnabled
    );
    setTodayTimes(times);
    await refreshStatuses(times);
    setIsLoading(false);
  }

  return (
    <AppContext.Provider
      value={{
        settings,
        updateSettings,
        isLoading,
        todayTimes,
        prayerStatuses,
        currentPrayer,
        nextPrayer,
        nextPrayerTime,
        timeRemaining,
        refreshPrayerTimes,
        streak,
        todayDetectedCount,
        weeklyStats,
        markPrayerDetected,
        markPrayerManual,
        calibration,
        saveCalibrationData,
        completeOnboarding,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
