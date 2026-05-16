import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  AppState,
  AppStateStatus,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useTranslation } from "@/hooks/useTranslation";
import {
  checkPermissions,
  openBatteryOptimizationSettings,
  openExactAlarmSettings,
  openNotificationSettings,
  openOverlaySettings,
  PermStatus,
  requestNotificationPermission,
} from "@/lib/permissions";

type AnyStatus = PermStatus | "needs_setup";

interface PermItem {
  key:         string;
  icon:        React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  color:       string;
  titleEn:     string;
  titleAr:     string;
  whyEn:       string;
  whyAr:       string;
  essential:   boolean;
  status:      AnyStatus;
  btnEn:       string;
  btnAr:       string;
  onAction:    () => Promise<void>;
}

export default function PermissionsScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { isArabic } = useTranslation();

  const [notifStatus, setNotifStatus] = useState<PermStatus>("unknown");
  // Track which Android-only permissions the user has tapped "configure"
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [working, setWorking] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { notifications } = await checkPermissions();
    setNotifStatus(notifications);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s: AppStateStatus) => {
      if (s === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  async function run(key: string, action: () => Promise<void>) {
    setWorking(key);
    try { await action(); } catch { /* ignore */ }
    await refresh();
    setWorking(null);
  }

  const items: PermItem[] = [
    {
      key:       "notifications",
      icon:      "bell-ring",
      color:     "#10b981",
      titleEn:   "Notifications",
      titleAr:   "الإشعارات",
      whyEn:     "Required for Adhan sound and all prayer time alerts",
      whyAr:     "مطلوب لأذان الصلاة وجميع تنبيهات الصلاة",
      essential: true,
      status:    notifStatus,
      btnEn:     notifStatus === "granted" ? "Granted ✓" : "Grant Access",
      btnAr:     notifStatus === "granted" ? "ممنوح ✓"   : "منح الإذن",
      onAction:  async () => {
        if (notifStatus !== "granted") {
          const ok = await requestNotificationPermission();
          setNotifStatus(ok ? "granted" : "denied");
          if (!ok) await openNotificationSettings();
        }
      },
    },
    ...(Platform.OS === "android" ? [
      {
        key:       "exact_alarms",
        icon:      "alarm" as const,
        color:     "#6366f1",
        titleEn:   "Exact Alarms",
        titleAr:   "المنبهات الدقيقة",
        whyEn:     "Adhan fires at the exact prayer time — not minutes off",
        whyAr:     "يضمن أن الأذان يُشغَّل في وقت الصلاة بالضبط",
        essential: true,
        status:    (done.exact_alarms ? "granted" : "needs_setup") as AnyStatus,
        btnEn:     done.exact_alarms ? "Configured ✓" : "Configure",
        btnAr:     done.exact_alarms ? "تم الإعداد ✓"  : "إعداد",
        onAction:  async () => {
          await openExactAlarmSettings();
          setDone((d) => ({ ...d, exact_alarms: true }));
        },
      },
      {
        key:       "battery",
        icon:      "battery-charging" as const,
        color:     "#f59e0b",
        titleEn:   "Battery Optimization",
        titleAr:   "تحسين البطارية",
        whyEn:     "Prevents Android from silencing Adhan when battery saving",
        whyAr:     "يمنع أندرويد من إيقاف الأذان عند توفير البطارية",
        essential: true,
        status:    (done.battery ? "granted" : "needs_setup") as AnyStatus,
        btnEn:     done.battery ? "Configured ✓" : "Disable for App",
        btnAr:     done.battery ? "تم الإعداد ✓"  : "تعطيل للتطبيق",
        onAction:  async () => {
          await openBatteryOptimizationSettings();
          setDone((d) => ({ ...d, battery: true }));
        },
      },
      {
        key:       "overlay",
        icon:      "layers-triple" as const,
        color:     "#ec4899",
        titleEn:   "Display Over Other Apps",
        titleAr:   "العرض فوق التطبيقات",
        whyEn:     "Shows Azkar floating alerts over any active app",
        whyAr:     "يتيح ظهور تنبيهات الأذكار فوق أي تطبيق",
        essential: false,
        status:    (done.overlay ? "granted" : "needs_setup") as AnyStatus,
        btnEn:     done.overlay ? "Configured ✓" : "Enable",
        btnAr:     done.overlay ? "تم الإعداد ✓"  : "تفعيل",
        onAction:  async () => {
          await openOverlaySettings();
          setDone((d) => ({ ...d, overlay: true }));
        },
      },
    ] : []),
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        s.container,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Step dots */}
      <View style={s.stepRow}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              s.stepDot,
              { backgroundColor: i < 3 ? colors.primary : colors.primary + "40" },
            ]}
          />
        ))}
      </View>

      {/* Hero */}
      <View style={s.hero}>
        <View style={[s.heroIcon, { backgroundColor: colors.primary + "18" }]}>
          <MaterialCommunityIcons name="shield-check-outline" size={38} color={colors.primary} />
        </View>
        <Text style={[s.heroTitle, { color: colors.foreground }]}>
          {isArabic ? "إعداد الأذونات" : "Permission Setup"}
        </Text>
        <Text style={[s.heroSub, { color: colors.mutedForeground }]}>
          {isArabic
            ? "هذه الإعدادات ضرورية لضمان تشغيل الأذان في جميع الظروف"
            : "These settings ensure Adhan plays reliably at every prayer time"}
        </Text>
      </View>

      {/* Permission cards */}
      <View style={s.list}>
        {items.map((item) => {
          const isGranted = item.status === "granted";
          const isBusy    = working === item.key;

          return (
            <View
              key={item.key}
              style={[
                s.card,
                {
                  backgroundColor: colors.card,
                  borderColor:     isGranted ? item.color + "40" : colors.border,
                  borderLeftColor: item.color,
                },
              ]}
            >
              <View style={s.cardTop}>
                <View style={[s.iconWrap, { backgroundColor: item.color + "18" }]}>
                  <MaterialCommunityIcons name={item.icon} size={20} color={item.color} />
                </View>

                <View style={s.cardMeta}>
                  <View style={s.cardTitleRow}>
                    <Text style={[s.cardTitle, { color: colors.foreground }]}>
                      {isArabic ? item.titleAr : item.titleEn}
                    </Text>
                    {!item.essential && (
                      <View style={[s.optBadge, { backgroundColor: colors.secondary }]}>
                        <Text style={[s.optText, { color: colors.mutedForeground }]}>
                          {isArabic ? "اختياري" : "Optional"}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={[s.cardWhy, { color: colors.mutedForeground }]}>
                    {isArabic ? item.whyAr : item.whyEn}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  s.actionBtn,
                  {
                    backgroundColor: isGranted ? item.color + "15" : item.color,
                    borderColor:     item.color,
                    opacity:         isBusy ? 0.6 : 1,
                  },
                ]}
                onPress={() => run(item.key, item.onAction)}
                disabled={isGranted || isBusy}
                activeOpacity={0.8}
              >
                <Text style={[s.actionText, { color: isGranted ? item.color : "#fff" }]}>
                  {isBusy ? "…" : isArabic ? item.btnAr : item.btnEn}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      {/* Info hint */}
      <View style={[s.infoBox, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "25" }]}>
        <Feather name="info" size={13} color={colors.primary} style={{ marginTop: 1 }} />
        <Text style={[s.infoText, { color: colors.mutedForeground }]}>
          {isArabic
            ? "يمكنك إعادة تفعيل هذه الأذونات في أي وقت من إعدادات التطبيق"
            : "You can reconfigure these at any time from app Settings → Permissions"}
        </Text>
      </View>

      {/* Continue */}
      <TouchableOpacity
        style={[s.continueBtn, { backgroundColor: colors.primary }]}
        onPress={() => router.push("/onboarding/calibration")}
        activeOpacity={0.85}
      >
        <Text style={[s.continueTxt, { color: colors.primaryForeground }]}>
          {isArabic ? "التالي — معايرة الحركة" : "Next — Motion Calibration"}
        </Text>
        <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:    { paddingHorizontal: 20, gap: 22 },

  stepRow:      { flexDirection: "row", gap: 6 },
  stepDot:      { flex: 1, height: 4, borderRadius: 2 },

  hero:         { alignItems: "center", gap: 12, paddingVertical: 4 },
  heroIcon:     { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center" },
  heroTitle:    { fontSize: 24, fontWeight: "700", letterSpacing: -0.5, textAlign: "center" },
  heroSub:      { fontSize: 14, textAlign: "center", lineHeight: 21, paddingHorizontal: 8 },

  list:         { gap: 10 },
  card:         {
    borderRadius: 18, borderWidth: 1, borderLeftWidth: 3,
    padding: 16, gap: 12,
  },
  cardTop:      { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  iconWrap:     { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cardMeta:     { flex: 1, gap: 4 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" },
  cardTitle:    { fontSize: 15, fontWeight: "700", letterSpacing: -0.2 },
  cardWhy:      { fontSize: 12, lineHeight: 18 },
  optBadge:     { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  optText:      { fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3 },

  actionBtn:    { borderRadius: 10, borderWidth: 1, paddingVertical: 10, alignItems: "center" },
  actionText:   { fontSize: 13, fontWeight: "700" },

  infoBox:      { borderRadius: 12, borderWidth: 1, padding: 12, flexDirection: "row", gap: 8, alignItems: "flex-start" },
  infoText:     { flex: 1, fontSize: 12, lineHeight: 18 },

  continueBtn:  { borderRadius: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  continueTxt:  { fontSize: 16, fontWeight: "700" },
});
