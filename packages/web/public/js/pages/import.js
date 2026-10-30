// ROF CRM — Import Data Page

Pages.importPage = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <style>
      .imn { max-width:1100px; margin:0 auto; --bg2:var(--surface2) }
      #content:has(.imn) { margin-left:auto; margin-right:auto; width:100% }
      .imn .tabs-line { display:flex; gap:8px; flex-wrap:wrap; border-bottom:none; margin-bottom:16px }
      .imn .tab-line { padding:7px 16px; font-size:12.5px; border:1px solid var(--border2); border-radius:999px; background:var(--surface); color:var(--text2); cursor:pointer; transition:.15s }
      .imn .tab-line:hover { border-color:var(--teal); color:var(--teal) }
      .imn .tab-line.active { background:var(--teal); color:#fff; border-color:var(--teal); font-weight:600 }
      .imn .sp { border-radius:10px; overflow:hidden }
      .imn .sp-hdr { padding:14px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:flex-start; gap:10px }
      .imn .sp-title { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
      .imn .sp-body { padding:18px }
      .imn-step { width:22px; height:22px; border-radius:50%; background:var(--teal); color:#fff; font-size:11px; font-weight:700; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0 }
      .imn .fg { gap:6px }
      .imn .fl { font-size:11px; font-weight:500; text-transform:none; letter-spacing:.3px; color:var(--text2) }
      .imn .fc { padding:9px 12px; font-size:13px; border-radius:8px; min-height:38px }
      .imn .fc:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg) }
      .imn .btn-teal { background:var(--teal); color:#fff; border:none; padding:9px 28px; border-radius:8px; font-size:12.5px; font-weight:600; min-height:40px; cursor:pointer }
      .imn .btn-teal:hover:not(:disabled) { filter:brightness(.92) }
      .imn .btn-teal:disabled { opacity:.5; cursor:not-allowed }
      .imn .btn-ghost.btn-lg { border-radius:8px; min-height:40px; padding:9px 24px; font-size:12.5px }
      .imn .btn-ghost.btn-sm { border-radius:6px; min-height:28px; padding:4px 12px; font-size:12px }
      .imn #imp-dropzone { background:var(--surface2); border:2px dashed var(--border2); border-radius:12px; padding:44px 20px; text-align:center; cursor:pointer; transition:border-color .2s, background .2s }
      .imn #imp-dropzone:hover { border-color:var(--teal); background:var(--teal-bg) }
      .imn .tbl-wrap { background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:auto }
      .imn table { width:100%; border-collapse:collapse; font-size:12.5px }
      .imn table th { background:var(--surface2); color:var(--text3); font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; padding:10px 14px; text-align:left; white-space:nowrap; border-bottom:1px solid var(--border2) }
      .imn table td { padding:9px 14px; border-bottom:1px solid var(--border); color:var(--text) }
      .imn table tbody tr:hover td { background:var(--surface2) }
      .imn #imp-history-body { background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:auto }
      .imn .empty-state { padding:36px 18px; text-align:center; color:var(--text3) }
      .imn .empty-state h3 { font-size:14px; font-weight:600; color:var(--text2); margin:0 0 4px }
      .imn .alert { border-radius:8px; padding:10px 14px; font-size:12.5px }
    </style>
    <div class="imn">
    <div class="page-hdr">
      <h1>Import Data</h1>
      <div class="breadcrumb">Settings / <b>Import</b></div>
    </div>
    <div class="tabs-line">
      <button class="tab-line active" data-group="imp" data-tab="upload" onclick="switchTab('imp','upload')">Upload</button>
      <button class="tab-line" data-group="imp" data-tab="history" onclick="switchTab('imp','history');ImportPage.loadHistory()">Import History</button>
    </div>

    <!-- UPLOAD TAB -->
    <div data-panel-group="imp" data-panel="upload">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><span class="imn-step">1</span><div class="sp-title">Import Settings</div></div>
        <div class="sp-body">
          <div class="sp-grid">
            <div class="fg"><label class="fl"><span class="r">*</span>Data Type</label>
              <select class="fc" id="imp-type" onchange="ImportPage.onTypeChange(this.value)">
                <option value="units" selected>Units / Inventory (CSV)</option>
              </select>
            </div>
            <div class="fg" id="imp-project-wrap"><label class="fl"><span class="r">*</span>Project</label>
              <select class="fc" id="imp-project"></select>
            </div>
            <div class="fg"><label class="fl">Duplicates</label>
              <div style="font-size:12px;color:var(--text2);padding:9px 0">A unit that already exists in its tower is skipped. One wrong row stops the whole file and nothing is imported.</div>
            </div>
          </div>
        </div>
      </div>
      <div style="font-size:11.5px;color:var(--text3);margin-bottom:12px">Applicants are made on the Booking screen and E-Draw results come in on Allotment → E-Draw Import.</div>

      <!-- Template download -->
      <div id="imp-template-bar" style="margin-bottom:12px">
        <div class="alert alert-info">
          Columns: unitNumber, tower, floor, bhkType, totalPriceInr (needed) and carpetAreaSqft, superAreaSqft, balconyAreaSqft, basePriceInr, facing (optional).
          <button class="btn btn-ghost btn-sm" style="margin-left:10px" onclick="ImportPage.downloadTemplate()">Download Template CSV</button>
        </div>
      </div>

      <!-- Drag & Drop Zone -->
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><span class="imn-step">2</span><div class="sp-title">Upload File</div></div>
        <div class="sp-body">
          <div id="imp-dropzone"
            ondragover="event.preventDefault();this.style.borderColor='var(--teal)'"
            ondragleave="this.style.borderColor='var(--border2)'"
            ondrop="ImportPage.onDrop(event)"
            onclick="document.getElementById('imp-file').click()">
            <div style="font-size:40px;margin-bottom:8px">📂</div>
            <div style="font-size:14px;font-weight:600;margin-bottom:4px">Drag & Drop a CSV file here</div>
            <div style="font-size:12px;color:var(--text3)">Or click to browse · Accepted: .csv (up to 2 MB, 5000 rows)</div>
            <input type="file" id="imp-file" style="display:none" accept=".csv" onchange="ImportPage.onFileSelect(this.files[0])">
          </div>
          <div id="imp-file-info" style="margin-top:8px;display:none">
            <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--surface2);border:1px solid var(--border2);border-radius:8px">
              <span style="font-size:20px">📄</span>
              <div>
                <div id="imp-file-name" style="font-weight:600;font-size:12px"></div>
                <div id="imp-file-size" style="font-size:10.5px;color:var(--text3)"></div>
              </div>
              <button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="ImportPage.clearFile()">✕ Remove</button>
            </div>
          </div>
        </div>
      </div>

      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <span class="imn-step">3</span>
        <button class="btn btn-ghost btn-lg" onclick="ImportPage.preview()" id="imp-preview-btn" disabled>Preview Data</button>
        <button class="btn btn-teal btn-lg" onclick="ImportPage.confirm()" id="imp-confirm-btn" disabled>Confirm Import</button>
      </div>

      <!-- Preview table -->
      <div id="imp-preview" style="margin-top:16px"></div>
      <!-- Result -->
      <div id="imp-result" style="margin-top:12px"></div>
    </div>

    <!-- HISTORY TAB -->
    <div data-panel-group="imp" data-panel="history" style="display:none">
      <div id="imp-history-body"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>
    </div>
  `;

  await ImportPage.init();
};

const ImportPage = {
  _file: null,
  _previewData: null,

  async init() {
    try { document.getElementById('imp-project').innerHTML = await Utils.projectOptions('— Choose a project —'); } catch {}
  },

  onTypeChange() {},

  onDrop(event) {
    event.preventDefault();
    document.getElementById('imp-dropzone').style.borderColor = 'var(--border2)';
    const file = event.dataTransfer.files[0];
    if (file) this.onFileSelect(file);
  },

  onFileSelect(file) {
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) { Utils.warn('Please select a CSV file'); return; }
    if (file.size > 2_000_000) { Utils.warn('The file is too large (2 MB at most)'); return; }

    this._file = file;
    document.getElementById('imp-file-info').style.display = 'block';
    document.getElementById('imp-file-name').textContent = file.name;
    document.getElementById('imp-file-size').textContent = `${(file.size/1024).toFixed(1)} KB`;
    document.getElementById('imp-preview-btn').disabled = false;
    document.getElementById('imp-confirm-btn').disabled = false;
  },

  clearFile() {
    this._file = null;
    this._previewData = null;
    document.getElementById('imp-file').value = '';
    document.getElementById('imp-file-info').style.display = 'none';
    document.getElementById('imp-preview-btn').disabled = true;
    document.getElementById('imp-confirm-btn').disabled = true;
    document.getElementById('imp-preview').innerHTML = '';
  },

  // the CSV is read here and sent as text (the server does not take a file upload)
  async _body(withProject) {
    const projectId = document.getElementById('imp-project')?.value;
    if (withProject && !projectId) { Utils.warn('Please choose a project'); return null; }
    return { importType: 'units', csvText: await this._file.text(), fileName: this._file.name, projectId: projectId || undefined };
  },

  async preview() {
    if (!this._file) { Utils.warn('Please select a file first'); return; }
    const body = await this._body(false);
    const el = document.getElementById('imp-preview');
    el.innerHTML = '<div class="page-loading"><div class="spinner"></div> Reading file…</div>';
    try {
      const d = (await Api.post('/import/preview', body)).data;
      this._previewData = d;
      const errors = d.errors || [];
      el.innerHTML = `
        <div class="alert ${errors.length ? 'alert-warn' : 'alert-success'}" style="margin-bottom:12px">
          ${errors.length ? '⚠ ' : '✓ '}${d.totalRows} rows read · ${d.validRows} good · ${d.errorRows} with problems
          ${d.alreadyInProject != null ? ` · ${d.alreadyInProject} already in this project (will be skipped)` : ''}
          ${errors.length ? ' · nothing is imported until every row is right' : ''}
        </div>
        ${errors.length ? `<div style="margin-bottom:12px;font-size:11px;color:var(--warn)">
          ${errors.slice(0,10).map(e => `<div>Row ${e.row} (${Utils.esc(e.unit || 'no unit number')}): ${Utils.esc(e.reason)}</div>`).join('')}
          ${d.errorRows > 10 ? `<div>... and ${d.errorRows - 10} more</div>` : ''}
        </div>` : ''}
        ${d.preview.length ? `<div class="tbl-wrap"><table>
          <thead><tr>${Object.keys(d.preview[0]).map(k => `<th>${Utils.esc(k)}</th>`).join('')}</tr></thead>
          <tbody>${d.preview.map(row => `<tr>${Object.values(row).map(v => `<td style="font-size:10.5px">${Utils.esc(v || '—')}</td>`).join('')}</tr>`).join('')}
            ${d.totalRows > 10 ? `<tr><td colspan="${Object.keys(d.preview[0]).length}" style="text-align:center;color:var(--text3);font-size:11px">... and ${d.totalRows - 10} more rows</td></tr>` : ''}
          </tbody>
        </table></div>` : ''}`;
    } catch (err) {
      el.innerHTML = `<div class="alert alert-error">Preview failed: ${Utils.esc(err.message)}</div>`;
    }
  },

  async confirm() {
    if (!this._file) { Utils.warn('Please select a file first'); return; }
    const body = await this._body(true);
    if (!body) return;
    Utils.confirm('Import these units into the chosen project? This cannot be undone.', async () => {
      const result = document.getElementById('imp-result');
      result.innerHTML = '<div class="page-loading"><div class="spinner"></div> Importing…</div>';
      try {
        const d = (await Api.post('/import', body)).data;
        result.innerHTML = `
          <div class="alert alert-success">
            ✓ Import complete! Created: <strong>${d.created}</strong> · Skipped (already there): <strong>${d.skipped}</strong> · Rows in file: <strong>${d.totalRows}</strong>
          </div>`;
        this.clearFile();
      } catch (err) {
        result.innerHTML = `<div class="alert alert-error">Import failed: ${Utils.esc(err.message)}</div>`;
      }
    });
  },

  downloadTemplate() { Utils.downloadUnitTemplate(); },

  async loadHistory() {
    const el = document.getElementById('imp-history-body');
    if (!el) return;
    try {
      const res = await Api.get('/import/history', { params: { pageSize: 50 } });
      const list = res.data || res || [];
      el.innerHTML = list.length === 0
        ? '<div class="empty-state"><h3>No import history</h3></div>'
        : `<table>
            <thead><tr><th>Date</th><th>Type</th><th>File</th><th>Created</th><th>Skipped</th><th>Problem rows</th><th>By</th><th>Status</th></tr></thead>
            <tbody>
              ${list.map(h => `<tr>
                <td style="font-size:10.5px">${Utils.date(h.created_at)}</td>
                <td>${Utils.chip(h.import_type || 'units')}</td>
                <td style="font-size:10.5px">${Utils.esc(h.file_name || '—')}</td>
                <td style="color:var(--green);font-weight:600">${h.created_rows || 0}</td>
                <td>${h.skipped_rows || 0}</td>
                <td style="${h.error_rows > 0 ? 'color:var(--red);font-weight:600' : ''}">${h.error_rows || 0}</td>
                <td style="font-size:10.5px">${Utils.esc(h.imported_by_name || '—')}</td>
                <td>${Utils.chip(h.status || 'completed')}</td>
              </tr>`).join('')}
            </tbody>
          </table>`;
    } catch (err) {
      el.innerHTML = `<div style="padding:20px;color:var(--red)">${Utils.esc(err.message)}</div>`;
    }
  },
};
