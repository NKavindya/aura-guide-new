def skill_id(conn, skill_name: str) -> int:
    row = conn.execute(
        "SELECT id FROM skills WHERE name = %s ORDER BY id LIMIT 1",
        (skill_name,),
    ).fetchone()
    if not row:
        raise ValueError(f"unknown skill {skill_name!r}")
    return int(row["id"])


def upsert_user_skill_score(conn, user_id: int, skill_name: str, score_1_to_3: int) -> None:
    """Append each evaluation as its own row so averages reflect all attempts (not rounded early)."""
    sid = max(1, min(3, int(score_1_to_3)))
    sk = skill_id(conn, skill_name)
    conn.execute(
        "INSERT INTO user_skills (user_id, skill_id, score_id) VALUES (%s, %s, %s)",
        (user_id, sk, sid),
    )


def status_id_by_name(conn, name: str) -> int:
    row = conn.execute(
        "SELECT id FROM status WHERE lower(trim(name)) = lower(trim(%s)) ORDER BY id LIMIT 1",
        (name,),
    ).fetchone()
    if not row:
        raise ValueError(f"unknown status {name!r}")
    return int(row["id"])
