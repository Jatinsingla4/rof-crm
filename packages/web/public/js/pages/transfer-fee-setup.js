/**
 * Transfer Fee Setup — Transfer > Setup > Transfer Fee
 * Allows configuring transfer fee, charges, and tax rates per project.
 */
(() => {

  const TFS_STYLES = `<style id="tfs-styles">
.tfs-page { padding: 0; font-family: Arial, sans-serif; font-size: 13px; }
.tfs-card { background: #fff; border: 1px solid #ddd; border-radius: 3px; margin-bottom: 10px; }
.tfs-hdr {
  display: flex; justify-content: space-between; align-items: center;
  background: #1d3a6e; padding: 7px 12px; border-radius: 3px 3px 0 0;
}
.tfs-hdr-title { color: #fff; font-size: 13px; font-weight: bold; letter-spacing: .3px; }
.tfs-body { padding: 14px 16px 16px; }
.tfs-project-row { display: flex; align-items: flex-end; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
.tfs-field { display: flex; flex-direction: column; gap: 3px; }
.tfs-lbl { font-size: 11px; color: #555; white-space: nowrap; }
.tfs-project-row select { padding: 5px 8px; border: 1px solid #ccc; border-radius: 3px; font-size: 13px; min-width: 200px; }
.tfs-divider { border: none; border-top: 1px solid #e0e0e0; margin: 4px 0 14px; }
.tfs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px 20px;
  margin-bottom: 14px;
}
.tfs-grid input[type="number"],
.tfs-grid input[type="date"] {
  padding: 5px 8px; border: 1px solid #ccc; border-radius: 3px;
  font-size: 13px; width: 100%; box-sizing: border-box;
}
.tfs-grid input:focus { outline: none; border-color: #337ab7; }
.tfs-foc-row { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; font-size: 13px; }
.tfs-foc-row input[type="checkbox"] { width: 15px; height: 15px; cursor: pointer; }
.tfs-btn-save {
  background: #1d3a6e; color: #fff; border: none;
  padding: 7px 22px; border-radius: 3px; font-size: 13px; font-weight: bold; cursor: pointer;
}
.tfs-btn-save:hover { background: #16305c; }
.tfs-btn-save:disabled { opacity: .7; cursor: not-allowed; }
.tfs-msg { margin-top: 10px; font-size: 13px; padding: 6px 10px; border-radius: 3px; display: none; }
.tfs-msg-ok  { background: #dff0d8; color: #3c763d; border: 1px solid #d6e9c6; }
.tfs-msg-err { background: #f2dede; color: #a94442; border: 1px solid #ebccd1; }
</style>`;

  function render() {
    return TFS_STYLES + `
<div class="tfs-page">
  <div class="tfs-card">
    <div class="tfs-hdr">
      <span class="tfs-hdr-title">TRANSFER FEE SETUP</span>
    </div>
    <div class="tfs-body">

      <div class="tfs-project-row">
        <div class="tfs-field">
          <span class="tfs-lbl">* Project:</span>
          <select id="tfs-project" onchange="TransferFeeSetup.onProjectChange()">
            <option value="">&lt;--Select--&gt;</option>
          </select>
        </div>
      </div>

      <hr class="tfs-divider">

      <div class="tfs-grid">
        <div class="tfs-field">
          <span class="tfs-lbl">Transfer Fee (Rs.)</span>
          <input type="number" id="tfs-fee" min="0" step="1" value="0">
        </div>
        <div class="tfs-field">
          <span class="tfs-lbl">Admin Charges (Rs.)</span>
          <input type="number" id="tfs-admin" min="0" step="1" value="0">
        </div>
        <div class="tfs-field">
          <span class="tfs-lbl">CGST (%)</span>
          <input type="number" id="tfs-cgst" min="0" step="0.01" value="0">
        </div>
        <div class="tfs-field">
          <span class="tfs-lbl">SGST (%)</span>
          <input type="number" id="tfs-sgst" min="0" step="0.01" value="0">
        </div>
        <div class="tfs-field">
          <span class="tfs-lbl">IGST (%)</span>
          <input type="number" id="tfs-igst" min="0" step="0.01" value="0">
        </div>
        <div class="tfs-field">
          <span class="tfs-lbl">UGST (%)</span>
          <input type="number" id="tfs-ugst" min="0" step="0.01" value="0">
        </div>
        <div class="tfs-field">
          <span class="tfs-lbl">Service Tax on Transfer Charge (%)</span>
          <input type="number" id="tfs-stax" min="0" step="0.01" value="12.36">
        </div>
        <div class="tfs-field">
          <span class="tfs-lbl">Effective From</span>
          <input type="date" id="tfs-effdate">
        </div>
      </div>

      <div class="tfs-foc-row">
        <input type="checkbox" id="tfs-foc" onchange="TransferFeeSetup.onFocChange()">
        <label for="tfs-foc">Is FOC (Free of Charge) — if checked, transfer fee = 0</label>
      </div>

      <button class="tfs-btn-save" id="tfs-save-btn" onclick="TransferFeeSetup.save()">SAVE</button>
      <div class="tfs-msg" id="tfs-msg"></div>

    </div>
  </div>
</div>`;
  }

  async function init() {
    await _loadProjects();
  }

  async function _loadProjects() {
    const token = localStorage.getItem('rof-jwt') || '';
    try {
      const res = await fetch('/api/projects', { headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      const sel = document.getElementById('tfs-project');
      if (!sel) return;
      (data.projects || data.data || data || []).forEach(p => {
        const o = document.createElement('option');
        o.value = p.id;
        o.textContent = p.name || p.project_name;
        sel.appendChild(o);
      });
    } catch (e) {
      console.error('TransferFeeSetup: failed to load projects', e);
    }
  }

  async function onProjectChange() {
    const projectId = document.getElementById('tfs-project')?.value;
    if (!projectId) return;
    _clearMsg();
    const token = localStorage.getItem('rof-jwt') || '';
    try {
      const res = await fetch('/api/transfers/fee-master?projectId=' + encodeURIComponent(projectId), {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (res.status === 404) {
        _resetFields();
        return;
      }
      if (!res.ok) throw new Error('Failed to load config');
      const data = await res.json();
      _fillFields(data.data);
    } catch (e) {
      console.error('TransferFeeSetup: onProjectChange error', e);
    }
  }

  function _fillFields(cfg) {
    _setVal('tfs-fee',     cfg.transfer_fee_inr  ?? 0);
    _setVal('tfs-admin',   cfg.admin_charges_inr ?? 0);
    _setVal('tfs-cgst',    cfg.cgst_pct          ?? 0);
    _setVal('tfs-sgst',    cfg.sgst_pct          ?? 0);
    _setVal('tfs-igst',    cfg.igst_pct          ?? 0);
    _setVal('tfs-ugst',    cfg.ugst_pct          ?? 0);
    _setVal('tfs-stax',    cfg.service_tax_pct   ?? 12.36);
    _setVal('tfs-effdate', cfg.effective_from     ? cfg.effective_from.slice(0, 10) : '');
    const foc = document.getElementById('tfs-foc');
    if (foc) foc.checked = !!cfg.is_foc;
  }

  function _resetFields() {
    _setVal('tfs-fee', 0); _setVal('tfs-admin', 0);
    _setVal('tfs-cgst', 0); _setVal('tfs-sgst', 0);
    _setVal('tfs-igst', 0); _setVal('tfs-ugst', 0);
    _setVal('tfs-stax', 12.36); _setVal('tfs-effdate', '');
    const foc = document.getElementById('tfs-foc');
    if (foc) foc.checked = false;
  }

  function _setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  function onFocChange() {
    const checked = document.getElementById('tfs-foc')?.checked;
    if (checked) {
      _setVal('tfs-fee', 0);
      _setVal('tfs-admin', 0);
    }
  }

  async function save() {
    const projectId = document.getElementById('tfs-project')?.value;
    if (!projectId) { _showMsg('Please select a project.', false); return; }

    const btn = document.getElementById('tfs-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    _clearMsg();

    const token = localStorage.getItem('rof-jwt') || '';
    try {
      const body = {
        projectId,
        transferFeeInr:  parseFloat(document.getElementById('tfs-fee')?.value   || '0'),
        adminChargesInr: parseFloat(document.getElementById('tfs-admin')?.value || '0'),
        cgstPct:         parseFloat(document.getElementById('tfs-cgst')?.value  || '0'),
        sgstPct:         parseFloat(document.getElementById('tfs-sgst')?.value  || '0'),
        igstPct:         parseFloat(document.getElementById('tfs-igst')?.value  || '0'),
        ugstPct:         parseFloat(document.getElementById('tfs-ugst')?.value  || '0'),
        servicetaxPct:   parseFloat(document.getElementById('tfs-stax')?.value  || '12.36'),
        isFoc:           !!(document.getElementById('tfs-foc')?.checked),
        effectiveFrom:   document.getElementById('tfs-effdate')?.value || null
      };

      const res = await fetch('/api/transfers/fee-master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      _showMsg('Transfer Fee configuration saved.', true);
    } catch (e) {
      _showMsg('Error: ' + e.message, false);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'SAVE'; }
    }
  }

  function _showMsg(text, ok) {
    const el = document.getElementById('tfs-msg');
    if (!el) return;
    el.textContent = text;
    el.className = 'tfs-msg ' + (ok ? 'tfs-msg-ok' : 'tfs-msg-err');
    el.style.display = 'block';
  }

  function _clearMsg() {
    const el = document.getElementById('tfs-msg');
    if (el) { el.style.display = 'none'; el.textContent = ''; }
  }

  window.TransferFeeSetup = { onProjectChange, onFocChange, save };

  Pages.transferFeeSetup = function(params) {
    const container = document.getElementById('content') || document.body;
    container.innerHTML = render();
    init();
  };

})();
