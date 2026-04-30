// ROF CRM — Unit Status / Inventory Grid Page (Enhanced)

Pages.unitStatus = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="page-hdr">
      <h1>Unit Status</h1>
      <div class="breadcrumb">Reports / <b>Unit Status</b></div>
    </div>

    <!-- Filter Panel -->
    <div class="sp" style="margin-bottom:12px">
      <div class="sp-hdr">
        <div class="sp-title">Filter Inventory</div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost btn-sm" id="us-view-grid" onclick="UnitStatusPage.setView('grid')"
            style="background:var(--accent);color:#fff">⊞ Grid</button>
          <button class="btn btn-ghost btn-sm" id="us-view-table" onclick="UnitStatusPage.setView('table')">≡ Table</button>
        </div>
      </div>
      <div class="sp-body">
        <div class="sp-grid">
          <div class="fg"><label class="fl">Project</label>
            <select class="fc" id="us-project" onchange="UnitStatusPage.onProjectChange()">
              <option value="">— All Projects —</option>
            </select>
          </div>
          <div class="fg"><label class="fl">Tower</label>
            <select class="fc" id="us-tower">
              <option value="">— All Towers —</option>
            </select>
          </div>
          <div class="fg"><label class="fl">BHK Type</label>
            <select class="fc" id="us-bhk">
              <option value="">— All Types —</option>
              <option value="Studio">Studio</option>
              <option value="1BHK">1 BHK</option>
              <option value="2BHK">2 BHK</option>
              <option value="3BHK">3 BHK</option>
            </select>
          </div>
          <div class="fg"><label class="fl">Location / Block</label>
            <select class="fc" id="us-location">
              <option value="">— All Locations —</option>
            </select>
          </div>
          <div class="fg"><label class="fl">Floor</label>
            <select class="fc" id="us-floor">
              <option value="">— All Floors —</option>
            </select>
          </div>
          <div class="fg"><label class="fl">Facing</label>
            <select class="fc" id="us-facing">
              <option value="">— All Facing —</option>
              <option value="North">North</option>
              <option value="South">South</option>
              <option value="East">East</option>
              <option value="West">West</option>
              <option value="North-East">North-East</option>
              <option value="North-West">North-West</option>
            </select>
          </div>
        </div>

        <!-- Status Checkboxes (10 statuses) -->
        <div style="margin-top:10px">
          <label class="fl" style="margin-bottom:6px;display:block">Status Filter</label>
          <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:12px" id="us-status-checks">
            ${[
              { val:'available',             label:'Available',              cls:'av' },
              { val:'application_received',  label:'Application Received',   cls:'app' },
              { val:'draw_pending',          label:'Draw Pending',           cls:'draw' },
              { val:'allotted',              label:'Allotted',               cls:'allot' },
              { val:'agreement_signed',      label:'Agreement Signed',       cls:'agr' },
              { val:'under_construction',    label:'Under Construction',     cls:'uc-stat' },
              { val:'oc_received',           label:'OC Received',            cls:'oc' },
              { val:'possession_handed_over',label:'Possession Handed Over', cls:'poss' },
              { val:'cancelled',             label:'Cancelled',              cls:'can' },
              { val:'blocked',               label:'Blocked',                cls:'blk' },
            ].map(s => `
              <label style="display:flex;align-items:center;gap:5px;cursor:pointer;user-select:none">
                <input type="checkbox" class="us-stat-cb" value="${s.val}" checked style="width:13px;height:13px">
                <span class="uc ${s.cls}" style="width:12px;height:12px;border-radius:2px;flex-shrink:0"></span>
                ${s.label}
              </label>
            `).join('')}
          </div>
          <div style="margin-top:6px;display:flex;gap:6px">
            <button class="btn btn-ghost btn-sm" onclick="UnitStatusPage.checkAll(true)">Select All</button>
            <button class="btn btn-ghost btn-sm" onclick="UnitStatusPage.checkAll(false)">Clear All</button>
          </div>
        </div>

        <div style="margin-top:12px;display:flex;gap:8px;align-items:center">
          <button class="btn btn-fetch btn-lg" onclick="UnitStatusPage.load()">FETCH</button>
          <button class="btn btn-ghost" onclick="UnitStatusPage.exportCsv()">Export CSV</button>
          <span id="us-count-label" style="font-size:11px;color:var(--text3)"></span>
        </div>
      </div>
    </div>

    <!-- Legend -->
    <div id="us-legend" style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:14px;font-size:11px">
      ${[
        { cls:'av',      label:'Available' },
        { cls:'app',     label:'Application Received' },
        { cls:'draw',    label:'Draw Pending' },
        { cls:'allot',   label:'Allotted' },
        { cls:'agr',     label:'Agreement Signed' },
        { cls:'uc-stat', label:'Under Construction' },
        { cls:'oc',      label:'OC Received' },
        { cls:'poss',    label:'Possession' },
        { cls:'can',     label:'Cancelled' },
        { cls:'blk',     label:'Blocked' },
      ].map(s => `
        <span><span class="uc ${s.cls}" style="display:inline-block;width:14px;height:14px;border-radius:3px;vertical-align:middle;margin-right:4px"></span>${s.label}</span>
      `).join('')}
    </div>

    <!-- KPI Cards -->
    <div id="us-kpis" style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:14px"></div>

    <!-- Inventory Grid / Table -->
    <div id="us-grid"><div class="page-loading"><div class="spinner"></div> Loading inventory…</div></div>

    <!-- Unit Detail Modal -->
    <div class="overlay" id="us-unit-modal">
      <div class="modal" style="max-width:520px">
        <div class="modal-hdr">
          <div class="modal-title" id="us-modal-title">Unit Details</div>
          <button class="modal-close" onclick="closeOverlay('us-unit-modal')">✕</button>
        </div>
        <div class="modal-body" id="us-modal-body"></div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="closeOverlay('us-unit-modal')">Close</button>
          <button class="btn btn-primary btn-sm" id="us-modal-view-btn">View Consumer</button>
        </div>
      </div>
    </div>

    <style>
      .uc { display:inline-flex;align-items:center;justify-content:center;
            width:54px;height:36px;border-radius:5px;font-size:10px;font-weight:700;
            border:1px solid transparent;transition:transform .1s,box-shadow .1s }
      .uc:hover { transform:scale(1.08);box-shadow:0 2px 8px rgba(0,0,0,.2) }
      .uc.av      { background:rgba(25,135,84,.15); border-color:var(--green);  color:var(--green) }
      .uc.app     { background:rgba(13,110,253,.15);border-color:var(--blue);   color:var(--blue) }
      .uc.draw    { background:rgba(255,193,7,.15); border-color:var(--amber);  color:var(--amber) }
      .uc.allot   { background:rgba(99,102,241,.15);border-color:var(--accent); color:var(--accent) }
      .uc.agr     { background:rgba(6,182,212,.15); border-color:var(--teal);   color:var(--teal) }
      .uc.uc-stat { background:rgba(234,88,12,.15); border-color:#ea580c;       color:#ea580c }
      .uc.oc      { background:rgba(168,85,247,.15);border-color:#a855f7;       color:#a855f7 }
      .uc.poss    { background:rgba(16,185,129,.25);border-color:#10b981;       color:#10b981 }
      .uc.can     { background:rgba(220,53,69,.12); border-color:var(--red);    color:var(--red) }
      .uc.blk     { background:rgba(100,116,139,.15);border-color:var(--text3); color:var(--text3) }
    </style>
  `;

  await UnitStatusPage.loadProjects();
  await UnitStatusPage.load();
};

const UnitStatusPage = {
  _units: [],
  _view: 'grid',

  _STATUS_CONFIG: [
    { val:'available',             label:'Available',            cls:'av',      color:'var(--green)' },
    { val:'application_received',  label:'App. Received',        cls:'app',     color:'var(--blue)' },
    { val:'draw_pending',          label:'Draw Pending',         cls:'draw',    color:'var(--amber)' },
    { val:'allotted',              label:'Allotted',             cls:'allot',   color:'var(--accent)' },
    { val:'agreement_signed',      label:'Agreement Signed',     cls:'agr',     color:'var(--teal)' },
    { val:'under_construction',    label:'Under Const.',         cls:'uc-stat', color:'#ea580c' },
    { val:'oc_received',           label:'OC Received',          cls:'oc',      color:'#a855f7' },
    { val:'possession_handed_over','label':'Possession',          cls:'poss',    color:'#10b981' },
    { val:'cancelled',             label:'Cancelled',            cls:'can',     color:'var(--red)' },
    { val:'blocked',               label:'Blocked',              cls:'blk',     color:'var(--text3)' },
  ],

  async loadProjects() {
    try {
      const res = await Api.get('/units', { params: { pageSize: 1000 } });
      const units = res.data || res || [];

      const projects  = [...new Map(units.filter(u=>u.project_id||u.projectId)
        .map(u=>[u.project_id||u.projectId,{id:u.project_id||u.projectId,name:u.project_name||u.projectName}])).values()];
      const towers    = [...new Set(units.map(u=>u.tower).filter(Boolean))].sort();
      const floors    = [...new Set(units.map(u=>u.floor||u.floor_number).filter(f=>f!=null))].sort((a,b)=>Number(a)-Number(b));
      const locations = [...new Set(units.map(u=>u.location||u.block).filter(Boolean))].sort();

      const pSel = document.getElementById('us-project');
      if (pSel) pSel.innerHTML = '<option value="">— All Projects —</option>' +
        projects.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');

      const tSel = document.getElementById('us-tower');
      if (tSel) tSel.innerHTML = '<option value="">— All Towers —</option>' +
        towers.map(t=>`<option value="${t}">Tower ${t}</option>`).join('');

      const fSel = document.getElementById('us-floor');
      if (fSel) fSel.innerHTML = '<option value="">— All Floors —</option>' +
        floors.map(f=>`<option value="${f}">Floor ${f}</option>`).join('');

      const lSel = document.getElementById('us-location');
      if (lSel) lSel.innerHTML = '<option value="">— All Locations —</option>' +
        locations.map(l=>`<option value="${l}">${l}</option>`).join('');
    } catch {}
  },

  async onProjectChange() {
    const projectId = document.getElementById('us-project')?.value;
    if (!projectId) return;
    try {
      const res = await Api.get('/units', { params: { projectId, pageSize: 500 } });
      const units = res.data || res || [];
      const towers = [...new Set(units.map(u=>u.tower).filter(Boolean))].sort();
      const tSel = document.getElementById('us-tower');
      if (tSel) tSel.innerHTML = '<option value="">— All Towers —</option>' +
        towers.map(t=>`<option value="${t}">Tower ${t}</option>`).join('');
    } catch {}
  },

  checkAll(checked) {
    document.querySelectorAll('.us-stat-cb').forEach(cb => { cb.checked = checked; });
  },

  setView(view) {
    this._view = view;
    const gBtn = document.getElementById('us-view-grid');
    const tBtn = document.getElementById('us-view-table');
    if (gBtn) { gBtn.style.background = view==='grid'?'var(--accent)':''; gBtn.style.color=view==='grid'?'#fff':''; }
    if (tBtn) { tBtn.style.background = view==='table'?'var(--accent)':''; tBtn.style.color=view==='table'?'#fff':''; }
    if (this._units.length) {
      if (view === 'grid') this.renderGrid(this._units);
      else this.renderTable(this._units);
    }
  },

  async load() {
    const projectId = document.getElementById('us-project')?.value;
    const tower     = document.getElementById('us-tower')?.value;
    const bhk       = document.getElementById('us-bhk')?.value;
    const location  = document.getElementById('us-location')?.value;
    const floor     = document.getElementById('us-floor')?.value;
    const facing    = document.getElementById('us-facing')?.value;

    const checkedStatuses = [...document.querySelectorAll('.us-stat-cb:checked')].map(cb=>cb.value);

    try {
      const params = { pageSize: 1000 };
      if (projectId) params.projectId = projectId;
      if (tower)     params.tower = tower;
      if (bhk)       params.bhkType = bhk;
      if (floor)     params.floor = floor;

      const res = await Api.get('/units', { params });
      let units = res.data || res || [];

      // Client-side filters
      if (location) units = units.filter(u=>(u.location||u.block||'')=== location);
      if (facing)   units = units.filter(u=>(u.facing||'')===facing);
      if (checkedStatuses.length < 10) {
        units = units.filter(u=> checkedStatuses.includes(u.status||'available'));
      }

      this._units = units;
      this.renderKpis(units);

      const countLabel = document.getElementById('us-count-label');
      if (countLabel) countLabel.textContent = `Showing ${units.length} units`;

      if (this._view === 'grid') this.renderGrid(units);
      else this.renderTable(units);
    } catch (err) {
      const el = document.getElementById('us-grid');
      if (el) el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`;
    }
  },

  renderKpis(units) {
    const el = document.getElementById('us-kpis');
    if (!el) return;
    const total = units.length;
    const byStatus = {};
    units.forEach(u => {
      const s = u.status || 'available';
      byStatus[s] = (byStatus[s]||0) + 1;
    });
    const avail    = byStatus['available'] || 0;
    const allotted = byStatus['allotted'] || 0;
    const poss     = byStatus['possession_handed_over'] || 0;
    const fillPct  = total ? Math.round((total-avail)/total*100) : 0;

    el.innerHTML = `
      <div class="kpi-card">
        <div class="kpi-label">Total Units</div>
        <div class="kpi-value">${total}</div>
      </div>
      <div class="kpi-card" style="cursor:pointer" onclick="UnitStatusPage.filterByStatus('available')">
        <div class="kpi-label">Available</div>
        <div class="kpi-value" style="color:var(--green)">${avail}</div>
        <div class="kpi-sub">${total?Math.round(avail/total*100):0}% of inventory</div>
      </div>
      <div class="kpi-card" style="cursor:pointer" onclick="UnitStatusPage.filterByStatus('allotted')">
        <div class="kpi-label">Allotted</div>
        <div class="kpi-value" style="color:var(--accent)">${allotted}</div>
      </div>
      <div class="kpi-card" style="cursor:pointer" onclick="UnitStatusPage.filterByStatus('possession_handed_over')">
        <div class="kpi-label">Possession Given</div>
        <div class="kpi-value" style="color:#10b981">${poss}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Fill Rate</div>
        <div class="kpi-value" style="color:var(--amber)">${fillPct}%</div>
        <div class="kpi-sub">Occupied units</div>
      </div>
    `;
  },

  filterByStatus(status) {
    // Uncheck all then check only the given status
    document.querySelectorAll('.us-stat-cb').forEach(cb => {
      cb.checked = cb.value === status;
    });
    this.load();
  },

  renderGrid(units) {
    const el = document.getElementById('us-grid');
    if (!el) return;
    if (units.length === 0) {
      el.innerHTML = '<div class="empty-state"><h3>No units found</h3><p>Adjust filters and click FETCH</p></div>';
      return;
    }

    const statusCls = {};
    this._STATUS_CONFIG.forEach(s => { statusCls[s.val] = s.cls; });

    // Group: project → tower → floor (floors sorted descending = top of building first)
    const byProject = {};
    for (const u of units) {
      const proj  = u.project_name  || u.projectName  || 'Unknown Project';
      const tower = u.tower         || '1';
      const floor = u.floor         || u.floor_number || 1;
      if (!byProject[proj]) byProject[proj] = {};
      if (!byProject[proj][tower]) byProject[proj][tower] = {};
      if (!byProject[proj][tower][floor]) byProject[proj][tower][floor] = [];
      byProject[proj][tower][floor].push(u);
    }

    let html = '';
    for (const [projName, towers] of Object.entries(byProject)) {
      html += `<div class="sp" style="margin-bottom:16px">
        <div class="sp-hdr">
          <div class="sp-title">${projName}</div>
          <div style="font-size:11px;color:var(--text3)">${
            Object.values(towers).flatMap(fl=>Object.values(fl)).flat().length
          } units</div>
        </div>
        <div class="sp-body" style="overflow-x:auto">`;

      for (const [towerNum, floors] of Object.entries(towers)) {
        html += `<div style="margin-bottom:20px">
          <div style="font-weight:700;font-size:11px;color:var(--text3);margin-bottom:8px;
                      text-transform:uppercase;letter-spacing:.06em">Tower ${towerNum}</div>`;
        const sortedFloors = Object.entries(floors).sort((a,b)=>Number(b[0])-Number(a[0]));
        for (const [floorNum, floorUnits] of sortedFloors) {
          html += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;min-width:max-content">
            <span style="width:44px;font-size:10.5px;color:var(--text3);text-align:right;flex-shrink:0">F${floorNum}</span>
            <div style="display:flex;gap:3px;flex-wrap:nowrap">`;
          for (const u of floorUnits) {
            const cls = statusCls[u.status||'available'] || 'av';
            const unitNo = u.unit_number || u.unitNumber || u.id?.slice(0,6);
            const tip = `${unitNo} · ${u.bhk_type||u.bhkType||'—'} · ${(u.status||'available').replace(/_/g,' ')}`;
            html += `<div class="uc ${cls}" title="${tip}" onclick="UnitStatusPage.showUnit('${u.id}')">${unitNo}</div>`;
          }
          html += `</div></div>`;
        }
        html += `</div>`;
      }
      html += `</div></div>`;
    }
    el.innerHTML = html;
  },

  renderTable(units) {
    const el = document.getElementById('us-grid');
    if (!el) return;
    if (units.length === 0) {
      el.innerHTML = '<div class="empty-state"><h3>No units found</h3></div>';
      return;
    }
    el.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>#</th><th>Unit No.</th><th>Project</th><th>Tower</th><th>Floor</th>
            <th>BHK</th><th>Carpet (sqft)</th><th>Super Area</th><th>Status</th>
            <th>Base Price</th><th>Allottee</th><th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${units.map((u,i) => `<tr>
            <td style="color:var(--text3)">${i+1}</td>
            <td class="td-bold">${u.unit_number||u.unitNumber||'—'}</td>
            <td style="font-size:10.5px">${u.project_name||u.projectName||'—'}</td>
            <td>${u.tower||'—'}</td>
            <td>${u.floor||u.floor_number||'—'}</td>
            <td>${u.bhk_type||u.bhkType||'—'}</td>
            <td>${u.carpet_area_sqft||u.carpetArea||'—'}</td>
            <td>${u.super_area_sqft||u.superArea||'—'}</td>
            <td>${Utils.chip(u.status||'available')}</td>
            <td>${Utils.currency(u.base_price_inr||u.basePrice||0)}</td>
            <td style="font-size:10.5px">${u.consumer_name||'—'}</td>
            <td><button class="btn btn-ghost btn-sm" onclick="UnitStatusPage.showUnit('${u.id}')">Details</button></td>
          </tr>`).join('')}
        </tbody>
        <tfoot class="tfoot-total">
          <tr>
            <td colspan="9"><strong>TOTAL: ${units.length} units</strong></td>
            <td><strong>${Utils.currency(units.reduce((s,u)=>s+parseFloat(u.base_price_inr||u.basePrice||0),0))}</strong></td>
            <td colspan="2"></td>
          </tr>
        </tfoot>
      </table>
    `;
  },

  showUnit(unitId) {
    const unit = this._units.find(u => u.id === unitId);
    if (!unit) return;

    const statusCfg = this._STATUS_CONFIG.find(s => s.val === (unit.status||'available')) || this._STATUS_CONFIG[0];
    const unitNo = unit.unit_number || unit.unitNumber || unitId.slice(0,8);

    document.getElementById('us-modal-title').textContent = `Unit ${unitNo}`;

    const viewBtn = document.getElementById('us-modal-view-btn');
    const consumerId = unit.consumer_id || unit.allotted_to_consumer_id;
    if (viewBtn) {
      viewBtn.style.display = consumerId ? '' : 'none';
      viewBtn.onclick = () => {
        closeOverlay('us-unit-modal');
        Router.navigate('/consumer', { id: consumerId });
      };
    }

    document.getElementById('us-modal-body').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:12px">
        <div>
          <div style="color:var(--text3);margin-bottom:2px">Unit Number</div>
          <div style="font-weight:700;font-size:16px">${unitNo}</div>
        </div>
        <div>
          <div style="color:var(--text3);margin-bottom:2px">Status</div>
          <div>
            <span class="chip" style="background:${statusCfg.color}1a;color:${statusCfg.color};border:1px solid ${statusCfg.color};font-size:11px;padding:3px 8px">
              ${statusCfg.label}
            </span>
          </div>
        </div>
        <div>
          <div style="color:var(--text3);margin-bottom:2px">Project</div>
          <div>${unit.project_name || unit.projectName || '—'}</div>
        </div>
        <div>
          <div style="color:var(--text3);margin-bottom:2px">Tower / Floor</div>
          <div>Tower ${unit.tower||'—'} · Floor ${unit.floor||unit.floor_number||'—'}</div>
        </div>
        <div>
          <div style="color:var(--text3);margin-bottom:2px">BHK Type</div>
          <div style="font-weight:600">${unit.bhk_type||unit.bhkType||'—'}</div>
        </div>
        <div>
          <div style="color:var(--text3);margin-bottom:2px">Facing</div>
          <div>${unit.facing||'—'}</div>
        </div>
        <div>
          <div style="color:var(--text3);margin-bottom:2px">Carpet Area</div>
          <div>${unit.carpet_area_sqft||unit.carpetArea||'—'} sqft</div>
        </div>
        <div>
          <div style="color:var(--text3);margin-bottom:2px">Super Area</div>
          <div>${unit.super_area_sqft||unit.superArea||'—'} sqft</div>
        </div>
        <div>
          <div style="color:var(--text3);margin-bottom:2px">Base Price</div>
          <div style="font-weight:600;color:var(--accent)">${Utils.currency(unit.base_price_inr||unit.basePrice||0)}</div>
        </div>
        <div>
          <div style="color:var(--text3);margin-bottom:2px">Total Price</div>
          <div style="font-weight:600">${Utils.currency(unit.total_price_inr||unit.totalPrice||0)}</div>
        </div>
        ${consumerId ? `
        <div style="grid-column:span 2">
          <div style="color:var(--text3);margin-bottom:2px">Allottee</div>
          <div style="font-weight:600">${unit.consumer_name||'—'}</div>
        </div>
        ` : ''}
      </div>
    `;
    showOverlay('us-unit-modal');
  },

  exportCsv() {
    if (!this._units.length) { Utils.warn('No data to export'); return; }
    const rows = [
      ['Unit No','Project','Tower','Floor','BHK','Carpet sqft','Super Area sqft','Status','Base Price','Allottee'],
      ...this._units.map(u=>[
        u.unit_number||'—', u.project_name||'—', u.tower||'—', u.floor||'—',
        u.bhk_type||'—', u.carpet_area_sqft||'—', u.super_area_sqft||'—',
        u.status||'available', u.base_price_inr||0, u.consumer_name||'—',
      ]),
    ];
    const csv = rows.map(r=>r.map(v=>`"${v}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    a.download = 'unit_status_report.csv';
    a.click();
  },
};
