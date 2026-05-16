/**
 * AzkarReminderBubble — Messenger-style floating bubble for daily azkar reminders.
 *
 * Behaviour:
 *  • Appears as a draggable circular icon when the morning/evening reminder fires
 *  • Tap           → opens the azkar page as a slide-up modal (full features)
 *  • Drag          → move freely around the screen
 *  • Release drag  → snaps to the nearest left/right edge
 *  • Drag to bottom dismiss zone → red circle grows → release to close
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef } from "react";
import { Dimensions, Platform, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { useAzkar } from "@/context/AzkarContext";

const BUBBLE_SIZE  = 64;
const EDGE_PAD     = 14;
const DISMISS_H    = 130;   // height of the bottom dismiss zone

const { width: W, height: H } = Dimensions.get("window");

export function AzkarReminderBubble() {
  if (Platform.OS === "web") return null;

  const { bubbleVisible, bubbleType, dismissBubble } = useAzkar();

  // ── Shared values (all on the UI thread) ──────────────────────────────────
  const x              = useSharedValue(W - BUBBLE_SIZE - EDGE_PAD);
  const y              = useSharedValue(H * 0.38);
  const bubbleScale    = useSharedValue(0);
  const dismissOpacity = useSharedValue(0);
  const dismissScale   = useSharedValue(1);
  const inZone         = useSharedValue(false);
  const pulseScale     = useSharedValue(1);

  // ── Mount / unmount animation ─────────────────────────────────────────────
  useEffect(() => {
    if (bubbleVisible) {
      // Reset position to right-center
      x.value = W - BUBBLE_SIZE - EDGE_PAD;
      y.value = H * 0.38;
      inZone.value = false;
      // Pop in
      bubbleScale.value = withSpring(1, { damping: 10, stiffness: 180 });
      // Gentle pulse (3 times) to draw attention
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 550 }),
          withTiming(1.00, { duration: 550 })
        ),
        3,
        false
      );
    } else {
      bubbleScale.value = withTiming(0, { duration: 180 });
    }
  }, [bubbleVisible]);

  // ── Helpers (called on JS thread via runOnJS) ─────────────────────────────
  const doOpen = useCallback(() => {
    const path = bubbleType === "morning" ? "/azkar-morning" : "/azkar-evening";
    router.push(path as any);
  }, [bubbleType]);

  const doDismiss = useCallback(() => {
    dismissBubble();
  }, [dismissBubble]);

  // ── Worklet helpers ───────────────────────────────────────────────────────
  function snapToEdge() {
    "worklet";
    const cx = x.value + BUBBLE_SIZE / 2;
    x.value = withSpring(
      cx < W / 2 ? EDGE_PAD : W - BUBBLE_SIZE - EDGE_PAD,
      { damping: 14, stiffness: 120 }
    );
  }

  function updateDismissZone(curY: number) {
    "worklet";
    const entering = curY + BUBBLE_SIZE > H - DISMISS_H;
    if (entering !== inZone.value) {
      inZone.value = entering;
      dismissScale.value = withSpring(entering ? 1.25 : 1, { damping: 10 });
    }
  }

  // ── Gestures ──────────────────────────────────────────────────────────────
  const pan = Gesture.Pan()
    .minDistance(8)
    .onBegin(() => {
      bubbleScale.value  = withSpring(0.88, { damping: 14 });
      dismissOpacity.value = withTiming(1, { duration: 180 });
    })
    .onUpdate((e) => {
      x.value = e.absoluteX - BUBBLE_SIZE / 2;
      y.value = e.absoluteY - BUBBLE_SIZE / 2;
      updateDismissZone(e.absoluteY - BUBBLE_SIZE / 2);
    })
    .onEnd(() => {
      bubbleScale.value    = withSpring(1, { damping: 12 });
      dismissOpacity.value = withTiming(0, { duration: 220 });

      if (inZone.value) {
        inZone.value = false;
        runOnJS(doDismiss)();
      } else {
        snapToEdge();
      }
    });

  const tap = Gesture.Tap()
    .onEnd(() => {
      runOnJS(doOpen)();
    });

  // Race: tap wins if no drag, pan wins if moved ≥ 8 px
  const gesture = Gesture.Race(tap, pan);

  // ── Animated styles ───────────────────────────────────────────────────────
  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: bubbleScale.value * pulseScale.value },
    ],
  }));

  const dismissZoneStyle = useAnimatedStyle(() => ({
    opacity: dismissOpacity.value,
  }));

  const dismissCircleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dismissScale.value }],
    backgroundColor: inZone.value ? "#ef444435" : "#ef444418",
    borderColor:     inZone.value ? "#ef4444cc" : "#ef444460",
  }));

  const isMorning = bubbleType === "morning";
  const bgColor   = isMorning ? "#f59e0b" : "#8b5cf6";
  const icon      = isMorning ? "weather-sunny" : "weather-night";

  return (
    <>
      {/* ── Bottom dismiss zone (decorative — pointerEvents=none) ─────────── */}
      <Animated.View style={[styles.dismissZone, dismissZoneStyle]} pointerEvents="none">
        <Animated.View style={[styles.dismissCircle, dismissCircleStyle]}>
          <MaterialCommunityIcons name="close" size={24} color="#ef4444" />
        </Animated.View>
        <Text style={styles.dismissLabel}>Drag here to close</Text>
      </Animated.View>

      {/* ── Floating bubble ───────────────────────────────────────────────── */}
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[
            styles.bubble,
            { backgroundColor: bgColor, shadowColor: bgColor },
            bubbleStyle,
          ]}
          pointerEvents={bubbleVisible ? "auto" : "none"}
        >
          <MaterialCommunityIcons name={icon} size={30} color="#fff" />
          {/* Small notification dot */}
          <View style={[styles.dot, { backgroundColor: isMorning ? "#fef3c7" : "#ede9fe" }]} />
        </Animated.View>
      </GestureDetector>
    </>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position:      "absolute",
    top:           0,
    left:          0,
    width:         BUBBLE_SIZE,
    height:        BUBBLE_SIZE,
    borderRadius:  BUBBLE_SIZE / 2,
    alignItems:    "center",
    justifyContent:"center",
    elevation:     24,
    shadowOffset:  { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius:  10,
    zIndex:        1001,
  },
  dot: {
    position:     "absolute",
    top:          7,
    right:        7,
    width:        11,
    height:       11,
    borderRadius: 6,
    borderWidth:  1.5,
    borderColor:  "rgba(255,255,255,0.6)",
  },

  dismissZone: {
    position:       "absolute",
    bottom:         0,
    left:           0,
    right:          0,
    height:         DISMISS_H + 30,
    alignItems:     "center",
    justifyContent: "center",
    paddingBottom:  18,
    zIndex:         1000,
  },
  dismissCircle: {
    width:         60,
    height:        60,
    borderRadius:  30,
    alignItems:    "center",
    justifyContent:"center",
    borderWidth:   2,
    marginBottom:  8,
  },
  dismissLabel: {
    fontSize:   11,
    fontWeight: "600",
    color:      "#ef4444",
    letterSpacing: 0.3,
  },
});
