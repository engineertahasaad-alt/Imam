/**
 * Azkar Floating Widget
 * Isolated component. Renders above all screens but below any Modal (e.g. prayer detection).
 * Uses PanResponder for drag + edge-snapping. Animated slide-in/out from side edge.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useAzkar } from "@/context/AzkarContext";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "@/hooks/useTranslation";

const WIDGET_WIDTH  = 220;
const EDGE_MARGIN   = 8;
const SLIDE_DIST    = WIDGET_WIDTH + EDGE_MARGIN + 4;

const FONT_SIZES = {
  small:  { arabic: 18, roman: 11, translation: 10 },
  medium: { arabic: 22, roman: 12, translation: 11 },
  large:  { arabic: 27, roman: 14, translation: 12 },
};

export function AzkarFloatingWidget() {
  const { settings, currentZikr, widgetVisible, dismissWidget } = useAzkar();
  const colors = useColors();
  const { isArabic } = useTranslation();

  const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

  // Track which side we're snapped to: -1 = left, +1 = right
  const [snapSide, setSnapSide] = useState<-1 | 1>(
    settings.position === "left" ? -1 : 1
  );

  // Sync snap side when settings change
  useEffect(() => {
    setSnapSide(settings.position === "left" ? -1 : 1);
  }, [settings.position]);

  // Animation values
  const slideAnim  = useRef(new Animated.Value(0)).current;  // 0=hidden 1=visible
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const countdownAnim = useRef(new Animated.Value(1)).current;

  // Vertical drag position (starts near center)
  const posY = useRef(SCREEN_H * 0.38);
  const dragY = useRef(new Animated.Value(posY.current)).current;

  // Slide-X position based on side and slide progress
  const translateX = slideAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [
      snapSide === 1 ? SLIDE_DIST : -SLIDE_DIST,
      0,
    ],
  });

  // Re-compute slide direction when snap side changes
  const translateXRef = useRef(translateX);
  translateXRef.current = translateX;

  // useNativeDriver not supported on web
  const nativeDrv = Platform.OS !== "web";

  // Show / hide animation
  useEffect(() => {
    if (widgetVisible && currentZikr) {
      countdownAnim.setValue(1);
      Animated.parallel([
        Animated.spring(slideAnim,   { toValue: 1, useNativeDriver: nativeDrv, tension: 60, friction: 10 }),
        Animated.timing(opacityAnim, { toValue: settings.opacity, duration: 250, useNativeDriver: nativeDrv }),
      ]).start();
      Animated.timing(countdownAnim, {
        toValue: 0,
        duration: settings.displaySeconds * 1000,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim,   { toValue: 0, duration: 220, useNativeDriver: nativeDrv }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: nativeDrv }),
      ]).start();
    }
  }, [widgetVisible, currentZikr]);

  // ── Drag gesture ─────────────────────────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  (_, g) => Math.abs(g.dy) > 4 || Math.abs(g.dx) > 4,

      onPanResponderMove: (_, g) => {
        // Allow vertical drag
        const newY = Math.max(60, Math.min(SCREEN_H - 160, posY.current + g.dy));
        dragY.setValue(newY);
        // Hint at side based on horizontal drag
      },

      onPanResponderRelease: (_, g) => {
        // Commit vertical position
        posY.current = Math.max(60, Math.min(SCREEN_H - 160, posY.current + g.dy));
        dragY.setValue(posY.current);

        // Snap to side based on horizontal position if dragged significantly
        if (Math.abs(g.dx) > 40) {
          setSnapSide(g.moveX < SCREEN_W / 2 ? -1 : 1);
        }
      },
    })
  ).current;

  // Never completely unmount so exit animations can play;
  // block touches when invisible so we don't steal taps from the app
  const fs = FONT_SIZES[settings.fontSize] ?? FONT_SIZES.medium;

  // Horizontal offset from the appropriate edge
  const leftPos  = snapSide === -1 ? EDGE_MARGIN : undefined;
  const rightPos = snapSide === 1  ? EDGE_MARGIN : undefined;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          pointerEvents: widgetVisible ? "auto" : "none",
          opacity:   opacityAnim,
          transform: [{ translateX }, { translateY: dragY as any }],
          left:  leftPos,
          right: rightPos,
          top:   0,
          backgroundColor: colors.card,
          borderColor:     colors.primary + "55",
          shadowColor:     colors.primary,
        },
      ]}
      {...panResponder.panHandlers}
    >
      {/* Header row */}
      <View style={styles.header}>
        <View style={[styles.iconBadge, { backgroundColor: colors.primary + "20" }]}>
          <Text style={styles.moonEmoji}>🤲</Text>
        </View>
        <Text style={[styles.headerLabel, { color: colors.mutedForeground }]}>
          ذكر
        </Text>
        <TouchableOpacity
          onPress={dismissWidget}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={[styles.closeBtn, { backgroundColor: colors.secondary }]}
        >
          <Text style={[styles.closeIcon, { color: colors.mutedForeground }]}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Zikr text — language-aware, no mixed display */}
      {currentZikr && (
        <View style={styles.body}>
          <Text
            style={[styles.arabic, { color: colors.foreground, fontSize: fs.arabic }]}
            textBreakStrategy="highQuality"
          >
            {currentZikr.arabic}
          </Text>
          {!isArabic && currentZikr.translation ? (
            <Text style={[styles.translation, { color: colors.mutedForeground + "bb", fontSize: fs.translation }]}>
              {currentZikr.translation}
            </Text>
          ) : null}
        </View>
      )}

      {/* Countdown bar */}
      <View style={[styles.countdownTrack, { backgroundColor: colors.border }]}>
        <Animated.View
          style={[
            styles.countdownFill,
            {
              backgroundColor: colors.primary,
              width: countdownAnim.interpolate({
                inputRange:  [0, 1],
                outputRange: ["0%", "100%"],
              }),
            },
          ]}
        />
      </View>

      {/* Drag hint */}
      <View style={styles.dragHandle}>
        <View style={[styles.dragDot, { backgroundColor: colors.border }]} />
        <View style={[styles.dragDot, { backgroundColor: colors.border }]} />
        <View style={[styles.dragDot, { backgroundColor: colors.border }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position:     "absolute",
    width:        WIDGET_WIDTH,
    borderRadius: 18,
    borderWidth:  1,
    paddingTop:   10,
    paddingBottom: 8,
    paddingHorizontal: 12,
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius:  12,
    elevation:     12,
    zIndex:        999,
    // Web only: pointerEvents
    ...(Platform.OS === "web" ? { cursor: "grab" } as any : {}),
  },

  header: {
    flexDirection:  "row",
    alignItems:     "center",
    marginBottom:   8,
    gap:            6,
  },
  iconBadge: {
    width:        26,
    height:       26,
    borderRadius: 13,
    alignItems:   "center",
    justifyContent: "center",
  },
  moonEmoji: { fontSize: 13 },
  headerLabel: {
    flex:      1,
    fontSize:  11,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  closeBtn: {
    width:        22,
    height:       22,
    borderRadius: 11,
    alignItems:   "center",
    justifyContent: "center",
  },
  closeIcon: {
    fontSize:   11,
    fontWeight: "700",
    lineHeight: 14,
  },

  body: {
    gap:            5,
    marginBottom:   8,
    alignItems:     "center",
  },
  arabic: {
    textAlign:  "center",
    fontWeight: "700",
    lineHeight: 34,
    writingDirection: "rtl",
  },
  roman: {
    textAlign:  "center",
    fontStyle:  "italic",
    lineHeight: 16,
  },
  translation: {
    textAlign: "center",
    lineHeight: 15,
  },

  countdownTrack: {
    height:       3,
    borderRadius: 2,
    overflow:     "hidden",
    marginBottom: 6,
  },
  countdownFill: {
    height: "100%",
    borderRadius: 2,
  },

  dragHandle: {
    flexDirection:  "row",
    justifyContent: "center",
    gap:            4,
  },
  dragDot: {
    width:        4,
    height:       4,
    borderRadius: 2,
  },
});
