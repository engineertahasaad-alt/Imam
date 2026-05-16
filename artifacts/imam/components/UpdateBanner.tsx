import * as Updates from "expo-updates";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export function UpdateBanner() {
  const [visible, setVisible] = useState(false);
  const [applying, setApplying] = useState(false);
  const translateY = React.useRef(new Animated.Value(-80)).current;

  useEffect(() => {
    if (__DEV__) return;

    async function checkForUpdate() {
      try {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) {
          await Updates.fetchUpdateAsync();
          show();
        }
      } catch {
        // silently ignore network / server errors
      }
    }

    checkForUpdate();
  }, []);

  function show() {
    setVisible(true);
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
  }

  function dismiss() {
    Animated.timing(translateY, {
      toValue: -80,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setVisible(false));
  }

  async function applyUpdate() {
    setApplying(true);
    try {
      await Updates.reloadAsync();
    } catch {
      setApplying(false);
      dismiss();
    }
  }

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.banner, { transform: [{ translateY }] }]}
      pointerEvents="box-none"
    >
      <View style={styles.inner}>
        <View style={styles.textGroup}>
          <Text style={styles.title}>Update ready</Text>
          <Text style={styles.subtitle}>Restart to get the latest version</Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.dismissBtn}
            onPress={dismiss}
            disabled={applying}
          >
            <Text style={styles.dismissText}>Later</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.applyBtn}
            onPress={applyUpdate}
            disabled={applying}
          >
            {applying ? (
              <ActivityIndicator size="small" color="#0d1321" />
            ) : (
              <Text style={styles.applyText}>Restart</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#34d399",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 8,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  textGroup: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0d1321",
  },
  subtitle: {
    fontSize: 12,
    color: "#0d1321",
    opacity: 0.75,
    marginTop: 1,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dismissBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dismissText: {
    fontSize: 13,
    color: "#0d1321",
    opacity: 0.65,
    fontWeight: "600",
  },
  applyBtn: {
    backgroundColor: "#0d1321",
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    minWidth: 72,
    alignItems: "center",
  },
  applyText: {
    fontSize: 13,
    color: "#34d399",
    fontWeight: "700",
  },
});
