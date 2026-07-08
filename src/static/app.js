// ── Utilities ─────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function $(id) { return document.getElementById(id); }

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso.replace(' ', 'T'));
  return isNaN(d) ? iso : d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Avatar ────────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#6366f1','#8b5cf6','#3b82f6','#0d9488','#10b981','#f59e0b','#ef4444','#ec4899'];

function avatarColor(name) {
  let h = 0;
  for (const c of (name || '?')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function avatarHtml(name, size = 'w-8 h-8 text-sm') {
  const color = avatarColor(name);
  const letter = (name || '?')[0].toUpperCase();
  return `<span class="${size} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
    style="background:${color}">${esc(letter)}</span>`;
}

// ── Tab navigation ─────────────────────────────────────────────────────────────

const TABS = ['lesson', 'students', 'feedback', 'settings'];

function switchTab(name) {
  TABS.forEach(t => {
    const panel = $(`tab-${t}`);
    if (panel) panel.classList.toggle('hidden', t !== name);
  });
  document.querySelectorAll('[data-tab]').forEach(btn => {
    const active = btn.dataset.tab === name;
    btn.classList.toggle('bg-indigo-600', active);
    btn.classList.toggle('text-white', active);
    btn.classList.toggle('text-gray-500', !active);
  });
  if (name === 'settings') loadSettings();
  if (name === 'students') loadStudentList();
  if (name === 'feedback') loadFeedbackTab();
}

document.querySelectorAll('[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ── Quick Guide ───────────────────────────────────────────────────────────────

const GUIDE_KEY = 'care_guide_dismissed';

function initGuide() {
  const guide = $('quick-guide');
  if (!guide) return;
  if (localStorage.getItem(GUIDE_KEY) === '1') {
    guide.classList.add('hidden');
  }
  $('btn-dismiss-guide').addEventListener('click', () => {
    localStorage.setItem(GUIDE_KEY, '1');
    guide.classList.add('hidden');
  });
  $('btn-show-guide').addEventListener('click', () => {
    localStorage.removeItem(GUIDE_KEY);
    guide.classList.remove('hidden');
    guide.scrollIntoView({ behavior: 'smooth', block: 'start' });
    switchTab('lesson');
  });
}

// ── Providers ─────────────────────────────────────────────────────────────────

const PROVIDERS = {
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    keyHint: 'Get a free key at openrouter.ai → Keys. One key gives access to GPT-4o, Claude, Gemini, Llama and more.',
    models: [
      // OpenAI via OpenRouter
      'openai/gpt-4o-mini',          // cheap, fast, great for most uses
      'openai/gpt-4o',               // most capable OpenAI model
      // Anthropic via OpenRouter
      'anthropic/claude-3-5-haiku',  // fast and affordable Claude
      'anthropic/claude-sonnet-4-5', // balanced Claude
      'anthropic/claude-opus-4',     // most powerful Claude
      // Google via OpenRouter
      'google/gemini-2.0-flash-exp', // fast and free-tier eligible
      'google/gemini-2.5-pro-preview', // Google's flagship
      // Free models
      'meta-llama/llama-3.1-8b-instruct:free',
      'mistralai/mistral-7b-instruct:free',
    ],
  },
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    keyHint: 'Get a key at platform.openai.com → API keys. Usage is billed per token.',
    models: [
      'gpt-4o-mini',    // recommended — cheap and fast
      'gpt-4o',         // most capable
      'gpt-4.1-mini',   // newer, efficient
      'gpt-4.1',        // newest flagship
      'o1-mini',        // reasoning model, slower
    ],
  },
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    keyHint: 'Get a free key at console.groq.com → API Keys. Groq is extremely fast — responses in under 1 second.',
    models: [
      'llama-3.1-70b-versatile',   // recommended — powerful and free tier
      'llama-3.1-8b-instant',      // fastest option
      'llama3-70b-8192',           // strong alternative
      'mixtral-8x7b-32768',        // good for long contexts
      'gemma2-9b-it',              // Google Gemma via Groq
    ],
  },
  google: {
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    keyHint: 'Get a free API key at aistudio.google.com → Get API key. Generous free tier.',
    models: [
      'gemini-2.0-flash',          // recommended — fast and free-tier
      'gemini-2.0-flash-lite',     // lightest, fastest
      'gemini-1.5-flash',          // reliable, widely supported
      'gemini-1.5-pro',            // longer context window
      'gemini-2.5-pro-preview',    // most capable Gemini
    ],
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    keyHint: 'Get a key at console.anthropic.com → API Keys. Note: uses Anthropic\'s native API format (not OpenAI-compatible).',
    models: [
      'claude-haiku-4-5-20251001', // fastest and cheapest Claude
      'claude-sonnet-4-6',         // balanced — recommended
      'claude-opus-4-8',           // most powerful Claude
      'claude-3-5-haiku-20241022', // affordable, fast
      'claude-3-5-sonnet-20241022', // previous flagship
    ],
  },
  ollama: {
    url: 'http://localhost:11434/v1/chat/completions',
    keyHint: 'Ollama runs models locally on your computer — no API key needed, no internet, completely private.',
    models: [
      'llama3.2',   // good all-round model
      'llama3.1',
      'mistral',
      'phi3',       // small and fast
      'gemma2',
      'qwen2.5',    // strong multilingual model
    ],
  },
  custom: {
    url: '',
    keyHint: 'Enter the full chat completions API endpoint URL above and your key below. Must be OpenAI-compatible format.',
    models: [],
  },
};

function detectProvider(url) {
  if (!url) return 'openrouter';
  if (url.includes('openrouter.ai')) return 'openrouter';
  if (url.includes('openai.com')) return 'openai';
  if (url.includes('groq.com')) return 'groq';
  if (url.includes('generativelanguage.googleapis.com')) return 'google';
  if (url.includes('api.anthropic.com')) return 'anthropic';
  if (url.includes('localhost:11434') || url.includes('127.0.0.1:11434')) return 'ollama';
  return 'custom';
}

function applyProvider(providerKey, keepUrl = false) {
  const p = PROVIDERS[providerKey];
  if (!p) return;

  if (!keepUrl && p.url) {
    $('settings-api-url').value = p.url;
  }

  $('api-key-hint').textContent = p.keyHint;

  const dl = $('model-suggestions');
  dl.innerHTML = '';
  p.models.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    dl.appendChild(opt);
  });

  if (p.models.length && !$('settings-model').value) {
    $('settings-model').value = p.models[0];
  }
}

$('settings-provider').addEventListener('change', e => {
  applyProvider(e.target.value, false);
});

// ── Settings ──────────────────────────────────────────────────────────────────

async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    const s = await res.json();

    const url = s.api_url || '';
    $('settings-api-url').value = url;

    const provider = detectProvider(url);
    $('settings-provider').value = provider;
    applyProvider(provider, true);

    if (s.model) $('settings-model').value = s.model;
    if (s.system_prompt) $('settings-prompt').value = s.system_prompt;

    const keyStatus = $('api-key-status');
    if (s.api_key_set) {
      keyStatus.textContent = '✓ API key is saved (hidden for security)';
      keyStatus.className = 'text-sm text-emerald-600 mb-2';
    } else {
      keyStatus.textContent = '⚠ No API key saved yet — enter one below';
      keyStatus.className = 'text-sm text-amber-600 mb-2';
    }
  } catch (err) {
    console.warn('loadSettings error', err);
  }
}

$('btn-toggle-key').addEventListener('click', () => {
  const inp = $('settings-api-key');
  const showing = inp.type === 'text';
  inp.type = showing ? 'password' : 'text';
  $('btn-toggle-key').textContent = showing ? 'Show' : 'Hide';
});

$('btn-save-settings').addEventListener('click', async () => {
  const confirm = $('settings-confirm');
  const errEl   = $('settings-error');
  confirm.hidden = true;
  errEl.hidden   = true;

  const body = {
    api_url: $('settings-api-url').value.trim() || null,
    model:   $('settings-model').value.trim()   || null,
    system_prompt: $('settings-prompt').value.trim() || null,
  };
  const key = $('settings-api-key').value.trim();
  if (key) body.api_key = key;

  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    $('settings-api-key').value = '';
    $('settings-api-key').type = 'password';
    $('btn-toggle-key').textContent = 'Show';
    confirm.hidden = false;
    await loadSettings();
    setTimeout(() => { confirm.hidden = true; }, 3000);
  } catch (err) {
    errEl.textContent = `Save failed: ${err.message}`;
    errEl.hidden = false;
  }
});

// ── Student picker (Lesson tab) ───────────────────────────────────────────────

let _allStudents = [];

async function fetchStudents() {
  const res = await fetch('/api/students');
  _allStudents = await res.json();
}

function selectedLessonIds() {
  return new Set(
    [...document.querySelectorAll('#lesson-picker-list input[type=checkbox]:checked')]
      .map(cb => Number(cb.value))
  );
}

function buildPickerItem(s, checked) {
  const label = document.createElement('label');
  label.className = 'flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-indigo-50 transition-colors select-none';
  label.innerHTML = `
    <input type="checkbox" value="${s.id}" ${checked ? 'checked' : ''}
      class="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 flex-shrink-0" />
    ${avatarHtml(s.name)}
    <span class="flex-1 min-w-0">
      <span class="text-sm font-medium text-gray-800">${esc(s.name)}</span>
      ${s.level ? `<span class="ml-2 text-xs text-gray-400">${esc(s.level)}</span>` : ''}
    </span>
    ${s.login ? `<span class="text-xs text-gray-300 font-mono">${esc(s.login)}</span>` : ''}
  `;
  label.querySelector('input').addEventListener('change', onPickerChange);
  return label;
}

function refreshLessonPicker(filter = '') {
  const prevIds = selectedLessonIds();
  const list = $('lesson-picker-list');
  list.innerHTML = '';
  const q = filter.toLowerCase();
  const filtered = _allStudents.filter(s =>
    s.active &&
    (!q ||
      s.name.toLowerCase().includes(q) ||
      (s.level || '').toLowerCase().includes(q) ||
      (s.login || '').toLowerCase().includes(q))
  );
  if (!filtered.length) {
    list.innerHTML = '<p class="text-xs text-gray-400 text-center py-6">No students match</p>';
  } else {
    filtered.forEach(s => list.appendChild(buildPickerItem(s, prevIds.has(s.id))));
  }
  onPickerChange();
}

function onPickerChange() {
  const ids = [...selectedLessonIds()];
  const summary = $('lesson-picker-summary');
  const names = ids.map(id => {
    const s = _allStudents.find(x => x.id === id);
    return s ? s.name : id;
  });

  if (ids.length === 0) {
    summary.textContent = 'No students selected';
    $('history-panel').hidden = true;
    $('btn-save').disabled = true;
  } else if (ids.length === 1) {
    summary.textContent = `Selected: ${names[0]}`;
    const s = _allStudents.find(x => x.id === ids[0]);
    loadHistory(ids[0], s ? s.name : 'Student');
    $('btn-save').disabled = false;
  } else {
    summary.textContent = `Selected: ${names.join(', ')} (${ids.length} students)`;
    $('history-panel').hidden = true;
    $('btn-save').disabled = false;
  }
}

$('lesson-picker-search').addEventListener('input', e => {
  refreshLessonPicker(e.target.value);
});

// ── History panel ─────────────────────────────────────────────────────────────

async function loadHistory(studentId, studentName) {
  $('history-heading').textContent = `${studentName}'s recent lessons`;
  $('history-panel').hidden = false;
  $('history-list').innerHTML = '<p class="text-xs text-gray-400 text-center py-4">Loading…</p>';

  try {
    const res = await fetch(`/api/students/${studentId}/history`);
    const entries = await res.json();
    renderHistory(entries, studentId);
  } catch {
    $('history-list').innerHTML = '<p class="text-xs text-red-400 text-center py-4">Could not load history</p>';
  }
}

function starsHtml(rating) {
  if (!rating) return '';
  let s = '';
  for (let i = 1; i <= 5; i++) {
    s += `<span class="${i <= rating ? 'text-amber-400' : 'text-gray-200'}">★</span>`;
  }
  return s;
}

function renderHistory(entries, studentId) {
  const list = $('history-list');
  if (!entries.length) {
    list.innerHTML = '<p class="text-xs text-gray-400 text-center py-6">No lessons recorded yet</p>';
    return;
  }
  list.innerHTML = '';
  entries.slice(0, 8).forEach(e => {
    const div = document.createElement('div');
    div.className = 'px-4 py-3 text-xs space-y-1.5';

    const skillsArr = (() => {
      if (!e.skills_practised) return [];
      try { return JSON.parse(e.skills_practised); } catch { return String(e.skills_practised).split(',').map(s => s.trim()); }
    })();
    const skillsHtml = skillsArr.map(sk =>
      `<span class="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">${esc(sk)}</span>`
    ).join(' ');

    const titleHtml = e.title
      ? `<span class="font-semibold text-gray-800">${esc(e.title)}</span> — `
      : '';

    const generalHtml = e.general_lesson
      ? `<div class="bg-amber-50 text-amber-700 rounded-lg px-2.5 py-1.5 mt-1 text-xs">${esc(e.general_lesson)}</div>`
      : '';

    const feedbackHtml = e.feedback_comments
      ? `<div class="mt-1.5 text-gray-500 italic border-l-2 border-sky-200 pl-2">
           ${starsHtml(e.feedback_rating)}
           <span class="ml-1">${esc(e.feedback_comments)}</span>
         </div>`
      : e.feedback_rating
        ? `<div class="mt-1.5 text-gray-400 italic">${starsHtml(e.feedback_rating)} (no comment)</div>`
        : '';

    div.innerHTML = `
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div>${titleHtml}<span class="text-gray-500">${formatDate(e.lesson_date || e.created_at)}</span></div>
        ${e.worksheet ? `<span class="font-medium text-gray-700">${esc(e.worksheet)}</span>` : ''}
      </div>
      ${generalHtml}
      ${e.lesson_summary ? `<p class="text-gray-600 line-clamp-3">${esc(e.lesson_summary)}</p>` : ''}
      ${skillsHtml ? `<div class="flex flex-wrap gap-1 mt-1">${skillsHtml}</div>` : ''}
      ${feedbackHtml}
    `;
    list.appendChild(div);
  });
}

// ── Generate ──────────────────────────────────────────────────────────────────

function showError(msg) {
  $('error-msg').hidden = false;
  $('error-text').textContent = msg;
}
function hideError() { $('error-msg').hidden = true; }

$('btn-generate').addEventListener('click', async () => {
  const ids = [...selectedLessonIds()];
  if (!ids.length) { showError('Select at least one student first.'); return; }

  const worksheet = $('worksheet').value.trim();
  const notes     = $('notes').value.trim();
  if (!worksheet && !notes) { showError('Please enter a worksheet name or lesson notes first.'); return; }

  hideError();
  $('results').hidden = true;
  $('post-save-feedback').hidden = true;
  $('loading').hidden = false;
  $('btn-generate').disabled = true;
  $('save-confirm').hidden = true;

  const firstId = ids[0];
  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id:     firstId,
        worksheet,
        raw_notes:      notes,
        title:          $('lesson-title').value.trim(),
        general_lesson: $('general-lesson').value.trim(),
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || `Server error ${res.status}`);
    }

    const report = await res.json();
    const skills = Array.isArray(report.skills_practised)
      ? report.skills_practised.join(', ')
      : (report.skills_practised || '');

    $('field-lesson-summary').value  = report.lesson_summary  || '';
    $('field-skills').value          = skills;
    $('field-next-lesson').value     = report.next_lesson     || '';
    $('field-internal-notes').value  = report.internal_notes  || '';

    $('results').hidden = false;
    $('btn-save').disabled = ids.length === 0;
    $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    showError(err.message);
  } finally {
    $('loading').hidden = true;
    $('btn-generate').disabled = false;
  }
});

// ── Save ──────────────────────────────────────────────────────────────────────

$('btn-save').addEventListener('click', async () => {
  const ids = [...selectedLessonIds()];
  if (!ids.length) return;

  $('btn-save').disabled = true;

  const skillsRaw = $('field-skills').value;
  const skills = skillsRaw.split(',').map(s => s.trim()).filter(Boolean);

  const dateVal = $('lesson-date').value;

  try {
    const res = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_ids:    ids,
        title:          $('lesson-title').value.trim(),
        general_lesson: $('general-lesson').value.trim(),
        worksheet:      $('worksheet').value.trim(),
        raw_notes:      $('notes').value.trim(),
        lesson_summary: $('field-lesson-summary').value.trim(),
        skills_practised: skills,
        next_lesson:    $('field-next-lesson').value.trim(),
        internal_notes: $('field-internal-notes').value.trim(),
        lesson_date:    dateVal,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || `Server error ${res.status}`);
    }

    const data = await res.json();
    $('save-confirm').hidden = false;

    // Show feedback links panel
    if (data.entry_ids && data.entry_ids.length) {
      showPostSaveFeedback(data.entry_ids, ids);
    }

    // Refresh history for single student
    if (ids.length === 1) {
      const s = _allStudents.find(x => x.id === ids[0]);
      loadHistory(ids[0], s ? s.name : 'Student');
    }

    setTimeout(() => { $('save-confirm').hidden = true; }, 4000);
  } catch (err) {
    showError(err.message);
  } finally {
    $('btn-save').disabled = false;
  }
});

// ── Post-save feedback ────────────────────────────────────────────────────────

function showPostSaveFeedback(entryIds, studentIds) {
  const card = $('post-save-feedback');
  const list = $('post-save-feedback-list');
  list.innerHTML = '';

  entryIds.forEach((entryId, i) => {
    const sid = studentIds[i];
    const student = _allStudents.find(x => x.id === sid);
    const name = student ? student.name : `Student ${sid}`;

    const row = document.createElement('div');
    row.className = 'flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3';
    row.innerHTML = `
      ${avatarHtml(name)}
      <span class="flex-1 text-sm font-medium text-gray-700">${esc(name)}</span>
      <button data-entry="${entryId}"
        class="btn-get-link text-xs bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 font-semibold px-3 py-1.5 rounded-lg transition">
        Get Link
      </button>
    `;
    list.appendChild(row);

    row.querySelector('.btn-get-link').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = 'Generating…';
      try {
        const res = await fetch(`/api/lessons/${entryId}/feedback-link`, { method: 'POST' });
        if (!res.ok) throw new Error(await res.text());
        const { token } = await res.json();
        const url = `${location.origin}/feedback.html?token=${token}`;

        btn.closest('div').querySelector('.btn-get-link')?.remove();
        const linkWrap = document.createElement('div');
        linkWrap.className = 'flex items-center gap-2';
        linkWrap.innerHTML = `
          <input type="text" value="${esc(url)}" readonly
            class="text-xs border border-gray-200 bg-gray-50 rounded-lg px-2.5 py-1.5 font-mono w-64 text-gray-600" />
          <button class="btn-copy-link text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200 font-semibold px-3 py-1.5 rounded-lg transition">
            Copy
          </button>
        `;
        row.appendChild(linkWrap);
        linkWrap.querySelector('.btn-copy-link').addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(url);
            linkWrap.querySelector('.btn-copy-link').textContent = 'Copied!';
            setTimeout(() => { linkWrap.querySelector('.btn-copy-link').textContent = 'Copy'; }, 2000);
          } catch {
            linkWrap.querySelector('input').select();
          }
        });
      } catch (err) {
        btn.textContent = 'Error — retry';
        btn.disabled = false;
      }
    });
  });

  card.hidden = false;
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Copy Summary ──────────────────────────────────────────────────────────────

$('btn-copy').addEventListener('click', async () => {
  const text = $('field-lesson-summary').value;
  try {
    await navigator.clipboard.writeText(text);
    $('btn-copy').textContent = 'Copied!';
    setTimeout(() => { $('btn-copy').innerHTML = `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg> Copy Summary`; }, 2000);
  } catch {
    $('field-lesson-summary').select();
  }
});

// ── Lesson date default ───────────────────────────────────────────────────────

$('lesson-date').value = new Date().toISOString().slice(0, 10);

// ── Mic dictation ─────────────────────────────────────────────────────────────

(function initMic() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btn = $('btn-mic');
  if (!SpeechRecognition) { btn.hidden = true; return; }

  const recog = new SpeechRecognition();
  recog.continuous = true;
  recog.interimResults = true;
  recog.lang = 'en-SG';

  let running = false;
  let baseText = '';

  recog.onresult = e => {
    let interim = '';
    let final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += t + ' ';
      else interim += t;
    }
    baseText += final;
    $('notes').value = baseText + interim;
  };

  recog.onerror = () => { running = false; setMicState(false); };
  recog.onend  = () => {
    if (running) { recog.start(); }
    else { setMicState(false); }
  };

  function setMicState(on) {
    $('mic-label').textContent = on ? 'Stop' : 'Dictate';
    btn.classList.toggle('bg-red-50', on);
    btn.classList.toggle('text-red-600', on);
    btn.classList.toggle('border-red-300', on);
  }

  btn.addEventListener('click', () => {
    if (running) {
      running = false;
      recog.stop();
    } else {
      baseText = $('notes').value;
      running = true;
      recog.start();
      setMicState(true);
    }
  });
})();

// ── Students tab ──────────────────────────────────────────────────────────────

let _studentFilter = '';

async function loadStudentList() {
  await fetchStudents();
  renderStudentList();
}

function renderStudentList() {
  const q = _studentFilter.toLowerCase();
  const showInactive = $('toggle-show-inactive')?.checked ?? false;
  const filtered = _allStudents.filter(s =>
    (showInactive || s.active) &&
    (!q ||
      s.name.toLowerCase().includes(q) ||
      (s.level || '').toLowerCase().includes(q) ||
      (s.parent_email || '').toLowerCase().includes(q) ||
      (s.login || '').toLowerCase().includes(q))
  );
  const container = $('student-list');
  if (!filtered.length) {
    container.innerHTML = '<p class="text-center text-gray-400 text-sm py-10">No students found</p>';
    return;
  }
  container.innerHTML = '';
  filtered.forEach(s => container.appendChild(buildStudentCard(s)));
}

function buildStudentCard(s) {
  const div = document.createElement('div');
  div.className = 'card';
  div.dataset.studentId = s.id;

  const activeBadge = s.active
    ? '<span class="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Active</span>'
    : '<span class="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Inactive</span>';

  div.innerHTML = `
    <div class="p-4">
      <div class="flex items-start gap-3">
        ${avatarHtml(s.name, 'w-10 h-10 text-base')}
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-semibold text-gray-900 text-sm">${esc(s.name)}</span>
            ${activeBadge}
            ${s.level ? `<span class="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">${esc(s.level)}</span>` : ''}
          </div>
          <div class="text-xs text-gray-400 mt-0.5 space-x-3">
            ${s.age ? `<span>${s.age} yrs</span>` : ''}
            ${s.parent_email ? `<span>${esc(s.parent_email)}</span>` : ''}
            ${s.login ? `<span class="font-mono">${esc(s.login)}</span>` : ''}
          </div>
          ${s.profile_notes ? `<p class="text-xs text-gray-500 mt-1 line-clamp-2">${esc(s.profile_notes)}</p>` : ''}
        </div>
        <button class="btn-edit-student text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition" title="Edit">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      </div>
      <div class="edit-panel hidden mt-4 pt-4 border-t border-gray-100 space-y-3">
        <p class="edit-error hidden text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"></p>
        <div class="grid grid-cols-2 gap-3">
          <div class="col-span-2">
            <label class="text-xs font-medium text-gray-600 block mb-1">Name</label>
            <input class="edit-name input-field text-sm" type="text" value="${esc(s.name)}" />
          </div>
          <div>
            <label class="text-xs font-medium text-gray-600 block mb-1">Age</label>
            <input class="edit-age input-field text-sm" type="number" value="${s.age ?? ''}" />
          </div>
          <div>
            <label class="text-xs font-medium text-gray-600 block mb-1">Level</label>
            <input class="edit-level input-field text-sm" type="text" value="${esc(s.level ?? '')}" />
          </div>
          <div class="col-span-2">
            <label class="text-xs font-medium text-gray-600 block mb-1">Login / Username</label>
            <input class="edit-login input-field text-sm" type="text" value="${esc(s.login ?? '')}" />
          </div>
          <div>
            <label class="text-xs font-medium text-gray-600 block mb-1">Parent Email</label>
            <input class="edit-parent-email input-field text-sm" type="email" value="${esc(s.parent_email ?? '')}" />
          </div>
          <div>
            <label class="text-xs font-medium text-gray-600 block mb-1">Parent Phone</label>
            <input class="edit-parent-phone input-field text-sm" type="tel" value="${esc(s.parent_phone ?? '')}" />
          </div>
          <div>
            <label class="text-xs font-medium text-gray-600 block mb-1">Student Email</label>
            <input class="edit-student-email input-field text-sm" type="email" value="${esc(s.student_email ?? '')}" />
          </div>
          <div>
            <label class="text-xs font-medium text-gray-600 block mb-1">Student Phone</label>
            <input class="edit-student-phone input-field text-sm" type="tel" value="${esc(s.student_phone ?? '')}" />
          </div>
          <div class="col-span-2">
            <label class="text-xs font-medium text-gray-600 block mb-1">Profile Notes</label>
            <textarea class="edit-notes input-field text-sm resize-y" rows="2">${esc(s.profile_notes ?? '')}</textarea>
          </div>
        </div>
        <div class="flex gap-2 items-center flex-wrap">
          <button class="btn-save-student btn-primary text-xs py-2">Save</button>
          <button class="btn-cancel-edit btn-secondary text-xs py-2">Cancel</button>
          <button class="btn-toggle-active btn-secondary text-xs py-2">
            ${s.active ? 'Deactivate' : 'Reactivate'}
          </button>
          <div class="relative ml-auto">
            <button class="btn-export-toggle btn-secondary text-xs py-2">
              Export
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div class="export-menu hidden absolute right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden w-20">
              <button data-format="csv"  class="export-opt w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 text-gray-700">CSV</button>
              <button data-format="tsv"  class="export-opt w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 text-gray-700 border-t border-gray-100">TSV</button>
              <button data-format="json" class="export-opt w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 text-gray-700 border-t border-gray-100">JSON</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const editPanel = div.querySelector('.edit-panel');
  const editErr   = div.querySelector('.edit-error');

  div.querySelector('.btn-edit-student').addEventListener('click', () => {
    editPanel.classList.toggle('hidden');
  });
  div.querySelector('.btn-cancel-edit').addEventListener('click', () => {
    editPanel.classList.add('hidden');
  });

  div.querySelector('.btn-save-student').addEventListener('click', async () => {
    editErr.hidden = true;
    const ageVal = div.querySelector('.edit-age').value.trim();
    const body = {
      name:          div.querySelector('.edit-name').value.trim(),
      age:           ageVal ? parseInt(ageVal) : null,
      level:         div.querySelector('.edit-level').value.trim() || null,
      login:         div.querySelector('.edit-login').value.trim() || null,
      parent_email:  div.querySelector('.edit-parent-email').value.trim() || null,
      parent_phone:  div.querySelector('.edit-parent-phone').value.trim() || null,
      student_email: div.querySelector('.edit-student-email').value.trim() || null,
      student_phone: div.querySelector('.edit-student-phone').value.trim() || null,
      profile_notes: div.querySelector('.edit-notes').value.trim() || null,
    };
    try {
      const res = await fetch(`/api/students/${s.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).detail || `Error ${res.status}`);
      await loadStudentList();
      await fetchStudents();
      refreshLessonPicker($('lesson-picker-search').value);
    } catch (err) {
      editErr.textContent = err.message;
      editErr.hidden = false;
    }
  });

  div.querySelector('.btn-toggle-active').addEventListener('click', async () => {
    try {
      await fetch(`/api/students/${s.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: s.active ? 0 : 1 }),
      });
      await loadStudentList();
      await fetchStudents();
      refreshLessonPicker($('lesson-picker-search').value);
    } catch (err) {
      console.error(err);
    }
  });

  // Export per student
  const exportToggle = div.querySelector('.btn-export-toggle');
  const exportMenu   = div.querySelector('.export-menu');
  exportToggle.addEventListener('click', e => { e.stopPropagation(); exportMenu.classList.toggle('hidden'); });
  div.querySelectorAll('.export-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = `/api/students/${s.id}/export?format=${btn.dataset.format}`;
      window.location.href = url;
      exportMenu.classList.add('hidden');
    });
  });

  return div;
}

$('student-search').addEventListener('input', e => {
  _studentFilter = e.target.value;
  renderStudentList();
});

$('toggle-show-inactive').addEventListener('change', renderStudentList);

// Add student panel
$('btn-show-add').addEventListener('click', () => {
  $('add-student-panel').classList.toggle('hidden');
});
$('btn-cancel-add').addEventListener('click', () => {
  $('add-student-panel').classList.add('hidden');
});

$('btn-add-student').addEventListener('click', async () => {
  const errEl = $('add-student-error');
  errEl.hidden = true;

  const name = $('ns-name').value.trim();
  if (!name) { errEl.textContent = 'Please enter the student\'s name.'; errEl.hidden = false; return; }

  const ageRaw = $('ns-age').value.trim();
  const body = {
    name,
    age:           ageRaw ? parseInt(ageRaw) : null,
    level:         $('ns-level').value.trim() || null,
    login:         $('ns-login').value.trim() || null,
    parent_email:  $('ns-parent-email').value.trim() || null,
    parent_phone:  $('ns-parent-phone').value.trim() || null,
    student_email: $('ns-student-email').value.trim() || null,
    student_phone: $('ns-student-phone').value.trim() || null,
    profile_notes: $('ns-notes').value.trim() || null,
  };

  try {
    const res = await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error((await res.json()).detail || `Error ${res.status}`);

    ['ns-name','ns-age','ns-level','ns-login','ns-parent-email','ns-parent-phone',
     'ns-student-email','ns-student-phone','ns-notes'].forEach(id => { $(id).value = ''; });
    $('add-student-panel').classList.add('hidden');
    await loadStudentList();
    await fetchStudents();
    refreshLessonPicker($('lesson-picker-search').value);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
  }
});

// Import
$('btn-import-trigger').addEventListener('click', () => $('file-import').click());
$('file-import').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  const form = new FormData();
  form.append('file', file);
  try {
    const res = await fetch('/api/students/import', { method: 'POST', body: form });
    const data = await res.json();
    await loadStudentList();
    await fetchStudents();
    refreshLessonPicker($('lesson-picker-search').value);
    alert(`Imported ${data.imported} student${data.imported !== 1 ? 's' : ''}.`);
  } catch (err) {
    alert(`Import failed: ${err.message}`);
  }
  e.target.value = '';
});

// Export all
const exportAllToggle = $('btn-export-all-toggle');
const exportAllMenu   = $('export-all-menu');
exportAllToggle.addEventListener('click', e => { e.stopPropagation(); exportAllMenu.classList.toggle('hidden'); });
document.querySelectorAll('.export-all-opt').forEach(btn => {
  btn.addEventListener('click', () => {
    window.location.href = `/api/students/export?format=${btn.dataset.format}`;
    exportAllMenu.classList.add('hidden');
  });
});
document.addEventListener('click', () => {
  exportAllMenu.classList.add('hidden');
  document.querySelectorAll('.export-menu').forEach(m => m.classList.add('hidden'));
});

// ── Feedback Tab ──────────────────────────────────────────────────────────────

let _feedbackFilter = '';

async function loadFeedbackTab() {
  if (!_allStudents.length) await fetchStudents();
  renderFeedbackStudentList();
}

function renderFeedbackStudentList() {
  const q = _feedbackFilter.toLowerCase();
  const filtered = _allStudents.filter(s =>
    s.active &&
    (!q ||
      s.name.toLowerCase().includes(q) ||
      (s.level || '').toLowerCase().includes(q))
  );
  const container = $('feedback-student-list');
  if (!filtered.length) {
    container.innerHTML = '<p class="text-center text-gray-400 text-sm py-10">No students found</p>';
    return;
  }
  container.innerHTML = '';
  filtered.forEach(s => container.appendChild(buildFeedbackStudentRow(s)));
}

function buildFeedbackStudentRow(s) {
  const div = document.createElement('div');
  div.className = 'card overflow-hidden';
  div.innerHTML = `
    <button class="btn-expand w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors">
      ${avatarHtml(s.name, 'w-9 h-9 text-sm')}
      <div class="flex-1 min-w-0">
        <span class="font-semibold text-gray-900 text-sm">${esc(s.name)}</span>
        ${s.level ? `<span class="ml-2 text-xs text-gray-400">${esc(s.level)}</span>` : ''}
      </div>
      <svg class="chevron w-4 h-4 text-gray-400 transition-transform duration-200 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    <div class="entries-panel hidden border-t border-gray-100 bg-gray-50">
      <div class="entries-list px-4 py-3 space-y-2">
        <p class="text-xs text-gray-400 text-center py-2">Loading…</p>
      </div>
    </div>
  `;

  let loaded = false;
  const panel  = div.querySelector('.entries-panel');
  const list   = div.querySelector('.entries-list');
  const chevron = div.querySelector('.chevron');

  div.querySelector('.btn-expand').addEventListener('click', async () => {
    const open = !panel.classList.contains('hidden');
    panel.classList.toggle('hidden', open);
    chevron.style.transform = open ? '' : 'rotate(180deg)';
    if (!open && !loaded) {
      loaded = true;
      try {
        const res = await fetch(`/api/students/${s.id}/history`);
        const entries = await res.json();
        renderFeedbackEntries(list, entries);
      } catch {
        list.innerHTML = '<p class="text-xs text-red-400 text-center py-2">Could not load lessons</p>';
      }
    }
  });

  return div;
}

function renderFeedbackEntries(container, entries) {
  if (!entries.length) {
    container.innerHTML = '<p class="text-xs text-gray-400 text-center py-2">No lessons saved yet — save a lesson report first</p>';
    return;
  }
  container.innerHTML = '';
  entries.slice(0, 8).forEach(e => {
    const row = document.createElement('div');
    row.className = 'bg-white border border-gray-200 rounded-xl p-3 space-y-2';

    const dateLabel = `${e.title ? esc(e.title) + ' — ' : ''}${formatDate(e.lesson_date || e.created_at)}`;
    const worksheetLabel = e.worksheet ? `<span class="text-gray-400"> · ${esc(e.worksheet)}</span>` : '';

    row.innerHTML = `
      <div class="text-xs font-medium text-gray-700">${dateLabel}${worksheetLabel}</div>
      <div class="fb-status"></div>
    `;

    const statusEl = row.querySelector('.fb-status');
    renderFeedbackStatus(statusEl, e);
    container.appendChild(row);
  });
}

function renderFeedbackStatus(el, e) {
  if (e.feedback_submitted_at) {
    const stars = starsHtml(e.feedback_rating);
    el.innerHTML = `
      <div class="flex items-center gap-2 text-xs text-emerald-600 font-medium">
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        Feedback received ${stars ? `<span class="ml-1">${stars}</span>` : ''}
      </div>
      ${e.feedback_comments ? `<p class="text-xs text-gray-500 italic mt-1">"${esc(e.feedback_comments)}"</p>` : ''}
    `;
  } else if (e.feedback_token) {
    const url = `${location.origin}/feedback.html?token=${e.feedback_token}`;
    el.innerHTML = `
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-xs text-blue-500 font-medium">Link ready — awaiting response</span>
      </div>
      <div class="flex items-center gap-2 mt-1">
        <input type="text" value="${esc(url)}" readonly
          class="text-xs border border-gray-200 bg-gray-50 rounded-lg px-2 py-1.5 font-mono flex-1 min-w-0 text-gray-500 cursor-text" />
        <button class="btn-copy-fb text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg transition font-medium whitespace-nowrap"
          data-url="${esc(url)}">Copy</button>
      </div>
    `;
    el.querySelector('.btn-copy-fb').addEventListener('click', btn => copyFbLink(btn.currentTarget));
  } else {
    el.innerHTML = `
      <button class="btn-get-fb text-xs bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 px-3 py-1.5 rounded-lg transition font-semibold"
        data-entry="${e.id}">
        Get Feedback Link
      </button>
    `;
    el.querySelector('.btn-get-fb').addEventListener('click', async btn => {
      const b = btn.currentTarget;
      b.disabled = true;
      b.textContent = 'Generating…';
      try {
        const res = await fetch(`/api/lessons/${e.id}/feedback-link`, { method: 'POST' });
        if (!res.ok) throw new Error(await res.text());
        const { token } = await res.json();
        const url = `${location.origin}/feedback.html?token=${token}`;
        e.feedback_token = token;
        renderFeedbackStatus(el, e);
      } catch {
        b.textContent = 'Error — try again';
        b.disabled = false;
      }
    });
  }
}

async function copyFbLink(btn) {
  const url = btn.dataset.url;
  try {
    await navigator.clipboard.writeText(url);
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = orig; }, 2000);
  } catch {
    btn.previousElementSibling?.select();
  }
}

$('feedback-search').addEventListener('input', e => {
  _feedbackFilter = e.target.value;
  renderFeedbackStudentList();
});

// ── Initialise ────────────────────────────────────────────────────────────────

async function init() {
  initGuide();
  switchTab('lesson');
  await fetchStudents();
  refreshLessonPicker();
}

init();
