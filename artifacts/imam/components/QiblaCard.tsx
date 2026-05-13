import { Feather } from "@expo/vector-icons";
import { Accelerometer, Magnetometer } from "expo-sensors";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { useTranslation } from "@/hooks/useTranslation";
import {
  getDistanceToMeccaKm,
  getQiblaBearing,
} from "@/lib/qiblaCalculator";

interface Props {
  userLat: number;
  userLng: number;
}

const DIAL_SIZE  = 168;
const R          = DIAL_SIZE / 2;
const MAG_ALPHA  = 0.12;
const ACC_ALPHA  = 0.10;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function tiltCompensatedHeading(
  mx: number, my: number, mz: number,
  ax: number, ay: number, az: number
): number {
  const accMag = Math.sqrt(ax * ax + ay * ay + az * az);
  if (accMag < 1e-4) {
    return (Math.atan2(-my, mx) * 180) / Math.PI;
  }
  const axN = ax / accMag;
  const ayN = ay / accMag;

  const pitch = Math.asin(clamp(-axN, -1, 1));
  const roll  = Math.asin(clamp(ayN / Math.cos(pitch), -1, 1));

  const xH = mx * Math.cos(pitch) + mz * Math.sin(pitch);
  const yH =
    mx * Math.sin(roll) * Math.sin(pitch) +
    my * Math.cos(roll) -
    mz * Math.sin(roll) * Math.cos(pitch);

  let heading = (Math.atan2(-yH, xH) * 180) / Math.PI;
  if (heading < 0) heading += 360;
  return heading;
}

const CARDINALS: { label: string; deg: number; color?: string }[] = [
  { label: "N", deg: 0,   color: "#f87171" },
  { label: "E", deg: 90 },
  { label: "S", deg: 180 },
  { label: "W", deg: 270 },
];

export function QiblaCard({ userLat, userLng }: Props) {
  const colors = useColors();
  const { isArabic } = useTranslation();

  const qiblaBearing = getQiblaBearing(userLat, userLng);
  const distanceKm   = getDistanceToMeccaKm(userLat, userLng);

  const [heading, setHeading]         = useState(0);
  const [available, setAvailable]     = useState(false);
  const [calibrated, setCalibrated]   = useState(false);
  const [accuracy, setAccuracy]       = useState<"low" | "medium" | "high">("low");
  const [needsCalib, setNeedsCalib]   = useState(false);
  const [sampleCount, setSampleCount] = useState(0);

  const magX     = useRef(0);
  const magY     = useRef(0);
  const magZ     = useRef(0);
  const accX     = useRef(0);
  const accY     = useRef(0);
  const accZ     = useRef(-1);
  const prevDeg  = useRef(0);
  const rotAnim  = useRef(new Animated.Value(0)).current;

  const magMin = useRef(Infinity);
  const magMax = useRef(-Infinity);

  useEffect(() => {
    if (Platform.OS === "web") return;

    let magSub: ReturnType<typeof Magnetometer.addListener>   | null = null;
    let accSub: ReturnType<typeof Accelerometer.addListener>  | null = null;

    Magnetometer.isAvailableAsync().then((ok) => {
      if (!ok) return;
      setAvailable(true);

      Magnetometer.setUpdateInterval(100);
      Accelerometer.setUpdateInterval(100);

      accSub = Accelerometer.addListener(({ x, y, z }) => {
        accX.current = ACC_ALPHA * x + (1 - ACC_ALPHA) * accX.current;
        accY.current = ACC_ALPHA * y + (1 - ACC_ALPHA) * accY.current;
        accZ.current = ACC_ALPHA * z + (1 - ACC_ALPHA) * accZ.current;
      });

      magSub = Magnetometer.addListener(({ x, y, z }) => {
        magX.current = MAG_ALPHA * x + (1 - MAG_ALPHA) * magX.current;
        magY.current = MAG_ALPHA * y + (1 - MAG_ALPHA) * magY.current;
        magZ.current = MAG_ALPHA * z + (1 - MAG_ALPHA) * magZ.current;

        const mag = Math.sqrt(
          magX.current * magX.current +
          magY.current * magY.current +
          magZ.current * magZ.current
        );
        if (mag < magMin.current) magMin.current = mag;
        if (mag > magMax.current) magMax.current = mag;

        const spread = magMax.current - magMin.current;
        const unstable = mag < 15 || mag > 120 || spread > 80;
        setNeedsCalib(unstable);

        const h = tiltCompensatedHeading(
          magX.current, magY.current, magZ.current,
          accX.current, accY.current, accZ.current
        );

        setSampleCount((c) => {
          const next = c + 1;
          if (next >= 15) {
            setCalibrated(true);
            setAccuracy(
              spread > 50 ? "low" :
              spread > 25 ? "medium" :
              "high"
            );
          }
          return next;
        });
        setHeading(h);
      });
    });

    return () => {
      magSub?.remove();
      accSub?.remove();
    };
  }, []);

  const needleDeg = available ? (qiblaBearing - heading + 360) % 360 : qiblaBearing;

  useEffect(() => {
    let diff = needleDeg - prevDeg.current;
    if (diff > 180)  diff -= 360;
    if (diff < -180) diff += 360;
    prevDeg.current += diff;
    Animated.timing(rotAnim, {
      toValue:         prevDeg.current,
      duration:        200,
      useNativeDriver: true,
    }).start();
  }, [needleDeg]);

  const spin = rotAnim.interpolate({
    inputRange:  [-1080, 1080],
    outputRange: ["-1080deg", "1080deg"],
  });

  const accuracyColor =
    accuracy === "high"   ? colors.primary :
    accuracy === "medium" ? "#f59e0b" :
                            "#f87171";

  const statusLabel = !available
    ? (isArabic ? "القبلة الثابتة" : "Static direction")
    : needsCalib
    ? (isArabic ? "يحتاج معايرة" : "Needs calibration")
    : !calibrated
    ? (isArabic ? "جاري المعايرة…" : "Calibrating…")
    : accuracy === "high"
    ? (isArabic ? "بوصلة مباشرة" : "Live compass")
    : (isArabic ? "دقة منخفضة" : "Low accuracy");

  const statusColor =
    !available  ? colors.mutedForeground :
    needsCalib  ? "#f87171" :
    !calibrated ? "#f59e0b" :
                  accuracyColor;

  const statusIcon =
    !available  ? "info" :
    needsCalib  ? "alert-triangle" :
    !calibrated ? "rotate-cw" :
                  "check-circle";

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={[styles.iconWrap, { backgroundColor: "#0ea5e920" }]}>
          <Feather name="compass" size={16} color="#0ea5e9" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            {isArabic ? "اتجاه القبلة" : "Qibla Direction"}
          </Text>
          <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
            {distanceKm.toLocaleString()} {isArabic ? "كم إلى مكة" : "km to Mecca"}
          </Text>
        </View>
        <View style={styles.bearingBadge}>
          <Text style={[styles.bearingNum, { color: colors.primary }]}>
            {Math.round(qiblaBearing)}°
          </Text>
          <Text style={[styles.bearingLbl, { color: colors.mutedForeground }]}>
            {isArabic ? "من الشمال" : "from N"}
          </Text>
        </View>
      </View>

      {/* Compass body */}
      <View style={styles.compassRow}>
        <View style={[styles.dial, { borderColor: colors.border, width: DIAL_SIZE, height: DIAL_SIZE, borderRadius: R }]}>
          {/* Cardinal labels */}
          {CARDINALS.map(({ label, deg, color }) => {
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

          {/* Tick marks at 45° intervals */}
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
                  position:        "absolute",
                  width:           len,
                  height:          1.5,
                  backgroundColor: colors.border,
                  left:            x1,
                  top:             y1,
                  transform:       [{ rotate: `${deg}deg` }],
                }}
              />
            );
          })}

          {/* Animated needle */}
          <Animated.View
            style={[
              styles.needleContainer,
              { width: DIAL_SIZE, height: DIAL_SIZE, transform: [{ rotate: spin }] },
            ]}
          >
            <View style={[styles.arrowTip, { borderBottomColor: colors.primary }]} />
            <View style={[styles.arrowShaft, { backgroundColor: colors.primary }]} />
            <View style={[styles.arrowTail, { backgroundColor: colors.primary + "50" }]} />
          </Animated.View>

          {/* Center hub */}
          <View
            style={[
              styles.hub,
              { left: R - 8, top: R - 8, backgroundColor: colors.card, borderColor: colors.border },
            ]}
          />
          <Text style={[styles.kaabaHint, { color: colors.mutedForeground }]}>🕋</Text>
        </View>

        {/* Right status panel */}
        <View style={styles.statusBlock}>
          <View style={[styles.statusChip, { backgroundColor: statusColor + "18" }]}>
            <Feather name={statusIcon as any} size={12} color={statusColor} />
            <Text style={[styles.statusChipText, { color: statusColor }]}>
              {statusLabel}
            </Text>
          </View>

          {available && calibrated && (
            <Text style={[styles.statusNote, { color: colors.mutedForeground }]}>
              {isArabic ? `الاتجاه: ${Math.round(heading)}°` : `Facing: ${Math.round(heading)}°`}
            </Text>
          )}

          {available && !calibrated && (
            <Text style={[styles.statusNote, { color: colors.mutedForeground }]}>
              {isArabic ? "حرّك الهاتف\nبشكل رقم 8" : "Move in a\nfigure-8"}
            </Text>
          )}

          {needsCalib && (
            <View style={[styles.calibHint, { backgroundColor: "#f8717118", borderColor: "#f8717130" }]}>
              <Text style={[styles.calibHintText, { color: "#f87171" }]}>
                {isArabic ? "حرّك الهاتف\nبشكل رقم 8\nللمعايرة" : "Move in\nfigure-8\nto calibrate"}
              </Text>
            </View>
          )}
        </View>
      </View>

      <Text style={[styles.hint, { color: colors.mutedForeground }]}>
        {available
          ? (isArabic ? "ضع الهاتف أفقياً، الشاشة للأعلى" : "Hold phone flat, screen facing up")
          : (isArabic
              ? `القبلة على بُعد ${Math.round(qiblaBearing)}° باتجاه عقارب الساعة من الشمال`
              : `Qibla is ${Math.round(qiblaBearing)}° clockwise from North`)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconWrap: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  cardTitle:    { fontSize: 15, fontWeight: "700" },
  cardSub:      { fontSize: 11, marginTop: 1 },
  bearingBadge: { alignItems: "flex-end" },
  bearingNum:   { fontSize: 22, fontWeight: "800", letterSpacing: -1 },
  bearingLbl:   { fontSize: 9 },

  compassRow: { flexDirection: "row", alignItems: "center", gap: 20, justifyContent: "center" },
  dial:       { borderWidth: 1.5, position: "relative" },

  cardinal: {
    position: "absolute", fontSize: 11, width: 14, textAlign: "center",
  },
  needleContainer: {
    position: "absolute", top: 0, left: 0,
    alignItems: "center", justifyContent: "flex-start", paddingTop: 16,
  },
  arrowTip: {
    width: 0, height: 0,
    borderLeftWidth: 7, borderRightWidth: 7, borderBottomWidth: 14,
    borderLeftColor: "transparent", borderRightColor: "transparent",
  },
  arrowShaft: { width: 4, height: 30, borderRadius: 2 },
  arrowTail:  { width: 4, height: 20, borderRadius: 2, marginTop: 2 },
  hub: {
    position: "absolute", width: 16, height: 16, borderRadius: 8, borderWidth: 2, zIndex: 10,
  },
  kaabaHint: {
    position: "absolute", top: 4, left: 0, right: 0,
    textAlign: "center", fontSize: 10,
  },

  statusBlock: { flex: 1, gap: 10, justifyContent: "center" },
  statusChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 8, padding: 8, alignSelf: "flex-start",
  },
  statusChipText: { fontSize: 11, fontWeight: "600", lineHeight: 15 },
  statusNote:     { fontSize: 11, lineHeight: 16 },
  calibHint: {
    borderRadius: 8, borderWidth: 1, padding: 8,
  },
  calibHintText: { fontSize: 10, lineHeight: 14, fontWeight: "600" },

  hint: { fontSize: 11, textAlign: "center" },
});
