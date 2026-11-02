/**
 * Cancel Extra Add On Charge
 * Cancel active addon charges assigned to consumers.
 */
(() => {

  const CAC2_STYLES = `<style id="cac2-styles">
.cac2-page { max-width:1400px; margin:0 auto; font-size:13px; color:var(--text); }
.cac2-card { background:var(--surface); border:1px solid var(--border2); border-radius:10px; margin-bottom:16px; overflow:hidden; }
.cac2-hdr { display:flex; justify-content:space-between; align-items:center; background:var(--teal-bg); padding:14px 18px; border-bottom:1px solid var(--border); }
.cac2-hdr-title { color:var(--text); font-size:12px; font-weight:600; letter-spacing:.6px; text-transform:uppercase; }
.cac2-body { padding:18px; }
.cac2-filter-grid, .cac2-filter-grid2 { display:grid; grid-template-columns:repeat(auto-fill, minmax(190px, 1fr)); gap:14px 18px; margin-bottom:14px; }
.cac2-filter-grid2 { margin-bottom:0; }
.cac2-field { display:flex; flex-direction:column; gap:6px; }
.cac2-lbl { font-size:11px; font-weight:500; color:var(--text2); letter-spacing:.3px; white-space:nowrap; }
.cac2-filter-grid select, .cac2-filter-grid input, .cac2-filter-grid2 select, .cac2-filter-grid2 input { padding:9px 12px; min-height:38px; border:1px solid var(--border2); border-radius:8px; font-size:13px; width:100%; box-sizing:border-box; background:var(--surface); color:var(--text); }
.cac2-filter-grid select:focus, .cac2-filter-grid input:focus, .cac2-filter-grid2 select:focus, .cac2-filter-grid2 input:focus { outline:none; border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg); }
.cac2-btn-fetch { background:var(--teal); color:#fff; border:none; padding:9px 26px; min-height:38px; border-radius:8px; font-size:12.5px; font-weight:600; cursor:pointer; align-self:flex-start; }
.cac2-btn-fetch:hover { filter:brightness(.92); }
.cac2-btn-fetch:disabled { opacity:.7; cursor:not-allowed; }
.cac2-table, .cac2-charges-table { width:100%; border-collapse:collapse; font-size:12.5px; }
.cac2-table th, .cac2-charges-table th { background:var(--surface2); color:var(--text3); padding:10px 14px; text-align:left; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:.4px; white-space:nowrap; border-bottom:1px solid var(--border2); }
.cac2-table td, .cac2-charges-table td { padding:10px 14px; border-bottom:1px solid var(--border); vertical-align:middle; color:var(--text); }
.cac2-table tbody tr:hover td, .cac2-charges-table tbody tr:hover td { background:var(--surface2); }
.cac2-table td.cac2-num { text-align:right; }
.cac2-link { color:var(--teal); cursor:pointer; font-size:12px; font-weight:600; }
.cac2-link:hover { text-decoration:underline; }
.cac2-cancel-link { color:var(--red); cursor:pointer; font-size:12px; font-weight:600; }
.cac2-cancel-link:hover { text-decoration:underline; }
.cac2-no-charges { color:var(--text3); font-size:12px; }
.cac2-empty { text-align:center; color:var(--text3); padding:36px 18px; font-size:13px; }
.cac2-info-card { background:var(--surface2); border:1px solid var(--border2); border-radius:10px; padding:14px 18px; margin-bottom:16px; }
.cac2-info-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:10px 20px; }
.cac2-info-item { display:flex; flex-direction:column; gap:3px; }
.cac2-info-lbl { font-size:10.5px; color:var(--text3); text-transform:uppercase; letter-spacing:.4px; }
.cac2-info-val { font-size:13px; font-weight:600; color:var(--text); }
.cac2-charges-table { border:1px solid var(--border2); border-radius:8px; overflow:hidden; font-size:12px; }
.cac2-charges-table th { text-align:center; }
.cac2-charges-table td { text-align:center; }
.cac2-charges-table td.cac2-tl { text-align:left; }
.cac2-charges-table td.cac2-tr { text-align:right; }
.cac2-status-active { color:var(--teal); background:var(--teal-bg); padding:3px 10px; border-radius:999px; font-size:11px; font-weight:600; }
.cac2-msg { margin-top:14px; font-size:12.5px; padding:9px 14px; border-radius:8px; display:none; }
.cac2-msg-ok  { background:var(--teal-bg); color:var(--teal); border:1px solid var(--teal); font-weight:600; }
.cac2-msg-err { background:var(--red-bg); color:var(--red); border:1px solid var(--red); }
.cac2-btn-close { background:var(--surface); color:var(--text2); border:1px solid var(--border2); padding:9px 22px; min-height:38px; border-radius:8px; font-size:12.5px; cursor:pointer; margin-top:14px; }
.cac2-btn-close:hover { background:var(--surface2); }
</style>`;

  let _projects = [];
  let _consumers = [];
  let _selectedConsumer = null;
  let _consumerCharges = [];

  function _renderPage() {
    return CAC2_STYLES + `
<div class="cac2-page">
  <div class="page-hdr">
    <h1>Cancel Extra Add On Charge</h1>
    <div class="breadcrumb">Set Projects / <b>Addon Charges</b></div>
  </div>

  <!-- SECTION 1: Filters -->
  <div class="cac2-card">
    <div class="cac2-hdr">
      <span class="cac2-hdr-title">CANCEL EXTRA ADD ON CHARGE</span>
    </div>
    <div class="cac2-body">
      <div class="cac2-filter-grid">
        <div class="cac2-field">
          <span class="cac2-lbl">* Project:</span>
          <select id="cac2-project" onchange="CancelAddonCharge.onProjectChange()">
            <option value="">&lt;--Select--&gt;</option>
          </select>
        </div>
        <div class="cac2-field">
          <span class="cac2-lbl">Tower:</span>
          <select id="cac2-tower">
            <option value="">&lt;--All--&gt;</option>
          </select>
        </div>
        <div class="cac2-field">
          <span class="cac2-lbl">Unit Type:</span>
          <select id="cac2-unit-type">
            <option value="">&lt;--All--&gt;</option>
          </select>
        </div>
        <div class="cac2-field">
          <span class="cac2-lbl">Registration No.:</span>
          <input type="text" id="cac2-reg-no" placeholder="Reg No.">
        </div>
        <div class="cac2-field">
          <span class="cac2-lbl">Name:</span>
          <input type="text" id="cac2-name" placeholder="First or Last Name">
        </div>
        <div class="cac2-field">
          <span class="cac2-lbl">Unit No.:</span>
          <input type="text" id="cac2-unit-no" placeholder="Unit No.">
        </div>
      </div>
      <div class="cac2-filter-grid2">
        <div class="cac2-field" style="justify-content:flex-end">
          <button class="cac2-btn-fetch" id="cac2-fetch-btn" onclick="CancelAddonCharge.search()">FETCH</button>
        </div>
      </div>
    </div>
  </div>

  <!-- SECTION 2: Results -->
  <div id="cac2-results-section" style="display:none">
    <div class="cac2-card">
      <div class="cac2-hdr">
        <span class="cac2-hdr-title">CUSTOMER ADDON CHARGE DETAILS</span>
      </div>
      <div class="cac2-body" style="padding:0">
        <div id="cac2-results-table"></div>
      </div>
    </div>
  </div>

  <!-- SECTION 3: Customer Charges Panel -->
  <div id="cac2-panel-section" style="display:none">
    <div class="cac2-card">
      <div class="cac2-hdr">
        <span class="cac2-hdr-title">CUSTOMER DETAILS</span>
      </div>
      <div class="cac2-body">
        <div class="cac2-info-card">
          <div class="cac2-info-grid" id="cac2-cust-info-row1"></div>
          <div class="cac2-info-grid" id="cac2-cust-info-row2" style="margin-top:8px"></div>
        </div>
        <div id="cac2-charges-wrap"></div>
        <div class="cac2-msg" id="cac2-panel-msg"></div>
        <button class="cac2-btn-close" onclick="CancelAddonCharge.closePanel()">CLOSE</button>
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
      const sel = document.getElementById('cac2-project');
      if (!sel) return;
      _projects = data.projects || data.data || data || [];
      _projects.forEach(function(p) {
        const o = document.createElement('option');
        o.value = p.id;
        o.textContent = p.name || p.project_name;
        sel.appendChild(o);
      });
    } catch (e) {
      console.error('CancelAddonCharge: failed to load projects', e);
    }
  }

  async function onProjectChange() {
    const projectId = _gv('cac2-project');
    const towerSel = document.getElementById('cac2-tower');
    if (towerSel) towerSel.innerHTML = '<option value="">&lt;--All--&gt;</option>';
    const typeSel0 = document.getElementById('cac2-unit-type');
    if (typeSel0) typeSel0.innerHTML = '<option value="">&lt;--All--&gt;</option>';
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
      console.error('CancelAddonCharge: failed to load towers', e);
    }
    // the unit types are the ones of this project, not a fixed list
    const typeSel = document.getElementById('cac2-unit-type');
    if (typeSel) typeSel.innerHTML = '<option value="">&lt;--All--&gt;</option>';
    try {
      const tr = await fetch('/api/master/unit-types?project_id=' + encodeURIComponent(projectId), { headers: { Authorization: 'Bearer ' + token } });
      ((await tr.json()).data || []).forEach(function(t) {
        const o = document.createElement('option');
        o.textContent = t.name;
        if (typeSel) typeSel.appendChild(o);
      });
    } catch (e) {
      console.error('CancelAddonCharge: failed to load unit types', e);
    }
  }

  async function _search() {
    const projectId = _gv('cac2-project');
    if (!projectId) { alert('Please select a project.'); return; }

    const btn = document.getElementById('cac2-fetch-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Loading...'; }
    _hidePanel();

    const params = new URLSearchParams({ projectId });
    const tower  = _gv('cac2-tower');     if (tower)  params.set('towerId', tower);
    const utype  = _gv('cac2-unit-type'); if (utype)  params.set('unitType', utype);
    const regNo  = _gv('cac2-reg-no');    if (regNo)  params.set('registrationNo', regNo);
    const name   = _gv('cac2-name');      if (name)   params.set('name', name);
    const unitNo = _gv('cac2-unit-no');   if (unitNo) params.set('unitNo', unitNo);

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
      const sec = document.getElementById('cac2-results-section');
      if (sec) sec.style.display = 'block';
      const tbl = document.getElementById('cac2-results-table');
      if (tbl) tbl.innerHTML = '<div class="cac2-empty">Error: ' + _esc(e.message) + '</div>';
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'FETCH'; }
    }
  }

  function _renderResultsTable(rows) {
    const sec = document.getElementById('cac2-results-section');
    const tbl = document.getElementById('cac2-results-table');
    if (!sec || !tbl) return;
    sec.style.display = 'block';
    if (rows.length === 0) {
      tbl.innerHTML = '<div class="cac2-empty">No customers found.</div>';
      return;
    }
    let html = '<table class="cac2-table"><thead><tr>' +
      '<th>S.NO</th><th>REGISTRATION NO.</th><th>BOOKING DATE</th>' +
      '<th>NAME</th><th>TOWER</th><th>UNIT TYPE</th><th>UNIT NO.</th>' +
      '<th>PLAN</th><th style="text-align:right">AMOUNT</th><th>ACTION</th>' +
      '</tr></thead><tbody>';
    rows.forEach(function(r, i) {
      const hasCharges = parseFloat(r.addon_total || 0) > 0;
      const action = hasCharges
        ? '<span class="cac2-cancel-link" onclick="CancelAddonCharge.showPanel(' + i + ')">Cancel</span>'
        : '<span class="cac2-no-charges">No Charges</span>';
      html += '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        '<td>' + _esc(r.registration_no || '') + '</td>' +
        '<td>' + _fmtDate(r.booking_date) + '</td>' +
        '<td>' + _esc(r.full_name) + '</td>' +
        '<td>' + _esc(r.tower_name || '') + '</td>' +
        '<td>' + _esc(r.unit_type || '') + '</td>' +
        '<td>' + _esc(r.unit_number || '') + '</td>' +
        '<td>' + _esc(r.payment_plan || '') + '</td>' +
        '<td class="cac2-num">' + _fmtNum(r.addon_total) + '</td>' +
        '<td>' + action + '</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    tbl.innerHTML = html;
  }

  async function _showPanel(consumerIdx) {
    _selectedConsumer = _consumers[consumerIdx];
    if (!_selectedConsumer) return;

    const sec = document.getElementById('cac2-panel-section');
    if (sec) sec.style.display = 'block';
    _clearPanelMsg();
    _renderCustomerInfo(_selectedConsumer);
    await _loadConsumerCharges(_selectedConsumer.consumer_id);
    if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function _renderCustomerInfo(c) {
    const row1 = document.getElementById('cac2-cust-info-row1');
    const row2 = document.getElementById('cac2-cust-info-row2');
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
    return '<div class="cac2-info-item">' +
      '<span class="cac2-info-lbl">' + _esc(lbl) + '</span>' +
      '<span class="cac2-info-val">' + _esc(String(val || '—')) + '</span>' +
      '</div>';
  }

  async function _loadConsumerCharges(consumerId) {
    const wrap = document.getElementById('cac2-charges-wrap');
    if (!wrap) return;
    wrap.innerHTML = '<div class="cac2-empty">Loading charges...</div>';
    const token = _token();
    try {
      const res = await fetch('/api/addon-charges/consumer?consumerId=' + encodeURIComponent(consumerId), {
        headers: { Authorization: 'Bearer ' + token }
      });
      const data = await res.json();
      _consumerCharges = data.data || [];
      _renderChargesTable(_consumerCharges);
    } catch (e) {
      wrap.innerHTML = '<div class="cac2-empty">Error loading charges.</div>';
    }
  }

  function _renderChargesTable(rows) {
    const wrap = document.getElementById('cac2-charges-wrap');
    if (!wrap) return;
    if (rows.length === 0) {
      wrap.innerHTML = '<div class="cac2-empty">No active addon charges for this customer.</div>';
      return;
    }
    let tbody = '';
    rows.forEach(function(r, i) {
      tbody += '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        '<td class="cac2-tl">' + _esc(r.charge_name) + '</td>' +
        '<td>' + _fmtDate(r.effective_date) + '</td>' +
        '<td class="cac2-tr">' + _fmtNum(r.amount) + '</td>' +
        '<td class="cac2-tr">' + _fmtNum(r.total_amount) + '</td>' +
        '<td><span class="cac2-status-active">Active</span></td>' +
        '<td>' +
          '<span class="cac2-cancel-link" onclick="CancelAddonCharge.cancelCharge(\'' + r.id + '\')">Cancel</span>' +
        '</td>' +
        '</tr>';
    });
    wrap.innerHTML = '<table class="cac2-charges-table"><thead><tr>' +
      '<th>S.NO</th><th>CHARGE NAME</th><th>EFF. DATE</th>' +
      '<th>AMOUNT</th><th>TOTAL AMOUNT</th><th>STATUS</th><th>ACTION</th>' +
      '</tr></thead><tbody>' + tbody + '</tbody></table>';
  }

  async function _cancelCharge(id) {
    if (!window.confirm('Cancel this charge?')) return;
    const token = _token();
    try {
      const res = await fetch('/api/addon-charges/consumer/' + id + '/cancel', {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + token }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      _showPanelMsg('Charge cancelled successfully.', true);
      if (_selectedConsumer) {
        await _loadConsumerCharges(_selectedConsumer.consumer_id);
        await _search();
      }
    } catch (e) {
      _showPanelMsg('Error: ' + e.message, false);
    }
  }

  function _closePanel() {
    _selectedConsumer = null;
    _hidePanel();
  }

  function _hidePanel() {
    const sec = document.getElementById('cac2-panel-section');
    if (sec) sec.style.display = 'none';
  }

  function _hideResults() {
    const sec = document.getElementById('cac2-results-section');
    if (sec) sec.style.display = 'none';
  }

  function _showPanelMsg(text, ok) {
    const el = document.getElementById('cac2-panel-msg');
    if (!el) return;
    el.textContent = text;
    el.className = 'cac2-msg ' + (ok ? 'cac2-msg-ok' : 'cac2-msg-err');
    el.style.display = 'block';
  }

  function _clearPanelMsg() {
    const el = document.getElementById('cac2-panel-msg');
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

  window.CancelAddonCharge = {
    search:          _search,
    showPanel:       _showPanel,
    cancelCharge:    _cancelCharge,
    closePanel:      _closePanel,
    onProjectChange: onProjectChange,
  };

  Pages.cancelAddonCharge = function(params) {
    const container = document.getElementById('content') || document.body;
    container.innerHTML = _renderPage();
    _init();
  };

})();
