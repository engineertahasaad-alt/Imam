import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAzkar } from "@/context/AzkarContext";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "@/hooks/useTranslation";

const TAB_H = Platform.OS === "web" ? 84 : 62;

export default function AzkarScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isArabic } = useTranslation();
  const { settings, showNow } = useAzkar();

  const paddingTop = insets.top + (Platform.OS === "web" ? 67 : 20);
  const paddingBottom = insets.bottom + TAB_H + (Platform.OS === "web" ? 34 : 16);

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
                  {t("morning_azkar")}
                </Text>
                <Text style={styles.dayCardDesc}>
                  {t("morning_azkar_desc")}
                </Text>
              </View>
              <MaterialCommunityIcons
                name={isArabic ? "chevron-left" : "chevron-right"}
                size={22}
                color="rgba(255,255,255,0.7)"
              />
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
                  {t("evening_azkar")}
                </Text>
                <Text style={styles.dayCardDesc}>
                  {t("evening_azkar_desc")}
                </Text>
              </View>
              <MaterialCommunityIcons
                name={isArabic ? "chevron-left" : "chevron-right"}
                size={22}
                color="rgba(255,255,255,0.7)"
              />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Floating Azkar Section */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIconWrap, { backgroundColor: colors.primary + "20" }]}>
            <Text style={{ fontSize: 20 }}>🤲</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {t("floating_azkar_lbl")}
            </Text>
            <Text style={[styles.sectionDesc, { color: colors.mutedForeground }]}>
              {t("floating_azkar_desc")}
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
            <Text style={[
              styles.statusText,
              { color: settings.enabled ? colors.primary : colors.mutedForeground },
            ]}>
              {settings.enabled
                ? (isArabic ? "مفعّل" : "Active")
                : (isArabic ? "معطّل" : "Off")}
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
              {t("azkar_manage_btn")}
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

  dailySection: { gap: 14 },
  dayCard:      { borderRadius: 20, overflow: "hidden", elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10 },
  dayCardGradient: { padding: 20 },
  dayCardContent:  { flexDirection: "row", alignItems: "center", gap: 14 },
  dayCardIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  dayCardTitle:    { fontSize: 18, fontWeight: "700", color: "#fff", marginBottom: 2 },
  dayCardDesc:     { fontSize: 12, color: "rgba(255,255,255,0.85)", lineHeight: 16 },

  section:       { borderRadius: 18, borderWidth: 1, padding: 16, gap: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  sectionIconWrap:{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  sectionTitle:  { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  sectionDesc:   { fontSize: 12, lineHeight: 18 },

  statusRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 10 },
  statusLabel:  { fontSize: 13, fontWeight: "500" },
  statusBadge:  { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusDot:    { width: 7, height: 7, borderRadius: 4 },
  statusText:   { fontSize: 13, fontWeight: "600" },

  floatBtnRow:    { flexDirection: "row", gap: 10 },
  previewBtn:     { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, paddingVertical: 12, borderWidth: 1 },
  previewBtnText: { fontSize: 13, fontWeight: "600" },
  manageBtn:      { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, paddingVertical: 12 },
  manageBtnText:  { fontSize: 13, fontWeight: "600" },
});
