/*
 * Prioritise Everything
 * Copyright (c) 2026 Habit Labs
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
(function() {
  // Utility
  const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  const norm = s => s.trim().replace(/\s+/g, ' ').toLowerCase();
  const pairKey = (a, b) => {
    const [x, y] = a < b ? [a, b] : [b, a];
    return `${x}|${y}`;
  };
  // Title Case for display (ranking list)
  const toTitleCase = (input) => {
    if (!input) return '';
    const SMALL = new Set(['a','an','the','and','but','or','nor','for','so','yet','as','at','by','in','of','on','per','to','vs','via']);
    const words = input.trim().replace(/\s+/g, ' ').split(' ');
    const isAllCaps = (w) => /^[A-Z0-9]+$/.test(w) && /[A-Z]/.test(w) && !/[a-z]/.test(w);
    const hasDigit = (w) => /\d/.test(w);
    const capSeg = (seg) => seg ? seg.charAt(0).toUpperCase() + seg.slice(1) : seg;
    const processCore = (core) => {
      const parts = core.toLowerCase().split("'");
      for (let j = 0; j < parts.length; j++) {
        parts[j] = capSeg(parts[j]);
      }
      return parts.join("'");
    };
    const titleCaseToken = (w, i, arr) => {
      if (!w) return w;
      if (isAllCaps(w) && w.length > 1) return w; // keep acronyms (API, HR)
      if (hasDigit(w)) return w; // keep mixed alphanumerics (Q1, H2)
      const first = i === 0;
      const last = i === arr.length - 1;
      if (!first && !last && SMALL.has(w.toLowerCase())) {
        return w.toLowerCase();
      }
      if (w.includes('-')) {
        return w.split('-').map(s => processCore(s)).join('-');
      }
      return processCore(w);
    };
    return words.map((w,i,arr)=> titleCaseToken(w,i,arr)).join(' ');
  };

  // Build possessive form for names (e.g., James' vs. Alex’s)
  const possessive = (name) => {
    if (!name) return '';
    const n = name.trim();
    if (!n) return '';
    return /s$/i.test(n) ? (n + '’') : (n + '’s');
  };

  // State
  const STORAGE_KEY = 'pe_state_v1';
  let state = {
    tasks: [], // [{id, title, normTitle}]
    results: {}, // pairKey -> winnerId
    queue: [], // [pairKey]
    history: [], // [{pairKey, winnerId}]
    name: '', // optional user name for print title
  };

  // DOM
  const addForm = document.getElementById('addForm');
  const taskInput = document.getElementById('taskInput');
  const taskList = document.getElementById('taskList');
  const resetBtn = document.getElementById('resetBtn');

  const compareEmpty = document.getElementById('compareEmpty');
  const compareDone = document.getElementById('compareDone');
  const compareCard = document.getElementById('compareCard');
  const progressText = document.getElementById('progressText');
  // choice buttons are re-queried in renderCompare()
  const undoBtn = document.getElementById('undoBtn');

  const rankingList = document.getElementById('rankingList');
  const printBtn = document.getElementById('printBtn');
  const printArea = document.getElementById('printArea');
  const nameInput = document.getElementById('nameInput');

  // Persistence
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save state:', e);
    }
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return;
      state = Object.assign(state, obj);
      // Validate shape
      if (!Array.isArray(state.tasks)) state.tasks = [];
      if (!state.results || typeof state.results !== 'object') state.results = {};
      if (!Array.isArray(state.queue)) state.queue = [];
      if (!Array.isArray(state.history)) state.history = [];
      if (typeof state.name !== 'string') state.name = '';
    } catch (e) {
      console.warn('Failed to load state:', e);
    }
  }

  // Pairs
  function allPairsForTasks(tasks) {
    const ids = tasks.map(t => t.id);
    const pairs = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        pairs.push(pairKey(ids[i], ids[j]));
      }
    }
    return pairs;
  }

  function rebuildQueue() {
    const allPairs = allPairsForTasks(state.tasks);
    const pending = [];
    for (const k of allPairs) {
      if (!(k in state.results)) pending.push(k);
    }
    // Keep existing pending first (stable), then add new ones
    const existingSet = new Set(state.queue.filter(k => pending.includes(k)));
    const newOnes = pending.filter(k => !existingSet.has(k));
    state.queue = [...existingSet, ...newOnes];
  }

  // Add task
  function addTask(titleRaw) {
    const title = titleRaw.trim();
    if (!title) return;
    const n = norm(title);
    if (state.tasks.some(t => t.normTitle === n)) return; // ignore exact duplicates
    const t = { id: uid(), title, normTitle: n };
    state.tasks.push(t);

    // Generate pairs only involving the new task
    for (const other of state.tasks) {
      if (other.id === t.id) continue;
      const k = pairKey(t.id, other.id);
      if (!(k in state.results) && !state.queue.includes(k)) {
        state.queue.push(k);
      }
    }
    render();
    save();
  }

  // Remove task (optional convenience)
  function removeTask(id) {
    const idx = state.tasks.findIndex(t => t.id === id);
    if (idx === -1) return;
    state.tasks.splice(idx, 1);

    // Drop results involving this id
    const toDelete = [];
    for (const k in state.results) {
      const [a, b] = k.split('|');
      if (a === id || b === id) toDelete.push(k);
    }
    for (const k of toDelete) delete state.results[k];

    // Clean queue
    state.queue = state.queue.filter(k => {
      const [a, b] = k.split('|');
      return a !== id && b !== id;
    });

    // Clean history
    state.history = state.history.filter(h => {
      const [a, b] = h.pairKey.split('|');
      return a !== id && b !== id;
    });

    // Rebuild queue to ensure consistency
    rebuildQueue();
    render();
    save();
  }

  // Ranking
  function computeRanking() {
    const wins = new Map();
    const losses = new Map();
    for (const t of state.tasks) {
      wins.set(t.id, 0);
      losses.set(t.id, 0);
    }
    for (const k in state.results) {
      const winner = state.results[k];
      const [a, b] = k.split('|');
      if (!wins.has(a) || !wins.has(b)) continue; // skip results for removed tasks
      const loser = winner === a ? b : a;
      wins.set(winner, wins.get(winner) + 1);
      losses.set(loser, losses.get(loser) + 1);
    }


    function headToHead(aId, bId) {
      const k = pairKey(aId, bId);
      const w = state.results[k];
      if (!w) return 0; // no decision
      if (w === aId) return -1; // a above b
      if (w === bId) return 1; // b above a
      return 0;
    }

    const sorted = [...state.tasks].sort((t1, t2) => {
      const w1 = wins.get(t1.id) || 0;
      const w2 = wins.get(t2.id) || 0;
      if (w1 !== w2) return w2 - w1; // more wins first
      const l1 = losses.get(t1.id) || 0;
      const l2 = losses.get(t2.id) || 0;
      if (l1 !== l2) return l1 - l2; // fewer losses next
      const h2h = headToHead(t1.id, t2.id);
      if (h2h !== 0) return h2h; // head-to-head
      return t1.normTitle.localeCompare(t2.normTitle);
    });

    return { sorted, wins, losses };
  }

  // UI rendering
  function renderTasks() {
    taskList.innerHTML = '';
    for (const t of state.tasks) {
      const li = document.createElement('li');
      li.className = 'task-item';
      const span = document.createElement('span');
      span.textContent = t.title;
      li.appendChild(span);
      const btn = document.createElement('button');
      btn.className = 'icon danger';
      btn.title = 'Remove task';
      btn.textContent = '✕';
      btn.addEventListener('click', () => {
        if (confirm(`Remove task: "${t.title}"?`)) {
          removeTask(t.id);
        }
      });
      li.appendChild(btn);
      taskList.appendChild(li);
    }
  }

  function renderRanking() {
    const { sorted, wins, losses } = computeRanking();
    rankingList.innerHTML = '';
    for (const t of sorted) {
      const li = document.createElement('li');
      const w = wins.get(t.id) || 0;
      const l = losses.get(t.id) || 0;
      li.textContent = `${toTitleCase(t.title)} — ${w} win${w!==1?'s':''}${l?`, ${l} loss${l!==1?'es':''}`:''}`;
      rankingList.appendChild(li);
    }
  }

  // Build and open a print-friendly document for the current ranking (single in-page print, no popup)
  function handlePrint() {
    const n = state.tasks.length;
    if (!n) return;
    const { sorted } = computeRanking();

    const nameTrim = (state.name || '').trim();
    const titleText = nameTrim ? `${possessive(nameTrim)} Prioritised List` : 'Prioritised List';
    const when = new Date().toLocaleString();

    // Use hidden in-page print area to avoid opening new windows/tabs
    printArea.innerHTML = '';
    const doc = document.createElement('div');
    doc.className = 'print-doc';

    const h1 = document.createElement('h1');
    h1.className = 'print-title';
    h1.textContent = titleText;

    const meta = document.createElement('div');
    meta.className = 'print-meta';
    meta.textContent = `Generated on ${when} • ${n} task${n!==1?'s':''}`;

    const ol = document.createElement('ol');
    ol.className = 'print-list';
    for (const t of sorted) {
      const li = document.createElement('li');
      li.textContent = toTitleCase(t.title);
      ol.appendChild(li);
    }

    doc.appendChild(h1);
    doc.appendChild(meta);
    doc.appendChild(ol);
    printArea.appendChild(doc);

    printArea.classList.remove('hidden');

    const cleanup = () => {
      printArea.classList.add('hidden');
      printArea.innerHTML = '';
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);

    // small delay lets layout settle before print
    setTimeout(() => {
      window.print();
      setTimeout(cleanup, 1000);
    }, 50);
  }

  function nextPendingPair() {
    if (state.queue.length === 0) return null;
    // Randomize to reduce bias
    const idx = Math.floor(Math.random() * state.queue.length);
    return { key: state.queue[idx], idx };
  }

  function renderCompare() {
    const n = state.tasks.length;
    const totalPairs = (n * (n - 1)) / 2;

    // Count completed pairs involving current tasks only
    const idSet = new Set(state.tasks.map(t => t.id));
    let doneCount = 0;
    for (const k in state.results) {
      const [a, b] = k.split('|');
      if (idSet.has(a) && idSet.has(b)) doneCount++;
    }

    progressText.textContent = `${doneCount} / ${totalPairs}`;

    if (n < 2) {
      compareEmpty.classList.remove('hidden');
      compareDone.classList.add('hidden');
      compareCard.classList.add('hidden');
      return;
    }

    if (state.queue.length === 0) {
      compareEmpty.classList.add('hidden');
      compareDone.classList.remove('hidden');
      compareCard.classList.add('hidden');
      return;
    }

    const pair = nextPendingPair();
    if (!pair) {
      compareEmpty.classList.add('hidden');
      compareDone.classList.remove('hidden');
      compareCard.classList.add('hidden');
      return;
    }

    const [aId, bId] = pair.key.split('|');
    const a = state.tasks.find(t => t.id === aId);
    const b = state.tasks.find(t => t.id === bId);
    if (!a || !b) {
      // Rebuild queue if pair is invalid
      rebuildQueue();
      return renderCompare();
    }

    compareEmpty.classList.add('hidden');
    compareDone.classList.add('hidden');
    compareCard.classList.remove('hidden');

    // Use fresh references each render to avoid stale nodes
    const choiceAEl = document.getElementById('choiceA');
    const choiceBEl = document.getElementById('choiceB');

    choiceAEl.textContent = a.title;
    choiceBEl.textContent = b.title;

    // Clear previous listeners by cloning nodes (ids preserved)
    const aClone = choiceAEl.cloneNode(true);
    const bClone = choiceBEl.cloneNode(true);
    choiceAEl.parentNode.replaceChild(aClone, choiceAEl);
    choiceBEl.parentNode.replaceChild(bClone, choiceBEl);

    aClone.addEventListener('click', () => {
      recordDecision(pair.key, a.id);
    });
    bClone.addEventListener('click', () => {
      recordDecision(pair.key, b.id);
    });
  }

  function recordDecision(k, winnerId) {
    state.results[k] = winnerId;
    state.history.push({ pairKey: k, winnerId });
    // Remove from queue if present
    const idx = state.queue.indexOf(k);
    if (idx !== -1) state.queue.splice(idx, 1);
    render();
    save();
  }

  function undo() {
    const last = state.history.pop();
    if (!last) return;
    delete state.results[last.pairKey];
    if (!state.queue.includes(last.pairKey)) {
      state.queue.push(last.pairKey);
    }
    render();
    save();
  }

  function render() {
    renderTasks();
    renderRanking();
    renderCompare();
    // Update print button state
    if (printBtn) {
      const hasTasks = state.tasks.length > 0;
      printBtn.disabled = !hasTasks;
      printBtn.title = hasTasks ? 'Print or save as PDF' : 'Add at least one task to print';
    }
  }

  // Events
  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = taskInput.value;
    if (!val.trim()) return;
    addTask(val);
    taskInput.value = '';
    taskInput.focus();
  });

  resetBtn.addEventListener('click', () => {
    if (!confirm('Reset all tasks and comparisons? This cannot be undone.')) return;
    state = { tasks: [], results: {}, queue: [], history: [] };
    render();
    save();
  });

  undoBtn.addEventListener('click', () => {
    undo();
  });

  if (printBtn) {
    printBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (state.tasks.length === 0) return;
      handlePrint();
    });
  }

  // Name input persistence
  if (nameInput) {
    try {
      nameInput.value = (state.name || '');
    } catch {}
    const persistName = () => {
      state.name = nameInput.value.replace(/\s+/g, ' ').trim();
      save();
    };
    nameInput.addEventListener('input', persistName);
    nameInput.addEventListener('change', persistName);
  }

  // Init
  load();
  // Prefill name after loading state
  if (nameInput) {
    try { nameInput.value = (state.name || ''); } catch {}
  }
  // Ensure queue matches current tasks/results
  rebuildQueue();
  render();
})();
