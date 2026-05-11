import { useApp } from "@/context/AppContext";
import { TKey, translations } from "@/lib/i18n";

export function useTranslation() {
  const { settings } = useApp();
  const lang = (settings.language ?? "en") as "en" | "ar";
  const isArabic = lang === "ar";

  function t(key: TKey): string {
    return (translations[lang] as Record<string, string>)[key]
      ?? (translations.en as Record<string, string>)[key]
      ?? key;
  }

  return { t, isArabic, lang };
}
