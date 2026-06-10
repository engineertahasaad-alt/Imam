/**
 * Azkar Overlay — Context
 * Isolated provider. Does NOT modify any prayer or adhan logic.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  AzkarSettings,
  DailyCompletionRecord,
  DEFAULT_AZKAR_SETTINGS,
  Zikr,
  azkarSoftVibrate,
  cancelAzkarNotifications,
  cancelDailyReminders,
  loadAzkarSettings,
  loadDailyCompletion,
  markCategoryComplete,
  pickNextZikr,
  saveAzkarSettings,
  scheduleAzkarNotifications,
  scheduleDailyReminders,
} from "@/lib/azkarService";

interface AzkarContextType {
  settings: AzkarSettings;
  updateSettings: (partial: Partial<AzkarSettings>) => Promise<void>;
  currentZikr: Zikr | null;
  widgetVisible: boolean;
  dismissWidget: () => void;
  showNow: () => Promise<void>;
  showZikr: (zikr: Zikr) => void;
  dailyCompletion: DailyCompletionRecord;
  markComplete: (category: "morning" | "evening") => Promise<void>;
  refreshCompletion: () => Promise<void>;
  /** Messenger-style daily reminder bubble */
  bubbleVisible: boolean;
  bubbleType: "morning" | "evening" | null;
  showReminderBubble: (type: "morning" | "evening") => void;
  dismissBubble: () => void;
}

const AzkarContext = createContext<AzkarContextType | null>(null);

const EMPTY_COMPLETION: DailyCompletionRecord = {
  date: "",
  morning: false,
  evening: false,
};

export function AzkarProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings]             = useState<AzkarSettings>(DEFAULT_AZKAR_SETTINGS);
  const [currentZikr, setCurrentZikr]       = useState<Zikr | null>(null);
  const [widgetVisible, setVisible]         = useState(false);
  const [dailyCompletion, setCompletion]    = useState<DailyCompletionRecord>(EMPTY_COMPLETION);
  const [bubbleVisible, setBubbleVisible]   = useState(false);
  const [bubbleType, setBubbleType]         = useState<"morning" | "evening" | null>(null);

  const settingsRef       = useRef(settings);
  const timerRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoHideRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastShownRef      = useRef<number>(0);
  const lastBubbleKeyRef  = useRef<string>("");

  settingsRef.current = settings;

  useEffect(() => {
    loadAzkarSettings().then((s) => {
      setSettings(s);
      if (s.enabled) startTimer(s.frequencyMinutes);
      scheduleAzkarNotifications(s).catch(() => {});
      scheduleDailyReminders(s).catch(() => {});
    });
    loadDailyCompletion().then(setCompletion);
    return () => clearTimers();
  }, []);

  function clearTimers() {
    if (timerRef.current)    clearInterval(timerRef.current);
    if (autoHideRef.current) clearTimeout(autoHideRef.current);
  }

  function startTimer(frequencyMinutes: number) {
    if (timerRef.current) clearInterval(timerRef.current);
    const ms = frequencyMinutes * 60 * 1000;
    timerRef.current = setInterval(() => {
      const s = settingsRef.current;
      if (!s.enabled) return;
      const now = Date.now();
      if (now - lastShownRef.current < ms * 0.8) return;
      showNow();
    }, ms);
  }

  const showNow = useCallback(async () => {
    const s = settingsRef.current;
    if (!s.enabled) return;

    const zikr = await pickNextZikr();
    setCurrentZikr(zikr);
    setVisible(true);
    lastShownRef.current = Date.now();

    if (s.vibration) azkarSoftVibrate();

    if (autoHideRef.current) clearTimeout(autoHideRef.current);
    autoHideRef.current = setTimeout(() => {
      setVisible(false);
    }, s.displaySeconds * 1000);
  }, []);

  const showZikr = useCallback((zikr: Zikr) => {
    const s = settingsRef.current;
    setCurrentZikr(zikr);
    setVisible(true);
    lastShownRef.current = Date.now();
    if (s.vibration) azkarSoftVibrate();
    if (autoHideRef.current) clearTimeout(autoHideRef.current);
    autoHideRef.current = setTimeout(() => {
      setVisible(false);
    }, s.displaySeconds * 1000);
  }, []);

  const dismissWidget = useCallback(() => {
    if (autoHideRef.current) clearTimeout(autoHideRef.current);
    setVisible(false);
  }, []);

  // ── Daily reminder bubble (Messenger-style) ───────────────────────────────

  const showReminderBubble = useCallback((type: "morning" | "evening") => {
    setBubbleType(type);
    setBubbleVisible(true);
  }, []);

  const dismissBubble = useCallback(() => {
    setBubbleVisible(false);
  }, []);

  // Check every 30 s whether morning/evening reminder time has arrived.
  // Only triggers when the app is in the foreground (this timer doesn't run
  // when the app is suspended — the system notification handles that case).
  useEffect(() => {
    const bubbleTimerRef = setInterval(() => {
      const s = settingsRef.current;
      const now = new Date();
      const h   = now.getHours();
      const m   = now.getMinutes();
      const dateKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

      if (s.morningReminderEnabled && h === s.morningReminderHour && m === s.morningReminderMinute) {
        const key = `morning-${dateKey}-${h}:${m}`;
        if (lastBubbleKeyRef.current !== key) {
          lastBubbleKeyRef.current = key;
          showReminderBubble("morning");
        }
      }
      if (s.eveningReminderEnabled && h === s.eveningReminderHour && m === s.eveningReminderMinute) {
        const key = `evening-${dateKey}-${h}:${m}`;
        if (lastBubbleKeyRef.current !== key) {
          lastBubbleKeyRef.current = key;
          showReminderBubble("evening");
        }
      }
    }, 30_000);

    return () => clearInterval(bubbleTimerRef);
  }, [showReminderBubble]);

  const updateSettings = useCallback(async (partial: Partial<AzkarSettings>) => {
    const updated = await saveAzkarSettings(partial);
    setSettings(updated);

    if (partial.enabled !== undefined || partial.frequencyMinutes !== undefined) {
      clearTimers();
      if (updated.enabled) startTimer(updated.frequencyMinutes);
    }

    scheduleAzkarNotifications(updated).catch(() => {});
    scheduleDailyReminders(updated).catch(() => {});

    if (!updated.enabled) {
      cancelAzkarNotifications().catch(() => {});
      setVisible(false);
    }

    if (
      partial.morningReminderEnabled === false &&
      partial.eveningReminderEnabled === false
    ) {
      cancelDailyReminders().catch(() => {});
    }
  }, []);

  const markComplete = useCallback(async (category: "morning" | "evening") => {
    const updated = await markCategoryComplete(category);
    setCompletion(updated);
  }, []);

  const refreshCompletion = useCallback(async () => {
    const rec = await loadDailyCompletion();
    setCompletion(rec);
  }, []);

  return (
    <AzkarContext.Provider
      value={{
        settings,
        updateSettings,
        currentZikr,
        widgetVisible,
        dismissWidget,
        showNow,
        showZikr,
        dailyCompletion,
        markComplete,
        refreshCompletion,
        bubbleVisible,
        bubbleType,
        showReminderBubble,
        dismissBubble,
      }}
    >
      {children}
    </AzkarContext.Provider>
  );
}

export function useAzkar(): AzkarContextType {
  const ctx = useContext(AzkarContext);
  if (!ctx) throw new Error("useAzkar must be used within AzkarProvider");
  return ctx;
}
