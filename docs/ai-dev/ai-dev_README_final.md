# AI Development Log

## AI Usage Overview

This project was developed as a 2-hour prototype for the B1 Builders Programme.

The goal was to build a simple full-stack web app that helps coding school instructors turn rough lesson notes into structured student updates. The app supports the workflow of a coding school such as Code Ninja, where students may be learning Scratch, Python, game projects, AI projects, portfolio work, or hands-on tech such as PC building.

The main user flow is:

```text
Select student → enter or speak rough notes → generate AI update → review/edit → save record
```

The AI generates:

- Parent-friendly lesson summary
- Skills practised
- Next lesson suggestion
- Internal instructor handover notes

The aim is not to replace the instructor. The instructor remains responsible for reviewing and editing the final output.

---

## AI Tools Used

### OpenRouter — `openai/gpt-4o-mini`

Used inside the app to transform rough lesson notes into structured lesson records.

I chose OpenRouter because it provides an OpenAI-compatible API and allowed fast testing with a low-cost model. The API call was first tested separately using `curl` before being connected to the application. This helped confirm that the API key and model ID were working before debugging the app itself.

### OpenRouter for pre-build planning

Before starting the actual build, I used OpenRouter to compare ideas and technical plans across several AI models, including Claude, GPT, DeepSeek, and Gemini.

I asked the models to help brainstorm possible B1 project ideas, check whether the Class_Assist idea was suitable, suggest the app structure, recommend tools, and identify risks.

I then compared the responses instead of following one model directly.

The comparison helped me make these design choices:

- Use a web app instead of Tkinter, because the project needs frontend and backend components.
- Use SQLite for the 2-hour prototype instead of Google Sheets, because Google Sheets integration would take longer due to permissions and setup.
- Keep Google Sheets as a future integration, since it matches the real school workflow.
- Use a simple frontend and backend instead of a heavy framework.
- Add voice input because instructors can speak rough notes faster after class.
- Keep real email sending out of the prototype, and focus on preview, review, and save.
- Use fake student data for the demo to avoid exposing private student information.

This planning step was useful because the different models gave different recommendations. I used the disagreement to make a more practical design choice.

For example, some models recommended Google Sheets because it matches the real workflow, while others warned that it could waste time during a 2-hour build. I decided to build with SQLite first, then document Google Sheets as the next version.

This helped me avoid scope creep and focus on completing the core user flow first.

### Claude Code

Used as the main coding assistant inside the development workflow.

Claude Code helped implement parts of the app such as:

- SQLite database helper functions
- OpenRouter API service
- FastAPI routes
- Frontend UI
- Voice input
- Testing and bug fixes

I did not allow Claude Code to directly build large parts of the app without review. I used a controlled workflow where Claude Code first explained the planned logic in pseudocode before I allowed it to write or change code.

### Claude / ChatGPT / Gemini / DeepSeek

Used during planning to compare project ideas, confirm the project fit, and decide on technical scope.

The different AI responses were compared to decide:

- Whether this was a strong B1 project idea
- Whether the app should be web-based instead of Tkinter
- Whether to use SQLite or Google Sheets for the prototype
- How to test the product
- How to explain the build process in the video

---

## Development Method

### Pseudocode-first workflow

Before letting Claude Code edit files, I asked it to explain the intended logic first.

The normal process was:

```text
1. I describe the task.
2. Claude Code gives pseudocode or a short implementation plan.
3. I review the plan.
4. If the plan is acceptable, I allow Claude Code to edit the file.
5. I review the diff before accepting.
6. I run tests or manual checks.
7. I commit only after checking the output.
```

This helped avoid blindly accepting generated code.

It also helped me catch problems earlier, because I could see whether Claude Code understood the data flow before it touched the actual source files.

---

## Contract-first approach

I used a contract-first method.

Instead of asking AI to build the whole app freely, I first defined the important structure:

- Database shape
- AI output fields
- Validation rules
- Expected routes
- Test cases

The key contract files were:

```text
data/schema.sql
src/prompts.py
tests/test_ai_contract.py
CLAUDE.md
```

Claude Code was then asked to implement one module at a time based on these contracts.

This made the work easier to review and reduced the chance of the AI changing unrelated files.

---

## Key Prompts Used

### Database module

```text
Implement src/database.py based on data/schema.sql.

Before writing code, give me pseudocode for the functions first.

Functions needed:
- init_db()
- get_students()
- get_student_history(student_id)
- save_entry(student_ids, entry)

Use stdlib sqlite3 only.
Do not touch other files.
Show the diff before applying changes.
```

### AI service module

```text
Implement src/ai_service.py.

Before writing code, explain the pseudocode for:
- reading OPENROUTER_API_KEY and MODEL from .env
- calling OpenRouter chat completions API
- parsing JSON output
- validating the result
- retrying once if the output is invalid

After I approve the plan, write the code.
Do not hardcode API keys.
Do not touch other files.
```

### Backend routes

```text
Implement src/main.py with the API routes described in CLAUDE.md.

Before coding, give me the route-level pseudocode first.

Routes:
- GET /api/students
- GET /api/students/{id}/history
- POST /api/generate
- POST /api/save

Mount the static frontend.
Do not change the database schema.
Show the diff before applying.
```

### Frontend

```text
Build the frontend using vanilla HTML and JavaScript.

Before writing code, describe the UI flow and event handling in pseudocode.

The UI should include:
- student selection
- worksheet input
- rough notes textarea
- voice input button
- generate button
- editable output sections
- save button
- copy summary button
- history display

Keep the UI simple and suitable for a 2-hour prototype.
```

---

## Important Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| App type | Web app | B1 requires frontend and backend components. |
| Frontend | Vanilla HTML, CSS, JavaScript | Fast to build, no heavy setup, good for a 2-hour prototype. |
| Backend | FastAPI | Simple JSON API, easy to test, good for a small full-stack app. |
| Database | SQLite | Google Sheets integration would take too long because of API setup, permissions, and testing. |
| Future database path | Google Sheets sync | The real workflow already uses Google Sheets, so this is a good future upgrade. |
| AI provider | OpenRouter with `openai/gpt-4o-mini` | Low cost, fast response, easy OpenAI-compatible API. |
| Voice input | Browser Web Speech API | Useful for instructors after class, and does not require audio upload or transcription backend. |
| Email sending | Not included in prototype | Real email sending can create safety and setup issues. The prototype focuses on preview, copy, and save. |
| Student data | Fake / synthetic data | Real students are minors. The demo should not expose private data. |
| Scratch credentials | Not stored | Usernames may be kept for context, but passwords should never enter the app or AI prompt. |
| AI review | Instructor must review before saving | AI should assist, not make final judgement. |

---

## Why SQLite Instead of Google Sheets for This Prototype

The real workflow uses Google Sheets, and a future version should connect to that system.

However, this was a 2-hour prototype. Connecting to Google Sheets would require extra setup:

- Google API permissions
- OAuth or Apps Script setup
- Testing write access
- Handling sheet format problems
- Avoiding accidental changes to real student data

For this prototype, I chose SQLite so the core workflow could be completed first:

```text
rough notes → AI generation → review/edit → save → view history
```

This was a deliberate scope decision.

A working SQLite prototype is better than an unfinished Google Sheets integration.

---

## AI Safety and Privacy Rules

Because the app is designed for student records, I added several safety rules:

- Use fake student data in the public demo.
- Do not send passwords to the AI model.
- Do not include unnecessary personal data in prompts.
- Do not allow the AI to invent achievements, certifications, or progress.
- Parent-facing summaries should be professional and encouraging.
- Harsh instructor notes should be rewritten in a neutral and constructive tone.
- Instructor must review and edit before saving.

---

## Testing Approach

### Automated tests

I used tests to check the structure of the AI output.

The tests check that the AI result includes the required fields:

- `lesson_summary`
- `skills_practised`
- `next_lesson`
- `internal_notes`

The tests also check that invalid or incomplete AI output is rejected.

Mocking was used for the AI call so tests could run without making real API requests.

---

### Manual AI testing

I tested the AI with different types of notes.

#### Normal note

```text
Aiden worked on Python ball drop. Got the paddle moving and ball bouncing off walls. Still needs help with paddle collision.
```

Expected result:

- Parent summary mentions the actual project.
- Skills include Python, game logic, movement, collision, or debugging.
- Next lesson suggests continuing paddle collision.

#### Messy note

```text
did snake today stuck loop distracted but ok
```

Expected result:

- Output is still readable.
- AI does not invent extra details.
- Internal note mentions where to continue.

#### Harsh note

```text
Student was terrible today and kept getting distracted.
```

Expected result:

- Parent summary becomes neutral and professional.
- Internal notes can mention focus issues more directly.
- No insulting language is sent to parents.

#### Very short note

```text
good progress today
```

Expected result:

- AI should produce a cautious summary.
- It should not invent a project or skill that was not provided.

---

## User Testing

The main user test was the 60-second instructor flow:

```text
1. Select student
2. Type or speak rough notes
3. Click Generate
4. Review output
5. Edit if needed
6. Save
7. Check history
```

Success criteria:

- Instructor can complete one student update quickly.
- Parent summary is clear.
- Internal handover is useful for another instructor.
- Saved record appears in history.
- App does not crash on empty or messy input.
- Voice input adds text to the notes box.

---

## What Worked

The strongest part of the build was the controlled AI workflow.

Asking Claude Code for pseudocode before code helped me check its understanding before allowing file changes. This made the development process safer and easier to explain.

The contract-first approach also helped. By defining the schema, AI output format, and tests first, Claude Code had clearer boundaries.

The SQLite choice also worked well for the time limit. It allowed the prototype to be completed without getting stuck on Google Sheets setup.

---

## What Changed During Development

At first, the idea was more general: rough notes to parent email.

After reviewing the real lesson tracking sheet, the app became more specific. The real pain was not only writing parent updates, but also filling in structured fields such as:

- Skills practised
- Next lesson
- Internal notes

So the AI output was changed to better match the actual workflow.

I also removed fields that were not part of the existing workflow, such as difficulty rating and engagement rating. These could be added later, but they were not needed for the first prototype.

---

## What I Would Improve Next

Given more time, I would add:

- Google Sheets integration
- Search across past student updates
- Better student profile pages
- Progress report generation from lesson history
- Testimonial generation
- Telegram or mobile input
- Better prompt examples using anonymised real lesson summaries
- User login for different instructors
- Export to email or PDF

---

## Notes on AI Responsibility

This project uses AI to reduce repetitive admin work, not to replace instructor judgement.

The instructor remains in control of the final record.

The AI helps with structure, wording, and consistency, but the human teacher checks whether the output is accurate and appropriate before saving it.

---

## Extra

Full AI chat logs and planning notes should be stored in:

```text
Extra/chat_logs/
```

Before committing or submitting, all logs should be checked for:

- API keys
- real student names
- parent emails
- student passwords
- private school data
- any sensitive information

These should be removed or anonymised before submission.
