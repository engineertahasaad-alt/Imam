import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Alert,
  I18nManager,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { useAzkar } from "@/context/AzkarContext";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "@/hooks/useTranslation";
import {
  ADHAN_VOICE_LABELS,
  testAdhanPreview,
} from "@/lib/adhanEngine";
import { requestCriticalPermissions } from "@/lib/adhanScheduler";
import {
  CALCULATION_METHODS,
  CalculationMethod,
} from "@/lib/prayerCalculator";
import type { AdhanVoice } from "@/lib/storage";

const TAB_H = Platform.OS === "web" ? 84 : 62;

const REMINDER_OFFSET_OPTIONS = [0, 5, 10, 15, 20, 30];
const TIME_OFFSET_OPTIONS     = [-15, -10, -5, 0, 5, 10, 15];

const SENSITIVITY_LABELS_EN: Record<number, string> = {
  1: "Very Stable — Fewest false detections",
  2: "Stable — Recommended for beginners",
  3: "Balanced — Default",
  4: "Responsive — Faster transitions",
  5: "Very Responsive — Fastest (more false positives)",
};

const SENSITIVITY_LABELS_AR: Record<number, string> = {
  1: "مستقر جداً — أقل اكتشافات خاطئة",
  2: "مستقر — موصى للمبتدئين",
  3: "متوازن — افتراضي",
  4: "متجاوب — انتقالات أسرع",
  5: "متجاوب جداً — الأسرع (قد يخطئ أكثر)",
};

const STRENGTH_LABELS_EN: Record<string, { label: string; hint: string }> = {
  low:    { label: "Gentle",  hint: "1 pulse" },
  medium: { label: "Strong",  hint: "2 pulses" },
  high:   { label: "Maximum", hint: "3–4 pulses" },
};

const STRENGTH_LABELS_AR: Record<string, { label: string; hint: string }> = {
  low:    { label: "خفيف",  hint: "نبضة" },
  medium: { label: "قوي",   hint: "نبضتان" },
  high:   { label: "أقصى",  hint: "3–4 نبضات" },
};

const FREQUENCY_OPTIONS = [5, 10, 15, 20, 30];
const DISPLAY_OPTIONS   = [3, 5, 8, 10];

export default function SettingsScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { t, isArabic } = useTranslation();
  const { settings, updateSettings, calibration, saveCalibrationData } = useApp();
  const { settings: azkar, updateSettings: updateAzkar, showNow } = useAzkar();

  const sensitivity       = settings.sensitivity       ?? 3;
  const vibrationStrength = settings.vibrationStrength ?? "high";
  const prayerOffset      = settings.prayerTimeOffsetMinutes ?? 0;
  const [nameInput, setNameInput] = React.useState(settings.userName ?? "");

  const SENSITIVITY_LABELS = isArabic ? SENSITIVITY_LABELS_AR : SENSITIVITY_LABELS_EN;
  const STRENGTH_LABELS    = isArabic ? STRENGTH_LABELS_AR    : STRENGTH_LABELS_EN;

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

  const adhanEnabled = settings.adhanEnabled  ?? false;
  const adhanVoice   = (settings.adhanVoice   ?? "alafasy") as AdhanVoice;
  const adhanVolume  = settings.adhanVolume   ?? 0.8;

  async function changeAdhanEnabled(val: boolean) {
    await updateSettings({ adhanEnabled: val });
  }
  async function changeAdhanVoice(voice: AdhanVoice) {
    await updateSettings({ adhanVoice: voice });
  }
  async function changeAdhanVolume(vol: number) {
    await updateSettings({ adhanVolume: vol });
  }
  async function handleTestAdhan() {
    await testAdhanPreview(adhanVoice, adhanVolume);
  }

  async function handleLanguageChange(lang: "en" | "ar") {
    I18nManager.forceRTL(lang === "ar");
    await updateSettings({ language: lang });
    if (Platform.OS !== "web") {
      Alert.alert(
        lang === "ar" ? "تم تغيير اللغة" : "Language Changed",
        lang === "ar"
          ? "أعد تشغيل التطبيق لتطبيق تخطيط العربية الكامل."
          : "Please restart the app to apply the full layout change.",
        [{ text: lang === "ar" ? "حسناً" : "OK" }]
      );
    }
  }

  function resetOnboarding() {
    Alert.alert(
      isArabic ? "إعادة الإعداد" : "Reset App",
      isArabic
        ? "سيؤدي هذا إلى مسح حالة الإعداد وإعادة التشغيل. سيتم الاحتفاظ بسجل صلاتك."
        : "This will clear your onboarding status and restart the setup. Your prayer log will be kept.",
      [
        { text: isArabic ? "إلغاء" : "Cancel", style: "cancel" },
        {
          text: isArabic ? "إعادة" : "Reset",
          style: "destructive",
          onPress: async () => {
            await updateSettings({ hasCompletedOnboarding: false });
            router.replace("/onboarding");
          },
        },
      ]
    );
  }

  const paddingBottom = TAB_H + insets.bottom;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16), paddingBottom },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>{t("s_settings")}</Text>

      {/* ── Profile ───────────────────────────────────────────────────────── */}
      <SettingsSection title={t("s_profile")} colors={colors}>
        <SettingsRow colors={colors}>
          <Feather name="user" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>{t("s_your_name")}</Text>
            <TextInput
              style={[styles.nameField, { color: colors.foreground, borderColor: colors.border }]}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder={t("s_name_ph")}
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="words"
              returnKeyType="done"
              onEndEditing={() =>
                updateSettings({ userName: nameInput.trim() || undefined })
              }
            />
          </View>
        </SettingsRow>
      </SettingsSection>

      {/* ── Location ──────────────────────────────────────────────────────── */}
      <SettingsSection title={t("s_location")} colors={colors}>
        <SettingsRow colors={colors}>
          <Feather name="map-pin" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>{t("s_city")}</Text>
            <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>
              {settings.cityName ?? t("s_not_set")}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.changeBtn, { backgroundColor: colors.secondary }]}
            onPress={() => router.push("/onboarding/setup")}
          >
            <Text style={[styles.changeBtnText, { color: colors.foreground }]}>{t("s_change")}</Text>
          </TouchableOpacity>
        </SettingsRow>

        {settings.latitude && settings.longitude ? (
          <SettingsRow colors={colors}>
            <Feather name="globe" size={18} color={colors.mutedForeground} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>{t("s_coordinates")}</Text>
              <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>
                {settings.latitude.toFixed(4)}, {settings.longitude.toFixed(4)}
              </Text>
            </View>
          </SettingsRow>
        ) : null}
      </SettingsSection>

      {/* ── Prayer Time Offset ────────────────────────────────────────────── */}
      <SettingsSection title={t("s_prayer_adj")} colors={colors}>
        <View style={styles.insetSection}>
          <Text style={[styles.insetLabel, { color: colors.mutedForeground }]}>
            {t("s_shift_times")}
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
            {t("s_shift_hint")}
          </Text>
        </View>
      </SettingsSection>

      {/* ── Calculation Method ─────────────────────────────────────────────── */}
      <SettingsSection title={t("s_calc_method")} colors={colors}>
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
      <SettingsSection title={t("s_notifications")} colors={colors}>
        <SettingsRow colors={colors}>
          <Feather name="bell" size={18} color={colors.primary} />
          <Text style={[styles.rowLabel, { color: colors.foreground }, { flex: 1 }]}>
            {t("s_prayer_reminders")}
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
              {t("s_reminder_delay")}
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

      {/* ── Adhan ──────────────────────────────────────────────────────────── */}
      <SettingsSection title={t("s_adhan")} colors={colors}>
        <SettingsRow colors={colors}>
          <Feather name="volume-2" size={18} color={colors.primary} />
          <Text style={[styles.rowLabel, { color: colors.foreground }, { flex: 1 }]}>
            {t("s_auto_adhan")}
          </Text>
          <Switch
            value={adhanEnabled}
            onValueChange={changeAdhanEnabled}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor="#fff"
          />
        </SettingsRow>

        {adhanEnabled && (
          <>
            <View style={styles.insetSection}>
              <Text style={[styles.insetLabel, { color: colors.mutedForeground }]}>
                {t("s_adhan_voice")}
              </Text>
              {(Object.entries(ADHAN_VOICE_LABELS) as [AdhanVoice, string][]).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.methodItem, { backgroundColor: colors.card }]}
                  onPress={() => changeAdhanVoice(key)}
                >
                  <View
                    style={[
                      styles.radioOuter,
                      { borderColor: adhanVoice === key ? colors.primary : colors.border },
                    ]}
                  >
                    {adhanVoice === key && (
                      <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
                    )}
                  </View>
                  <Text style={[styles.methodKey, { color: colors.foreground }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.insetSection}>
              <Text style={[styles.insetLabel, { color: colors.mutedForeground }]}>
                {t("s_volume")}
              </Text>
              <View style={styles.chipRow}>
                {[0.2, 0.4, 0.6, 0.8, 1.0].map((vol) => (
                  <TouchableOpacity
                    key={vol}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: Math.abs(adhanVolume - vol) < 0.05 ? colors.primary : colors.secondary,
                        borderColor:     Math.abs(adhanVolume - vol) < 0.05 ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => changeAdhanVolume(vol)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: Math.abs(adhanVolume - vol) < 0.05 ? colors.primaryForeground : colors.mutedForeground },
                      ]}
                    >
                      {Math.round(vol * 100)}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.insetHint, { color: colors.mutedForeground }]}>
                {t("s_adhan_hint")}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.calibrateBtn, { borderColor: colors.primary }]}
              onPress={handleTestAdhan}
            >
              <Feather name="play" size={16} color={colors.primary} />
              <Text style={[styles.calibrateBtnText, { color: colors.primary }]}>{t("s_test_adhan")}</Text>
            </TouchableOpacity>

            {Platform.OS === "android" && (
              <TouchableOpacity
                style={[styles.calibrateBtn, { borderColor: "#f59e0b", marginTop: 0 }]}
                onPress={requestCriticalPermissions}
              >
                <Feather name="shield" size={16} color="#f59e0b" />
                <Text style={[styles.calibrateBtnText, { color: "#f59e0b" }]}>
                  {isArabic ? "إصلاح موثوقية الأذان" : "Fix Adhan Reliability"}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </SettingsSection>

      {/* ── Detection Sensitivity ─────────────────────────────────────────── */}
      <SettingsSection title={t("s_detection_sens")} colors={colors}>
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
      <SettingsSection title={t("s_vibration_sec")} colors={colors}>
        <SettingsRow colors={colors}>
          <Feather name="volume-2" size={18} color={colors.primary} />
          <Text style={[styles.rowLabel, { color: colors.foreground }, { flex: 1 }]}>
            {t("s_haptic")}
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
              {t("s_vibration_pattern")}
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
              {t("s_vibration_hint")}
            </Text>
          </View>
        )}
      </SettingsSection>

      {/* ── Motion Calibration ────────────────────────────────────────────── */}
      <SettingsSection title={t("s_motion_calib")} colors={colors}>
        <SettingsRow colors={colors}>
          <Feather
            name="activity"
            size={18}
            color={calibration ? colors.primary : colors.mutedForeground}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>{t("s_calib_status")}</Text>
            <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>
              {calibration
                ? `${t("s_calibrated_at")} ${new Date(calibration.calibratedAt).toLocaleDateString()}`
                : t("s_not_calibrated")}
            </Text>
          </View>
        </SettingsRow>

        {calibration && (
          <SettingsRow colors={colors}>
            <Feather name="smartphone" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>{t("s_pocket_side")}</Text>
              <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>
                {calibration.pocketSide === "left"  ? t("s_left_pocket")  :
                 calibration.pocketSide === "right" ? t("s_right_pocket") :
                                                      t("s_not_set")}
              </Text>
            </View>
            <View style={styles.pocketToggleRow}>
              {(["left", "right"] as const).map((side) => {
                const active = calibration.pocketSide === side;
                return (
                  <TouchableOpacity
                    key={side}
                    style={[
                      styles.pocketBtn,
                      {
                        backgroundColor: active ? colors.primary  : colors.secondary,
                        borderColor:     active ? colors.primary  : colors.border,
                      },
                    ]}
                    onPress={async () => {
                      await saveCalibrationData({ ...calibration, pocketSide: side });
                    }}
                  >
                    <Text style={[styles.pocketBtnText, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>
                      {side === "left" ? "L" : "R"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </SettingsRow>
        )}

        <TouchableOpacity
          style={[styles.calibrateBtn, { borderColor: colors.primary }]}
          onPress={() => router.push("/onboarding/calibration")}
        >
          <Feather name="refresh-cw" size={16} color={colors.primary} />
          <Text style={[styles.calibrateBtnText, { color: colors.primary }]}>{t("s_recalibrate")}</Text>
        </TouchableOpacity>
      </SettingsSection>

      {/* ── Azkar Overlay ─────────────────────────────────────────────────── */}
      <SettingsSection title={t("s_azkar")} colors={colors}>
        <SettingsRow colors={colors}>
          <Text style={{ fontSize: 18 }}>🤲</Text>
          <Text style={[styles.rowLabel, { color: colors.foreground, flex: 1 }]}>
            {t("s_azkar_overlay")}
          </Text>
          <Switch
            value={azkar.enabled}
            onValueChange={(v) => updateAzkar({ enabled: v })}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor="#fff"
          />
        </SettingsRow>

        {azkar.enabled && (
          <>
            {/* Frequency */}
            <View style={styles.insetSection}>
              <Text style={[styles.insetLabel, { color: colors.mutedForeground }]}>
                {t("s_show_every")}
              </Text>
              <View style={styles.chipRow}>
                {FREQUENCY_OPTIONS.map((min) => (
                  <TouchableOpacity
                    key={min}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: azkar.frequencyMinutes === min ? colors.primary : colors.secondary,
                        borderColor:     azkar.frequencyMinutes === min ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => updateAzkar({ frequencyMinutes: min })}
                  >
                    <Text style={[styles.chipText, { color: azkar.frequencyMinutes === min ? colors.primaryForeground : colors.mutedForeground }]}>
                      {min}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Display duration */}
            <View style={styles.insetSection}>
              <Text style={[styles.insetLabel, { color: colors.mutedForeground }]}>
                {t("s_display_dur")}
              </Text>
              <View style={styles.chipRow}>
                {DISPLAY_OPTIONS.map((sec) => (
                  <TouchableOpacity
                    key={sec}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: azkar.displaySeconds === sec ? colors.primary : colors.secondary,
                        borderColor:     azkar.displaySeconds === sec ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => updateAzkar({ displaySeconds: sec })}
                  >
                    <Text style={[styles.chipText, { color: azkar.displaySeconds === sec ? colors.primaryForeground : colors.mutedForeground }]}>
                      {sec}s
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Font size */}
            <View style={styles.insetSection}>
              <Text style={[styles.insetLabel, { color: colors.mutedForeground }]}>
                {t("s_font_size")}
              </Text>
              <View style={styles.chipRow}>
                {(["small", "medium", "large"] as const).map((sz) => (
                  <TouchableOpacity
                    key={sz}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: azkar.fontSize === sz ? colors.primary : colors.secondary,
                        borderColor:     azkar.fontSize === sz ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => updateAzkar({ fontSize: sz })}
                  >
                    <Text style={[styles.chipText, { color: azkar.fontSize === sz ? colors.primaryForeground : colors.mutedForeground }]}>
                      {sz === "small" ? "S" : sz === "medium" ? "M" : "L"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Position */}
            <View style={styles.insetSection}>
              <Text style={[styles.insetLabel, { color: colors.mutedForeground }]}>
                {t("s_screen_side")}
              </Text>
              <View style={styles.chipRow}>
                {(["left", "right"] as const).map((side) => (
                  <TouchableOpacity
                    key={side}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: azkar.position === side ? colors.primary : colors.secondary,
                        borderColor:     azkar.position === side ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => updateAzkar({ position: side })}
                  >
                    <Text style={[styles.chipText, { color: azkar.position === side ? colors.primaryForeground : colors.mutedForeground }]}>
                      {side === "left" ? t("s_side_left") : t("s_side_right")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.insetHint, { color: colors.mutedForeground }]}>
                {t("s_drag_hint")}
              </Text>
            </View>

            {/* Opacity */}
            <View style={styles.insetSection}>
              <Text style={[styles.insetLabel, { color: colors.mutedForeground }]}>
                {t("s_opacity")}
              </Text>
              <View style={styles.chipRow}>
                {[0.6, 0.75, 0.9, 1.0].map((op) => (
                  <TouchableOpacity
                    key={op}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: Math.abs(azkar.opacity - op) < 0.05 ? colors.primary : colors.secondary,
                        borderColor:     Math.abs(azkar.opacity - op) < 0.05 ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => updateAzkar({ opacity: op })}
                  >
                    <Text style={[styles.chipText, { color: Math.abs(azkar.opacity - op) < 0.05 ? colors.primaryForeground : colors.mutedForeground }]}>
                      {Math.round(op * 100)}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Soft vibration toggle */}
            <SettingsRow colors={colors}>
              <Feather name="wind" size={18} color={colors.primary} />
              <Text style={[styles.rowLabel, { color: colors.foreground, flex: 1 }]}>
                {t("s_soft_vib")}
              </Text>
              <Switch
                value={azkar.vibration}
                onValueChange={(v) => updateAzkar({ vibration: v })}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor="#fff"
              />
            </SettingsRow>

            {/* Background notifications toggle */}
            <SettingsRow colors={colors}>
              <Feather name="bell" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: colors.foreground }]}>
                  {t("s_bg_reminders")}
                </Text>
                <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>
                  {t("s_bg_reminders_desc")}
                </Text>
              </View>
              <Switch
                value={azkar.backgroundNotifications}
                onValueChange={(v) => updateAzkar({ backgroundNotifications: v })}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor="#fff"
              />
            </SettingsRow>

            {/* Preview button */}
            <TouchableOpacity
              style={[styles.calibrateBtn, { borderColor: colors.primary }]}
              onPress={showNow}
            >
              <Text style={{ fontSize: 14 }}>🤲</Text>
              <Text style={[styles.calibrateBtnText, { color: colors.primary }]}>{t("s_preview_widget")}</Text>
            </TouchableOpacity>

            {/* Custom azkar management */}
            <TouchableOpacity
              style={[styles.calibrateBtn, { borderColor: colors.border }]}
              onPress={() => router.push("/custom-azkar")}
            >
              <Feather name="plus-circle" size={16} color={colors.foreground} />
              <Text style={[styles.calibrateBtnText, { color: colors.foreground }]}>{t("s_manage_azkar")}</Text>
            </TouchableOpacity>
          </>
        )}
      </SettingsSection>

      {/* ── Language ──────────────────────────────────────────────────────── */}
      <SettingsSection title={t("s_language")} colors={colors}>
        <View style={styles.insetSection}>
          <View style={[styles.chipRow, { gap: 10 }]}>
            {(["en", "ar"] as const).map((lang) => {
              const isActive = (settings.language ?? "en") === lang;
              return (
                <TouchableOpacity
                  key={lang}
                  style={[
                    styles.chip,
                    {
                      flex: 1,
                      paddingVertical: 10,
                      alignItems: "center",
                      backgroundColor: isActive ? colors.primary : colors.secondary,
                      borderColor:     isActive ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => handleLanguageChange(lang)}
                >
                  <Text style={[styles.chipText, { color: isActive ? colors.primaryForeground : colors.mutedForeground }]}>
                    {lang === "en" ? "English" : "العربية"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[styles.insetHint, { color: colors.mutedForeground }]}>
            {t("s_language_note")}
          </Text>
        </View>
      </SettingsSection>

      {/* ── Appearance / Theme ────────────────────────────────────────────── */}
      <SettingsSection title={t("s_theme")} colors={colors}>
        <View style={styles.insetSection}>
          <View style={[styles.chipRow, { gap: 8 }]}>
            {(["light", "dark", "system"] as const).map((thm) => {
              const isActive = (settings.theme ?? "system") === thm;
              const icon = thm === "light" ? "☀️" : thm === "dark" ? "🌙" : "⚙️";
              const label = t(thm === "light" ? "s_theme_light" : thm === "dark" ? "s_theme_dark" : "s_theme_system");
              return (
                <TouchableOpacity
                  key={thm}
                  style={[
                    styles.chip,
                    {
                      flex: 1,
                      paddingVertical: 12,
                      alignItems: "center",
                      gap: 4,
                      backgroundColor: isActive ? colors.primary : colors.secondary,
                      borderColor:     isActive ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => updateSettings({ theme: thm })}
                >
                  <Text style={{ fontSize: 18 }}>{icon}</Text>
                  <Text style={[styles.chipText, { fontSize: 12, color: isActive ? colors.primaryForeground : colors.mutedForeground }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </SettingsSection>

      {/* ── About ─────────────────────────────────────────────────────────── */}
      <SettingsSection title={t("s_about")} colors={colors}>
        <View style={[styles.aboutItem, { borderColor: colors.border }]}>
          <Text style={[styles.aboutLabel, { color: colors.mutedForeground }]}>{t("s_version")}</Text>
          <Text style={[styles.aboutValue, { color: colors.foreground }]}>1.0.0</Text>
        </View>
        <View style={[styles.aboutItem, { borderColor: colors.border }]}>
          <Text style={[styles.aboutLabel, { color: colors.mutedForeground }]}>{t("s_privacy")}</Text>
          <Text style={[styles.aboutValue, { color: colors.foreground }]}>{t("s_no_data")}</Text>
        </View>
        <View style={[styles.aboutItem, { borderColor: colors.border }]}>
          <Text style={[styles.aboutLabel, { color: colors.mutedForeground }]}>{t("s_sensors")}</Text>
          <Text style={[styles.aboutValue, { color: colors.foreground }]}>{t("s_accel_gyro")}</Text>
        </View>
        <TouchableOpacity
          style={[styles.aboutItem, { borderColor: colors.border }]}
          onPress={() => router.push("/debug-notifications")}
        >
          <Text style={[styles.aboutLabel, { color: colors.mutedForeground }]}>
            {isArabic ? "فحص الإشعارات المجدولة" : "Scheduled Notifications Debug"}
          </Text>
          <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
        </TouchableOpacity>
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
        <Text style={[styles.resetText, { color: colors.destructive }]}>{t("s_reset")}</Text>
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
        {title}
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
  nameField:    {
    fontSize: 14, marginTop: 6, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
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

  pocketToggleRow: { flexDirection: "row", gap: 6 },
  pocketBtn:       { width: 36, height: 36, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  pocketBtnText:   { fontSize: 14, fontWeight: "800" },

  calibrateBtn:     { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, margin: 16, marginTop: 4, justifyContent: "center" },
  calibrateBtnText: { fontSize: 14, fontWeight: "600" },

  aboutItem:  { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  aboutLabel: { fontSize: 14 },
  aboutValue: { fontSize: 14, fontWeight: "500" },

  resetBtn:  { borderRadius: 14, borderWidth: 1, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 },
  resetText: { fontSize: 15, fontWeight: "600" },
});
