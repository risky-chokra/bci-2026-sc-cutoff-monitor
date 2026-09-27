(() => {
  'use strict';
  const DB_NAME = 'bci-2026-sc-candidates';
  const STORE = 'entries';
  const DB_VERSION = 1;
  const LEGACY_KEY = 'bci2026_sc_candidate_scores_v1';
  const RECRUITMENT = 'rssb-basic-computer-instructor-2026';
  const MIN_PER_PAPER = 35;
  const $ = (id) => document.getElementById(id);
  let db = null;
  let rows = [];
  let dbReady = false;
  let persistentGranted = false;

  const fmt = (n, decimals = 2) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: decimals, minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 1 });
  const total = (r) => Number(r.paper1) + Number(r.paper2);
  const qualified = (r) => Number(r.paper1) >= MIN_PER_PAPER && Number(r.paper2) >= MIN_PER_PAPER;
  const areaName = (v) => v === 'tsp' ? 'TSP' : v === 'non-tsp' ? 'Non-TSP' : 'Area not recorded';
  const setStatus = (text, ok = true) => {
    const e = $('connection-status');
    e.classList.toggle('connected', ok);
    e.classList.toggle('offline', !ok);
    e.lastElementChild.textContent = text;
  };
  const newId = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  function normalizeRecord(r) {
    if (!r || (r.category && r.category !== 'SC')) return null;
    if (r.paper1 === '' || r.paper1 == null || r.paper2 === '' || r.paper2 == null) return null;
    const p1 = Number(r.paper1), p2 = Number(r.paper2);
    if (!Number.isFinite(p1) || !Number.isFinite(p2) || p1 < -33.34 || p1 > 100 || p2 < -33.34 || p2 > 100) return null;
    let area = r.area;
    if (area === 'scheduled') area = 'tsp';
    if (area === 'non-scheduled') area = 'non-tsp';
    if (!['tsp', 'non-tsp'].includes(area)) area = 'unrecorded';
    return {
      id: typeof r.id === 'string' && r.id ? r.id : newId(),
      category: 'SC',
      area,
      paper1: p1,
      paper2: p2,
      created_at: typeof r.created_at === 'string' ? r.created_at : new Date().toISOString()
    };
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('This browser does not support IndexedDB.'));
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open the local database.'));
      request.onblocked = () => reject(new Error('The local database is busy in another tab. Close other copies and refresh.'));
    });
  }
  function transactionDone(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Database transaction failed.'));
      tx.onabort = () => reject(tx.error || new Error('Database transaction was cancelled.'));
    });
  }
  async function getAllRows() {
    const tx = db.transaction(STORE, 'readonly');
    const done = transactionDone(tx);
    const request = tx.objectStore(STORE).getAll();
    const result = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    await done;
    return result.map(normalizeRecord).filter(Boolean);
  }
  async function putRecord(record) {
    const tx = db.transaction(STORE, 'readwrite');
    const done = transactionDone(tx);
    tx.objectStore(STORE).put(record);
    await done;
  }
  async function replaceAllRecords(records) {
    const tx = db.transaction(STORE, 'readwrite');
    const done = transactionDone(tx);
    const store = tx.objectStore(STORE);
    store.clear();
    records.forEach((r) => store.put(r));
    await done;
  }
  async function clearAllRecords() {
    const tx = db.transaction(STORE, 'readwrite');
    const done = transactionDone(tx);
    tx.objectStore(STORE).clear();
    await done;
  }
  async function migrateLegacyData() {
    let old;
    try { old = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null'); } catch (_) { old = null; }
    if (!Array.isArray(old) || old.length === 0) return;
    const current = await getAllRows();
    if (current.length) return;
    const migrated = old.map(normalizeRecord).filter(Boolean);
    if (migrated.length) {
      await replaceAllRecords(migrated);
      localStorage.removeItem(LEGACY_KEY);
    }
  }
  async function initDatabase() {
    setStatus('Opening local database', false);
    try {
      db = await openDatabase();
      await migrateLegacyData();
      rows = await getAllRows();
      if (navigator.storage && navigator.storage.persist) {
        try { persistentGranted = await navigator.storage.persist(); } catch (_) { persistentGranted = false; }
      }
      dbReady = true;
      setStatus(persistentGranted ? 'Local database · persistent' : 'Local database ready', true);
      $('dashboard-message').textContent = persistentGranted
        ? 'Scores are saved in the persistent local database on this device.'
        : 'Scores are saved in this browser database. Export backups regularly; browser data can be cleared by the device owner.';
      $('submit-button').disabled = false;
      $('export-button').disabled = false;
      $('excel-button').disabled = false;
      $('pdf-button').disabled = false;
      $('import-button').disabled = false;
      $('clear-data-button').disabled = rows.length === 0;
      render();
    } catch (error) {
      setStatus('Local database unavailable', false);
      $('dashboard-message').textContent = error.message || 'The local database could not be opened. Try a current browser over HTTPS.';
      $('form-feedback').textContent = 'Scores cannot be saved until local database access is available.';
      $('form-feedback').classList.add('error');
      $('submit-button').disabled = true;
      $('import-button').disabled = true;
      $('export-button').disabled = true;
      $('excel-button').disabled = true;
      $('pdf-button').disabled = true;
    }
  }

  function selectedRows() {
    const area = $('area-filter').value;
    return rows.filter((r) => area === 'all' || r.area === area);
  }
  function analysisRows(areaRows) {
    return $('eligibility-filter').value === 'qualified' ? areaRows.filter(qualified) : areaRows;
  }
  function quantile(values, q) {
    if (!values.length) return null;
    const pos = (values.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return values[lo] + (values[hi] - values[lo]) * (pos - lo);
  }
  function drawChart(data) {
    const host = $('distribution');
    host.innerHTML = '';
    const bins = Array.from({ length: 28 }, (_, i) => ({ label: `${i * 10 - 70}`, count: 0 }));
    data.forEach((r) => bins[Math.max(0, Math.min(27, Math.floor((total(r) + 70) / 10)))].count++);
    const max = Math.max(1, ...bins.map((b) => b.count));
    bins.forEach((b, i) => {
      const group = document.createElement('div'); group.className = 'bar-group';
      const bar = document.createElement('div'); bar.className = 'bar';
      bar.style.height = b.count ? `${Math.max(5, b.count / max * 100)}%` : '0%';
      const start = i * 10 - 70;
      bar.title = `${start}–${start + 9}: ${b.count} ${b.count === 1 ? 'entry' : 'entries'}`;
      const label = document.createElement('span'); label.className = 'bar-label';
      label.textContent = i % 2 === 0 ? b.label : '';
      group.append(bar, label); host.appendChild(group);
    });
    const empty = $('chart-empty');
    empty.classList.toggle('show', data.length === 0);
    const areaRows = selectedRows();
    $('chart-empty-title').textContent = areaRows.length ? 'No qualified candidates in this area yet' : 'No candidate entries in this area yet';
    $('chart-empty-detail').textContent = areaRows.length ? 'Switch the analysis set to include all entries.' : 'Add a candidate score or import a JSON backup.';
  }
  function render() {
    const areaRows = selectedRows();
    const eligible = areaRows.filter(qualified);
    const active = analysisRows(areaRows);
    const scores = active.map(total).sort((a, b) => a - b);
    $('entry-count').textContent = fmt(areaRows.length, 0);
    $('qualified-entry-count').textContent = fmt(eligible.length, 0);
    $('qualified-rate').textContent = areaRows.length ? `${Math.round(eligible.length * 100 / areaRows.length)}%` : '—';
    $('median-score').innerHTML = scores.length ? `${fmt(quantile(scores, .5))}<small>/ 200</small>` : '—<small>/ 200</small>';
    $('median-foot').textContent = $('eligibility-filter').value === 'qualified' ? 'Qualified entries only' : 'All entries in selected area';
    $('analysis-count').textContent = fmt(active.length, 0);
    const q1 = quantile(scores, .25), q3 = quantile(scores, .75);
    $('score-range').textContent = scores.length ? `${fmt(q1)}–${fmt(q3)}` : '—';
    $('score-extremes').textContent = scores.length ? `${fmt(scores[0])} / ${fmt(scores[scores.length - 1])}` : '—';
    $('below-count').textContent = fmt(areaRows.length - eligible.length, 0);
    $('chart-subtitle').textContent = `${$('eligibility-filter').value === 'qualified' ? 'Qualified candidates' : 'All candidates'} · ${$('area-filter').value === 'all' ? 'All areas' : areaName($('area-filter').value)} · 10-mark bands`;
    $('dashboard-message').textContent = `${fmt(areaRows.length, 0)} local ${areaRows.length === 1 ? 'entry' : 'entries'} in this area; ${fmt(eligible.length, 0)} meet the SC minimum of 35 marks in each paper. The analysis set is ${$('eligibility-filter').value === 'qualified' ? 'qualified candidates only' : 'all candidate entries'}.`;
    $('updated-at').textContent = `${fmt(rows.length, 0)} total record${rows.length === 1 ? '' : 's'} saved in this browser database`;
    const tspRows = rows.filter((r) => r.area === 'tsp'), nontspRows = rows.filter((r) => r.area === 'non-tsp');
    $('tsp-entry-count').textContent = fmt(tspRows.length, 0);
    $('tsp-qualified-count').textContent = fmt(tspRows.filter(qualified).length, 0);
    $('nontsp-entry-count').textContent = fmt(nontspRows.length, 0);
    $('nontsp-qualified-count').textContent = fmt(nontspRows.filter(qualified).length, 0);
    $('clear-data-button').disabled = rows.length === 0;
    drawChart(active);
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
    const pass = p1 >= MIN_PER_PAPER && p2 >= MIN_PER_PAPER;
    chip.textContent = pass ? 'Meets SC minimum · 35 in each paper' : 'Not qualified · 35 needed in each paper';
    chip.className = `qualify-chip ${pass ? 'pass' : 'fail'}`;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function exportJson() {
    const data = { schemaVersion: 4, recruitment: RECRUITMENT, category: 'SC', exportedAt: new Date().toISOString(), entries: rows };
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'bci-2026-sc-database-backup.json');
    $('dashboard-message').textContent = `JSON backup exported with all ${rows.length} database records.`;
  }
  async function importJson(file) {
    const feedback = $('form-feedback');
    if (!file) return;
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error('The file is over the 25 MB import limit.');
      const data = JSON.parse(await file.text());
      if (![1, 2, 3, 4].includes(data.schemaVersion) || data.recruitment !== RECRUITMENT || data.category !== 'SC' || !Array.isArray(data.entries)) throw new Error('This is not a supported BCI 2026 SC database backup.');
      const incoming = data.entries.map(normalizeRecord).filter(Boolean);
      const merged = new Map(rows.map((r) => [r.id, r]));
      incoming.forEach((r) => { if (!merged.has(r.id)) merged.set(r.id, r); });
      const next = Array.from(merged.values());
      await replaceAllRecords(next);
      rows = next; render(); feedback.classList.remove('error');
      feedback.textContent = `Imported ${incoming.length} valid records; ${rows.length} unique records are now saved in this browser database.`;
    } catch (e) { feedback.textContent = e.message || 'The selected JSON file could not be imported.'; feedback.classList.add('error'); }
    finally { $('import-file').value = ''; }
  }

  const SEATS = [
    { dept: 'Secondary Education', area: 'Non-TSP', backlog: 694, current: 185, total: 879 },
    { dept: 'Secondary Education', area: 'TSP', backlog: 30, current: 13, total: 43 },
    { dept: 'Sanskrit Education', area: 'Non-TSP', backlog: 0, current: 23, total: 23 },
    { dept: 'Sanskrit Education', area: 'TSP', backlog: 0, current: 0, total: 0 }
  ];
  function excelCell(value, rowIndex, colIndex) {
    const ref = `${columnName(colIndex + 1)}${rowIndex + 1}`;
    if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"${rowIndex === 0 ? ' s="1"' : ''} t="n"><v>${value}</v></c>`;
    const text = xmlEscape(value == null ? '' : String(value));
    return `<c r="${ref}"${rowIndex === 0 ? ' s="1"' : ''} t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
  }
  function columnName(n) { let s = ''; while (n) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; }
  function xmlEscape(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'); }
  function sheetXml(data) {
    const rowsXml = data.map((r, i) => `<row r="${i + 1}">${r.map((v, j) => excelCell(v, i, j)).join('')}</row>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="18"/><sheetData>${rowsXml}</sheetData><autoFilter ref="A1:${columnName(Math.max(...data.map(r => r.length)))}${Math.max(1, data.length)}"/></worksheet>`;
  }
  function crc32(bytes) {
    let crc = -1;
    for (const b of bytes) { crc ^= b; for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1)); }
    return (crc ^ -1) >>> 0;
  }
  function joinBytes(parts) {
    const length = parts.reduce((a, b) => a + b.length, 0), result = new Uint8Array(length); let offset = 0;
    parts.forEach((p) => { result.set(p, offset); offset += p.length; }); return result;
  }
  function le16(n) { return Uint8Array.of(n & 255, (n >>> 8) & 255); }
  function le32(n) { return Uint8Array.of(n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255); }
  function zipStore(files) {
    const encoder = new TextEncoder(), locals = [], centrals = []; let offset = 0;
    for (const [name, content] of Object.entries(files)) {
      const fileName = encoder.encode(name), data = typeof content === 'string' ? encoder.encode(content) : content, crc = crc32(data);
      const local = joinBytes([le32(0x04034b50), le16(20), le16(0), le16(0), le16(0), le16(33), le32(crc), le32(data.length), le32(data.length), le16(fileName.length), le16(0), fileName, data]);
      locals.push(local);
      const central = joinBytes([le32(0x02014b50), le16(20), le16(20), le16(0), le16(0), le16(0), le16(33), le32(crc), le32(data.length), le32(data.length), le16(fileName.length), le16(0), le16(0), le16(0), le16(0), le32(0), le32(offset), fileName]);
      centrals.push(central); offset += local.length;
    }
    const centralData = joinBytes(centrals), end = joinBytes([le32(0x06054b50), le16(0), le16(0), le16(centrals.length), le16(centrals.length), le32(centralData.length), le32(offset), le16(0)]);
    return new Blob([...locals, centralData, end], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  function exportExcel() {
    const entries = [['Category', 'Area', 'Paper I', 'Paper II', 'Total', 'Minimum qualification', 'Saved at']];
    rows.forEach((r) => entries.push(['SC', areaName(r.area), r.paper1, r.paper2, total(r), qualified(r) ? 'Qualified' : 'Below minimum', r.created_at]));
    const areaSummary = [['Area', 'SC seats', 'Candidate entries', 'Qualified entries', 'Below minimum', 'Qualified median total']];
    [['Non-TSP', 'non-tsp', 902], ['TSP', 'tsp', 43], ['Area not recorded', 'unrecorded', 0]].forEach(([name, key, seats]) => {
      const group = rows.filter((r) => r.area === key), eligible = group.filter(qualified), sorted = eligible.map(total).sort((a, b) => a - b);
      areaSummary.push([name, seats, group.length, eligible.length, group.length - eligible.length, sorted.length ? quantile(sorted, .5) : '']);
    });
    const vacancy = [['Department', 'Area', 'SC backlog', 'Current SC vacancies', 'Total SC seats']];
    SEATS.forEach((s) => vacancy.push([s.dept, s.area, s.backlog, s.current, s.total]));
    vacancy.push(['TOTAL', '', 724, 221, 945]);
    const sheets = [['Candidate Scores', entries], ['Area Summary', areaSummary], ['Official SC Seats', vacancy]];
    const files = {
      '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
      '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${xmlEscape(s[0])}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`,
      'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      'xl/styles.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF4169E1"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
    };
    sheets.forEach((s, i) => { files[`xl/worksheets/sheet${i+1}.xml`] = sheetXml(s[1]); });
    downloadBlob(zipStore(files), 'bci-2026-sc-candidate-database.xlsx');
    $('dashboard-message').textContent = `Excel workbook exported with all ${rows.length} database records, TSP/Non-TSP summaries and official SC seats.`;
  }

  function exportPdf() {
    const w = window.open('', '_blank');
    if (!w) { $('dashboard-message').textContent = 'Allow pop-ups to create the printable PDF report.'; return; }
    const bodyRows = rows.map((r) => `<tr><td>SC</td><td>${areaName(r.area)}</td><td>${fmt(r.paper1)}</td><td>${fmt(r.paper2)}</td><td>${fmt(total(r))}</td><td>${qualified(r) ? 'Qualified' : 'Below minimum'}</td><td>${xmlEscape(r.created_at)}</td></tr>`).join('');
    const qualifiedCount = rows.filter(qualified).length;
    w.document.open();
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>BCI 2026 SC Candidate Database</title><style>body{font:12px Arial,sans-serif;color:#1d293b;margin:28px}h1{font-size:20px;margin:0 0 6px}p{color:#56657a;font-size:11px}table{border-collapse:collapse;width:100%;font-size:9px;margin-top:18px}th,td{border:1px solid #ccd4df;padding:6px;text-align:left}th{background:#edf2ff}tr{page-break-inside:avoid}.note{margin-top:18px;border-top:1px solid #ccd4df;padding-top:10px}@media print{body{margin:12mm}}</style></head><body><h1>RSSB Basic Computer Instructor 2026 — SC Candidate Database</h1><p>Local records: ${rows.length} · Qualified (35+ in each paper): ${qualifiedCount} · Generated ${new Date().toLocaleString('en-IN')}</p><p>Candidate-entered data only. Not an official cut-off, merit list or selection prediction.</p><table><thead><tr><th>Category</th><th>Area</th><th>Paper I</th><th>Paper II</th><th>Total</th><th>Minimum check</th><th>Saved at</th></tr></thead><tbody>${bodyRows || '<tr><td colspan="7">No candidate entries saved.</td></tr>'}</tbody></table><h2 class="note">Official SC seats</h2><table><thead><tr><th>Area</th><th>Department</th><th>Backlog SC</th><th>Current SC</th><th>Total SC</th></tr></thead><tbody>${SEATS.map(s=>`<tr><td>${s.area}</td><td>${s.dept}</td><td>${s.backlog}</td><td>${s.current}</td><td>${s.total}</td></tr>`).join('')}<tr><th colspan="2">Total</th><th>724</th><th>221</th><th>945</th></tr></tbody></table><p class="note">SC minimum qualification logic: at least 35 marks in each 100-mark paper, per RSSB Advertisement 07/2026, page 24. Select “Save as PDF” in the print dialog to download a PDF copy.</p></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 500);
    $('dashboard-message').textContent = 'PDF report opened in the print dialog. Choose “Save as PDF” to download it.';
  }

  $('area-filter').addEventListener('change', render);
  $('eligibility-filter').addEventListener('change', render);
  $('paper1').addEventListener('input', refreshTotal);
  $('paper2').addEventListener('input', refreshTotal);
  $('import-button').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', (e) => importJson(e.target.files[0]));
  $('export-button').addEventListener('click', exportJson);
  $('excel-button').addEventListener('click', exportExcel);
  $('pdf-button').addEventListener('click', exportPdf);
  $('clear-data-button').addEventListener('click', async () => {
    if (!rows.length || !dbReady) return;
    if (window.confirm(`Delete all ${rows.length} local candidate records? Export a backup first if you may need them.`)) {
      try { await clearAllRecords(); rows = []; render(); $('form-feedback').classList.remove('error'); $('form-feedback').textContent = 'All local candidate records were deleted.'; setStatus('Local database cleared'); }
      catch (_) { $('form-feedback').textContent = 'The database could not be cleared.'; $('form-feedback').classList.add('error'); }
    }
  });
  $('score-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const feedback = $('form-feedback'); feedback.classList.remove('error');
    if (!dbReady) { feedback.textContent = 'The local database is not ready yet.'; feedback.classList.add('error'); return; }
    const p1 = Number($('paper1').value), p2 = Number($('paper2').value), area = $('candidate-area').value;
    if (!['tsp', 'non-tsp'].includes(area)) { feedback.textContent = 'Select TSP or Non-TSP before saving.'; feedback.classList.add('error'); return; }
    if (!Number.isFinite(p1) || !Number.isFinite(p2) || p1 < -33.34 || p1 > 100 || p2 < -33.34 || p2 > 100) { feedback.textContent = 'Enter each paper score between −33.34 and 100, using up to two decimal places.'; feedback.classList.add('error'); return; }
    const row = { id: newId(), category: 'SC', area, paper1: p1, paper2: p2, created_at: new Date().toISOString() };
    const button = $('submit-button'); button.disabled = true; button.firstElementChild.textContent = 'Saving to local database…';
    try {
      await putRecord(row); rows.push(row); render();
      feedback.textContent = qualified(row) ? 'Saved. The entry meets the SC minimum marks check.' : 'Saved, but does not meet the SC minimum: 35 marks are required in each paper.';
      $('score-form').reset(); refreshTotal();
      setStatus(persistentGranted ? 'Local database · persistent' : 'Local database saved', true);
    } catch (_) {
      feedback.textContent = 'Could not save this record. Keep your marks and export a backup if possible, then try again.'; feedback.classList.add('error');
    } finally { button.disabled = false; button.firstElementChild.textContent = 'Save score on this device'; }
  });

  refreshTotal();
  render();
  initDatabase();
})();
