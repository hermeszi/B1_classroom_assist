from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from src import database, ai_service

import os

_STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")


@asynccontextmanager
async def lifespan(app: FastAPI):
    database.init_db()
    yield


app = FastAPI(lifespan=lifespan)


# ── request bodies ────────────────────────────────────────────────────────────

class AddStudentRequest(BaseModel):
    name: str
    age: int | None = None
    level: str | None = None
    scratch_user: str | None = None
    parent_email: str | None = None
    profile_notes: str | None = None


class GenerateRequest(BaseModel):
    student_id: int
    worksheet: str
    raw_notes: str


class SaveRequest(BaseModel):
    student_ids: list[int]
    worksheet: str
    raw_notes: str
    lesson_summary: str
    skills_practised: list[str]
    next_lesson: str
    internal_notes: str
    lesson_date: str = ""


# ── API routes ────────────────────────────────────────────────────────────────

@app.get("/api/students")
def get_students():
    return database.get_students()


@app.post("/api/students", status_code=201)
def add_student(req: AddStudentRequest):
    if not req.name.strip():
        raise HTTPException(status_code=422, detail="name is required")
    new_id = database.add_student(
        req.name.strip(), req.age, req.level, req.scratch_user,
        req.parent_email, req.profile_notes,
    )
    students = {s["id"]: s for s in database.get_students()}
    return students[new_id]


@app.get("/api/students/{student_id}/history")
def get_student_history(student_id: int):
    students = {s["id"]: s for s in database.get_students()}
    if student_id not in students:
        raise HTTPException(status_code=404, detail=f"Student {student_id} not found")
    return database.get_student_history(student_id)


@app.post("/api/generate")
def generate(req: GenerateRequest):
    students = {s["id"]: s for s in database.get_students()}
    if req.student_id not in students:
        raise HTTPException(status_code=404, detail=f"Student {req.student_id} not found")
    student = students[req.student_id]
    try:
        report = ai_service.generate_report(student, req.worksheet, req.raw_notes)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
    return report


@app.post("/api/save", status_code=201)
def save(req: SaveRequest):
    if not req.student_ids:
        raise HTTPException(status_code=422, detail="student_ids must not be empty")
    known_ids = {s["id"] for s in database.get_students()}
    unknown = [sid for sid in req.student_ids if sid not in known_ids]
    if unknown:
        raise HTTPException(status_code=404, detail=f"Unknown student ids: {unknown}")
    database.save_entry(req.student_ids, req.model_dump())
    return {"saved": len(req.student_ids)}


# ── static files (last, so API routes take priority) ─────────────────────────

app.mount("/", StaticFiles(directory=_STATIC_DIR, html=True), name="static")
