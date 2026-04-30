// ROF CRM — Set Projects (Project & Unit Configuration)

Pages.setProjects = async function(params = {}) {
  const tab = params.tab || 'new-project';
  const content = document.getElementById('content');

  const tabBtn = (key, label, active) =>
    `<button class="tab-line${active?' active':''}" data-group="spj" data-tab="${key}"
       onclick="switchTab('spj','${key}');SPJPage.load('${key}')">${label}</button>`;

  content.innerHTML = `
    <div class="page-hdr">
      <h1>Set Projects</h1>
      <div class="breadcrumb">Settings / <b>Project Configuration</b></div>
    </div>
    <div class="tabs-line" style="flex-wrap:wrap">
      ${tabBtn('new-project',      'New Project',         tab==='new-project')}
      ${tabBtn('edit-project',     'Edit Project',        tab==='edit-project')}
      ${tabBtn('add-tower',        'Add Tower/Plot',      tab==='add-tower')}
      ${tabBtn('add-unit',         'Add Unit',            tab==='add-unit')}
      ${tabBtn('unit-location',    'Unit Location',       tab==='unit-location')}
      ${tabBtn('reminder-master',  'Reminder Master',     tab==='reminder-master')}
      ${tabBtn('plan-setup',       'Payment Plan Setup',  tab==='plan-setup')}
      ${tabBtn('plan-view',        'View Plans',          tab==='plan-view')}
      ${tabBtn('rate-report',      'Rate Report',         tab==='rate-report')}
    </div>

    <!-- NEW PROJECT -->
    <div data-panel-group="spj" data-panel="new-project" ${tab!=='new-project'?'style="display:none"':''}>
      <div class="sp">
        <div class="sp-hdr"><div class="sp-title">Create New Project</div></div>
        <div class="sp-body">
          <form id="spj-new-project-form" onsubmit="SPJPage.createProject(event)">
            <div class="sp-grid">
              <div class="fg">
                <label class="fl"><span class="r">*</span>Project Name</label>
                <input class="fc" name="name" placeholder="e.g. ROF AALAYAS" required>
              </div>
              <div class="fg">
                <label class="fl"><span class="r">*</span>RERA Number</label>
                <input class="fc" name="reraNumber" placeholder="RERA/GGM/2024/XXXX" required>
              </div>
              <div class="fg">
                <label class="fl"><span class="r">*</span>TCP Licence No.</label>
                <input class="fc" name="tcpLicence" placeholder="Licence number" required>
              </div>
              <div class="fg">
                <label class="fl">Location / Sector</label>
                <input class="fc" name="location" placeholder="e.g. Sector 93, Gurugram">
              </div>
              <div class="fg">
                <label class="fl">Land Area (sqft)</label>
                <input type="number" class="fc" name="landAreaSqft" placeholder="0">
              </div>
              <div class="fg">
                <label class="fl">Total Units (Planned)</label>
                <input type="number" class="fc" name="totalUnits" placeholder="0">
              </div>
              <div class="fg">
                <label class="fl">Possession Date</label>
                <input type="date" class="fc" name="possessionDate">
              </div>
              <div class="fg">
                <label class="fl">Income Category</label>
                <select class="fc" name="incomeCategory">
                  <option value="">All</option>
                  <option>EWS</option><option>LIG</option><option>MIG</option>
                </select>
              </div>
            </div>
            <div style="margin-top:14px;display:flex;gap:8px">
              <button type="submit" class="btn btn-teal">Save Project</button>
              <button type="reset" class="btn btn-ghost">Clear</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- EDIT PROJECT -->
    <div data-panel-group="spj" data-panel="edit-project" ${tab!=='edit-project'?'style="display:none"':''}>
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-body" style="padding:10px 14px">
          <div style="display:flex;gap:8px;align-items:center">
            <select class="fc" id="spj-edit-project-sel" style="max-width:280px" onchange="SPJPage.loadEditProject()">
              <option value="">— Select Project to Edit —</option>
            </select>
          </div>
        </div>
      </div>
      <div id="spj-edit-project-form-wrap" style="display:none">
        <div class="sp">
          <div class="sp-hdr"><div class="sp-title" id="spj-edit-project-title">Edit Project</div></div>
          <div class="sp-body">
            <form id="spj-edit-project-form" onsubmit="SPJPage.updateProject(event)">
              <input type="hidden" id="spj-edit-proj-id">
              <div class="sp-grid">
                <div class="fg"><label class="fl">Project Name</label><input class="fc" id="spj-edit-proj-name"></div>
                <div class="fg"><label class="fl">Location</label><input class="fc" id="spj-edit-proj-location"></div>
                <div class="fg"><label class="fl">Total Units</label><input type="number" class="fc" id="spj-edit-proj-units"></div>
              </div>
              <div style="margin-top:12px;display:flex;gap:8px">
                <button type="submit" class="btn btn-teal">Update Project</button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div id="spj-projects-list"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>

    <!-- ADD TOWER/PLOT -->
    <div data-panel-group="spj" data-panel="add-tower" ${tab!=='add-tower'?'style="display:none"':''}>
      <div class="g2" style="gap:16px;align-items:start">
        <div class="sp" style="max-width:360px">
          <div class="sp-hdr"><div class="sp-title">Add Tower / Plot</div></div>
          <div class="sp-body">
            <form id="spj-tower-form" onsubmit="SPJPage.addTower(event)">
              <div class="form-group">
                <label class="form-label">Project <span style="color:var(--red)">*</span></label>
                <select class="form-control" id="spj-tower-project" required>
                  <option value="">Select Project</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Tower / Plot Name <span style="color:var(--red)">*</span></label>
                <input class="form-control" name="towerName" placeholder="e.g. Tower A" required>
              </div>
              <div class="form-group">
                <label class="form-label">No. of Floors</label>
                <input type="number" class="form-control" name="floors" placeholder="e.g. 14">
              </div>
              <button type="submit" class="btn btn-teal" style="margin-top:8px">Add Tower</button>
            </form>
          </div>
        </div>
        <div style="flex:1">
          <div class="tbl-hdr mb8">
            <div class="tbl-title">Tower List</div>
            <div class="tbl-actions">
              <select class="form-control form-control-sm" id="spj-tower-list-project" onchange="SPJPage.loadTowers()" style="width:200px">
                <option value="">All Projects</option>
              </select>
            </div>
          </div>
          <div id="spj-towers-list"><div class="page-loading"><div class="spinner"></div></div></div>
        </div>
      </div>
    </div>

    <!-- ADD UNIT -->
    <div data-panel-group="spj" data-panel="add-unit" ${tab!=='add-unit'?'style="display:none"':''}>
      <div class="sp">
        <div class="sp-hdr"><div class="sp-title">Add Unit</div></div>
        <div class="sp-body">
          <form id="spj-unit-form" onsubmit="SPJPage.addUnit(event)">
            <div class="sp-grid">
              <div class="fg">
                <label class="fl"><span class="r">*</span>Project</label>
                <select class="fc" id="spj-unit-project" required onchange="SPJPage.onUnitProjectChange()">
                  <option value="">Select Project</option>
                </select>
              </div>
              <div class="fg">
                <label class="fl">Tower</label>
                <select class="fc" id="spj-unit-tower">
                  <option value="">Select Tower</option>
                </select>
              </div>
              <div class="fg">
                <label class="fl"><span class="r">*</span>Unit Number</label>
                <input class="fc" name="unit_number" placeholder="e.g. A-101" required>
              </div>
              <div class="fg">
                <label class="fl">Floor</label>
                <input type="number" class="fc" name="floor" placeholder="1">
              </div>
              <div class="fg">
                <label class="fl">BHK Type</label>
                <select class="fc" name="bhk_type">
                  <option value="">Select</option>
                  ${ROF.BHK_TYPES.map(b=>`<option>${b}</option>`).join('')}
                </select>
              </div>
              <div class="fg">
                <label class="fl">Facing</label>
                <select class="fc" name="facing">
                  <option value="">Select</option>
                  ${ROF.FACINGS.map(f=>`<option>${f}</option>`).join('')}
                </select>
              </div>
              <div class="fg">
                <label class="fl">Carpet Area (sqft)</label>
                <input type="number" step="0.01" class="fc" name="carpet_area_sqft">
              </div>
              <div class="fg">
                <label class="fl">Super Area (sqft)</label>
                <input type="number" step="0.01" class="fc" name="super_area_sqft">
              </div>
              <div class="fg">
                <label class="fl">Base Price (₹)</label>
                <input type="number" class="fc" name="base_price">
              </div>
              <div class="fg">
                <label class="fl">Status</label>
                <select class="fc" name="status">
                  <option value="available">Available</option>
                  <option value="hold">Hold</option>
                  <option value="booked">Booked</option>
                </select>
              </div>
            </div>
            <div style="margin-top:14px;display:flex;gap:8px">
              <button type="submit" class="btn btn-teal">Add Unit</button>
              <button type="reset" class="btn btn-ghost">Clear</button>
            </div>
          </form>
          <hr style="margin:16px 0;border-color:var(--border)">
          <div class="tbl-hdr mb8">
            <div class="tbl-title">Bulk Add via CSV</div>
            <div class="tbl-actions">
              <button class="btn btn-ghost btn-sm" onclick="window.open('/api/import/template/units','_blank')">Download Template</button>
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <select class="fc" id="spj-bulk-project" style="max-width:240px">
              <option value="">Select Project</option>
            </select>
            <input type="file" class="fc" id="spj-bulk-file" accept=".csv,.xlsx" style="max-width:240px">
            <button class="btn btn-teal btn-sm" onclick="SPJPage.bulkAddUnits()">Upload</button>
          </div>
          <div id="spj-bulk-result" style="margin-top:8px"></div>
        </div>
      </div>
    </div>

    <!-- UNIT LOCATION MASTER -->
    <div data-panel-group="spj" data-panel="unit-location" ${tab!=='unit-location'?'style="display:none"':''}>
      <div class="g2" style="gap:16px;align-items:start">
        <div class="sp" style="max-width:360px">
          <div class="sp-hdr"><div class="sp-title">Unit Location Master</div></div>
          <div class="sp-body">
            <form id="spj-uloc-form" onsubmit="SPJPage.addUnitLocation(event)">
              <div class="form-group">
                <label class="form-label">Project <span style="color:var(--red)">*</span></label>
                <select class="form-control" id="spj-uloc-project" required>
                  <option value="">Select Project</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Location Name <span style="color:var(--red)">*</span></label>
                <input class="form-control" name="name" placeholder="e.g. Corner Flat, Park Facing" required>
              </div>
              <div class="form-group">
                <label class="form-label">Description</label>
                <textarea class="form-control" name="description" rows="2" placeholder="Optional"></textarea>
              </div>
              <button type="submit" class="btn btn-teal" style="margin-top:8px">Add Location</button>
            </form>
          </div>
        </div>
        <div style="flex:1">
          <div class="tbl-hdr mb8">
            <div class="tbl-title">Unit Locations</div>
            <div class="tbl-actions">
              <select class="form-control form-control-sm" id="spj-uloc-list-project" onchange="SPJPage.loadUnitLocations()" style="width:200px">
                <option value="">All Projects</option>
              </select>
            </div>
          </div>
          <div id="spj-uloc-list"><div class="page-loading"><div class="spinner"></div></div></div>
        </div>
      </div>
    </div>

    <!-- REMINDER MASTER -->
    <div data-panel-group="spj" data-panel="reminder-master" ${tab!=='reminder-master'?'style="display:none"':''}>
      <div class="g2" style="gap:16px;align-items:start">
        <div class="sp" style="max-width:360px">
          <div class="sp-hdr"><div class="sp-title">Add Reminder Rule</div></div>
          <div class="sp-body">
            <form id="spj-reminder-form" onsubmit="SPJPage.addReminder(event)">
              <div class="form-group">
                <label class="form-label">Reminder Name <span style="color:var(--red)">*</span></label>
                <input class="form-control" name="name" placeholder="e.g. 15-Day Demand Reminder" required>
              </div>
              <div class="form-group">
                <label class="form-label">Days Before Due Date <span style="color:var(--red)">*</span></label>
                <input type="number" class="form-control" name="days_before" min="0" placeholder="e.g. 15" required>
              </div>
              <div class="form-group">
                <label class="form-label">Channel</label>
                <select class="form-control" name="channel">
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="all">All Channels</option>
                </select>
              </div>
              <button type="submit" class="btn btn-teal" style="margin-top:8px">Add Reminder</button>
            </form>
          </div>
        </div>
        <div style="flex:1">
          <div class="tbl-hdr mb8"><div class="tbl-title">Reminder Rules</div></div>
          <div id="spj-reminder-list"><div class="page-loading"><div class="spinner"></div></div></div>
        </div>
      </div>
    </div>

    <!-- PAYMENT PLAN SETUP -->
    <div data-panel-group="spj" data-panel="plan-setup" ${tab!=='plan-setup'?'style="display:none"':''}>
      <!-- Sub-tabs use group "plan-sub" (NOT "spj") so they never hide this parent panel -->
      <div class="tabs-line" style="margin-bottom:14px">
        <button class="tab-line active" data-group="plan-sub" data-tab="plan-new"
          onclick="switchTab('plan-sub','plan-new')">New</button>
        <button class="tab-line" data-group="plan-sub" data-tab="plan-edit"
          onclick="switchTab('plan-sub','plan-edit');SPJPage.loadPlanTemplates()">Edit</button>
      </div>

      <!-- ── NEW sub-panel ────────────────────────────────────── -->
      <div data-panel-group="plan-sub" data-panel="plan-new">
        <div class="sp">
          <div class="sp-hdr">
            <div class="sp-title">Add Installment to Schedule</div>
            <div class="tbl-actions">
              <button class="btn btn-ghost btn-sm" onclick="SPJPage.loadAHPTemplate()">↻ Load AHP Template</button>
            </div>
          </div>
          <div class="sp-body">
            <form id="spj-plan-form" onsubmit="SPJPage.addInstallment(event)">
              <div class="sp-grid">
                <div class="fg">
                  <label class="fl"><span class="r">*</span>Project</label>
                  <select class="fc" id="spj-plan-project" required onchange="SPJPage.onPlanProjectChange()">
                    <option value="">Select Project</option>
                  </select>
                </div>
                <div class="fg">
                  <label class="fl"><span class="r">*</span>Plan Name</label>
                  <input class="fc" id="spj-plan-name" name="plan_name" value="Standard AHP Plan" placeholder="e.g. Standard AHP Plan" required>
                </div>
                <div class="fg">
                  <label class="fl"><span class="r">*</span>Installment Type</label>
                  <select class="fc" id="spj-plan-type" name="installment_type" onchange="SPJPage.onTypeChange(this.value)">
                    <option value="installment">Installment</option>
                    <option value="plc">PLC Charge</option>
                    <option value="other_charge">Other Charge</option>
                    <option value="booking">Booking Amount</option>
                    <option value="possession">On Possession</option>
                  </select>
                </div>
                <div class="fg">
                  <label class="fl"><span class="r">*</span>Installment Name</label>
                  <input class="fc" name="installment_name" id="spj-plan-iname" placeholder="e.g. On Allotment" required>
                </div>
                <div class="fg">
                  <label class="fl">Index (order)</label>
                  <input type="number" class="fc" name="installment_index" id="spj-plan-idx" min="1" value="1" placeholder="1">
                </div>
                <!-- Percentage: shown for installment, plc, booking, possession -->
                <div class="fg" id="spj-plan-pct-wrap">
                  <label class="fl">Percentage (%)</label>
                  <input type="number" step="0.001" class="fc" name="percentage" id="spj-plan-pct" placeholder="20.000">
                </div>
                <!-- Flat amount: shown for other_charge only -->
                <div class="fg" id="spj-plan-amt-wrap" style="display:none">
                  <label class="fl">Flat Amount (₹)</label>
                  <input type="number" class="fc" name="flat_amount_inr" id="spj-plan-amt" placeholder="0">
                </div>
                <div class="fg">
                  <label class="fl">Due Offset (days after allotment)</label>
                  <input type="number" class="fc" name="due_date_offset_days" id="spj-plan-offset" placeholder="0" value="0">
                </div>
                <div class="fg">
                  <label class="fl">Notes / Description</label>
                  <input class="fc" name="notes" placeholder="Optional notes">
                </div>
              </div>
              <div style="margin-top:14px;display:flex;gap:8px;align-items:center">
                <button type="submit" class="btn btn-teal">Add Installment</button>
                <button type="button" class="btn btn-ghost" onclick="SPJPage.clearPlanForm()">Clear Form</button>
              </div>
            </form>
          </div>
        </div>
        <div class="alert alert-info" style="margin-top:12px">
          <b>AHP Standard Schedule:</b> 5% Booking → 20% On Allotment (within 15 days) → 6 × 12.5% half-yearly → 5% On Possession = 100%
          &nbsp;<button class="btn btn-ghost btn-sm" onclick="SPJPage.loadAHPTemplate()">↻ Auto-fill this template</button>
        </div>
        <!-- Live schedule preview for selected project/plan -->
        <div id="spj-plan-preview" style="margin-top:16px"></div>
      </div>

      <!-- ── EDIT sub-panel ───────────────────────────────────── -->
      <div data-panel-group="plan-sub" data-panel="plan-edit" style="display:none">
        <div class="sp" style="margin-bottom:12px">
          <div class="sp-body" style="padding:10px 14px">
            <div style="display:flex;gap:8px;align-items:center">
              <select class="fc" id="spj-plan-edit-project" onchange="SPJPage.loadPlanTemplates()" style="max-width:280px">
                <option value="">All Projects</option>
              </select>
              <button class="btn btn-fetch btn-sm" onclick="SPJPage.loadPlanTemplates()">FETCH</button>
            </div>
          </div>
        </div>
        <div id="spj-plan-edit-body"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
    </div>

    <!-- PLAN VIEW -->
    <div data-panel-group="spj" data-panel="plan-view" ${tab!=='plan-view'?'style="display:none"':''}>
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-body" style="padding:10px 14px">
          <div style="display:flex;gap:8px;align-items:center">
            <select class="fc" id="spj-planview-project" onchange="SPJPage.loadPaymentPlans()" style="max-width:280px">
              <option value="">All Projects</option>
            </select>
            <button class="btn btn-fetch btn-sm" onclick="SPJPage.loadPaymentPlans()">FETCH</button>
          </div>
        </div>
      </div>
      <div id="spj-plans-body"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>

    <!-- RATE REPORT -->
    <div data-panel-group="spj" data-panel="rate-report" ${tab!=='rate-report'?'style="display:none"':''}>
      <div class="tbl-hdr mb8">
        <div class="tbl-title">Rate Report — Unit Pricing by Project</div>
        <div class="tbl-actions">
          <button class="btn btn-ghost btn-sm" onclick="SPJPage.load('rate-report')">↻ Refresh</button>
        </div>
      </div>
      <div id="spj-rate-report"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>
  `;

  // Initialize project dropdowns and load current tab
  await SPJPage.initProjectDropdowns();
  await SPJPage.load(tab);
};

// ─────────────────────────────────────────────────────────────────────────────
Object.assign(SPJPage, {
  _projects: [],

  async initProjectDropdowns() {
    try {
      const res = await Api.get('/projects');
      this._projects = res.data || [];
      const opts = this._projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
      ['spj-tower-project','spj-tower-list-project','spj-unit-project','spj-bulk-project',
       'spj-uloc-project','spj-uloc-list-project','spj-plan-project','spj-plan-edit-project',
       'spj-planview-project','spj-edit-project-sel'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          const hasBlank = el.options[0]?.value === '';
          el.innerHTML = (hasBlank ? `<option value="">${el.options[0]?.text||'All Projects'}</option>` : '') + opts;
        }
      });
    } catch {}
  },

  async load(tab) {
    const map = {
      'edit-project':   () => this.loadProjectsList(),
      'add-tower':      () => this.loadTowers(),
      'unit-location':  () => this.loadUnitLocations(),
      'reminder-master':() => this.loadReminders(),
      'plan-setup':     () => { switchTab('plan-sub', 'plan-new'); },
      'plan-view':      () => this.loadPaymentPlans(),
      'rate-report':    () => this.loadRateReport(),
    };
    if (map[tab]) await map[tab]();
  },

  // ── Projects list for edit tab
  async loadProjectsList() {
    const el = document.getElementById('spj-projects-list');
    if (!el) return;
    el.innerHTML = this._projects.length === 0
      ? `<div class="empty-state"><div class="empty-icon">🏗</div><div>No projects found</div></div>`
      : `<table class="dash-tbl">
          <thead><tr><th>Project</th><th>RERA No.</th><th>Location</th><th class="txt-right">Units</th><th class="txt-right">Available</th><th class="txt-right">Allotted</th><th>Action</th></tr></thead>
          <tbody>
            ${this._projects.map(p => `<tr>
              <td class="td-bold">${p.name}</td>
              <td class="td-mono">${p.rera_number||'—'}</td>
              <td>${p.location||'—'}</td>
              <td class="txt-right">${p.unit_count||0}</td>
              <td class="txt-right" style="color:var(--green)">${p.available_units||0}</td>
              <td class="txt-right" style="color:var(--blue)">${p.allotted_units||0}</td>
              <td><button class="btn btn-ghost btn-sm" onclick="SPJPage.selectProjectForEdit('${p.id}','${p.name}','${p.location||''}',${p.total_units||0})">Edit</button></td>
            </tr>`).join('')}
          </tbody>
        </table>`;
  },

  selectProjectForEdit(id, name, location, totalUnits) {
    document.getElementById('spj-edit-project-sel').value = id;
    document.getElementById('spj-edit-proj-id').value = id;
    document.getElementById('spj-edit-proj-name').value = name;
    document.getElementById('spj-edit-proj-location').value = location;
    document.getElementById('spj-edit-proj-units').value = totalUnits;
    document.getElementById('spj-edit-project-title').textContent = `Edit: ${name}`;
    document.getElementById('spj-edit-project-form-wrap').style.display = '';
  },

  loadEditProject() {
    const id = document.getElementById('spj-edit-project-sel')?.value;
    const proj = this._projects.find(p => p.id === id);
    if (proj) this.selectProjectForEdit(proj.id, proj.name, proj.location||'', proj.total_units||0);
  },

  async updateProject(e) {
    e.preventDefault();
    const id   = document.getElementById('spj-edit-proj-id').value;
    const name = document.getElementById('spj-edit-proj-name').value.trim();
    const loc  = document.getElementById('spj-edit-proj-location').value.trim();
    const units = document.getElementById('spj-edit-proj-units').value;
    try {
      await Api.patch(`/projects/${id}`, { name, location: loc, totalUnits: parseInt(units)||null });
      Utils.success('Project updated');
      await this.initProjectDropdowns();
      await this.loadProjectsList();
    } catch (err) { Utils.error(err.message); }
  },

  async createProject(e) {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const body = Object.fromEntries(fd.entries());
    try {
      await Api.post('/projects', body);
      Utils.success(`Project "${body.name}" created`);
      form.reset();
      await this.initProjectDropdowns();
    } catch (err) { Utils.error(err.message); }
  },

  // ── Towers
  async loadTowers() {
    const el = document.getElementById('spj-towers-list');
    if (!el) return;
    const projectId = document.getElementById('spj-tower-list-project')?.value;
    try {
      const projects = projectId ? [{ id: projectId }] : this._projects;
      if (!projects.length) { el.innerHTML = `<div class="empty-state"><div class="empty-icon">🏢</div><div>No projects</div></div>`; return; }
      const rows = [];
      for (const p of projects) {
        const res = await Api.get(`/projects/${p.id}/towers`);
        (res.data||[]).forEach(t => rows.push({ ...t, project_name: this._projects.find(pr=>pr.id===p.id)?.name || '' }));
      }
      el.innerHTML = rows.length === 0
        ? `<div class="empty-state"><div class="empty-icon">🏢</div><div>No towers found</div></div>`
        : `<table class="dash-tbl">
            <thead><tr><th>Project</th><th>Tower/Plot</th><th class="txt-right">Units</th><th>Action</th></tr></thead>
            <tbody>
              ${rows.map(r=>`<tr>
                <td>${r.project_name||'—'}</td>
                <td class="td-bold">${r.tower_name||'—'}</td>
                <td class="txt-right">${r.unit_count||0}</td>
                <td><button class="btn btn-ghost btn-xs" style="color:var(--red)" onclick="SPJPage.deleteTower(this,'${r.id}','${r.project_id}')">✕</button></td>
              </tr>`).join('')}
            </tbody>
          </table>`;
    } catch (err) { el.innerHTML = `<div class="alert alert-danger">${err.message}</div>`; }
  },

  async addTower(e) {
    e.preventDefault();
    const form = e.target;
    const projectId = document.getElementById('spj-tower-project').value;
    const towerName = form.querySelector('[name="towerName"]').value.trim();
    if (!projectId || !towerName) { Utils.warn('Project and tower name are required'); return; }
    try {
      await Api.post(`/projects/${projectId}/towers`, { towerName });
      Utils.success(`Tower "${towerName}" added`);
      form.reset();
      await this.loadTowers();
    } catch (err) { Utils.error(err.message); }
  },

  async deleteTower(btn, towerId, projectId) {
    if (!confirm('Delete this tower?')) return;
    try {
      await Api.delete(`/projects/${projectId}/towers/${towerId}`);
      btn.closest('tr').remove();
      Utils.success('Tower deleted');
    } catch (err) { Utils.error(err.message); }
  },

  // ── Units
  async onUnitProjectChange() {
    const projectId = document.getElementById('spj-unit-project')?.value;
    const towSel = document.getElementById('spj-unit-tower');
    if (!towSel || !projectId) return;
    try {
      const res = await Api.get(`/projects/${projectId}/towers`);
      const towers = res.data || [];
      towSel.innerHTML = `<option value="">No Tower</option>` + towers.map(t=>`<option value="${t.id}">${t.tower_name}</option>`).join('');
    } catch { towSel.innerHTML = `<option value="">No towers</option>`; }
  },

  async addUnit(e) {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const body = Object.fromEntries(fd.entries());
    body.project_id = document.getElementById('spj-unit-project')?.value;
    body.tower_id   = document.getElementById('spj-unit-tower')?.value || undefined;
    if (!body.project_id) { Utils.warn('Please select a project'); return; }
    try {
      await Api.post('/units', body);
      Utils.success(`Unit ${body.unit_number} added`);
      form.reset();
    } catch (err) { Utils.error(err.message); }
  },

  async bulkAddUnits() {
    const file      = document.getElementById('spj-bulk-file')?.files[0];
    const projectId = document.getElementById('spj-bulk-project')?.value;
    const result    = document.getElementById('spj-bulk-result');
    if (!file) { Utils.warn('Please select a CSV file'); return; }
    if (!projectId) { Utils.warn('Please select a project'); return; }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('projectId', projectId);
    fd.append('dataType', 'units');
    try {
      const res = await Api.uploadFile('/import', fd);
      const data = res.data || res;
      result.innerHTML = `<div class="alert alert-success">✓ ${data.created||0} units added · ${data.updated||0} updated · ${data.errors||0} errors</div>`;
    } catch (err) {
      result.innerHTML = `<div class="alert alert-error">Import failed: ${err.message}</div>`;
    }
  },

  // ── Unit Locations
  async loadUnitLocations() {
    const el = document.getElementById('spj-uloc-list');
    if (!el) return;
    const projectId = document.getElementById('spj-uloc-list-project')?.value;
    try {
      const projects = projectId ? [{ id: projectId }] : this._projects;
      const rows = [];
      for (const p of projects) {
        const res = await Api.get(`/projects/${p.id}/unit-locations`);
        (res.data||[]).forEach(loc => rows.push({ ...loc, project_name: this._projects.find(pr=>pr.id===p.id)?.name||'' }));
      }
      el.innerHTML = rows.length === 0
        ? `<div class="empty-state"><div class="empty-icon">📍</div><div>No unit locations</div></div>`
        : `<table class="dash-tbl">
            <thead><tr><th>Project</th><th>Location Name</th><th>Description</th><th>Action</th></tr></thead>
            <tbody>
              ${rows.map(r=>`<tr>
                <td>${r.project_name||'—'}</td>
                <td class="td-bold">${r.name}</td>
                <td>${r.description||'—'}</td>
                <td><button class="btn btn-ghost btn-xs" style="color:var(--red)" onclick="SPJPage.deleteUnitLocation(this,'${r.id}','${r.project_id}')">✕</button></td>
              </tr>`).join('')}
            </tbody>
          </table>`;
    } catch (err) { el.innerHTML = `<div class="alert alert-danger">${err.message}</div>`; }
  },

  async addUnitLocation(e) {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const body = Object.fromEntries(fd.entries());
    const projectId = document.getElementById('spj-uloc-project')?.value;
    if (!projectId) { Utils.warn('Select a project'); return; }
    try {
      await Api.post(`/projects/${projectId}/unit-locations`, body);
      Utils.success('Location added');
      form.reset();
      await this.loadUnitLocations();
    } catch (err) { Utils.error(err.message); }
  },

  async deleteUnitLocation(btn, locId, projectId) {
    if (!confirm('Delete this location?')) return;
    try {
      await Api.delete(`/projects/${projectId}/unit-locations/${locId}`);
      btn.closest('tr').remove();
      Utils.success('Deleted');
    } catch (err) { Utils.error(err.message); }
  },

  // ── Reminders
  async loadReminders() {
    const el = document.getElementById('spj-reminder-list');
    if (!el) return;
    try {
      const res = await Api.get('/master/reminder-master');
      const rows = res.data || [];
      el.innerHTML = rows.length === 0
        ? `<div class="empty-state"><div class="empty-icon">⏰</div><div>No reminders configured</div></div>`
        : `<table class="dash-tbl">
            <thead><tr><th>Reminder Name</th><th class="txt-right">Days Before</th><th>Channel</th><th>Action</th></tr></thead>
            <tbody>
              ${rows.map(r=>`<tr>
                <td class="td-bold">${r.name}</td>
                <td class="txt-right" style="color:var(--warn);font-weight:700">${r.days_before}</td>
                <td><span class="chip chip-blue">${r.channel||'all'}</span></td>
                <td><button class="btn btn-ghost btn-xs" style="color:var(--red)" onclick="SPJPage.deleteReminder(this,'${r.id}')">✕</button></td>
              </tr>`).join('')}
            </tbody>
          </table>`;
    } catch (err) { el.innerHTML = `<div class="alert alert-danger">${err.message}</div>`; }
  },

  async addReminder(e) {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const body = Object.fromEntries(fd.entries());
    try {
      await Api.post('/master/reminder-master', body);
      Utils.success('Reminder rule added');
      form.reset();
      await this.loadReminders();
    } catch (err) { Utils.error(err.message); }
  },

  async deleteReminder(btn, id) {
    if (!confirm('Delete?')) return;
    try {
      await Api.delete(`/master/reminder-master/${id}`);
      btn.closest('tr').remove();
      Utils.success('Deleted');
    } catch (err) { Utils.error(err.message); }
  },

  // ── Payment Plan Templates

  onTypeChange(type) {
    const pctWrap = document.getElementById('spj-plan-pct-wrap');
    const amtWrap = document.getElementById('spj-plan-amt-wrap');
    const nameField = document.getElementById('spj-plan-iname');
    if (!pctWrap || !amtWrap) return;
    if (type === 'other_charge') {
      pctWrap.style.display = 'none';
      amtWrap.style.display = '';
    } else {
      pctWrap.style.display = '';
      amtWrap.style.display = 'none';
    }
    const autoNames = { booking: 'Booking Amount', possession: 'On Possession', plc: 'PLC Charge' };
    if (autoNames[type] && nameField && !nameField.value.trim()) nameField.value = autoNames[type];
  },

  async onPlanProjectChange() {
    const projectId = document.getElementById('spj-plan-project')?.value;
    const planName  = document.getElementById('spj-plan-name')?.value || 'Standard AHP Plan';
    if (projectId) await this.loadPlanPreview(projectId, planName);
  },

  async addInstallment(e) {
    e.preventDefault();
    const form = e.target;
    const projectId = document.getElementById('spj-plan-project')?.value;
    if (!projectId) { Utils.warn('Please select a project first'); return; }
    const fd = new FormData(form);
    const body = Object.fromEntries(fd.entries());
    try {
      await Api.post(`/projects/${projectId}/plan-templates`, body);
      Utils.success(`"${body.installment_name}" added`);
      // Auto-increment index
      const idxEl = document.getElementById('spj-plan-idx');
      if (idxEl) idxEl.value = (parseInt(idxEl.value) || 1) + 1;
      // Reset volatile fields; keep project, plan name, type, index
      form.querySelector('[name="installment_name"]').value = '';
      const pct = form.querySelector('[name="percentage"]');
      if (pct) pct.value = '';
      const amt = form.querySelector('[name="flat_amount_inr"]');
      if (amt) amt.value = '';
      const notes = form.querySelector('[name="notes"]');
      if (notes) notes.value = '';
      // Refresh live preview
      await this.loadPlanPreview(projectId, body.plan_name);
    } catch (err) { Utils.error(err.message); }
  },

  async loadPlanPreview(projectId, planName) {
    const el = document.getElementById('spj-plan-preview');
    if (!el || !projectId) return;
    try {
      const params = planName ? `?planName=${encodeURIComponent(planName)}` : '';
      const res = await Api.get(`/projects/${projectId}/plan-templates${params}`);
      const rows = res.data || [];
      if (!rows.length) { el.innerHTML = ''; return; }
      const total = rows.reduce((s, r) => s + (parseFloat(r.percentage) || 0), 0);
      const totalOk = Math.abs(total - 100) < 0.1;
      el.innerHTML = `
        <div class="sp">
          <div class="sp-hdr">
            <div class="sp-title">Current Schedule: ${Utils.esc(planName || 'Plan')}</div>
            <span class="chip ${totalOk ? 'chip-teal' : 'chip-warn'}">${total.toFixed(1)}% total${totalOk ? ' ✓' : ' — needs 100%'}</span>
          </div>
          <div class="sp-body" style="padding:0">
            <table class="dash-tbl">
              <thead><tr><th>#</th><th>Name</th><th>Type</th><th class="txt-right">%</th><th class="txt-right">Flat ₹</th><th class="txt-right">Due (days)</th><th>Remove</th></tr></thead>
              <tbody>
                ${rows.map(r => `<tr>
                  <td>${r.installment_index}</td>
                  <td class="td-bold">${Utils.esc(r.installment_name)}</td>
                  <td>${Utils.chip(r.installment_type || 'installment')}</td>
                  <td class="txt-right">${r.percentage ? parseFloat(r.percentage).toFixed(1) + '%' : '—'}</td>
                  <td class="txt-right">${r.flat_amount_inr ? Utils.currency(r.flat_amount_inr) : '—'}</td>
                  <td class="txt-right">${r.due_date_offset_days || 0}d</td>
                  <td><button class="btn btn-ghost btn-xs" style="color:var(--red)"
                      onclick="SPJPage.deleteTemplate(this,'${r.id}','${projectId}')">✕</button></td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>`;
    } catch (err) {
      el.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  },

  clearPlanForm() {
    const form = document.getElementById('spj-plan-form');
    if (!form) return;
    form.querySelector('[name="installment_name"]').value = '';
    const pct = form.querySelector('[name="percentage"]'); if (pct) pct.value = '';
    const amt = form.querySelector('[name="flat_amount_inr"]'); if (amt) amt.value = '';
    const notes = form.querySelector('[name="notes"]'); if (notes) notes.value = '';
    document.getElementById('spj-plan-idx').value = '1';
    document.getElementById('spj-plan-type').value = 'installment';
    this.onTypeChange('installment');
    document.getElementById('spj-plan-preview').innerHTML = '';
  },

  async loadAHPTemplate() {
    const projectId = document.getElementById('spj-plan-project')?.value;
    if (!projectId) { Utils.warn('Please select a project first'); return; }
    const planName = document.getElementById('spj-plan-name')?.value?.trim() || 'Standard AHP Plan';
    const schedule = [
      { installment_name: 'Booking Amount',   installment_type: 'booking',     percentage: '5',    installment_index: 1, due_date_offset_days: 0 },
      { installment_name: 'On Allotment',      installment_type: 'installment', percentage: '20',   installment_index: 2, due_date_offset_days: 15 },
      { installment_name: '1st Half-Yearly',   installment_type: 'installment', percentage: '12.5', installment_index: 3, due_date_offset_days: 180 },
      { installment_name: '2nd Half-Yearly',   installment_type: 'installment', percentage: '12.5', installment_index: 4, due_date_offset_days: 360 },
      { installment_name: '3rd Half-Yearly',   installment_type: 'installment', percentage: '12.5', installment_index: 5, due_date_offset_days: 540 },
      { installment_name: '4th Half-Yearly',   installment_type: 'installment', percentage: '12.5', installment_index: 6, due_date_offset_days: 720 },
      { installment_name: '5th Half-Yearly',   installment_type: 'installment', percentage: '12.5', installment_index: 7, due_date_offset_days: 900 },
      { installment_name: '6th Half-Yearly',   installment_type: 'installment', percentage: '12.5', installment_index: 8, due_date_offset_days: 1080 },
      { installment_name: 'On Possession',     installment_type: 'possession',  percentage: '5',    installment_index: 9, due_date_offset_days: 0 },
    ];
    if (!confirm(`Load standard AHP schedule (9 items, 100%) for "${planName}"? Existing items with same plan name will coexist.`)) return;
    try {
      for (const item of schedule) {
        await Api.post(`/projects/${projectId}/plan-templates`, { ...item, plan_name: planName });
      }
      Utils.success('AHP template loaded (9 installments, 100%)');
      await this.loadPlanPreview(projectId, planName);
    } catch (err) { Utils.error(`Load failed: ${err.message}`); }
  },

  // ── Edit sub-tab
  async loadPlanTemplates() {
    const el = document.getElementById('spj-plan-edit-body');
    if (!el) return;
    const projectId = document.getElementById('spj-plan-edit-project')?.value;
    el.innerHTML = `<div class="page-loading"><div class="spinner"></div></div>`;
    try {
      const projects = projectId
        ? [this._projects.find(p => p.id === projectId) || { id: projectId, name: '' }]
        : this._projects;
      if (!projects.length) {
        el.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div>No projects found</div></div>`;
        return;
      }
      let html = '';
      for (const proj of projects) {
        const res = await Api.get(`/projects/${proj.id}/plan-templates`);
        const rows = res.data || [];
        if (!rows.length) continue;
        const plans = {};
        rows.forEach(r => { if (!plans[r.plan_name]) plans[r.plan_name] = []; plans[r.plan_name].push(r); });
        for (const [planName, items] of Object.entries(plans)) {
          const total = items.reduce((s, r) => s + (parseFloat(r.percentage) || 0), 0);
          const ok = Math.abs(total - 100) < 0.1;
          html += `
            <div class="sp" style="margin-bottom:14px">
              <div class="sp-hdr">
                <div class="sp-title">${Utils.esc(proj.name || proj.id)} — ${Utils.esc(planName)}</div>
                <span class="chip ${ok ? 'chip-teal' : 'chip-warn'}">${total.toFixed(1)}% total</span>
              </div>
              <div class="sp-body" style="padding:0">
                <table class="dash-tbl">
                  <thead><tr><th>#</th><th>Name</th><th>Type</th><th class="txt-right">%</th><th class="txt-right">Flat ₹</th><th class="txt-right">Due (days)</th><th>Notes</th><th>Actions</th></tr></thead>
                  <tbody>
                    ${items.map(r => `<tr id="ptrow-${r.id}">
                      <td>${r.installment_index}</td>
                      <td class="td-bold">${Utils.esc(r.installment_name)}</td>
                      <td>${Utils.chip(r.installment_type || 'installment')}</td>
                      <td class="txt-right">${r.percentage ? parseFloat(r.percentage).toFixed(1) + '%' : '—'}</td>
                      <td class="txt-right">${r.flat_amount_inr ? Utils.currency(r.flat_amount_inr) : '—'}</td>
                      <td class="txt-right">${r.due_date_offset_days || 0}d</td>
                      <td style="color:var(--text3);font-size:12px">${Utils.esc(r.notes || '')}</td>
                      <td style="display:flex;gap:4px">
                        <button class="btn btn-ghost btn-xs" onclick="SPJPage.inlineEditTemplate('${r.id}','${proj.id}')">✎ Edit</button>
                        <button class="btn btn-ghost btn-xs" style="color:var(--red)" onclick="SPJPage.deleteTemplate(this,'${r.id}','${proj.id}')">✕</button>
                      </td>
                    </tr>
                    <tr id="ptrow-edit-${r.id}" style="display:none">
                      <td colspan="8">
                        <div style="padding:10px;background:var(--surface2);border-radius:6px;display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px">
                          <div class="fg"><label class="fl">Name</label><input class="fc" id="pt-name-${r.id}" value="${Utils.esc(r.installment_name)}"></div>
                          <div class="fg"><label class="fl">Type</label>
                            <select class="fc" id="pt-type-${r.id}">
                              ${['installment','plc','other_charge','booking','possession'].map(t=>`<option value="${t}"${r.installment_type===t?' selected':''}>${t}</option>`).join('')}
                            </select>
                          </div>
                          <div class="fg"><label class="fl">% / Amount</label><input type="number" step="0.001" class="fc" id="pt-pct-${r.id}" value="${r.percentage||''}"></div>
                          <div class="fg"><label class="fl">Due (days)</label><input type="number" class="fc" id="pt-off-${r.id}" value="${r.due_date_offset_days||0}"></div>
                          <div class="fg"><label class="fl">Index</label><input type="number" class="fc" id="pt-idx-${r.id}" value="${r.installment_index||1}"></div>
                          <div class="fg"><label class="fl">Notes</label><input class="fc" id="pt-notes-${r.id}" value="${Utils.esc(r.notes||'')}"></div>
                          <div class="fg" style="display:flex;align-items:flex-end;gap:6px">
                            <button class="btn btn-teal btn-sm" onclick="SPJPage.saveEditTemplate('${r.id}','${proj.id}')">Save</button>
                            <button class="btn btn-ghost btn-sm" onclick="SPJPage.cancelEditTemplate('${r.id}')">Cancel</button>
                          </div>
                        </div>
                      </td>
                    </tr>`).join('')}
                  </tbody>
                </table>
              </div>
            </div>`;
        }
      }
      el.innerHTML = html || `<div class="empty-state"><div class="empty-icon">📋</div><div>No payment plan schedules found. Use the New tab to create one.</div></div>`;
    } catch (err) { el.innerHTML = `<div class="alert alert-danger">${err.message}</div>`; }
  },

  inlineEditTemplate(id, projectId) {
    document.getElementById(`ptrow-${id}`).style.display = 'none';
    document.getElementById(`ptrow-edit-${id}`).style.display = '';
  },

  cancelEditTemplate(id) {
    document.getElementById(`ptrow-${id}`).style.display = '';
    document.getElementById(`ptrow-edit-${id}`).style.display = 'none';
  },

  async saveEditTemplate(id, projectId) {
    const body = {
      installment_name:     document.getElementById(`pt-name-${id}`)?.value?.trim(),
      installment_type:     document.getElementById(`pt-type-${id}`)?.value,
      percentage:           parseFloat(document.getElementById(`pt-pct-${id}`)?.value) || null,
      due_date_offset_days: parseInt(document.getElementById(`pt-off-${id}`)?.value) || 0,
      installment_index:    parseInt(document.getElementById(`pt-idx-${id}`)?.value) || 1,
      notes:                document.getElementById(`pt-notes-${id}`)?.value?.trim() || null,
    };
    try {
      await Api.patch(`/projects/${projectId}/plan-templates/${id}`, body);
      Utils.success('Updated');
      await this.loadPlanTemplates();
    } catch (err) { Utils.error(err.message); }
  },

  async deleteTemplate(btn, id, projectId) {
    if (!confirm('Delete this installment?')) return;
    try {
      await Api.delete(`/projects/${projectId}/plan-templates/${id}`);
      // Remove both the display row and any edit row
      document.getElementById(`ptrow-${id}`)?.remove();
      document.getElementById(`ptrow-edit-${id}`)?.remove();
      btn.closest('tr')?.remove();
      Utils.success('Deleted');
      // Refresh preview if visible
      const previewEl = document.getElementById('spj-plan-preview');
      if (previewEl && previewEl.innerHTML) {
        const pid = document.getElementById('spj-plan-project')?.value;
        const pname = document.getElementById('spj-plan-name')?.value;
        if (pid) await this.loadPlanPreview(pid, pname);
      }
    } catch (err) { Utils.error(err.message); }
  },

  async loadPaymentPlans() {
    const el = document.getElementById('spj-plans-body');
    if (!el) return;
    const projectId = document.getElementById('spj-planview-project')?.value;
    try {
      const projects = projectId ? [{ id: projectId, name: this._projects.find(p=>p.id===projectId)?.name||'' }] : this._projects;
      let html = '';
      for (const proj of projects) {
        const res = await Api.get(`/projects/${proj.id}/payment-plans`);
        const plans = res.data || [];
        html += `
          <div class="sp" style="margin-bottom:14px">
            <div class="sp-hdr">
              <div class="sp-title">${proj.name||'Project'}</div>
              <span class="chip chip-blue">${plans.length} plans</span>
            </div>
            ${plans.length === 0
              ? `<div class="sp-body"><div style="color:var(--text3);font-size:12px">No payment plans created yet</div></div>`
              : `<div class="sp-body">
                  <table class="dash-tbl">
                    <thead><tr><th>Consumer</th><th>Unit</th><th>Total Amount</th><th>Paid</th><th>Outstanding</th><th>Status</th></tr></thead>
                    <tbody>
                      ${plans.map(p=>`<tr>
                        <td class="td-bold">${p.consumer_name||'—'}</td>
                        <td>${p.unit_number||'—'}</td>
                        <td>${Utils.currency(p.total_amount)}</td>
                        <td style="color:var(--teal)">${Utils.currency(p.total_paid)}</td>
                        <td style="color:var(--red)">${Utils.currency(p.outstanding)}</td>
                        <td>${Utils.chip(p.status||'active')}</td>
                      </tr>`).join('')}
                    </tbody>
                  </table>
                </div>`}
          </div>`;
      }
      el.innerHTML = html || `<div class="empty-state"><div class="empty-icon">📋</div><div>No payment plans found</div></div>`;
    } catch (err) { el.innerHTML = `<div class="alert alert-danger">${err.message}</div>`; }
  },

  // ── Rate Report
  async loadRateReport() {
    const el = document.getElementById('spj-rate-report');
    if (!el) return;
    try {
      const res = await Api.get('/projects/reports/rates');
      const rows = res.data || [];
      el.innerHTML = rows.length === 0
        ? `<div class="empty-state"><div class="empty-icon">💰</div><div>No rate data available — add units with base prices to see the rate report</div></div>`
        : `<table class="dash-tbl">
            <thead><tr>
              <th>Project</th><th>BHK</th><th>Tower</th>
              <th class="txt-right">Units</th>
              <th class="txt-right">Min Price</th><th class="txt-right">Max Price</th><th class="txt-right">Avg Price</th>
              <th class="txt-right">Min Carpet</th><th class="txt-right">Max Carpet</th>
            </tr></thead>
            <tbody>
              ${rows.map(r=>`<tr>
                <td class="td-bold">${r.project_name}</td>
                <td>${r.bhk_type||'—'}</td>
                <td>${r.tower||'—'}</td>
                <td class="txt-right">${r.unit_count}</td>
                <td class="txt-right">${Utils.currency(r.min_price)}</td>
                <td class="txt-right">${Utils.currency(r.max_price)}</td>
                <td class="txt-right" style="font-weight:600;color:var(--teal)">${Utils.currency(r.avg_price)}</td>
                <td class="txt-right">${r.min_carpet||0} sqft</td>
                <td class="txt-right">${r.max_carpet||0} sqft</td>
              </tr>`).join('')}
            </tbody>
          </table>`;
    } catch (err) { el.innerHTML = `<div class="alert alert-danger">${err.message}</div>`; }
  },
});
