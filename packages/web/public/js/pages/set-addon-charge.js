/**
 * Set Extra Add On Charge — Addon Charges > Set Extra Add On Charge
 * Assign addon charges to individual consumers.
 */
(() => {

  const SAC_STYLES = `<style id="sac-styles">
.sac-page { padding: 0; font-family: Arial, sans-serif; font-size: 13px; }
.sac-card { background: #fff; border: 1px solid #ddd; border-radius: 3px; margin-bottom: 10px; }
.sac-hdr {
  display: flex; justify-content: space-between; align-items: center;
  background: #1d3a6e; padding: 7px 12px; border-radius: 3px 3px 0 0;
}
.sac-hdr-title { color: #fff; font-size: 13px; font-weight: bold; letter-spacing: .3px; }
.sac-hdr-actions { display: flex; gap: 8px; align-items: center; }
.sac-body { padding: 14px 16px 16px; }
.sac-filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 8px 14px;
  margin-bottom: 10px;
}
.sac-filter-grid2 {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 8px 14px;
  margin-bottom: 12px;
}
.sac-field { display: flex; flex-direction: column; gap: 3px; }
.sac-lbl { font-size: 11px; color: #555; white-space: nowrap; }
.sac-filter-grid select,
.sac-filter-grid input,
.sac-filter-grid2 select,
.sac-filter-grid2 input {
  padding: 5px 7px; border: 1px solid #ccc; border-radius: 3px;
  font-size: 12px; width: 100%; box-sizing: border-box;
}
.sac-filter-grid select:focus,
.sac-filter-grid input:focus,
.sac-filter-grid2 select:focus,
.sac-filter-grid2 input:focus { outline: none; border-color: #337ab7; }
.sac-btn-fetch {
  background: #1d3a6e; color: #fff; border: none;
  padding: 6px 20px; border-radius: 3px; font-size: 13px; font-weight: bold; cursor: pointer;
  align-self: flex-end;
}
.sac-btn-fetch:hover { background: #16305c; }
.sac-btn-fetch:disabled { opacity: .7; cursor: not-allowed; }
.sac-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.sac-table th { background: #1d3a6e; color: #fff; padding: 6px 8px; text-align: left; font-weight: bold; font-size: 12px; white-space: nowrap; }
.sac-table td { padding: 5px 8px; border-bottom: 1px solid #eee; vertical-align: middle; }
.sac-table tr:nth-child(even) td { background: #f9fbff; }
.sac-table tr:hover td { background: #eef4ff; }
.sac-table td.sac-num { text-align: right; }
.sac-link { color: #337ab7; cursor: pointer; text-decoration: underline; font-size: 12px; }
.sac-link:hover { color: #1d3a6e; }
.sac-link-name { color: #337ab7; cursor: pointer; font-weight: 600; }
.sac-link-name:hover { color: #1d3a6e; text-decoration: underline; }
.sac-act-sep { color: #ccc; margin: 0 2px; }
.sac-icon-btn {
  background: none; border: none; cursor: pointer; font-size: 14px; padding: 2px 4px;
  color: #555;
}
.sac-icon-btn:hover { color: #1d3a6e; }
.sac-info-card {
  background: #f7f9fc; border: 1px solid #d0daea; border-radius: 3px;
  padding: 12px 16px; margin-bottom: 10px;
}
.sac-info-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 6px 20px;
}
.sac-info-item { display: flex; flex-direction: column; gap: 2px; }
.sac-info-lbl { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: .3px; }
.sac-info-val { font-size: 12px; font-weight: 600; color: #222; }
.sac-form-card {
  background: #fff; border: 1px solid #ddd; border-radius: 3px;
  padding: 14px 16px; margin-bottom: 10px;
}
.sac-form-title { font-size: 12px; font-weight: bold; color: #1d3a6e; margin-bottom: 12px; text-transform: uppercase; }
.sac-form-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px 16px; margin-bottom: 12px;
}
.sac-form-grid select,
.sac-form-grid input,
.sac-form-grid textarea { padding: 5px 8px; border: 1px solid #ccc; border-radius: 3px; font-size: 13px; width: 100%; box-sizing: border-box; }
.sac-form-grid select:focus,
.sac-form-grid input:focus,
.sac-form-grid textarea:focus { outline: none; border-color: #337ab7; }
.sac-form-grid textarea { resize: vertical; }
.sac-btn-row { display: flex; gap: 8px; align-items: center; margin-bottom: 4px; }
.sac-btn-submit {
  background: #1d3a6e; color: #fff; border: none;
  padding: 7px 22px; border-radius: 3px; font-size: 13px; font-weight: bold; cursor: pointer;
}
.sac-btn-submit:hover { background: #16305c; }
.sac-btn-submit:disabled { opacity: .7; cursor: not-allowed; }
.sac-btn-cancel {
  background: #fff; color: #555; border: 1px solid #ccc;
  padding: 7px 16px; border-radius: 3px; font-size: 13px; cursor: pointer;
}
.sac-btn-cancel:hover { background: #f5f5f5; }
.sac-msg { margin-top: 10px; font-size: 13px; padding: 6px 10px; border-radius: 3px; display: none; }
.sac-msg-ok  { background: #dff0d8; color: #3c763d; border: 1px solid #d6e9c6; }
.sac-msg-err { background: #f2dede; color: #a94442; border: 1px solid #ebccd1; }
.sac-charges-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
.sac-charges-table th { background: #1d3a6e; color: #fff; padding: 5px 7px; text-align: center; font-size: 11px; white-space: nowrap; }
.sac-charges-table td { padding: 4px 7px; border-bottom: 1px solid #eee; vertical-align: middle; text-align: center; }
.sac-charges-table td.sac-tl { text-align: left; }
.sac-charges-table td.sac-tr { text-align: right; }
.sac-charges-table tfoot td { font-weight: bold; background: #f0f4ff; }
.sac-empty { text-align: center; color: #999; padding: 16px; font-size: 13px; }
.sac-del-link { color: #a94442; cursor: pointer; text-decoration: underline; font-size: 12px; }
.sac-del-link:hover { color: #800; }
</style>`;

  let _projects = [];
  let _consumers = [];
  let _selectedConsumer = null;
  let _chargeMaster = [];
  let _consumerCharges = [];
  let _editingChargeId = null;

  function _renderPage() {
    return SAC_STYLES + `
<div class="sac-page">

  <!-- SECTION 1: Filters -->
  <div class="sac-card">
    <div class="sac-hdr">
      <span class="sac-hdr-title">ADD EXTRA ADDON CHARGE</span>
    </div>
    <div class="sac-body">
      <div class="sac-filter-grid">
        <div class="sac-field">
          <span class="sac-lbl">* Project:</span>
          <select id="sac-project" onchange="SetAddonCharge.onProjectChange()">
            <option value="">&lt;--Select--&gt;</option>
          </select>
        </div>
        <div class="sac-field">
          <span class="sac-lbl">Tower:</span>
          <select id="sac-tower">
            <option value="">&lt;--All--&gt;</option>
          </select>
        </div>
        <div class="sac-field">
          <span class="sac-lbl">Unit Type:</span>
          <select id="sac-unit-type">
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
        <div class="sac-field">
          <span class="sac-lbl">Payment Plan:</span>
          <select id="sac-plan">
            <option value="">&lt;--All--&gt;</option>
          </select>
        </div>
        <div class="sac-field">
          <span class="sac-lbl">Registration No.:</span>
          <input type="text" id="sac-reg-no" placeholder="Reg No.">
        </div>
        <div class="sac-field">
          <span class="sac-lbl">Name:</span>
          <input type="text" id="sac-name" placeholder="First or Last Name">
        </div>
      </div>
      <div class="sac-filter-grid2">
        <div class="sac-field">
          <span class="sac-lbl">Unit No.:</span>
          <input type="text" id="sac-unit-no" placeholder="Unit No.">
        </div>
        <div class="sac-field" style="justify-content:flex-end">
          <button class="sac-btn-fetch" id="sac-fetch-btn" onclick="SetAddonCharge.search()">FETCH</button>
        </div>
      </div>
    </div>
  </div>

  <!-- SECTION 2: Results -->
  <div id="sac-results-section" style="display:none">
    <div class="sac-card">
      <div class="sac-hdr">
        <span class="sac-hdr-title">CUSTOMER ADDON CHARGE DETAILS</span>
        <div class="sac-hdr-actions">
          <button class="sac-icon-btn" title="Print" onclick="window.print()">🖨</button>
          <button class="sac-icon-btn" title="Download CSV" onclick="SetAddonCharge._downloadCsv()">⬇</button>
        </div>
      </div>
      <div class="sac-body" style="padding:0">
        <div id="sac-results-table"></div>
      </div>
    </div>
  </div>

  <!-- SECTION 3: Charge Form -->
  <div id="sac-form-section" style="display:none">
    <div class="sac-card">
      <div class="sac-hdr">
        <span class="sac-hdr-title">CUSTOMER DETAILS</span>
      </div>
      <div class="sac-body">
        <div class="sac-info-card">
          <div class="sac-info-grid" id="sac-cust-info-row1"></div>
          <div class="sac-info-grid" id="sac-cust-info-row2" style="margin-top:8px"></div>
        </div>

        <div class="sac-form-card">
          <div class="sac-form-title" id="sac-form-title">ADD ADDON CHARGES</div>
          <div class="sac-form-grid">
            <div class="sac-field">
              <span class="sac-lbl">* Charge Name:</span>
              <select id="sac-charge-name" onchange="SetAddonCharge.onChargeSelect()">
                <option value="">&lt;--Select--&gt;</option>
              </select>
            </div>
            <div class="sac-field">
              <span class="sac-lbl">* Amount (Rs.):</span>
              <input type="number" id="sac-amount" min="0" step="0.01" value="0">
            </div>
            <div class="sac-field" style="grid-column: span 2">
              <span class="sac-lbl">Remark:</span>
              <textarea id="sac-remark" rows="3" placeholder="Optional remark"></textarea>
            </div>
          </div>
          <div class="sac-btn-row">
            <button class="sac-btn-submit" id="sac-submit-btn" onclick="SetAddonCharge.submitCharge()">SUBMIT</button>
            <button class="sac-btn-cancel" onclick="SetAddonCharge.cancelForm()">CANCEL</button>
            <button class="sac-btn-cancel" onclick="SetAddonCharge.cancelForm()">CLOSE</button>
          </div>
          <div class="sac-msg" id="sac-form-msg"></div>
        </div>

        <div id="sac-charges-table-wrap"></div>
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
      const sel = document.getElementById('sac-project');
      if (!sel) return;
      _projects = data.projects || data.data || data || [];
      _projects.forEach(function(p) {
        const o = document.createElement('option');
        o.value = p.id;
        o.textContent = p.name || p.project_name;
        sel.appendChild(o);
      });
    } catch (e) {
      console.error('SetAddonCharge: failed to load projects', e);
    }
  }

  async function onProjectChange() {
    const projectId = _gv('sac-project');
    const towerSel = document.getElementById('sac-tower');
    const planSel = document.getElementById('sac-plan');
    if (towerSel) towerSel.innerHTML = '<option value="">&lt;--All--&gt;</option>';
    if (planSel) planSel.innerHTML = '<option value="">&lt;--All--&gt;</option>';
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
      console.error('SetAddonCharge: failed to load towers', e);
    }
  }

  async function _search() {
    const projectId = _gv('sac-project');
    if (!projectId) { _showFormMsg('Please select a project.', false); return; }

    const btn = document.getElementById('sac-fetch-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Loading...'; }
    _hideForm();

    const params = new URLSearchParams({ projectId });
    const tower   = _gv('sac-tower');   if (tower)   params.set('towerId', tower);
    const utype   = _gv('sac-unit-type'); if (utype) params.set('unitType', utype);
    const plan    = _gv('sac-plan');    if (plan)    params.set('paymentPlan', plan);
    const regNo   = _gv('sac-reg-no'); if (regNo)   params.set('registrationNo', regNo);
    const name    = _gv('sac-name');   if (name)    params.set('name', name);
    const unitNo  = _gv('sac-unit-no'); if (unitNo)  params.set('unitNo', unitNo);

    const token = _token();
    try {
      const res = await fetch('/api/addon-charges/consumers?' + params.toString(), {
        headers: { Authorization: 'Bearer ' + token }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fetch failed');
      _consumers = data.data || [];
      _renderResultsTable(_consumers);

      const planSel = document.getElementById('sac-plan');
      if (planSel && planSel.options.length <= 1) {
        const plans = [...new Set(_consumers.map(function(c) { return c.payment_plan; }).filter(Boolean))];
        plans.forEach(function(pl) {
          const o = document.createElement('option');
          o.value = pl; o.textContent = pl;
          planSel.appendChild(o);
        });
      }
    } catch (e) {
      const sec = document.getElementById('sac-results-section');
      if (sec) { sec.style.display = 'block'; }
      const tbl = document.getElementById('sac-results-table');
      if (tbl) tbl.innerHTML = '<div class="sac-empty">Error: ' + _esc(e.message) + '</div>';
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'FETCH'; }
    }
  }

  function _renderResultsTable(rows) {
    const sec = document.getElementById('sac-results-section');
    const tbl = document.getElementById('sac-results-table');
    if (!sec || !tbl) return;
    sec.style.display = 'block';
    if (rows.length === 0) {
      tbl.innerHTML = '<div class="sac-empty">No customers found.</div>';
      return;
    }
    let html = '<table class="sac-table"><thead><tr>' +
      '<th>S.NO</th><th>REGISTRATION NO.</th><th>BOOKING DATE</th>' +
      '<th>NAME</th><th>TOWER</th><th>UNIT TYPE</th><th>UNIT NO.</th>' +
      '<th>PLAN</th><th style="text-align:right">AMOUNT</th><th>ACTION</th>' +
      '</tr></thead><tbody>';
    rows.forEach(function(r, i) {
      const idx = i;
      html += '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        '<td>' + _esc(r.registration_no || '') + '</td>' +
        '<td>' + _fmtDate(r.booking_date) + '</td>' +
        '<td><span class="sac-link-name" onclick="SetAddonCharge.showForm(' + idx + ',\'add\')">' + _esc(r.full_name) + '</span></td>' +
        '<td>' + _esc(r.tower_name || '') + '</td>' +
        '<td>' + _esc(r.unit_type || '') + '</td>' +
        '<td>' + _esc(r.unit_number || '') + '</td>' +
        '<td>' + _esc(r.payment_plan || '') + '</td>' +
        '<td class="sac-num">' + _fmtNum(r.addon_total) + '</td>' +
        '<td>' +
          '<span class="sac-link" onclick="SetAddonCharge.showForm(' + idx + ',\'add\')">Add</span>' +
          '<span class="sac-act-sep">|</span>' +
          '<span class="sac-link" onclick="SetAddonCharge.showForm(' + idx + ',\'edit\')">Edit</span>' +
        '</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    tbl.innerHTML = html;
  }

  async function _showForm(consumerIdx, mode) {
    _selectedConsumer = _consumers[consumerIdx];
    if (!_selectedConsumer) return;
    _editingChargeId = null;

    const sec = document.getElementById('sac-form-section');
    if (sec) sec.style.display = 'block';

    const titleEl = document.getElementById('sac-form-title');
    if (titleEl) titleEl.textContent = mode === 'edit' ? 'EDIT ADDON CHARGES' : 'ADD ADDON CHARGES';

    const submitBtn = document.getElementById('sac-submit-btn');
    if (submitBtn) submitBtn.textContent = 'SUBMIT';

    _setVal('sac-amount', '0');
    _setVal('sac-remark', '');
    _clearFormMsg();

    _renderCustomerInfo(_selectedConsumer);

    const projectId = _gv('sac-project');
    await _loadChargeMaster(projectId);
    await _loadConsumerCharges(_selectedConsumer.consumer_id);

    sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function _renderCustomerInfo(c) {
    const row1 = document.getElementById('sac-cust-info-row1');
    const row2 = document.getElementById('sac-cust-info-row2');
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
    return '<div class="sac-info-item">' +
      '<span class="sac-info-lbl">' + _esc(lbl) + '</span>' +
      '<span class="sac-info-val">' + _esc(String(val || '—')) + '</span>' +
      '</div>';
  }

  async function _loadChargeMaster(projectId) {
    const sel = document.getElementById('sac-charge-name');
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
      console.error('SetAddonCharge: failed to load charge master', e);
    }
  }

  function onChargeSelect() {
    const sel = document.getElementById('sac-charge-name');
    if (!sel) return;
    const opt = sel.selectedOptions[0];
    if (!opt || !opt.dataset.amount) return;
    if (opt.dataset.rateType === 'per_sqft' && _selectedConsumer) {
      const rate = parseFloat(opt.dataset.ratePerSqft || 0);
      const carpetArea = parseFloat(_selectedConsumer.carpet_area_sqft || 0);
      _setVal('sac-amount', Math.round(rate * carpetArea * 100) / 100);
      return;
    }
    _setVal('sac-amount', parseFloat(opt.dataset.amount || 0));
  }

  async function _loadConsumerCharges(consumerId) {
    const wrap = document.getElementById('sac-charges-table-wrap');
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
      wrap.innerHTML = '<div class="sac-empty">Error loading charges.</div>';
    }
  }

  function _renderChargesTable(rows) {
    const wrap = document.getElementById('sac-charges-table-wrap');
    if (!wrap) return;
    if (rows.length === 0) {
      wrap.innerHTML = '<div class="sac-empty">No existing addon charges for this customer.</div>';
      return;
    }

    let totAmt = 0, totInc = 0, totAWI = 0, totCgst = 0, totSgst = 0, totTotal = 0;
    let tbody = '';
    rows.forEach(function(r, i) {
      const amt  = parseFloat(r.amount || 0);
      const inc  = parseFloat(r.increase_amount || 0);
      const awi  = amt + inc;
      const cgst = parseFloat(r.cgst_amount || 0);
      const sgst = parseFloat(r.sgst_amount || 0);
      const tot  = parseFloat(r.total_amount || 0);
      totAmt += amt; totInc += inc; totAWI += awi;
      totCgst += cgst; totSgst += sgst; totTotal += tot;
      tbody += '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        '<td class="sac-tl">' + _esc(r.charge_name) + '</td>' +
        '<td>' + _fmtDate(r.effective_date) + '</td>' +
        '<td class="sac-tr">' + _fmtNum(amt) + '</td>' +
        '<td class="sac-tr">' + _fmtNum(inc) + '</td>' +
        '<td class="sac-tr">' + _fmtNum(awi) + '</td>' +
        '<td class="sac-tr">' + _fmtNum(cgst) + '</td>' +
        '<td class="sac-tr">' + _fmtNum(sgst) + '</td>' +
        '<td class="sac-tr">' + _fmtNum(parseFloat(r.itc_cgst || 0)) + '</td>' +
        '<td class="sac-tr">' + _fmtNum(parseFloat(r.itc_sgst || 0)) + '</td>' +
        '<td class="sac-tr">' + _fmtNum(tot) + '</td>' +
        '<td class="sac-tl">' + _esc(r.remark || '') + '</td>' +
        '<td>' +
          '<span class="sac-link" onclick="SetAddonCharge.editCharge(' + JSON.stringify(r) + ')">Edit</span>' +
          '<span class="sac-act-sep">|</span>' +
          '<span class="sac-del-link" onclick="SetAddonCharge.deleteCharge(\'' + r.id + '\')">Delete</span>' +
        '</td>' +
        '</tr>';
    });

    wrap.innerHTML = '<table class="sac-charges-table"><thead><tr>' +
      '<th>S.NO</th><th>CHARGE NAME</th><th>EFF. DATE</th>' +
      '<th>AMOUNT</th><th>INCREASE AMT</th><th>AMT WITH INC</th>' +
      '<th>CGST</th><th>SGST</th><th>ITC CGST</th><th>ITC SGST</th>' +
      '<th>TOTAL AMOUNT</th><th>REMARK</th><th>ACTION</th>' +
      '</tr></thead><tbody>' + tbody + '</tbody>' +
      '<tfoot><tr>' +
        '<td colspan="3" style="text-align:right;font-size:11px">Total:</td>' +
        '<td class="sac-tr">' + _fmtNum(totAmt) + '</td>' +
        '<td class="sac-tr">' + _fmtNum(totInc) + '</td>' +
        '<td class="sac-tr">' + _fmtNum(totAWI) + '</td>' +
        '<td class="sac-tr">' + _fmtNum(totCgst) + '</td>' +
        '<td class="sac-tr">' + _fmtNum(totSgst) + '</td>' +
        '<td class="sac-tr">0</td>' +
        '<td class="sac-tr">0</td>' +
        '<td class="sac-tr">' + _fmtNum(totTotal) + '</td>' +
        '<td colspan="2"></td>' +
      '</tr></tfoot>' +
      '</table>';
  }

  function _editCharge(row) {
    _editingChargeId = row.id;
    const sel = document.getElementById('sac-charge-name');
    if (sel) {
      for (let i = 0; i < sel.options.length; i++) {
        if (sel.options[i].dataset.name === row.charge_name) {
          sel.selectedIndex = i; break;
        }
      }
    }
    _setVal('sac-amount', parseFloat(row.amount || 0));
    _setVal('sac-remark', row.remark || '');
    const titleEl = document.getElementById('sac-form-title');
    if (titleEl) titleEl.textContent = 'EDIT ADDON CHARGES';
    const submitBtn = document.getElementById('sac-submit-btn');
    if (submitBtn) submitBtn.textContent = 'UPDATE';
    _clearFormMsg();
    const formCard = document.querySelector('.sac-form-card');
    if (formCard) formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function _submitCharge() {
    if (!_selectedConsumer) return;
    const projectId = _gv('sac-project');
    const sel = document.getElementById('sac-charge-name');
    const opt = sel && sel.selectedOptions[0];
    const chargeName = opt && opt.dataset.name ? opt.dataset.name : _gv('sac-charge-name');
    if (!chargeName) { _showFormMsg('Please select a charge type.', false); return; }

    const amount = parseFloat(_gv('sac-amount') || '0');
    const remark = _gv('sac-remark');
    const cgstPct = opt && opt.dataset.cgst ? parseFloat(opt.dataset.cgst) : 9;
    const sgstPct = opt && opt.dataset.sgst ? parseFloat(opt.dataset.sgst) : 9;

    const submitBtn = document.getElementById('sac-submit-btn');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = _editingChargeId ? 'Updating...' : 'Submitting...'; }
    _clearFormMsg();

    const token = _token();
    try {
      let res, data;
      if (_editingChargeId) {
        res = await fetch('/api/addon-charges/consumer/' + _editingChargeId, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ amount: amount, remark: remark || null })
        });
      } else {
        res = await fetch('/api/addon-charges/consumer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({
            consumerId:      _selectedConsumer.consumer_id,
            projectId:       projectId,
            chargeMasterId:  opt ? opt.value : null,
            chargeName:      chargeName,
            amount:          amount,
            cgstPct:         cgstPct,
            sgstPct:         sgstPct,
            remark:          remark || null,
          })
        });
      }
      data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      _showFormMsg((_editingChargeId ? 'Charge updated successfully.' : 'Charge added successfully.') + (data.note ? ' ' + data.note : ''), true);
      _editingChargeId = null;
      const titleEl = document.getElementById('sac-form-title');
      if (titleEl) titleEl.textContent = 'ADD ADDON CHARGES';
      if (submitBtn) submitBtn.textContent = 'SUBMIT';
      _setVal('sac-charge-name', '');
      _setVal('sac-amount', '0');
      _setVal('sac-remark', '');
      await _loadConsumerCharges(_selectedConsumer.consumer_id);
      await _search();
    } catch (e) {
      _showFormMsg('Error: ' + e.message, false);
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = _editingChargeId ? 'UPDATE' : 'SUBMIT'; }
    }
  }

  async function _deleteCharge(id) {
    if (!window.confirm('Delete this charge?')) return;
    const token = _token();
    try {
      const res = await fetch('/api/addon-charges/consumer/' + id + '/cancel', {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + token }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      _showFormMsg('Charge deleted.', true);
      if (_selectedConsumer) await _loadConsumerCharges(_selectedConsumer.consumer_id);
    } catch (e) {
      _showFormMsg('Error: ' + e.message, false);
    }
  }

  function _cancelForm() {
    _selectedConsumer = null;
    _editingChargeId = null;
    _hideForm();
  }

  function _hideForm() {
    const sec = document.getElementById('sac-form-section');
    if (sec) sec.style.display = 'none';
  }

  function _hideResults() {
    const sec = document.getElementById('sac-results-section');
    if (sec) sec.style.display = 'none';
  }

  function _downloadCsv() {
    if (!_consumers.length) return;
    const hdr = ['S.NO','Registration No.','Booking Date','Name','Tower','Unit Type','Unit No.','Plan','Addon Total'];
    const rows = _consumers.map(function(r, i) {
      return [i+1, r.registration_no, _fmtDate(r.booking_date), r.full_name,
              r.tower_name||'', r.unit_type||'', r.unit_number||'',
              r.payment_plan||'', r.addon_total||0].join(',');
    });
    const csv = [hdr.join(',')].concat(rows).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'addon_charges.csv';
    a.click();
  }

  function _token() { return localStorage.getItem('rof-jwt') || ''; }

  function _gv(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function _setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
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

  function _showFormMsg(text, ok) {
    const el = document.getElementById('sac-form-msg');
    if (!el) return;
    el.textContent = text;
    el.className = 'sac-msg ' + (ok ? 'sac-msg-ok' : 'sac-msg-err');
    el.style.display = 'block';
  }

  function _clearFormMsg() {
    const el = document.getElementById('sac-form-msg');
    if (el) { el.style.display = 'none'; el.textContent = ''; }
  }

  window.SetAddonCharge = {
    search:        _search,
    showForm:      _showForm,
    submitCharge:  _submitCharge,
    editCharge:    _editCharge,
    deleteCharge:  _deleteCharge,
    cancelForm:    _cancelForm,
    onProjectChange: onProjectChange,
    onChargeSelect:  onChargeSelect,
    _downloadCsv:  _downloadCsv,
  };

  Pages.setAddonCharge = function(params) {
    const container = document.getElementById('content') || document.body;
    container.innerHTML = _renderPage();
    _init();
  };

})();
