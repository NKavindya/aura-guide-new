import React, { ReactNode, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { cardShadow } from "../../theme";
import { useTheme } from "../../theme/ThemeContext";

export function AppCard({
  children,
  style,
  variant = "default",
}: {
  children: ReactNode;
  style?: object;
  variant?: "default" | "muted";
}) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: colors.surface,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 20,
          ...cardShadow.shadow,
        },
        cardMuted: {
          backgroundColor: colors.surfaceMuted,
          borderColor: "transparent",
        },
      }),
    [colors],
  );

  return <View style={[styles.card, variant === "muted" && styles.cardMuted, style]}>{children}</View>;
}
