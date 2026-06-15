(() => {

  const TRD_STYLES = `<style id="trd-styles">
.trd-page { padding: 0; font-family: Arial, sans-serif; font-size: 13px; }
.trd-card { background: #fff; border: 1px solid #ddd; border-radius: 3px; margin-bottom: 10px; }
.trd-hdr {
  display: flex; justify-content: space-between; align-items: center;
  background: #1d3a6e; padding: 7px 12px; border-radius: 3px 3px 0 0;
}
.trd-hdr-title { color: #fff; font-size: 13px; font-weight: bold; letter-spacing: .3px; }
.trd-body { padding: 14px 16px 16px; }
.trd-filter-row {
  display: flex; align-items: flex-end; gap: 16px;
  margin-bottom: 16px; flex-wrap: wrap;
}
.trd-field { display: flex; flex-direction: column; gap: 3px; }
.trd-lbl { font-size: 11px; color: #555; white-space: nowrap; }
.trd-field select,
.trd-field input[type="text"],
.trd-field input[type="date"] {
  padding: 5px 8px; border: 1px solid #ccc; border-radius: 3px;
  font-size: 13px; box-sizing: border-box;
}
.trd-field select           { min-width: 200px; }
.trd-field input[type="text"] { min-width: 150px; }
.trd-field input[type="date"] { min-width: 140px; }
.trd-btn-fetch {
  background: #1d3a6e; color: #fff; border: none;
  padding: 7px 22px; border-radius: 3px; font-size: 13px;
  font-weight: bold; cursor: pointer; align-self: flex-end;
}
.trd-btn-fetch:hover    { background: #16305c; }
.trd-btn-fetch:disabled { opacity: .7; cursor: not-allowed; }
.trd-btn-icon {
  background: #fff; border: 1px solid #ccc; border-radius: 3px;
  padding: 5px 12px; font-size: 13px; cursor: pointer;
}
.trd-btn-icon:hover { background: #f0f0f0; }
.trd-result-row {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 10px;
}
.trd-result-count { font-size: 13px; font-weight: bold; color: #333; }
.trd-btn-group { display: flex; gap: 8px; }
.trd-table-wrap { overflow-x: auto; }
table.trd-tbl {
  width: 100%; border-collapse: collapse; font-size: 12px;
}
table.trd-tbl th {
  background: #1d3a6e; color: #fff; padding: 7px 8px; text-align: left;
  font-size: 11px; white-space: nowrap; border: 1px solid #14306a;
}
table.trd-tbl td {
  padding: 6px 8px; border: 1px solid #e0e0e0;
  white-space: nowrap; vertical-align: top;
}
table.trd-tbl tr:nth-child(even) td { background: #f9f9f9; }
table.trd-tbl tr:hover td { background: #eef4ff; }
.trd-letter-link { color: #1d3a6e; cursor: pointer; text-decoration: underline; }
.trd-msg { margin-top: 8px; font-size: 13px; padding: 6px 10px; border-radius: 3px; }
.trd-msg-err { background: #f2dede; color: #a94442; border: 1px solid #ebccd1; }
@media print {
  .trd-filter-card, .trd-btn-group, .trd-btn-fetch { display: none !important; }
  .trd-card { border: none; }
  table.trd-tbl th {
    background: #1d3a6e !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
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
      tbody.innerHTML = '<tr><td colspan="16" style="text-align:center;color:#888;padding:20px">No records found.</td></tr>';
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
