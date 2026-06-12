import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { useTheme } from "./ThemeContext";

/** Shared dynamic text/surface styles for screens that use static StyleSheet.create at module level. */
export function useThemedScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        screenBg: { backgroundColor: colors.background },
        title: { color: colors.text, fontWeight: "900" as const },
        subtitle: { color: colors.muted },
        body: { color: colors.text },
        bodyMuted: { color: colors.muted },
        card: { backgroundColor: colors.surface, borderColor: colors.border },
        sectionTitle: { color: colors.text, fontWeight: "800" as const },
        chip: { backgroundColor: colors.chipBlue },
      }),
    [colors],
  );
  return { colors, isDark, styles };
}
