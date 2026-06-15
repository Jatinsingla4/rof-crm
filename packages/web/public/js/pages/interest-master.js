// ROF CRM — Interest Master Page (per-project interest rate management)

{
  const IM_STYLES = `
<style id="im-styles">
.im-page {
  padding: 18px 20px;
  font-family: Arial, sans-serif;
  font-size: 13px;
  background: #fff;
}
.im-card {
  max-width: 500px;
  margin: 0 auto;
  border: 1px solid #ccc;
  border-radius: 3px;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,.08);
}
.im-hdr {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #1d3a6e;
  padding: 7px 12px;
  border-radius: 3px 3px 0 0;
}
.im-hdr-title {
  color: #fff;
  font-size: 13px;
  font-weight: bold;
  letter-spacing: .3px;
}
.im-hdr-note {
  background: #f8d7da;
  color: #c0392b;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 3px;
  border: 1px solid #f5c6cb;
  font-weight: normal;
  white-space: nowrap;
}
.im-body {
  padding: 16px 22px 20px;
  background: #f5f5f5;
  border-top: none;
}
.im-row {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}
.im-lbl {
  width: 148px;
  font-size: 13px;
  color: #333;
  flex-shrink: 0;
}
.im-req { color: #c0392b; }
.im-row select,
.im-row input[type="text"],
.im-row input[type="number"] {
  width: 210px;
  padding: 4px 8px;
  border: 1px solid #ccc;
  border-radius: 3px;
  font-size: 13px;
  background: #fff;
  box-sizing: border-box;
}
.im-date-wrap {
  display: flex;
  align-items: center;
  width: 210px;
  border: 1px solid #ccc;
  border-radius: 3px;
  background: #fff;
  padding: 3px 6px;
  box-sizing: border-box;
}
.im-date-wrap .im-cal { margin-right: 6px; font-size: 13px; color: #555; }
.im-date-wrap input[type="date"] {
  border: none;
  outline: none;
  font-size: 13px;
  flex: 1;
  background: transparent;
  width: 100%;
  padding: 0;
}
.im-btns {
  margin-top: 18px;
  display: flex;
  gap: 5px;
}
.im-btn {
  padding: 6px 16px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: bold;
  cursor: pointer;
  color: #fff;
  letter-spacing: .2px;
}
.im-btn-blue { background: #337ab7; }
.im-btn-blue:hover { background: #2a6496; }
.im-btn-blue:disabled { background: #337ab7; opacity: .7; cursor: default; }
.im-btn-red { background: #e05c6a; }
.im-btn-red:hover { background: #c9302c; }
.im-msg-wrap { margin-top: 8px; }
.im-msg {
  padding: 6px 10px;
  border-radius: 3px;
  font-size: 12px;
}
.im-msg-ok  { background: #dff0d8; color: #3c763d; border: 1px solid #d6e9c6; }
.im-msg-err { background: #f2dede; color: #a94442; border: 1px solid #ebccd1; }
.im-results { margin-top: 14px; }
.im-proj-hdr {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 7px 10px;
  background: #fff;
  border-bottom: 1px solid #ddd;
}
.im-proj-title {
  font-size: 13px;
  font-weight: bold;
  color: #1d3a6e;
  letter-spacing: .3px;
}
.im-proj-icons { color: #c0392b; font-size: 16px; }
.im-proj-icons span { margin-left: 8px; cursor: pointer; }
.im-tbl-wrap { border: 1px solid #ddd; border-top: none; }
.im-tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.im-tbl th {
  background: #1d3a6e;
  color: #fff;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: normal;
  text-align: left;
  border-right: 1px solid rgba(255,255,255,.15);
}
.im-tbl th:last-child { border-right: none; }
.im-tbl td {
  padding: 7px 10px;
  border-bottom: 1px solid #e8e8e8;
  border-right: 1px solid #eee;
  color: #333;
}
.im-tbl td:last-child { border-right: none; }
.im-tbl tr:last-child td { border-bottom: none; }
.im-edit-link {
  color: #337ab7;
  cursor: pointer;
  text-decoration: none;
  font-size: 13px;
}
.im-edit-link:hover { text-decoration: underline; }
.im-edit-input {
  width: 90px;
  padding: 3px 6px;
  border: 1px solid #ccc;
  border-radius: 3px;
  font-size: 13px;
}
.im-inline-link {
  color: #337ab7;
  cursor: pointer;
  font-size: 13px;
  text-decoration: none;
  margin-right: 8px;
}
.im-inline-link:hover { text-decoration: underline; }
.im-inline-cancel {
  color: #999;
  cursor: pointer;
  font-size: 13px;
  text-decoration: none;
}
.im-inline-cancel:hover { text-decoration: underline; }
.im-empty { padding: 12px 10px; font-size: 13px; color: #777; }
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
