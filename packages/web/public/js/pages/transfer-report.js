(() => {

  const TRR_STYLES = `<style id="trr-styles">
.trr-page { padding:0; font-size:13px; max-width:1180px; margin:0 auto }
.trr-card { margin-bottom:16px; background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:hidden }
.trr-hdr { display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; background:var(--teal-bg); padding:14px 18px; border-bottom:1px solid var(--border) }
.trr-hdr-title { color:var(--text); font-size:12px; font-weight:600; letter-spacing:.6px; text-transform:uppercase }
.trr-body { padding:18px }
.trr-filter-row { display:flex; align-items:flex-end; gap:16px 18px; margin-bottom:16px; flex-wrap:wrap }
.trr-field { display:flex; flex-direction:column; gap:6px }
.trr-lbl { font-size:11px; color:var(--text2); letter-spacing:.3px; white-space:nowrap }
.trr-field select, .trr-field input[type="text"], .trr-field input[type="date"] { padding:9px 12px; border:1px solid var(--border2); border-radius:8px; font-size:13px; background:var(--surface); color:var(--text); min-height:38px; box-sizing:border-box;  }
.trr-field select:focus, .trr-field input[type="text"]:focus, .trr-field input[type="date"]:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg); outline:none }
.trr-field select { min-width:220px }
.trr-field input[type="text"] { min-width:170px }
.trr-field input[type="date"] { min-width:150px }
.trr-btn-fetch { background:var(--teal); color:#fff; border:none; padding:9px 26px; border-radius:8px; font-size:12.5px; font-weight:600; cursor:pointer; min-height:36px }
.trr-btn-fetch:hover { filter:brightness(.92) }
.trr-btn-fetch:disabled { opacity:.65; cursor:not-allowed }
.trr-btn-fetch { align-self:flex-end }
.trr-btn-icon { background:var(--surface); color:var(--text2); border:1px solid var(--border2); border-radius:8px; padding:6px 14px; font-size:13px; cursor:pointer }
.trr-btn-icon:hover { background:var(--surface2) }
.trr-result-row { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:12px }
.trr-result-count { font-size:13px; font-weight:600; color:var(--text) }
.trr-btn-group { display:flex; gap:8px }
.trr-table-wrap { overflow-x:auto; border:1px solid var(--border2); border-radius:10px }
table.trr-tbl { width:100%; border-collapse:collapse; font-size:12.5px }
table.trr-tbl th { background:var(--surface2); color:var(--text3); padding:10px 14px; text-align:left; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; white-space:nowrap; border-bottom:1px solid var(--border2) }
table.trr-tbl td { padding:10px 14px; border-bottom:1px solid var(--border); color:var(--text); white-space:nowrap; vertical-align:top; }
table.trr-tbl tbody tr:last-child td { border-bottom:none }
table.trr-tbl tbody tr:hover td { background:var(--surface2) }
.trr-link, .trr-letter-link { color:var(--teal); cursor:pointer; text-decoration:none; font-weight:500 }
.trr-link:hover, .trr-letter-link:hover { text-decoration:underline }
.trr-msg { margin-top:12px; padding:8px 12px; border-radius:8px; font-size:12.5px;  }
.trr-msg-ok { background:var(--teal-bg); color:var(--teal); border:1px solid var(--teal) }
.trr-msg-err { background:var(--red-bg); color:var(--red); border:1px solid var(--red) }
@media print {
  .trr-filter-card, .trr-btn-group, .trr-btn-fetch { display:none !important }
  .trr-card { border:none }
  table.trr-tbl th { -webkit-print-color-adjust:exact; print-color-adjust:exact }
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
              <th>DETAIL</th>
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

  function _buildRegNo(r) {
    const base = r.registration_no || '';
    const count = r.no_of_transfers || 0;
    if (!base) return '';
    if (count === 0) return base;
    const suffixes = [];
    for (let i = 1; i <= count; i++) suffixes.push('T' + i);
    return base + ' [' + suffixes.join(',') + ']';
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
      tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;color:var(--text3);padding:36px">No records found.</td></tr>';
      return;
    }
    tbody.innerHTML = _rows.map((r, i) => {
      const cid = _esc(r.consumer_id || '');
      return `<tr>
        <td>${i + 1}</td>
        <td>${_fmtDate(r.booking_date)}</td>
        <td>${_esc(_buildRegNo(r))}</td>
        <td><a href="/api/consumers/${cid}/applicant-file?token=1" target="_blank" style="color:var(--teal);text-decoration:none;font-weight:500;cursor:pointer" title="View Applicant File">${_esc(r.name)}</a></td>
        <td>${_esc(r.floor)}</td>
        <td>${_esc(r.unit_number)}</td>
        <td>${_esc(r.payment_plan)}</td>
        <td>${_esc(r.broker_company)}</td>
        <td>${r.super_area_sqft != null ? r.super_area_sqft : ''}</td>
        <td>${r.base_price_inr != null ? Number(r.base_price_inr).toLocaleString('en-IN') : ''}</td>
        <td style="text-align:center">${r.no_of_transfers}</td>
        <td><a href="#"
          onclick="event.preventDefault();closeAllNavDropdowns && closeAllNavDropdowns();Router.navigate('/transfer-detail')"
          style="color:var(--teal);text-decoration:none;font-weight:500;font-size:12px">Detail</a></td>
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
