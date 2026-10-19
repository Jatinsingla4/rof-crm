(() => {

  const TDE_STYLES = `<style id="tde-styles">
.tde-page { padding:0; font-size:13px; max-width:1180px; margin:0 auto }
.tde-card { margin-bottom:16px; background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:hidden }
.tde-hdr { display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; background:var(--teal-bg); padding:14px 18px; border-bottom:1px solid var(--border) }
.tde-hdr-title { color:var(--text); font-size:12px; font-weight:600; letter-spacing:.6px; text-transform:uppercase }
.tde-body { padding:18px }
.tde-filter-row { display:flex; align-items:flex-end; gap:16px 18px; margin-bottom:16px; flex-wrap:wrap }
.tde-field { display:flex; flex-direction:column; gap:6px }
.tde-lbl { font-size:11px; color:var(--text2); letter-spacing:.3px; white-space:nowrap }
.tde-field select, .tde-field input[type="text"] { padding:9px 12px; border:1px solid var(--border2); border-radius:8px; font-size:13px; background:var(--surface); color:var(--text); min-height:38px; box-sizing:border-box;  }
.tde-field select:focus, .tde-field input[type="text"]:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg); outline:none }
.tde-field select { min-width:220px }
.tde-field input[type="text"] { min-width:170px }
.tde-btn-fetch { background:var(--teal); color:#fff; border:none; padding:9px 26px; border-radius:8px; font-size:12.5px; font-weight:600; cursor:pointer; min-height:36px }
.tde-btn-fetch:hover { filter:brightness(.92) }
.tde-btn-fetch:disabled { opacity:.65; cursor:not-allowed }
.tde-btn-fetch { align-self:flex-end }
.tde-msg { margin-top:12px; padding:8px 12px; border-radius:8px; font-size:12.5px;  }
.tde-msg-ok-box { background:var(--teal-bg); color:var(--teal); border:1px solid var(--teal) }
.tde-msg-err { background:var(--red-bg); color:var(--red); border:1px solid var(--red) }
.tde-table-wrap { overflow-x:auto; border:1px solid var(--border2); border-radius:10px }
table.tde-tbl { width:100%; border-collapse:collapse; font-size:12.5px }
table.tde-tbl th { background:var(--surface2); color:var(--text3); padding:10px 14px; text-align:left; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; white-space:nowrap; border-bottom:1px solid var(--border2) }
table.tde-tbl td { padding:10px 14px; border-bottom:1px solid var(--border); color:var(--text); white-space:nowrap; vertical-align:middle; }
table.tde-tbl tbody tr:last-child td { border-bottom:none }
table.tde-tbl tbody tr:hover td { background:var(--surface2) }
.tde-date-input { padding:6px 10px; border:1px solid var(--border2); border-radius:8px; font-size:12.5px; background:var(--surface); color:var(--text); width:150px; box-sizing:border-box }
.tde-date-input:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg); outline:none }
.tde-btn-save { background:var(--teal); color:#fff; border:none; padding:5px 16px; border-radius:8px; font-size:12.5px; font-weight:600; cursor:pointer; min-height:36px }
.tde-btn-save:hover { filter:brightness(.92) }
.tde-btn-save:disabled { opacity:.65; cursor:not-allowed }
.tde-inline-msg { font-size:11px; margin-left:6px }
.tde-msg-ok { color:var(--teal) }
.tde-msg-err-inline { color:var(--red) }
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
      <div id="tde-count" style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:12px;"></div>
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
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:36px">No records found.</td></tr>';
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
