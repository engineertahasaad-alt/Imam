import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { getScheduledNotifications, sendImmediateNotification } from "@/lib/notifications";
import { useApp } from "@/context/AppContext";

type ScheduledNotif = Notifications.NotificationRequest;

function formatDate(date: Date): string {
  return date.toLocaleString([], {
    weekday: "short",
    month:   "short",
    day:     "numeric",
    hour:    "2-digit",
    minute:  "2-digit",
    second:  "2-digit",
  });
}

function timeUntil(date: Date): string {
  const diffMs  = date.getTime() - Date.now();
  if (diffMs <= 0) return "passed";
  const diffMin = Math.floor(diffMs / 60_000);
  const hrs     = Math.floor(diffMin / 60);
  const mins    = diffMin % 60;
  if (hrs > 0) return `in ${hrs}h ${mins}m`;
  return `in ${mins}m`;
}

function getTriggerDate(trigger: ScheduledNotif["trigger"]): Date | null {
  if (!trigger) return null;
  // DATE trigger has a `value` field (ms since epoch)
  if ("value" in trigger && typeof trigger.value === "number") {
    return new Date(trigger.value);
  }
  // Some SDK versions use `dateComponents` or `seconds`
  if ("seconds" in trigger && typeof trigger.seconds === "number") {
    return new Date(Date.now() + trigger.seconds * 1000);
  }
  return null;
}

function getBadge(id: string): { label: string; color: string } {
  if (id.startsWith("adhan_"))  return { label: "ADHAN",  color: "#10b981" };
  if (id.startsWith("prayer_")) return { label: "PRAYER", color: "#6366f1" };
  return { label: "OTHER", color: "#94a3b8" };
}

export default function DebugNotificationsScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const { settings, updateSettings } = useApp();

  const [notifs,    setNotifs]    = useState<ScheduledNotif[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [testSent,  setTestSent]  = useState(false);

  const load = useCallback(async () => {
    const all = await getScheduledNotifications();
    // Sort by fire time ascending
    const sorted = [...all].sort((a, b) => {
      const da = getTriggerDate(a.trigger)?.getTime() ?? 0;
      const db = getTriggerDate(b.trigger)?.getTime() ?? 0;
      return da - db;
    });
    setNotifs(sorted);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleReschedule() {
    setLoading(true);
    // Trigger a settings update that causes AppContext to re-run computeTimes
    await updateSettings({ adhanEnabled: settings.adhanEnabled });
    await new Promise((r) => setTimeout(r, 1500));
    await load();
    setLoading(false);
  }

  async function handleTestNow() {
    await sendImmediateNotification("🔔 Test Notification", "If you see this, notifications are working.");
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  }

  const adhanCount  = notifs.filter((n) => n.identifier.startsWith("adhan_")).length;
  const prayerCount = notifs.filter((n) => n.identifier.startsWith("prayer_")).length;

  return (
    <ScrollView
      style={[s.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32, gap: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.title, { color: colors.foreground }]}>Scheduled Notifications</Text>
      </View>

      {/* Summary chips */}
      <View style={s.chipRow}>
        <View style={[s.chip, { backgroundColor: "#10b981" + "20", borderColor: "#10b981" + "50" }]}>
          <Text style={[s.chipNum, { color: "#10b981" }]}>{adhanCount}</Text>
          <Text style={[s.chipLabel, { color: "#10b981" }]}>Adhan</Text>
        </View>
        <View style={[s.chip, { backgroundColor: "#6366f1" + "20", borderColor: "#6366f1" + "50" }]}>
          <Text style={[s.chipNum, { color: "#6366f1" }]}>{prayerCount}</Text>
          <Text style={[s.chipLabel, { color: "#6366f1" }]}>Prayer</Text>
        </View>
        <View style={[s.chip, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Text style={[s.chipNum, { color: colors.foreground }]}>{notifs.length}</Text>
          <Text style={[s.chipLabel, { color: colors.mutedForeground }]}>Total</Text>
        </View>
      </View>

      {/* Action buttons */}
      <View style={s.btnRow}>
        <TouchableOpacity
          style={[s.btn, { borderColor: colors.primary, flex: 1 }]}
          onPress={handleReschedule}
        >
          <Feather name="refresh-cw" size={14} color={colors.primary} />
          <Text style={[s.btnText, { color: colors.primary }]}>Reschedule</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.btn, { borderColor: testSent ? "#10b981" : "#f59e0b", flex: 1 }]}
          onPress={handleTestNow}
        >
          <Feather name="bell" size={14} color={testSent ? "#10b981" : "#f59e0b"} />
          <Text style={[s.btnText, { color: testSent ? "#10b981" : "#f59e0b" }]}>
            {testSent ? "Sent!" : "Test Now"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Notification list */}
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : notifs.length === 0 ? (
        <View style={[s.emptyBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Feather name="bell-off" size={32} color={colors.mutedForeground} />
          <Text style={[s.emptyTitle, { color: colors.foreground }]}>No notifications scheduled</Text>
          <Text style={[s.emptyHint, { color: colors.mutedForeground }]}>
            Enable notifications and adhan in Settings, then tap Reschedule.
          </Text>
        </View>
      ) : (
        <View style={s.list}>
          {notifs.map((n) => {
            const fireDate = getTriggerDate(n.trigger);
            const badge    = getBadge(n.identifier);
            const isPast   = fireDate ? fireDate < new Date() : false;
            return (
              <View
                key={n.identifier}
                style={[
                  s.card,
                  {
                    backgroundColor: colors.card,
                    borderColor:     isPast ? colors.destructive + "40" : colors.border,
                    opacity:         isPast ? 0.5 : 1,
                  },
                ]}
              >
                <View style={s.cardTop}>
                  <View style={[s.badge, { backgroundColor: badge.color + "20", borderColor: badge.color + "50" }]}>
                    <Text style={[s.badgeText, { color: badge.color }]}>{badge.label}</Text>
                  </View>
                  {fireDate && (
                    <Text style={[s.timeUntil, { color: isPast ? colors.destructive : colors.primary }]}>
                      {timeUntil(fireDate)}
                    </Text>
                  )}
                </View>

                <Text style={[s.notifTitle, { color: colors.foreground }]} numberOfLines={1}>
                  {n.content.title ?? "(no title)"}
                </Text>
                <Text style={[s.notifBody, { color: colors.mutedForeground }]} numberOfLines={2}>
                  {n.content.body ?? "(no body)"}
                </Text>

                {fireDate && (
                  <Text style={[s.fireTime, { color: colors.mutedForeground }]}>
                    🕐 {formatDate(fireDate)}
                  </Text>
                )}

                <Text style={[s.identifier, { color: colors.mutedForeground }]} numberOfLines={1}>
                  id: {n.identifier}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1 },
  header:       { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20 },
  backBtn:      { padding: 4 },
  title:        { fontSize: 20, fontWeight: "700" },

  chipRow:      { flexDirection: "row", gap: 10, paddingHorizontal: 20 },
  chip:         { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 10, alignItems: "center", gap: 2 },
  chipNum:      { fontSize: 22, fontWeight: "700" },
  chipLabel:    { fontSize: 11, fontWeight: "600" },

  btnRow:       { flexDirection: "row", gap: 10, paddingHorizontal: 20 },
  btn:          { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderRadius: 10, paddingVertical: 11 },
  btnText:      { fontSize: 14, fontWeight: "600" },

  emptyBox:     { marginHorizontal: 20, borderRadius: 16, borderWidth: 1, padding: 32, alignItems: "center", gap: 10 },
  emptyTitle:   { fontSize: 16, fontWeight: "600", textAlign: "center" },
  emptyHint:    { fontSize: 13, textAlign: "center", lineHeight: 18 },

  list:         { paddingHorizontal: 20, gap: 10 },
  card:         { borderRadius: 14, borderWidth: 1, padding: 14, gap: 4 },
  cardTop:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  badge:        { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText:    { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  timeUntil:    { fontSize: 12, fontWeight: "600" },
  notifTitle:   { fontSize: 15, fontWeight: "600" },
  notifBody:    { fontSize: 13, lineHeight: 18 },
  fireTime:     { fontSize: 12, marginTop: 4 },
  identifier:   { fontSize: 10, marginTop: 2, fontFamily: "monospace" },
});
