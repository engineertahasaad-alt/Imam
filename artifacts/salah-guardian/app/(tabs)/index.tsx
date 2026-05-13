import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
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

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isArabic } = useTranslation();

  const {
    settings, isLoading, prayerStatuses, currentPrayer,
    nextPrayer, nextPrayerTime, timeRemaining, streak,
    todayDetectedCount, markPrayerDetected, calibration,
    refreshPrayerTimes, refreshCalibration,
  } = useApp();

  const { dailyCompletion, refreshCompletion } = useAzkar();

  const [detectionVisible, setDetectionVisible] = useState(false);
  const [trainingVisible, setTrainingVisible]   = useState(false);
  const [qiblaVisible, setQiblaVisible]         = useState(false);
  const [refreshing, setRefreshing]             = useState(false);

  const [bannerPrayer, setBannerPrayer]       = useState<string | null>(null);
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

  const bannerPrayerDetected = bannerPrayer != null &&
    prayerStatuses.find((p) => p.name === bannerPrayer)?.detected === true;
  const showBanner = bannerPrayer !== null && !bannerDismissed && !bannerPrayerDetected;

  const vibrationEnabled  = settings?.vibrationEnabled  ?? true;
  const vibrationStrength = settings?.vibrationStrength ?? "high";
  const sensitivity       = settings?.sensitivity       ?? 3;
  const userName          = settings?.userName;

  async function handleRefresh() {
    setRefreshing(true);
    refreshPrayerTimes();
    setTimeout(() => setRefreshing(false), 800);
  }

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

  const paddingTop    = insets.top  + (Platform.OS === "web" ? 60 : 10);
  const paddingBottom = insets.bottom + TAB_H;

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <MaterialCommunityIcons name="mosque" size={36} color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>{t("calculating")}</Text>
      </View>
    );
  }

  return (
    <>
      {/* ── Main layout — no scroll, everything fits ─────────────── */}
      <View
        style={[
          styles.root,
          { backgroundColor: colors.background, paddingTop, paddingBottom },
        ]}
      >
        {/* Celebration — only mounts when actually triggered */}
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

          {/* Section label + countdown inline */}
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

          {/* Prayer schedule strip */}
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
                    <Text style={[styles.scheduleTime,   { color: col }]}>
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
            <IconAction icon="play-circle-outline" label={isArabic ? "ابدأ الصلاة" : "Start Prayer"}
              onPress={() => setDetectionVisible(true)} bg="rgba(52,211,153,0.22)" iconColor="#34d399" />
            <IconAction icon="school-outline" label={isArabic ? "تدريب الصلاة" : "Training"}
              onPress={() => setTrainingVisible(true)} bg="rgba(251,191,36,0.18)" iconColor="#fbbf24" />
            <IconAction icon="clock-time-five-outline" label={isArabic ? "مواقيت الصلاة" : "Prayer Times"}
              onPress={() => router.push("/(tabs)/log")} bg="rgba(99,102,241,0.22)" iconColor="#818cf8" />
            <IconAction icon="compass-outline" label={isArabic ? "اتجاه القبلة" : "Qibla"}
              onPress={() => setQiblaVisible(true)} bg="rgba(244,114,182,0.18)" iconColor="#f472b6" />
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
            {/* Completion chips */}
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
            <IconAction icon="weather-sunny" label={isArabic ? "أذكار الصباح" : "Morning"}
              onPress={() => router.push("/azkar-morning")} bg="rgba(251,191,36,0.22)" iconColor="#fbbf24" />
            <IconAction icon="weather-night" label={isArabic ? "أذكار المساء" : "Evening"}
              onPress={() => router.push("/azkar-evening")} bg="rgba(139,92,246,0.25)" iconColor="#a78bfa" />
            <IconAction icon="bell-ring-outline" label={isArabic ? "أذكار عامة" : "Floating"}
              onPress={() => router.push("/(tabs)/azkar")} bg="rgba(52,211,153,0.18)" iconColor="#34d399" />
            <IconAction icon="circle-outline" label={isArabic ? "التسبيح" : "Tasbeeh"}
              onPress={() => router.push("/(tabs)/azkar")} bg="rgba(244,114,182,0.18)" iconColor="#f472b6" />
          </View>
        </LinearGradient>

        {/* ── STATS ROW ──────────────────────────────────────────── */}
        <View style={[styles.statsRow, { backgroundColor: colors.card, borderColor: colors.border, marginHorizontal: 14 }]}>
          <View style={styles.statCell}>
            <View style={[styles.statIcon, { backgroundColor: colors.gold + "22" }]}>
              <MaterialCommunityIcons name="fire" size={14} color={colors.gold} />
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

      {/* ── QIBLA MODAL ────────────────────────────────────────── */}
      <Modal visible={qiblaVisible} transparent animationType="slide" onRequestClose={() => setQiblaVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setQiblaVisible(false)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 }]}>
            {/* Handle */}
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            {/* Close row */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {isArabic ? "اتجاه القبلة" : "Qibla Direction"}
              </Text>
              <TouchableOpacity onPress={() => setQiblaVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
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
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── DETECTION / TRAINING / ALERT MODALS ─────────────────── */}
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

  root: {
    flex: 1,
    gap: 12,
    justifyContent: "center",
  },

  // Header
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  headerLeft: { flex: 1, gap: 3 },
  greeting: { fontSize: 16, fontWeight: "700", letterSpacing: -0.3 },
  nextChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  nextChipText: { fontSize: 12, fontWeight: "600" },
  headerBtn: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 1,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },

  // Cards
  card: {
    borderRadius: 20,
    overflow: "hidden",
    padding: 14,
    gap: 10,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
  },
  glowRing: { position: "absolute", borderWidth: 1 },

  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardLabelGroup: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardIconWrap: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: "center", justifyContent: "center",
  },
  cardTitle: { fontSize: 18, fontWeight: "800", color: "#fff", letterSpacing: -0.3 },

  // Inline countdown
  countdownInline: { alignItems: "flex-end" },
  countdownArabic: { fontSize: 13, color: "rgba(255,255,255,0.55)", fontWeight: "300" },
  countdownText: {
    fontSize: 26, fontWeight: "200", color: "#fff",
    letterSpacing: 1.5, fontVariant: ["tabular-nums"],
  },

  // Schedule strip
  scheduleStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  scheduleCell: { flex: 1, alignItems: "center", gap: 2 },
  scheduleDot: {
    width: 12, height: 12, borderRadius: 6,
    alignItems: "center", justifyContent: "center", marginBottom: 1,
  },
  scheduleArabic: { fontSize: 10, fontWeight: "600", textAlign: "center" },
  scheduleTime:   { fontSize: 9, fontVariant: ["tabular-nums"], textAlign: "center" },
  scheduleActiveLine: {
    position: "absolute", bottom: -3,
    left: "20%", right: "20%",
    height: 2, borderRadius: 1, backgroundColor: "#34d399",
  },

  // Azkar subtitle
  azkarSub: { fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: -4 },

  // Completion chips
  completionChips: { flexDirection: "row", gap: 4 },
  completionChip: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },

  // Icon grid
  iconGrid: { flexDirection: "row", justifyContent: "space-between" },
  iconAction: { flex: 1, alignItems: "center", gap: 5 },
  iconCircle: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: "center", justifyContent: "center",
  },
  iconLabel: { fontSize: 10, fontWeight: "600", textAlign: "center" },

  // Stats row
  statsRow: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  statCell: { flex: 1, alignItems: "center", gap: 2 },
  statIcon: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: "center", justifyContent: "center", marginBottom: 1,
  },
  statNumber: { fontSize: 15, fontWeight: "700", letterSpacing: -0.5 },
  statLabel:  { fontSize: 9, textAlign: "center" },
  statDivider: { width: StyleSheet.hairlineWidth, height: 34, marginHorizontal: 4 },

  hint: { textAlign: "center", fontSize: 11, lineHeight: 16 },

  // Qibla modal
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 14,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    alignSelf: "center", marginBottom: 4,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: { fontSize: 17, fontWeight: "700" },
  noLocBox: {
    borderRadius: 14, borderWidth: 1,
    padding: 24, alignItems: "center", gap: 10,
  },
  noLocText: { fontSize: 13, textAlign: "center", lineHeight: 18 },
});
