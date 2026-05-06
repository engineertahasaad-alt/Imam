import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { MotionEngine } from "@/lib/motionEngine";
import { CalibrationData } from "@/lib/storage";

interface CalibStep {
  key: keyof Omit<CalibrationData, "calibratedAt" | "pocketSide">;
  label: string;
  instruction: string;
  icon: string;
  color: string;
}

const STEPS: CalibStep[] = [
  {
    key: "standing",
    label: "Standing",
    instruction:
      "Stand upright with your phone in your pocket. Stay still for 3 seconds.",
    icon: "arrow-up",
    color: "#34d399",
  },
  {
    key: "ruku",
    label: "Bowing (Ruku)",
    instruction:
      "Bend forward in Ruku position with your phone in your pocket. Hold for 3 seconds.",
    icon: "chevron-down",
    color: "#60a5fa",
  },
  {
    key: "sujood",
    label: "Prostration (Sujood)",
    instruction:
      "Go into Sujood position with your phone in your pocket. Hold for 3 seconds.",
    icon: "minus",
    color: "#f59e0b",
  },
  {
    key: "sitting",
    label: "Sitting (Tashahud)",
    instruction:
      "Sit in Tashahud position with your phone in your pocket. Hold for 3 seconds.",
    icon: "minus-circle",
    color: "#c084fc",
  },
];

export default function CalibrationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { saveCalibrationData, completeOnboarding, settings } = useApp();

  const [currentStep, setCurrentStep] = useState(0);
  const [stepState, setStepState] = useState<
    "idle" | "recording" | "done"
  >("idle");
  const [recorded, setRecorded] = useState<
    Record<string, [number, number, number]>
  >({});
  const [allDone, setAllDone] = useState(false);

  const engineRef = useRef<MotionEngine | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const RECORD_DURATION = 3000;

  useEffect(() => {
    const engine = new MotionEngine(() => {});
    engineRef.current = engine;
    return () => {
      engine.stopRecording();
      engine.stop();
    };
  }, []);

  function startRecording() {
    if (Platform.OS === "web") {
      handleWebCalibration();
      return;
    }

    setStepState("recording");
    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: RECORD_DURATION,
      useNativeDriver: false,
    }).start();

    engineRef.current?.startRecording(RECORD_DURATION, (avg) => {
      const key = STEPS[currentStep].key;
      setRecorded((prev) => ({ ...prev, [key]: avg }));
      setStepState("done");
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        ).catch(() => {});
      }
    });
  }

  function handleWebCalibration() {
    // Web: simulate calibration with default values
    const key = STEPS[currentStep].key;
    const defaults: Record<string, [number, number, number]> = {
      standing: [0, 0.98, 0.2],
      ruku: [0, 0.5, 0.8],
      sujood: [0, 0.1, 0.99],
      sitting: [0, 0.7, 0.6],
    };
    setStepState("recording");
    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: RECORD_DURATION,
      useNativeDriver: false,
    }).start();

    setTimeout(() => {
      setRecorded((prev) => ({
        ...prev,
        [key]: defaults[key] ?? [0, 0, 1],
      }));
      setStepState("done");
    }, RECORD_DURATION);
  }

  function nextStep() {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
      setStepState("idle");
    } else {
      setAllDone(true);
    }
  }

  async function finishCalibration() {
    const data: CalibrationData = {
      standing: recorded.standing ?? [0, 0.98, 0.2],
      ruku: recorded.ruku ?? [0, 0.5, 0.8],
      sujood: recorded.sujood ?? [0, 0.1, 0.99],
      sitting: recorded.sitting ?? [0, 0.7, 0.6],
      calibratedAt: Date.now(),
      pocketSide: "right",
    };

    await saveCalibrationData(data);
    await completeOnboarding(
      settings.latitude ?? 21.3891,
      settings.longitude ?? 39.8579,
      settings.cityName ?? "Unknown"
    );
    router.replace("/(tabs)");
  }

  async function skipCalibration() {
    await completeOnboarding(
      settings.latitude ?? 21.3891,
      settings.longitude ?? 39.8579,
      settings.cityName ?? "Unknown"
    );
    router.replace("/(tabs)");
  }

  const step = STEPS[currentStep];

  if (allDone) {
    return (
      <View
        style={[
          styles.centered,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20),
          },
        ]}
      >
        <View
          style={[
            styles.successCircle,
            { backgroundColor: colors.primary + "20" },
          ]}
        >
          <Feather name="check-circle" size={60} color={colors.primary} />
        </View>
        <Text style={[styles.successTitle, { color: colors.foreground }]}>
          Calibration Complete!
        </Text>
        <Text style={[styles.successDesc, { color: colors.mutedForeground }]}>
          Your personal motion profile has been saved. Salah Guardian will now
          detect your prayers accurately.
        </Text>

        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: colors.primary }]}
          onPress={finishCalibration}
        >
          <Text
            style={[styles.nextBtnText, { color: colors.primaryForeground }]}
          >
            Start Using App
          </Text>
          <Feather
            name="arrow-right"
            size={20}
            color={colors.primaryForeground}
          />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20),
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 32),
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Progress */}
      <View style={styles.progress}>
        {STEPS.map((s, i) => (
          <View
            key={s.key}
            style={[
              styles.progressSegment,
              {
                backgroundColor:
                  i <= currentStep ? colors.primary : colors.border,
              },
            ]}
          />
        ))}
      </View>

      <Text style={[styles.stepCounter, { color: colors.mutedForeground }]}>
        Step {currentStep + 1} of {STEPS.length}
      </Text>

      {/* Step icon */}
      <View style={styles.iconSection}>
        <View
          style={[
            styles.stepIconCircle,
            { backgroundColor: step.color + "20", borderColor: step.color + "40" },
          ]}
        >
          <Feather name={step.icon as any} size={48} color={step.color} />
        </View>
      </View>

      <Text style={[styles.stepLabel, { color: colors.foreground }]}>
        {step.label}
      </Text>
      <Text style={[styles.instruction, { color: colors.mutedForeground }]}>
        {step.instruction}
      </Text>

      {/* Recording bar */}
      {stepState === "recording" && (
        <View
          style={[
            styles.progressBarBg,
            { backgroundColor: colors.border },
          ]}
        >
          <Animated.View
            style={[
              styles.progressBarFill,
              {
                backgroundColor: step.color,
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                }),
              },
            ]}
          />
        </View>
      )}

      {stepState === "done" && (
        <View
          style={[
            styles.doneChip,
            { backgroundColor: colors.primary + "20" },
          ]}
        >
          <Feather name="check" size={16} color={colors.primary} />
          <Text style={[styles.doneText, { color: colors.primary }]}>
            Recorded!
          </Text>
        </View>
      )}

      {/* Buttons */}
      {stepState === "idle" && (
        <TouchableOpacity
          style={[styles.recordBtn, { backgroundColor: step.color }]}
          onPress={startRecording}
        >
          <Feather name="radio" size={20} color="#fff" />
          <Text style={styles.recordBtnText}>Record Position</Text>
        </TouchableOpacity>
      )}

      {stepState === "recording" && (
        <View style={[styles.recordingIndicator, { borderColor: step.color }]}>
          <Text style={[styles.recordingText, { color: step.color }]}>
            Recording... hold still
          </Text>
        </View>
      )}

      {stepState === "done" && (
        <TouchableOpacity
          style={[styles.nextStepBtn, { backgroundColor: colors.primary }]}
          onPress={nextStep}
        >
          <Text
            style={[styles.nextStepText, { color: colors.primaryForeground }]}
          >
            {currentStep < STEPS.length - 1 ? "Next Position" : "Finish"}
          </Text>
          <Feather
            name="arrow-right"
            size={20}
            color={colors.primaryForeground}
          />
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={skipCalibration} style={styles.skip}>
        <Text style={[styles.skipText, { color: colors.mutedForeground }]}>
          Skip calibration (use defaults)
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    gap: 16,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  progress: {
    flexDirection: "row",
    gap: 6,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  stepCounter: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  iconSection: {
    alignItems: "center",
    marginVertical: 16,
  },
  stepIconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLabel: {
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
  },
  instruction: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  doneChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: "center",
  },
  doneText: {
    fontSize: 14,
    fontWeight: "600",
  },
  recordBtn: {
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 8,
  },
  recordBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  recordingIndicator: {
    borderRadius: 14,
    borderWidth: 2,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  recordingText: {
    fontSize: 15,
    fontWeight: "600",
  },
  nextStepBtn: {
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 8,
  },
  nextStepText: {
    fontSize: 16,
    fontWeight: "700",
  },
  skip: {
    alignItems: "center",
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 13,
  },
  successCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
  },
  successDesc: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  nextBtn: {
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 16,
    paddingHorizontal: 32,
  },
  nextBtnText: {
    fontSize: 17,
    fontWeight: "700",
  },
});
