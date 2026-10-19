(() => {

  const TRD_STYLES = `<style id="trd-styles">
.trd-page { padding:0; font-size:13px; max-width:1180px; margin:0 auto }
.trd-card { margin-bottom:16px; background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:hidden }
.trd-hdr { display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; background:var(--teal-bg); padding:14px 18px; border-bottom:1px solid var(--border) }
.trd-hdr-title { color:var(--text); font-size:12px; font-weight:600; letter-spacing:.6px; text-transform:uppercase }
.trd-body { padding:18px }
.trd-filter-row { display:flex; align-items:flex-end; gap:16px 18px; margin-bottom:16px; flex-wrap:wrap }
.trd-field { display:flex; flex-direction:column; gap:6px }
.trd-lbl { font-size:11px; color:var(--text2); letter-spacing:.3px; white-space:nowrap }
.trd-field select, .trd-field input[type="text"], .trd-field input[type="date"] { padding:9px 12px; border:1px solid var(--border2); border-radius:8px; font-size:13px; background:var(--surface); color:var(--text); min-height:38px; box-sizing:border-box;  }
.trd-field select:focus, .trd-field input[type="text"]:focus, .trd-field input[type="date"]:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg); outline:none }
.trd-field select { min-width:220px }
.trd-field input[type="text"] { min-width:170px }
.trd-field input[type="date"] { min-width:150px }
.trd-btn-fetch { background:var(--teal); color:#fff; border:none; padding:9px 26px; border-radius:8px; font-size:12.5px; font-weight:600; cursor:pointer; min-height:36px }
.trd-btn-fetch:hover { filter:brightness(.92) }
.trd-btn-fetch:disabled { opacity:.65; cursor:not-allowed }
.trd-btn-fetch { align-self:flex-end }
.trd-btn-icon { background:var(--surface); color:var(--text2); border:1px solid var(--border2); border-radius:8px; padding:6px 14px; font-size:13px; cursor:pointer }
.trd-btn-icon:hover { background:var(--surface2) }
.trd-result-row { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:12px }
.trd-result-count { font-size:13px; font-weight:600; color:var(--text) }
.trd-btn-group { display:flex; gap:8px }
.trd-table-wrap { overflow-x:auto; border:1px solid var(--border2); border-radius:10px }
table.trd-tbl { width:100%; border-collapse:collapse; font-size:12.5px }
table.trd-tbl th { background:var(--surface2); color:var(--text3); padding:10px 14px; text-align:left; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; white-space:nowrap; border-bottom:1px solid var(--border2) }
table.trd-tbl td { padding:10px 14px; border-bottom:1px solid var(--border); color:var(--text); white-space:nowrap; vertical-align:top; }
table.trd-tbl tbody tr:last-child td { border-bottom:none }
table.trd-tbl tbody tr:hover td { background:var(--surface2) }
.trd-link, .trd-letter-link { color:var(--teal); cursor:pointer; text-decoration:none; font-weight:500 }
.trd-link:hover, .trd-letter-link:hover { text-decoration:underline }
.trd-msg { margin-top:12px; padding:8px 12px; border-radius:8px; font-size:12.5px;  }
.trd-msg-ok { background:var(--teal-bg); color:var(--teal); border:1px solid var(--teal) }
.trd-msg-err { background:var(--red-bg); color:var(--red); border:1px solid var(--red) }
@media print {
  .trd-filter-card, .trd-btn-group, .trd-btn-fetch { display:none !important }
  .trd-card { border:none }
  table.trd-tbl th { -webkit-print-color-adjust:exact; print-color-adjust:exact }
}
</style>`;

  let _rows = [];

  function _renderPage() {
    return TRD_STYLES + `
<div class="trd-page">
  <div class="trd-card trd-filter-card">
    <div class="trd-hdr">
      <span class="trd-hdr-title">TRANSFER DETAIL</span>
    </div>
    <div class="trd-body">
      <div class="trd-filter-row">
        <div class="trd-field">
          <span class="trd-lbl">* Project</span>
          <select id="trd-project">
            <option value="">&lt;--Select--&gt;</option>
          </select>
        </div>
        <div class="trd-field">
          <span class="trd-lbl">Registration No</span>
          <input type="text" id="trd-regno" placeholder="Search...">
        </div>
        <div class="trd-field">
          <span class="trd-lbl">First Name</span>
          <input type="text" id="trd-fname" placeholder="Search...">
        </div>
        <div class="trd-field">
          <span class="trd-lbl">Unit Address</span>
          <input type="text" id="trd-unit" placeholder="Unit no...">
        </div>
        <div class="trd-field">
          <span class="trd-lbl">From Date</span>
          <input type="date" id="trd-from">
        </div>
        <div class="trd-field">
          <span class="trd-lbl">To Date</span>
          <input type="date" id="trd-to">
        </div>
        <button class="trd-btn-fetch" id="trd-fetch-btn"
                onclick="TransferDetail.fetch()">FETCH</button>
      </div>
      <div id="trd-msg"></div>
    </div>
  </div>

  <div class="trd-card" id="trd-results-card" style="display:none">
    <div class="trd-hdr">
      <span class="trd-hdr-title">RESULTS</span>
      <div class="trd-btn-group">
        <button class="trd-btn-icon" onclick="window.print()">&#128424; Print</button>
        <button class="trd-btn-icon" onclick="TransferDetail.downloadCSV()">&#11015; CSV</button>
      </div>
    </div>
    <div class="trd-body">
      <div class="trd-result-row">
        <span class="trd-result-count" id="trd-count"></span>
      </div>
      <div class="trd-table-wrap">
        <table class="trd-tbl">
          <thead>
            <tr>
              <th>S.NO</th>
              <th>REG NO</th>
              <th>APPLICANT NAME (SELLER)</th>
              <th>TRANSFER APPLICANT (BUYER)</th>
              <th>APPLICATION DATE</th>
              <th>TRANSFER DATE</th>
              <th>ADDRESS</th>
              <th>TRANSFER AMOUNT</th>
              <th>STAX AMOUNT</th>
              <th>CGST</th>
              <th>SGST</th>
              <th>IGST</th>
              <th>UGST</th>
              <th>TOTAL AMOUNT</th>
              <th>RECEIPT NO</th>
              <th>TRANSFER LETTER</th>
            </tr>
          </thead>
          <tbody id="trd-tbody"></tbody>
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

  function _fmtNum(n) {
    if (n == null || n === '') return '';
    const num = Number(n);
    if (isNaN(num)) return '';
    return Math.round(num).toLocaleString('en-IN');
  }

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _renderRows() {
    const tbody = document.getElementById('trd-tbody');
    if (!tbody) return;
    if (!_rows.length) {
      tbody.innerHTML = '<tr><td colspan="16" style="text-align:center;color:var(--text3);padding:36px">No records found.</td></tr>';
      return;
    }
    tbody.innerHTML = _rows.map(function(r, i) {
      const total = (Number(r.transfer_amount_inr) || 0)
                  + (Number(r.stax_amount)          || 0)
                  + (Number(r.cgst_amount)           || 0)
                  + (Number(r.sgst_amount)           || 0)
                  + (Number(r.igst_amount)           || 0)
                  + (Number(r.ugst_amount)           || 0);
      return '<tr>'
        + '<td>' + (i + 1) + '</td>'
        + '<td>' + _esc(r.seller_reg_no || '') + '</td>'
        + '<td>' + _esc(r.seller_name   || '') + '</td>'
        + '<td>' + _esc(r.buyer_name    || '') + '</td>'
        + '<td>' + _fmtDate(r.application_date) + '</td>'
        + '<td>' + _fmtDate(r.transfer_date)    + '</td>'
        + '<td>' + _esc(r.unit_number   || '') + '</td>'
        + '<td style="text-align:right">' + _fmtNum(r.transfer_amount_inr) + '</td>'
        + '<td style="text-align:right">' + _fmtNum(r.stax_amount)          + '</td>'
        + '<td style="text-align:right">' + _fmtNum(r.cgst_amount)           + '</td>'
        + '<td style="text-align:right">' + _fmtNum(r.sgst_amount)           + '</td>'
        + '<td style="text-align:right">' + _fmtNum(r.igst_amount)           + '</td>'
        + '<td style="text-align:right">' + _fmtNum(r.ugst_amount)           + '</td>'
        + '<td style="text-align:right">' + _fmtNum(total)                   + '</td>'
        + '<td>' + _esc(r.transfer_receipt_no || '') + '</td>'
        + '<td><a class="trd-letter-link" href="#"'
        +   ' onclick="event.preventDefault();TransferDetail.openLetter(\'' + r.id + '\')"'
        +   '>Letter</a></td>'
        + '</tr>';
    }).join('');
  }

  async function _fetch() {
    const token       = localStorage.getItem('rof-jwt') || '';
    const projectId   = (document.getElementById('trd-project') ? document.getElementById('trd-project').value : '').trim();
    const regNo       = (document.getElementById('trd-regno')   ? document.getElementById('trd-regno').value   : '').trim();
    const firstName   = (document.getElementById('trd-fname')   ? document.getElementById('trd-fname').value   : '').trim();
    const unitAddress = (document.getElementById('trd-unit')    ? document.getElementById('trd-unit').value    : '').trim();

    const btn = document.getElementById('trd-fetch-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Fetching...'; }
    _clearMsg();

    try {
      const qs = new URLSearchParams();
      if (projectId) qs.set('projectId', projectId);
      const search = firstName || regNo || unitAddress;
      if (search) qs.set('search', search);
      qs.set('page',     '1');
      qs.set('pageSize', '100');

      const res = await fetch('/api/transfers/list?' + qs.toString(), {
        headers: { Authorization: 'Bearer ' + token }
      });
      const data = await res.json();
      if (!res.ok) { _showMsg(data.message || data.error || 'Failed to fetch.'); return; }

      _rows = data.data || [];
      const card = document.getElementById('trd-results-card');
      if (card) card.style.display = '';
      const cnt = document.getElementById('trd-count');
      if (cnt) cnt.textContent = _rows.length + ' record(s) found';
      _renderRows();
    } catch (e) {
      _showMsg('Error: ' + e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'FETCH'; }
    }
  }

  function _showMsg(text) {
    const el = document.getElementById('trd-msg');
    if (!el) return;
    el.textContent = text;
    el.className = 'trd-msg trd-msg-err';
  }

  function _clearMsg() {
    const el = document.getElementById('trd-msg');
    if (el) { el.textContent = ''; el.className = 'trd-msg'; }
  }

  function _downloadCSV() {
    if (!_rows.length) return;
    const headers = [
      'S.NO', 'REG NO', 'APPLICANT NAME (SELLER)', 'TRANSFER APPLICANT (BUYER)',
      'APPLICATION DATE', 'TRANSFER DATE', 'ADDRESS', 'TRANSFER AMOUNT',
      'STAX AMOUNT', 'CGST', 'SGST', 'IGST', 'UGST', 'TOTAL AMOUNT', 'RECEIPT NO'
    ];
    const esc = function(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    const lines = [headers.map(esc).join(',')];
    _rows.forEach(function(r, i) {
      const total = (Number(r.transfer_amount_inr) || 0)
                  + (Number(r.stax_amount)          || 0)
                  + (Number(r.cgst_amount)           || 0)
                  + (Number(r.sgst_amount)           || 0)
                  + (Number(r.igst_amount)           || 0)
                  + (Number(r.ugst_amount)           || 0);
      lines.push([
        i + 1,
        r.seller_reg_no      || '',
        r.seller_name        || '',
        r.buyer_name         || '',
        r.application_date   ? new Date(r.application_date).toLocaleDateString('en-IN') : '',
        r.transfer_date      ? new Date(r.transfer_date).toLocaleDateString('en-IN')    : '',
        r.unit_number        || '',
        r.transfer_amount_inr || 0,
        r.stax_amount         || 0,
        r.cgst_amount         || 0,
        r.sgst_amount         || 0,
        r.igst_amount         || 0,
        r.ugst_amount         || 0,
        total,
        r.transfer_receipt_no || ''
      ].map(esc).join(','));
    });
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'transfer-detail.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function _init() {
    const token = localStorage.getItem('rof-jwt') || '';
    try {
      const res  = await fetch('/api/projects', { headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      const sel  = document.getElementById('trd-project');
      if (!sel) return;
      (data.projects || data.data || data || []).forEach(function(p) {
        const o      = document.createElement('option');
        o.value      = p.id;
        o.textContent = p.name || p.project_name;
        sel.appendChild(o);
      });
    } catch (e) {
      console.error('TransferDetail: failed to load projects', e);
    }
  }

  function _openLetter(id) {
    const tok = localStorage.getItem('rof-jwt') || '';
    window.open(
      '/api/transfers/' + id + '/letter?token=' + encodeURIComponent(tok),
      '_blank'
    );
  }

  window.TransferDetail = { fetch: _fetch, downloadCSV: _downloadCSV, openLetter: _openLetter };

  Pages.transferDetail = function(params) {
    const container = document.getElementById('content') || document.body;
    container.innerHTML = _renderPage();
    _init();
  };

})();
