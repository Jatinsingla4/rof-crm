// ROF CRM — Installment Wise Interest Page (per-installment rate overrides)

{
  const II_STYLES = `
<style id="ii-styles">
.ii-page {
  padding: 0;
  font-family: Arial, sans-serif;
  font-size: 13px;
  background: #f0f0f0;
}
/* Filter card */
.ii-filter-card {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 3px;
  margin-bottom: 10px;
}
.ii-hdr {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #1d3a6e;
  padding: 7px 12px;
  border-radius: 3px 3px 0 0;
}
.ii-hdr-title {
  color: #fff;
  font-size: 13px;
  font-weight: bold;
  letter-spacing: .3px;
}
.ii-collapse-btn {
  background: #337ab7;
  color: #fff;
  border: none;
  padding: 1px 8px;
  font-size: 16px;
  line-height: 1.4;
  cursor: pointer;
  border-radius: 3px;
  font-weight: bold;
}
.ii-filter-body {
  padding: 12px 14px 14px;
  background: #fff;
}
.ii-filter-fields {
  display: flex;
  gap: 24px;
  align-items: flex-end;
  flex-wrap: wrap;
}
.ii-field-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ii-field-lbl {
  font-size: 13px;
  color: #333;
}
.ii-req { color: #c0392b; }
.ii-filter-card select {
  min-width: 160px;
  padding: 4px 8px;
  border: 1px solid #ccc;
  border-radius: 3px;
  font-size: 13px;
  background: #fff;
}
.ii-fetch-row {
  margin-top: 10px;
}
.ii-btn-fetch {
  background: #337ab7;
  color: #fff;
  border: none;
  padding: 5px 18px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: bold;
  cursor: pointer;
}
.ii-btn-fetch:hover { background: #2a6496; }
.ii-btn-fetch:disabled { opacity: .7; cursor: default; }
.ii-fmsg {
  margin-top: 8px;
  padding: 6px 10px;
  border-radius: 3px;
  font-size: 12px;
}
.ii-fmsg-err { background: #f2dede; color: #a94442; border: 1px solid #ebccd1; }
/* Results card */
.ii-results-card {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 3px;
}
.ii-tbl-wrap { overflow-x: auto; }
.ii-tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.ii-tbl th {
  background: #1d3a6e;
  color: #fff;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: normal;
  text-align: left;
  border-right: 1px solid rgba(255,255,255,.15);
}
.ii-tbl th:last-child { border-right: none; }
.ii-tbl td {
  padding: 6px 10px;
  border-bottom: 1px solid #e8e8e8;
  border-right: 1px solid #eee;
  color: #333;
}
.ii-tbl td:last-child { border-right: none; }
.ii-tbl tr:last-child td { border-bottom: none; }
.ii-tbl tr.ii-row-first td { background: #f5f0dc; }
.ii-interest-input {
  width: 80px;
  text-align: right;
  padding: 3px 5px;
  border: 1px solid #ccc;
  border-radius: 2px;
  font-size: 13px;
}
.ii-save-wrap { padding: 10px 14px 12px; }
.ii-btn-save {
  background: #337ab7;
  color: #fff;
  border: none;
  padding: 5px 18px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: bold;
  cursor: pointer;
}
.ii-btn-save:hover { background: #2a6496; }
.ii-btn-save:disabled { opacity: .7; cursor: default; }
.ii-smsg {
  display: inline-block;
  margin-left: 10px;
  padding: 4px 10px;
  border-radius: 3px;
  font-size: 12px;
}
.ii-smsg-ok  { background: #dff0d8; color: #3c763d; border: 1px solid #d6e9c6; }
.ii-smsg-err { background: #f2dede; color: #a94442; border: 1px solid #ebccd1; }
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
        div.innerHTML = `<div class="ii-results-card"><div class="ii-hdr"><span class="ii-hdr-title">INTEREST MASTER</span></div><div style="padding:12px;color:#777;font-size:13px;">No installments found for this plan.</div></div>`;
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
