/**
 * Charge Master — Project Set Up > Charge Master > Other Charges
 * Global admin-editable charge rate config (e.g. Balcony Charge rate).
 */
(() => {

  const CM_STYLES = `<style id="cm-styles">
.cm-page { max-width:1100px; margin:0 auto; font-size:13px; color:var(--text); }
.cm-card { background:var(--surface); border:1px solid var(--border2); border-radius:10px; margin-bottom:16px; overflow:hidden; }
.cm-hdr { display:flex; justify-content:space-between; align-items:center; background:var(--teal-bg); padding:14px 18px; border-bottom:1px solid var(--border); }
.cm-hdr-title { color:var(--text); font-size:12px; font-weight:600; letter-spacing:.6px; text-transform:uppercase; }
.cm-hdr-sub { font-size:11px; color:var(--text3); }
.cm-body { padding:0; }
.cm-table { width:100%; border-collapse:collapse; font-size:12.5px; }
.cm-table th { background:var(--surface2); color:var(--text3); padding:10px 18px; text-align:left; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:.4px; border-bottom:1px solid var(--border2); }
.cm-table td { padding:12px 18px; border-bottom:1px solid var(--border); vertical-align:middle; color:var(--text); }
.cm-table tbody tr:hover td { background:var(--surface2); }
.cm-table input[type="number"] { padding:9px 12px; min-height:38px; border:1px solid var(--border2); border-radius:8px; font-size:13px; width:140px; box-sizing:border-box; background:var(--surface); color:var(--text); }
.cm-table input:focus { outline:none; border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg); }
.cm-btn-save { background:var(--teal); color:#fff; border:none; padding:8px 20px; min-height:36px; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; }
.cm-btn-save:hover { filter:brightness(.92); }
.cm-btn-save:disabled { opacity:.7; cursor:not-allowed; }
.cm-msg { margin:14px 18px 16px; font-size:12.5px; padding:9px 14px; border-radius:8px; display:none; }
.cm-msg-ok  { background:var(--teal-bg); color:var(--teal); border:1px solid var(--teal); font-weight:600; }
.cm-msg-err { background:var(--red-bg); color:var(--red); border:1px solid var(--red); }
.cm-empty { text-align:center; color:var(--text3); padding:36px 18px; font-size:13px; }
@media (max-width:700px) { .cm-table th, .cm-table td { padding:10px 12px; } .cm-table input[type="number"] { width:100px; } }
</style>`;

  let _rows = [];

  function _render() {
    return CM_STYLES + `
<div class="cm-page">
  <div class="page-hdr">
    <h1>Charge Master</h1>
    <div class="breadcrumb">Set Projects / <b>Charge Master</b></div>
  </div>
  <div class="cm-card">
    <div class="cm-hdr">
      <span class="cm-hdr-title">Other Charges</span>
      <span class="cm-hdr-sub">Edit a rate and click Save</span>
    </div>
    <div class="cm-body">
      <div id="cm-table-section"></div>
      <div class="cm-msg" id="cm-msg"></div>
    </div>
  </div>
</div>`;
  }

  async function _init() {
    await _loadConfig();
  }

  async function _loadConfig() {
    const token = localStorage.getItem('rof-jwt') || '';
    const tableSection = document.getElementById('cm-table-section');
    if (!tableSection) return;
    tableSection.innerHTML = '<div class="cm-empty">Loading...</div>';
    try {
      const res = await fetch('/api/charge-master/config', {
        headers: { Authorization: 'Bearer ' + token }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      _renderTable(data.data || []);
    } catch (e) {
      tableSection.innerHTML = '<div class="cm-empty">Error loading charge config: ' + e.message + '</div>';
    }
  }

  function _renderTable(rows) {
    rows = rows.filter(function(r) { return r.charge_key === 'balcony_charge'; });
    _rows = rows;
    const tableSection = document.getElementById('cm-table-section');
    if (!tableSection) return;
    if (rows.length === 0) {
      tableSection.innerHTML = '<div class="cm-empty">No charge config found.</div>';
      return;
    }
    let html = '<table class="cm-table"><thead><tr>' +
      '<th>CHARGE NAME</th><th>RATE</th><th>UNIT</th><th>CAP</th><th>ACTION</th>' +
      '</tr></thead><tbody>';
    rows.forEach(function(r) {
      html += '<tr>' +
        '<td>' + _esc(r.charge_name) + '</td>' +
        '<td><input type="number" step="0.01" min="0" max="1000000" id="cm-rate-' + r.charge_key + '" value="' + parseFloat(r.rate_value) + '"></td>' +
        '<td>' + _esc(r.rate_unit) + '</td>' +
        '<td>' + (r.cap_value != null ? _fmtNum(r.cap_value) + (r.is_cap_configurable ? '' : ' (fixed)') : '—') + '</td>' +
        '<td><button class="cm-btn-save" onclick="ChargeMaster.save(\'' + r.charge_key + '\')">SAVE</button></td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    tableSection.innerHTML = html;
  }

  async function _save(chargeKey) {
    const input = document.getElementById('cm-rate-' + chargeKey);
    if (!input) return;
    const rateValue = parseFloat(input.value);
    if (!/^\d+(\.\d{1,2})?$/.test(input.value.trim()) || rateValue > 1000000) { _showMsg('Rate must be a number from 0 to 10,00,000, up to 2 decimals.', false); return; }
    const btn = input.closest('tr').querySelector('button'); btn.disabled = true;

    const token = localStorage.getItem('rof-jwt') || '';
    _clearMsg();
    try {
      const res = await fetch('/api/charge-master/config/' + encodeURIComponent(chargeKey), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ rate_value: rateValue })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      _showMsg('Rate updated successfully.', true);
      await _loadConfig();
    } catch (e) {
      _showMsg('Error: ' + e.message, false);
      btn.disabled = false;
    }
  }

  function _esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _fmtNum(n) {
    const num = parseFloat(n || 0);
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function _showMsg(text, ok) {
    const el = document.getElementById('cm-msg');
    if (!el) return;
    el.textContent = text;
    el.className = 'cm-msg ' + (ok ? 'cm-msg-ok' : 'cm-msg-err');
    el.style.display = 'block';
  }

  function _clearMsg() {
    const el = document.getElementById('cm-msg');
    if (el) { el.style.display = 'none'; el.textContent = ''; }
  }

  window.ChargeMaster = {
    save: _save,
  };

  Pages.chargeMaster = function(params) {
    const container = document.getElementById('content') || document.body;
    container.innerHTML = _render();
    _init();
  };

})();
