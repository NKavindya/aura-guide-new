/** Strip JSON / Python-dict artifacts from coach text before display. */
function tryParseObjectLiteral(raw: string): Record<string, unknown> | null {
  const t = raw.trim();
  if (!t.startsWith("{")) return null;
  try {
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    /* JSON.parse failed — try normalizing single quotes */
  }
  try {
    const normalized = t
      .replace(/'/g, '"')
      .replace(/\bTrue\b/g, "true")
      .replace(/\bFalse\b/g, "false")
      .replace(/\bNone\b/g, "null");
    return JSON.parse(normalized) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function pickReadableString(obj: Record<string, unknown>, prefer: string[]): string {
  for (const key of prefer) {
    const v = obj[key];
    if (typeof v === "string" && v.trim() && key !== "answer") {
      return v.trim();
    }
  }
  for (const [k, v] of Object.entries(obj)) {
    if (k === "answer" || k === "id" || k === "type") continue;
    if (typeof v === "string" && v.trim().length > 12) {
      return v.trim();
    }
  }
  return "";
}

export function sanitizeCoachText(raw: string): string {
  let t = (raw || "").trim();
  if (!t) return "";

  if (t.startsWith("{")) {
    const parsed = tryParseObjectLiteral(t);
    if (parsed) {
      const extracted = pickReadableString(parsed, [
        "question",
        "description",
        "text",
        "prompt",
        "feedback",
        "content",
        "message",
      ]);
      if (extracted) t = extracted;
    }
  }

  t = t.replace(/```[\s\S]*?```/g, "").replace(/\*\*([^*]+)\*\*/g, "$1");
  t = t.replace(/^#+\s*/gm, "");
  if (t.startsWith("{") && t.includes("'")) {
    const parsed = tryParseObjectLiteral(t);
    if (parsed) {
      const extracted = pickReadableString(parsed, ["question", "description", "feedback", "text"]);
      if (extracted) t = extracted;
    }
  }
  return t.trim();
}

export function sanitizeCoachQuestion(raw: string): string {
  return sanitizeCoachText(raw);
}

export function formatCoachQuestion(label: string, number: number, question: string): string {
  const q = sanitizeCoachQuestion(question);
  return `${label} ${number}\n\n${q}`;
}

export function sanitizeCoachFeedback(raw: string): string {
  let t = sanitizeCoachText(raw);
  if (t.startsWith("**") && t.includes("feedback**")) {
    t = t.replace(/^\*\*[^*]+\*\*\s*/i, "").trim();
  }
  return t;
}
