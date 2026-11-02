/**
 * Set Extra Add On Charge On Bulk Customer
 * Apply addon charges to multiple consumers at once.
 */
(() => {

  const BAC_STYLES = `<style id="bac-styles">
.bac-page { max-width:1400px; margin:0 auto; font-size:13px; color:var(--text); }
.bac-card { background:var(--surface); border:1px solid var(--border2); border-radius:10px; margin-bottom:16px; overflow:hidden; }
.bac-hdr { display:flex; justify-content:space-between; align-items:center; background:var(--teal-bg); padding:14px 18px; border-bottom:1px solid var(--border); }
.bac-hdr-title { color:var(--text); font-size:12px; font-weight:600; letter-spacing:.6px; text-transform:uppercase; }
.bac-body { padding:18px; }
.bac-filter-grid, .bac-filter-grid2 { display:grid; grid-template-columns:repeat(auto-fill, minmax(190px, 1fr)); gap:14px 18px; margin-bottom:14px; }
.bac-filter-grid2 { margin-bottom:0; }
.bac-field { display:flex; flex-direction:column; gap:6px; }
.bac-lbl { font-size:11px; font-weight:500; color:var(--text2); letter-spacing:.3px; white-space:nowrap; }
.bac-filter-grid select, .bac-filter-grid input, .bac-filter-grid2 select, .bac-filter-grid2 input,
.bac-bulk-form-grid select, .bac-bulk-form-grid input, .bac-bulk-form-grid textarea { padding:9px 12px; min-height:38px; border:1px solid var(--border2); border-radius:8px; font-size:13px; width:100%; box-sizing:border-box; background:var(--surface); color:var(--text); }
.bac-bulk-form-grid textarea { min-height:70px; resize:vertical; }
.bac-filter-grid select:focus, .bac-filter-grid input:focus, .bac-filter-grid2 select:focus, .bac-filter-grid2 input:focus,
.bac-bulk-form-grid select:focus, .bac-bulk-form-grid input:focus, .bac-bulk-form-grid textarea:focus { outline:none; border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg); }
.bac-btn-fetch, .bac-btn-apply { background:var(--teal); color:#fff; border:none; padding:9px 26px; min-height:38px; border-radius:8px; font-size:12.5px; font-weight:600; cursor:pointer; }
.bac-btn-fetch { align-self:flex-start; }
.bac-btn-fetch:hover, .bac-btn-apply:hover { filter:brightness(.92); }
.bac-btn-fetch:disabled, .bac-btn-apply:disabled { opacity:.7; cursor:not-allowed; }
.bac-table { width:100%; border-collapse:collapse; font-size:12.5px; }
.bac-table th { background:var(--surface2); color:var(--text3); padding:10px 14px; text-align:left; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:.4px; white-space:nowrap; border-bottom:1px solid var(--border2); }
.bac-table td { padding:10px 14px; border-bottom:1px solid var(--border); vertical-align:middle; color:var(--text); }
.bac-table tbody tr:hover td { background:var(--surface2); }
.bac-table td.bac-num { text-align:right; }
.bac-table td.bac-center { text-align:center; }
.bac-empty { text-align:center; color:var(--text3); padding:36px 18px; font-size:13px; }
.bac-select-all-row { display:flex; align-items:center; gap:8px; padding:10px 18px; background:var(--surface2); border-bottom:1px solid var(--border2); font-size:12.5px; color:var(--text); }
.bac-select-all-row input[type="checkbox"], .bac-table input[type="checkbox"] { width:15px; height:15px; cursor:pointer; accent-color:var(--teal); }
.bac-bulk-form-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:14px 18px; margin-bottom:16px; }
.bac-msg { margin-top:14px; font-size:12.5px; padding:9px 14px; border-radius:8px; display:none; }
.bac-msg-ok  { background:var(--teal-bg); color:var(--teal); border:1px solid var(--teal); font-weight:600; }
.bac-msg-err { background:var(--red-bg); color:var(--red); border:1px solid var(--red); }
.bac-progress { font-size:12.5px; color:var(--teal); margin-top:10px; display:none; }
.bac-form-title { font-size:12px; font-weight:600; color:var(--teal); margin-bottom:14px; text-transform:uppercase; letter-spacing:.6px; }
@media (max-width:700px) { .bac-bulk-form-grid > .bac-field { grid-column:auto !important; } }
</style>`;

  let _projects = [];
  let _consumers = [];
  let _chargeMaster = [];

  function _renderPage() {
    return BAC_STYLES + `
<div class="bac-page">
  <div class="page-hdr">
    <h1>Set Extra Add On Charge on Bulk Customer</h1>
    <div class="breadcrumb">Set Projects / <b>Addon Charges</b></div>
  </div>

  <!-- SECTION 1: Filters -->
  <div class="bac-card">
    <div class="bac-hdr">
      <span class="bac-hdr-title">SET EXTRA ADD ON CHARGE ON BULK CUSTOMER</span>
    </div>
    <div class="bac-body">
      <div class="bac-filter-grid">
        <div class="bac-field">
          <span class="bac-lbl">* Project:</span>
          <select id="bac-project" onchange="BulkAddonCharge.onProjectChange()">
            <option value="">&lt;--Select--&gt;</option>
          </select>
        </div>
        <div class="bac-field">
          <span class="bac-lbl">Tower:</span>
          <select id="bac-tower">
            <option value="">&lt;--All--&gt;</option>
          </select>
        </div>
        <div class="bac-field">
          <span class="bac-lbl">Unit Type:</span>
          <select id="bac-unit-type">
            <option value="">&lt;--All--&gt;</option>
          </select>
        </div>
        <div class="bac-field">
          <span class="bac-lbl">Registration No.:</span>
          <input type="text" id="bac-reg-no" placeholder="Reg No.">
        </div>
        <div class="bac-field">
          <span class="bac-lbl">Name:</span>
          <input type="text" id="bac-name" placeholder="First or Last Name">
        </div>
        <div class="bac-field">
          <span class="bac-lbl">Unit No.:</span>
          <input type="text" id="bac-unit-no" placeholder="Unit No.">
        </div>
      </div>
      <div class="bac-filter-grid2">
        <div class="bac-field" style="justify-content:flex-end">
          <button class="bac-btn-fetch" id="bac-fetch-btn" onclick="BulkAddonCharge.search()">FETCH</button>
        </div>
      </div>
    </div>
  </div>

  <!-- SECTION 2: Results -->
  <div id="bac-results-section" style="display:none">
    <div class="bac-card">
      <div class="bac-hdr">
        <span class="bac-hdr-title">CUSTOMER ADDON CHARGE DETAILS</span>
      </div>
      <div class="bac-body" style="padding:0">
        <div id="bac-results-table"></div>
      </div>
    </div>
  </div>

  <!-- SECTION 3: Bulk Charge Form -->
  <div id="bac-form-section" style="display:none">
    <div class="bac-card">
      <div class="bac-hdr">
        <span class="bac-hdr-title">ADD ADDON CHARGE TO SELECTED CUSTOMERS</span>
      </div>
      <div class="bac-body">
        <div class="bac-form-title">CHARGE DETAILS</div>
        <div class="bac-bulk-form-grid">
          <div class="bac-field">
            <span class="bac-lbl">* Charge Name:</span>
            <select id="bac-charge-name" onchange="BulkAddonCharge.onChargeSelect()">
              <option value="">&lt;--Select--&gt;</option>
            </select>
          </div>
          <div class="bac-field">
            <span class="bac-lbl">* Amount (Rs.):</span>
            <input type="number" id="bac-amount" min="0" step="0.01" value="0">
          </div>
          <div class="bac-field" style="grid-column: span 2">
            <span class="bac-lbl">Remark:</span>
            <textarea id="bac-remark" rows="2" placeholder="Optional remark"></textarea>
          </div>
        </div>
        <button class="bac-btn-apply" id="bac-apply-btn" onclick="BulkAddonCharge.applyToSelected()">APPLY TO SELECTED</button>
        <div class="bac-progress" id="bac-progress"></div>
        <div class="bac-msg" id="bac-form-msg"></div>
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
      const sel = document.getElementById('bac-project');
      if (!sel) return;
      _projects = data.projects || data.data || data || [];
      _projects.forEach(function(p) {
        const o = document.createElement('option');
        o.value = p.id;
        o.textContent = p.name || p.project_name;
        sel.appendChild(o);
      });
    } catch (e) {
      console.error('BulkAddonCharge: failed to load projects', e);
    }
  }

  async function onProjectChange() {
    const projectId = _gv('bac-project');
    const towerSel = document.getElementById('bac-tower');
    if (towerSel) towerSel.innerHTML = '<option value="">&lt;--All--&gt;</option>';
    const typeSel0 = document.getElementById('bac-unit-type');
    if (typeSel0) typeSel0.innerHTML = '<option value="">&lt;--All--&gt;</option>';
    _hideResults();
    _hideForm();
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
      console.error('BulkAddonCharge: failed to load towers', e);
    }
    // the unit types are the ones of this project, not a fixed list
    const typeSel = document.getElementById('bac-unit-type');
    if (typeSel) typeSel.innerHTML = '<option value="">&lt;--All--&gt;</option>';
    try {
      const tr = await fetch('/api/master/unit-types?project_id=' + encodeURIComponent(projectId), { headers: { Authorization: 'Bearer ' + token } });
      ((await tr.json()).data || []).forEach(function(t) {
        const o = document.createElement('option');
        o.textContent = t.name;
        if (typeSel) typeSel.appendChild(o);
      });
    } catch (e) {
      console.error('BulkAddonCharge: failed to load unit types', e);
    }
  }

  async function _search() {
    const projectId = _gv('bac-project');
    if (!projectId) { alert('Please select a project.'); return; }

    const btn = document.getElementById('bac-fetch-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Loading...'; }
    _hideForm();

    const params = new URLSearchParams({ projectId });
    const tower  = _gv('bac-tower');     if (tower)  params.set('towerId', tower);
    const utype  = _gv('bac-unit-type'); if (utype)  params.set('unitType', utype);
    const regNo  = _gv('bac-reg-no');    if (regNo)  params.set('registrationNo', regNo);
    const name   = _gv('bac-name');      if (name)   params.set('name', name);
    const unitNo = _gv('bac-unit-no');   if (unitNo) params.set('unitNo', unitNo);

    const token = _token();
    try {
      const res = await fetch('/api/addon-charges/consumers?' + params.toString(), {
        headers: { Authorization: 'Bearer ' + token }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fetch failed');
      _consumers = data.data || [];
      _renderResultsTable(_consumers);
      if (_consumers.length > 0) {
        await _loadChargeMaster(projectId);
        const formSec = document.getElementById('bac-form-section');
        if (formSec) formSec.style.display = 'block';
      }
    } catch (e) {
      const sec = document.getElementById('bac-results-section');
      if (sec) sec.style.display = 'block';
      const tbl = document.getElementById('bac-results-table');
      if (tbl) tbl.innerHTML = '<div class="bac-empty">Error: ' + _esc(e.message) + '</div>';
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'FETCH'; }
    }
  }

  function _renderResultsTable(rows) {
    const sec = document.getElementById('bac-results-section');
    const tbl = document.getElementById('bac-results-table');
    if (!sec || !tbl) return;
    sec.style.display = 'block';
    if (rows.length === 0) {
      tbl.innerHTML = '<div class="bac-empty">No customers found.</div>';
      return;
    }

    let html = '<div class="bac-select-all-row">' +
      '<input type="checkbox" id="bac-select-all" onchange="BulkAddonCharge.toggleSelectAll(this)">' +
      '<label for="bac-select-all" style="cursor:pointer">Select All</label>' +
      '<span style="color:var(--text3);margin-left:8px" id="bac-selected-count"></span>' +
      '</div>';

    html += '<table class="bac-table"><thead><tr>' +
      '<th style="width:32px;text-align:center">#</th>' +
      '<th>S.NO</th><th>REGISTRATION NO.</th><th>BOOKING DATE</th>' +
      '<th>NAME</th><th>TOWER</th><th>UNIT TYPE</th><th>UNIT NO.</th>' +
      '<th>PLAN</th><th style="text-align:right">AMOUNT</th>' +
      '</tr></thead><tbody>';
    rows.forEach(function(r, i) {
      html += '<tr>' +
        '<td class="bac-center"><input type="checkbox" class="bac-row-check" data-idx="' + i + '" onchange="BulkAddonCharge.updateCount()"></td>' +
        '<td>' + (i + 1) + '</td>' +
        '<td>' + _esc(r.registration_no || '') + '</td>' +
        '<td>' + _fmtDate(r.booking_date) + '</td>' +
        '<td>' + _esc(r.full_name) + '</td>' +
        '<td>' + _esc(r.tower_name || '') + '</td>' +
        '<td>' + _esc(r.unit_type || '') + '</td>' +
        '<td>' + _esc(r.unit_number || '') + '</td>' +
        '<td>' + _esc(r.payment_plan || '') + '</td>' +
        '<td class="bac-num">' + _fmtNum(r.addon_total) + '</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    tbl.innerHTML = html;
  }

  function _toggleSelectAll(cb) {
    const checks = document.querySelectorAll('.bac-row-check');
    checks.forEach(function(c) { c.checked = cb.checked; });
    _updateCount();
  }

  function _updateCount() {
    const checks = document.querySelectorAll('.bac-row-check:checked');
    const el = document.getElementById('bac-selected-count');
    if (el) el.textContent = checks.length > 0 ? checks.length + ' selected' : '';
    // Update select-all checkbox state
    const all = document.querySelectorAll('.bac-row-check');
    const selAll = document.getElementById('bac-select-all');
    if (selAll) selAll.checked = all.length > 0 && checks.length === all.length;
  }

  async function _loadChargeMaster(projectId) {
    const sel = document.getElementById('bac-charge-name');
    if (!sel) return;
    sel.innerHTML = '<option value="">&lt;--Select--&gt;</option>';
    if (!projectId) return;
    const token = _token();
    try {
      const res = await fetch('/api/addon-charges/master?projectId=' + encodeURIComponent(projectId), {
        headers: { Authorization: 'Bearer ' + token }
      });
      const data = await res.json();
      _chargeMaster = data.data || [];
      _chargeMaster.forEach(function(m) {
        const o = document.createElement('option');
        o.value = m.id;
        o.dataset.name = m.charge_name;
        o.dataset.amount = m.default_amount;
        o.dataset.rateType = m.rate_type;
        o.dataset.ratePerSqft = m.rate_per_sqft_inr;
        o.dataset.cgst = m.cgst_pct;
        o.dataset.sgst = m.sgst_pct;
        o.textContent = m.charge_name;
        sel.appendChild(o);
      });
    } catch (e) {
      console.error('BulkAddonCharge: failed to load charge master', e);
    }
  }

  function onChargeSelect() {
    const sel = document.getElementById('bac-charge-name');
    if (!sel) return;
    const opt = sel.selectedOptions[0];
    if (!opt || !opt.dataset.amount) return;
    const amtEl = document.getElementById('bac-amount');
    if (amtEl) amtEl.value = parseFloat(opt.dataset.amount || 0);
  }

  async function _applyToSelected() {
    const projectId = _gv('bac-project');
    const sel = document.getElementById('bac-charge-name');
    const opt = sel && sel.selectedOptions[0];
    const chargeName = opt && opt.dataset.name ? opt.dataset.name : '';
    const chargeMasterId = opt ? opt.value : null;
    // A rate or a percent is worked out by the server for each customer's own unit, so no amount is sent for it
    const isPerSqft = !!(opt && (opt.dataset.rateType === 'per_sqft' || opt.dataset.rateType === 'percent'));
    const ratePerSqft = opt && opt.dataset.rateType === 'per_sqft' ? parseFloat(opt.dataset.ratePerSqft || 0) : 1;
    const amount = parseFloat(_gv('bac-amount') || '0');
    const remark = _gv('bac-remark');
    const cgstPct = opt && opt.dataset.cgst ? parseFloat(opt.dataset.cgst) : 9;
    const sgstPct = opt && opt.dataset.sgst ? parseFloat(opt.dataset.sgst) : 9;

    const checks = document.querySelectorAll('.bac-row-check:checked');
    const selectedIndices = [];
    checks.forEach(function(c) { selectedIndices.push(parseInt(c.dataset.idx)); });

    if (selectedIndices.length === 0) { _showFormMsg('Please select at least one customer.', false); return; }
    if (!chargeName) { _showFormMsg('Please select a charge type.', false); return; }
    if (!isPerSqft && amount <= 0) { _showFormMsg('Amount must be greater than 0.', false); return; }
    if (isPerSqft && ratePerSqft <= 0) { _showFormMsg('This charge has no rate per sq.ft. configured.', false); return; }

    const applyBtn = document.getElementById('bac-apply-btn');
    const progressEl = document.getElementById('bac-progress');
    if (applyBtn) { applyBtn.disabled = true; applyBtn.textContent = 'Applying...'; }
    if (progressEl) { progressEl.textContent = 'Applying to ' + selectedIndices.length + ' customers...'; progressEl.style.display = 'block'; }
    _clearFormMsg();

    const token = _token();
    const promises = selectedIndices.map(function(idx) {
      const consumer = _consumers[idx];
      if (!consumer) return Promise.resolve(null);
      const consumerAmount = isPerSqft ? undefined : amount;
      return fetch('/api/addon-charges/consumer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          consumerId:     consumer.consumer_id,
          projectId:      projectId,
          chargeMasterId: chargeMasterId || null,
          chargeName:     chargeName,
          amount:         consumerAmount,
          cgstPct:        cgstPct,
          sgstPct:        sgstPct,
          remark:         remark || null,
        })
      }).then(function(r) { return r.json(); }).catch(function() { return null; });
    });

    try {
      const results = await Promise.all(promises);
      const succeeded = results.filter(function(r) { return r && r.success; }).length;
      const failed = results.length - succeeded;
      const firstErr = (results.find(function(r) { return r && !r.success && r.error; }) || {}).error;

      if (progressEl) progressEl.style.display = 'none';
      if (failed === 0) {
        _showFormMsg('Charge applied to ' + succeeded + ' customer' + (succeeded !== 1 ? 's' : '') + '.', true);
      } else {
        _showFormMsg('Applied to ' + succeeded + ' customers. ' + failed + ' failed' + (firstErr ? ' (' + firstErr + ')' : '') + '.', succeeded > 0);
      }

      // Uncheck all
      const allChecks = document.querySelectorAll('.bac-row-check');
      allChecks.forEach(function(c) { c.checked = false; });
      const selAll = document.getElementById('bac-select-all');
      if (selAll) selAll.checked = false;
      _updateCount();

      // Reload results to refresh addon_total
      await _search();
    } catch (e) {
      if (progressEl) progressEl.style.display = 'none';
      _showFormMsg('Error: ' + e.message, false);
    } finally {
      if (applyBtn) { applyBtn.disabled = false; applyBtn.textContent = 'APPLY TO SELECTED'; }
    }
  }

  function _hideResults() {
    const sec = document.getElementById('bac-results-section');
    if (sec) sec.style.display = 'none';
  }

  function _hideForm() {
    const sec = document.getElementById('bac-form-section');
    if (sec) sec.style.display = 'none';
  }

  function _showFormMsg(text, ok) {
    const el = document.getElementById('bac-form-msg');
    if (!el) return;
    el.textContent = text;
    el.className = 'bac-msg ' + (ok ? 'bac-msg-ok' : 'bac-msg-err');
    el.style.display = 'block';
  }

  function _clearFormMsg() {
    const el = document.getElementById('bac-form-msg');
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

  window.BulkAddonCharge = {
    search:           _search,
    toggleSelectAll:  _toggleSelectAll,
    updateCount:      _updateCount,
    onChargeSelect:   onChargeSelect,
    applyToSelected:  _applyToSelected,
    onProjectChange:  onProjectChange,
  };

  Pages.bulkAddonCharge = function(params) {
    const container = document.getElementById('content') || document.body;
    container.innerHTML = _renderPage();
    _init();
  };

})();
