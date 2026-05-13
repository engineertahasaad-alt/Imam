import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { WeeklyChart } from "@/components/WeeklyChart";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "@/hooks/useTranslation";
import {
  PRAYER_NAMES,
  formatDate,
  getPrayersForDate,
  getTodayString,
} from "@/lib/storage";

const TAB_H = Platform.OS === "web" ? 84 : 62;

interface DayEntry {
  date: string;
  label: string;
  prayers: Array<{
    name: string;
    detected: boolean;
    confidence?: number;
    rakaatCount?: number;
  }>;
}

interface MissedStat {
  name: string;
  missedCount: number;
}

export default function PrayersScreen() {
  const colors      = useColors();
  const insets      = useSafeAreaInsets();
  const { t, lang } = useTranslation();
  const { prayerStatuses, markPrayerManual, weeklyStats, streak } = useApp();

  const [days, setDays]           = useState<DayEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [missedStats, setMissedStats]     = useState<MissedStat[]>([]);
  const [totalDetected, setTotalDetected] = useState(0);
  const [totalPossible, setTotalPossible] = useState(0);

  useEffect(() => {
    loadAll();
  }, [prayerStatuses, lang]);

  async function loadAll() {
    setLoading(true);
    const today = new Date();
    const entries: DayEntry[] = [];
    const missedCounts: Record<string, number> = {};
    PRAYER_NAMES.forEach((n) => (missedCounts[n] = 0));
    let detected = 0;
    let possible = 0;

    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = formatDate(d);
      const records = await getPrayersForDate(dateStr);

      const prayers = PRAYER_NAMES.map((name) => {
        const rec = records.find((r) => r.prayerName === name);
        return {
          name,
          detected: rec?.detected ?? false,
          confidence: rec?.confidence,
          rakaatCount: rec?.rakaatCount,
        };
      });

      if (i < 7) {
        PRAYER_NAMES.forEach((name) => {
          const rec = records.find((r) => r.prayerName === name);
          if (rec?.detected) { detected++; } else { missedCounts[name]++; }
          possible++;
        });
      }

      entries.push({
        date: dateStr,
        label:
          i === 0 ? t("log_today") :
          i === 1 ? t("log_yesterday") :
          formatDayLabel(d, lang),
        prayers,
      });
    }

    setDays(entries);
    setTotalDetected(detected);
    setTotalPossible(possible);
    const sorted = Object.entries(missedCounts)
      .map(([name, missedCount]) => ({ name, missedCount }))
      .sort((a, b) => b.missedCount - a.missedCount);
    setMissedStats(sorted);
    setLoading(false);
  }

  async function handleMarkManual(date: string, prayerName: string) {
    if (date !== getTodayString()) return;
    await markPrayerManual(prayerName);
    await loadAll();
  }

  const consistency = totalPossible > 0
    ? Math.round((totalDetected / totalPossible) * 100)
    : 0;
  const weeklyTotal = weeklyStats.reduce((sum, d) => sum + d.detected, 0);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingBottom: TAB_H + insets.bottom + 20,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {t("tab_log")}
        </Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          {t("last_7_days")} · {t("last_14_days")}
        </Text>
      </View>

      <View style={styles.inner}>
        {/* ── Stats summary row ─────────────────────── */}
        <View style={styles.statsRow}>
          <StatBox
            label={t("streak_lbl")}
            value={`${streak}d`}
            icon="zap"
            color={colors.gold}
            bg={colors.gold + "15"}
            colors={colors}
          />
          <StatBox
            label={t("this_week")}
            value={`${weeklyTotal}`}
            icon="check-circle"
            color={colors.primary}
            bg={colors.primary + "15"}
            colors={colors}
          />
          <StatBox
            label={t("consistency")}
            value={`${consistency}%`}
            icon="trending-up"
            color={colors.accent}
            bg={colors.accent + "15"}
            colors={colors}
          />
        </View>

        {/* ── Weekly chart ──────────────────────────── */}
        <WeeklyChart stats={weeklyStats} />

        {/* ── Prayer performance (7-day) ────────────── */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {t("prayer_perf_7d")}
          </Text>
          {missedStats.map((s) => {
            const detectedCount = 7 - s.missedCount;
            const pct = detectedCount / 7;
            return (
              <View key={s.name} style={styles.prayerStatRow}>
                <Text style={[styles.prayerStatName, { color: colors.foreground }]}>
                  {s.name}
                </Text>
                <View style={styles.barContainer}>
                  <View style={[styles.barBg, { backgroundColor: colors.border }]}>
                    <View
                      style={[
                        styles.barProgress,
                        {
                          width: `${pct * 100}%`,
                          backgroundColor:
                            pct >= 0.8 ? colors.primary :
                            pct >= 0.5 ? colors.warning  : colors.error,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.prayerStatCount, { color: colors.mutedForeground }]}>
                    {detectedCount}/7
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ── Divider ──────────────────────────────── */}
        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerLabel, { color: colors.mutedForeground }]}>
            {t("last_14_days")}
          </Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        {/* ── 14-day prayer log ────────────────────── */}
        {loading ? null : days.map((item) => (
          <View
            key={item.date}
            style={[
              styles.dayCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.dayHeader}>
              <Text style={[styles.dayLabel, { color: colors.foreground }]}>
                {item.label}
              </Text>
              <Text style={[styles.dayDate, { color: colors.mutedForeground }]}>
                {item.date}
              </Text>
              <View
                style={[
                  styles.dayBadge,
                  {
                    backgroundColor:
                      item.prayers.filter((p) => p.detected).length === 5
                        ? colors.primary + "20"
                        : colors.secondary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.dayBadgeText,
                    {
                      color:
                        item.prayers.filter((p) => p.detected).length === 5
                          ? colors.primary
                          : colors.mutedForeground,
                    },
                  ]}
                >
                  {item.prayers.filter((p) => p.detected).length}/5
                </Text>
              </View>
            </View>

            <View style={styles.prayerRow}>
              {item.prayers.map((p) => (
                <TouchableOpacity
                  key={p.name}
                  style={[
                    styles.prayerChip,
                    {
                      backgroundColor: p.detected ? colors.primary : colors.secondary,
                      borderColor:     p.detected ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => !p.detected && handleMarkManual(item.date, p.name)}
                >
                  {p.detected ? (
                    <Feather name="check" size={10} color={colors.primaryForeground} />
                  ) : null}
                  <Text
                    style={[
                      styles.prayerChipText,
                      {
                        color: p.detected
                          ? colors.primaryForeground
                          : colors.mutedForeground,
                      },
                    ]}
                  >
                    {p.name.substring(0, 3)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {!loading && days.length === 0 && (
          <View style={styles.empty}>
            <Feather name="book-open" size={40} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {t("no_records")}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function StatBox({
  label, value, icon, color, bg, colors,
}: {
  label: string; value: string; icon: any; color: string; bg: string; colors: any;
}) {
  return (
    <View style={[statBoxStyles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[statBoxStyles.iconWrap, { backgroundColor: bg }]}>
        <Feather name={icon} size={16} color={color} />
      </View>
      <Text style={[statBoxStyles.value, { color: colors.foreground }]}>{value}</Text>
      <Text style={[statBoxStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function formatDayLabel(date: Date, lang: "en" | "ar"): string {
  return date.toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", {
    weekday: "short",
    month:   "short",
    day:     "numeric",
  });
}

const statBoxStyles = StyleSheet.create({
  container: {
    flex: 1, borderRadius: 14, borderWidth: 1, padding: 14,
    alignItems: "center", gap: 4,
  },
  iconWrap: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  value: { fontSize: 22, fontWeight: "700", letterSpacing: -0.5 },
  label: { fontSize: 11 },
});

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 26, fontWeight: "700" },
  headerSub:   { fontSize: 13, marginTop: 2 },

  inner: { paddingHorizontal: 20, paddingTop: 16, gap: 14 },

  statsRow: { flexDirection: "row", gap: 10 },

  section:        { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  sectionTitle:   { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  prayerStatRow:  { gap: 5 },
  prayerStatName: { fontSize: 13, fontWeight: "500" },
  barContainer:   { flexDirection: "row", alignItems: "center", gap: 8 },
  barBg:          { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  barProgress:    { height: "100%", borderRadius: 3 },
  prayerStatCount:{ fontSize: 11, width: 28, textAlign: "right" },

  dividerRow:   { flexDirection: "row", alignItems: "center", gap: 10 },
  dividerLine:  { flex: 1, height: StyleSheet.hairlineWidth },
  dividerLabel: { fontSize: 11, fontWeight: "600" },

  dayCard:   { borderRadius: 14, borderWidth: 1, padding: 14, gap: 12 },
  dayHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  dayLabel:  { fontSize: 15, fontWeight: "700", flex: 1 },
  dayDate:   { fontSize: 11 },
  dayBadge:  { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  dayBadgeText: { fontSize: 12, fontWeight: "700" },

  prayerRow: { flexDirection: "row", gap: 6 },
  prayerChip: {
    flex: 1, borderRadius: 10, borderWidth: 1, paddingVertical: 8,
    alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 3,
  },
  prayerChipText: { fontSize: 11, fontWeight: "600" },

  empty:     { alignItems: "center", justifyContent: "center", paddingTop: 40, gap: 12 },
  emptyText: { fontSize: 14 },
});
