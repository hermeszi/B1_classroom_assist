-- class_assist prototype schema (SQLite). SYNTHETIC DATA ONLY.
-- Mirrors the centre's real per-student feedback sheet.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS instructors (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,     -- first / preferred name only
  age           INTEGER,
  level         TEXT,              -- e.g. Scratch L1, Scratch L2, Python Beginner
  scratch_user  TEXT,             -- username ONLY; never store passwords
  parent_email  TEXT,
  profile_notes TEXT              -- siblings, CCA, learning style, goals
);

-- One row per lesson, per student. Group-taught siblings get one row each
-- (the same generated summary can be saved to several students).
CREATE TABLE IF NOT EXISTS lesson_entries (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id       INTEGER NOT NULL REFERENCES students(id),
  instructor_id    INTEGER REFERENCES instructors(id),
  lesson_date      TEXT NOT NULL DEFAULT (date('now')),
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  worksheet        TEXT,            -- instructor input, e.g. "Scratch Dino Run"
  raw_notes        TEXT NOT NULL,   -- instructor input: a few rough bullets
  lesson_summary   TEXT,            -- AI: parent-facing narrative (house style)
  skills_practised TEXT,            -- AI: JSON array string
  next_lesson      TEXT,            -- AI: suggested next project / topic
  internal_notes   TEXT             -- AI: terse handover for next instructor
);

-- synthetic seed (safe to commit + demo)
INSERT INTO instructors (name) VALUES ('Ming'), ('Wei');

INSERT INTO students (name, age, level, scratch_user, parent_email, profile_notes) VALUES
  ('Aiden', 11, 'Scratch L2',      'aiden_codes', 'parent1@example.test', 'Loves games; focus drops after ~20 min.'),
  ('Mei',   13, 'Python Beginner', 'mei_dev',     'parent2@example.test', 'Strong logic; rushes syntax. Twin, taught with Lena.'),
  ('Lena',  13, 'Python Beginner', 'lena_dev',    'parent2@example.test', 'Mei''s twin; taught together. Careful, methodical.'),
  ('Ravi',  15, 'Scratch L3',      'ravi_builds', 'parent3@example.test', 'Independent; wants harder challenges. CCA: robotics.');
