import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { palette, commonStyles } from "../../theme";
import { AppCard } from "../../components/AppCard";
import { InputField } from "../../components/InputField";
import { PickerField } from "../../components/PickerField";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ScreenHeader } from "../../components/ScreenHeader";
import { UserProfile } from "../../types";
import { Picker } from "@react-native-picker/picker";
import { api } from "../../api/api";
import { screenStyles, useScreenScrollStyle } from "../../styles/screenStyles";
import { useTextColors } from "../../theme/themedHelpers";
import { useTheme } from "../../theme/ThemeContext";
import { prettifyCvLine } from "../../utils/cvFeedback";

function avgPct(skills: { current_pct?: number }[]) {
  if (!skills.length) return 0;
  const sum = skills.reduce((a, s) => a + (typeof s.current_pct === "number" ? s.current_pct : 0), 0);
  return Math.round(sum / skills.length);
}

export function ProfileScreen({
  user,
  onNavigateSettings,
  onSignOut,
  onProfileUpdated,
}: {
  user: UserProfile;
  onNavigateSettings: () => void;
  onSignOut?: () => void;
  onProfileUpdated: () => Promise<void>;
}) {
  const { width } = useWindowDimensions();
  const tc = useTextColors();
  const { colors } = useTheme();
  const scrollStyle = useScreenScrollStyle();
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(user);
  const [cvItems, setCvItems] = useState<any[]>([]);
  const [cvInsights, setCvInsights] = useState<{
    strengths: string[];
    weaknesses: string[];
    improvements: string[];
  } | null>(null);
  const [summary, setSummary] = useState<any>({ skills: [], completed_tasks: 0 });
  const [downloadingCv, setDownloadingCv] = useState(false);

  useEffect(() => {
    setForm(user);
  }, [user]);

  const loadCvSection = async () => {
    try {
      const [items, fb] = await Promise.all([
        api.listCVs(),
        api.getCVFeedback().catch(() => null),
      ]);
      setCvItems(Array.isArray(items) ? items : []);
      const f = fb as any;
      if (f && (f.strengths?.length || f.weaknesses?.length || f.improvements?.length)) {
        setCvInsights({
          strengths: Array.isArray(f.strengths) ? f.strengths : [],
          weaknesses: Array.isArray(f.weaknesses) ? f.weaknesses : [],
          improvements: Array.isArray(f.improvements) ? f.improvements : [],
        });
      } else {
        setCvInsights(null);
      }
    } catch {
      setCvItems([]);
      setCvInsights(null);
    }
  };

  useEffect(() => {
    loadCvSection();
  }, []);

  useEffect(() => {
    api.getGoalSummary().then(setSummary).catch(() => setSummary({ skills: [], completed_tasks: 0 }));
  }, [user.goalId]);

  const techAvg = useMemo(
    () => avgPct((summary.skills || []).filter((s: any) => (s.category_name || "").toLowerCase() === "technical")),
    [summary.skills],
  );
  const softAvg = useMemo(
    () => avgPct((summary.skills || []).filter((s: any) => (s.category_name || "").toLowerCase() === "soft skills")),
    [summary.skills],
  );

  const initials = `${(form.firstName || "?").slice(0, 1)}${(form.lastName || "").slice(0, 1)}`.toUpperCase();

  const downloadCv = async () => {
    setDownloadingCv(true);
    try {
      await api.downloadCV();
    } catch (error) {
      Alert.alert("Download failed", (error as Error).message);
    } finally {
      setDownloadingCv(false);
    }
  };

  const saveProfile = async () => {
    try {
      await api.updateUserProfile({
        first_name: form.firstName,
        last_name: form.lastName,
        degree_program: form.degreeProgram,
        study_year: parseInt(form.studyYear, 10) || 1,
        university: form.university,
        technical_skill_level: form.technicalSkillLevel,
        soft_skill_level: form.softSkillLevel,
        availability_type: form.availabilityType,
        availability_hours: parseInt(form.availabilityHours, 10) || 1,
        goal_id: form.goalId || 1,
      });
      await onProfileUpdated();
      setIsEditing(false);
      Alert.alert("Success", "Profile updated successfully.");
      api.getGoalSummary().then(setSummary).catch(() => {});
    } catch (error) {
      Alert.alert("Update failed", (error as Error).message);
    }
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={scrollStyle}>
      <ScreenHeader
        title="Profile"
        subtitle="Your learning identity"
        rightAction={
          <Pressable onPress={onNavigateSettings} style={[styles.roundBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="settings-outline" size={21} color={colors.text} />
          </Pressable>
        }
      />

      <AppCard style={styles.coverCard}>
        <View style={[styles.coverRow, width < 400 && styles.coverRowStack]}>
          <View style={styles.avatarRing}>
            <View style={styles.avatarInner}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </View>
          <View style={commonStyles.flexOne}>
            <Text style={[styles.displayName, tc.text]}>
              {form.firstName} {form.lastName}
            </Text>
            <Text style={styles.email}>{form.email}</Text>
            <View style={[styles.miniChips, { marginTop: 10 }]}>
              <Text style={styles.chip}>{user.goal || "Goal unset"}</Text>
              <Text style={styles.chip}>{form.degreeProgram || "Degree"}</Text>
            </View>
          </View>
          <Pressable onPress={() => setIsEditing((v) => !v)} style={styles.roundBtn}>
            <Feather name="edit-2" size={18} color={palette.primary} />
          </Pressable>
        </View>
      </AppCard>

      {isEditing ? (
          <AppCard style={commonStyles.stackSm}>
            <Text style={styles.sectionLabel}>Edit details</Text>
            <InputField label="First name" placeholder="First name" value={form.firstName} onChangeText={(v) => setForm({ ...form, firstName: v })} />
            <InputField label="Last name" placeholder="Last name" value={form.lastName} onChangeText={(v) => setForm({ ...form, lastName: v })} />
            <InputField label="University" placeholder="University" value={form.university} onChangeText={(v) => setForm({ ...form, university: v })} />

            <PickerField label="Degree Program" selectedValue={form.degreeProgram} onValueChange={(v) => setForm({ ...form, degreeProgram: v })}>
              <Picker.Item label="Select Degree Program" value="" />
              <Picker.Item label="Software Engineering" value="Software Engineering" />
              <Picker.Item label="Computer Science" value="Computer Science" />
              <Picker.Item label="Information Technology" value="Information Technology" />
            </PickerField>
            <PickerField label="Study Year" selectedValue={form.studyYear} onValueChange={(v) => setForm({ ...form, studyYear: v })}>
              <Picker.Item label="Select Study Year" value="" />
              <Picker.Item label="1st year" value="1" />
              <Picker.Item label="2nd year" value="2" />
              <Picker.Item label="3rd year" value="3" />
              <Picker.Item label="4th year" value="4" />
            </PickerField>
            <PickerField label="Goal" selectedValue={String(form.goalId || "")} onValueChange={(v) => setForm({ ...form, goalId: parseInt(v, 10) || 1 })}>
              <Picker.Item label="Select Goal" value="" />
              <Picker.Item label="Software Engineer" value="1" />
              <Picker.Item label="Backend Developer" value="2" />
              <Picker.Item label="QA Engineer" value="3" />
              <Picker.Item label="DevOps Engineer" value="4" />
            </PickerField>
            <PickerField label="Technical level" selectedValue={form.technicalSkillLevel} onValueChange={(v) => setForm({ ...form, technicalSkillLevel: v })}>
              <Picker.Item label="Select level" value="" />
              <Picker.Item label="Beginner" value="Beginner" />
              <Picker.Item label="Intermediate" value="Intermediate" />
              <Picker.Item label="Advanced" value="Advanced" />
            </PickerField>
            <PickerField label="Soft skills level" selectedValue={form.softSkillLevel} onValueChange={(v) => setForm({ ...form, softSkillLevel: v })}>
              <Picker.Item label="Select level" value="" />
              <Picker.Item label="Beginner" value="Beginner" />
              <Picker.Item label="Intermediate" value="Intermediate" />
              <Picker.Item label="Advanced" value="Advanced" />
            </PickerField>
            <PickerField label="Availability type" selectedValue={form.availabilityType} onValueChange={(v) => setForm({ ...form, availabilityType: v })}>
              <Picker.Item label="Select availability type" value="" />
              <Picker.Item label="Daily" value="daily" />
              <Picker.Item label="Weekly" value="weekly" />
            </PickerField>
            <PickerField label="Availability (hours)" selectedValue={form.availabilityHours} onValueChange={(v) => setForm({ ...form, availabilityHours: v })}>
              <Picker.Item label="Select hours" value="" />
              {Array.from({ length: 24 }, (_, i) => (
                <Picker.Item key={i + 1} label={`${i + 1} hour${i === 0 ? "" : "s"}`} value={`${i + 1}`} />
              ))}
            </PickerField>
            <View style={styles.editActions}>
              <PrimaryButton label="Save Changes" onPress={saveProfile} style={styles.saveBtn} />
              <Pressable onPress={() => setIsEditing(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
            </View>
          </AppCard>
      ) : null}
      
      <AppCard style={styles.metricsCard}>
        <Text style={styles.metricsEyebrow}>Momentum</Text>
        <View style={[styles.metricsGrid, width < 380 && styles.metricsGridStack]}>
          <Metric
            icon="sparkles-outline"
            label="Aura score"
            value={`${summary.aura_score_percent ?? user.currentScore ?? 0}`}
            subtitle={summary.skill_readiness_label || user.skillReadinessLabel || ""}
            tint={palette.primaryMuted}
          />
          <Metric icon="checkmark-done-outline" label="Tasks done" value={`${summary.completed_tasks ?? 0}`} tint={palette.success} />
          <Metric icon="code-slash-outline" label="Technical" value={`${techAvg}%`} tint="#6366F1" />
          <Metric icon="chatbubbles-outline" label="Soft skills" value={`${softAvg}%`} tint={palette.secondary} />
        </View>
      </AppCard>

      {onSignOut ? (
        <PrimaryButton label="Sign Out" onPress={onSignOut} variant="danger" />
      ) : null}

      <AppCard>
        <Text style={[styles.sectionLabel, tc.text]}>CV & analysis</Text>
        {cvItems.length === 0 ? (
          <Text style={styles.cvEmpty}>No CV on file yet. Upload a PDF from AI Coach for agent analysis.</Text>
        ) : (
          cvItems.map((cv: any) => (
            <View key={`${cv.file_name}-${cv.uploaded_at}`} style={styles.cvRow}>
              <View style={styles.cvIcon}>
                <Ionicons name="document-text" size={20} color={palette.primary} />
              </View>
              <View style={commonStyles.flexOne}>
                <Text style={[styles.cvFile, tc.text]}>{cv.file_name}</Text>
                <Text style={styles.cvDate}>{String(cv.uploaded_at).slice(0, 16).replace("T", " · ")}</Text>
              </View>
              <Pressable
                onPress={downloadCv}
                disabled={downloadingCv}
                style={({ pressed }) => [styles.cvDownloadBtn, pressed && styles.cvDownloadBtnPressed]}
                accessibilityLabel="Download CV PDF"
              >
                <Ionicons name={downloadingCv ? "hourglass-outline" : "download-outline"} size={20} color={palette.primary} />
              </Pressable>
            </View>
          ))
        )}
        {cvInsights ? (
          <View style={styles.cvInsightBlock}>
            {cvInsights.strengths.length ? (
              <View style={styles.cvInsightColumn}>
                <Text style={[styles.cvInsightTitle, tc.text]}>Strengths</Text>
                {cvInsights.strengths.slice(0, 8).map((line, i) => (
                  <Text key={`s-${i}`} style={[styles.cvBullet, tc.text]}>
                    • {prettifyCvLine(line)}
                  </Text>
                ))}
              </View>
            ) : null}
            {cvInsights.weaknesses.length ? (
              <View style={styles.cvInsightColumn}>
                <Text style={[styles.cvInsightTitle, tc.text]}>Growth areas</Text>
                {cvInsights.weaknesses.slice(0, 8).map((line, i) => (
                  <Text key={`w-${i}`} style={[styles.cvBullet, tc.text]}>
                    • {prettifyCvLine(line)}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </AppCard>
    </ScrollView>
  );
}

function Metric({
  icon,
  label,
  value,
  subtitle,
  tint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  subtitle?: string;
  tint: string;
}) {
  return (
    <View style={styles.metricCell}>
      <View style={[styles.metricIconBg, { backgroundColor: tint + "22" }]}>
        <Ionicons name={icon} size={22} color={tint} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricCap}>{label}</Text>
      {subtitle ? <Text style={styles.metricSub}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: palette.border,
  },
  coverCard: {
    padding: 18,
    borderLeftWidth: 4,
    borderLeftColor: palette.primaryMuted,
    overflow: "hidden",
  },
  coverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  coverRowStack: {
    flexWrap: "wrap",
  },
  avatarRing: {
    padding: 3,
    borderRadius: 22,
    backgroundColor: "rgba(129,140,248,0.85)",
  },
  avatarInner: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: palette.primaryDark,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.95)",
  },
  avatarText: {
    fontSize: 26,
    fontWeight: "900",
    color: "#F8FAFC",
  },
  displayName: {
    fontSize: 22,
    fontWeight: "900",
    color: palette.text,
    letterSpacing: -0.4,
  },
  email: {
    marginTop: 4,
    fontSize: 14,
    color: palette.muted,
    fontWeight: "600",
  },
  miniChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    fontSize: 12,
    fontWeight: "700",
    color: palette.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: palette.chipBlue,
    overflow: "hidden",
  },
  metricsCard: {
    gap: 14,
    backgroundColor: "rgba(248,250,252,0.94)",
    borderColor: palette.border,
  },
  metricsEyebrow: {
    fontWeight: "900",
    fontSize: 11,
    color: palette.muted,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metricsGridStack: {
    flexDirection: "column",
  },
  metricCell: {
    flexGrow: 1,
    flexBasis: "42%",
    minWidth: "40%",
    borderRadius: 16,
    padding: 12,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 6,
    alignItems: "flex-start",
  },
  metricIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "900",
    color: palette.text,
  },
  metricCap: {
    fontSize: 12,
    fontWeight: "700",
    color: palette.muted,
  },
  metricSub: {
    fontSize: 11,
    fontWeight: "600",
    color: palette.muted,
    lineHeight: 15,
  },
  sectionLabel: {
    fontWeight: "900",
    fontSize: 16,
    color: palette.text,
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  cvEmpty: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },
  cvRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  cvIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: palette.chipBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  cvFile: {
    fontWeight: "800",
    color: palette.text,
    fontSize: 15,
  },
  cvDate: {
    marginTop: 2,
    fontSize: 12,
    color: palette.muted,
    fontWeight: "600",
  },
  cvDownloadBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.chipBlue,
    borderWidth: 1,
    borderColor: palette.border,
  },
  cvDownloadBtnPressed: {
    opacity: 0.85,
  },
  cvInsightBlock: {
    marginTop: 16,
    gap: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  cvInsightColumn: {
    gap: 6,
  },
  cvInsightTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: palette.text,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  cvBullet: {
    fontSize: 13,
    lineHeight: 19,
    color: palette.text,
    fontWeight: "600",
  },
  editActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  saveBtn: {
    flex: 2,
  },
  cancelBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surfaceMuted,
    borderWidth: 1,
    borderColor: palette.border,
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: palette.muted,
  },
});
