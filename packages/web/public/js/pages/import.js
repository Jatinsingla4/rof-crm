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
                <option value="">— Select Type —</option>
                <option value="consumers">Consumers / Leads</option>
                <option value="units">Units / Inventory</option>
                <option value="payments">Payment Records</option>
                <option value="edraw">E-Draw Results (TCP Haryana)</option>
              </select>
            </div>
            <div class="fg" id="imp-project-wrap"><label class="fl">Project (optional)</label>
              <select class="fc" id="imp-project">
                <option value="">— All Projects —</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Duplicate Handling</label>
              <select class="fc" id="imp-dup">
                <option value="skip">Skip duplicates</option>
                <option value="update">Update existing</option>
                <option value="error">Error on duplicate</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Template download -->
      <div id="imp-template-bar" style="display:none;margin-bottom:12px">
        <div class="alert alert-info">
          Download the CSV template for selected data type before uploading.
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
            <div style="font-size:14px;font-weight:600;margin-bottom:4px">Drag & Drop CSV or Excel file here</div>
            <div style="font-size:12px;color:var(--text3)">Or click to browse · Accepted: .csv, .xlsx, .xls</div>
            <input type="file" id="imp-file" style="display:none" accept=".csv,.xlsx,.xls" onchange="ImportPage.onFileSelect(this.files[0])">
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
    try {
      const res = await Api.get('/units', { params: { pageSize: 300 } });
      const units = res.data || res || [];
      const projects = [...new Map(
        units.filter(u => u.project_id||u.projectId)
             .map(u => [u.project_id||u.projectId, { id: u.project_id||u.projectId, name: u.project_name||u.projectName }])
      ).values()];
      const sel = document.getElementById('imp-project');
      if (sel) sel.innerHTML = '<option value="">— All Projects —</option>' +
        projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    } catch {}
  },

  onTypeChange(type) {
    const bar = document.getElementById('imp-template-bar');
    if (bar) bar.style.display = type ? 'block' : 'none';
  },

  onDrop(event) {
    event.preventDefault();
    document.getElementById('imp-dropzone').style.borderColor = 'var(--border2)';
    const file = event.dataTransfer.files[0];
    if (file) this.onFileSelect(file);
  },

  onFileSelect(file) {
    if (!file) return;
    const allowed = ['.csv', '.xlsx', '.xls'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) { Utils.warn('Please select a CSV or Excel file'); return; }

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

  async preview() {
    if (!this._file) { Utils.warn('Please select a file first'); return; }
    const dataType = document.getElementById('imp-type')?.value;
    if (!dataType) { Utils.warn('Please select a data type'); return; }

    const fd = new FormData();
    fd.append('file', this._file);
    fd.append('dataType', dataType);
    fd.append('preview', 'true');

    const el = document.getElementById('imp-preview');
    el.innerHTML = '<div class="page-loading"><div class="spinner"></div> Parsing file…</div>';

    try {
      const res = await Api.uploadFile('/import/preview', fd);
      const data = res.data || res;
      this._previewData = data;

      const rows = data.rows || data.data || [];
      const errors = data.errors || [];
      const total = data.total || rows.length;

      el.innerHTML = `
        <div class="alert ${errors.length ? 'alert-warn' : 'alert-success'}" style="margin-bottom:12px">
          ${errors.length ? `⚠ ${errors.length} rows have issues · ` : '✓ '}
          ${total} rows parsed · ${rows.length} valid · ${errors.length} with errors
        </div>
        ${errors.length ? `<div style="margin-bottom:12px;font-size:11px;color:var(--warn)">
          ${errors.slice(0,5).map(e => `<div>Row ${e.row}: ${e.message}</div>`).join('')}
          ${errors.length > 5 ? `<div>... and ${errors.length-5} more errors</div>` : ''}
        </div>` : ''}
        ${rows.length > 0 ? `<div class="tbl-wrap"><table>
          <thead><tr>${Object.keys(rows[0]).map(k=>`<th>${k}</th>`).join('')}</tr></thead>
          <tbody>
            ${rows.slice(0,10).map(row=>`<tr>${Object.values(row).map(v=>`<td style="font-size:10.5px">${v||'—'}</td>`).join('')}</tr>`).join('')}
            ${rows.length>10?`<tr><td colspan="${Object.keys(rows[0]).length}" style="text-align:center;color:var(--text3);font-size:11px">... and ${rows.length-10} more rows</td></tr>`:''}
          </tbody>
        </table></div>` : ''}
      `;
    } catch (err) {
      el.innerHTML = `<div class="alert alert-error">Preview failed: ${err.message}</div>`;
    }
  },

  async confirm() {
    if (!this._file) { Utils.warn('Please select a file first'); return; }
    const dataType = document.getElementById('imp-type')?.value;
    if (!dataType) { Utils.warn('Please select a data type'); return; }
    const dup = document.getElementById('imp-dup')?.value;
    const projectId = document.getElementById('imp-project')?.value;

    Utils.confirm(`Import ${dataType.replace(/_/g,' ')} data? This cannot be undone.`, async () => {
      const fd = new FormData();
      fd.append('file', this._file);
      fd.append('dataType', dataType);
      fd.append('duplicateHandling', dup);
      if (projectId) fd.append('projectId', projectId);

      const result = document.getElementById('imp-result');
      result.innerHTML = '<div class="page-loading"><div class="spinner"></div> Importing…</div>';

      try {
        const res = await Api.uploadFile('/import', fd);
        const data = res.data || res;
        result.innerHTML = `
          <div class="alert alert-success">
            ✓ Import complete!
            Created: <strong>${data.created||0}</strong> ·
            Updated: <strong>${data.updated||0}</strong> ·
            Skipped: <strong>${data.skipped||0}</strong> ·
            Errors: <strong>${data.errors||0}</strong>
          </div>
        `;
        this.clearFile();
      } catch (err) {
        result.innerHTML = `<div class="alert alert-error">Import failed: ${err.message}</div>`;
      }
    });
  },

  downloadTemplate() {
    const type = document.getElementById('imp-type')?.value;
    if (!type) { Utils.warn('Select a data type first'); return; }
    window.open(`/api/import/template/${type}`, '_blank');
  },

  async loadHistory() {
    const el = document.getElementById('imp-history-body');
    if (!el) return;
    try {
      const res = await Api.get('/import/history', { params: { pageSize: 50 } });
      const list = res.data || res || [];
      el.innerHTML = list.length === 0
        ? '<div class="empty-state"><h3>No import history</h3></div>'
        : `<table>
            <thead><tr><th>Date</th><th>Type</th><th>File</th><th>Created</th><th>Updated</th><th>Errors</th><th>Status</th></tr></thead>
            <tbody>
              ${list.map(h => `<tr>
                <td style="font-size:10.5px">${Utils.date(h.created_at||h.createdAt)}</td>
                <td>${Utils.chip(h.data_type||h.dataType||'unknown')}</td>
                <td style="font-size:10.5px">${h.file_name||h.fileName||'—'}</td>
                <td style="color:var(--green);font-weight:600">${h.created||0}</td>
                <td>${h.updated||0}</td>
                <td style="${h.errors>0?'color:var(--red);font-weight:600':''}">${h.errors||0}</td>
                <td>${Utils.chip(h.status||'completed')}</td>
              </tr>`).join('')}
            </tbody>
          </table>`;
    } catch (err) {
      el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`;
    }
  },
};
