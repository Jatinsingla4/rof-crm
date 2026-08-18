/**
 * Set Extra Add On Charge On Bulk Customer
 * Apply addon charges to multiple consumers at once.
 */
(() => {

  const BAC_STYLES = `<style id="bac-styles">
.bac-page { padding: 0; font-family: Arial, sans-serif; font-size: 13px; }
.bac-card { background: #fff; border: 1px solid #ddd; border-radius: 3px; margin-bottom: 10px; }
.bac-hdr {
  display: flex; justify-content: space-between; align-items: center;
  background: #1d3a6e; padding: 7px 12px; border-radius: 3px 3px 0 0;
}
.bac-hdr-title { color: #fff; font-size: 13px; font-weight: bold; letter-spacing: .3px; }
.bac-body { padding: 14px 16px 16px; }
.bac-filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 8px 14px;
  margin-bottom: 10px;
}
.bac-filter-grid2 {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 8px 14px;
  margin-bottom: 12px;
}
.bac-field { display: flex; flex-direction: column; gap: 3px; }
.bac-lbl { font-size: 11px; color: #555; white-space: nowrap; }
.bac-filter-grid select,
.bac-filter-grid input,
.bac-filter-grid2 select,
.bac-filter-grid2 input {
  padding: 5px 7px; border: 1px solid #ccc; border-radius: 3px;
  font-size: 12px; width: 100%; box-sizing: border-box;
}
.bac-filter-grid select:focus,
.bac-filter-grid input:focus,
.bac-filter-grid2 select:focus,
.bac-filter-grid2 input:focus { outline: none; border-color: #337ab7; }
.bac-btn-fetch {
  background: #1d3a6e; color: #fff; border: none;
  padding: 6px 20px; border-radius: 3px; font-size: 13px; font-weight: bold; cursor: pointer;
  align-self: flex-end;
}
.bac-btn-fetch:hover { background: #16305c; }
.bac-btn-fetch:disabled { opacity: .7; cursor: not-allowed; }
.bac-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.bac-table th { background: #1d3a6e; color: #fff; padding: 6px 8px; text-align: left; font-weight: bold; font-size: 12px; white-space: nowrap; }
.bac-table td { padding: 5px 8px; border-bottom: 1px solid #eee; vertical-align: middle; }
.bac-table tr:nth-child(even) td { background: #f9fbff; }
.bac-table tr:hover td { background: #eef4ff; }
.bac-table td.bac-num { text-align: right; }
.bac-table td.bac-center { text-align: center; }
.bac-empty { text-align: center; color: #999; padding: 16px; font-size: 13px; }
.bac-select-all-row { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: #f7f9fc; border-bottom: 1px solid #eee; font-size: 12px; color: #333; }
.bac-select-all-row input[type="checkbox"] { width: 14px; height: 14px; cursor: pointer; }
.bac-table input[type="checkbox"] { width: 14px; height: 14px; cursor: pointer; }
.bac-bulk-form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px 16px;
  margin-bottom: 12px;
}
.bac-bulk-form-grid select,
.bac-bulk-form-grid input,
.bac-bulk-form-grid textarea {
  padding: 5px 8px; border: 1px solid #ccc; border-radius: 3px;
  font-size: 13px; width: 100%; box-sizing: border-box;
}
.bac-bulk-form-grid select:focus,
.bac-bulk-form-grid input:focus,
.bac-bulk-form-grid textarea:focus { outline: none; border-color: #337ab7; }
.bac-bulk-form-grid textarea { resize: vertical; }
.bac-btn-apply {
  background: #1d3a6e; color: #fff; border: none;
  padding: 7px 22px; border-radius: 3px; font-size: 13px; font-weight: bold; cursor: pointer;
}
.bac-btn-apply:hover { background: #16305c; }
.bac-btn-apply:disabled { opacity: .7; cursor: not-allowed; }
.bac-msg { margin-top: 10px; font-size: 13px; padding: 6px 10px; border-radius: 3px; display: none; }
.bac-msg-ok  { background: #dff0d8; color: #3c763d; border: 1px solid #d6e9c6; }
.bac-msg-err { background: #f2dede; color: #a94442; border: 1px solid #ebccd1; }
.bac-progress { font-size: 13px; color: #337ab7; margin-top: 8px; display: none; }
.bac-form-title { font-size: 12px; font-weight: bold; color: #1d3a6e; margin-bottom: 12px; text-transform: uppercase; }
</style>`;

  let _projects = [];
  let _consumers = [];
  let _chargeMaster = [];

  function _renderPage() {
    return BAC_STYLES + `
<div class="bac-page">

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
            <option>Type-A</option>
            <option>Type-B</option>
            <option>Type-C</option>
            <option>Type-D</option>
            <option>Type-1A</option>
            <option>Shop</option>
            <option>Plot</option>
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
      '<span style="color:#888;margin-left:8px" id="bac-selected-count"></span>' +
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
    const isPerSqft = !!(opt && opt.dataset.rateType === 'per_sqft');
    const ratePerSqft = isPerSqft ? parseFloat(opt.dataset.ratePerSqft || 0) : 0;
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
      const consumerAmount = isPerSqft
        ? Math.round(ratePerSqft * parseFloat(consumer.carpet_area_sqft || 0) * 100) / 100
        : amount;
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

      if (progressEl) progressEl.style.display = 'none';
      if (failed === 0) {
        _showFormMsg('Charge applied to ' + succeeded + ' customer' + (succeeded !== 1 ? 's' : '') + '.', true);
      } else {
        _showFormMsg('Applied to ' + succeeded + ' customers. ' + failed + ' failed.', succeeded > 0);
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
