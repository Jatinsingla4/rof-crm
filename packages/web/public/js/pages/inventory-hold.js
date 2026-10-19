// ROF CRM — Inventory Governance (Hold/Unhold) Page

Pages.inventoryHold = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="page-hdr">
      <h1>Inventory Governance</h1>
      <div class="breadcrumb">Investor & Hold / <b>Unit Holds</b></div>
    </div>

    <style>
      .ihd { max-width:1280px; margin-left:auto; margin-right:auto }
      .ihd .tabs-line { display:flex; gap:8px; flex-wrap:wrap; border-bottom:none; margin-bottom:0 }
      .ihd .tab-line { padding:7px 16px; font-size:12.5px; border:1px solid var(--border2); border-radius:999px; background:var(--surface); color:var(--text2); cursor:pointer; transition:.15s }
      .ihd .tab-line:hover { border-color:var(--teal); color:var(--teal) }
      .ihd .tab-line.active { background:var(--teal); color:#fff; border-color:var(--teal); font-weight:600 }
      .ihd .tbl-wrap { background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:auto }
      .ihd .tbl-wrap table { width:100%; border-collapse:collapse; font-size:12.5px }
      .ihd .tbl-wrap th { background:var(--surface2); color:var(--text3); font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; padding:10px 14px; text-align:left; white-space:nowrap; border-bottom:1px solid var(--border2) }
      .ihd .tbl-wrap td { padding:10px 14px; border-bottom:1px solid var(--border); color:var(--text) }
      .ihd .tbl-wrap tbody tr:hover td { background:var(--surface2) }
      .ihd .tbl-wrap small { color:var(--text3) }
      .ihd .sp { border-radius:10px; overflow:hidden }
      .ihd .sp-hdr { padding:14px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border) }
      .ihd .sp-title { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
      .ihd .sp-body { padding:18px }
      .ihd .sp-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:14px }
      .ihd .fg { gap:6px }
      .ihd .fl { font-size:11px; font-weight:500; text-transform:none; letter-spacing:.3px; color:var(--text2) }
      .ihd .fc { padding:9px 12px; font-size:13px; border-radius:8px; min-height:38px }
      .ihd .fc:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg) }
      .ihd .btn-teal { background:var(--teal); color:#fff; border:none; padding:9px 26px; border-radius:8px; font-size:12.5px; font-weight:600; min-height:38px; cursor:pointer }
      .ihd .btn-teal:hover { filter:brightness(.92) }
      .ihd .btn-warn { border-radius:6px }
    </style>
    <div class="ihd">
    <div class="tabs-line">
      <button class="tab-line active" data-group="hold" data-tab="active" onclick="switchTab('hold','active');InventoryHoldPage.loadHolds('active')">Active Holds</button>
      <button class="tab-line" data-group="hold" data-tab="history" onclick="switchTab('hold','history');InventoryHoldPage.loadHolds('all')">Hold History</button>
      <button class="tab-line" data-group="hold" data-tab="create" onclick="switchTab('hold','create')">+ New Hold</button>
    </div>

    <!-- Active Holds List -->
    <div data-panel-group="hold" data-panel="active">
      <div class="tbl-wrap" style="margin-top:16px;">
        <table id="active-holds-table">
          <thead>
            <tr>
              <th>Unit</th>
              <th>Project / Tower</th>
              <th>Broker / Client</th>
              <th>Hold Time</th>
              <th>Expiry</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody id="active-holds-body">
            <tr><td colspan="6" style="text-align:center"><div class="spinner"></div></td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Hold History -->
    <div data-panel-group="hold" data-panel="history" style="display:none">
      <div class="tbl-wrap" style="margin-top:16px;">
        <table id="history-holds-table">
          <thead>
            <tr>
              <th>Unit</th>
              <th>Broker</th>
              <th>Client</th>
              <th>Status</th>
              <th>Created / Expired</th>
            </tr>
          </thead>
          <tbody id="history-holds-body">
            <tr><td colspan="5" style="text-align:center"><div class="spinner"></div></td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create Hold -->
    <div data-panel-group="hold" data-panel="create" style="display:none">
      <div class="sp" style="margin-top:16px;max-width:900px;">
        <div class="sp-hdr"><div class="sp-title">Create Unit Hold (24-48 Hours)</div></div>
        <div class="sp-body">
          <div class="alert alert-warn" style="margin-bottom:16px">
            Holding a unit will lock it from being booked by other executives. It will automatically be released after the specified expiry time.
          </div>
          <div class="sp-grid">
            <div class="fg">
              <label class="fl"><span class="r">*</span>Project</label>
              <select class="fc" id="hold-project" onchange="InventoryHoldPage.loadTowers()"><option value="">— Select —</option></select>
            </div>
            <div class="fg">
              <label class="fl"><span class="r">*</span>Tower</label>
              <select class="fc" id="hold-tower" onchange="InventoryHoldPage.loadUnits()"><option value="">— Select —</option></select>
            </div>
            <div class="fg">
              <label class="fl"><span class="r">*</span>Unit</label>
              <select class="fc" id="hold-unit"><option value="">— Select Available Unit —</option></select>
            </div>
            
            <div class="fg">
              <label class="fl"><span class="r">*</span>Broker</label>
              <select class="fc" id="hold-broker"><option value="">— Select Broker —</option></select>
            </div>
            <div class="fg">
              <label class="fl">Client Name</label>
              <input class="fc" id="hold-client-name" placeholder="Name">
            </div>
            <div class="fg">
              <label class="fl">Client Mobile</label>
              <input class="fc" id="hold-client-mobile" placeholder="Mobile">
            </div>
            
            <div class="fg">
              <label class="fl">Hold Duration (Hours)</label>
              <select class="fc" id="hold-duration">
                <option value="24">24 Hours (Default)</option>
                <option value="48">48 Hours</option>
              </select>
            </div>
            
            <div class="fg" style="grid-column: span 2;">
              <label class="fl">Notes / Remarks</label>
              <textarea class="fc" id="hold-notes" rows="2" placeholder="Optional notes..."></textarea>
            </div>
          </div>
          <div style="margin-top:16px;">
            <button class="btn btn-teal btn-lg" onclick="InventoryHoldPage.submitHold(this)">Create Hold</button>
          </div>
        </div>
      </div>
    </div>
    </div>
  `;

  await InventoryHoldPage.init();
};

const InventoryHoldPage = {
  async init() {
    this.loadHolds('active');
    
    try {
      const [projRes, brkRes] = await Promise.all([
        Api.get('/units/projects'),
        Api.get('/brokers')
      ]);
      
      const pSelect = document.getElementById('hold-project');
      if (pSelect && projRes.data) {
        pSelect.innerHTML = '<option value="">— Select —</option>' + projRes.data.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
      }
      
      const bSelect = document.getElementById('hold-broker');
      if (bSelect && brkRes.data) {
        bSelect.innerHTML = '<option value="">— Select Broker —</option>' + brkRes.data.filter(b=>b.status==='active').map(b => `<option value="${b.id}">${b.firm_name || b.name}</option>`).join('');
      }
    } catch(e) {
      console.error(e);
    }
  },

  async loadTowers() {
    const pid = document.getElementById('hold-project').value;
    const tSelect = document.getElementById('hold-tower');
    const uSelect = document.getElementById('hold-unit');
    tSelect.innerHTML = '<option value="">— Select —</option>';
    uSelect.innerHTML = '<option value="">— Select Available Unit —</option>';
    if (!pid) return;

    try {
      const res = await Api.get(`/units/tower/${pid}`);
      const towers = res.data || res || [];
      tSelect.innerHTML = '<option value="">— Select —</option>' + towers.map(t => `<option value="${t.id}">${t.tower_name}</option>`).join('');
    } catch(e) { console.error(e); }
  },

  async loadUnits() {
    const pid = document.getElementById('hold-project').value;
    const tid = document.getElementById('hold-tower').value;
    const uSelect = document.getElementById('hold-unit');
    uSelect.innerHTML = '<option value="">— Select Available Unit —</option>';
    if (!pid || !tid) return;

    try {
      const res = await Api.get('/units', { params: { projectId: pid, towerId: tid, status: 'available' } });
      uSelect.innerHTML = '<option value="">— Select Available Unit —</option>' + res.data.map(u => `<option value="${u.id}">${u.unit_number} (${u.floor}F)</option>`).join('');
    } catch(e) { console.error(e); }
  },

  async loadHolds(status) {
    const tbody = document.getElementById(status === 'active' ? 'active-holds-body' : 'history-holds-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center"><div class="spinner"></div></td></tr>';
    
    try {
      const res = await Api.get('/inventory-hold', { params: { status } });
      const holds = res.data || [];
      
      if (holds.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text3)">No ${status} holds found.</td></tr>`;
        return;
      }

      if (status === 'active') {
        tbody.innerHTML = holds.map(h => {
          const isExpiringSoon = new Date(h.expires_at).getTime() - new Date().getTime() < (4 * 60 * 60 * 1000); // 4 hours
          return `
          <tr>
            <td class="td-bold">${h.unit_number}</td>
            <td>${h.project_name} / ${h.tower_name}</td>
            <td>${h.broker_firm_name}<br><small>${h.client_name || '-'}</small></td>
            <td style="font-size:10.5px">${Utils.date(h.held_at, true)}</td>
            <td style="font-size:10.5px;color:${isExpiringSoon ? 'var(--red)' : 'inherit'}">${Utils.date(h.expires_at, true)}</td>
            <td><button class="btn btn-sm btn-outline btn-warn" onclick="InventoryHoldPage.unhold('${h.id}')">Unhold</button></td>
          </tr>
        `}).join('');
      } else {
        tbody.innerHTML = holds.map(h => `
          <tr>
            <td class="td-bold">${h.unit_number}</td>
            <td>${h.broker_firm_name}</td>
            <td>${h.client_name || '-'}</td>
            <td>${Utils.chip(h.status)}</td>
            <td style="font-size:10.5px">${Utils.date(h.held_at)} <br> ${Utils.date(h.expires_at)}</td>
          </tr>
        `).join('');
      }
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" style="color:var(--red);text-align:center">${err.message}</td></tr>`;
    }
  },

  async submitHold(btn) {
    const unitId = document.getElementById('hold-unit').value;
    const brokerId = document.getElementById('hold-broker').value;
    const clientName = document.getElementById('hold-client-name').value;
    const clientMobile = document.getElementById('hold-client-mobile').value;
    const holdHours = document.getElementById('hold-duration').value;
    const notes = document.getElementById('hold-notes').value;

    if (!unitId || !brokerId) { Utils.warn('Unit and Broker are required'); return; }

    btn.disabled = true; btn.textContent = 'Processing...';
    try {
      await Api.post('/inventory-hold', { unitId, brokerId, clientName, clientMobile, holdHours, notes });
      Utils.success('Unit held successfully');
      
      // Reset form
      document.getElementById('hold-unit').value = '';
      document.getElementById('hold-client-name').value = '';
      document.getElementById('hold-client-mobile').value = '';
      
      // Switch back to active holds tab
      document.querySelector('[data-tab="active"]').click();
    } catch(err) {
      Utils.error(err.message);
    } finally {
      btn.disabled = false; btn.textContent = 'Create Hold';
    }
  },

  async unhold(id) {
    if(!confirm('Are you sure you want to release this unit hold?')) return;
    try {
      await Api.post(`/inventory-hold/${id}/unhold`);
      Utils.success('Hold released');
      this.loadHolds('active');
    } catch(err) { Utils.error(err.message); }
  }
};
