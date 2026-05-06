import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
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

const OFFSET_OPTIONS = [0, 5, 10, 15, 20, 30];

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, updateSettings, calibration } = useApp();

  async function toggleNotifications(val: boolean) {
    await updateSettings({ notificationsEnabled: val });
  }

  async function toggleVibration(val: boolean) {
    await updateSettings({ vibrationEnabled: val });
  }

  async function changeMethod(method: CalculationMethod) {
    await updateSettings({ calculationMethod: method });
  }

  async function changeOffset(offset: number) {
    await updateSettings({ reminderOffsetMinutes: offset });
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
        {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
          paddingBottom,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>
        Settings
      </Text>

      {/* Location */}
      <SettingsSection title="Location" colors={colors}>
        <SettingsRow colors={colors}>
          <Feather name="map-pin" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>
              City
            </Text>
            <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>
              {settings.cityName ?? "Not set"}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.changeBtn,
              { backgroundColor: colors.secondary },
            ]}
            onPress={() => router.push("/onboarding/setup")}
          >
            <Text style={[styles.changeBtnText, { color: colors.foreground }]}>
              Change
            </Text>
          </TouchableOpacity>
        </SettingsRow>

        {settings.latitude && settings.longitude ? (
          <SettingsRow colors={colors}>
            <Feather name="globe" size={18} color={colors.mutedForeground} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>
                Coordinates
              </Text>
              <Text
                style={[styles.rowValue, { color: colors.mutedForeground }]}
              >
                {settings.latitude.toFixed(4)}, {settings.longitude.toFixed(4)}
              </Text>
            </View>
          </SettingsRow>
        ) : null}
      </SettingsSection>

      {/* Calculation Method */}
      <SettingsSection title="Calculation Method" colors={colors}>
        {Object.entries(CALCULATION_METHODS).map(([key, val]) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.methodItem,
              {
                backgroundColor: colors.card,
              },
            ]}
            onPress={() => changeMethod(key as CalculationMethod)}
          >
            <View
              style={[
                styles.radioOuter,
                {
                  borderColor:
                    settings.calculationMethod === key
                      ? colors.primary
                      : colors.border,
                },
              ]}
            >
              {settings.calculationMethod === key && (
                <View
                  style={[
                    styles.radioInner,
                    { backgroundColor: colors.primary },
                  ]}
                />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.methodKey, { color: colors.foreground }]}>
                {key}
              </Text>
              <Text
                style={[styles.methodName, { color: colors.mutedForeground }]}
              >
                {val.name}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </SettingsSection>

      {/* Notifications */}
      <SettingsSection title="Notifications" colors={colors}>
        <SettingsRow colors={colors}>
          <Feather name="bell" size={18} color={colors.primary} />
          <Text style={[styles.rowLabel, { color: colors.foreground }, { flex: 1 }]}>
            Prayer Reminders
          </Text>
          <Switch
            value={settings.notificationsEnabled}
            onValueChange={toggleNotifications}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor="#fff"
          />
        </SettingsRow>

        {settings.notificationsEnabled && (
          <View style={styles.offsetSection}>
            <Text
              style={[styles.offsetLabel, { color: colors.mutedForeground }]}
            >
              Reminder after prayer time (minutes)
            </Text>
            <View style={styles.offsetRow}>
              {OFFSET_OPTIONS.map((offset) => (
                <TouchableOpacity
                  key={offset}
                  style={[
                    styles.offsetChip,
                    {
                      backgroundColor:
                        settings.reminderOffsetMinutes === offset
                          ? colors.primary
                          : colors.secondary,
                      borderColor:
                        settings.reminderOffsetMinutes === offset
                          ? colors.primary
                          : colors.border,
                    },
                  ]}
                  onPress={() => changeOffset(offset)}
                >
                  <Text
                    style={[
                      styles.offsetText,
                      {
                        color:
                          settings.reminderOffsetMinutes === offset
                            ? colors.primaryForeground
                            : colors.mutedForeground,
                      },
                    ]}
                  >
                    {offset === 0 ? "Off" : `+${offset}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <SettingsRow colors={colors}>
          <Feather name="volume-2" size={18} color={colors.primary} />
          <Text style={[styles.rowLabel, { color: colors.foreground }, { flex: 1 }]}>
            Vibration
          </Text>
          <Switch
            value={settings.vibrationEnabled}
            onValueChange={toggleVibration}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor="#fff"
          />
        </SettingsRow>
      </SettingsSection>

      {/* Calibration info */}
      <SettingsSection title="Motion Calibration" colors={colors}>
        <SettingsRow colors={colors}>
          <Feather name="activity" size={18} color={calibration ? colors.primary : colors.mutedForeground} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>
              Calibration Status
            </Text>
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
          <Text style={[styles.calibrateBtnText, { color: colors.primary }]}>
            Re-calibrate
          </Text>
        </TouchableOpacity>
      </SettingsSection>

      {/* About */}
      <SettingsSection title="About" colors={colors}>
        <View style={[styles.aboutItem, { borderColor: colors.border }]}>
          <Text style={[styles.aboutLabel, { color: colors.mutedForeground }]}>
            Version
          </Text>
          <Text style={[styles.aboutValue, { color: colors.foreground }]}>
            1.0.0
          </Text>
        </View>
        <View style={[styles.aboutItem, { borderColor: colors.border }]}>
          <Text style={[styles.aboutLabel, { color: colors.mutedForeground }]}>
            Privacy
          </Text>
          <Text style={[styles.aboutValue, { color: colors.foreground }]}>
            No data collected
          </Text>
        </View>
      </SettingsSection>

      {/* Reset */}
      <TouchableOpacity
        style={[
          styles.resetBtn,
          { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "30" },
        ]}
        onPress={resetOnboarding}
      >
        <Feather name="refresh-ccw" size={16} color={colors.destructive} />
        <Text style={[styles.resetText, { color: colors.destructive }]}>
          Reset Setup
        </Text>
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
    <View style={settingsSectionStyles.wrapper}>
      <Text
        style={[settingsSectionStyles.title, { color: colors.mutedForeground }]}
      >
        {title.toUpperCase()}
      </Text>
      <View
        style={[
          settingsSectionStyles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
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
    <View
      style={[settingsRowStyles.row, { borderBottomColor: colors.border }]}
    >
      {children}
    </View>
  );
}

const settingsSectionStyles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  title: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    paddingLeft: 4,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
});

const settingsRowStyles = StyleSheet.create({
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
  container: {
    paddingHorizontal: 20,
    gap: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: "500",
  },
  rowValue: {
    fontSize: 12,
    marginTop: 2,
  },
  changeBtn: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  changeBtnText: {
    fontSize: 13,
    fontWeight: "500",
  },
  methodItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "transparent",
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  methodKey: {
    fontSize: 14,
    fontWeight: "600",
  },
  methodName: {
    fontSize: 11,
    marginTop: 1,
  },
  offsetSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  offsetLabel: {
    fontSize: 12,
  },
  offsetRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  offsetChip: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  offsetText: {
    fontSize: 13,
    fontWeight: "600",
  },
  calibrateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    margin: 16,
    marginTop: 4,
    justifyContent: "center",
  },
  calibrateBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  aboutItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  aboutLabel: {
    fontSize: 14,
  },
  aboutValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  resetBtn: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 8,
  },
  resetText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
