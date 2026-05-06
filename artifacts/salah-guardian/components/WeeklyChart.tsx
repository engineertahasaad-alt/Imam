import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { WeeklyStat } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

interface Props {
  stats: WeeklyStat[];
}

export function WeeklyChart({ stats }: Props) {
  const colors = useColors();
  const maxVal = 5;

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>
        7-Day Overview
      </Text>

      <View style={styles.chart}>
        {stats.map((s, i) => {
          const pct = s.detected / maxVal;
          const isToday = i === stats.length - 1;

          return (
            <View key={s.date} style={styles.barColumn}>
              <Text
                style={[
                  styles.countLabel,
                  {
                    color: s.detected > 0 ? colors.primary : colors.mutedForeground + "60",
                  },
                ]}
              >
                {s.detected > 0 ? s.detected : ""}
              </Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      height: `${Math.max(pct * 100, s.detected > 0 ? 8 : 4)}%`,
                      backgroundColor: isToday
                        ? colors.primary
                        : s.detected >= 3
                        ? colors.primary + "90"
                        : s.detected > 0
                        ? colors.primary + "50"
                        : colors.border,
                      borderRadius: 6,
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.dayLabel,
                  {
                    color: isToday
                      ? colors.primary
                      : colors.mutedForeground,
                    fontWeight: isToday ? "700" : "400",
                  },
                ]}
              >
                {s.day}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.legend}>
        <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
        <Text style={[styles.legendText, { color: colors.mutedForeground }]}>
          Prayers detected
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 16,
  },
  chart: {
    flexDirection: "row",
    height: 100,
    gap: 6,
    alignItems: "flex-end",
  },
  barColumn: {
    flex: 1,
    alignItems: "center",
    height: "100%",
  },
  countLabel: {
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 2,
    height: 14,
  },
  barTrack: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-end",
    marginBottom: 4,
  },
  barFill: {
    width: "100%",
    minHeight: 4,
  },
  dayLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
  },
});
