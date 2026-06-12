import React, { ReactNode, useMemo } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";

export function InputField({
  label,
  placeholder,
  value,
  onChangeText,
  icon,
  secureTextEntry,
  keyboardType,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  icon?: ReactNode;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address";
}) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        inputGroup: { gap: 8 },
        inputLabel: { fontSize: 14, fontWeight: "700", color: colors.text },
        inputWrapper: { justifyContent: "center" },
        inputIcon: { position: "absolute", left: 14, zIndex: 2 },
        input: {
          height: 52,
          borderRadius: 16,
          backgroundColor: colors.surfaceMuted,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: 16,
          color: colors.text,
        },
        inputWithIcon: { paddingLeft: 42 },
      }),
    [colors],
  );

  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputWrapper}>
        {icon ? <View style={styles.inputIcon}>{icon}</View> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          keyboardType={keyboardType}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={secureTextEntry}
          style={[styles.input, icon ? styles.inputWithIcon : undefined]}
        />
      </View>
    </View>
  );
}
