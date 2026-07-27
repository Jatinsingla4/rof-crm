// ROF CRM — Unit Status / Inventory Grid Page (Legacy-Matched)

Pages.unitStatus = async function(params = {}) {
  const view = params.view || 'project';
  if (view === 'tower') {
    await UnitStatusPage.renderTowerWiseView();
    return;
  }
  const content = document.getElementById('content');
  content.innerHTML = `
    <!-- Top bar: UNIT STATUS label + status toggle buttons -->
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">
      <span style="font-weight:700;font-size:13px;color:var(--accent);white-space:nowrap">UNIT STATUS</span>
      <div id="us-status-btns" style="display:flex;gap:5px;flex-wrap:wrap">
        ${[
          { key:'all',            label:'All'            },
          { key:'available',      label:'Available'      },
          { key:'mortgage',       label:'Mortgage'       },
          { key:'hold',           label:'Hold'           },
          { key:'unapproved',     label:'Unapproved'     },
          { key:'booked',         label:'Booked'         },
          { key:'allotted',       label:'Allotted'       },
          { key:'rera_registered',label:'Rera Registered'},
          { key:'registry',       label:'Registry'       },
          { key:'temp_surrender', label:'Temp.Surrender' },
        ].map(b => `
          <button class="us-sbtn${b.key === 'all' ? ' us-sbtn-active' : ''}"
            data-key="${b.key}"
            onclick="UnitStatusPage.setStatusFilter('${b.key}')"
            style="display:inline-flex;align-items:center;gap:4px;
              padding:4px 10px;font-size:11.5px;border-radius:4px;cursor:pointer;
              border:1px solid ${b.key === 'all' ? '#1db5a0' : '#bbb'};
              background:${b.key === 'all' ? '#1db5a0' : '#fff'};
              color:${b.key === 'all' ? '#fff' : '#555'};
              font-weight:${b.key === 'all' ? '600' : '400'}">
            <span class="us-sbtn-icon">${b.key === 'all' ? '✓' : '☐'}</span>
            ${b.label}
          </button>
        `).join('')}
        <button title="Collapse filter panel"
          style="margin-left:4px;padding:4px 8px;border:1px solid #bbb;
            border-radius:4px;background:#555;color:#fff;cursor:pointer;font-size:12px"
          onclick="UnitStatusPage.toggleFilters()">—</button>
      </div>
    </div>

    <!-- Filter Panel -->
    <div id="us-filter-panel" class="sp" style="margin-bottom:10px">
      <div class="sp-body" style="padding:12px">
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:10px">
          <div class="fg">
            <label class="fl">*Project</label>
            <select class="fc" id="us-project" onchange="UnitStatusPage.onProjectChange()">
              <option value="">&#8592;&#8211;Select&#8211;&#8594;</option>
            </select>
          </div>
          <div class="fg">
            <label class="fl">Group Name</label>
            <select class="fc" id="us-group">
              <option value="">&#8592;&#8211;All&#8211;&#8594;</option>
            </select>
          </div>
          <div class="fg">
            <label class="fl">Unit Type</label>
            <select class="fc" id="us-bhk">
              <option value="">&#8592;&#8211;Select&#8211;&#8594;</option>
              <option value="Studio">Studio</option>
              <option value="1BHK">1 BHK</option>
              <option value="2BHK">2 BHK</option>
              <option value="2BHK+ST">2 BHK+ST</option>
              <option value="3BHK">3 BHK</option>
            </select>
          </div>
          <div class="fg">
            <label class="fl">Tower</label>
            <select class="fc" id="us-tower">
              <option value="">&#8592;&#8211;All&#8211;&#8594;</option>
            </select>
          </div>
          <div class="fg">
            <label class="fl">Floor</label>
            <select class="fc" id="us-floor">
              <option value="">&#8592;&#8211;All&#8211;&#8594;</option>
            </select>
          </div>
          <div class="fg">
            <label class="fl">Name</label>
            <input class="fc" id="us-consumer-name" placeholder="Name"
              onkeydown="if(event.key==='Enter')UnitStatusPage.load()">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px;align-items:end">
          <div class="fg">
            <label class="fl">Unit No.</label>
            <input class="fc" id="us-unit-no" placeholder="Unit Address"
              onkeydown="if(event.key==='Enter')UnitStatusPage.load()">
          </div>
          <div class="fg">
            <label class="fl">Location</label>
            <select class="fc" id="us-location">
              <option value="">&#8592;&#8211;All&#8211;&#8594;</option>
            </select>
          </div>
          <div class="fg" style="grid-column:span 4;display:flex;align-items:flex-end;justify-content:space-between">
            <button class="btn btn-fetch" onclick="UnitStatusPage.load()"
              style="background:#2196f3;color:#fff;border:none;padding:7px 22px;
                border-radius:4px;font-size:13px;font-weight:600;cursor:pointer">FETCH</button>
            <span id="us-total-sold" style="font-size:12.5px;color:#333;font-weight:500"></span>
          </div>
        </div>
      </div>
    </div>

    <!-- Summary Stats -->
    <div id="us-stats" style="margin-bottom:10px;font-size:12.5px;color:#333;line-height:2"></div>

    <!-- UNIT STATUS bar + Legend + Print/Download -->
    <div style="display:flex;align-items:center;justify-content:space-between;
      background:#f8f9fa;border:1px solid #e0e0e0;padding:6px 12px;margin-bottom:0;flex-wrap:wrap;gap:6px">
      <span style="font-weight:700;font-size:12px;color:var(--accent)">UNIT STATUS</span>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:11px;color:#444">
        ${[
          { color:'#b2ebf2', label:'Mortgage'          },
          { color:'#c8e6c9', label:'Director Hold unit' },
          { color:'#ff9800', label:'Hold unit'          },
          { color:'#fff59d', label:'Unapproved unit'    },
          { color:'#f8bbd0', label:'Booked unit'        },
          { color:'#a5d6a7', label:'Allotted unit'      },
          { color:'#80deea', label:'Rera Registered'    },
          { color:'#e1bee7', label:'Registry unit'      },
          { color:'#90caf9', label:'Temp.Surrender unit'},
        ].map(l => `
          <span style="display:inline-flex;align-items:center;gap:3px">
            <span style="display:inline-block;width:18px;height:14px;border-radius:2px;
              background:${l.color};border:1px solid rgba(0,0,0,.15);flex-shrink:0"></span>
            ${l.label}
          </span>
        `).join('')}
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="window.print()" title="Print"
          style="background:none;border:none;cursor:pointer;font-size:16px;color:#c0392b">🖨</button>
        <button onclick="UnitStatusPage.exportCsv()" title="Download CSV"
          style="background:none;border:none;cursor:pointer;font-size:16px;color:#27ae60">⬇</button>
      </div>
    </div>

    <!-- Results table -->
    <div id="us-grid" style="min-height:80px">
      <div class="page-loading"><div class="spinner"></div> Loading inventory…</div>
    </div>

    <style>
      .us-sbtn-active { background:#1db5a0 !important; color:#fff !important; border-color:#1db5a0 !important; font-weight:600 !important; }
      .us-sbtn-active .us-sbtn-icon::before { content:'✓'; }
      #us-grid table { border-collapse:collapse; width:100%; font-size:12px; }
      #us-grid thead th {
        background:#2c3e50; color:#fff; padding:7px 8px;
        text-align:center; font-size:11px; font-weight:600;
        white-space:nowrap; border:1px solid #1a252f; position:sticky; top:0; z-index:1;
      }
      #us-grid tbody td {
        padding:6px 8px; border:1px solid #ddd;
        vertical-align:middle; text-align:center;
      }
      #us-grid tbody td.td-name { text-align:left; font-weight:600; }
      #us-grid tbody td.td-unitno { font-weight:700; }
      #us-grid tbody td.td-status { text-align:left; }
      #us-grid tfoot td {
        background:#f5f5f5; font-weight:700; font-size:11px;
        padding:5px 8px; border:1px solid #ccc;
      }
      @media print {
        #us-filter-panel, #us-status-btns, .btn-fetch { display:none !important; }
      }
    </style>
  `;

  await UnitStatusPage.loadProjects();
  UnitStatusPage.startPolling();
  await UnitStatusPage.load();
};

const UnitStatusPage = {
  _units: [],
  _view: 'table',
  _pollTimer: null,
  _activeStatusKey: 'all',
  _filtersVisible: true,

  // Map our DB status values → legacy display label
  _STATUS_LABELS: {
    available:              'Available',
    application_received:   'Booked',
    draw_pending:           'Booked',
    locked:                 'Hold',
    held:                   'Hold',
    booked:                 'Booked',
    allotted:               'Allotted',
    agreement_signed:       'Rera Registered',
    under_construction:     'Allotted',
    oc_received:            'Allotted',
    possession_handed_over: 'Registry',
    temp_surrender:         'Temp. Surrender',
  },

  // Row background colors matching legacy exactly
  _STATUS_BG: {
    available:              '',
    application_received:   '#f8bbd0',
    draw_pending:           '#fff59d',
    locked:                 '#ffcc80',
    held:                   '#ffcc80',
    booked:                 '#f8bbd0',
    allotted:               '#a5d6a7',
    agreement_signed:       '#80deea',
    under_construction:     '#a5d6a7',
    oc_received:            '#a5d6a7',
    possession_handed_over: '#e1bee7',
    temp_surrender:         '#ef9a9a',
  },

  // Status filter button → set of DB status values
  _STATUS_MAP: {
    all:            ['available','application_received','draw_pending','booked',
                     'allotted','agreement_signed','under_construction','oc_received',
                     'possession_handed_over','locked','held'],
    available:      ['available'],
    mortgage:       [],
    hold:           ['locked','held'],
    unapproved:     ['application_received','draw_pending'],
    booked:         ['booked','application_received','draw_pending'],
    allotted:       ['allotted','under_construction','oc_received'],
    rera_registered:['agreement_signed'],
    registry:       ['possession_handed_over'],
    temp_surrender: ['temp_surrender'],
  },

  toggleFilters() {
    const panel = document.getElementById('us-filter-panel');
    if (!panel) return;
    this._filtersVisible = !this._filtersVisible;
    panel.style.display = this._filtersVisible ? '' : 'none';
  },

  setStatusFilter(key) {
    this._activeStatusKey = key;
    document.querySelectorAll('.us-sbtn').forEach(btn => {
      const isActive = btn.dataset.key === key;
      btn.classList.toggle('us-sbtn-active', isActive);
      const icon = btn.querySelector('.us-sbtn-icon');
      if (icon) icon.textContent = isActive ? '✓' : '☐';
      btn.style.background   = isActive ? '#1db5a0' : '#fff';
      btn.style.color        = isActive ? '#fff'    : '#555';
      btn.style.borderColor  = isActive ? '#1db5a0' : '#bbb';
      btn.style.fontWeight   = isActive ? '600'     : '400';
    });
    // Filter already-loaded data instantly
    if (this._units.length) this._renderFiltered();
  },

  _getActiveStatuses() {
    return this._STATUS_MAP[this._activeStatusKey] || this._STATUS_MAP['all'];
  },

  _applyFilters(units) {
    const activeStatuses = this._getActiveStatuses();
    let filtered = activeStatuses.length
      ? units.filter(u => activeStatuses.includes(u.status || 'available'))
      : units;

    const bhk      = document.getElementById('us-bhk')?.value;
    const unitNo   = document.getElementById('us-unit-no')?.value.trim().toLowerCase();
    const groupVal = document.getElementById('us-group')?.value;
    const facing   = '';

    if (bhk)      filtered = filtered.filter(u => (u.bhk_type || '') === bhk);
    if (unitNo)   filtered = filtered.filter(u => (u.unit_number || '').toLowerCase().includes(unitNo));
    if (groupVal) filtered = filtered.filter(u => (u.unit_group || '') === groupVal);

    return filtered;
  },

  _renderFiltered() {
    const filtered = this._applyFilters(this._units);
    this.renderTable(filtered);
    this.renderStats(filtered);
  },

  async loadProjects() {
    try {
      const res = await Api.get('/units', { params: { pageSize: 1000 } });
      const units = res.data || res || [];

      const projects = [...new Map(units
        .filter(u => u.project_id)
        .map(u => [u.project_id, { id: u.project_id, name: u.project_name || u.projectName }])
      ).values()];

      const towerMap = new Map();
      units.forEach(u => {
        const tid = u.tower_id; const tname = u.tower_name || u.tower;
        if (tid && tname) towerMap.set(tid, tname);
      });

      const floors = [...new Set(units.map(u => u.floor).filter(f => f != null))]
        .sort((a, b) => Number(a) - Number(b));

      const groups = [...new Set(units.map(u => u.unit_group).filter(Boolean))].sort();

      const pSel = document.getElementById('us-project');
      if (pSel) pSel.innerHTML = '<option value="">&#8592;&#8211;Select&#8211;&#8594;</option>' +
        projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

      const tSel = document.getElementById('us-tower');
      if (tSel) tSel.innerHTML = '<option value="">&#8592;&#8211;All&#8211;&#8594;</option>' +
        [...towerMap.entries()].sort((a,b)=>a[1].localeCompare(b[1]))
          .map(([id,name]) => `<option value="${id}">${name}</option>`).join('');

      const fSel = document.getElementById('us-floor');
      if (fSel) fSel.innerHTML = '<option value="">&#8592;&#8211;All&#8211;&#8594;</option>' +
        floors.map(f => `<option value="${f}">${UnitStatusPage._ordinalFloor(f)}</option>`).join('');

      const gSel = document.getElementById('us-group');
      if (gSel) gSel.innerHTML = '<option value="">&#8592;&#8211;All&#8211;&#8594;</option>' +
        groups.map(g => `<option value="${g}">${g}</option>`).join('');

    } catch(e) { console.warn('loadProjects:', e); }
  },

  async onProjectChange() {
    const projectId = document.getElementById('us-project')?.value;
    if (!projectId) return;
    try {
      const res = await Api.get('/units', { params: { projectId, pageSize: 1000 } });
      const units = res.data || res || [];

      const towerMap = new Map();
      units.forEach(u => {
        const tid = u.tower_id; const tname = u.tower_name || u.tower;
        if (tid && tname) towerMap.set(tid, tname);
      });
      const tSel = document.getElementById('us-tower');
      if (tSel) tSel.innerHTML = '<option value="">&#8592;&#8211;All&#8211;&#8594;</option>' +
        [...towerMap.entries()].sort((a,b)=>a[1].localeCompare(b[1]))
          .map(([id,name]) => `<option value="${id}">${name}</option>`).join('');

      const floors = [...new Set(units.map(u => u.floor).filter(f => f != null))].sort((a,b)=>Number(a)-Number(b));
      const fSel = document.getElementById('us-floor');
      if (fSel) fSel.innerHTML = '<option value="">&#8592;&#8211;All&#8211;&#8594;</option>' +
        floors.map(f => `<option value="${f}">${UnitStatusPage._ordinalFloor(f)}</option>`).join('');

      const groups = [...new Set(units.map(u => u.unit_group).filter(Boolean))].sort();
      const gSel = document.getElementById('us-group');
      if (gSel) gSel.innerHTML = '<option value="">&#8592;&#8211;All&#8211;&#8594;</option>' +
        groups.map(g => `<option value="${g}">${g}</option>`).join('');

    } catch(e) { console.warn('onProjectChange:', e); }
  },

  _ordinalFloor(n) {
    const num = Number(n);
    if (num === 0) return 'Ground Floor';
    const s = ['th','st','nd','rd'];
    const v = num % 100;
    return num + (s[(v-20)%10] || s[v] || s[0]) + ' Floor';
  },

  _getStatusDate(u) {
    const s = u.status || 'available';
    if (['allotted','agreement_signed','under_construction','oc_received'].includes(s))
      return u.allotment_date;
    if (['locked','application_received','draw_pending'].includes(s))
      return u.booking_date;
    if (s === 'possession_handed_over') return u.registry_date;
    if (s === 'held') return u.held_at;
    return null;
  },

  _fmtDate(d) {
    if (!d) return null;
    try { return new Date(d).toLocaleDateString('en-GB'); } catch { return null; }
  },

  async load(silent = false) {
    const projectId    = document.getElementById('us-project')?.value;
    const towerId      = document.getElementById('us-tower')?.value;
    const floor        = document.getElementById('us-floor')?.value;
    const consumerName = document.getElementById('us-consumer-name')?.value.trim();

    if (!silent) {
      const el = document.getElementById('us-grid');
      if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div> Loading inventory…</div>';
    }

    try {
      const params = { pageSize: 1000 };
      if (projectId)    params.projectId    = projectId;
      if (towerId)      params.towerId      = towerId;
      if (floor)        params.floor        = floor;
      if (consumerName) params.consumerName = consumerName;

      const res = await Api.get('/units', { params });
      this._units = res.data || res || [];

      this._renderFiltered();
    } catch(err) {
      const el = document.getElementById('us-grid');
      if (el) el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`;
    }
  },

  renderStats(units) {
    const total   = units.length;
    const av      = units.filter(u => (u.status||'available') === 'available').length;
    const hold    = units.filter(u => ['locked','held'].includes(u.status||'')).length;
    const unapp   = units.filter(u => ['application_received','draw_pending'].includes(u.status||'')).length;
    const booked  = units.filter(u => ['booked','application_received','draw_pending'].includes(u.status||'')).length;
    const allot   = units.filter(u => ['allotted','under_construction','oc_received'].includes(u.status||'')).length;
    const rera    = units.filter(u => u.status === 'agreement_signed').length;
    const reg     = units.filter(u => u.status === 'possession_handed_over').length;
    const tempSur = units.filter(u => u.status === 'temp_surrender').length;
    const sold    = total - av;
    const totalArea = units.reduce((s,u) => s + parseFloat(u.carpet_area_sqft||0), 0);

    // Tower label prefix
    const towerSel = document.getElementById('us-tower');
    const towerLabel = towerSel?.options[towerSel.selectedIndex]?.text;
    const towerPrefix = towerSel?.value
      ? `<span style="font-weight:600">Tower : ${towerLabel}</span>&emsp;&emsp;` : '';

    const statsEl = document.getElementById('us-stats');
    if (statsEl) statsEl.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px 20px;line-height:1.9">
        <span>${towerPrefix}Total Unit : <b>${total}</b></span>
        <span>Available Unit : <b>${av}</b></span>
        <span>Mortgage Unit : <b>0</b></span>
        <span>Hold Unit : <b>${hold}</b></span>
        <span>Unapproved Unit : <b>${unapp}</b></span>
        <span>Booked Unit : <b>${booked}</b></span>
        <span>Alloted Unit : <b>${allot}</b></span>
        <span>Rera Registered : <b>${rera}</b></span>
        <span>Registry Unit : <b>${reg}</b></span>
        <span>Temp.Surrender Unit : <b>${tempSur}</b></span>
        <span>Total Area : <b>${totalArea.toFixed(3)}</b></span>
        <span></span>
      </div>
    `;

    const soldEl = document.getElementById('us-total-sold');
    if (soldEl) soldEl.textContent = `Total Sold Unit : ${sold}`;
  },

  renderTable(units) {
    const el = document.getElementById('us-grid');
    if (!el) return;
    if (!units.length) {
      el.innerHTML = '<div class="empty-state" style="padding:30px;text-align:center"><h3>No units found</h3></div>';
      return;
    }

    // Sort by project name to guarantee contiguous groups regardless of API ordering
    const sortedUnits = [...units].sort((a, b) =>
      (a.project_name || '').localeCompare(b.project_name || '')
    );

    // Pre-compute rowspan counts per project
    const projectSpan = {};
    sortedUnits.forEach(u => {
      const p = u.project_name || 'Unknown';
      projectSpan[p] = (projectSpan[p] || 0) + 1;
    });
    const projectEmitted = new Set();

    const rows = sortedUnits.map((u, i) => {
      const bg       = this._STATUS_BG[u.status || 'available'] || '';
      const label    = this._STATUS_LABELS[u.status || 'available'] || (u.status || 'Available');
      const dateVal  = this._getStatusDate(u);
      const dateStr  = this._fmtDate(dateVal);
      const statusHtml = dateStr
        ? `${label}<br><span style="font-size:10.5px;color:#555">(${dateStr})</span>`
        : label;

      const floorLabel = u.floor != null ? this._ordinalFloor(u.floor) : '—';
      const regNo      = u.registration_no || '';
      const name       = u.consumer_name || '';
      const tower      = u.tower_name || u.tower || '—';
      const group      = u.unit_group  || 'N/A';
      const bhk        = u.bhk_type    || '—';
      const carpet     = u.carpet_area_sqft != null ? parseFloat(u.carpet_area_sqft).toFixed(3) : '—';
      const superArea  = u.super_area_sqft  != null ? parseFloat(u.super_area_sqft).toFixed(4)  : '—';
      const unitNo     = u.unit_number  || '—';
      const broker     = u.broker_name  || 'Direct';

      const projName = u.project_name || 'Unknown';
      let projectCell = '';
      if (!projectEmitted.has(projName)) {
        projectEmitted.add(projName);
        projectCell = `<td rowspan="${projectSpan[projName]}" style="font-weight:700;font-size:11.5px;text-align:center;vertical-align:middle;background:#1a3a5c;color:#fff;letter-spacing:0.4px;padding:8px 10px;min-width:140px;border-right:2px solid #0f2744;white-space:nowrap">${projName}</td>`;
      }

      return `<tr style="background:${bg}">
        ${projectCell}
        <td>${i + 1}</td>
        <td>${regNo}</td>
        <td class="td-name"><a href="/api/consumers/${u.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" onclick="event.stopPropagation()" style="color:var(--primary);text-decoration:underline;cursor:pointer" title="View Applicant File">${name}</a></td>
        <td>${tower}</td>
        <td>${floorLabel}</td>
        <td>${group}</td>
        <td>${bhk}</td>
        <td>${carpet}</td>
        <td>${superArea}</td>
        <td class="td-unitno">${unitNo}</td>
        <td>N/A</td>
        <td>${broker}</td>
        <td class="td-status">${statusHtml}</td>
      </tr>`;
    }).join('');

    const totalArea = units.reduce((s,u) => s + parseFloat(u.carpet_area_sqft||0), 0);

    el.innerHTML = `
      <div style="overflow-x:auto;max-height:600px;overflow-y:auto">
      <table>
        <thead>
          <tr>
            <th style="min-width:140px;text-align:center">PROJECT</th>
            <th>S.NO.</th>
            <th>REGISTRATION NO.</th>
            <th style="min-width:160px;text-align:left">NAME</th>
            <th>TOWER</th>
            <th>FLOOR</th>
            <th>GROUP</th>
            <th>UNIT TYPE</th>
            <th>AREA (SQ.FT.)</th>
            <th>SUPER AREA (SQ.FT.)</th>
            <th>UNIT NO.</th>
            <th>LOCATION</th>
            <th>BROKER</th>
            <th style="min-width:120px;text-align:left">STATUS</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td colspan="8"><strong>TOTAL: ${units.length} units</strong></td>
            <td><strong>${totalArea.toFixed(3)}</strong></td>
            <td colspan="5"></td>
          </tr>
        </tfoot>
      </table>
      </div>
    `;
  },

  exportCsv() {
    if (!this._units.length) { if(typeof Utils!=='undefined') Utils.warn('No data to export'); return; }
    const filtered = this._applyFilters(this._units);
    const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB') : '';
    const rows = [
      ['S.NO','Registration No','Name','Tower','Floor','Group','Unit Type',
       'Area (SQ.FT.)','Super Area (SQ.FT.)','Unit No','Location','Broker','Status','Hold'],
      ...filtered.map((u, i) => [
        i + 1,
        u.registration_no || '',
        u.consumer_name || '',
        u.tower_name || u.tower || '',
        u.floor != null ? this._ordinalFloor(u.floor) : '',
        u.unit_group || 'N/A',
        u.bhk_type || '',
        u.carpet_area_sqft != null ? parseFloat(u.carpet_area_sqft).toFixed(3) : '',
        u.super_area_sqft  != null ? parseFloat(u.super_area_sqft).toFixed(4)  : '',
        u.unit_number || '',
        'N/A',
        u.broker_name || 'Direct',
        (() => {
          const label   = this._STATUS_LABELS[u.status||'available'] || u.status || 'Available';
          const dateVal = this._getStatusDate(u);
          const ds      = fmtDate(dateVal);
          return ds ? `${label} (${ds})` : label;
        })(),
        u.hold_client || (u.hold_status ? 'Yes' : ''),
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'unit_status_report.csv';
    a.click();
  },

  refreshData() {
    if (!document.getElementById('us-grid')) { this.stopPolling(); return; }
    this.load(true);
  },

  startPolling() {
    this.stopPolling();
    this._pollTimer = setInterval(() => {
      if (!document.getElementById('us-grid')) { this.stopPolling(); return; }
      this.load(true);
    }, 30000);
  },

  stopPolling() {
    if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
  },

  // ── TOWER WISE VIEW ──────────────────────────────────────────────────────

  _twTowers: [],
  _twTotals: {},
  _currentProjectId: '',
  _currentProjectName: '',

  async renderTowerWiseView() {
    const content = document.getElementById('content');
    content.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <span style="font-weight:700;font-size:13px;color:var(--accent)">TOWER WISE UNIT STATUS</span>
      </div>
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-body" style="padding:12px">
          <div style="display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap">
            <div class="fg">
              <label class="fl">*Project :</label>
              <select class="fc" id="tw-project" style="min-width:220px">
                <option value="">— Select —</option>
              </select>
            </div>
            <button id="tw-fetch-btn"
              style="background:#2196f3;color:#fff;border:none;padding:7px 22px;
                border-radius:4px;font-size:13px;font-weight:600;cursor:pointer">
              FETCH
            </button>
          </div>
        </div>
      </div>
      <div id="tw-results"></div>
      <style>
        @media print {
          .sp, #tw-fetch-btn { display:none !important; }
        }
      </style>
    `;
    await this.loadTowerWiseProjects();
    document.getElementById('tw-fetch-btn')?.addEventListener('click', () => this.fetchTowerWiseData());
  },

  async loadTowerWiseProjects() {
    try {
      const res = await Api.get('/units/projects');
      const projects = res.data || res || [];
      const select = document.getElementById('tw-project');
      if (!select) return;
      select.innerHTML = '<option value="">— Select —</option>' +
        projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    } catch(e) { console.warn('loadTowerWiseProjects:', e); }
  },

  async fetchTowerWiseData() {
    const sel = document.getElementById('tw-project');
    const projectId = sel?.value;
    if (!projectId) {
      if (typeof Utils !== 'undefined') Utils.warn('Please select a project');
      return;
    }
    this._currentProjectId   = projectId;
    this._currentProjectName = sel.options[sel.selectedIndex]?.text || '';
    const results = document.getElementById('tw-results');
    if (results) results.innerHTML = '<div class="page-loading"><div class="spinner"></div> Loading…</div>';
    try {
      const res = await Api.get(`/units/tower/${projectId}`);
      const towers = res.towers || [];
      const totals = res.totals || {};
      this._twTowers = towers;
      this._twTotals = totals;
      this.renderTowerWiseTable(towers, totals);
    } catch(err) {
      if (results) results.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`;
    }
  },

  renderTowerWiseTable(towers, totals) {
    const results = document.getElementById('tw-results');
    if (!results) return;

    const pct = (count, total) => {
      const c = parseInt(count) || 0, t = parseInt(total) || 0;
      return t === 0 ? '0.00' : ((c / t) * 100).toFixed(2);
    };
    const area = val => parseFloat(val || 0).toFixed(4);

    const thG = `border:1px solid #2d4d7a;padding:8px 6px;text-align:center;font-weight:700;font-size:12px;background:#1e3a5f;`;
    const thS = `border:1px solid #5a8dc5;padding:6px 4px;text-align:center;font-size:11px;font-weight:700;background:#4a7db5;`;
    const subCols = () => `
      <th style="${thS}min-width:72px;">UNIT(NO.)</th>
      <th style="${thS}min-width:116px;">AREA(IN SQ. FT.)</th>
      <th style="${thS}min-width:58px;">PER(%)</th>`;
    const formatIndian = num => {
      const n = parseFloat(num) || 0;
      if (n === 0) return '0.00';
      return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const pid  = this._currentProjectId;
    const pname = this._currentProjectName;
    const linkStyle = `color:#1a56db;font-weight:bold;text-decoration:none;cursor:pointer;`;
    const mkLink = (count, towerId, towerName, sg) => {
      const n = parseInt(count) || 0;
      if (n === 0) return '0';
      const tn = towerName.replace(/'/g, "\\'");
      const pn = pname.replace(/'/g, "\\'");
      return `<a href="#" style="${linkStyle}"
        onmouseover="this.style.textDecoration='underline'"
        onmouseout="this.style.textDecoration='none'"
        onclick="event.preventDefault();UnitStatusPage.openTowerDetail('${pid}','${towerId}','${pn}','${tn}','${sg}')">${n}</a>`;
    };

    let rowsHtml = '';
    towers.forEach((t, i) => {
      const bg = i % 2 === 0 ? '#ffffff' : '#fef9f0';
      const td = (val, align = 'center') =>
        `<td style="padding:6px 8px;border:1px solid #dee2e6;text-align:${align}">${val}</td>`;
      rowsHtml += `<tr style="background:${bg}">
        ${td(i + 1)}
        ${td(t.tower_name || '—', 'left')}
        ${td(mkLink(t.total_units,    t.tower_id, t.tower_name, 'all'))}
        ${td(area(t.total_area), 'right')}
        ${td('100')}
        ${td(mkLink(t.booked_count,   t.tower_id, t.tower_name, 'booked'))}
        ${td(area(t.booked_area), 'right')}
        ${td(pct(t.booked_count, t.total_units))}
        ${td(mkLink(t.allotted_count, t.tower_id, t.tower_name, 'allotted'))}
        ${td(area(t.allotted_area), 'right')}
        ${td(pct(t.allotted_count, t.total_units))}
        ${td(mkLink(t.hold_count,     t.tower_id, t.tower_name, 'hold'))}
        ${td(area(t.hold_area), 'right')}
        ${td(pct(t.hold_count, t.total_units))}
        ${td(mkLink(t.available_count,t.tower_id, t.tower_name, 'available'))}
        ${td(area(t.available_area), 'right')}
        ${td(pct(t.available_count, t.total_units))}
        ${td(formatIndian(t.received_amount), 'right')}
      </tr>`;
    });

    const tdTot = (val, align = 'center') =>
      `<td style="padding:7px 8px;border:1px solid #c5a800;text-align:${align};font-weight:700;background:#fef3cd">${val}</td>`;
    rowsHtml += `<tr>
      ${tdTot('')}
      ${tdTot('Total :', 'left')}
      ${tdTot(totals.total_units || 0)}
      ${tdTot(area(totals.total_area), 'right')}
      ${tdTot('100')}
      ${tdTot(totals.booked_count || 0)}
      ${tdTot(area(totals.booked_area), 'right')}
      ${tdTot(pct(totals.booked_count, totals.total_units))}
      ${tdTot(totals.allotted_count || 0)}
      ${tdTot(area(totals.allotted_area), 'right')}
      ${tdTot(pct(totals.allotted_count, totals.total_units))}
      ${tdTot(totals.hold_count || 0)}
      ${tdTot(area(totals.hold_area), 'right')}
      ${tdTot(pct(totals.hold_count, totals.total_units))}
      ${tdTot(totals.available_count || 0)}
      ${tdTot(area(totals.available_area), 'right')}
      ${tdTot(pct(totals.available_count, totals.total_units))}
      ${tdTot(formatIndian(totals.received_amount), 'right')}
    </tr>`;

    results.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;
        background:#f8f9fa;border:1px solid #e0e0e0;padding:6px 12px;margin-bottom:0">
        <span style="font-weight:700;font-size:12px;color:var(--accent)">TOWER WISE UNIT STATUS</span>
        <div style="display:flex;gap:8px">
          <button onclick="window.print()" title="Print"
            style="background:none;border:none;cursor:pointer;font-size:16px;color:#c0392b">🖨</button>
          <button onclick="UnitStatusPage.exportTowerWiseCsv()" title="Download CSV"
            style="background:none;border:none;cursor:pointer;font-size:16px;color:#27ae60">⬇</button>
        </div>
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;min-width:1100px;font-size:13px;">
          <thead>
            <tr style="background:#1e3a5f;color:#fff;">
              <th rowspan="2" style="${thG}min-width:50px;">S.NO.</th>
              <th rowspan="2" style="${thG}min-width:120px;text-align:left;padding-left:10px;">TOWER NAME</th>
              <th colspan="3" style="${thG}">TOTAL</th>
              <th colspan="3" style="${thG}">BOOKED</th>
              <th colspan="3" style="${thG}">ALLOTTED</th>
              <th colspan="3" style="${thG}">HOLD</th>
              <th colspan="3" style="${thG}">AVAILABLE</th>
              <th colspan="1" style="${thG}min-width:140px;">RECEIVED AMOUNT</th>
            </tr>
            <tr style="background:#4a7db5;color:#fff;">
              ${subCols()}${subCols()}${subCols()}${subCols()}${subCols()}
              <th style="${thS}min-width:140px;">RS.</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;
  },

  async openTowerDetail(projectId, towerId, projectName, towerName, statusGroup) {
    try {
      const token = Auth.getToken() || localStorage.getItem('rof-jwt') || '';
      const params = new URLSearchParams({ projectId, towerId, statusGroup });
      const res = await fetch('/api/units/tower-detail?' + params.toString(), {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) throw new Error('Server returned ' + res.status);
      const data = await res.json();
      const html = this.buildDetailPageHtml(data, statusGroup);
      const blob = new Blob([html], { type: 'text/html' });
      const url  = URL.createObjectURL(blob);
      const tab  = window.open(url, '_blank');
      if (tab) setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch(err) {
      if (typeof Utils !== 'undefined') Utils.error('Failed to load details: ' + err.message);
    }
  },

  buildDetailPageHtml(data, statusGroup) {
    const today = new Date().toLocaleDateString('en-GB');
    const statusLabels = {
      allotted: 'Allotted Units', booked: 'Booked Units',
      hold: 'Hold Units', available: 'Available Units', all: 'All Units'
    };
    const isAvailable = statusGroup === 'available';
    const thStyle = `border:1px solid #2d4d7a;padding:8px 10px;text-align:center;background:#1e3a5f;color:white;font-size:12px;font-weight:bold;white-space:nowrap;`;
    const tdStyle = `border:1px solid #dee2e6;padding:8px 10px;font-size:12px;vertical-align:middle;`;

    const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB') : '—';
    const fmtFloor = f => {
      if (f == null) return '—';
      const n = parseInt(f);
      if (n === 0) return 'Ground Floor';
      const s = ['th','st','nd','rd'];
      const v = n % 100;
      return n + (s[(v-20)%10] || s[v] || s[0]) + ' Floor';
    };
    const fmtLoan = v => {
      if (!v) return 'Self';
      return v.toLowerCase() === 'loan' ? 'Loan Sanctioned' : 'Self';
    };

    let rowsHtml = '';
    if (!data.units || data.units.length === 0) {
      rowsHtml = `<tr><td colspan="${isAvailable ? 7 : 10}" style="${tdStyle}text-align:center;padding:20px;color:#888;">No units found.</td></tr>`;
    } else {
      data.units.forEach((u, i) => {
        const bg = i % 2 === 0 ? '#fff' : '#f9f9f9';
        const td = (val, align = 'center') => `<td style="${tdStyle}text-align:${align}">${val ?? '—'}</td>`;
        if (isAvailable) {
          rowsHtml += `<tr style="background:${bg}">
            ${td(i + 1)} ${td(u.unit_number)} ${td(u.unit_type)} ${td(parseFloat(u.area||0).toFixed(4),'right')}
            ${td(fmtFloor(u.floor))} ${td(parseFloat(u.super_area_sqft||0).toFixed(4),'right')} ${td(u.status)}
          </tr>`;
        } else {
          rowsHtml += `<tr style="background:${bg}">
            ${td(i + 1)} ${td(u.registration_no,'left')} ${td(u.consumer_id ? `<a href="/api/consumers/${u.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" style="color:var(--primary);text-decoration:underline;cursor:pointer" title="View Applicant File">${u.consumer_name||'—'}</a>` : (u.consumer_name||'—'), 'left')}
            ${td(fmtDate(u.booking_date))} ${td(u.broker_name || 'Direct')}
            ${td(fmtLoan(u.loan_type))} ${td(u.payment_plan || 'Payment Plan')}
            ${td(u.unit_number)} ${td(u.unit_type)} ${td(parseFloat(u.area||0).toFixed(4),'right')}
          </tr>`;
        }
      });
    }

    const headers = isAvailable
      ? ['S.NO.','UNIT ADDRESS','UNIT TYPE','AREA (SQ.FT.)','FLOOR','SUPER AREA (SQ.FT.)','STATUS']
      : ['S.NO.','REGISTRATION NO','NAME','BOOKING DATE','BROKER','TYPE','PAYMENT PLAN','UNIT ADDRESS','UNIT TYPE','AREA (SQ.FT.)'];

    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Date Wise Booking — ${data.tower_name || ''}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:13px;padding:20px;background:#f5f5f5}
  .action-bar{position:fixed;top:0;left:0;right:0;background:#1a3c5e;color:white;
    padding:10px 20px;display:flex;align-items:center;gap:10px;z-index:1000;
    box-shadow:0 2px 8px rgba(0,0,0,.3)}
  .action-bar button{background:white;color:#1a3c5e;border:2px solid white;
    padding:6px 14px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600}
  .action-bar button:hover{background:#1a3c5e;color:white}
  .spacer{height:52px}
  .page-card{background:white;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,.1);
    padding:20px;margin-top:10px}
  .page-title{color:#1a56db;font-size:14px;font-weight:bold;text-transform:uppercase;
    letter-spacing:.5px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #e9ecef}
  .meta{margin-bottom:16px;font-size:13px;color:#333;display:flex;gap:24px;flex-wrap:wrap}
  .meta span strong{color:#1a3c5e}
  table{width:100%;border-collapse:collapse}
  @media print{.action-bar,.spacer{display:none!important}body{padding:10px}}
</style></head><body>
  <div class="action-bar">
    <span style="flex:1;font-weight:bold;font-size:13px;">ROF CRM — Date Wise Booking</span>
    <button onclick="window.print()">🖨 Print</button>
    <button onclick="window.close()" style="border-color:#dc3545;color:#dc3545;">✕ Close</button>
  </div>
  <div class="spacer"></div>
  <div class="page-card">
    <div class="page-title">DATE WISE BOOKING</div>
    <div class="meta">
      <span><strong>Project:</strong> ${data.project_name || '—'}</span>
      <span><strong>Date:</strong> ${today}</span>
      <span><strong>Tower:</strong> ${data.tower_name || '—'}</span>
      <span><strong>Status:</strong> ${statusLabels[statusGroup] || statusGroup}</span>
      <span><strong>Total Units:</strong> ${data.units ? data.units.length : 0}</span>
    </div>
    <div style="overflow-x:auto">
      <table>
        <thead><tr>${headers.map(h => `<th style="${thStyle}">${h}</th>`).join('')}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  </div>
</body></html>`;
  },

  exportTowerWiseCsv() {
    const towers = this._twTowers || [];
    const totals = this._twTotals || {};
    if (!towers.length) { if (typeof Utils !== 'undefined') Utils.warn('No data to export'); return; }
    const pct = (count, total) => {
      const c = parseInt(count) || 0, t = parseInt(total) || 0;
      return t === 0 ? '0.00' : ((c / t) * 100).toFixed(2);
    };
    const area = val => parseFloat(val || 0).toFixed(4);
    const fmtAmt = val => (parseFloat(val) || 0).toFixed(2);
    const headers = ['S.No.','Tower Name',
      'Total Units','Total Area','Total %',
      'Booked Units','Booked Area','Booked %',
      'Allotted Units','Allotted Area','Allotted %',
      'Hold Units','Hold Area','Hold %',
      'Available Units','Available Area','Available %',
      'Received Amount (Rs.)'];
    const dataRows = towers.map((t, i) => [
      i + 1, t.tower_name,
      t.total_units, area(t.total_area), '100',
      t.booked_count,   area(t.booked_area),   pct(t.booked_count,   t.total_units),
      t.allotted_count, area(t.allotted_area),  pct(t.allotted_count, t.total_units),
      t.hold_count,     area(t.hold_area),      pct(t.hold_count,     t.total_units),
      t.available_count,area(t.available_area), pct(t.available_count,t.total_units),
      fmtAmt(t.received_amount),
    ]);
    const totalRow = ['', 'Total :',
      totals.total_units || 0,    area(totals.total_area),    '100',
      totals.booked_count || 0,   area(totals.booked_area),   pct(totals.booked_count,   totals.total_units),
      totals.allotted_count || 0, area(totals.allotted_area), pct(totals.allotted_count, totals.total_units),
      totals.hold_count || 0,     area(totals.hold_area),     pct(totals.hold_count,     totals.total_units),
      totals.available_count || 0,area(totals.available_area),pct(totals.available_count,totals.total_units),
      fmtAmt(totals.received_amount),
    ];
    const csv = [headers, ...dataRows, totalRow]
      .map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))
      .join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'tower-wise-unit-status.csv';
    a.click();
  },
};
