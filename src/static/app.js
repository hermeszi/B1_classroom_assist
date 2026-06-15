const sel         = document.getElementById("student-select");
const worksheet   = document.getElementById("worksheet");
const lessonDate  = document.getElementById("lesson-date");
const notes       = document.getElementById("notes");
const histPanel   = document.getElementById("history-panel");
const histHeading = document.getElementById("history-heading");
const histList    = document.getElementById("history-list");
const btnGen    = document.getElementById("btn-generate");
const btnSave   = document.getElementById("btn-save");
const btnCopy   = document.getElementById("btn-copy");
const loading   = document.getElementById("loading");
const errorMsg  = document.getElementById("error-msg");
const results   = document.getElementById("results");
const saveConf  = document.getElementById("save-confirm");
const fSummary  = document.getElementById("field-lesson-summary");
const fSkills   = document.getElementById("field-skills");
const fNext     = document.getElementById("field-next-lesson");
const fInternal = document.getElementById("field-internal-notes");

let reportReady = false;

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.hidden = false;
}

function clearError() {
  errorMsg.hidden = true;
  errorMsg.textContent = "";
}

function selectedIds() {
  return [...sel.selectedOptions].map(o => Number(o.value));
}

// ── history panel ────────────────────────────────────────────────────────────

function renderHistory(entries, studentName) {
  histHeading.textContent = `Past lessons — ${studentName}`;
  histList.innerHTML = "";

  if (entries.length === 0) {
    const p = document.createElement("p");
    p.className = "text-gray-400 text-sm";
    p.textContent = "No previous lessons recorded.";
    histList.appendChild(p);
    histPanel.hidden = false;
    return;
  }

  // API already returns newest-first (ORDER BY created_at DESC)
  entries.forEach(e => {
    const details = document.createElement("details");
    details.className = "border border-gray-200 rounded-lg overflow-hidden group";

    // ── summary toggle row ───────────────────────────────────────────────────
    const sumEl = document.createElement("summary");
    sumEl.className = "flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer select-none hover:bg-gray-50 list-none";

    const left = document.createElement("span");
    left.className = "font-medium truncate";
    left.textContent = e.worksheet ?? "(no worksheet)";

    const right = document.createElement("span");
    right.className = "flex items-center gap-2 shrink-0";

    const dateSpan = document.createElement("span");
    dateSpan.className = "text-gray-400 text-xs";
    dateSpan.textContent = e.lesson_date ?? "";

    const chevron = document.createElement("span");
    chevron.className = "text-gray-400 text-xs inline-block transition-transform group-open:rotate-180";
    chevron.textContent = "▾";

    right.append(dateSpan, chevron);
    sumEl.append(left, right);

    // ── expandable body ──────────────────────────────────────────────────────
    const body = document.createElement("div");
    body.className = "px-4 py-3 border-t border-gray-100 space-y-3";

    function addSection(label, text, badge) {
      if (!text) return;
      const wrap = document.createElement("div");
      wrap.className = "space-y-0.5";

      const hdr = document.createElement("div");
      hdr.className = "flex items-center gap-2";

      const lbl = document.createElement("span");
      lbl.className = "text-xs font-semibold text-gray-500 uppercase tracking-wide";
      lbl.textContent = label;
      hdr.appendChild(lbl);

      if (badge) {
        const b = document.createElement("span");
        b.className = "text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium";
        b.textContent = badge;
        hdr.appendChild(b);
      }

      const val = document.createElement("p");
      val.className = "text-sm text-gray-700 whitespace-pre-wrap";
      val.textContent = text;

      wrap.append(hdr, val);
      body.appendChild(wrap);
    }

    addSection("Lesson summary",  e.lesson_summary);
    addSection("Next lesson",     e.next_lesson);
    addSection("Internal notes",  e.internal_notes, "Instructor only");

    details.append(sumEl, body);
    histList.appendChild(details);
  });

  histPanel.hidden = false;
}

async function loadHistory() {
  const ids = selectedIds();
  if (ids.length === 0) { histPanel.hidden = true; return; }

  const chosenOpt = [...sel.selectedOptions][0];
  const studentName = chosenOpt.textContent.split("  ")[0];

  try {
    const res = await fetch(`/api/students/${ids[0]}/history`);
    if (!res.ok) throw new Error();
    renderHistory(await res.json(), studentName);
  } catch {
    histPanel.hidden = true;
  }
}

// ── load / refresh students ───────────────────────────────────────────────────

function buildOption(s) {
  const opt = document.createElement("option");
  opt.value = s.id;
  opt.textContent = `${s.name}  (age ${s.age ?? "?"}, ${s.level ?? "?"})`;
  return opt;
}

async function loadStudents() {
  try {
    const res = await fetch("/api/students");
    if (!res.ok) throw new Error("Server error loading students");
    const students = await res.json();
    students.forEach(s => sel.appendChild(buildOption(s)));
  } catch (e) {
    showError("Could not load students. Is the server running?");
  }
}

async function refreshStudents(selectId) {
  const res = await fetch("/api/students");
  if (!res.ok) return;
  const students = await res.json();
  sel.innerHTML = "";
  students.forEach(s => {
    const opt = buildOption(s);
    if (s.id === selectId) opt.selected = true;
    sel.appendChild(opt);
  });
  if (selectId != null) await loadHistory();
}

sel.addEventListener("change", loadHistory);

// ── add student ───────────────────────────────────────────────────────────────

const addDetails  = document.getElementById("add-student-details");
const btnAddStu   = document.getElementById("btn-add-student");
const addStuError = document.getElementById("add-student-error");
const nsName      = document.getElementById("ns-name");
const nsAge       = document.getElementById("ns-age");
const nsLevel     = document.getElementById("ns-level");
const nsScratch   = document.getElementById("ns-scratch");
const nsEmail     = document.getElementById("ns-email");
const nsNotes     = document.getElementById("ns-notes");

btnAddStu.addEventListener("click", async () => {
  addStuError.hidden = true;
  const name = nsName.value.trim();
  if (!name) { addStuError.textContent = "Name is required."; addStuError.hidden = false; return; }

  btnAddStu.disabled = true;
  try {
    const res = await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        age:           nsAge.value    ? Number(nsAge.value) : null,
        level:         nsLevel.value.trim()   || null,
        scratch_user:  nsScratch.value.trim() || null,
        parent_email:  nsEmail.value.trim()   || null,
        profile_notes: nsNotes.value.trim()   || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) { addStuError.textContent = data.detail ?? "Failed to add student."; addStuError.hidden = false; return; }

    // reset form and collapse panel
    [nsName, nsAge, nsLevel, nsScratch, nsEmail, nsNotes].forEach(el => { el.value = ""; });
    addDetails.removeAttribute("open");

    await refreshStudents(data.id);
  } catch {
    addStuError.textContent = "Network error — could not reach the server.";
    addStuError.hidden = false;
  } finally {
    btnAddStu.disabled = false;
  }
});

// ── generate ──────────────────────────────────────────────────────────────────

btnGen.addEventListener("click", async () => {
  clearError();
  saveConf.hidden = true;

  const ids = selectedIds();
  if (ids.length === 0) { showError("Select at least one student."); return; }

  const ws    = worksheet.value.trim();
  const rawNotes = notes.value.trim();
  if (!ws)       { showError("Enter a worksheet name."); return; }
  if (!rawNotes) { showError("Enter some lesson notes."); return; }

  btnGen.disabled = true;
  loading.hidden  = false;
  results.hidden  = true;
  reportReady     = false;

  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: ids[0], worksheet: ws, raw_notes: rawNotes }),
    });
    const data = await res.json();
    if (!res.ok) { showError(data.detail ?? "Generate failed."); return; }

    fSummary.value  = data.lesson_summary  ?? "";
    fSkills.value   = (data.skills_practised ?? []).join(", ");
    fNext.value     = data.next_lesson     ?? "";
    fInternal.value = data.internal_notes  ?? "";

    results.hidden = false;
    reportReady    = true;
  } catch (e) {
    showError("Network error — could not reach the server.");
  } finally {
    btnGen.disabled = false;
    loading.hidden  = true;
  }
});

// ── save ──────────────────────────────────────────────────────────────────────

btnSave.addEventListener("click", async () => {
  clearError();
  saveConf.hidden = true;

  const ids = selectedIds();
  if (ids.length === 0) { showError("Select at least one student to save."); return; }

  const skills = fSkills.value.split(",").map(s => s.trim()).filter(Boolean);

  try {
    const res = await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_ids:      ids,
        worksheet:        worksheet.value.trim(),
        raw_notes:        notes.value.trim(),
        lesson_summary:   fSummary.value,
        skills_practised: skills,
        next_lesson:      fNext.value,
        internal_notes:   fInternal.value,
        lesson_date:      lessonDate.value,
      }),
    });
    const data = await res.json();
    if (!res.ok) { showError(data.detail ?? "Save failed."); return; }
    saveConf.hidden = false;
    await loadHistory();
  } catch (e) {
    showError("Network error — could not reach the server.");
  }
});

// ── copy summary ──────────────────────────────────────────────────────────────

btnCopy.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(fSummary.value);
    const original = btnCopy.textContent;
    btnCopy.textContent = "Copied!";
    setTimeout(() => { btnCopy.textContent = original; }, 1500);
  } catch {
    showError("Clipboard access denied by browser.");
  }
});

// ── Save disabled until a report exists ──────────────────────────────────────

new MutationObserver(() => {
  btnSave.disabled = !reportReady;
}).observe(results, { attributes: true, attributeFilter: ["hidden"] });

btnSave.disabled = true;

// ── mic / Web Speech API ──────────────────────────────────────────────────────

const btnMic   = document.getElementById("btn-mic");
const micLabel = document.getElementById("mic-label");
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  btnMic.hidden = true;
} else {
  const recognition = new SpeechRecognition();
  recognition.continuous     = true;
  recognition.interimResults = false;
  recognition.lang           = "en-US";

  let listening = false;

  function setListening(on) {
    listening = on;
    btnMic.classList.toggle("bg-red-50",       on);
    btnMic.classList.toggle("border-red-400",  on);
    btnMic.classList.toggle("text-red-600",    on);
    btnMic.classList.toggle("animate-pulse",   on);
    btnMic.classList.toggle("border-gray-300", !on);
    btnMic.classList.toggle("text-gray-600",   !on);
    micLabel.textContent = on ? "Stop" : "Mic";
  }

  recognition.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) {
        const text = e.results[i][0].transcript.trim();
        if (text) {
          notes.value += (notes.value.trimEnd() ? " " : "") + text;
        }
      }
    }
  };

  // Some browsers auto-stop after silence; restart if we're still in listening mode.
  recognition.onend = () => {
    if (listening) recognition.start();
  };

  recognition.onerror = (e) => {
    if (e.error !== "aborted") showError(`Mic error: ${e.error}`);
    setListening(false);
  };

  btnMic.addEventListener("click", () => {
    if (listening) {
      recognition.stop();
      setListening(false);
    } else {
      recognition.start();
      setListening(true);
    }
  });
}

// ── init ──────────────────────────────────────────────────────────────────────

lessonDate.value = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local
loadStudents();
