import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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
import { EVENING_AZKAR, DailyZikr, dailyZikrToZikr } from "@/lib/azkarService";

const EVENING_ACCENT = "#8b5cf6";

function ZikrCard({
  zikr,
  isArabic,
  colors,
  onFloat,
  onDone,
}: {
  zikr: DailyZikr;
  isArabic: boolean;
  colors: ReturnType<typeof useColors>;
  onFloat: (zikr: DailyZikr) => void;
  onDone: (id: string) => void;
}) {
  const [count, setCount] = useState(zikr.repeatCount);
  const done = count === 0;
  const reportedRef = useRef(false);

  useEffect(() => {
    if (done && !reportedRef.current) {
      reportedRef.current = true;
      onDone(zikr.id);
    }
  }, [done]);

  function handleTap() {
    if (done) {
      setCount(zikr.repeatCount);
      reportedRef.current = false;
    } else {
      setCount((c) => c - 1);
    }
  }

  async function handleShare() {
    const text = isArabic
      ? zikr.arabicText
      : `${zikr.arabicText}\n\n${zikr.englishText}`;
    try { await Share.share({ message: text }); } catch {}
  }

  const progress = done ? 1 : (zikr.repeatCount - count) / zikr.repeatCount;

  return (
    <TouchableOpacity
      onPress={handleTap}
      activeOpacity={0.85}
      style={[
        styles.card,
        {
          backgroundColor: done ? EVENING_ACCENT + "12" : colors.card,
          borderColor: done ? EVENING_ACCENT + "50" : colors.border,
        },
      ]}
    >
      <Text
        style={[styles.arabicText, { color: done ? EVENING_ACCENT : colors.foreground }]}
        textBreakStrategy="highQuality"
      >
        {zikr.arabicText}
      </Text>

      {!isArabic && (
        <Text style={[styles.englishText, { color: colors.mutedForeground }]}>
          {zikr.englishText}
        </Text>
      )}

      {zikr.repeatCount > 1 && (
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: done ? colors.success : EVENING_ACCENT,
                width: `${progress * 100}%` as any,
              },
            ]}
          />
        </View>
      )}

      <View style={styles.cardFooter}>
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
          <Text style={[styles.counterValue, { color: done ? colors.success : colors.foreground }]}>
            {done ? (isArabic ? "تم ✓" : "Done ✓") : `${count} / ${zikr.repeatCount}`}
          </Text>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: EVENING_ACCENT + "20" }]}
            onPress={() => onFloat(zikr)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons name="picture-in-picture-bottom-right" size={15} color={EVENING_ACCENT} />
            <Text style={[styles.actionLabel, { color: EVENING_ACCENT }]}>
              {isArabic ? "تعويم" : "Float"}
            </Text>
          </TouchableOpacity>

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

export default function AzkarEveningScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isArabic } = useTranslation();
  const { showZikr, markComplete, dailyCompletion } = useAzkar();

  const doneIdsRef = useRef<Set<string>>(new Set());
  const [allDone, setAllDone] = useState(dailyCompletion.evening);

  function handleFloat(zikr: DailyZikr) {
    showZikr(dailyZikrToZikr(zikr));
  }

  function handleCardDone(id: string) {
    doneIdsRef.current.add(id);
    if (doneIdsRef.current.size >= EVENING_AZKAR.length) {
      setAllDone(true);
      markComplete("evening");
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
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
          <MaterialCommunityIcons name="weather-night" size={22} color={EVENING_ACCENT} />
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {isArabic ? "أذكار المساء" : "Evening Azkar"}
          </Text>
        </View>
        {allDone ? (
          <MaterialCommunityIcons name="check-circle" size={24} color={colors.success} style={{ marginRight: 4 }} />
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 32) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {allDone && (
          <View style={[styles.completionBanner, { backgroundColor: colors.success + "18", borderColor: colors.success + "40" }]}>
            <MaterialCommunityIcons name="check-decagram" size={22} color={colors.success} />
            <Text style={[styles.completionText, { color: colors.success }]}>
              {isArabic ? "أحسنت! أتممت أذكار المساء اليوم 🌙" : "Well done! Evening Azkar complete for today 🌙"}
            </Text>
          </View>
        )}

        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          {isArabic ? "اضغط على البطاقة للعد" : "Tap a card to count"}
        </Text>

        {EVENING_AZKAR.map((zikr) => (
          <ZikrCard
            key={zikr.id}
            zikr={zikr}
            isArabic={isArabic}
            colors={colors}
            onFloat={handleFloat}
            onDone={handleCardDone}
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

  completionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  completionText: { fontSize: 13, fontWeight: "600", flex: 1 },

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
  englishText: { fontSize: 13, lineHeight: 20, textAlign: "left" },
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
