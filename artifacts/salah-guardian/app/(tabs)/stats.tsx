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
import {
  getTrainingSessions,
  SessionQuality,
  TrainingSession,
} from "@/lib/trainingStorage";

interface MissedStat {
  name: string;
  missedCount: number;
}

const QUALITY_COLOR: Record<SessionQuality, string> = {
  excellent: "#22c55e",
  good:      "#3b82f6",
  weak:      "#f59e0b",
  noisy:     "#f87171",
};
const QUALITY_ICON: Record<SessionQuality, string> = {
  excellent: "award",
  good:      "thumbs-up",
  weak:      "alert-triangle",
  noisy:     "x-circle",
};

function fmtRelativeDate(ts: number): string {
  const diffMs  = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1)  return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)  return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

export default function StatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { weeklyStats, streak } = useApp();
  const [missedStats, setMissedStats]       = useState<MissedStat[]>([]);
  const [totalDetected, setTotalDetected]   = useState(0);
  const [totalPossible, setTotalPossible]   = useState(0);
  const [trainingSessions, setTrainingSessions] = useState<TrainingSession[]>([]);

  useEffect(() => {
    computeStats();
    getTrainingSessions().then(s => setTrainingSessions(s.slice().reverse()));
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

  const totalSessions = trainingSessions.length;
  const bestScore = totalSessions > 0
    ? Math.round(Math.max(...trainingSessions.map(s => s.qualityScore)) * 100)
    : 0;
  const avgScore = totalSessions > 0
    ? Math.round(trainingSessions.reduce((s, t) => s + t.qualityScore, 0) / totalSessions * 100)
    : 0;

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

      {/* Training History */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={th.headerRow}>
          <View style={[th.iconWrap, { backgroundColor: "#3b82f6" + "20" }]}>
            <Feather name="cpu" size={15} color="#3b82f6" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>
              Training History
            </Text>
            <Text style={[th.subLabel, { color: colors.mutedForeground }]}>
              Phone calibration sessions
            </Text>
          </View>
        </View>

        {totalSessions === 0 ? (
          <View style={th.emptyBox}>
            <Feather name="cpu" size={28} color={colors.mutedForeground} />
            <Text style={[th.emptyTitle, { color: colors.foreground }]}>No sessions yet</Text>
            <Text style={[th.emptyDesc, { color: colors.mutedForeground }]}>
              Use "Train Your Phone" on the home screen to personalize detection.
            </Text>
          </View>
        ) : (
          <>
            {/* Summary mini-stats */}
            <View style={th.summaryRow}>
              <View style={[th.summaryBox, { backgroundColor: colors.background }]}>
                <Text style={[th.summaryVal, { color: colors.foreground }]}>{totalSessions}</Text>
                <Text style={[th.summaryLbl, { color: colors.mutedForeground }]}>Sessions</Text>
              </View>
              <View style={[th.summaryBox, { backgroundColor: colors.background }]}>
                <Text style={[th.summaryVal, { color: "#22c55e" }]}>{bestScore}%</Text>
                <Text style={[th.summaryLbl, { color: colors.mutedForeground }]}>Best</Text>
              </View>
              <View style={[th.summaryBox, { backgroundColor: colors.background }]}>
                <Text style={[th.summaryVal, { color: "#3b82f6" }]}>{avgScore}%</Text>
                <Text style={[th.summaryLbl, { color: colors.mutedForeground }]}>Average</Text>
              </View>
            </View>

            {/* Quality timeline dots */}
            <View style={th.timelineWrap}>
              <Text style={[th.timelineLabel, { color: colors.mutedForeground }]}>
                Quality over time (newest right)
              </Text>
              <View style={th.dotsRow}>
                {trainingSessions.slice().reverse().map((s, i) => (
                  <View
                    key={s.id}
                    style={[
                      th.timelineDot,
                      { backgroundColor: QUALITY_COLOR[s.quality] },
                      { height: Math.max(8, (s.overallScore / 100) * 36) },
                    ]}
                  />
                ))}
              </View>
              <View style={th.dotsAxisRow}>
                <Text style={[th.axisLabel, { color: colors.mutedForeground }]}>0%</Text>
                <Text style={[th.axisLabel, { color: colors.mutedForeground }]}>100%</Text>
              </View>
            </View>

            {/* Session list (most recent first) */}
            <View style={th.sessionList}>
              {trainingSessions.slice(0, 8).map((s) => (
                <View
                  key={s.id}
                  style={[th.sessionRow, { borderBottomColor: colors.border }]}
                >
                  <View style={[th.qualityDot, { backgroundColor: QUALITY_COLOR[s.quality] }]} />
                  <View style={{ flex: 1 }}>
                    <View style={th.sessionTopRow}>
                      <Text style={[th.sessionQuality, { color: QUALITY_COLOR[s.quality] }]}>
                        {s.quality.charAt(0).toUpperCase() + s.quality.slice(1)}
                      </Text>
                      <Text style={[th.sessionTime, { color: colors.mutedForeground }]}>
                        {fmtRelativeDate(s.timestamp)}
                      </Text>
                    </View>
                    <View style={th.scoreBarWrap}>
                      <View style={[th.scoreBarBg, { backgroundColor: colors.border }]}>
                        <View
                          style={[
                            th.scoreBarFill,
                            {
                              width: `${s.overallScore}%`,
                              backgroundColor: QUALITY_COLOR[s.quality],
                            },
                          ]}
                        />
                      </View>
                      <Text style={[th.scoreNum, { color: colors.mutedForeground }]}>
                        {s.overallScore}%
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      th.iconChip,
                      { backgroundColor: QUALITY_COLOR[s.quality] + "20" },
                    ]}
                  >
                    <Feather
                      name={QUALITY_ICON[s.quality] as any}
                      size={13}
                      color={QUALITY_COLOR[s.quality]}
                    />
                  </View>
                </View>
              ))}
            </View>

            {totalSessions > 8 && (
              <Text style={[th.moreLabel, { color: colors.mutedForeground }]}>
                +{totalSessions - 8} older sessions stored
              </Text>
            )}
          </>
        )}
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

const th = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  subLabel: {
    fontSize: 11,
    marginTop: 1,
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  emptyDesc: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 260,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 8,
  },
  summaryBox: {
    flex: 1,
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
    gap: 2,
  },
  summaryVal: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  summaryLbl: {
    fontSize: 10,
  },
  timelineWrap: {
    gap: 6,
  },
  timelineLabel: {
    fontSize: 11,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    height: 40,
  },
  timelineDot: {
    width: 8,
    borderRadius: 4,
    minHeight: 8,
  },
  dotsAxisRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  axisLabel: {
    fontSize: 9,
  },
  sessionList: {
    gap: 0,
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  qualityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sessionTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sessionQuality: {
    fontSize: 12,
    fontWeight: "600",
  },
  sessionTime: {
    fontSize: 11,
  },
  scoreBarWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  scoreBarBg: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
  },
  scoreBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  scoreNum: {
    fontSize: 10,
    width: 26,
    textAlign: "right",
  },
  iconChip: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  moreLabel: {
    fontSize: 11,
    textAlign: "center",
    paddingTop: 4,
  },
});
