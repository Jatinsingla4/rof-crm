/**
 * Waiveoff Add On Charge
 * Waive active addon charges assigned to consumers.
 */
(() => {

  const WAC_STYLES = `<style id="wac-styles">
.wac-page { max-width:1400px; margin:0 auto; font-size:13px; color:var(--text); }
.wac-card { background:var(--surface); border:1px solid var(--border2); border-radius:10px; margin-bottom:16px; overflow:hidden; }
.wac-hdr { display:flex; justify-content:space-between; align-items:center; background:var(--teal-bg); padding:14px 18px; border-bottom:1px solid var(--border); }
.wac-hdr-title { color:var(--text); font-size:12px; font-weight:600; letter-spacing:.6px; text-transform:uppercase; }
.wac-body { padding:18px; }
.wac-filter-grid, .wac-filter-grid2 { display:grid; grid-template-columns:repeat(auto-fill, minmax(190px, 1fr)); gap:14px 18px; margin-bottom:14px; }
.wac-filter-grid2 { margin-bottom:0; }
.wac-field { display:flex; flex-direction:column; gap:6px; }
.wac-lbl { font-size:11px; font-weight:500; color:var(--text2); letter-spacing:.3px; white-space:nowrap; }
.wac-filter-grid select, .wac-filter-grid input, .wac-filter-grid2 select, .wac-filter-grid2 input { padding:9px 12px; min-height:38px; border:1px solid var(--border2); border-radius:8px; font-size:13px; width:100%; box-sizing:border-box; background:var(--surface); color:var(--text); }
.wac-filter-grid select:focus, .wac-filter-grid input:focus, .wac-filter-grid2 select:focus, .wac-filter-grid2 input:focus { outline:none; border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg); }
.wac-btn-fetch { background:var(--teal); color:#fff; border:none; padding:9px 26px; min-height:38px; border-radius:8px; font-size:12.5px; font-weight:600; cursor:pointer; align-self:flex-start; }
.wac-btn-fetch:hover { filter:brightness(.92); }
.wac-btn-fetch:disabled { opacity:.7; cursor:not-allowed; }
.wac-table, .wac-charges-table { width:100%; border-collapse:collapse; font-size:12.5px; }
.wac-table th, .wac-charges-table th { background:var(--surface2); color:var(--text3); padding:10px 14px; text-align:left; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:.4px; white-space:nowrap; border-bottom:1px solid var(--border2); }
.wac-table td, .wac-charges-table td { padding:10px 14px; border-bottom:1px solid var(--border); vertical-align:middle; color:var(--text); }
.wac-table tbody tr:hover td, .wac-charges-table tbody tr:hover td { background:var(--surface2); }
.wac-table td.wac-num { text-align:right; }
.wac-link { color:var(--teal); cursor:pointer; font-size:12px; font-weight:600; }
.wac-link:hover { text-decoration:underline; }
.wac-waive-link { color:var(--warn); cursor:pointer; font-size:12px; font-weight:600; }
.wac-waive-link:hover { text-decoration:underline; }
.wac-no-charges { color:var(--text3); font-size:12px; }
.wac-empty { text-align:center; color:var(--text3); padding:36px 18px; font-size:13px; }
.wac-info-card { background:var(--surface2); border:1px solid var(--border2); border-radius:10px; padding:14px 18px; margin-bottom:16px; }
.wac-info-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:10px 20px; }
.wac-info-item { display:flex; flex-direction:column; gap:3px; }
.wac-info-lbl { font-size:10.5px; color:var(--text3); text-transform:uppercase; letter-spacing:.4px; }
.wac-info-val { font-size:13px; font-weight:600; color:var(--text); }
.wac-charges-table { border:1px solid var(--border2); border-radius:8px; overflow:hidden; font-size:12px; }
.wac-charges-table th { text-align:center; }
.wac-charges-table td { text-align:center; }
.wac-charges-table td.wac-tl { text-align:left; }
.wac-charges-table td.wac-tr { text-align:right; }
.wac-waive-form-row td { background:var(--surface2) !important; }
.wac-waive-form-inner { padding:10px 12px; display:flex; align-items:flex-start; gap:14px; flex-wrap:wrap; text-align:left; }
.wac-waive-form-inner textarea { padding:9px 12px; border:1px solid var(--border2); border-radius:8px; font-size:13px; width:340px; max-width:100%; resize:vertical; background:var(--surface); color:var(--text); }
.wac-waive-form-inner textarea:focus { outline:none; border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg); }
.wac-btn-confirm-waive { background:var(--warn); color:#fff; border:none; padding:9px 18px; min-height:36px; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; }
.wac-btn-confirm-waive:hover { filter:brightness(.92); }
.wac-btn-confirm-waive:disabled { opacity:.7; cursor:not-allowed; }
.wac-btn-cancel-waive { background:var(--surface); color:var(--text2); border:1px solid var(--border2); padding:9px 16px; min-height:36px; border-radius:8px; font-size:12px; cursor:pointer; }
.wac-btn-cancel-waive:hover { background:var(--surface2); }
.wac-status-active { color:var(--teal); background:var(--teal-bg); padding:3px 10px; border-radius:999px; font-size:11px; font-weight:600; }
.wac-status-waived { color:var(--warn); font-weight:600; }
.wac-msg { margin-top:14px; font-size:12.5px; padding:9px 14px; border-radius:8px; display:none; }
.wac-msg-ok  { background:var(--teal-bg); color:var(--teal); border:1px solid var(--teal); font-weight:600; }
.wac-msg-err { background:var(--red-bg); color:var(--red); border:1px solid var(--red); }
.wac-btn-close { background:var(--surface); color:var(--text2); border:1px solid var(--border2); padding:9px 22px; min-height:38px; border-radius:8px; font-size:12.5px; cursor:pointer; margin-top:14px; }
.wac-btn-close:hover { background:var(--surface2); }
</style>`;

  let _projects = [];
  let _consumers = [];
  let _selectedConsumer = null;
  let _consumerCharges = [];
  let _activeWaiveId = null;

  function _renderPage() {
    return WAC_STYLES + `
<div class="wac-page">
  <div class="page-hdr">
    <h1>Waiveoff Add On Charge</h1>
    <div class="breadcrumb">Set Projects / <b>Addon Charges</b></div>
  </div>

  <!-- SECTION 1: Filters -->
  <div class="wac-card">
    <div class="wac-hdr">
      <span class="wac-hdr-title">WAIVEOFF ADD ON CHARGE</span>
    </div>
    <div class="wac-body">
      <div class="wac-filter-grid">
        <div class="wac-field">
          <span class="wac-lbl">* Project:</span>
          <select id="wac-project" onchange="WaiveoffAddonCharge.onProjectChange()">
            <option value="">&lt;--Select--&gt;</option>
          </select>
        </div>
        <div class="wac-field">
          <span class="wac-lbl">Tower:</span>
          <select id="wac-tower">
            <option value="">&lt;--All--&gt;</option>
          </select>
        </div>
        <div class="wac-field">
          <span class="wac-lbl">Unit Type:</span>
          <select id="wac-unit-type">
            <option value="">&lt;--All--&gt;</option>
            <option>Type-A</option>
            <option>Type-B</option>
            <option>Type-C</option>
            <option>Type-D</option>
            <option>Type-1A</option>
            <option>Shop</option>
            <option>Plot</option>
          </select>
        </div>
        <div class="wac-field">
          <span class="wac-lbl">Registration No.:</span>
          <input type="text" id="wac-reg-no" placeholder="Reg No.">
        </div>
        <div class="wac-field">
          <span class="wac-lbl">Name:</span>
          <input type="text" id="wac-name" placeholder="First or Last Name">
        </div>
        <div class="wac-field">
          <span class="wac-lbl">Unit No.:</span>
          <input type="text" id="wac-unit-no" placeholder="Unit No.">
        </div>
      </div>
      <div class="wac-filter-grid2">
        <div class="wac-field" style="justify-content:flex-end">
          <button class="wac-btn-fetch" id="wac-fetch-btn" onclick="WaiveoffAddonCharge.search()">FETCH</button>
        </div>
      </div>
    </div>
  </div>

  <!-- SECTION 2: Results -->
  <div id="wac-results-section" style="display:none">
    <div class="wac-card">
      <div class="wac-hdr">
        <span class="wac-hdr-title">CUSTOMER ADDON CHARGE DETAILS</span>
      </div>
      <div class="wac-body" style="padding:0">
        <div id="wac-results-table"></div>
      </div>
    </div>
  </div>

  <!-- SECTION 3: Customer Charges Panel -->
  <div id="wac-panel-section" style="display:none">
    <div class="wac-card">
      <div class="wac-hdr">
        <span class="wac-hdr-title">CUSTOMER DETAILS</span>
      </div>
      <div class="wac-body">
        <div class="wac-info-card">
          <div class="wac-info-grid" id="wac-cust-info-row1"></div>
          <div class="wac-info-grid" id="wac-cust-info-row2" style="margin-top:8px"></div>
        </div>
        <div id="wac-charges-wrap"></div>
        <div class="wac-msg" id="wac-panel-msg"></div>
        <button class="wac-btn-close" onclick="WaiveoffAddonCharge.closePanel()">CLOSE</button>
      </div>
    </div>
  </div>

</div>`;
  }

  async function _init() {
    await _loadProjects();
  }

  async function _loadProjects() {
    const token = _token();
    try {
      const res = await fetch('/api/projects', { headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      const sel = document.getElementById('wac-project');
      if (!sel) return;
      _projects = data.projects || data.data || data || [];
      _projects.forEach(function(p) {
        const o = document.createElement('option');
        o.value = p.id;
        o.textContent = p.name || p.project_name;
        sel.appendChild(o);
      });
    } catch (e) {
      console.error('WaiveoffAddonCharge: failed to load projects', e);
    }
  }

  async function onProjectChange() {
    const projectId = _gv('wac-project');
    const towerSel = document.getElementById('wac-tower');
    if (towerSel) towerSel.innerHTML = '<option value="">&lt;--All--&gt;</option>';
    _hideResults();
    _hidePanel();
    if (!projectId) return;
    const token = _token();
    try {
      const res = await fetch('/api/units/towers?projectId=' + encodeURIComponent(projectId), {
        headers: { Authorization: 'Bearer ' + token }
      });
      const data = await res.json();
      (data.data || []).forEach(function(t) {
        const o = document.createElement('option');
        o.value = t.id;
        o.textContent = t.name;
        towerSel.appendChild(o);
      });
    } catch (e) {
      console.error('WaiveoffAddonCharge: failed to load towers', e);
    }
  }

  async function _search() {
    const projectId = _gv('wac-project');
    if (!projectId) { alert('Please select a project.'); return; }

    const btn = document.getElementById('wac-fetch-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Loading...'; }
    _hidePanel();

    const params = new URLSearchParams({ projectId });
    const tower  = _gv('wac-tower');     if (tower)  params.set('towerId', tower);
    const utype  = _gv('wac-unit-type'); if (utype)  params.set('unitType', utype);
    const regNo  = _gv('wac-reg-no');    if (regNo)  params.set('registrationNo', regNo);
    const name   = _gv('wac-name');      if (name)   params.set('name', name);
    const unitNo = _gv('wac-unit-no');   if (unitNo) params.set('unitNo', unitNo);

    const token = _token();
    try {
      const res = await fetch('/api/addon-charges/consumers?' + params.toString(), {
        headers: { Authorization: 'Bearer ' + token }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fetch failed');
      _consumers = data.data || [];
      _renderResultsTable(_consumers);
    } catch (e) {
      const sec = document.getElementById('wac-results-section');
      if (sec) sec.style.display = 'block';
      const tbl = document.getElementById('wac-results-table');
      if (tbl) tbl.innerHTML = '<div class="wac-empty">Error: ' + _esc(e.message) + '</div>';
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'FETCH'; }
    }
  }

  function _renderResultsTable(rows) {
    const sec = document.getElementById('wac-results-section');
    const tbl = document.getElementById('wac-results-table');
    if (!sec || !tbl) return;
    sec.style.display = 'block';
    if (rows.length === 0) {
      tbl.innerHTML = '<div class="wac-empty">No customers found.</div>';
      return;
    }
    let html = '<table class="wac-table"><thead><tr>' +
      '<th>S.NO</th><th>REGISTRATION NO.</th><th>BOOKING DATE</th>' +
      '<th>NAME</th><th>TOWER</th><th>UNIT TYPE</th><th>UNIT NO.</th>' +
      '<th>PLAN</th><th style="text-align:right">AMOUNT</th><th>ACTION</th>' +
      '</tr></thead><tbody>';
    rows.forEach(function(r, i) {
      const hasCharges = parseFloat(r.addon_total || 0) > 0;
      const action = hasCharges
        ? '<span class="wac-waive-link" onclick="WaiveoffAddonCharge.showPanel(' + i + ')">Waive</span>'
        : '<span class="wac-no-charges">No Charges</span>';
      html += '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        '<td>' + _esc(r.registration_no || '') + '</td>' +
        '<td>' + _fmtDate(r.booking_date) + '</td>' +
        '<td>' + _esc(r.full_name) + '</td>' +
        '<td>' + _esc(r.tower_name || '') + '</td>' +
        '<td>' + _esc(r.unit_type || '') + '</td>' +
        '<td>' + _esc(r.unit_number || '') + '</td>' +
        '<td>' + _esc(r.payment_plan || '') + '</td>' +
        '<td class="wac-num">' + _fmtNum(r.addon_total) + '</td>' +
        '<td>' + action + '</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    tbl.innerHTML = html;
  }

  async function _showPanel(consumerIdx) {
    _selectedConsumer = _consumers[consumerIdx];
    if (!_selectedConsumer) return;
    _activeWaiveId = null;

    const sec = document.getElementById('wac-panel-section');
    if (sec) sec.style.display = 'block';
    _clearPanelMsg();
    _renderCustomerInfo(_selectedConsumer);
    await _loadConsumerCharges(_selectedConsumer.consumer_id);
    if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function _renderCustomerInfo(c) {
    const row1 = document.getElementById('wac-cust-info-row1');
    const row2 = document.getElementById('wac-cust-info-row2');
    if (row1) row1.innerHTML =
      _infoItem('Project', c.project_name) +
      _infoItem('Name', c.full_name) +
      _infoItem('Registration No.', c.registration_no) +
      _infoItem('Tower', c.tower_name || '—');
    if (row2) row2.innerHTML =
      _infoItem('Booking Date', _fmtDate(c.booking_date)) +
      _infoItem('Payment Plan', c.payment_plan || '—') +
      _infoItem('Unit Type', c.unit_type || '—') +
      _infoItem('Area (sqft)', c.super_area_sqft || '—');
  }

  function _infoItem(lbl, val) {
    return '<div class="wac-info-item">' +
      '<span class="wac-info-lbl">' + _esc(lbl) + '</span>' +
      '<span class="wac-info-val">' + _esc(String(val || '—')) + '</span>' +
      '</div>';
  }

  async function _loadConsumerCharges(consumerId) {
    const wrap = document.getElementById('wac-charges-wrap');
    if (!wrap) return;
    wrap.innerHTML = '<div class="wac-empty">Loading charges...</div>';
    const token = _token();
    try {
      const res = await fetch('/api/addon-charges/consumer?consumerId=' + encodeURIComponent(consumerId), {
        headers: { Authorization: 'Bearer ' + token }
      });
      const data = await res.json();
      _consumerCharges = data.data || [];
      _renderChargesTable(_consumerCharges);
    } catch (e) {
      wrap.innerHTML = '<div class="wac-empty">Error loading charges.</div>';
    }
  }

  function _renderChargesTable(rows) {
    const wrap = document.getElementById('wac-charges-wrap');
    if (!wrap) return;
    if (rows.length === 0) {
      wrap.innerHTML = '<div class="wac-empty">No active addon charges for this customer.</div>';
      return;
    }

    let tbody = '';
    rows.forEach(function(r, i) {
      tbody += '<tr id="wac-row-' + r.id + '">' +
        '<td>' + (i + 1) + '</td>' +
        '<td class="wac-tl">' + _esc(r.charge_name) + '</td>' +
        '<td>' + _fmtDate(r.effective_date) + '</td>' +
        '<td class="wac-tr">' + _fmtNum(r.amount) + '</td>' +
        '<td class="wac-tr">' + _fmtNum(r.total_amount) + '</td>' +
        '<td id="wac-status-' + r.id + '"><span class="wac-status-active">Active</span></td>' +
        '<td>' +
          '<span class="wac-waive-link" id="wac-waive-btn-' + r.id + '" onclick="WaiveoffAddonCharge.showWaiveForm(\'' + r.id + '\')">Waive Off</span>' +
        '</td>' +
        '</tr>' +
        '<tr class="wac-waive-form-row" id="wac-form-row-' + r.id + '" style="display:none">' +
          '<td colspan="7">' +
            '<div class="wac-waive-form-inner">' +
              '<div style="display:flex;flex-direction:column;gap:4px">' +
                '<span style="font-size:11px;font-weight:500;color:var(--text2)">* Waive Remark:</span>' +
                '<textarea id="wac-remark-' + r.id + '" rows="2" placeholder="Required — reason for waiving"></textarea>' +
              '</div>' +
              '<div style="display:flex;gap:8px;align-items:flex-end">' +
                '<button class="wac-btn-confirm-waive" id="wac-confirm-btn-' + r.id + '" onclick="WaiveoffAddonCharge.confirmWaive(\'' + r.id + '\')">CONFIRM WAIVE</button>' +
                '<button class="wac-btn-cancel-waive" onclick="WaiveoffAddonCharge.cancelWaiveForm(\'' + r.id + '\')">CANCEL</button>' +
              '</div>' +
            '</div>' +
          '</td>' +
        '</tr>';
    });

    wrap.innerHTML = '<table class="wac-charges-table"><thead><tr>' +
      '<th>S.NO</th><th>CHARGE NAME</th><th>EFF. DATE</th>' +
      '<th>AMOUNT</th><th>TOTAL AMOUNT</th><th>STATUS</th><th>ACTION</th>' +
      '</tr></thead><tbody>' + tbody + '</tbody></table>';
  }

  function _showWaiveForm(id) {
    // Close any other open waive form first
    if (_activeWaiveId && _activeWaiveId !== id) {
      const prev = document.getElementById('wac-form-row-' + _activeWaiveId);
      if (prev) prev.style.display = 'none';
    }
    _activeWaiveId = id;
    const formRow = document.getElementById('wac-form-row-' + id);
    if (formRow) formRow.style.display = '';
    const waiveBtn = document.getElementById('wac-waive-btn-' + id);
    if (waiveBtn) waiveBtn.style.display = 'none';
  }

  function _cancelWaiveForm(id) {
    const formRow = document.getElementById('wac-form-row-' + id);
    if (formRow) formRow.style.display = 'none';
    const waiveBtn = document.getElementById('wac-waive-btn-' + id);
    if (waiveBtn) waiveBtn.style.display = '';
    if (_activeWaiveId === id) _activeWaiveId = null;
    const remarkEl = document.getElementById('wac-remark-' + id);
    if (remarkEl) remarkEl.value = '';
  }

  async function _confirmWaive(id) {
    const remarkEl = document.getElementById('wac-remark-' + id);
    const waiveRemark = remarkEl ? remarkEl.value.trim() : '';
    if (!waiveRemark) {
      remarkEl && (remarkEl.style.border = '1px solid var(--red)');
      _showPanelMsg('Waive remark is required.', false);
      return;
    }
    if (remarkEl) remarkEl.style.border = '';

    const confirmBtn = document.getElementById('wac-confirm-btn-' + id);
    if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'Saving...'; }

    const token = _token();
    try {
      const res = await fetch('/api/addon-charges/consumer/' + id + '/waive', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ waiveRemark: waiveRemark })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');

      // Update row in place: hide form row, update status, hide action
      const formRow = document.getElementById('wac-form-row-' + id);
      if (formRow) formRow.style.display = 'none';
      const statusCell = document.getElementById('wac-status-' + id);
      if (statusCell) statusCell.innerHTML = '<span class="wac-status-waived">Waived</span>';
      const waiveBtn = document.getElementById('wac-waive-btn-' + id);
      if (waiveBtn) { waiveBtn.style.display = ''; waiveBtn.style.color = 'var(--text3)'; waiveBtn.style.cursor = 'default'; waiveBtn.style.textDecoration = 'none'; waiveBtn.onclick = null; waiveBtn.textContent = 'Waived'; }
      _activeWaiveId = null;

      _showPanelMsg('Charge waived successfully.', true);
      await _search();
    } catch (e) {
      _showPanelMsg('Error: ' + e.message, false);
      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'CONFIRM WAIVE'; }
    }
  }

  function _closePanel() {
    _selectedConsumer = null;
    _activeWaiveId = null;
    _hidePanel();
  }

  function _hidePanel() {
    const sec = document.getElementById('wac-panel-section');
    if (sec) sec.style.display = 'none';
  }

  function _hideResults() {
    const sec = document.getElementById('wac-results-section');
    if (sec) sec.style.display = 'none';
  }

  function _showPanelMsg(text, ok) {
    const el = document.getElementById('wac-panel-msg');
    if (!el) return;
    el.textContent = text;
    el.className = 'wac-msg ' + (ok ? 'wac-msg-ok' : 'wac-msg-err');
    el.style.display = 'block';
  }

  function _clearPanelMsg() {
    const el = document.getElementById('wac-panel-msg');
    if (el) { el.style.display = 'none'; el.textContent = ''; }
  }

  function _token() { return localStorage.getItem('rof-jwt') || ''; }

  function _gv(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function _esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _fmtNum(n) {
    const num = parseFloat(n || 0);
    if (isNaN(num)) return '0';
    return Math.round(num).toLocaleString('en-IN');
  }

  function _fmtDate(d) {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    return dd + '/' + mm + '/' + dt.getFullYear();
  }

  window.WaiveoffAddonCharge = {
    search:           _search,
    showPanel:        _showPanel,
    showWaiveForm:    _showWaiveForm,
    cancelWaiveForm:  _cancelWaiveForm,
    confirmWaive:     _confirmWaive,
    closePanel:       _closePanel,
    onProjectChange:  onProjectChange,
  };

  Pages.waiveoffAddonCharge = function(params) {
    const container = document.getElementById('content') || document.body;
    container.innerHTML = _renderPage();
    _init();
  };

})();
