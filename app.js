(() => {
  'use strict';
  const STORAGE_KEY = 'bci2026_sc_candidate_scores_v1';
  const RECRUITMENT = 'rssb-basic-computer-instructor-2026';
  const $ = (id) => document.getElementById(id);
  const seatCounts = {
    'secondary|non-scheduled': 879,
    'secondary|scheduled': 43,
    'sanskrit|non-scheduled': 23,
    'sanskrit|scheduled': 0
  };
  let storageAvailable = true;
  let rows = readRows();

  function setConnection(text, state = 'connected') {
    const el = $('connection-status');
    el.classList.toggle('connected', state === 'connected');
    el.classList.toggle('offline', state !== 'connected');
    el.lastElementChild.textContent = text;
  }
  const number = (n) => Number.isFinite(Number(n)) ? Number(n) : 0;
  const score = (r) => number(r.paper1) + number(r.paper2);
  const fmt = (n) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 1, minimumFractionDigits: Number.isInteger(n) ? 0 : 1 });
  const currentPool = () => $('pool-filter').value;
  const filteredRows = () => {
    const pool = currentPool();
    return rows.filter((r) => pool === 'all' || `${r.department}|${r.area}` === pool);
  };
  const quantile = (values, q) => {
    if (!values.length) return null;
    const pos = (values.length - 1) * q;
    const lo = Math.floor(pos), hi = Math.ceil(pos);
    return values[lo] + (values[hi] - values[lo]) * (pos - lo);
  };

  function readRows() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data.filter(validRow) : [];
    } catch (e) {
      storageAvailable = false;
      return [];
    }
  }

  function validRow(r) {
    return r && ['secondary', 'sanskrit'].includes(r.department)
      && ['scheduled', 'non-scheduled'].includes(r.area)
      && ['answer-key', 'official-result'].includes(r.score_basis)
      && Number.isFinite(Number(r.paper1)) && Number.isFinite(Number(r.paper2))
      && Number(r.paper1) >= -33.34 && Number(r.paper1) <= 100
      && Number(r.paper2) >= -33.34 && Number(r.paper2) <= 100;
  }

  function saveRows() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
      storageAvailable = true;
      setConnection('Local data saved');
      return true;
    } catch (e) {
      storageAvailable = false;
      setConnection('Local storage unavailable', 'offline');
      return false;
    }
  }

  function drawChart(data) {
    const host = $('distribution');
    host.innerHTML = '';
    const bins = Array.from({ length: 28 }, (_, i) => ({ label: `${i * 10 - 70}`, count: 0 }));
    data.forEach((r) => {
      const index = Math.max(0, Math.min(27, Math.floor((score(r) + 70) / 10)));
      bins[index].count += 1;
    });
    const max = Math.max(1, ...bins.map((b) => b.count));
    bins.forEach((b, i) => {
      const group = document.createElement('div');
      group.className = 'bar-group';
      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.height = b.count ? `${Math.max(5, (b.count / max) * 100)}%` : '0%';
      const start = i * 10 - 70;
      bar.title = `${start}–${start + 9} marks: ${b.count} ${b.count === 1 ? 'entry' : 'entries'}`;
      const label = document.createElement('span');
      label.className = 'bar-label';
      label.textContent = i % 2 === 0 ? b.label : '';
      group.append(bar, label);
      host.appendChild(group);
    });
    $('chart-empty').classList.toggle('show', data.length === 0);
  }

  function render() {
    const data = filteredRows();
    const scores = data.map(score).sort((a, b) => a - b);
    $('entry-count').textContent = fmt(data.length);
    const med = quantile(scores, .5), q1 = quantile(scores, .25), q3 = quantile(scores, .75);
    $('median-score').innerHTML = med === null ? '—<small>/ 200</small>' : `${fmt(med)}<small>/ 200</small>`;
    $('score-range').textContent = q1 === null ? '—' : `${fmt(q1)} – ${fmt(q3)}`;
    $('min-score').textContent = scores.length ? `${fmt(scores[0])} / 200` : '—';
    $('max-score').textContent = scores.length ? `${fmt(scores[scores.length - 1])} / 200` : '—';
    const qualifying = data.filter((r) => number(r.paper1) >= 35 && number(r.paper2) >= 35).length;
    $('qualifying-count').textContent = data.length ? `${fmt(qualifying)} of ${fmt(data.length)}` : '—';
    $('estimate-count').textContent = fmt(data.filter((r) => r.score_basis === 'answer-key').length);
    $('official-count').textContent = fmt(data.filter((r) => r.score_basis === 'official-result').length);
    $('qualified-rate').textContent = data.length ? `${Math.round(qualifying * 100 / data.length)}%` : '—';
    $('updated-at').textContent = `${rows.length.toLocaleString('en-IN')} record${rows.length === 1 ? '' : 's'} saved in this browser`;
    $('dashboard-message').textContent = data.length
      ? `Showing ${fmt(data.length)} locally stored candidate ${data.length === 1 ? 'entry' : 'entries'} for this score pool.`
      : 'No candidate entries in this score pool yet. Imported and entered records are stored only on this device.';
    drawChart(data);
    $('clear-data-button').disabled = rows.length === 0;
  }

  function setPoolHint() {
    const count = seatCounts[`${$('department').value}|${$('area').value}`];
    $('pool-hint').textContent = count === 0
      ? 'The notification lists no SC seats for this pool. You may still enter an eligible score for your own records.'
      : 'Choose the department and area matching your application. Scheduled Area eligibility is restricted by the notification.';
  }

  function refreshTotal() {
    const a = $('paper1').value, b = $('paper2').value, chip = $('qualify-preview');
    if (a === '' || b === '') {
      $('total-preview').innerHTML = '— <small>/ 200</small>';
      chip.textContent = 'Enter both papers'; chip.className = 'qualify-chip'; return;
    }
    const p1 = Number(a), p2 = Number(b);
    if (!Number.isFinite(p1) || !Number.isFinite(p2)) return;
    $('total-preview').innerHTML = `${fmt(p1 + p2)} <small>/ 200</small>`;
    const pass = p1 >= 35 && p2 >= 35;
    chip.textContent = pass ? 'Meets 35% per-paper check' : 'Below 35% in one or both papers';
    chip.className = `qualify-chip ${pass ? 'pass' : 'fail'}`;
  }

  function exportData() {
    const backup = {
      schemaVersion: 1,
      recruitment: RECRUITMENT,
      category: 'SC',
      exportedAt: new Date().toISOString(),
      entries: rows
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bci-2026-sc-candidate-data.json';
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    $('dashboard-message').textContent = `Exported ${rows.length} local candidate ${rows.length === 1 ? 'entry' : 'entries'} to a JSON backup file.`;
  }

  async function importData(file) {
    const feedback = $('form-feedback');
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      feedback.textContent = 'The selected file is larger than 5 MB.';
      feedback.classList.add('error'); return;
    }
    try {
      const backup = JSON.parse(await file.text());
      if (backup.schemaVersion !== 1 || backup.recruitment !== RECRUITMENT || backup.category !== 'SC' || !Array.isArray(backup.entries)) {
        throw new Error('This is not a supported BCI 2026 SC data backup.');
      }
      const incoming = backup.entries.filter(validRow).map((r) => ({
        id: typeof r.id === 'string' ? r.id : crypto.randomUUID(),
        category: 'SC',
        department: r.department,
        area: r.area,
        paper1: Number(r.paper1),
        paper2: Number(r.paper2),
        score_basis: r.score_basis,
        created_at: r.created_at || new Date().toISOString()
      }));
      const merged = new Map(rows.map((r) => [r.id, r]));
      incoming.forEach((r) => { if (!merged.has(r.id)) merged.set(r.id, r); });
      rows = Array.from(merged.values());
      if (!saveRows()) throw new Error('This browser could not save the imported data. Export a backup and check available browser storage.');
      render();
      feedback.classList.remove('error');
      feedback.textContent = `Imported ${incoming.length} valid records. ${rows.length} unique records are now stored on this device.`;
    } catch (error) {
      feedback.textContent = error.message || 'The selected file could not be read.';
      feedback.classList.add('error');
    } finally {
      $('import-file').value = '';
    }
  }

  $('pool-filter').addEventListener('change', render);
  $('department').addEventListener('change', setPoolHint);
  $('area').addEventListener('change', setPoolHint);
  $('paper1').addEventListener('input', refreshTotal);
  $('paper2').addEventListener('input', refreshTotal);
  $('export-button').addEventListener('click', exportData);
  $('import-button').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', (e) => importData(e.target.files[0]));
  $('clear-data-button').addEventListener('click', () => {
    if (!rows.length) return;
    if (window.confirm(`Delete all ${rows.length} locally stored candidate entries from this browser? Export a backup first if you may need these records.`)) {
      rows = [];
      if (saveRows()) {
        render();
        $('form-feedback').classList.remove('error');
        $('form-feedback').textContent = 'Local candidate records deleted from this browser.';
      }
    }
  });

  $('score-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const feedback = $('form-feedback');
    feedback.classList.remove('error');
    const p1 = Number($('paper1').value), p2 = Number($('paper2').value);
    if (p1 < -33.34 || p1 > 100 || p2 < -33.34 || p2 > 100) {
      feedback.textContent = 'Enter each paper score between −33.34 and 100.';
      feedback.classList.add('error'); return;
    }
    const row = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      category: 'SC',
      department: $('department').value,
      area: $('area').value,
      paper1: p1,
      paper2: p2,
      score_basis: $('score-basis').value,
      created_at: new Date().toISOString()
    };
    rows.push(row);
    if (!saveRows()) {
      rows.pop();
      feedback.textContent = 'The browser could not save this entry. Export a backup or free local storage space and try again.';
      feedback.classList.add('error'); return;
    }
    render();
    feedback.textContent = 'Score saved in this browser only. Export the data file if you want to back it up or transfer it.';
    $('score-form').reset();
    refreshTotal();
  });

  setPoolHint(); refreshTotal();
  setConnection(storageAvailable ? 'Local data ready' : 'Local storage unavailable', storageAvailable ? 'connected' : 'offline');
  render();
})();
