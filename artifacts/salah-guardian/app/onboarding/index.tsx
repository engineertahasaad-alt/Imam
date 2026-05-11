import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import {
  Image,
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

export default function WelcomeScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { t }   = useTranslation();

  const FEATURES = [
    {
      icon: "activity" as const,
      title: t("feature_motion_title"),
      desc:  t("feature_motion_desc"),
      color: "#34d399",
    },
    {
      icon: "wifi-off" as const,
      title: t("feature_offline_title"),
      desc:  t("feature_offline_desc"),
      color: "#60a5fa",
    },
    {
      icon: "lock" as const,
      title: t("feature_private_title"),
      desc:  t("feature_private_desc"),
      color: "#f59e0b",
    },
    {
      icon: "bell" as const,
      title: t("feature_remind_title"),
      desc:  t("feature_remind_desc"),
      color: "#c084fc",
    },
  ];

  return (
    <LinearGradient colors={[colors.background, colors.background]} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20),
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 32),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo area */}
        <View style={styles.logoSection}>
          <Image
            source={require("../../assets/images/icon.png")}
            style={styles.icon}
          />
          <Text style={[styles.appName, { color: colors.primary }]}>Imam</Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
            {t("tagline")}
          </Text>
        </View>

        {/* Privacy statement */}
        <View
          style={[
            styles.privacyBanner,
            { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" },
          ]}
        >
          <Feather name="shield" size={20} color={colors.primary} />
          <Text style={[styles.privacyText, { color: colors.primary }]}>
            {t("privacy_banner")}
          </Text>
        </View>

        {/* Feature list */}
        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View
              key={f.icon}
              style={[styles.featureRow, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.featureIcon, { backgroundColor: f.color + "20" }]}>
                <Feather name={f.icon} size={20} color={f.color} />
              </View>
              <View style={styles.featureText}>
                <Text style={[styles.featureTitle, { color: colors.foreground }]}>{f.title}</Text>
                <Text style={[styles.featureDesc, { color: colors.mutedForeground }]}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.cta, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/onboarding/setup")}
        >
          <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>
            {t("get_started")}
          </Text>
          <Feather name="arrow-right" size={20} color={colors.primaryForeground} />
        </TouchableOpacity>

        <Text style={[styles.footnote, { color: colors.mutedForeground }]}>
          {t("footnote")}
        </Text>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container:    { paddingHorizontal: 24, gap: 20 },
  logoSection:  { alignItems: "center", gap: 8, marginBottom: 4 },
  icon:         { width: 80, height: 80, borderRadius: 20 },
  appName:      { fontSize: 30, fontWeight: "700", letterSpacing: -0.5 },
  tagline:      { fontSize: 15 },
  privacyBanner:{
    borderRadius: 14, borderWidth: 1, padding: 14,
    flexDirection: "row", alignItems: "flex-start", gap: 12,
  },
  privacyText:  { flex: 1, fontSize: 13, lineHeight: 20, fontWeight: "500" },
  features:     { gap: 10 },
  featureRow:   {
    borderRadius: 14, borderWidth: 1, padding: 14,
    flexDirection: "row", alignItems: "center", gap: 14,
  },
  featureIcon:  {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  featureText:  { flex: 1, gap: 2 },
  featureTitle: { fontSize: 14, fontWeight: "600" },
  featureDesc:  { fontSize: 12, lineHeight: 18 },
  cta: {
    borderRadius: 16, paddingVertical: 18,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 4,
  },
  ctaText:   { fontSize: 17, fontWeight: "700" },
  footnote:  { fontSize: 11, textAlign: "center", lineHeight: 16 },
});
