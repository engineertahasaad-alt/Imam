import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { QiblaCard } from "@/components/QiblaCard";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "@/hooks/useTranslation";

const TAB_H = Platform.OS === "web" ? 84 : 62;

export default function QiblaScreen() {
  const colors        = useColors();
  const insets        = useSafeAreaInsets();
  const { t, isArabic } = useTranslation();
  const { settings }  = useApp();

  const hasLocation = !!(settings.latitude && settings.longitude);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20),
          paddingBottom: TAB_H + insets.bottom + 20,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Text style={[styles.title, { color: colors.foreground }]}>
        {isArabic ? "القبلة" : "Qibla Direction"}
      </Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        {isArabic ? "اتجاه الكعبة المشرفة" : "Direction toward the Kaaba, Mecca"}
      </Text>

      {/* Compass card */}
      {hasLocation ? (
        <QiblaCard
          userLat={settings.latitude!}
          userLng={settings.longitude!}
        />
      ) : (
        <View style={[styles.noLocation, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.noLocIcon, { backgroundColor: colors.primary + "20" }]}>
            <Feather name="map-pin" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.noLocTitle, { color: colors.foreground }]}>
            {isArabic ? "الموقع مطلوب" : "Location Required"}
          </Text>
          <Text style={[styles.noLocDesc, { color: colors.mutedForeground }]}>
            {isArabic
              ? "يرجى تفعيل الموقع من الإعدادات لعرض اتجاه القبلة"
              : "Enable location in Settings to show the Qibla direction"}
          </Text>
        </View>
      )}

      {/* Instructions card */}
      <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.infoTitle, { color: colors.foreground }]}>
          {isArabic ? "كيفية الاستخدام" : "How to use"}
        </Text>
        {[
          isArabic
            ? ["📱", "ضع الهاتف أفقياً، الشاشة للأعلى"]
            : ["📱", "Hold phone flat with screen facing up"],
          isArabic
            ? ["🔄", "حرّك الهاتف بشكل رقم 8 لمعايرة البوصلة"]
            : ["🔄", "Move in a figure-8 to calibrate the compass"],
          isArabic
            ? ["🕋", "اتجه حيث تشير الإبرة نحو الكعبة"]
            : ["🕋", "Face the direction the needle points — that's Qibla"],
        ].map(([icon, text], i) => (
          <View key={i} style={styles.infoRow}>
            <Text style={styles.infoIcon}>{icon}</Text>
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>{text}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:    { paddingHorizontal: 20, gap: 16 },
  title:        { fontSize: 26, fontWeight: "700" },
  subtitle:     { fontSize: 13, marginTop: -8 },

  noLocation: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
    gap: 12,
  },
  noLocIcon:  { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  noLocTitle: { fontSize: 16, fontWeight: "700" },
  noLocDesc:  { fontSize: 13, textAlign: "center", lineHeight: 20, maxWidth: 260 },

  infoCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  infoTitle:  { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  infoRow:    { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  infoIcon:   { fontSize: 16, width: 24, textAlign: "center" },
  infoText:   { flex: 1, fontSize: 13, lineHeight: 19 },
});
