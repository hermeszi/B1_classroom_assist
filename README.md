# CARE — Classroom AI for Reports & Engagement

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> A self-hosted web app that turns an instructor's rough lesson notes into polished
> parent-facing summaries, filled-in progress records, and student feedback links —
> powered by any OpenAI-compatible AI provider.

---

## The Problem

In schools and enrichment centres, instructors often have to write student updates after lessons: a parent-facing summary, skills practised, the next lesson plan, and internal handover notes for the next instructor....
It is difficult to write meaningful updates within reasonable hours.

**CARE** allows educators to enter a worksheet name and a few rough notes → the AI writes the full summary in the centre's house style and fills every field that instructors normally skip. 
Each write-up drops from ~5–8 minutes to roughly a minute of review and editing.

---

## Demo
[>>> CARE Demo online <<<](https://b1classroomassist-production.up.railway.app/)

[![Watch the CARE Overview Video](https://youtube.com)](https://youtu.be)

<img width="1211" height="1008" alt="image" src="https://github.com/user-attachments/assets/bde322d5-552a-40c0-b04a-d58753c2d37e" />



---

## Features

| Feature | Details |
|---|---|
| **AI report generation** | lesson summary · skills · next lesson · internal notes |
| **Multi-student lesson** | tick any number of students; one AI call generates a shared report, saved individually |
| **Student feedback links** | one-time URLs sent to students for star rating + comments |
| **Feedback in history** | student responses visible in both the Feedback tab and the per-student lesson history in the Students tab |
| **Multi-provider AI** | OpenRouter · OpenAI · Google Gemini · Anthropic (Claude) · Groq · Ollama · Custom |
| **Voice dictation** | mic button via Web Speech API |
| **Student records** | add · edit · deactivate · re-activate · import/export CSV/TSV/JSON |
| **Lesson history & editing** | per-student expandable history in the Students tab; inline edit all fields; archive/unarchive entries |
| **System prompt presets** | built-in presets for General enrichment, Primary (P1–P6), and Secondary/tuition (Sec 1–5) — Singapore context |
| **Prompt lock** | system prompt is locked by default; must explicitly unlock to edit, preventing accidental changes |
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
[`src/schema.sql`](src/schema.sql) and is applied automatically on first run.

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
- **`lesson_entries.archived`** soft-hides old or irrelevant lesson entries. Archived
  entries are excluded from the default view; toggle "Show archived" per student card
  in the Students tab.
- **`student_feedback.token`** is a one-time UUID hex string. Generating a second
  link for the same lesson entry creates a new row (multiple links can exist; the
  history view shows the most recently created one).
- **`students.active`** soft-deletes a student: they disappear from the lesson picker
  but all historical records are preserved. Toggle "Show deactivated students" in the
  Students tab to find and reactivate them.
- **`settings`** table overrides environment variables at runtime — anything you save
  through the Settings tab takes priority over `.env`. If `system_prompt` is not set
  in the DB, the built-in default in `src/prompts.py` is used automatically.

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
3. Add environment variables in the **Variables** tab:
   - `OPENROUTER_API_KEY` = your key (or set it later via the Settings tab)
   - `MODEL` = e.g. `openai/gpt-4o-mini` (optional — can be set in the app)
4. Add a **Volume** and mount it at `/app/data` to persist the SQLite database across deploys.
   The schema file (`src/schema.sql`) lives inside the app image and is never affected by the volume mount.
5. Railway auto-detects the Dockerfile and deploys.

> **Why `/app/data` is safe:** `schema.sql` was moved into `src/` in this project, so only the live
> database file (`class_assist.db`) is ever stored in `data/`. Mounting a volume there cannot
> hide or overwrite any application files.

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
- [ ] Customise the AI system prompt in **Settings** if needed — pick a preset
      (General enrichment / Primary / Secondary) or write your own; unlock the textarea
      first by ticking the checkbox
- [ ] Try a test lesson: select a student → fill notes → Generate → Save

---

## Managing Your Database

Everything CARE stores — students, lessons, feedback, settings — lives in a single
file: `data/class_assist.db`. Understanding this file is the key to backups,
migrations, and recovery.

### Where the file lives

| Deployment | Path on disk |
|---|---|
| Local Python | `data/class_assist.db` inside the project folder |
| Docker (local) | `data/class_assist.db` on your host machine (mounted into the container) |
| Synology / QNAP NAS | `data/class_assist.db` inside the project folder you copied to the NAS |
| Railway | Inside the Railway persistent volume at `/app/data/class_assist.db` |
| VPS | `data/class_assist.db` inside `/opt/care` (or wherever you cloned the repo) |

### Backing up

SQLite is a single file — backing up means copying that file:

```bash
# Simple backup with a date stamp
cp data/class_assist.db data/class_assist.db.bak-$(date +%Y%m%d)

# Or copy to a safe location
cp data/class_assist.db ~/Desktop/care-backup-$(date +%Y%m%d).db
```

> **When running Docker:** the file is on your **host machine** at `./data/class_assist.db`,
> not inside the container. Copy it from there — the container does not need to be stopped.

For Railway or other cloud deployments, download the file first:
```bash
# Railway CLI (if installed)
railway run cp /app/data/class_assist.db /tmp/backup.db
```
Or use the platform's volume download feature.

### Restoring or moving to a new server

Stop the app, replace the `.db` file, restart:

```bash
# Local / VPS
docker compose down
cp /path/to/backup.db data/class_assist.db
docker compose up -d
```

The app runs migrations on startup — your schema is always kept up to date automatically.

### Starting fresh

Delete (or rename) the database file and restart the app — it will recreate the
database from `src/schema.sql` and load the synthetic seed students:

```bash
rm data/class_assist.db   # or: mv data/class_assist.db data/class_assist.db.old
docker compose restart
```

### How Docker volumes work (plain English)

When you run CARE with Docker, the `docker-compose.yml` contains:

```yaml
volumes:
  - ./data:/app/data
```

This means: **"link the `data/` folder on your computer to `/app/data` inside the container."**
The database file your computer can see at `./data/class_assist.db` is the exact same file the
app is reading and writing. They are not two copies — it is one file, shared.

Consequences:
- Stopping or deleting the container does **not** delete your data.
- Rebuilding the image (`docker compose up --build`) does **not** delete your data.
- If you delete `./data/class_assist.db` on your computer, the app loses all its data.
- Moving the project folder to another machine: bring the `data/` folder with it.

> **Cloud platforms (Railway, Render):** instead of a local folder, the platform provides a
> "persistent volume" — a network disk that stays attached to your app. It works the same
> way as the folder link above. Without it, the database is stored inside the container and
> wiped every time the app redeploys.

---

## Privacy & Safety

- **First names only** in AI prompts. No surnames, no passwords, no parent contact
  details are ever sent to the AI provider.
- The schema file (`src/schema.sql`) contains **synthetic students only**
  (`parent@example.test` addresses, invented names) — safe to commit and share.
- The live database (`data/class_assist.db`) is in `.gitignore` and is never
  committed — it stays on your server only.
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
│   ├── prompts.py       Default system prompt + output contract (REQUIRED_KEYS, validate_report)
│   ├── schema.sql       Full DB schema + synthetic seed — lives in src/ so volume mounts never hide it
│   └── static/
│       ├── index.html   Single-page app (4 tabs: Lesson · Students · Feedback · Settings)
│       ├── app.js       Vanilla JS — no build step; PROMPT_PRESETS for SG context
│       ├── feedback.html Student-facing feedback form (star rating + comments)
│       └── biosite.png  Developer contact QR code (shown in About popover)
├── data/
│   ├── .gitkeep         Keeps the data/ directory tracked by git (db file is gitignored)
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

---

## About

Built by **Ming** — [bio.site/mingde](https://bio.site/mingde)

CARE was started as a 42 SG B1 Builders submission and developed entirely using
[Claude Code](https://claude.ai/code) (Claude Sonnet 4.6 via the Claude Code CLI).
Every session is logged in [CLAUDE.md](CLAUDE.md).

Feedback on the app itself: use the **Survey** button inside CARE, or open the
[feedback form](https://docs.google.com/forms/d/e/1FAIpQLSd1yV1G2-gT59rD1IjmfRQ7cdvb_7PfO30cAzYJBsOO1G9jmQ/viewform?usp=header) directly.
