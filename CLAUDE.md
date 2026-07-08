# CARE — project context for Claude Code

## What this is
A full-stack web app (started as a ~2-hour prototype for the 42 SG B1 Builders
submission, now evolving into a general classroom tool) for youth enrichment centres.
An instructor gives a lesson topic + a few rough notes, and the app produces:
- a parent-facing **lesson summary**
- **skills practised**
- a suggested **next lesson**
- **internal handover notes**

The app is named **CARE** — Classroom AI for Reports & Engagement.

## Stack (do not change without asking)
- Backend: FastAPI + uvicorn (Python 3.12)
- DB: SQLite (stdlib sqlite3), file at data/class_assist.db, schema in data/schema.sql
- Frontend: single src/static/index.html + app.js, vanilla JS, NO build step. Tailwind via CDN.
- LLM: multi-provider. Primary: OpenRouter (OpenAI-compatible). Also supports OpenAI,
  Google Gemini, Groq, Anthropic native API, Ollama. Key in env OPENROUTER_API_KEY,
  model in env MODEL (default openai/gpt-4o-mini). Settings overridable from UI.
- Email: preview + copy only. NEVER send a real email.

## Contracts (source of truth — implement AGAINST these, do not redefine)
- DB shape: data/schema.sql
- AI output shape + validator: src/prompts.py (SYSTEM_PROMPT, REQUIRED_KEYS, validate_report)
- Tests that must pass: tests/test_ai_contract.py  ->  run `pytest -q`

## Conventions
- ai_service MUST expose `_call_model(system, user) -> str` returning the raw model
  text, so tests can monkeypatch it.
- `_call_model` reads api_key, model, api_url from the DB settings table at call time
  (DB > env > hardcoded default). Detects `api.anthropic.com` and switches to the
  Anthropic native message format automatically.
- `generate_report(student, worksheet, raw_notes, title, general_lesson) -> dict`
  builds the user message, calls _call_model, parses JSON, runs validate_report(),
  and retries the model ONCE on an invalid payload.
- For reliable JSON: instruct JSON in the system prompt; for OpenAI-compatible
  providers also pass response_format={"type": "json_object"}.
- Privacy: first names only. No surnames, no passwords, no PII in prompts.
  Synthetic data only in the committed seed.
- No hidden network calls inside tests.
- `POST /api/save` returns `{"saved": N, "entry_ids": [...]}` — entry_ids are used
  to generate per-student feedback links in the UI.
- `GET /api/settings` NEVER returns the actual API key — only `api_key_set: bool`.

## Key DB columns (current — do not regress)
- students: id, name, age, level, login, parent_email, parent_phone, student_email,
  student_phone, profile_notes, active
- lesson_entries: id, student_id, instructor_id, lesson_date, created_at,
  title, general_lesson, worksheet, raw_notes, lesson_summary, skills_practised,
  next_lesson, internal_notes
- student_feedback: id, lesson_entry_id, student_id, token (unique UUID hex),
  submitted_at, rating, comments, created_at
- settings: key, value

## Run
- Dev:       uvicorn src.main:app --reload --port 8001
- Container: docker compose up --build   ->  http://localhost:8001
- Tests:     pytest -q

---

## AI Development Log

This project was built entirely with Claude (Anthropic) via Claude Code.
The log below records what was built in each session.

---

### Session 1 — Initial prototype (42 SG B1 submission)
**Model used:** Claude Sonnet 4.6 via Claude Code CLI

Built the core CRUD loop from scratch in one session:
- `data/schema.sql` — students, instructors, lesson_entries tables + synthetic seed
- `src/database.py` — init_db(), get_students(), get_student_history(), save_entry()
- `src/ai_service.py` — _call_model() (OpenRouter), generate_report() with retry
- `src/prompts.py` — SYSTEM_PROMPT + validate_report() output contract
- `src/main.py` — GET /api/students, GET /api/students/{id}/history,
  POST /api/generate, POST /api/save; static mount
- `src/static/index.html + app.js` — student picker, worksheet/notes inputs,
  Generate, editable report fields, Save, Copy Summary
- `tests/test_ai_contract.py` — monkeypatched contract tests
- Docker + docker-compose setup

**What AI did well:** end-to-end coherent architecture in one pass; contract tests
that actually catch regressions; clean separation of concerns.

---

### Session 2 — Feature expansion
**Model used:** Claude Sonnet 4.6 via Claude Code CLI

Extended the app with three major feature areas requested by the user:

**Students tab**
- Full student management: add, edit, deactivate/reactivate, export (CSV/TSV/JSON),
  import CSV, per-student export
- DB migration: `scratch_user` → `login` column rename via ALTER TABLE RENAME COLUMN
  (SQLite 3.25+); runtime migration check via `sqlite_master` table existence
- Searchable student list with avatar circles (deterministic colour from name hash)

**Settings tab**
- `settings` key/value table in DB
- API key, model, custom system prompt stored in DB; read at call time
- GET /api/settings never exposes the key (returns `api_key_set: bool` only)

**Student feedback**
- `student_feedback` table: UUID hex token per lesson entry/student pair
- POST /api/lessons/{id}/feedback-link creates a token
- GET/POST /api/feedback/{token} — student-facing read + submit
- `src/static/feedback.html` — star rating form

**UI overhaul**
- 3-tab layout (Lesson / Students / Settings)
- Colour-coded section cards, SVG icons, Tailwind utility classes
- Shared lesson fields: `title` (lesson of the day) + `general_lesson` (class
  content description), persist across student switches in a session

**Docker startup fix**
- Switched init_db() from `os.path.exists()` to `sqlite_master` table check to
  avoid "no such table" crash when Docker bakes an empty db file into the image

---

### Session 3 — CARE rebranding + multi-provider AI + UX improvements
**Model used:** Claude Sonnet 4.6 via Claude Code CLI

**Rebranding**
- Renamed app to CARE — Classroom AI for Reports & Engagement
- Updated page title, header, subtitle

**Error messages**
- `_call_model` now translates HTTP status codes to plain-English messages:
  401 (invalid key), 403 (access denied), 404 (model not found), 429 (rate limit),
  5xx (server error), ConnectError, TimeoutException (45 s limit)

**Multi-provider AI**
- Provider dropdown in Settings tab: OpenRouter, OpenAI, Google Gemini, Anthropic,
  Groq, Ollama, Custom
- `api_url` stored in settings table, read at call time
- `_call_model` auto-detects `api.anthropic.com` and switches to Anthropic's native
  `/v1/messages` format (different headers + body shape)
- Ollama skips the API-key-required check (localhost)
- `<datalist>` model suggestions per provider with inline descriptions

**Post-save feedback links**
- `POST /api/save` returns `entry_ids`
- Sky-blue card appears after saving with per-student "Get Link" buttons
- Clicking creates a token via the feedback-link endpoint, shows copyable URL

**Teacher Quick Guide card**
- Dismissible 5-step guide at top of Lesson tab
- Dismissed state persisted in `localStorage` (key: `care_guide_dismissed`)
- `?` button in header re-shows it

---

### Session 4 — Feedback tab, show-inactive toggle, docs
**Model used:** Claude Sonnet 4.6 via Claude Code CLI

**Feedback tab (new 4th tab)**
- Lists all active students; click to expand and see their lesson history
- Each lesson entry shows feedback state: no link / link sent / feedback received
- "Get Feedback Link" button lazy-creates a token; existing links shown with Copy
- Student rating + comments shown inline when submitted
- Info card explains local WiFi vs. hosted-server usage; no external service needed

**Show inactive students toggle**
- `fetchStudents()` now fetches all students (no `active_only` filter)
- Lesson picker filters to `s.active` in JS
- Students tab has a "Show deactivated students" checkbox

**Improved system prompt** (`src/prompts.py`)
- Generic (not centre-specific) but richer: numbered rules, explicit word count,
  tone-softening examples, student-feedback integration rules, group-lesson handling

**Docs**
- `.env.example` — documents all providers, explains DB path override
- `README.md` — full rewrite: feature table, DB schema diagram with design notes,
  6 deployment guides (local Python, Docker, Synology NAS, QNAP, Render, Railway,
  VPS + Caddy HTTPS), provider comparison table, privacy notes
- `Dockerfile` — fixed port 8000 → 8001 to match docker-compose.yml
