// ROF CRM — Interest Scheduler Page (Manual Schedular)

{
  const IS_STYLES = `
<style id="is-styles">
.is-page-wrap { padding:0; font-size:13px }
.is-card { max-width:560px; margin:0 auto 16px; background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:hidden }
.is-card { margin-top:8px }
.is-card-title { background:var(--teal-bg); color:var(--text); padding:14px 18px; font-size:12px; font-weight:600; letter-spacing:.6px; text-transform:uppercase; border-bottom:1px solid var(--border) }
.is-card-body { padding:22px 24px 24px }
.is-form-row { display:flex; align-items:center; margin-bottom:16px; gap:12px }
.is-form-row label { width:72px; font-size:12px; color:var(--text2); font-weight:500; flex-shrink:0 }
.is-form-row select { padding:9px 12px; border:1px solid var(--border2); border-radius:8px; font-size:13px; background:var(--surface); color:var(--text); min-height:38px; box-sizing:border-box }
.is-form-row select:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg); outline:none }
.is-form-row select { flex:1 }
.is-btn-row { display:flex; gap:10px; margin-top:22px; flex-wrap:wrap }
.is-btn-calc { background:var(--teal); color:#fff; border:none; padding:9px 24px; border-radius:8px; font-size:12.5px; font-weight:600; cursor:pointer; min-height:38px }
.is-btn-calc:hover { filter:brightness(.92) }
.is-btn-calc:disabled { opacity:.65; cursor:default }
.is-btn-calc { text-transform:uppercase; letter-spacing:.3px }
.is-btn-del { background:var(--red); color:#fff; border:none; padding:9px 24px; border-radius:8px; font-size:12.5px; font-weight:600; cursor:pointer; text-transform:uppercase; letter-spacing:.3px; min-height:38px }
.is-btn-del:hover { filter:brightness(.92) }
.is-btn-del:disabled { opacity:.65; cursor:default }
.is-summary { display:flex; gap:12px; margin:16px auto; max-width:960px; flex-wrap:wrap }
.is-summary-card { flex:1 1 180px; background:var(--surface); border:1px solid var(--border2); border-left:3px solid var(--teal); border-radius:10px; padding:12px 16px; text-align:left }
.is-summary-card span { display:block; font-size:10.5px; color:var(--text3); margin-bottom:5px; text-transform:uppercase; letter-spacing:.5px }
.is-summary-card strong { font-size:20px; color:var(--text) }
.is-table-wrap { overflow-x:auto; margin-bottom:14px; border:1px solid var(--border2); border-radius:10px; background:var(--surface) }
.is-table { width:100%; border-collapse:collapse; font-size:12.5px }
.is-table th { background:var(--surface2); color:var(--text3); padding:10px 14px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; text-align:left; border-bottom:1px solid var(--border2); white-space:nowrap }
.is-table td { padding:10px 14px; border-bottom:1px solid var(--border); color:var(--text); white-space:nowrap; }
.is-table tr:last-child td { border-bottom:none }
.is-table tbody tr:hover td { background:var(--surface2) }
.is-table a { color:var(--teal); text-decoration:none; font-weight:500 }
.is-table a:hover { text-decoration:underline }
.is-save-row { display:flex; align-items:center; gap:14px; margin-top:12px; padding:12px 0 }
.is-btn-save { background:var(--teal); color:#fff; border:none; padding:9px 24px; border-radius:8px; font-size:12.5px; font-weight:600; cursor:pointer; min-height:38px }
.is-btn-save:hover { filter:brightness(.92) }
.is-btn-save:disabled { opacity:.65; cursor:default }
.is-btn-save { text-transform:uppercase }
.is-save-note { font-size:11.5px; color:var(--text3) }
.is-no-interest { padding:30px 16px; color:var(--text3); font-size:13px; text-align:center }
</style>`;

  const InterestScheduler = {
    _lastPayload: null,

    render() {
      return IS_STYLES + `
<div class="is-page-wrap">
  <div class="is-card">
    <div class="is-card-title">MANUAL SCHEDULAR</div>
    <div class="is-card-body">
      <div class="is-form-row">
        <label>Project:</label>
        <select id="is-project">
          <option value="">&lt;--Select--&gt;</option>
        </select>
      </div>
      <div class="is-form-row">
        <label>Tower:</label>
        <select id="is-tower">
          <option value="">&lt;--All--&gt;</option>
        </select>
      </div>
      <div class="is-btn-row">
        <button class="is-btn-calc" id="is-calc-btn"
          onclick="InterestScheduler.calculate()">CALCULATE INTEREST</button>
        <button class="is-btn-del" id="is-del-btn"
          onclick="InterestScheduler.deleteInterest()">DELETE INTEREST</button>
      </div>
    </div>
  </div>
  <div id="is-results" style="display:none;max-width:960px;margin:0 auto;"></div>
</div>`;
    },

    async init() {
      await this.loadProjects();
      document.getElementById('is-project')
        .addEventListener('change', () => this.loadTowers());
    },

    async loadProjects() {
      const token = localStorage.getItem('rof-jwt') || '';
      try {
        const res = await fetch('/api/projects', {
          headers: { Authorization: 'Bearer ' + token }
        });
        const data = await res.json();
        const sel = document.getElementById('is-project');
        const list = data.projects || data.data || data;
        (Array.isArray(list) ? list : []).forEach(p => {
          const o = document.createElement('option');
          o.value = p.id;
          o.textContent = p.name;
          sel.appendChild(o);
        });
      } catch (e) {
        console.error('Failed to load projects', e);
      }
    },

    async loadTowers() {
      const projectId = document.getElementById('is-project').value;
      const sel = document.getElementById('is-tower');
      sel.innerHTML = '<option value="">&lt;--All--&gt;</option>';
      if (!projectId) return;
      const token = localStorage.getItem('rof-jwt') || '';
      try {
        const res = await fetch('/api/projects/' + projectId + '/towers', {
          headers: { Authorization: 'Bearer ' + token }
        });
        const data = await res.json();
        const list = data.towers || data.data || data;
        (Array.isArray(list) ? list : []).forEach(t => {
          const o = document.createElement('option');
          o.value = t.id || t.tower_id;
          o.textContent = t.tower_name;
          sel.appendChild(o);
        });
      } catch (e) {
        console.error('Failed to load towers', e);
      }
    },

    async calculate() {
      const projectId = document.getElementById('is-project').value;
      if (!projectId) { alert('Please select a project'); return; }
      const towerId = document.getElementById('is-tower').value || null;

      const btn = document.getElementById('is-calc-btn');
      btn.textContent = 'Calculating...';
      btn.disabled = true;

      const token = localStorage.getItem('rof-jwt') || '';
      try {
        const res = await fetch('/api/payments/interest-scheduler', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token
          },
          body: JSON.stringify({ project_id: projectId, tower_id: towerId, persist: false })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Calculation failed');
        this._lastPayload = { project_id: projectId, tower_id: towerId };
        this.renderResults(data);
      } catch (err) {
        alert('Error: ' + err.message);
      } finally {
        btn.textContent = 'CALCULATE INTEREST';
        btn.disabled = false;
      }
    },

    renderResults(data) {
      const { summary, details } = data;
      const div = document.getElementById('is-results');
      div.style.display = 'block';

      let html = `
<div class="is-summary">
  <div class="is-summary-card">
    <span>Consumers Processed</span>
    <strong>${summary.consumers_processed}</strong>
  </div>
  <div class="is-summary-card">
    <span>With Interest</span>
    <strong>${summary.consumers_with_interest}</strong>
  </div>
  <div class="is-summary-card">
    <span>Total Interest</span>
    <strong>&#8377;${summary.total_interest_inr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
  </div>
</div>`;

      if (summary.consumers_with_interest > 0) {
        html += `
<div class="is-table-wrap">
  <table class="is-table">
    <thead>
      <tr>
        <th>S.No.</th>
        <th>Consumer</th>
        <th>Reg. No.</th>
        <th>Installment</th>
        <th>Due Date</th>
        <th>Delay Days</th>
        <th>Delay Amount</th>
        <th>Interest (&#8377;)</th>
      </tr>
    </thead>
    <tbody>`;
        let sno = 1;
        details.forEach(c => {
          c.rows.forEach(row => {
            html += `
      <tr>
        <td>${sno++}</td>
        <td><a href="/api/consumers/${c.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" style="color:var(--teal);text-decoration:none;font-weight:500;cursor:pointer" title="View Applicant File">${c.consumer_name}</a></td>
        <td>${c.registration_number || '—'}</td>
        <td>${row.installment_name}</td>
        <td>${row.installment_date ? new Date(row.installment_date).toLocaleDateString('en-IN') : '—'}</td>
        <td>${row.delay_days}</td>
        <td>${(row.amount_received === 0 && row.is_first_receipt === true) ? '--' : '&#8377;' + Math.round(row.delay_amount).toLocaleString('en-IN')}</td>
        <td style="color:var(--red);font-weight:600;">&#8377;${row.interest_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>`;
          });
        });
        html += `
    </tbody>
  </table>
</div>
<div class="is-save-row">
  <button class="is-btn-save" id="is-save-btn" onclick="InterestScheduler.saveToDb()">SAVE TO DATABASE</button>
  <span class="is-save-note">Saves interest records for waiver processing</span>
</div>`;
      } else {
        html += `<div class="is-no-interest">No overdue interest found for the selected project/tower.</div>`;
      }

      div.innerHTML = html;
    },

    async saveToDb() {
      if (!this._lastPayload) return;
      const btn = document.getElementById('is-save-btn');
      btn.textContent = 'Saving...';
      btn.disabled = true;
      const token = localStorage.getItem('rof-jwt') || '';
      try {
        const res = await fetch('/api/payments/interest-scheduler', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token
          },
          body: JSON.stringify({ ...this._lastPayload, persist: true })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Save failed');
        alert('Interest saved successfully!\n' + data.summary.consumers_with_interest + ' consumer(s) updated.');
      } catch (err) {
        alert('Error: ' + err.message);
      } finally {
        btn.textContent = 'SAVE TO DATABASE';
        btn.disabled = false;
      }
    },

    async deleteInterest() {
      const projectId = document.getElementById('is-project').value;
      if (!projectId) { alert('Please select a project'); return; }
      if (!await Utils.ask('Delete all stored interest for this project? This cannot be undone.')) return;

      const towerId = document.getElementById('is-tower').value || null;
      const btn = document.getElementById('is-del-btn');
      btn.textContent = 'Deleting...';
      btn.disabled = true;
      const token = localStorage.getItem('rof-jwt') || '';
      try {
        const res = await fetch('/api/payments/interest-scheduler', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token
          },
          body: JSON.stringify({ project_id: projectId, tower_id: towerId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Delete failed');
        alert('Interest deleted. ' + (data.deleted || 0) + ' record(s) removed.');
        document.getElementById('is-results').style.display = 'none';
      } catch (err) {
        alert('Error: ' + err.message);
      } finally {
        btn.textContent = 'DELETE INTEREST';
        btn.disabled = false;
      }
    }
  };

  window.InterestScheduler = InterestScheduler;

  Pages.interestScheduler = (params = {}) => {
    const container = document.getElementById('content') || document.body;
    container.innerHTML = InterestScheduler.render();
    InterestScheduler._lastPayload = null;
    InterestScheduler.init();
  };
}
