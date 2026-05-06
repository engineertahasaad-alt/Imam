import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

const METHODS = Object.entries(CALCULATION_METHODS).map(([key, val]) => ({
  key: key as CalculationMethod,
  name: val.name,
}));

// Common cities for quick select
const PRESET_CITIES = [
  { name: "Makkah", lat: 21.3891, lng: 39.8579 },
  { name: "Madinah", lat: 24.5247, lng: 39.5692 },
  { name: "Cairo", lat: 30.0444, lng: 31.2357 },
  { name: "Dubai", lat: 25.2048, lng: 55.2708 },
  { name: "London", lat: 51.5074, lng: -0.1278 },
  { name: "New York", lat: 40.7128, lng: -74.006 },
  { name: "Karachi", lat: 24.8607, lng: 67.0011 },
  { name: "Istanbul", lat: 41.0082, lng: 28.9784 },
];

export default function SetupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { updateSettings } = useApp();

  const [selectedMethod, setSelectedMethod] = useState<CalculationMethod>("MWL");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [cityName, setCityName] = useState("");
  const [loadingGPS, setLoadingGPS] = useState(false);
  const [step, setStep] = useState<"location" | "method">("location");

  async function useGPS() {
    if (Platform.OS === "web") {
      Alert.alert("GPS", "Use the city presets on web");
      return;
    }
    setLoadingGPS(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Please allow location access to get accurate prayer times.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLat(loc.coords.latitude);
      setLng(loc.coords.longitude);
      setCityName("Current Location");
      setStep("method");
    } catch (e) {
      Alert.alert("Error", "Could not get location. Please select a city.");
    } finally {
      setLoadingGPS(false);
    }
  }

  function selectCity(city: (typeof PRESET_CITIES)[number]) {
    setLat(city.lat);
    setLng(city.lng);
    setCityName(city.name);
    setStep("method");
  }

  async function finishSetup() {
    if (!lat || !lng) return;
    await updateSettings({
      calculationMethod: selectedMethod,
      latitude: lat,
      longitude: lng,
      cityName,
    });
    router.push("/onboarding/calibration");
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20),
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 32),
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Step indicator */}
      <View style={styles.stepIndicator}>
        <View
          style={[
            styles.stepDot,
            { backgroundColor: colors.primary },
          ]}
        />
        <View
          style={[
            styles.stepLine,
            {
              backgroundColor:
                step === "method" ? colors.primary : colors.border,
            },
          ]}
        />
        <View
          style={[
            styles.stepDot,
            {
              backgroundColor:
                step === "method" ? colors.primary : colors.border,
            },
          ]}
        />
      </View>

      {step === "location" ? (
        <>
          <Text style={[styles.heading, { color: colors.foreground }]}>
            Set Your Location
          </Text>
          <Text style={[styles.subheading, { color: colors.mutedForeground }]}>
            Needed for accurate prayer times
          </Text>

          {/* GPS button */}
          <TouchableOpacity
            style={[styles.gpsBtn, { backgroundColor: colors.primary }]}
            onPress={useGPS}
            disabled={loadingGPS}
          >
            {loadingGPS ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Feather name="map-pin" size={20} color={colors.primaryForeground} />
            )}
            <Text
              style={[styles.gpsBtnText, { color: colors.primaryForeground }]}
            >
              {loadingGPS ? "Getting location..." : "Use GPS"}
            </Text>
          </TouchableOpacity>

          <Text style={[styles.orText, { color: colors.mutedForeground }]}>
            or select a city
          </Text>

          {/* City grid */}
          <View style={styles.cityGrid}>
            {PRESET_CITIES.map((city) => (
              <TouchableOpacity
                key={city.name}
                style={[
                  styles.cityChip,
                  {
                    backgroundColor:
                      cityName === city.name
                        ? colors.primary
                        : colors.card,
                    borderColor:
                      cityName === city.name
                        ? colors.primary
                        : colors.border,
                  },
                ]}
                onPress={() => selectCity(city)}
              >
                <Text
                  style={[
                    styles.cityChipText,
                    {
                      color:
                        cityName === city.name
                          ? colors.primaryForeground
                          : colors.foreground,
                    },
                  ]}
                >
                  {city.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : (
        <>
          <View style={styles.locationConfirm}>
            <Feather name="map-pin" size={16} color={colors.primary} />
            <Text style={[styles.locationText, { color: colors.primary }]}>
              {cityName}
            </Text>
            <TouchableOpacity onPress={() => setStep("location")}>
              <Text style={[styles.changeText, { color: colors.mutedForeground }]}>
                Change
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.heading, { color: colors.foreground }]}>
            Calculation Method
          </Text>
          <Text style={[styles.subheading, { color: colors.mutedForeground }]}>
            Choose your region's prayer time standard
          </Text>

          <View style={styles.methodList}>
            {METHODS.map((m) => (
              <TouchableOpacity
                key={m.key}
                style={[
                  styles.methodItem,
                  {
                    backgroundColor: colors.card,
                    borderColor:
                      selectedMethod === m.key
                        ? colors.primary
                        : colors.border,
                  },
                ]}
                onPress={() => setSelectedMethod(m.key)}
              >
                <View
                  style={[
                    styles.radio,
                    {
                      borderColor:
                        selectedMethod === m.key
                          ? colors.primary
                          : colors.border,
                    },
                  ]}
                >
                  {selectedMethod === m.key && (
                    <View
                      style={[
                        styles.radioFill,
                        { backgroundColor: colors.primary },
                      ]}
                    />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.methodName,
                      {
                        color:
                          selectedMethod === m.key
                            ? colors.primary
                            : colors.foreground,
                      },
                    ]}
                  >
                    {m.key}
                  </Text>
                  <Text
                    style={[
                      styles.methodDesc,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {m.name}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: colors.primary }]}
            onPress={finishSetup}
          >
            <Text
              style={[styles.nextBtnText, { color: colors.primaryForeground }]}
            >
              Continue
            </Text>
            <Feather
              name="arrow-right"
              size={20}
              color={colors.primaryForeground}
            />
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    gap: 16,
  },
  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 0,
    marginBottom: 8,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stepLine: {
    width: 60,
    height: 2,
  },
  heading: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  subheading: {
    fontSize: 14,
    marginTop: -8,
  },
  gpsBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 4,
  },
  gpsBtnText: {
    fontSize: 16,
    fontWeight: "600",
  },
  orText: {
    textAlign: "center",
    fontSize: 13,
  },
  cityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cityChip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cityChipText: {
    fontSize: 14,
    fontWeight: "500",
  },
  locationConfirm: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  locationText: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  changeText: {
    fontSize: 13,
  },
  methodList: {
    gap: 8,
  },
  methodItem: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioFill: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  methodName: {
    fontSize: 14,
    fontWeight: "600",
  },
  methodDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  nextBtn: {
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 8,
  },
  nextBtnText: {
    fontSize: 17,
    fontWeight: "700",
  },
});
