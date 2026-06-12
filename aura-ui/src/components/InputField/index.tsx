import React, { ReactNode, useMemo } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";

export function InputField({
  label,
  placeholder,
  value,
  onChangeText,
  icon,
  trailingAccessory,
  secureTextEntry,
  keyboardType,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  icon?: ReactNode;
  trailingAccessory?: ReactNode;
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
        inputTrailing: { position: "absolute", right: 12, zIndex: 2 },
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
        inputWithTrailing: { paddingRight: 72 },
      }),
    [colors],
  );

  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputWrapper}>
        {icon ? <View style={styles.inputIcon}>{icon}</View> : null}
        {trailingAccessory ? <View style={styles.inputTrailing}>{trailingAccessory}</View> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          keyboardType={keyboardType}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={secureTextEntry}
          style={[
            styles.input,
            icon ? styles.inputWithIcon : undefined,
            trailingAccessory ? styles.inputWithTrailing : undefined,
          ]}
        />
      </View>
    </View>
  );
}
