import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { PRAYER_ARABIC, formatCountdown, formatTime } from "@/lib/prayerCalculator";

interface Props {
  nextPrayer: string;
  nextPrayerTime: Date | null;
  timeRemaining: number;
  currentPrayer: string;
}

export function NextPrayerCard({
  nextPrayer,
  nextPrayerTime,
  timeRemaining,
  currentPrayer,
}: Props) {
  const colors = useColors();

  const countdownText = formatCountdown(timeRemaining);
  const nextTimeText = nextPrayerTime ? formatTime(nextPrayerTime) : "--:--";

  return (
    <LinearGradient
      colors={["#0d3d2e", "#162032"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      {/* Decorative arc */}
      <View style={styles.arcContainer}>
        <View style={[styles.arc, { borderColor: colors.primary + "30" }]} />
        <View
          style={[
            styles.arcInner,
            { borderColor: colors.primary + "20" },
          ]}
        />
      </View>

      <View style={styles.content}>
        <Text style={[styles.currentLabel, { color: colors.mutedForeground }]}>
          Now: {currentPrayer}
        </Text>

        <Text style={[styles.arabic, { color: colors.primary + "cc" }]}>
          {PRAYER_ARABIC[nextPrayer] ?? ""}
        </Text>
        <Text style={[styles.prayerName, { color: colors.foreground }]}>
          {nextPrayer}
        </Text>

        <View style={[styles.divider, { backgroundColor: colors.primary + "30" }]} />

        <Text style={[styles.countdown, { color: colors.primary }]}>
          {countdownText}
        </Text>
        <Text style={[styles.timeLabel, { color: colors.mutedForeground }]}>
          at {nextTimeText}
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    borderRadius: 20,
    overflow: "hidden",
    padding: 28,
    position: "relative",
    minHeight: 220,
  },
  arcContainer: {
    position: "absolute",
    top: -60,
    right: -60,
    alignItems: "center",
    justifyContent: "center",
  },
  arc: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    position: "absolute",
  },
  arcInner: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    position: "absolute",
  },
  content: {
    alignItems: "center",
  },
  currentLabel: {
    fontSize: 12,
    marginBottom: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  arabic: {
    fontSize: 28,
    marginBottom: 4,
    fontWeight: "300",
  },
  prayerName: {
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  divider: {
    width: 40,
    height: 1,
    marginBottom: 16,
  },
  countdown: {
    fontSize: 44,
    fontWeight: "200",
    letterSpacing: 2,
    fontVariant: ["tabular-nums"],
  },
  timeLabel: {
    fontSize: 13,
    marginTop: 6,
  },
});
