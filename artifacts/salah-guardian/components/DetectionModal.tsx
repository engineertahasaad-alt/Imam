import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { BodyPosition, DetectionEvent, MotionEngine } from "@/lib/motionEngine";
import { CalibrationData } from "@/lib/storage";

interface Props {
  visible: boolean;
  prayerName: string;
  expectedRakaat: number;
  calibration: CalibrationData | null;
  onComplete: (rakaatCount: number, confidence: number, durationMs: number) => void;
  onCancel: () => void;
}

const POSITION_ICONS: Record<BodyPosition, string> = {
  STANDING: "arrow-up",
  RUKU: "chevron-down",
  SUJOOD: "minus",
  SITTING: "minus-circle",
  UNKNOWN: "loader",
};

const POSITION_LABELS: Record<BodyPosition, string> = {
  STANDING: "Qiyam (Standing)",
  RUKU: "Ruku (Bowing)",
  SUJOOD: "Sujood (Prostration)",
  SITTING: "Sitting",
  UNKNOWN: "Detecting...",
};

export function DetectionModal({
  visible,
  prayerName,
  expectedRakaat,
  calibration,
  onComplete,
  onCancel,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [position, setPosition] = useState<BodyPosition>("UNKNOWN");
  const [rakaatCount, setRakaatCount] = useState(0);
  const [events, setEvents] = useState<string[]>([]);
  const [startTime] = useState(Date.now());

  const engineRef = useRef<MotionEngine | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      startDetection();
    }
    return () => {
      engineRef.current?.stop();
    };
  }, [visible]);

  // Pulse animation
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  function startDetection() {
    setPosition("UNKNOWN");
    setRakaatCount(0);
    setEvents([]);

    const engine = new MotionEngine((event: DetectionEvent) => {
      if (event.type === "POSITION_CHANGE" && event.position) {
        setPosition(event.position);
        if (Platform.OS !== "web") {
          Haptics.selectionAsync().catch(() => {});
        }
      }
      if (event.type === "RAKAH_COMPLETE") {
        const count = event.rakaatCount ?? 0;
        setRakaatCount(count);
        setEvents((prev) => [
          `Rak'ah ${count} complete`,
          ...prev.slice(0, 3),
        ]);
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success
          ).catch(() => {});
        }
      }
    });

    if (calibration) {
      engine.setCalibration({
        ...calibration,
        calibratedAt: calibration.calibratedAt,
        pocketSide: calibration.pocketSide,
      });
    }

    engine.start();
    engineRef.current = engine;
  }

  function handleComplete() {
    const engine = engineRef.current;
    if (!engine) return;
    const count = engine.getRakaatCount();
    const durationMs = Date.now() - startTime;
    const confidence =
      count >= expectedRakaat ? 0.9 : count > 0 ? 0.6 : 0.3;
    engine.stop();
    onComplete(count, confidence, durationMs);
  }

  const positionColor =
    position === "SUJOOD"
      ? colors.accent
      : position === "RUKU"
      ? colors.primary + "cc"
      : position === "SITTING"
      ? colors.warning
      : position === "STANDING"
      ? colors.primary
      : colors.mutedForeground;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + 20,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {prayerName} Detection
          </Text>
          <TouchableOpacity
            onPress={onCancel}
            style={[
              styles.cancelBtn,
              { backgroundColor: colors.secondary },
            ]}
          >
            <Feather name="x" size={18} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* Position indicator */}
        <View style={styles.centerSection}>
          <Animated.View
            style={[
              styles.positionCircle,
              {
                backgroundColor: positionColor + "18",
                borderColor: positionColor + "40",
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <View
              style={[
                styles.positionInner,
                { backgroundColor: positionColor + "30" },
              ]}
            >
              <Feather
                name={POSITION_ICONS[position] as any}
                size={36}
                color={positionColor}
              />
            </View>
          </Animated.View>

          <Text style={[styles.positionLabel, { color: positionColor }]}>
            {POSITION_LABELS[position]}
          </Text>

          {position === "UNKNOWN" && Platform.OS === "web" && (
            <Text style={[styles.webNote, { color: colors.mutedForeground }]}>
              Sensor detection requires a physical device
            </Text>
          )}
        </View>

        {/* Rakaat counter */}
        <View
          style={[
            styles.rakaatCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.rakaatNumber, { color: colors.foreground }]}>
            {rakaatCount}
            <Text style={[styles.rakaatTotal, { color: colors.mutedForeground }]}>
              /{expectedRakaat}
            </Text>
          </Text>
          <Text style={[styles.rakaatLabel, { color: colors.mutedForeground }]}>
            Rak'aat
          </Text>

          {/* Progress dots */}
          <View style={styles.progressDots}>
            {Array.from({ length: expectedRakaat }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      i < rakaatCount ? colors.primary : colors.border,
                  },
                ]}
              />
            ))}
          </View>
        </View>

        {/* Recent events */}
        {events.length > 0 && (
          <View style={styles.eventLog}>
            {events.map((evt, i) => (
              <Text
                key={i}
                style={[
                  styles.eventText,
                  {
                    color:
                      i === 0 ? colors.primary : colors.mutedForeground,
                    opacity: 1 - i * 0.3,
                  },
                ]}
              >
                ✓ {evt}
              </Text>
            ))}
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.buttons}>
          <TouchableOpacity
            style={[
              styles.completeBtn,
              { backgroundColor: colors.primary },
            ]}
            onPress={handleComplete}
          >
            <Feather name="check" size={20} color={colors.primaryForeground} />
            <Text style={[styles.completeBtnText, { color: colors.primaryForeground }]}>
              Mark Complete
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.cancelButton,
              { backgroundColor: colors.secondary, borderColor: colors.border },
            ]}
            onPress={onCancel}
          >
            <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Keep your phone in your pocket while praying
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  cancelBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  centerSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  positionCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  positionInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  positionLabel: {
    fontSize: 18,
    fontWeight: "600",
  },
  webNote: {
    fontSize: 12,
    marginTop: 8,
    textAlign: "center",
  },
  rakaatCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    marginBottom: 24,
  },
  rakaatNumber: {
    fontSize: 56,
    fontWeight: "700",
    lineHeight: 64,
  },
  rakaatTotal: {
    fontSize: 32,
  },
  rakaatLabel: {
    fontSize: 13,
    marginBottom: 12,
  },
  progressDots: {
    flexDirection: "row",
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  eventLog: {
    alignItems: "center",
    marginBottom: 24,
    gap: 4,
  },
  eventText: {
    fontSize: 13,
    fontWeight: "500",
  },
  buttons: {
    gap: 10,
  },
  completeBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  completeBtnText: {
    fontSize: 16,
    fontWeight: "700",
  },
  cancelButton: {
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: "500",
  },
  hint: {
    textAlign: "center",
    fontSize: 12,
    marginTop: 16,
  },
});
