import csv
import io
import json as _json
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
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
    login: str | None = None
    parent_email: str | None = None
    parent_phone: str | None = None
    student_email: str | None = None
    student_phone: str | None = None
    profile_notes: str | None = None


class UpdateStudentRequest(BaseModel):
    name: str | None = None
    age: int | None = None
    level: str | None = None
    login: str | None = None
    parent_email: str | None = None
    parent_phone: str | None = None
    student_email: str | None = None
    student_phone: str | None = None
    profile_notes: str | None = None
    active: int | None = None


class GenerateRequest(BaseModel):
    student_id: int
    worksheet: str
    raw_notes: str
    title: str = ""
    general_lesson: str = ""


class SaveRequest(BaseModel):
    student_ids: list[int]
    title: str = ""
    general_lesson: str = ""
    worksheet: str
    raw_notes: str
    lesson_summary: str
    skills_practised: list[str]
    next_lesson: str
    internal_notes: str
    lesson_date: str = ""


class SettingsRequest(BaseModel):
    api_key: str | None = None
    api_url: str | None = None
    model: str | None = None
    system_prompt: str | None = None


class UpdateLessonEntryRequest(BaseModel):
    lesson_date: str | None = None
    title: str | None = None
    general_lesson: str | None = None
    worksheet: str | None = None
    raw_notes: str | None = None
    lesson_summary: str | None = None
    skills_practised: str | None = None
    next_lesson: str | None = None
    internal_notes: str | None = None
    archived: int | None = None


class FeedbackRequest(BaseModel):
    rating: int | None = None
    comments: str = ""


# ── students ──────────────────────────────────────────────────────────────────

@app.get("/api/students")
def get_students(active_only: bool = Query(False)):
    return database.get_students(active_only=active_only)


@app.post("/api/students", status_code=201)
def add_student(req: AddStudentRequest):
    if not req.name.strip():
        raise HTTPException(status_code=422, detail="name is required")
    new_id = database.add_student(
        req.name.strip(), req.age, req.level, req.login,
        req.parent_email, req.profile_notes,
        req.parent_phone, req.student_email, req.student_phone,
    )
    students = {s["id"]: s for s in database.get_students()}
    return students[new_id]


# NOTE: /export and /import must be defined before /{student_id} routes
@app.get("/api/students/export")
def export_all_students(format: str = Query("json")):
    data = database.export_students_data()
    return _build_export_response(data, format, "students")


@app.post("/api/students/import")
async def import_students(file: UploadFile = File(...)):
    content = (await file.read()).decode("utf-8-sig")
    delimiter = "\t" if (file.filename or "").endswith(".tsv") else ","
    reader = csv.DictReader(io.StringIO(content), delimiter=delimiter)
    rows = [dict(r) for r in reader]
    count = database.import_students_data(rows)
    return {"imported": count}


@app.put("/api/students/{student_id}")
def update_student(student_id: int, req: UpdateStudentRequest):
    students = {s["id"]: s for s in database.get_students()}
    if student_id not in students:
        raise HTTPException(status_code=404, detail=f"Student {student_id} not found")
    database.update_student(student_id, req.model_dump(exclude_unset=True))
    updated = {s["id"]: s for s in database.get_students()}
    return updated[student_id]


@app.get("/api/students/{student_id}/export")
def export_student(student_id: int, format: str = Query("json")):
    data = database.export_students_data([student_id])
    if not data:
        raise HTTPException(status_code=404, detail="Student not found")
    name = data[0]["name"].lower().replace(" ", "_")
    return _build_export_response(data, format, f"student_{name}")


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
        report = ai_service.generate_report(student, req.worksheet, req.raw_notes, req.title, req.general_lesson)
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
    entry_ids = database.save_entry(req.student_ids, req.model_dump())
    return {"saved": len(req.student_ids), "entry_ids": entry_ids}


# ── settings ──────────────────────────────────────────────────────────────────

@app.get("/api/settings")
def get_settings():
    s = database.get_all_settings()
    api_key_set = bool(s.get("api_key"))
    s.pop("api_key", None)  # never expose the stored key
    s["api_key_set"] = api_key_set
    return s


@app.put("/api/settings")
def save_settings(req: SettingsRequest):
    if req.api_key is not None:
        database.set_setting("api_key", req.api_key)
    if req.api_url is not None:
        database.set_setting("api_url", req.api_url)
    if req.model is not None:
        database.set_setting("model", req.model)
    if req.system_prompt is not None:
        database.set_setting("system_prompt", req.system_prompt)
    return {"saved": True}


# ── feedback ──────────────────────────────────────────────────────────────────

@app.put("/api/lessons/{entry_id}")
def update_lesson_entry(entry_id: int, req: UpdateLessonEntryRequest):
    entry = database.get_lesson_entry(entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Lesson entry not found")
    database.update_lesson_entry(entry_id, req.model_dump(exclude_unset=True))
    return {"updated": True}


@app.post("/api/lessons/{entry_id}/feedback-link", status_code=201)
def create_feedback_link(entry_id: int):
    entry = database.get_lesson_entry(entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Lesson entry not found")
    token = database.create_feedback_token(entry_id, entry["student_id"])
    return {"token": token}


@app.get("/api/feedback/{token}")
def get_feedback_info(token: str):
    fb = database.get_feedback_by_token(token)
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback link not found")
    return {
        "student_name": fb["student_name"],
        "worksheet": fb["worksheet"],
        "lesson_date": fb["lesson_date"],
        "already_submitted": fb["submitted_at"] is not None,
    }


@app.post("/api/feedback/{token}")
def submit_feedback(token: str, req: FeedbackRequest):
    fb = database.get_feedback_by_token(token)
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback link not found")
    if fb["submitted_at"]:
        raise HTTPException(status_code=409, detail="Feedback already submitted")
    database.submit_feedback(token, req.rating, req.comments)
    return {"submitted": True}


# ── helpers ───────────────────────────────────────────────────────────────────

def _build_export_response(data: list[dict], fmt: str, filename: str) -> StreamingResponse:
    if fmt == "json":
        content = _json.dumps(data, indent=2)
        media_type = "application/json"
        ext = "json"
    elif fmt in ("csv", "tsv"):
        delim = "\t" if fmt == "tsv" else ","
        buf = io.StringIO()
        if data:
            writer = csv.DictWriter(buf, fieldnames=list(data[0].keys()), delimiter=delim)
            writer.writeheader()
            writer.writerows(data)
        content = buf.getvalue()
        media_type = "text/tab-separated-values" if fmt == "tsv" else "text/csv"
        ext = fmt
    else:
        raise HTTPException(status_code=400, detail=f"Unknown format: {fmt}")

    return StreamingResponse(
        io.BytesIO(content.encode()),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}.{ext}"'},
    )


# ── static files (last so API routes take priority) ───────────────────────────

app.mount("/", StaticFiles(directory=_STATIC_DIR, html=True), name="static")
