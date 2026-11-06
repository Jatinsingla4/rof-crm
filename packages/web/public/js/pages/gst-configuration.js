(() => {

  const GSTC_STYLES = `<style id="gstc-styles">
.gstc-page { display:flex; gap:16px; align-items:flex-start; max-width:1500px; margin:0 auto; font-size:13px; color:var(--text) }
.gstc-sidebar { width:220px; min-width:220px; background:var(--surface); border:1px solid var(--border2); border-radius:10px; padding:8px 0; position:sticky; top:0; overflow:hidden }
.gstc-tab-btn { display:block; width:calc(100% - 16px); margin:1px 8px; padding:8px 12px; text-align:left; border:none; border-radius:8px; background:transparent; color:var(--text2); font-size:11.5px; font-weight:500; cursor:pointer; transition:all .15s; text-transform:uppercase; letter-spacing:0.3px; }
.gstc-tab-btn:hover { background:var(--surface2); color:var(--text); }
.gstc-tab-btn.gstc-active { background:var(--teal-bg); color:var(--teal); font-weight:600; }
.gstc-content { flex:1; min-width:0; overflow-x:auto; }
.gstc-card { background:var(--surface); border:1px solid var(--border2); border-radius:10px; margin-bottom:16px; overflow:hidden; }
.gstc-card-title { font-size:12px; font-weight:600; color:var(--text); padding:14px 18px; border-bottom:1px solid var(--border); background:var(--teal-bg); text-transform:uppercase; letter-spacing:0.6px; }
.gstc-card-body { padding:18px; }
.gstc-form-row { display:flex; flex-wrap:wrap; gap:14px 20px; align-items:flex-end; margin-bottom:14px; }
.gstc-field { display:flex; flex-direction:column; gap:6px; min-width:140px; }
.gstc-field label { font-size:11px; color:var(--text2); font-weight:500; letter-spacing:.3px; }
.gstc-field input, .gstc-field select { padding:9px 12px; min-height:38px; border:1px solid var(--border2); border-radius:8px; font-size:13px; min-width:130px; background:var(--surface); color:var(--text); }
.gstc-field input:focus, .gstc-field select:focus { outline:none; border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg); }
.gstc-toggle-group { display:flex; flex-wrap:wrap; gap:6px; }
.gstc-toggle-btn { padding:6px 14px; border:1px solid var(--border2); background:var(--surface); color:var(--text2); font-size:12px; font-weight:500; cursor:pointer; border-radius:999px; transition:all .15s; }
.gstc-toggle-btn:hover { border-color:var(--teal); color:var(--teal); }
.gstc-toggle-btn.gstc-selected { background:var(--teal); color:#fff; border-color:var(--teal); font-weight:600; }
.gstc-type-toggle { display:flex; }
.gstc-type-btn { padding:8px 18px; border:1px solid var(--border2); background:var(--surface); color:var(--text2); font-size:12px; font-weight:500; cursor:pointer; transition:all .15s; }
.gstc-type-btn:first-child { border-radius:8px 0 0 8px; }
.gstc-type-btn:last-child { border-radius:0 8px 8px 0; border-left:none; }
.gstc-type-btn.gstc-type-active { background:var(--teal); color:#fff; border-color:var(--teal); font-weight:600; }
.gstc-btn-save, .gstc-btn-view, .gstc-btn-track { color:#fff; border:none; padding:9px 24px; min-height:38px; border-radius:8px; font-size:12.5px; font-weight:600; cursor:pointer; }
.gstc-btn-save, .gstc-btn-track { background:var(--teal); }
.gstc-btn-view { background:var(--red); }
.gstc-btn-save:hover, .gstc-btn-view:hover, .gstc-btn-track:hover { filter:brightness(.92); }
.gstc-btn-edit, .gstc-btn-delete { color:#fff; border:none; padding:4px 12px; border-radius:6px; font-size:11.5px; font-weight:600; cursor:pointer; margin-right:4px; }
.gstc-btn-edit { background:var(--teal); }
.gstc-btn-delete { background:var(--red); }
.gstc-table { width:100%; border-collapse:collapse; font-size:12.5px; }
.gstc-table th { background:var(--surface2); color:var(--text3); padding:10px 12px; text-align:center; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; white-space:nowrap; border-bottom:1px solid var(--border2); }
.gstc-table td { padding:9px 12px; border-bottom:1px solid var(--border); text-align:center; vertical-align:middle; color:var(--text); }
.gstc-table tr:hover td { background:var(--surface2); }
.gstc-table td.gstc-left { text-align:left; }
.gstc-msg-success { background:var(--teal-bg); border:1px solid var(--teal); color:var(--teal); padding:9px 14px; border-radius:8px; margin-bottom:10px; font-size:12.5px; font-weight:600; }
.gstc-msg-error { background:var(--red-bg); border:1px solid var(--red); color:var(--red); padding:9px 14px; border-radius:8px; margin-bottom:10px; font-size:12.5px; }
@media (max-width:900px) { .gstc-page { flex-direction:column; align-items:stretch } .gstc-sidebar { width:100%; min-width:0; position:static; display:flex; flex-wrap:wrap; padding:6px } .gstc-tab-btn { width:auto; margin:2px } }
</style>`;

  // ── STATE ──────────────────────────────────────────────────────────────────
  let _tab = 'financial-year';
  let _projects = [];
  let _towers = [];
  let _hsnSacCodes = [];
  let _gstSlabs = [];
  let _editingId = null;
  let _selectedChargeType = null;
  let _gstType = 'INTRA';

  let _financialYears = [];
  let _hsnAssigns = [];
  let _gstSlabRows = [];
  let _taxSetupRows = [];
  let _chargeMappingRows = [];
  let _projectGstins = [];
  let _reraNumbers = [];

  // ── HELPERS ────────────────────────────────────────────────────────────────
  function _tok() {
    return (window.Auth && Auth.getToken && Auth.getToken()) || localStorage.getItem('rof-jwt') || '';
  }

  function _esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _fmtDate(d) {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function _showMsg(elId, msg, success) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = `<div class="${success ? 'gstc-msg-success' : 'gstc-msg-error'}">${msg}</div>`;
    setTimeout(() => { if (el) el.innerHTML = ''; }, 3000);
  }

  async function _api(method, path, body) {
    const opts = {
      method,
      headers: { 'Authorization': 'Bearer ' + _tok(), 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch('/api/gst-configuration' + path, opts);
    return res.json();
  }

  // ── INIT ───────────────────────────────────────────────────────────────────
  async function _init() {
    try {
      const r = await _api('GET', '/projects');
      _projects = r.data || [];
    } catch (e) {}
    _switchTab('financial-year');
  }

  // ── PAGE SHELL ─────────────────────────────────────────────────────────────
  function _renderPage() {
    return GSTC_STYLES + `
    <div class="gstc-page">
      <div class="gstc-sidebar" id="gstc-sidebar">${_renderSidebar()}</div>
      <div class="gstc-content" id="gstc-content">
        <div style="padding:40px;text-align:center;color:var(--text3)">Loading...</div>
      </div>
    </div>`;
  }

  function _renderSidebar() {
    const tabs = [
      ['financial-year',  'FINANCIAL YEAR'],
      ['hsn-sac-code',    'HSN/SAC CODE'],
      ['hsn-sac-assign',  'HSN/SAC CODE ASSIGN'],
      ['gst-slab',        'GST SLAB'],
      ['gst-tax-setup',   'GST TAX SETUP'],
      ['gst-charge-map',  'GST TAX CHARGE MAPPING'],
      ['project-gstin',   'PROJECT WISE GSTIN'],
      ['project-rera',    'PROJECT WISE RERA NO.'],
    ];
    return tabs.map(([key, label]) =>
      `<button class="gstc-tab-btn${_tab === key ? ' gstc-active' : ''}"
         onclick="GSTConfig.switchTab('${key}')">${label}</button>`
    ).join('');
  }

  // ── TAB SWITCHER ───────────────────────────────────────────────────────────
  async function _switchTab(tab) {
    _tab = tab;
    _editingId = null;

    document.querySelectorAll('.gstc-tab-btn').forEach(b =>
      b.classList.toggle('gstc-active', b.getAttribute('onclick').includes("'" + tab + "'"))
    );

    const content = document.getElementById('gstc-content');
    if (!content) return;
    content.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text3)">Loading...</div>';

    switch (tab) {
      case 'financial-year':
        await _loadFinancialYears();
        content.innerHTML = _renderFinancialYear();
        break;
      case 'hsn-sac-code':
        await _loadHsnCodes();
        content.innerHTML = _renderHsnSacCode();
        break;
      case 'hsn-sac-assign':
        await _loadHsnCodes();
        _hsnAssigns = [];
        content.innerHTML = _renderHsnSacAssign();
        break;
      case 'gst-slab':
        await _loadGstSlabs();
        content.innerHTML = _renderGstSlab();
        break;
      case 'gst-tax-setup':
        await _loadGstSlabs();
        await _loadTaxSetup();
        content.innerHTML = _renderGstTaxSetup();
        break;
      case 'gst-charge-map':
        await _loadGstSlabs();
        _chargeMappingRows = [];
        content.innerHTML = _renderGstChargeMap();
        break;
      case 'project-gstin':
        await _loadProjectGstin();
        content.innerHTML = _renderProjectGstin();
        break;
      case 'project-rera':
        _reraNumbers = [];
        content.innerHTML = _renderProjectRera();
        break;
    }
  }

  // ── TAB 1: FINANCIAL YEAR ──────────────────────────────────────────────────
  async function _loadFinancialYears() {
    const r = await _api('GET', '/financial-years');
    _financialYears = r.data || [];
  }

  function _renderFinancialYear() {
    const editing = _editingId ? _financialYears.find(f => f.id === _editingId) : null;
    const rows = _financialYears.map((fy, i) => `
      <tr>
        <td>${i + 1}</td>
        <td class="gstc-left">${_esc(fy.name)}</td>
        <td>${_fmtDate(fy.from_date)}</td>
        <td>${_fmtDate(fy.to_date)}</td>
        <td>${fy.is_active ? 'Yes' : 'No'}</td>
        <td><button class="gstc-btn-edit" onclick="GSTConfig.editFY('${fy.id}')">Edit</button></td>
      </tr>`).join('')
      || `<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:20px">No financial years found.</td></tr>`;

    return `
      <div class="gstc-card">
        <div class="gstc-card-title">FINANCIAL YEAR</div>
        <div class="gstc-card-body">
          <div id="gstc-fy-msg"></div>
          <div class="gstc-form-row">
            <div class="gstc-field">
              <label>*Name</label>
              <input type="text" id="gstc-fy-name" placeholder="Name" value="${_esc(editing?.name || '')}">
            </div>
            <div class="gstc-field">
              <label>*From Date</label>
              <input type="date" id="gstc-fy-from" value="${(editing?.from_date || '').slice(0, 10)}">
            </div>
            <div class="gstc-field">
              <label>*To Date</label>
              <input type="date" id="gstc-fy-to" value="${(editing?.to_date || '').slice(0, 10)}">
            </div>
          </div>
          <div class="gstc-form-row">
            <button class="gstc-btn-save" onclick="GSTConfig.saveFY()">SAVE</button>
            <button class="gstc-btn-view" onclick="GSTConfig.switchTab('financial-year')">VIEW</button>
            <button class="gstc-btn-track">TRACK</button>
          </div>
        </div>
      </div>
      <div class="gstc-card">
        <div class="gstc-card-title">FINANCIAL YEAR</div>
        <div style="overflow-x:auto">
          <table class="gstc-table">
            <thead><tr>
              <th>S.NO.</th><th>NAME</th><th>FROM DATE</th><th>TO DATE</th><th>ACTIVE</th><th></th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  async function _saveFY() {
    const name = document.getElementById('gstc-fy-name')?.value.trim();
    const fromDate = document.getElementById('gstc-fy-from')?.value;
    const toDate = document.getElementById('gstc-fy-to')?.value;
    if (!name || !fromDate || !toDate) {
      _showMsg('gstc-fy-msg', 'Name, From Date and To Date are required.', false); return;
    }
    const wasEditing = !!_editingId;
    try {
      let r;
      if (_editingId) {
        r = await _api('PATCH', '/financial-years/' + _editingId, { name, fromDate, toDate });
      } else {
        r = await _api('POST', '/financial-years', { name, fromDate, toDate, isActive: false });
      }
      if (!r.success) throw new Error(r.error || 'Failed');
      _editingId = null;
      await _loadFinancialYears();
      document.getElementById('gstc-content').innerHTML = _renderFinancialYear();
      _showMsg('gstc-fy-msg', wasEditing ? 'Updated successfully.' : 'Financial year saved.', true);
    } catch (e) {
      _showMsg('gstc-fy-msg', 'Error: ' + e.message, false);
    }
  }

  function _editFY(id) {
    _editingId = id;
    document.getElementById('gstc-content').innerHTML = _renderFinancialYear();
  }

  // ── TAB 2: HSN/SAC CODE ────────────────────────────────────────────────────
  async function _loadHsnCodes() {
    const r = await _api('GET', '/hsn-sac-codes');
    _hsnSacCodes = r.data || [];
  }

  function _renderHsnSacCode() {
    const editing = _editingId ? _hsnSacCodes.find(h => h.id === _editingId) : null;
    const rows = _hsnSacCodes.map((h, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${_esc(h.code)}</td>
        <td>${_esc(h.type)}</td>
        <td>
          <button class="gstc-btn-edit" onclick="GSTConfig.editHSN('${h.id}')">Edit</button>
          <button class="gstc-btn-delete" onclick="GSTConfig.deleteHSN('${h.id}')">Delete</button>
        </td>
      </tr>`).join('')
      || `<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:20px">No HSN/SAC codes found.</td></tr>`;

    return `
      <div class="gstc-card">
        <div class="gstc-card-title">HSN/SAC CODE</div>
        <div class="gstc-card-body">
          <div id="gstc-hsn-msg"></div>
          <div class="gstc-form-row">
            <div class="gstc-field">
              <label>*Code</label>
              <input type="text" id="gstc-hsn-code" placeholder="Code" value="${_esc(editing?.code || '')}">
            </div>
            <div class="gstc-field">
              <label>*Type</label>
              <select id="gstc-hsn-type">
                <option value="">&lt;-Select-&gt;</option>
                <option value="Goods" ${editing?.type === 'Goods' ? 'selected' : ''}>Goods</option>
                <option value="Service" ${editing?.type === 'Service' ? 'selected' : ''}>Service</option>
              </select>
            </div>
          </div>
          <div class="gstc-form-row">
            <button class="gstc-btn-save" onclick="GSTConfig.saveHSN()">SAVE</button>
            <button class="gstc-btn-view" onclick="GSTConfig.switchTab('hsn-sac-code')">VIEW</button>
            <button class="gstc-btn-track">TRACK</button>
          </div>
        </div>
      </div>
      <div class="gstc-card">
        <div class="gstc-card-title">HSN/SAC CODE</div>
        <div style="overflow-x:auto">
          <table class="gstc-table">
            <thead><tr><th>S.NO.</th><th>CODE</th><th>TYPE</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  async function _saveHSN() {
    const code = document.getElementById('gstc-hsn-code')?.value.trim();
    const type = document.getElementById('gstc-hsn-type')?.value;
    if (!code || !type) { _showMsg('gstc-hsn-msg', 'Code and Type are required.', false); return; }
    const wasEditing = !!_editingId;
    try {
      let r;
      if (_editingId) {
        r = await _api('PATCH', '/hsn-sac-codes/' + _editingId, { code, type });
      } else {
        r = await _api('POST', '/hsn-sac-codes', { code, type });
      }
      if (!r.success) throw new Error(r.error || 'Failed');
      _editingId = null;
      await _loadHsnCodes();
      document.getElementById('gstc-content').innerHTML = _renderHsnSacCode();
      _showMsg('gstc-hsn-msg', wasEditing ? 'Updated successfully.' : 'Saved successfully.', true);
    } catch (e) {
      _showMsg('gstc-hsn-msg', 'Error: ' + e.message, false);
    }
  }

  function _editHSN(id) {
    _editingId = id;
    document.getElementById('gstc-content').innerHTML = _renderHsnSacCode();
  }

  async function _deleteHSN(id) {
    if (!confirm('Delete this HSN/SAC code?')) return;
    try {
      const r = await _api('DELETE', '/hsn-sac-codes/' + id);
      if (!r.success) throw new Error(r.error || 'Failed');
      await _loadHsnCodes();
      document.getElementById('gstc-content').innerHTML = _renderHsnSacCode();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  }

  // ── TAB 3: HSN/SAC CODE ASSIGN ────────────────────────────────────────────
  function _renderHsnSacAssign() {
    const hsnOpts = _hsnSacCodes.map(h =>
      `<option value="${h.id}">${_esc(h.code)}</option>`
    ).join('');
    const projOpts = _projects.map(p =>
      `<option value="${p.id}">${_esc(p.name)}</option>`
    ).join('');
    const chargeTypes = ['BASIC', 'PLC', 'OTHER CHARGE', 'IFMS', 'EXTRA ADD ON', 'OTHERS'];

    const rows = _hsnAssigns.map((a, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${_esc(a.hsn_code)}</td>
        <td class="gstc-left">${_esc(a.project_name)}</td>
        <td>${_esc(a.charge_type)}</td>
        <td><button class="gstc-btn-delete" onclick="GSTConfig.deleteAssign('${a.id}')">Delete</button></td>
      </tr>`).join('')
      || `<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:20px">No assignments found.</td></tr>`;

    return `
      <div class="gstc-card">
        <div class="gstc-card-title">HSN/SAC CODE ASSIGN</div>
        <div class="gstc-card-body">
          <div id="gstc-assign-msg"></div>
          <div class="gstc-form-row">
            <div class="gstc-field">
              <label>*Code</label>
              <select id="gstc-assign-hsn" style="min-width:150px">
                <option value="">&lt;-Select-&gt;</option>
                ${hsnOpts}
              </select>
            </div>
            <div class="gstc-field">
              <label>*Project</label>
              <select id="gstc-assign-proj" style="min-width:180px"
                onchange="GSTConfig.loadAssignForProject()">
                <option value="">&lt;-Select-&gt;</option>
                ${projOpts}
              </select>
            </div>
            <div class="gstc-field" style="min-width:320px">
              <label>*Charge Type</label>
              <div class="gstc-toggle-group" id="gstc-assign-charge">
                ${chargeTypes.map(ct =>
                  `<button class="gstc-toggle-btn${_selectedChargeType === ct ? ' gstc-selected' : ''}"
                     data-ct="${ct}"
                     onclick="GSTConfig.selectChargeType(this,'${ct}')">${ct}</button>`
                ).join('')}
              </div>
            </div>
          </div>
          <div class="gstc-form-row">
            <button class="gstc-btn-save" onclick="GSTConfig.saveAssign()">SAVE</button>
            <button class="gstc-btn-view" onclick="GSTConfig.viewAssign()">VIEW</button>
            <button class="gstc-btn-track">TRACK</button>
          </div>
        </div>
      </div>
      <div class="gstc-card" id="gstc-assign-table-card">
        <div class="gstc-card-title">HSN/SAC CODE ASSIGN</div>
        <div style="overflow-x:auto">
          <table class="gstc-table">
            <thead><tr>
              <th>S.NO.</th><th>CODE</th><th>PROJECT</th><th>CHARGE TYPE</th><th></th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  function _selectChargeType(btn, ct) {
    document.querySelectorAll('#gstc-assign-charge .gstc-toggle-btn')
      .forEach(b => b.classList.remove('gstc-selected'));
    btn.classList.add('gstc-selected');
    _selectedChargeType = ct;
  }

  async function _loadAssignForProject() {
    const projectId = document.getElementById('gstc-assign-proj')?.value;
    if (!projectId) return;
    const r = await _api('GET', '/hsn-sac-assign?projectId=' + projectId);
    _hsnAssigns = r.data || [];
    const tbody = document.querySelector('#gstc-assign-table-card tbody');
    if (!tbody) return;
    tbody.innerHTML = _hsnAssigns.map((a, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${_esc(a.hsn_code)}</td>
        <td class="gstc-left">${_esc(a.project_name)}</td>
        <td>${_esc(a.charge_type)}</td>
        <td><button class="gstc-btn-delete" onclick="GSTConfig.deleteAssign('${a.id}')">Delete</button></td>
      </tr>`).join('')
      || `<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:20px">No assignments for this project.</td></tr>`;
  }

  async function _saveAssign() {
    const hsnSacId = document.getElementById('gstc-assign-hsn')?.value;
    const projectId = document.getElementById('gstc-assign-proj')?.value;
    if (!hsnSacId || !projectId || !_selectedChargeType) {
      _showMsg('gstc-assign-msg', 'Code, Project and Charge Type are required.', false); return;
    }
    try {
      const r = await _api('POST', '/hsn-sac-assign', { hsnSacId, projectId, chargeType: _selectedChargeType });
      if (!r.success) throw new Error(r.error || 'Failed');
      _showMsg('gstc-assign-msg', 'Assignment saved.', true);
      await _loadAssignForProject();
    } catch (e) {
      _showMsg('gstc-assign-msg', 'Error: ' + e.message, false);
    }
  }

  async function _viewAssign() {
    const r = await _api('GET', '/hsn-sac-assign');
    _hsnAssigns = r.data || [];
    document.getElementById('gstc-content').innerHTML = _renderHsnSacAssign();
  }

  async function _deleteAssign(id) {
    if (!confirm('Delete this assignment?')) return;
    try {
      const r = await _api('DELETE', '/hsn-sac-assign/' + id);
      if (!r.success) throw new Error(r.error || 'Failed');
      await _viewAssign();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  }

  // ── TAB 4: GST SLAB ───────────────────────────────────────────────────────
  async function _loadGstSlabs() {
    const r = await _api('GET', '/gst-slabs');
    _gstSlabs = r.data || [];
    _gstSlabRows = _gstSlabs;
  }

  function _renderGstSlab() {
    const rows = _gstSlabRows.map((s, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${_fmtDate(s.from_date)}</td>
        <td>${_fmtDate(s.to_date)}</td>
        <td><button class="gstc-btn-delete" onclick="GSTConfig.deleteSlab('${s.id}')">Delete</button></td>
      </tr>`).join('')
      || `<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:20px">No slabs found.</td></tr>`;

    return `
      <div class="gstc-card">
        <div class="gstc-card-title">GST SLAB MASTER</div>
        <div class="gstc-card-body">
          <div id="gstc-slab-msg"></div>
          <div class="gstc-form-row">
            <div class="gstc-field">
              <label>*From Date</label>
              <input type="date" id="gstc-slab-from">
            </div>
            <div class="gstc-field">
              <label>To Date</label>
              <input type="date" id="gstc-slab-to">
            </div>
          </div>
          <div class="gstc-form-row">
            <button class="gstc-btn-save" onclick="GSTConfig.saveSlab()">SAVE</button>
            <button class="gstc-btn-view" onclick="GSTConfig.switchTab('gst-slab')">VIEW</button>
            <button class="gstc-btn-track">TRACK</button>
          </div>
        </div>
      </div>
      <div class="gstc-card">
        <div class="gstc-card-title">TAX SLAB MASTER</div>
        <div style="overflow-x:auto">
          <table class="gstc-table">
            <thead><tr><th>S.NO.</th><th>FROM DATE</th><th>TO DATE</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  async function _saveSlab() {
    const fromDate = document.getElementById('gstc-slab-from')?.value;
    const toDate = document.getElementById('gstc-slab-to')?.value;
    if (!fromDate) { _showMsg('gstc-slab-msg', 'From Date is required.', false); return; }
    try {
      const r = await _api('POST', '/gst-slabs', { fromDate, toDate });
      if (!r.success) throw new Error(r.error || 'Failed');
      await _loadGstSlabs();
      document.getElementById('gstc-content').innerHTML = _renderGstSlab();
      _showMsg('gstc-slab-msg', 'GST Slab saved.', true);
    } catch (e) {
      _showMsg('gstc-slab-msg', 'Error: ' + e.message, false);
    }
  }

  async function _deleteSlab(id) {
    if (!confirm('Delete this GST slab?')) return;
    try {
      const r = await _api('DELETE', '/gst-slabs/' + id);
      if (!r.success) throw new Error(r.error || 'Failed');
      await _loadGstSlabs();
      document.getElementById('gstc-content').innerHTML = _renderGstSlab();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  }

  // ── TAB 5: GST TAX SETUP ──────────────────────────────────────────────────
  async function _loadTaxSetup(slabId) {
    const path = slabId ? '/gst-tax-setup?slabId=' + slabId : '/gst-tax-setup';
    const r = await _api('GET', path);
    _taxSetupRows = r.data || [];
  }

  function _renderGstTaxSetup() {
    const editing = _editingId ? _taxSetupRows.find(t => t.id === _editingId) : null;
    if (editing) _gstType = editing.type;

    const slabOpts = _gstSlabs.map(s =>
      `<option value="${s.id}">${_fmtDate(s.from_date)} - ${_fmtDate(s.to_date)}</option>`
    ).join('');

    const taxRows = _taxSetupRows.map((t, i) => `
      <tr>
        <td>${i + 1}</td>
        <td class="gstc-left">${_esc(t.slab_label || '')}</td>
        <td>${_esc(t.gst_code)}</td>
        <td>${_esc(t.type)}</td>
        <td>${parseFloat(t.cgst_pct || 0).toFixed(2)}</td>
        <td>${parseFloat(t.sgst_pct || 0).toFixed(2)}</td>
        <td>${parseFloat(t.utgst_pct || 0).toFixed(3)}</td>
        <td>${parseFloat(t.igst_pct || 0).toFixed(2)}</td>
        <td>
          <button class="gstc-btn-edit" onclick="GSTConfig.editTax('${t.id}')">Edit</button>
          <button class="gstc-btn-delete" onclick="GSTConfig.deleteTax('${t.id}')">Delete</button>
        </td>
      </tr>`).join('')
      || `<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:20px">No tax setup found.</td></tr>`;

    return `
      <div class="gstc-card">
        <div class="gstc-card-title">GST TAX SETUP</div>
        <div class="gstc-card-body">
          <div id="gstc-tax-msg"></div>
          <div class="gstc-form-row">
            <div class="gstc-field">
              <label>*Slab</label>
              <select id="gstc-tax-slab" style="min-width:200px"
                onchange="GSTConfig.loadTaxForSlab()">
                <option value="">&lt;-Select-&gt;</option>
                ${slabOpts}
              </select>
            </div>
            <div class="gstc-field">
              <label>*GST Code</label>
              <input type="text" id="gstc-tax-code" placeholder="GST Code"
                value="${_esc(editing?.gst_code || '')}">
            </div>
            <div class="gstc-field">
              <label>*Type</label>
              <div class="gstc-type-toggle">
                ${['INTER', 'INTRA', 'UT'].map(t =>
                  `<button class="gstc-type-btn${_gstType === t ? ' gstc-type-active' : ''}"
                     onclick="GSTConfig.setGstType(this,'${t}')">${t}</button>`
                ).join('')}
              </div>
            </div>
            <div class="gstc-field">
              <label>*IGST(%)</label>
              <input type="number" id="gstc-tax-igst" placeholder="IGST"
                step="0.001" min="0"
                value="${editing ? (editing.type === 'INTRA'
                  ? (parseFloat(editing.cgst_pct || 0) * 2)
                  : editing.type === 'INTER'
                    ? parseFloat(editing.igst_pct || 0)
                    : parseFloat(editing.utgst_pct || 0)) : ''}">
            </div>
          </div>
          <div class="gstc-form-row">
            <button class="gstc-btn-save" onclick="GSTConfig.saveTax()">SAVE</button>
            <button class="gstc-btn-view" onclick="GSTConfig.switchTab('gst-tax-setup')">VIEW</button>
            <button class="gstc-btn-track">TRACK</button>
          </div>
        </div>
      </div>
      <div class="gstc-card">
        <div class="gstc-card-title">GST TAX SETUP</div>
        <div style="overflow-x:auto">
          <table class="gstc-table">
            <thead>
              <tr>
                <th rowspan="2">S.NO.</th>
                <th rowspan="2">SLAB</th>
                <th rowspan="2">GST CODE</th>
                <th rowspan="2">TYPE</th>
                <th colspan="4">RATE</th>
                <th rowspan="2"></th>
              </tr>
              <tr>
                <th>CGST(%)</th><th>SGST(%)</th><th>UTGST(%)</th><th>IGST(%)</th>
              </tr>
            </thead>
            <tbody>${taxRows}</tbody>
          </table>
        </div>
      </div>`;
  }

  function _setGstType(btn, type) {
    document.querySelectorAll('.gstc-type-btn')
      .forEach(b => b.classList.remove('gstc-type-active'));
    btn.classList.add('gstc-type-active');
    _gstType = type;
  }

  async function _loadTaxForSlab() {
    const slabId = document.getElementById('gstc-tax-slab')?.value;
    if (!slabId) return;
    await _loadTaxSetup(slabId);
    const tbody = document.querySelector('#gstc-content .gstc-table tbody');
    if (!tbody) return;
    tbody.innerHTML = _taxSetupRows.map((t, i) => `
      <tr>
        <td>${i + 1}</td>
        <td class="gstc-left">${_esc(t.slab_label || '')}</td>
        <td>${_esc(t.gst_code)}</td>
        <td>${_esc(t.type)}</td>
        <td>${parseFloat(t.cgst_pct || 0).toFixed(2)}</td>
        <td>${parseFloat(t.sgst_pct || 0).toFixed(2)}</td>
        <td>${parseFloat(t.utgst_pct || 0).toFixed(3)}</td>
        <td>${parseFloat(t.igst_pct || 0).toFixed(2)}</td>
        <td>
          <button class="gstc-btn-edit" onclick="GSTConfig.editTax('${t.id}')">Edit</button>
          <button class="gstc-btn-delete" onclick="GSTConfig.deleteTax('${t.id}')">Delete</button>
        </td>
      </tr>`).join('')
      || `<tr><td colspan="9" style="color:var(--text3);text-align:center;padding:16px">No entries for this slab.</td></tr>`;
  }

  async function _saveTax() {
    const slabId = document.getElementById('gstc-tax-slab')?.value;
    const gstCode = document.getElementById('gstc-tax-code')?.value.trim();
    const igstPct = parseFloat(document.getElementById('gstc-tax-igst')?.value || '0');

    if (!gstCode) { _showMsg('gstc-tax-msg', 'GST Code is required.', false); return; }

    let cgst = 0, sgst = 0, utgst = 0, igst = 0;
    if (_gstType === 'INTRA') {
      cgst = Math.round(igstPct / 2 * 1000) / 1000;
      sgst = cgst;
    } else if (_gstType === 'INTER') {
      igst = igstPct;
    } else {
      utgst = igstPct;
    }

    const wasEditing = !!_editingId;
    try {
      let r;
      if (_editingId) {
        r = await _api('PATCH', '/gst-tax-setup/' + _editingId, {
          gstCode, type: _gstType,
          cgstPct: cgst, sgstPct: sgst, utgstPct: utgst, igstPct: igst
        });
      } else {
        if (!slabId) { _showMsg('gstc-tax-msg', 'Please select a Slab.', false); return; }
        r = await _api('POST', '/gst-tax-setup', {
          slabId, gstCode, type: _gstType,
          cgstPct: cgst, sgstPct: sgst, utgstPct: utgst, igstPct: igst
        });
      }
      if (!r.success) throw new Error(r.error || 'Failed');
      _editingId = null;
      await _loadGstSlabs();
      await _loadTaxSetup();
      document.getElementById('gstc-content').innerHTML = _renderGstTaxSetup();
      _showMsg('gstc-tax-msg', wasEditing ? 'Updated successfully.' : 'GST Tax saved.', true);
    } catch (e) {
      _showMsg('gstc-tax-msg', 'Error: ' + e.message, false);
    }
  }

  function _editTax(id) {
    _editingId = id;
    document.getElementById('gstc-content').innerHTML = _renderGstTaxSetup();
  }

  async function _deleteTax(id) {
    if (!confirm('Delete this tax setup?')) return;
    try {
      const r = await _api('DELETE', '/gst-tax-setup/' + id);
      if (!r.success) throw new Error(r.error || 'Failed');
      await _loadTaxSetup();
      document.getElementById('gstc-content').innerHTML = _renderGstTaxSetup();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  }

  // ── TAB 6: GST TAX CHARGE MAPPING ─────────────────────────────────────────
  function _renderGstChargeMap() {
    const projOpts = _projects.map(p =>
      `<option value="${p.id}">${_esc(p.name)}</option>`
    ).join('');
    const slabOpts = _gstSlabs.map(s =>
      `<option value="${s.id}">${_fmtDate(s.from_date)} - ${_fmtDate(s.to_date)}</option>`
    ).join('');

    const rows = _chargeMappingRows.map((m, i) => `
      <tr>
        <td>${i + 1}</td>
        <td class="gstc-left">${_esc(m.project_name)}</td>
        <td class="gstc-left">${_esc(m.slab_label || '')}</td>
        <td>${_esc(m.charge_type)}</td>
        <td>${_esc(m.gst_code || '')}</td>
        <td>${m.cgst_pct || 0}</td>
        <td>${m.sgst_pct || 0}</td>
        <td><button class="gstc-btn-delete" onclick="GSTConfig.deleteChargeMap('${m.id}')">Delete</button></td>
      </tr>`).join('')
      || `<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:20px">Click FETCH to load mappings.</td></tr>`;

    return `
      <div class="gstc-card">
        <div class="gstc-card-title">GST TAX CHARGE MAPPING</div>
        <div class="gstc-card-body">
          <div id="gstc-map-msg"></div>
          <div class="gstc-form-row">
            <div class="gstc-field">
              <label>*Project:</label>
              <select id="gstc-map-proj" style="min-width:180px">
                <option value="">&lt;-Select-&gt;</option>
                ${projOpts}
              </select>
            </div>
            <div class="gstc-field">
              <label>*Slab:</label>
              <select id="gstc-map-slab" style="min-width:180px">
                <option value="">&lt;-Select-&gt;</option>
                ${slabOpts}
              </select>
            </div>
            <div class="gstc-field" style="justify-content:flex-end">
              <button class="gstc-btn-save" onclick="GSTConfig.fetchChargeMap()">FETCH</button>
            </div>
            <div class="gstc-field" style="justify-content:flex-end">

            </div>
            <div class="gstc-field" style="justify-content:flex-end">
              <button class="gstc-btn-track">TRACK</button>
            </div>
          </div>
        </div>
      </div>
      <div class="gstc-card">
        <div class="gstc-card-title">CREATE GST CHARGE MAPPING</div>
        <div class="gstc-card-body">
          <div id="gstc-map-create-msg"></div>
          <div class="gstc-form-row">
            <div class="gstc-field">
              <label>*Project:</label>
              <select id="gstc-map-add-proj" style="min-width:180px">
                <option value="">&lt;-Select-&gt;</option>
                ${projOpts}
              </select>
            </div>
            <div class="gstc-field">
              <label>*Slab:</label>
              <select id="gstc-map-add-slab" style="min-width:180px" onchange="GSTConfig.onMapSlabChange()">
                <option value="">&lt;-Select-&gt;</option>
                ${slabOpts}
              </select>
            </div>
            <div class="gstc-field">
              <label>*Charge Type:</label>
              <select id="gstc-map-add-chargetype" style="min-width:160px">
                <option value="">&lt;-Select-&gt;</option>
                <option value="BASIC">BASIC</option>
                <option value="PLC">PLC</option>
                <option value="OTHER CHARGE">OTHER CHARGE</option>
                <option value="IFMS">IFMS</option>
                <option value="EXTRA ADD ON">EXTRA ADD ON</option>
                <option value="OTHERS">OTHERS</option>
              </select>
            </div>
            <div class="gstc-field">
              <label>*Rate:</label>
              <select id="gstc-map-add-rate" style="min-width:220px">
                <option value="">&lt;-Select Slab First-&gt;</option>
              </select>
            </div>
            <div class="gstc-field" style="justify-content:flex-end">
              <button class="gstc-btn-save" onclick="GSTConfig.saveChargeMap()">SAVE</button>
            </div>
          </div>
        </div>
      </div>
      <div class="gstc-card">
        <div class="gstc-card-title">GST TAX CHARGE MAPPING</div>
        <div style="overflow-x:auto">
          <table class="gstc-table">
            <thead><tr>
              <th>S.NO.</th><th>PROJECT</th><th>SLAB</th><th>CHARGE TYPE</th>
              <th>GST CODE</th><th>CGST(%)</th><th>SGST(%)</th><th></th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  async function _fetchChargeMap() {
    const projectId = document.getElementById('gstc-map-proj')?.value;
    const slabId = document.getElementById('gstc-map-slab')?.value;
    if (!projectId || !slabId) {
      _showMsg('gstc-map-msg', 'Please select Project and Slab.', false); return;
    }
    try {
      const r = await _api('GET', '/gst-charge-mapping?projectId=' + projectId + '&slabId=' + slabId);
      _chargeMappingRows = r.data || [];
      document.getElementById('gstc-content').innerHTML = _renderGstChargeMap();
      const ps = document.getElementById('gstc-map-proj');
      const ss = document.getElementById('gstc-map-slab');
      if (ps) ps.value = projectId;
      if (ss) ss.value = slabId;
    } catch (e) {
      alert('Error: ' + e.message);
    }
  }
  async function _deleteChargeMap(id) {
    if (!confirm('Delete this mapping?')) return;
    try {
      const r = await _api('DELETE', '/gst-charge-mapping/' + id);
      if (!r.success) throw new Error(r.error || 'Failed');
      await _fetchChargeMap();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  }

  async function _onMapSlabChange() {
    const slabId = document.getElementById('gstc-map-add-slab')?.value;
    const rateSelect = document.getElementById('gstc-map-add-rate');
    if (!slabId) {
      rateSelect.innerHTML = '<option value="">&lt;-Select Slab First-&gt;</option>';
      return;
    }
    rateSelect.innerHTML = '<option value="">Loading...</option>';
    try {
      const r = await _api('GET', '/gst-tax-setup?slabId=' + slabId);
      // Booking charges CGST + SGST, so only INTRA rates can be mapped to a charge
      const rows = (r.data || []).filter(t => t.type === 'INTRA');
      if (rows.length === 0) {
        rateSelect.innerHTML = '<option value="">No INTRA rates for this slab</option>';
        return;
      }
      rateSelect.innerHTML = '<option value="">&lt;-Select-&gt;</option>' +
        rows.map(t =>
          `<option value="${t.id}">${_esc(t.gst_code)} (CGST ${t.cgst_pct}% / SGST ${t.sgst_pct}%)</option>`
        ).join('');
    } catch (e) {
      rateSelect.innerHTML = '<option value="">Error loading rates</option>';
    }
  }

  async function _saveChargeMap() {
    const projectId  = document.getElementById('gstc-map-add-proj')?.value;
    const slabId     = document.getElementById('gstc-map-add-slab')?.value;
    const chargeType = document.getElementById('gstc-map-add-chargetype')?.value;
    const gstTaxId   = document.getElementById('gstc-map-add-rate')?.value;
    const msgEl      = document.getElementById('gstc-map-create-msg');

    if (!projectId || !slabId || !chargeType || !gstTaxId) {
      msgEl.innerHTML = '<div class="gstc-msg-error">All fields are required.</div>';
      return;
    }
    try {
      const r = await _api('POST', '/gst-charge-mapping', { projectId, slabId, gstTaxId, chargeType });
      if (!r.success) throw new Error(r.error || 'Failed to save mapping.');
      msgEl.innerHTML = '<div class="gstc-msg-success">Mapping saved successfully.</div>';
      document.getElementById('gstc-map-add-chargetype').value = '';
      document.getElementById('gstc-map-add-rate').innerHTML = '<option value="">&lt;-Select Slab First-&gt;</option>';
    } catch (e) {
      msgEl.innerHTML = '<div class="gstc-msg-error">' + _esc(e.message || 'Failed to save mapping.') + '</div>';
    }
  }

  // ── TAB 7: PROJECT WISE GSTIN ─────────────────────────────────────────────
  async function _loadProjectGstin() {
    const r = await _api('GET', '/project-gstin');
    _projectGstins = r.data || [];
  }

  function _renderProjectGstin() {
    const editing = _editingId ? _projectGstins.find(g => g.id === _editingId) : null;
    const projOpts = _projects.map(p =>
      `<option value="${p.id}">${_esc(p.name)}</option>`
    ).join('');

    const rows = _projectGstins.map((g, i) => `
      <tr>
        <td>${i + 1}</td>
        <td class="gstc-left">${_esc(g.project_name)}</td>
        <td>${_esc(g.gstin)}</td>
        <td><button class="gstc-btn-edit" onclick="GSTConfig.editGstin('${g.id}')">Edit</button></td>
      </tr>`).join('')
      || `<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:20px">No GSTIN configured.</td></tr>`;

    return `
      <div class="gstc-card">
        <div class="gstc-card-title">PROJECT WISE GSTIN</div>
        <div class="gstc-card-body">
          <div id="gstc-gstin-msg"></div>
          <div class="gstc-form-row">
            <div class="gstc-field">
              <label>*Project</label>
              <select id="gstc-gstin-proj" style="min-width:180px">
                <option value="">&lt;-Select-&gt;</option>
                ${projOpts}
              </select>
            </div>
            <div class="gstc-field">
              <label>*GSTIN</label>
              <input type="text" id="gstc-gstin-val" placeholder="GSTIN" maxlength="15"
                style="text-transform:uppercase" value="${_esc(editing?.gstin || '')}">
            </div>
          </div>
          <div class="gstc-form-row">
            <button class="gstc-btn-save" onclick="GSTConfig.saveGstin()">SAVE</button>
            <button class="gstc-btn-view" onclick="GSTConfig.switchTab('project-gstin')">VIEW</button>
            <button class="gstc-btn-track">TRACK</button>
          </div>
        </div>
      </div>
      <div class="gstc-card">
        <div class="gstc-card-title">PROJECT WISE GSTIN</div>
        <div style="overflow-x:auto">
          <table class="gstc-table">
            <thead><tr><th>S.NO.</th><th>PROJECT</th><th>GSTIN</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  async function _saveGstin() {
    const projectId = document.getElementById('gstc-gstin-proj')?.value;
    const gstin = (document.getElementById('gstc-gstin-val')?.value || '').trim().toUpperCase();
    if (!projectId || !gstin) {
      _showMsg('gstc-gstin-msg', 'Project and GSTIN are required.', false); return;
    }
    const wasEditing = !!_editingId;
    try {
      let r;
      if (_editingId) {
        r = await _api('PATCH', '/project-gstin/' + _editingId, { gstin });
      } else {
        r = await _api('POST', '/project-gstin', { projectId, gstin });
      }
      if (!r.success) throw new Error(r.error || 'Failed');
      _editingId = null;
      await _loadProjectGstin();
      document.getElementById('gstc-content').innerHTML = _renderProjectGstin();
      _showMsg('gstc-gstin-msg', wasEditing ? 'Updated successfully.' : 'GSTIN saved.', true);
    } catch (e) {
      _showMsg('gstc-gstin-msg', 'Error: ' + e.message, false);
    }
  }

  function _editGstin(id) {
    _editingId = id;
    const g = _projectGstins.find(g => g.id === id);
    document.getElementById('gstc-content').innerHTML = _renderProjectGstin();
    if (g) {
      const ps = document.getElementById('gstc-gstin-proj');
      if (ps) ps.value = g.project_id;
    }
  }

  // ── TAB 8: PROJECT WISE RERA NO. ──────────────────────────────────────────
  function _renderProjectRera() {
    const projOpts = _projects.map(p =>
      `<option value="${p.id}">${_esc(p.name)}</option>`
    ).join('');
    const editing = _editingId ? _reraNumbers.find(r => r.id === _editingId) : null;

    const rows = _reraNumbers.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td class="gstc-left">${_esc(r.project_name)}</td>
        <td>${_esc(r.tower_name || '—')}</td>
        <td class="gstc-left">${_esc(r.rera_number)}</td>
        <td><button class="gstc-btn-edit" onclick="GSTConfig.editRera('${r.id}')">Edit</button></td>
      </tr>`).join('')
      || `<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:20px">No RERA numbers configured.</td></tr>`;

    return `
      <div class="gstc-card">
        <div class="gstc-card-title">PROJECT WISE RERA NO.</div>
        <div class="gstc-card-body">
          <div id="gstc-rera-msg"></div>
          <div class="gstc-form-row">
            <div class="gstc-field">
              <label>*Project</label>
              <select id="gstc-rera-proj" style="min-width:180px"
                onchange="GSTConfig.loadTowersForRera()">
                <option value="">&lt;-Select-&gt;</option>
                ${projOpts}
              </select>
            </div>
            <div class="gstc-field">
              <label>Tower:</label>
              <select id="gstc-rera-tower" style="min-width:150px">
                <option value="">&lt;-Select-&gt;</option>
              </select>
            </div>
            <div class="gstc-field">
              <label>*RERA NO.</label>
              <input type="text" id="gstc-rera-val" placeholder="RERA No."
                value="${_esc(editing?.rera_number || '')}">
            </div>
          </div>
          <div class="gstc-form-row">
            <button class="gstc-btn-save" onclick="GSTConfig.saveRera()">SAVE</button>
            <button class="gstc-btn-view" onclick="GSTConfig.viewRera()">VIEW</button>
            <button class="gstc-btn-track">TRACK</button>
          </div>
        </div>
      </div>
      <div class="gstc-card">
        <div class="gstc-card-title">PROJECT WISE RERA NO.</div>
        <div style="overflow-x:auto">
          <table class="gstc-table">
            <thead><tr>
              <th>S.NO.</th><th>PROJECT</th><th>TOWER</th><th>RERA NO.</th><th></th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  async function _loadTowersForRera() {
    const projectId = document.getElementById('gstc-rera-proj')?.value;
    const tsel = document.getElementById('gstc-rera-tower');
    if (!projectId || !tsel) return;
    try {
      const r = await _api('GET', '/towers?projectId=' + projectId);
      _towers = r.data || [];
      tsel.innerHTML = '<option value="">&lt;-Select-&gt;</option>'
        + _towers.map(t => `<option value="${t.id}">${_esc(t.tower_name)}</option>`).join('');
      const rr = await _api('GET', '/project-rera?projectId=' + projectId);
      _reraNumbers = rr.data || [];
      const tbody = document.querySelector('#gstc-content .gstc-table tbody');
      if (tbody) {
        tbody.innerHTML = _reraNumbers.map((r, i) => `
          <tr>
            <td>${i + 1}</td>
            <td class="gstc-left">${_esc(r.project_name)}</td>
            <td>${_esc(r.tower_name || '—')}</td>
            <td class="gstc-left">${_esc(r.rera_number)}</td>
            <td><button class="gstc-btn-edit" onclick="GSTConfig.editRera('${r.id}')">Edit</button></td>
          </tr>`).join('')
          || `<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:20px">No RERA numbers for this project.</td></tr>`;
      }
    } catch (e) {}
  }

  async function _saveRera() {
    const projectId = document.getElementById('gstc-rera-proj')?.value;
    const towerId = document.getElementById('gstc-rera-tower')?.value || null;
    const reraNumber = document.getElementById('gstc-rera-val')?.value.trim();
    if (!projectId || !reraNumber) {
      _showMsg('gstc-rera-msg', 'Project and RERA No. are required.', false); return;
    }
    const wasEditing = !!_editingId;
    try {
      let r;
      if (_editingId) {
        r = await _api('PATCH', '/project-rera/' + _editingId, { reraNumber });
      } else {
        r = await _api('POST', '/project-rera', { projectId, towerId: towerId || undefined, reraNumber });
      }
      if (!r.success) throw new Error(r.error || 'Failed');
      _editingId = null;
      await _loadTowersForRera();
      _showMsg('gstc-rera-msg', wasEditing ? 'Updated successfully.' : 'RERA No. saved.', true);
    } catch (e) {
      _showMsg('gstc-rera-msg', 'Error: ' + e.message, false);
    }
  }

  async function _viewRera() {
    const r = await _api('GET', '/project-rera');
    _reraNumbers = r.data || [];
    document.getElementById('gstc-content').innerHTML = _renderProjectRera();
  }

  function _editRera(id) {
    _editingId = id;
    const rr = _reraNumbers.find(r => r.id === id);
    document.getElementById('gstc-content').innerHTML = _renderProjectRera();
    if (rr) {
      const ps = document.getElementById('gstc-rera-proj');
      if (ps) {
        ps.value = rr.project_id;
        _loadTowersForRera().then(() => {
          const ts = document.getElementById('gstc-rera-tower');
          if (ts && rr.tower_id) ts.value = rr.tower_id;
        });
      }
    }
  }

  // ── PUBLIC API ─────────────────────────────────────────────────────────────
  window.GSTConfig = {
    switchTab:           _switchTab,
    saveFY:              _saveFY,
    editFY:              _editFY,
    saveHSN:             _saveHSN,
    editHSN:             _editHSN,
    deleteHSN:           _deleteHSN,
    selectChargeType:    _selectChargeType,
    loadAssignForProject:_loadAssignForProject,
    saveAssign:          _saveAssign,
    viewAssign:          _viewAssign,
    deleteAssign:        _deleteAssign,
    saveSlab:            _saveSlab,
    deleteSlab:          _deleteSlab,
    setGstType:          _setGstType,
    loadTaxForSlab:      _loadTaxForSlab,
    saveTax:             _saveTax,
    editTax:             _editTax,
    deleteTax:           _deleteTax,
    fetchChargeMap:      _fetchChargeMap,
    deleteChargeMap:     _deleteChargeMap,
    onMapSlabChange:     _onMapSlabChange,
    saveChargeMap:       _saveChargeMap,
    saveGstin:           _saveGstin,
    editGstin:           _editGstin,
    loadTowersForRera:   _loadTowersForRera,
    saveRera:            _saveRera,
    viewRera:            _viewRera,
    editRera:            _editRera,
  };

  Pages.gstConfiguration = function(params) {
    const container = document.getElementById('content') || document.body;
    container.innerHTML = _renderPage();
    _init();
  };

})();
