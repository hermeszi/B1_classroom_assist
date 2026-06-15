# class_assist (team/organisational use)
 
## Overview
 
### Problem
- **Who is affected?** Instructors and parents at a small youth coding enrichment centre. Students (~9–16) attend on a flexible "pass" system  (different days, different instructors) so continuity depends entirely on written records.
  
- **What is the issue?** After every class an instructor writes a per-student update that (a) tells parents what happened, (b) lets the next instructor take over, and (c) builds a progress record for promotion and testimonials. In the current Google-Sheets workflow the parent-facing summary gets written, but the structured fields — skills practised, next lesson, internal handover notes — are almost always left blank because filling them by hand is tedious. Each write-up runs ~5–8 minutes; across a class it becomes a long admin tail after every session.
### Outcome
- A full-stack web app: the instructor enters a worksheet name and a few rough notes, and AI produces a parent-ready lesson summary in the centre's house style **and** auto-fills the three fields instructors normally skip (skills practised, next lesson, internal notes). Entries are saved per student with a live history view.
- **Estimated impact:** a ~5–8 min/student write-up drops to roughly a minute of review-and-edit, and the structured progress fields (promotions and testimonials later rely on) actually get filled meaningfully.
---
 
## Demo
Instructor flow, start to finish:
1. Select one or more students (multiple for group/sibling lessons).
2. Enter the worksheet and rough notes — by typing or by voice (mic button, Web Speech API).
3. **Generate** → AI returns an editable lesson summary, skills practised, next lesson, and internal notes.
4. Review and edit any field.
5. Set the lesson date (defaults to today; editable for backdated write-ups).
6. **Save** → the entry is stored and the student's History panel updates immediately.
7. **Copy Summary** to paste into the parent update.
<img width="800" height="800" alt="B1_class_assist" src="https://github.com/user-attachments/assets/429508fd-51d4-4915-89cb-a7f15c0701de" />
 
---
 
## Technology Stack
### Frontend
- HTML + vanilla JavaScript (no build step), Tailwind via CDN.
- Web Speech API for optional voice note capture.
### Backend
- Python, FastAPI, uvicorn.
- SQLite (stdlib `sqlite3`) for persistence.
- OpenRouter (OpenAI-compatible Chat Completions), model `openai/gpt-4o-mini`, called via `httpx`.
---
 
## Installation
1. `cp .env.example .env` and set `OPENROUTER_API_KEY` (and `MODEL`, default `openai/gpt-4o-mini`).
2. Run it, either:
   - **Local:** `python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`, then `uvicorn src.main:app --reload`
   - **Docker:** `docker compose up --build`
3. Open `http://localhost:8000` (or your chosen port).
## Usage
Select student(s) → enter worksheet + notes (type or speak) → Generate → review/edit → set date → Save → Copy Summary. Past entries show in the History panel, newest first. Add new students from the "Add student" panel.
 
## Project Structure
- `src/` — `main.py` (FastAPI routes), `database.py` (SQLite), `ai_service.py` (OpenRouter call + validation), `prompts.py` (system prompt + output contract), `static/` (UI).
- `data/` — `schema.sql` (schema + **synthetic** seed). The live `.db` is gitignored.
- `tests/` — contract tests (`pytest`).
- `docs/ai-dev/` — AI usage writeup.
- `Extra/` — full AI chat-session logs.
## Data & safety
The committed seed uses synthetic students only. Real records live in a gitignored local database and are never committed. No passwords or surnames are sent to the AI provider.


