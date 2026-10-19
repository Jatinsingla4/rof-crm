// ROF CRM — Installment Wise Interest Page (per-installment rate overrides)

{
  const II_STYLES = `
<style id="ii-styles">
.ii-page { padding:0; font-size:13px; background:transparent; max-width:1100px; margin:0 auto }
.ii-filter-card { margin-bottom:16px; background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:hidden }
.ii-hdr { display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; background:var(--teal-bg); padding:14px 18px; border-bottom:1px solid var(--border) }
.ii-hdr-title { color:var(--text); font-size:12px; font-weight:600; letter-spacing:.6px; text-transform:uppercase }
.ii-collapse-btn { background:var(--surface); color:var(--text2); border:1px solid var(--border2); padding:1px 10px; font-size:16px; line-height:1.4; cursor:pointer; border-radius:6px }
.ii-filter-body { padding:18px }
.ii-filter-fields { display:flex; gap:18px 24px; align-items:flex-end; flex-wrap:wrap }
.ii-field-group { display:flex; flex-direction:column; gap:6px }
.ii-field-lbl { font-size:11px; color:var(--text2); letter-spacing:.3px }
.ii-req { color:var(--red) }
.ii-filter-card select { padding:9px 12px; border:1px solid var(--border2); border-radius:8px; font-size:13px; background:var(--surface); color:var(--text); min-height:38px; box-sizing:border-box }
.ii-filter-card select:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg); outline:none }
.ii-filter-card select { min-width:200px }
.ii-fetch-row { margin-top:18px }
.ii-btn-fetch { background:var(--teal); color:#fff; border:none; padding:9px 24px; border-radius:8px; font-size:12.5px; font-weight:600; cursor:pointer; min-height:38px }
.ii-btn-fetch:hover { filter:brightness(.92) }
.ii-btn-fetch:disabled { opacity:.65; cursor:default }
.ii-fmsg { margin-top:12px }
.ii-fmsg { padding:8px 12px; border-radius:8px; font-size:12px }
.ii-fmsg-ok { background:var(--teal-bg); color:var(--teal); border:1px solid var(--teal) }
.ii-fmsg-err { background:var(--red-bg); color:var(--red); border:1px solid var(--red) }
.ii-results-card { margin-bottom:16px; background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:hidden }
.ii-tbl-wrap { overflow-x:auto }
.ii-tbl { width:100%; border-collapse:collapse; font-size:12.5px }
.ii-tbl th { background:var(--surface2); color:var(--text3); padding:10px 14px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; text-align:left; border-bottom:1px solid var(--border2); white-space:nowrap }
.ii-tbl td { padding:10px 14px; border-bottom:1px solid var(--border); color:var(--text);  }
.ii-tbl tr:last-child td { border-bottom:none }
.ii-tbl tbody tr:hover td { background:var(--surface2) }
.ii-tbl tr.ii-row-first td { background:var(--teal-bg) }
.ii-interest-input { padding:6px 10px; border:1px solid var(--border2); border-radius:8px; font-size:12.5px; background:var(--surface); color:var(--text); width:90px; text-align:right; }
.ii-interest-input:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg); outline:none }
.ii-save-wrap { padding:14px 18px 16px; border-top:1px solid var(--border); background:var(--surface2) }
.ii-btn-save { background:var(--teal); color:#fff; border:none; padding:9px 24px; border-radius:8px; font-size:12.5px; font-weight:600; cursor:pointer; min-height:38px }
.ii-btn-save:hover { filter:brightness(.92) }
.ii-btn-save:disabled { opacity:.65; cursor:default }
.ii-smsg { display:inline-block; margin-left:10px; padding:6px 12px; border-radius:8px; font-size:12px }
.ii-smsg-ok { background:var(--teal-bg); color:var(--teal); border:1px solid var(--teal) }
.ii-smsg-err { background:var(--red-bg); color:var(--red); border:1px solid var(--red) }
</style>`;

  const InstallmentInterest = {
    _rows: [],
    _projectId: null,
    _planName: null,
    _collapsed: false,

    render() {
      return II_STYLES + `
<div class="ii-page">
  <div class="ii-filter-card" id="ii-filter-card">
    <div class="ii-hdr">
      <span class="ii-hdr-title">INTEREST MASTER</span>
      <button class="ii-collapse-btn" onclick="InstallmentInterest.toggleCollapse()" title="Collapse/Expand">&#8722;</button>
    </div>
    <div class="ii-filter-body" id="ii-filter-body">
      <div class="ii-filter-fields">
        <div class="ii-field-group">
          <span class="ii-field-lbl"><span class="ii-req">*</span>Project:</span>
          <select id="ii-project" onchange="InstallmentInterest.onProjectChange()">
            <option value="">&lt;--Select--&gt;</option>
          </select>
        </div>
        <div class="ii-field-group">
          <span class="ii-field-lbl"><span class="ii-req">*</span>Payment Plan:</span>
          <select id="ii-plan">
            <option value="">&lt;--Select--&gt;</option>
          </select>
        </div>
      </div>
      <div class="ii-fetch-row">
        <button class="ii-btn-fetch" id="ii-fetch-btn" onclick="InstallmentInterest.fetchInstallments()">FETCH</button>
      </div>
      <div id="ii-fmsg"></div>
    </div>
  </div>
  <div id="ii-results"></div>
</div>`;
    },

    async init() {
      await this.loadProjects();
    },

    toggleCollapse() {
      this._collapsed = !this._collapsed;
      const body = document.getElementById('ii-filter-body');
      const btn  = document.querySelector('.ii-collapse-btn');
      if (body) body.style.display = this._collapsed ? 'none' : '';
      if (btn)  btn.innerHTML = this._collapsed ? '&#43;' : '&#8722;';
    },

    async loadProjects() {
      const token = localStorage.getItem('rof-jwt') || '';
      try {
        const res = await fetch('/api/projects', { headers: { Authorization: 'Bearer ' + token } });
        const data = await res.json();
        const sel = document.getElementById('ii-project');
        const list = data.projects || data.data || data;
        (Array.isArray(list) ? list : []).forEach(p => {
          const o = document.createElement('option');
          o.value = p.id;
          o.textContent = p.name;
          sel.appendChild(o);
        });
      } catch (e) { console.error('Failed to load projects', e); }
    },

    async onProjectChange() {
      const projectId = document.getElementById('ii-project').value;
      const planSel = document.getElementById('ii-plan');
      planSel.innerHTML = '<option value="">&lt;--Select--&gt;</option>';
      document.getElementById('ii-results').innerHTML = '';
      if (!projectId) return;
      const token = localStorage.getItem('rof-jwt') || '';
      try {
        const res = await fetch('/api/payments/plan-names/' + projectId, {
          headers: { Authorization: 'Bearer ' + token },
        });
        const data = await res.json();
        (data.data || []).forEach(name => {
          const o = document.createElement('option');
          o.value = name;
          o.textContent = name;
          planSel.appendChild(o);
        });
      } catch (e) { console.error('Failed to load plan names', e); }
    },

    showFMsg(text, isErr) {
      const el = document.getElementById('ii-fmsg');
      if (!el) return;
      el.innerHTML = `<div class="ii-fmsg ${isErr ? 'ii-fmsg-err' : ''}">${text}</div>`;
      setTimeout(() => { el.innerHTML = ''; }, 4000);
    },

    async fetchInstallments() {
      const projectId = document.getElementById('ii-project').value;
      const planName  = document.getElementById('ii-plan').value;
      if (!projectId) { this.showFMsg('Please select a project.', true); return; }
      if (!planName)  { this.showFMsg('Please select a payment plan.', true); return; }

      this._projectId = projectId;
      this._planName  = planName;

      const btn = document.getElementById('ii-fetch-btn');
      btn.disabled = true; btn.textContent = 'Loading...';
      const token = localStorage.getItem('rof-jwt') || '';
      try {
        const res = await fetch(
          '/api/payments/installment-interest/' + encodeURIComponent(projectId) + '/' + encodeURIComponent(planName),
          { headers: { Authorization: 'Bearer ' + token } }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Fetch failed');
        this._rows = data.data || [];
        this.renderTable();
      } catch (err) {
        this.showFMsg('Error: ' + err.message, true);
      } finally {
        btn.disabled = false; btn.textContent = 'FETCH';
      }
    },

    renderTable() {
      const div = document.getElementById('ii-results');
      if (this._rows.length === 0) {
        div.innerHTML = `<div class="ii-results-card"><div class="ii-hdr"><span class="ii-hdr-title">INTEREST MASTER</span></div><div style="padding:30px 18px;color:var(--text3);font-size:13px;text-align:center;">No installments found for this plan.</div></div>`;
        return;
      }
      let rows = '';
      this._rows.forEach((r, i) => {
        const pct = r.percentage != null ? parseFloat(r.percentage).toFixed(2) : null;
        const installNo = pct != null
          ? `${r.installment_name} (${pct})%`
          : r.installment_name;
        const storedRate = r.interest_rate_percent != null ? parseFloat(r.interest_rate_percent).toFixed(4) : '0.0000';
        const firstCls = i === 0 ? ' ii-row-first' : '';
        rows += `
<tr class="${firstCls}">
  <td>${i + 1}</td>
  <td>${installNo}</td>
  <td>${r.installment_name}</td>
  <td><input class="ii-interest-input" type="number" step="0.0001" min="0"
       data-idx="${r.installment_index}" value="${storedRate}"></td>
</tr>`;
      });
      div.innerHTML = `
<div class="ii-results-card">
  <div class="ii-hdr">
    <span class="ii-hdr-title">INTEREST MASTER</span>
  </div>
  <div class="ii-tbl-wrap">
    <table class="ii-tbl">
      <thead>
        <tr>
          <th style="width:6%">S.NO.</th>
          <th style="width:28%">INSTALLMENT NO.</th>
          <th style="width:50%">INSTALLMENT NAME</th>
          <th style="width:16%">INTEREST</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <div class="ii-save-wrap">
    <button class="ii-btn-save" id="ii-save-btn" onclick="InstallmentInterest.save()">SAVE</button>
    <span id="ii-smsg"></span>
  </div>
</div>`;
    },

    async save() {
      if (!this._projectId || !this._planName) return;
      const inputs = document.querySelectorAll('.ii-interest-input');
      const rates = [];
      inputs.forEach(inp => {
        const idx = parseInt(inp.getAttribute('data-idx'));
        const val = inp.value.trim();
        const num = parseFloat(val);
        rates.push({
          installment_index:     idx,
          interest_rate_percent: (!val || num === 0) ? null : num,
        });
      });

      const btn = document.getElementById('ii-save-btn');
      btn.disabled = true; btn.textContent = 'Saving...';
      const token = localStorage.getItem('rof-jwt') || '';
      try {
        const res = await fetch(
          '/api/payments/installment-interest/' + encodeURIComponent(this._projectId) + '/' + encodeURIComponent(this._planName),
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ rates }),
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Save failed');
        const smsg = document.getElementById('ii-smsg');
        smsg.className = 'ii-smsg ii-smsg-ok';
        smsg.textContent = 'Saved successfully.';
        setTimeout(() => { smsg.textContent = ''; smsg.className = 'ii-smsg'; }, 4000);
      } catch (err) {
        const smsg = document.getElementById('ii-smsg');
        smsg.className = 'ii-smsg ii-smsg-err';
        smsg.textContent = 'Error: ' + err.message;
      } finally {
        btn.disabled = false; btn.textContent = 'SAVE';
      }
    },
  };

  window.InstallmentInterest = InstallmentInterest;

  Pages.installmentInterest = (params = {}) => {
    const container = document.getElementById('content') || document.body;
    container.innerHTML = InstallmentInterest.render();
    InstallmentInterest._rows = [];
    InstallmentInterest._projectId = null;
    InstallmentInterest._planName  = null;
    InstallmentInterest._collapsed  = false;
    InstallmentInterest.init();
  };
}
