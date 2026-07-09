import json
import os
import sqlite3
import uuid
from datetime import date, datetime

_SRC_DIR = os.path.dirname(__file__)
_PROJECT_ROOT = os.path.dirname(_SRC_DIR)
_DB_PATH = os.environ.get("DB_PATH") or os.path.join(_PROJECT_ROOT, "data", "class_assist.db")
_SCHEMA_PATH = os.path.join(_SRC_DIR, "schema.sql")  # lives in src/ — never under a data volume

_STUDENT_COLS = (
    "id", "name", "age", "level", "login",
    "parent_email", "parent_phone", "student_email", "student_phone",
    "profile_notes", "active",
)


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with _connect() as conn:
        tables = {row[0] for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )}

        if "students" not in tables:
            # Fresh or empty database — apply full schema
            with open(_SCHEMA_PATH) as f:
                conn.executescript(f.read())
            return

        # Migrate students table
        student_cols = {row[1] for row in conn.execute("PRAGMA table_info(students)")}

        # Rename scratch_user → login (SQLite 3.25+)
        if "scratch_user" in student_cols and "login" not in student_cols:
            conn.execute("ALTER TABLE students RENAME COLUMN scratch_user TO login")

        for col, defn in [
            ("parent_phone",  "TEXT"),
            ("student_email", "TEXT"),
            ("student_phone", "TEXT"),
            ("active",        "INTEGER NOT NULL DEFAULT 1"),
        ]:
            if col not in student_cols:
                conn.execute(f"ALTER TABLE students ADD COLUMN {col} {defn}")

        # Migrate lesson_entries table
        entry_cols = {row[1] for row in conn.execute("PRAGMA table_info(lesson_entries)")}
        for col, defn in [
            ("title",          "TEXT"),
            ("general_lesson", "TEXT"),
            ("archived",       "INTEGER NOT NULL DEFAULT 0"),
        ]:
            if col not in entry_cols:
                conn.execute(f"ALTER TABLE lesson_entries ADD COLUMN {col} {defn}")

        # Create new tables if missing
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS student_feedback (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                lesson_entry_id INTEGER NOT NULL REFERENCES lesson_entries(id),
                student_id      INTEGER NOT NULL REFERENCES students(id),
                token           TEXT NOT NULL UNIQUE,
                submitted_at    TEXT,
                rating          INTEGER,
                comments        TEXT,
                created_at      TEXT NOT NULL DEFAULT (datetime('now'))
            );
        """)


# ── students ──────────────────────────────────────────────────────────────────

def add_student(
    name: str,
    age: int | None = None,
    level: str | None = None,
    login: str | None = None,
    parent_email: str | None = None,
    profile_notes: str | None = None,
    parent_phone: str | None = None,
    student_email: str | None = None,
    student_phone: str | None = None,
) -> int:
    with _connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO students
                (name, age, level, login, parent_email, profile_notes,
                 parent_phone, student_email, student_phone)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (name, age, level, login, parent_email, profile_notes,
             parent_phone, student_email, student_phone),
        )
        return cur.lastrowid


def update_student(student_id: int, fields: dict) -> None:
    allowed = {
        "name", "age", "level", "login",
        "parent_email", "parent_phone", "student_email", "student_phone",
        "profile_notes", "active",
    }
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return
    sets = ", ".join(f"{k} = ?" for k in updates)
    vals = list(updates.values()) + [student_id]
    with _connect() as conn:
        conn.execute(f"UPDATE students SET {sets} WHERE id = ?", vals)


def get_students(active_only: bool = False) -> list[dict]:
    cols = ", ".join(_STUDENT_COLS)
    where = "WHERE active = 1" if active_only else ""
    with _connect() as conn:
        rows = conn.execute(
            f"SELECT {cols} FROM students {where} ORDER BY name"
        ).fetchall()
    return [dict(r) for r in rows]


def get_student_history(student_id: int) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT le.id, le.student_id, le.instructor_id, le.lesson_date, le.created_at,
                   le.title, le.general_lesson, le.archived,
                   le.worksheet, le.raw_notes, le.lesson_summary, le.skills_practised,
                   le.next_lesson, le.internal_notes,
                   (SELECT token FROM student_feedback
                    WHERE lesson_entry_id = le.id AND student_id = le.student_id
                    ORDER BY created_at DESC LIMIT 1) AS feedback_token,
                   (SELECT submitted_at FROM student_feedback
                    WHERE lesson_entry_id = le.id AND student_id = le.student_id
                    ORDER BY created_at DESC LIMIT 1) AS feedback_submitted_at,
                   (SELECT rating FROM student_feedback
                    WHERE lesson_entry_id = le.id AND student_id = le.student_id
                    ORDER BY created_at DESC LIMIT 1) AS feedback_rating,
                   (SELECT comments FROM student_feedback
                    WHERE lesson_entry_id = le.id AND student_id = le.student_id
                    ORDER BY created_at DESC LIMIT 1) AS feedback_comments
            FROM lesson_entries le
            WHERE le.student_id = ?
            ORDER BY le.created_at DESC
            """,
            (student_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def save_entry(student_ids: list[int], entry: dict) -> list[int]:
    skills = entry.get("skills_practised")
    if isinstance(skills, (list, dict)):
        skills = json.dumps(skills)

    lesson_date = entry.get("lesson_date") or date.today().isoformat()
    entry_ids = []

    with _connect() as conn:
        for sid in student_ids:
            cur = conn.execute(
                """
                INSERT INTO lesson_entries
                    (student_id, lesson_date, title, general_lesson,
                     worksheet, raw_notes, lesson_summary,
                     skills_practised, next_lesson, internal_notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    sid,
                    lesson_date,
                    entry.get("title") or None,
                    entry.get("general_lesson") or None,
                    entry.get("worksheet"),
                    entry.get("raw_notes", ""),
                    entry.get("lesson_summary"),
                    skills,
                    entry.get("next_lesson"),
                    entry.get("internal_notes"),
                ),
            )
            entry_ids.append(cur.lastrowid)
    return entry_ids


def export_students_data(student_ids: list[int] | None = None) -> list[dict]:
    cols = ", ".join(_STUDENT_COLS)
    with _connect() as conn:
        if student_ids:
            placeholders = ",".join("?" * len(student_ids))
            rows = conn.execute(
                f"SELECT {cols} FROM students WHERE id IN ({placeholders}) ORDER BY name",
                student_ids,
            ).fetchall()
        else:
            rows = conn.execute(
                f"SELECT {cols} FROM students ORDER BY name"
            ).fetchall()
    return [dict(r) for r in rows]


def import_students_data(rows: list[dict]) -> int:
    count = 0
    with _connect() as conn:
        for row in rows:
            name = (row.get("name") or "").strip()
            if not name:
                continue
            try:
                age = int(row["age"]) if row.get("age") and str(row["age"]).strip() else None
            except (ValueError, TypeError):
                age = None
            active_raw = str(row.get("active", "1")).lower().strip()
            active = 0 if active_raw in ("0", "false", "no") else 1
            # accept both "login" (new) and "scratch_user" (legacy CSV exports)
            login = row.get("login") or row.get("scratch_user") or None
            conn.execute(
                """
                INSERT INTO students
                    (name, age, level, login, parent_email, parent_phone,
                     student_email, student_phone, profile_notes, active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    name, age,
                    row.get("level") or None,
                    login,
                    row.get("parent_email") or None,
                    row.get("parent_phone") or None,
                    row.get("student_email") or None,
                    row.get("student_phone") or None,
                    row.get("profile_notes") or None,
                    active,
                ),
            )
            count += 1
    return count


# ── settings ──────────────────────────────────────────────────────────────────

def get_setting(key: str, default: str | None = None) -> str | None:
    with _connect() as conn:
        row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else default


def set_setting(key: str, value: str) -> None:
    with _connect() as conn:
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?)"
            " ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value),
        )


def get_all_settings() -> dict:
    with _connect() as conn:
        rows = conn.execute("SELECT key, value FROM settings").fetchall()
    return {r["key"]: r["value"] for r in rows}


# ── feedback ──────────────────────────────────────────────────────────────────

def update_lesson_entry(entry_id: int, fields: dict) -> None:
    allowed = {
        "lesson_date", "title", "general_lesson", "worksheet",
        "raw_notes", "lesson_summary", "skills_practised",
        "next_lesson", "internal_notes", "archived",
    }
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return
    sets = ", ".join(f"{k} = ?" for k in updates)
    vals = list(updates.values()) + [entry_id]
    with _connect() as conn:
        conn.execute(f"UPDATE lesson_entries SET {sets} WHERE id = ?", vals)


def get_lesson_entry(entry_id: int) -> dict | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT id, student_id, lesson_date, worksheet FROM lesson_entries WHERE id = ?",
            (entry_id,),
        ).fetchone()
    return dict(row) if row else None


def create_feedback_token(lesson_entry_id: int, student_id: int) -> str:
    token = uuid.uuid4().hex
    with _connect() as conn:
        conn.execute(
            "INSERT INTO student_feedback (lesson_entry_id, student_id, token) VALUES (?, ?, ?)",
            (lesson_entry_id, student_id, token),
        )
    return token


def get_feedback_by_token(token: str) -> dict | None:
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT sf.id, sf.lesson_entry_id, sf.student_id, sf.token,
                   sf.submitted_at, sf.rating, sf.comments, sf.created_at,
                   s.name AS student_name, le.worksheet, le.lesson_date
            FROM student_feedback sf
            JOIN students s ON s.id = sf.student_id
            JOIN lesson_entries le ON le.id = sf.lesson_entry_id
            WHERE sf.token = ?
            """,
            (token,),
        ).fetchone()
    return dict(row) if row else None


def submit_feedback(token: str, rating: int | None, comments: str) -> None:
    with _connect() as conn:
        conn.execute(
            """
            UPDATE student_feedback
            SET rating = ?, comments = ?, submitted_at = ?
            WHERE token = ?
            """,
            (rating, comments, datetime.utcnow().isoformat(), token),
        )


def get_student_feedback(student_id: int) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT sf.rating, sf.comments, sf.submitted_at, le.worksheet, le.lesson_date
            FROM student_feedback sf
            JOIN lesson_entries le ON le.id = sf.lesson_entry_id
            WHERE sf.student_id = ? AND sf.submitted_at IS NOT NULL
            ORDER BY sf.submitted_at DESC
            LIMIT 5
            """,
            (student_id,),
        ).fetchall()
    return [dict(r) for r in rows]
