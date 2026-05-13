import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Font from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useEffect, useState } from "react";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AzkarFloatingWidget } from "@/components/AzkarFloatingWidget";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider } from "@/context/AppContext";
import { AzkarProvider } from "@/context/AzkarContext";

LogBox.ignoreLogs([
  "expo-notifications: Android Push notifications",
  "[expo-notifications]",
  "expo-notifications",
  "[expo-av]",
  "shadow*",
]);

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="custom-azkar" />
      <Stack.Screen name="azkar-morning" />
      <Stack.Screen name="azkar-evening" />
    </Stack>
  );
}

export default function RootLayout() {
  const [interLoaded, interError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [iconsLoaded, setIconsLoaded] = useState(false);

  useEffect(() => {
    Font.loadAsync({
      MaterialCommunityIcons: require("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf"),
    })
      .catch(() => {})
      .finally(() => setIconsLoaded(true));
  }, []);

  const fontsReady = (interLoaded || interError) && iconsLoaded;

  const onLayoutRootView = useCallback(async () => {
    if (fontsReady) {
      await SplashScreen.hideAsync();
    }
  }, [fontsReady]);

  if (!fontsReady) return null;

  return (
    <SafeAreaProvider onLayout={onLayoutRootView}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AppProvider>
            <AzkarProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <RootLayoutNav />
                  <AzkarFloatingWidget />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </AzkarProvider>
          </AppProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
