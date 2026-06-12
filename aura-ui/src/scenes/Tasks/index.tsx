import React, { useEffect, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { palette, commonStyles } from "../../theme";
import { AppCard } from "../../components/AppCard";
import { Badge } from "../../components/Badge";
import { ProgressBar } from "../../components/ProgressBar";
import { ScreenHeader } from "../../components/ScreenHeader";
import { SegmentedControl } from "../../components/SegmentedControl";
import { PrimaryButton } from "../../components/PrimaryButton";
import { InputField } from "../../components/InputField";
import { api } from "../../api/api";
import { screenStyles } from "../../styles/screenStyles";
import { useThemedScreen } from "../../theme/useThemedScreen";
import { PendingTaskAnswerPayload } from "../AICoach";

function statusLabel(status: string | undefined) {
  const s = (status || "").toLowerCase();
  if (s === "completed") return "Done";
  if (s === "in_progress") return "In progress";
  return "To do";
}

async function confirmDeleteTask(summary: string): Promise<boolean> {
  const message = summary ? `Remove this task?\n\n${summary}` : "Remove this task?";

  if (Platform.OS === "web") {
    if (typeof window === "undefined") return false;
    return window.confirm(message);
  }

  return new Promise<boolean>((resolve) => {
    Alert.alert(
      "Delete Task",
      message,
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => resolve(false),
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

function statusProgress(status: string | undefined) {
  const s = (status || "").toLowerCase();
  if (s === "completed") return 100;
  if (s === "in_progress") return 55;
  return 20;
}

function parseTaskInstant(value: unknown): number {
  const s = typeof value === "string" ? value : "";
  if (!s) return Number.MAX_SAFE_INTEGER;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
}

/** Due soon / recent first for open tasks; most recently ended first for completed. */
function sortTasksForTab(tab: string, taskList: any[]): any[] {
  const copy = [...taskList];
  if (tab === "Completed") {
    copy.sort((a, b) => parseTaskInstant(b.end_date_time) - parseTaskInstant(a.end_date_time));
    return copy;
  }
  copy.sort((a, b) => {
    const endDiff = parseTaskInstant(a.end_date_time) - parseTaskInstant(b.end_date_time);
    if (endDiff !== 0) return endDiff;
    return parseTaskInstant(a.start_date_time) - parseTaskInstant(b.start_date_time);
  });
  return copy;
}

function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function TasksScreen({
  onNavigateCalendar,
  onRequestAgentTaskAnswer,
}: {
  onNavigateCalendar: () => void;
  onRequestAgentTaskAnswer?: (payload: PendingTaskAnswerPayload) => void;
}) {
  const [listTab, setListTab] = useState("Today");
  const [tasks, setTasks] = useState<any[]>([]);
  const [showAddTaskCard, setShowAddTaskCard] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [newStartDate, setNewStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [newEndDate, setNewEndDate] = useState(tomorrowISO());
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [editTaskName, setEditTaskName] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const { colors, styles: themed } = useThemedScreen();
  const safeDate = (value: any) => (typeof value === "string" ? value : "");

  const loadTasks = async () => {
    try {
      const data = await api.getTasks();
      setTasks(Array.isArray(data) ? data : []);
    } catch (error) {
      Alert.alert("Task loading failed", (error as Error).message);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTasks = tasks.filter(
    (task) => safeDate(task.start_date_time).slice(0, 10) <= todayStr && (task.status || "").toLowerCase() !== "completed",
  );
  const upcomingTasks = tasks.filter(
    (task) => safeDate(task.start_date_time).slice(0, 10) > todayStr && (task.status || "").toLowerCase() !== "completed",
  );
  const completed = tasks.filter((task) => (task.status || "").toLowerCase() === "completed");

  const rawShown = listTab === "Today" ? todayTasks : listTab === "Upcoming" ? upcomingTasks : completed;
  const shown = sortTasksForTab(listTab, rawShown);

  const addTask = async () => {
    if (!newTask.trim()) return;
    if (!newStartDate || !newEndDate) {
      Alert.alert("Missing dates", "Start and end date are required.");
      return;
    }
    if (newEndDate <= newStartDate) {
      Alert.alert("Invalid range", "End date must be after start date.");
      return;
    }
    await api.addTask({
      task: newTask.trim(),
      status: "pending",
      start_date_time: `${newStartDate}T09:00:00.000Z`,
      end_date_time: `${newEndDate}T18:00:00.000Z`,
    });
    setNewTask("");
    setShowAddTaskCard(false);
    await loadTasks();
    Alert.alert("Success", "Task added successfully.");
  };

  const moveTask = async (task: any, status: string) => {
    if (!task.is_custom) {
      Alert.alert("Managed by AURA", "Status for generated tasks is updated through agent interactions.");
      return;
    }
    await api.updateTask(task.id, { status });
    await loadTasks();
  };

  const openEditTask = (task: any) => {
    setEditingTask(task);
    setEditTaskName(typeof task.task === "string" ? task.task : "");
    setEditStartDate(safeDate(task.start_date_time).slice(0, 10));
    setEditEndDate(safeDate(task.end_date_time).slice(0, 10) || tomorrowISO());
  };

  const saveEditedTask = async () => {
    if (!editingTask) return;
    if (!editTaskName.trim()) {
      Alert.alert("Missing name", "Task name is required.");
      return;
    }
    if (!editStartDate || !editEndDate || editEndDate <= editStartDate) {
      Alert.alert("Invalid dates", "End date must be after start date.");
      return;
    }
    await api.updateTask(editingTask.id, {
      task: editTaskName.trim(),
      start_date_time: `${editStartDate}T09:00:00.000Z`,
      end_date_time: `${editEndDate}T18:00:00.000Z`,
    });
    setEditingTask(null);
    await loadTasks();
    Alert.alert("Updated", "Task saved.");
  };

  const deleteTaskPressed = async (task: any) => {
    const rawId = task.id;
    const id = Number(rawId);
    if (!Number.isFinite(id)) {
      if (Platform.OS === "web") {
        typeof window !== "undefined" && window.alert("Invalid task id.");
      } else {
        Alert.alert("Error", "Invalid task id.");
      }
      return;
    }

    const title = typeof task.task === "string" ? task.task.trim() : "";
    const excerpt = title.length > 90 ? `${title.slice(0, 90)}…` : title;

    const confirmed = await confirmDeleteTask(excerpt || "(no description)");
    if (!confirmed) return;

    try {
      await api.deleteTask(id);
      await loadTasks();
    } catch (error) {
      const msg = (error as Error).message || "Something went wrong";
      if (Platform.OS === "web") {
        typeof window !== "undefined" && window.alert(`Delete failed: ${msg}`);
      } else {
        Alert.alert("Delete failed", msg);
      }
    }
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[screenStyles.scrollContent, themed.screenBg]}>
      <ScreenHeader
        title="Tasks"
        subtitle="Stay on top of your plan"
        rightAction={
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => setShowAddTaskCard(true)}
              style={styles.iconButton}
              accessibilityLabel="Add new task"
            >
              <Ionicons name="add" size={24} color={palette.primary} />
            </Pressable>
            <Pressable onPress={onNavigateCalendar} style={styles.iconButton} accessibilityLabel="Open calendar">
              <Ionicons name="calendar" size={22} color={palette.primary} />
            </Pressable>
          </View>
        }
      />

      <View style={styles.tabContainer}>
        <SegmentedControl options={["Today", "Upcoming", "Completed"]} value={listTab} onChange={setListTab} />
      </View>

      {showAddTaskCard ? (
        <View style={styles.addTaskSheet}>
          <View style={styles.addTaskToolbar}>
            <Text style={styles.addTaskToolbarTitle}>Create Task</Text>
            <Pressable
              onPress={() => setShowAddTaskCard(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Cancel create task"
            >
              <Text style={styles.cancelLink}>Cancel</Text>
            </Pressable>
          </View>
          <AppCard style={styles.addCard}>
            <View style={styles.addHeader}>
              <View style={styles.addIconCircle}>
                <Ionicons name="add" size={24} color={palette.primary} />
              </View>
              <View>
                <Text style={styles.addTitle}>Create Task</Text>
                <Text style={styles.addHint}>Add a custom goal to your track</Text>
              </View>
            </View>
            <View style={commonStyles.stackSm}>
              <InputField
                label="Task Name"
                placeholder="e.g. Learn React Navigation"
                value={newTask}
                onChangeText={setNewTask}
              />
              <View style={styles.dateInputRow}>
                <View style={commonStyles.flexOne}>
                  <InputField
                    label="Start Date"
                    placeholder="YYYY-MM-DD"
                    value={newStartDate}
                    onChangeText={setNewStartDate}
                  />
                </View>
                <View style={commonStyles.flexOne}>
                  <InputField label="End Date" placeholder="YYYY-MM-DD" value={newEndDate} onChangeText={setNewEndDate} />
                </View>
              </View>
              <PrimaryButton label="Add Task" onPress={addTask} />
            </View>
          </AppCard>
        </View>
      ) : null}

      {editingTask ? (
        <View style={styles.addTaskSheet}>
          <View style={styles.addTaskToolbar}>
            <Text style={styles.addTaskToolbarTitle}>Edit Task</Text>
            <Pressable onPress={() => setEditingTask(null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.cancelLink}>Cancel</Text>
            </Pressable>
          </View>
          <AppCard style={styles.addCard}>
            <View style={commonStyles.stackSm}>
              <InputField label="Task Name" placeholder="Task name" value={editTaskName} onChangeText={setEditTaskName} />
              <View style={styles.dateInputRow}>
                <View style={commonStyles.flexOne}>
                  <InputField label="Start Date" placeholder="YYYY-MM-DD" value={editStartDate} onChangeText={setEditStartDate} />
                </View>
                <View style={commonStyles.flexOne}>
                  <InputField label="End Date" placeholder="YYYY-MM-DD" value={editEndDate} onChangeText={setEditEndDate} />
                </View>
              </View>
              <PrimaryButton label="Save changes" onPress={saveEditedTask} />
            </View>
          </AppCard>
        </View>
      ) : null}

      {shown.length === 0 ? (
        <AppCard style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons name="clipboard-outline" size={48} color={palette.muted} />
          </View>
          <Text style={styles.emptyTitle}>No tasks here</Text>
          <Text style={styles.emptyBody}>
            {listTab === "Today" && "You're all caught up for today! Add a personal task below."}
            {listTab === "Upcoming" && "No future tasks scheduled. Plan your next moves!"}
            {listTab === "Completed" && "Finish tasks to see them in your archives."}
          </Text>
        </AppCard>
      ) : null}

      <View style={commonStyles.stackMd}>
        {shown.map((task) => (
          <AppCard key={`${task.task_origin ?? "custom"}-${task.id}`} style={styles.taskCard}>
            <View style={styles.cardTop}>
              <View style={commonStyles.flexOne}>
                <Text selectable style={[styles.taskDescription, themed.body]}>
                  {task.task}
                </Text>
                <View style={[commonStyles.badgeRow, styles.badges]}>
                  {(task.task_origin ?? "custom") === "agent" ? (
                    <Badge label="Agent" backgroundColor="#EEF2FF" textColor="#4338CA" />
                  ) : task.is_custom ? (
                    <Badge label="Personal" backgroundColor={palette.chipGreen} textColor={palette.accent} />
                  ) : (
                    <Badge label="Plan" backgroundColor={palette.chipPurple} textColor={palette.secondary} />
                  )}
                  <Badge label={statusLabel(task.status)} backgroundColor={palette.surfaceMuted} textColor={palette.muted} />
                </View>
              </View>
              <View style={styles.cardActions}>
                {task.is_custom ? (
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => openEditTask(task)}
                    style={styles.editButton}
                    accessibilityLabel="Edit task"
                  >
                    <Ionicons name="create-outline" size={18} color={palette.primary} />
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => void deleteTaskPressed(task)}
                  style={styles.deleteButton}
                  hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                  accessibilityLabel="Delete task"
                  accessibilityRole="button"
                >
                  <Ionicons name="trash-outline" size={18} color={palette.danger} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.progressSection}>
              <ProgressBar value={statusProgress(task.status)} color={task.is_custom ? palette.accent : palette.primary} />
            </View>

            <View style={styles.dateFooter}>
              <View style={styles.dateInfo}>
                <Ionicons name="calendar-outline" size={14} color={palette.muted} />
                <Text style={styles.dateText}>
                  {safeDate(task.start_date_time).slice(0, 10)} - {safeDate(task.end_date_time).slice(0, 10) || "-"}
                </Text>
              </View>
            </View>

            {(task.task_origin ?? "custom") === "agent" &&
            String(task.status || "").toLowerCase() !== "completed" &&
            onRequestAgentTaskAnswer ? (
              <Pressable
                style={styles.agentAnswerBtn}
                onPress={() =>
                  onRequestAgentTaskAnswer({
                    userCommonTaskId: task.id,
                    taskText: task.task,
                    skillName: task.skill_name || "Code Understanding",
                  })
                }
              >
                <Ionicons name="chatbubble-ellipses-outline" size={18} color="#FFFFFF" />
                <Text style={styles.agentAnswerBtnText}>Answer in AI Coach</Text>
              </Pressable>
            ) : null}
            {task.is_custom ? (
              <View style={styles.actions}>
                <MiniAction label="To Do" onPress={() => moveTask(task, "pending")} active={task.status === "pending"} />
                <MiniAction label="Doing" onPress={() => moveTask(task, "in_progress")} active={task.status === "in_progress"} />
                <MiniAction label="Done" onPress={() => moveTask(task, "completed")} primary />
              </View>
            ) : (task.task_origin ?? "custom") !== "agent" ? (
              <View style={styles.auraHint}>
                <Ionicons name="sparkles-outline" size={12} color={palette.muted} />
                <Text style={styles.hintText}>Suggested from your plan</Text>
              </View>
            ) : (
              <View style={styles.auraHint}>
                <Ionicons name="information-circle-outline" size={12} color={palette.muted} />
                <Text style={styles.hintText}>Submit your answer from AI Coach to receive feedback.</Text>
              </View>
            )}
          </AppCard>
        ))}
      </View>
    </ScrollView>
  );
}

function MiniAction({
  label,
  onPress,
  primary,
  active,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  active?: boolean;
}) {
  return (
    <Pressable 
      onPress={onPress} 
      style={[
        styles.miniBtn, 
        primary && styles.miniBtnPrimary,
        active && styles.miniBtnActive
      ]}
    >
      <Text style={[
        styles.miniBtnText, 
        primary && styles.miniBtnTextPrimary,
        active && styles.miniBtnTextActive
      ]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  addTaskSheet: {
    marginBottom: 16,
    gap: 10,
  },
  addTaskToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  addTaskToolbarTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: palette.text,
  },
  cancelLink: {
    fontSize: 15,
    fontWeight: "700",
    color: palette.primary,
  },
  tabContainer: {
    marginBottom: 16,
  },
  taskCard: {
    padding: 16,
  },
  taskDescription: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    color: palette.text,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.chipBlue,
  },
  badges: {
    marginTop: 10,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  progressSection: {
    marginVertical: 14,
  },
  dateFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  dateInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dateText: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.muted,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  miniBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    alignItems: "center",
  },
  miniBtnPrimary: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  miniBtnActive: {
    backgroundColor: palette.chipBlue,
    borderColor: palette.primary,
  },
  miniBtnText: {
    fontWeight: "800",
    fontSize: 12,
    color: palette.text,
  },
  miniBtnTextPrimary: {
    color: "#FFFFFF",
  },
  miniBtnTextActive: {
    color: palette.primary,
  },
  auraHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  hintText: {
    fontSize: 12,
    color: palette.muted,
    fontWeight: "600",
  },
  agentAnswerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: palette.primary,
    marginBottom: 10,
  },
  agentAnswerBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },
  emptyCard: {
    alignItems: "center",
    padding: 32,
    gap: 12,
    marginBottom: 16,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: palette.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: palette.text,
  },
  emptyBody: {
    fontSize: 14,
    color: palette.muted,
    textAlign: "center",
    lineHeight: 20,
  },
  addCard: {
    marginTop: 24,
    padding: 20,
    backgroundColor: palette.surface,
    borderColor: palette.primary,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  addHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  addIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: palette.chipBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  addTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: palette.text,
  },
  addHint: {
    fontSize: 13,
    color: palette.muted,
  },
  dateInputRow: {
    flexDirection: "row",
    gap: 12,
  },
});
