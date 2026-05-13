import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAzkar } from "@/context/AzkarContext";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "@/hooks/useTranslation";

const TAB_H = Platform.OS === "web" ? 84 : 62;
const EVENING_ACCENT = "#8b5cf6";

function HourPicker({
  value,
  onChange,
  colors,
}: {
  value: number;
  onChange: (v: number) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.hourPickerRow]}>
      <TouchableOpacity
        onPress={() => onChange(value === 0 ? 23 : value - 1)}
        style={[styles.hourBtn, { backgroundColor: colors.secondary }]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <MaterialCommunityIcons name="chevron-left" size={18} color={colors.foreground} />
      </TouchableOpacity>
      <Text style={[styles.hourValue, { color: colors.foreground }]}>
        {String(value).padStart(2, "0")}
      </Text>
      <TouchableOpacity
        onPress={() => onChange(value === 23 ? 0 : value + 1)}
        style={[styles.hourBtn, { backgroundColor: colors.secondary }]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <MaterialCommunityIcons name="chevron-right" size={18} color={colors.foreground} />
      </TouchableOpacity>
    </View>
  );
}

function MinutePicker({
  value,
  onChange,
  colors,
}: {
  value: number;
  onChange: (v: number) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const STEPS = [0, 15, 30, 45];
  const currentIdx = STEPS.findIndex((s) => s === value) >= 0
    ? STEPS.findIndex((s) => s === value)
    : 0;

  return (
    <View style={[styles.hourPickerRow]}>
      <TouchableOpacity
        onPress={() => onChange(STEPS[(currentIdx - 1 + STEPS.length) % STEPS.length])}
        style={[styles.hourBtn, { backgroundColor: colors.secondary }]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <MaterialCommunityIcons name="chevron-left" size={18} color={colors.foreground} />
      </TouchableOpacity>
      <Text style={[styles.hourValue, { color: colors.foreground }]}>
        {String(STEPS[currentIdx]).padStart(2, "0")}
      </Text>
      <TouchableOpacity
        onPress={() => onChange(STEPS[(currentIdx + 1) % STEPS.length])}
        style={[styles.hourBtn, { backgroundColor: colors.secondary }]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <MaterialCommunityIcons name="chevron-right" size={18} color={colors.foreground} />
      </TouchableOpacity>
    </View>
  );
}

export default function AzkarScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isArabic } = useTranslation();
  const { settings, showNow, updateSettings, dailyCompletion, refreshCompletion } = useAzkar();

  const paddingTop    = insets.top + (Platform.OS === "web" ? 67 : 20);
  const paddingBottom = insets.bottom + TAB_H + (Platform.OS === "web" ? 34 : 16);

  // Refresh completion whenever the hub becomes active
  useEffect(() => {
    refreshCompletion();
  }, []);

  const morningDone = dailyCompletion.morning;
  const eveningDone = dailyCompletion.evening;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { paddingTop, paddingBottom }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {isArabic ? "الأذكار" : "Azkar"}
        </Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          {isArabic ? "تذكر الله" : "Remember Allah"}
        </Text>
      </View>

      {/* Daily Progress Row */}
      {(morningDone || eveningDone) && (
        <View style={[styles.progressRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>
            {isArabic ? "إنجاز اليوم" : "Today's Progress"}
          </Text>
          <View style={styles.progressBadges}>
            {morningDone && (
              <View style={[styles.doneBadge, { backgroundColor: "#f59e0b20", borderColor: "#f59e0b40" }]}>
                <Text style={{ fontSize: 13 }}>🌤️</Text>
                <Text style={[styles.doneBadgeText, { color: "#f59e0b" }]}>
                  {isArabic ? "الصباح ✓" : "Morning ✓"}
                </Text>
              </View>
            )}
            {eveningDone && (
              <View style={[styles.doneBadge, { backgroundColor: EVENING_ACCENT + "20", borderColor: EVENING_ACCENT + "40" }]}>
                <Text style={{ fontSize: 13 }}>🌙</Text>
                <Text style={[styles.doneBadgeText, { color: EVENING_ACCENT }]}>
                  {isArabic ? "المساء ✓" : "Evening ✓"}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Morning & Evening Cards */}
      <View style={styles.dailySection}>
        {/* Morning */}
        <TouchableOpacity
          style={styles.dayCard}
          onPress={() => router.push("/azkar-morning")}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={["#f59e0b", "#fbbf24"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.dayCardGradient}
          >
            <View style={styles.dayCardContent}>
              <View style={styles.dayCardIconWrap}>
                <MaterialCommunityIcons name="weather-sunny" size={34} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dayCardTitle}>
                  {isArabic ? "أذكار الصباح" : "Morning Azkar"}
                </Text>
                <Text style={styles.dayCardDesc}>
                  {isArabic ? "ابدأ يومك بذكر الله" : "Start your day with remembrance of Allah"}
                </Text>
              </View>
              {morningDone ? (
                <MaterialCommunityIcons name="check-circle" size={22} color="rgba(255,255,255,0.95)" />
              ) : (
                <MaterialCommunityIcons
                  name={isArabic ? "chevron-left" : "chevron-right"}
                  size={22}
                  color="rgba(255,255,255,0.7)"
                />
              )}
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Evening */}
        <TouchableOpacity
          style={styles.dayCard}
          onPress={() => router.push("/azkar-evening")}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={["#6366f1", "#8b5cf6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.dayCardGradient}
          >
            <View style={styles.dayCardContent}>
              <View style={styles.dayCardIconWrap}>
                <MaterialCommunityIcons name="weather-night" size={34} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dayCardTitle}>
                  {isArabic ? "أذكار المساء" : "Evening Azkar"}
                </Text>
                <Text style={styles.dayCardDesc}>
                  {isArabic ? "اختم يومك بشكر الله" : "End your day with gratitude to Allah"}
                </Text>
              </View>
              {eveningDone ? (
                <MaterialCommunityIcons name="check-circle" size={22} color="rgba(255,255,255,0.95)" />
              ) : (
                <MaterialCommunityIcons
                  name={isArabic ? "chevron-left" : "chevron-right"}
                  size={22}
                  color="rgba(255,255,255,0.7)"
                />
              )}
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Daily Reminders Section */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIconWrap, { backgroundColor: "#f59e0b20" }]}>
            <MaterialCommunityIcons name="bell-outline" size={22} color="#f59e0b" />
          </View>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {isArabic ? "تذكيرات يومية" : "Daily Reminders"}
          </Text>
        </View>

        {/* Morning reminder row */}
        <View style={styles.reminderBlock}>
          <View style={styles.reminderToggleRow}>
            <View style={styles.reminderToggleLeft}>
              <Text style={{ fontSize: 16 }}>🌤️</Text>
              <Text style={[styles.reminderLabel, { color: colors.foreground }]}>
                {isArabic ? "تذكير الصباح" : "Morning reminder"}
              </Text>
            </View>
            <Switch
              value={settings.morningReminderEnabled}
              onValueChange={(v) => updateSettings({ morningReminderEnabled: v })}
              trackColor={{ false: colors.border, true: "#f59e0b60" }}
              thumbColor={settings.morningReminderEnabled ? "#f59e0b" : colors.mutedForeground}
            />
          </View>
          {settings.morningReminderEnabled && (
            <View style={[styles.timePicker, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Text style={[styles.timePickerLabel, { color: colors.mutedForeground }]}>
                {isArabic ? "الوقت" : "Time"}
              </Text>
              <View style={styles.timePickerControls}>
                <HourPicker
                  value={settings.morningReminderHour}
                  onChange={(v) => updateSettings({ morningReminderHour: v })}
                  colors={colors}
                />
                <Text style={[styles.timeSep, { color: colors.foreground }]}>:</Text>
                <MinutePicker
                  value={settings.morningReminderMinute}
                  onChange={(v) => updateSettings({ morningReminderMinute: v })}
                  colors={colors}
                />
              </View>
            </View>
          )}
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Evening reminder row */}
        <View style={styles.reminderBlock}>
          <View style={styles.reminderToggleRow}>
            <View style={styles.reminderToggleLeft}>
              <Text style={{ fontSize: 16 }}>🌙</Text>
              <Text style={[styles.reminderLabel, { color: colors.foreground }]}>
                {isArabic ? "تذكير المساء" : "Evening reminder"}
              </Text>
            </View>
            <Switch
              value={settings.eveningReminderEnabled}
              onValueChange={(v) => updateSettings({ eveningReminderEnabled: v })}
              trackColor={{ false: colors.border, true: EVENING_ACCENT + "60" }}
              thumbColor={settings.eveningReminderEnabled ? EVENING_ACCENT : colors.mutedForeground}
            />
          </View>
          {settings.eveningReminderEnabled && (
            <View style={[styles.timePicker, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Text style={[styles.timePickerLabel, { color: colors.mutedForeground }]}>
                {isArabic ? "الوقت" : "Time"}
              </Text>
              <View style={styles.timePickerControls}>
                <HourPicker
                  value={settings.eveningReminderHour}
                  onChange={(v) => updateSettings({ eveningReminderHour: v })}
                  colors={colors}
                />
                <Text style={[styles.timeSep, { color: colors.foreground }]}>:</Text>
                <MinutePicker
                  value={settings.eveningReminderMinute}
                  onChange={(v) => updateSettings({ eveningReminderMinute: v })}
                  colors={colors}
                />
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Floating Azkar Section */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIconWrap, { backgroundColor: colors.primary + "20" }]}>
            <Text style={{ fontSize: 20 }}>🤲</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {isArabic ? "التذكير العائم" : "Floating Reminder"}
            </Text>
            <Text style={[styles.sectionDesc, { color: colors.mutedForeground }]}>
              {isArabic ? "يظهر تذكير ذكر لطيف على شاشتك طوال اليوم" : "A gentle dhikr reminder appears on your screen throughout the day"}
            </Text>
          </View>
        </View>

        <View style={[styles.statusRow, { backgroundColor: colors.secondary, borderRadius: 10 }]}>
          <Text style={[styles.statusLabel, { color: colors.mutedForeground }]}>
            {isArabic ? "الحالة" : "Status"}
          </Text>
          <View style={[
            styles.statusBadge,
            { backgroundColor: settings.enabled ? colors.primary + "20" : colors.border },
          ]}>
            <View style={[
              styles.statusDot,
              { backgroundColor: settings.enabled ? colors.primary : colors.mutedForeground },
            ]} />
            <Text style={[styles.statusText, { color: settings.enabled ? colors.primary : colors.mutedForeground }]}>
              {settings.enabled ? (isArabic ? "مفعّل" : "Active") : (isArabic ? "معطّل" : "Off")}
            </Text>
          </View>
        </View>

        <View style={styles.floatBtnRow}>
          {settings.enabled && (
            <TouchableOpacity
              style={[styles.previewBtn, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}
              onPress={() => showNow()}
            >
              <MaterialCommunityIcons name="eye-outline" size={16} color={colors.primary} />
              <Text style={[styles.previewBtnText, { color: colors.primary }]}>
                {isArabic ? "معاينة الآن" : "Preview Now"}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.manageBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/custom-azkar")}
          >
            <MaterialCommunityIcons name="tune-variant" size={16} color={colors.primaryForeground} />
            <Text style={[styles.manageBtnText, { color: colors.primaryForeground }]}>
              {isArabic ? "إدارة وإعدادات" : "Manage & Settings"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:    { paddingHorizontal: 20, gap: 20 },
  headerRow:    { gap: 4, marginBottom: 4 },
  headerTitle:  { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  headerSub:    { fontSize: 14 },

  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  progressLabel: { fontSize: 12, fontWeight: "500" },
  progressBadges: { flexDirection: "row", gap: 8 },
  doneBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  doneBadgeText: { fontSize: 12, fontWeight: "700" },

  dailySection: { gap: 14 },
  dayCard:      { borderRadius: 20, overflow: "hidden", elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10 },
  dayCardGradient: { padding: 20 },
  dayCardContent:  { flexDirection: "row", alignItems: "center", gap: 14 },
  dayCardIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  dayCardTitle:    { fontSize: 18, fontWeight: "700", color: "#fff", marginBottom: 2 },
  dayCardDesc:     { fontSize: 12, color: "rgba(255,255,255,0.85)", lineHeight: 16 },

  section:        { borderRadius: 18, borderWidth: 1, padding: 16, gap: 14 },
  sectionHeader:  { flexDirection: "row", alignItems: "center", gap: 12 },
  sectionIconWrap:{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  sectionTitle:   { fontSize: 15, fontWeight: "700" },
  sectionDesc:    { fontSize: 12, lineHeight: 18, marginTop: 2 },

  divider: { height: StyleSheet.hairlineWidth },

  reminderBlock:      { gap: 10 },
  reminderToggleRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  reminderToggleLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  reminderLabel:      { fontSize: 14, fontWeight: "600" },

  timePicker:         { borderRadius: 12, borderWidth: 1, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  timePickerLabel:    { fontSize: 12, fontWeight: "500" },
  timePickerControls: { flexDirection: "row", alignItems: "center", gap: 8 },
  hourPickerRow:      { flexDirection: "row", alignItems: "center", gap: 8 },
  hourBtn:            { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  hourValue:          { fontSize: 18, fontWeight: "700", minWidth: 28, textAlign: "center" },
  timeSep:            { fontSize: 18, fontWeight: "700" },

  statusRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 10 },
  statusLabel: { fontSize: 13, fontWeight: "500" },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusDot:   { width: 7, height: 7, borderRadius: 4 },
  statusText:  { fontSize: 13, fontWeight: "600" },

  floatBtnRow:    { flexDirection: "row", gap: 10 },
  previewBtn:     { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, paddingVertical: 12, borderWidth: 1 },
  previewBtnText: { fontSize: 13, fontWeight: "600" },
  manageBtn:      { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, paddingVertical: 12 },
  manageBtnText:  { fontSize: 13, fontWeight: "600" },
});
