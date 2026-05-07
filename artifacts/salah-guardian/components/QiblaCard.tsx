import { Feather } from "@expo/vector-icons";
import { Magnetometer } from "expo-sensors";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import {
  getDistanceToMeccaKm,
  getQiblaBearing,
  magnetometerToHeading,
} from "@/lib/qiblaCalculator";

interface Props {
  userLat: number;
  userLng: number;
}

const ALPHA = 0.15;
const DIAL_SIZE = 160;
const R = DIAL_SIZE / 2;

export function QiblaCard({ userLat, userLng }: Props) {
  const colors = useColors();

  const qiblaBearing = getQiblaBearing(userLat, userLng);
  const distanceKm   = getDistanceToMeccaKm(userLat, userLng);

  const [heading, setHeading]       = useState(0);
  const [available, setAvailable]   = useState(false);
  const [calibrated, setCalibrated] = useState(false);

  const filteredX   = useRef(0);
  const filteredY   = useRef(0);
  const sampleCount = useRef(0);
  const rotAnim     = useRef(new Animated.Value(0)).current;
  const prevDeg     = useRef(0);

  useEffect(() => {
    if (Platform.OS === "web") return;
    let sub: ReturnType<typeof Magnetometer.addListener> | null = null;

    Magnetometer.isAvailableAsync().then((ok) => {
      if (!ok) return;
      setAvailable(true);
      Magnetometer.setUpdateInterval(100);
      sub = Magnetometer.addListener(({ x, y }) => {
        filteredX.current = ALPHA * x + (1 - ALPHA) * filteredX.current;
        filteredY.current = ALPHA * y + (1 - ALPHA) * filteredY.current;
        sampleCount.current += 1;
        if (sampleCount.current > 12) setCalibrated(true);
        setHeading(magnetometerToHeading(filteredX.current, filteredY.current));
      });
    });

    return () => { sub?.remove(); };
  }, []);

  // needle angle = where to rotate to point at Qibla relative to device heading
  const needleDeg = available ? (qiblaBearing - heading + 360) % 360 : qiblaBearing;

  useEffect(() => {
    let diff = needleDeg - prevDeg.current;
    if (diff > 180)  diff -= 360;
    if (diff < -180) diff += 360;
    prevDeg.current += diff;
    Animated.timing(rotAnim, {
      toValue: prevDeg.current,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [needleDeg]);

  const spin = rotAnim.interpolate({
    inputRange:  [-1080, 1080],
    outputRange: ["-1080deg", "1080deg"],
  });

  // Cardinal label positions (absolute within dial)
  const cardinals: { label: string; deg: number; color?: string }[] = [
    { label: "N", deg: 0,   color: "#f87171" },
    { label: "E", deg: 90 },
    { label: "S", deg: 180 },
    { label: "W", deg: 270 },
  ];

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={[styles.iconWrap, { backgroundColor: "#0ea5e920" }]}>
          <Feather name="compass" size={16} color="#0ea5e9" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Qibla Direction</Text>
          <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
            {distanceKm.toLocaleString()} km to Mecca
          </Text>
        </View>
        <View style={styles.bearingBadge}>
          <Text style={[styles.bearingNum, { color: colors.primary }]}>
            {Math.round(qiblaBearing)}°
          </Text>
          <Text style={[styles.bearingLbl, { color: colors.mutedForeground }]}>from N</Text>
        </View>
      </View>

      {/* Compass body */}
      <View style={styles.compassRow}>
        {/* Dial */}
        <View
          style={[
            styles.dial,
            { borderColor: colors.border, width: DIAL_SIZE, height: DIAL_SIZE, borderRadius: R },
          ]}
        >
          {/* Cardinal labels — fixed to dial, don't rotate */}
          {cardinals.map(({ label, deg, color }) => {
            const rad = (deg * Math.PI) / 180;
            const lr  = R - 18;
            const cx  = R + Math.sin(rad) * lr;
            const cy  = R - Math.cos(rad) * lr;
            return (
              <Text
                key={label}
                style={[
                  styles.cardinal,
                  {
                    color:      color ?? colors.mutedForeground,
                    fontWeight: label === "N" ? "800" : "600",
                    left:       cx - 7,
                    top:        cy - 10,
                  },
                ]}
              >
                {label}
              </Text>
            );
          })}

          {/* Tick lines at 45° intervals */}
          {[45, 135, 225, 315].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const inner = R - 12;
            const outer = R - 4;
            const x1 = R + Math.sin(rad) * inner;
            const y1 = R - Math.cos(rad) * inner;
            const x2 = R + Math.sin(rad) * outer;
            const y2 = R - Math.cos(rad) * outer;
            const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
            return (
              <View
                key={deg}
                style={{
                  position:  "absolute",
                  width:     len,
                  height:    1.5,
                  backgroundColor: colors.border,
                  left:      x1,
                  top:       y1,
                  transform: [{ rotate: `${deg}deg` }],
                }}
              />
            );
          })}

          {/* Animated Qibla needle — this rotates as one piece */}
          <Animated.View
            style={[
              styles.needleContainer,
              { width: DIAL_SIZE, height: DIAL_SIZE, transform: [{ rotate: spin }] },
            ]}
          >
            {/* Arrow tip (pointing UP = toward Qibla) */}
            <View style={[styles.arrowTip, { borderBottomColor: colors.primary }]} />
            {/* Arrow shaft */}
            <View style={[styles.arrowShaft, { backgroundColor: colors.primary }]} />
            {/* Opposite end */}
            <View style={[styles.arrowTail, { backgroundColor: colors.primary + "50" }]} />
          </Animated.View>

          {/* Center hub */}
          <View style={[styles.hub, { left: R - 8, top: R - 8, backgroundColor: colors.card, borderColor: colors.border }]} />

          {/* Kaaba emoji at top of needle (fixed) */}
          <Text style={[styles.kaabaHint, { color: colors.mutedForeground }]}>🕋</Text>
        </View>

        {/* Right status */}
        <View style={styles.statusBlock}>
          {Platform.OS === "web" || !available ? (
            <>
              <View style={[styles.statusChip, { backgroundColor: colors.secondary }]}>
                <Feather name="info" size={12} color={colors.mutedForeground} />
                <Text style={[styles.statusChipText, { color: colors.mutedForeground }]}>
                  Static{"\n"}direction
                </Text>
              </View>
              <Text style={[styles.statusNote, { color: colors.mutedForeground }]}>
                Live compass{"\n"}needs device
              </Text>
            </>
          ) : !calibrated ? (
            <>
              <View style={[styles.statusChip, { backgroundColor: "#f59e0b20" }]}>
                <Feather name="rotate-cw" size={12} color="#f59e0b" />
                <Text style={[styles.statusChipText, { color: "#f59e0b" }]}>
                  Calibrating…
                </Text>
              </View>
              <Text style={[styles.statusNote, { color: colors.mutedForeground }]}>
                Move phone in{"\n"}figure-8 motion
              </Text>
            </>
          ) : (
            <>
              <View style={[styles.statusChip, { backgroundColor: colors.primary + "20" }]}>
                <Feather name="check-circle" size={12} color={colors.primary} />
                <Text style={[styles.statusChipText, { color: colors.primary }]}>
                  Live compass
                </Text>
              </View>
              <Text style={[styles.statusNote, { color: colors.mutedForeground }]}>
                Facing{"\n"}{Math.round(heading)}° from N
              </Text>
            </>
          )}
        </View>
      </View>

      <Text style={[styles.hint, { color: colors.mutedForeground }]}>
        {available ? "Hold phone flat, screen facing up" : `Qibla is ${Math.round(qiblaBearing)}° clockwise from North`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  cardSub: {
    fontSize: 11,
    marginTop: 1,
  },
  bearingBadge: {
    alignItems: "flex-end",
  },
  bearingNum: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -1,
  },
  bearingLbl: {
    fontSize: 9,
  },
  compassRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    justifyContent: "center",
  },
  dial: {
    borderWidth: 1.5,
    position: "relative",
  },
  cardinal: {
    position: "absolute",
    fontSize: 11,
    width: 14,
    textAlign: "center",
  },
  needleContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 16,
  },
  arrowTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 14,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  arrowShaft: {
    width: 4,
    height: 30,
    borderRadius: 2,
  },
  arrowTail: {
    width: 4,
    height: 20,
    borderRadius: 2,
    marginTop: 2,
  },
  hub: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    zIndex: 10,
  },
  kaabaHint: {
    position: "absolute",
    top: 4,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 10,
  },
  statusBlock: {
    flex: 1,
    gap: 10,
    justifyContent: "center",
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    padding: 8,
    alignSelf: "flex-start",
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 15,
  },
  statusNote: {
    fontSize: 11,
    lineHeight: 16,
  },
  hint: {
    fontSize: 11,
    textAlign: "center",
  },
});
