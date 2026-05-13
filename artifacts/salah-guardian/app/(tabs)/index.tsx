import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CelebrationBanner } from "@/components/CelebrationBanner";
import { DetectionModal } from "@/components/DetectionModal";
import { PrayerAlertBanner } from "@/components/PrayerAlertBanner";
import { QiblaCard } from "@/components/QiblaCard";
import { TrainingModal } from "@/components/TrainingModal";
import { useApp } from "@/context/AppContext";
import { useAzkar } from "@/context/AzkarContext";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "@/hooks/useTranslation";
import { formatCountdown, formatTime, PRAYER_ARABIC } from "@/lib/prayerCalculator";

const ALERT_THRESHOLD_MS = 5 * 60 * 1000;
const TAB_H = Platform.OS === "web" ? 84 : 62;

const RAKAAT_MAP: Record<string, number> = {
  Fajr: 2, Dhuhr: 4, Asr: 4, Maghrib: 3, Isha: 4,
};
function getRakaatCount(n: string) { return RAKAAT_MAP[n] ?? 4; }

const TASBEEH_PRESETS = [
  { ar: "سُبْحَانَ اللَّهِ",    en: "Subhanallah",    target: 33 },
  { ar: "الْحَمْدُ لِلَّهِ",   en: "Alhamdulillah",  target: 33 },
  { ar: "اللَّهُ أَكْبَرُ",    en: "Allahu Akbar",   target: 34 },
  { ar: "لَا إِلَهَ إِلَّا اللَّهُ", en: "La ilaha illallah", target: 100 },
];

function IconAction({
  icon, label, onPress, bg, iconColor,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  label: string;
  onPress: () => void;
  bg: string;
  iconColor: string;
}) {
  return (
    <TouchableOpacity style={styles.iconAction} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.iconCircle, { backgroundColor: bg }]}>
        <MaterialCommunityIcons name={icon} size={22} color={iconColor} />
      </View>
      <Text style={[styles.iconLabel, { color: "rgba(255,255,255,0.85)" }]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/* ─── Reusable bottom-sheet wrapper ─────────────────────────────── */
function BottomSheet({
  visible, onClose, title, children, sheetBg,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  sheetBg: string;
}) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={[styles.modalSheet, { backgroundColor: sheetBg, paddingBottom: insets.bottom + 20 }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function HomeScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { t, isArabic } = useTranslation();

  const {
    settings, isLoading, prayerStatuses, currentPrayer,
    nextPrayer, nextPrayerTime, timeRemaining, streak,
    todayDetectedCount, markPrayerDetected, calibration,
    refreshPrayerTimes, refreshCalibration,
  } = useApp();

  const { dailyCompletion, refreshCompletion } = useAzkar();

  /* modal visibility */
  const [detectionVisible,   setDetectionVisible]   = useState(false);
  const [trainingVisible,    setTrainingVisible]     = useState(false);
  const [qiblaVisible,       setQiblaVisible]        = useState(false);
  const [prayerTimesVisible, setPrayerTimesVisible]  = useState(false);
  const [tasbeehVisible,     setTasbeehVisible]      = useState(false);

  /* tasbeeh state */
  const [tasbeehCount,       setTasbeehCount]        = useState(0);
  const [tasbeehPreset,      setTasbeehPreset]       = useState(0);

  const [bannerPrayer, setBannerPrayer]   = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const prevNextRef = useRef<string>("");

  useEffect(() => {
    if (!nextPrayer) return;
    if (nextPrayer !== prevNextRef.current) {
      prevNextRef.current = nextPrayer;
      setBannerDismissed(false);
    }
    if (timeRemaining > 0 && timeRemaining <= ALERT_THRESHOLD_MS) setBannerPrayer(nextPrayer);
  }, [timeRemaining, nextPrayer]);

  useEffect(() => { refreshCompletion(); }, []);

  /* reset tasbeeh when modal opens */
  useEffect(() => {
    if (tasbeehVisible) { setTasbeehCount(0); }
  }, [tasbeehVisible, tasbeehPreset]);

  const bannerPrayerDetected = bannerPrayer != null &&
    prayerStatuses.find((p) => p.name === bannerPrayer)?.detected === true;
  const showBanner = bannerPrayer !== null && !bannerDismissed && !bannerPrayerDetected;

  const vibrationEnabled  = settings?.vibrationEnabled  ?? true;
  const vibrationStrength = settings?.vibrationStrength ?? "high";
  const sensitivity       = settings?.sensitivity       ?? 3;
  const userName          = settings?.userName;

  const preset = TASBEEH_PRESETS[tasbeehPreset];

  const handleTasbeehTap = useCallback(() => {
    setTasbeehCount((c) => {
      const next = c + 1;
      if (next % preset.target === 0) {
        if (Platform.OS !== "web") Vibration.vibrate(60);
      } else {
        if (Platform.OS !== "web") Vibration.vibrate(20);
      }
      return next;
    });
  }, [preset.target]);

  async function handleDetectionComplete(rakaat: number, confidence: number, durationMs: number) {
    setDetectionVisible(false);
    const prayerName = currentPrayer || nextPrayer;
    if (prayerName) await markPrayerDetected(prayerName, confidence, rakaat, durationMs);
  }

  const countdownText = formatCountdown(timeRemaining);
  const nextTimeText  = nextPrayerTime ? formatTime(nextPrayerTime) : "--:--";
  const greeting = isArabic
    ? `السلام عليكم${userName ? `، ${userName}` : ""}`
    : `Peace be upon you${userName ? `, ${userName}` : ""}`;

  const paddingTop    = insets.top + (Platform.OS === "web" ? 60 : 10);
  const paddingBottom = insets.bottom + TAB_H;

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <MaterialCommunityIcons name="mosque" size={36} color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>{t("calculating")}</Text>
      </View>
    );
  }

  /* ── repeating cycle count for tasbeeh ── */
  const cycles = Math.floor(tasbeehCount / preset.target);
  const posInCycle = tasbeehCount % preset.target;
  const pct = preset.target > 0 ? posInCycle / preset.target : 0;

  return (
    <>
      {/* ══════════════════════ MAIN SCREEN ══════════════════════ */}
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop, paddingBottom }]}>

        {/* Celebration — only mounts when all 5 prayers done */}
        {todayDetectedCount === 5 && (
          <View style={{ paddingHorizontal: 14, marginBottom: 10 }}>
            <CelebrationBanner visible userName={userName} streak={streak} />
          </View>
        )}

        {/* ── HEADER ─────────────────────────────────────────────── */}
        <View style={[styles.header, { paddingHorizontal: 14 }]}>
          <View style={styles.headerLeft}>
            <Text style={[styles.greeting, { color: colors.foreground }]} numberOfLines={1}>
              {greeting}
            </Text>
            {nextPrayer ? (
              <View style={styles.nextChip}>
                <MaterialCommunityIcons name="clock-outline" size={11} color={colors.primary} />
                <Text style={[styles.nextChipText, { color: colors.primary }]}>
                  {isArabic
                    ? `${PRAYER_ARABIC[nextPrayer] ?? nextPrayer} · ${nextTimeText}`
                    : `${nextPrayer} · ${nextTimeText}`}
                </Text>
              </View>
            ) : null}
          </View>
          <TouchableOpacity
            style={[styles.headerBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push("/(tabs)/settings")}
          >
            <Feather name="settings" size={17} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* ── PRAYER CARD ─────────────────────────────────────────── */}
        <LinearGradient
          colors={colors.isDark
            ? ["#0a2e1f", "#0d2d1a", "#162032"]
            : ["#065f46", "#047857", "#059669"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.card, { marginHorizontal: 14 }]}
        >
          <View style={[styles.glowRing, { borderColor: "rgba(52,211,153,0.12)", top: -28, right: -28, width: 130, height: 130, borderRadius: 65 }]} />
          <View style={[styles.glowRing, { borderColor: "rgba(52,211,153,0.07)", top: -50, right: -50, width: 190, height: 190, borderRadius: 95 }]} />

          {/* Title + inline countdown */}
          <View style={styles.cardTopRow}>
            <View style={styles.cardLabelGroup}>
              <View style={[styles.cardIconWrap, { backgroundColor: "rgba(52,211,153,0.18)" }]}>
                <MaterialCommunityIcons name="mosque" size={16} color="#34d399" />
              </View>
              <Text style={styles.cardTitle}>{isArabic ? "الصلاة" : "Prayer"}</Text>
            </View>
            {nextPrayer && (
              <View style={styles.countdownInline}>
                <Text style={styles.countdownArabic}>{PRAYER_ARABIC[nextPrayer] ?? nextPrayer}</Text>
                <Text style={styles.countdownText}>{countdownText}</Text>
              </View>
            )}
          </View>

          {/* Schedule strip */}
          {prayerStatuses.length > 0 && (
            <View style={[styles.scheduleStrip, { backgroundColor: "rgba(0,0,0,0.22)" }]}>
              {prayerStatuses.map((prayer) => {
                const isCurrent = prayer.name === currentPrayer;
                const isNext    = prayer.name === nextPrayer;
                const col = isCurrent ? "#34d399" : isNext ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)";
                return (
                  <View key={prayer.name} style={styles.scheduleCell}>
                    <View style={[
                      styles.scheduleDot,
                      {
                        backgroundColor: prayer.detected ? "#34d399" : "transparent",
                        borderColor: isCurrent ? "#34d399" : "rgba(255,255,255,0.3)",
                        borderWidth: prayer.detected ? 0 : 1.5,
                      },
                    ]}>
                      {prayer.detected && <Text style={{ fontSize: 7, color: "#0d1321" }}>✓</Text>}
                    </View>
                    <Text style={[styles.scheduleArabic, { color: col }]}>{prayer.arabic}</Text>
                    <Text style={[styles.scheduleTime, { color: col }]}>
                      {prayer.time ? formatTime(prayer.time) : "--:--"}
                    </Text>
                    {isCurrent && <View style={styles.scheduleActiveLine} />}
                  </View>
                );
              })}
            </View>
          )}

          {/* Action icons */}
          <View style={styles.iconGrid}>
            <IconAction icon="play-circle-outline"
              label={isArabic ? "ابدأ الصلاة" : "Start Prayer"}
              onPress={() => setDetectionVisible(true)}
              bg="rgba(52,211,153,0.22)" iconColor="#34d399" />
            <IconAction icon="school-outline"
              label={isArabic ? "تدريب الصلاة" : "Training"}
              onPress={() => setTrainingVisible(true)}
              bg="rgba(251,191,36,0.18)" iconColor="#fbbf24" />
            <IconAction icon="clock-time-five-outline"
              label={isArabic ? "مواقيت الصلاة" : "Prayer Times"}
              onPress={() => setPrayerTimesVisible(true)}
              bg="rgba(99,102,241,0.22)" iconColor="#818cf8" />
            <IconAction icon="compass-outline"
              label={isArabic ? "اتجاه القبلة" : "Qibla"}
              onPress={() => setQiblaVisible(true)}
              bg="rgba(244,114,182,0.18)" iconColor="#f472b6" />
          </View>
        </LinearGradient>

        {/* ── AZKAR CARD ─────────────────────────────────────────── */}
        <LinearGradient
          colors={colors.isDark
            ? ["#0e1a3a", "#12203f", "#162032"]
            : ["#1e3a5f", "#1e40af", "#2563eb"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.card, { marginHorizontal: 14 }]}
        >
          <View style={[styles.glowRing, { borderColor: "rgba(129,140,248,0.14)", top: -28, right: -28, width: 130, height: 130, borderRadius: 65 }]} />
          <View style={[styles.glowRing, { borderColor: "rgba(129,140,248,0.08)", top: -50, right: -50, width: 190, height: 190, borderRadius: 95 }]} />

          <View style={styles.cardTopRow}>
            <View style={styles.cardLabelGroup}>
              <View style={[styles.cardIconWrap, { backgroundColor: "rgba(139,92,246,0.22)" }]}>
                <Text style={{ fontSize: 15 }}>🤲</Text>
              </View>
              <Text style={styles.cardTitle}>{isArabic ? "الأذكار" : "Azkar"}</Text>
            </View>
            <View style={styles.completionChips}>
              {dailyCompletion.morning && (
                <View style={[styles.completionChip, { backgroundColor: "rgba(251,191,36,0.22)" }]}>
                  <Text style={{ fontSize: 12 }}>🌤️</Text>
                </View>
              )}
              {dailyCompletion.evening && (
                <View style={[styles.completionChip, { backgroundColor: "rgba(139,92,246,0.25)" }]}>
                  <Text style={{ fontSize: 12 }}>🌙</Text>
                </View>
              )}
            </View>
          </View>

          <Text style={styles.azkarSub}>
            {isArabic ? "وردك اليومي والتسبيحات الذكية" : "Daily dhikr & smart reminders"}
          </Text>

          <View style={styles.iconGrid}>
            {/* Morning → azkar-morning screen */}
            <IconAction icon="weather-sunny"
              label={isArabic ? "أذكار الصباح" : "Morning"}
              onPress={() => router.push("/azkar-morning")}
              bg="rgba(251,191,36,0.22)" iconColor="#fbbf24" />
            {/* Evening → azkar-evening screen */}
            <IconAction icon="weather-night"
              label={isArabic ? "أذكار المساء" : "Evening"}
              onPress={() => router.push("/azkar-evening")}
              bg="rgba(139,92,246,0.25)" iconColor="#a78bfa" />
            {/* General / Floating → custom-azkar management */}
            <IconAction icon="bell-ring-outline"
              label={isArabic ? "أذكار عامة" : "General"}
              onPress={() => router.push("/custom-azkar")}
              bg="rgba(52,211,153,0.18)" iconColor="#34d399" />
            {/* Tasbeeh → counter modal */}
            <IconAction icon="circle-slice-8"
              label={isArabic ? "التسبيح" : "Tasbeeh"}
              onPress={() => setTasbeehVisible(true)}
              bg="rgba(244,114,182,0.18)" iconColor="#f472b6" />
          </View>
        </LinearGradient>

        {/* ── STATS ROW ─────────────────────────────────────────── */}
        <View style={[styles.statsRow, { backgroundColor: colors.card, borderColor: colors.border, marginHorizontal: 14 }]}>
          <View style={styles.statCell}>
            <View style={[styles.statIcon, { backgroundColor: (colors.gold ?? "#f59e0b") + "22" }]}>
              <MaterialCommunityIcons name="fire" size={14} color={colors.gold ?? "#f59e0b"} />
            </View>
            <Text style={[styles.statNumber, { color: colors.foreground }]}>{streak}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              {isArabic ? "أيام متتالية" : "Day streak"}
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statCell}>
            <View style={[styles.statIcon, { backgroundColor: colors.primary + "22" }]}>
              <MaterialCommunityIcons name="check-circle-outline" size={14} color={colors.primary} />
            </View>
            <Text style={[styles.statNumber, { color: colors.foreground }]}>{todayDetectedCount}/5</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              {isArabic ? "اليوم" : "Today"}
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statCell}>
            <View style={[styles.statIcon, { backgroundColor: "#f59e0b22" }]}>
              <Text style={{ fontSize: 12 }}>🌤️</Text>
            </View>
            <Text style={[styles.statNumber, { color: colors.foreground }]}>
              {[dailyCompletion.morning, dailyCompletion.evening].filter(Boolean).length}/2
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              {isArabic ? "الأذكار" : "Azkar"}
            </Text>
          </View>
        </View>

        {/* Pocket hint */}
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          {t("pocket_hint")}
        </Text>
      </View>

      {/* ══════════════════ PRAYER TIMES MODAL ══════════════════ */}
      <BottomSheet
        visible={prayerTimesVisible}
        onClose={() => setPrayerTimesVisible(false)}
        title={isArabic ? "مواقيت الصلاة" : "Prayer Times"}
        sheetBg={colors.background}
      >
        <View style={[styles.ptContainer, { borderColor: colors.border }]}>
          {prayerStatuses.length === 0 ? (
            <View style={styles.ptNoLoc}>
              <MaterialCommunityIcons name="map-marker-off" size={28} color={colors.mutedForeground} />
              <Text style={[styles.ptNoLocText, { color: colors.mutedForeground }]}>
                {isArabic ? "يرجى تفعيل الموقع لعرض المواقيت" : "Enable location to show prayer times"}
              </Text>
            </View>
          ) : prayerStatuses.map((prayer, idx) => {
            const isCurrent = prayer.name === currentPrayer;
            const isNext    = prayer.name === nextPrayer;
            const rowBg = isCurrent
              ? colors.primary + "18"
              : isNext
              ? colors.primary + "0a"
              : "transparent";
            return (
              <View key={prayer.name} style={[
                styles.ptRow,
                { backgroundColor: rowBg, borderBottomColor: colors.border, borderBottomWidth: idx < prayerStatuses.length - 1 ? StyleSheet.hairlineWidth : 0 },
              ]}>
                {/* Status dot */}
                <View style={[
                  styles.ptDot,
                  {
                    backgroundColor: prayer.detected ? colors.primary : "transparent",
                    borderColor: prayer.detected ? colors.primary : colors.border,
                  },
                ]}>
                  {prayer.detected && <Feather name="check" size={8} color="#fff" />}
                </View>

                {/* Names */}
                <View style={styles.ptNames}>
                  <Text style={[styles.ptArabic, { color: isCurrent || isNext ? colors.foreground : colors.mutedForeground }]}>
                    {prayer.arabic}
                  </Text>
                  <Text style={[styles.ptEnglish, { color: colors.mutedForeground }]}>
                    {prayer.name}
                  </Text>
                </View>

                {/* Rakaat badge */}
                <View style={[styles.ptRakaat, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.ptRakaatText, { color: colors.mutedForeground }]}>
                    {getRakaatCount(prayer.name)}
                  </Text>
                </View>

                {/* Time */}
                <Text style={[
                  styles.ptTime,
                  { color: isCurrent ? colors.primary : isNext ? colors.foreground : colors.mutedForeground,
                    fontWeight: isCurrent || isNext ? "700" : "400" },
                ]}>
                  {prayer.time ? formatTime(prayer.time) : "--:--"}
                </Text>

                {/* Label */}
                {isCurrent && (
                  <View style={[styles.ptBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.ptBadgeText}>{isArabic ? "الآن" : "Now"}</Text>
                  </View>
                )}
                {isNext && !isCurrent && (
                  <View style={[styles.ptBadge, { backgroundColor: colors.primary + "33", borderColor: colors.primary, borderWidth: 1 }]}>
                    <Text style={[styles.ptBadgeText, { color: colors.primary }]}>{isArabic ? "التالية" : "Next"}</Text>
                  </View>
                )}
                {!isCurrent && !isNext && <View style={{ width: 42 }} />}
              </View>
            );
          })}
        </View>

        {/* Next prayer countdown */}
        {nextPrayer && timeRemaining > 0 && (
          <View style={[styles.ptCountdownRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="clock-outline" size={14} color={colors.primary} />
            <Text style={[styles.ptCountdownLabel, { color: colors.mutedForeground }]}>
              {isArabic ? "الوقت المتبقي لـ" : "Time until"}{" "}
              <Text style={{ color: colors.primary, fontWeight: "700" }}>
                {isArabic ? (PRAYER_ARABIC[nextPrayer] ?? nextPrayer) : nextPrayer}
              </Text>
            </Text>
            <Text style={[styles.ptCountdownTimer, { color: colors.foreground }]}>{countdownText}</Text>
          </View>
        )}
      </BottomSheet>

      {/* ══════════════════ QIBLA MODAL ══════════════════════════ */}
      <BottomSheet
        visible={qiblaVisible}
        onClose={() => setQiblaVisible(false)}
        title={isArabic ? "اتجاه القبلة" : "Qibla Direction"}
        sheetBg={colors.background}
      >
        {settings.latitude && settings.longitude ? (
          <QiblaCard userLat={settings.latitude} userLng={settings.longitude} />
        ) : (
          <View style={[styles.noLocBox, { borderColor: colors.border }]}>
            <MaterialCommunityIcons name="map-marker-off" size={28} color={colors.mutedForeground} />
            <Text style={[styles.noLocText, { color: colors.mutedForeground }]}>
              {isArabic ? "يرجى تفعيل الموقع لعرض اتجاه القبلة" : "Enable location to show Qibla direction"}
            </Text>
          </View>
        )}
      </BottomSheet>

      {/* ══════════════════ TASBEEH MODAL ════════════════════════ */}
      <BottomSheet
        visible={tasbeehVisible}
        onClose={() => setTasbeehVisible(false)}
        title={isArabic ? "التسبيح" : "Tasbeeh"}
        sheetBg={colors.background}
      >
        {/* Preset selector */}
        <View style={styles.tbPresets}>
          {TASBEEH_PRESETS.map((p, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => { setTasbeehPreset(i); setTasbeehCount(0); }}
              style={[
                styles.tbPresetChip,
                {
                  backgroundColor: tasbeehPreset === i ? colors.primary + "22" : colors.card,
                  borderColor:     tasbeehPreset === i ? colors.primary : colors.border,
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[styles.tbPresetText, { color: tasbeehPreset === i ? colors.primary : colors.mutedForeground }]}>
                {isArabic ? p.ar : p.en}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Arabic text */}
        <Text style={[styles.tbArabicText, { color: colors.foreground }]}>{preset.ar}</Text>

        {/* Progress ring-ish + count */}
        <Pressable style={styles.tbTapArea} onPress={handleTasbeehTap}>
          <LinearGradient
            colors={[colors.primary + "33", colors.primary + "15"]}
            style={styles.tbCountCircle}
          >
            <Text style={[styles.tbCount, { color: colors.primary }]}>{posInCycle}</Text>
            <Text style={[styles.tbTarget, { color: colors.mutedForeground }]}>/ {preset.target}</Text>
          </LinearGradient>
          <Text style={[styles.tbTapHint, { color: colors.mutedForeground }]}>
            {isArabic ? "اضغط للتسبيح" : "Tap to count"}
          </Text>
        </Pressable>

        {/* Cycle count + reset */}
        <View style={styles.tbBottom}>
          {cycles > 0 && (
            <View style={[styles.tbCycleBadge, { backgroundColor: colors.primary + "22" }]}>
              <MaterialCommunityIcons name="refresh" size={13} color={colors.primary} />
              <Text style={[styles.tbCycleText, { color: colors.primary }]}>
                {cycles}× {isArabic ? "دورة" : "cycles"}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          <Text style={[styles.tbTotal, { color: colors.mutedForeground }]}>
            {isArabic ? `الإجمالي: ${tasbeehCount}` : `Total: ${tasbeehCount}`}
          </Text>
          <TouchableOpacity
            onPress={() => setTasbeehCount(0)}
            style={[styles.tbReset, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <MaterialCommunityIcons name="restart" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* ══════════════════ DETECTION / TRAINING / ALERT ═════════ */}
      <DetectionModal
        visible={detectionVisible}
        prayerName={currentPrayer || nextPrayer}
        expectedRakaat={getRakaatCount(currentPrayer || nextPrayer)}
        calibration={calibration}
        vibrationEnabled={vibrationEnabled}
        vibrationStrength={vibrationStrength}
        sensitivity={sensitivity}
        onComplete={handleDetectionComplete}
        onCancel={() => setDetectionVisible(false)}
      />

      <TrainingModal
        visible={trainingVisible}
        pocketSide={calibration?.pocketSide ?? "unknown"}
        onClose={() => setTrainingVisible(false)}
        onCalibrationImproved={refreshCalibration}
      />

      {showBanner && bannerPrayer && (
        <PrayerAlertBanner
          prayerName={bannerPrayer}
          timeRemainingMs={timeRemaining}
          onStartDetection={() => { setBannerDismissed(true); setDetectionVisible(true); }}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  loadingText: { fontSize: 15 },

  root: { flex: 1, gap: 12, justifyContent: "center" },

  /* Header */
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  headerLeft: { flex: 1, gap: 3 },
  greeting: { fontSize: 16, fontWeight: "700", letterSpacing: -0.3 },
  nextChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  nextChipText: { fontSize: 12, fontWeight: "600" },
  headerBtn: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 1,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },

  /* Cards */
  card: {
    borderRadius: 20, overflow: "hidden", padding: 14, gap: 10,
    elevation: 6, shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 10,
  },
  glowRing: { position: "absolute", borderWidth: 1 },

  cardTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardLabelGroup: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardIconWrap: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 18, fontWeight: "800", color: "#fff", letterSpacing: -0.3 },

  /* Inline countdown */
  countdownInline: { alignItems: "flex-end" },
  countdownArabic: { fontSize: 13, color: "rgba(255,255,255,0.55)", fontWeight: "300" },
  countdownText: { fontSize: 26, fontWeight: "200", color: "#fff", letterSpacing: 1.5, fontVariant: ["tabular-nums"] },

  /* Schedule strip */
  scheduleStrip: { flexDirection: "row", justifyContent: "space-between", borderRadius: 12, paddingVertical: 8, paddingHorizontal: 6 },
  scheduleCell: { flex: 1, alignItems: "center", gap: 2 },
  scheduleDot: { width: 12, height: 12, borderRadius: 6, alignItems: "center", justifyContent: "center", marginBottom: 1 },
  scheduleArabic: { fontSize: 10, fontWeight: "600", textAlign: "center" },
  scheduleTime: { fontSize: 9, fontVariant: ["tabular-nums"], textAlign: "center" },
  scheduleActiveLine: { position: "absolute", bottom: -3, left: "20%", right: "20%", height: 2, borderRadius: 1, backgroundColor: "#34d399" },

  /* Azkar card */
  azkarSub: { fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: -4 },
  completionChips: { flexDirection: "row", gap: 4 },
  completionChip: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },

  /* Icon grid */
  iconGrid: { flexDirection: "row", justifyContent: "space-between" },
  iconAction: { flex: 1, alignItems: "center", gap: 5 },
  iconCircle: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  iconLabel: { fontSize: 10, fontWeight: "600", textAlign: "center" },

  /* Stats row */
  statsRow: { flexDirection: "row", borderRadius: 14, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 8, alignItems: "center" },
  statCell: { flex: 1, alignItems: "center", gap: 2 },
  statIcon: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", marginBottom: 1 },
  statNumber: { fontSize: 15, fontWeight: "700", letterSpacing: -0.5 },
  statLabel: { fontSize: 9, textAlign: "center" },
  statDivider: { width: StyleSheet.hairlineWidth, height: 34, marginHorizontal: 4 },

  hint: { textAlign: "center", fontSize: 11, lineHeight: 16 },

  /* Shared modal / bottom-sheet */
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 14 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { fontSize: 17, fontWeight: "700" },

  /* No-location placeholder */
  noLocBox: { borderRadius: 14, borderWidth: 1, padding: 24, alignItems: "center", gap: 10 },
  noLocText: { fontSize: 13, textAlign: "center", lineHeight: 18 },

  /* Prayer Times modal */
  ptContainer: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  ptRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  ptDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  ptNames: { flex: 1 },
  ptArabic: { fontSize: 14, fontWeight: "700" },
  ptEnglish: { fontSize: 10, marginTop: 1 },
  ptRakaat: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  ptRakaatText: { fontSize: 10, fontWeight: "600" },
  ptTime: { fontSize: 14, fontVariant: ["tabular-nums"], minWidth: 52, textAlign: "right" },
  ptBadge: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 4, minWidth: 42, alignItems: "center" },
  ptBadgeText: { fontSize: 10, fontWeight: "700", color: "#fff" },
  ptNoLoc: { padding: 24, alignItems: "center", gap: 10 },
  ptNoLocText: { fontSize: 13, textAlign: "center" },
  ptCountdownRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  ptCountdownLabel: { flex: 1, fontSize: 13 },
  ptCountdownTimer: { fontSize: 16, fontWeight: "700", fontVariant: ["tabular-nums"] },

  /* Tasbeeh modal */
  tbPresets: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tbPresetChip: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  tbPresetText: { fontSize: 11, fontWeight: "600" },
  tbArabicText: { textAlign: "center", fontSize: 22, fontWeight: "700", lineHeight: 36 },
  tbTapArea: { alignItems: "center", gap: 10 },
  tbCountCircle: {
    width: 140, height: 140, borderRadius: 70,
    alignItems: "center", justifyContent: "center",
  },
  tbCount: { fontSize: 52, fontWeight: "200", letterSpacing: -2 },
  tbTarget: { fontSize: 14 },
  tbTapHint: { fontSize: 12 },
  tbBottom: { flexDirection: "row", alignItems: "center", gap: 8 },
  tbCycleBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  tbCycleText: { fontSize: 12, fontWeight: "600" },
  tbTotal: { fontSize: 12 },
  tbReset: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
