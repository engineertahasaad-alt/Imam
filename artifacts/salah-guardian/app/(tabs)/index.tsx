import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
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
import { PrayerTimesList } from "@/components/PrayerTimesList";
import { StreakCard } from "@/components/StreakCard";
import { useApp } from "@/context/AppContext";
import { vibrateAction, vibratePrayerComplete } from "@/lib/haptics";
import { useColors } from "@/hooks/useColors";
import { getRakaatCount } from "@/lib/prayerCalculator";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    currentPrayer,
    nextPrayer,
    nextPrayerTime,
    timeRemaining,
    prayerStatuses,
    streak,
    todayDetectedCount,
    markPrayerDetected,
    calibration,
    refreshPrayerTimes,
    settings,
  } = useApp();

  const vibrationEnabled = settings?.vibrationEnabled ?? true;

  const [detectionVisible, setDetectionVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    refreshPrayerTimes();
    setTimeout(() => setRefreshing(false), 800);
  }

  function startDetection() {
    vibrateAction(vibrationEnabled);
    setDetectionVisible(true);
  }

  async function handleDetectionComplete(
    rakaatCount: number,
    confidence: number,
    durationMs: number
  ) {
    setDetectionVisible(false);
    await markPrayerDetected(currentPrayer, confidence, rakaatCount, durationMs);
    vibratePrayerComplete(vibrationEnabled);
  }

  const paddingBottom =
    Platform.OS === "web" ? insets.bottom + 84 : insets.bottom + 80;

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
            paddingBottom,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text
              style={[styles.greeting, { color: colors.mutedForeground }]}
            >
              {getGreeting()}
            </Text>
            <Text style={[styles.date, { color: colors.foreground }]}>
              {formatToday()}
            </Text>
          </View>
          <View
            style={[
              styles.detectedBadge,
              {
                backgroundColor:
                  todayDetectedCount >= 5
                    ? colors.primary + "20"
                    : colors.secondary,
              },
            ]}
          >
            <Text
              style={[
                styles.detectedCount,
                {
                  color:
                    todayDetectedCount >= 5
                      ? colors.primary
                      : colors.mutedForeground,
                },
              ]}
            >
              {todayDetectedCount}/5
            </Text>
            <Text
              style={[
                styles.detectedLabel,
                { color: colors.mutedForeground },
              ]}
            >
              prayed
            </Text>
          </View>
        </View>

        {/* Next prayer countdown */}
        <NextPrayerCard
          nextPrayer={nextPrayer}
          nextPrayerTime={nextPrayerTime}
          timeRemaining={timeRemaining}
          currentPrayer={currentPrayer}
        />

        {/* Streak stats */}
        <StreakCard streak={streak} todayCount={todayDetectedCount} />

        {/* Today's prayer times */}
        <View>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Today's Prayers
          </Text>
          <PrayerTimesList
            statuses={prayerStatuses}
            currentPrayer={currentPrayer}
          />
        </View>

        {/* Detect prayer button */}
        <TouchableOpacity
          style={[styles.detectBtn, { backgroundColor: colors.primary }]}
          onPress={startDetection}
        >
          <Feather name="activity" size={20} color={colors.primaryForeground} />
          <Text
            style={[
              styles.detectBtnText,
              { color: colors.primaryForeground },
            ]}
          >
            Start Prayer Detection
          </Text>
        </TouchableOpacity>

        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Place your phone in your pocket before praying
        </Text>
      </ScrollView>

      <DetectionModal
        visible={detectionVisible}
        prayerName={currentPrayer || nextPrayer}
        expectedRakaat={getRakaatCount(currentPrayer || nextPrayer)}
        calibration={calibration}
        vibrationEnabled={vibrationEnabled}
        onComplete={handleDetectionComplete}
        onCancel={() => setDetectionVisible(false)}
      />
    </>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Assalamu Alaikum";
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

function formatToday(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  greeting: {
    fontSize: 13,
    fontWeight: "500",
  },
  date: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 2,
  },
  detectedBadge: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: "center",
  },
  detectedCount: {
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 22,
  },
  detectedLabel: {
    fontSize: 10,
    lineHeight: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  detectBtn: {
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 4,
  },
  detectBtnText: {
    fontSize: 16,
    fontWeight: "700",
  },
  hint: {
    textAlign: "center",
    fontSize: 12,
    marginTop: -4,
    marginBottom: 8,
  },
});
