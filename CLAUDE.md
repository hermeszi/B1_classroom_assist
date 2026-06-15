# class_assist — project context for Claude Code

## What this is
A ~2-hour prototype for the 42 SG B1 Builders submission (team / organisational-use
project). At a youth coding centre, an instructor gives a worksheet name + a few rough
notes from a lesson, and the app produces a record in the centre's house style:
- a parent-facing **lesson summary**
- **skills practised**
- a suggested **next lesson**
- **internal handover notes**

The last three are fields instructors currently leave blank in the real sheet, so
auto-filling them (plus drafting the summary) is the core value. Saved to a
per-student history.

## Stack (do not change without asking)
- Backend: FastAPI + uvicorn (Python 3.12)
- DB: SQLite (stdlib sqlite3), file at data/class_assist.db, schema in data/schema.sql
- Frontend: single src/static/index.html + app.js, vanilla JS, NO build step. Tailwind via CDN allowed.
- LLM: OpenRouter (OpenAI-compatible Chat Completions). Endpoint
  https://openrouter.ai/api/v1/chat/completions. Key in env OPENROUTER_API_KEY,
  model in env MODEL (default openai/gpt-4o-mini).
- Email: preview + copy only. NEVER send a real email.

## Contracts (source of truth — implement AGAINST these, do not redefine)
- DB shape: data/schema.sql
- AI output shape + validator: src/prompts.py (SYSTEM_PROMPT, REQUIRED_KEYS, validate_report)
- Tests that must pass: tests/test_ai_contract.py  ->  run `pytest -q`

## Conventions
- ai_service MUST expose `_call_model(system, user) -> str` returning the raw model
  text, so tests can monkeypatch it. It POSTs to OpenRouter with
  Authorization: Bearer <OPENROUTER_API_KEY> and the OpenAI chat format.
- `generate_report(student, worksheet, raw_notes) -> dict` builds the user message,
  calls _call_model, parses JSON, runs validate_report(), and retries the model
  ONCE on an invalid payload.
- For reliable JSON: instruct JSON in the system prompt; if the chosen model
  supports it, also pass response_format={"type": "json_object"}.
- Privacy: first names only. No surnames, no passwords, no PII in prompts.
  Synthetic data only in the committed seed.
- No hidden network calls inside tests.

## Tasks (build in this order, one diff at a time)
1. src/database.py  : init_db(), get_students(), get_student_history(student_id),
                      save_entry(student_ids, entry)   # entry may save to >1 student
2. src/ai_service.py: _call_model(system, user), generate_report(student, worksheet, raw_notes)
3. src/main.py      : GET /api/students, GET /api/students/{id}/history,
                      POST /api/generate, POST /api/save; mount src/static at "/"
4. src/static/      : index.html + app.js — student picker (allow multi-select for
                      group lessons), worksheet + notes inputs, Generate, editable
                      panes for summary / skills / next_lesson / internal_notes,
                      Save, Copy Summary
5. make tests pass  : pytest -q
6. stretch          : mic button via Web Speech API appending to the notes box

## Run
- Dev:       uvicorn src.main:app --reload --port 8001
- Container: docker compose up --build   ->  http://localhost:8001
