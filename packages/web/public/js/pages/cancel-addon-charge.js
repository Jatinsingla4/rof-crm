/**
 * Cancel Extra Add On Charge
 * Cancel active addon charges assigned to consumers.
 */
(() => {

  const CAC2_STYLES = `<style id="cac2-styles">
.cac2-page { padding: 0; font-family: Arial, sans-serif; font-size: 13px; }
.cac2-card { background: #fff; border: 1px solid #ddd; border-radius: 3px; margin-bottom: 10px; }
.cac2-hdr {
  display: flex; justify-content: space-between; align-items: center;
  background: #1d3a6e; padding: 7px 12px; border-radius: 3px 3px 0 0;
}
.cac2-hdr-title { color: #fff; font-size: 13px; font-weight: bold; letter-spacing: .3px; }
.cac2-body { padding: 14px 16px 16px; }
.cac2-filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 8px 14px;
  margin-bottom: 10px;
}
.cac2-filter-grid2 {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 8px 14px;
  margin-bottom: 12px;
}
.cac2-field { display: flex; flex-direction: column; gap: 3px; }
.cac2-lbl { font-size: 11px; color: #555; white-space: nowrap; }
.cac2-filter-grid select,
.cac2-filter-grid input,
.cac2-filter-grid2 select,
.cac2-filter-grid2 input {
  padding: 5px 7px; border: 1px solid #ccc; border-radius: 3px;
  font-size: 12px; width: 100%; box-sizing: border-box;
}
.cac2-filter-grid select:focus,
.cac2-filter-grid input:focus,
.cac2-filter-grid2 select:focus,
.cac2-filter-grid2 input:focus { outline: none; border-color: #337ab7; }
.cac2-btn-fetch {
  background: #1d3a6e; color: #fff; border: none;
  padding: 6px 20px; border-radius: 3px; font-size: 13px; font-weight: bold; cursor: pointer;
  align-self: flex-end;
}
.cac2-btn-fetch:hover { background: #16305c; }
.cac2-btn-fetch:disabled { opacity: .7; cursor: not-allowed; }
.cac2-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.cac2-table th { background: #1d3a6e; color: #fff; padding: 6px 8px; text-align: left; font-weight: bold; font-size: 12px; white-space: nowrap; }
.cac2-table td { padding: 5px 8px; border-bottom: 1px solid #eee; vertical-align: middle; }
.cac2-table tr:nth-child(even) td { background: #f9fbff; }
.cac2-table tr:hover td { background: #eef4ff; }
.cac2-table td.cac2-num { text-align: right; }
.cac2-link { color: #337ab7; cursor: pointer; text-decoration: underline; font-size: 12px; }
.cac2-link:hover { color: #1d3a6e; }
.cac2-cancel-link { color: #a94442; cursor: pointer; text-decoration: underline; font-size: 12px; }
.cac2-cancel-link:hover { color: #800; }
.cac2-no-charges { color: #aaa; font-size: 12px; }
.cac2-empty { text-align: center; color: #999; padding: 16px; font-size: 13px; }
.cac2-info-card {
  background: #f7f9fc; border: 1px solid #d0daea; border-radius: 3px;
  padding: 12px 16px; margin-bottom: 10px;
}
.cac2-info-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 6px 20px;
}
.cac2-info-item { display: flex; flex-direction: column; gap: 2px; }
.cac2-info-lbl { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: .3px; }
.cac2-info-val { font-size: 12px; font-weight: 600; color: #222; }
.cac2-charges-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
.cac2-charges-table th { background: #1d3a6e; color: #fff; padding: 5px 7px; text-align: center; font-size: 11px; white-space: nowrap; }
.cac2-charges-table td { padding: 4px 7px; border-bottom: 1px solid #eee; vertical-align: middle; text-align: center; }
.cac2-charges-table td.cac2-tl { text-align: left; }
.cac2-charges-table td.cac2-tr { text-align: right; }
.cac2-msg { margin-top: 10px; font-size: 13px; padding: 6px 10px; border-radius: 3px; display: none; }
.cac2-msg-ok  { background: #dff0d8; color: #3c763d; border: 1px solid #d6e9c6; }
.cac2-msg-err { background: #f2dede; color: #a94442; border: 1px solid #ebccd1; }
.cac2-btn-close {
  background: #fff; color: #555; border: 1px solid #ccc;
  padding: 6px 16px; border-radius: 3px; font-size: 13px; cursor: pointer; margin-top: 8px;
}
.cac2-btn-close:hover { background: #f5f5f5; }
</style>`;

  let _projects = [];
  let _consumers = [];
  let _selectedConsumer = null;
  let _consumerCharges = [];

  function _renderPage() {
    return CAC2_STYLES + `
<div class="cac2-page">

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
            <option>Type-A</option>
            <option>Type-B</option>
            <option>Type-C</option>
            <option>Type-D</option>
            <option>Type-1A</option>
            <option>Shop</option>
            <option>Plot</option>
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
    wrap.innerHTML = '<div style="color:#999;font-size:12px;padding:8px">Loading charges...</div>';
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
        '<td><span style="color:#3c763d;font-weight:600">Active</span></td>' +
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
