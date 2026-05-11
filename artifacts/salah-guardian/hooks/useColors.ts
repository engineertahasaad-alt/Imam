import { useEffect, useReducer } from "react";
import { useColorScheme } from "react-native";

import colors from "@/constants/colors";
import { getStoredTheme, subscribeTheme } from "@/lib/themeStore";

export function useColors() {
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const systemScheme = useColorScheme();

  useEffect(() => subscribeTheme(rerender), []);

  const storedTheme  = getStoredTheme();
  const resolvedScheme =
    storedTheme === "system" ? (systemScheme ?? "dark") : storedTheme;
  const isDark  = resolvedScheme === "dark";
  const palette = isDark ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius, isDark };
}
