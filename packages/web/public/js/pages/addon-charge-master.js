/**
 * Addon Charge Master — Project Set Up > Extra Add On Charge Master
 * Per-project charge type configuration.
 */
(() => {

  const ACM_STYLES = `<style id="acm-styles">
.acm-page { padding: 0; font-family: Arial, sans-serif; font-size: 13px; }
.acm-card { background: #fff; border: 1px solid #ddd; border-radius: 3px; margin-bottom: 10px; }
.acm-hdr {
  display: flex; justify-content: space-between; align-items: center;
  background: #1d3a6e; padding: 7px 12px; border-radius: 3px 3px 0 0;
}
.acm-hdr-title { color: #fff; font-size: 13px; font-weight: bold; letter-spacing: .3px; }
.acm-body { padding: 14px 16px 16px; }
.acm-project-row { display: flex; align-items: flex-end; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
.acm-field { display: flex; flex-direction: column; gap: 3px; }
.acm-lbl { font-size: 11px; color: #555; white-space: nowrap; }
.acm-project-row select { padding: 5px 8px; border: 1px solid #ccc; border-radius: 3px; font-size: 13px; min-width: 200px; }
.acm-divider { border: none; border-top: 1px solid #e0e0e0; margin: 4px 0 14px; }
.acm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px 20px;
  margin-bottom: 14px;
}
.acm-grid input[type="text"],
.acm-grid input[type="number"] {
  padding: 5px 8px; border: 1px solid #ccc; border-radius: 3px;
  font-size: 13px; width: 100%; box-sizing: border-box;
}
.acm-grid input:focus { outline: none; border-color: #337ab7; }
.acm-btn-row { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
.acm-btn-save {
  background: #1d3a6e; color: #fff; border: none;
  padding: 7px 22px; border-radius: 3px; font-size: 13px; font-weight: bold; cursor: pointer;
}
.acm-btn-save:hover { background: #16305c; }
.acm-btn-save:disabled { opacity: .7; cursor: not-allowed; }
.acm-btn-cancel {
  background: #fff; color: #555; border: 1px solid #ccc;
  padding: 7px 16px; border-radius: 3px; font-size: 13px; cursor: pointer;
}
.acm-btn-cancel:hover { background: #f5f5f5; }
.acm-msg { margin-top: 10px; font-size: 13px; padding: 6px 10px; border-radius: 3px; display: none; }
.acm-msg-ok  { background: #dff0d8; color: #3c763d; border: 1px solid #d6e9c6; }
.acm-msg-err { background: #f2dede; color: #a94442; border: 1px solid #ebccd1; }
.acm-table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 12px; }
.acm-table th { background: #1d3a6e; color: #fff; padding: 6px 8px; text-align: left; font-weight: bold; font-size: 12px; }
.acm-table td { padding: 5px 8px; border-bottom: 1px solid #eee; vertical-align: middle; }
.acm-table tr:hover td { background: #f9f9f9; }
.acm-act-link { color: #337ab7; cursor: pointer; font-size: 12px; text-decoration: underline; margin-right: 8px; }
.acm-act-link:hover { color: #1d3a6e; }
.acm-act-del { color: #a94442; cursor: pointer; font-size: 12px; text-decoration: underline; }
.acm-act-del:hover { color: #800; }
.acm-empty { text-align: center; color: #999; padding: 16px; font-size: 13px; }
.acm-badge-active   { background: #dff0d8; color: #3c763d; padding: 2px 7px; border-radius: 10px; font-size: 11px; }
.acm-badge-inactive { background: #f2dede; color: #a94442; padding: 2px 7px; border-radius: 10px; font-size: 11px; }
</style>`;

  let _editingId = null;
  let _rows = [];

  function _render() {
    return ACM_STYLES + `
<div class="acm-page">
  <div class="acm-card">
    <div class="acm-hdr">
      <span class="acm-hdr-title">EXTRA ADD ON CHARGE MASTER</span>
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
        <div style="font-size:12px;font-weight:bold;color:#1d3a6e;margin-bottom:10px;" id="acm-form-title">ADD NEW CHARGE TYPE</div>
        <div class="acm-grid">
          <div class="acm-field" style="grid-column: span 2">
            <span class="acm-lbl">* Charge Name</span>
            <input type="text" id="acm-charge-name" placeholder="e.g. Club Membership, IFMS, etc.">
          </div>
          <div class="acm-field" style="grid-column: span 2">
            <span class="acm-lbl">Rate Type</span>
            <div style="display:flex;gap:16px;align-items:center;height:29px;">
              <label style="display:flex;align-items:center;gap:4px;font-size:13px;font-weight:normal;cursor:pointer;">
                <input type="radio" name="acm-rate-type" id="acm-rate-type-flat" value="flat" checked onchange="AddonChargeMaster.onRateTypeChange()"> Flat Amount
              </label>
              <label style="display:flex;align-items:center;gap:4px;font-size:13px;font-weight:normal;cursor:pointer;">
                <input type="radio" name="acm-rate-type" id="acm-rate-type-persqft" value="per_sqft" onchange="AddonChargeMaster.onRateTypeChange()"> Per Sq.Ft.
              </label>
            </div>
          </div>
          <div class="acm-field" id="acm-default-amount-field">
            <span class="acm-lbl">Default Amount (Rs.)</span>
            <input type="number" id="acm-default-amount" min="0" step="0.01" value="0">
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
        </div>
        <div class="acm-btn-row">
          <button class="acm-btn-save" id="acm-save-btn" onclick="AddonChargeMaster.save()">SAVE</button>
          <button class="acm-btn-cancel" id="acm-cancel-btn" style="display:none" onclick="AddonChargeMaster.cancelEdit()">CANCEL</button>
        </div>
        <div class="acm-msg" id="acm-msg"></div>
      </div>

      <div id="acm-table-section"></div>

    </div>
  </div>
</div>`;
  }

  async function _init() {
    await _loadProjects();
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
    tableSection.innerHTML = '<div style="padding:10px;color:#999;font-size:12px;">Loading...</div>';
    try {
      const res = await fetch('/api/addon-charges/master?projectId=' + encodeURIComponent(projectId), {
        headers: { Authorization: 'Bearer ' + token }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      _renderTable(data.data || []);
    } catch (e) {
      tableSection.innerHTML = '<div class="acm-empty">Error loading charges: ' + e.message + '</div>';
    }
  }

  function _renderTable(rows) {
    _rows = rows;
    const tableSection = document.getElementById('acm-table-section');
    if (!tableSection) return;
    if (rows.length === 0) {
      tableSection.innerHTML = '<div class="acm-empty">No charge types configured for this project.</div>';
      return;
    }
    let html = '<table class="acm-table"><thead><tr>' +
      '<th>S.NO</th><th>CHARGE NAME</th><th>RATE</th>' +
      '<th>CGST %</th><th>SGST %</th><th>STATUS</th><th>ACTION</th>' +
      '</tr></thead><tbody>';
    rows.forEach(function(r, i) {
      const statusBadge = r.is_active
        ? '<span class="acm-badge-active">Active</span>'
        : '<span class="acm-badge-inactive">Inactive</span>';
      const rateLabel = r.rate_type === 'per_sqft'
        ? 'Per Sq.Ft. @ Rs.' + _fmtNum(r.rate_per_sqft_inr) + '/sqft'
        : 'Flat @ Rs.' + _fmtNum(r.default_amount);
      html += '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        '<td>' + _esc(r.charge_name) + '</td>' +
        '<td style="text-align:right">' + rateLabel + '</td>' +
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
    const isPerSqft = row.rate_type === 'per_sqft';
    const flatRadio = document.getElementById('acm-rate-type-flat');
    const sqftRadio = document.getElementById('acm-rate-type-persqft');
    if (flatRadio) flatRadio.checked = !isPerSqft;
    if (sqftRadio) sqftRadio.checked = isPerSqft;
    _applyRateTypeVisibility(isPerSqft);
    _setVal('acm-cgst', parseFloat(row.cgst_pct));
    _setVal('acm-sgst', parseFloat(row.sgst_pct));
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

  function _applyRateTypeVisibility(isPerSqft) {
    const flatField = document.getElementById('acm-default-amount-field');
    const sqftField = document.getElementById('acm-rate-per-sqft-field');
    if (flatField) flatField.style.display = isPerSqft ? 'none' : '';
    if (sqftField) sqftField.style.display = isPerSqft ? '' : 'none';
  }

  function onRateTypeChange() {
    const sqftRadio = document.getElementById('acm-rate-type-persqft');
    _applyRateTypeVisibility(!!(sqftRadio && sqftRadio.checked));
  }

  async function _save() {
    const projectId = document.getElementById('acm-project') && document.getElementById('acm-project').value;
    if (!projectId) { _showMsg('Please select a project first.', false); return; }

    const chargeName = (_gv('acm-charge-name') || '').trim();
    if (!chargeName) { _showMsg('Charge Name is required.', false); return; }

    if (_editingId) {
      const ok = window.confirm('This will update all existing consumer charges for this type and recalculate their payment schedules. Continue?');
      if (!ok) return;
    }

    const saveBtn = document.getElementById('acm-save-btn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = _editingId ? 'Updating...' : 'Saving...'; }
    _clearMsg();

    const token = localStorage.getItem('rof-jwt') || '';
    try {
      const sqftRadio = document.getElementById('acm-rate-type-persqft');
      const isPerSqft = !!(sqftRadio && sqftRadio.checked);
      const body = {
        projectId,
        chargeName,
        rateType:       isPerSqft ? 'per_sqft' : 'flat',
        defaultAmount:  parseFloat(_gv('acm-default-amount') || '0'),
        ratePerSqftInr: parseFloat(_gv('acm-rate-per-sqft') || '0'),
        cgstPct:       parseFloat(_gv('acm-cgst') || '9'),
        sgstPct:       parseFloat(_gv('acm-sgst') || '9'),
      };

      let res, data;
      if (_editingId) {
        res = await fetch('/api/addon-charges/master/' + _editingId, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({
            chargeName: body.chargeName, rateType: body.rateType,
            defaultAmount: body.defaultAmount, ratePerSqftInr: body.ratePerSqftInr,
            cgstPct: body.cgstPct, sgstPct: body.sgstPct
          })
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
      if (_editingId && data.affectedConsumers > 0) {
        _showMsg('Charge type updated — recalculated for ' + data.affectedConsumers + ' consumer(s).', true);
      } else {
        _showMsg(_editingId ? 'Charge type updated.' : 'Charge type saved.', true);
      }
      _editingId = null;
      _resetForm();
      await _loadCharges(projectId);
    } catch (e) {
      _showMsg('Error: ' + e.message, false);
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = _editingId ? 'UPDATE' : 'SAVE'; }
    }
  }

  async function _deactivate(id) {
    const ok = window.confirm('This will deactivate the charge type and cancel it for all existing consumers who currently have it, recalculating their payment schedules. Continue?');
    if (!ok) return;
    const token = localStorage.getItem('rof-jwt') || '';
    try {
      const res = await fetch('/api/addon-charges/master/' + id, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Deactivate failed');
      if (data.affectedConsumers > 0) {
        _showMsg('Charge type deactivated — cancelled for ' + data.affectedConsumers + ' consumer(s).', true);
      } else {
        _showMsg('Charge type deactivated.', true);
      }
      const projectId = document.getElementById('acm-project') && document.getElementById('acm-project').value;
      if (projectId) await _loadCharges(projectId);
    } catch (e) {
      _showMsg('Error: ' + e.message, false);
    }
  }

  function _resetForm() {
    _setVal('acm-charge-name', '');
    _setVal('acm-default-amount', '0');
    _setVal('acm-rate-per-sqft', '0');
    const flatRadio = document.getElementById('acm-rate-type-flat');
    const sqftRadio = document.getElementById('acm-rate-type-persqft');
    if (flatRadio) flatRadio.checked = true;
    if (sqftRadio) sqftRadio.checked = false;
    _applyRateTypeVisibility(false);
    _setVal('acm-cgst', '9');
    _setVal('acm-sgst', '9');
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
    _init();
  };

})();
