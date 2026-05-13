import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { useTranslation } from "@/hooks/useTranslation";

interface Props {
  streak: number;
  todayCount: number;
}

export function StreakCard({ streak, todayCount }: Props) {
  const colors      = useColors();
  const { t }       = useTranslation();
  const consistency = Math.round((todayCount / 5) * 100);

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.statBlock}>
        <View style={[styles.iconWrap, { backgroundColor: colors.gold + "20" }]}>
          <Feather name="zap" size={14} color={colors.gold} />
        </View>
        <Text style={[styles.number, { color: colors.foreground }]}>{streak}</Text>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>{t("day_streak")}</Text>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.statBlock}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primary + "20" }]}>
          <Feather name="check-circle" size={14} color={colors.primary} />
        </View>
        <Text style={[styles.number, { color: colors.foreground }]}>{todayCount}/5</Text>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>{t("today_label")}</Text>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.statBlock}>
        <View style={[styles.iconWrap, { backgroundColor: colors.accent + "20" }]}>
          <Feather name="bar-chart-2" size={14} color={colors.accent} />
        </View>
        <Text style={[styles.number, { color: colors.foreground }]}>{consistency}%</Text>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>{t("today_label")}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  statBlock: { flex: 1, alignItems: "center", gap: 3 },
  iconWrap: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center", marginBottom: 2,
  },
  number:  { fontSize: 17, fontWeight: "700", letterSpacing: -0.5 },
  label:   { fontSize: 10, textAlign: "center" },
  divider: { width: StyleSheet.hairlineWidth, height: 36, marginHorizontal: 4 },
});
