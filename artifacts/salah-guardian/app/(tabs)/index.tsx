import { Feather } from "@expo/vector-icons";
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
import { NextPrayerCard } from "@/components/NextPrayerCard";
import { PrayerAlertBanner } from "@/components/PrayerAlertBanner";
import { QiblaCard } from "@/components/QiblaCard";
import { StreakCard } from "@/components/StreakCard";
import { TrainingModal } from "@/components/TrainingModal";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "@/hooks/useTranslation";

const ALERT_THRESHOLD_MS = 5 * 60 * 1000;
const TAB_H = Platform.OS === "web" ? 84 : 62;

const RAKAAT_MAP: Record<string, number> = {
  Fajr: 2, Dhuhr: 4, Asr: 4, Maghrib: 3, Isha: 4,
};

function getRakaatCount(prayerName: string): number {
  return RAKAAT_MAP[prayerName] ?? 4;
}

export default function HomeScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { t }   = useTranslation();

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

  const bannerPrayerDetected =
    bannerPrayer != null &&
    prayerStatuses.find((p) => p.name === bannerPrayer)?.detected === true;

  const showBanner =
    bannerPrayer !== null && !bannerDismissed && !bannerPrayerDetected;

  const vibrationEnabled  = settings?.vibrationEnabled  ?? true;
  const vibrationStrength = settings?.vibrationStrength ?? "high";
  const sensitivity       = settings?.sensitivity       ?? 3;
  const userName          = settings?.userName;

  async function handleRefresh() {
    setRefreshing(true);
    refreshPrayerTimes();
    setTimeout(() => setRefreshing(false), 800);
  }

  async function handleDetectionComplete(
    rakaatCount: number,
    confidence: number,
    durationMs: number
  ) {
    setDetectionVisible(false);
    const prayerName = currentPrayer || nextPrayer;
    if (prayerName) {
      await markPrayerDetected(prayerName, confidence, rakaatCount, durationMs);
    }
  }

  const paddingBottom = TAB_H + insets.bottom;

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Feather name="moon" size={32} color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
          {t("calculating")}
        </Text>
      </View>
    );
  }

  const greetingText = userName
    ? `${t("greeting")}, ${userName} 👋`
    : `${t("greeting")} 👋`;

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + (Platform.OS === "web" ? 60 : 10), paddingBottom },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        {/* Personalized greeting */}
        <View style={styles.greetingRow}>
          <View>
            <Text style={[styles.greetingMain, { color: colors.foreground }]}>
              {greetingText}
            </Text>
            <Text style={[styles.greetingSub, { color: colors.mutedForeground }]}>
              {t("prayers_accepted")}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.settingsBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push("/(tabs)/settings")}
          >
            <Feather name="settings" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* All-5-prayers celebration */}
        <CelebrationBanner
          visible={todayDetectedCount === 5}
          userName={userName}
          streak={streak}
        />

        {/* Next prayer + prayer schedule merged in one card */}
        <NextPrayerCard
          nextPrayer={nextPrayer}
          nextPrayerTime={nextPrayerTime}
          timeRemaining={timeRemaining}
          currentPrayer={currentPrayer}
          prayerStatuses={prayerStatuses}
        />

        {/* No-location prompt */}
        {prayerStatuses.length === 0 && (
          <View style={[styles.noLocationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="map-pin" size={22} color={colors.mutedForeground} />
            <Text style={[styles.noLocationText, { color: colors.mutedForeground }]}>
              {t("no_location")}
            </Text>
          </View>
        )}

        {/* Streak stats */}
        <StreakCard streak={streak} todayCount={todayDetectedCount} />

        {/* Qibla compass */}
        {settings.latitude && settings.longitude && (
          <QiblaCard userLat={settings.latitude} userLng={settings.longitude} />
        )}

        {/* ── Start Praying button (bilingual) ── */}
        <TouchableOpacity
          style={[styles.detectBtn, { backgroundColor: colors.primary }]}
          onPress={() => setDetectionVisible(true)}
          activeOpacity={0.85}
        >
          <Feather name="activity" size={20} color={colors.primaryForeground} />
          <View style={styles.detectBtnTextWrap}>
            <Text style={[styles.detectBtnAr, { color: colors.primaryForeground }]}>
              {t("start_praying")}
            </Text>
            <Text style={[styles.detectBtnEn, { color: colors.primaryForeground + "cc" }]}>
              Start praying
            </Text>
          </View>
        </TouchableOpacity>

        {/* Train Phone */}
        <TouchableOpacity
          style={[styles.trainCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => setTrainingVisible(true)}
          activeOpacity={0.8}
        >
          <View style={[styles.trainIcon, { backgroundColor: colors.gold + "22" }]}>
            <Feather name="cpu" size={20} color={colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.trainTitle, { color: colors.foreground }]}>
              {t("train_phone")}
            </Text>
            <Text style={[styles.trainDesc, { color: colors.mutedForeground }]}>
              {t("train_desc")}
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>

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
          onStartDetection={() => {
            setBannerDismissed(true);
            setDetectionVisible(true);
          }}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  loadingText: { fontSize: 15 },

  container: { paddingHorizontal: 16, gap: 12 },

  greetingRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  greetingMain: { fontSize: 16, fontWeight: "700", letterSpacing: -0.3 },
  greetingSub:  { fontSize: 11, marginTop: 2 },
  settingsBtn:  {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },

  noLocationCard: {
    borderRadius: 14, borderWidth: 1, padding: 20, alignItems: "center", gap: 10,
  },
  noLocationText: { fontSize: 13, textAlign: "center", lineHeight: 18 },

  detectBtn: {
    borderRadius: 16, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
  },
  detectBtnTextWrap: { alignItems: "flex-start" },
  detectBtnAr:  { fontSize: 18, fontWeight: "800", letterSpacing: 0.3 },
  detectBtnEn:  { fontSize: 12, fontWeight: "500", marginTop: 1 },

  trainCard: {
    borderRadius: 14, borderWidth: 1, padding: 12,
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  trainIcon: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: "center", justifyContent: "center",
  },
  trainTitle: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  trainDesc:  { fontSize: 11, lineHeight: 16 },

  hint: { textAlign: "center", fontSize: 11, lineHeight: 16, marginTop: -4 },
});
