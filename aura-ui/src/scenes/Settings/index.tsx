import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { confirmAction, showAlert } from "../../utils/alert";
import { useScreenScrollStyle } from "../../styles/screenStyles";
import { useTheme } from "../../theme/ThemeContext";
import { AppCard } from "../../components/AppCard";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ScreenHeader } from "../../components/ScreenHeader";

export function SettingsScreen({
  values,
  onChange,
  onOpenTerms,
  onBack,
  onSignOut,
  onDeleteAccount,
}: {
  values: { notifications: boolean; darkMode: boolean; language: string };
  onChange: (next: { notifications: boolean; darkMode: boolean; language: string }) => void;
  onOpenTerms: () => void;
  onBack: () => void;
  onSignOut: () => void;
  onDeleteAccount?: () => Promise<void>;
}) {
  const { colors } = useTheme();
  const scrollStyle = useScreenScrollStyle({ paddingTop: 8, paddingBottom: 40, gap: 20 });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        sectionCard: { padding: 16, gap: 16 },
        sectionTitle: {
          fontSize: 14,
          fontWeight: "900",
          color: colors.muted,
          textTransform: "uppercase",
          letterSpacing: 1,
        },
        rows: { gap: 20 },
        settingsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
        rowLabel: { flexDirection: "row", alignItems: "flex-start", gap: 12, flex: 1, marginRight: 8 },
        rowMeta: { fontSize: 12, color: colors.muted, marginTop: 2, fontWeight: "600" },
        iconCircle: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
        rowText: { fontSize: 16, fontWeight: "700", color: colors.text },
        valueText: { fontSize: 14, fontWeight: "600", color: colors.muted },
        footer: { marginTop: 12, gap: 16 },
        deleteAccountBtn: { alignItems: "center", paddingVertical: 12 },
        deleteAccountText: { color: colors.danger, fontWeight: "800", fontSize: 15 },
        versionText: { textAlign: "center", fontSize: 12, color: colors.muted, fontWeight: "600" },
      }),
    [colors],
  );

  const confirmDelete = () => {
    void (async () => {
      const ok = await confirmAction(
        "Delete account",
        "This permanently removes your profile, tasks, scores, and chat history. This cannot be undone.",
      );
      if (!ok) return;
      try {
        await onDeleteAccount?.();
      } catch (e) {
        showAlert("Delete failed", (e as Error).message);
      }
    })();
  };

  return (
    <ScrollView contentContainerStyle={scrollStyle}>
      <ScreenHeader title="Settings" subtitle="Preferences & account" onBack={onBack} />

      <AppCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.rows}>
          <Pressable onPress={onOpenTerms} style={styles.settingsRow}>
            <View style={styles.rowLabel}>
              <View style={[styles.iconCircle, { backgroundColor: colors.chipBlue }]}>
                <Ionicons name="document-text-outline" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.rowText}>Terms and Conditions — updated May 2026</Text>
                <Text style={styles.rowMeta}>Full text opens in Terms</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        </View>
      </AppCard>

      <AppCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.rows}>
          <View style={styles.settingsRow}>
            <View style={styles.rowLabel}>
              <View style={[styles.iconCircle, { backgroundColor: colors.chipGreen }]}>
                <Ionicons name="notifications-outline" size={20} color={colors.success} />
              </View>
              <Text style={styles.rowText}>Notifications</Text>
            </View>
            <Switch
              value={values.notifications}
              onValueChange={(notifications) => onChange({ ...values, notifications })}
              trackColor={{ false: colors.border, true: colors.primaryMuted }}
              thumbColor={values.notifications ? colors.primary : "#f4f3f4"}
            />
          </View>

          <View style={styles.settingsRow}>
            <View style={styles.rowLabel}>
              <View style={[styles.iconCircle, { backgroundColor: colors.chipPurple }]}>
                <Ionicons name="moon-outline" size={20} color={colors.secondary} />
              </View>
              <Text style={styles.rowText}>Dark Mode</Text>
            </View>
            <Switch
              value={values.darkMode}
              onValueChange={(darkMode) => onChange({ ...values, darkMode })}
              trackColor={{ false: colors.border, true: colors.primaryMuted }}
              thumbColor={values.darkMode ? colors.primary : "#f4f3f4"}
            />
          </View>

          <View style={styles.settingsRow}>
            <View style={styles.rowLabel}>
              <View style={[styles.iconCircle, { backgroundColor: colors.chipYellow }]}>
                <Ionicons name="language-outline" size={20} color={colors.warning} />
              </View>
              <Text style={styles.rowText}>Language</Text>
            </View>
            <Text style={styles.valueText}>{values.language}</Text>
          </View>
        </View>
      </AppCard>

      <View style={styles.footer}>
        <PrimaryButton label="Sign Out" onPress={onSignOut} variant="danger" />
        {onDeleteAccount ? (
          <Pressable onPress={confirmDelete} style={styles.deleteAccountBtn}>
            <Text style={styles.deleteAccountText}>Delete account</Text>
          </Pressable>
        ) : null}
        <Text style={styles.versionText}>Version 1.0.0 (AURA)</Text>
      </View>
    </ScrollView>
  );
}
