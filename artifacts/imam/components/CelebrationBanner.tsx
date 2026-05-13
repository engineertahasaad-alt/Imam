import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { useTranslation } from "@/hooks/useTranslation";

interface Props {
  visible: boolean;
  userName?: string;
  streak: number;
}

export function CelebrationBanner({ visible, userName, streak }: Props) {
  const colors      = useColors();
  const { t, isArabic } = useTranslation();
  const translateY  = useRef(new Animated.Value(-120)).current;
  const opacity     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 7, tension: 60 }),
        Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -120, duration: 300, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const titleText = userName
    ? (isArabic ? `ما شاء الله، ${userName}!` : `Ma sha Allah, ${userName}!`)
    : t("mashaallah");

  const streakText = isArabic
    ? `🔥 ${streak} أيام متتالية — استمر!`
    : `🔥 ${streak}-day streak — keep going!`;

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: colors.primary, opacity, transform: [{ translateY }] },
      ]}
    >
      <Text style={styles.moon}>🌙</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.title, { color: colors.primaryForeground }]}>
          {titleText}
        </Text>
        <Text style={[styles.subtitle, { color: colors.primaryForeground + "cc" }]}>
          {t("all_5_complete")}
        </Text>
        {streak > 1 && (
          <Text style={[styles.subtitle, { color: colors.primaryForeground + "cc" }]}>
            {streakText}
          </Text>
        )}
      </View>
      <Feather name="star" size={20} color={colors.primaryForeground} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16, padding: 16,
    flexDirection: "row", alignItems: "center", gap: 12, overflow: "hidden",
  },
  moon:     { fontSize: 32 },
  title:    { fontSize: 15, fontWeight: "700" },
  subtitle: { fontSize: 12, lineHeight: 18 },
});
