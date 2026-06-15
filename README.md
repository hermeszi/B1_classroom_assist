# class_assist

## Overview
### Problem
- Who is affected? Instructors and parents at Code Ninja, a youth coding centre
  (ages 9–18, teaching Python, Scratch, and other STEM including PC hardware building).
- What is the issue? Per-student post-class write-ups (parent update, handover,
  progress record) cost 5-8 min each and add up across a class.

### Outcome
- A web app: rough notes -> AI -> parent email + handover + skills + difficulty +
  engagement + next-project, saved per student. Target: under ~1 min/student.

---
## Demo
- (screenshots / GIF / <=5 min video here)

---
## Technology Stack
### Frontend
- HTML, vanilla JS (Web Speech API for optional voice).
### Backend
- FastAPI, SQLite, Anthropic API (claude-haiku-4-5).

---
## Installation
1. `cp .env.example .env` and add your XXX_API_KEY
2. `docker compose up --build`  (or `pip install -r requirements.txt` + `uvicorn src.main:app --reload`)
3. Open http://localhost:8001

## Usage
Select a student, type/dictate notes, click Generate, review/edit, Save, Copy Email.

## Project Structure
- src/ application code   data/ schema + seed   tests/ contract tests
- docs/ai-dev AI usage     Extra/ AI chat logs
