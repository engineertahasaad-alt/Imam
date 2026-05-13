import { Feather } from "@expo/vector-icons";
import { Accelerometer, Gyroscope } from "expo-sensors";
import * as Speech from "expo-speech";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import {
  buildImprovedCalibration,
  extractFeatures,
  scoreSession,
} from "@/lib/trainingEngine";
import { saveCalibration } from "@/lib/storage";
import {
  clearTrainingSessions,
  getSessionCount,
  getTrainingSessions,
  MovementFeatures,
  RawSample,
  saveTrainingSession,
  SessionQuality,
  TrainingSession,
} from "@/lib/trainingStorage";

interface Props {
  visible: boolean;
  pocketSide?: "left" | "right" | "unknown";
  onClose: () => void;
  onCalibrationImproved?: () => void;
}

type Phase = "intro" | "countdown" | "step" | "transition" | "analysis" | "result";

interface TrainingStep {
  label: MovementFeatures["label"];
  arabic: string;
  english: string;
  instruction: string;
  icon: string;
  recordMs: number;
  pauseBeforeMs: number;
}

const STEPS: TrainingStep[] = [
  {
    label:         "STANDING",
    arabic:        "قف ثابتًا",
    english:       "Stand Still",
    instruction:   "Stand upright with phone in pocket",
    icon:          "arrow-up",
    recordMs:      4500,
    pauseBeforeMs: 2500,
  },
  {
    label:         "RUKU",
    arabic:        "اركع الآن",
    english:       "Bow Down",
    instruction:   "Bow forward at the waist (Ruku)",
    icon:          "chevrons-down",
    recordMs:      4500,
    pauseBeforeMs: 3000,
  },
  {
    label:         "SUJOOD",
    arabic:        "اسجد",
    english:       "Prostrate",
    instruction:   "Forehead to the ground (Sujood)",
    icon:          "minus",
    recordMs:      4500,
    pauseBeforeMs: 3500,
  },
  {
    label:         "SITTING",
    arabic:        "اجلس",
    english:       "Sit",
    instruction:   "Sit between the two prostrations",
    icon:          "minus-circle",
    recordMs:      3500,
    pauseBeforeMs: 3000,
  },
];

const QUALITY_CONFIG: Record<SessionQuality, { label: string; color: string; icon: string; hint: string }> = {
  excellent: { label: "Excellent",  color: "#22c55e", icon: "award",         hint: "Great data captured. Detection will improve significantly." },
  good:      { label: "Good",       color: "#3b82f6", icon: "thumbs-up",     hint: "Good session. Detection will improve over time." },
  weak:      { label: "Weak",       color: "#f59e0b", icon: "alert-triangle", hint: "Low motion stability. Try again in a quieter spot." },
  noisy:     { label: "Noisy",      color: "#f87171", icon: "x-circle",      hint: "Too much interference. Session not applied." },
};

async function speak(text: string, lang = "ar") {
  try {
    Speech.stop();
    await Speech.speak(text, { language: lang, rate: 0.85 });
  } catch {
    // Speech unavailable — silently continue
  }
}

export function TrainingModal({
  visible,
  pocketSide = "unknown",
  onClose,
  onCalibrationImproved,
}: Props) {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();

  const [phase, setPhase]               = useState<Phase>("intro");
  const [stepIdx, setStepIdx]           = useState(0);
  const [countdown, setCountdown]       = useState(3);
  const [recordProgress, setRecordProgress] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [lastSession, setLastSession]   = useState<TrainingSession | null>(null);
  const [applied, setApplied]           = useState(false);

  const samplesRef      = useRef<RawSample[][]>([[], [], [], []]);
  const accelRef        = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });
  const gyroRef         = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });
  const accelSubRef     = useRef<any>(null);
  const gyroSubRef      = useRef<any>(null);
  const isRecordingRef  = useRef(false);
  const activeStepRef   = useRef(0);
  const timerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // ── Pulse animation ───────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "step") { pulseAnim.setValue(1); return; }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.10, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [phase]);

  // ── Load session count ────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      getSessionCount().then(setSessionCount);
      reset();
    }
    return () => {
      stopSensors();
      clearTimers();
      Speech.stop().catch(() => {});
    };
  }, [visible]);

  function reset() {
    setPhase("intro");
    setStepIdx(0);
    setCountdown(3);
    setRecordProgress(0);
    setLastSession(null);
    setApplied(false);
    samplesRef.current = [[], [], [], []];
    isRecordingRef.current = false;
    activeStepRef.current  = 0;
    progressAnim.setValue(0);
  }

  function clearTimers() {
    if (timerRef.current)    { clearTimeout(timerRef.current);    timerRef.current    = null; }
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }

  // ── Sensor management ─────────────────────────────────────────────────────

  function startSensors() {
    if (Platform.OS === "web") return;
    Accelerometer.setUpdateInterval(80);
    Gyroscope.setUpdateInterval(80);

    accelSubRef.current = Accelerometer.addListener(({ x, y, z }) => {
      accelRef.current = { x, y, z };
      if (isRecordingRef.current) {
        samplesRef.current[activeStepRef.current].push({
          ts: Date.now(),
          ax: x, ay: y, az: z,
          gx: gyroRef.current.x, gy: gyroRef.current.y, gz: gyroRef.current.z,
        });
      }
    });

    gyroSubRef.current = Gyroscope.addListener(({ x, y, z }) => {
      gyroRef.current = { x, y, z };
    });
  }

  function stopSensors() {
    accelSubRef.current?.remove();  accelSubRef.current = null;
    gyroSubRef.current?.remove();   gyroSubRef.current  = null;
    isRecordingRef.current = false;
  }

  // ── Training sequence ─────────────────────────────────────────────────────

  function startTraining() {
    samplesRef.current = [[], [], [], []];
    setPhase("countdown");
    setCountdown(3);
    speak("استعد", "ar");
    startSensors();
    runCountdown(3, () => runStep(0));
  }

  function runCountdown(from: number, onDone: () => void) {
    setCountdown(from);
    if (from <= 0) { onDone(); return; }
    timerRef.current = setTimeout(() => runCountdown(from - 1, onDone), 1000);
  }

  const runStep = useCallback((idx: number) => {
    if (idx >= STEPS.length) { finishTraining(); return; }

    const step = STEPS[idx];
    activeStepRef.current  = idx;
    isRecordingRef.current = false;

    setPhase("transition");
    setStepIdx(idx);
    speak(step.arabic, "ar");

    timerRef.current = setTimeout(() => {
      // Start recording
      isRecordingRef.current = true;
      setPhase("step");
      setRecordProgress(0);

      const startedAt  = Date.now();
      intervalRef.current = setInterval(() => {
        const pct = Math.min(1, (Date.now() - startedAt) / step.recordMs);
        setRecordProgress(pct);
        Animated.timing(progressAnim, { toValue: pct, duration: 100, useNativeDriver: false }).start();
        if (pct >= 1) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
        }
      }, 100);

      timerRef.current = setTimeout(() => {
        isRecordingRef.current = false;
        runStep(idx + 1);
      }, step.recordMs);

    }, step.pauseBeforeMs);
  }, []);

  async function finishTraining() {
    stopSensors();
    clearTimers();
    setPhase("analysis");
    Speech.stop().catch(() => {});

    await new Promise(r => setTimeout(r, 1200));

    const features: MovementFeatures[] = STEPS.map((step, i) =>
      extractFeatures(samplesRef.current[i], step.label)
    );

    const { score, quality } = scoreSession(features);

    const session: TrainingSession = {
      id:              `training_${Date.now()}`,
      timestamp:       Date.now(),
      quality,
      qualityScore:    score,
      features,
      sessionDurationMs: STEPS.reduce((a, s) => a + s.recordMs + s.pauseBeforeMs, 0),
    };

    await saveTrainingSession(session);
    setLastSession(session);
    setSessionCount(prev => prev + 1);
    setPhase("result");

    if (quality === "excellent" || quality === "good") {
      speak("ممتاز", "ar");
    }
  }

  async function applyImprovements() {
    const sessions = await getTrainingSessions();
    const improved = buildImprovedCalibration(sessions, pocketSide);
    if (improved) {
      await saveCalibration(improved);
      onCalibrationImproved?.();
    }
    setApplied(true);
  }

  async function handleResetData() {
    await clearTrainingSessions();
    setSessionCount(0);
    reset();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const currentStep = STEPS[stepIdx] ?? STEPS[0];
  const qConfig     = lastSession ? QUALITY_CONFIG[lastSession.quality] : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
        ]}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>
              Voice Training Mode
            </Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              {sessionCount > 0
                ? `${sessionCount} session${sessionCount !== 1 ? "s" : ""} recorded`
                : "No sessions yet"}
            </Text>
          </View>
          {(phase === "intro" || phase === "result") && (
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.secondary }]}
              onPress={onClose}
            >
              <Feather name="x" size={18} color={colors.foreground} />
            </TouchableOpacity>
          )}
        </View>

        {/* ════════════════════════════════════════════════════════════════
            INTRO PHASE
        ════════════════════════════════════════════════════════════════ */}
        {phase === "intro" && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="info" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoTitle, { color: colors.foreground }]}>
                  How it works
                </Text>
                <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                  The app will guide you through 4 prayer positions using Arabic voice prompts.
                  Sensor data is recorded locally and used to improve detection accuracy — no internet required.
                </Text>
              </View>
            </View>

            {[
              { icon: "volume-2", label: "Arabic voice prompts guide you" },
              { icon: "cpu",      label: "Sensor data recorded per position" },
              { icon: "bar-chart-2", label: "Session quality scored automatically" },
              { icon: "trending-up", label: "Multiple sessions improve accuracy" },
            ].map((item) => (
              <View key={item.label} style={[styles.featureRow, { borderColor: colors.border }]}>
                <View style={[styles.featureIcon, { backgroundColor: colors.primary + "18" }]}>
                  <Feather name={item.icon as any} size={16} color={colors.primary} />
                </View>
                <Text style={[styles.featureLabel, { color: colors.foreground }]}>{item.label}</Text>
              </View>
            ))}

            <View style={[styles.stepsPreview, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.stepsPreviewTitle, { color: colors.mutedForeground }]}>
                SEQUENCE
              </Text>
              {STEPS.map((step, i) => (
                <View key={step.label} style={styles.stepPreviewRow}>
                  <View style={[styles.stepPreviewNum, { backgroundColor: colors.primary + "20" }]}>
                    <Text style={[styles.stepPreviewNumText, { color: colors.primary }]}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.stepPreviewArabic, { color: colors.foreground }]}>{step.arabic}</Text>
                  <Text style={[styles.stepPreviewEn, { color: colors.mutedForeground }]}>{step.english}</Text>
                </View>
              ))}
            </View>

            {Platform.OS === "web" && (
              <View style={[styles.webNote, { backgroundColor: colors.warning + "18", borderColor: colors.warning + "44" }]}>
                <Feather name="alert-triangle" size={14} color={colors.warning} />
                <Text style={[styles.webNoteText, { color: colors.warning }]}>
                  Voice prompts and sensor recording require a physical device.
                  This session will run in text-only mode on web.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
              onPress={startTraining}
            >
              <Feather name="mic" size={20} color={colors.primaryForeground} />
              <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
                Start Training
              </Text>
            </TouchableOpacity>

            {sessionCount > 0 && (
              <TouchableOpacity
                style={[styles.dangerBtn, { borderColor: colors.destructive + "44" }]}
                onPress={handleResetData}
              >
                <Feather name="trash-2" size={15} color={colors.destructive} />
                <Text style={[styles.dangerBtnText, { color: colors.destructive }]}>
                  Reset All Training Data
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}

        {/* ════════════════════════════════════════════════════════════════
            COUNTDOWN PHASE
        ════════════════════════════════════════════════════════════════ */}
        {phase === "countdown" && (
          <View style={styles.centeredPhase}>
            <Text style={[styles.arabicBig, { color: colors.primary }]}>استعد</Text>
            <Text style={[styles.englishSub, { color: colors.mutedForeground }]}>Get Ready</Text>
            <View style={[styles.countdownCircle, { borderColor: colors.primary + "55", backgroundColor: colors.primary + "12" }]}>
              <Text style={[styles.countdownNum, { color: colors.primary }]}>{countdown}</Text>
            </View>
            <Text style={[styles.centeredHint, { color: colors.mutedForeground }]}>
              Place your phone in your pocket now
            </Text>
          </View>
        )}

        {/* ════════════════════════════════════════════════════════════════
            TRANSITION PHASE (between steps)
        ════════════════════════════════════════════════════════════════ */}
        {phase === "transition" && (
          <View style={styles.centeredPhase}>
            <Text style={[styles.stepCounter, { color: colors.mutedForeground }]}>
              Step {stepIdx + 1} of {STEPS.length}
            </Text>
            <Text style={[styles.arabicBig, { color: colors.primary }]}>{currentStep.arabic}</Text>
            <Text style={[styles.englishSub, { color: colors.mutedForeground }]}>{currentStep.english}</Text>
            <View style={[styles.iconCircle, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "44" }]}>
              <Feather name={currentStep.icon as any} size={40} color={colors.primary} />
            </View>
            <Text style={[styles.centeredHint, { color: colors.mutedForeground }]}>
              {currentStep.instruction}
            </Text>
          </View>
        )}

        {/* ════════════════════════════════════════════════════════════════
            RECORDING PHASE
        ════════════════════════════════════════════════════════════════ */}
        {phase === "step" && (
          <View style={styles.centeredPhase}>
            <Text style={[styles.stepCounter, { color: colors.mutedForeground }]}>
              Recording {stepIdx + 1} / {STEPS.length}
            </Text>
            <Animated.View
              style={[
                styles.iconCircle,
                {
                  backgroundColor: colors.primary + "18",
                  borderColor:     colors.primary + "66",
                  transform:       [{ scale: pulseAnim }],
                },
              ]}
            >
              <Feather name={currentStep.icon as any} size={40} color={colors.primary} />
            </Animated.View>
            <Text style={[styles.arabicBig, { color: colors.primary }]}>{currentStep.arabic}</Text>
            <Text style={[styles.englishSub, { color: colors.mutedForeground }]}>{currentStep.english}</Text>

            {/* Recording progress bar */}
            <View style={[styles.progressTrack, { backgroundColor: colors.secondary }]}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: colors.primary,
                    width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
                  },
                ]}
              />
            </View>
            <Text style={[styles.recordingLabel, { color: colors.primary }]}>Recording…</Text>
            <Text style={[styles.centeredHint, { color: colors.mutedForeground }]}>
              Hold this position still
            </Text>
          </View>
        )}

        {/* ════════════════════════════════════════════════════════════════
            ANALYSIS PHASE
        ════════════════════════════════════════════════════════════════ */}
        {phase === "analysis" && (
          <View style={styles.centeredPhase}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "44" }]}>
              <Feather name="cpu" size={40} color={colors.primary} />
            </View>
            <Text style={[styles.arabicBig, { color: colors.primary }]}>تحليل…</Text>
            <Text style={[styles.englishSub, { color: colors.mutedForeground }]}>Analyzing session</Text>
            <Text style={[styles.centeredHint, { color: colors.mutedForeground }]}>
              Extracting motion features & scoring quality
            </Text>
          </View>
        )}

        {/* ════════════════════════════════════════════════════════════════
            RESULT PHASE
        ════════════════════════════════════════════════════════════════ */}
        {phase === "result" && lastSession && qConfig && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {/* Quality badge */}
            <View style={[styles.qualityCard, { backgroundColor: qConfig.color + "15", borderColor: qConfig.color + "44" }]}>
              <Feather name={qConfig.icon as any} size={28} color={qConfig.color} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.qualityTitle, { color: qConfig.color }]}>
                  {qConfig.label} Session
                </Text>
                <Text style={[styles.qualityHint, { color: colors.mutedForeground }]}>{qConfig.hint}</Text>
              </View>
            </View>

            {/* Score bar */}
            <View style={[styles.scoreCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.scoreRow}>
                <Text style={[styles.scoreLabel, { color: colors.mutedForeground }]}>Session Score</Text>
                <Text style={[styles.scoreValue, { color: colors.foreground }]}>
                  {Math.round(lastSession.qualityScore * 100)}%
                </Text>
              </View>
              <View style={[styles.scoreTrack, { backgroundColor: colors.secondary }]}>
                <View
                  style={[
                    styles.scoreFill,
                    { backgroundColor: qConfig.color, width: `${Math.round(lastSession.qualityScore * 100)}%` },
                  ]}
                />
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <Text style={[styles.positionsTitle, { color: colors.mutedForeground }]}>
                POSITIONS CAPTURED
              </Text>
              {lastSession.features.map((f) => (
                <View key={f.label} style={styles.positionRow}>
                  <View
                    style={[
                      styles.positionDot,
                      { backgroundColor: f.sampleCount >= 10 ? colors.primary : colors.border },
                    ]}
                  />
                  <Text style={[styles.positionName, { color: colors.foreground }]}>{f.label}</Text>
                  <Text style={[styles.positionStat, { color: colors.mutedForeground }]}>
                    {f.sampleCount} samples · {Math.round(f.stabilityScore * 100)}% stable
                  </Text>
                </View>
              ))}
            </View>

            <Text style={[styles.sessionTotal, { color: colors.mutedForeground }]}>
              Total sessions: {sessionCount}
            </Text>

            {/* Action buttons */}
            {!applied && lastSession.quality !== "noisy" && (
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                onPress={applyImprovements}
              >
                <Feather name="zap" size={18} color={colors.primaryForeground} />
                <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
                  Apply Improvements
                </Text>
              </TouchableOpacity>
            )}

            {applied && (
              <View style={[styles.appliedBanner, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "44" }]}>
                <Feather name="check-circle" size={16} color={colors.primary} />
                <Text style={[styles.appliedText, { color: colors.primary }]}>
                  Detection improved! New calibration applied.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={startTraining}
            >
              <Feather name="refresh-cw" size={16} color={colors.foreground} />
              <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>Train Again</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={() => {
                reset();
                getSessionCount().then(setSessionCount);
              }}
            >
              <Feather name="plus-circle" size={16} color={colors.foreground} />
              <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>Add More Samples</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dangerBtn, { borderColor: colors.destructive + "44" }]}
              onPress={handleResetData}
            >
              <Feather name="trash-2" size={15} color={colors.destructive} />
              <Text style={[styles.dangerBtnText, { color: colors.destructive }]}>Reset Training Data</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, paddingHorizontal: 20 },
  scroll:      { gap: 14, paddingBottom: 20 },

  header:      { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  headerSub:   { fontSize: 12, marginTop: 2 },
  iconBtn:     { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },

  // Centered phases
  centeredPhase: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  stepCounter:   { fontSize: 12, fontWeight: "600" },
  arabicBig:     { fontSize: 34, fontWeight: "700" },
  englishSub:    { fontSize: 16 },
  centeredHint:  { fontSize: 13, textAlign: "center", paddingHorizontal: 24, lineHeight: 20 },
  recordingLabel:{ fontSize: 13, fontWeight: "600" },

  countdownCircle: {
    width: 100, height: 100, borderRadius: 50, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  countdownNum: { fontSize: 48, fontWeight: "700" },

  iconCircle: {
    width: 110, height: 110, borderRadius: 55, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },

  progressTrack: { width: "80%", height: 8, borderRadius: 4, overflow: "hidden", marginTop: 4 },
  progressFill:  { height: 8, borderRadius: 4 },

  // Intro
  infoCard:    { borderRadius: 14, borderWidth: 1, padding: 14, flexDirection: "row", gap: 12 },
  infoTitle:   { fontSize: 14, fontWeight: "600", marginBottom: 4 },
  infoText:    { fontSize: 13, lineHeight: 19 },

  featureRow:  { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  featureIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  featureLabel:{ fontSize: 14 },

  stepsPreview:      { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  stepsPreviewTitle: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
  stepPreviewRow:    { flexDirection: "row", alignItems: "center", gap: 12 },
  stepPreviewNum:    { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  stepPreviewNumText:{ fontSize: 12, fontWeight: "700" },
  stepPreviewArabic: { fontSize: 16, fontWeight: "600", flex: 1 },
  stepPreviewEn:     { fontSize: 12 },

  webNote:     { borderRadius: 10, borderWidth: 1, padding: 12, flexDirection: "row", gap: 8, alignItems: "flex-start" },
  webNoteText: { fontSize: 12, flex: 1, lineHeight: 17 },

  primaryBtn:     { borderRadius: 14, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  primaryBtnText: { fontSize: 16, fontWeight: "700" },

  secondaryBtn:     { borderRadius: 14, borderWidth: 1, paddingVertical: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  secondaryBtnText: { fontSize: 15, fontWeight: "500" },

  dangerBtn:     { borderRadius: 14, borderWidth: 1, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  dangerBtnText: { fontSize: 14, fontWeight: "500" },

  // Result
  qualityCard: { borderRadius: 14, borderWidth: 1, padding: 16, flexDirection: "row", gap: 14, alignItems: "center" },
  qualityTitle:{ fontSize: 18, fontWeight: "700" },
  qualityHint: { fontSize: 12, marginTop: 2, lineHeight: 17 },

  scoreCard:    { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  scoreRow:     { flexDirection: "row", justifyContent: "space-between" },
  scoreLabel:   { fontSize: 12, fontWeight: "500" },
  scoreValue:   { fontSize: 14, fontWeight: "700" },
  scoreTrack:   { height: 8, borderRadius: 4, overflow: "hidden" },
  scoreFill:    { height: 8, borderRadius: 4 },
  divider:      { height: 1, marginVertical: 4 },

  positionsTitle: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
  positionRow:    { flexDirection: "row", alignItems: "center", gap: 10 },
  positionDot:    { width: 8, height: 8, borderRadius: 4 },
  positionName:   { fontSize: 13, fontWeight: "600", width: 80 },
  positionStat:   { fontSize: 11, flex: 1 },

  sessionTotal: { fontSize: 12, textAlign: "center" },

  appliedBanner: { borderRadius: 12, borderWidth: 1, padding: 12, flexDirection: "row", gap: 8, alignItems: "center" },
  appliedText:   { fontSize: 13, fontWeight: "600", flex: 1 },
});
