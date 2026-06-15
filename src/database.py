import json
import os
import sqlite3
from datetime import date

_SRC_DIR = os.path.dirname(__file__)
_PROJECT_ROOT = os.path.dirname(_SRC_DIR)
_DB_PATH = os.path.join(_PROJECT_ROOT, "data", "class_assist.db")
_SCHEMA_PATH = os.path.join(_PROJECT_ROOT, "data", "schema.sql")


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    if os.path.exists(_DB_PATH):
        return
    with _connect() as conn:
        with open(_SCHEMA_PATH) as f:
            conn.executescript(f.read())


def add_student(
    name: str,
    age: int | None = None,
    level: str | None = None,
    scratch_user: str | None = None,
    parent_email: str | None = None,
    profile_notes: str | None = None,
) -> int:
    with _connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO students (name, age, level, scratch_user, parent_email, profile_notes)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (name, age, level, scratch_user, parent_email, profile_notes),
        )
        return cur.lastrowid


def get_students() -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT id, name, age, level, scratch_user, parent_email, profile_notes FROM students ORDER BY name"
        ).fetchall()
    return [dict(r) for r in rows]


def get_student_history(student_id: int) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT id, student_id, instructor_id, lesson_date, created_at,
                   worksheet, raw_notes, lesson_summary, skills_practised,
                   next_lesson, internal_notes
            FROM lesson_entries
            WHERE student_id = ?
            ORDER BY created_at DESC
            """,
            (student_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def save_entry(student_ids: list[int], entry: dict) -> None:
    skills = entry.get("skills_practised")
    if isinstance(skills, (list, dict)):
        skills = json.dumps(skills)

    lesson_date = entry.get("lesson_date") or date.today().isoformat()

    with _connect() as conn:
        for sid in student_ids:
            conn.execute(
                """
                INSERT INTO lesson_entries
                    (student_id, lesson_date, worksheet, raw_notes, lesson_summary,
                     skills_practised, next_lesson, internal_notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    sid,
                    lesson_date,
                    entry.get("worksheet"),
                    entry.get("raw_notes", ""),
                    entry.get("lesson_summary"),
                    skills,
                    entry.get("next_lesson"),
                    entry.get("internal_notes"),
                ),
            )
