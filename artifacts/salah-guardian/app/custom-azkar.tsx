import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useTranslation } from "@/hooks/useTranslation";
import {
  Zikr,
  addCustomZikr,
  deleteCustomZikr,
  loadCustomAzkar,
} from "@/lib/azkarService";

export default function CustomAzkarScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { t }   = useTranslation();

  const [customAzkar, setCustomAzkar] = useState<Zikr[]>([]);
  const [arabic,      setArabic]      = useState("");
  const [translit,    setTranslit]    = useState("");
  const [translation, setTranslation] = useState("");
  const [saving,      setSaving]      = useState(false);

  useEffect(() => {
    loadCustomAzkar().then(setCustomAzkar);
  }, []);

  async function handleAdd() {
    const trimmed = arabic.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const updated = await addCustomZikr({
        arabic:          trimmed,
        transliteration: translit.trim(),
        translation:     translation.trim(),
      });
      setCustomAzkar(updated);
      setArabic("");
      setTranslit("");
      setTranslation("");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(index: number) {
    Alert.alert(
      t("s_delete_zikr"),
      customAzkar[index].arabic,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: t("s_delete_zikr"),
          style: "destructive",
          onPress: async () => {
            const updated = await deleteCustomZikr(index);
            setCustomAzkar(updated);
          },
        },
      ]
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 12, backgroundColor: colors.background, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {t("s_custom_azkar_title")}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hint */}
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          {t("s_custom_zikr_hint")}
        </Text>

        {/* Existing custom azkar list */}
        {customAzkar.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>🤲</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {t("s_no_custom_azkar")}
            </Text>
          </View>
        ) : (
          <View style={styles.listSection}>
            {customAzkar.map((zikr, index) => (
              <View
                key={index}
                style={[styles.zikrCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.zikrArabic, { color: colors.foreground }]}>
                    {zikr.arabic}
                  </Text>
                  {zikr.transliteration ? (
                    <Text style={[styles.zikrTranslit, { color: colors.primary }]}>
                      {zikr.transliteration}
                    </Text>
                  ) : null}
                  {zikr.translation ? (
                    <Text style={[styles.zikrTrans, { color: colors.mutedForeground }]}>
                      {zikr.translation}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={() => confirmDelete(index)}
                  style={[styles.deleteBtn, { backgroundColor: colors.destructive + "15" }]}
                >
                  <Feather name="trash-2" size={16} color={colors.destructive} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Add new zikr form */}
        <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.formTitle, { color: colors.foreground }]}>
            {t("s_add_zikr")}
          </Text>

          <TextInput
            style={[styles.input, styles.arabicInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.secondary }]}
            value={arabic}
            onChangeText={setArabic}
            placeholder={t("s_zikr_arabic_ph")}
            placeholderTextColor={colors.mutedForeground}
            textAlign="right"
            multiline
          />

          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.secondary }]}
            value={translit}
            onChangeText={setTranslit}
            placeholder={t("s_zikr_translit_ph")}
            placeholderTextColor={colors.mutedForeground}
          />

          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.secondary }]}
            value={translation}
            onChangeText={setTranslation}
            placeholder={t("s_zikr_trans_ph")}
            placeholderTextColor={colors.mutedForeground}
          />

          <TouchableOpacity
            style={[
              styles.addBtn,
              {
                backgroundColor: arabic.trim() ? colors.primary : colors.border,
                opacity: saving ? 0.7 : 1,
              },
            ]}
            onPress={handleAdd}
            disabled={!arabic.trim() || saving}
          >
            <Feather name="plus" size={18} color={arabic.trim() ? colors.primaryForeground : colors.mutedForeground} />
            <Text style={[styles.addBtnText, { color: arabic.trim() ? colors.primaryForeground : colors.mutedForeground }]}>
              {t("s_save_zikr")}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  backBtn:     { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700" },

  container: { padding: 20, gap: 16 },

  hint: { fontSize: 13, lineHeight: 18, textAlign: "center" },

  emptyCard: {
    borderRadius: 14, borderWidth: 1,
    padding: 32, alignItems: "center", gap: 4,
  },
  emptyText: { fontSize: 13, textAlign: "center", lineHeight: 20 },

  listSection: { gap: 10 },
  zikrCard: {
    borderRadius: 12, borderWidth: 1, padding: 14,
    flexDirection: "row", alignItems: "flex-start", gap: 12,
  },
  zikrArabic:  { fontSize: 18, fontWeight: "600", lineHeight: 28, textAlign: "right" },
  zikrTranslit:{ fontSize: 12, marginTop: 4 },
  zikrTrans:   { fontSize: 11, marginTop: 2, lineHeight: 16 },
  deleteBtn:   { borderRadius: 8, padding: 8, alignSelf: "flex-start" },

  formCard: {
    borderRadius: 14, borderWidth: 1, padding: 16, gap: 10,
  },
  formTitle: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  input: {
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14,
  },
  arabicInput: {
    fontSize: 18, minHeight: 56,
    fontWeight: "500",
  },
  addBtn: {
    borderRadius: 12, paddingVertical: 13,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 4,
  },
  addBtnText: { fontSize: 15, fontWeight: "700" },
});
