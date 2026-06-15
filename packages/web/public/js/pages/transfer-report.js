(() => {

  const TRR_STYLES = `<style id="trr-styles">
.trr-page { padding: 0; font-family: Arial, sans-serif; font-size: 13px; }
.trr-card { background: #fff; border: 1px solid #ddd; border-radius: 3px; margin-bottom: 10px; }
.trr-hdr {
  display: flex; justify-content: space-between; align-items: center;
  background: #1d3a6e; padding: 7px 12px; border-radius: 3px 3px 0 0;
}
.trr-hdr-title { color: #fff; font-size: 13px; font-weight: bold; letter-spacing: .3px; }
.trr-body { padding: 14px 16px 16px; }
.trr-filter-row {
  display: flex; align-items: flex-end; gap: 16px;
  margin-bottom: 16px; flex-wrap: wrap;
}
.trr-field { display: flex; flex-direction: column; gap: 3px; }
.trr-lbl { font-size: 11px; color: #555; white-space: nowrap; }
.trr-field select,
.trr-field input[type="text"] {
  padding: 5px 8px; border: 1px solid #ccc; border-radius: 3px;
  font-size: 13px; box-sizing: border-box;
}
.trr-field select    { min-width: 200px; }
.trr-field input[type="text"] { min-width: 150px; }
.trr-btn-fetch {
  background: #1d3a6e; color: #fff; border: none;
  padding: 7px 22px; border-radius: 3px; font-size: 13px;
  font-weight: bold; cursor: pointer; align-self: flex-end;
}
.trr-btn-fetch:hover     { background: #16305c; }
.trr-btn-fetch:disabled  { opacity: .7; cursor: not-allowed; }
.trr-btn-icon {
  background: #fff; border: 1px solid #ccc; border-radius: 3px;
  padding: 5px 12px; font-size: 13px; cursor: pointer;
}
.trr-btn-icon:hover { background: #f0f0f0; }
.trr-result-row {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 10px;
}
.trr-result-count { font-size: 13px; font-weight: bold; color: #333; }
.trr-btn-group { display: flex; gap: 8px; }
.trr-table-wrap { overflow-x: auto; }
table.trr-tbl {
  width: 100%; border-collapse: collapse; font-size: 12px;
}
table.trr-tbl th {
  background: #1d3a6e; color: #fff; padding: 7px 8px; text-align: left;
  font-size: 11px; white-space: nowrap; border: 1px solid #14306a;
}
table.trr-tbl td {
  padding: 6px 8px; border: 1px solid #e0e0e0;
  white-space: nowrap; vertical-align: top;
}
table.trr-tbl tr:nth-child(even) td { background: #f9f9f9; }
table.trr-tbl tr:hover td { background: #eef4ff; }
.trr-link { color: #1d3a6e; cursor: pointer; text-decoration: underline; }
.trr-msg { margin-top: 8px; font-size: 13px; padding: 6px 10px; border-radius: 3px; }
.trr-msg-err { background: #f2dede; color: #a94442; border: 1px solid #ebccd1; }
@media print {
  .trr-filter-card, .trr-btn-group, .trr-btn-fetch { display: none !important; }
  .trr-card { border: none; }
  table.trr-tbl th {
    background: #1d3a6e !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
</style>`;

  let _rows = [];

  function _renderPage() {
    return TRR_STYLES + `
<div class="trr-page">
  <div class="trr-card trr-filter-card">
    <div class="trr-hdr">
      <span class="trr-hdr-title">TRANSFER REPORT</span>
    </div>
    <div class="trr-body">
      <div class="trr-filter-row">
        <div class="trr-field">
          <span class="trr-lbl">* Project</span>
          <select id="trr-project">
            <option value="">&lt;--Select--&gt;</option>
          </select>
        </div>
        <div class="trr-field">
          <span class="trr-lbl">Registration No</span>
          <input type="text" id="trr-regno" placeholder="Search...">
        </div>
        <div class="trr-field">
          <span class="trr-lbl">First Name</span>
          <input type="text" id="trr-fname" placeholder="Search...">
        </div>
        <div class="trr-field">
          <span class="trr-lbl">Unit Address</span>
          <input type="text" id="trr-unit" placeholder="Unit no...">
        </div>
        <button class="trr-btn-fetch" id="trr-fetch-btn"
                onclick="TransferReport.fetch()">FETCH</button>
      </div>
      <div id="trr-msg"></div>
    </div>
  </div>

  <div class="trr-card" id="trr-results-card" style="display:none">
    <div class="trr-hdr">
      <span class="trr-hdr-title">RESULTS</span>
      <div class="trr-btn-group">
        <button class="trr-btn-icon" onclick="window.print()">&#128424; Print</button>
        <button class="trr-btn-icon" onclick="TransferReport.downloadCSV()">&#11015; CSV</button>
      </div>
    </div>
    <div class="trr-body">
      <div class="trr-result-row">
        <span class="trr-result-count" id="trr-count"></span>
      </div>
      <div class="trr-table-wrap">
        <table class="trr-tbl">
          <thead>
            <tr>
              <th>S.NO</th>
              <th>REGISTRATION DATE</th>
              <th>REG NO</th>
              <th>NAME</th>
              <th>FLOOR</th>
              <th>UNIT ADDRESS</th>
              <th>PAYMENT PLAN</th>
              <th>BROKER</th>
              <th>AREA (Sq.Ft)</th>
              <th>RATE (Rs.)</th>
              <th>NO. OF TRANSFER</th>
            </tr>
          </thead>
          <tbody id="trr-tbody"></tbody>
        </table>
      </div>
    </div>
  </div>
</div>`;
  }

  function _fmtDate(val) {
    if (!val) return '';
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return dd + '/' + mm + '/' + d.getFullYear();
  }

  function _buildRegNo(row) {
    const base = row.registration_no || '';
    const nos = (row.transfer_nos || '').split(',').filter(Boolean);
    if (!nos.length) return base;
    const suffix = nos.map((_, i) => 'T' + (i + 1)).join(',');
    return base + ' [' + suffix + ']';
  }

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _renderRows() {
    const tbody = document.getElementById('trr-tbody');
    if (!tbody) return;
    if (!_rows.length) {
      tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:#888;padding:20px">No records found.</td></tr>';
      return;
    }
    tbody.innerHTML = _rows.map((r, i) => {
      const cid = _esc(r.consumer_id || '');
      return `<tr>
        <td>${i + 1}</td>
        <td>${_fmtDate(r.booking_date)}</td>
        <td>${_esc(_buildRegNo(r))}</td>
        <td><span class="trr-link" onclick="Router.navigate('/consumer',{id:'${cid}'})">${_esc(r.name)}</span></td>
        <td>${_esc(r.floor)}</td>
        <td>${_esc(r.unit_number)}</td>
        <td>${_esc(r.payment_plan)}</td>
        <td>${_esc(r.broker_company)}</td>
        <td>${r.super_area_sqft != null ? r.super_area_sqft : ''}</td>
        <td>${r.base_price_inr != null ? Number(r.base_price_inr).toLocaleString('en-IN') : ''}</td>
        <td style="text-align:center">${r.no_of_transfers}</td>
      </tr>`;
    }).join('');
  }

  async function _fetch() {
    const token = localStorage.getItem('rof-jwt') || '';
    const projectId    = (document.getElementById('trr-project')?.value  || '').trim();
    const registrationNo = (document.getElementById('trr-regno')?.value  || '').trim();
    const firstName    = (document.getElementById('trr-fname')?.value    || '').trim();
    const unitAddress  = (document.getElementById('trr-unit')?.value     || '').trim();

    const btn = document.getElementById('trr-fetch-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Fetching...'; }
    _clearMsg();

    try {
      const qs = new URLSearchParams();
      if (projectId)      qs.set('projectId',      projectId);
      if (registrationNo) qs.set('registrationNo', registrationNo);
      if (firstName)      qs.set('firstName',      firstName);
      if (unitAddress)    qs.set('unitAddress',     unitAddress);

      const res = await fetch('/api/transfers/report?' + qs.toString(), {
        headers: { Authorization: 'Bearer ' + token }
      });
      const data = await res.json();
      if (!res.ok) { _showMsg(data.message || data.error || 'Failed to fetch.'); return; }

      _rows = data.data || [];
      const card = document.getElementById('trr-results-card');
      if (card) card.style.display = '';
      const cnt = document.getElementById('trr-count');
      if (cnt) cnt.textContent = _rows.length + ' record(s) found';
      _renderRows();
    } catch (e) {
      _showMsg('Error: ' + e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'FETCH'; }
    }
  }

  function _showMsg(text) {
    const el = document.getElementById('trr-msg');
    if (!el) return;
    el.textContent = text;
    el.className = 'trr-msg trr-msg-err';
  }

  function _clearMsg() {
    const el = document.getElementById('trr-msg');
    if (el) { el.textContent = ''; el.className = 'trr-msg'; }
  }

  function _downloadCSV() {
    if (!_rows.length) return;
    const headers = [
      'S.NO','REGISTRATION DATE','REG NO','NAME',
      'FLOOR','UNIT ADDRESS','PAYMENT PLAN','BROKER',
      'AREA (Sq.Ft)','RATE (Rs.)','NO. OF TRANSFER'
    ];
    const esc = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const lines = [headers.map(esc).join(',')];
    _rows.forEach((r, i) => {
      lines.push([
        i + 1,
        _fmtDate(r.booking_date),
        _buildRegNo(r),
        r.name || '',
        r.floor || '',
        r.unit_number || '',
        r.payment_plan || '',
        r.broker_company || '',
        r.super_area_sqft != null ? r.super_area_sqft : '',
        r.base_price_inr != null ? r.base_price_inr : '',
        r.no_of_transfers
      ].map(esc).join(','));
    });
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transfer-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function _init() {
    const token = localStorage.getItem('rof-jwt') || '';
    try {
      const res = await fetch('/api/projects', { headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      const sel = document.getElementById('trr-project');
      if (!sel) return;
      (data.projects || data.data || data || []).forEach(p => {
        const o = document.createElement('option');
        o.value = p.id;
        o.textContent = p.name || p.project_name;
        sel.appendChild(o);
      });
    } catch (e) {
      console.error('TransferReport: failed to load projects', e);
    }
  }

  window.TransferReport = { fetch: _fetch, downloadCSV: _downloadCSV };

  Pages.transferReport = function(params) {
    const container = document.getElementById('content') || document.body;
    container.innerHTML = _renderPage();
    _init();
  };

})();
