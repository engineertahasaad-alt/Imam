import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useTranslation } from "@/hooks/useTranslation";
import { PRAYER_ARABIC } from "@/lib/prayerCalculator";

const TAB_H = Platform.OS === "web" ? 84 : 62;

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function fmtMs(ms: number): string {
  if (ms <= 0) return "Now";
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}:${pad(s)}` : `0:${pad(s)}`;
}

interface PrayerAlertBannerProps {
  prayerName: string;
  timeRemainingMs: number;
  onStartDetection: () => void;
  onDismiss: () => void;
}

export function PrayerAlertBanner({
  prayerName,
  timeRemainingMs,
  onStartDetection,
  onDismiss,
}: PrayerAlertBannerProps) {
  const colors      = useColors();
  const insets      = useSafeAreaInsets();
  const { t }       = useTranslation();
  const slideAnim   = useRef(new Animated.Value(120)).current;
  const pulseAnim   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0, useNativeDriver: true, tension: 80, friction: 10,
    }).start();
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const isNow      = timeRemainingMs <= 0;
  const arabic     = PRAYER_ARABIC[prayerName] ?? "";
  const bottomInset = TAB_H + insets.bottom + 12;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { bottom: bottomInset, transform: [{ translateY: slideAnim }] },
      ]}
      pointerEvents="box-none"
    >
      <Animated.View
        style={[
          styles.banner,
          {
            backgroundColor: isNow ? "#166534" : "#14532d",
            borderColor:     isNow ? "#22c55e" : "#16a34a",
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        {/* Header row */}
        <View style={styles.headerRow}>
          <View style={styles.titleBlock}>
            <View style={styles.dotRow}>
              <View style={[styles.liveDot, { backgroundColor: isNow ? "#4ade80" : "#86efac" }]} />
              <Text style={styles.liveLbl}>
                {isNow ? t("prayer_time_lbl") : t("upcoming_lbl")}
              </Text>
            </View>
            <Text style={styles.prayerName}>{prayerName}</Text>
            <Text style={styles.prayerArabic}>{arabic}</Text>
          </View>

          <View style={styles.rightBlock}>
            {!isNow && (
              <Text style={styles.countdown}>{fmtMs(timeRemainingMs)}</Text>
            )}
            <TouchableOpacity
              onPress={onDismiss}
              style={styles.closeBtn}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <Feather name="x" size={15} color="#86efac" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Action button */}
        <TouchableOpacity
          style={styles.startBtn}
          onPress={onStartDetection}
          activeOpacity={0.85}
        >
          <Feather name="activity" size={16} color="#14532d" />
          <Text style={styles.startBtnText}>
            {isNow ? t("start_detection_btn") : t("get_ready_btn")}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: "absolute", left: 16, right: 16, zIndex: 200 },
  banner: {
    borderRadius: 20, borderWidth: 1.5, padding: 16, gap: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 10,
  },
  headerRow: {
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
  },
  titleBlock:   { gap: 2 },
  dotRow:       { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  liveDot:      { width: 7, height: 7, borderRadius: 4 },
  liveLbl:      { fontSize: 10, fontWeight: "700", color: "#86efac", letterSpacing: 1 },
  prayerName:   { fontSize: 22, fontWeight: "800", color: "#f0fdf4", letterSpacing: -0.5 },
  prayerArabic: { fontSize: 16, color: "#86efac", fontWeight: "500" },
  rightBlock:   { alignItems: "flex-end", gap: 4 },
  countdown:    { fontSize: 28, fontWeight: "800", color: "#f0fdf4", letterSpacing: -1, fontVariant: ["tabular-nums"] },
  closeBtn:     { padding: 4 },
  startBtn: {
    backgroundColor: "#4ade80", borderRadius: 12, paddingVertical: 12,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  startBtnText: { fontSize: 15, fontWeight: "700", color: "#14532d" },
});
