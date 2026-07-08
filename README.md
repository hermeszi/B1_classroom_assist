# CARE — Classroom AI for Reports & Engagement

> A self-hosted web app that turns an instructor's rough lesson notes into polished
> parent-facing summaries, filled-in progress records, and student feedback links —
> powered by any OpenAI-compatible AI provider.

---

## The Problem

At small enrichment centres, instructors write a per-student update after every lesson:
a parent-facing summary, skills practised, the next lesson plan, and internal handover
notes for the next instructor. The parent summary gets written; the structured fields
almost always get left blank because filling them by hand is tedious.

**CARE** fixes that. Enter a worksheet name and a few rough notes → the AI writes the
full summary in the centre's house style and fills every field that instructors normally
skip. Each write-up drops from ~5–8 minutes to roughly a minute of review and edit.

---

## Demo

[YouTube demo](https://youtu.be/MUnVXtHYfys)

![Screenshot](https://github.com/user-attachments/assets/429508fd-51d4-4915-89cb-a7f15c0701de)

---

## Features

| Feature | Details |
|---|---|
| **AI report generation** | lesson summary · skills · next lesson · internal notes |
| **Multi-student lesson** | tick any number of students; one AI call generates a shared report, saved individually |
| **Student feedback links** | one-time URLs sent to students for star rating + comments |
| **Feedback in history** | student responses appear in lesson history and are fed back into future AI prompts |
| **Multi-provider AI** | OpenRouter · OpenAI · Google Gemini · Anthropic (Claude) · Groq · Ollama · Custom |
| **Voice dictation** | mic button via Web Speech API |
| **Student records** | add · edit · deactivate · re-activate · import/export CSV/TSV/JSON |
| **Lesson history** | per-student, newest first, with skills tags and feedback |
| **Customisable prompt** | edit the AI system prompt from the Settings tab |
| **Self-hosted** | SQLite database, no external services required |

---

## Technology Stack

**Backend** — Python 3.12, FastAPI, uvicorn, SQLite (`stdlib sqlite3`), httpx

**Frontend** — Single-page vanilla JS + HTML, Tailwind CSS via CDN, Web Speech API

**AI** — Any OpenAI-compatible chat completions endpoint; Anthropic native API also
supported. Tested with OpenRouter, OpenAI, Google Gemini, Groq, Ollama, and Anthropic.

---

## Database Schema

CARE uses a single SQLite file (`data/class_assist.db`). The schema is in
[`data/schema.sql`](data/schema.sql) and is applied automatically on first run.

```
┌─────────────────────────────────────────────────────────────────┐
│ students                                                        │
│  id · name · age · level · login · parent_email · parent_phone │
│  student_email · student_phone · profile_notes · active        │
└────────────────────────┬────────────────────────────────────────┘
                         │ 1:many
┌────────────────────────▼────────────────────────────────────────┐
│ lesson_entries                                                  │
│  id · student_id · instructor_id · lesson_date · created_at    │
│  title · general_lesson         ← shared across a session      │
│  worksheet · raw_notes          ← instructor input             │
│  lesson_summary · skills_practised · next_lesson               │
│  internal_notes                 ← AI output                    │
└────────────────────────┬────────────────────────────────────────┘
                         │ 1:many
┌────────────────────────▼────────────────────────────────────────┐
│ student_feedback                                                │
│  id · lesson_entry_id · student_id · token (unique UUID)       │
│  rating (1–5) · comments · submitted_at · created_at          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ settings  (key/value)                                           │
│  api_key · api_url · model · system_prompt                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ instructors  (stub — for future multi-instructor login)         │
│  id · name                                                      │
└─────────────────────────────────────────────────────────────────┘
```

### Key design decisions

- **`lesson_entries.title` and `general_lesson`** are set once per teaching session
  (e.g. "Introduction to Loops") and shared across all students taught that day —
  saving typing when a whole class did the same activity.
- **`student_feedback.token`** is a one-time UUID hex string. Generating a second
  link for the same lesson entry creates a new row (multiple links can exist; the
  history view shows the most recently created one).
- **`students.active`** soft-deletes a student: they disappear from the lesson picker
  but all historical records are preserved. Toggle "Show deactivated students" in the
  Students tab to find and reactivate them.
- **`settings`** table overrides environment variables at runtime — anything you save
  through the Settings tab takes priority over `.env`.

---

## Quick Start

### Option A — Local Python (development)

```bash
git clone <this-repo>
cd B1_classroom_assist

python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env and set OPENROUTER_API_KEY (or enter the key in the Settings tab later)

uvicorn src.main:app --reload --port 8001
# Open http://localhost:8001
```

### Option B — Docker (local machine or any server)

```bash
cp .env.example .env
# Edit .env with your API key

docker compose up --build
# Open http://localhost:8001
```

The `docker-compose.yml` mounts `./data` as a persistent volume so the SQLite
database survives container restarts and rebuilds.

---

## Deployment Guides

### 1. Local computer (always-on, e.g. a spare Mac Mini or PC)

Use Option A or B above. To make it accessible to other devices on the same WiFi
(e.g. student feedback from their own device):

```bash
# Find your computer's local IP address
ip addr show     # Linux
ipconfig         # Windows
ifconfig         # macOS

# Start on all interfaces
uvicorn src.main:app --host 0.0.0.0 --port 8001
```

Students and parents on the same network can then open `http://192.168.x.x:8001`.

---

### 2. Synology NAS (DS-series)

Synology NAS boxes can run Docker containers — ideal for always-on self-hosting
without a cloud bill.

**Prerequisites:** DSM 7+, Container Manager package installed (replaces the old
Docker package).

**Steps:**

1. Copy the project folder to your NAS (via File Station or `scp`).
2. Open **Container Manager → Project → Create**.
3. Set the project path to the folder you copied.
4. Container Manager reads `docker-compose.yml` automatically.
5. Set environment variables under **Project → Environment**:
   - `OPENROUTER_API_KEY` = your key  
   (or leave blank and set it through the Settings tab after launch)
6. Click **Build and Start**.
7. Access via `http://<NAS-IP>:8001` from any device on your network.

**Data persistence:** the `docker-compose.yml` already mounts `./data:/app/data`,
so the database lives in the project folder on your NAS — it persists across
updates and restarts.

**Port forwarding (optional):** to access from outside your home network, forward
port 8001 (TCP) in your router to the NAS IP. Use a free domain from
[DuckDNS](https://www.duckdns.org/) and Synology's built-in reverse proxy
(Control Panel → Login Portal → Advanced → Reverse Proxy) with HTTPS.

---

### 3. QNAP NAS

**Prerequisites:** Container Station installed from App Center.

1. Open **Container Station → Create Application**.
2. Upload the project folder or paste the `docker-compose.yml` contents.
3. Add environment variables in the compose editor:
   ```yaml
   environment:
     OPENROUTER_API_KEY: "sk-..."
     MODEL: "openai/gpt-4o-mini"
   ```
4. Click **Create** → **Start**.
5. Access via `http://<QNAP-IP>:8001`.

---

### 4. Render.com (free cloud hosting)

Render's free tier spins the app down after 15 minutes of inactivity (first request
after that takes ~30 s to wake up). Suitable for low-traffic use.

1. Push the repo to GitHub.
2. Go to [render.com](https://render.com) → **New Web Service** → connect your repo.
3. Set:
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn src.main:app --host 0.0.0.0 --port $PORT`
   - **Environment Variables:** add `OPENROUTER_API_KEY`
4. Add a **Persistent Disk** (under Advanced):
   - Mount path: `/app/data`
   - This keeps the SQLite database across deploys.
5. Deploy. Your public URL is `https://<your-app>.onrender.com`.

> **Feedback links on Render:** because the app is public, feedback URLs
> (`https://<your-app>.onrender.com/feedback.html?token=…`) work from anywhere —
> share them with students via message or show on screen.

---

### 5. Railway.app

Railway offers a small free credit monthly; persistent volumes are supported.

1. Push the repo to GitHub.
2. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub**.
3. Add environment variables in the **Variables** tab.
4. Add a **Volume** (mount at `/app/data`) to persist the database.
5. Railway auto-detects the Dockerfile and deploys.

---

### 6. VPS (DigitalOcean, Linode, Hetzner, etc.)

Best for full control. A $5/month Hetzner or DigitalOcean droplet is more than
enough for a small enrichment centre.

```bash
# On the VPS (Ubuntu 22.04 example)
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git

git clone <this-repo> /opt/care
cd /opt/care
cp .env.example .env
nano .env   # set OPENROUTER_API_KEY

docker compose up -d   # runs in background

# Optional: add a domain + HTTPS with Caddy (recommended)
sudo apt install -y caddy
```

**Caddy reverse proxy** (`/etc/caddy/Caddyfile`):
```
care.yourdomain.com {
    reverse_proxy localhost:8001
}
```
Caddy handles HTTPS automatically via Let's Encrypt. Replace
`care.yourdomain.com` with your actual domain (point an A record to the VPS IP).

---

## First-Time Setup Checklist

- [ ] Copy `.env.example` → `.env` and set your API key (or enter it in the Settings tab)
- [ ] Open the app → **Settings tab** → choose your AI provider and model
- [ ] Add your students in the **Students tab** (or import a CSV)
- [ ] Customise the AI system prompt in **Settings** if needed (e.g. change subject
      references from "coding" to your centre's focus)
- [ ] Try a test lesson: select a student → fill notes → Generate → Save

---

## Privacy & Safety

- **First names only** in AI prompts. No surnames, no passwords, no parent contact
  details are ever sent to the AI provider.
- The committed `data/schema.sql` seed uses **synthetic students only**
  (`parent@example.test` addresses, invented names).
- The live database (`data/class_assist.db`) is in `.gitignore` and is never
  committed.
- `GET /api/settings` never returns the stored API key — only a boolean
  `api_key_set: true/false`.
- Feedback tokens are one-time UUIDs. There is no login for students submitting
  feedback — possession of the link is the authentication.

---

## Project Structure

```
├── src/
│   ├── main.py          FastAPI routes (students, lessons, settings, feedback)
│   ├── database.py      SQLite helpers + migrations
│   ├── ai_service.py    AI call + retry logic; supports OpenAI-compatible + Anthropic native
│   ├── prompts.py       System prompt + output contract (REQUIRED_KEYS, validate_report)
│   └── static/
│       ├── index.html   Single-page app (4 tabs: Lesson · Students · Feedback · Settings)
│       ├── app.js       Vanilla JS — no build step
│       └── feedback.html Student-facing feedback form (star rating + comments)
├── data/
│   ├── schema.sql       Full schema + synthetic seed data
│   └── class_assist.db  Live database — gitignored
├── tests/
│   └── test_ai_contract.py  Contract tests (pytest) — run with: pytest -q
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── .env.example
```

---

## Running Tests

```bash
pytest -q
```

The contract tests mock `_call_model` so no real API key is needed.

---

## AI Provider Notes

| Provider | Endpoint type | Notes |
|---|---|---|
| OpenRouter | OpenAI-compatible | Recommended — one key, many models, free-tier models available |
| OpenAI | OpenAI-compatible | Direct access; billing per token |
| Google Gemini | OpenAI-compatible | Generous free tier via AI Studio key |
| Anthropic (Claude) | Native Anthropic API | CARE uses the `/v1/messages` format automatically when the Anthropic URL is detected |
| Groq | OpenAI-compatible | Extremely fast, free tier |
| Ollama | OpenAI-compatible | Runs locally; no key needed; no data leaves your machine |
| Custom | OpenAI-compatible | Any other endpoint that follows the OpenAI Chat Completions format |

> Direct Anthropic API (`api.anthropic.com`) uses a different request/response
> format. CARE detects this automatically and switches formats — no manual
> configuration needed.
