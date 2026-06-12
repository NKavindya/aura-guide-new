import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { AppCard } from "../../components/AppCard";
import { InputField } from "../../components/InputField";
import { PrimaryButton } from "../../components/PrimaryButton";
import { TextLink } from "../../components/TextLink";
import { initialProfile } from "../../constants";
import { useTheme } from "../../theme/ThemeContext";

export function SignInScreen({
  onSignIn,
  onOpenSignUp,
  onOpenReset,
}: {
  onSignIn: (email?: string, password?: string) => void;
  onOpenSignUp: () => void;
  onOpenReset: () => void;
}) {
  const { colors } = useTheme();
  const [email, setEmail] = useState(initialProfile.email);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const canSubmit = Boolean(email.trim()) && password.length > 0;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        authScroll: {
          paddingHorizontal: 20,
          paddingVertical: 28,
          justifyContent: "center",
          minHeight: "100%",
          gap: 18,
          backgroundColor: colors.background,
        },
        authHero: { alignItems: "center", gap: 10 },
        logoBubble: {
          width: 74,
          height: 74,
          borderRadius: 24,
          backgroundColor: colors.surface,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: colors.border,
        },
        authTitle: { fontSize: 30, fontWeight: "800", color: colors.text, textAlign: "center" },
        authSubtitle: { maxWidth: 300, textAlign: "center", color: colors.muted, lineHeight: 22 },
        authCard: { gap: 14 },
        footerRow: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 4 },
        footerText: { color: colors.muted, fontWeight: "600" },
        showHideBtn: { paddingHorizontal: 4, paddingVertical: 6 },
        showHideText: { color: colors.primary, fontWeight: "800", fontSize: 13 },
      }),
    [colors],
  );

  return (
    <ScrollView contentContainerStyle={styles.authScroll}>
      <View style={styles.authHero}>
        <View style={styles.logoBubble}>
          <Ionicons name="school" size={36} color={colors.primary} />
        </View>
        <Text style={styles.authTitle}>Welcome back</Text>
        <Text style={styles.authSubtitle}>Sign in to continue your AURA journey.</Text>
      </View>

      <AppCard style={styles.authCard}>
        <InputField
          label="Email"
          placeholder="you@university.edu"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          icon={<Feather name="mail" size={18} color={colors.muted} />}
        />
        <InputField
          label="Password"
          placeholder="Your password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          trailingAccessory={
            <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.showHideBtn} hitSlop={8}>
              <Text style={styles.showHideText}>{showPassword ? "Hide" : "Show"}</Text>
            </Pressable>
          }
        />
        <TextLink label="Forgot password?" onPress={onOpenReset} />
        <PrimaryButton label="Sign In" onPress={() => onSignIn(email, password)} disabled={!canSubmit} />
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>New here?</Text>
          <TextLink label="Create account" onPress={onOpenSignUp} />
        </View>
      </AppCard>
    </ScrollView>
  );
}
