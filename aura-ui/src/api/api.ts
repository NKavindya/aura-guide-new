import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { CONFIG } from "../config";

const API_BASE_URL = CONFIG.API_BASE_URL;

async function authHeaders(contentType = true) {
  const token = await AsyncStorage.getItem("auth_token");
  if (!token) throw new Error("No auth token found");
  return {
    ...(contentType ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${token}`,
  };
}

export const api = {
  /**
   * Register a new user with comprehensive profile data.
   * Expects: email, password, first_name, last_name, university, degree_program, study_year, goal_id
   */
  async signup(data: any) {
    const response = await fetch(`${API_BASE_URL}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },
  async validateSignupEmail(email: string) {
    const response = await fetch(`${API_BASE_URL}/auth/validate-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) throw new Error((await response.text()).trim());
    return response.json();
  },

  /**
   * Authenticate user credentials and preserve the session token.
   * On success, the JWT token is stored in AsyncStorage for future authorized requests.
   */
  async login(data: any) {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(await response.text());
    const result = await response.json();
    
    // persist the JWT token locally so the user stays logged in
    if (result.token) {
      await AsyncStorage.setItem("auth_token", result.token);
    }
    return result;
  },

  /**
   * retrieve the authenticated user's profile information.
   * this request includes the 'Authorization' Bearer token from AsyncStorage.
   */
  async getUserProfile() {
    const response = await fetch(`${API_BASE_URL}/user`, {
      method: "GET",
      headers: await authHeaders(false),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },
  async updateUserProfile(data: any) {
    const response = await fetch(`${API_BASE_URL}/user`, {
      method: "PUT",
      headers: await authHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },
  async deleteAccount() {
    const token = await AsyncStorage.getItem("auth_token");
    if (!token) throw new Error("No auth token found");
    const response = await fetch(`${API_BASE_URL}/users/profile/me`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      ...(Platform.OS === "web" ? { credentials: "include" as RequestCredentials } : {}),
    });
    if (!response.ok) {
      const msg = (await response.text()).trim() || "Delete failed";
      throw new Error(msg);
    }
    await AsyncStorage.removeItem("auth_token");
    await AsyncStorage.removeItem("aura_returning_user");
    await AsyncStorage.removeItem("aura_dark_mode");
    try {
      return await response.json();
    } catch {
      return { message: "Profile deleted successfully" };
    }
  },
  async getCareerPath() {
    const response = await fetch(`${API_BASE_URL}/user/careerPath`, {
      method: "GET",
      headers: await authHeaders(false),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },
  async getSkillScore() {
    const response = await fetch(`${API_BASE_URL}/user/skilScore`, {
      method: "GET",
      headers: await authHeaders(false),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },
  async getTasks() {
    const response = await fetch(`${API_BASE_URL}/task-plan/taskPlan`, {
      method: "GET",
      headers: await authHeaders(false),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },
  async getDashboardSummary() {
    const response = await fetch(`${API_BASE_URL}/progress/dashboard`, {
      method: "GET",
      headers: await authHeaders(false),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },
  async generateTaskPlan() {
    const response = await fetch(`${API_BASE_URL}/task-plan/generatePlan`, {
      method: "GET",
      headers: await authHeaders(false),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },
  async addTask(data: any) {
    const response = await fetch(`${API_BASE_URL}/task-plan/tasks`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },
  async updateTask(taskId: number, data: any) {
    const response = await fetch(`${API_BASE_URL}/task-plan/tasks/${taskId}`, {
      method: "PUT",
      headers: await authHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },
  async completeTask(taskId: number) {
    const response = await fetch(`${API_BASE_URL}/task-plan/tasks/${taskId}/complete`, {
      method: "PUT",
      headers: await authHeaders(false),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },
  /** Deletes custom or agent task in one shot (backend resolves the correct table). */
  async deleteTask(taskId: number) {
    const id = Number(taskId);
    if (!Number.isFinite(id) || id < 1) {
      throw new Error("Invalid task id");
    }
    const response = await fetch(`${API_BASE_URL}/task-plan/tasks/${id}`, {
      method: "DELETE",
      headers: await authHeaders(false),
    });
    if (!response.ok) throw new Error(await response.text());
    const raw = await response.text();
    if (!raw?.trim()) return {};
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return { message: raw };
    }
  },
  async uploadCV(fileName: string, content: string) {
    const response = await fetch(`${API_BASE_URL}/aura-life-coach/cv/upload`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ file_name: fileName, content }),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },
  async analyzeCV() {
    const response = await fetch(`${API_BASE_URL}/aura-life-coach/cv/analyze`, {
      method: "POST",
      headers: await authHeaders(false),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },
  async getCVFeedback() {
    const response = await fetch(`${API_BASE_URL}/aura-life-coach/cv/feedback`, {
      method: "GET",
      headers: await authHeaders(false),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },
  async listCVs() {
    const response = await fetch(`${API_BASE_URL}/aura-life-coach/cv/list`, {
      method: "GET",
      headers: await authHeaders(false),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },
  async downloadCV() {
    const token = await AsyncStorage.getItem("auth_token");
    if (!token) throw new Error("No auth token found");
    const response = await fetch(`${API_BASE_URL}/aura-life-coach/cv/download`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      ...(Platform.OS === "web" ? { credentials: "include" as RequestCredentials } : {}),
    });
    if (!response.ok) {
      let msg = await response.text();
      try {
        const j = JSON.parse(msg);
        if (j?.error) msg = j.error;
      } catch {
        /* plain text */
      }
      throw new Error(msg || "Download failed");
    }
    const blob = await response.blob();
    const disp = response.headers.get("Content-Disposition") || "";
    const match = /filename="?([^";]+)"?/i.exec(disp);
    const fileName = (match?.[1] || "cv.pdf").trim();

    if (Platform.OS === "web" && typeof document !== "undefined") {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      return { fileName };
    }

    throw new Error("CV download is available on web. Open Profile in your browser to save the PDF.");
  },
  async getGoalSummary() {
    const response = await fetch(`${API_BASE_URL}/goals/summary`, {
      method: "GET",
      headers: await authHeaders(false),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },

  async getDailyTaskReminder() {
    const response = await fetch(`${API_BASE_URL}/notification/dailyTaskReminder`, {
      method: "GET",
      headers: await authHeaders(false),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },

  async getMotivationalQuote() {
    const response = await fetch(`${API_BASE_URL}/notification/motivationalQuote`, {
      method: "GET",
      headers: await authHeaders(false),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },

  async getNotifications() {
    const response = await fetch(`${API_BASE_URL}/notification/list`, {
      method: "GET",
      headers: await authHeaders(false),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },

  async markAllNotificationsRead() {
    const response = await fetch(`${API_BASE_URL}/notification/mark-all-read`, {
      method: "POST",
      headers: await authHeaders(),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },

  async recordCheckIn() {
    const response = await fetch(`${API_BASE_URL}/progress/check-in`, {
      method: "POST",
      headers: await authHeaders(),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },

  async getBehavioralInterviewFeedback() {
    const response = await fetch(`${API_BASE_URL}/aura-life-coach/BehavioralInterviewFeedback`, {
      method: "GET",
      headers: await authHeaders(false),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },

  async getCalendarEvents() {
    const response = await fetch(`${API_BASE_URL}/calendar/events`, {
      method: "GET",
      headers: await authHeaders(false),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },
  async addCalendarEvent(data: any) {
    const response = await fetch(`${API_BASE_URL}/calendar/add-event`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },

  async updatePreferences(data: any) {
    const response = await fetch(`${API_BASE_URL}/settings/preferences`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },
  async updateNotificationPreferences(data: any) {
    const response = await fetch(`${API_BASE_URL}/settings/notificationPreferences`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },

  /** AI Coach - Ollama via Python agent (Bearer JWT). */
  async agentChat(message: string, sessionId?: number | null, topicFlow?: "reflection" | "communication" | null) {
    const response = await fetch(`${CONFIG.AI_AGENT_BASE_URL}/agent/chat`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        message,
        ...(sessionId != null ? { session_id: sessionId } : {}),
        ...(topicFlow ? { topic_flow: topicFlow } : {}),
      }),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json() as Promise<{
      reply: string;
      session_id: number;
      follow_up?: string | null;
    }>;
  },

  async agentReflectionQuestion(
    questionNumber: number,
    opts?: { sessionId?: number | null; chatUserMessage?: string },
  ) {
    const response = await fetch(`${CONFIG.AI_AGENT_BASE_URL}/agent/reflection/next-question`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        question_number: questionNumber,
        ...(opts?.sessionId != null ? { session_id: opts.sessionId } : {}),
        ...(opts?.chatUserMessage ? { chat_user_message: opts.chatUserMessage } : {}),
      }),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json() as Promise<{
      type: string;
      question_number: number;
      question: string;
      session_id: number;
    }>;
  },

  async agentReflectionEvaluate(
    questionNumber: number,
    question: string,
    answer: string,
    sessionId?: number | null,
  ) {
    const response = await fetch(`${CONFIG.AI_AGENT_BASE_URL}/agent/reflection/evaluate`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        question_number: questionNumber,
        question,
        answer,
        ...(sessionId != null ? { session_id: sessionId } : {}),
      }),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json() as Promise<{
      score: number;
      feedback: string;
      question_number: number;
      session_id: number;
    }>;
  },

  async uploadCVPdf(asset: { uri: string; name: string; mimeType?: string }) {
    const token = await AsyncStorage.getItem("auth_token");
    if (!token) throw new Error("No auth token found");
    const form = new FormData();
    const rawName = (asset.name || "cv.pdf").trim();
    const fileName = rawName.toLowerCase().endsWith(".pdf") ? rawName : `${rawName.replace(/\.[^.]+$/, "") || "cv"}.pdf`;
    const pdfType =
      asset.mimeType && asset.mimeType.toLowerCase().includes("pdf") ? asset.mimeType : "application/pdf";

    if (Platform.OS === "web") {
      const res = await fetch(asset.uri);
      const buf = await res.arrayBuffer();
      const blob = new Blob([buf], { type: pdfType });
      if (typeof File !== "undefined") {
        const fileObj = new File([blob], fileName, { type: pdfType });
        form.append("file", fileObj);
      } else {
        form.append("file", blob, fileName);
      }
    } else {
      form.append(
        "file",
        {
          uri: asset.uri,
          name: fileName,
          type: pdfType,
        } as any,
      );
    }
    const response = await fetch(`${API_BASE_URL}/aura-life-coach/cv/upload-pdf`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      ...(Platform.OS === "web" ? { credentials: "include" as RequestCredentials } : {}),
      body: form,
    });
    if (!response.ok) {
      let msg = await response.text();
      try {
        const j = JSON.parse(msg);
        if (j?.error) msg = j.error;
      } catch {
        /* plain text */
      }
      throw new Error(msg || "Upload failed");
    }
    return response.json() as Promise<{
      strengths: string[];
      weaknesses: string[];
      improvements: string[];
      chat_summary?: string;
    }>;
  },

  async agentInterviewQuestion(
    questionNumber: number,
    opts?: { sessionId?: number | null; chatUserMessage?: string },
  ) {
    const response = await fetch(`${CONFIG.AI_AGENT_BASE_URL}/agent/interview/next-question`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        question_number: questionNumber,
        ...(opts?.sessionId != null ? { session_id: opts.sessionId } : {}),
        ...(opts?.chatUserMessage ? { chat_user_message: opts.chatUserMessage } : {}),
      }),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json() as Promise<{
      type: string;
      question_number: number;
      question: string;
      session_id: number;
    }>;
  },

  async agentInterviewEvaluate(
    questionNumber: number,
    question: string,
    answer: string,
    sessionId?: number | null,
  ) {
    const response = await fetch(`${CONFIG.AI_AGENT_BASE_URL}/agent/interview/evaluate`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        question_number: questionNumber,
        question,
        answer,
        ...(sessionId != null ? { session_id: sessionId } : {}),
      }),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json() as Promise<{
      score: number;
      feedback: string;
      question_number: number;
      session_id: number;
    }>;
  },

  async agentTaskGenerate(opts?: { sessionId?: number | null; chatUserMessage?: string }) {
    const response = await fetch(`${CONFIG.AI_AGENT_BASE_URL}/agent/task/generate`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        ...(opts?.sessionId != null ? { session_id: opts.sessionId } : {}),
        ...(opts?.chatUserMessage ? { chat_user_message: opts.chatUserMessage } : {}),
      }),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json() as Promise<{
      user_common_task_id: number;
      task: string;
      skill: string;
      chat_message: string;
      start_time: string;
      end_time: string;
      session_id: number;
    }>;
  },

  async agentTaskEvaluate(body: {
    user_common_task_id: number;
    task_description: string;
    skill: string;
    answer: string;
    session_id?: number | null;
  }) {
    const response = await fetch(`${CONFIG.AI_AGENT_BASE_URL}/agent/task/evaluate`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json() as Promise<{ feedback_message: string; score: number; skill: string; session_id: number }>;
  },

  async getAgentChatHistory(sessionId?: number) {
    const q =
      sessionId != null ? `?session_id=${encodeURIComponent(String(sessionId))}` : "";
    const response = await fetch(`${CONFIG.AI_AGENT_BASE_URL}/agent/chat/history${q}`, {
      method: "GET",
      headers: await authHeaders(false),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json() as Promise<{
      session_id: number | null;
      messages: { id: number; content: string; role: string }[];
    }>;
  },

  /**
   * wipe the local authentication token to terminate the session.
   */
  async logout() {
    await AsyncStorage.removeItem("auth_token");
  }
};
