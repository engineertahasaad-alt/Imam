import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { PrayerStatus } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { formatTime } from "@/lib/prayerCalculator";

interface Props {
  statuses: PrayerStatus[];
  currentPrayer: string;
}

export function PrayerTimesList({ statuses, currentPrayer }: Props) {
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {statuses.map((prayer, index) => {
        const isCurrent = prayer.name === currentPrayer;
        const isLast = index === statuses.length - 1;

        return (
          <View key={prayer.name}>
            <View
              style={[
                styles.row,
                isCurrent && {
                  backgroundColor: colors.primary + "18",
                  borderRadius: 10,
                  marginHorizontal: -2,
                  paddingHorizontal: 6,
                },
              ]}
            >
              {/* Status indicator */}
              <View style={styles.statusCol}>
                {prayer.detected ? (
                  <View
                    style={[
                      styles.checkCircle,
                      { backgroundColor: colors.primary },
                    ]}
                  >
                    <Feather name="check" size={12} color={colors.primaryForeground} />
                  </View>
                ) : (
                  <View
                    style={[
                      styles.emptyCircle,
                      {
                        borderColor: isCurrent ? colors.primary : colors.border,
                      },
                    ]}
                  />
                )}
              </View>

              {/* Prayer info */}
              <View style={styles.nameCol}>
                <Text
                  style={[
                    styles.prayerName,
                    {
                      color: isCurrent ? colors.primary : colors.foreground,
                      fontWeight: isCurrent ? "700" : "500",
                    },
                  ]}
                >
                  {prayer.name}
                </Text>
                <Text
                  style={[styles.arabicName, { color: colors.mutedForeground }]}
                >
                  {prayer.arabic}
                </Text>
              </View>

              {/* Time */}
              <Text
                style={[
                  styles.time,
                  {
                    color: isCurrent
                      ? colors.primary
                      : colors.mutedForeground,
                  },
                ]}
              >
                {formatTime(prayer.time)}
              </Text>

              {/* Confidence badge */}
              {prayer.detected && prayer.confidence !== undefined && (
                <View
                  style={[
                    styles.confidenceBadge,
                    { backgroundColor: colors.primary + "20" },
                  ]}
                >
                  <Text
                    style={[styles.confidenceText, { color: colors.primary }]}
                  >
                    {Math.round(prayer.confidence * 100)}%
                  </Text>
                </View>
              )}
            </View>

            {!isLast && (
              <View
                style={[styles.separator, { backgroundColor: colors.border }]}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 8,
    gap: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 2,
    gap: 10,
  },
  statusCol: {
    width: 28,
    alignItems: "center",
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  nameCol: {
    flex: 1,
  },
  prayerName: {
    fontSize: 15,
  },
  arabicName: {
    fontSize: 11,
    marginTop: 1,
  },
  time: {
    fontSize: 14,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  confidenceBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 4,
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: "600",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 38,
  },
});
