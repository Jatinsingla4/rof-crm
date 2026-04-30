// ROF CRM — Parking Management Page

Pages.parking = async function(params = {}) {
  const tab = params.tab || 'type-master';
  const content = document.getElementById('content');
  content.innerHTML = `
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
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <!-- Add / Edit Type -->
        <div class="sp">
          <div class="sp-hdr"><div class="sp-title">Add Parking Type</div></div>
          <div class="sp-body">
            <div class="sp-grid" style="grid-template-columns:1fr">
              <div class="fg"><label class="fl"><span class="r">*</span>Project</label>
                <select class="fc" id="ptm-project"></select>
              </div>
              <div class="fg"><label class="fl"><span class="r">*</span>Type Name</label>
                <input type="text" class="fc" id="ptm-name" placeholder="e.g. Covered, Open, Stilt, EV">
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
      <div style="display:grid;grid-template-columns:1fr 2fr;gap:14px">
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
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
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
        <div class="sp-body" style="padding:10px 14px">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
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
        Api.get('/units/projects'),
        Api.get('/consumers', { params: { leadStage: 'allotted', pageSize: 500 } }),
      ]);
      this._projects = pRes.status === 'fulfilled' ? (pRes.value.data || pRes.value || []) : [];
      this._consumers = cRes.status === 'fulfilled' ? (cRes.value.data || cRes.value || []) : [];

      const projOpts = '<option value="">— All Projects —</option>' +
        this._projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

      ['ptm-project','pim-project','pim-filter-project','pas-project','pir-project'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = projOpts;
      });

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

  loadTypeMaster() {
    // Load from localStorage (since no dedicated type-master API endpoint)
    this._typeData = JSON.parse(localStorage.getItem('rof_parking_types') || '[]');
    if (!this._typeData.length) {
      // Seed defaults
      this._typeData = [
        { id:1, project:'All Projects', projectId:'', name:'Covered', price:100000, desc:'Covered parking with security' },
        { id:2, project:'All Projects', projectId:'', name:'Open',    price:50000,  desc:'Open outdoor parking' },
        { id:3, project:'All Projects', projectId:'', name:'Stilt',   price:75000,  desc:'Stilt floor parking' },
      ];
      localStorage.setItem('rof_parking_types', JSON.stringify(this._typeData));
    }
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
            <td style="font-size:10.5px">${t.project||'All'}</td>
            <td class="td-bold">${t.name}</td>
            <td style="color:var(--green);font-weight:600">${Utils.currency(t.price)}</td>
            <td style="font-size:10.5px">${t.desc||'—'}</td>
            <td>
              <button class="btn btn-ghost btn-sm" onclick="ParkingPage.editType(${t.id})">Edit</button>
              <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="ParkingPage.deleteType(${t.id})">Delete</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    `;
  },

  saveType() {
    const projectId = document.getElementById('ptm-project')?.value || '';
    const projectName = this._projects.find(p=>p.id===projectId)?.name || 'All Projects';
    const name  = document.getElementById('ptm-name')?.value?.trim();
    const price = parseFloat(document.getElementById('ptm-price')?.value || '0');
    const desc  = document.getElementById('ptm-desc')?.value?.trim();
    const result= document.getElementById('ptm-result');

    if (!name || !price) {
      if (result) result.innerHTML = '<div class="alert alert-warn">Type name and price are required.</div>';
      return;
    }
    const editing = document.getElementById('ptm-name')?.dataset.editingId;
    if (editing) {
      const idx = this._typeData.findIndex(t=>t.id===parseInt(editing));
      if (idx>=0) this._typeData[idx] = { id:parseInt(editing), project:projectName, projectId, name, price, desc };
    } else {
      const newId = (this._typeData[this._typeData.length-1]?.id||0) + 1;
      this._typeData.push({ id:newId, project:projectName, projectId, name, price, desc });
    }
    localStorage.setItem('rof_parking_types', JSON.stringify(this._typeData));
    this._renderTypeList();
    this.resetTypeForm();
    if (result) result.innerHTML = `<div class="alert alert-success">✓ Parking type "${name}" saved.</div>`;
    setTimeout(() => { if (result) result.innerHTML = ''; }, 3000);
  },

  editType(id) {
    const t = this._typeData.find(x=>x.id===id);
    if (!t) return;
    const nameEl  = document.getElementById('ptm-name');
    const priceEl = document.getElementById('ptm-price');
    const descEl  = document.getElementById('ptm-desc');
    const projEl  = document.getElementById('ptm-project');
    if (nameEl)  { nameEl.value = t.name; nameEl.dataset.editingId = String(id); }
    if (priceEl) priceEl.value = String(t.price);
    if (descEl)  descEl.value  = t.desc||'';
    if (projEl && t.projectId) projEl.value = t.projectId;
  },

  deleteType(id) {
    Utils.confirm('Delete this parking type?', () => {
      this._typeData = this._typeData.filter(t=>t.id!==id);
      localStorage.setItem('rof_parking_types', JSON.stringify(this._typeData));
      this._renderTypeList();
    });
  },

  resetTypeForm() {
    const nameEl = document.getElementById('ptm-name');
    if (nameEl) { nameEl.value = ''; delete nameEl.dataset.editingId; }
    const priceEl = document.getElementById('ptm-price');
    if (priceEl) priceEl.value = '';
    const descEl = document.getElementById('ptm-desc');
    if (descEl) descEl.value = '';
  },

  // ── INVENTORY MASTER ────────────────────────────────────────

  loadInventoryMaster() {
    this.loadSlotList();
  },

  async addSlot() {
    const projectId  = document.getElementById('pim-project')?.value;
    const slotNumber = document.getElementById('pim-slot')?.value?.trim();
    const type       = document.getElementById('pim-type')?.value || 'covered';
    const floor      = parseInt(document.getElementById('pim-floor')?.value||'0',10);
    const price      = parseFloat(document.getElementById('pim-price')?.value||'0') ||
                       this._priceForType(type);
    const result     = document.getElementById('pim-result');

    if (!projectId) {
      if (result) result.innerHTML = '<div class="alert alert-warn">Please select a project.</div>';
      return;
    }
    if (!slotNumber) {
      if (result) result.innerHTML = '<div class="alert alert-warn">Slot number is required.</div>';
      return;
    }
    try {
      await Api.post('/parking', { projectId, slotNumber, parkingType: type, floor, amount: price });
      if (result) result.innerHTML = `<div class="alert alert-success">✓ Slot ${slotNumber} created.</div>`;
      document.getElementById('pim-slot').value = '';
      this.loadSlotList();
    } catch (err) {
      if (result) result.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  },

  async bulkAddSlots() {
    const projectId = document.getElementById('pim-project')?.value;
    const type      = document.getElementById('pim-type')?.value || 'covered';
    const floor     = parseInt(document.getElementById('pim-floor')?.value||'0',10);
    const price     = parseFloat(document.getElementById('pim-price')?.value||'0') ||
                      this._priceForType(type);
    const result    = document.getElementById('pim-result');

    if (!projectId) { if (result) result.innerHTML = '<div class="alert alert-warn">Select a project first.</div>'; return; }

    const countStr = prompt('How many slots to create? (e.g. 20 will create P001 to P020)');
    const count = parseInt(countStr||'0',10);
    if (!count || count<1) return;

    let created = 0;
    result.innerHTML = '<div class="page-loading" style="padding:10px"><div class="spinner"></div> Creating slots…</div>';
    for (let i=1; i<=count; i++) {
      const slotNumber = `P${String(i).padStart(3,'0')}`;
      try {
        await Api.post('/parking', { projectId, slotNumber, parkingType: type, floor, amount: price });
        created++;
      } catch {}
    }
    if (result) result.innerHTML = `<div class="alert alert-success">✓ Created ${created} of ${count} slots.</div>`;
    this.loadSlotList();
  },

  _priceForType(type) {
    const defaults = { covered:100000, stilt:75000, open:50000, ev:150000, visitor:0 };
    return defaults[type] || 0;
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
            <thead><tr><th>#</th><th>Slot No.</th><th>Type</th><th>Floor</th><th>Status</th><th>Price</th><th>Allottee</th></tr></thead>
            <tbody>
              ${slots.map((s,i)=>`<tr>
                <td style="color:var(--text3)">${i+1}</td>
                <td class="td-bold">${s.slot_number||'—'}</td>
                <td>${(s.parking_type||'—').replace(/_/g,' ')}</td>
                <td>${s.floor!=null?s.floor:'G'}</td>
                <td>${Utils.chip(s.status||'available')}</td>
                <td>${Utils.currency(s.amount_inr||0)}</td>
                <td style="font-size:10.5px">${s.consumer_name||'—'}</td>
              </tr>`).join('')}
            </tbody>
          </table>`;
    } catch (err) {
      el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`;
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
      const res = await Api.get('/parking', { params: { projectId, status: 'available', pageSize: 200 } });
      const slots = res.data || res || [];
      this._slots = slots;
      sel.innerHTML = slots.length
        ? '<option value="">— Select Slot —</option>' +
          slots.map(s => `<option value="${s.id}" data-price="${s.amount_inr||0}" data-type="${s.parking_type||''}">${s.slot_number} — ${(s.parking_type||'').replace(/_/g,' ')} — ${Utils.currency(s.amount_inr||0)}</option>`).join('')
        : '<option value="">No available slots</option>';
    } catch {
      sel.innerHTML = '<option value="">Error loading slots</option>';
    }
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
    const type       = slotOption?.dataset.type || 'covered';
    const amount     = parseFloat(document.getElementById('pas-amount')?.value || '0');
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
          parkingType: type,
          amount,
        });
        if (result) result.innerHTML = `<div class="alert alert-success">✓ Parking slot ${slotNumber} assigned to ${consumerName}.</div>`;
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
                <td class="td-bold">${p.slot_number||'—'}</td>
                <td style="font-size:10.5px">${p.consumer_name||'—'}</td>
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
              <td class="td-bold">${s.slot_number||'—'}</td>
              <td style="font-size:10.5px">${s.project_name||'—'}</td>
              <td>${(s.parking_type||'—').replace(/_/g,' ')}</td>
              <td>${s.floor!=null?s.floor:'G'}</td>
              <td>${Utils.chip(s.status||'available')}</td>
              <td style="font-weight:600">${Utils.currency(s.amount_inr||0)}</td>
              <td style="font-size:10.5px">${s.consumer_name||'—'}</td>
              <td style="font-size:10.5px">${s.unit_number||'—'}</td>
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
      el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`;
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
    const csv = rows.map(r=>r.map(v=>`"${v}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    a.download = 'parking_inventory_report.csv';
    a.click();
  },
};
