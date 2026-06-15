// ROF CRM — Ownership Transfer Page
(() => {

  const TR_STYLES = `<style id="tr-styles">
.tr-page { padding: 0; font-family: Arial, sans-serif; font-size: 13px; }
.tr-card { background: #fff; border: 1px solid #ddd; border-radius: 3px; margin-bottom: 10px; }
.tr-hdr {
  display: flex; justify-content: space-between; align-items: center;
  background: #1d3a6e; padding: 7px 12px; border-radius: 3px 3px 0 0;
}
.tr-hdr-title { color: #fff; font-size: 13px; font-weight: bold; letter-spacing: .3px; }
.tr-body { padding: 14px 16px 16px; }
.tr-filter-row { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.tr-field { display: flex; flex-direction: column; gap: 3px; }
.tr-lbl { font-size: 11px; color: #555; white-space: nowrap; }
.tr-filter-row select,
.tr-filter-row input[type="text"] {
  padding: 5px 8px; border: 1px solid #ccc; border-radius: 3px;
  font-size: 13px; min-width: 160px;
}
.tr-btn {
  background: #1d3a6e; color: #fff; border: none;
  padding: 6px 18px; border-radius: 3px; font-size: 13px; font-weight: bold;
  cursor: pointer; white-space: nowrap;
}
.tr-btn:hover { background: #16305c; }
.tr-btn:disabled { opacity: .7; cursor: not-allowed; }
.tr-btn-sm {
  background: #1d3a6e; color: #fff; border: none;
  padding: 4px 10px; border-radius: 3px; font-size: 12px; cursor: pointer;
}
.tr-btn-sm:hover { background: #16305c; }
.tr-btn-back {
  background: none; border: none; color: #fff; font-size: 18px;
  cursor: pointer; padding: 0 6px 0 0; font-weight: bold; line-height: 1;
}
.tr-table-wrap { overflow-x: auto; }
.tr-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.tr-table th { background: #1d3a6e; color: #fff; padding: 6px 8px; text-align: left; white-space: nowrap; }
.tr-table td { padding: 5px 8px; border-bottom: 1px solid #eee; vertical-align: middle; }
.tr-table tr:hover td { background: #f5f7ff; }
.tr-section-title { font-size: 12px; font-weight: bold; color: #1d3a6e; margin: 12px 0 6px; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px; }
.tr-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px 18px;
  margin-bottom: 10px;
}
.tr-grid input[type="text"],
.tr-grid input[type="date"],
.tr-grid input[type="number"],
.tr-grid input[type="email"],
.tr-grid select,
.tr-grid textarea {
  padding: 5px 8px; border: 1px solid #ccc; border-radius: 3px;
  font-size: 13px; width: 100%; box-sizing: border-box;
}
.tr-grid input[readonly],
.tr-grid input:read-only { background: #f5f5f5; color: #666; }
.tr-grid input:focus,
.tr-grid select:focus,
.tr-grid textarea:focus { outline: none; border-color: #337ab7; }
.tr-radio-group { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; padding: 4px 0; }
.tr-radio-group label { font-size: 13px; display: flex; align-items: center; gap: 4px; cursor: pointer; }
.tr-info-box { background: #f8f9fc; border: 1px solid #d8dff0; border-radius: 3px; padding: 10px 14px; margin-bottom: 10px; font-size: 12px; }
.tr-info-row { display: flex; gap: 24px; flex-wrap: wrap; }
.tr-info-item { display: flex; flex-direction: column; gap: 1px; }
.tr-info-lbl { color: #888; font-size: 11px; }
.tr-info-val { font-weight: bold; color: #222; }
.tr-msg { margin-top: 8px; font-size: 13px; padding: 6px 10px; border-radius: 3px; display: none; }
.tr-msg-ok  { background: #dff0d8; color: #3c763d; border: 1px solid #d6e9c6; }
.tr-msg-err { background: #f2dede; color: #a94442; border: 1px solid #ebccd1; }
.tr-pagination { display: flex; gap: 6px; align-items: center; margin-top: 10px; font-size: 12px; }
.tr-pagination button { padding: 3px 10px; border: 1px solid #ccc; border-radius: 3px; cursor: pointer; background: #fff; }
.tr-pagination button:disabled { opacity: .5; cursor: not-allowed; }
.tr-history-section { margin-top: 18px; }
</style>`;

  // ── State ─────────────────────────────────────────────────────────────────
  let _view = 'search';
  let _projects = [];
  let _sellerData = null;
  let _selectedUnitId = null;
  let _formData = {};
  let _users = [];
  let _histPage = 1;
  const _HIST_PS = 20;

  // ── Render dispatcher ─────────────────────────────────────────────────────
  function _render() {
    const container = document.getElementById('tr-content');
    if (!container) return;
    if (_view === 'search') container.innerHTML = _renderSearch();
    else if (_view === 'form') container.innerHTML = _renderForm();
    else if (_view === 'buyer') container.innerHTML = _renderBuyer();
  }

  // ── Search View ───────────────────────────────────────────────────────────
  function _renderSearch() {
    const opts = _projects.map(p =>
      `<option value="${p.id}">${_esc(p.name || p.project_name)}</option>`
    ).join('');
    return `
<div class="tr-card">
  <div class="tr-hdr"><span class="tr-hdr-title">OWNERSHIP TRANSFER — SEARCH ALLOTTEE</span></div>
  <div class="tr-body">
    <div class="tr-filter-row">
      <div class="tr-field">
        <span class="tr-lbl">Project</span>
        <select id="tr-f-project"><option value="">--All Projects--</option>${opts}</select>
      </div>
      <div class="tr-field">
        <span class="tr-lbl">Reg No</span>
        <input type="text" id="tr-f-regno" placeholder="Registration No">
      </div>
      <div class="tr-field">
        <span class="tr-lbl">First Name</span>
        <input type="text" id="tr-f-name" placeholder="First Name">
      </div>
      <div class="tr-field">
        <span class="tr-lbl">Unit Address</span>
        <input type="text" id="tr-f-unit" placeholder="Unit Number">
      </div>
      <div class="tr-field" style="justify-content:flex-end">
        <button class="tr-btn" onclick="TransferApp.search()">FETCH</button>
      </div>
    </div>
    <div id="tr-search-results"></div>
    <div id="tr-search-msg" class="tr-msg"></div>
  </div>
</div>`;
  }

  async function _doSearch() {
    const projectId = document.getElementById('tr-f-project')?.value || '';
    const regno = document.getElementById('tr-f-regno')?.value?.trim() || '';
    const name = document.getElementById('tr-f-name')?.value?.trim() || '';
    const unit = document.getElementById('tr-f-unit')?.value?.trim() || '';

    const resultsDiv = document.getElementById('tr-search-results');
    const msgDiv = document.getElementById('tr-search-msg');
    if (resultsDiv) resultsDiv.innerHTML = '<p style="color:#888;font-size:12px">Searching...</p>';
    if (msgDiv) msgDiv.style.display = 'none';

    const token = localStorage.getItem('rof-jwt') || '';
    const params = new URLSearchParams();
    if (projectId) params.set('projectId', projectId);
    if (regno) params.set('registrationNo', regno);
    if (name) params.set('firstName', name);
    if (unit) params.set('unitNumber', unit);
    params.set('leadStage', 'allotted');
    params.set('pageSize', '100');

    try {
      const res = await fetch('/api/consumers?' + params.toString(), {
        headers: { Authorization: 'Bearer ' + token }
      });
      const data = await res.json();
      const rows = data.consumers || data.data || data || [];
      if (!rows.length) {
        if (resultsDiv) resultsDiv.innerHTML = '<p style="color:#888;font-size:12px">No allotted consumers found.</p>';
        return;
      }
      if (resultsDiv) resultsDiv.innerHTML = _renderSearchTable(rows);
    } catch (e) {
      if (msgDiv) { msgDiv.textContent = 'Error: ' + e.message; msgDiv.className = 'tr-msg tr-msg-err'; msgDiv.style.display = 'block'; }
      if (resultsDiv) resultsDiv.innerHTML = '';
    }
  }

  function _renderSearchTable(rows) {
    const trs = rows.map((c, i) => `
<tr>
  <td>${i + 1}</td>
  <td>${_esc(c.registration_no || '')}</td>
  <td>${_esc(c.name || c.first_name || '')}</td>
  <td>${_esc(c.unit_number || c.allocated_unit_number || '')}</td>
  <td>${_esc(c.broker_company || '')}</td>
  <td>${_fmt(c.registration_date || c.created_at)}</td>
  <td>${_fmt(c.allotment_date || '')}</td>
  <td><button class="tr-btn-sm" onclick="TransferApp.selectSeller('${c.id}','${c.allocated_unit_id || ''}')">TRANSFER</button></td>
</tr>`).join('');
    return `
<div class="tr-table-wrap">
<table class="tr-table">
  <thead><tr>
    <th>SR.NO</th><th>REG NO</th><th>NAME</th><th>UNIT ADDRESS</th>
    <th>BROKER COMPANY</th><th>REG DATE</th><th>ALLOTMENT DATE</th><th>ACTION</th>
  </tr></thead>
  <tbody>${trs}</tbody>
</table>
</div>`;
  }

  async function _selectSeller(consumerId, unitId) {
    if (!consumerId || !unitId) {
      alert('This consumer has no allocated unit. Cannot initiate transfer.');
      return;
    }
    const token = localStorage.getItem('rof-jwt') || '';
    try {
      const res = await fetch('/api/transfers/unit-owner/' + encodeURIComponent(unitId), {
        headers: { Authorization: 'Bearer ' + token }
      });
      const data = await res.json();
      if (!res.ok) { alert(data.message || 'Could not load owner details.'); return; }
      _sellerData = data.data;
      _selectedUnitId = unitId;
      _view = 'form';
      _render();
      _initForm();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  }

  // ── Form View ─────────────────────────────────────────────────────────────
  function _renderForm() {
    const s = _sellerData || {};
    const userOpts = _users.map(u =>
      `<option value="${_esc(u.name || u.email)}">${_esc(u.name || u.email)}</option>`
    ).join('');

    return `
<div class="tr-card">
  <div class="tr-hdr">
    <span style="display:flex;align-items:center;gap:8px">
      <button class="tr-btn-back" onclick="TransferApp.back()">&#8592;</button>
      <span class="tr-hdr-title">OWNERSHIP TRANSFER — TRANSFER DETAILS</span>
    </span>
  </div>
  <div class="tr-body">

    <div class="tr-section-title">Payment Detail (Existing Allottee)</div>
    <div class="tr-info-box">
      <div class="tr-info-row">
        <div class="tr-info-item"><span class="tr-info-lbl">Name</span><span class="tr-info-val">${_esc(s.name || '')}</span></div>
        <div class="tr-info-item"><span class="tr-info-lbl">Reg No</span><span class="tr-info-val">${_esc(s.registration_no || '')}</span></div>
        <div class="tr-info-item"><span class="tr-info-lbl">Unit</span><span class="tr-info-val">${_esc(s.unit_number || '')}</span></div>
        <div class="tr-info-item"><span class="tr-info-lbl">Project</span><span class="tr-info-val">${_esc(s.project_name || '')}</span></div>
        <div class="tr-info-item"><span class="tr-info-lbl">Mobile</span><span class="tr-info-val">${_esc(s.mobile || '')}</span></div>
        <div class="tr-info-item"><span class="tr-info-lbl">PAN</span><span class="tr-info-val">${_esc(s.pan_no || '')}</span></div>
        <div class="tr-info-item"><span class="tr-info-lbl">Allotment Date</span><span class="tr-info-val">${_fmt(s.allotment_date)}</span></div>
        <div class="tr-info-item"><span class="tr-info-lbl">Previous Transfers</span><span class="tr-info-val">${s.transfer_count || 0}</span></div>
      </div>
    </div>

    <div class="tr-section-title">Unit Information</div>
    <div class="tr-grid">
      <div class="tr-field" style="grid-column:1/-1">
        <span class="tr-lbl">Applicant Type</span>
        <div class="tr-radio-group">
          <label><input type="radio" name="tr-atype" value="Individual" checked> Individual</label>
          <label><input type="radio" name="tr-atype" value="Multiple"> Multiple</label>
          <label><input type="radio" name="tr-atype" value="Company"> Company</label>
          <label><input type="radio" name="tr-atype" value="Private Firms"> Private Firms</label>
        </div>
      </div>
      <div class="tr-field">
        <span class="tr-lbl">Project</span>
        <input type="text" id="tr-project-disp" value="${_esc(s.project_name || '')}" readonly>
      </div>
      <div class="tr-field">
        <span class="tr-lbl">Unit Type</span>
        <input type="text" id="tr-unit-type" value="${_esc(s.bhk_type || '')}" readonly>
      </div>
      <div class="tr-field">
        <span class="tr-lbl">Broker Company</span>
        <input type="text" id="tr-broker-co" placeholder="Broker Company">
      </div>
      <div class="tr-field">
        <span class="tr-lbl">Main Broker</span>
        <input type="text" id="tr-main-broker" placeholder="Main Broker Name">
      </div>
      <div class="tr-field">
        <span class="tr-lbl">Reg No</span>
        <input type="text" id="tr-regno" value="${_esc(s.registration_no || '')}" readonly>
      </div>
      <div class="tr-field">
        <span class="tr-lbl">* Transfer Date</span>
        <input type="date" id="tr-transfer-date">
      </div>
      <div class="tr-field">
        <span class="tr-lbl">Basic Price (Rs.)</span>
        <input type="number" id="tr-basic-price" min="0" step="1" value="${s.base_price_inr || 0}">
      </div>
      <div class="tr-field">
        <span class="tr-lbl">GSTIN</span>
        <input type="text" id="tr-gstin" placeholder="GSTIN (optional)" style="text-transform:uppercase">
      </div>
      <div class="tr-field">
        <span class="tr-lbl">Application Date</span>
        <input type="date" id="tr-app-date">
      </div>
      <div class="tr-field">
        <span class="tr-lbl">Transfer No</span>
        <input type="text" id="tr-transfer-no" placeholder="Transfer Number">
      </div>
      <div class="tr-field">
        <span class="tr-lbl">Transfer Receipt No</span>
        <input type="text" id="tr-receipt-no" placeholder="Receipt Number">
      </div>
    </div>

    <div class="tr-section-title">Transfer Charges</div>
    <div class="tr-grid">
      <div class="tr-field">
        <span class="tr-lbl">Transfer Fee (Rs.)</span>
        <input type="number" id="tr-fee" min="0" step="1" value="0" oninput="TransferApp.calcTax()">
      </div>
      <div class="tr-field">
        <span class="tr-lbl">Admin Charges (Rs.)</span>
        <input type="number" id="tr-admin" min="0" step="1" value="0" oninput="TransferApp.calcTax()">
      </div>
      <div class="tr-field">
        <span class="tr-lbl">Transfer Amount (Rs.)</span>
        <input type="number" id="tr-transfer-amt" min="0" step="1" value="0">
      </div>
      <div class="tr-field">
        <span class="tr-lbl">Service Tax %</span>
        <input type="number" id="tr-stax-pct" min="0" step="0.01" value="0" oninput="TransferApp.calcTax()">
      </div>
      <div class="tr-field">
        <span class="tr-lbl">CGST %</span>
        <input type="number" id="tr-cgst-pct" min="0" step="0.01" value="0" oninput="TransferApp.calcTax()">
      </div>
      <div class="tr-field">
        <span class="tr-lbl">SGST %</span>
        <input type="number" id="tr-sgst-pct" min="0" step="0.01" value="0" oninput="TransferApp.calcTax()">
      </div>
      <div class="tr-field">
        <span class="tr-lbl">IGST %</span>
        <input type="number" id="tr-igst-pct" min="0" step="0.01" value="0" oninput="TransferApp.calcTax()">
      </div>
      <div class="tr-field">
        <span class="tr-lbl">UGST %</span>
        <input type="number" id="tr-ugst-pct" min="0" step="0.01" value="0" oninput="TransferApp.calcTax()">
      </div>
    </div>
    <div class="tr-grid" style="background:#f8f9fc;padding:8px;border-radius:3px;margin-bottom:10px">
      <div class="tr-field">
        <span class="tr-lbl">Service Tax Amt (Rs.)</span>
        <input type="number" id="tr-stax-amt" readonly>
      </div>
      <div class="tr-field">
        <span class="tr-lbl">CGST Amt (Rs.)</span>
        <input type="number" id="tr-cgst-amt" readonly>
      </div>
      <div class="tr-field">
        <span class="tr-lbl">SGST Amt (Rs.)</span>
        <input type="number" id="tr-sgst-amt" readonly>
      </div>
      <div class="tr-field">
        <span class="tr-lbl">IGST Amt (Rs.)</span>
        <input type="number" id="tr-igst-amt" readonly>
      </div>
      <div class="tr-field">
        <span class="tr-lbl">UGST Amt (Rs.)</span>
        <input type="number" id="tr-ugst-amt" readonly>
      </div>
    </div>

    <div class="tr-section-title">Employee</div>
    <div class="tr-grid">
      <div class="tr-field">
        <span class="tr-lbl">Sales Person</span>
        <select id="tr-salesperson">
          <option value="">--Select--</option>
          ${userOpts}
        </select>
      </div>
      <div class="tr-field" style="grid-column:span 2">
        <span class="tr-lbl">Remarks</span>
        <textarea id="tr-remarks" rows="2" style="resize:vertical;width:100%;padding:5px 8px;border:1px solid #ccc;border-radius:3px;font-size:13px;box-sizing:border-box"></textarea>
      </div>
    </div>

    <div id="tr-form-msg" class="tr-msg"></div>
    <button class="tr-btn" id="tr-next-btn" onclick="TransferApp.nextToBuyer()" style="margin-top:10px">NEXT &#8594;</button>
  </div>
</div>`;
  }

  async function _initForm() {
    const today = new Date().toISOString().slice(0, 10);
    const td = document.getElementById('tr-transfer-date');
    if (td) td.value = today;
    const ad = document.getElementById('tr-app-date');
    if (ad) ad.value = today;

    if (_sellerData && _sellerData.project_id) {
      await _loadFeeMaster(_sellerData.project_id);
    }
    await _loadUsers();
  }

  async function _loadFeeMaster(projectId) {
    const token = localStorage.getItem('rof-jwt') || '';
    try {
      const res = await fetch('/api/transfers/fee-master?projectId=' + encodeURIComponent(projectId), {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (res.status === 404) return;
      if (!res.ok) return;
      const data = await res.json();
      const fm = data.data;
      _setVal('tr-fee', fm.transfer_fee_inr || 0);
      _setVal('tr-admin', fm.admin_charges_inr || 0);
      _setVal('tr-stax-pct', fm.service_tax_pct || 0);
      _setVal('tr-cgst-pct', fm.cgst_pct || 0);
      _setVal('tr-sgst-pct', fm.sgst_pct || 0);
      _setVal('tr-igst-pct', fm.igst_pct || 0);
      _setVal('tr-ugst-pct', fm.ugst_pct || 0);
      _calcTax();
    } catch (e) {
      console.error('TransferApp: fee-master load failed', e);
    }
  }

  async function _loadUsers() {
    const token = localStorage.getItem('rof-jwt') || '';
    try {
      const res = await fetch('/api/users', { headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      _users = data.users || data.data || data || [];
      const sel = document.getElementById('tr-salesperson');
      if (!sel) return;
      sel.innerHTML = '<option value="">--Select--</option>';
      _users.forEach(u => {
        const o = document.createElement('option');
        o.value = u.name || u.email;
        o.textContent = u.name || u.email;
        sel.appendChild(o);
      });
    } catch (e) {
      console.error('TransferApp: users load failed', e);
    }
  }

  function _calcTax() {
    const fee = parseFloat(document.getElementById('tr-fee')?.value || '0');
    const admin = parseFloat(document.getElementById('tr-admin')?.value || '0');
    const base = fee + admin;
    const staxPct = parseFloat(document.getElementById('tr-stax-pct')?.value || '0');
    const cgstPct = parseFloat(document.getElementById('tr-cgst-pct')?.value || '0');
    const sgstPct = parseFloat(document.getElementById('tr-sgst-pct')?.value || '0');
    const igstPct = parseFloat(document.getElementById('tr-igst-pct')?.value || '0');
    const ugstPct = parseFloat(document.getElementById('tr-ugst-pct')?.value || '0');
    _setVal('tr-stax-amt', _round(base * staxPct / 100));
    _setVal('tr-cgst-amt', _round(base * cgstPct / 100));
    _setVal('tr-sgst-amt', _round(base * sgstPct / 100));
    _setVal('tr-igst-amt', _round(base * igstPct / 100));
    _setVal('tr-ugst-amt', _round(base * ugstPct / 100));
  }

  function _nextToBuyer() {
    if (!document.getElementById('tr-transfer-date')?.value) {
      _showMsg('tr-form-msg', 'Transfer Date is required.', false);
      return;
    }
    _formData = {
      transferNo: document.getElementById('tr-transfer-no')?.value?.trim() || null,
      applicationDate: document.getElementById('tr-app-date')?.value || null,
      transferDate: document.getElementById('tr-transfer-date')?.value || null,
      transferType: document.querySelector('input[name="tr-atype"]:checked')?.value || 'Individual',
      transferAmountInr: parseFloat(document.getElementById('tr-transfer-amt')?.value || '0'),
      transferFee: parseFloat(document.getElementById('tr-fee')?.value || '0'),
      adminCharges: parseFloat(document.getElementById('tr-admin')?.value || '0'),
      staxAmount: parseFloat(document.getElementById('tr-stax-amt')?.value || '0'),
      cgstAmount: parseFloat(document.getElementById('tr-cgst-amt')?.value || '0'),
      sgstAmount: parseFloat(document.getElementById('tr-sgst-amt')?.value || '0'),
      igstAmount: parseFloat(document.getElementById('tr-igst-amt')?.value || '0'),
      ugstAmount: parseFloat(document.getElementById('tr-ugst-amt')?.value || '0'),
      basicPrice: parseFloat(document.getElementById('tr-basic-price')?.value || '0'),
      gstin: (document.getElementById('tr-gstin')?.value?.trim() || '').toUpperCase() || null,
      brokerCompany: document.getElementById('tr-broker-co')?.value?.trim() || null,
      mainBroker: document.getElementById('tr-main-broker')?.value?.trim() || null,
      salesPersonName: document.getElementById('tr-salesperson')?.value || null,
      transferReceiptNo: document.getElementById('tr-receipt-no')?.value?.trim() || null,
      remarks: document.getElementById('tr-remarks')?.value?.trim() || null,
    };
    _view = 'buyer';
    _render();
  }

  // ── Buyer View ────────────────────────────────────────────────────────────
  function _renderBuyer() {
    const states = [
      'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
      'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra',
      'Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim',
      'Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
      'Andaman and Nicobar Islands','Chandigarh','Dadra & Nagar Haveli and Daman & Diu',
      'Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'
    ].map(s => `<option value="${s}">${s}</option>`).join('');

    return `
<div class="tr-card">
  <div class="tr-hdr">
    <span style="display:flex;align-items:center;gap:8px">
      <button class="tr-btn-back" onclick="TransferApp.back()">&#8592;</button>
      <span class="tr-hdr-title">OWNERSHIP TRANSFER — NEW BUYER DETAILS</span>
    </span>
  </div>
  <div class="tr-body">

    <div class="tr-section-title">New Applicant Details</div>
    <div class="tr-grid">
      <div class="tr-field">
        <span class="tr-lbl">Salutation</span>
        <select id="tr-b-sal">
          <option value="">--</option>
          <option>Mr.</option><option>Mrs.</option><option>Ms.</option>
          <option>Dr.</option><option>Prof.</option><option>M/s</option>
        </select>
      </div>
      <div class="tr-field">
        <span class="tr-lbl">* First Name</span>
        <input type="text" id="tr-b-fname" placeholder="First Name">
      </div>
      <div class="tr-field">
        <span class="tr-lbl">Middle Name</span>
        <input type="text" id="tr-b-mname" placeholder="Middle Name">
      </div>
      <div class="tr-field">
        <span class="tr-lbl">* Last Name</span>
        <input type="text" id="tr-b-lname" placeholder="Last Name">
      </div>
      <div class="tr-field">
        <span class="tr-lbl">S/o (Father's Name)</span>
        <input type="text" id="tr-b-sof" placeholder="Father / Husband Name">
      </div>
      <div class="tr-field">
        <span class="tr-lbl">Date of Birth</span>
        <input type="date" id="tr-b-dob">
      </div>
      <div class="tr-field" style="grid-column:1/-1">
        <span class="tr-lbl">Gender</span>
        <div class="tr-radio-group">
          <label><input type="radio" name="tr-b-gender" value="Male" checked> Male</label>
          <label><input type="radio" name="tr-b-gender" value="Female"> Female</label>
          <label><input type="radio" name="tr-b-gender" value="Other"> Other</label>
        </div>
      </div>
      <div class="tr-field" style="grid-column:1/-1">
        <span class="tr-lbl">Nationality</span>
        <div class="tr-radio-group">
          <label><input type="radio" name="tr-b-nat" value="Indian" checked> Indian</label>
          <label><input type="radio" name="tr-b-nat" value="NRI"> NRI</label>
          <label><input type="radio" name="tr-b-nat" value="Foreign"> Foreign</label>
        </div>
      </div>
      <div class="tr-field" style="grid-column:1/-1">
        <span class="tr-lbl">Marital Status</span>
        <div class="tr-radio-group">
          <label><input type="radio" name="tr-b-marital" value="Single" checked> Single</label>
          <label><input type="radio" name="tr-b-marital" value="Married"> Married</label>
          <label><input type="radio" name="tr-b-marital" value="Divorced"> Divorced</label>
          <label><input type="radio" name="tr-b-marital" value="Widowed"> Widowed</label>
        </div>
      </div>
      <div class="tr-field">
        <span class="tr-lbl">PAN No</span>
        <input type="text" id="tr-b-pan" placeholder="PAN Number" style="text-transform:uppercase" maxlength="10">
      </div>
      <div class="tr-field">
        <span class="tr-lbl">Aadhaar No</span>
        <input type="text" id="tr-b-aadhaar" placeholder="Aadhaar Number" maxlength="12">
      </div>
      <div class="tr-field">
        <span class="tr-lbl">* Mobile</span>
        <input type="text" id="tr-b-mobile" placeholder="Mobile Number" maxlength="10">
      </div>
      <div class="tr-field">
        <span class="tr-lbl">Email</span>
        <input type="email" id="tr-b-email" placeholder="Email Address">
      </div>
      <div class="tr-field">
        <span class="tr-lbl">Profession</span>
        <input type="text" id="tr-b-profession" placeholder="Profession">
      </div>
      <div class="tr-field">
        <span class="tr-lbl">Company</span>
        <input type="text" id="tr-b-company" placeholder="Company Name">
      </div>
    </div>

    <div class="tr-section-title">Buyer Address</div>
    <div class="tr-grid">
      <div class="tr-field" style="grid-column:1/-1">
        <span class="tr-lbl">Present Address</span>
        <input type="text" id="tr-b-addr" placeholder="Present Address">
      </div>
      <div class="tr-field">
        <span class="tr-lbl">Pin Code</span>
        <input type="text" id="tr-b-pin" placeholder="PIN" maxlength="6">
      </div>
      <div class="tr-field">
        <span class="tr-lbl">City</span>
        <input type="text" id="tr-b-city" placeholder="City">
      </div>
      <div class="tr-field">
        <span class="tr-lbl">State</span>
        <select id="tr-b-state"><option value="">--Select State--</option>${states}</select>
      </div>
      <div class="tr-field">
        <span class="tr-lbl">Country</span>
        <input type="text" id="tr-b-country" value="India" placeholder="Country">
      </div>
      <div class="tr-field">
        <span class="tr-lbl">Contact Mobile</span>
        <input type="text" id="tr-b-cmobile" placeholder="Contact Mobile" maxlength="10">
      </div>
      <div class="tr-field">
        <span class="tr-lbl">Phone</span>
        <input type="text" id="tr-b-phone" placeholder="Landline">
      </div>
    </div>

    <div id="tr-buyer-msg" class="tr-msg"></div>
    <button class="tr-btn" id="tr-save-btn" onclick="TransferApp.saveTransfer()" style="margin-top:10px">SAVE TRANSFER</button>
  </div>
</div>`;
  }

  async function _saveTransfer() {
    const fname = document.getElementById('tr-b-fname')?.value?.trim() || '';
    const lname = document.getElementById('tr-b-lname')?.value?.trim() || '';
    const mobile = document.getElementById('tr-b-mobile')?.value?.trim() || '';

    if (!fname) { _showMsg('tr-buyer-msg', 'First Name is required.', false); return; }
    if (!lname) { _showMsg('tr-buyer-msg', 'Last Name is required.', false); return; }
    if (!mobile) { _showMsg('tr-buyer-msg', 'Mobile is required.', false); return; }

    // FIX 2: aadhaar_hash is NOT NULL in DB — require it before POST
    const aadhaar = document.getElementById('tr-b-aadhaar')?.value?.trim() || '';
    if (!aadhaar) {
      _showMsg('tr-buyer-msg', 'Aadhaar No is required.', false);
      return;
    }

    const btn = document.getElementById('tr-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

    const token = localStorage.getItem('rof-jwt') || '';
    const s = _sellerData || {};

    try {
      const mname = document.getElementById('tr-b-mname')?.value?.trim() || '';
      const sal = document.getElementById('tr-b-sal')?.value || '';
      const fullName = [sal, fname, mname, lname].filter(Boolean).join(' ').trim();

      // FIX 1: map radio values to the DB check constraint ('married','unmarried','not_specified')
      const maritalRaw = document.querySelector('input[name="tr-b-marital"]:checked')?.value || 'Single';
      const maritalMapped = maritalRaw === 'Married' ? 'married'
                          : maritalRaw === 'Unmarried' ? 'unmarried'
                          : 'not_specified';

      const consumerBody = {
        salutation:            sal || null,
        first_name:            fname,
        middle_name:           mname || null,
        last_name:             lname,
        name:                  fullName,
        father_name:           document.getElementById('tr-b-sof')?.value?.trim() || null,
        dob:                   document.getElementById('tr-b-dob')?.value || null,
        gender:                document.querySelector('input[name="tr-b-gender"]:checked')?.value || 'Male',
        nationality:           document.querySelector('input[name="tr-b-nat"]:checked')?.value || 'Indian',
        marital_status:        maritalMapped,
        pan_no:                (document.getElementById('tr-b-pan')?.value?.trim() || '').toUpperCase() || null,
        aadhaar_no:            aadhaar,
        mobile:                mobile,
        email:                 document.getElementById('tr-b-email')?.value?.trim() || null,
        profession:            document.getElementById('tr-b-profession')?.value?.trim() || null,
        company:               document.getElementById('tr-b-company')?.value?.trim() || null,
        present_address_line1: document.getElementById('tr-b-addr')?.value?.trim() || null,
        present_pin:           document.getElementById('tr-b-pin')?.value?.trim() || null,
        present_city:          document.getElementById('tr-b-city')?.value?.trim() || null,
        present_state:         document.getElementById('tr-b-state')?.value || null,
        present_country:       document.getElementById('tr-b-country')?.value?.trim() || 'India',
        present_mobile_no:     document.getElementById('tr-b-cmobile')?.value?.trim() || null,
        phone_no:              document.getElementById('tr-b-phone')?.value?.trim() || null,
        project_id:            s.project_id || null,
        lead_stage:            'allotted',
      };

      const cRes = await fetch('/api/consumers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(consumerBody)
      });
      const cData = await cRes.json();
      if (!cRes.ok) throw new Error(cData.error || cData.message || 'Failed to create buyer');

      const newConsumerId = (cData.consumer || cData.data || cData).id;
      if (!newConsumerId) throw new Error('Buyer consumer ID missing from response');

      const transferBody = {
        unitId: _selectedUnitId,
        oldConsumerId: s.id,
        newConsumerId: newConsumerId,
        transferFee: _formData.transferFee,
        adminCharges: _formData.adminCharges,
        remarks: _formData.remarks,
        transferNo: _formData.transferNo,
        applicationDate: _formData.applicationDate,
        transferType: _formData.transferType,
        transferAmountInr: _formData.transferAmountInr,
        staxAmount: _formData.staxAmount,
        cgstAmount: _formData.cgstAmount,
        sgstAmount: _formData.sgstAmount,
        igstAmount: _formData.igstAmount,
        ugstAmount: _formData.ugstAmount,
        basicPrice: _formData.basicPrice,
        gstin: _formData.gstin,
        brokerCompany: _formData.brokerCompany,
        mainBroker: _formData.mainBroker,
        salesPersonName: _formData.salesPersonName,
        transferReceiptNo: _formData.transferReceiptNo,
      };

      const tRes = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(transferBody)
      });
      const tData = await tRes.json();
      if (!tRes.ok) throw new Error(tData.error || tData.message || 'Transfer failed');

      _showMsg('tr-buyer-msg', 'Transfer completed successfully!', true);
      setTimeout(() => {
        _view = 'search';
        _sellerData = null;
        _formData = {};
        _histPage = 1;
        _render();
        _loadHistory();
      }, 1800);

    } catch (e) {
      _showMsg('tr-buyer-msg', 'Error: ' + e.message, false);
      if (btn) { btn.disabled = false; btn.textContent = 'SAVE TRANSFER'; }
    }
  }

  // ── Transfer History ───────────────────────────────────────────────────────
  async function _loadHistory() {
    const histDiv = document.getElementById('tr-history-body');
    if (!histDiv) return;

    histDiv.innerHTML = '<tr><td colspan="10" style="color:#888;padding:8px">Loading...</td></tr>';
    const token = localStorage.getItem('rof-jwt') || '';
    const params = new URLSearchParams({ page: _histPage, pageSize: _HIST_PS });

    try {
      const res = await fetch('/api/transfers/list?' + params.toString(), {
        headers: { Authorization: 'Bearer ' + token }
      });
      const data = await res.json();
      const rows = data.data || [];
      const total = data.total || 0;

      const totalSpan = document.getElementById('tr-hist-total');
      if (totalSpan) totalSpan.textContent = total;

      if (!rows.length) {
        histDiv.innerHTML = '<tr><td colspan="10" style="color:#888;padding:8px">No transfer records.</td></tr>';
        _updateHistPager(0);
        return;
      }
      histDiv.innerHTML = rows.map((t, i) => `
<tr>
  <td>${(_histPage - 1) * _HIST_PS + i + 1}</td>
  <td>${_esc(t.transfer_no || '')}</td>
  <td>${_fmt(t.transfer_date)}</td>
  <td>${_esc(t.seller_name || '')}</td>
  <td>${_esc(t.buyer_name || '')}</td>
  <td>${_esc(t.unit_number || '')}</td>
  <td>${_esc(t.project_name || '')}</td>
  <td>${_esc(t.transfer_type || '')}</td>
  <td>${_num(t.transfer_amount_inr)}</td>
  <td>${_esc(t.broker_company || '')}</td>
</tr>`).join('');

      _updateHistPager(total);
    } catch (e) {
      histDiv.innerHTML = `<tr><td colspan="10" style="color:#a94442;padding:8px">Error: ${_esc(e.message)}</td></tr>`;
    }
  }

  function _updateHistPager(total) {
    const pages = Math.max(1, Math.ceil(total / _HIST_PS));
    const info = document.getElementById('tr-hist-pager-info');
    const prev = document.getElementById('tr-hist-prev');
    const next = document.getElementById('tr-hist-next');
    if (info) info.textContent = 'Page ' + _histPage + ' of ' + pages + ' (' + total + ' records)';
    if (prev) prev.disabled = _histPage <= 1;
    if (next) next.disabled = _histPage >= pages;
  }

  function _histPrev() {
    if (_histPage > 1) { _histPage--; _loadHistory(); }
  }
  function _histNext() { _histPage++; _loadHistory(); }

  // ── Full page HTML ─────────────────────────────────────────────────────────
  function _renderPage() {
    return TR_STYLES + `
<div class="tr-page">
  <div id="tr-content"></div>
  <div class="tr-history-section tr-card">
    <div class="tr-hdr">
      <span class="tr-hdr-title">TRANSFER HISTORY</span>
      <span style="color:#fff;font-size:12px">Total: <span id="tr-hist-total">0</span></span>
    </div>
    <div class="tr-body">
      <div class="tr-table-wrap">
        <table class="tr-table">
          <thead><tr>
            <th>#</th><th>Transfer No</th><th>Date</th><th>Seller</th><th>Buyer</th>
            <th>Unit</th><th>Project</th><th>Type</th><th>Amount (Rs.)</th><th>Broker</th>
          </tr></thead>
          <tbody id="tr-history-body">
            <tr><td colspan="10" style="color:#888;padding:8px">No records yet.</td></tr>
          </tbody>
        </table>
      </div>
      <div class="tr-pagination">
        <button id="tr-hist-prev" onclick="TransferApp.histPrev()" disabled>&#8592; Prev</button>
        <span id="tr-hist-pager-info">Page 1</span>
        <button id="tr-hist-next" onclick="TransferApp.histNext()">Next &#8594;</button>
      </div>
    </div>
  </div>
</div>`;
  }

  // ── Utils ──────────────────────────────────────────────────────────────────
  function _esc(s) {
    return String(s || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function _fmt(d) {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function _num(n) { return n != null ? Number(n).toLocaleString('en-IN') : ''; }
  function _round(n) { return Math.round(n * 100) / 100; }
  function _setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }
  function _showMsg(id, text, ok) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = 'tr-msg ' + (ok ? 'tr-msg-ok' : 'tr-msg-err');
    el.style.display = 'block';
  }

  // ── Boot ───────────────────────────────────────────────────────────────────
  async function _init() {
    const token = localStorage.getItem('rof-jwt') || '';
    try {
      const res = await fetch('/api/projects', { headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      _projects = data.projects || data.data || data || [];
    } catch (e) {
      console.error('TransferApp: projects load failed', e);
    }
    _view = 'search';
    _render();
    _loadHistory();
  }

  window.TransferApp = {
    search: _doSearch,
    selectSeller: _selectSeller,
    back() {
      if (_view === 'buyer') { _view = 'form'; _render(); _initForm(); }
      else { _view = 'search'; _sellerData = null; _formData = {}; _render(); _loadHistory(); }
    },
    calcTax: _calcTax,
    nextToBuyer: _nextToBuyer,
    saveTransfer: _saveTransfer,
    histPrev: _histPrev,
    histNext: _histNext,
  };

  Pages.transfers = async function(params) {
    const container = document.getElementById('content') || document.body;
    container.innerHTML = _renderPage();
    await _init();
  };

})();
