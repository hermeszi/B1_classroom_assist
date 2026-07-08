import json
import os
import re

import httpx
from dotenv import load_dotenv

from src.prompts import SYSTEM_PROMPT, validate_report

load_dotenv()
_API_KEY = os.getenv("OPENROUTER_API_KEY")
_MODEL = os.getenv("MODEL", "openai/gpt-4o-mini")
_DEFAULT_URL = "https://openrouter.ai/api/v1/chat/completions"


def _call_model(system: str, user: str) -> str:
    """POST to the configured AI endpoint. Reads settings from DB at call time."""
    try:
        from src import database
        api_key = database.get_setting("api_key") or _API_KEY or ""
        model   = database.get_setting("model") or _MODEL
        api_url = database.get_setting("api_url") or _DEFAULT_URL
    except Exception:
        api_key = _API_KEY or ""
        model   = _MODEL
        api_url = _DEFAULT_URL

    if not api_key and "localhost" not in api_url and "127.0.0.1" not in api_url:
        raise ValueError(
            "No API key configured. Go to the ⚙ Settings tab and enter your API key."
        )

    is_anthropic = "api.anthropic.com" in api_url

    try:
        if is_anthropic:
            response = httpx.post(
                api_url,
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": model,
                    "max_tokens": 4096,
                    "system": system,
                    "messages": [{"role": "user", "content": user}],
                },
                timeout=45,
            )
        else:
            response = httpx.post(
                api_url,
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user",   "content": user},
                    ],
                    "response_format": {"type": "json_object"},
                },
                timeout=45,
            )
        response.raise_for_status()
    except httpx.HTTPStatusError as e:
        status = e.response.status_code
        if status == 401:
            raise ValueError(
                "Invalid API key — the provider rejected it. "
                "Go to ⚙ Settings and check your API key."
            )
        if status == 403:
            raise ValueError(
                "Access denied. Your API key may not have permission to use "
                f"'{model}'. Check your account or try a different model."
            )
        if status == 404:
            raise ValueError(
                f"Model '{model}' not found. "
                "Go to ⚙ Settings and check the model name."
            )
        if status == 429:
            raise ValueError(
                "Rate limit reached — too many requests. "
                "Wait a moment, then try again."
            )
        if status >= 500:
            raise ValueError(
                f"The AI service returned a server error ({status}). "
                "Please try again in a moment."
            )
        try:
            detail = e.response.json().get("error", {}).get("message", "")
        except Exception:
            detail = e.response.text[:200]
        raise ValueError(f"API error {status}: {detail or 'unknown error'}")
    except httpx.ConnectError:
        raise ValueError(
            "Could not reach the AI service. "
            "Check your internet connection and the API URL in ⚙ Settings."
        )
    except httpx.TimeoutException:
        raise ValueError(
            "The AI service took too long to respond (45 s). "
            "Try again, or switch to a faster model in ⚙ Settings."
        )

    try:
        if is_anthropic:
            return response.json()["content"][0]["text"]
        return response.json()["choices"][0]["message"]["content"]
    except (KeyError, IndexError):
        raise ValueError(
            "Unexpected response format from the AI provider. "
            "The model may not support JSON output mode — try a different model."
        )


def _strip_fences(text: str) -> str:
    m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    return m.group(1) if m else text


def _build_user_msg(
    student: dict,
    worksheet: str,
    raw_notes: str,
    title: str = "",
    general_lesson: str = "",
) -> str:
    parts = [
        f"Student: {student['name']}, age {student.get('age', 'unknown')}, level {student.get('level', 'unknown')}",
    ]
    if student.get("profile_notes"):
        parts.append(f"Profile: {student['profile_notes']}")

    try:
        from src import database
        feedback_rows = database.get_student_feedback(student.get("id", -1))
        if feedback_rows:
            fb_parts = []
            for fb in feedback_rows:
                rating_str = f"{fb['rating']}/5" if fb.get("rating") else "unrated"
                comment = (fb.get("comments") or "").strip()
                if comment:
                    fb_parts.append(f"({rating_str}) {comment}")
            if fb_parts:
                parts.append("Recent student feedback: " + " | ".join(fb_parts))
    except Exception:
        pass

    if title:
        parts.append(f"Lesson topic: {title}")
    if general_lesson:
        parts.append(f"General lesson content: {general_lesson}")

    parts += [
        f"Worksheet: {worksheet}",
        f"Notes: {raw_notes}",
    ]
    return "\n".join(parts)


def generate_report(
    student: dict,
    worksheet: str,
    raw_notes: str,
    title: str = "",
    general_lesson: str = "",
) -> dict:
    try:
        from src import database
        system = database.get_setting("system_prompt") or SYSTEM_PROMPT
    except Exception:
        system = SYSTEM_PROMPT

    user_msg = _build_user_msg(student, worksheet, raw_notes, title, general_lesson)

    raw = _call_model(system, user_msg)
    try:
        payload = json.loads(_strip_fences(raw))
    except json.JSONDecodeError:
        raise ValueError(
            "The AI returned an unreadable response. "
            "Try again — if this repeats, switch to a different model in ⚙ Settings."
        )

    errors = validate_report(payload)
    if errors:
        corrective = (
            f"Your previous reply had these violations: {errors}\n"
            f"Fix them and reply with valid JSON only.\n\n"
            f"Original request:\n{user_msg}"
        )
        raw2 = _call_model(system, corrective)
        try:
            payload = json.loads(_strip_fences(raw2))
        except json.JSONDecodeError:
            raise ValueError("AI returned invalid JSON on retry.")
        errors2 = validate_report(payload)
        if errors2:
            raise ValueError(f"Model still invalid after retry: {errors2}")

    return payload
