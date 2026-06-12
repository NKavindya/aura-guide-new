import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { AppCard } from "../../components/AppCard";
import { InputField } from "../../components/InputField";
import { PrimaryButton } from "../../components/PrimaryButton";
import { useTheme } from "../../theme/ThemeContext";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ResetPasswordScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [step, setStep] = useState<"email" | "done">("email");

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
        authSubtitle: {
          maxWidth: 320,
          textAlign: "center",
          color: colors.muted,
          lineHeight: 22,
          fontWeight: "600",
        },
        authCard: { gap: 14 },
        errorText: { color: colors.danger, fontWeight: "600" },
        notice: { color: colors.muted, fontSize: 13, lineHeight: 20, fontWeight: "600" },
        doneTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
        doneBody: { color: colors.muted, lineHeight: 22, fontWeight: "600" },
      }),
    [colors],
  );

  const submit = () => {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !emailPattern.test(normalized)) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    setStep("done");
  };

  if (step === "done") {
    return (
      <ScrollView contentContainerStyle={styles.authScroll}>
        <View style={styles.authHero}>
          <View style={styles.logoBubble}>
            <Feather name="info" size={34} color={colors.primary} />
          </View>
          <Text style={styles.authTitle}>Reset not available yet</Text>
          <Text style={styles.authSubtitle}>
            We saved your request for {email.trim().toLowerCase()}, but email-based password reset is not configured on this server.
          </Text>
        </View>
        <AppCard style={styles.authCard}>
          <Text style={styles.doneTitle}>What you can do</Text>
          <Text style={styles.doneBody}>
            Sign in with your existing password if you remember it, or contact your course administrator to reset your account manually.
          </Text>
          <PrimaryButton label="Back to Sign In" onPress={onBack} />
        </AppCard>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.authScroll}>
      <View style={styles.authHero}>
        <View style={styles.logoBubble}>
          <Feather name="mail" size={34} color={colors.primary} />
        </View>
        <Text style={styles.authTitle}>Reset Password</Text>
        <Text style={styles.authSubtitle}>Enter the email on your account to continue.</Text>
      </View>

      <AppCard style={styles.authCard}>
        <Text style={styles.notice}>
          Email reset links are not enabled in this version. Continue to see next steps for your account.
        </Text>
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
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <PrimaryButton label="Continue" onPress={submit} disabled={!email.trim()} />
        <PrimaryButton label="Back to Sign In" onPress={onBack} secondary />
      </AppCard>
    </ScrollView>
  );
}
