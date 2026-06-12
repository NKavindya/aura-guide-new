/** Strip JSON / Python-dict artifacts from coach text before display. */
export function sanitizeCoachQuestion(raw: string): string {
  return sanitizeCoachDisplayText(raw);
}

export function sanitizeCoachDisplayText(raw: string): string {
  let t = (raw || "").trim();
  if (!t) return "";

  if (t.startsWith("{")) {
    try {
      const parsed = JSON.parse(t) as Record<string, unknown>;
      const picked = pickDisplayField(parsed);
      if (picked) t = picked;
    } catch {
      const py = tryParsePythonDict(t);
      if (py) {
        const picked = pickDisplayField(py);
        if (picked) t = picked;
      } else {
        const m = /['"]?(?:question|description|feedback)['"]?\s*:\s*['"](.+?)['"]\s*[,}]/is.exec(t);
        if (m?.[1]) t = m[1].trim();
      }
    }
  }

  t = t.replace(/```[\s\S]*?```/g, "").replace(/\*\*([^*]+)\*\*/g, "$1");
  t = t.replace(/^#+\s*/gm, "");
  t = t.replace(/\{[\s\S]*?"(?:clear|concise|complete|correct|considerate|concrete|courteous|updated|status|message)"[\s\S]*?\}/g, " ");
  t = t.replace(/\s{2,}/g, " ").trim();
  if (t.startsWith("{") && (t.includes("'id'") || t.includes('"id"'))) {
    return "The coach could not format this response. Try again or use Next question.";
  }
  return t.trim();
}

function pickDisplayField(data: Record<string, unknown>): string {
  for (const key of ["question", "feedback", "description", "text", "message", "answer", "content"]) {
    const val = data[key];
    if (typeof val === "string" && val.trim().length > 0) return val.trim();
  }
  for (const val of Object.values(data)) {
    if (typeof val === "string" && val.trim().length > 20) return val.trim();
  }
  return "";
}

function tryParsePythonDict(text: string): Record<string, unknown> | null {
  try {
    const jsonish = text
      .replace(/'/g, '"')
      .replace(/True/g, "true")
      .replace(/False/g, "false")
      .replace(/None/g, "null");
    const parsed = JSON.parse(jsonish) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function formatCoachQuestion(label: string, number: number, question: string): string {
  const q = sanitizeCoachQuestion(question);
  return `${label} ${number}\n\n${q}`;
}

export function formatCoachFeedback(feedback: string): string {
  return sanitizeCoachDisplayText(feedback);
}
