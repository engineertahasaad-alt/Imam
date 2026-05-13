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
  DEFAULT_AZKAR_SETTINGS,
  Zikr,
  azkarSoftVibrate,
  cancelAzkarNotifications,
  loadAzkarSettings,
  pickNextZikr,
  saveAzkarSettings,
  scheduleAzkarNotifications,
} from "@/lib/azkarService";

interface AzkarContextType {
  settings: AzkarSettings;
  updateSettings: (partial: Partial<AzkarSettings>) => Promise<void>;
  currentZikr: Zikr | null;
  widgetVisible: boolean;
  dismissWidget: () => void;
  showNow: () => Promise<void>;
  showZikr: (zikr: Zikr) => void;
}

const AzkarContext = createContext<AzkarContextType | null>(null);

export function AzkarProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings]       = useState<AzkarSettings>(DEFAULT_AZKAR_SETTINGS);
  const [currentZikr, setCurrentZikr] = useState<Zikr | null>(null);
  const [widgetVisible, setVisible]   = useState(false);

  const settingsRef   = useRef(settings);
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoHideRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastShownRef  = useRef<number>(0);

  settingsRef.current = settings;

  // Load settings on mount, then start the timer
  useEffect(() => {
    loadAzkarSettings().then((s) => {
      setSettings(s);
      if (s.enabled) startTimer(s.frequencyMinutes);
      scheduleAzkarNotifications(s).catch(() => {});
    });
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
      // Prevent spam: require at least 80 % of the interval between shows
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

    // Auto-hide after displaySeconds
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

  const updateSettings = useCallback(async (partial: Partial<AzkarSettings>) => {
    const updated = await saveAzkarSettings(partial);
    setSettings(updated);

    if (partial.enabled !== undefined || partial.frequencyMinutes !== undefined) {
      clearTimers();
      if (updated.enabled) startTimer(updated.frequencyMinutes);
    }

    scheduleAzkarNotifications(updated).catch(() => {});

    if (!updated.enabled) {
      cancelAzkarNotifications().catch(() => {});
      setVisible(false);
    }
  }, []);

  return (
    <AzkarContext.Provider
      value={{ settings, updateSettings, currentZikr, widgetVisible, dismissWidget, showNow, showZikr }}
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
