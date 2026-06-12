from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.agent_workflows import (
    evaluate_professional_communication_session,
    evaluate_task_answer,
    fetch_user_learning_row,
    generate_agent_task,
    interview_evaluate,
    interview_next_question,
    persist_professional_communication_score,
    reflection_evaluate,
    reflection_next_question,
    run_cv_analyze,
)
from app.chat_persist import append_message, resolve_session_id
from app.auth import get_current_email
from app.db import get_conn
from app.json_utils import clean_coach_display_text
from app.ollama_client import chat_communication_coach, chat_completion_with_flow
from app.settings import settings

app = FastAPI(title="AURA AI Agent", version="1.0.0")

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=16000)
    session_id: int | None = None
    topic_flow: str | None = Field(
        None,
        description="Optional guided mode: reflection | communication",
        max_length=32,
    )


class ChatResponse(BaseModel):
    reply: str
    session_id: int
    follow_up: str | None = None


def user_id_for_email(email: str) -> int:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id FROM user_student WHERE lower(trim(email)) = lower(trim(%s))",
            (email,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return int(row["id"])


def ensure_session_owner(user_id: int, session_id: int) -> None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id FROM chat_sessions WHERE id = %s AND user_id = %s",
            (session_id, user_id),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")


def is_communication_exit_message(text: str) -> bool:
    t = text.strip().lower().rstrip(".!?")
    return t in ("exit", "quit", "stop")


@app.get("/health")
async def health():
    return {"status": "ok", "model": settings.ollama_model}


@app.post("/agent/chat", response_model=ChatResponse)
async def agent_chat(body: ChatRequest, email: str = Depends(get_current_email)):
    user_id = user_id_for_email(email)
    text = body.message.strip()
    flow_key = (body.topic_flow or "").strip().lower()

    session_id = body.session_id
    if session_id is not None:
        ensure_session_owner(user_id, session_id)
    else:
        topic = {
            "reflection": "Reflect on progress",
            "communication": "Professional communication coaching",
        }.get(flow_key, "AI Coach")
        with get_conn() as conn:
            row = conn.execute(
                """INSERT INTO chat_sessions (user_id, topic, start_date_time)
                   VALUES (%s, %s, %s) RETURNING id""",
                (user_id, topic[:255], datetime.now(timezone.utc)),
            ).fetchone()
        session_id = int(row["id"])

    with get_conn() as conn:
        conn.execute(
            """INSERT INTO chat_message (session_id, message, is_sender_user)
               VALUES (%s, %s, %s)""",
            (session_id, text, True),
        )

    history_rows = []
    with get_conn() as conn:
        history_rows = conn.execute(
            """SELECT message, is_sender_user FROM chat_message
               WHERE session_id = %s ORDER BY id ASC""",
            (session_id,),
        ).fetchall()

    ollama_messages: list[dict] = []
    for row in history_rows:
        role = "user" if row["is_sender_user"] else "assistant"
        ollama_messages.append({"role": role, "content": row["message"]})

    follow_up: str | None = None
    try:
        if flow_key == "communication":
            row = fetch_user_learning_row(email)
            goal = row["goal_name"]
            skill_level = (
                f"technical={row['technical_skill_level']}, "
                f"soft={row['soft_skill_level']}"
            )
            if is_communication_exit_message(text):
                lines: list[str] = []
                for r in history_rows:
                    role = "User" if r["is_sender_user"] else "Coach"
                    lines.append(f"{role}: {r['message']}")
                hist_txt = "\n".join(lines)
                ev = await evaluate_professional_communication_session(goal, hist_txt)
                persist_professional_communication_score(email, ev["score"])
                reply = "Session ended. Good job today!"
                follow_up = (
                    f"Communication review (1–3)\n\nScore: {ev['score']}/3\n\n"
                    f"{clean_coach_display_text(str(ev.get('feedback') or ''))}"
                )
            else:
                reply = await chat_communication_coach(
                    ollama_messages, goal, skill_level
                )
        else:
            reply = await chat_completion_with_flow(ollama_messages, body.topic_flow)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Ollama error: {e!s}") from e

    with get_conn() as conn:
        conn.execute(
            """INSERT INTO chat_message (session_id, message, is_sender_user)
               VALUES (%s, %s, %s)""",
            (session_id, reply, False),
        )
        if follow_up:
            conn.execute(
                """INSERT INTO chat_message (session_id, message, is_sender_user)
                   VALUES (%s, %s, %s)""",
                (session_id, follow_up, False),
            )

    return ChatResponse(
        reply=reply, session_id=session_id, follow_up=follow_up
    )


@app.get("/agent/chat/history")
async def chat_history(session_id: int | None = None, email: str = Depends(get_current_email)):
    user_id = user_id_for_email(email)

    if session_id is not None:
        ensure_session_owner(user_id, session_id)
        sid = session_id
    else:
        with get_conn() as conn:
            row = conn.execute(
                """SELECT id FROM chat_sessions WHERE user_id = %s
                   ORDER BY start_date_time DESC NULLS LAST, id DESC LIMIT 1""",
                (user_id,),
            ).fetchone()
        if not row:
            return {"session_id": None, "messages": []}
        sid = int(row["id"])

    with get_conn() as conn:
        rows = conn.execute(
            """SELECT id, message, is_sender_user FROM chat_message
               WHERE session_id = %s ORDER BY id ASC""",
            (sid,),
        ).fetchall()

    messages = [
        {
            "id": r["id"],
            "content": r["message"],
            "role": "user" if r["is_sender_user"] else "assistant",
        }
        for r in rows
    ]
    return {"session_id": sid, "messages": messages}


@app.post("/agent/chat/new-session")
async def new_session(email: str = Depends(get_current_email)):
    user_id = user_id_for_email(email)
    with get_conn() as conn:
        row = conn.execute(
            """INSERT INTO chat_sessions (user_id, topic, start_date_time)
               VALUES (%s, %s, %s) RETURNING id""",
            (user_id, "AI Coach", datetime.now(timezone.utc)),
        ).fetchone()
    return {"session_id": int(row["id"])}


class CVAnalyzeBody(BaseModel):
    cv_text: str = Field(..., min_length=10, max_length=200000)
    file_name: str = Field(default="cv.pdf", max_length=500)
    session_id: int | None = None


@app.post("/agent/cv-analyze")
async def cv_analyze(body: CVAnalyzeBody, email: str = Depends(get_current_email)):
    try:
        out = await run_cv_analyze(email, body.cv_text, body.file_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"{e!s}") from e

    uid = user_id_for_email(email)
    sid: int
    with get_conn() as conn:
        sid = resolve_session_id(conn, uid, body.session_id, topic="CV analysis")
        summary = str(out.get("chat_summary") or "").strip()
        if summary:
            append_message(conn, sid, summary[:14000], False)
    return {**out, "session_id": sid}


class InterviewQBody(BaseModel):
    question_number: int = Field(..., ge=1, le=500)
    session_id: int | None = None
    chat_user_message: str | None = Field(None, max_length=2000)


@app.post("/agent/interview/next-question")
async def interview_q(body: InterviewQBody, email: str = Depends(get_current_email)):
    try:
        uid = user_id_for_email(email)
        with get_conn() as conn:
            sid = resolve_session_id(
                conn,
                uid,
                body.session_id,
                topic="Interview practice",
            )
            if body.chat_user_message and body.chat_user_message.strip():
                append_message(conn, sid, body.chat_user_message.strip(), True)

        out = await interview_next_question(email, body.question_number)
        assistant = (
            f"**Question {out.get('question_number', body.question_number)}**\n\n"
            f"{out.get('question', '')}"
        )
        with get_conn() as conn:
            append_message(conn, sid, assistant, False)

        return {**out, "session_id": sid}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"{e!s}") from e


class InterviewEvalBody(BaseModel):
    question_number: int = Field(..., ge=1)
    question: str = Field(..., min_length=3, max_length=8000)
    answer: str = Field(..., min_length=3, max_length=16000)
    session_id: int | None = None


@app.post("/agent/interview/evaluate")
async def interview_ev(body: InterviewEvalBody, email: str = Depends(get_current_email)):
    try:
        uid = user_id_for_email(email)
        with get_conn() as conn:
            sid = resolve_session_id(
                conn, uid, body.session_id, topic="Interview practice"
            )
            append_message(conn, sid, body.answer.strip(), True)

        out = await interview_evaluate(
            email, body.question_number, body.question, body.answer
        )
        fb = str(out.get("feedback") or "").strip()
        with get_conn() as conn:
            append_message(conn, sid, f"**Interview feedback**\n\n{fb}", False)
        return {**out, "session_id": sid}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"{e!s}") from e


class ReflectionQBody(BaseModel):
    question_number: int = Field(..., ge=1, le=500)
    session_id: int | None = None
    chat_user_message: str | None = Field(None, max_length=2000)


@app.post("/agent/reflection/next-question")
async def reflection_q(body: ReflectionQBody, email: str = Depends(get_current_email)):
    try:
        uid = user_id_for_email(email)
        with get_conn() as conn:
            sid = resolve_session_id(
                conn, uid, body.session_id, topic="Reflection & self-assessment"
            )
            if body.chat_user_message and body.chat_user_message.strip():
                append_message(conn, sid, body.chat_user_message.strip(), True)

        out = await reflection_next_question(email, body.question_number)
        assistant = (
            f"**Reflection {out.get('question_number', body.question_number)}**\n\n"
            f"{out.get('question', '')}"
        )
        with get_conn() as conn:
            append_message(conn, sid, assistant, False)

        return {**out, "session_id": sid}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"{e!s}") from e


class ReflectionEvalBody(BaseModel):
    question_number: int = Field(..., ge=1)
    question: str = Field(..., min_length=3, max_length=8000)
    answer: str = Field(..., min_length=3, max_length=16000)
    session_id: int | None = None


@app.post("/agent/reflection/evaluate")
async def reflection_ev(body: ReflectionEvalBody, email: str = Depends(get_current_email)):
    try:
        uid = user_id_for_email(email)
        with get_conn() as conn:
            sid = resolve_session_id(
                conn, uid, body.session_id, topic="Reflection & self-assessment"
            )
            append_message(conn, sid, body.answer.strip(), True)

        out = await reflection_evaluate(
            email, body.question_number, body.question, body.answer
        )
        fb = str(out.get("feedback") or "").strip()
        score = int(out.get("score") or 2)
        with get_conn() as conn:
            append_message(
                conn,
                sid,
                f"**Reflection feedback** (score {score}/3)\n\n{fb}",
                False,
            )
        return {**out, "session_id": sid}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"{e!s}") from e


class TaskGenBody(BaseModel):
    session_id: int | None = None
    chat_user_message: str | None = Field(
        default="Assign me a new task",
        max_length=2000,
    )


@app.post("/agent/task/generate")
async def task_gen(
    body: TaskGenBody = TaskGenBody(), email: str = Depends(get_current_email)
):
    b = body
    try:
        uid = user_id_for_email(email)
        with get_conn() as conn:
            sid = resolve_session_id(conn, uid, b.session_id, topic="Skill tasks")
            msg = (b.chat_user_message or "Assign me a new task").strip()
            append_message(conn, sid, msg, True)

        out = await generate_agent_task(email)
        chat = str(out.get("chat_message") or "").strip()
        with get_conn() as conn:
            if chat:
                append_message(conn, sid, chat, False)

        return {**out, "session_id": sid}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"{e!s}") from e


class TaskEvalBody(BaseModel):
    user_common_task_id: int = Field(..., ge=1)
    task_description: str = Field(..., min_length=10, max_length=16000)
    skill: str = Field(..., min_length=3, max_length=120)
    answer: str = Field(..., min_length=10, max_length=32000)
    session_id: int | None = None


@app.post("/agent/task/evaluate")
async def task_ev(body: TaskEvalBody, email: str = Depends(get_current_email)):
    try:
        uid = user_id_for_email(email)
        sid: int
        with get_conn() as conn:
            sid = resolve_session_id(conn, uid, body.session_id, topic="Skill tasks")
            append_message(conn, sid, body.answer.strip(), True)

        result = await evaluate_task_answer(
            email,
            body.user_common_task_id,
            body.task_description,
            body.skill.strip(),
            body.answer.strip(),
        )
        fb = str(result.get("feedback_message") or "").strip()
        with get_conn() as conn:
            append_message(
                conn,
                sid,
                f"**Task feedback** ({result.get('skill', body.skill)})\n\n{fb}",
                False,
            )
        return {**result, "session_id": sid}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"{e!s}") from e
