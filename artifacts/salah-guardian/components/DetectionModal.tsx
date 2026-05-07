import { Feather } from "@expo/vector-icons";
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
import {
  vibrateAction,
  vibrateCorrect,
  vibratePrayerComplete,
  vibrateRakaatComplete,
  vibrateWrong,
} from "@/lib/haptics";
import { BodyPosition, DetectionEvent, MotionEngine } from "@/lib/motionEngine";
import { CalibrationData } from "@/lib/storage";

interface Props {
  visible: boolean;
  prayerName: string;
  expectedRakaat: number;
  calibration: CalibrationData | null;
  vibrationEnabled: boolean;
  vibrationStrength?: "low" | "medium" | "high";
  sensitivity?: number;
  onComplete: (rakaatCount: number, confidence: number, durationMs: number) => void;
  onCancel: () => void;
}

const POSITION_ICONS: Record<BodyPosition, string> = {
  STANDING: "arrow-up",
  RUKU:     "chevrons-down",
  SUJOOD:   "minus",
  SITTING:  "minus-circle",
  UNKNOWN:  "loader",
};

const POSITION_LABELS: Record<BodyPosition, string> = {
  STANDING: "Qiyam — Standing",
  RUKU:     "Ruku — Bowing",
  SUJOOD:   "Sujood — Prostration",
  SITTING:  "Jalsa — Sitting",
  UNKNOWN:  "Detecting…",
};

const POSITION_GUIDE: Record<BodyPosition, string> = {
  STANDING: "Stand upright, phone in pocket",
  RUKU:     "Bow forward at the waist",
  SUJOOD:   "Prostrate — forehead to ground",
  SITTING:  "Sit between the two sajdahs",
  UNKNOWN:  "Keep the phone still in your pocket",
};

const FSM_STEPS = [
  "STANDING", "RUKU", "STANDING_RETURN",
  "SUJOOD_1", "BETWEEN_SAJDAHS", "SUJOOD_2", "TASHAHUD",
] as const;

const FSM_LABELS: Record<string, string> = {
  STANDING:        "Qiyam",
  RUKU:            "Ruku",
  STANDING_RETURN: "I'tidal",
  SUJOOD_1:        "Sujood 1",
  BETWEEN_SAJDAHS: "Jalsa",
  SUJOOD_2:        "Sujood 2",
  TASHAHUD:        "Tashahud",
};

export function DetectionModal({
  visible,
  prayerName,
  expectedRakaat,
  calibration,
  vibrationEnabled,
  vibrationStrength = "high",
  sensitivity = 3,
  onComplete,
  onCancel,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [position, setPosition]         = useState<BodyPosition>("UNKNOWN");
  const [expectedPos, setExpected]       = useState<BodyPosition>("STANDING");
  const [nextExpected, setNextExpected]  = useState<BodyPosition>("RUKU");
  const [isCorrect, setIsCorrect]        = useState<boolean | null>(null);
  const [holdProgress, setHoldProgress]  = useState(0);
  const [isConfirmed, setIsConfirmed]    = useState(false);
  const [rakaatCount, setRakaatCount]    = useState(0);
  const [confidence, setConfidence]      = useState(0);
  const [stability, setStability]        = useState(1);
  const [fsmState, setFsmState]          = useState("STANDING");
  const [events, setEvents]              = useState<string[]>([]);
  const [startTime]                      = useState(Date.now());

  const engineRef  = useRef<MotionEngine | null>(null);
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const confAnim   = useRef(new Animated.Value(0)).current;
  const stabAnim   = useRef(new Animated.Value(1)).current;
  const holdAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) startDetection();
    return () => { engineRef.current?.stop(); };
  }, [visible]);

  useEffect(() => {
    const speed = position !== "UNKNOWN" ? 700 : 1100;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.07, duration: speed, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: speed, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [position]);

  useEffect(() => {
    Animated.timing(confAnim, { toValue: confidence, duration: 300, useNativeDriver: false }).start();
  }, [confidence]);

  useEffect(() => {
    Animated.timing(stabAnim, { toValue: stability, duration: 200, useNativeDriver: false }).start();
  }, [stability]);

  useEffect(() => {
    Animated.timing(holdAnim, { toValue: holdProgress, duration: 120, useNativeDriver: false }).start();
  }, [holdProgress]);

  function startDetection() {
    setPosition("UNKNOWN");
    setExpected("STANDING");
    setNextExpected("RUKU");
    setIsCorrect(null);
    setHoldProgress(0);
    setIsConfirmed(false);
    setRakaatCount(0);
    setConfidence(0);
    setStability(1);
    setFsmState("STANDING");
    setEvents([]);

    const engine = new MotionEngine((event: DetectionEvent) => {

      // ── Stability heartbeat ──────────────────────────────────────────────
      if (event.type === "STABILITY_UPDATE") {
        if (event.stability  !== undefined) setStability(event.stability);
        if (event.confidence !== undefined) setConfidence(event.confidence);
        if (event.position && event.position !== "UNKNOWN") setPosition(event.position);
        if (event.fsmState)          setFsmState(event.fsmState);
        if (event.expectedPosition)  setExpected(event.expectedPosition);
        if (event.nextExpectedPosition) setNextExpected(event.nextExpectedPosition);
        if (event.holdProgress !== undefined) setHoldProgress(event.holdProgress);
      }

      // ── Posture validation ──────────────────────────────────────────────
      if (event.type === "POSTURE_VALIDATION") {
        if (event.position)            setPosition(event.position);
        if (event.expectedPosition)    setExpected(event.expectedPosition);
        if (event.nextExpectedPosition) setNextExpected(event.nextExpectedPosition);
        if (event.confidence !== undefined) setConfidence(event.confidence);
        if (event.fsmState)            setFsmState(event.fsmState);
        if (event.isCorrect !== undefined) setIsCorrect(event.isCorrect);
        if (event.holdProgress !== undefined) setHoldProgress(event.holdProgress);

        // ── WRONG posture (including repeats) ──────────────────────────
        if (event.isCorrect === false) {
          setHoldProgress(0);
          setIsConfirmed(false);
          vibrateWrong(vibrationEnabled, vibrationStrength);
        }

        // ── Holding in correct position — update progress bar ──────────
        if (event.isCorrect === true && event.isConfirmed === false) {
          // No vibration during hold — just show the progress bar
        }

        // ── CONFIRMED correct after 3-second hold ─────────────────────
        if (event.isCorrect === true && event.isConfirmed === true) {
          setHoldProgress(1);
          setIsConfirmed(true);
          vibrateCorrect(vibrationEnabled, vibrationStrength);
          setTimeout(() => { setHoldProgress(0); setIsConfirmed(false); }, 800);
        }
      }

      // ── FSM position change (after confirmed hold) ───────────────────
      if (event.type === "POSITION_CHANGE" && event.position) {
        setPosition(event.position);
        if (event.confidence !== undefined) setConfidence(event.confidence);
        if (event.fsmState) setFsmState(event.fsmState);
        setHoldProgress(0);
        setIsConfirmed(false);
        setIsCorrect(null);
      }

      // ── Rak'ah complete ─────────────────────────────────────────────
      if (event.type === "RAKAH_COMPLETE") {
        const count = event.rakaatCount ?? 0;
        setRakaatCount(count);
        if (event.fsmState) setFsmState(event.fsmState);
        setEvents((prev) => [`Rak'ah ${count} complete`, ...prev.slice(0, 3)]);
        vibrateRakaatComplete(vibrationEnabled);
      }

    }, sensitivity);

    if (calibration) {
      engine.setCalibration({
        ...calibration,
        calibratedAt: calibration.calibratedAt,
        pocketSide:   calibration.pocketSide,
      });
    }

    engine.start();
    engineRef.current = engine;
    vibrateAction(vibrationEnabled);
  }

  function handleComplete() {
    const engine = engineRef.current;
    if (!engine) return;
    const count    = engine.getRakaatCount();
    const durationMs = Date.now() - startTime;
    const conf     = count >= expectedRakaat ? 0.95 : count > 0 ? 0.65 : 0.3;
    engine.stop();
    vibratePrayerComplete(vibrationEnabled);
    onComplete(count, conf, durationMs);
  }

  // ── Colors ─────────────────────────────────────────────────────────────────
  const positionColor =
    position === "SUJOOD"   ? colors.accent :
    position === "RUKU"     ? "#60a5fa" :
    position === "SITTING"  ? colors.warning :
    position === "STANDING" ? colors.primary :
                              colors.mutedForeground;

  const stabilityColor =
    stability > 0.7 ? colors.primary :
    stability > 0.4 ? colors.warning :
                      "#f87171";

  const validationBg     = isCorrect === true  ? colors.primary + "20" :
                           isCorrect === false ? "#f8717120" :
                                                colors.secondary;
  const validationBorder = isCorrect === true  ? colors.primary + "55" :
                           isCorrect === false ? "#f8717155" :
                                                colors.border;
  const validationColor  = isCorrect === true  ? colors.primary :
                           isCorrect === false ? "#f87171" :
                                                colors.mutedForeground;

  const holdSecsRemaining = ((1 - holdProgress) * 3).toFixed(1);
  const showHoldBar = isCorrect === true && !isConfirmed && holdProgress > 0;

  const fsmIdx = FSM_STEPS.indexOf(fsmState as (typeof FSM_STEPS)[number]);

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
          { backgroundColor: colors.background, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
        ]}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {prayerName || "Prayer"} — Live Detection
          </Text>
          <TouchableOpacity
            onPress={onCancel}
            style={[styles.iconBtn, { backgroundColor: colors.secondary }]}
          >
            <Feather name="x" size={18} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* ── Position circle ─────────────────────────────────────────────── */}
        <View style={styles.centerSection}>
          <Animated.View
            style={[
              styles.positionCircle,
              {
                backgroundColor: positionColor + "18",
                borderColor:     positionColor + "55",
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <View style={[styles.positionInner, { backgroundColor: positionColor + "30" }]}>
              <Feather name={POSITION_ICONS[position] as any} size={32} color={positionColor} />
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

        {/* ── Posture validation card ─────────────────────────────────────── */}
        <View style={[styles.validationCard, { backgroundColor: validationBg, borderColor: validationBorder }]}>
          <View style={styles.validationRow}>
            <Feather
              name={
                isCorrect === true  ? (isConfirmed ? "check-circle" : "clock") :
                isCorrect === false ? "alert-triangle" :
                                      "target"
              }
              size={18}
              color={validationColor}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.validationTitle, { color: colors.mutedForeground }]}>
                {isCorrect === true && !isConfirmed && showHoldBar
                  ? `Hold still… ${holdSecsRemaining}s`
                  : isConfirmed
                  ? "Posture confirmed"
                  : isCorrect === false
                  ? "Adjust posture"
                  : "Expected posture"}
              </Text>
              <Text style={[styles.validationPosition, { color: validationColor }]}>
                {POSITION_LABELS[expectedPos]}
              </Text>
            </View>
            <View>
              <Text style={[styles.nextLabel, { color: colors.mutedForeground }]}>Next</Text>
              <Text style={[styles.nextPosition, { color: colors.mutedForeground }]}>
                {nextExpected === "RUKU"     ? "Ruku" :
                 nextExpected === "STANDING" ? "Stand" :
                 nextExpected === "SUJOOD"   ? "Sujood" :
                 nextExpected === "SITTING"  ? "Sit" : "—"}
              </Text>
            </View>
          </View>

          {/* 3-second hold progress bar */}
          {showHoldBar && (
            <View style={[styles.holdTrack, { backgroundColor: colors.primary + "25" }]}>
              <Animated.View
                style={[
                  styles.holdFill,
                  {
                    backgroundColor: colors.primary,
                    width: holdAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0%", "100%"],
                    }),
                  },
                ]}
              />
            </View>
          )}

          <Text style={[styles.validationGuide, { color: colors.mutedForeground }]}>
            {POSITION_GUIDE[expectedPos]}
          </Text>
        </View>

        {/* ── Quality bars ─────────────────────────────────────────────────── */}
        <View style={[styles.qualityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.qualityRow}>
            <Text style={[styles.qualityLabel, { color: colors.mutedForeground }]}>Match confidence</Text>
            <Text style={[styles.qualityPct, { color: colors.primary }]}>{Math.round(confidence * 100)}%</Text>
          </View>
          <View style={[styles.barTrack, { backgroundColor: colors.secondary }]}>
            <Animated.View
              style={[styles.barFill, {
                backgroundColor: colors.primary,
                width: confAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
              }]}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.qualityRow}>
            <Text style={[styles.qualityLabel, { color: colors.mutedForeground }]}>Phone stability</Text>
            <Text style={[styles.qualityPct, { color: stabilityColor }]}>{Math.round(stability * 100)}%</Text>
          </View>
          <View style={[styles.barTrack, { backgroundColor: colors.secondary }]}>
            <Animated.View
              style={[styles.barFill, {
                backgroundColor: stabilityColor,
                width: stabAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
              }]}
            />
          </View>

          {stability < 0.4 && (
            <Text style={[styles.stabilityHint, { color: colors.warning }]}>
              Hold still — stabilizing…
            </Text>
          )}
        </View>

        {/* ── FSM step dots ─────────────────────────────────────────────────── */}
        <View style={styles.fsmRow}>
          {FSM_STEPS.map((step, i) => {
            const isPast    = i < fsmIdx;
            const isCurrent = i === fsmIdx;
            return (
              <React.Fragment key={step}>
                {i > 0 && (
                  <View style={[styles.fsmLine, { backgroundColor: isPast ? colors.primary : colors.border }]} />
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
                        transform: [{ scale: isCurrent ? 1.3 : 1 }],
                      },
                    ]}
                  />
                  {isCurrent && (
                    <Text style={[styles.fsmStepLabel, { color: colors.primary }]} numberOfLines={1}>
                      {FSM_LABELS[step]}
                    </Text>
                  )}
                </View>
              </React.Fragment>
            );
          })}
        </View>

        {/* ── Rak'aat counter ─────────────────────────────────────────────── */}
        <View style={[styles.rakaatCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.rakaatNumber, { color: colors.foreground }]}>
            {rakaatCount}
            <Text style={[styles.rakaatTotal, { color: colors.mutedForeground }]}>
              /{expectedRakaat}
            </Text>
          </Text>
          <Text style={[styles.rakaatLabel, { color: colors.mutedForeground }]}>Rak'aat completed</Text>
          <View style={styles.progressDots}>
            {Array.from({ length: expectedRakaat }).map((_, i) => (
              <View
                key={i}
                style={[styles.dot, { backgroundColor: i < rakaatCount ? colors.primary : colors.border }]}
              />
            ))}
          </View>
        </View>

        {/* ── Event log ────────────────────────────────────────────────────── */}
        {events.length > 0 && (
          <View style={styles.eventLog}>
            {events.map((evt, i) => (
              <Text
                key={i}
                style={[styles.eventText, { color: i === 0 ? colors.primary : colors.mutedForeground, opacity: 1 - i * 0.3 }]}
              >
                ✓ {evt}
              </Text>
            ))}
          </View>
        )}

        {/* ── Buttons ──────────────────────────────────────────────────────── */}
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
            <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Short vibration = confirmed · Long repeated = adjust posture
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  title:  { fontSize: 17, fontWeight: "700", flex: 1, marginRight: 12 },
  iconBtn:{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },

  centerSection: { alignItems: "center", marginBottom: 12 },
  positionCircle:{ width: 112, height: 112, borderRadius: 56, borderWidth: 2, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  positionInner: { width: 70, height: 70, borderRadius: 35, alignItems: "center", justifyContent: "center" },
  positionLabel: { fontSize: 14, fontWeight: "600" },
  webNote:       { fontSize: 11, marginTop: 6, textAlign: "center" },

  // Validation card
  validationCard: { borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 10, gap: 6 },
  validationRow:  { flexDirection: "row", alignItems: "center", gap: 10 },
  validationTitle:{ fontSize: 11, fontWeight: "600" },
  validationPosition: { fontSize: 14, fontWeight: "700" },
  validationGuide:{ fontSize: 11, lineHeight: 15, paddingLeft: 28 },
  nextLabel:      { fontSize: 10, textAlign: "right" },
  nextPosition:   { fontSize: 12, fontWeight: "600", textAlign: "right" },

  // 3-second hold bar
  holdTrack: { height: 6, borderRadius: 3, overflow: "hidden", marginTop: 2 },
  holdFill:  { height: 6, borderRadius: 3 },

  // Quality bars
  qualityCard:  { borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 10 },
  qualityRow:   { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  qualityLabel: { fontSize: 11, fontWeight: "500" },
  qualityPct:   { fontSize: 11, fontWeight: "700" },
  barTrack:     { height: 5, borderRadius: 3, overflow: "hidden", marginBottom: 2 },
  barFill:      { height: 5, borderRadius: 3 },
  divider:      { height: 1, marginVertical: 8 },
  stabilityHint:{ fontSize: 10, marginTop: 4, textAlign: "center" },

  // FSM
  fsmRow:      { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 10, paddingBottom: 22, overflow: "visible" },
  fsmStep:     { alignItems: "center", overflow: "visible" },
  fsmDot:      { width: 10, height: 10, borderRadius: 5 },
  fsmLine:     { flex: 1, height: 2, marginHorizontal: 2 },
  fsmStepLabel:{ fontSize: 9, fontWeight: "600", marginTop: 3, position: "absolute", top: 14, width: 56, textAlign: "center" },

  // Rak'aat
  rakaatCard:   { borderRadius: 14, borderWidth: 1, padding: 12, alignItems: "center", marginBottom: 10 },
  rakaatNumber: { fontSize: 42, fontWeight: "700", lineHeight: 50 },
  rakaatTotal:  { fontSize: 22 },
  rakaatLabel:  { fontSize: 11, marginBottom: 7 },
  progressDots: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  dot:          { width: 10, height: 10, borderRadius: 5 },

  // Events
  eventLog:  { alignItems: "center", marginBottom: 8, gap: 2 },
  eventText: { fontSize: 12, fontWeight: "500" },

  // Buttons
  buttons:      { gap: 8 },
  completeBtn:  { borderRadius: 14, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  completeBtnText: { fontSize: 16, fontWeight: "700" },
  cancelButton: { borderRadius: 14, paddingVertical: 12, borderWidth: 1, alignItems: "center" },
  cancelBtnText:{ fontSize: 14, fontWeight: "500" },

  hint: { textAlign: "center", fontSize: 10, marginTop: 8, lineHeight: 15 },
});
