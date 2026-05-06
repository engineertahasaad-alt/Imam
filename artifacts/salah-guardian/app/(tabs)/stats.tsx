import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { WeeklyChart } from "@/components/WeeklyChart";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import {
  PRAYER_NAMES,
  formatDate,
  getPrayersForDate,
} from "@/lib/storage";

interface MissedStat {
  name: string;
  missedCount: number;
}

export default function StatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { weeklyStats, streak } = useApp();
  const [missedStats, setMissedStats] = useState<MissedStat[]>([]);
  const [totalDetected, setTotalDetected] = useState(0);
  const [totalPossible, setTotalPossible] = useState(0);

  useEffect(() => {
    computeStats();
  }, [weeklyStats]);

  async function computeStats() {
    const today = new Date();
    const missedCounts: Record<string, number> = {};
    PRAYER_NAMES.forEach((n) => (missedCounts[n] = 0));

    let detected = 0;
    let possible = 0;

    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = formatDate(d);
      const records = await getPrayersForDate(dateStr);

      PRAYER_NAMES.forEach((name) => {
        const rec = records.find((r) => r.prayerName === name);
        if (rec?.detected) {
          detected++;
        } else {
          missedCounts[name]++;
        }
        possible++;
      });
    }

    setTotalDetected(detected);
    setTotalPossible(possible);

    const sorted = Object.entries(missedCounts)
      .map(([name, missedCount]) => ({ name, missedCount }))
      .sort((a, b) => b.missedCount - a.missedCount);
    setMissedStats(sorted);
  }

  const consistency =
    totalPossible > 0 ? Math.round((totalDetected / totalPossible) * 100) : 0;

  const weeklyTotal = weeklyStats.reduce((sum, d) => sum + d.detected, 0);

  const paddingBottom =
    Platform.OS === "web" ? insets.bottom + 84 : insets.bottom + 80;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
          paddingBottom,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>
        Statistics
      </Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Last 7 days
      </Text>

      {/* Key stats row */}
      <View style={styles.statsRow}>
        <StatBox
          label="Streak"
          value={`${streak}d`}
          icon="zap"
          color={colors.gold}
          bg={colors.gold + "15"}
          colors={colors}
        />
        <StatBox
          label="This Week"
          value={`${weeklyTotal}`}
          icon="check-circle"
          color={colors.primary}
          bg={colors.primary + "15"}
          colors={colors}
        />
        <StatBox
          label="Consistency"
          value={`${consistency}%`}
          icon="trending-up"
          color={colors.accent}
          bg={colors.accent + "15"}
          colors={colors}
        />
      </View>

      {/* Weekly chart */}
      <WeeklyChart stats={weeklyStats} />

      {/* Most missed prayers */}
      <View
        style={[
          styles.section,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Prayer Performance (7 days)
        </Text>

        {missedStats.map((s) => {
          const detectedCount = 7 - s.missedCount;
          const pct = detectedCount / 7;

          return (
            <View key={s.name} style={styles.prayerStatRow}>
              <Text
                style={[styles.prayerStatName, { color: colors.foreground }]}
              >
                {s.name}
              </Text>
              <View style={styles.barContainer}>
                <View
                  style={[
                    styles.barBg,
                    { backgroundColor: colors.border },
                  ]}
                >
                  <View
                    style={[
                      styles.barProgress,
                      {
                        width: `${pct * 100}%`,
                        backgroundColor:
                          pct >= 0.8
                            ? colors.primary
                            : pct >= 0.5
                            ? colors.warning
                            : colors.error,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.prayerStatCount,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {detectedCount}/7
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function StatBox({
  label,
  value,
  icon,
  color,
  bg,
  colors,
}: {
  label: string;
  value: string;
  icon: any;
  color: string;
  bg: string;
  colors: any;
}) {
  return (
    <View
      style={[
        statBoxStyles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={[statBoxStyles.iconWrap, { backgroundColor: bg }]}>
        <Feather name={icon} size={16} color={color} />
      </View>
      <Text style={[statBoxStyles.value, { color: colors.foreground }]}>
        {value}
      </Text>
      <Text style={[statBoxStyles.label, { color: colors.mutedForeground }]}>
        {label}
      </Text>
    </View>
  );
}

const statBoxStyles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
    gap: 4,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  value: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 11,
  },
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    gap: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 13,
    marginTop: -8,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  prayerStatRow: {
    gap: 6,
  },
  prayerStatName: {
    fontSize: 13,
    fontWeight: "500",
  },
  barContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  barBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  barProgress: {
    height: "100%",
    borderRadius: 3,
  },
  prayerStatCount: {
    fontSize: 11,
    width: 28,
    textAlign: "right",
  },
});
