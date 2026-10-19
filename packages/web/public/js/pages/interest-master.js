// ROF CRM — Interest Master Page (per-project interest rate management)

{
  const IM_STYLES = `
<style id="im-styles">
.im-page { padding:0; font-size:13px; background:transparent }
.im-card { max-width:560px; margin:0 auto 16px; background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:hidden }
.im-hdr { display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; background:var(--teal-bg); padding:14px 18px; border-bottom:1px solid var(--border) }
.im-hdr-title { color:var(--text); font-size:12px; font-weight:600; letter-spacing:.6px; text-transform:uppercase }
.im-hdr-note { background:var(--red-bg); color:var(--red); font-size:11px; padding:3px 10px; border-radius:999px; border:1px solid var(--red); font-weight:normal; white-space:nowrap }
.im-body { padding:20px 24px 24px; background:transparent }
.im-row { display:flex; align-items:center; margin-bottom:16px; gap:12px }
.im-lbl { width:148px; font-size:12px; color:var(--text2); flex-shrink:0 }
.im-req { color:var(--red) }
.im-row select, .im-row input[type="text"], .im-row input[type="number"] { padding:9px 12px; border:1px solid var(--border2); border-radius:8px; font-size:13px; background:var(--surface); color:var(--text); min-height:38px; box-sizing:border-box }
.im-row select, .im-row input[type="text"], .im-row input[type="number"]:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg); outline:none }
.im-row select, .im-row input[type="text"], .im-row input[type="number"] { width:230px; max-width:100% }
.im-date-wrap { display:flex; align-items:center; width:230px; max-width:100%; border:1px solid var(--border2); border-radius:8px; background:var(--surface); padding:0 10px; min-height:38px; box-sizing:border-box }
.im-date-wrap:focus-within { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg) }
.im-date-wrap .im-cal { margin-right:6px; font-size:13px; color:var(--text3) }
.im-date-wrap input[type="date"] { border:none; outline:none; font-size:13px; flex:1; background:transparent; width:100%; padding:0; color:var(--text) }
.im-btns { margin-top:22px; display:flex; gap:10px; flex-wrap:wrap }
.im-btn { padding:9px 24px; border:none; border-radius:8px; font-size:12.5px; font-weight:600; cursor:pointer; color:#fff; min-height:38px }
.im-btn-blue { background:var(--teal) }
.im-btn-blue:hover { filter:brightness(.92) }
.im-btn-blue:disabled { opacity:.65; cursor:default }
.im-btn-red { background:var(--red) }
.im-btn-red:hover { filter:brightness(.92) }
.im-msg-wrap { margin-top:12px }
.im-msg { padding:8px 12px; border-radius:8px; font-size:12px }
.im-msg-ok { background:var(--teal-bg); color:var(--teal); border:1px solid var(--teal) }
.im-msg-err { background:var(--red-bg); color:var(--red); border:1px solid var(--red) }
.im-results { margin-top:16px; max-width:560px; margin-left:auto; margin-right:auto }
.im-proj-hdr { display:flex; justify-content:space-between; align-items:center; padding:12px 18px; background:var(--teal-bg); border:1px solid var(--border2); border-radius:10px 10px 0 0 }
.im-proj-title { font-size:12px; font-weight:600; color:var(--text); letter-spacing:.6px; text-transform:uppercase }
.im-proj-icons { color:var(--text3); font-size:16px }
.im-proj-icons span { margin-left:8px; cursor:pointer }
.im-tbl-wrap { border:1px solid var(--border2); border-top:none; border-radius:0 0 10px 10px; background:var(--surface); overflow-x:auto }
.im-tbl { width:100%; border-collapse:collapse; font-size:12.5px }
.im-tbl th { background:var(--surface2); color:var(--text3); padding:10px 14px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; text-align:left; border-bottom:1px solid var(--border2); white-space:nowrap }
.im-tbl td { padding:10px 14px; border-bottom:1px solid var(--border); color:var(--text);  }
.im-tbl tr:last-child td { border-bottom:none }
.im-tbl tbody tr:hover td { background:var(--surface2) }
.im-edit-link, .im-inline-link { color:var(--teal); cursor:pointer; text-decoration:none; font-size:12.5px; font-weight:500 }
.im-inline-link { margin-right:10px }
.im-edit-link:hover, .im-inline-link:hover { text-decoration:underline }
.im-edit-input { padding:6px 10px; border:1px solid var(--border2); border-radius:8px; font-size:12.5px; background:var(--surface); color:var(--text); width:100px;  }
.im-edit-input:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg); outline:none }
.im-inline-cancel { color:var(--text3); cursor:pointer; font-size:12.5px; text-decoration:none }
.im-inline-cancel:hover { text-decoration:underline }
.im-empty { padding:30px 18px; font-size:13px; color:var(--text3); text-align:center }
</style>`;

  function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  const InterestMaster = {
    _history: [],

    render() {
      return IM_STYLES + `
<div class="im-page">
  <div class="im-card">
    <div class="im-hdr">
      <span class="im-hdr-title">INTEREST MASTER</span>
      <span class="im-hdr-note">*Denotes mandatory fields</span>
    </div>
    <div class="im-body">
      <div class="im-row">
        <span class="im-lbl"><span class="im-req">*</span>Project:</span>
        <select id="im-project">
          <option value="">--Select--</option>
        </select>
      </div>
      <div class="im-row">
        <span class="im-lbl"><span class="im-req">*</span>Interest Value(%):</span>
        <input type="text" id="im-rate" placeholder="Interest Value(%)">
      </div>
      <div class="im-row">
        <span class="im-lbl">Effective Date:</span>
        <div class="im-date-wrap">
          <span class="im-cal">&#128197;</span>
          <input type="date" id="im-date">
        </div>
      </div>
      <div class="im-btns">
        <button class="im-btn im-btn-blue" id="im-save-btn" onclick="InterestMaster.save()">SAVE</button>
        <button class="im-btn im-btn-blue" id="im-view-btn" onclick="InterestMaster.view()">VIEW</button>
        <button class="im-btn im-btn-red" onclick="InterestMaster.close()">CLOSE</button>
      </div>
      <div class="im-msg-wrap"><div id="im-msg"></div></div>
    </div>
  </div>
  <div id="im-results" class="im-results"></div>
</div>`;
    },

    async init() {
      document.getElementById('im-date').value = new Date().toISOString().slice(0, 10);
      await this.loadProjects();
    },

    async loadProjects() {
      const token = localStorage.getItem('rof-jwt') || '';
      try {
        const res = await fetch('/api/projects', { headers: { Authorization: 'Bearer ' + token } });
        const data = await res.json();
        const sel = document.getElementById('im-project');
        const list = data.projects || data.data || data;
        (Array.isArray(list) ? list : []).forEach(p => {
          const o = document.createElement('option');
          o.value = p.id;
          o.textContent = p.name;
          sel.appendChild(o);
        });
      } catch (e) { console.error('Failed to load projects', e); }
    },

    showMsg(text, isErr) {
      const el = document.getElementById('im-msg');
      el.innerHTML = `<div class="im-msg ${isErr ? 'im-msg-err' : 'im-msg-ok'}">${text}</div>`;
      setTimeout(() => { el.innerHTML = ''; }, 4000);
    },

    async save() {
      const projectId = document.getElementById('im-project').value;
      const rate      = document.getElementById('im-rate').value.trim();
      const dateVal   = document.getElementById('im-date').value;
      if (!projectId) { this.showMsg('Please select a project.', true); return; }
      if (!rate || isNaN(parseFloat(rate))) { this.showMsg('Please enter a valid interest rate.', true); return; }

      const btn = document.getElementById('im-save-btn');
      btn.disabled = true; btn.textContent = 'Saving...';
      const token = localStorage.getItem('rof-jwt') || '';
      try {
        const res = await fetch('/api/payments/interest-master', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ project_id: projectId, rate_percent: parseFloat(rate), effective_from: dateVal || undefined }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Save failed');
        this.showMsg('Interest rate saved successfully.', false);
        document.getElementById('im-rate').value = '';
      } catch (err) {
        this.showMsg('Error: ' + err.message, true);
      } finally {
        btn.disabled = false; btn.textContent = 'SAVE';
      }
    },

    async view() {
      const projectId = document.getElementById('im-project').value;
      if (!projectId) { this.showMsg('Please select a project.', true); return; }
      const projectName = document.getElementById('im-project').selectedOptions[0].textContent;

      const btn = document.getElementById('im-view-btn');
      btn.disabled = true; btn.textContent = 'Loading...';
      const token = localStorage.getItem('rof-jwt') || '';
      try {
        const res = await fetch('/api/payments/interest-master/' + projectId, {
          headers: { Authorization: 'Bearer ' + token },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Load failed');
        this._history = data.data || [];
        this.renderHistory(projectName);
      } catch (err) {
        this.showMsg('Error: ' + err.message, true);
      } finally {
        btn.disabled = false; btn.textContent = 'VIEW';
      }
    },

    renderHistory(projectName) {
      const div = document.getElementById('im-results');
      if (this._history.length === 0) {
        div.innerHTML = `<div class="im-proj-hdr"><span class="im-proj-title">PROJECT: ${projectName}</span></div><div class="im-tbl-wrap"><div class="im-empty">No interest rates configured for this project yet.</div></div>`;
        return;
      }
      let rows = '';
      this._history.forEach((r, i) => {
        rows += `
<tr id="im-row-${r.id}">
  <td>${i + 1}</td>
  <td id="im-rate-cell-${r.id}">${parseFloat(r.rate_percent).toFixed(2)}</td>
  <td>${fmtDate(r.effective_from)}</td>
  <td><a class="im-edit-link" onclick="InterestMaster.startEdit('${r.id}', ${r.rate_percent}, '${r.effective_from || ''}')">Edit</a></td>
</tr>`;
      });
      div.innerHTML = `
<div class="im-proj-hdr">
  <span class="im-proj-title">PROJECT: ${projectName}</span>
  <span class="im-proj-icons">
    <span title="Print">&#128424;</span>
    <span title="Download">&#11015;</span>
  </span>
</div>
<div class="im-tbl-wrap">
  <table class="im-tbl">
    <thead>
      <tr>
        <th style="width:8%">SR. NO.</th>
        <th style="width:42%">INTEREST VALUE(%)</th>
        <th style="width:35%">EFFECTIVE DATE</th>
        <th style="width:15%">EDIT</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</div>`;
    },

    startEdit(id, currentRate, currentDate) {
      const rateCell = document.getElementById('im-rate-cell-' + id);
      if (!rateCell) return;
      const row = document.getElementById('im-row-' + id);
      const lastTd = row.querySelector('td:last-child');
      rateCell.innerHTML = `<input class="im-edit-input" id="im-edit-rate-${id}" type="number" step="0.01" value="${parseFloat(currentRate).toFixed(2)}">`;
      lastTd.innerHTML = `<a class="im-inline-link" onclick="InterestMaster.saveEdit('${id}')">Save</a><a class="im-inline-cancel" onclick="InterestMaster.cancelEdit()">Cancel</a>`;
    },

    async saveEdit(id) {
      const input = document.getElementById('im-edit-rate-' + id);
      const newRate = parseFloat(input.value);
      if (isNaN(newRate)) { alert('Enter a valid rate'); return; }
      const token = localStorage.getItem('rof-jwt') || '';
      try {
        const res = await fetch('/api/payments/interest-master/' + id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ rate_percent: newRate }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Update failed');
        const record = this._history.find(r => r.id === id);
        if (record) record.rate_percent = newRate;
        const projectName = document.getElementById('im-project').selectedOptions[0].textContent;
        this.renderHistory(projectName);
      } catch (err) { alert('Error: ' + err.message); }
    },

    cancelEdit() {
      const projectName = document.getElementById('im-project').selectedOptions[0].textContent;
      this.renderHistory(projectName);
    },

    close() {
      document.getElementById('im-results').innerHTML = '';
      document.getElementById('im-rate').value = '';
      document.getElementById('im-date').value = new Date().toISOString().slice(0, 10);
      document.getElementById('im-project').value = '';
      document.getElementById('im-msg').innerHTML = '';
    },
  };

  window.InterestMaster = InterestMaster;

  Pages.interestMaster = (params = {}) => {
    const container = document.getElementById('content') || document.body;
    container.innerHTML = InterestMaster.render();
    InterestMaster._history = [];
    InterestMaster.init();
  };
}
