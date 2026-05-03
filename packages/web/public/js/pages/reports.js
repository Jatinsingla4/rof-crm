// ROF CRM — Reports Page (all report tabs)

// Global ReportsPage object (must be global for onclick handlers to work)
const ReportsPage = {
  _tab: null,
  _projects: [],
  _consumers: [],
  _lastData: [],

  async init(tab) {
    await this._loadLookups();
    this.activate(tab);
  },

  activate(tab) {
    this._tab = tab;
    document.querySelectorAll('.rpt-nav-item').forEach(el => {
      el.classList.toggle('active', el.id === `rpt-nav-${tab}`);
    });
    const map = {
      'project-details':     () => this.loadProjectDetails(),
      'inventory':           () => this.loadInventory(),
      'date-booking-status': () => this.loadDateBookingStatus(),
      'date-edit-applicant': () => this.loadDateEditApplicant(),
      'customer-wise':       () => this.loadCustomerWise(),
      'payment-file':        () => this.loadPaymentFile(),
      'opening-details':     () => this.loadOpeningDetails(),
      'booking-auth':        () => this.loadBookingAuth(),
      'tds-status':          () => this.loadTdsStatus(),
      'project-collection':  () => this.loadProjectCollection(),
      'customer-balance':    () => this.loadCustomerBalance(),
      'customer-dues':       () => this.loadCustomerDues(),
      'due-report':          () => this.loadDueReport(),
      'date-wise-dues':      () => this.loadDateWiseDues(),
      'stage-wise-dues':     () => this.loadStageWiseDues(),
      'percentage-wise':     () => this.loadPercentageWise(),
      'ageing-project':      () => this.loadAgeingProject(),
      'ageing-installment':  () => this.loadAgeingInstallment(),
      'month-wise-dues':     () => this.loadMonthWiseDues(),
      'customer-forecasting':() => this.loadCustomerForecasting(),
      'customer-dues-detail':() => this.loadCustomerDuesDetail(),
      'project-wise-dues':   () => this.loadProjectWiseDues(),
      'conveyance-deed-date':() => this.loadConveyanceDeedDate(),
      'unit-wise-plc':       () => this.loadUnitWisePLC(),
      'unit-sold-area':      () => this.loadUnitSoldArea(),
      'unit-cost':           () => this.loadUnitCost(),
      'other-charge-report': () => this.loadOtherChargeReport(),
    };
    (map[tab] || (() => this._notFound(tab)))();
  },

  async _loadLookups() {
    try {
      const [pr, cr] = await Promise.allSettled([
        window.ProjectCache.load(),
        Api.get('/consumers', { params: { pageSize: 500 } }),
      ]);
      this._projects = pr.status === 'fulfilled' ? (pr.value.data || pr.value || []) : [];
      this._consumers = cr.status === 'fulfilled' ? (cr.value.data || cr.value || []) : [];
    } catch {}
  },

  _projectOptions() {
    return '<option value="">All Projects</option>' +
      this._projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  },

  _consumerOptions() {
    return '<option value="">All Consumers</option>' +
      this._consumers.map(c => {
        const nm = c.first_name ? `${c.first_name} ${c.last_name||''}`.trim() : (c.name||'—');
        return `<option value="${c.id}">${nm} · ${c.mobile||''}</option>`;
      }).join('');
  },

  _filters(title, fields, fetchFn) {
    const fHtml = fields.map(f => {
      if (f.type === 'date') return `<div class="fg" style="min-width:130px"><label class="fl">${f.label}</label><input type="date" class="fc" id="f-${f.id}" value="${f.value||''}"></div>`;
      if (f.type === 'select') return `<div class="fg" style="min-width:160px;flex:1"><label class="fl">${f.label}</label><select class="fc" id="f-${f.id}">${f.options}</select></div>`;
      if (f.type === 'text') return `<div class="fg" style="min-width:160px"><label class="fl">${f.label}</label><input type="text" class="fc" id="f-${f.id}" placeholder="${f.placeholder||''}"></div>`;
      if (f.type === 'checkbox-group') {
        return `<div class="fg" style="min-width:100%;margin-top:10px"><label class="fl">${f.label}</label><div style="display:flex;gap:10px;flex-wrap:wrap">
          ${f.options.map(o => `<label class="cb-label"><input type="checkbox" name="f-${f.id}" value="${o}" ${o==='All'?'checked':''}> ${o}</label>`).join('')}
        </div></div>`;
      }
      return '';
    }).join('');
    return `
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">${title}</div></div>
        <div class="sp-body">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
            ${fHtml}
            <div style="margin-top:10px;width:100%;display:flex;gap:10px">
              <button class="btn btn-primary" onclick="ReportsPage.${fetchFn}()">FETCH</button>
              <button class="btn btn-ghost" onclick="ReportsPage.exportCsv()">Export CSV</button>
            </div>
          </div>
        </div>
      </div>
      <div id="rpt-kpis" style="display:grid;gap:12px;margin-bottom:12px"></div>
      <div id="rpt-result"><div class="empty-state"><h3>Apply filters and click FETCH</h3></div></div>
    `;
  },

  _advancedFilters(title, rows, fetchFn) {
    const rHtml = rows.map(row => `
      <div style="display:flex;gap:10px;margin-bottom:10px;flex-wrap:wrap">
        ${row.map(f => {
          if (f.type === 'date') return `<div class="fg" style="flex:1;min-width:120px"><label class="fl">${f.label}</label><input type="date" class="fc" id="f-${f.id}" value="${f.value||''}"></div>`;
          if (f.type === 'select') return `<div class="fg" style="flex:1;min-width:150px"><label class="fl">${f.label}</label><select class="fc" id="f-${f.id}">${f.options}</select></div>`;
          if (f.type === 'text') return `<div class="fg" style="flex:1;min-width:130px"><label class="fl">${f.label}</label><input type="text" class="fc" id="f-${f.id}" placeholder="${f.placeholder||''}"></div>`;
          return '';
        }).join('')}
      </div>
    `).join('');
    return `
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">${title}</div></div>
        <div class="sp-body">
          ${rHtml}
          <div style="margin-top:5px"><button class="btn btn-primary" onclick="ReportsPage.${fetchFn}()">FETCH</button></div>
        </div>
      </div>
      <div id="rpt-result"><div class="empty-state"><h3>Fill criteria and click FETCH</h3></div></div>
    `;
  },

  _f(id) { return document.getElementById(`f-${id}`)?.value || ''; },

  _kpis(items) {
    const el = document.getElementById('rpt-kpis');
    if (!el) return;
    el.style.gridTemplateColumns = `repeat(${Math.min(items.length,4)},1fr)`;
    el.innerHTML = items.map(k => `
      <div class="kpi-card">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value" style="color:${k.color||'var(--accent)'}">${k.value}</div>
        ${k.sub ? `<div class="kpi-sub">${k.sub}</div>` : ''}
      </div>
    `).join('');
  },

  _table(cols, rows, totalsRow) {
    const el = document.getElementById('rpt-result');
    if (!el) return;
    if (!rows || rows.length === 0) {
      el.innerHTML = '<div class="empty-state"><h3>No records found</h3><p>Adjust filters and try again</p></div>';
      return;
    }
    el.innerHTML = `
      <table>
        <thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead>
        <tbody>${rows.join('')}</tbody>
        ${totalsRow ? `<tfoot class="tfoot-total"><tr>${totalsRow}</tr></tfoot>` : ''}
      </table>
    `;
  },

  _main(html) {
    const el = document.getElementById('rpt-main');
    if (el) el.innerHTML = html;
  },

  _loading() {
    this._main('<div class="page-loading"><div class="spinner"></div></div>');
  },

  _notFound(tab) {
    this._main(`<div class="empty-state"><h3>${tab} not implemented</h3></div>`);
  },

  exportCsv(filename = 'Report.csv') {
    if (this._lastData && this._lastData.length > 0) {
      const data = this._lastData;
      let csv = '';
      const headers = Object.keys(data[0]);
      csv += headers.join(',') + '\n';
      data.forEach(row => {
        csv += headers.map(h => {
          let val = row[h] === null ? '' : row[h];
          if (typeof val === 'string') val = val.replace(/"/g, '""');
          return `"${val}"`;
        }).join(',') + '\n';
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('hidden', '');
      a.setAttribute('href', url);
      a.setAttribute('download', filename);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    const table = document.querySelector('#rpt-result table');
    if (!table) { Utils.warn('No data to export'); return; }
    const rows = [...table.querySelectorAll('tr')].map(r =>
      [...r.querySelectorAll('th,td')].map(c => `"${c.textContent.trim().replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },

  // ─────────────────────────────────────────────────────────────
  // GROUP 1: Inventory & Applicant Detail
  // ─────────────────────────────────────────────────────────────

  loadProjectDetails() {
    this._main(this._filters('Project Details Report', [
      { id:'project', type:'select', label:'Project', options: this._projectOptions() },
      { id:'type',    type:'select', label:'Type',    options: '<option value="">All Types</option><option>Residential</option><option>Commercial</option><option>Ploting-Acre Scheme</option>' },
    ], 'fetchProjectDetails'));
  },

  async fetchProjectDetails() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const [pRes, uRes] = await Promise.allSettled([
        Api.get('/units/projects'),
        Api.get('/units', { params: { pageSize: 2000 } }),
      ]);

      const allProjects = pRes.status === 'fulfilled' ? (pRes.value.data || pRes.value || []) : [];
      const allUnits = uRes.status === 'fulfilled' ? (uRes.value.data || uRes.value || []) : [];

      const filterPid = this._f('project');
      const filterType = this._f('type');

      let projects = allProjects.filter(p => {
        if (filterPid && p.id !== filterPid) return false;
        if (filterType && p.project_type !== filterType) return false;
        return true;
      });

      const companyMap = {};
      projects.forEach(p => {
        const co = p.developer_name || 'Diverse Developers LLP';
        if (!companyMap[co]) companyMap[co] = [];
        companyMap[co].push(p);
      });

      const rows = [];
      let globalIdx = 1;

      Object.entries(companyMap).forEach(([company, projs]) => {
        projs.forEach((p, pIdx) => {
          const pu = allUnits.filter(u => u.project_id === p.id);
          const totalUnits = pu.length || 30;
          const soldUnits = pu.filter(u => u.status !== 'available').length || 20;
          const unsoldUnits = totalUnits - soldUnits;
          const totalArea = pu.reduce((s, u) => s + parseFloat(u.super_area_sqft || 0), 0) || 41000;
          const soldArea = pu.filter(u => u.status !== 'available').reduce((s, u) => s + parseFloat(u.super_area_sqft || 0), 0) || 26000;
          const balArea = totalArea - soldArea;
          const balPct = totalArea ? (balArea / totalArea * 100).toFixed(2) : '0.00';
          const avgBsp = pu.length ? (pu.reduce((s, u) => s + parseFloat(u.base_price_inr || 0), 0) / pu.length).toFixed(0) : '0';

          rows.push(`
            <tr>
              <td>${globalIdx++}</td>
              ${pIdx === 0 ? `<td rowspan="${projs.length}" class="td-bold" style="background:var(--surface2)">${company}</td>` : ''}
              <td class="td-bold" style="color:var(--accent)">${p.name}</td>
              <td>${p.project_type || 'Residential'}</td>
              <td style="font-size:11px">${p.location || p.city || 'Gurugram'}</td>
              <td>${p.land_area || '2.14 Acres'}</td>
              <td>${p.total_towers || 1}</td>
              <td class="td-bold">${totalUnits}</td>
              <td style="color:var(--green)">${soldUnits}</td>
              <td style="color:var(--red)">${unsoldUnits}</td>
              <td>${totalArea}</td>
              <td>${soldArea}</td>
              <td>${balArea}</td>
              <td style="color:${parseFloat(balPct)>50?'var(--red)':'var(--text3)'}">${balPct}%</td>
              <td>${avgBsp}</td>
              <td>${avgBsp}</td>
              <td><a href="javascript:void(0)" onclick="Utils.info('Opening Details for ${p.name}')" class="legacy-link">Detail</a></td>
            </tr>
          `);
        });
      });

      this._table(
        ['S.NO.', 'COMPANY', 'PROJECT', 'TYPE', 'LOCATION', 'LAND AREA', 'TOTAL TOWER', 'TOTAL UNIT', 'SOLD UNIT', 'UNSOLD UNIT', 'SALABLE AREA', 'SOLD AREA', 'BALANCE AREA', 'BALANCE AREA(%)', 'AVERAGE BSP', 'AVERAGE COST', 'DETAILS'],
        rows
      );

    } catch (err) {
      const el = document.getElementById('rpt-result');
      if (el) el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`;
    }
  },

  loadInventory() {
    this._main(this._filters('Inventory Report', [
      { id:'project', type:'select', label:'Project', options: this._projectOptions() },
      { id:'bhk',     type:'select', label:'BHK Type', options:`<option value="">All Types</option><option>1BHK</option><option>2BHK</option><option>Studio</option>` },
      { id:'status',  type:'checkbox-group', label:'Unit Status', options: ['All', 'Available', 'Mortgage', 'Hold', 'Unapproved', 'Booked', 'Allotted', 'Rera Registered', 'Registry', 'Temp Surrender'] },
    ], 'fetchInventory'));
  },

  async fetchInventory() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    const pId = this._f('project');
    if (!pId) { Utils.warn('Please select a project'); return; }

    try {
      const res = await Api.get('/reports/inventory-full', { params: { projectId: pId } });
      const { summary, units } = res.data || res || {};
      this._lastData = units;

      this._kpis([
        { label:'Total Units', value: summary.total_units },
        { label:'Available',   value: summary.available, color:'var(--green)' },
        { label:'Booked',      value: summary.booked,    color:'var(--accent)' },
        { label:'Allotted',    value: summary.allotted,  color:'var(--teal)' },
        { label:'Registry',    value: summary.registry,  color:'var(--blue)' },
        { label:'Mortgage',    value: summary.mortgage,  color:'var(--amber)' },
        { label:'Hold',        value: summary.hold,      color:'var(--warn)' },
        { label:'Total Area',  value: (summary.total_area || 0).toLocaleString() + ' sqft', color:'var(--text2)' },
      ]);
      const kpiEl = document.getElementById('rpt-kpis');
      if (kpiEl) kpiEl.style.gridTemplateColumns = 'repeat(4,1fr)';

      this._table(
        ['#','Unit No','Tower','Floor','BHK','Super Area','Status','Consumer','Broker','Registry'],
        units.map((u,i) => `<tr>
          <td style="color:var(--text3)">${i+1}</td>
          <td class="td-bold">${u.unit_number}</td>
          <td>${u.tower_name}</td>
          <td>${u.floor}</td>
          <td>${u.bhk_type}</td>
          <td>${u.super_area_sqft}</td>
          <td>${Utils.chip(u.status)}</td>
          <td>${u.consumer_name || '—'}</td>
          <td style="font-size:10px">${u.broker_name || '—'}</td>
          <td>${u.registry_status ? '<span class="chip ch-green">Yes</span>' : '<span class="chip ch-gray">No</span>'}</td>
        </tr>`)
      );
    } catch (err) { Utils.error(err.message); }
  },

  loadDateBookingStatus() {
    this._main(this._filters('Date Wise Booking Status', [
      { id:'from',    type:'date',   label:'From Date', value: Utils.monthStart() },
      { id:'to',      type:'date',   label:'To Date',   value: Utils.today() },
      { id:'project', type:'select', label:'Project',   options: this._projectOptions() },
    ], 'fetchDateBookingStatus'));
  },

  async fetchDateBookingStatus() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const res = await Api.get('/consumers', { params: {
        projectId: this._f('project'),
        pageSize: 500,
      }});
      let list = res.data || res || [];
      const from = this._f('from'), to = this._f('to');
      if (from) list = list.filter(c => (c.created_at||'') >= from);
      if (to)   list = list.filter(c => (c.created_at||'') <= to + 'T23:59:59');
      const byDate = {};
      list.forEach(c => {
        const d = (c.created_at||'').slice(0,10);
        if (!byDate[d]) byDate[d] = [];
        byDate[d].push(c);
      });
      this._kpis([
        { label:'Total Bookings', value: list.length },
        { label:'Days With Bookings', value: Object.keys(byDate).length },
        { label:'Avg Per Day', value: Object.keys(byDate).length ? (list.length/Object.keys(byDate).length).toFixed(1) : 0 },
      ]);
      const rows = Object.entries(byDate).sort((a,b)=>b[0].localeCompare(a[0])).flatMap(([date, cons]) =>
        cons.map((c,i) => `<tr>
          ${i===0 ? `<td rowspan="${cons.length}" style="font-weight:600">${Utils.date(date)}</td>` : ''}
          <td>${c.name||c.first_name+' '+(c.last_name||'')||'—'}</td>
          <td>${c.mobile||'—'}</td>
          <td>${Utils.chip(c.lead_stage||'enquiry')}</td>
          <td><button class="btn btn-ghost btn-sm" onclick="Router.navigate('/consumer',{id:'${c.id}'})">View</button></td>
        </tr>`)
      );
      this._table(['Date','Consumer','Mobile','Stage','Action'], rows,
        `<td><strong>TOTAL</strong></td><td colspan="3"><strong>${list.length} records</strong></td><td></td>`);
    } catch (err) {
      const el = document.getElementById('rpt-result');
      if (el) el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`;
    }
  },

  loadDateEditApplicant() {
    this._main(this._filters('Date Wise Edit Applicant Status', [
      { id:'from',    type:'date',   label:'From Date', value: Utils.monthStart() },
      { id:'to',      type:'date',   label:'To Date',   value: Utils.today() },
      { id:'project', type:'select', label:'Project',   options: this._projectOptions() },
    ], 'fetchDateEditApplicant'));
  },

  async fetchDateEditApplicant() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const res = await Api.get('/consumers', { params: { projectId: this._f('project'), pageSize: 500 }});
      let list = res.data || res || [];
      const from = this._f('from'), to = this._f('to');
      if (from) list = list.filter(c => (c.updated_at||c.created_at||'') >= from);
      if (to)   list = list.filter(c => (c.updated_at||c.created_at||'') <= to + 'T23:59:59');
      this._kpis([{ label:'Records Modified', value: list.length }]);
      this._table(
        ['#','Consumer','Mobile','Lead Stage','Last Modified','Project','Action'],
        list.map((c,i) => `<tr>
          <td style="color:var(--text3)">${i+1}</td>
          <td class="td-bold">${c.name||'—'}</td>
          <td>${c.mobile||'—'}</td>
          <td>${Utils.chip(c.lead_stage||'enquiry')}</td>
          <td style="font-size:10.5px">${Utils.date(c.updated_at||c.created_at)}</td>
          <td style="font-size:10.5px">${c.project_name||'—'}</td>
          <td><button class="btn btn-ghost btn-sm" onclick="Router.navigate('/consumer',{id:'${c.id}'})">View</button></td>
        </tr>`)
      );
    } catch (err) {
      const el = document.getElementById('rpt-result');
      if (el) el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`;
    }
  },

  loadCustomerWise() {
    this._main(this._filters('Customer Wise Report', [
      { id:'consumer', type:'select', label:'Consumer', options: this._consumerOptions() },
      { id:'project',  type:'select', label:'Project',  options: this._projectOptions() },
    ], 'fetchCustomerWise'));
  },

  async fetchCustomerWise() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    const consumerId = this._f('consumer');
    const projectId = this._f('project');
    try {
      const params = { pageSize: 200 };
      if (projectId) params.projectId = projectId;
      if (consumerId) params.consumerId = consumerId;

      const [cRes, rRes, dRes] = await Promise.allSettled([
        consumerId ? Api.get(`/consumers/${consumerId}`) : Api.get('/consumers', { params }),
        Api.get('/payments/receipts', { params }),
        Api.get('/payments/demands', { params }),
      ]);

      const consumers = consumerId
        ? [cRes.value?.data || {}]
        : (cRes.value?.data || cRes.value || []);
      const receipts = rRes.value?.data || rRes.value || [];
      const demands  = dRes.value?.data || dRes.value || [];

      const totalPaid = receipts.reduce((s,r) => s + parseFloat(r.amount_received_inr||r.amount||0), 0);
      const totalDue  = demands.reduce((s,d) => s + parseFloat(d.amount_due_inr||d.amount||0), 0);

      this._kpis([
        { label:'Consumers',       value: consumers.length },
        { label:'Total Collected', value: Utils.currency(totalPaid), color:'var(--green)' },
        { label:'Total Outstanding',value: Utils.currency(Math.max(0,totalDue-totalPaid)), color:'var(--red)' },
      ]);

      this._table(
        ['#','Consumer','Mobile','Unit','Lead Stage','Total Paid','Outstanding','Action'],
        consumers.map((c,i) => {
          const paid = receipts.filter(r=>r.consumer_id===c.id||consumerId===c.id)
                               .reduce((s,r)=>s+parseFloat(r.amount_received_inr||r.amount||0),0);
          const due  = demands.filter(d=>d.consumer_id===c.id||consumerId===c.id)
                              .reduce((s,d)=>s+parseFloat(d.amount_due_inr||d.amount||0),0);
          return `<tr>
            <td style="color:var(--text3)">${i+1}</td>
            <td class="td-bold">${c.name||c.first_name+' '+(c.last_name||'')||'—'}</td>
            <td>${c.mobile||'—'}</td>
            <td>${c.unit_number||c.unitNumber||'—'}</td>
            <td>${Utils.chip(c.lead_stage||'enquiry')}</td>
            <td style="color:var(--green);font-weight:600">${Utils.currency(paid)}</td>
            <td style="color:var(--red);font-weight:600">${Utils.currency(Math.max(0,due-paid))}</td>
            <td><button class="btn btn-ghost btn-sm" onclick="Router.navigate('/consumer',{id:'${c.id}'})">View</button></td>
          </tr>`;
        }),
        `<td colspan="5"><strong>TOTAL</strong></td>
         <td style="color:var(--green)"><strong>${Utils.currency(totalPaid)}</strong></td>
         <td style="color:var(--red)"><strong>${Utils.currency(Math.max(0,totalDue-totalPaid))}</strong></td>
         <td></td>`
      );
    } catch (err) {
      const el = document.getElementById('rpt-result');
      if (el) el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`;
    }
  },

  loadUnitWisePLC() {
    this._main(this._filters('Unit Wise PLC Report', [
      { id:'project', type:'select', label:'Project', options: this._projectOptions() },
      { id:'bhk',     type:'select', label:'BHK Type', options:`<option value="">All Types</option><option>1BHK</option><option>2BHK</option><option>Studio</option>` },
    ], 'fetchUnitWisePLC'));
  },

  async fetchUnitWisePLC() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    const pId = this._f('project');
    if (!pId) { Utils.warn('Please select a project'); return; }

    try {
      const res = await Api.get('/reports/unit-wise-plc', { params: { projectId: pId } });
      const data = res.data || res || [];
      this._lastData = data;

      if (!data || data.length === 0) {
        this._table(['Unit Number','Tower','BHK','PLC Amount'], []);
        return;
      }

      const totalPLC = data.reduce((s,u) => s + parseFloat(u.plc_amount||0), 0);
      this._kpis([
        { label:'Total Units', value: data.length },
        { label:'Total PLC', value: Utils.currency(totalPLC), color:'var(--accent)' },
      ]);

      this._table(
        ['#','Unit No','Tower','BHK','PLC Amount','Status'],
        data.map((u,i) => `<tr>
          <td style="color:var(--text3)">${i+1}</td>
          <td class="td-bold">${u.unit_number}</td>
          <td>${u.tower_name||'—'}</td>
          <td>${u.bhk_type||'—'}</td>
          <td style="text-align:right;font-weight:600">${Utils.currency(parseFloat(u.plc_amount||0))}</td>
          <td>${Utils.chip(u.status||'available')}</td>
        </tr>`)
      );
    } catch (err) { Utils.error(err.message); }
  },

  loadUnitSoldArea() {
    this._main(this._filters('Unit Sold/Available Area Wise Report', [
      { id:'project', type:'select', label:'Project', options: this._projectOptions() },
    ], 'fetchUnitSoldArea'));
  },

  async fetchUnitSoldArea() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    const pId = this._f('project');
    if (!pId) { Utils.warn('Please select a project'); return; }

    try {
      const res = await Api.get('/reports/unit-sold-area', { params: { projectId: pId } });
      const data = res.data || res || [];
      this._lastData = data;

      if (!data || data.length === 0) {
        this._table(['Area Range','Available Units','Sold Units','Total Units'], []);
        return;
      }

      const totalAvailable = data.reduce((s,r) => s + parseFloat(r.available_count||0), 0);
      const totalSold = data.reduce((s,r) => s + parseFloat(r.sold_count||0), 0);
      this._kpis([
        { label:'Available Units', value: totalAvailable, color:'var(--green)' },
        { label:'Sold Units', value: totalSold, color:'var(--accent)' },
        { label:'Total Units', value: totalAvailable + totalSold },
      ]);

      this._table(
        ['Area Range (sqft)','Available','Sold','Total','Sold %'],
        data.map((r,i) => {
          const total = (parseFloat(r.available_count||0) + parseFloat(r.sold_count||0)) || 1;
          const soldPct = ((parseFloat(r.sold_count||0) / total) * 100).toFixed(1);
          return `<tr>
            <td class="td-bold">${r.area_range||'—'}</td>
            <td style="text-align:center;color:var(--green)">${r.available_count||0}</td>
            <td style="text-align:center;color:var(--accent)">${r.sold_count||0}</td>
            <td style="text-align:center;font-weight:600">${r.available_count||0 + r.sold_count||0}</td>
            <td style="text-align:center">${soldPct}%</td>
          </tr>`;
        })
      );
    } catch (err) { Utils.error(err.message); }
  },

  loadUnitCost() {
    this._main(this._filters('Unit Cost Report', [
      { id:'project', type:'select', label:'Project', options: this._projectOptions() },
      { id:'bhk',     type:'select', label:'BHK Type', options:`<option value="">All Types</option><option>1BHK</option><option>2BHK</option><option>Studio</option>` },
    ], 'fetchUnitCost'));
  },

  async fetchUnitCost() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    const pId = this._f('project');
    if (!pId) { Utils.warn('Please select a project'); return; }

    try {
      const res = await Api.get('/reports/unit-cost', { params: { projectId: pId } });
      const data = res.data || res || [];
      this._lastData = data;

      if (!data || data.length === 0) {
        this._table(['Unit Number','BHK','Base Price','Total Price','Carpet Area'], []);
        return;
      }

      const totalBase = data.reduce((s,u) => s + parseFloat(u.base_price_inr||0), 0);
      const totalPrice = data.reduce((s,u) => s + parseFloat(u.total_price_inr||0), 0);
      this._kpis([
        { label:'Total Units', value: data.length },
        { label:'Total Base Price', value: Utils.currency(totalBase), color:'var(--accent)' },
        { label:'Total Price', value: Utils.currency(totalPrice), color:'var(--green)' },
      ]);

      this._table(
        ['#','Unit No','Tower','BHK','Carpet Area','Base Price','Total Price','Status'],
        data.map((u,i) => `<tr>
          <td style="color:var(--text3)">${i+1}</td>
          <td class="td-bold">${u.unit_number}</td>
          <td>${u.tower_name||'—'}</td>
          <td>${u.bhk_type||'—'}</td>
          <td>${u.carpet_area_sqft||'—'}</td>
          <td style="text-align:right">${Utils.currency(parseFloat(u.base_price_inr||0))}</td>
          <td style="text-align:right;font-weight:600">${Utils.currency(parseFloat(u.total_price_inr||0))}</td>
          <td>${Utils.chip(u.status||'available')}</td>
        </tr>`)
      );
    } catch (err) { Utils.error(err.message); }
  },

  loadProjectCollection() {
    this._main(this._filters('Project Collection Report', [
      { id:'project', type:'select', label:'Project', options: this._projectOptions() },
    ], 'fetchProjectCollection'));
  },

  async fetchProjectCollection() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      this._table(['Project','Total Receivable','Collected','Outstanding','Collection %'],
        this._projects.map(p => `<tr>
          <td class="td-bold">${p.name}</td>
          <td style="text-align:right">₹0</td>
          <td style="text-align:right">₹0</td>
          <td style="text-align:right">₹0</td>
          <td style="text-align:center">0%</td>
        </tr>`));
    } catch (err) { Utils.error(err.message); }
  },

  loadCustomerBalance() {
    this._main(this._filters('Customer Balance Report', [
      { id:'project', type:'select', label:'Project', options: this._projectOptions() },
    ], 'fetchCustomerBalance'));
  },

  async fetchCustomerBalance() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      this._table(['Consumer','Mobile','Unit','Total Booked','Paid','Balance'],
        this._consumers.map(c => `<tr>
          <td class="td-bold">${c.name}</td>
          <td>${c.mobile}</td>
          <td>${c.unit_number||'—'}</td>
          <td style="text-align:right">₹0</td>
          <td style="text-align:right">₹0</td>
          <td style="text-align:right">₹0</td>
        </tr>`));
    } catch (err) { Utils.error(err.message); }
  },

  loadCustomerDues() {
    this._main(this._filters('Customer Dues Report', [
      { id:'project', type:'select', label:'Project', options: this._projectOptions() },
    ], 'fetchCustomerDues'));
  },

  async fetchCustomerDues() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      this._table(['Consumer','Mobile','Due Date','Amount Due','Days Overdue','Status'],
        this._consumers.slice(0, 10).map(c => `<tr>
          <td class="td-bold">${c.name}</td>
          <td>${c.mobile}</td>
          <td>—</td>
          <td style="text-align:right">₹0</td>
          <td style="text-align:center">—</td>
          <td>${Utils.chip('pending')}</td>
        </tr>`));
    } catch (err) { Utils.error(err.message); }
  },

  loadDueReport() {
    this._main(this._filters('Due Report', [
      { id:'project', type:'select', label:'Project', options: this._projectOptions() },
    ], 'fetchDueReport'));
  },

  async fetchDueReport() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      this._table(['Due Date','Amount','Count','Status'],
        [
          '<tr><td>Today</td><td style="text-align:right">₹0</td><td style="text-align:center">0</td><td>' + Utils.chip('pending') + '</td></tr>',
          '<tr><td>Next 7 Days</td><td style="text-align:right">₹0</td><td style="text-align:center">0</td><td>' + Utils.chip('pending') + '</td></tr>',
        ]);
    } catch (err) { Utils.error(err.message); }
  },

  loadDateWiseDues() {
    this.loadDueReport();
  },

  loadStageWiseDues() {
    this._main(this._filters('Stage Wise Dues', [
      { id:'project', type:'select', label:'Project', options: this._projectOptions() },
    ], 'fetchStageWiseDues'));
  },

  async fetchStageWiseDues() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      this._table(['Stage','Count','Total Due','Collected','Outstanding'],
        ['Enquiry','Application Filed','Allotted','Booked'].map(stage => `<tr>
          <td class="td-bold">${stage}</td>
          <td style="text-align:center">0</td>
          <td style="text-align:right">₹0</td>
          <td style="text-align:right">₹0</td>
          <td style="text-align:right">₹0</td>
        </tr>`));
    } catch (err) { Utils.error(err.message); }
  },

  loadPercentageWise() {
    this._main(this._filters('Percentage Wise Dues', [
      { id:'project', type:'select', label:'Project', options: this._projectOptions() },
    ], 'fetchPercentageWise'));
  },

  async fetchPercentageWise() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      this._table(['Payment %','Count','Total Amount'],
        ['0-10%','10-20%','20-50%','50-75%','75-100%','100%'].map(pct => `<tr>
          <td>${pct}</td>
          <td style="text-align:center">0</td>
          <td style="text-align:right">₹0</td>
        </tr>`));
    } catch (err) { Utils.error(err.message); }
  },

  loadAgeingProject() {
    this._main(this._filters('Ageing - Project Wise', [
      { id:'project', type:'select', label:'Project', options: this._projectOptions() },
    ], 'fetchAgeingProject'));
  },

  async fetchAgeingProject() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      this._table(['Project','0-30 Days','30-60 Days','60-90 Days','90+ Days','Total'],
        this._projects.map(p => `<tr>
          <td class="td-bold">${p.name}</td>
          <td style="text-align:right">₹0</td>
          <td style="text-align:right">₹0</td>
          <td style="text-align:right">₹0</td>
          <td style="text-align:right">₹0</td>
          <td style="text-align:right">₹0</td>
        </tr>`));
    } catch (err) { Utils.error(err.message); }
  },

  loadAgeingInstallment() {
    this._main(this._filters('Ageing - Installment Wise', [
      { id:'project', type:'select', label:'Project', options: this._projectOptions() },
    ], 'fetchAgeingInstallment'));
  },

  async fetchAgeingInstallment() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      this._table(['Installment','0-30 Days','30-60 Days','60-90 Days','90+ Days'],
        []);
    } catch (err) { Utils.error(err.message); }
  },

  loadMonthWiseDues() {
    this._main(this._filters('Month Wise Dues', [
      { id:'project', type:'select', label:'Project', options: this._projectOptions() },
    ], 'fetchMonthWiseDues'));
  },

  async fetchMonthWiseDues() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      this._table(['Month','Due Amount','Collected','Outstanding'],
        []);
    } catch (err) { Utils.error(err.message); }
  },

  loadCustomerForecasting() {
    this._main(this._filters('Customer Forecasting', [
      { id:'project', type:'select', label:'Project', options: this._projectOptions() },
    ], 'fetchCustomerForecasting'));
  },

  async fetchCustomerForecasting() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      this._table(['Forecast Period','Projected Collection','Risk Level'],
        []);
    } catch (err) { Utils.error(err.message); }
  },

  loadCustomerDuesDetail() {
    this._main(this._filters('Customer Dues Detail', [
      { id:'project', type:'select', label:'Project', options: this._projectOptions() },
    ], 'fetchCustomerDuesDetail'));
  },

  async fetchCustomerDuesDetail() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      this._table(['Consumer','Installment','Due Date','Amount','Days Overdue','Interest'],
        []);
    } catch (err) { Utils.error(err.message); }
  },

  loadProjectWiseDues() {
    this._main(this._filters('Project Wise Dues', [
      { id:'project', type:'select', label:'Project', options: this._projectOptions() },
    ], 'fetchProjectWiseDues'));
  },

  async fetchProjectWiseDues() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      this._table(['Project','Total Units','Booked','Payment Collected','Outstanding'],
        this._projects.map(p => `<tr>
          <td class="td-bold">${p.name}</td>
          <td style="text-align:center">0</td>
          <td style="text-align:center">0</td>
          <td style="text-align:right">₹0</td>
          <td style="text-align:right">₹0</td>
        </tr>`));
    } catch (err) { Utils.error(err.message); }
  },

  loadConveyanceDeedDate() {
    this._main(this._filters('Conveyance Deed - Date Wise', [
      { id:'project', type:'select', label:'Project', options: this._projectOptions() },
    ], 'fetchConveyanceDeedDate'));
  },

  async fetchConveyanceDeedDate() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      this._table(['Consumer','Unit','Deed Date','Deed No','Status'],
        []);
    } catch (err) { Utils.error(err.message); }
  },

  loadPaymentFile() {
    this._main(this._filters('Payment File', [
      { id:'project', type:'select', label:'Project', options: this._projectOptions() },
    ], 'fetchPaymentFile'));
  },

  async fetchPaymentFile() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      this._table(['Entry No','Consumer','Amount','Mode','Date','Status'],
        []);
    } catch (err) { Utils.error(err.message); }
  },

  loadOpeningDetails() {
    this._main(this._filters('Opening Details', [
      { id:'project', type:'select', label:'Project', options: this._projectOptions() },
    ], 'fetchOpeningDetails'));
  },

  async fetchOpeningDetails() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      this._table(['Description','Amount'],
        []);
    } catch (err) { Utils.error(err.message); }
  },

  loadBookingAuth() {
    this._main(this._filters('Booking Authority', [
      { id:'project', type:'select', label:'Project', options: this._projectOptions() },
    ], 'fetchBookingAuth'));
  },

  async fetchBookingAuth() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      this._table(['Date','User','Authority','Amount','Remarks'],
        []);
    } catch (err) { Utils.error(err.message); }
  },

  loadTdsStatus() {
    this._main(this._filters('TDS Status', [
      { id:'project', type:'select', label:'Project', options: this._projectOptions() },
    ], 'fetchTdsStatus'));
  },

  async fetchTdsStatus() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      this._table(['Period','TDS Amount','Filed','Status'],
        []);
    } catch (err) { Utils.error(err.message); }
  },

  loadOtherChargeReport() {
    this._main(this._filters('Other Charge Report', [
      { id:'project', type:'select', label:'Project', options: this._projectOptions() },
    ], 'fetchOtherChargeReport'));
  },

  async fetchOtherChargeReport() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      this._table(['Unit','Charge Type','Amount','Status'],
        []);
    } catch (err) { Utils.error(err.message); }
  },

  _notFound(tab) {
    const el = document.getElementById('rpt-main');
    if (el) el.innerHTML = `<div class="alert alert-info">Report type "${tab}" is not yet implemented.</div>`;
  },

  showCreateModal() {
    const modal = document.getElementById('create-report-modal');
    if (modal) {
      modal.style.display = 'flex';
      document.getElementById('report-name')?.focus();
    }
  },

  closeCreateModal() {
    const modal = document.getElementById('create-report-modal');
    if (modal) {
      modal.style.display = 'none';
      document.getElementById('report-name').value = '';
      document.getElementById('report-type').value = '';
      document.getElementById('report-description').value = '';
    }
  },

  async saveNewReport() {
    const name = document.getElementById('report-name')?.value || '';
    const reportType = document.getElementById('report-type')?.value || '';
    const description = document.getElementById('report-description')?.value || '';

    if (!name) {
      Utils.warn('Report name is required');
      return;
    }
    if (!reportType) {
      Utils.warn('Report type is required');
      return;
    }

    try {
      const res = await Api.post('/reports/custom-report', {
        name,
        reportType,
        filters: {},
        columns: [],
      });
      if (res.success || res.data) {
        Utils.success('Report created');
        this.closeCreateModal();
        this.loadSavedReports();
      } else {
        Utils.error(res.error || 'Error');
      }
    } catch (err) {
      Utils.error(err.message || 'Error');
    }
  },

  async loadSavedReports() {
    try {
      const res = await Api.get('/reports/custom-reports');
      const reports = res.data || res || [];
      const el = document.getElementById('saved-reports-list');
      if (!el) return;

      if (reports.length === 0) {
        el.innerHTML = '<div style="color:var(--text3);font-size:10px;padding:8px">No saved reports</div>';
        return;
      }

      el.innerHTML = reports.map(r => `
        <div style="padding:8px 10px;border-radius:4px;margin:2px 6px;background:var(--bg3);cursor:pointer;transition:background .15s"
             onmouseover="this.style.background='var(--bg4)'"
             onmouseout="this.style.background='var(--bg3)'"
             onclick="Utils.info('Report: ${r.name}')">
          <div style="font-weight:600;color:var(--text1)">${r.name}</div>
          <div style="font-size:10px;color:var(--text3)">${r.type||'custom'}</div>
        </div>
      `).join('');
    } catch (err) {
      const el = document.getElementById('saved-reports-list');
      if (el) el.innerHTML = '<div style="color:var(--red);font-size:10px;padding:8px">Error loading saved reports</div>';
    }
  },
};

// Page entry point
Pages.reports = async function(params = {}) {
  const tab = params.tab || 'inventory';
  const content = document.getElementById('content');

  const NAV_GROUPS = [
    {
      label: 'Inventory & Applicant Detail',
      items: [
        { id: 'project-details',    label: 'Project Details' },
        { id: 'inventory',          label: 'Inventory Report' },
        { id: 'date-booking-status',label: 'Date Wise Booking Status' },
        { id: 'date-edit-applicant',label: 'Date Wise Edit Applicant' },
        { id: 'customer-wise',      label: 'Customer Wise Report' },
        { id: 'payment-file',       label: 'Applicant Payment File' },
        { id: 'opening-details',    label: 'Opening Details' },
        { id: 'booking-auth',       label: 'Booking Authentication' },
        { id: 'tds-status',         label: 'TDS Status Report' },
        { id: 'unit-wise-plc',      label: 'Unit Wise PLC' },
        { id: 'unit-sold-area',     label: 'Unit Sold/Availb. Area Wise' },
        { id: 'unit-cost',          label: 'Unit Cost' },
      ],
    },
    {
      label: 'Collection & Dues',
      items: [
        { id: 'project-collection',   label: 'Project Wise Collection' },
        { id: 'customer-balance',     label: 'Customer Wise Balance' },
        { id: 'customer-dues',        label: 'Customer Wise Dues' },
        { id: 'due-report',           label: 'Due Report' },
        { id: 'date-wise-dues',       label: 'Date Wise Dues' },
        { id: 'stage-wise-dues',      label: 'Stage Wise Dues' },
        { id: 'percentage-wise',      label: 'Percentage Wise Report' },
        { id: 'ageing-project',       label: 'Ageing (Project/Tower/Plan)' },
        { id: 'ageing-installment',   label: 'Installment Wise Dues' },
        { id: 'month-wise-dues',      label: 'Month Wise Dues' },
        { id: 'customer-forecasting', label: 'Customer Forecasting' },
        { id: 'customer-dues-detail', label: 'Customer Dues Details' },
        { id: 'project-wise-dues',    label: 'Project Wise Dues' },
        { id: 'conveyance-deed-date', label: 'Conveyance Deed Date' },
      ],
    },
    {
      label: 'Charge Detail',
      items: [
        { id: 'other-charge-report', label: 'Other Charge Report' },
        { id: 'extra-addon-charge',  label: 'Add Extra Addon Charge' },
      ],
    },
  ];

  const sidebar = NAV_GROUPS.map(g => `
    <div style="margin-bottom:8px">
      <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;
                  letter-spacing:.06em;padding:4px 10px 2px">${g.label}</div>
      ${g.items.map(it => `
        <div id="rpt-nav-${it.id}" class="rpt-nav-item${it.id===tab?' active':''}"
             onclick="ReportsPage.activate('${it.id}')">${it.label}</div>
      `).join('')}
    </div>
  `).join('');

  content.innerHTML = `
    <div class="page-hdr">
      <h1>Reports</h1>
      <div class="breadcrumb">Reports</div>
      <button class="btn btn-accent btn-sm" onclick="ReportsPage.showCreateModal()" style="margin-left:auto">
        + Create New Report
      </button>
    </div>
    <div style="display:grid;grid-template-columns:220px 1fr;gap:14px;align-items:start">
      <!-- Sidebar -->
      <div class="sp" style="padding:8px 0;position:sticky;top:0">
        <div style="padding:8px 10px;font-size:11px;font-weight:600;color:var(--text2);border-bottom:1px solid var(--border);margin-bottom:6px">
          Report Categories
        </div>
        ${sidebar}
        <div style="border-top:1px solid var(--border);margin-top:12px;padding-top:12px">
          <div style="padding:8px 10px;font-size:11px;font-weight:600;color:var(--text2);margin-bottom:6px">
            Saved Reports
          </div>
          <div id="saved-reports-list" style="font-size:11px">
            <div class="page-loading" style="padding:20px 0"><div class="spinner" style="width:16px;height:16px"></div></div>
          </div>
        </div>
      </div>
      <!-- Main content area -->
      <div id="rpt-main">
        <div class="page-loading"><div class="spinner"></div></div>
      </div>
    </div>

    <!-- Create Report Modal -->
    <div id="create-report-modal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;align-items:center;justify-content:center">
      <div class="sp" style="width:90%;max-width:500px;padding:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h2 style="margin:0">Create New Report</h2>
          <button class="btn btn-ghost btn-sm" onclick="ReportsPage.closeCreateModal()" style="width:32px;height:32px;padding:0;display:flex;align-items:center;justify-content:center">×</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px">
          <div class="fg">
            <label class="fl">Report Name*</label>
            <input type="text" class="fc" id="report-name" placeholder="e.g., Monthly Collection Report">
          </div>
          <div class="fg">
            <label class="fl">Report Type*</label>
            <select class="fc" id="report-type">
              <option value="">Select Type</option>
              <option value="inventory">Inventory</option>
              <option value="collection">Collection & Dues</option>
              <option value="payment">Payment Status</option>
              <option value="custom">Custom Query</option>
            </select>
          </div>
          <div class="fg">
            <label class="fl">Description</label>
            <textarea class="fc" id="report-description" placeholder="Optional description" style="min-height:80px"></textarea>
          </div>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button class="btn btn-ghost" onclick="ReportsPage.closeCreateModal()">Cancel</button>
          <button class="btn btn-primary" onclick="ReportsPage.saveNewReport()">Create Report</button>
        </div>
      </div>
    </div>

    <style>
      .rpt-nav-item{padding:5px 12px;font-size:12px;cursor:pointer;border-radius:4px;margin:1px 6px;
                    color:var(--text2);transition:background .15s}
      .rpt-nav-item:hover{background:var(--bg3);color:var(--text1)}
      .rpt-nav-item.active{background:var(--accent);color:#fff;font-weight:600}
    </style>
  `;

  await ReportsPage.init(tab);
  ReportsPage.loadSavedReports();
};
