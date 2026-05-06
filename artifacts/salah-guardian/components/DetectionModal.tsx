import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import {
  vibrateAction,
  vibratePrayerComplete,
  vibratePosition,
  vibrateRakaatComplete,
} from "@/lib/haptics";
import { BodyPosition, DetectionEvent, MotionEngine } from "@/lib/motionEngine";
import { CalibrationData } from "@/lib/storage";

interface Props {
  visible: boolean;
  prayerName: string;
  expectedRakaat: number;
  calibration: CalibrationData | null;
  vibrationEnabled: boolean;
  onComplete: (rakaatCount: number, confidence: number, durationMs: number) => void;
  onCancel: () => void;
}

const POSITION_ICONS: Record<BodyPosition, string> = {
  STANDING: "arrow-up",
  RUKU: "chevrons-down",
  SUJOOD: "minus",
  SITTING: "minus-circle",
  UNKNOWN: "loader",
};

const POSITION_LABELS: Record<BodyPosition, string> = {
  STANDING: "Qiyam — Standing",
  RUKU: "Ruku — Bowing",
  SUJOOD: "Sujood — Prostration",
  SITTING: "Jalsa — Sitting",
  UNKNOWN: "Detecting…",
};

const FSM_STEPS = [
  "STANDING",
  "RUKU",
  "STANDING_RETURN",
  "SUJOOD_1",
  "BETWEEN_SAJDAHS",
  "SUJOOD_2",
  "TASHAHUD",
] as const;

const FSM_LABELS: Record<string, string> = {
  STANDING: "Qiyam",
  RUKU: "Ruku",
  STANDING_RETURN: "I'tidal",
  SUJOOD_1: "Sujood 1",
  BETWEEN_SAJDAHS: "Jalsa",
  SUJOOD_2: "Sujood 2",
  TASHAHUD: "Tashahud",
};

export function DetectionModal({
  visible,
  prayerName,
  expectedRakaat,
  calibration,
  vibrationEnabled,
  onComplete,
  onCancel,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [position, setPosition] = useState<BodyPosition>("UNKNOWN");
  const [rakaatCount, setRakaatCount] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [stability, setStability] = useState(1);
  const [fsmState, setFsmState] = useState("STANDING");
  const [events, setEvents] = useState<string[]>([]);
  const [startTime] = useState(Date.now());

  const engineRef = useRef<MotionEngine | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const confAnim = useRef(new Animated.Value(0)).current;
  const stabAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      startDetection();
    }
    return () => {
      engineRef.current?.stop();
    };
  }, [visible]);

  // Pulse animation — faster when actively detecting
  useEffect(() => {
    const speed = position !== "UNKNOWN" ? 600 : 1000;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: speed, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: speed, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [position]);

  // Animate confidence bar
  useEffect(() => {
    Animated.timing(confAnim, {
      toValue: confidence,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [confidence]);

  // Animate stability bar
  useEffect(() => {
    Animated.timing(stabAnim, {
      toValue: stability,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [stability]);

  function startDetection() {
    setPosition("UNKNOWN");
    setRakaatCount(0);
    setConfidence(0);
    setStability(1);
    setFsmState("STANDING");
    setEvents([]);

    const engine = new MotionEngine((event: DetectionEvent) => {
      if (event.type === "STABILITY_UPDATE") {
        if (event.stability !== undefined) setStability(event.stability);
        if (event.confidence !== undefined) setConfidence(event.confidence);
        if (event.position && event.position !== "UNKNOWN") setPosition(event.position);
        if (event.fsmState) setFsmState(event.fsmState);
      }

      if (event.type === "POSITION_CHANGE" && event.position) {
        setPosition(event.position);
        if (event.confidence !== undefined) setConfidence(event.confidence);
        vibratePosition(event.position, vibrationEnabled);
      }

      if (event.type === "RAKAH_COMPLETE") {
        const count = event.rakaatCount ?? 0;
        setRakaatCount(count);
        if (event.fsmState) setFsmState(event.fsmState);
        setEvents((prev) => [`Rak'ah ${count} complete`, ...prev.slice(0, 3)]);
        vibrateRakaatComplete(vibrationEnabled);
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
    const conf = count >= expectedRakaat ? 0.95 : count > 0 ? 0.65 : 0.3;
    engine.stop();
    vibratePrayerComplete(vibrationEnabled);
    onComplete(count, conf, durationMs);
  }

  const positionColor =
    position === "SUJOOD"    ? colors.accent :
    position === "RUKU"      ? "#60a5fa" :
    position === "SITTING"   ? colors.warning :
    position === "STANDING"  ? colors.primary :
                               colors.mutedForeground;

  const stabilityColor =
    stability > 0.7 ? colors.primary :
    stability > 0.4 ? colors.warning :
                      "#f87171";

  const confidencePct = Math.round(confidence * 100);
  const stabilityPct  = Math.round(stability * 100);

  const fsmIdx = FSM_STEPS.indexOf(fsmState as typeof FSM_STEPS[number]);

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
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 16,
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
            style={[styles.iconBtn, { backgroundColor: colors.secondary }]}
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
                borderColor: positionColor + "55",
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <View
              style={[styles.positionInner, { backgroundColor: positionColor + "30" }]}
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

        {/* Sensor quality bars */}
        <View style={[styles.qualityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Confidence */}
          <View style={styles.qualityRow}>
            <Text style={[styles.qualityLabel, { color: colors.mutedForeground }]}>
              Match confidence
            </Text>
            <Text style={[styles.qualityPct, { color: colors.primary }]}>
              {confidencePct}%
            </Text>
          </View>
          <View style={[styles.barTrack, { backgroundColor: colors.secondary }]}>
            <Animated.View
              style={[
                styles.barFill,
                {
                  backgroundColor: colors.primary,
                  width: confAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0%", "100%"],
                  }),
                },
              ]}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Stability */}
          <View style={styles.qualityRow}>
            <Text style={[styles.qualityLabel, { color: colors.mutedForeground }]}>
              Phone stability
            </Text>
            <Text style={[styles.qualityPct, { color: stabilityColor }]}>
              {stabilityPct}%
            </Text>
          </View>
          <View style={[styles.barTrack, { backgroundColor: colors.secondary }]}>
            <Animated.View
              style={[
                styles.barFill,
                {
                  backgroundColor: stabilityColor,
                  width: stabAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0%", "100%"],
                  }),
                },
              ]}
            />
          </View>

          {stability < 0.4 && (
            <Text style={[styles.stabilityHint, { color: colors.warning }]}>
              Hold still — detecting motion…
            </Text>
          )}
        </View>

        {/* FSM step indicator */}
        <View style={styles.fsmRow}>
          {FSM_STEPS.map((step, i) => {
            const isPast    = i < fsmIdx;
            const isCurrent = i === fsmIdx;
            const isFuture  = i > fsmIdx;
            return (
              <React.Fragment key={step}>
                {i > 0 && (
                  <View
                    style={[
                      styles.fsmLine,
                      { backgroundColor: isPast ? colors.primary : colors.border },
                    ]}
                  />
                )}
                <View style={styles.fsmStep}>
                  <View
                    style={[
                      styles.fsmDot,
                      {
                        backgroundColor:
                          isCurrent ? colors.primary :
                          isPast    ? colors.primary + "60" :
                                      colors.border,
                        borderWidth: isCurrent ? 2 : 0,
                        borderColor: colors.primary,
                        transform: [{ scale: isCurrent ? 1.25 : 1 }],
                      },
                    ]}
                  />
                  {isCurrent && (
                    <Text
                      style={[styles.fsmStepLabel, { color: colors.primary }]}
                      numberOfLines={1}
                    >
                      {FSM_LABELS[step]}
                    </Text>
                  )}
                </View>
              </React.Fragment>
            );
          })}
        </View>

        {/* Rakaat counter */}
        <View
          style={[styles.rakaatCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Text style={[styles.rakaatNumber, { color: colors.foreground }]}>
            {rakaatCount}
            <Text style={[styles.rakaatTotal, { color: colors.mutedForeground }]}>
              /{expectedRakaat}
            </Text>
          </Text>
          <Text style={[styles.rakaatLabel, { color: colors.mutedForeground }]}>
            Rak'aat completed
          </Text>

          <View style={styles.progressDots}>
            {Array.from({ length: expectedRakaat }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: i < rakaatCount ? colors.primary : colors.border },
                ]}
              />
            ))}
          </View>
        </View>

        {/* Event log */}
        {events.length > 0 && (
          <View style={styles.eventLog}>
            {events.map((evt, i) => (
              <Text
                key={i}
                style={[
                  styles.eventText,
                  { color: i === 0 ? colors.primary : colors.mutedForeground, opacity: 1 - i * 0.3 },
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
            style={[styles.completeBtn, { backgroundColor: colors.primary }]}
            onPress={handleComplete}
          >
            <Feather name="check" size={20} color={colors.primaryForeground} />
            <Text style={[styles.completeBtnText, { color: colors.primaryForeground }]}>
              Mark Complete
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cancelButton, { backgroundColor: colors.secondary, borderColor: colors.border }]}
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
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  centerSection: {
    alignItems: "center",
    marginBottom: 20,
  },
  positionCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  positionInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  positionLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  webNote: {
    fontSize: 12,
    marginTop: 8,
    textAlign: "center",
  },

  // Quality bars
  qualityCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  qualityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  qualityLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  qualityPct: {
    fontSize: 12,
    fontWeight: "700",
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 4,
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  divider: {
    height: 1,
    marginVertical: 10,
  },
  stabilityHint: {
    fontSize: 11,
    marginTop: 6,
    textAlign: "center",
  },

  // FSM steps
  fsmRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  fsmStep: {
    alignItems: "center",
  },
  fsmDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  fsmLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 2,
  },
  fsmStepLabel: {
    fontSize: 9,
    fontWeight: "600",
    marginTop: 3,
    position: "absolute",
    top: 12,
    width: 52,
    textAlign: "center",
  },

  // Rakaat
  rakaatCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  rakaatNumber: {
    fontSize: 52,
    fontWeight: "700",
    lineHeight: 60,
  },
  rakaatTotal: {
    fontSize: 28,
  },
  rakaatLabel: {
    fontSize: 12,
    marginBottom: 10,
  },
  progressDots: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  // Event log
  eventLog: {
    alignItems: "center",
    marginBottom: 12,
    gap: 3,
  },
  eventText: {
    fontSize: 13,
    fontWeight: "500",
  },

  // Buttons
  buttons: {
    gap: 8,
  },
  completeBtn: {
    borderRadius: 14,
    paddingVertical: 15,
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
    paddingVertical: 13,
    borderWidth: 1,
    alignItems: "center",
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: "500",
  },
  hint: {
    textAlign: "center",
    fontSize: 11,
    marginTop: 12,
  },
});
