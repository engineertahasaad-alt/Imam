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

import { DetectionModal } from "@/components/DetectionModal";
import { NextPrayerCard } from "@/components/NextPrayerCard";
import { PrayerAlertBanner } from "@/components/PrayerAlertBanner";
import { PrayerTimesList } from "@/components/PrayerTimesList";
import { StreakCard } from "@/components/StreakCard";
import { TrainingModal } from "@/components/TrainingModal";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const ALERT_THRESHOLD_MS = 5 * 60 * 1000;

const RAKAAT_MAP: Record<string, number> = {
  Fajr: 2, Dhuhr: 4, Asr: 4, Maghrib: 3, Isha: 4,
};

function getRakaatCount(prayerName: string): number {
  return RAKAAT_MAP[prayerName] ?? 4;
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

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

  // Banner state: track which prayer triggered it and whether user dismissed it
  const [bannerPrayer, setBannerPrayer]       = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const prevNextPrayerRef                     = useRef<string>("");

  // Show banner when next prayer is within 5 minutes
  useEffect(() => {
    if (!nextPrayer) return;
    // New prayer approaching — reset dismissed flag
    if (nextPrayer !== prevNextPrayerRef.current) {
      prevNextPrayerRef.current = nextPrayer;
      setBannerDismissed(false);
    }
    if (timeRemaining > 0 && timeRemaining <= ALERT_THRESHOLD_MS) {
      setBannerPrayer(nextPrayer);
    }
  }, [timeRemaining, nextPrayer]);

  // Has the alerted prayer already been detected today?
  const bannerPrayerDetected =
    bannerPrayer != null &&
    prayerStatuses.find((p) => p.name === bannerPrayer)?.detected === true;

  const showBanner =
    bannerPrayer !== null && !bannerDismissed && !bannerPrayerDetected;

  const vibrationEnabled  = settings?.vibrationEnabled  ?? true;
  const vibrationStrength = settings?.vibrationStrength ?? "high";
  const sensitivity       = settings?.sensitivity       ?? 3;

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

  const paddingBottom = Platform.OS === "web" ? insets.bottom + 84 : insets.bottom + 80;

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Feather name="moon" size={32} color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
          Calculating prayer times…
        </Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16), paddingBottom },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        {/* Next prayer countdown */}
        <NextPrayerCard
          nextPrayer={nextPrayer}
          nextPrayerTime={nextPrayerTime}
          timeRemaining={timeRemaining}
          currentPrayer={currentPrayer}
        />

        {/* Streak stats */}
        <StreakCard streak={streak} todayCount={todayDetectedCount} />

        {/* Today's prayers */}
        {prayerStatuses.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
              TODAY'S PRAYERS
            </Text>
            <PrayerTimesList statuses={prayerStatuses} currentPrayer={currentPrayer} />
          </View>
        ) : (
          <View style={[styles.noLocationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="map-pin" size={24} color={colors.mutedForeground} />
            <Text style={[styles.noLocationText, { color: colors.mutedForeground }]}>
              Set your location in Settings to see prayer times
            </Text>
          </View>
        )}

        {/* Start Prayer Detection */}
        <TouchableOpacity
          style={[styles.detectBtn, { backgroundColor: colors.primary }]}
          onPress={() => setDetectionVisible(true)}
          activeOpacity={0.85}
        >
          <Feather name="activity" size={22} color={colors.primaryForeground} />
          <Text style={[styles.detectBtnText, { color: colors.primaryForeground }]}>
            Start Prayer Detection
          </Text>
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
              Train Your Phone
            </Text>
            <Text style={[styles.trainDesc, { color: colors.mutedForeground }]}>
              Teach Imam your body positions for better accuracy
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>

        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Place your phone in your pocket before starting prayer
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

  container: { paddingHorizontal: 20, gap: 16 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, paddingLeft: 4 },

  noLocationCard: {
    borderRadius: 16, borderWidth: 1, padding: 24, alignItems: "center", gap: 12,
  },
  noLocationText: { fontSize: 14, textAlign: "center", lineHeight: 20 },

  detectBtn: {
    borderRadius: 16, paddingVertical: 17,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    marginTop: 4,
  },
  detectBtnText: { fontSize: 17, fontWeight: "700" },

  trainCard: {
    borderRadius: 16, borderWidth: 1, padding: 14,
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  trainIcon: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
  },
  trainTitle: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  trainDesc:  { fontSize: 12, lineHeight: 17 },

  hint: { textAlign: "center", fontSize: 12, lineHeight: 18, marginTop: -4 },
});
