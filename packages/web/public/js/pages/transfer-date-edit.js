(() => {

  const TDE_STYLES = `<style id="tde-styles">
.tde-page { padding: 0; font-family: Arial, sans-serif; font-size: 13px; }
.tde-card { background: #fff; border: 1px solid #ddd; border-radius: 3px; margin-bottom: 10px; }
.tde-hdr {
  display: flex; justify-content: space-between; align-items: center;
  background: #1d3a6e; padding: 7px 12px; border-radius: 3px 3px 0 0;
}
.tde-hdr-title { color: #fff; font-size: 13px; font-weight: bold; letter-spacing: .3px; }
.tde-body { padding: 14px 16px 16px; }
.tde-filter-row {
  display: flex; align-items: flex-end; gap: 16px;
  margin-bottom: 16px; flex-wrap: wrap;
}
.tde-field { display: flex; flex-direction: column; gap: 3px; }
.tde-lbl { font-size: 11px; color: #555; white-space: nowrap; }
.tde-field select,
.tde-field input[type="text"] {
  padding: 5px 8px; border: 1px solid #ccc; border-radius: 3px;
  font-size: 13px; box-sizing: border-box;
}
.tde-field select           { min-width: 200px; }
.tde-field input[type="text"] { min-width: 150px; }
.tde-btn-fetch {
  background: #1d3a6e; color: #fff; border: none;
  padding: 7px 22px; border-radius: 3px; font-size: 13px;
  font-weight: bold; cursor: pointer; align-self: flex-end;
}
.tde-btn-fetch:hover    { background: #16305c; }
.tde-btn-fetch:disabled { opacity: .7; cursor: not-allowed; }
.tde-msg { margin-top: 8px; font-size: 13px; padding: 6px 10px; border-radius: 3px; }
.tde-msg-err { background: #f2dede; color: #a94442; border: 1px solid #ebccd1; }
.tde-table-wrap { overflow-x: auto; }
table.tde-tbl {
  width: 100%; border-collapse: collapse; font-size: 12px;
}
table.tde-tbl th {
  background: #1d3a6e; color: #fff; padding: 7px 8px; text-align: left;
  font-size: 11px; white-space: nowrap; border: 1px solid #14306a;
}
table.tde-tbl td {
  padding: 6px 8px; border: 1px solid #e0e0e0;
  white-space: nowrap; vertical-align: middle;
}
table.tde-tbl tr:nth-child(even) td { background: #f9f9f9; }
table.tde-tbl tr:hover td { background: #eef4ff; }
.tde-date-input {
  width: 140px; padding: 4px 6px; border: 1px solid #ccc;
  border-radius: 3px; font-size: 12px; box-sizing: border-box;
}
.tde-btn-save {
  background: #1d3a6e; color: #fff; border: none;
  padding: 4px 14px; border-radius: 3px; font-size: 12px;
  cursor: pointer; font-weight: bold;
}
.tde-btn-save:hover    { background: #16305c; }
.tde-btn-save:disabled { opacity: .7; cursor: not-allowed; }
.tde-inline-msg { font-size: 11px; margin-left: 6px; }
.tde-msg-ok  { color: #3c763d; }
.tde-msg-err-inline { color: #a94442; }
</style>`;

  let _transfers = [];

  function _renderPage() {
    return TDE_STYLES + `
<div class="tde-page">
  <div class="tde-card">
    <div class="tde-hdr">
      <span class="tde-hdr-title">TRANSFER DATE EDIT</span>
    </div>
    <div class="tde-body">
      <div class="tde-filter-row">
        <div class="tde-field">
          <span class="tde-lbl">* Project</span>
          <select id="tde-project">
            <option value="">&lt;--Select--&gt;</option>
          </select>
        </div>
        <div class="tde-field">
          <span class="tde-lbl">Registration No</span>
          <input type="text" id="tde-regno" placeholder="Search...">
        </div>
        <div class="tde-field">
          <span class="tde-lbl">First Name</span>
          <input type="text" id="tde-fname" placeholder="Search...">
        </div>
        <button class="tde-btn-fetch" id="tde-fetch-btn"
                onclick="TransferDateEdit.fetch()">FETCH</button>
      </div>
      <div id="tde-msg"></div>
    </div>
  </div>

  <div class="tde-card" id="tde-results-card" style="display:none">
    <div class="tde-hdr">
      <span class="tde-hdr-title">RESULTS</span>
    </div>
    <div class="tde-body">
      <div id="tde-count" style="font-size:13px;font-weight:bold;color:#333;margin-bottom:10px;"></div>
      <div class="tde-table-wrap">
        <table class="tde-tbl">
          <thead>
            <tr>
              <th>S.NO</th>
              <th>REG NO</th>
              <th>SELLER</th>
              <th>BUYER</th>
              <th>UNIT</th>
              <th>TRANSFER DATE</th>
              <th>APPLICATION DATE</th>
              <th>SAVE</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody id="tde-tbody"></tbody>
        </table>
      </div>
    </div>
  </div>
</div>`;
  }

  function _toDateInput(val) {
    if (!val) return '';
    var d = new Date(val);
    if (isNaN(d.getTime())) return '';
    var yyyy = d.getFullYear();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
  }

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _renderRows() {
    var tbody = document.getElementById('tde-tbody');
    if (!tbody) return;
    if (!_transfers.length) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#888;padding:20px">No records found.</td></tr>';
      return;
    }
    tbody.innerHTML = _transfers.map(function(r, i) {
      var tdVal = _toDateInput(r.transfer_date);
      var adVal = _toDateInput(r.application_date);
      return '<tr>'
        + '<td>' + (i + 1) + '</td>'
        + '<td>' + _esc(r.seller_reg_no || '') + '</td>'
        + '<td>' + _esc(r.seller_name   || '') + '</td>'
        + '<td>' + _esc(r.buyer_name    || '') + '</td>'
        + '<td>' + _esc(r.unit_number   || '') + '</td>'
        + '<td><input type="date" class="tde-date-input" id="tde-td-' + r.id + '" value="' + tdVal + '"></td>'
        + '<td><input type="date" class="tde-date-input" id="tde-ad-' + r.id + '" value="' + adVal + '"></td>'
        + '<td><button class="tde-btn-save" onclick="TransferDateEdit.save(\'' + r.id + '\')">SAVE</button></td>'
        + '<td><span class="tde-inline-msg" id="tde-msg-' + r.id + '"></span></td>'
        + '</tr>';
    }).join('');
  }

  async function _fetch() {
    var token     = localStorage.getItem('rof-jwt') || '';
    var projectId = (document.getElementById('tde-project') ? document.getElementById('tde-project').value : '').trim();
    var regNo     = (document.getElementById('tde-regno')   ? document.getElementById('tde-regno').value   : '').trim();
    var firstName = (document.getElementById('tde-fname')   ? document.getElementById('tde-fname').value   : '').trim();

    var btn = document.getElementById('tde-fetch-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Fetching...'; }
    _clearMsg();

    try {
      var qs = new URLSearchParams();
      if (projectId) qs.set('projectId', projectId);
      var search = firstName || regNo;
      if (search) qs.set('search', search);
      qs.set('pageSize', '100');

      var res = await fetch('/api/transfers/list?' + qs.toString(), {
        headers: { Authorization: 'Bearer ' + token }
      });
      var data = await res.json();
      if (!res.ok) { _showMsg(data.message || data.error || 'Failed to fetch.'); return; }

      _transfers = data.data || [];
      var card = document.getElementById('tde-results-card');
      if (card) card.style.display = '';
      var cnt = document.getElementById('tde-count');
      if (cnt) cnt.textContent = _transfers.length + ' record(s) found';
      _renderRows();
    } catch (e) {
      _showMsg('Error: ' + e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'FETCH'; }
    }
  }

  async function _save(transferId) {
    var tdInput = document.getElementById('tde-td-' + transferId);
    var adInput = document.getElementById('tde-ad-' + transferId);
    var msgEl   = document.getElementById('tde-msg-' + transferId);

    if (!tdInput) return;

    var tdVal = (tdInput.value || '').trim();
    var adVal = (adInput ? adInput.value : '').trim();

    if (!tdVal) {
      if (msgEl) { msgEl.className = 'tde-inline-msg tde-msg-err-inline'; msgEl.textContent = 'Transfer Date required'; }
      return;
    }

    var token = localStorage.getItem('rof-jwt') || '';
    try {
      var res = await fetch('/api/transfers/' + transferId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          transfer_date:    tdVal,
          application_date: adVal || null
        })
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');

      if (msgEl) {
        msgEl.className = 'tde-inline-msg tde-msg-ok';
        msgEl.textContent = '✓ Saved';
        setTimeout(function() { msgEl.textContent = ''; }, 2000);
      }
      var rec = _transfers.find(function(t) { return t.id === transferId; });
      if (rec) {
        rec.transfer_date    = data.data.transfer_date;
        rec.application_date = data.data.application_date;
      }
    } catch (e) {
      if (msgEl) { msgEl.className = 'tde-inline-msg tde-msg-err-inline'; msgEl.textContent = 'Error: ' + e.message; }
    }
  }

  function _showMsg(text) {
    var el = document.getElementById('tde-msg');
    if (!el) return;
    el.textContent = text;
    el.className = 'tde-msg tde-msg-err';
  }

  function _clearMsg() {
    var el = document.getElementById('tde-msg');
    if (el) { el.textContent = ''; el.className = 'tde-msg'; }
  }

  async function _init() {
    var token = localStorage.getItem('rof-jwt') || '';
    try {
      var res  = await fetch('/api/projects', { headers: { Authorization: 'Bearer ' + token } });
      var data = await res.json();
      var sel  = document.getElementById('tde-project');
      if (!sel) return;
      (data.projects || data.data || data || []).forEach(function(p) {
        var o = document.createElement('option');
        o.value = p.id;
        o.textContent = p.name || p.project_name;
        sel.appendChild(o);
      });
    } catch (e) {
      console.error('TransferDateEdit: failed to load projects', e);
    }
  }

  window.TransferDateEdit = { fetch: _fetch, save: _save };

  Pages.transferDateEdit = function(params) {
    var container = document.getElementById('content') || document.body;
    container.innerHTML = _renderPage();
    _init();
  };

})();
