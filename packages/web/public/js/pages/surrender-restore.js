(() => {

  const SR_STYLES = `<style id="sr-styles">
.sr-page { padding: 0; font-family: Arial, sans-serif; font-size: 13px; }
.sr-card { background: #fff; border: 1px solid #ddd; border-radius: 3px; margin-bottom: 10px; }
.sr-hdr {
  display: flex; justify-content: space-between; align-items: center;
  background: #1d3a6e; padding: 7px 12px; border-radius: 3px 3px 0 0;
}
.sr-hdr-title { color: #fff; font-size: 13px; font-weight: bold; }
.sr-body { padding: 14px 16px 16px; }
.sr-type-toggle { display: flex; gap: 0; margin-bottom: 12px; }
.sr-type-btn {
  padding: 6px 18px; border: 2px solid #17a2b8; font-size: 13px;
  font-weight: bold; cursor: pointer; background: #fff; color: #17a2b8; transition: all .15s;
}
.sr-type-btn:first-child { border-radius: 3px 0 0 3px; }
.sr-type-btn:last-child { border-radius: 0 3px 3px 0; }
.sr-type-btn.sr-active { background: #17a2b8; color: #fff; }
.sr-filter-grid {
  display: grid; grid-template-columns: 180px 150px 130px 150px 150px 150px auto;
  gap: 8px 12px; align-items: end; margin-bottom: 10px;
}
.sr-field { display: flex; flex-direction: column; gap: 3px; }
.sr-lbl { font-size: 11px; color: #555; white-space: nowrap; }
.sr-field select, .sr-field input {
  padding: 5px 7px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px; width: 100%; box-sizing: border-box;
}
.sr-field select:focus, .sr-field input:focus { outline: none; border-color: #337ab7; }
.sr-btn-fetch {
  background: #1d3a6e; color: #fff; border: none; padding: 6px 20px;
  border-radius: 3px; font-size: 13px; font-weight: bold; cursor: pointer;
}
.sr-btn-fetch:hover { background: #16305c; }
.sr-btn-fetch:disabled { opacity: .7; cursor: not-allowed; }
.sr-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.sr-table th { background: #1d3a6e; color: #fff; padding: 6px 8px; text-align: center; font-weight: bold; white-space: nowrap; }
.sr-table td { padding: 5px 8px; border-bottom: 1px solid #eee; vertical-align: middle; text-align: center; }
.sr-table tr:nth-child(even) td { background: #f9fbff; }
.sr-table tr:hover td { background: #eef4ff; }
.sr-table td.sr-left { text-align: left; }
.sr-btn-restore {
  background: #337ab7; color: #fff; border: none; padding: 4px 12px;
  border-radius: 3px; font-size: 12px; cursor: pointer;
}
.sr-btn-restore:hover { background: #286090; }
.sr-success-msg { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 8px 12px; border-radius: 3px; margin-bottom: 8px; font-size: 12px; font-weight: bold; }
.sr-error-msg { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 8px 12px; border-radius: 3px; margin-bottom: 8px; font-size: 12px; }
</style>`;

  let _type = 'surrender';
  let _projects = [];
  let _towers = [];
  let _rows = [];

  function _tok() { return (window.Auth && Auth.getToken && Auth.getToken()) || localStorage.getItem('rof-jwt') || ''; }
  function _fmtDate(d) {
    if (!d) return 'N/A';
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  function _v(v) { return v || 'N/A'; }

  function _toggleType(t) {
    _type = t;
    document.querySelectorAll('.sr-type-btn').forEach(b => b.classList.toggle('sr-active', b.dataset.type === t));
  }

  async function _loadProjects() {
    try {
      const res = await fetch('/api/projects', { headers: { 'Authorization': 'Bearer ' + _tok() } });
      const data = await res.json();
      _projects = data.data || data || [];
      const sel = document.getElementById('sr-project');
      if (sel) {
        sel.innerHTML = '<option value="">--Select--</option>' +
          _projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
      }
    } catch(e) {}
  }

  async function _onProjectChange() {
    const projectId = document.getElementById('sr-project').value;
    const tsel = document.getElementById('sr-tower');
    if (!tsel) return;
    if (!projectId) { tsel.innerHTML = '<option value="">--All Towers--</option>'; return; }
    try {
      const res = await fetch(`/api/units/towers?projectId=${projectId}`, { headers: { 'Authorization': 'Bearer ' + _tok() } });
      const data = await res.json();
      _towers = data.data || data || [];
      tsel.innerHTML = '<option value="">--All Towers--</option>' +
        _towers.map(t => `<option value="${t.id}">${t.tower_name}</option>`).join('');
    } catch(e) {
      tsel.innerHTML = '<option value="">--All Towers--</option>';
    }
  }

  async function _fetch() {
    const projectId = document.getElementById('sr-project').value;
    if (!projectId) { alert('Please select a project.'); return; }

    const btn = document.querySelector('.sr-btn-fetch');
    if (btn) { btn.disabled = true; btn.textContent = 'Loading...'; }

    const msgEl = document.getElementById('sr-msg');
    if (msgEl) msgEl.innerHTML = '';

    try {
      const params = new URLSearchParams({ projectId, type: _type });
      const noc = document.getElementById('sr-noc')?.value;
      const regno = document.getElementById('sr-regno')?.value.trim();
      const fname = document.getElementById('sr-fname')?.value.trim();
      const unit = document.getElementById('sr-unit')?.value.trim();
      if (noc && noc !== 'all') params.append('noc', noc);
      if (regno) params.append('registrationNo', regno);
      if (fname) params.append('firstName', fname);
      if (unit) params.append('unitAddress', unit);

      const res = await fetch(`/api/surrender/list?${params}`, {
        headers: { 'Authorization': 'Bearer ' + _tok() }
      });
      const data = await res.json();
      _rows = data.data || [];
      _renderTable();
    } catch(e) {
      const me = document.getElementById('sr-msg');
      if (me) me.innerHTML = `<div class="sr-error-msg">Error: ${e.message}</div>`;
    } finally {
      const b = document.querySelector('.sr-btn-fetch');
      if (b) { b.disabled = false; b.textContent = 'FETCH'; }
    }
  }

  function _renderTable() {
    const tbody = document.getElementById('sr-tbody');
    if (!tbody) return;

    if (_rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#888;padding:20px">No records found.</td></tr>`;
      return;
    }

    tbody.innerHTML = _rows.map((r, i) => {
      const isRestored = r.status === 'restored' || r.refund_status === 'restored';
      return `<tr>
        <td>${i+1}</td>
        <td>${_v(r.registration_no)}</td>
        <td class="sr-left">${_v(r.full_name)}</td>
        <td>${_v(r.unit_number)}</td>
        <td>${_v(r.tower_name)}</td>
        <td>${_fmtDate(r.cancellation_date || r.surrender_date || r.created_at)}</td>
        <td>${r.surrender_type || _type}</td>
        <td>${isRestored ? 'Restored' : (r.status || r.refund_status || 'Pending')}</td>
        <td>
          ${isRestored
            ? '<span style="color:#888;font-size:11px">Restored</span>'
            : `<button class="sr-btn-restore" onclick="SurrenderRestore._restore(${i})">Restore</button>`
          }
        </td>
      </tr>`;
    }).join('');
  }

  async function _restore(idx) {
    const r = _rows[idx];
    if (!r) return;

    if (!window.confirm('Restore this applicant? This will reactivate their booking.')) return;

    const msgEl = document.getElementById('sr-msg');
    try {
      const res = await fetch('/api/surrender/restore', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + _tok(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surrenderId: r.id,
          type: _type,
          consumerId: r.consumer_id,
          allocationId: r.allocation_id,
          unitId: r.unit_id,
          bookingId: r.booking_record_id,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Restore failed');
      if (msgEl) msgEl.innerHTML = `<div class="sr-success-msg">Applicant restored successfully.</div>`;
      await _fetch();
    } catch(e) {
      if (msgEl) msgEl.innerHTML = `<div class="sr-error-msg">Error: ${e.message}</div>`;
    }
  }

  function _renderPage() {
    return `${SR_STYLES}
      <div class="sr-page">
        <div class="sr-card">
          <div class="sr-hdr"><span class="sr-hdr-title">SURRENDER RESTORE</span></div>
          <div class="sr-body">
            <div class="sr-type-toggle">
              <button class="sr-type-btn sr-active" data-type="surrender" onclick="SurrenderRestore._toggleType('surrender')">Surrender</button>
              <button class="sr-type-btn" data-type="cancellation" onclick="SurrenderRestore._toggleType('cancellation')">Cancellation</button>
            </div>
            <div class="sr-filter-grid">
              <div class="sr-field">
                <span class="sr-lbl">Project*</span>
                <select id="sr-project" onchange="SurrenderRestore._onProjectChange()">
                  <option value="">--Select--</option>
                </select>
              </div>
              <div class="sr-field">
                <span class="sr-lbl">Tower</span>
                <select id="sr-tower"><option value="">--All Towers--</option></select>
              </div>
              <div class="sr-field">
                <span class="sr-lbl">NOC</span>
                <select id="sr-noc">
                  <option value="all">All</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div class="sr-field">
                <span class="sr-lbl">Registration No.</span>
                <input id="sr-regno" type="text" placeholder="Registration No.">
              </div>
              <div class="sr-field">
                <span class="sr-lbl">First Name</span>
                <input id="sr-fname" type="text" placeholder="First Name">
              </div>
              <div class="sr-field">
                <span class="sr-lbl">Unit Address</span>
                <input id="sr-unit" type="text" placeholder="Unit Address">
              </div>
              <div class="sr-field">
                <span class="sr-lbl">&nbsp;</span>
                <button class="sr-btn-fetch" onclick="SurrenderRestore._fetch()">FETCH</button>
              </div>
            </div>
            <div id="sr-msg"></div>
          </div>
        </div>

        <div class="sr-card">
          <div class="sr-hdr"><span class="sr-hdr-title">SURRENDER RESTORE LIST</span></div>
          <div style="overflow-x:auto">
            <table class="sr-table">
              <thead><tr>
                <th>S.NO</th><th>REGISTRATION NO</th><th>NAME</th>
                <th>UNIT ADDRESS</th><th>TOWER</th><th>SURRENDER DATE</th>
                <th>TYPE</th><th>STATUS</th><th>ACTION</th>
              </tr></thead>
              <tbody id="sr-tbody">
                <tr><td colspan="9" style="text-align:center;color:#888;padding:20px">Select a project and click FETCH.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
  }

  window.SurrenderRestore = {
    _toggleType,
    _onProjectChange,
    _fetch,
    _restore,
  };

  Pages.surrenderRestore = function(params) {
    const container = document.getElementById('content') || document.body;
    container.innerHTML = _renderPage();
    _loadProjects();
  };

})();
