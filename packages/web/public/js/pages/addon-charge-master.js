/**
 * Addon Charge Master — Project Set Up > Extra Add On Charge Master
 * Per-project charge type configuration.
 */
(() => {

  const ACM_STYLES = `<style id="acm-styles">
.acm-page { max-width:1200px; margin:0 auto; font-size:13px; color:var(--text); }
.acm-card { background:var(--surface); border:1px solid var(--border2); border-radius:10px; margin-bottom:16px; overflow:hidden; }
.acm-card:empty { display:none; }
.acm-hdr { display:flex; justify-content:space-between; align-items:center; background:var(--teal-bg); padding:14px 18px; border-bottom:1px solid var(--border); }
.acm-hdr-title { color:var(--text); font-size:12px; font-weight:600; letter-spacing:.6px; text-transform:uppercase; }
.acm-body { padding:18px; }
.acm-project-row { display:flex; align-items:flex-end; gap:16px; margin-bottom:16px; flex-wrap:wrap; }
.acm-field { display:flex; flex-direction:column; gap:6px; }
.acm-lbl { font-size:11px; font-weight:500; color:var(--text2); letter-spacing:.3px; white-space:nowrap; }
.acm-project-row select { padding:9px 12px; min-height:38px; border:1px solid var(--border2); border-radius:8px; font-size:13px; min-width:260px; background:var(--surface); color:var(--text); }
.acm-divider { border:none; border-top:1px solid var(--border); margin:4px 0 16px; }
.acm-form-title { font-size:12px; font-weight:600; letter-spacing:.6px; text-transform:uppercase; color:var(--teal); margin-bottom:12px; }
.acm-grid { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:14px 20px; margin-bottom:16px; }
.acm-grid input[type="text"], .acm-grid input[type="number"], .acm-grid input[type="date"], .acm-grid select { padding:9px 12px; min-height:38px; border:1px solid var(--border2); border-radius:8px; font-size:13px; width:100%; box-sizing:border-box; background:var(--surface); color:var(--text); }
.acm-grid input:focus, .acm-project-row select:focus { outline:none; border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg); }
.acm-grid input[type="radio"] { accent-color:var(--teal); }
.acm-btn-row { display:flex; align-items:center; gap:10px; }
.acm-btn-save { background:var(--teal); color:#fff; border:none; padding:9px 26px; min-height:38px; border-radius:8px; font-size:12.5px; font-weight:600; cursor:pointer; }
.acm-btn-save:hover { filter:brightness(.92); }
.acm-btn-save:disabled { opacity:.7; cursor:not-allowed; }
.acm-btn-cancel { background:var(--surface); color:var(--text2); border:1px solid var(--border2); padding:9px 20px; min-height:38px; border-radius:8px; font-size:12.5px; cursor:pointer; }
.acm-btn-cancel:hover { background:var(--surface2); }
.acm-msg { margin-top:14px; font-size:12.5px; padding:9px 14px; border-radius:8px; display:none; }
.acm-msg-ok  { background:var(--teal-bg); color:var(--teal); border:1px solid var(--teal); font-weight:600; }
.acm-msg-err { background:var(--red-bg); color:var(--red); border:1px solid var(--red); }
.acm-table { width:100%; border-collapse:collapse; font-size:12.5px; }
.acm-table th { background:var(--surface2); color:var(--text3); padding:10px 18px; text-align:left; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:.4px; border-bottom:1px solid var(--border2); }
.acm-table td { padding:11px 18px; border-bottom:1px solid var(--border); vertical-align:middle; color:var(--text); }
.acm-table tbody tr:hover td { background:var(--surface2); }
.acm-act-link { display:inline-block; color:var(--teal); cursor:pointer; font-size:12px; font-weight:600; margin-right:14px; }
.acm-act-link:hover { text-decoration:underline; }
.acm-act-del { color:var(--red); cursor:pointer; font-size:12px; font-weight:600; }
.acm-act-del:hover { text-decoration:underline; }
.acm-empty { text-align:center; color:var(--text3); padding:36px 18px; font-size:13px; }
.acm-badge-active   { background:var(--teal-bg); color:var(--teal); padding:3px 10px; border-radius:999px; font-size:11px; font-weight:600; }
.acm-badge-inactive { background:var(--red-bg); color:var(--red); padding:3px 10px; border-radius:999px; font-size:11px; font-weight:600; }
@media (max-width:900px) { .acm-grid { grid-template-columns:minmax(0,1fr); } .acm-grid > .acm-field { grid-column:auto !important; } }
@media (max-width:700px) { .acm-table th, .acm-table td { padding:9px 12px; } .acm-project-row select { min-width:0; width:100%; } }
</style>`;

  const _TH = '<div class="acm-hdr"><span class="acm-hdr-title">Configured Charge Types</span></div>';
  let _editingId = null;
  let _rows = [];

  function _render() {
    return ACM_STYLES + `
<div class="acm-page">
  <div class="page-hdr">
    <h1>Extra Add On Charge Master</h1>
    <div class="breadcrumb">Set Projects / <b>Addon Charge Master</b></div>
  </div>
  <div class="acm-card">
    <div class="acm-hdr">
      <span class="acm-hdr-title">Charge Type Setup</span>
    </div>
    <div class="acm-body">

      <div class="acm-project-row">
        <div class="acm-field">
          <span class="acm-lbl">* Project:</span>
          <select id="acm-project" onchange="AddonChargeMaster.onProjectChange()">
            <option value="">&lt;--Select--&gt;</option>
          </select>
        </div>
      </div>

      <hr class="acm-divider">

      <div id="acm-form-section">
        <div class="acm-form-title" id="acm-form-title">ADD NEW CHARGE TYPE</div>
        <div class="acm-grid">
          <div class="acm-field" style="grid-column: span 2">
            <span class="acm-lbl">* Charge Name</span>
            <input type="text" id="acm-charge-name" placeholder="e.g. Club Membership, IFMS, etc.">
          </div>
          <div class="acm-field" style="grid-column: span 2">
            <span class="acm-lbl">Rate Type</span>
            <div style="display:flex;gap:18px;align-items:center;min-height:38px;">
              <label style="display:flex;align-items:center;gap:4px;font-size:13px;font-weight:normal;cursor:pointer;">
                <input type="radio" name="acm-rate-type" id="acm-rate-type-flat" value="flat" checked onchange="AddonChargeMaster.onRateTypeChange()"> Flat Amount
              </label>
              <label style="display:flex;align-items:center;gap:4px;font-size:13px;font-weight:normal;cursor:pointer;">
                <input type="radio" name="acm-rate-type" id="acm-rate-type-persqft" value="per_sqft" onchange="AddonChargeMaster.onRateTypeChange()"> Per Sq.Ft.
              </label>
              <label style="display:flex;align-items:center;gap:4px;font-size:13px;font-weight:normal;cursor:pointer;">
                <input type="radio" name="acm-rate-type" id="acm-rate-type-percent" value="percent" onchange="AddonChargeMaster.onRateTypeChange()"> % of basic price
              </label>
            </div>
          </div>
          <div class="acm-field" id="acm-default-amount-field">
            <span class="acm-lbl">Default Amount (Rs.)</span>
            <input type="number" id="acm-default-amount" min="0" step="0.01" value="0">
          </div>
          <div class="acm-field" id="acm-percent-field" style="display:none">
            <span class="acm-lbl">Percent (%)</span>
            <input type="number" id="acm-percent" min="0" max="100" step="0.0001" value="0">
            <select id="acm-percent-basis" style="margin-top:4px"><option value="basic">of the basic price</option><option value="after_discount">of the basic price after discounts</option></select>
          </div>
          <div class="acm-field" id="acm-rate-per-sqft-field" style="display:none">
            <span class="acm-lbl">Rate per Sq.Ft. (Rs.)</span>
            <input type="number" id="acm-rate-per-sqft" min="0" step="0.01" value="0">
          </div>
          <div class="acm-field">
            <span class="acm-lbl">CGST (%)</span>
            <input type="number" id="acm-cgst" min="0" step="0.01" value="9">
          </div>
          <div class="acm-field">
            <span class="acm-lbl">SGST (%)</span>
            <input type="number" id="acm-sgst" min="0" step="0.01" value="9">
          </div>
          <div class="acm-field"><span class="acm-lbl">Charge Type</span><input type="text" id="acm-charge-type" maxlength="30" value="Other" placeholder="e.g. Parking, Restoration"></div>
          <div class="acm-field"><span class="acm-lbl">Apply date</span><select id="acm-apply-date"><option>Customer Wise Date</option><option>Possession</option></select></div>
          <div class="acm-field"><span class="acm-lbl">Per sqft on</span><select id="acm-calc-rate"><option>Carpet Area</option><option>Super Area</option><option>Balcony Area</option><option>Plot Area</option></select><span style="font-size:11px;color:var(--text3);margin-left:8px">Which area the per-sqft rate is multiplied by. Not used for a fixed amount.</span></div>
          <div class="acm-field"><span class="acm-lbl">Quantity (stock)</span><input type="number" id="acm-quantity" min="0" step="1" placeholder="e.g. 798"><span style="font-size:11px;color:var(--text3)">With Inventory base: how many exist. Each unit or customer that takes one uses one.</span></div>
          <div class="acm-field"><span class="acm-lbl">Effective date</span><input type="date" id="acm-effective-date"></div>
          <div class="acm-field" style="grid-column: span 2"><span class="acm-lbl">Description</span><input type="text" id="acm-description" maxlength="500"></div>
          <div class="acm-field" style="grid-column: span 4">
            <div style="display:flex;gap:18px;flex-wrap:wrap;min-height:30px;align-items:center">
              <label style="display:flex;align-items:center;gap:4px;font-size:13px;font-weight:normal;cursor:pointer;"><input type="checkbox" id="acm-f-mandatory"> Mandatory</label>
              <label style="display:flex;align-items:center;gap:4px;font-size:13px;font-weight:normal;cursor:pointer;"><input type="checkbox" id="acm-f-parking"> Is Parking</label>
              <label style="display:flex;align-items:center;gap:4px;font-size:13px;font-weight:normal;cursor:pointer;"><input type="checkbox" id="acm-f-inventory"> Inventory Base</label>
              <label style="display:flex;align-items:center;gap:4px;font-size:13px;font-weight:normal;cursor:pointer;"><input type="checkbox" id="acm-f-multiple"> Multiple Booking</label>
              <label style="display:flex;align-items:center;gap:4px;font-size:13px;font-weight:normal;cursor:pointer;"><input type="checkbox" id="acm-f-alteration"> Alteration</label>
              <label style="display:flex;align-items:center;gap:4px;font-size:13px;font-weight:normal;cursor:pointer;"><input type="checkbox" id="acm-f-agreement"> Is Agreement</label>
              <label style="display:flex;align-items:center;gap:4px;font-size:13px;font-weight:normal;cursor:pointer;"><input type="checkbox" id="acm-f-dues" checked> Include in dues</label>
            </div>
          </div>
        </div>
        <div class="acm-btn-row">
          <button class="acm-btn-save" id="acm-save-btn" onclick="AddonChargeMaster.save()">SAVE</button>
          <button class="acm-btn-cancel" id="acm-cancel-btn" style="display:none" onclick="AddonChargeMaster.cancelEdit()">CANCEL</button>
        </div>
        <div class="acm-msg" id="acm-msg"></div>
      </div>

    </div>
  </div>
  <div id="acm-table-section" class="acm-card"></div>
</div>`;
  }

  async function _init(project) {
    await _loadProjects();
    // opened from Set Projects: start on the project being set up
    const sel = document.getElementById('acm-project');
    if (project && sel && [...sel.options].some(function (o) { return o.value === project; })) { sel.value = project; await onProjectChange(); }
  }

  async function _loadProjects() {
    const token = localStorage.getItem('rof-jwt') || '';
    try {
      const res = await fetch('/api/projects', { headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      const sel = document.getElementById('acm-project');
      if (!sel) return;
      (data.projects || data.data || data || []).forEach(function(p) {
        const o = document.createElement('option');
        o.value = p.id;
        o.textContent = p.name || p.project_name;
        sel.appendChild(o);
      });
    } catch (e) {
      console.error('AddonChargeMaster: failed to load projects', e);
    }
  }

  async function onProjectChange() {
    _editingId = null;
    _resetForm();
    const projectId = document.getElementById('acm-project') && document.getElementById('acm-project').value;
    const tableSection = document.getElementById('acm-table-section');
    if (!projectId) {
      if (tableSection) tableSection.innerHTML = '';
      return;
    }
    _clearMsg();
    await _loadCharges(projectId);
  }

  async function _loadCharges(projectId) {
    const token = localStorage.getItem('rof-jwt') || '';
    const tableSection = document.getElementById('acm-table-section');
    if (!tableSection) return;
    tableSection.innerHTML = _TH + '<div class="acm-empty">Loading...</div>';
    try {
      const res = await fetch('/api/addon-charges/master?projectId=' + encodeURIComponent(projectId), {
        headers: { Authorization: 'Bearer ' + token }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      _renderTable(data.data || []);
    } catch (e) {
      tableSection.innerHTML = _TH + '<div class="acm-empty">Error loading charges: ' + e.message + '</div>';
    }
  }

  function _renderTable(rows) {
    _rows = rows;
    const tableSection = document.getElementById('acm-table-section');
    if (!tableSection) return;
    if (rows.length === 0) {
      tableSection.innerHTML = _TH + '<div class="acm-empty">No charge types configured for this project.</div>';
      return;
    }
    let html = _TH + '<table class="acm-table"><thead><tr>' +
      '<th>S.NO</th><th>CHARGE NAME</th><th>TYPE</th><th>RATE</th><th>QTY</th><th>FLAGS</th>' +
      '<th>CGST %</th><th>SGST %</th><th>STATUS</th><th>ACTION</th>' +
      '</tr></thead><tbody>';
    rows.forEach(function(r, i) {
      const statusBadge = r.is_active
        ? '<span class="acm-badge-active">Active</span>'
        : '<span class="acm-badge-inactive">Inactive</span>';
      const rateLabel = r.rate_type === 'per_sqft'
        ? 'Per Sq.Ft. @ Rs.' + _fmtNum(r.rate_per_sqft_inr) + '/sqft on ' + ({ 'Super Area': 'super', 'Balcony Area': 'balcony', 'Plot Area': 'plot' }[r.calculate_rate_type] || 'carpet') + ' area'
        : r.rate_type === 'percent'
          ? _fmtNum(r.percent_value) + '% of basic price' + (r.percent_basis === 'after_discount' ? ' after discounts' : '')
          : 'Flat @ Rs.' + _fmtNum(r.default_amount);
      html += '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        '<td>' + _esc(r.charge_name) + '</td>' +
        '<td>' + _esc(r.charge_type) + '</td>' +
        '<td style="text-align:right">' + rateLabel + '</td>' +
        '<td style="text-align:center">' + (r.stock_used != null ? r.stock_used + ' of ' + r.quantity + ' given' : r.quantity != null ? r.quantity : '—') + '</td>' +
        '<td>' + _FLAGS.filter(function(f) { return f[0] !== 'dues' && r[f[2]]; }).map(function(f) { return f[0]; }).concat(r.include_in_dues === false ? ['not in dues'] : []).join(', ') + '</td>' +
        '<td style="text-align:center">' + parseFloat(r.cgst_pct).toFixed(2) + '</td>' +
        '<td style="text-align:center">' + parseFloat(r.sgst_pct).toFixed(2) + '</td>' +
        '<td style="text-align:center">' + statusBadge + '</td>' +
        '<td>' +
          '<span class="acm-act-link" onclick="AddonChargeMaster.edit(\'' + r.id + '\')">Edit</span>' +
          '<span class="acm-act-del" onclick="AddonChargeMaster.deactivate(\'' + r.id + '\')">Deactivate</span>' +
        '</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    tableSection.innerHTML = html;
  }

  function _editRow(id) {
    const row = _rows.find(function(r) { return r.id === id; });
    if (!row) return;
    _editingId = row.id;
    _setVal('acm-charge-name', row.charge_name);
    _setVal('acm-default-amount', row.default_amount);
    _setVal('acm-rate-per-sqft', row.rate_per_sqft_inr || 0);
    _setVal('acm-percent', row.percent_value != null ? parseFloat(row.percent_value) : 0);
    _setVal('acm-percent-basis', row.percent_basis || 'basic');
    const flatRadio = document.getElementById('acm-rate-type-flat');
    const sqftRadio = document.getElementById('acm-rate-type-persqft');
    const pctRadio = document.getElementById('acm-rate-type-percent');
    if (flatRadio) flatRadio.checked = row.rate_type !== 'per_sqft' && row.rate_type !== 'percent';
    if (sqftRadio) sqftRadio.checked = row.rate_type === 'per_sqft';
    if (pctRadio) pctRadio.checked = row.rate_type === 'percent';
    _applyRateTypeVisibility(row.rate_type);
    _setVal('acm-cgst', parseFloat(row.cgst_pct));
    _setVal('acm-sgst', parseFloat(row.sgst_pct));
    _fillExtras(row);
    const titleEl = document.getElementById('acm-form-title');
    if (titleEl) titleEl.textContent = 'EDIT CHARGE TYPE';
    const saveBtn = document.getElementById('acm-save-btn');
    if (saveBtn) saveBtn.textContent = 'UPDATE';
    const cancelBtn = document.getElementById('acm-cancel-btn');
    if (cancelBtn) cancelBtn.style.display = '';
    _clearMsg();
    const formSection = document.getElementById('acm-form-section');
    if (formSection) formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function cancelEdit() {
    _editingId = null;
    _resetForm();
  }

  // kind: 'flat', 'per_sqft' or 'percent'; only the field that belongs to it is shown
  function _applyRateTypeVisibility(kind) {
    kind = kind === true ? 'per_sqft' : kind === false || !kind ? 'flat' : kind;
    const show = function(id, on) { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
    show('acm-default-amount-field', kind === 'flat'); show('acm-rate-per-sqft-field', kind === 'per_sqft'); show('acm-percent-field', kind === 'percent');
  }
  function _kindChecked() {
    return document.getElementById('acm-rate-type-percent') && document.getElementById('acm-rate-type-percent').checked ? 'percent'
      : document.getElementById('acm-rate-type-persqft') && document.getElementById('acm-rate-type-persqft').checked ? 'per_sqft' : 'flat';
  }

  function onRateTypeChange() {
    _applyRateTypeVisibility(_kindChecked());
  }

  async function _save() {
    const projectId = document.getElementById('acm-project') && document.getElementById('acm-project').value;
    if (!projectId) { _showMsg('Please select a project first.', false); return; }

    const chargeName = (_gv('acm-charge-name') || '').trim();
    if (!chargeName) { _showMsg('Charge Name is required.', false); return; }
    // A charge that adds ₹0 does nothing, so ask for an amount (or a rate for per sqft)
    const kind = _kindChecked();
    if (kind === 'flat' && !(parseFloat(_gv('acm-default-amount')) > 0)) { _showMsg('Enter an amount more than 0 (or choose Per Sq.Ft. or a percent).', false); return; }
    if (kind === 'percent' && !(parseFloat(_gv('acm-percent')) > 0 && parseFloat(_gv('acm-percent')) <= 100)) { _showMsg('Enter a percent more than 0 and at most 100.', false); return; }

    if (_editingId) {
      const ok = await Utils.ask('This will update all existing consumer charges for this type and recalculate their payment schedules. Continue?');
      if (!ok) return;
    }

    const saveBtn = document.getElementById('acm-save-btn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = _editingId ? 'Updating...' : 'Saving...'; }
    _clearMsg();

    const token = localStorage.getItem('rof-jwt') || '';
    try {
      const kindNow = _kindChecked();
      const body = {
        projectId,
        chargeName,
        rateType:       kindNow,
        percentValue:   kindNow === 'percent' ? parseFloat(_gv('acm-percent')) : undefined,
        percentBasis:   kindNow === 'percent' ? _gv('acm-percent-basis') : undefined,
        defaultAmount:  parseFloat(_gv('acm-default-amount') || '0'),
        ratePerSqftInr: parseFloat(_gv('acm-rate-per-sqft') || '0'),
        cgstPct:       parseFloat(_gv('acm-cgst') || '9'),
        sgstPct:       parseFloat(_gv('acm-sgst') || '9'),
        ..._extras(),
      };

      let res, data;
      if (_editingId) {
        res = await fetch('/api/addon-charges/master/' + _editingId, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify(Object.assign({}, body, { projectId: undefined }))
        });
      } else {
        res = await fetch('/api/addon-charges/master', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify(body)
        });
      }
      data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      const doneMsg = _editingId && data.affectedConsumers > 0 ? 'Charge type updated — recalculated for ' + data.affectedConsumers + ' consumer(s).' : (_editingId ? 'Charge type updated.' : 'Charge type saved.');
      _editingId = null;
      _resetForm();
      await _loadCharges(projectId);
      _showMsg(doneMsg, true);
    } catch (e) {
      _showMsg('Error: ' + e.message, false);
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = _editingId ? 'UPDATE' : 'SAVE'; }
    }
  }

  async function _deactivate(id) {
    const ok = await Utils.ask('This will deactivate the charge type and cancel it for all existing consumers who currently have it, recalculating their payment schedules. Continue?');
    if (!ok) return;
    const token = localStorage.getItem('rof-jwt') || '';
    try {
      const res = await fetch('/api/addon-charges/master/' + id, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Deactivate failed');
      const projectId = document.getElementById('acm-project') && document.getElementById('acm-project').value;
      if (projectId) await _loadCharges(projectId);
      _showMsg(data.affectedConsumers > 0 ? 'Charge type deactivated — cancelled for ' + data.affectedConsumers + ' consumer(s).' : 'Charge type deactivated.', true);
    } catch (e) {
      _showMsg('Error: ' + e.message, false);
    }
  }

  const _FLAGS = [['mandatory','isMandatory','is_mandatory'],['parking','isParking','is_parking'],['inventory','inventoryBase','inventory_base'],['multiple','multipleBooking','multiple_booking'],['alteration','isAlteration','is_alteration'],['agreement','isAgreement','is_agreement'],['dues','includeInDues','include_in_dues']];
  function _extras() {
    const o = { chargeType: _gv('acm-charge-type'), applyDateType: _gv('acm-apply-date'), calculateRateType: _gv('acm-calc-rate'),
      quantity: _gv('acm-quantity') === '' ? null : Number(_gv('acm-quantity')), effectiveDate: _gv('acm-effective-date') || null, description: _gv('acm-description') || null };
    _FLAGS.forEach(function(f) { o[f[1]] = !!document.getElementById('acm-f-' + f[0]).checked; });
    return o;
  }
  function _fillExtras(row) {
    _setVal('acm-charge-type', row ? row.charge_type : 'Other'); _setVal('acm-apply-date', row ? row.apply_date_type : 'Customer Wise Date'); _setVal('acm-calc-rate', row && ['Super Area', 'Balcony Area', 'Plot Area'].includes(row.calculate_rate_type) ? row.calculate_rate_type : 'Carpet Area');
    _setVal('acm-quantity', row && row.quantity != null ? row.quantity : ''); _setVal('acm-effective-date', row && row.effective_date ? String(row.effective_date).slice(0, 10) : ''); _setVal('acm-description', row && row.description ? row.description : '');
    _FLAGS.forEach(function(f) { document.getElementById('acm-f-' + f[0]).checked = row ? !!row[f[2]] : f[0] === 'dues'; });
  }

  function _resetForm() {
    _setVal('acm-charge-name', '');
    _setVal('acm-default-amount', '0');
    _setVal('acm-rate-per-sqft', '0');
    const flatRadio = document.getElementById('acm-rate-type-flat');
    const sqftRadio = document.getElementById('acm-rate-type-persqft');
    if (flatRadio) flatRadio.checked = true;
    if (sqftRadio) sqftRadio.checked = false;
    if (document.getElementById('acm-rate-type-percent')) document.getElementById('acm-rate-type-percent').checked = false;
    _setVal('acm-percent', '0'); _setVal('acm-percent-basis', 'basic');
    _applyRateTypeVisibility('flat');
    _setVal('acm-cgst', '9');
    _setVal('acm-sgst', '9');
    _fillExtras(null);
    const titleEl = document.getElementById('acm-form-title');
    if (titleEl) titleEl.textContent = 'ADD NEW CHARGE TYPE';
    const saveBtn = document.getElementById('acm-save-btn');
    if (saveBtn) { saveBtn.textContent = 'SAVE'; saveBtn.disabled = false; }
    const cancelBtn = document.getElementById('acm-cancel-btn');
    if (cancelBtn) cancelBtn.style.display = 'none';
    _clearMsg();
  }

  function _setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  function _gv(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function _esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _fmtNum(n) {
    const num = parseFloat(n || 0);
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function _showMsg(text, ok) {
    const el = document.getElementById('acm-msg');
    if (!el) return;
    el.textContent = text;
    el.className = 'acm-msg ' + (ok ? 'acm-msg-ok' : 'acm-msg-err');
    el.style.display = 'block';
  }

  function _clearMsg() {
    const el = document.getElementById('acm-msg');
    if (el) { el.style.display = 'none'; el.textContent = ''; }
  }

  window.AddonChargeMaster = {
    load:          _loadCharges,
    save:          _save,
    edit:          _editRow,
    deactivate:    _deactivate,
    cancelEdit:    cancelEdit,
    onProjectChange: onProjectChange,
    onRateTypeChange: onRateTypeChange,
  };

  Pages.addonChargeMaster = function(params) {
    const container = document.getElementById('content') || document.body;
    container.innerHTML = _render();
    _init(params && params.project);
  };

})();
