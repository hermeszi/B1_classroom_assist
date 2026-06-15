import json
import os
import re

import httpx
from dotenv import load_dotenv

from src.prompts import SYSTEM_PROMPT, validate_report

load_dotenv()
_API_KEY = os.getenv("OPENROUTER_API_KEY")
_MODEL = os.getenv("MODEL", "openai/gpt-4o-mini")
_URL = "https://openrouter.ai/api/v1/chat/completions"


def _call_model(system: str, user: str) -> str:
    response = httpx.post(
        _URL,
        headers={"Authorization": f"Bearer {_API_KEY}"},
        json={
            "model": _MODEL,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "response_format": {"type": "json_object"},
        },
        timeout=30,
    )
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"]


def _strip_fences(text: str) -> str:
    m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    return m.group(1) if m else text


def _build_user_msg(student: dict, worksheet: str, raw_notes: str) -> str:
    parts = [
        f"Student: {student['name']}, age {student.get('age', 'unknown')}, level {student.get('level', 'unknown')}",
    ]
    notes = student.get("profile_notes")
    if notes:
        parts.append(f"Profile: {notes}")
    parts += [
        f"Worksheet: {worksheet}",
        f"Notes: {raw_notes}",
    ]
    return "\n".join(parts)


def generate_report(student: dict, worksheet: str, raw_notes: str) -> dict:
    user_msg = _build_user_msg(student, worksheet, raw_notes)

    raw = _call_model(SYSTEM_PROMPT, user_msg)
    payload = json.loads(_strip_fences(raw))

    errors = validate_report(payload)
    if errors:
        corrective = (
            f"Your previous reply had these violations: {errors}\n"
            f"Fix them and reply with valid JSON only.\n\n"
            f"Original request:\n{user_msg}"
        )
        raw2 = _call_model(SYSTEM_PROMPT, corrective)
        payload = json.loads(_strip_fences(raw2))
        errors2 = validate_report(payload)
        if errors2:
            raise ValueError(f"Model still invalid after retry: {errors2}")

    return payload
