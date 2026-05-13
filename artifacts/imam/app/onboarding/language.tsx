import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  I18nManager,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const PERMISSIONS = [
  {
    icon: "map-pin" as const,
    color: "#34d399",
    en: "Location",
    ar: "الموقع",
    descEn: "For accurate prayer times based on your city",
    descAr: "لحساب أوقات الصلاة الدقيقة لمدينتك",
  },
  {
    icon: "bell" as const,
    color: "#60a5fa",
    en: "Notifications",
    ar: "الإشعارات",
    descEn: "For Adhan, prayer reminders and Azkar",
    descAr: "للأذان وتذكيرات الصلاة والأذكار",
  },
  {
    icon: "activity" as const,
    color: "#f59e0b",
    en: "Motion Sensors",
    ar: "مستشعرات الحركة",
    descEn: "Accelerometer & gyroscope — no camera, no microphone",
    descAr: "مقياس التسارع والجيروسكوب — لا كاميرا، لا ميكروفون",
  },
  {
    icon: "zap" as const,
    color: "#c084fc",
    en: "Battery Optimization",
    ar: "تحسين البطارية",
    descEn: "Disable battery optimization so reminders always work",
    descAr: "تعطيل تحسين البطارية حتى تعمل التذكيرات دائماً",
  },
];

export default function LanguageScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { updateSettings } = useApp();

  const [selected, setSelected] = useState<"en" | "ar" | null>(null);
  const [requesting, setRequesting] = useState(false);

  const isAr = selected === "ar";

  async function handleContinue() {
    if (!selected) return;
    setRequesting(true);
    try {
      I18nManager.forceRTL(selected === "ar");
      await updateSettings({ language: selected });
      if (Platform.OS !== "web") {
        await Notifications.requestPermissionsAsync().catch(() => {});
      }
    } catch { /* ignore */ } finally {
      setRequesting(false);
    }
    router.push("/onboarding/setup");
  }

  return (
    <LinearGradient
      colors={[colors.background, colors.background]}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 32),
            paddingBottom: insets.bottom + 32,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {isAr ? "اختر اللغة" : "Choose Language"}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {isAr ? "اختر اللغة المفضلة لديك" : "Select your preferred language"}
          </Text>
        </View>

        {/* Language Cards */}
        <View style={styles.langRow}>
          {(["en", "ar"] as const).map((lang) => {
            const active = selected === lang;
            return (
              <TouchableOpacity
                key={lang}
                activeOpacity={0.8}
                style={[
                  styles.langCard,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setSelected(lang)}
              >
                <Text style={[styles.langFlag, { fontSize: 36 }]}>
                  {lang === "en" ? "🇬🇧" : "🇸🇦"}
                </Text>
                <Text
                  style={[
                    styles.langName,
                    { color: active ? colors.primaryForeground : colors.foreground },
                  ]}
                >
                  {lang === "en" ? "English" : "العربية"}
                </Text>
                <Text
                  style={[
                    styles.langSub,
                    { color: active ? colors.primaryForeground + "cc" : colors.mutedForeground },
                  ]}
                >
                  {lang === "en" ? "Left to right" : "من اليمين لليسار"}
                </Text>
                {active && (
                  <View style={[styles.checkBadge, { backgroundColor: "rgba(255,255,255,0.25)" }]}>
                    <Feather name="check" size={14} color={colors.primaryForeground} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Permissions explanation */}
        <View style={[styles.permSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.permHeader}>
            <Feather name="shield" size={16} color={colors.primary} />
            <Text style={[styles.permTitle, { color: colors.foreground }]}>
              {isAr ? "الأذونات المطلوبة" : "Permissions Needed"}
            </Text>
          </View>
          <Text style={[styles.permIntro, { color: colors.mutedForeground }]}>
            {isAr
              ? "سيطلب التطبيق هذه الأذونات لضمان عمله بشكل كامل:"
              : "The app will request these permissions to work properly:"}
          </Text>
          {PERMISSIONS.map((p) => (
            <View key={p.en} style={styles.permRow}>
              <View style={[styles.permIcon, { backgroundColor: p.color + "20" }]}>
                <Feather name={p.icon} size={14} color={p.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.permName, { color: colors.foreground }]}>
                  {isAr ? p.ar : p.en}
                </Text>
                <Text style={[styles.permDesc, { color: colors.mutedForeground }]}>
                  {isAr ? p.descAr : p.descEn}
                </Text>
              </View>
            </View>
          ))}
          <View style={[styles.privacyNote, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
            <Feather name="lock" size={13} color={colors.primary} />
            <Text style={[styles.privacyText, { color: colors.primary }]}>
              {isAr
                ? "جميع البيانات تبقى على جهازك. لا يُرسَل أي شيء عبر الإنترنت."
                : "All data stays on your device. Nothing is sent over the internet."}
            </Text>
          </View>
        </View>

        {/* Continue button */}
        <TouchableOpacity
          style={[
            styles.continueBtn,
            {
              backgroundColor: selected ? colors.primary : colors.border,
              opacity: selected ? 1 : 0.6,
            },
          ]}
          onPress={handleContinue}
          disabled={!selected || requesting}
          activeOpacity={0.8}
        >
          <Text style={[styles.continueBtnText, { color: colors.primaryForeground }]}>
            {requesting
              ? (isAr ? "جاري..." : "Please wait...")
              : (isAr ? "متابعة" : "Continue")}
          </Text>
          {!requesting && (
            <Feather name="arrow-right" size={20} color={colors.primaryForeground} />
          )}
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 24, gap: 20 },

  titleSection: { alignItems: "center", gap: 6 },
  title:        { fontSize: 26, fontWeight: "700", letterSpacing: -0.5 },
  subtitle:     { fontSize: 14 },

  langRow: { flexDirection: "row", gap: 14 },
  langCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 2,
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  langFlag: {},
  langName: { fontSize: 17, fontWeight: "700" },
  langSub:  { fontSize: 11, textAlign: "center" },
  checkBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  permSection: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  permHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  permTitle: { fontSize: 15, fontWeight: "700" },
  permIntro: { fontSize: 12, lineHeight: 18, marginTop: -4 },
  permRow:   { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  permIcon:  {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  permName: { fontSize: 13, fontWeight: "600" },
  permDesc: { fontSize: 11, lineHeight: 16, marginTop: 1 },
  privacyNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginTop: 2,
  },
  privacyText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: "500" },

  continueBtn: {
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 4,
  },
  continueBtnText: { fontSize: 17, fontWeight: "700" },
});
