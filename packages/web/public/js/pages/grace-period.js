/**
 * Grace Period — Interest Calculation > Grace Period
 * Allows setting grace_period_days per consumer.
 * Reuses GET /api/payments/customer-wise-consumers endpoint.
 */
(() => {

  let _consumers = [];

  const GP_STYLES = `<style id="gp-styles">
.gp-page { padding:0; font-size:13px; max-width:1100px; margin:0 auto }
.gp-filter-card { margin-bottom:16px; background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:hidden }
.gp-hdr { display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; background:var(--teal-bg); padding:14px 18px; border-bottom:1px solid var(--border) }
.gp-hdr-title { color:var(--text); font-size:12px; font-weight:600; letter-spacing:.6px; text-transform:uppercase }
.gp-filter-body { padding:18px; display:flex; flex-wrap:wrap; gap:16px 18px; align-items:flex-end }
.gp-field { display:flex; flex-direction:column; gap:6px }
.gp-lbl { font-size:11px; color:var(--text2); letter-spacing:.3px; white-space:nowrap }
.gp-filter-body select, .gp-filter-body input[type="text"] { padding:9px 12px; border:1px solid var(--border2); border-radius:8px; font-size:13px; background:var(--surface); color:var(--text); min-height:38px; box-sizing:border-box }
.gp-filter-body select:focus, .gp-filter-body input[type="text"]:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg); outline:none }
.gp-filter-body select, .gp-filter-body input[type="text"] { min-width:170px }
.gp-btn-fetch { background:var(--teal); color:#fff; border:none; padding:9px 24px; border-radius:8px; font-size:12.5px; font-weight:600; cursor:pointer; min-height:38px }
.gp-btn-fetch:hover { filter:brightness(.92) }
.gp-btn-fetch:disabled { opacity:.65; cursor:default }
.gp-results-card { margin-bottom:16px; background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:hidden }
.gp-results-card { overflow-x:auto }
.gp-tbl { width:100%; border-collapse:collapse; font-size:12.5px }
.gp-tbl th { background:var(--surface2); color:var(--text3); padding:10px 14px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; text-align:left; border-bottom:1px solid var(--border2); white-space:nowrap }
.gp-tbl td { padding:10px 14px; border-bottom:1px solid var(--border); color:var(--text);  }
.gp-tbl tr:last-child td { border-bottom:none }
.gp-tbl tbody tr:hover td { background:var(--surface2) }
.gp-tbl tr.gp-row-first td { background:var(--teal-bg) }
.gp-grace-input { padding:6px 10px; border:1px solid var(--border2); border-radius:8px; font-size:12.5px; background:var(--surface); color:var(--text); width:80px; text-align:center; }
.gp-grace-input:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg); outline:none }
.gp-set-link { color:var(--teal); cursor:pointer; font-size:12.5px; font-weight:500; text-decoration:none; margin-right:8px }
.gp-set-link:hover { text-decoration:underline }
.gp-inline-msg { font-size:11px; margin-left:4px }
.gp-msg-ok { color:var(--teal) }
.gp-msg-err { color:var(--red) }
</style>`;

  function render() {
    return GP_STYLES + `
<div class="gp-page">
  <div class="gp-filter-card">
    <div class="gp-hdr">
      <span class="gp-hdr-title">GRACE PERIOD</span>
    </div>
    <div class="gp-filter-body">
      <div class="gp-field">
        <span class="gp-lbl">*Project:</span>
        <select id="gp-project">
          <option value="">&lt;--Select--&gt;</option>
        </select>
      </div>
      <div class="gp-field">
        <span class="gp-lbl">Registration No.:</span>
        <input type="text" id="gp-reg" placeholder="Reg. No.">
      </div>
      <div class="gp-field">
        <span class="gp-lbl">First Name:</span>
        <input type="text" id="gp-name" placeholder="First Name">
      </div>
      <div class="gp-field">
        <span class="gp-lbl">Unit No.:</span>
        <input type="text" id="gp-unit" placeholder="Unit No.">
      </div>
      <button class="gp-btn-fetch" id="gp-fetch-btn" onclick="GracePeriod.fetch()">FETCH</button>
    </div>
  </div>
  <div id="gp-results"></div>
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
      const sel = document.getElementById('gp-project');
      if (!sel) return;
      (data.projects || data.data || data || []).forEach(p => {
        const o = document.createElement('option');
        o.value = p.id;
        o.textContent = p.name || p.project_name;
        sel.appendChild(o);
      });
    } catch (e) {
      console.error('GracePeriod: failed to load projects', e);
    }
  }

  async function gpFetch() {
    const projectId = document.getElementById('gp-project')?.value;
    if (!projectId) { alert('Please select a project.'); return; }

    const reg  = (document.getElementById('gp-reg')?.value  || '').trim();
    const name = (document.getElementById('gp-name')?.value || '').trim();
    const unit = (document.getElementById('gp-unit')?.value || '').trim();

    const btn = document.getElementById('gp-fetch-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Loading...'; }

    const token = localStorage.getItem('rof-jwt') || '';
    try {
      const params = new URLSearchParams({ project_id: projectId });
      if (reg)  params.append('registration_no', reg);
      if (name) params.append('first_name', name);
      if (unit) params.append('unit_address', unit);

      const res = await fetch('/api/payments/customer-wise-consumers?' + params.toString(), {
        headers: { Authorization: 'Bearer ' + token },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fetch failed');
      _consumers = data.data || [];
      _renderTable();
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'FETCH'; }
    }
  }

  function _renderTable() {
    const div = document.getElementById('gp-results');
    if (!div) return;

    if (!_consumers.length) {
      div.innerHTML = `<div class="gp-results-card">
        <div class="gp-hdr"><span class="gp-hdr-title">GRACE PERIOD</span></div>
        <div style="padding:30px 18px;font-size:13px;color:var(--text3);text-align:center;">No consumers found.</div>
      </div>`;
      return;
    }

    const rows = _consumers.map((c, i) => {
      const firstCls = i === 0 ? ' gp-row-first' : '';
      const graceDays = parseInt(c.grace_period_days) || 0;
      return `<tr class="${firstCls}" data-consumer-id="${c.consumer_id}">
        <td style="text-align:center;">${i + 1}</td>
        <td>${c.registration_no || '&mdash;'}</td>
        <td style="font-weight:500;"><a href="/api/consumers/${c.consumer_id}/applicant-file?token=1" target="_blank" style="color:var(--teal);text-decoration:none;font-weight:500;cursor:pointer" title="View Applicant File">${c.name || ''}</a></td>
        <td>${c.unit_address || '&mdash;'}</td>
        <td>${c.payment_plan || '&mdash;'}</td>
        <td style="text-align:center;">
          <input type="number" class="gp-grace-input"
            id="gp-input-${c.consumer_id}"
            value="${graceDays}" min="0" max="365" step="1">
        </td>
        <td>
          <a class="gp-set-link" onclick="GracePeriod.setGrace('${c.consumer_id}')">Set</a>
          <span class="gp-inline-msg" id="gp-msg-${c.consumer_id}"></span>
        </td>
      </tr>`;
    }).join('');

    div.innerHTML = `<div class="gp-results-card">
      <div class="gp-hdr"><span class="gp-hdr-title">GRACE PERIOD</span></div>
      <div style="overflow-x:auto;">
        <table class="gp-tbl">
          <thead><tr>
            <th style="width:5%">S.NO.</th>
            <th style="width:12%">REGISTRATION NO.</th>
            <th style="width:22%">NAME</th>
            <th style="width:15%">UNIT ADDRESS</th>
            <th style="width:18%">PAYMENT PLAN</th>
            <th style="width:13%">GRACE PERIOD (DAYS)</th>
            <th style="width:15%">SET GRACE</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
  }

  async function setGrace(consumerId) {
    const input = document.getElementById('gp-input-' + consumerId);
    const msgEl = document.getElementById('gp-msg-' + consumerId);
    if (!input) return;

    const days = parseInt(input.value);
    if (isNaN(days) || days < 0) {
      if (msgEl) { msgEl.className = 'gp-inline-msg gp-msg-err'; msgEl.textContent = 'Invalid'; }
      return;
    }

    const token = localStorage.getItem('rof-jwt') || '';
    try {
      const res = await fetch('/api/payments/consumer-grace-period/' + consumerId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ grace_period_days: days }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');

      if (msgEl) {
        msgEl.className = 'gp-inline-msg gp-msg-ok';
        msgEl.textContent = '✓ Saved';
        setTimeout(() => { msgEl.textContent = ''; }, 2000);
      }
      const consumer = _consumers.find(c => c.consumer_id === consumerId);
      if (consumer) consumer.grace_period_days = days;
    } catch (e) {
      if (msgEl) { msgEl.className = 'gp-inline-msg gp-msg-err'; msgEl.textContent = 'Error: ' + e.message; }
    }
  }

  window.GracePeriod = { fetch: gpFetch, setGrace };

  Pages.gracePeriod = function(params) {
    const container = document.getElementById('content') || document.body;
    container.innerHTML = render();
    init();
  };

})();
