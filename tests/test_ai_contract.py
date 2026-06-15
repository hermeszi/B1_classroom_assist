"""Contract tests for class_assist.

Validator tests run immediately (pure functions, no network).
The end-to-end test activates once src/ai_service.py exists; it mocks the
model call so no real API request is made.

Run:  pytest -q
"""
import pytest
from src.prompts import validate_report

VALID = {
    "lesson_summary": "Aiden built a Dino Run game today and practised collision detection.",
    "skills_practised": ["loops", "collision detection"],
    "next_lesson": "2.5D movement",
    "internal_notes": "- Continue with depth effect\n- Watch focus after ~20 min",
}


def test_valid_payload_passes():
    assert validate_report(VALID) == []


def test_missing_key_fails():
    bad = {k: v for k, v in VALID.items() if k != "lesson_summary"}
    assert any("missing" in e for e in validate_report(bad))


def test_skills_must_be_list():
    assert any("skills_practised" in e for e in validate_report({**VALID, "skills_practised": "loops"}))


def test_string_fields_must_be_strings():
    assert any("lesson_summary" in e for e in validate_report({**VALID, "lesson_summary": 123}))


def test_empty_strings_allowed_for_optional_text():
    # next_lesson / internal_notes may be empty when the notes don't imply them.
    assert validate_report({**VALID, "next_lesson": "", "internal_notes": ""}) == []


def test_generate_report_returns_valid_contract(monkeypatch):
    """ai_service.generate_report() must produce a payload that passes the contract.

    Convention (see CLAUDE.md): ai_service exposes _call_model(system, user) -> str,
    patched here so no real API call is made.
    """
    ai_service = pytest.importorskip("src.ai_service")

    fake_json = (
        '{"lesson_summary":"ok","skills_practised":["loops"],'
        '"next_lesson":"","internal_notes":"- x"}'
    )
    monkeypatch.setattr(ai_service, "_call_model", lambda system, user: fake_json, raising=False)

    student = {"name": "Aiden", "age": 11, "level": "Scratch L2"}
    out = ai_service.generate_report(student, worksheet="Dino Run",
                                     raw_notes="added hit detection, game over works")
    assert validate_report(out) == []
