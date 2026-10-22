// ROF CRM — Parking Management Page

Pages.parking = async function(params = {}) {
  const tab = params.tab || 'type-master';
  const content = document.getElementById('content');
  content.innerHTML = `
    <style>
      .pkn { max-width:1360px; margin-left:auto; margin-right:auto }
      .pkn .tabs-line { display:flex; gap:8px; flex-wrap:wrap; border-bottom:none; margin-bottom:16px }
      .pkn .tab-line { padding:7px 16px; font-size:12.5px; border:1px solid var(--border2); border-radius:999px; background:var(--surface); color:var(--text2); cursor:pointer; transition:.15s }
      .pkn .tab-line:hover { border-color:var(--teal); color:var(--teal) }
      .pkn .tab-line.active { background:var(--teal); color:#fff; border-color:var(--teal); font-weight:600 }
      .pkn .sp { border-radius:10px; overflow:hidden }
      .pkn .sp-hdr { padding:14px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border) }
      .pkn .sp-title { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
      .pkn .sp-body { padding:18px }
      .pkn .fg { gap:6px }
      .pkn .fl { font-size:11px; font-weight:500; text-transform:none; letter-spacing:.3px; color:var(--text2) }
      .pkn .fc { padding:9px 12px; font-size:13px; border-radius:8px; min-height:38px }
      .pkn .fc:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg) }
      .pkn .btn-primary, .pkn .btn-teal { background:var(--teal) !important; color:#fff !important; border:none; padding:9px 24px; border-radius:8px; font-size:12.5px; font-weight:600; min-height:38px; cursor:pointer }
      .pkn .btn-primary:hover, .pkn .btn-teal:hover { filter:brightness(.92) }
      .pkn .btn-ghost { border-radius:8px; min-height:38px; padding:9px 18px; font-size:12.5px }
      .pkn .btn-sm { min-height:30px; padding:5px 12px; font-size:12px; border-radius:6px }
      .pkn table { width:100%; border-collapse:collapse; font-size:12.5px }
      .pkn table th { background:var(--surface2); color:var(--text3); font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; padding:10px 14px; text-align:left; white-space:nowrap; border-bottom:1px solid var(--border2) }
      .pkn table td { padding:9px 14px; border-bottom:1px solid var(--border); color:var(--text) }
      .pkn table tbody tr:hover td { background:var(--surface2) }
      .pkn .tfoot-total td { background:var(--surface2); font-weight:700; border-top:1px solid var(--border2) }
      .pkn #ptm-list-body, .pkn #pas-recent-body { padding:0; overflow:auto }
      .pkn #pim-slot-list, .pkn #pir-body { background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:auto }
      .pkn #pir-kpis { grid-template-columns:repeat(auto-fit,minmax(170px,1fr)) !important }
      .pkn .kpi-card { background:var(--surface); border:1px solid var(--border2); border-left:3px solid var(--teal); border-radius:10px; padding:12px 16px }
      .pkn .kpi-label { font-size:10.5px; color:var(--text3); text-transform:uppercase; letter-spacing:.5px }
      .pkn .kpi-value { font-size:20px; font-weight:700; margin-top:4px }
      .pkn .empty-state { padding:36px 18px; text-align:center; color:var(--text3) }
      .pkn .empty-state h3 { font-size:14px; font-weight:600; color:var(--text2); margin:0 0 4px }
      @media (max-width:900px) { .pkn .pkn-cols { grid-template-columns:minmax(0,1fr) !important } }
    </style>
    <div class="pkn">
    <div class="page-hdr">
      <h1>Parking Management</h1>
      <div class="breadcrumb">Application / <b>Parking</b></div>
    </div>
    <div class="tabs-line">
      <button class="tab-line${tab==='type-master'?' active':''}" data-group="park" data-tab="type-master"
        onclick="switchTab('park','type-master');ParkingPage.loadTypeMaster()">Parking Type Master</button>
      <button class="tab-line${tab==='inventory-master'?' active':''}" data-group="park" data-tab="inventory-master"
        onclick="switchTab('park','inventory-master');ParkingPage.loadInventoryMaster()">Inventory Master</button>
      <button class="tab-line${tab==='assign'?' active':''}" data-group="park" data-tab="assign"
        onclick="switchTab('park','assign');ParkingPage.loadAssign()">Assign Parking</button>
      <button class="tab-line${tab==='inventory-report'?' active':''}" data-group="park" data-tab="inventory-report"
        onclick="switchTab('park','inventory-report');ParkingPage.loadInventoryReport()">Inventory Report</button>
    </div>

    <!-- TYPE MASTER -->
    <div data-panel-group="park" data-panel="type-master"${tab!=='type-master'?' style="display:none"':''}>
      <div class="pkn-cols" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start">
        <!-- Add / Edit Type -->
        <div class="sp">
          <div class="sp-hdr"><div class="sp-title">Price of a Parking Type (per project)</div></div>
          <div class="sp-body">
            <div class="sp-grid" style="grid-template-columns:1fr">
              <div class="fg"><label class="fl"><span class="r">*</span>Project</label>
                <select class="fc" id="ptm-project"></select>
              </div>
              <div class="fg"><label class="fl"><span class="r">*</span>Type Name</label>
                <select class="fc" id="ptm-name">
                  <option value="covered">Covered</option><option value="open">Open</option><option value="stilt">Stilt</option><option value="ev">EV Charging</option><option value="visitor">Visitor</option>
                </select>
              </div>
              <div class="fg"><label class="fl"><span class="r">*</span>Price (₹)</label>
                <input type="number" class="fc" id="ptm-price" placeholder="0" min="0">
              </div>
              <div class="fg"><label class="fl">Description</label>
                <input type="text" class="fc" id="ptm-desc" placeholder="Additional details…">
              </div>
            </div>
            <div style="margin-top:10px;display:flex;gap:8px">
              <button class="btn btn-primary" onclick="ParkingPage.saveType()">Save Type</button>
              <button class="btn btn-ghost" onclick="ParkingPage.resetTypeForm()">Reset</button>
            </div>
            <div id="ptm-result" style="margin-top:10px"></div>
          </div>
        </div>
        <!-- Type List -->
        <div class="sp">
          <div class="sp-hdr">
            <div class="sp-title">Defined Parking Types</div>
          </div>
          <div class="sp-body" id="ptm-list-body">
            <div class="page-loading"><div class="spinner"></div></div>
          </div>
        </div>
      </div>
    </div>

    <!-- INVENTORY MASTER -->
    <div data-panel-group="park" data-panel="inventory-master"${tab!=='inventory-master'?' style="display:none"':''}>
      <div class="pkn-cols" style="display:grid;grid-template-columns:1fr 2fr;gap:14px;align-items:start">
        <!-- Add Slot Form -->
        <div class="sp">
          <div class="sp-hdr"><div class="sp-title">Add Parking Slot</div></div>
          <div class="sp-body">
            <div class="sp-grid" style="grid-template-columns:1fr">
              <div class="fg"><label class="fl"><span class="r">*</span>Project</label>
                <select class="fc" id="pim-project"></select>
              </div>
              <div class="fg"><label class="fl"><span class="r">*</span>Slot Number</label>
                <input type="text" class="fc" id="pim-slot" placeholder="e.g. P001, B2-C04">
              </div>
              <div class="fg"><label class="fl"><span class="r">*</span>Parking Type</label>
                <select class="fc" id="pim-type">
                  <option value="covered">Covered</option>
                  <option value="open">Open</option>
                  <option value="stilt">Stilt</option>
                  <option value="ev">EV Charging</option>
                  <option value="visitor">Visitor</option>
                </select>
              </div>
              <div class="fg"><label class="fl">Floor / Level</label>
                <input type="number" class="fc" id="pim-floor" value="0" placeholder="0=Ground, -1=Basement">
              </div>
              <div class="fg"><label class="fl">Price (₹)</label>
                <input type="number" class="fc" id="pim-price" placeholder="Auto from type">
              </div>
            </div>
            <div style="margin-top:10px;display:flex;gap:8px">
              <button class="btn btn-primary" onclick="ParkingPage.addSlot()">Add Slot</button>
              <button class="btn btn-ghost btn-sm" onclick="ParkingPage.bulkAddSlots()">Bulk Add (1-N)</button>
            </div>
            <div id="pim-result" style="margin-top:10px"></div>
          </div>
        </div>
        <!-- Slot List -->
        <div>
          <div style="display:flex;gap:8px;margin-bottom:10px;align-items:center;flex-wrap:wrap">
            <select class="fc" id="pim-filter-project" style="width:200px" onchange="ParkingPage.loadSlotList()">
              <option value="">All Projects</option>
            </select>
            <select class="fc" id="pim-filter-type" style="width:150px" onchange="ParkingPage.loadSlotList()">
              <option value="">All Types</option>
              <option value="covered">Covered</option>
              <option value="open">Open</option>
              <option value="stilt">Stilt</option>
              <option value="ev">EV</option>
            </select>
            <select class="fc" id="pim-filter-status" style="width:150px" onchange="ParkingPage.loadSlotList()">
              <option value="">All Status</option>
              <option value="available">Available</option>
              <option value="allotted">Allotted</option>
            </select>
            <button class="btn btn-ghost btn-sm" onclick="ParkingPage.loadSlotList()">Refresh</button>
          </div>
          <div id="pim-slot-list"><div class="page-loading"><div class="spinner"></div></div></div>
        </div>
      </div>
    </div>

    <!-- ASSIGN PARKING -->
    <div data-panel-group="park" data-panel="assign"${tab!=='assign'?' style="display:none"':''}>
      <div class="pkn-cols" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start">
        <!-- Assign Form -->
        <div class="sp">
          <div class="sp-hdr"><div class="sp-title">Assign Parking to Consumer</div></div>
          <div class="sp-body">
            <div class="sp-grid" style="grid-template-columns:1fr">
              <div class="fg"><label class="fl"><span class="r">*</span>Project</label>
                <select class="fc" id="pas-project" onchange="ParkingPage.loadAvailableSlots(this.value)"></select>
              </div>
              <div class="fg"><label class="fl"><span class="r">*</span>Consumer</label>
                <select class="fc" id="pas-consumer" onchange="ParkingPage.loadConsumerUnit(this.value)"></select>
              </div>
              <div class="fg"><label class="fl">Unit Number (auto-loaded)</label>
                <input type="text" class="fc" id="pas-unit" readonly placeholder="Select consumer first">
              </div>
              <div class="fg"><label class="fl"><span class="r">*</span>Available Parking Slot</label>
                <select class="fc" id="pas-slot" onchange="ParkingPage.updateSlotPrice(this.value)">
                  <option value="">— Select Project First —</option>
                </select>
              </div>
              <div class="fg"><label class="fl">Amount (₹)</label>
                <input type="number" class="fc" id="pas-amount" placeholder="Auto-filled from slot price">
              </div>
              <div class="fg"><label class="fl">Remarks</label>
                <input type="text" class="fc" id="pas-remarks" placeholder="Any notes…">
              </div>
            </div>
            <div style="margin-top:12px;display:flex;gap:8px">
              <button class="btn btn-teal btn-lg" onclick="ParkingPage.assignParking()">Assign Parking</button>
            </div>
            <div id="pas-result" style="margin-top:12px"></div>
          </div>
        </div>
        <!-- Recent Assignments -->
        <div class="sp">
          <div class="sp-hdr"><div class="sp-title">Recent Assignments</div></div>
          <div class="sp-body" id="pas-recent-body">
            <div class="page-loading"><div class="spinner"></div></div>
          </div>
        </div>
      </div>
    </div>

    <!-- INVENTORY REPORT -->
    <div data-panel-group="park" data-panel="inventory-report"${tab!=='inventory-report'?' style="display:none"':''}>
      <!-- Filters -->
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-body">
          <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end">
            <div class="fg" style="min-width:200px;flex:1">
              <label class="fl">Project</label>
              <select class="fc" id="pir-project"></select>
            </div>
            <div class="fg" style="min-width:140px">
              <label class="fl">Type</label>
              <select class="fc" id="pir-type">
                <option value="">All Types</option>
                <option value="covered">Covered</option>
                <option value="open">Open</option>
                <option value="stilt">Stilt</option>
                <option value="ev">EV</option>
              </select>
            </div>
            <div class="fg" style="min-width:140px">
              <label class="fl">Status</label>
              <select class="fc" id="pir-status">
                <option value="">All Status</option>
                <option value="available">Available</option>
                <option value="allotted">Allotted</option>
              </select>
            </div>
            <button class="btn btn-primary" onclick="ParkingPage.loadInventoryReport()">FETCH</button>
            <button class="btn btn-ghost" onclick="ParkingPage.exportReport()">Export</button>
          </div>
        </div>
      </div>
      <!-- KPIs -->
      <div id="pir-kpis" style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:14px"></div>
      <!-- Table -->
      <div id="pir-body"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>
    </div>
  `;

  await ParkingPage.init(tab);
};

const ParkingPage = {
  _projects: [],
  _consumers: [],
  _slots: [],        // available slots for assign
  _reportData: [],
  _typeData: [],     // local type master (project-type-price combos)

  async init(tab) {
    await this._loadLookups();
    if (tab === 'type-master')       this.loadTypeMaster();
    else if (tab === 'inventory-master') { this.loadInventoryMaster(); this.loadSlotList(); }
    else if (tab === 'assign')       this.loadAssign();
    else if (tab === 'inventory-report') this.loadInventoryReport();
  },

  async _loadLookups() {
    try {
      const [pRes, cRes] = await Promise.allSettled([
        window.ProjectCache.load(),
        Promise.resolve({ data: [] }),
      ]);
      this._projects = pRes.status === 'fulfilled' ? (pRes.value.data || pRes.value || []) : [];
      this._consumers = cRes.status === 'fulfilled' ? (cRes.value.data || cRes.value || []) : [];

      const projOpts = await Utils.projectOptions();

      ['ptm-project','pim-project','pim-filter-project','pas-project','pir-project'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = id === 'ptm-project' ? projOpts.replace('— All Projects —', '— Select Project —') : projOpts;
      });
      try { this._prices = (await Api.get('/parking/types')).data || []; } catch { this._prices = []; }

      const consumerOpts = '<option value="">— Select Consumer —</option>' +
        this._consumers.map(c => {
          const nm = c.first_name ? `${c.first_name} ${c.last_name||''}`.trim() : (c.name||'—');
          return `<option value="${c.id}">${nm} · ${c.mobile||''}</option>`;
        }).join('');
      const consEl = document.getElementById('pas-consumer');
      if (consEl) consEl.innerHTML = consumerOpts;
    } catch {}
  },

  // ── TYPE MASTER ────────────────────────────────────────────

  async loadTypeMaster() {
    try { this._prices = (await Api.get('/parking/types')).data || []; } catch (err) { this._prices = []; Utils.error(err.message); }
    this._typeData = this._prices.map(t => ({ id: t.id, project: t.project_name, projectId: t.project_id, name: t.parking_type, price: Number(t.price_inr), desc: t.description }));
    this._renderTypeList();
  },

  _renderTypeList() {
    const el = document.getElementById('ptm-list-body');
    if (!el) return;
    if (!this._typeData.length) {
      el.innerHTML = '<div class="empty-state"><p>No types defined. Add your first type.</p></div>';
      return;
    }
    el.innerHTML = `
      <table>
        <thead><tr><th>#</th><th>Project</th><th>Type Name</th><th>Price</th><th>Description</th><th>Action</th></tr></thead>
        <tbody>
          ${this._typeData.map((t,i)=>`<tr>
            <td style="color:var(--text3)">${i+1}</td>
            <td style="font-size:10.5px">${Utils.esc(t.project||'—')}</td>
            <td class="td-bold">${Utils.esc(t.name)}</td>
            <td style="color:var(--green);font-weight:600">${Utils.currency(t.price)}</td>
            <td style="font-size:10.5px">${Utils.esc(t.desc||'—')}</td>
            <td>
              <button class="btn btn-ghost btn-sm" onclick="ParkingPage.editType('${t.id}')">Edit</button>
              <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="ParkingPage.deleteType('${t.id}')">Delete</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    `;
  },

  async saveType() {
    const projectId = document.getElementById('ptm-project')?.value || '';
    const parkingType = document.getElementById('ptm-name')?.value;
    const priceText = document.getElementById('ptm-price')?.value?.trim();
    const description = document.getElementById('ptm-desc')?.value?.trim();
    const result = document.getElementById('ptm-result');
    if (!projectId) { if (result) result.innerHTML = '<div class="alert alert-warn">Select a project.</div>'; return; }
    if (priceText === '' || priceText === undefined) { if (result) result.innerHTML = '<div class="alert alert-warn">Price is required.</div>'; return; }
    try {
      await Api.put('/parking/types', { projectId, parkingType, priceInr: priceText, description: description || undefined });
      await this.loadTypeMaster();
      this.resetTypeForm();
      if (result) result.innerHTML = '<div class="alert alert-success">✓ Price saved.</div>';
      setTimeout(() => { if (result) result.innerHTML = ''; }, 3000);
    } catch (err) { if (result) result.innerHTML = `<div class="alert alert-error">${Utils.esc(err.message)}</div>`; }
  },

  editType(id) {
    const t = this._typeData.find(x => x.id === id);
    if (!t) return;
    document.getElementById('ptm-project').value = t.projectId;
    document.getElementById('ptm-name').value = t.name;
    document.getElementById('ptm-price').value = String(t.price);
    document.getElementById('ptm-desc').value = t.desc || '';
  },

  deleteType(id) {
    Utils.confirm('Delete this price?', async () => {
      try { await Api.delete(`/parking/types/${id}`); await this.loadTypeMaster(); Utils.success('Price deleted'); }
      catch (err) { Utils.error(err.message); }
    });
  },

  resetTypeForm() {
    const priceEl = document.getElementById('ptm-price'); if (priceEl) priceEl.value = '';
    const descEl = document.getElementById('ptm-desc'); if (descEl) descEl.value = '';
  },

  // ── INVENTORY MASTER ────────────────────────────────────────

  loadInventoryMaster() {
    this.loadSlotList();
  },

  async addSlot() {
    const projectId  = document.getElementById('pim-project')?.value;
    const slotNumber = document.getElementById('pim-slot')?.value?.trim();
    const type       = document.getElementById('pim-type')?.value || 'covered';
    const floorText  = document.getElementById('pim-floor')?.value?.trim();
    const priceText  = document.getElementById('pim-price')?.value?.trim();
    const result     = document.getElementById('pim-result');
    const warn = (m) => { if (result) result.innerHTML = `<div class="alert alert-warn">${m}</div>`; };

    if (!projectId) return warn('Please select a project.');
    if (!slotNumber) return warn('Slot number is required.');
    if (!priceText && this._priceForType(projectId, type) === null) return warn('Enter a price, or set the price of this type in Parking Type Master.');
    try {
      await Api.post('/parking', { projectId, slotNumber, parkingType: type, floor: floorText || undefined, amount: priceText || undefined });
      if (result) result.innerHTML = `<div class="alert alert-success">✓ Slot ${Utils.esc(slotNumber)} created.</div>`;
      document.getElementById('pim-slot').value = '';
      this.loadSlotList();
    } catch (err) {
      if (result) result.innerHTML = `<div class="alert alert-error">${Utils.esc(err.message)}</div>`;
    }
  },

  async bulkAddSlots() {
    const projectId = document.getElementById('pim-project')?.value;
    const type      = document.getElementById('pim-type')?.value || 'covered';
    const floorText = document.getElementById('pim-floor')?.value?.trim();
    const priceText = document.getElementById('pim-price')?.value?.trim();
    const result    = document.getElementById('pim-result');

    if (!projectId) { if (result) result.innerHTML = '<div class="alert alert-warn">Select a project first.</div>'; return; }
    if (!priceText && this._priceForType(projectId, type) === null) { if (result) result.innerHTML = '<div class="alert alert-warn">Enter a price, or set the price of this type in Parking Type Master.</div>'; return; }
    const countStr = prompt('How many slots to create? (e.g. 20 will create P001 to P020; numbers that exist are skipped)');
    if (countStr === null) return;
    result.innerHTML = '<div class="page-loading" style="padding:10px"><div class="spinner"></div> Creating slots…</div>';
    try {
      const res = await Api.post('/parking/bulk', { projectId, count: countStr.trim(), parkingType: type, floor: floorText || undefined, amount: priceText || undefined });
      const d = res.data || res;
      result.innerHTML = `<div class="alert alert-success">✓ Created ${d.created} of ${d.requested} slots (${Utils.esc(d.first)} to ${Utils.esc(d.last)})${d.skipped ? `, ${d.skipped} already existed` : ''}.</div>`;
      this.loadSlotList();
    } catch (err) { result.innerHTML = `<div class="alert alert-error">${Utils.esc(err.message)}</div>`; }
  },

  // the price list entry of a type in a project, or null when there is none (no invented default)
  _priceForType(projectId, type) {
    const t = (this._prices || []).find(x => x.project_id === projectId && x.parking_type === type);
    return t ? Number(t.price_inr) : null;
  },

  async releaseSlot(id) {
    Utils.confirm('Release this slot? It goes back to Available.', async () => {
      try { await Api.patch(`/parking/${id}/release`, {}); Utils.success('Slot released'); this.loadSlotList(); }
      catch (err) { Utils.error(err.message); }
    });
  },

  async deleteSlot(id) {
    Utils.confirm('Delete this slot?', async () => {
      try { await Api.delete(`/parking/${id}`); Utils.success('Slot deleted'); this.loadSlotList(); }
      catch (err) { Utils.error(err.message); }
    });
  },

  async loadSlotList() {
    const el = document.getElementById('pim-slot-list');
    if (!el) return;
    el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const res = await Api.get('/parking', { params: {
        projectId:  document.getElementById('pim-filter-project')?.value || undefined,
        parkingType: document.getElementById('pim-filter-type')?.value || undefined,
        status:     document.getElementById('pim-filter-status')?.value || undefined,
        pageSize: 300,
      }});
      const slots = res.data || res || [];
      el.innerHTML = slots.length === 0
        ? '<div class="empty-state"><h3>No slots found</h3><p>Create slots using the form on the left</p></div>'
        : `<table>
            <thead><tr><th>#</th><th>Slot No.</th><th>Type</th><th>Floor</th><th>Status</th><th>Price</th><th>Allottee</th><th>Action</th></tr></thead>
            <tbody>
              ${slots.map((s,i)=>`<tr>
                <td style="color:var(--text3)">${i+1}</td>
                <td class="td-bold">${Utils.esc(s.slot_number||'—')}</td>
                <td>${(s.parking_type||'—').replace(/_/g,' ')}</td>
                <td>${s.floor!=null?s.floor:'G'}</td>
                <td>${Utils.chip(s.status||'available')}</td>
                <td>${Utils.currency(s.amount_inr||0)}</td>
                <td style="font-size:10.5px">${Utils.esc(s.consumer_name||'—')}</td>
                <td>${s.status==='allotted' ? `<button class="btn btn-ghost btn-sm" onclick="ParkingPage.releaseSlot('${s.id}')">Release</button>` : `<button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="ParkingPage.deleteSlot('${s.id}')">Delete</button>`}</td>
              </tr>`).join('')}
            </tbody>
          </table>`;
    } catch (err) {
      el.innerHTML = `<div style="padding:20px;color:var(--red)">${Utils.esc(err.message)}</div>`;
    }
  },

  // ── ASSIGN PARKING ──────────────────────────────────────────

  async loadAssign() {
    this.loadRecentAssignments();
  },

  async loadAvailableSlots(projectId) {
    const sel = document.getElementById('pas-slot');
    if (!sel) return;
    if (!projectId) {
      sel.innerHTML = '<option value="">— Select Project First —</option>';
      return;
    }
    try {
      await this._loadConsumersOf(projectId);
      const res = await Api.get('/parking', { params: { projectId, status: 'available', pageSize: 1000 } });
      const slots = res.data || res || [];
      this._slots = slots;
      sel.innerHTML = slots.length
        ? '<option value="">— Select Slot —</option>' +
          slots.map(s => `<option value="${s.id}" data-price="${s.amount_inr||0}" data-type="${s.parking_type||''}">${Utils.esc(s.slot_number)} — ${(s.parking_type||'').replace(/_/g,' ')} — ${Utils.currency(s.amount_inr||0)}</option>`).join('')
        : '<option value="">No available slots</option>';
    } catch {
      sel.innerHTML = '<option value="">Error loading slots</option>';
    }
  },

  async _loadConsumersOf(projectId) {
    try { this._consumers = (await Api.get('/consumers', { params: { projectId, leadStage: 'allotted', pageSize: 1000 } })).data || []; } catch { this._consumers = []; }
    const el = document.getElementById('pas-consumer');
    if (el) el.innerHTML = '<option value="">— Select Consumer —</option>' + this._consumers.map(c => {
      const nm = c.first_name ? `${c.first_name} ${c.last_name||''}`.trim() : (c.name||'—');
      return `<option value="${c.id}">${Utils.esc(nm)} · ${Utils.esc(c.mobile||'')}</option>`;
    }).join('');
  },

  updateSlotPrice(slotId) {
    const sel = document.getElementById('pas-slot');
    const selected = sel?.options[sel.selectedIndex];
    const price = selected?.dataset.price;
    const amtEl = document.getElementById('pas-amount');
    if (amtEl && price) amtEl.value = price;
  },

  loadConsumerUnit(consumerId) {
    const consumer = this._consumers.find(c=>c.id===consumerId);
    const unitEl = document.getElementById('pas-unit');
    if (unitEl) unitEl.value = consumer?.unit_number || consumer?.unitNumber || '';
  },

  async assignParking() {
    const projectId  = document.getElementById('pas-project')?.value;
    const consumerId = document.getElementById('pas-consumer')?.value;
    const slotSel    = document.getElementById('pas-slot');
    const slotOption = slotSel?.options[slotSel.selectedIndex];
    const slotId     = slotSel?.value;
    const slotNumber = slotOption?.textContent?.split(' —')[0]?.trim();
    const amountText = document.getElementById('pas-amount')?.value?.trim();
    const amount     = amountText === '' ? 0 : Number(amountText);
    const result     = document.getElementById('pas-result');

    if (!projectId)  { if (result) result.innerHTML = '<div class="alert alert-warn">Select a project.</div>'; return; }
    if (!consumerId) { if (result) result.innerHTML = '<div class="alert alert-warn">Select a consumer.</div>'; return; }
    if (!slotId)     { if (result) result.innerHTML = '<div class="alert alert-warn">Select a parking slot.</div>'; return; }

    const consumer = this._consumers.find(c=>c.id===consumerId);
    const consumerName = consumer?.name || consumer?.first_name || '—';

    Utils.confirm(`Assign slot ${slotNumber} to ${consumerName}? Amount: ${Utils.currency(amount)}`, async () => {
      try {
        await Api.post('/parking', {
          projectId,
          consumerId,
          slotNumber,
          unitId: consumer?.allocated_unit_id || undefined,
          amount: amountText || undefined,
        });
        if (result) result.innerHTML = `<div class="alert alert-success">✓ Parking slot ${slotNumber} assigned to ${Utils.esc(consumerName)}.</div>`;
        // Reload available slots
        await this.loadAvailableSlots(projectId);
        this.loadRecentAssignments();
      } catch (err) {
        if (result) result.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
      }
    });
  },

  async loadRecentAssignments() {
    const el = document.getElementById('pas-recent-body');
    if (!el) return;
    try {
      const res = await Api.get('/parking', { params: { status: 'allotted', pageSize: 20 } });
      const list = res.data || res || [];
      el.innerHTML = list.length === 0
        ? '<div class="empty-state" style="padding:20px"><p>No parking assignments yet</p></div>'
        : `<table>
            <thead><tr><th>Slot</th><th>Consumer</th><th>Type</th><th>Amount</th><th>Date</th></tr></thead>
            <tbody>
              ${list.slice(0,15).map(p=>`<tr>
                <td class="td-bold">${Utils.esc(p.slot_number||'—')}</td>
                <td style="font-size:10.5px">${Utils.esc(p.consumer_name||'—')}</td>
                <td>${(p.parking_type||'—').replace(/_/g,' ')}</td>
                <td>${Utils.currency(p.amount_inr||0)}</td>
                <td style="font-size:10.5px">${Utils.date(p.allotted_at||p.created_at)}</td>
              </tr>`).join('')}
            </tbody>
          </table>`;
    } catch {
      el.innerHTML = '<div class="empty-state" style="padding:20px"><p>Unable to load assignments</p></div>';
    }
  },

  // ── INVENTORY REPORT ────────────────────────────────────────

  async loadInventoryReport() {
    const el = document.getElementById('pir-body');
    const kpiEl = document.getElementById('pir-kpis');
    if (!el) return;
    el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

    const projectId  = document.getElementById('pir-project')?.value || '';
    const type       = document.getElementById('pir-type')?.value || '';
    const status     = document.getElementById('pir-status')?.value || '';

    try {
      const res = await Api.get('/parking', { params: {
        projectId: projectId || undefined,
        parkingType: type || undefined,
        status: status || undefined,
        pageSize: 500,
      }});
      const slots = res.data || res || [];
      this._reportData = slots;

      const available = slots.filter(s=>s.status==='available').length;
      const allotted  = slots.filter(s=>s.status==='allotted').length;
      const covered   = slots.filter(s=>s.parking_type==='covered').length;
      const open      = slots.filter(s=>s.parking_type==='open').length;
      const revenue   = slots.filter(s=>s.status==='allotted')
                             .reduce((s,p)=>s+parseFloat(p.amount_inr||0),0);

      if (kpiEl) {
        kpiEl.innerHTML = [
          { label:'Total Slots',     value: slots.length },
          { label:'Available',       value: available, color:'var(--green)' },
          { label:'Allotted',        value: allotted,  color:'var(--accent)' },
          { label:'Covered / Open',  value: `${covered} / ${open}` },
          { label:'Parking Revenue', value: Utils.currency(revenue), color:'var(--teal)' },
        ].map(k=>`
          <div class="kpi-card">
            <div class="kpi-label">${k.label}</div>
            <div class="kpi-value" style="color:${k.color||'var(--text1)'}">${k.value}</div>
          </div>
        `).join('');
      }

      if (slots.length === 0) {
        el.innerHTML = '<div class="empty-state"><h3>No parking slots found</h3><p>Create slots in Inventory Master first</p></div>';
        return;
      }

      el.innerHTML = `
        <table>
          <thead>
            <tr>
              <th>#</th><th>Slot No.</th><th>Project</th><th>Type</th><th>Floor</th>
              <th>Status</th><th>Price</th><th>Allottee</th><th>Unit No.</th><th>Allotted On</th>
            </tr>
          </thead>
          <tbody>
            ${slots.map((s,i)=>`<tr>
              <td style="color:var(--text3)">${i+1}</td>
              <td class="td-bold">${Utils.esc(s.slot_number||'—')}</td>
              <td style="font-size:10.5px">${Utils.esc(s.project_name||'—')}</td>
              <td>${(s.parking_type||'—').replace(/_/g,' ')}</td>
              <td>${s.floor!=null?s.floor:'G'}</td>
              <td>${Utils.chip(s.status||'available')}</td>
              <td style="font-weight:600">${Utils.currency(s.amount_inr||0)}</td>
              <td style="font-size:10.5px">${Utils.esc(s.consumer_name||'—')}</td>
              <td style="font-size:10.5px">${Utils.esc(s.unit_number||'—')}</td>
              <td style="font-size:10.5px">${s.allotted_at?Utils.date(s.allotted_at):'—'}</td>
            </tr>`).join('')}
          </tbody>
          <tfoot class="tfoot-total">
            <tr>
              <td colspan="6"><strong>TOTAL: ${slots.length} slots</strong></td>
              <td style="color:var(--teal)"><strong>${Utils.currency(revenue)}</strong></td>
              <td colspan="3"></td>
            </tr>
          </tfoot>
        </table>
      `;
    } catch (err) {
      el.innerHTML = `<div style="padding:20px;color:var(--red)">${Utils.esc(err.message)}</div>`;
    }
  },

  exportReport() {
    if (!this._reportData.length) { Utils.warn('No data to export'); return; }
    const rows = [
      ['Slot No', 'Project', 'Type', 'Floor', 'Status', 'Price', 'Allottee', 'Unit', 'Date'],
      ...this._reportData.map(s => [
        s.slot_number, s.project_name||'—', s.parking_type||'—',
        s.floor!=null?s.floor:'G', s.status||'—',
        s.amount_inr||0, s.consumer_name||'—', s.unit_number||'—',
        s.allotted_at ? Utils.date(s.allotted_at) : '—',
      ]),
    ];
    const csv = rows.map(r=>r.map(v=>Utils.csvCell(v)).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    a.download = 'parking_inventory_report.csv';
    a.click();
  },
};
