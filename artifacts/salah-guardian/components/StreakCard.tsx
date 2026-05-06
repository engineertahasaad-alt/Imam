import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface Props {
  streak: number;
  todayCount: number;
}

export function StreakCard({ streak, todayCount }: Props) {
  const colors = useColors();

  const consistency = Math.round((todayCount / 5) * 100);

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Streak */}
      <View style={styles.statBlock}>
        <View
          style={[styles.iconWrap, { backgroundColor: colors.gold + "20" }]}
        >
          <Feather name="zap" size={18} color={colors.gold} />
        </View>
        <Text style={[styles.number, { color: colors.foreground }]}>
          {streak}
        </Text>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          Day Streak
        </Text>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Today */}
      <View style={styles.statBlock}>
        <View
          style={[styles.iconWrap, { backgroundColor: colors.primary + "20" }]}
        >
          <Feather name="check-circle" size={18} color={colors.primary} />
        </View>
        <Text style={[styles.number, { color: colors.foreground }]}>
          {todayCount}/5
        </Text>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          Today
        </Text>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Consistency */}
      <View style={styles.statBlock}>
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: colors.accent + "20" },
          ]}
        >
          <Feather name="bar-chart-2" size={18} color={colors.accent} />
        </View>
        <Text style={[styles.number, { color: colors.foreground }]}>
          {consistency}%
        </Text>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          Today
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    padding: 16,
    alignItems: "center",
  },
  statBlock: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  number: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 11,
    textAlign: "center",
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 48,
    marginHorizontal: 8,
  },
});
