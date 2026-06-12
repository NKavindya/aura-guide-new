import ast
import json
import re


def _strip_markdown_fences(text: str) -> str:
    s = (text or "").strip()
    if not s.startswith("```"):
        return s
    lines = s.split("\n")
    if not lines:
        return s
    first = lines[0].strip()
    if first.startswith("```"):
        lines = lines[1:]
    while lines and lines[-1].strip() == "```":
        lines = lines[:-1]
    return "\n".join(lines).strip()


def _brace_match_object(s: str, start: int) -> str | None:
    if start < 0 or start >= len(s) or s[start] != "{":
        return None
    depth = 0
    in_string = False
    escape = False
    quote = ""
    for i in range(start, len(s)):
        ch = s[i]
        if escape:
            escape = False
            continue
        if in_string:
            if ch == "\\":
                escape = True
            elif ch == quote:
                in_string = False
                quote = ""
            continue
        if ch in ('"', "'"):
            in_string = True
            quote = ch
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return s[start : i + 1]
    return None


def _try_ast_dict(chunk: str) -> dict | None:
    try:
        val = ast.literal_eval(chunk)
        if isinstance(val, dict):
            return val
    except Exception:
        pass
    return None


def _loads_flexible(chunk: str) -> dict:
    attempts = [
        chunk,
        chunk.replace("'", '"'),
        re.sub(r",\s*}", "}", chunk),
    ]
    for candidate in attempts:
        try:
            data = json.loads(candidate)
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            continue
    parsed = _try_ast_dict(chunk)
    if parsed is not None:
        return parsed
    raise ValueError("could not parse model JSON")


def extract_json_object(text: str) -> dict:
    """Parse first JSON/Python-dict object from model output."""
    s = _strip_markdown_fences(text)
    if "```" in s:
        s = _strip_markdown_fences(s)
    if not s:
        raise ValueError("empty model response")

    brace = s.find("{")
    if brace == -1:
        raise ValueError("no JSON object in response")
    chunk = _brace_match_object(s, brace)
    if not chunk:
        last = s.rfind("}")
        if last > brace:
            chunk = s[brace : last + 1]
        else:
            raise ValueError(
                "could not parse coach response — the model returned malformed JSON. Please try again."
            )
    return _loads_flexible(chunk)


def clean_coach_question_text(text: str) -> str:
    """Normalize interview/reflection question text for chat display."""
    t = _strip_markdown_fences((text or "").strip())
    if t.startswith("{"):
        try:
            data = extract_json_object(t)
            for key in ("question", "description", "text", "prompt"):
                q = data.get(key)
                if isinstance(q, str) and q.strip():
                    t = q.strip()
                    break
        except Exception:
            parsed = _try_ast_dict(t)
            if parsed:
                for key in ("question", "description", "text"):
                    v = parsed.get(key)
                    if isinstance(v, str) and v.strip():
                        t = v.strip()
                        break
    t = re.sub(r"\*\*([^*]+)\*\*", r"\1", t)
    t = re.sub(r"^#+\s*", "", t, flags=re.MULTILINE)
    t = re.sub(r"^[`\"']+|[`\"']+$", "", t.strip())
    if t.startswith("{") and ("'id'" in t or '"id"' in t):
        try:
            data = extract_json_object(t)
            desc = data.get("description") or data.get("question")
            if isinstance(desc, str) and desc.strip():
                t = desc.strip()
        except Exception:
            pass
    return t.strip()


def coerce_cv_feedback_line(item: object) -> str:
    if item is None:
        return ""
    if isinstance(item, str):
        return item.strip()
    if isinstance(item, dict):
        desc = (
            item.get("description")
            or item.get("text")
            or item.get("detail")
            or item.get("content")
            or item.get("summary")
            or item.get("value")
        )
        label = item.get("title") or item.get("label") or item.get("name") or item.get("category") or item.get("id")
        if isinstance(desc, str) and desc.strip():
            ds = desc.strip()
            if isinstance(label, (str, int, float)) and str(label).strip():
                ls = str(label).strip().replace("_", " ")
                if ds.lower().startswith(ls.lower()):
                    return ds
                return f"{ls.title()}: {ds}"
            return ds
        nested = item.get("items") or item.get("points") or item.get("bullets")
        if isinstance(nested, list):
            parts = [coerce_cv_feedback_line(x) for x in nested]
            return "; ".join(p for p in parts if p)
        str_vals = [str(v).strip() for v in item.values() if isinstance(v, str) and str(v).strip()]
        if str_vals:
            return " — ".join(str_vals)
        return ""
    if isinstance(item, (int, float, bool)):
        return str(item).strip()
    return str(item).strip()


def as_str_list(val) -> list[str]:
    if val is None:
        return []
    if isinstance(val, str):
        return [val.strip()] if val.strip() else []
    if isinstance(val, list):
        out: list[str] = []
        for x in val:
            line = coerce_cv_feedback_line(x)
            if line:
                out.append(line)
        return out
    single = coerce_cv_feedback_line(val)
    return [single] if single else []
