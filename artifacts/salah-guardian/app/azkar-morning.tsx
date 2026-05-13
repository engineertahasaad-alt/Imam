import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAzkar } from "@/context/AzkarContext";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "@/hooks/useTranslation";
import { MORNING_AZKAR, DailyZikr, dailyZikrToZikr } from "@/lib/azkarService";

function ZikrCard({
  zikr,
  index,
  isArabic,
  colors,
  t,
  onFloat,
}: {
  zikr: DailyZikr;
  index: number;
  isArabic: boolean;
  colors: ReturnType<typeof useColors>;
  t: (k: string) => string;
  onFloat: (zikr: DailyZikr) => void;
}) {
  const [count, setCount] = useState(zikr.repeatCount);
  const done = count === 0;

  function handleTap() {
    if (done) {
      setCount(zikr.repeatCount);
    } else {
      setCount((c) => c - 1);
    }
  }

  async function handleShare() {
    const text = isArabic
      ? zikr.arabicText
      : `${zikr.arabicText}\n\n${zikr.englishText}`;
    try {
      await Share.share({ message: text });
    } catch {}
  }

  const progress = done ? 1 : (zikr.repeatCount - count) / zikr.repeatCount;
  const progressColor = done ? colors.success : colors.primary;

  return (
    <TouchableOpacity
      onPress={handleTap}
      activeOpacity={0.85}
      style={[
        styles.card,
        {
          backgroundColor: done ? colors.primary + "12" : colors.card,
          borderColor: done ? colors.primary + "50" : colors.border,
        },
      ]}
    >
      {/* Arabic text */}
      <Text
        style={[
          styles.arabicText,
          { color: done ? colors.primary : colors.foreground },
        ]}
        textBreakStrategy="highQuality"
      >
        {zikr.arabicText}
      </Text>

      {/* English translation — only shown when English */}
      {!isArabic && (
        <Text style={[styles.englishText, { color: colors.mutedForeground }]}>
          {zikr.englishText}
        </Text>
      )}

      {/* Progress bar */}
      {zikr.repeatCount > 1 && (
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: progressColor,
                width: `${progress * 100}%` as any,
              },
            ]}
          />
        </View>
      )}

      {/* Bottom row */}
      <View style={styles.cardFooter}>
        {/* Counter badge */}
        <View
          style={[
            styles.counterBadge,
            {
              backgroundColor: done ? colors.success + "20" : colors.secondary,
              borderColor: done ? colors.success + "40" : colors.border,
            },
          ]}
        >
          {done ? (
            <MaterialCommunityIcons name="check-circle" size={14} color={colors.success} />
          ) : (
            <Text style={[styles.counterLabel, { color: colors.mutedForeground }]}>
              {isArabic ? "التكرار" : "Repeat"}
            </Text>
          )}
          <Text
            style={[
              styles.counterValue,
              { color: done ? colors.success : colors.foreground },
            ]}
          >
            {done ? (isArabic ? "تم ✓" : "Done ✓") : `${count} / ${zikr.repeatCount}`}
          </Text>
        </View>

        <View style={styles.cardActions}>
          {/* Float button */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary + "15" }]}
            onPress={() => onFloat(zikr)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons name="picture-in-picture-bottom-right" size={15} color={colors.primary} />
            <Text style={[styles.actionLabel, { color: colors.primary }]}>
              {isArabic ? "تعويم" : "Float"}
            </Text>
          </TouchableOpacity>

          {/* Share button */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.secondary }]}
            onPress={handleShare}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="share-2" size={14} color={colors.mutedForeground} />
            <Text style={[styles.actionLabel, { color: colors.mutedForeground }]}>
              {isArabic ? "مشاركة" : "Share"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function AzkarMorningScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isArabic } = useTranslation();
  const { showZikr } = useAzkar();

  function handleFloat(zikr: DailyZikr) {
    showZikr(dailyZikrToZikr(zikr));
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 12),
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <MaterialCommunityIcons name="weather-sunny" size={22} color="#f59e0b" />
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {t("morning_azkar")}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.list,
          {
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 32),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          {isArabic ? "اضغط على البطاقة للعد" : "Tap a card to count"}
        </Text>

        {MORNING_AZKAR.map((zikr, i) => (
          <ZikrCard
            key={zikr.id}
            zikr={zikr}
            index={i}
            isArabic={isArabic}
            colors={colors}
            t={t}
            onFloat={handleFloat}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn:      { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle:  { fontSize: 18, fontWeight: "700" },

  list: { padding: 16, gap: 14 },
  hint: { fontSize: 12, textAlign: "center", marginBottom: 4 },

  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },

  arabicText: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "right",
    lineHeight: 38,
    writingDirection: "rtl",
  },
  englishText: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: "left",
  },

  progressTrack: { height: 3, borderRadius: 2, overflow: "hidden" },
  progressFill:  { height: "100%", borderRadius: 2 },

  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  counterBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  counterLabel: { fontSize: 11, fontWeight: "500" },
  counterValue: { fontSize: 13, fontWeight: "700" },

  cardActions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionLabel: { fontSize: 12, fontWeight: "600" },
});
