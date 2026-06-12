import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { AppCard } from "../../components/AppCard";
import { InputField } from "../../components/InputField";
import { PrimaryButton } from "../../components/PrimaryButton";
import { api } from "../../api/api";
import { useThemedScreen } from "../../theme/useThemedScreen";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ResetPasswordScreen({ onBack }: { onBack: () => void }) {
  const { colors, styles: themed } = useThemedScreen();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !emailPattern.test(normalized)) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await api.requestPasswordReset(normalized);
      setSent(true);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.toLowerCase().includes("not configured")) {
        Alert.alert(
          "Email not configured",
          "The server cannot send reset emails yet. Ask your administrator to set SMTP_HOST and SMTP_FROM, or sign in with your existing password.",
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.authScroll, themed.screenBg]}>
      <View style={styles.authHero}>
        <View style={[styles.logoBubble, { backgroundColor: colors.surface }]}>
          <Feather name="mail" size={34} color={colors.primary} />
        </View>
        <Text style={[styles.authTitle, themed.title]}>Reset Password</Text>
        <Text style={[styles.authSubtitle, themed.subtitle]}>
          {sent ? "If an account exists, check your inbox for a reset link." : "Enter your email to request a reset link."}
        </Text>
      </View>

      <AppCard style={styles.authCard}>
        {!sent ? (
          <>
            <InputField
              label="Email"
              placeholder="you@university.edu"
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                if (error) setError("");
              }}
              keyboardType="email-address"
              icon={<Feather name="mail" size={18} color={colors.muted} />}
            />
            {error ? <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text> : null}
            <PrimaryButton label={loading ? "Sending…" : "Send Reset Link"} onPress={submit} disabled={!email.trim() || loading} />
            <PrimaryButton label="Back to Sign In" onPress={onBack} secondary />
          </>
        ) : (
          <View style={styles.centeredBlock}>
            <View style={[styles.successIcon, { backgroundColor: colors.chipGreen }]}>
              <Feather name="check" size={24} color={colors.success} />
            </View>
            <Text style={[styles.confirmTitle, themed.title]}>Request received</Text>
            <Text style={[styles.confirmText, themed.subtitle]}>
              If {email.trim()} is registered and email is configured on the server, you will receive reset instructions shortly.
            </Text>
            <PrimaryButton label="Back to Sign In" onPress={onBack} secondary />
          </View>
        )}
      </AppCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  authScroll: {
    paddingHorizontal: 20,
    paddingVertical: 28,
    justifyContent: "center",
    minHeight: "100%",
    gap: 18,
  },
  authHero: { alignItems: "center", gap: 10 },
  logoBubble: {
    width: 74,
    height: 74,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  authTitle: { fontSize: 30, fontWeight: "800", textAlign: "center" },
  authSubtitle: { maxWidth: 300, textAlign: "center", lineHeight: 22 },
  authCard: { gap: 14 },
  centeredBlock: { alignItems: "center", gap: 12 },
  successIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmTitle: { fontSize: 22, fontWeight: "800" },
  confirmText: { textAlign: "center", lineHeight: 22 },
  errorText: { fontWeight: "600" },
});
