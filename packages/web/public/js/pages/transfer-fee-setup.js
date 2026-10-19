/**
 * Transfer Fee Setup — Transfer > Setup > Transfer Fee
 * Allows configuring transfer fee, charges, and tax rates per project.
 */
(() => {

  const TFS_STYLES = `<style id="tfs-styles">
.tfs-page { padding:0; font-size:13px; max-width:1000px; margin:0 auto }
.tfs-card { margin-bottom:16px; background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:hidden }
.tfs-hdr { display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; background:var(--teal-bg); padding:14px 18px; border-bottom:1px solid var(--border) }
.tfs-hdr-title { color:var(--text); font-size:12px; font-weight:600; letter-spacing:.6px; text-transform:uppercase }
.tfs-body { padding:18px }
.tfs-project-row { display:flex; align-items:flex-end; gap:16px; margin-bottom:16px; flex-wrap:wrap }
.tfs-field { display:flex; flex-direction:column; gap:6px }
.tfs-lbl { font-size:11px; color:var(--text2); letter-spacing:.3px; white-space:nowrap }
.tfs-project-row select { padding:9px 12px; border:1px solid var(--border2); border-radius:8px; font-size:13px; background:var(--surface); color:var(--text); min-height:38px; box-sizing:border-box; min-width:240px; }
.tfs-project-row select:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg); outline:none }
.tfs-divider { border:none; border-top:1px solid var(--border); margin:4px 0 18px }
.tfs-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:16px 20px; margin-bottom:16px }
.tfs-grid input[type="number"], .tfs-grid input[type="date"] { padding:9px 12px; border:1px solid var(--border2); border-radius:8px; font-size:13px; background:var(--surface); color:var(--text); min-height:38px; box-sizing:border-box; width:100%; }
.tfs-grid input[type="number"]:focus, .tfs-grid input[type="date"]:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg); outline:none }
.tfs-foc-row { display:flex; align-items:center; gap:8px; margin-bottom:16px; font-size:13px; color:var(--text) }
.tfs-foc-row input[type="checkbox"] { width:16px; height:16px; cursor:pointer; accent-color:var(--teal) }
.tfs-btn-save { background:var(--teal); color:#fff; border:none; padding:9px 26px; border-radius:8px; font-size:12.5px; font-weight:600; cursor:pointer; min-height:36px }
.tfs-btn-save:hover { filter:brightness(.92) }
.tfs-btn-save:disabled { opacity:.65; cursor:not-allowed }
.tfs-msg { margin-top:12px; padding:8px 12px; border-radius:8px; font-size:12.5px; display:none; }
.tfs-msg-ok { background:var(--teal-bg); color:var(--teal); border:1px solid var(--teal) }
.tfs-msg-err { background:var(--red-bg); color:var(--red); border:1px solid var(--red) }
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
