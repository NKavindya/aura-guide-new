import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { palette, commonStyles } from "../../theme";
import { AppCard } from "../../components/AppCard";
import { ScreenHeader } from "../../components/ScreenHeader";
import { Message } from "../../types";
import { api } from "../../api/api";
import { screenPadding } from "../../styles/screenStyles";
import { prettifyCvLine } from "../../utils/cvFeedback";
import { formatCoachFeedback, formatCoachQuestion } from "../../utils/coachText";
import { showAlert } from "../../utils/alert";

const PROMPTS = [
  {
    id: "task",
    label: "Assign me a new task",
    subtitle: "A focused assignment for your technical skills",
    icon: "list-circle-outline" as const,
  },
  {
    id: "interview",
    label: "Let's practice for an interview",
    subtitle: "STAR-style behavioral prompts",
    icon: "mic-outline" as const,
  },
  {
    id: "reflect",
    label: "Help me reflect on my progress",
    subtitle: "One guided reflection with feedback",
    icon: "leaf-outline" as const,
  },
  {
    id: "comm",
    label: "Help to improve my communication skills",
    subtitle: "Workplace scenarios • 7Cs • type exit when done",
    icon: "chatbubbles-outline" as const,
  },
] as const;

function fmtTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export type PendingTaskAnswerPayload = {
  userCommonTaskId: number;
  taskText: string;
  skillName: string;
};

type Phase =
  | { kind: "home" }
  | { kind: "interview"; questionNumber: number; questionText: string; awaitingFeedback: boolean }
  | { kind: "reflection"; questionNumber: number; questionText: string; awaitingFeedback: boolean }
  | { kind: "communication" }
  | { kind: "task_answer"; payload: PendingTaskAnswerPayload };

export function AICoachScreen({
  pendingTaskAnswer,
  onConsumedPendingTask,
}: {
  pendingTaskAnswer?: PendingTaskAnswerPayload | null;
  onConsumedPendingTask?: () => void;
}) {
  const { height } = useWindowDimensions();
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatSessionId, setChatSessionId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "home" });
  /** Input bar hidden until user picks a path or opens task answer from Tasks. */
  const [showComposer, setShowComposer] = useState(false);
  const [reflectionShowNext, setReflectionShowNext] = useState(false);
  const [interviewShowNext, setInterviewShowNext] = useState(false);
  const [cvLocalSummary, setCvLocalSummary] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [inputHeight, setInputHeight] = useState(44);
  const scrollRef = useRef<ScrollView>(null);

  const activeTaskAnswer = useMemo((): PendingTaskAnswerPayload | null => {
    if (phase.kind === "task_answer") return phase.payload;
    if (pendingTaskAnswer) return pendingTaskAnswer;
    return null;
  }, [phase, pendingTaskAnswer]);

  /** Prompt strip + CV: slightly taller on home; stays compact during flows so it stays reachable. */
  const promptBandMaxHeight = useMemo(() => {
    if (phase.kind === "communication" || phase.kind === "interview" || phase.kind === "reflection") {
      return Math.min(Math.round(height * 0.18), 140);
    }
    const cap = height * (phase.kind === "home" ? 0.28 : 0.22);
    return Math.min(Math.round(cap), phase.kind === "home" ? 260 : 200);
  }, [height, phase.kind]);

  const pushAura = useCallback((content: string, category?: string) => {
    setMessages((c) => [
      ...c,
      {
        id: Date.now() + Math.random(),
        type: "aura",
        content,
        timestamp: fmtTime(new Date()),
        category,
      },
    ]);
  }, []);

  const pushUser = useCallback((content: string) => {
    setMessages((c) => [
      ...c,
      { id: Date.now() + Math.random(), type: "user", content, timestamp: fmtTime(new Date()) },
    ]);
  }, []);

  /**
   * Single bootstrap: loads history (or welcome), then appends deep-linked task answer lines so
   * async history hydration cannot wipe them (fixes navigation from Tasks).
   */
  useEffect(() => {
    let cancelled = false;
    const pendingAtMount = pendingTaskAnswer ?? null;

    (async () => {
      let nextSessionId: number | null = null;
      let baseMessages: Message[] = [];

      try {
        const hist = await api.getAgentChatHistory();
        if (cancelled) return;
        if ((hist.messages?.length ?? 0) > 0 && hist.session_id != null) {
          nextSessionId = hist.session_id;
          baseMessages = hist.messages.map((m, i) => ({
            id: typeof m.id === "number" ? m.id : 2000 + i,
            type: m.role === "user" ? ("user" as const) : ("aura" as const),
            content: m.content,
            timestamp: fmtTime(new Date()),
          }));
        }
      } catch {
        /* welcome path below */
      }

      if (cancelled) return;

      if (baseMessages.length === 0) {
        try {
          const [quote, reminder] = await Promise.all([
            api.getMotivationalQuote().catch(() => null),
            api.getDailyTaskReminder().catch(() => null),
          ]);
          if (cancelled) return;
          const parts = [quote?.message, reminder?.message].filter(Boolean);
          baseMessages = [
            {
              id: 1,
              type: "aura",
              content:
                parts.length > 0
                  ? parts.join("\n\n")
                  : "Choose a guided path below, or analyze your CV. Your coach adapts to your goal and saves progress automatically.",
              timestamp: fmtTime(new Date()),
              category: "Welcome",
            },
          ];
        } catch {
          if (!cancelled) {
            baseMessages = [
              {
                id: 1,
                type: "aura",
                content: "Choose a guided path below to begin.",
                timestamp: fmtTime(new Date()),
                category: "Welcome",
              },
            ];
          }
        }
      }

      if (cancelled) return;

      const t = fmtTime(new Date());
      if (pendingAtMount) {
        const uid = Date.now();
        baseMessages = [
          ...baseMessages,
          {
            id: uid,
            type: "user",
            content: "I'm ready to answer my agent task.",
            timestamp: t,
          },
          {
            id: uid + 1,
            type: "aura",
            content: `Review the **Your task** card above for full instructions. Submissions are graded on **${pendingAtMount.skillName}** only.`,
            timestamp: t,
            category: "Task answer",
          },
        ];
        setPhase({ kind: "task_answer", payload: pendingAtMount });
        setShowComposer(true);
        setInterviewShowNext(false);
        onConsumedPendingTask?.();
      } else {
        setShowComposer(false);
      }

      if (nextSessionId != null) setChatSessionId(nextSessionId);
      setMessages(baseMessages);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run bootstrap on mount; pending is captured from first paint
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, isTyping, interviewShowNext, reflectionShowNext, showComposer, activeTaskAnswer]);

  const resetToHome = useCallback(() => {
    setPhase({ kind: "home" });
    setShowComposer(false);
    setInterviewShowNext(false);
    setReflectionShowNext(false);
    setInput("");
  }, []);

  const runAssignTask = async () => {
    pushUser("Assign me a new task");
    setShowComposer(false);
    setIsTyping(true);
    try {
      const res = await api.agentTaskGenerate({
        sessionId: chatSessionId,
        chatUserMessage: "Assign me a new task",
      });
      setChatSessionId(res.session_id);
      pushAura(res.chat_message, "New task");
    } catch (e) {
      pushAura(`Could not generate a task: ${(e as Error).message}`, "Error");
    } finally {
      setIsTyping(false);
    }
  };

  const startInterview = async () => {
    pushUser("Let's practice for an interview");
    setShowComposer(true);
    setInterviewShowNext(false);
    setIsTyping(true);
    try {
      const q = await api.agentInterviewQuestion(1, {
        sessionId: chatSessionId,
        chatUserMessage: "Let's practice for an interview",
      });
      setChatSessionId(q.session_id);
      setPhase({
        kind: "interview",
        questionNumber: q.question_number,
        questionText: q.question,
        awaitingFeedback: true,
      });
      pushAura(formatCoachQuestion("Question", q.question_number, q.question), "Interview");
    } catch (e) {
      pushAura(`Interview could not start: ${(e as Error).message}`, "Error");
      resetToHome();
    } finally {
      setIsTyping(false);
    }
  };

  const startCommunication = async () => {
    const label = PROMPTS[3].label;
    pushUser(label);
    setPhase({ kind: "communication" });
    setShowComposer(true);
    setInterviewShowNext(false);
    setReflectionShowNext(false);
    setIsTyping(true);
    try {
      const res = await api.agentChat(label, null, "communication");
      setChatSessionId(res.session_id);
      pushAura(formatCoachFeedback(res.reply), "Communication");
      if (res.follow_up?.trim()) {
        pushAura(formatCoachFeedback(res.follow_up.trim()), "Review");
      }
    } catch (e) {
      pushAura(`Something went wrong: ${(e as Error).message}`, "Error");
      resetToHome();
    } finally {
      setIsTyping(false);
    }
  };

  const startReflection = async () => {
    pushUser(PROMPTS[2].label);
    setInterviewShowNext(false);
    setReflectionShowNext(false);
    setShowComposer(true);
    setIsTyping(true);
    try {
      const q = await api.agentReflectionQuestion(1, {
        sessionId: chatSessionId,
        chatUserMessage: PROMPTS[2].label,
      });
      setChatSessionId(q.session_id);
      setPhase({
        kind: "reflection",
        questionNumber: q.question_number,
        questionText: q.question,
        awaitingFeedback: true,
      });
      pushAura(formatCoachQuestion("Reflection", q.question_number, q.question), "Reflection");
    } catch (e) {
      pushAura(`Reflection could not start: ${(e as Error).message}`, "Error");
      resetToHome();
    } finally {
      setIsTyping(false);
    }
  };

  const nextReflectionQuestion = async () => {
    if (phase.kind !== "reflection") return;
    const nextN = phase.questionNumber + 1;
    setReflectionShowNext(false);
    setIsTyping(true);
    try {
      const q = await api.agentReflectionQuestion(nextN, { sessionId: chatSessionId });
      setChatSessionId(q.session_id);
      setShowComposer(true);
      setPhase({
        kind: "reflection",
        questionNumber: q.question_number,
        questionText: q.question,
        awaitingFeedback: true,
      });
      pushAura(formatCoachQuestion("Reflection", q.question_number, q.question), "Reflection");
    } catch (e) {
      pushAura(`Next reflection failed: ${(e as Error).message}`, "Error");
    } finally {
      setIsTyping(false);
    }
  };

  const onPickPrompt = (id: (typeof PROMPTS)[number]["id"]) => {
    if (phase.kind !== "home") return;
    if (id === "task") runAssignTask();
    else if (id === "interview") startInterview();
    else if (id === "reflect") startReflection();
    else if (id === "comm") startCommunication();
  };

  const sendComposer = async () => {
    const content = input.trim();
    if (!content) return;

    if (phase.kind === "task_answer") {
      pushUser(content);
      setInput("");
      setIsTyping(true);
      try {
        const p = phase.payload;
        const res = await api.agentTaskEvaluate({
          user_common_task_id: p.userCommonTaskId,
          task_description: p.taskText,
          skill: p.skillName,
          answer: content,
          session_id: chatSessionId ?? undefined,
        });
        setChatSessionId(res.session_id);
        pushAura(formatCoachFeedback(res.feedback_message || "Thanks - review your skill matrix on Goals."), "Feedback");
        setPhase({ kind: "home" });
        setShowComposer(false);
      } catch (e) {
        pushAura(`Evaluation failed: ${(e as Error).message}`, "Error");
      } finally {
        setIsTyping(false);
      }
      return;
    }

    if (phase.kind === "interview" && phase.awaitingFeedback) {
      pushUser(content);
      setInput("");
      setIsTyping(true);
      try {
        const ev = await api.agentInterviewEvaluate(
          phase.questionNumber,
          phase.questionText,
          content,
          chatSessionId,
        );
        setChatSessionId(ev.session_id);
        pushAura(formatCoachFeedback(ev.feedback), "Feedback");
        setInterviewShowNext(true);
        setShowComposer(false);
        setPhase({
          kind: "interview",
          questionNumber: phase.questionNumber,
          questionText: phase.questionText,
          awaitingFeedback: false,
        });
      } catch (e) {
        pushAura(`Could not evaluate: ${(e as Error).message}`, "Error");
      } finally {
        setIsTyping(false);
      }
      return;
    }

    if (phase.kind === "reflection" && phase.awaitingFeedback) {
      pushUser(content);
      setInput("");
      setIsTyping(true);
      try {
        const ev = await api.agentReflectionEvaluate(
          phase.questionNumber,
          phase.questionText,
          content,
          chatSessionId,
        );
        setChatSessionId(ev.session_id);
        pushAura(formatCoachFeedback(ev.feedback), "Feedback");
        setReflectionShowNext(true);
        setShowComposer(false);
        setPhase({
          kind: "reflection",
          questionNumber: phase.questionNumber,
          questionText: phase.questionText,
          awaitingFeedback: false,
        });
      } catch (e) {
        pushAura(`Could not evaluate: ${(e as Error).message}`, "Error");
      } finally {
        setIsTyping(false);
      }
      return;
    }

    if (phase.kind === "communication") {
      pushUser(content);
      setInput("");
      setIsTyping(true);
      try {
        const res = await api.agentChat(content, chatSessionId, "communication");
        setChatSessionId(res.session_id);
        pushAura(formatCoachFeedback(res.reply), "Communication");
        if (res.follow_up?.trim()) {
          pushAura(formatCoachFeedback(res.follow_up.trim()), "Review");
        }
        const ended =
          res.reply.trim() === "Session ended. Good job today!" ||
          res.reply.includes("Session ended. Good job today!");
        if (ended) {
          setPhase({ kind: "home" });
          setShowComposer(false);
        }
      } catch (e) {
        pushAura(`Could not reach coach: ${(e as Error).message}`, "Error");
      } finally {
        setIsTyping(false);
      }
    }
  };

  const nextInterviewQuestion = async () => {
    if (phase.kind !== "interview") return;
    const nextN = phase.questionNumber + 1;
    setInterviewShowNext(false);
    setIsTyping(true);
    try {
      const q = await api.agentInterviewQuestion(nextN, { sessionId: chatSessionId });
      setChatSessionId(q.session_id);
      setShowComposer(true);
      setPhase({
        kind: "interview",
        questionNumber: q.question_number,
        questionText: q.question,
        awaitingFeedback: true,
      });
      pushAura(formatCoachQuestion("Question", q.question_number, q.question), "Interview");
    } catch (e) {
      pushAura(`Next question failed: ${(e as Error).message}`, "Error");
    } finally {
      setIsTyping(false);
    }
  };

  const pickPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: Platform.OS === "ios" ? (["application/pdf", "com.adobe.pdf"] as string[]) : "application/pdf",
        copyToCacheDirectory: Platform.OS !== "web",
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const name = asset.name || "cv.pdf";
      const lower = name.toLowerCase();
      const mime = (asset.mimeType || "").toLowerCase();
      const pdfMsg =
        "Only PDF files can be uploaded as your CV. Word, text, and other document types are not accepted — export your CV as PDF and try again.";
      const blockedExt = [".doc", ".docx", ".txt", ".rtf", ".odt", ".pages", ".md"];
      if (blockedExt.some((ext) => lower.endsWith(ext))) {
        showAlert("PDF only", pdfMsg);
        return;
      }
      const blockedMime =
        mime.startsWith("text/") ||
        mime.includes("msword") ||
        mime.includes("wordprocessingml") ||
        mime.includes("opendocument") ||
        mime === "application/rtf" ||
        mime === "application/json";
      if (blockedMime) {
        showAlert("PDF only", pdfMsg);
        return;
      }
      if (!lower.endsWith(".pdf")) {
        showAlert("PDF only", pdfMsg);
        return;
      }
      if (mime) {
        const looksPdf =
          mime === "application/pdf" ||
          mime === "application/x-pdf" ||
          mime.endsWith("+pdf") ||
          (mime === "application/octet-stream" && lower.endsWith(".pdf"));
        if (!looksPdf) {
          showAlert("PDF only", pdfMsg);
          return;
        }
      }
      setFileName(name);
      setIsUploading(true);
      const data = await api.uploadCVPdf({
        uri: asset.uri,
        name,
        mimeType: asset.mimeType || "application/pdf",
      });
      const bullets = (arr: unknown[]) =>
        Array.isArray(arr) ? arr.map((s) => `• ${prettifyCvLine(s)}`).join("\n") : "";
      const prettifyBulletLines = (text: string) =>
        text
          .split("\n")
          .map((ln) => {
            const m = /^(\s*•\s*)(.+)$/.exec(ln);
            return m ? `${m[1]}${prettifyCvLine(m[2])}` : ln.replace(/\*\*([^*]+)\*\*/g, "$1");
          })
          .join("\n");
      const summaryRaw =
        data.chat_summary ||
        ["Strengths", bullets(data.strengths as unknown[]), "", "Growth areas", bullets(data.weaknesses as unknown[])].join("\n");
      const summary = prettifyBulletLines(summaryRaw);
      setCvLocalSummary(summary);
      pushAura(`Here's your CV feedback.\n\n${summary}\n\n_Saved under Profile › CV & analysis._`, "CV feedback");
      showAlert("CV feedback ready", "Strengths and growth areas are saved. View them anytime on Profile.");
    } catch (e) {
      showAlert("Upload failed", (e as Error).message);
    } finally {
      setIsUploading(false);
    }
  };

  const composerHint =
    phase.kind === "task_answer"
      ? "Write your task answer here - it will be scored on the selected skill."
      : phase.kind === "interview" && phase.awaitingFeedback
        ? "Answer using STAR where you can (Situation, Task, Action, Result)."
        : phase.kind === "reflection" && phase.awaitingFeedback
          ? "Answer in a short paragraph. Be specific about what you learned and what you'd improve."
          : phase.kind === "communication"
            ? 'Reply as you would at work. When finished, send **exit**, **quit**, or **stop** to end and get your communication score.'
            : "";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[commonStyles.flexOne, { backgroundColor: palette.background }]}
    >
      <View style={styles.layoutColumn}>
        <View style={[styles.topBar, { paddingHorizontal: screenPadding }]}>
          <View style={{ flex: 1 }}>
            <ScreenHeader title="AI Coach" subtitle="Choose a path - then reply in your own words" />
          </View>
          {phase.kind !== "home" ? (
            <Pressable
              onPress={resetToHome}
              style={styles.exitPill}
              accessibilityLabel={phase.kind === "interview" ? "Exit interview" : "Exit flow"}
            >
              <Ionicons name="close" size={18} color={palette.text} />
              <Text style={styles.exitPillText}>
                {phase.kind === "interview" ? "Exit interview" : "Exit"}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={[styles.promptBand, { maxHeight: promptBandMaxHeight }]}>
          <ScrollView
            nestedScrollEnabled
            style={{ flexGrow: 0 }}
            contentContainerStyle={[styles.promptBandInnerScroll, { paddingHorizontal: screenPadding }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.promptBandCaption} numberOfLines={2}>
              Upload your CV anytime (PDF only) - or tap a coach path when you are on Home.
            </Text>
            <Pressable
              onPress={pickPdf}
              disabled={isUploading}
              style={({ pressed }) => [
                styles.promptRow,
                styles.cvUploadRow,
                pressed && styles.promptRowPressed,
                isUploading && styles.promptRowDisabled,
              ]}
            >
              <View style={[styles.promptRowBadge, styles.cvUploadBadge]}>
                <Ionicons name="cloud-upload-outline" size={14} color={palette.primary} />
              </View>
              <View style={commonStyles.flexOne}>
                <Text style={styles.promptRowLabel} numberOfLines={1}>
                  {isUploading ? "Uploading PDF…" : "Upload CV (PDF)"}
                </Text>
                <Text style={styles.promptRowMeta} numberOfLines={2}>
                  {fileName ? fileName : "Extract text on the server, then AI feedback in chat & profile"}
                </Text>
              </View>
              <Ionicons name="document-attach" size={18} color={palette.primary} />
            </Pressable>
            <View style={styles.promptRowList}>
              {PROMPTS.map((p, index) => (
                <Pressable
                  key={p.id}
                  disabled={phase.kind !== "home"}
                  onPress={() => onPickPrompt(p.id)}
                  style={({ pressed }) => [
                    styles.promptRow,
                    phase.kind !== "home" && styles.promptRowMuted,
                    pressed && phase.kind === "home" && styles.promptRowPressed,
                  ]}
                >
                  <View style={styles.promptRowBadge}>
                    <Text style={styles.promptRowBadgeText}>{index + 1}</Text>
                  </View>
                  <Ionicons name={p.icon} size={17} color={palette.primary} style={styles.promptRowIcon} />
                  <View style={commonStyles.flexOne}>
                    <Text style={styles.promptRowLabel} numberOfLines={1}>
                      {p.label}
                    </Text>
                    <Text style={styles.promptRowMeta} numberOfLines={1}>
                      {phase.kind !== "home" ? "Finish current flow or tap Exit" : p.subtitle}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={palette.muted} />
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.chatScroll}
          contentContainerStyle={[styles.chatBody, { paddingHorizontal: screenPadding }]}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {activeTaskAnswer ? (
            <AppCard style={styles.taskContextCard}>
              <View style={styles.taskContextHeader}>
                <Ionicons name="reader-outline" size={22} color={palette.primary} />
                <View style={commonStyles.flexOne}>
                  <Text style={styles.taskContextEyebrow}>Your task</Text>
                  <Text style={styles.taskContextSkill}>{activeTaskAnswer.skillName}</Text>
                </View>
              </View>
              <Text selectable style={styles.taskContextBody}>
                {activeTaskAnswer.taskText}
              </Text>
            </AppCard>
          ) : null}

        {cvLocalSummary ? (
          <AppCard style={styles.cvSummaryCard}>
            <Text style={styles.cvSummaryCardTitle}>Latest CV feedback</Text>
            <ScrollView nestedScrollEnabled style={styles.cvSummaryScroll} showsVerticalScrollIndicator>
              <Text selectable style={styles.cvSummaryText}>
                {cvLocalSummary}
              </Text>
            </ScrollView>
          </AppCard>
        ) : null}

        {messages.map((message) => {
          const isUser = message.type === "user";
          return (
            <View key={message.id} style={[styles.messageRow, isUser ? styles.rowUser : styles.rowAura]}>
              {!isUser ? (
                <View style={styles.avatarAura}>
                  <Ionicons name="sparkles" size={18} color="#FFFFFF" />
                </View>
              ) : null}
              <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAura]}>
                {message.category ? (
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{message.category}</Text>
                  </View>
                ) : null}
                <Text style={[styles.msgText, isUser && styles.msgTextUser]}>{message.content}</Text>
                {message.timestamp ? (
                  <Text style={[styles.msgTime, isUser && styles.msgTimeUser]}>{message.timestamp}</Text>
                ) : null}
              </View>
            </View>
          );
        })}

        {interviewShowNext && phase.kind === "interview" ? (
          <Pressable onPress={nextInterviewQuestion} style={styles.nextQBtn}>
            <Text style={styles.nextQBtnText}>Next question</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </Pressable>
        ) : null}

        {reflectionShowNext && phase.kind === "reflection" ? (
          <Pressable onPress={nextReflectionQuestion} style={styles.nextQBtnSecondary}>
            <Text style={styles.nextQBtnSecondaryText}>Another reflection</Text>
            <Ionicons name="leaf-outline" size={18} color={palette.primary} />
          </Pressable>
        ) : null}

        {isTyping ? (
          <View style={styles.messageRow}>
            <View style={styles.avatarAura}>
              <Ionicons name="sparkles" size={18} color="#FFFFFF" />
            </View>
            <View style={[styles.bubble, styles.bubbleAura]}>
              <Text style={styles.typing}>Thinking…</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
      </View>

      {showComposer ? (
        <View style={[styles.footer, { paddingHorizontal: screenPadding }]}>
          {composerHint ? <Text style={styles.composerHint}>{composerHint}</Text> : null}
          <View style={styles.footerRow}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Type your message…"
              placeholderTextColor={palette.muted}
              style={[styles.footerInput, { height: Math.min(160, Math.max(44, inputHeight)) }]}
              multiline
              textAlignVertical="top"
              onContentSizeChange={(e) => {
                const h = e.nativeEvent.contentSize.height;
                setInputHeight(Math.min(160, Math.max(44, h + 12)));
              }}
            />
            <Pressable accessibilityLabel="Send" onPress={sendComposer} style={styles.sendFab}>
              <Ionicons name="send" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.footerPlaceholder} />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: screenPadding,
    paddingTop: 6,
    gap: 8,
  },
  exitPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  exitPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.text,
  },
  layoutColumn: {
    flex: 1,
    minHeight: 0,
  },
  promptBand: {
    flexGrow: 0,
    flexShrink: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
    backgroundColor: palette.background,
    overflow: "hidden",
  },
  promptBandInnerScroll: {
    paddingTop: 4,
    paddingBottom: 10,
    gap: 6,
    flexGrow: 0,
  },
  promptBandCaption: {
    fontSize: 11,
    fontWeight: "700",
    color: palette.muted,
    letterSpacing: 0.3,
  },
  promptRowList: {
    gap: 6,
  },
  promptRow: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  cvUploadRow: {
    borderColor: palette.primaryMuted,
    backgroundColor: palette.chipBlue,
  },
  cvUploadBadge: {
    alignItems: "center",
    justifyContent: "center",
  },
  promptRowMuted: {
    opacity: 0.55,
  },
  promptRowDisabled: {
    opacity: 0.7,
  },
  promptRowPressed: {
    opacity: 0.88,
    backgroundColor: palette.surfaceMuted,
  },
  promptRowBadge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: "rgba(99,102,241,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  promptRowBadgeText: {
    fontSize: 12,
    fontWeight: "900",
    color: palette.primary,
  },
  promptRowIcon: {
    alignSelf: "center",
  },
  promptRowLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: palette.text,
    letterSpacing: -0.2,
  },
  promptRowMeta: {
    fontSize: 10,
    fontWeight: "600",
    color: palette.muted,
    marginTop: 2,
  },
  chatScroll: {
    flex: 1,
    minHeight: 280,
  },
  taskContextCard: {
    borderLeftWidth: 4,
    borderLeftColor: palette.primary,
    gap: 10,
    padding: 14,
  },
  taskContextHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  taskContextEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: palette.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  taskContextSkill: {
    fontSize: 15,
    fontWeight: "900",
    color: palette.text,
    marginTop: 2,
  },
  taskContextBody: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
    color: palette.text,
  },
  chatBody: {
    paddingBottom: 24,
    gap: 14,
    flexGrow: 1,
  },
  cvSummaryCard: {
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: palette.primaryMuted,
  },
  cvSummaryCardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: palette.muted,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cvSummaryScroll: {
    marginTop: 4,
    maxHeight: 200,
    borderRadius: 12,
    backgroundColor: palette.surfaceMuted,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 12,
  },
  cvSummaryText: {
    fontSize: 13,
    lineHeight: 20,
    color: palette.text,
    fontWeight: "600",
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  rowUser: {
    justifyContent: "flex-end",
  },
  rowAura: {
    justifyContent: "flex-start",
  },
  avatarAura: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: palette.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  bubble: {
    maxWidth: "88%",
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 6,
  },
  bubbleAura: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderBottomLeftRadius: 4,
  },
  bubbleUser: {
    backgroundColor: palette.primary,
    borderBottomRightRadius: 4,
  },
  categoryBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(99,102,241,0.12)",
  },
  categoryText: {
    fontSize: 10,
    fontWeight: "800",
    color: palette.primary,
    textTransform: "uppercase",
  },
  msgText: {
    color: palette.text,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500",
  },
  msgTextUser: {
    color: "#FFFFFF",
  },
  msgTime: {
    fontSize: 10,
    fontWeight: "600",
    color: palette.muted,
    alignSelf: "flex-end",
    marginTop: 2,
  },
  msgTimeUser: {
    color: "rgba(255,255,255,0.6)",
  },
  typing: {
    color: palette.muted,
    fontStyle: "italic",
    fontSize: 13,
  },
  nextQBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "center",
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 99,
    backgroundColor: palette.primary,
  },
  nextQBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },
  nextQBtnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "center",
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 99,
    backgroundColor: palette.surface,
    borderWidth: 2,
    borderColor: palette.primary,
  },
  nextQBtnSecondaryText: {
    color: palette.primary,
    fontWeight: "800",
    fontSize: 15,
  },
  footer: {
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 20 : 12,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.background,
  },
  footerPlaceholder: {
    height: Platform.OS === "ios" ? 12 : 6,
  },
  composerHint: {
    fontSize: 12,
    fontWeight: "600",
    color: palette.muted,
    marginBottom: 8,
    lineHeight: 17,
    paddingHorizontal: 4,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  footerInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    color: palette.text,
    fontSize: 15,
  },
  sendFab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.primary,
  },
});
