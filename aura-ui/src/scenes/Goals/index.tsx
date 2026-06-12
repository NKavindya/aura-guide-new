import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { palette, commonStyles } from "../../theme";
import { AppCard } from "../../components/AppCard";
import { ProgressBar } from "../../components/ProgressBar";
import { ScreenHeader } from "../../components/ScreenHeader";
import { api } from "../../api/api";
import { useScreenScrollStyle } from "../../styles/screenStyles";
import { useTextColors } from "../../theme/themedHelpers";
import { useTheme } from "../../theme/ThemeContext";

export function GoalsScreen() {
  const { width } = useWindowDimensions();
  const tc = useTextColors();
  const { colors } = useTheme();
  const scrollStyle = useScreenScrollStyle();
  const [summary, setSummary] = useState<any>({
    completed_tasks: 0,
    skills: [],
    career_title: "",
    aura_score_percent: 0,
    skill_readiness_label: "",
    recommendation: "",
  });

  useEffect(() => {
    api
      .getGoalSummary()
      .then((data) =>
        setSummary(
          data || {
            completed_tasks: 0,
            skills: [],
            career_title: "",
            aura_score_percent: 0,
            skill_readiness_label: "",
            recommendation: "",
          },
        ),
      )
      .catch(() =>
        setSummary({
          completed_tasks: 0,
          skills: [],
          career_title: "",
          aura_score_percent: 0,
          skill_readiness_label: "",
          recommendation: "",
        }),
      );
  }, []);

  const technicalSkills = useMemo(
    () => (summary.skills || []).filter((skill: any) => (skill.category_name || "").toLowerCase() === "technical"),
    [summary.skills],
  );
  const softSkills = useMemo(
    () => (summary.skills || []).filter((skill: any) => (skill.category_name || "").toLowerCase() === "soft skills"),
    [summary.skills],
  );

  const techAvg = useMemo(() => avgPct(technicalSkills), [technicalSkills]);
  const softAvg = useMemo(() => avgPct(softSkills), [softSkills]);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={scrollStyle}>
      <ScreenHeader title="Goals & Skills" subtitle="Your professional roadmap" />

      <AppCard style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="rocket" size={28} color="#FFFFFF" />
          </View>
          <View style={commonStyles.flexOne}>
            <Text style={styles.heroEyebrow}>Current Track</Text>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {summary.career_title || "Select a goal in Profile"}
            </Text>
          </View>
        </View>
        
        <View style={[styles.heroStats, width < 380 && styles.heroStatsCol]}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{summary.completed_tasks ?? 0}</Text>
            <Text style={styles.heroStatLabel}>Tasks Done</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{techAvg}%</Text>
            <Text style={styles.heroStatLabel}>Tech Proficiency</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{softAvg}%</Text>
            <Text style={styles.heroStatLabel}>Soft Skills</Text>
          </View>
        </View>
        <Text style={styles.heroAuraLine}>
          Aura (avg. of assessed skills):{" "}
          <Text style={styles.heroAuraEm}>
            {typeof summary.aura_score_percent === "number" ? summary.aura_score_percent : 0}/100
          </Text>
          {summary.skill_readiness_label ? ` · ${summary.skill_readiness_label}` : ""}
        </Text>
      </AppCard>

      {summary.recommendation?.trim() ? (
        <AppCard style={[styles.recCard, { borderLeftColor: colors.success }]}>
          <Text style={[styles.recEyebrow, { color: colors.success }]}>Career recommendation</Text>
          <Text style={[styles.recBody, tc.text]}>{summary.recommendation.trim()}</Text>
        </AppCard>
      ) : null}

      <SkillSection title="Technical Skills" subtitle="Core competencies for your role" tone="tech" skills={technicalSkills} empty="No technical skills found for this goal." />

      <SkillSection title="Soft Skills" subtitle="Essential interpersonal abilities" tone="soft" skills={softSkills} empty="No soft skills found for this goal." />
    </ScrollView>
  );
}

function avgPct(skills: { current_pct?: number }[]) {
  if (!skills.length) return 0;
  const sum = skills.reduce((a, s) => a + (typeof s.current_pct === "number" ? s.current_pct : 0), 0);
  return Math.round(sum / skills.length);
}

function SkillSection({
  title,
  subtitle,
  tone,
  skills,
  empty,
}: {
  title: string;
  subtitle: string;
  tone: "tech" | "soft";
  skills: any[];
  empty: string;
}) {
  const { colors } = useTheme();
  const tc = useTextColors();
  const barColor = tone === "tech" ? colors.primary : colors.secondary;

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: tone === "tech" ? palette.chipBlue : palette.chipPurple }]}>
          <Ionicons name={tone === "tech" ? "code-slash" : "chatbubbles"} size={18} color={barColor} />
        </View>
        <View>
          <Text style={[styles.sectionTitle, tc.text]}>{title}</Text>
          <Text style={[styles.sectionSub, tc.muted]}>{subtitle}</Text>
        </View>
      </View>

      {skills.length === 0 ? (
        <AppCard style={styles.emptyCard}>
          <Text style={styles.empty}>{empty}</Text>
        </AppCard>
      ) : (
        <View style={commonStyles.stackMd}>
          {skills.map((skill: any) => (
            <AppCard key={String(skill.skill_id)} style={styles.skillBlock}>
              <View style={commonStyles.progressSummaryRow}>
                <Text style={[styles.skillName, tc.text]} numberOfLines={2}>{skill.skill_name}</Text>
                <View style={styles.pctBadge}>
                  <Text style={[styles.skillPct, { color: barColor }]}>
                    {skill.current_pct}%
                  </Text>
                </View>
              </View>
              <View style={styles.levelRow}>
                <Text style={[styles.levelHint, tc.muted]}>
                  Level: <Text style={[styles.levelValue, tc.text]}>{skill.current_level || "Not assessed"}</Text>
                </Text>
                <Text style={[styles.levelHint, tc.muted]}>
                  Target: <Text style={[styles.levelValue, tc.text]}>{skill.required_level || "—"}</Text>
                </Text>
              </View>
              <ProgressBar value={Math.min(skill.current_pct, 100)} color={barColor} />
            </AppCard>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: palette.primaryDark,
    borderColor: "rgba(255,255,255,0.1)",
    padding: 20,
    gap: 20,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  heroIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  heroEyebrow: {
    color: "rgba(255,255,255,0.6)",
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  heroStats: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.15)",
    paddingVertical: 16,
    borderRadius: 16,
  },
  heroStatsCol: {
    flexDirection: "column",
  },
  heroStat: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  heroStatValue: {
    fontSize: 20,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  heroStatLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase",
  },
  heroAuraLine: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.75)",
    lineHeight: 18,
  },
  heroAuraEm: {
    fontWeight: "800",
    color: "#FFFFFF",
  },
  heroDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  recCard: {
    borderLeftWidth: 4,
    borderLeftColor: palette.success,
    gap: 8,
  },
  recEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: palette.success,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  recBody: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
    color: palette.text,
  },
  sectionContainer: {
    marginTop: 24,
    gap: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 4,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: palette.text,
  },
  sectionSub: {
    fontSize: 13,
    color: palette.muted,
    fontWeight: "500",
  },
  emptyCard: {
    padding: 20,
    alignItems: "center",
  },
  empty: {
    fontSize: 14,
    color: palette.muted,
    textAlign: "center",
  },
  skillBlock: {
    padding: 16,
    gap: 12,
  },
  skillName: {
    flex: 1,
    fontWeight: "800",
    fontSize: 15,
    color: palette.text,
  },
  pctBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: palette.surfaceMuted,
  },
  skillPct: {
    fontWeight: "900",
    fontSize: 13,
  },
  levelRow: {
    flexDirection: "row",
    gap: 16,
  },
  levelHint: {
    fontSize: 12,
    color: palette.muted,
    fontWeight: "600",
  },
  levelValue: {
    color: palette.text,
    fontWeight: "800",
  },
});
