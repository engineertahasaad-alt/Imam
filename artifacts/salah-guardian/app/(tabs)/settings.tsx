import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import {
  CALCULATION_METHODS,
  CalculationMethod,
} from "@/lib/prayerCalculator";

const REMINDER_OFFSET_OPTIONS = [0, 5, 10, 15, 20, 30];
const TIME_OFFSET_OPTIONS = [-15, -10, -5, 0, 5, 10, 15];

const SENSITIVITY_LABELS: Record<number, string> = {
  1: "Very Stable — Fewest false detections",
  2: "Stable — Recommended for beginners",
  3: "Balanced — Default",
  4: "Responsive — Faster transitions",
  5: "Very Responsive — Fastest (more false positives)",
};

const STRENGTH_LABELS: Record<string, { label: string; hint: string }> = {
  low:    { label: "Gentle",  hint: "1 pulse" },
  medium: { label: "Strong",  hint: "2 pulses" },
  high:   { label: "Maximum", hint: "3–4 pulses" },
};

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, updateSettings, calibration } = useApp();

  const sensitivity       = settings.sensitivity       ?? 3;
  const vibrationStrength = settings.vibrationStrength ?? "high";
  const prayerOffset      = settings.prayerTimeOffsetMinutes ?? 0;

  async function changeMethod(method: CalculationMethod) {
    await updateSettings({ calculationMethod: method });
  }
  async function changeReminderOffset(offset: number) {
    await updateSettings({ reminderOffsetMinutes: offset });
  }
  async function changeSensitivity(s: number) {
    await updateSettings({ sensitivity: s });
  }
  async function changeStrength(s: "low" | "medium" | "high") {
    await updateSettings({ vibrationStrength: s });
  }
  async function changePrayerTimeOffset(offset: number) {
    await updateSettings({ prayerTimeOffsetMinutes: offset });
  }

  function resetOnboarding() {
    Alert.alert(
      "Reset App",
      "This will clear your onboarding status and restart the setup. Your prayer log will be kept.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            await updateSettings({ hasCompletedOnboarding: false });
            router.replace("/onboarding");
          },
        },
      ]
    );
  }

  const paddingBottom =
    Platform.OS === "web" ? insets.bottom + 84 : insets.bottom + 80;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16), paddingBottom },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>

      {/* ── Location ──────────────────────────────────────────────────────── */}
      <SettingsSection title="Location" colors={colors}>
        <SettingsRow colors={colors}>
          <Feather name="map-pin" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>City</Text>
            <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>
              {settings.cityName ?? "Not set"}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.changeBtn, { backgroundColor: colors.secondary }]}
            onPress={() => router.push("/onboarding/setup")}
          >
            <Text style={[styles.changeBtnText, { color: colors.foreground }]}>Change</Text>
          </TouchableOpacity>
        </SettingsRow>

        {settings.latitude && settings.longitude ? (
          <SettingsRow colors={colors}>
            <Feather name="globe" size={18} color={colors.mutedForeground} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>Coordinates</Text>
              <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>
                {settings.latitude.toFixed(4)}, {settings.longitude.toFixed(4)}
              </Text>
            </View>
          </SettingsRow>
        ) : null}
      </SettingsSection>

      {/* ── Prayer Time Offset ────────────────────────────────────────────── */}
      <SettingsSection title="Prayer Time Adjustment" colors={colors}>
        <View style={styles.insetSection}>
          <Text style={[styles.insetLabel, { color: colors.mutedForeground }]}>
            Shift all prayer times (minutes)
          </Text>
          <View style={styles.chipRow}>
            {TIME_OFFSET_OPTIONS.map((offset) => (
              <TouchableOpacity
                key={offset}
                style={[
                  styles.chip,
                  {
                    backgroundColor: prayerOffset === offset ? colors.primary : colors.secondary,
                    borderColor:     prayerOffset === offset ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => changePrayerTimeOffset(offset)}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: prayerOffset === offset ? colors.primaryForeground : colors.mutedForeground },
                  ]}
                >
                  {offset === 0 ? "0" : offset > 0 ? `+${offset}` : `${offset}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.insetHint, { color: colors.mutedForeground }]}>
            Use when your mosque uses slightly different times than calculated
          </Text>
        </View>
      </SettingsSection>

      {/* ── Calculation Method ─────────────────────────────────────────────── */}
      <SettingsSection title="Calculation Method" colors={colors}>
        {Object.entries(CALCULATION_METHODS).map(([key, val]) => (
          <TouchableOpacity
            key={key}
            style={[styles.methodItem, { backgroundColor: colors.card }]}
            onPress={() => changeMethod(key as CalculationMethod)}
          >
            <View
              style={[
                styles.radioOuter,
                { borderColor: settings.calculationMethod === key ? colors.primary : colors.border },
              ]}
            >
              {settings.calculationMethod === key && (
                <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.methodKey, { color: colors.foreground }]}>{key}</Text>
              <Text style={[styles.methodName, { color: colors.mutedForeground }]}>{val.name}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </SettingsSection>

      {/* ── Notifications ─────────────────────────────────────────────────── */}
      <SettingsSection title="Notifications" colors={colors}>
        <SettingsRow colors={colors}>
          <Feather name="bell" size={18} color={colors.primary} />
          <Text style={[styles.rowLabel, { color: colors.foreground }, { flex: 1 }]}>
            Prayer Reminders
          </Text>
          <Switch
            value={settings.notificationsEnabled}
            onValueChange={(val) => updateSettings({ notificationsEnabled: val })}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor="#fff"
          />
        </SettingsRow>

        {settings.notificationsEnabled && (
          <View style={styles.insetSection}>
            <Text style={[styles.insetLabel, { color: colors.mutedForeground }]}>
              Reminder delay after prayer time (minutes)
            </Text>
            <View style={styles.chipRow}>
              {REMINDER_OFFSET_OPTIONS.map((offset) => (
                <TouchableOpacity
                  key={offset}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: settings.reminderOffsetMinutes === offset ? colors.primary : colors.secondary,
                      borderColor:     settings.reminderOffsetMinutes === offset ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => changeReminderOffset(offset)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: settings.reminderOffsetMinutes === offset ? colors.primaryForeground : colors.mutedForeground },
                    ]}
                  >
                    {offset === 0 ? "Off" : `+${offset}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </SettingsSection>

      {/* ── Detection Sensitivity ─────────────────────────────────────────── */}
      <SettingsSection title="Detection Sensitivity" colors={colors}>
        <View style={styles.insetSection}>
          <View style={styles.sensitivityRow}>
            {[1, 2, 3, 4, 5].map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.sensitivityBtn,
                  {
                    backgroundColor: sensitivity === s ? colors.primary : colors.secondary,
                    borderColor:     sensitivity === s ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => changeSensitivity(s)}
              >
                <Text
                  style={[
                    styles.sensitivityNum,
                    { color: sensitivity === s ? colors.primaryForeground : colors.mutedForeground },
                  ]}
                >
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View
            style={[
              styles.sensitivityHintBox,
              { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" },
            ]}
          >
            <Text style={[styles.sensitivityHintText, { color: colors.primary }]}>
              {SENSITIVITY_LABELS[sensitivity]}
            </Text>
          </View>
        </View>
      </SettingsSection>

      {/* ── Vibration ─────────────────────────────────────────────────────── */}
      <SettingsSection title="Vibration Feedback" colors={colors}>
        <SettingsRow colors={colors}>
          <Feather name="volume-2" size={18} color={colors.primary} />
          <Text style={[styles.rowLabel, { color: colors.foreground }, { flex: 1 }]}>
            Haptic Feedback
          </Text>
          <Switch
            value={settings.vibrationEnabled}
            onValueChange={(val) => updateSettings({ vibrationEnabled: val })}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor="#fff"
          />
        </SettingsRow>

        {settings.vibrationEnabled && (
          <View style={styles.insetSection}>
            <Text style={[styles.insetLabel, { color: colors.mutedForeground }]}>
              Pattern strength (used while phone is in pocket)
            </Text>
            <View style={styles.chipRow}>
              {(["low", "medium", "high"] as const).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.strengthChip,
                    {
                      backgroundColor: vibrationStrength === s ? colors.primary : colors.secondary,
                      borderColor:     vibrationStrength === s ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => changeStrength(s)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: vibrationStrength === s ? colors.primaryForeground : colors.mutedForeground },
                    ]}
                  >
                    {STRENGTH_LABELS[s].label}
                  </Text>
                  <Text
                    style={[
                      styles.strengthHint,
                      { color: vibrationStrength === s ? colors.primaryForeground + "bb" : colors.mutedForeground + "80" },
                    ]}
                  >
                    {STRENGTH_LABELS[s].hint}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.insetHint, { color: colors.mutedForeground }]}>
              Short = correct posture   Long = adjust posture
            </Text>
          </View>
        )}
      </SettingsSection>

      {/* ── Motion Calibration ────────────────────────────────────────────── */}
      <SettingsSection title="Motion Calibration" colors={colors}>
        <SettingsRow colors={colors}>
          <Feather
            name="activity"
            size={18}
            color={calibration ? colors.primary : colors.mutedForeground}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>Calibration Status</Text>
            <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>
              {calibration
                ? `Calibrated ${new Date(calibration.calibratedAt).toLocaleDateString()}`
                : "Not calibrated (using defaults)"}
            </Text>
          </View>
        </SettingsRow>
        <TouchableOpacity
          style={[styles.calibrateBtn, { borderColor: colors.primary }]}
          onPress={() => router.push("/onboarding/calibration")}
        >
          <Feather name="refresh-cw" size={16} color={colors.primary} />
          <Text style={[styles.calibrateBtnText, { color: colors.primary }]}>Re-calibrate</Text>
        </TouchableOpacity>
      </SettingsSection>

      {/* ── About ─────────────────────────────────────────────────────────── */}
      <SettingsSection title="About" colors={colors}>
        <View style={[styles.aboutItem, { borderColor: colors.border }]}>
          <Text style={[styles.aboutLabel, { color: colors.mutedForeground }]}>Version</Text>
          <Text style={[styles.aboutValue, { color: colors.foreground }]}>1.0.0</Text>
        </View>
        <View style={[styles.aboutItem, { borderColor: colors.border }]}>
          <Text style={[styles.aboutLabel, { color: colors.mutedForeground }]}>Privacy</Text>
          <Text style={[styles.aboutValue, { color: colors.foreground }]}>No data collected</Text>
        </View>
        <View style={[styles.aboutItem, { borderColor: colors.border }]}>
          <Text style={[styles.aboutLabel, { color: colors.mutedForeground }]}>Sensors</Text>
          <Text style={[styles.aboutValue, { color: colors.foreground }]}>
            Accelerometer + Gyroscope
          </Text>
        </View>
      </SettingsSection>

      {/* ── Reset ─────────────────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[
          styles.resetBtn,
          { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "30" },
        ]}
        onPress={resetOnboarding}
      >
        <Feather name="refresh-ccw" size={16} color={colors.destructive} />
        <Text style={[styles.resetText, { color: colors.destructive }]}>Reset Setup</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function SettingsSection({
  title,
  children,
  colors,
}: {
  title: string;
  children: React.ReactNode;
  colors: any;
}) {
  return (
    <View style={sectionStyles.wrapper}>
      <Text style={[sectionStyles.title, { color: colors.mutedForeground }]}>
        {title.toUpperCase()}
      </Text>
      <View
        style={[sectionStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        {children}
      </View>
    </View>
  );
}

function SettingsRow({
  children,
  colors,
}: {
  children: React.ReactNode;
  colors: any;
}) {
  return (
    <View style={[rowStyles.row, { borderBottomColor: colors.border }]}>{children}</View>
  );
}

const sectionStyles = StyleSheet.create({
  wrapper: { gap: 8 },
  title:   { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, paddingLeft: 4 },
  card:    { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
});

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});

const styles = StyleSheet.create({
  container:    { paddingHorizontal: 20, gap: 20 },
  title:        { fontSize: 26, fontWeight: "700" },
  rowLabel:     { fontSize: 15, fontWeight: "500" },
  rowValue:     { fontSize: 12, marginTop: 2 },
  changeBtn:    { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  changeBtnText:{ fontSize: 13, fontWeight: "500" },

  insetSection: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  insetLabel:   { fontSize: 12 },
  insetHint:    { fontSize: 11, lineHeight: 16 },
  chipRow:      { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  chip:         { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  chipText:     { fontSize: 13, fontWeight: "600" },

  methodItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "transparent",
  },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  methodKey:  { fontSize: 14, fontWeight: "600" },
  methodName: { fontSize: 11, marginTop: 1 },

  sensitivityRow:     { flexDirection: "row", gap: 8 },
  sensitivityBtn:     { flex: 1, borderRadius: 10, borderWidth: 1, paddingVertical: 12, alignItems: "center" },
  sensitivityNum:     { fontSize: 17, fontWeight: "700" },
  sensitivityHintBox: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  sensitivityHintText:{ fontSize: 12, fontWeight: "500" },

  strengthChip: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, alignItems: "center", gap: 2 },
  strengthHint: { fontSize: 10 },

  calibrateBtn:     { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, margin: 16, marginTop: 4, justifyContent: "center" },
  calibrateBtnText: { fontSize: 14, fontWeight: "600" },

  aboutItem:  { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  aboutLabel: { fontSize: 14 },
  aboutValue: { fontSize: 14, fontWeight: "500" },

  resetBtn:   { borderRadius: 14, borderWidth: 1, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 },
  resetText:  { fontSize: 15, fontWeight: "600" },
});
