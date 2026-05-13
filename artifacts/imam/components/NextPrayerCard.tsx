import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { PrayerStatus } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "@/hooks/useTranslation";
import { PRAYER_ARABIC, formatCountdown, formatTime } from "@/lib/prayerCalculator";

interface Props {
  nextPrayer: string;
  nextPrayerTime: Date | null;
  timeRemaining: number;
  currentPrayer: string;
  prayerStatuses: PrayerStatus[];
}

export function NextPrayerCard({
  nextPrayer,
  nextPrayerTime,
  timeRemaining,
  currentPrayer,
  prayerStatuses,
}: Props) {
  const colors        = useColors();
  const { t }         = useTranslation();
  const countdownText = formatCountdown(timeRemaining);
  const nextTimeText  = nextPrayerTime ? formatTime(nextPrayerTime) : "--:--";

  const darkGrad:  readonly [string, string] = ["#0d3d2e", "#162032"];
  const lightGrad: readonly [string, string] = [colors.primary + "28", colors.card];

  return (
    <LinearGradient
      colors={colors.isDark ? darkGrad : lightGrad}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      {/* Decorative arc */}
      <View style={styles.arcContainer}>
        <View style={[styles.arc,      { borderColor: colors.primary + "25" }]} />
        <View style={[styles.arcInner, { borderColor: colors.primary + "15" }]} />
      </View>

      {/* ── Top: Next prayer info ── */}
      <View style={styles.topSection}>
        <Text style={[styles.currentLabel, { color: colors.isDark ? colors.mutedForeground : colors.mutedForeground }]}>
          {t("now_label")} {currentPrayer}
        </Text>

        <Text style={[styles.arabic, { color: colors.primary + "cc" }]}>
          {PRAYER_ARABIC[nextPrayer] ?? ""}
        </Text>

        <View style={styles.countdownRow}>
          <Text style={[styles.countdown, { color: colors.primary }]}>
            {countdownText}
          </Text>
        </View>

        <Text style={[styles.timeLabel, { color: colors.isDark ? "#94a3b8" : colors.mutedForeground }]}>
          {t("at_label")} {nextTimeText}
        </Text>
      </View>

      {/* ── Divider ── */}
      {prayerStatuses.length > 0 && (
        <View style={[styles.divider, { backgroundColor: colors.primary + "30" }]} />
      )}

      {/* ── Bottom: Prayer schedule (horizontal) ── */}
      {prayerStatuses.length > 0 && (
        <View style={styles.scheduleRow}>
          {prayerStatuses.map((prayer) => {
            const isCurrent = prayer.name === currentPrayer;
            const isNext    = prayer.name === nextPrayer;
            const labelColor = isCurrent
              ? colors.primary
              : isNext
                ? (colors.isDark ? "#e2e8f0" : colors.foreground)
                : (colors.isDark ? "#64748b" : colors.mutedForeground);

            return (
              <View key={prayer.name} style={styles.prayerCol}>
                {/* Detected / current indicator */}
                <View style={[
                  styles.dot,
                  {
                    backgroundColor: prayer.detected
                      ? colors.primary
                      : isCurrent
                        ? "transparent"
                        : "transparent",
                    borderWidth: prayer.detected ? 0 : 1.5,
                    borderColor: isCurrent
                      ? colors.primary
                      : (colors.isDark ? "#475569" : colors.border),
                  },
                ]}>
                  {prayer.detected && (
                    <Text style={{ fontSize: 8, color: colors.primaryForeground }}>✓</Text>
                  )}
                </View>

                {/* Arabic name */}
                <Text style={[styles.prayerArabic, { color: labelColor }]}>
                  {prayer.arabic}
                </Text>

                {/* Time */}
                <Text style={[styles.prayerTime, { color: isCurrent ? colors.primary : (colors.isDark ? "#64748b" : colors.mutedForeground) }]}>
                  {prayer.time ? formatTime(prayer.time) : "--:--"}
                </Text>

                {/* Current prayer underline */}
                {isCurrent && (
                  <View style={[styles.activeLine, { backgroundColor: colors.primary }]} />
                )}
              </View>
            );
          })}
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    borderRadius: 20,
    overflow: "hidden",
    padding: 20,
    position: "relative",
  },
  arcContainer: {
    position: "absolute",
    top: -50,
    right: -50,
    alignItems: "center",
    justifyContent: "center",
  },
  arc: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    position: "absolute",
  },
  arcInner: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    position: "absolute",
  },

  topSection:   { alignItems: "center", paddingBottom: 16 },
  currentLabel: { fontSize: 11, marginBottom: 8, letterSpacing: 1, textTransform: "uppercase" },
  arabic:       { fontSize: 30, marginBottom: 2, fontWeight: "300" },
  countdownRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  countdown:    { fontSize: 46, fontWeight: "200", letterSpacing: 2, fontVariant: ["tabular-nums"] },
  timeLabel:    { fontSize: 12, marginTop: 6 },

  divider: { height: StyleSheet.hairlineWidth, marginBottom: 14 },

  scheduleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  prayerCol: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    position: "relative",
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  prayerArabic: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  prayerTime: {
    fontSize: 10,
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
  activeLine: {
    position: "absolute",
    bottom: -6,
    left: "20%",
    right: "20%",
    height: 2,
    borderRadius: 1,
  },
});
