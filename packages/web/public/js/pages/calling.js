Pages.calling = function(p) {
  return CallingPage.render(p);
};

const CallingPage = {
  _statusCodes: [],
  _projects: [],
  _towers: [],
  _users: [],

  async render() {
    const content = document.getElementById('content');
    content.innerHTML = `
      <style>
        .cln { max-width:1180px; margin-left:auto; margin-right:auto }
        .cln .sp { border-radius:10px; overflow:hidden; margin-bottom:16px }
        .cln .sp-hdr { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; padding:14px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border) }
        .cln .sp-title { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
        .cln .sp-body { padding:18px }
        .cln-grid { display:grid; gap:16px 18px; margin-bottom:16px }
        .cln-grid-6 { grid-template-columns:repeat(6,minmax(0,1fr)) }
        .cln-grid-5 { grid-template-columns:repeat(5,minmax(0,1fr)) }
        @media (max-width:1000px) { .cln-grid-6, .cln-grid-5 { grid-template-columns:repeat(3,minmax(0,1fr)) } }
        @media (max-width:640px) { .cln-grid-6, .cln-grid-5 { grid-template-columns:minmax(0,1fr) } }
        .cln .fg, .cln-mo .fg { gap:6px }
        .cln .fl, .cln-mo .fl { font-size:11px; font-weight:500; text-transform:none; letter-spacing:.3px; color:var(--text2) }
        .cln .fc, .cln-mo .fc { padding:9px 12px; font-size:13px; border-radius:8px; min-height:38px; width:100% }
        .cln .fc:focus, .cln-mo .fc:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg) }
        .cln-btn { background:var(--teal); color:#fff; border:none; padding:9px 26px; border-radius:8px; font-size:12.5px; font-weight:600; cursor:pointer; min-height:38px }
        .cln-btn:hover { filter:brightness(.92) }
        .cln-kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:14px; margin-bottom:16px }
        .cln-kpi { background:var(--surface); border:1px solid var(--border2); border-left:3px solid var(--teal); border-radius:10px; padding:12px 16px }
        .cln-kpi-lab { font-size:10.5px; color:var(--text3); text-transform:uppercase; letter-spacing:.5px }
        .cln-kpi-val { font-size:20px; font-weight:700; color:var(--text); margin-top:4px }
        .cln-card { background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:hidden }
        .cln-scroll { overflow-x:auto }
        .cln-tbl { width:100%; border-collapse:collapse; font-size:12.5px }
        .cln-tbl th { text-align:left; padding:10px 14px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; color:var(--text3); background:var(--surface2); border-bottom:1px solid var(--border2); white-space:nowrap }
        .cln-tbl td { padding:10px 14px; border-bottom:1px solid var(--border); color:var(--text); vertical-align:middle }
        .cln-tbl tbody tr:hover td { background:var(--surface2) }
        .cln-tbl tbody tr:last-child td { border-bottom:none }
        .cln-sub { font-size:11px; color:var(--text3); margin-top:2px }
        .cln-chip { display:inline-block; background:var(--teal-bg); color:var(--teal); font-size:11px; font-weight:600; padding:2px 10px; border-radius:999px }
        .cln-pick { background:var(--teal); color:#fff; border:none; padding:5px 14px; border-radius:6px; font-size:11.5px; font-weight:600; cursor:pointer }
        .cln-pick:hover { filter:brightness(.92) }
        .cln-empty, .cln-load { padding:36px 18px; text-align:center; color:var(--text3); font-size:13px }
        .cln-mo { position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:1200; display:flex; align-items:center; justify-content:center; padding:16px }
        .cln-mo-box { background:var(--surface); color:var(--text); border:1px solid var(--border2); border-radius:14px; width:min(96vw,820px); max-height:90vh; overflow:auto; box-shadow:0 20px 60px rgba(0,0,0,.4) }
        .cln-mo-hdr { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; background:var(--teal-bg); border-bottom:1px solid var(--border) }
        .cln-mo-hdr h3 { margin:0; font-size:13px; font-weight:600; text-transform:uppercase; letter-spacing:.6px; color:var(--text) }
        .cln-mo-x { background:none; border:none; font-size:22px; line-height:1; cursor:pointer; color:var(--text2); width:30px; height:30px; border-radius:8px }
        .cln-mo-x:hover { background:var(--surface2); color:var(--text) }
        .cln-mo-body { padding:20px; display:flex; gap:24px; flex-wrap:wrap }
        .cln-mo-col { flex:1 1 280px; display:flex; flex-direction:column; gap:14px; min-width:0 }
        .cln-mo-col h4 { margin:0; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.5px; color:var(--text2) }
        .cln-mo-hist { border-left:1px solid var(--border); padding-left:24px; max-height:450px; overflow-y:auto }
        @media (max-width:700px) { .cln-mo-hist { border-left:none; padding-left:0 } }
        .cln-hist-item { padding:10px 0; border-bottom:1px solid var(--border) }
        .cln-hist-item:last-child { border-bottom:none }
        .cln-hist-t { font-weight:600; font-size:12px; color:var(--text) }
        .cln-hist-n { font-size:13px; color:var(--text2); margin-top:2px }
      </style>

      <div class="page-hdr">
        <h1>Selection Free Calling List</h1>
        <div class="breadcrumb">Application / Collection Process / <b>Calling</b></div>
      </div>

      <div class="cln">
        <div class="sp">
          <div class="sp-hdr"><div class="sp-title">Selection Free Calling List</div></div>
          <div class="sp-body">
            <!-- Row 1 -->
            <div class="cln-grid cln-grid-6">
              <div class="fg">
                <label class="fl">Project</label>
                <select id="f-project" class="fc" onchange="CallingPage.loadTowers(this.value)">
                  <option value="">— All —</option>
                </select>
              </div>
              <div class="fg">
                <label class="fl">Tower</label>
                <select id="f-tower" class="fc">
                  <option value="">— All —</option>
                </select>
              </div>
              <div class="fg">
                <label class="fl">Payment Plan</label>
                <select id="f-plan" class="fc">
                  <option value="">— All —</option>
                </select>
              </div>
              <div class="fg">
                <label class="fl">Customer Status</label>
                <select id="f-cust-status" class="fc">
                  <option value="">— All —</option>
                  <option value="Lead">Lead</option>
                  <option value="Applicant">Applicant</option>
                  <option value="Allottee">Allottee</option>
                  <option value="Registry Done">Registry Done</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
              <div class="fg">
                <label class="fl">Status Code</label>
                <select id="f-status" class="fc">
                  <option value="">— All —</option>
                </select>
              </div>
              <div class="fg">
                <label class="fl">Sub Status Code</label>
                <input type="text" id="f-sub-status" class="fc" placeholder="— All —">
              </div>
            </div>
            <!-- Row 2 -->
            <div class="cln-grid cln-grid-5">
              <div class="fg">
                <label class="fl">Registration No.</label>
                <input type="text" id="f-reg-no" class="fc" placeholder="Registration No.">
              </div>
              <div class="fg">
                <label class="fl">Customer Name</label>
                <input type="text" id="f-name" class="fc" placeholder="Customer Name">
              </div>
              <div class="fg">
                <label class="fl">Unit No.</label>
                <input type="text" id="f-unit" class="fc" placeholder="Unit Address">
              </div>
              <div class="fg">
                <label class="fl">OS Amount (&gt;=)</label>
                <input type="number" id="f-min-os" class="fc" value="500">
              </div>
              <div class="fg">
                <label class="fl">Employee Name</label>
                <select id="f-employee" class="fc">
                  <option value="">— All —</option>
                </select>
              </div>
            </div>
            <button class="cln-btn" onclick="CallingPage.fetch()">FETCH</button>
          </div>
        </div>

        <div id="calling-kpis" class="cln-kpis"></div>
        <div class="cln-card"><div id="calling-grid" class="cln-scroll"></div></div>
      </div>
    `;

    await this.loadLookups();
    this.fetch();
  },

  async loadLookups() {
    try {
      const [pr, sc, ur] = await Promise.all([
        Api.get('/units/projects'),
        Api.get('/communications/status-codes'),
        Api.get('/employees/directory')
      ]);

      this._projects = pr.data || [];
      this._statusCodes = sc.data || [];
      this._users = ur.data || [];

      // Populate Project select
      const pSel = document.getElementById('f-project');
      this._projects.forEach(p => { pSel.innerHTML += `<option value="${p.id}">${Utils.esc(p.name)}</option>`; });

      // Populate Status Code select
      const sSel = document.getElementById('f-status');
      this._statusCodes.forEach(s => { sSel.innerHTML += `<option>${s.code}</option>`; });

      // Populate Employee select
      const eSel = document.getElementById('f-employee');
      this._users.forEach(u => { eSel.innerHTML += `<option value="${u.id}">${Utils.esc(u.name)}</option>`; });

    } catch (err) { Utils.error(err.message); }
  },

  async loadTowers(projectId) {
    const tSel = document.getElementById('f-tower');
    tSel.innerHTML = '<option value="">— All —</option>';
    if (!projectId) return;

    try {
      const res = await Api.get(`/units/towers?projectId=${projectId}`);
      const towers = res.data || [];
      towers.forEach(t => { tSel.innerHTML += `<option value="${t.id}">${Utils.esc(t.name)}</option>`; });
    } catch (err) { Utils.error(err.message); }
  },

  async fetch() {
    const grid = document.getElementById('calling-grid');
    grid.innerHTML = '<div class="cln-load"><div class="spinner"></div></div>';

    try {
      const params = {
        minOsAmount: document.getElementById('f-min-os').value,
        projectId: document.getElementById('f-project').value,
        towerId: document.getElementById('f-tower').value,
        customerStatus: document.getElementById('f-cust-status').value,
        statusCode: document.getElementById('f-status').value,
        subStatusCode: document.getElementById('f-sub-status').value,
        regNo: document.getElementById('f-reg-no').value,
        customerName: document.getElementById('f-name').value,
        unitNo: document.getElementById('f-unit').value,
        employeeId: document.getElementById('f-employee').value
      };

      const res = await Api.get('/communications/calling-list', { params });
      const data = res.data || [];

      this.renderKPIs(data);
      this.renderTable(data);
    } catch (err) { Utils.error(err.message); }
  },

  renderKPIs(data) {
    const kpi = document.getElementById('calling-kpis');
    const totalOs = data.reduce((s,c) => s + parseFloat(c.total_overdue_amt || 0), 0);
    kpi.innerHTML = `
      <div class="cln-kpi">
        <div class="cln-kpi-lab">Accounts to Call</div>
        <div class="cln-kpi-val">${data.length}</div>
      </div>
      <div class="cln-kpi" style="border-left-color:var(--red)">
        <div class="cln-kpi-lab">Total Recovery Potential</div>
        <div class="cln-kpi-val" style="color:var(--red)">${Utils.currency(totalOs)}</div>
      </div>
    `;
  },

  renderTable(data) {
    const grid = document.getElementById('calling-grid');
    if (data.length === 0) {
      grid.innerHTML = '<div class="cln-empty">No accounts matching filters</div>';
      return;
    }

    const headers = ['Customer', 'Unit', 'O/S Amount', 'Last Status', 'Next Call', 'PTP Date', 'Action'];
    const rows = data.map(c => `
      <tr>
        <td>
          <div style="font-weight:600">${Utils.esc(c.name)}</div>
          <div class="cln-sub">${c.mobile} | Reg: ${c.registration_no || '—'}</div>
        </td>
        <td>${c.unit_number}<div class="cln-sub">${c.project_name} | ${c.tower_name || ''}</div></td>
        <td style="color:var(--red);font-weight:600">${Utils.currency(c.total_overdue_amt)}</td>
        <td>
          <span class="cln-chip">${c.last_call_status || 'Never Called'}</span>
          <div class="cln-sub">${c.last_call_sub_status || ''}</div>
        </td>
        <td>${c.next_call_date ? Utils.date(c.next_call_date) : '—'}</td>
        <td style="color:var(--teal)">${c.promise_to_pay_date ? Utils.date(c.promise_to_pay_date) : '—'}</td>
        <td>
          <button class="cln-pick" onclick="CallingPage.openDialer('${c.id}')">PICK CALL</button>
        </td>
      </tr>
    `);

    grid.innerHTML = `
      <table class="cln-tbl">
        <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    `;
  },

  async openDialer(consumerId) {
    try {
      const res = await Api.get(`/communications/remarks/${consumerId}`);
      const history = res.data || [];

      const modal = document.createElement('div');
      modal.className = 'cln-mo';
      modal.id = 'dialer-modal';
      modal.innerHTML = `
        <div class="cln-mo-box">
          <div class="cln-mo-hdr">
            <h3>Call Interaction Log</h3>
            <button class="cln-mo-x" onclick="document.getElementById('dialer-modal').remove()">×</button>
          </div>
          <div class="cln-mo-body">
            <div class="cln-mo-col">
              <h4>Update Log</h4>
              <div class="fg">
                <label class="fl">Call Status</label>
                <select id="m-status" class="fc">
                  ${this._statusCodes.map(s => `<option>${s.code}</option>`).join('')}
                </select>
              </div>
              <div class="fg">
                <label class="fl">Sub Status / Remarks</label>
                <input type="text" id="m-sub-status" class="fc" placeholder="e.g. Next Followup">
              </div>
              <div class="fg">
                <label class="fl">Promise to Pay (PTP) Date</label>
                <input type="date" id="m-ptp" class="fc">
              </div>
              <div class="fg">
                <label class="fl">Next Call Date</label>
                <input type="date" id="m-next-call" class="fc">
              </div>
              <div class="fg">
                <label class="fl">Notes</label>
                <textarea id="m-remarks" class="fc" rows="3"></textarea>
              </div>
              <button class="cln-btn" onclick="CallingPage.saveCall('${consumerId}')">Submit Call Result</button>
            </div>
            <div class="cln-mo-col cln-mo-hist">
              <h4>Communication History</h4>
              ${history.length === 0 ? '<p class="cln-sub">No previous interactions</p>' : history.map(h => `
                <div class="cln-hist-item">
                  <div class="cln-hist-t">${Utils.date(h.timestamp)} - ${h.channel}</div>
                  <div class="cln-hist-n">${Utils.esc(h.notes || 'No notes')}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    } catch (err) { Utils.error(err.message); }
  },

  async saveCall(consumerId) {
    const payload = {
      consumerId,
      statusCode: document.getElementById('m-status').value,
      subStatusCode: document.getElementById('m-sub-status').value,
      ptpDate: document.getElementById('m-ptp').value,
      nextCallDate: document.getElementById('m-next-call').value,
      remarks: document.getElementById('m-remarks').value
    };

    try {
      await Api.post('/communications/log-call', payload);
      Utils.success('Call logged successfully');
      document.getElementById('dialer-modal').remove();
      this.fetch();
    } catch (err) { Utils.error(err.message); }
  }
};

