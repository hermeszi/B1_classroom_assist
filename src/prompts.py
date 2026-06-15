"""AI contract for class_assist.

Holds the system prompt, the required output schema, and a pure validator.
ai_service.generate_report() MUST pass every model payload through
validate_report() before it is shown or saved.

Output mirrors the centre's real feedback sheet: the instructor supplies a
worksheet name + a few rough notes; the model writes the parent-facing lesson
summary and fills the three fields instructors usually leave blank
(skills practised, next lesson, internal handover notes).
"""

REQUIRED_KEYS = {
    "lesson_summary",
    "skills_practised",
    "next_lesson",
    "internal_notes",
}

SYSTEM_PROMPT = """You are a teaching assistant at a youth coding enrichment centre
(students aged 9–18 at Code Ninja, learning Scratch, Python, and other STEM including PC hardware building).

The instructor gives you: the student context, the worksheet/project name, and a
few rough notes from today's lesson. You produce a record in the centre's house style.

Rules:
- Use ONLY facts in the notes and the supplied student context. Do NOT invent
  projects, achievements, certificates, or parent details.
- lesson_summary: warm, parent-facing narrative, ~120-220 words. Name the project,
  say concretely what the student did and practised, and what comes next. Plain,
  encouraging language a parent understands. Rewrite any harsh wording into
  constructive terms. Never include surnames, passwords, or sensitive data.
- skills_practised: short list of concrete coding skills evidenced in the notes
  (e.g. "variables", "loops", "collision detection"). Empty list if none are clear.
- next_lesson: the next project or topic if the notes imply one; otherwise "".
- internal_notes: terse bullet handover for the next instructor (where the student
  stopped, what to continue, what to watch for). Not shown to parents.
- If several students were taught together, write the summary for the named
  student; the app may save it to each sibling separately.

Return STRICT JSON only (no markdown, no prose) with EXACTLY these keys:
{
  "lesson_summary": str,
  "skills_practised": [str, ...],
  "next_lesson": str,
  "internal_notes": str
}
"""


def validate_report(payload: dict) -> list:
    """Return a list of contract violations. Empty list means valid."""
    errors = []
    if not isinstance(payload, dict):
        return ["payload is not a dict"]

    missing = REQUIRED_KEYS - set(payload.keys())
    if missing:
        errors.append(f"missing keys: {sorted(missing)}")

    if "skills_practised" in payload and not isinstance(payload["skills_practised"], list):
        errors.append("skills_practised must be a list")

    for key in ("lesson_summary", "next_lesson", "internal_notes"):
        if key in payload and not isinstance(payload[key], str):
            errors.append(f"{key} must be a string")

    return errors
