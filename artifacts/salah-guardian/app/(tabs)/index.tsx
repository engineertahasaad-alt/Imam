import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Platform,
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
function getRakaatCount(prayerName: string): number {
  return RAKAAT_MAP[prayerName] ?? 4;
}

// ── Compact circular icon button ─────────────────────────────────────────────
function IconAction({
  icon,
  label,
  onPress,
  bg,
  iconColor,
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
    settings,
    isLoading,
    prayerStatuses,
    currentPrayer,
    nextPrayer,
    nextPrayerTime,
    timeRemaining,
    streak,
    todayDetectedCount,
    markPrayerDetected,
    calibration,
    refreshPrayerTimes,
    refreshCalibration,
  } = useApp();

  const { dailyCompletion, refreshCompletion } = useAzkar();

  const [detectionVisible, setDetectionVisible] = useState(false);
  const [trainingVisible, setTrainingVisible]   = useState(false);
  const [refreshing, setRefreshing]             = useState(false);

  const [bannerPrayer, setBannerPrayer]       = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const prevNextPrayerRef                     = useRef<string>("");

  useEffect(() => {
    if (!nextPrayer) return;
    if (nextPrayer !== prevNextPrayerRef.current) {
      prevNextPrayerRef.current = nextPrayer;
      setBannerDismissed(false);
    }
    if (timeRemaining > 0 && timeRemaining <= ALERT_THRESHOLD_MS) {
      setBannerPrayer(nextPrayer);
    }
  }, [timeRemaining, nextPrayer]);

  useEffect(() => { refreshCompletion(); }, []);

  const bannerPrayerDetected =
    bannerPrayer != null &&
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

  async function handleDetectionComplete(rakaatCount: number, confidence: number, durationMs: number) {
    setDetectionVisible(false);
    const prayerName = currentPrayer || nextPrayer;
    if (prayerName) await markPrayerDetected(prayerName, confidence, rakaatCount, durationMs);
  }

  const paddingTop    = insets.top + (Platform.OS === "web" ? 60 : 10);
  const paddingBottom = TAB_H + insets.bottom;
  const countdownText = formatCountdown(timeRemaining);
  const nextTimeText  = nextPrayerTime ? formatTime(nextPrayerTime) : "--:--";

  // Greeting
  const greeting = isArabic
    ? `السلام عليكم${userName ? `، ${userName}` : ""}`
    : `Peace be upon you${userName ? `, ${userName}` : ""}`;

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <MaterialCommunityIcons name="mosque" size={36} color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
          {t("calculating")}
        </Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={[styles.container, { paddingTop, paddingBottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        {/* ── HEADER ─────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.greeting, { color: colors.foreground }]} numberOfLines={1}>
              {greeting}
            </Text>
            {nextPrayer ? (
              <View style={styles.nextPrayerChip}>
                <MaterialCommunityIcons name="clock-outline" size={11} color={colors.primary} />
                <Text style={[styles.nextPrayerChipText, { color: colors.primary }]}>
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

        {/* Celebration */}
        <CelebrationBanner visible={todayDetectedCount === 5} userName={userName} streak={streak} />

        {/* ── PRAYER CARD ─────────────────────────────────────────── */}
        <LinearGradient
          colors={colors.isDark ? ["#0a2e1f", "#0d2d1a", "#162032"] : ["#065f46", "#047857", "#059669"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sectionCard}
        >
          {/* Decorative glow rings */}
          <View style={[styles.glowRing, { borderColor: "rgba(52,211,153,0.12)", top: -30, right: -30, width: 140, height: 140, borderRadius: 70 }]} />
          <View style={[styles.glowRing, { borderColor: "rgba(52,211,153,0.07)", top: -55, right: -55, width: 200, height: 200, borderRadius: 100 }]} />

          {/* Section label */}
          <View style={styles.sectionLabelRow}>
            <View style={[styles.sectionIconWrap, { backgroundColor: "rgba(52,211,153,0.18)" }]}>
              <MaterialCommunityIcons name="mosque" size={18} color="#34d399" />
            </View>
            <Text style={styles.sectionLabel}>
              {isArabic ? "الصلاة" : "Prayer"}
            </Text>
          </View>

          {/* Next prayer countdown */}
          {nextPrayer ? (
            <View style={styles.countdownBlock}>
              <Text style={styles.nextPrayerArabic}>
                {PRAYER_ARABIC[nextPrayer] ?? nextPrayer}
              </Text>
              <Text style={styles.countdown}>{countdownText}</Text>
              <Text style={styles.countdownSub}>
                {isArabic ? `المتبقي · ${nextTimeText}` : `Remaining · ${nextTimeText}`}
              </Text>
            </View>
          ) : (
            <View style={styles.countdownBlock}>
              <Text style={styles.countdownSub}>
                {isArabic ? "حدد موقعك لعرض أوقات الصلاة" : "Set location for prayer times"}
              </Text>
            </View>
          )}

          {/* Prayer schedule strip */}
          {prayerStatuses.length > 0 && (
            <View style={[styles.scheduleStrip, { backgroundColor: "rgba(0,0,0,0.25)" }]}>
              {prayerStatuses.map((prayer) => {
                const isCurrent = prayer.name === currentPrayer;
                const isNext    = prayer.name === nextPrayer;
                const col = isCurrent
                  ? "#34d399"
                  : isNext
                    ? "rgba(255,255,255,0.9)"
                    : "rgba(255,255,255,0.4)";
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
            <IconAction
              icon="play-circle-outline"
              label={isArabic ? "ابدأ الصلاة" : "Start Prayer"}
              onPress={() => setDetectionVisible(true)}
              bg="rgba(52,211,153,0.22)"
              iconColor="#34d399"
            />
            <IconAction
              icon="school-outline"
              label={isArabic ? "تدريب الصلاة" : "Training"}
              onPress={() => setTrainingVisible(true)}
              bg="rgba(251,191,36,0.18)"
              iconColor="#fbbf24"
            />
            <IconAction
              icon="clock-time-five-outline"
              label={isArabic ? "مواقيت الصلاة" : "Prayer Times"}
              onPress={() => router.push("/(tabs)/log")}
              bg="rgba(99,102,241,0.22)"
              iconColor="#818cf8"
            />
            <IconAction
              icon="compass-outline"
              label={isArabic ? "اتجاه القبلة" : "Qibla"}
              onPress={() => router.push("/(tabs)/stats")}
              bg="rgba(244,114,182,0.18)"
              iconColor="#f472b6"
            />
          </View>
        </LinearGradient>

        {/* ── AZKAR CARD ─────────────────────────────────────────── */}
        <LinearGradient
          colors={colors.isDark ? ["#0e1a3a", "#12203f", "#162032"] : ["#1e3a5f", "#1e40af", "#2563eb"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sectionCard}
        >
          {/* Decorative glow rings */}
          <View style={[styles.glowRing, { borderColor: "rgba(129,140,248,0.14)", top: -30, right: -30, width: 140, height: 140, borderRadius: 70 }]} />
          <View style={[styles.glowRing, { borderColor: "rgba(129,140,248,0.08)", top: -55, right: -55, width: 200, height: 200, borderRadius: 100 }]} />

          {/* Section label */}
          <View style={styles.sectionLabelRow}>
            <View style={[styles.sectionIconWrap, { backgroundColor: "rgba(139,92,246,0.22)" }]}>
              <Text style={{ fontSize: 16 }}>🤲</Text>
            </View>
            <Text style={styles.sectionLabel}>
              {isArabic ? "الأذكار" : "Azkar"}
            </Text>

            {/* Today's completion chips */}
            <View style={styles.completionChips}>
              {dailyCompletion.morning && (
                <View style={[styles.completionChip, { backgroundColor: "rgba(251,191,36,0.22)" }]}>
                  <Text style={{ fontSize: 11 }}>🌤️</Text>
                </View>
              )}
              {dailyCompletion.evening && (
                <View style={[styles.completionChip, { backgroundColor: "rgba(139,92,246,0.25)" }]}>
                  <Text style={{ fontSize: 11 }}>🌙</Text>
                </View>
              )}
            </View>
          </View>

          {/* Subtitle */}
          <Text style={styles.azkarSubtitle}>
            {isArabic ? "وردك اليومي والتسبيحات الذكية" : "Daily dhikr & smart reminders"}
          </Text>

          {/* Action icons */}
          <View style={styles.iconGrid}>
            <IconAction
              icon="weather-sunny"
              label={isArabic ? "أذكار الصباح" : "Morning"}
              onPress={() => router.push("/azkar-morning")}
              bg="rgba(251,191,36,0.22)"
              iconColor="#fbbf24"
            />
            <IconAction
              icon="weather-night"
              label={isArabic ? "أذكار المساء" : "Evening"}
              onPress={() => router.push("/azkar-evening")}
              bg="rgba(139,92,246,0.25)"
              iconColor="#a78bfa"
            />
            <IconAction
              icon="bell-ring-outline"
              label={isArabic ? "أذكار عامة" : "Floating"}
              onPress={() => router.push("/(tabs)/azkar")}
              bg="rgba(52,211,153,0.18)"
              iconColor="#34d399"
            />
            <IconAction
              icon="circle-outline"
              label={isArabic ? "التسبيح" : "Tasbeeh"}
              onPress={() => router.push("/(tabs)/azkar")}
              bg="rgba(244,114,182,0.18)"
              iconColor="#f472b6"
            />
          </View>
        </LinearGradient>

        {/* ── STATS ROW ──────────────────────────────────────────── */}
        <View style={[styles.statsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.statCell}>
            <View style={[styles.statIcon, { backgroundColor: colors.gold + "22" }]}>
              <MaterialCommunityIcons name="fire" size={15} color={colors.gold} />
            </View>
            <Text style={[styles.statNumber, { color: colors.foreground }]}>{streak}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              {isArabic ? "أيام متتالية" : "Day streak"}
            </Text>
          </View>

          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

          <View style={styles.statCell}>
            <View style={[styles.statIcon, { backgroundColor: colors.primary + "22" }]}>
              <MaterialCommunityIcons name="check-circle-outline" size={15} color={colors.primary} />
            </View>
            <Text style={[styles.statNumber, { color: colors.foreground }]}>{todayDetectedCount}/5</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              {isArabic ? "اليوم" : "Today"}
            </Text>
          </View>

          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

          <View style={styles.statCell}>
            <View style={[styles.statIcon, { backgroundColor: "#f59e0b22" }]}>
              <Text style={{ fontSize: 13 }}>🌤️</Text>
            </View>
            <Text style={[styles.statNumber, { color: colors.foreground }]}>
              {[dailyCompletion.morning, dailyCompletion.evening].filter(Boolean).length}/2
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              {isArabic ? "الأذكار" : "Azkar"}
            </Text>
          </View>
        </View>

        {/* ── POCKET HINT ─────────────────────────────────────────── */}
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          {t("pocket_hint")}
        </Text>
      </ScrollView>

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

  container: { paddingHorizontal: 14, gap: 14 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  headerLeft: { flex: 1, gap: 3 },
  greeting: { fontSize: 16, fontWeight: "700", letterSpacing: -0.3 },
  nextPrayerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  nextPrayerChipText: { fontSize: 12, fontWeight: "600" },
  headerBtn: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },

  // Section cards
  sectionCard: {
    borderRadius: 22,
    overflow: "hidden",
    padding: 18,
    gap: 14,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  glowRing: {
    position: "absolute",
    borderWidth: 1,
  },

  // Section label
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionIconWrap: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: "center", justifyContent: "center",
  },
  sectionLabel: {
    fontSize: 20, fontWeight: "800", color: "#fff", flex: 1,
    letterSpacing: -0.3,
  },
  completionChips: { flexDirection: "row", gap: 4 },
  completionChip: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: "center", justifyContent: "center",
  },

  // Prayer countdown
  countdownBlock: { alignItems: "center", paddingVertical: 4 },
  nextPrayerArabic: {
    fontSize: 28, fontWeight: "300", color: "rgba(255,255,255,0.7)",
    marginBottom: 2,
  },
  countdown: {
    fontSize: 52, fontWeight: "200", color: "#fff",
    letterSpacing: 2,
    fontVariant: ["tabular-nums"],
  },
  countdownSub: { fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 },

  // Prayer schedule strip
  scheduleStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  scheduleCell: { flex: 1, alignItems: "center", gap: 3 },
  scheduleDot: {
    width: 13, height: 13, borderRadius: 7,
    alignItems: "center", justifyContent: "center", marginBottom: 1,
  },
  scheduleArabic: { fontSize: 10, fontWeight: "600", textAlign: "center" },
  scheduleTime:   { fontSize: 9, fontVariant: ["tabular-nums"], textAlign: "center" },
  scheduleActiveLine: {
    position: "absolute", bottom: -4,
    left: "20%", right: "20%",
    height: 2, borderRadius: 1, backgroundColor: "#34d399",
  },

  // Azkar subtitle
  azkarSubtitle: {
    fontSize: 12, color: "rgba(255,255,255,0.55)",
    marginTop: -6,
  },

  // Icon grid
  iconGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  iconAction: {
    flex: 1,
    alignItems: "center",
    gap: 7,
  },
  iconCircle: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: "center", justifyContent: "center",
  },
  iconLabel: {
    fontSize: 10.5,
    fontWeight: "600",
    textAlign: "center",
  },

  // Stats row
  statsRow: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  statCell: { flex: 1, alignItems: "center", gap: 3 },
  statIcon: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center", marginBottom: 2,
  },
  statNumber: { fontSize: 16, fontWeight: "700", letterSpacing: -0.5 },
  statLabel:  { fontSize: 10, textAlign: "center" },
  statDivider: { width: StyleSheet.hairlineWidth, height: 36, marginHorizontal: 4 },

  hint: { textAlign: "center", fontSize: 11, lineHeight: 16, marginTop: -4 },
});
