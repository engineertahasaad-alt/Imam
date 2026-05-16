import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useTranslation } from "@/hooks/useTranslation";

const TAB_H = Platform.OS === "web" ? 84 : 62;

// Pill-style icon wrapper for Material You / M3 active tab indicator
function TabIcon({
  name,
  color,
  size,
  focused,
  pillColor,
}: {
  name:       React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  color:      string;
  size:       number;
  focused:    boolean;
  pillColor:  string;
}) {
  return (
    <View
      style={[
        iconStyles.wrap,
        focused && { backgroundColor: pillColor },
      ]}
    >
      <MaterialCommunityIcons
        name={name}
        size={focused ? size + 1 : size - 1}
        color={color}
      />
    </View>
  );
}

const iconStyles = StyleSheet.create({
  wrap: {
    width:          48,
    height:         30,
    borderRadius:   15,
    alignItems:     "center",
    justifyContent: "center",
  },
});

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t }  = useTranslation();

  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const pill  = colors.primary + "22";

  const tabBarStyle = {
    position:        "absolute" as const,
    backgroundColor: isIOS ? "transparent" : colors.background,
    borderTopWidth:  StyleSheet.hairlineWidth,
    borderTopColor:  colors.border,
    elevation:       0,
    height:          isWeb ? 84 : TAB_H + insets.bottom,
    paddingBottom:   isWeb ? 0 : insets.bottom,
    // Subtle rounded top on Android
    ...(Platform.OS === "android" && {
      borderTopLeftRadius:  18,
      borderTopRightRadius: 18,
    }),
  };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:   colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown:             false,
        tabBarStyle,
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={90}
              tint={colors.isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
          ) : null,
        tabBarLabelStyle: {
          fontSize:      10,
          fontWeight:    "600",
          letterSpacing: 0.1,
          marginTop:     -2,
        },
        tabBarItemStyle: {
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tab_home"),
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="mosque" color={color} size={size} focused={focused} pillColor={pill} />
          ),
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: t("tab_log"),
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="calendar-check" color={color} size={size} focused={focused} pillColor={pill} />
          ),
        }}
      />
      <Tabs.Screen
        name="qibla"
        options={{
          title: t("tab_qibla"),
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="compass" color={color} size={size} focused={focused} pillColor={pill} />
          ),
        }}
      />
      <Tabs.Screen
        name="azkar"
        options={{
          title: t("tab_azkar"),
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="hand-extended" color={color} size={size} focused={focused} pillColor={pill} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tab_settings"),
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="tune-variant" color={color} size={size} focused={focused} pillColor={pill} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{ href: null }}
      />
    </Tabs>
  );
}
