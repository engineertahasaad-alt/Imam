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
import {
  registerRescheduleTask,
  requestCriticalPermissions,
  scheduleAdhan,
} from "@/lib/adhanScheduler";
import {
  playAdhanInApp,
  stopAdhan,
} from "@/lib/adhanEngine";
import { setStoredTheme } from "@/lib/themeStore";

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
  refreshCalibration: () => Promise<void>;

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
    sensitivity: 3,
    prayerTimeOffsetMinutes: 0,
    vibrationStrength: "high",
    adhanEnabled: true,
    adhanVoice: "abdulbasit",
    adhanVolume: 0.8,
    invalidPostureAlerts: true,
    userName: undefined,
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

  // Keep a ref to settings so the adhan timer always reads the latest values
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Track previous timeRemaining to detect the moment prayer time arrives
  const prevTimeRemainingRef = useRef<number>(0);
  const adhanFiredRef = useRef<string>(""); // which prayer we already fired for

  useEffect(() => {
    loadInitialData();
    // Register background/boot task so notifications survive phone reboot
    if (Platform.OS !== "web") {
      registerRescheduleTask().catch(() => {});
    }
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

        // Foreground adhan: fire when timeRemaining crosses from positive → ≤ 0
        // (meaning a prayer time just arrived while the app is open)
        const prev = prevTimeRemainingRef.current;
        const curr = info.timeRemaining;
        const prayerKey = info.next + "_" + (info.nextTime?.toISOString().slice(0, 16) ?? "");
        if (
          prev > 0 &&
          curr <= 0 &&
          info.next &&
          adhanFiredRef.current !== prayerKey
        ) {
          adhanFiredRef.current = prayerKey;
          // Read settings directly from ref — avoids stale closure
          const s = settingsRef.current;
          if (s.adhanEnabled && Platform.OS !== "web") {
            playAdhanInApp(s.adhanVoice as any, s.adhanVolume ?? 0.8).catch(() => {});
          }
        }
        prevTimeRemainingRef.current = curr;
      }
    }, 1000);
    return () => { clearInterval(timer); stopAdhan(); };
  }, []);

  async function loadInitialData() {
    setIsLoading(true);
    try {
      const [s, cal] = await Promise.all([getSettings(), getCalibration()]);
      setSettings(s);
      setCalibration(cal);
      setStoredTheme((s.theme ?? "system") as "dark" | "light" | "system");

      if (s.latitude && s.longitude) {
        const times = computeTimes(
          s.latitude,
          s.longitude,
          s.calculationMethod as CalculationMethod,
          s.reminderOffsetMinutes,
          s.notificationsEnabled,
          s.adhanEnabled,
          s.adhanVoice,
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
    notificationsEnabled: boolean,
    adhanEnabled = false,
    adhanVoice   = "alafasy",
  ): PrayerTimes {
    const times = calculatePrayerTimes(lat, lng, new Date(), method);

    if (Platform.OS !== "web") {
      // Build a "next occurrence" prayer map: for any prayer that has already
      // passed today, use tomorrow's time instead.  This prevents the gap where
      // no adhan notification exists between the last prayer of the day and
      // the Fajr of the following day.
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowTimes = calculatePrayerTimes(lat, lng, tomorrow, method);

      const todayMap: Record<string, Date> = {
        Fajr: times.fajr, Dhuhr: times.dhuhr, Asr: times.asr,
        Maghrib: times.maghrib, Isha: times.isha,
      };
      const tmrwMap: Record<string, Date> = {
        Fajr: tomorrowTimes.fajr, Dhuhr: tomorrowTimes.dhuhr, Asr: tomorrowTimes.asr,
        Maghrib: tomorrowTimes.maghrib, Isha: tomorrowTimes.isha,
      };

      const now = Date.now();
      const prayerMap: Record<string, Date> = {};
      for (const name of Object.keys(todayMap)) {
        prayerMap[name] = todayMap[name].getTime() > now
          ? todayMap[name]
          : tmrwMap[name];
      }

      // Run sequentially inside a single async IIFE so that
      // cancelAllPrayerReminders() (inside scheduleAllPrayerReminders) cannot
      // race against and wipe freshly-scheduled adhan notifications.
      (async () => {
        if (notificationsEnabled) {
          await scheduleAllPrayerReminders(prayerMap, reminderOffset);
        }
        await scheduleAdhan(prayerMap, adhanVoice as any, adhanEnabled);
      })().catch(() => {});
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
        settings.notificationsEnabled,
        settings.adhanEnabled,
        settings.adhanVoice,
      );
      setTodayTimes(times);
      refreshStatuses(times);
    }
  }, [settings]);

  async function updateSettings(newSettings: Partial<AppSettings>) {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    await saveSettings(newSettings);
    if (newSettings.theme !== undefined) {
      setStoredTheme(newSettings.theme);
    }

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
          updated.notificationsEnabled,
          updated.adhanEnabled,
          updated.adhanVoice,
        );
        setTodayTimes(times);
        await refreshStatuses(times);
      }
    }

    // Reschedule adhan when adhan-specific settings change (no full prayer-time recompute needed)
    if (
      (newSettings.adhanEnabled !== undefined || newSettings.adhanVoice !== undefined) &&
      newSettings.latitude === undefined &&
      newSettings.longitude === undefined &&
      newSettings.calculationMethod === undefined
    ) {
      const t = todayTimesRef.current;
      if (t && Platform.OS !== "web") {
        scheduleAdhan(
          { Fajr: t.fajr, Dhuhr: t.dhuhr, Asr: t.asr, Maghrib: t.maghrib, Isha: t.isha },
          (updated.adhanVoice ?? "alafasy") as any,
          updated.adhanEnabled ?? false
        ).catch(() => {});
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

  async function refreshCalibration() {
    const cal = await getCalibration();
    setCalibration(cal);
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
      // Request battery optimization exemption + exact alarm permission
      // so adhan fires reliably even with screen locked or app backgrounded
      await requestCriticalPermissions();
    }

    const times = computeTimes(
      lat,
      lng,
      newSettings.calculationMethod as CalculationMethod,
      newSettings.reminderOffsetMinutes,
      newSettings.notificationsEnabled,
      newSettings.adhanEnabled,
      newSettings.adhanVoice,
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
        refreshCalibration,
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
