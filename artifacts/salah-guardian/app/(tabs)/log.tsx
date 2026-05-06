import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import {
  PRAYER_NAMES,
  formatDate,
  getPrayersForDate,
  getTodayString,
} from "@/lib/storage";

interface DayEntry {
  date: string;
  label: string;
  prayers: Array<{
    name: string;
    detected: boolean;
    time?: Date;
    confidence?: number;
    rakaatCount?: number;
  }>;
}

export default function LogScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { prayerStatuses, markPrayerManual } = useApp();
  const [days, setDays] = useState<DayEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLog();
  }, [prayerStatuses]);

  async function loadLog() {
    setLoading(true);
    const entries: DayEntry[] = [];
    const today = new Date();

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

      entries.push({
        date: dateStr,
        label: i === 0 ? "Today" : i === 1 ? "Yesterday" : formatDayLabel(d),
        prayers,
      });
    }

    setDays(entries);
    setLoading(false);
  }

  async function handleMarkManual(date: string, prayerName: string) {
    if (date !== getTodayString()) return;
    await markPrayerManual(prayerName);
    await loadLog();
  }

  const paddingBottom =
    Platform.OS === "web" ? insets.bottom + 84 : insets.bottom + 80;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
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
          Prayer Log
        </Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          Last 14 days
        </Text>
      </View>

      <FlatList
        data={days}
        keyExtractor={(item) => item.date}
        scrollEnabled={!!days.length}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom,
          gap: 12,
        }}
        renderItem={({ item }) => (
          <View
            style={[
              styles.dayCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
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
                      backgroundColor: p.detected
                        ? colors.primary
                        : colors.secondary,
                      borderColor: p.detected ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() =>
                    !p.detected && handleMarkManual(item.date, p.name)
                  }
                >
                  {p.detected ? (
                    <Feather
                      name="check"
                      size={10}
                      color={colors.primaryForeground}
                    />
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
        )}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Feather name="book-open" size={40} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No prayer records yet
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
  },
  headerSub: {
    fontSize: 13,
    marginTop: 2,
  },
  dayCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dayLabel: {
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
  },
  dayDate: {
    fontSize: 11,
  },
  dayBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dayBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  prayerRow: {
    flexDirection: "row",
    gap: 6,
  },
  prayerChip: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 3,
  },
  prayerChipText: {
    fontSize: 11,
    fontWeight: "600",
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
  },
});
