import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { palette, commonStyles } from "../../theme";
import { AppCard } from "../../components/AppCard";
import { Badge } from "../../components/Badge";
import { ProgressBar } from "../../components/ProgressBar";
import { ScreenHeader } from "../../components/ScreenHeader";
import { TextLink } from "../../components/TextLink";
import { UserProfile, Route, TabRoute } from "../../types";
import { api } from "../../api/api";
import { screenStyles, useScreenScrollStyle } from "../../styles/screenStyles";
import { useTextColors } from "../../theme/themedHelpers";
import { useTheme } from "../../theme/ThemeContext";

function formatToday() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function taskStatusLabel(status: string | undefined) {
  const s = (status || "").toLowerCase();
  if (s === "completed") return "Done";
  if (s === "in_progress") return "In progress";
  return "To do";
}

function taskProgress(status: string | undefined) {
  const s = (status || "").toLowerCase();
  if (s === "completed") return 100;
  if (s === "in_progress") return 55;
  return 18;
}

function LinearQuickIcon({
  bg,
  iconColor,
  name,
}: {
  bg: string;
  iconColor: string;
  name: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={[styles.quickIconOuter, { backgroundColor: bg }]}>
      <Ionicons name={name} size={22} color={iconColor} />
    </View>
  );
}

export function DashboardScreen({
  user,
  isReturningUser = true,
  onNavigate,
  onNavigateTab,
  onSignOut,
}: {
  user: UserProfile;
  isReturningUser?: boolean;
  onNavigate: (route: Route) => void;
  onNavigateTab?: (tab: TabRoute) => void;
  onSignOut: () => void;
}) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const tc = useTextColors();
  const scrollStyle = useScreenScrollStyle(styles.screenRoot);
  const themed = useMemo(
    () =>
      StyleSheet.create({
        iconButton: {
          width: 42,
          height: 42,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        },
        calendarRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 14,
          paddingHorizontal: 14,
          borderRadius: 18,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: 4,
        },
      }),
    [colors],
  );
  const [tasks, setTasks] = useState<any[]>([]);
  const [todayPlan, setTodayPlan] = useState<any[]>([]);
  const [dayStreak, setDayStreak] = useState(1);
  const [score, setScore] = useState(user.currentScore || 0);
  const [readiness, setReadiness] = useState(user.skillReadinessLabel || "");
  const [reminder, setReminder] = useState("");
  const [quote, setQuote] = useState("");

  const safeDate = (value: any) => (typeof value === "string" ? value : "");

  useEffect(() => {
    api
      .getDashboardSummary()
      .then((data) => {
        setTasks(Array.isArray(data.ongoing_tasks) ? data.ongoing_tasks : []);
        setTodayPlan(Array.isArray(data.todays_plan) ? data.todays_plan : []);
        setDayStreak(typeof data.day_streak === "number" ? data.day_streak : 1);
        setScore(typeof data.current_score === "number" ? data.current_score : 0);
        setReadiness(typeof data.skill_readiness_label === "string" ? data.skill_readiness_label : "");
      })
      .catch(() => {
        setTasks([]);
        setTodayPlan([]);
        setScore(user.currentScore || 0);
        setReadiness(user.skillReadinessLabel || "");
      });
  }, [user.currentScore, user.skillReadinessLabel]);

  useEffect(() => {
    Promise.all([api.getDailyTaskReminder().catch(() => ({ message: "" })), api.getMotivationalQuote().catch(() => ({ message: "" }))]).then(([r, q]) => {
      setReminder(typeof r.message === "string" ? r.message : "");
      setQuote(typeof q.message === "string" ? q.message : "");
    });
  }, []);

  const coachBody =
    (user.recommendation && user.recommendation.trim()) ||
    reminder ||
    quote ||
    "Your plan updates as you complete tasks. Open Tasks to keep momentum.";

  const coachSupporting =
    user.recommendation?.trim() && reminder && reminder !== user.recommendation ? reminder : user.recommendation?.trim() && quote ? quote : "";

  const name = user.firstName?.trim() || "there";

  const goTab = onNavigateTab ?? ((_t: TabRoute) => {});

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={scrollStyle}>
      {/*<Text style={styles.appTitle}>AURA Guide – Your Personalized Career Coach</Text>*/}
      <ScreenHeader
        title={isReturningUser ? `Welcome back,\n${name}!` : `Welcome,\n${name}!`}
        subtitle={formatToday()}
        leftAction={
          <View style={styles.headerLogo}>
            <Ionicons name="sparkles" size={18} color="#FFFFFF" />
          </View>
        }
        rightAction={
          <View style={styles.headerActions}>
            <Pressable onPress={() => onNavigate("notifications")} style={themed.iconButton}>
              <Ionicons name="notifications-outline" size={20} color={colors.text} />
            </Pressable>
            <Pressable onPress={onSignOut} style={themed.iconButton}>
              <Ionicons name="log-out-outline" size={20} color={colors.text} />
            </Pressable>
          </View>
        }
      />

      <View style={[styles.statsRow, width < 360 && styles.statsRowStack]}>
        <AppCard style={[styles.metricCard, styles.metricCardElevated]}>
          <View style={styles.metricContent}>
            <View>
              <Text style={[styles.metricValue, tc.text]}>{score}</Text>
              <Text style={styles.metricLabel}>Aura score (0–100)</Text>
              {readiness ? <Text style={styles.metricHint}>{readiness}</Text> : null}
            </View>
            <View style={[styles.metricIconWrap, { backgroundColor: palette.chipYellow }]}>
              <Ionicons name="trophy" size={28} color={palette.warning} />
            </View>
          </View>
        </AppCard>
        <AppCard style={[styles.metricCard, styles.metricCardElevated]}>
          <View style={styles.metricContent}>
            <View>
              <Text style={[styles.metricValue, tc.text]}>{dayStreak}</Text>
              <Text style={styles.metricLabel}>Day Streak</Text>
            </View>
            <View style={[styles.metricIconWrap, { backgroundColor: palette.chipGreen }]}>
              <Ionicons name="flame" size={28} color={palette.success} />
            </View>
          </View>
        </AppCard>
      </View>

      <Pressable onPress={() => onNavigate("careerTrack")} style={({ pressed }) => pressed && styles.quickPressed}>
        <AppCard style={styles.goalCard}>
          <View style={styles.goalHeader}>
            <View style={styles.goalIcon}>
              <Ionicons name="rocket" size={20} color={palette.primary} />
            </View>
            <Text style={styles.eyebrow}>Career Track</Text>
          </View>
          <Text style={[styles.goalTitle, tc.text]}>{user.goal || "Set your goal in Profile"}</Text>
        </AppCard>
      </Pressable>

      <AppCard style={styles.coachCard}>
        <View style={styles.coachHeader}>
          <Ionicons name="bulb" size={20} color="#FBBF24" />
          <Text style={styles.coachEyebrow}>Insights for you</Text>
        </View>
        <Text style={styles.coachBody}>{coachBody}</Text>
        {coachSupporting ? <Text style={styles.coachSupport}>{coachSupporting}</Text> : null}
      </AppCard>

      <Text style={[styles.sectionTitle, styles.sectionTitleSpaced, tc.text]}>Quick Actions</Text>
      {/*<View style={styles.quickActionsRow}>*/}
      {/*  <Pressable*/}
      {/*    style={({ pressed }) => [styles.quickActionTile, pressed && styles.quickPressed]}*/}
      {/*    onPress={() => goTab("aiCoach")}*/}
      {/*    accessibilityRole="button"*/}
      {/*    accessibilityLabel="Open AI Coach"*/}
      {/*  >*/}
      {/*    <LinearQuickIcon bg="#EEF2FF" iconColor="#4F46E5" name="chatbubble-ellipses" />*/}
      {/*    <Text style={styles.quickTileTitle}>AI Coach</Text>*/}
      {/*    <Text style={styles.quickTileSub}>Guided prompts</Text>*/}
      {/*  </Pressable>*/}
      {/*  <Pressable*/}
      {/*    style={({ pressed }) => [styles.quickActionTile, pressed && styles.quickPressed]}*/}
      {/*    onPress={() => goTab("tasks")}*/}
      {/*  >*/}
      {/*    <LinearQuickIcon bg={palette.chipBlue} iconColor={palette.primary} name="checkbox-outline" />*/}
      {/*    <Text style={styles.quickTileTitle}>Tasks</Text>*/}
      {/*    <Text style={styles.quickTileSub}>Plan & answers</Text>*/}
      {/*  </Pressable>*/}
      {/*  <Pressable*/}
      {/*    style={({ pressed }) => [styles.quickActionTile, pressed && styles.quickPressed]}*/}
      {/*    onPress={() => goTab("goals")}*/}
      {/*  >*/}
      {/*    <LinearQuickIcon bg={palette.chipGreen} iconColor="#047857" name="flag" />*/}
      {/*    <Text style={styles.quickTileTitle}>Goals</Text>*/}
      {/*    <Text style={styles.quickTileSub}>Skills & gaps</Text>*/}
      {/*  </Pressable>*/}
      {/*</View>*/}
      <Pressable
        style={({ pressed }) => [themed.calendarRow, pressed && styles.quickPressed]}
        onPress={() => onNavigate("calendar")}
      >
        <View style={[styles.quickIconOuter, { backgroundColor: palette.chipBlue }]}>
          <Ionicons name="calendar-outline" size={22} color={palette.primary} />
        </View>
        <View style={commonStyles.flexOne}>
          <Text style={[styles.calendarRowTitle, tc.text]}>Calendar</Text>
          <Text style={[styles.calendarRowSub, tc.muted]}>Sessions & deadlines</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={palette.muted} />
      </Pressable>

      <AppCard style={commonStyles.stackMd}>
        <View style={styles.sectionHeadingRow}>
          <Text style={[styles.sectionTitle, tc.text]}>Today's Plan</Text>
        </View>
        <View style={commonStyles.stackSm}>
          {todayPlan.length === 0 ? (
            <Text style={[styles.emptyMuted, tc.muted]}>No tasks yet. Ask AI Coach to assign one, or add your own from Tasks.</Text>
          ) : null}
          {todayPlan.map((item) => (
            <View key={`${item.id}-${item.task}`} style={styles.timelineRow}>
              <View style={[styles.timelineLine, item.status === "completed" && styles.timelineLineDone]} />
              <View style={commonStyles.flexOne}>
                <Text style={[styles.timelineTask, tc.text, item.status === "completed" && styles.timelineTaskDone]}>{item.task}</Text>
                <View style={styles.timelineMetaRow}>
                  <Ionicons name="time-outline" size={12} color={palette.muted} />
                  <Text style={styles.timelineMeta}>
                    {safeDate(item.start_date_time).slice(11, 16) ? safeDate(item.start_date_time).slice(11, 16) + " · " : ""}
                    {taskStatusLabel(item.status)}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </AppCard>

      <View style={styles.sectionHeadingRow}>
        <Text style={[styles.sectionTitle, tc.text]}>Ongoing Tasks</Text>
        <TextLink label="View all" onPress={() => onNavigate("tasks")} />
      </View>

      {tasks.length === 0 ? (
        <AppCard variant="muted">
          <Text style={[styles.emptyMuted, tc.muted]}>You're all caught up on active tasks!</Text>
        </AppCard>
      ) : null}

      {tasks.slice(0, 5).map((task) => (
        <AppCard key={task.id} style={[styles.taskCard, styles.taskCardModern]}>
          <View style={styles.taskRow}>
            <View style={commonStyles.flexOne}>
              <Text selectable style={[styles.ongoingTaskBody, tc.text]}>
                {task.task}
              </Text>
              <View style={[commonStyles.badgeRow, styles.taskBadges]}>
                {task.is_custom ? (
                  <Badge
                    label="Personal"
                    backgroundColor={palette.chipGreen}
                    textColor={palette.accent}
                  />
                ) : null}
                <Badge label={taskStatusLabel(task.status)} backgroundColor={palette.surfaceMuted} textColor={palette.muted} />
              </View>
            </View>
          </View>
          <View style={styles.progressContainer}>
            <ProgressBar value={taskProgress(task.status)} />
          </View>
          <View style={styles.taskFooter}>
            <Ionicons name="calendar-outline" size={12} color={palette.muted} />
            <Text style={[styles.taskDate, tc.muted]}>
              {safeDate(task.start_date_time).slice(0, 10)}
              {safeDate(task.end_date_time) ? ` - ${safeDate(task.end_date_time).slice(0, 10)}` : ""}
            </Text>
          </View>
        </AppCard>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    paddingBottom: 8,
  },
  appTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: palette.primary,
    letterSpacing: 0.3,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerLogo: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.primary,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statsRowStack: {
    flexDirection: "column",
  },
  metricCard: {
    flex: 1,
    padding: 16,
  },
  metricCardElevated: {
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
  },
  metricContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metricIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  metricValue: {
    fontSize: 24,
    fontWeight: "900",
    color: palette.text,
  },
  metricLabel: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  metricHint: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
  goalCard: {
    gap: 8,
    borderLeftWidth: 4,
    borderLeftColor: palette.primary,
  },
  goalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  goalIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: palette.chipBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: palette.primary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  goalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: palette.text,
  },
  coachCard: {
    backgroundColor: palette.primaryDark,
    borderColor: "rgba(255,255,255,0.1)",
    gap: 12,
  },
  coachHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  coachEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  coachBody: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  coachSupport: {
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "500",
  },
  sectionHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: palette.text,
    letterSpacing: -0.5,
  },
  sectionTitleSpaced: {
    marginTop: 8,
    marginBottom: 4,
  },
  quickActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 6,
  },
  quickActionTile: {
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: "28%",
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 6,
    alignItems: "flex-start",
  },
  quickPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  quickIconOuter: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  quickTileTitle: {
    fontWeight: "800",
    fontSize: 13,
    color: palette.text,
  },
  quickTileSub: {
    fontSize: 11,
    fontWeight: "600",
    color: palette.muted,
    lineHeight: 15,
  },
  calendarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: 4,
  },
  calendarRowTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: palette.text,
  },
  calendarRowSub: {
    fontSize: 12,
    fontWeight: "600",
    color: palette.muted,
    marginTop: 2,
  },
  timelineRow: {
    flexDirection: "row",
    gap: 16,
    alignItems: "stretch",
    paddingVertical: 4,
  },
  timelineLine: {
    width: 4,
    borderRadius: 4,
    backgroundColor: palette.chipBlue,
    minHeight: 40,
  },
  timelineLineDone: {
    backgroundColor: palette.success,
  },
  timelineTask: {
    fontWeight: "700",
    fontSize: 15,
    color: palette.text,
  },
  timelineTaskDone: {
    color: palette.muted,
    textDecorationLine: "line-through",
  },
  timelineMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  timelineMeta: {
    fontSize: 12,
    color: palette.muted,
    fontWeight: "600",
  },
  emptyMuted: {
    color: palette.muted,
    textAlign: "center",
    paddingVertical: 12,
  },
  taskCard: {
    marginBottom: 12,
  },
  taskCardModern: {
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
  },
  ongoingTaskBody: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    color: palette.text,
  },
  taskRow: {
    marginBottom: 8,
  },
  taskBadges: {
    marginTop: 8,
  },
  progressContainer: {
    marginVertical: 12,
  },
  taskFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  taskDate: {
    fontSize: 12,
    fontWeight: "600",
    color: palette.muted,
  },
});
