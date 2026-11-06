// ROF CRM — Demand Management Page

Pages.demands = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <style>
      #content:has(.dmn) { margin-left:auto; margin-right:auto; width:100% }
      .dmn { max-width:1500px; margin:0 auto; --bg2:var(--surface2) }
      .dmn .tabs-line { display:flex; gap:8px; flex-wrap:wrap; border-bottom:none; margin-bottom:16px }
      .dmn .tab-line { padding:7px 16px; font-size:12.5px; border:1px solid var(--border2); border-radius:999px; background:var(--surface); color:var(--text2); cursor:pointer; transition:.15s }
      .dmn .tab-line:hover { border-color:var(--teal); color:var(--teal) }
      .dmn .tab-line.active { background:var(--teal); color:#fff; border-color:var(--teal); font-weight:600 }
      .dmn .sp { background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:hidden }
      .dmn .sp-hdr { padding:14px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border) }
      .dmn .sp-title { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
      .dmn .sp-body { padding:18px }
      .dmn .fg { gap:6px }
      .dmn .fl { font-size:11px; font-weight:500; text-transform:none; letter-spacing:.3px; color:var(--text2) }
      .dmn .fc { padding:9px 12px; font-size:13px; border-radius:8px; min-height:38px }
      .dmn .fc:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg) }
      .dmn .btn-fetch, .dmn .btn-accent { background:var(--teal) !important; color:#fff !important; border:none; padding:9px 24px; min-height:38px; border-radius:8px; font-size:12.5px; font-weight:600; cursor:pointer }
      .dmn .btn-accent.btn-sm { min-height:30px; padding:5px 14px; font-size:12px; border-radius:6px }
      .dmn .btn-fetch:hover, .dmn .btn-accent:hover { filter:brightness(.92) }
      .dmn .btn-ghost.btn-sm { min-height:30px; padding:5px 12px; font-size:12px; border-radius:6px }
      .dmn .tbl-wrap { background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:hidden }
      .dmn .tbl-hdr { padding:12px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border); flex-wrap:wrap }
      .dmn .tbl-title { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
      .dmn .tbl-actions { margin-left:auto; display:flex; gap:8px; flex-wrap:wrap }
      .dmn #penal-body { background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:auto }
      .dmn #penal-body:empty { display:none }
      .dmn table { width:100%; border-collapse:collapse; font-size:12.5px }
      .dmn table th { background:var(--surface2); color:var(--text3); font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; padding:10px 14px; text-align:left; white-space:nowrap; border-bottom:1px solid var(--border2) }
      .dmn table td { padding:9px 14px; border-bottom:1px solid var(--border); color:var(--text) }
      .dmn table tbody tr:hover td { background:var(--surface2) }
      .dmn .tfoot-total td, .dmn tfoot td { background:var(--surface2); font-weight:700; border-top:1px solid var(--border2) }
      .dmn .kpi { border:1px solid var(--border2); border-left:3px solid var(--teal); border-radius:10px }
      .dmn .empty-state { padding:36px 18px; text-align:center; color:var(--text3) }
      .dmn .empty-state h3 { font-size:14px; font-weight:600; color:var(--text2); margin:0 0 4px }
    </style>
    <div class="dmn">
    <div class="page-hdr">
      <h1>Demand Management</h1>
      <div class="breadcrumb">Application / <b>Demand Overview</b></div>
    </div>
    <div class="tabs-line">
      <button class="tab-line active" data-group="dem" data-tab="overview" onclick="switchTab('dem','overview')">Overview</button>
      <button class="tab-line" data-group="dem" data-tab="status" onclick="switchTab('dem','status');DemandsPage.loadStatus()">Demand Status</button>
      <button class="tab-line" data-group="dem" data-tab="penal" onclick="switchTab('dem','penal');DemandsPage.loadPenal()">Penal Interest</button>
    </div>

    <!-- OVERVIEW TAB -->
    <div data-panel-group="dem" data-panel="overview">
      <div class="kpi-row" id="demand-kpis">
        ${[...Array(5)].map(() => `<div class="kpi"><div class="page-loading"><div class="spinner"></div></div></div>`).join('')}
      </div>
      <div class="tbl-wrap" style="margin-top:14px">
        <div class="tbl-hdr">
          <div class="tbl-title">Demand Records</div>
          <div class="tbl-actions">
            <button class="btn btn-accent btn-sm" onclick="Router.navigate('/demand-raise')">Raise New Demand</button>
            <button class="btn btn-ghost btn-sm" onclick="DemandsPage.sendAllUnsent()">Send All Unsent</button>
            
          </div>
        </div>
        <div id="demands-tbl-body"><div class="page-loading"><div class="spinner"></div> Loading…</div></div>
      </div>
    </div>

    <!-- DEMAND STATUS TAB -->
    <div data-panel-group="dem" data-panel="status" style="display:none">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Demand Status Filters</div></div>
        <div class="sp-body">
          <div class="sp-grid">
            <div class="fg"><label class="fl">Project</label>
              <select class="fc" id="ds-project">
                <option value="">— All Projects —</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Consumer</label>
              <select class="fc" id="ds-consumer">
                <option value="">— All Consumers —</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Demand Type</label>
              <select class="fc" id="ds-type">
                <option value="">— All Types —</option>
                <option value="main">Main Demand</option>
                <option value="reminder_1">Reminder 1</option>
                <option value="reminder_2">Reminder 2</option>
                <option value="termination">Termination Notice</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Send Status</label>
              <select class="fc" id="ds-send-status">
                <option value="">— All —</option>
                <option value="sent">Sent</option>
                <option value="unsent">Unsent</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            <div class="fg"><label class="fl">From Date</label>
              <input type="date" class="fc" id="ds-from" value="${Utils.monthStart()}">
            </div>
            <div class="fg"><label class="fl">To Date</label>
              <input type="date" class="fc" id="ds-to" value="${Utils.today()}">
            </div>
          </div>
          <button class="btn btn-fetch" style="margin-top:10px" onclick="DemandsPage.loadStatus()">FETCH</button>
        </div>
      </div>

      <!-- Status Summary Cards -->
      <div id="ds-kpis" class="kpi-row" style="margin-bottom:12px"></div>

      <!-- Demand Status Matrix (reference style) -->
      <div class="tbl-wrap">
        <div class="tbl-hdr">
          <div class="tbl-title">Demand Status Report</div>
          <div class="tbl-actions">
            
          </div>
        </div>
        <div id="ds-body"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
    </div>

    <!-- PENAL INTEREST TAB -->
    <div data-panel-group="dem" data-panel="penal" style="display:none">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">HRERA Rule 15 — Penal Interest (11.10% p.a.)</div></div>
        <div class="sp-body">
          <div class="sp-grid">
            <div class="fg"><label class="fl">Project</label>
              <select class="fc" id="pi-project">
                <option value="">— All Projects —</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Min Days Overdue</label>
              <input type="number" class="fc" id="pi-min-days" value="1" min="1">
            </div>
          </div>
          <button class="btn btn-fetch" style="margin-top:10px" onclick="DemandsPage.loadPenal()">FETCH</button>
        </div>
      </div>
      <div id="penal-kpis" class="kpi-row" style="margin-bottom:12px"></div>
      <div id="penal-body"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>
    </div>
  `;

  await DemandsPage.init(params);
};

const DemandsPage = {
  _list: [],

  async init(params = {}) {
    await Promise.allSettled([
      this.loadOverview(),
      this.loadDropdowns(),
    ]);

    if (params.tab && params.tab !== 'overview') {
      setTimeout(() => {
        const btn = document.querySelector(`[data-group="dem"][data-tab="${params.tab}"]`);
        if (btn) btn.click();
      }, 100);
    }
  },

  async loadDropdowns() {
    try {
      const [projRes, consRes] = await Promise.allSettled([
        window.ProjectCache.load(),
        Api.get('/consumers', { params: { pageSize: 300 } }),
      ]);

      const projects = projRes.status === 'fulfilled' ? (projRes.value.data || projRes.value || []) : [];
      const consumers = consRes.status === 'fulfilled' ? (consRes.value.data || consRes.value || []) : [];

      ['ds-project','pi-project'].forEach(id => {
        const sel = document.getElementById(id);
        if (sel) sel.innerHTML = '<option value="">— All Projects —</option>' +
          projects.map(p => `<option value="${p.id}">${Utils.esc(p.name)}</option>`).join('');
      });

      const cSel = document.getElementById('ds-consumer');
      if (cSel) cSel.innerHTML = '<option value="">— All Consumers —</option>' +
        consumers.map(c => `<option value="${c.id}">${c.name||`${c.first_name||''} ${c.last_name||''}`} · ${c.mobile||''}</option>`).join('');
    } catch {}
  },

  async loadOverview() {
    try {
      const res = await Api.get('/payments/demands', { params: { page: 1, pageSize: 200 } });
      const list = res.data || res || [];
      this._list = list;

      const main  = list.filter(d => !d.demand_type || d.demand_type === 'main');
      const r1    = list.filter(d => d.demand_type === 'reminder_1');
      const r2    = list.filter(d => d.demand_type === 'reminder_2');
      const term  = list.filter(d => d.demand_type === 'termination');
      const osAmt = list.reduce((s,d) => s + parseFloat(d.amount_due_inr||d.amount||0), 0);

      document.getElementById('demand-kpis').innerHTML = `
        <div class="kpi c-accent"><div class="kpi-lbl">Total Demands</div><div class="kpi-val">${list.length}</div><div class="kpi-sub">All stages</div></div>
        <div class="kpi c-blue"><div class="kpi-lbl">Main Demand</div><div class="kpi-val">${main.length}</div><div class="kpi-sub">${main.filter(d=>d.sent_at).length} sent · ${main.filter(d=>!d.sent_at).length} unsent</div></div>
        <div class="kpi c-warn"><div class="kpi-lbl">Reminders</div><div class="kpi-val">${r1.length + r2.length}</div><div class="kpi-sub">R1: ${r1.length} · R2: ${r2.length}</div></div>
        <div class="kpi c-red"><div class="kpi-lbl">Termination</div><div class="kpi-val">${term.length}</div><div class="kpi-sub">${term.filter(d=>d.sent_at).length} sent</div></div>
        <div class="kpi c-gold"><div class="kpi-lbl">O/S Amount</div><div class="kpi-val">${Utils.currency(osAmt)}</div><div class="kpi-sub">Total outstanding</div></div>
      `;

      this.renderTable(list);
    } catch (err) {
      document.getElementById('demands-tbl-body').innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`;
    }
  },

  renderTable(list) {
    const el = document.getElementById('demands-tbl-body');
    if (!el) return;
    if (list.length === 0) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">📄</div><h3>No demand records</h3></div>`;
      return;
    }

    const totalAmt = list.reduce((s,d) => s + parseFloat(d.amount_due_inr||d.amount||0), 0);

    el.innerHTML = `
      <table>
        <thead><tr><th>Demand ID</th><th>Consumer</th><th>Unit</th><th>Project</th><th>Instalment</th><th>Amount</th><th>Due Date</th><th>Type</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>
          ${list.map(d => {
            const paid = d.delivery_status === 'paid';
            const sent = paid || d.sent_at || d.delivery_status === 'sent' || d.delivery_status === 'delivered';
            const dtype = d.demand_type || 'main';
            const typeMap = { main:'Demand', reminder_1:'Reminder 1', reminder_2:'Reminder 2', termination:'Termination' };
            const clsMap  = { main:'ch-blue', reminder_1:'ch-warn', reminder_2:'ch-red', termination:'ch-accent' };
            const dueDate = d.due_date || d.dueDate;
            const isOverdue = !paid && dueDate && new Date(dueDate) < new Date();
            const statusChipCls = paid ? 'ch-teal' : sent ? 'ch-green' : 'ch-gray';
            const statusChipTxt = paid ? 'Paid' : sent ? 'Sent' : 'Unsent';
            return `<tr>
              <td class="td-mono">${(d.id||'').slice(0,8)}</td>
              <td class="td-bold"><a href="/api/consumers/${d.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" onclick="event.stopPropagation()" style="color:var(--teal);text-decoration:none;font-weight:600;cursor:pointer" title="View Applicant File">${d.consumer_name||d.consumerName||'—'}</a></td>
              <td>${d.unit_no||d.unitNo||'—'}</td>
              <td style="font-size:10.5px">${d.project_name||d.projectName||'—'}</td>
              <td style="font-size:10.5px">${d.instalment_name||d.instalmentName||'—'}</td>
              <td style="font-weight:600">${Utils.currency(d.amount_due_inr||d.amount||0)}</td>
              <td style="font-size:10.5px;${isOverdue?'color:var(--red);font-weight:600':'color:var(--warn)'}">${Utils.date(dueDate)}</td>
              <td><span class="chip ${clsMap[dtype]||'ch-blue'}">${typeMap[dtype]||dtype}</span></td>
              <td><span class="chip ${statusChipCls}">${statusChipTxt}</span></td>
              <td><div style="display:flex;gap:3px">
                <button class="btn btn-ghost btn-sm" onclick="DemandsPage.printDemandLetter('${d.consumer_id}','${d.id}',this,'${dueDate||''}')">Print</button>
                ${paid ? '' : `<button class="btn ${sent?'btn-ghost':'btn-teal'} btn-sm" onclick="DemandsPage.sendDemand('${d.id}',this)">${sent?'Re-Send':'Send'}</button>`}
              </div></td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot>
          <tr class="tfoot-total">
            <td colspan="5"><strong>Total</strong></td>
            <td style="font-weight:700">${Utils.currency(totalAmt)}</td>
            <td colspan="4">${list.length} demands</td>
          </tr>
        </tfoot>
      </table>`;
  },

  async loadStatus() {
    const el = document.getElementById('ds-body');
    const kpiEl = document.getElementById('ds-kpis');
    if (!el) return;
    el.innerHTML = '<div class="page-loading"><div class="spinner"></div> Loading…</div>';

    try {
      const params = { page: 1, pageSize: 500 };
      const projectId = document.getElementById('ds-project')?.value;
      const consumerId = document.getElementById('ds-consumer')?.value;
      const dtype     = document.getElementById('ds-type')?.value;
      const sendSt    = document.getElementById('ds-send-status')?.value;
      const from      = document.getElementById('ds-from')?.value;
      const to        = document.getElementById('ds-to')?.value;

      if (projectId)  params.projectId  = projectId;
      if (consumerId) params.consumerId = consumerId;
      if (dtype)      params.demandType = dtype;
      if (from)       params.from = from;
      if (to)         params.to   = to;

      const res = await Api.get('/payments/demands', { params });
      let list = res.data || res || [];

      // Client-side filter for send status
      const isPaid   = d => d.delivery_status === 'paid';
      const isSent   = d => d.sent_at || d.delivery_status === 'sent' || d.delivery_status === 'delivered' || d.delivery_status === 'paid';
      const isUnsent = d => !d.sent_at && d.delivery_status !== 'sent' && d.delivery_status !== 'delivered' && d.delivery_status !== 'paid';
      if (sendSt === 'sent')   list = list.filter(isSent);
      if (sendSt === 'unsent') list = list.filter(isUnsent);
      if (sendSt === 'paid')   list = list.filter(isPaid);

      // KPI summary
      const totalAmt  = list.reduce((s,d) => s + parseFloat(d.amount_due_inr||d.amount||0), 0);
      const sentCount = list.filter(isSent).length;
      const unsentCnt = list.filter(isUnsent).length;
      const overdueC  = list.filter(d => { const dd = d.due_date||d.dueDate; return dd && new Date(dd) < new Date() && !isPaid(d); }).length;

      if (kpiEl) kpiEl.innerHTML = `
        <div class="kpi c-accent"><div class="kpi-lbl">Total Demands</div><div class="kpi-val">${list.length}</div><div class="kpi-sub">In filter</div></div>
        <div class="kpi c-green"><div class="kpi-lbl">Sent</div><div class="kpi-val">${sentCount}</div><div class="kpi-sub">Delivered to consumer</div></div>
        <div class="kpi c-warn"><div class="kpi-lbl">Unsent</div><div class="kpi-val">${unsentCnt}</div><div class="kpi-sub">Pending delivery</div></div>
        <div class="kpi c-red"><div class="kpi-lbl">Overdue</div><div class="kpi-val">${overdueC}</div><div class="kpi-sub">Past due date</div></div>
        <div class="kpi c-gold"><div class="kpi-lbl">Outstanding</div><div class="kpi-val">${Utils.currency(totalAmt)}</div><div class="kpi-sub">Total due</div></div>
      `;

      if (list.length === 0) {
        el.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><h3>No demands match the selected filters</h3></div>';
        return;
      }

      const grandTotal = list.reduce((s,d) => s + parseFloat(d.amount_due_inr||d.amount||0), 0);

      el.innerHTML = `
        <table>
          <thead>
            <tr>
              <th>S.No.</th>
              <th>Consumer</th>
              <th>Unit</th>
              <th>Project</th>
              <th>Instalment</th>
              <th>Due Date</th>
              <th>Amount (₹)</th>
              <th>Type</th>
              <th>Sent Status</th>
              <th>Sent On</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${list.map((d,i) => {
              const paid   = d.delivery_status === 'paid';
              const sent   = paid || d.sent_at || d.delivery_status === 'sent' || d.delivery_status === 'delivered';
              const dueDate = d.due_date || d.dueDate;
              const isOverdue = !paid && dueDate && new Date(dueDate) < new Date();
              const dtype  = d.demand_type || 'main';
              const typeMap = { main:'Main Demand', reminder_1:'Reminder 1', reminder_2:'Reminder 2', termination:'Termination' };
              const clsMap  = { main:'ch-blue', reminder_1:'ch-warn', reminder_2:'ch-red', termination:'ch-accent' };
              const statusChipCls = paid ? 'ch-teal' : sent ? 'ch-green' : 'ch-gray';
              const statusChipTxt = paid ? 'Paid' : sent ? 'Sent' : 'Unsent';
              return `<tr>
                <td>${i+1}</td>
                <td class="td-bold"><a href="/api/consumers/${d.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" onclick="event.stopPropagation()" style="color:var(--teal);text-decoration:none;font-weight:600;cursor:pointer" title="View Applicant File">${d.consumer_name||d.consumerName||'—'}</a></td>
                <td>${d.unit_no||d.unitNo||'—'}</td>
                <td style="font-size:10.5px">${d.project_name||d.projectName||'—'}</td>
                <td style="font-size:10.5px">${d.instalment_name||d.instalmentName||'—'}</td>
                <td style="font-size:10.5px;${isOverdue?'color:var(--red);font-weight:600':''}">${Utils.date(dueDate)}</td>
                <td style="font-weight:600">${Utils.currency(d.amount_due_inr||d.amount||0)}</td>
                <td><span class="chip ${clsMap[dtype]||'ch-blue'}">${typeMap[dtype]||dtype}</span></td>
                <td><span class="chip ${statusChipCls}">${statusChipTxt}</span></td>
                <td style="font-size:10.5px">${sent ? Utils.date(d.sent_at||d.sentAt) : '—'}</td>
                <td><div style="display:flex;gap:3px">
                  <button class="btn btn-ghost btn-sm" onclick="DemandsPage.printDemandLetter('${d.consumer_id}','${d.id}',this,'${dueDate||''}')">Print</button>
                  ${paid ? '' : `<button class="btn ${sent?'btn-ghost':'btn-teal'} btn-sm" onclick="DemandsPage.sendDemand('${d.id}',this)">${sent?'Re-Send':'Send'}</button>`}
                </div></td>
              </tr>`;
            }).join('')}
          </tbody>
          <tfoot>
            <tr class="tfoot-total">
              <td colspan="6"><strong>Total</strong></td>
              <td style="font-weight:700">${Utils.currency(grandTotal)}</td>
              <td colspan="4">${list.length} records</td>
            </tr>
          </tfoot>
        </table>`;
    } catch (err) { el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`; }
  },

  async loadPenal() {
    const el = document.getElementById('penal-body');
    const kpiEl = document.getElementById('penal-kpis');
    if (!el) return;
    el.innerHTML = '<div class="page-loading"><div class="spinner"></div> Loading…</div>';

    try {
      const projectId = document.getElementById('pi-project')?.value;
      const minDays   = parseInt(document.getElementById('pi-min-days')?.value || '1');
      const params    = { page: 1, pageSize: 200 };
      if (projectId) params.projectId = projectId;

      const res  = await Api.get('/payments/overdue', { params });
      let list   = res.data || res || [];
      list = list.filter(d => (d.days_overdue||d.daysOverdue||0) >= minDays);

      const totalOverdue = list.reduce((s,d) => s + parseFloat(d.amount_due_inr||d.amount||0), 0);
      const totalPenal   = list.reduce((s,d) => s + parseFloat(d.penal_interest_inr||d.penalInterestInr||0), 0);
      const avgDays      = list.length ? Math.round(list.reduce((s,d) => s + (d.days_overdue||0), 0) / list.length) : 0;

      if (kpiEl) kpiEl.innerHTML = `
        <div class="kpi c-red"><div class="kpi-lbl">Overdue Cases</div><div class="kpi-val">${list.length}</div><div class="kpi-sub">Min ${minDays} day(s)</div></div>
        <div class="kpi c-warn"><div class="kpi-lbl">Overdue Principal</div><div class="kpi-val">${Utils.currency(totalOverdue)}</div><div class="kpi-sub">Total outstanding</div></div>
        <div class="kpi c-accent"><div class="kpi-lbl">Penal Interest</div><div class="kpi-val">${Utils.currency(totalPenal)}</div><div class="kpi-sub">@11.10% p.a. (HRERA Rule 15)</div></div>
        <div class="kpi c-purple"><div class="kpi-lbl">Avg Days Overdue</div><div class="kpi-val">${avgDays}</div><div class="kpi-sub">days</div></div>
        <div class="kpi c-gold"><div class="kpi-lbl">Total Payable</div><div class="kpi-val">${Utils.currency(totalOverdue + totalPenal)}</div><div class="kpi-sub">Principal + Interest</div></div>
      `;

      el.innerHTML = list.length === 0
        ? '<div class="empty-state"><div class="empty-icon">✅</div><h3>No overdue accounts match filter</h3></div>'
        : `<table>
            <thead><tr><th>Consumer</th><th>Mobile</th><th>Unit</th><th>Project</th><th>Principal (₹)</th><th>Days Overdue</th><th>Penal Interest (₹)</th><th>Total Payable (₹)</th></tr></thead>
            <tbody>
              ${list.map(d => `<tr>
                <td class="td-bold"><a href="/api/consumers/${d.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" onclick="event.stopPropagation()" style="color:var(--teal);text-decoration:none;font-weight:600;cursor:pointer" title="View Applicant File">${d.consumer_name||d.name||'—'}</a></td>
                <td>${d.mobile||'—'}</td>
                <td>${d.unit_no||d.unitNo||'—'}</td>
                <td style="font-size:10.5px">${d.project_name||d.projectName||'—'}</td>
                <td style="font-weight:600;color:var(--red)">${Utils.currency(d.amount_due_inr||d.amount||0)}</td>
                <td style="font-weight:700;color:var(--red)">${d.days_overdue||d.daysOverdue||0}</td>
                <td style="color:var(--accent)">${Utils.currency(d.penal_interest_inr||d.penalInterestInr||0)}</td>
                <td style="font-weight:700">${Utils.currency((d.amount_due_inr||0) + (d.penal_interest_inr||0))}</td>
              </tr>`).join('')}
            </tbody>
            <tfoot>
              <tr class="tfoot-total">
                <td colspan="4"><strong>Total</strong></td>
                <td style="font-weight:700;color:var(--red)">${Utils.currency(totalOverdue)}</td>
                <td></td>
                <td style="font-weight:700;color:var(--accent)">${Utils.currency(totalPenal)}</td>
                <td style="font-weight:700">${Utils.currency(totalOverdue + totalPenal)}</td>
              </tr>
            </tfoot>
          </table>`;
    } catch (err) { el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`; }
  },

  async sendDemand(demandId, btn) {
    btn.disabled = true;
    const orig = btn.textContent;
    btn.textContent = 'Sending…';
    try {
      await Api.patch(`/payments/demands/${demandId}/send`, { channel: 'email' });
      Utils.success('Demand letter sent');
      btn.textContent = 'Re-Send';
      btn.classList.remove('btn-teal'); btn.classList.add('btn-ghost');
      const row = btn.closest('tr');
      if (row) {
        const chip = row.querySelector('.ch-gray');
        if (chip) { chip.className = 'chip ch-green'; chip.textContent = 'Sent'; }
      }
    } catch (err) {
      Utils.error(err.message); btn.textContent = orig;
    }
    btn.disabled = false;
  },

  async sendAllUnsent() {
    const unsent = this._list.filter(d => !d.sent_at && d.delivery_status !== 'sent' && d.delivery_status !== 'delivered' && d.delivery_status !== 'paid');
    if (!unsent.length) { Utils.info('No unsent demands'); return; }
    Utils.confirm(`Send ${unsent.length} unsent demands?`, async () => {
      let ok = 0;
      for (const d of unsent) {
        try { await Api.patch(`/payments/demands/${d.id}/send`, { channel:'email' }); ok++; } catch {}
      }
      Utils.success(`${ok} of ${unsent.length} demands sent`);
      await this.loadOverview();
    });
  },

  async printDemandLetter(consumerId, demandId, btn, dueDate) {
    if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }
    try {
      const normalizedDueDate = dueDate ? (/^\d{4}-\d{2}-\d{2}/.test(dueDate) ? String(dueDate).slice(0, 10) : new Date(dueDate).toLocaleDateString('en-CA')) : null;
      const genRes = await Api.post('/documents/generate', {
        consumerId,
        documentType: 'demand_letter',
        demandId,
        dueDate: normalizedDueDate || null,
        includeInterest: true,
      });
      const documentId = genRes.data?.documentId || genRes.documentId;
      if (!documentId) throw new Error('Document ID missing from response');

      // the letter comes back as a web page, not as JSON (Api.get reads JSON, so it always saw "no content")
      const htmlRes = await fetch(`/api/documents/${documentId}/html`, { headers: { Authorization: 'Bearer ' + Auth.getToken() } });
      if (!htmlRes.ok) { const e = await htmlRes.json().catch(() => ({})); throw new Error(e.error || `The letter could not be opened (${htmlRes.status})`); }
      const html = await htmlRes.text();
      if (!html) throw new Error('No HTML content returned');

      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (!win) Utils.error('Popup blocked — please allow popups for this site');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      Utils.error('Print failed: ' + err.message);
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Print'; }
  },
};
