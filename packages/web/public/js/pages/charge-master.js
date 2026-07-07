/**
 * Charge Master — Project Set Up > Charge Master > Other Charges
 * Global admin-editable charge rate config (e.g. Balcony Charge rate).
 */
(() => {

  const CM_STYLES = `<style id="cm-styles">
.cm-page { padding: 0; font-family: Arial, sans-serif; font-size: 13px; }
.cm-card { background: #fff; border: 1px solid #ddd; border-radius: 3px; margin-bottom: 10px; }
.cm-hdr {
  display: flex; justify-content: space-between; align-items: center;
  background: #1d3a6e; padding: 7px 12px; border-radius: 3px 3px 0 0;
}
.cm-hdr-title { color: #fff; font-size: 13px; font-weight: bold; letter-spacing: .3px; }
.cm-body { padding: 14px 16px 16px; }
.cm-table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 12px; }
.cm-table th { background: #1d3a6e; color: #fff; padding: 6px 8px; text-align: left; font-weight: bold; font-size: 12px; }
.cm-table td { padding: 6px 8px; border-bottom: 1px solid #eee; vertical-align: middle; }
.cm-table input[type="number"] {
  padding: 5px 8px; border: 1px solid #ccc; border-radius: 3px;
  font-size: 13px; width: 120px; box-sizing: border-box;
}
.cm-table input:focus { outline: none; border-color: #337ab7; }
.cm-btn-save {
  background: #1d3a6e; color: #fff; border: none;
  padding: 5px 16px; border-radius: 3px; font-size: 12px; font-weight: bold; cursor: pointer;
}
.cm-btn-save:hover { background: #16305c; }
.cm-btn-save:disabled { opacity: .7; cursor: not-allowed; }
.cm-msg { margin-top: 10px; font-size: 13px; padding: 6px 10px; border-radius: 3px; display: none; }
.cm-msg-ok  { background: #dff0d8; color: #3c763d; border: 1px solid #d6e9c6; }
.cm-msg-err { background: #f2dede; color: #a94442; border: 1px solid #ebccd1; }
.cm-empty { text-align: center; color: #999; padding: 16px; font-size: 13px; }
</style>`;

  let _rows = [];

  function _render() {
    return CM_STYLES + `
<div class="cm-page">
  <div class="cm-card">
    <div class="cm-hdr">
      <span class="cm-hdr-title">CHARGE MASTER — OTHER CHARGES</span>
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
    tableSection.innerHTML = '<div style="padding:10px;color:#999;font-size:12px;">Loading...</div>';
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
        '<td><input type="number" step="0.01" min="0" id="cm-rate-' + r.charge_key + '" value="' + parseFloat(r.rate_value) + '"></td>' +
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
    if (isNaN(rateValue) || rateValue < 0) { _showMsg('Please enter a valid rate.', false); return; }

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
