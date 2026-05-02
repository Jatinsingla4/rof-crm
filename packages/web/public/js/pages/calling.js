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
      <div class="page-header">
        <div class="header-content">
          <h1>Selection Free Calling List</h1>
          <p>Prioritize and track debt recovery calls</p>
        </div>
      </div>

      <div class="card" style="margin-bottom:14px">
        <div class="card-header" style="padding:10px 14px; background:var(--bg2); border-bottom:1px solid var(--border)">
          <h4 style="font-size:12px; text-transform:uppercase; letter-spacing:0.5px; color:var(--text2)">Selection Free Calling List</h4>
        </div>
        <div class="card-body" style="padding:15px">
          <!-- Row 1 -->
          <div style="display:grid; grid-template-columns: repeat(6, 1fr); gap:12px; margin-bottom:12px">
            <div class="form-group-sm">
              <label>Project:</label>
              <select id="f-project" class="form-control" onchange="CallingPage.loadTowers(this.value)">
                <option value="">— All —</option>
              </select>
            </div>
            <div class="form-group-sm">
              <label>Tower:</label>
              <select id="f-tower" class="form-control">
                <option value="">— All —</option>
              </select>
            </div>
            <div class="form-group-sm">
              <label>Payment Plan:</label>
              <select id="f-plan" class="form-control">
                <option value="">— All —</option>
              </select>
            </div>
            <div class="form-group-sm">
              <label>Customer Status:</label>
              <select id="f-cust-status" class="form-control">
                <option value="">— All —</option>
                <option value="Lead">Lead</option>
                <option value="Applicant">Applicant</option>
                <option value="Allottee">Allottee</option>
                <option value="Registry Done">Registry Done</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
            <div class="form-group-sm">
              <label>Status Code:</label>
              <select id="f-status" class="form-control">
                <option value="">— All —</option>
              </select>
            </div>
            <div class="form-group-sm">
              <label>Sub Status Code:</label>
              <input type="text" id="f-sub-status" class="form-control" placeholder="— All —">
            </div>
          </div>
          <!-- Row 2 -->
          <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:12px; margin-bottom:12px">
            <div class="form-group-sm">
              <label>Registration No.:</label>
              <input type="text" id="f-reg-no" class="form-control" placeholder="Registration No.">
            </div>
            <div class="form-group-sm">
              <label>Customer Name:</label>
              <input type="text" id="f-name" class="form-control" placeholder="Customer Name">
            </div>
            <div class="form-group-sm">
              <label>Unit No.:</label>
              <input type="text" id="f-unit" class="form-control" placeholder="Unit Address">
            </div>
            <div class="form-group-sm">
              <label>OS Amount(>=):</label>
              <input type="number" id="f-min-os" class="form-control" value="500">
            </div>
            <div class="form-group-sm">
              <label>Employee Name:</label>
              <select id="f-employee" class="form-control">
                <option value="">— All —</option>
              </select>
            </div>
          </div>
          <button class="btn btn-primary" style="padding:6px 20px" onclick="CallingPage.fetch()">FETCH</button>
        </div>
      </div>

      <div id="calling-kpis" class="kpi-row"></div>
      <div id="calling-grid" class="table-container"></div>
    `;

    await this.loadLookups();
    this.fetch();
  },

  async loadLookups() {
    try {
      const [pr, sc, ur] = await Promise.all([
        Api.get('/units/projects'),
        Api.get('/communications/status-codes'),
        Api.get('/employees')
      ]);

      this._projects = pr.data || [];
      this._statusCodes = sc.data || [];
      this._users = ur.data || [];

      // Populate Project select
      const pSel = document.getElementById('f-project');
      this._projects.forEach(p => { pSel.innerHTML += `<option value="${p.id}">${p.name}</option>`; });

      // Populate Status Code select
      const sSel = document.getElementById('f-status');
      this._statusCodes.forEach(s => { sSel.innerHTML += `<option>${s.code}</option>`; });

      // Populate Employee select
      const eSel = document.getElementById('f-employee');
      this._users.forEach(u => { eSel.innerHTML += `<option value="${u.id}">${u.name}</option>`; });

    } catch (err) { Utils.error(err.message); }
  },

  async loadTowers(projectId) {
    const tSel = document.getElementById('f-tower');
    tSel.innerHTML = '<option value="">— All —</option>';
    if (!projectId) return;

    try {
      const res = await Api.get(`/units/towers?projectId=${projectId}`);
      const towers = res.data || [];
      towers.forEach(t => { tSel.innerHTML += `<option value="${t.id}">${t.name}</option>`; });
    } catch (err) { Utils.error(err.message); }
  },

  async fetch() {
    const grid = document.getElementById('calling-grid');
    grid.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    
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
      <div class="kpi-card">
        <div class="kpi-val">${data.length}</div>
        <div class="kpi-lab">Accounts to Call</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-val" style="color:var(--red)">${Utils.currency(totalOs)}</div>
        <div class="kpi-lab">Total Recovery Potential</div>
      </div>
    `;
  },

  renderTable(data) {
    const grid = document.getElementById('calling-grid');
    if (data.length === 0) {
      grid.innerHTML = '<div class="empty-state">No accounts matching filters</div>';
      return;
    }

    const headers = ['Customer', 'Unit', 'O/S Amount', 'Last Status', 'Next Call', 'PTP Date', 'Action'];
    const rows = data.map(c => `
      <tr>
        <td>
          <div class="td-bold">${c.name}</div>
          <div style="font-size:11px;color:var(--text3)">${c.mobile} | Reg: ${c.registration_no || '—'}</div>
        </td>
        <td>${c.unit_number}<br><small>${c.project_name} | ${c.tower_name || ''}</small></td>
        <td style="color:var(--red);font-weight:600">${Utils.currency(c.total_overdue_amt)}</td>
        <td>
          <span class="status-chip">${c.last_call_status || 'Never Called'}</span>
          <div style="font-size:10px;color:var(--text3)">${c.last_call_sub_status || ''}</div>
        </td>
        <td>${c.next_call_date ? Utils.date(c.next_call_date) : '—'}</td>
        <td style="color:var(--teal)">${c.promise_to_pay_date ? Utils.date(c.promise_to_pay_date) : '—'}</td>
        <td>
          <button class="btn btn-sm btn-accent" onclick="CallingPage.openDialer('${c.id}')">PICK CALL</button>
        </td>
      </tr>
    `);

    grid.innerHTML = `
      <table class="table">
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
      modal.className = 'modal-overlay';
      modal.id = 'dialer-modal';
      modal.innerHTML = `
        <div class="modal-content" style="max-width:800px">
          <div class="modal-header">
            <h3>Call Interaction Log</h3>
            <button class="close-btn" onclick="document.getElementById('dialer-modal').remove()">×</button>
          </div>
          <div class="modal-body" style="display:flex;gap:20px">
            <div style="flex:1">
              <h4>Update Log</h4>
              <div class="form-group">
                <label>Call Status</label>
                <select id="m-status" class="form-control">
                  ${this._statusCodes.map(s => `<option>${s.code}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Sub Status / Remarks</label>
                <input type="text" id="m-sub-status" class="form-control" placeholder="e.g. Next Followup">
              </div>
              <div class="form-group">
                <label>Promise to Pay (PTP) Date</label>
                <input type="date" id="m-ptp" class="form-control">
              </div>
              <div class="form-group">
                <label>Next Call Date</label>
                <input type="date" id="m-next-call" class="form-control">
              </div>
              <div class="form-group">
                <label>Notes</label>
                <textarea id="m-remarks" class="form-control" rows="3"></textarea>
              </div>
              <button class="btn btn-primary btn-block" onclick="CallingPage.saveCall('${consumerId}')">Submit Call Result</button>
            </div>
            <div style="flex:1; border-left: 1px solid var(--border); padding-left:20px; max-height:450px; overflow-y:auto">
              <h4>Communication History</h4>
              ${history.length === 0 ? '<p>No previous interactions</p>' : history.map(h => `
                <div class="history-item">
                  <div style="font-weight:600;font-size:12px">${Utils.date(h.timestamp)} - ${h.channel}</div>
                  <div style="font-size:13px">${h.notes || 'No notes'}</div>
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

