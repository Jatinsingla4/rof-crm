// ROF CRM — Reports Page (all report tabs)

// Global ReportsPage object (must be global for onclick handlers to work)
const ReportsPage = {
  _tab: null,
  _projects: [],
  _consumers: [],
  _lastData: [],

  async init(tab, params) {
    await this._loadLookups();
    this.activate(tab, params);
  },

  activate(tab, params) {
    this._tab = tab;
    document.querySelectorAll('.rpt-nav-item').forEach(el => {
      el.classList.toggle('active', el.id === `rpt-nav-${tab}`);
    });
    const map = {
      'project-details':     () => this.loadProjectDetails(),
      'inventory':           () => this.loadInventory(),
      'date-booking-status': () => this.loadDateBookingStatus(),
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
      'inventory-details':   () => this.loadInventoryDetails(),
      'other-charge-report': () => this.loadOtherChargeReport(),
      'all-applicants':      () => this.loadAllApplicants(params),
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
      const filterPid  = this._f('project');
      const params     = filterPid ? { projectId: filterPid } : {};
      const res        = await Api.get('/reports/project-details', { params });
      const rows_data  = res.data || res || [];

      const rows = [];
      rows_data.forEach((row, i) => {
        const totalUnits  = parseInt(row.total_units)  || 0;
        const soldUnits   = parseInt(row.sold_units)   || 0;
        const unsoldUnits = parseInt(row.unsold_units) || 0;
        const salableArea = parseFloat(row.salable_area) || 0;
        const soldArea    = parseFloat(row.sold_area)    || 0;
        const balArea     = parseFloat(row.balance_area) || 0;
        const balPct      = salableArea > 0 ? (balArea / salableArea * 100).toFixed(2) : '0.00';
        const avgBsp      = Math.round(parseFloat(row.average_bsp)  || 0).toLocaleString('en-IN');
        const avgCost     = Math.round(parseFloat(row.average_cost) || 0).toLocaleString('en-IN');
        const towers      = parseInt(row.total_towers) || 0;

        rows.push(`
          <tr>
            <td>${i + 1}</td>
            <td class="td-bold" style="color:var(--accent)">${row.project_name}</td>
            <td>Residential</td>
            <td style="font-size:11px">${row.location || 'Gurugram'}</td>
            <td>${row.land_area_sqft ? Number(row.land_area_sqft).toLocaleString('en-IN') + ' sqft' : '—'}</td>
            <td>${towers}</td>
            <td class="td-bold">${totalUnits}</td>
            <td style="color:var(--green)">${soldUnits}</td>
            <td style="color:var(--red)">${unsoldUnits}</td>
            <td>${salableArea.toLocaleString('en-IN')}</td>
            <td>${soldArea.toLocaleString('en-IN')}</td>
            <td>${balArea.toLocaleString('en-IN')}</td>
            <td style="color:${parseFloat(balPct)>50?'var(--red)':'var(--text3)'}">${balPct}%</td>
            <td>₹${avgBsp}</td>
            <td>₹${avgCost}</td>
          </tr>
        `);
      });

      this._table(
        ['S.NO.', 'PROJECT', 'TYPE', 'LOCATION', 'LAND AREA', 'TOTAL TOWER', 'TOTAL UNIT', 'SOLD UNIT', 'UNSOLD UNIT', 'SALABLE AREA', 'SOLD AREA', 'BALANCE AREA', 'BALANCE AREA(%)', 'AVERAGE BSP', 'AVERAGE COST'],
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

    try {
      const res = await Api.get('/reports/inventory-full', { params: { projectId: pId || undefined } });
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
          <td>${u.consumer_id ? `<a href="/api/consumers/${u.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" style="color:var(--primary);text-decoration:underline;cursor:pointer" title="View Applicant File">${u.consumer_name||'—'}</a>` : (u.consumer_name || '—')}</td>
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
      const uniqueDates = new Set(list.map(c => (c.created_at||'').slice(0,10)));
      this._kpis([
        { label:'Total Bookings',     value: list.length },
        { label:'Days With Bookings', value: uniqueDates.size },
        { label:'Avg Per Day',        value: uniqueDates.size ? (list.length / uniqueDates.size).toFixed(1) : 0 },
      ]);
      const rows = list
        .sort((a, b) => (b.created_at||'').localeCompare(a.created_at||''))
        .map(c => {
          const d = new Date(c.created_at || '');
          const formatted = isNaN(d) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
          const name = c.name || ((c.first_name||'') + ' ' + (c.last_name||'')).trim() || '—';
          return `<tr>
            <td style="font-weight:600">${formatted}</td>
            <td>${name}</td>
            <td>${c.mobile||'—'}</td>
            <td>${Utils.chip(c.lead_stage||'enquiry')}</td>
            <td><button class="btn btn-ghost btn-sm" onclick="Router.navigate('/consumer',{id:'${c.id}'})">View</button></td>
          </tr>`;
        });
      this._table(['Date','Consumer','Mobile','Stage','Action'], rows,
        `<td><strong>TOTAL</strong></td><td colspan="3"><strong>${list.length} records</strong></td><td></td>`);
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
    const bhk = this._f('bhk');

    try {
      const res = await Api.get('/reports/unit-wise-plc', { params: {
        projectId: pId || undefined,
        bhk:       bhk || undefined,
      }});
      const data = res.data || res || [];
      this._lastData = data;

      if (!data || data.length === 0) {
        this._table(['#','Project','Tower','Unit No','BHK','PLC Amount','Status'], []);
        return;
      }

      const totalPLC = data.reduce((s,u) => s + parseFloat(u.plc_amount||0), 0);
      this._kpis([
        { label:'Total Units', value: data.length },
        { label:'Total PLC', value: Utils.currency(totalPLC), color:'var(--accent)' },
      ]);

      this._table(
        ['#','Project','Tower','Unit No','BHK','PLC Amount','Status'],
        data.map((u,i) => `<tr>
          <td style="color:var(--text3)">${i+1}</td>
          <td>${u.project_name||'—'}</td>
          <td>${u.tower_name||'—'}</td>
          <td class="td-bold">${u.unit_number}</td>
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

    try {
      const res = await Api.get('/reports/unit-sold-area', { params: { projectId: pId || undefined } });
      const data = res.data || res || [];
      this._lastData = data;

      if (!data || data.length === 0) {
        this._table(['Area Range (sqft)', 'Available', 'Sold/Booked', 'Total', 'Sold %'], []);
        return;
      }

      const totalAvail = data.reduce((s, r) => s + parseInt(r.available_count || 0), 0);
      const totalSold  = data.reduce((s, r) => s + parseInt(r.sold_count     || 0), 0);
      const totalUnits = data.reduce((s, r) => s + parseInt(r.total_count    || 0), 0);
      this._kpis([
        { label:'Available Units', value: totalAvail,  color:'var(--green)'  },
        { label:'Sold/Booked',     value: totalSold,   color:'var(--accent)' },
        { label:'Total Units',     value: totalUnits                         },
        { label:'Sold %', value: totalUnits ? ((totalSold / totalUnits) * 100).toFixed(1) + '%' : '0%', color:'var(--blue)' },
      ]);

      this._table(
        ['Area Range (sqft)', 'Available', 'Sold/Booked', 'Total', 'Sold %'],
        data.map(r => {
          const avail = parseInt(r.available_count || 0);
          const sold  = parseInt(r.sold_count      || 0);
          const total = parseInt(r.total_count     || 0);
          const pct   = parseFloat(r.sold_pct      || 0).toFixed(1);
          const barW  = Math.min(100, parseFloat(r.sold_pct || 0));
          return `<tr>
            <td class="td-bold">${r.area_range || '—'}</td>
            <td style="text-align:center;color:var(--green);font-weight:600">${avail}</td>
            <td style="text-align:center;color:var(--accent);font-weight:600">${sold}</td>
            <td style="text-align:center;font-weight:600">${total}</td>
            <td style="min-width:120px">
              <div style="display:flex;align-items:center;gap:6px">
                <div style="flex:1;background:var(--bg3);border-radius:3px;height:6px;overflow:hidden">
                  <div style="background:var(--accent);width:${barW}%;height:100%;border-radius:3px"></div>
                </div>
                <span style="font-size:11px;font-weight:600;min-width:32px">${pct}%</span>
              </div>
            </td>
          </tr>`;
        }),
        `<td><strong>TOTAL</strong></td>
         <td style="text-align:center;font-weight:600;color:var(--green)">${totalAvail}</td>
         <td style="text-align:center;font-weight:600;color:var(--accent)">${totalSold}</td>
         <td style="text-align:center;font-weight:600">${totalUnits}</td>
         <td style="font-weight:600">${totalUnits ? ((totalSold / totalUnits) * 100).toFixed(1) : 0}%</td>`
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

    try {
      const res = await Api.get('/reports/unit-cost', { params: { projectId: pId || undefined } });
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

  _idGroupBy: 'project',
  _idView:    'summary',

  _setIdGroupBy(gb) {
    this._idGroupBy = gb;
    ['project','tower','bhk_type','matrix'].forEach(g => {
      const b = document.getElementById('id-gb-' + g);
      if (b) b.classList.toggle('btn-primary', g === gb);
      if (b) b.classList.toggle('btn-ghost',   g !== gb);
    });
    const viewWrap = document.getElementById('id-view-wrap');
    if (viewWrap) viewWrap.style.display = gb === 'matrix' ? 'none' : '';
  },

  _setIdView(v) {
    this._idView = v;
    ['summary','details'].forEach(vv => {
      const b = document.getElementById('id-view-' + vv);
      if (b) b.classList.toggle('btn-primary', vv === v);
      if (b) b.classList.toggle('btn-ghost',   vv !== v);
    });
  },

  loadInventoryDetails() {
    this._idGroupBy = 'project';
    this._idView    = 'summary';
    this._main(`
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Inventory Details Report</div></div>
        <div class="sp-body">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
            <div class="fg" style="flex:1;min-width:160px">
              <label class="fl">Project</label>
              <select class="fc" id="f-project">${this._projectOptions()}</select>
            </div>
            <div class="fg" style="min-width:280px">
              <label class="fl">Group By</label>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                <button id="id-gb-project"  class="btn btn-primary btn-sm" onclick="ReportsPage._setIdGroupBy('project')">Project</button>
                <button id="id-gb-tower"    class="btn btn-ghost  btn-sm" onclick="ReportsPage._setIdGroupBy('tower')">Tower</button>
                <button id="id-gb-bhk_type" class="btn btn-ghost  btn-sm" onclick="ReportsPage._setIdGroupBy('bhk_type')">Unit Type</button>
                <button id="id-gb-matrix"   class="btn btn-ghost  btn-sm" onclick="ReportsPage._setIdGroupBy('matrix')">Tower vs Unit Type</button>
              </div>
            </div>
            <div class="fg" id="id-view-wrap" style="min-width:160px">
              <label class="fl">View</label>
              <div style="display:flex;gap:6px">
                <button id="id-view-summary" class="btn btn-primary btn-sm" onclick="ReportsPage._setIdView('summary')">Summary</button>
                <button id="id-view-details" class="btn btn-ghost  btn-sm" onclick="ReportsPage._setIdView('details')">Details</button>
              </div>
            </div>
          </div>
          <div style="margin-top:12px;display:flex;gap:10px">
            <button class="btn btn-primary" onclick="ReportsPage.fetchInventoryDetails()">FETCH</button>
            <button class="btn btn-ghost"   onclick="ReportsPage.exportCsv('Inventory_Details.csv')">Export CSV</button>
          </div>
        </div>
      </div>
      <div id="rpt-kpis" style="display:grid;gap:12px;margin-bottom:12px"></div>
      <div id="rpt-result"><div class="empty-state"><h3>Apply filters and click FETCH</h3></div></div>
    `);
  },

  async fetchInventoryDetails() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    const pId = document.getElementById('f-project')?.value || '';
    const groupBy = this._idGroupBy;
    const view = this._idView;

    const n = v => parseInt(v || 0);
    const f = v => parseFloat(v || 0);
    const pct = (part, total) => total ? ((part / total) * 100).toFixed(1) : '0.0';

    try {
      const res = await Api.get('/reports/inventory-details', {
        params: { projectId: pId || undefined, groupBy, view },
      });
      const data = res.data || [];
      this._lastData = data;

      const totalUnits = data.reduce((s, r) => s + n(r.total_units), 0);
      const totalSold  = data.reduce((s, r) => s + n(r.sold_units), 0);
      const totalUnsold = data.reduce((s, r) => s + n(r.unsold_units), 0);
      this._kpis([
        { label: 'Total Units',  value: totalUnits },
        { label: 'Sold Units',   value: totalSold,   color: 'var(--accent)' },
        { label: 'Unsold Units', value: totalUnsold, color: 'var(--green)'  },
        { label: 'Sold %', value: pct(totalSold, totalUnits) + '%', color: 'var(--blue)' },
      ]);

      if (groupBy === 'matrix') {
        this._renderInventoryMatrix(data);
        return;
      }

      const showNonSalable = groupBy === 'project' || groupBy === 'tower';
      const cols = ['#', 'Name'];
      if (showNonSalable) cols.push('Non-Salable (Unit/Area)', 'Salable (Unit/Area)');
      cols.push('Total (Unit/Area)', 'Sold (Unit/Area)', 'Sold %');
      if (view === 'details') cols.push('Booked', 'Allotted', 'Hold', 'Temp Surrender');
      cols.push('Unsold (Unit/Area)', 'Unsold %', 'Avg Rate (₹/sqft)');

      const ua = (u, a) => `${u} / ${f(a).toFixed(1)}`;

      const rows = data.map((r, i) => {
        const label = groupBy === 'tower' && r.project_name ? `${r.group_name} <span style="color:var(--text3);font-size:11px">(${r.project_name})</span>` : (r.group_name || '—');
        let cells = `<td style="color:var(--text3)">${i + 1}</td><td class="td-bold">${label}</td>`;
        if (showNonSalable) {
          cells += `<td style="text-align:center">${ua(0, 0)}</td>`;
          cells += `<td style="text-align:center">${ua(n(r.total_units), r.total_area)}</td>`;
        }
        cells += `<td style="text-align:center;font-weight:600">${ua(n(r.total_units), r.total_area)}</td>`;
        cells += `<td style="text-align:center;color:var(--accent);font-weight:600">${ua(n(r.sold_units), r.sold_area)}</td>`;
        cells += `<td style="text-align:center">${pct(n(r.sold_units), n(r.total_units))}%</td>`;
        if (view === 'details') {
          cells += `<td style="text-align:center">${ua(n(r.booked_units), r.booked_area)}</td>`;
          cells += `<td style="text-align:center">${ua(n(r.allotted_units), r.allotted_area)}</td>`;
          cells += `<td style="text-align:center">${ua(n(r.hold_units), r.hold_area)}</td>`;
          cells += `<td style="text-align:center">${ua(n(r.temp_surrender_units), r.temp_surrender_area)}</td>`;
        }
        cells += `<td style="text-align:center;color:var(--green);font-weight:600">${ua(n(r.unsold_units), r.unsold_area)}</td>`;
        cells += `<td style="text-align:center">${pct(n(r.unsold_units), n(r.total_units))}%</td>`;
        cells += `<td style="text-align:right">${r.avg_rate ? f(r.avg_rate).toFixed(2) : '—'}</td>`;
        return `<tr>${cells}</tr>`;
      });

      this._table(cols, rows);
    } catch (err) { Utils.error(err.message); }
  },

  _renderInventoryMatrix(data) {
    const el = document.getElementById('rpt-result');
    if (!el) return;
    const n = v => parseInt(v || 0);

    const towerOrder = [];
    const towerSeen = new Set();
    const bhkOrder = [];
    const bhkSeen = new Set();
    const cellMap = {};

    data.forEach(r => {
      if (!r.bhk_type) return;
      if (!towerSeen.has(r.tower_name)) { towerSeen.add(r.tower_name); towerOrder.push(r.tower_name); }
      if (!bhkSeen.has(r.bhk_type)) { bhkSeen.add(r.bhk_type); bhkOrder.push(r.bhk_type); }
      cellMap[`${r.tower_name}||${r.bhk_type}`] = r;
    });

    if (towerOrder.length === 0 || bhkOrder.length === 0) {
      el.innerHTML = '<div class="empty-state"><h3>No records found</h3></div>';
      return;
    }

    const thS = 'background:var(--accent,#1a56db);color:#fff;text-align:center;padding:7px 10px;white-space:nowrap;font-size:11px;font-weight:700;border:1px solid rgba(255,255,255,.2)';
    const tdS = 'text-align:center;padding:6px 10px;border:1px solid var(--border,#e5e7eb);font-size:12px;white-space:nowrap';

    const headHtml = `<th style="${thS}">Tower</th>` + bhkOrder.map(b => `<th style="${thS}">${b}</th>`).join('');
    const bodyHtml = towerOrder.map(tw => {
      const cells = bhkOrder.map(b => {
        const r = cellMap[`${tw}||${b}`];
        if (!r) return `<td style="${tdS};color:var(--text3)">—</td>`;
        return `<td style="${tdS}">T:${n(r.total_units)} · S:${n(r.sold_units)} · U:${n(r.unsold_units)}</td>`;
      }).join('');
      return `<tr><td style="${tdS};font-weight:600;text-align:left">${tw}</td>${cells}</tr>`;
    }).join('');

    el.innerHTML = `
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>${headHtml}</tr></thead>
          <tbody>${bodyHtml}</tbody>
        </table>
      </div>
    `;
  },

  loadAllApplicants(params) {
    this._main(this._filters('All Applicants Report', [
      { id:'project',        type:'select', label:'Project',        options: this._projectOptions() },
      { id:'bhkType',        type:'text',   label:'Unit Type' },
      { id:'towerName',      type:'text',   label:'Tower' },
      { id:'registrationNo', type:'text',   label:'Registration No.' },
      { id:'firstName',      type:'text',   label:'First Name' },
      { id:'unitNumber',     type:'text',   label:'Unit Number' },
    ], 'fetchAllApplicants'));
    if (params && params.projectId) {
      const sel = document.getElementById('f-project');
      if (sel) sel.value = params.projectId;
      this.fetchAllApplicants();
    }
  },

  async fetchAllApplicants() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const params = {
        projectId:      this._f('project')        || undefined,
        bhkType:        this._f('bhkType')        || undefined,
        towerName:      this._f('towerName')      || undefined,
        registrationNo: this._f('registrationNo') || undefined,
        firstName:      this._f('firstName')      || undefined,
        unitNumber:     this._f('unitNumber')     || undefined,
      };
      const res  = await Api.get('/reports/all-applicants', { params });
      const data = res.data || [];
      this._lastData = data;

      const maxCoApplicants = data.reduce((m, r) => Math.max(m, (r.co_applicants || []).length), 0);

      const cols = ['S.No', 'Registration No', 'Unit Address', 'Unit Type', 'Project', '1st Applicant'];
      for (let i = 0; i < maxCoApplicants; i++) {
        const n = i + 2;
        const suffix = n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
        cols.push(`${n}${suffix} Applicant`);
      }

      const cell = (p) => {
        if (!p) return '—';
        return `
          <div>${p.salutation ? p.salutation + ' ' : ''}${p.name || '—'}</div>
          <div style="color:var(--text3);font-size:11px">S/o ${p.father_name || '—'}</div>
          <div style="color:var(--text3);font-size:11px">${p.address || '—'}</div>
          <div style="font-size:11px">PAN: ${p.pan_no || '—'}</div>
          <div style="font-size:11px">${p.email || '—'} · ${p.mobile || '—'}</div>
          <div style="font-size:11px">Aadhaar: ${p.aadhaar_no || '—'}</div>
        `;
      };

      const rows = data.map((r, i) => {
        const primary = {
          name: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
          salutation: r.salutation,
          father_name: r.father_name,
          address: r.present_address,
          pan_no: r.pan_no,
          email: r.email,
          mobile: r.mobile,
          aadhaar_no: r.aadhaar_no,
        };
        let cells = `<td>${i + 1}</td><td>${r.registration_no || '—'}</td><td>${r.unit_number || '—'}</td><td>${r.bhk_type || '—'}</td><td>${r.project_name || '—'}</td><td>${cell(primary)}</td>`;
        const coApplicants = r.co_applicants || [];
        for (let j = 0; j < maxCoApplicants; j++) {
          cells += `<td>${cell(coApplicants[j])}</td>`;
        }
        return `<tr>${cells}</tr>`;
      });

      const rowsWithBands = [];
      let lastProject = null;
      data.forEach((r, i) => {
        if (r.project_name !== lastProject) {
          rowsWithBands.push(`<tr><td colspan="${cols.length}" style="font-weight:700;background:var(--bg2)">PROJECT: ${r.project_name || '—'}</td></tr>`);
          lastProject = r.project_name;
        }
        rowsWithBands.push(rows[i]);
      });

      this._table(cols, rowsWithBands);
    } catch (err) {
      const el = document.getElementById('rpt-result');
      if (el) el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`;
    }
  },

  _pwcDateType: 'receipt',
  _pwcGroupBy:  'project',

  _setPwcDateType(type) {
    this._pwcDateType = type;
    ['receipt','posting','deposit'].forEach(t => {
      const b = document.getElementById('pwc-dt-' + t);
      if (b) b.classList.toggle('btn-primary', t === type);
      if (b) b.classList.toggle('btn-ghost',   t !== type);
    });
  },

  _setPwcGroupBy(gb) {
    this._pwcGroupBy = gb;
    ['project','company'].forEach(g => {
      const b = document.getElementById('pwc-gb-' + g);
      if (b) b.classList.toggle('btn-primary', g === gb);
      if (b) b.classList.toggle('btn-ghost',   g !== gb);
    });
  },

  loadProjectCollection() {
    this._pwcDateType = 'receipt';
    this._pwcGroupBy  = 'project';
    this._main(`
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Project Wise Collection Report</div></div>
        <div class="sp-body">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
            <div class="fg" style="flex:1;min-width:160px">
              <label class="fl">Project</label>
              <select class="fc" id="f-project">${this._projectOptions()}</select>
            </div>
            <div class="fg" style="min-width:130px">
              <label class="fl">From Date</label>
              <input type="date" class="fc" id="f-from" value="${Utils.monthStart ? Utils.monthStart() : ''}">
            </div>
            <div class="fg" style="min-width:130px">
              <label class="fl">To Date</label>
              <input type="date" class="fc" id="f-to" value="${Utils.today ? Utils.today() : ''}">
            </div>
            <div class="fg" style="min-width:220px">
              <label class="fl">Date Type</label>
              <div style="display:flex;gap:6px">
                <button id="pwc-dt-receipt"  class="btn btn-primary btn-sm" onclick="ReportsPage._setPwcDateType('receipt')">Receipt</button>
                <button id="pwc-dt-posting"  class="btn btn-ghost  btn-sm" onclick="ReportsPage._setPwcDateType('posting')">Posting</button>
                <button id="pwc-dt-deposit"  class="btn btn-ghost  btn-sm" onclick="ReportsPage._setPwcDateType('deposit')">Deposit</button>
              </div>
            </div>
            <div class="fg" style="min-width:180px">
              <label class="fl">Group By</label>
              <div style="display:flex;gap:6px">
                <button id="pwc-gb-project" class="btn btn-primary btn-sm" onclick="ReportsPage._setPwcGroupBy('project')">Project</button>
                <button id="pwc-gb-company" class="btn btn-ghost  btn-sm" onclick="ReportsPage._setPwcGroupBy('company')">Company</button>
              </div>
            </div>
          </div>
          <div style="margin-top:12px;display:flex;gap:10px">
            <button class="btn btn-primary" onclick="ReportsPage.fetchProjectCollection()">FETCH</button>
            <button class="btn btn-ghost"   onclick="ReportsPage.exportCsv('Project_Collection.csv')">Export CSV</button>
          </div>
        </div>
      </div>
      <div id="rpt-kpis" style="display:grid;gap:12px;margin-bottom:12px"></div>
      <div id="rpt-result"><div class="empty-state"><h3>Apply filters and click FETCH</h3></div></div>
    `);
  },

  async fetchProjectCollection() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const projectId = document.getElementById('f-project')?.value || '';
      const fromDate  = document.getElementById('f-from')?.value   || '';
      const toDate    = document.getElementById('f-to')?.value     || '';
      const params = {};
      if (projectId) params.projectId = projectId;
      if (fromDate)  params.fromDate  = fromDate;
      if (toDate)    params.toDate    = toDate;

      const res  = await Api.get('/reports/project-collection', { params });
      const rows = res.data    || [];
      const tot  = res.totals  || {};
      const co   = res.companyName || 'Company';

      const fmtA = v => '₹' + parseFloat(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
      const fmtN = v => parseInt(v || 0).toLocaleString('en-IN');

      this._lastData = rows.map(r => ({
        Project:          r.project_name,
        Cheque:           parseFloat(r.cheque_amount  || 0),
        Draft:            parseFloat(r.draft_amount   || 0),
        Online:           parseFloat(r.online_amount  || 0),
        'Total Amount':   parseFloat(r.total_amount   || 0),
        Normal:           parseInt(r.normal_count     || 0),
        Cancel:           parseInt(r.cancel_count     || 0),
        Bounce:           parseInt(r.bounce_count     || 0),
        'Total Receipts': parseInt(r.normal_count||0) + parseInt(r.cancel_count||0) + parseInt(r.bounce_count||0),
        'Refund CR':      0,
        'Refund DR':      0,
        'Total Collection': parseFloat(r.total_collection || 0),
      }));

      const amtStyle  = 'text-align:right;color:#1a56db';
      const cntStyle  = 'text-align:center';
      const boldStyle = 'font-weight:600';

      const buildRow = (sr, name, r, style) => {
        const totalR = parseInt(r.normal_count||0) + parseInt(r.cancel_count||0) + parseInt(r.bounce_count||0);
        return `<tr style="${style||''}">
          <td style="${cntStyle}">${sr}</td>
          <td style="${boldStyle}">${name}</td>
          <td style="${amtStyle}">${fmtA(r.cheque_amount)}</td>
          <td style="${amtStyle}">${fmtA(r.draft_amount)}</td>
          <td style="${amtStyle}">${fmtA(r.online_amount)}</td>
          <td style="${amtStyle}">${fmtA(r.total_amount)}</td>
          <td style="${cntStyle}">${fmtN(r.normal_count)}</td>
          <td style="${cntStyle}">${fmtN(r.cancel_count)}</td>
          <td style="${cntStyle}">${fmtN(r.bounce_count)}</td>
          <td style="${cntStyle}">${fmtN(totalR)}</td>
          <td style="${amtStyle}">₹0</td>
          <td style="${amtStyle}">₹0</td>
          <td style="${amtStyle}">${fmtA(r.total_collection)}</td>
        </tr>`;
      };

      let bodyHtml = '';
      if (this._pwcGroupBy === 'company') {
        bodyHtml = buildRow(1, co, tot, '');
      } else {
        if (rows.length === 0) {
          bodyHtml = `<tr><td colspan="13" style="text-align:center;padding:24px;color:var(--text-muted)">No records found</td></tr>`;
        } else {
          bodyHtml = rows.map((r, i) => buildRow(i + 1, r.project_name, r, i % 2 === 1 ? 'background:var(--bg-row-alt,rgba(0,0,0,.03))' : '')).join('');
        }
      }

      const totalR = parseInt(tot.normal_count||0) + parseInt(tot.cancel_count||0) + parseInt(tot.bounce_count||0);
      const footHtml = `<tr style="background:#fef3cd;font-weight:700">
        <td></td>
        <td>TOTAL</td>
        <td style="${amtStyle}">${fmtA(tot.cheque_amount)}</td>
        <td style="${amtStyle}">${fmtA(tot.draft_amount)}</td>
        <td style="${amtStyle}">${fmtA(tot.online_amount)}</td>
        <td style="${amtStyle}">${fmtA(tot.total_amount)}</td>
        <td style="${cntStyle}">${fmtN(tot.normal_count)}</td>
        <td style="${cntStyle}">${fmtN(tot.cancel_count)}</td>
        <td style="${cntStyle}">${fmtN(tot.bounce_count)}</td>
        <td style="${cntStyle}">${fmtN(totalR)}</td>
        <td style="${amtStyle}">₹0</td>
        <td style="${amtStyle}">₹0</td>
        <td style="${amtStyle}">${fmtA(tot.total_collection)}</td>
      </tr>`;

      const thS = 'background:var(--accent,#1a56db);color:#fff;text-align:center;padding:7px 10px;white-space:nowrap;font-size:11px;font-weight:700;border:1px solid rgba(255,255,255,.2)';
      if (el) el.innerHTML = `
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead>
              <tr>
                <th rowspan="2" style="${thS}">SR.NO</th>
                <th rowspan="2" style="${thS}">PROJECT</th>
                <th colspan="4" style="${thS}">HEAD</th>
                <th colspan="4" style="${thS}">NO OF RECEIPT</th>
                <th colspan="2" style="${thS}">REFUND</th>
                <th rowspan="2" style="${thS}">TOTAL COLLECTION</th>
              </tr>
              <tr>
                <th style="${thS}">CHEQUE</th>
                <th style="${thS}">DRAFT</th>
                <th style="${thS}">ONLINE</th>
                <th style="${thS}">TOTAL AMOUNT</th>
                <th style="${thS}">NORMAL</th>
                <th style="${thS}">CANCEL</th>
                <th style="${thS}">BOUNCE</th>
                <th style="${thS}">TOTAL RECEIPT</th>
                <th style="${thS}">CR</th>
                <th style="${thS}">DR</th>
              </tr>
            </thead>
            <tbody>${bodyHtml}</tbody>
            <tfoot>${footHtml}</tfoot>
          </table>
        </div>
      `;
    } catch (err) { Utils.error(err.message); }
  },

  loadCustomerBalance() {
    this._main(`
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Customer Balance Report</div></div>
        <div class="sp-body">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:10px">
            <div class="fg" style="flex:1;min-width:150px">
              <label class="fl">Project</label>
              <select class="fc" id="f-project" onchange="ReportsPage._cbLoadTowers()">${this._projectOptions()}</select>
            </div>
            <div class="fg" style="flex:1;min-width:140px">
              <label class="fl">Tower</label>
              <select class="fc" id="f-tower"><option value="">All Towers</option></select>
            </div>
            <div class="fg" style="min-width:150px">
              <label class="fl">Balance Type</label>
              <select class="fc" id="f-balancetype">
                <option value="all">All</option>
                <option value="outstanding">Outstanding Only</option>
                <option value="overpaid">Overpaid</option>
              </select>
            </div>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
            <div class="fg" style="min-width:150px">
              <label class="fl">Registration No.</label>
              <input type="text" class="fc" id="f-regno" placeholder="Search reg no...">
            </div>
            <div class="fg" style="min-width:150px">
              <label class="fl">Name</label>
              <input type="text" class="fc" id="f-name" placeholder="Search name...">
            </div>
            <div style="display:flex;gap:8px;margin-bottom:2px">
              <button class="btn btn-primary" onclick="ReportsPage.fetchCustomerBalance()">FETCH</button>
              <button class="btn btn-ghost" onclick="ReportsPage.exportCsv('Customer_Balance.csv')">Export CSV</button>
            </div>
          </div>
        </div>
      </div>
      <div id="rpt-kpis" style="display:grid;gap:12px;margin-bottom:12px"></div>
      <div id="rpt-result"><div class="empty-state"><h3>Apply filters and click FETCH</h3></div></div>
    `);
  },

  async _cbLoadTowers() {
    const pid = document.getElementById('f-project')?.value;
    const sel = document.getElementById('f-tower');
    if (!sel) return;
    sel.innerHTML = '<option value="">All Towers</option>';
    if (!pid) return;
    try {
      const res = await Api.get('/units/towers', { params: { projectId: pid } });
      const towers = res.data || res || [];
      towers.forEach(t => {
        const o = document.createElement('option');
        o.value = t.id; o.textContent = t.tower_name;
        sel.appendChild(o);
      });
    } catch (_) {}
  },

  async fetchCustomerBalance() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const params = {};
      const pid  = document.getElementById('f-project')?.value;
      const tid  = document.getElementById('f-tower')?.value;
      const bt   = document.getElementById('f-balancetype')?.value;
      const reg  = document.getElementById('f-regno')?.value?.trim();
      const nm   = document.getElementById('f-name')?.value?.trim();
      if (pid)  params.projectId      = pid;
      if (tid)  params.towerId        = tid;
      if (bt && bt !== 'all') params.balanceType = bt;
      if (reg)  params.registrationNo = reg;
      if (nm)   params.name           = nm;

      const res  = await Api.get('/reports/customer-balance', { params });
      const body = res;
      const rows = body.data    || [];
      const summ = body.summary || {};

      this._lastData = rows.map(r => ({
        'Reg No':              r.registration_no || '',
        'Name':                r.consumer_name,
        'Mobile':              r.mobile || '',
        'Project':             r.project_name,
        'Tower':               r.tower_name || '',
        'Floor':               r.floor || '',
        'Unit No':             r.unit_number,
        'Unit Type':           r.bhk_type || '',
        'Booking Date':        r.booking_date ? String(r.booking_date).slice(0,10) : '',
        'Plan':                r.plan_name || '',
        'Broker':              r.broker_name || 'Direct',
        'Unit Cost':           parseFloat(r.unit_cost        || 0),
        'Total GST':           parseFloat(r.total_gst        || 0),
        'Total Cost':          parseFloat(r.total_cost       || 0),
        'Total Demanded':      parseFloat(r.total_demanded   || 0),
        'Total Received':      parseFloat(r.total_received   || 0),
        'Received %':          parseFloat(r.received_pct     || 0),
        'Last Payment Date':   r.last_payment_date ? String(r.last_payment_date).slice(0,10) : '',
        'Last Payment Amount': parseFloat(r.last_payment_amount || 0),
        'Balance':             parseFloat(r.balance          || 0),
        'Receipts':            parseInt(r.receipt_count      || 0),
      }));

      const fmtA = v => '₹' + parseFloat(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
      const fmtN = v => parseFloat(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
      const aR   = 'text-align:right';
      const aC   = 'text-align:center';

      // KPI bar
      this._kpis([
        { label: 'TOTAL CONSUMERS',  value: parseInt(summ.totalConsumers || 0).toLocaleString('en-IN'), color: 'var(--accent)' },
        { label: 'TOTAL UNIT COST',  value: fmtA(summ.totalUnitCost),  color: 'var(--accent)' },
        { label: 'TOTAL RECEIVED',   value: fmtA(summ.totalReceived),  color: '#198754' },
        { label: 'TOTAL BALANCE',    value: fmtA(summ.totalBalance),   color: parseFloat(summ.totalBalance||0) > 0 ? '#dc3545' : '#198754' },
      ]);
      const kpiEl = document.getElementById('rpt-kpis');
      if (kpiEl) kpiEl.style.gridTemplateColumns = 'repeat(4,1fr)';

      if (!rows || rows.length === 0) {
        if (el) el.innerHTML = '<div class="empty-state"><h3>No records found</h3><p>Adjust filters and try again</p></div>';
        return;
      }

      // Footer totals
      let tCost=0, tDem=0, tRec=0, tBal=0;
      rows.forEach(r => {
        tCost += parseFloat(r.unit_cost       || 0);
        tDem  += parseFloat(r.total_demanded  || 0);
        tRec  += parseFloat(r.total_received  || 0);
        tBal  += parseFloat(r.balance         || 0);
      });

      const balColor = b => {
        const v = parseFloat(b || 0);
        if (v > 0) return '#dc3545';
        if (v < 0) return '#0d6efd';
        return '#198754';
      };

      const bodyRows = rows.map((r, i) => {
        const bal  = parseFloat(r.balance     || 0);
        const pct  = parseFloat(r.received_pct|| 0);
        const bStyle = `${aR};font-weight:600;color:${balColor(bal)}`;
        const pStyle = pct >= 100 ? `${aR};color:#198754;font-weight:600` : aR;
        const pctDisp = pct >= 100 ? `${fmtN(pct)}% ✓` : `${fmtN(pct)}%`;
        const nameLink = r.consumer_id
          ? `<a href="/api/consumers/${r.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" style="color:var(--primary);text-decoration:underline;font-weight:600;cursor:pointer" title="View Applicant File">${r.consumer_name}</a>`
          : `<span style="font-weight:600">${r.consumer_name}</span>`;
        return `<tr>
          <td style="${aC}">${i+1}</td>
          <td>${r.registration_no || '—'}</td>
          <td>${nameLink}</td>
          <td>${r.project_name}</td>
          <td>${r.tower_name || '—'}</td>
          <td style="${aC}">${r.floor || '—'}</td>
          <td>${r.unit_number}</td>
          <td>${r.bhk_type || '—'}</td>
          <td style="${aC}">${r.booking_date ? String(r.booking_date).slice(0,10) : '—'}</td>
          <td>${r.plan_name || '—'}</td>
          <td>${r.broker_name || 'Direct'}</td>
          <td style="${aR}">${fmtA(r.unit_cost)}</td>
          <td style="${aR}">${fmtA(r.total_gst)}</td>
          <td style="${aR}">${fmtA(r.total_cost)}</td>
          <td style="${aR}">${fmtA(r.total_demanded)}</td>
          <td style="${aR};color:#198754">${fmtA(r.total_received)}</td>
          <td style="${pStyle}">${pctDisp}</td>
          <td style="${aC}">${r.last_payment_date ? String(r.last_payment_date).slice(0,10) : '—'}</td>
          <td style="${aR}">${r.last_payment_amount ? fmtA(r.last_payment_amount) : '—'}</td>
          <td style="${bStyle}">${fmtA(bal)}</td>
          <td style="${aC}">${r.receipt_count || 0}</td>
        </tr>`;
      });

      const footRow = `
        <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="font-weight:700">TOTAL</td>
        <td style="${aR};font-weight:700">${fmtA(tCost)}</td>
        <td></td><td></td>
        <td style="${aR};font-weight:700">${fmtA(tDem)}</td>
        <td style="${aR};font-weight:700;color:#198754">${fmtA(tRec)}</td>
        <td></td><td></td><td></td>
        <td style="${aR};font-weight:700;color:${balColor(tBal)}">${fmtA(tBal)}</td>
        <td></td>
      `;

      const cols = ['S.NO.','REG. NO.','NAME','PROJECT','TOWER','FLOOR','UNIT NO.','UNIT TYPE',
        'BOOKING DATE','PLAN','BROKER','UNIT COST','TOTAL GST','TOTAL COST','TOTAL DEMANDED',
        'TOTAL RECEIVED','RECEIVED (%)','LAST PAYMENT DATE','LAST PAYMENT AMOUNT','BALANCE','RECEIPTS'];

      this._table(cols, bodyRows, footRow);
      const tableEl = document.getElementById('rpt-result');
      if (tableEl) tableEl.innerHTML = `<div class="cb-wrap">${tableEl.innerHTML}</div>`;
    } catch (err) { Utils.error(err.message); }
  },

  _cwdWithTax: false,

  _cwdSetTax(v) {
    this._cwdWithTax = v;
    const btnNo  = document.getElementById('cwd-tax-no');
    const btnYes = document.getElementById('cwd-tax-yes');
    if (btnNo)  { btnNo.classList.toggle('btn-primary', !v); btnNo.classList.toggle('btn-ghost', v); }
    if (btnYes) { btnYes.classList.toggle('btn-primary', v); btnYes.classList.toggle('btn-ghost', !v); }
  },

  loadCustomerDues() {
    this._cwdWithTax = false;
    this._main(`
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr" style="display:flex;justify-content:space-between;align-items:center">
          <div class="sp-title">Customer Wise Dues</div>
          <div style="display:flex;gap:6px">
            <button id="cwd-tax-no"  class="btn btn-primary btn-sm" onclick="ReportsPage._cwdSetTax(false)">Without Tax</button>
            <button id="cwd-tax-yes" class="btn btn-ghost   btn-sm" onclick="ReportsPage._cwdSetTax(true)">With Tax</button>
          </div>
        </div>
        <div class="sp-body">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:8px">
            <div class="fg" style="flex:1;min-width:140px">
              <label class="fl">*Project</label>
              <select class="fc" id="f-project" onchange="ReportsPage._cwdLoadTowers()">${this._projectOptions()}</select>
            </div>
            <div class="fg" style="flex:1;min-width:120px">
              <label class="fl">Tower</label>
              <select class="fc" id="f-tower"><option value="">&#60;--All--&#62;</option></select>
            </div>
            <div class="fg" style="min-width:110px">
              <label class="fl">Unit Type</label>
              <select class="fc" id="f-bhk">
                <option value="">&#60;--All--&#62;</option>
                <option>1BHK</option><option>2BHK</option><option>Studio</option>
              </select>
            </div>
            <div class="fg" style="min-width:110px">
              <label class="fl">Payment Plan</label>
              <select class="fc" id="f-plan"><option value="">&#60;--All--&#62;</option></select>
            </div>
            <div class="fg" style="min-width:120px">
              <label class="fl">Dues Criteria</label>
              <select class="fc" id="f-duescriteria">
                <option value="">&#60;--All--&#62;</option>
                <option value="demanded">Demanded</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div class="fg" style="min-width:70px">
              <label class="fl">In (%)</label>
              <input type="number" class="fc" id="f-inpct" min="0" max="100" placeholder="100">
            </div>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
            <div class="fg" style="min-width:110px">
              <label class="fl">Broker</label>
              <select class="fc" id="f-broker"><option value="">&#60;--All--&#62;</option></select>
            </div>
            <div class="fg" style="min-width:110px">
              <label class="fl">Registration No.</label>
              <input type="text" class="fc" id="f-regno" placeholder="Search...">
            </div>
            <div class="fg" style="min-width:110px">
              <label class="fl">First Name</label>
              <input type="text" class="fc" id="f-firstname" placeholder="Search...">
            </div>
            <div class="fg" style="min-width:110px">
              <label class="fl">Unit Address</label>
              <input type="text" class="fc" id="f-unitaddr" placeholder="Search...">
            </div>
            <div class="fg" style="min-width:120px">
              <label class="fl">Due Date</label>
              <input type="date" class="fc" id="f-duedate">
            </div>
            <div class="fg" style="min-width:110px">
              <label class="fl">Customer Classification</label>
              <select class="fc" id="f-custclass">
                <option value="">&#60;--All--&#62;</option>
                <option>EWS</option><option>LIG</option><option>MIG</option>
              </select>
            </div>
            <div style="margin-bottom:2px">
              <button class="btn btn-primary" onclick="ReportsPage.fetchCustomerDues()">FETCH</button>
            </div>
          </div>
        </div>
      </div>
      <div id="rpt-result"><div class="empty-state"><h3>Select a project and click FETCH</h3></div></div>
    `);
    this._cwdLoadBrokers();
  },

  async _cwdLoadTowers() {
    const pid = document.getElementById('f-project')?.value;
    const sel = document.getElementById('f-tower');
    if (!sel) return;
    sel.innerHTML = '<option value="">&#60;--All--&#62;</option>';
    if (!pid) return;
    try {
      const res = await Api.get('/units/towers', { params: { projectId: pid } });
      const towers = res.data || res || [];
      towers.forEach(t => {
        const o = document.createElement('option');
        o.value = t.id; o.textContent = t.tower_name;
        sel.appendChild(o);
      });
    } catch (_) {}
  },

  async _cwdLoadBrokers() {
    const sel = document.getElementById('f-broker');
    if (!sel) return;
    try {
      const res = await Api.get('/brokers');
      const list = res.data || res || [];
      list.forEach((b) => {
        const o = document.createElement('option');
        o.value = b.id; o.textContent = b.firm_name || b.name || b.id;
        sel.appendChild(o);
      });
    } catch (_) {}
  },

  async fetchCustomerDues() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const pid = document.getElementById('f-project')?.value;

      const params = { projectId: pid || undefined };
      const tid  = document.getElementById('f-tower')?.value;
      const bhk  = document.getElementById('f-bhk')?.value;
      const dc   = document.getElementById('f-duescriteria')?.value;
      const ip   = document.getElementById('f-inpct')?.value;
      const reg  = document.getElementById('f-regno')?.value?.trim();
      const fn   = document.getElementById('f-firstname')?.value?.trim();
      const dd   = document.getElementById('f-duedate')?.value;
      const cc   = document.getElementById('f-custclass')?.value;
      if (tid)  params.towerId               = tid;
      if (bhk)  params.bhkType               = bhk;
      if (dc)   params.duesCriteria          = dc;
      if (ip)   params.inPercent             = ip;
      if (reg)  params.registrationNo        = reg;
      if (fn)   params.firstName             = fn;
      if (dd)   params.dueDate               = dd;
      if (cc)   params.customerClassification= cc;

      const res  = await Api.get('/reports/customer-dues', { params });
      const body = res || {};
      const rows = body.data    || [];
      const summ = body.summary || {};
      const wt   = this._cwdWithTax;

      const fmtA = v => parseFloat(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
      const fmtD = v => v ? String(v).slice(0,10) : '—';
      const aR   = 'text-align:right;white-space:nowrap';
      const aC   = 'text-align:center';

      const thS  = 'background:#1a56db;color:#fff;text-align:center;padding:5px 8px;white-space:nowrap;font-size:11px;font-weight:700;border:1px solid rgba(255,255,255,.15)';
      const thSG = 'background:#0d47a1;color:#fff;text-align:center;padding:5px 8px;white-space:nowrap;font-size:11px;font-weight:700;border:1px solid rgba(255,255,255,.15)';

      // CUSTOMER DETAILS: always 15 cols
      // DUES: without-tax = 3, with-tax = 7
      const duesColspan  = wt ? 7  : 3;
      const rcvdColspan  = wt ? 7  : 3;
      const osColspan    = wt ? 7  : 3;
      const custColspan  = 15;

      // Build header row 1
      const hdr1 = `<tr>
        <th rowspan="2" style="${thS}">S.NO.</th>
        <th colspan="${custColspan}" style="${thSG}">CUSTOMER DETAILS</th>
        <th colspan="${duesColspan}" style="${thSG}">DUES</th>
        <th colspan="${rcvdColspan}" style="${thSG}">RECEIVED</th>
        <th rowspan="2" style="${thS}">CREDIT<br>AMOUNT</th>
        <th colspan="${osColspan}" style="${thSG}">OUTSTANDING</th>
        <th colspan="2" style="${thSG}">UNDUE</th>
      </tr>`;

      // Build header row 2
      const custHdrs = ['REG. NO.','BOOKING DATE','NAME','TOWER','UNIT NO.','UNIT TYPE','AREA','AGREEMENT DATE','BROKER','PAYMENT PLAN','LOAN','MOBILE NO.','EMAIL','NET BSP','UNIT COST'];
      const duesHdrsWT  = ['DATE','AMOUNT','S.TAX','CGST','SGST','ITC','TOTAL DUE'];
      const duesHdrsNT  = ['DATE','AMOUNT','TOTAL DUE'];
      const rcvdHdrsWT  = ['PENDING','CLEAR','S.TAX','CGST','SGST','ITC','TOTAL'];
      const rcvdHdrsNT  = ['PENDING','CLEAR','TOTAL'];
      const osHdrsWT    = ['AMOUNT','S.TAX','CGST','SGST','ITC','TOTAL O/S','O/S %'];
      const osHdrsNT    = ['AMOUNT','TOTAL O/S','O/S %'];
      const duesHdrs    = wt ? duesHdrsWT : duesHdrsNT;
      const rcvdHdrs    = wt ? rcvdHdrsWT : rcvdHdrsNT;
      const osHdrs      = wt ? osHdrsWT   : osHdrsNT;

      const mkTh = arr => arr.map(h => `<th style="${thS}">${h}</th>`).join('');
      const hdr2 = `<tr>${mkTh(custHdrs)}${mkTh(duesHdrs)}${mkTh(rcvdHdrs)}${mkTh(osHdrs)}<th style="${thS}">AMOUNT</th><th style="${thS}">BAL. INT.</th></tr>`;

      // Build data rows
      const bodyRows = rows.map((r, i) => {
        const os  = parseFloat(r.outstanding_amount || 0);
        const osPct = parseFloat(r.outstanding_pct || 0);
        const osStyle = os > 0 ? `${aR};color:#dc3545;font-weight:600` : `${aR};color:#198754;font-weight:600`;
        const nameLink = `<a href="/api/consumers/${r.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" style="color:var(--primary);text-decoration:underline;font-weight:600;cursor:pointer" title="View Applicant File">${r.consumer_name}</a>`;

        // CUSTOMER DETAILS cells (15)
        const custCells = [
          `<td>${r.registration_no || '—'}</td>`,
          `<td style="${aC}">${fmtD(r.booking_date)}</td>`,
          `<td>${nameLink}</td>`,
          `<td>${r.tower_name || '—'}</td>`,
          `<td>${r.unit_number}</td>`,
          `<td>${r.bhk_type || '—'}</td>`,
          `<td style="${aR}">${r.area ? parseFloat(r.area).toFixed(4) : '—'}</td>`,
          `<td style="${aC}">${fmtD(r.allotment_date)}</td>`,
          `<td>${r.broker_name || 'Direct'}</td>`,
          `<td>${r.plan_name || '—'}</td>`,
          `<td>${r.loan_type || '—'}</td>`,
          `<td>${r.mobile || '—'}</td>`,
          `<td>${r.email || '—'}</td>`,
          `<td style="${aR}">${fmtA(r.net_bsp)}</td>`,
          `<td style="${aR}">${fmtA(r.unit_cost)}</td>`,
        ].join('');

        // DUES cells
        let duesCells;
        if (wt) {
          duesCells = [
            `<td style="${aC}">${fmtD(r.dues_date)}</td>`,
            `<td style="${aR}">${fmtA(r.dues_amount)}</td>`,
            `<td style="${aR}">0.00</td>`,
            `<td style="${aR}">${fmtA(r.dues_cgst)}</td>`,
            `<td style="${aR}">${fmtA(r.dues_sgst)}</td>`,
            `<td style="${aR}">0.00</td>`,
            `<td style="${aR};font-weight:600">${fmtA(r.dues_total)}</td>`,
          ].join('');
        } else {
          duesCells = [
            `<td style="${aC}">${fmtD(r.dues_date)}</td>`,
            `<td style="${aR}">${fmtA(r.dues_amount)}</td>`,
            `<td style="${aR};font-weight:600">${fmtA(r.dues_total)}</td>`,
          ].join('');
        }

        // RECEIVED cells
        let rcvdCells;
        if (wt) {
          rcvdCells = [
            `<td style="${aR}">0.00</td>`,
            `<td style="${aR};color:#198754">${fmtA(r.received_clear)}</td>`,
            `<td style="${aR}">0.00</td>`,
            `<td style="${aR}">${fmtA(r.received_cgst)}</td>`,
            `<td style="${aR}">${fmtA(r.received_sgst)}</td>`,
            `<td style="${aR}">0.00</td>`,
            `<td style="${aR};font-weight:600;color:#198754">${fmtA(r.received_total)}</td>`,
          ].join('');
        } else {
          rcvdCells = [
            `<td style="${aR}">0.00</td>`,
            `<td style="${aR};color:#198754">${fmtA(r.received_clear)}</td>`,
            `<td style="${aR};font-weight:600;color:#198754">${fmtA(r.received_total)}</td>`,
          ].join('');
        }

        // CREDIT
        const creditCell = `<td style="${aR}">0.00</td>`;

        // OUTSTANDING cells
        let osCells;
        if (wt) {
          osCells = [
            `<td style="${osStyle}">${fmtA(r.outstanding_amount)}</td>`,
            `<td style="${aR}">0.00</td>`,
            `<td style="${aR}">${fmtA(r.outstanding_cgst)}</td>`,
            `<td style="${aR}">${fmtA(r.outstanding_sgst)}</td>`,
            `<td style="${aR}">0.00</td>`,
            `<td style="${osStyle}">${fmtA(r.outstanding_total)}</td>`,
            `<td style="${osStyle}">${osPct}%</td>`,
          ].join('');
        } else {
          osCells = [
            `<td style="${osStyle}">${fmtA(r.outstanding_amount)}</td>`,
            `<td style="${osStyle}">${fmtA(r.outstanding_amount)}</td>`,
            `<td style="${osStyle}">${osPct}%</td>`,
          ].join('');
        }

        // UNDUE
        const undueCells = [
          `<td style="${aR}">${fmtA(r.undue_amount)}</td>`,
          `<td style="${aR}">0.00</td>`,
        ].join('');

        return `<tr>${'<td style="' + aC + '">' + (i+1) + '</td>'}${custCells}${duesCells}${rcvdCells}${creditCell}${osCells}${undueCells}</tr>`;
      });

      // Summary matrix at bottom
      const sm = summ;
      const sfmt = v => parseFloat(v||0).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2});
      const summaryHtml = `
        <div style="margin-top:20px;display:inline-block">
          <table style="border-collapse:collapse;font-size:12px;min-width:420px">
            <thead>
              <tr style="background:#1a56db;color:#fff">
                <th style="padding:6px 12px;border:1px solid #ddd"></th>
                <th style="padding:6px 12px;border:1px solid #ddd">PENDING</th>
                <th style="padding:6px 12px;border:1px solid #ddd">CLEAR</th>
                <th style="padding:6px 12px;border:1px solid #ddd">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${[
                ['Amount',   sm.pending?.amount,  sm.clear?.amount,  sm.total?.amount],
                ['CGST',     sm.pending?.cgst,    sm.clear?.cgst,    sm.total?.cgst],
                ['SGST',     sm.pending?.sgst,    sm.clear?.sgst,    sm.total?.sgst],
                ['Interest', sm.pending?.interest,sm.clear?.interest,sm.total?.interest],
              ].map(([lbl,p,c,t],idx) => `
                <tr style="background:${idx%2===0?'#f8f9fa':'#fff'}">
                  <td style="padding:5px 12px;border:1px solid #ddd;font-weight:600">${lbl}</td>
                  <td style="padding:5px 12px;border:1px solid #ddd;text-align:right">${sfmt(p)}</td>
                  <td style="padding:5px 12px;border:1px solid #ddd;text-align:right">${sfmt(c)}</td>
                  <td style="padding:5px 12px;border:1px solid #ddd;text-align:right">${sfmt(t)}</td>
                </tr>`).join('')}
              <tr style="background:#e3f2fd;font-weight:700">
                <td style="padding:5px 12px;border:1px solid #ddd">Total :</td>
                <td style="padding:5px 12px;border:1px solid #ddd;text-align:right">${sfmt(sm.pending?.total)}</td>
                <td style="padding:5px 12px;border:1px solid #ddd;text-align:right">${sfmt(sm.clear?.total)}</td>
                <td style="padding:5px 12px;border:1px solid #ddd;text-align:right">${sfmt(sm.total?.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;

      if (el) {
        if (rows.length === 0) {
          el.innerHTML = `<div class="empty-state"><h3>No records found</h3><p>Adjust filters and try again</p></div>${summaryHtml}`;
          return;
        }
        el.innerHTML = `
          <div style="overflow-x:auto">
            <div style="font-weight:700;font-size:13px;margin-bottom:8px;color:var(--accent)">CUSTOMER WISE DUES</div>
            <table style="width:100%;border-collapse:collapse;font-size:11px">
              <thead>${hdr1}${hdr2}</thead>
              <tbody>${bodyRows.join('')}</tbody>
            </table>
          </div>
          <div style="margin-top:16px">
            <div style="font-weight:700;font-size:12px;margin-bottom:6px;color:var(--accent)">AMOUNT RECEIVED AS ON DATE</div>
            ${summaryHtml}
          </div>
        `;
      }
    } catch (err) { Utils.error(err.message); }
  },

  loadDueReport(preFrom, preTo, title = 'Due Report') {
    this._main(`
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">${title}</div></div>
        <div class="sp-body">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:10px">
            <div class="fg" style="flex:1;min-width:150px">
              <label class="fl">Project</label>
              <select class="fc" id="f-project" onchange="ReportsPage._drLoadTowers()">${this._projectOptions()}</select>
            </div>
            <div class="fg" style="flex:1;min-width:140px">
              <label class="fl">Tower</label>
              <select class="fc" id="f-tower"><option value="">All Towers</option></select>
            </div>
            <div class="fg" style="min-width:130px">
              <label class="fl">Status</label>
              <select class="fc" id="f-status">
                <option value="">All Status</option>
                <option value="demanded">Demanded</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div class="fg" style="min-width:130px">
              <label class="fl">Installment</label>
              <select class="fc" id="f-instalment">
                <option value="">All</option>
                ${[1,2,3,4,5,6,7,8].map(i => `<option value="${i}">${i}</option>`).join('')}
              </select>
            </div>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
            <div class="fg" style="min-width:130px">
              <label class="fl">Due Date From</label>
              <input type="date" class="fc" id="f-from" value="${preFrom||''}">
            </div>
            <div class="fg" style="min-width:130px">
              <label class="fl">Due Date To</label>
              <input type="date" class="fc" id="f-to" value="${preTo||''}">
            </div>
            <div style="display:flex;gap:8px;margin-bottom:2px">
              <button class="btn btn-primary" onclick="ReportsPage.fetchDueReport()">FETCH</button>
              <button class="btn btn-ghost" onclick="ReportsPage.exportCsv('Due_Report.csv')">Export CSV</button>
            </div>
          </div>
        </div>
      </div>
      <div id="dr-summary" style="display:none;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:10px 16px;margin-bottom:12px;display:flex;gap:24px;font-size:13px"></div>
      <div id="rpt-result"><div class="empty-state"><h3>Apply filters and click FETCH</h3></div></div>
    `);
  },

  async _drLoadTowers() {
    const pid = document.getElementById('f-project')?.value;
    const sel = document.getElementById('f-tower');
    if (!sel) return;
    sel.innerHTML = '<option value="">All Towers</option>';
    if (!pid) return;
    try {
      const res = await Api.get('/units/towers', { params: { projectId: pid } });
      const towers = res.data || res || [];
      towers.forEach(t => {
        const o = document.createElement('option');
        o.value = t.id; o.textContent = t.tower_name;
        sel.appendChild(o);
      });
    } catch (_) {}
  },

  async fetchDueReport() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const params = {};
      const pid  = document.getElementById('f-project')?.value;
      const tid  = document.getElementById('f-tower')?.value;
      const st   = document.getElementById('f-status')?.value;
      const inst = document.getElementById('f-instalment')?.value;
      const frm  = document.getElementById('f-from')?.value;
      const to   = document.getElementById('f-to')?.value;
      if (pid)  params.projectId        = pid;
      if (tid)  params.towerId          = tid;
      if (st)   params.status           = st;
      if (inst) params.installmentIndex = inst;
      if (frm)  params.fromDate         = frm;
      if (to)   params.toDate           = to;

      const res  = await Api.get('/reports/due-report', { params });
      const rows = (Array.isArray(res.data) ? res.data : res) || [];
      const summ = res.summary || {};

      this._lastData = rows.map(r => ({
        'Reg No':           r.registration_no,
        'Consumer':         r.consumer_name,
        'Mobile':           r.mobile,
        'Project':          r.project_name,
        'Tower':            r.tower_name || '',
        'Floor':            r.floor || '',
        'Unit No':          r.unit_number,
        'Unit Type':        r.bhk_type || '',
        'Installment':      r.installment_name || r.installment_index,
        'Due Date':         r.due_date,
        'Amount Due':       parseFloat(r.amount_due_inr || 0),
        'CGST':             parseFloat(r.cgst_amount    || 0),
        'SGST':             parseFloat(r.sgst_amount    || 0),
        'Total Due':        parseFloat(r.total_due      || 0),
        'Paid':             parseFloat(r.paid_amount    || 0),
        'Balance':          parseFloat(r.balance_amount || 0),
        'Days Overdue':     parseInt(r.days_overdue     || 0),
        'Status':           r.demand_status,
      }));

      const fmtA = v => '₹' + parseFloat(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
      const fmtN = v => parseInt(v || 0).toLocaleString('en-IN');
      const aR   = 'text-align:right';
      const aC   = 'text-align:center';

      // Summary bar
      const sEl = document.getElementById('dr-summary');
      if (sEl) {
        sEl.style.display = 'flex';
        sEl.innerHTML = [
          `<span><strong>TOTAL DEMANDS:</strong> ${fmtN(summ.totalDemands)}</span>`,
          `<span><strong>TOTAL DUE:</strong> <span style="color:#1a56db">${fmtA(summ.totalDue)}</span></span>`,
          `<span><strong>TOTAL DUE WITH GST:</strong> <span style="color:#1a56db">${fmtA(summ.totalDueWithGst)}</span></span>`,
        ].join('<span style="color:var(--border)">|</span>');
      }

      if (!rows || rows.length === 0) {
        if (el) el.innerHTML = '<div class="empty-state"><h3>No records found</h3><p>Adjust filters and try again</p></div>';
        return;
      }

      // Totals
      let tDue=0, tCgst=0, tSgst=0, tTotal=0, tPaid=0, tBal=0;
      rows.forEach(r => {
        tDue  += parseFloat(r.amount_due_inr || 0);
        tCgst += parseFloat(r.cgst_amount    || 0);
        tSgst += parseFloat(r.sgst_amount    || 0);
        tTotal+= parseFloat(r.total_due      || 0);
        tPaid += parseFloat(r.paid_amount    || 0);
        tBal  += parseFloat(r.balance_amount || 0);
      });

      const statusBadge = s => {
        if (s === 'demanded') return `<span style="background:#fff3cd;color:#856404;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:600">DEMANDED</span>`;
        return `<span style="background:#e2e3e5;color:#41464b;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:600">PENDING</span>`;
      };

      const bodyRows = rows.map((r, i) => {
        const bal  = parseFloat(r.balance_amount || 0);
        const days = parseInt(r.days_overdue     || 0);
        const balStyle = bal > 0
          ? `${aR};color:#dc3545;font-weight:600`
          : `${aR};color:#198754;font-weight:600`;
        const dayStyle = days > 0
          ? `${aC};color:#dc3545;font-weight:600`
          : aC;
        return `<tr>
          <td style="${aC}">${i+1}</td>
          <td>${r.registration_no || '—'}</td>
          <td style="font-weight:600"><a href="/api/consumers/${r.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" onclick="event.stopPropagation()" style="color:var(--primary);text-decoration:underline;cursor:pointer" title="View Applicant File">${r.consumer_name}</a></td>
          <td>${r.mobile || '—'}</td>
          <td>${r.project_name}</td>
          <td>${r.tower_name || '—'}</td>
          <td style="${aC}">${r.floor || '—'}</td>
          <td>${r.unit_number}</td>
          <td>${r.bhk_type || '—'}</td>
          <td>${r.installment_name || ('Inst ' + r.installment_index)}</td>
          <td style="${aC}">${r.due_date ? r.due_date.toString().slice(0,10) : '—'}</td>
          <td style="${aR}">${fmtA(r.amount_due_inr)}</td>
          <td style="${aR}">${fmtA(r.cgst_amount)}</td>
          <td style="${aR}">${fmtA(r.sgst_amount)}</td>
          <td style="${aR};font-weight:600">${fmtA(r.total_due)}</td>
          <td style="${aR};color:#198754">${fmtA(r.paid_amount)}</td>
          <td style="${balStyle}">${fmtA(r.balance_amount)}</td>
          <td style="${dayStyle}">${days > 0 ? days : '—'}</td>
          <td style="${aC}">${statusBadge(r.demand_status)}</td>
        </tr>`;
      });

      const footRow = `
        <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
        <td style="font-weight:700">TOTAL</td>
        <td style="${aR};font-weight:700">${fmtA(tDue)}</td>
        <td style="${aR};font-weight:700">${fmtA(tCgst)}</td>
        <td style="${aR};font-weight:700">${fmtA(tSgst)}</td>
        <td style="${aR};font-weight:700">${fmtA(tTotal)}</td>
        <td style="${aR};font-weight:700;color:#198754">${fmtA(tPaid)}</td>
        <td style="${aR};font-weight:700">${fmtA(tBal)}</td>
        <td></td><td></td>
      `;

      const cols = ['S.NO.','REG. NO.','CONSUMER NAME','MOBILE','PROJECT','TOWER','FLOOR',
        'UNIT NO.','UNIT TYPE','INSTALLMENT NAME','DUE DATE','AMOUNT DUE','CGST','SGST',
        'TOTAL DUE','PAID','BALANCE','DAYS OVERDUE','STATUS'];

      this._table(cols, bodyRows, footRow);
      const drEl = document.getElementById('rpt-result');
      if (drEl) drEl.innerHTML = `<div class="cb-wrap">${drEl.innerHTML}</div>`;
    } catch (err) { Utils.error(err.message); }
  },

  loadDateWiseDues() {
    const today = new Date().toISOString().slice(0,10);
    this.loadDueReport(today, today, 'Date Wise Dues');
  },

  loadStageWiseDues() {
    this._main(`
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Stage Wise Dues Report</div></div>
        <div class="sp-body">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
            <div class="fg" style="flex:1;min-width:150px">
              <label class="fl">*Project</label>
              <select class="fc" id="f-project" onchange="ReportsPage._swdLoadTowers()">${this._projectOptions()}</select>
            </div>
            <div class="fg" style="flex:1;min-width:130px">
              <label class="fl">Tower</label>
              <select class="fc" id="f-tower"><option value="">&lt;--All--&gt;</option></select>
            </div>
            <div class="fg" style="min-width:130px">
              <label class="fl">Due Date</label>
              <input type="date" class="fc" id="f-duedate">
            </div>
            <div style="margin-bottom:2px;display:flex;gap:8px">
              <button class="btn btn-primary" onclick="ReportsPage.fetchStageWiseDues()">FETCH</button>
              <button class="btn btn-ghost"   onclick="ReportsPage.exportCsv('Stage_Wise_Dues.csv')">Export CSV</button>
            </div>
          </div>
        </div>
      </div>
      <div id="rpt-kpis" style="display:grid;gap:12px;margin-bottom:12px"></div>
      <div id="rpt-result"><div class="empty-state"><h3>Select a project and click FETCH</h3></div></div>
    `);
  },

  async _swdLoadTowers() {
    const pid = document.getElementById('f-project')?.value;
    const sel = document.getElementById('f-tower');
    if (!sel) return;
    sel.innerHTML = '<option value="">&lt;--All--&gt;</option>';
    if (!pid) return;
    try {
      const res = await Api.get(`/projects/${pid}/towers`);
      const towers = res.data || res || [];
      towers.forEach(t => {
        const o = document.createElement('option');
        o.value = t.id; o.textContent = t.tower_name;
        sel.appendChild(o);
      });
    } catch (_) {}
  },

  async fetchStageWiseDues() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const pid = document.getElementById('f-project')?.value;
      const params = { projectId: pid || undefined };
      const tid = document.getElementById('f-tower')?.value;
      const dd  = document.getElementById('f-duedate')?.value;
      if (tid) params.towerId  = tid;
      if (dd)  params.dueDate  = dd;

      const res  = await Api.get('/reports/stage-wise-dues', { params });
      const rows = res.data   || [];
      const tot  = res.totals || {};

      this._lastData = rows.map(r => ({
        'Stage':            r.installment_name || ('Installment ' + r.installment_index),
        'Consumers':        parseInt(r.consumer_count   || 0),
        'Total Demanded':   parseFloat(r.total_demanded  || 0),
        'CGST':             parseFloat(r.total_cgst      || 0),
        'SGST':             parseFloat(r.total_sgst      || 0),
        'Total Due':        parseFloat(r.total_due       || 0),
        'Total Received':   parseFloat(r.total_received  || 0),
        'Outstanding':      parseFloat(r.total_outstanding || 0),
        'Paid Count':       parseInt(r.paid_count        || 0),
        'Unpaid Count':     parseInt(r.unpaid_count      || 0),
        'Outstanding %':    parseFloat(r.total_demanded  || 0) > 0
          ? (parseFloat(r.total_outstanding || 0) / parseFloat(r.total_demanded) * 100).toFixed(1) + '%'
          : '0%',
      }));

      const fmtA = v => '₹' + parseFloat(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
      const fmtN = v => parseInt(v || 0).toLocaleString('en-IN');
      const aR   = 'text-align:right';
      const aC   = 'text-align:center';

      // KPI cards
      this._kpis([
        { label: 'TOTAL STAGES',      value: rows.length.toString(),      color: 'var(--accent)' },
        { label: 'TOTAL DEMANDED',    value: fmtA(tot.total_demanded),    color: 'var(--accent)' },
        { label: 'TOTAL OUTSTANDING', value: fmtA(tot.total_outstanding), color: '#dc3545' },
      ]);
      const kpiEl = document.getElementById('rpt-kpis');
      if (kpiEl) kpiEl.style.gridTemplateColumns = 'repeat(3,1fr)';

      if (!rows || rows.length === 0) {
        if (el) el.innerHTML = '<div class="empty-state"><h3>No records found</h3><p>Adjust filters and try again</p></div>';
        return;
      }

      const bodyRows = rows.map((r, i) => {
        const demanded    = parseFloat(r.total_demanded    || 0);
        const received    = parseFloat(r.total_received    || 0);
        const outstanding = parseFloat(r.total_outstanding || 0);
        const osPct       = demanded > 0 ? (outstanding / demanded * 100) : 0;
        const rcvPct      = demanded > 0 ? Math.min(100, (received / demanded * 100)) : 0;
        const osStyle     = outstanding > 0 ? `${aR};color:#dc3545;font-weight:600` : `${aR};color:#198754;font-weight:600`;
        const stageName   = r.installment_name || ('Installment ' + r.installment_index);
        const rowBg       = i % 2 === 1 ? 'background:var(--bg-row-alt,rgba(0,0,0,.03))' : '';

        const barHtml = `
          <div style="display:flex;flex-direction:column;gap:2px;min-width:120px">
            <div style="font-size:11px;${aR}">${fmtA(received)}</div>
            <div style="background:#e9ecef;border-radius:3px;height:6px;overflow:hidden">
              <div style="background:#198754;width:${rcvPct.toFixed(1)}%;height:100%;border-radius:3px;transition:width .3s"></div>
            </div>
            <div style="font-size:10px;color:var(--text-muted);${aR}">${rcvPct.toFixed(0)}%</div>
          </div>`;

        return `<tr style="${rowBg}">
          <td style="${aC}">${i + 1}</td>
          <td style="font-weight:600">${stageName}</td>
          <td style="${aC}">${fmtN(r.consumer_count)}</td>
          <td style="${aR}">${fmtA(r.total_demanded)}</td>
          <td style="${aR}">${fmtA(r.total_cgst)}</td>
          <td style="${aR}">${fmtA(r.total_sgst)}</td>
          <td style="${aR};font-weight:600">${fmtA(r.total_due)}</td>
          <td style="padding:4px 8px">${barHtml}</td>
          <td style="${osStyle}">${fmtA(r.total_outstanding)}</td>
          <td style="${aC};color:#198754">${fmtN(r.paid_count)}</td>
          <td style="${aC};color:#dc3545">${fmtN(r.unpaid_count)}</td>
          <td style="${osStyle}">${osPct.toFixed(1)}%</td>
        </tr>`;
      });

      const totDem  = parseFloat(tot.total_demanded    || 0);
      const totOs   = parseFloat(tot.total_outstanding || 0);
      const totOsPct = totDem > 0 ? (totOs / totDem * 100).toFixed(1) : '0';
      const footRow = `
        <td></td>
        <td style="font-weight:700">TOTAL</td>
        <td style="${aC};font-weight:700">${fmtN(tot.consumer_count)}</td>
        <td style="${aR};font-weight:700">${fmtA(tot.total_demanded)}</td>
        <td style="${aR};font-weight:700">${fmtA(tot.total_cgst)}</td>
        <td style="${aR};font-weight:700">${fmtA(tot.total_sgst)}</td>
        <td style="${aR};font-weight:700">${fmtA(tot.total_due)}</td>
        <td style="${aR};font-weight:700">${fmtA(tot.total_received)}</td>
        <td style="${aR};font-weight:700;color:#dc3545">${fmtA(tot.total_outstanding)}</td>
        <td style="${aC};font-weight:700;color:#198754">${fmtN(tot.paid_count)}</td>
        <td style="${aC};font-weight:700;color:#dc3545">${fmtN(tot.unpaid_count)}</td>
        <td style="${aR};font-weight:700;color:#dc3545">${totOsPct}%</td>
      `;

      const cols = ['S.NO.','STAGE NAME','NO. OF CONSUMERS','TOTAL DEMANDED','CGST','SGST',
        'TOTAL DUE','TOTAL RECEIVED','OUTSTANDING','PAID COUNT','UNPAID COUNT','OUTSTANDING %'];
      this._table(cols, bodyRows, footRow);
    } catch (err) { Utils.error(err.message); }
  },

  loadPercentageWise() {
    this._main(`
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Percentage Wise Dues Report</div></div>
        <div class="sp-body">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
            <div class="fg" style="flex:1;min-width:150px">
              <label class="fl">*Project</label>
              <select class="fc" id="f-project" onchange="ReportsPage._pwdLoadTowers()">${this._projectOptions()}</select>
            </div>
            <div class="fg" style="flex:1;min-width:130px">
              <label class="fl">Tower</label>
              <select class="fc" id="f-tower"><option value="">&lt;--All--&gt;</option></select>
            </div>
            <div class="fg" style="min-width:130px">
              <label class="fl">Due Date</label>
              <input type="date" class="fc" id="f-duedate">
            </div>
            <div style="margin-bottom:2px;display:flex;gap:8px">
              <button class="btn btn-primary" onclick="ReportsPage.fetchPercentageWise()">FETCH</button>
              <button class="btn btn-ghost"   onclick="ReportsPage.exportCsv('Percentage_Wise_Dues.csv')">Export CSV</button>
            </div>
          </div>
        </div>
      </div>
      <div id="rpt-kpis" style="display:grid;gap:12px;margin-bottom:12px"></div>
      <div id="rpt-result"><div class="empty-state"><h3>Select a project and click FETCH</h3></div></div>
    `);
  },

  async _pwdLoadTowers() {
    const pid = document.getElementById('f-project')?.value;
    const sel = document.getElementById('f-tower');
    if (!sel) return;
    sel.innerHTML = '<option value="">&lt;--All--&gt;</option>';
    if (!pid) return;
    try {
      const res = await Api.get(`/projects/${pid}/towers`);
      const towers = res.data || res || [];
      towers.forEach(t => {
        const o = document.createElement('option');
        o.value = t.id; o.textContent = t.tower_name;
        sel.appendChild(o);
      });
    } catch (_) {}
  },

  async fetchPercentageWise() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const pid = document.getElementById('f-project')?.value;
      const params = { projectId: pid || undefined };
      const tid = document.getElementById('f-tower')?.value;
      const dd  = document.getElementById('f-duedate')?.value;
      if (tid) params.towerId = tid;
      if (dd)  params.dueDate = dd;

      const res  = await Api.get('/reports/percentage-wise-dues', { params });
      const body = res.data || res || {};
      const buckets = body.buckets              || [];
      const cbb     = body.consumers_by_bucket  || {};
      const tot     = body.totals               || {};

      this._lastData = buckets.map(b => ({
        '% Range':          b.pct_bucket,
        'Consumers':        parseInt(b.consumer_count    || 0),
        'Total Cost':       parseFloat(b.total_cost      || 0),
        'Total Received':   parseFloat(b.total_received  || 0),
        'Outstanding':      parseFloat(b.total_outstanding || 0),
        'Avg %':            parseFloat(b.avg_pct         || 0),
      }));

      const fmtA = v => '₹' + parseFloat(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
      const aR   = 'text-align:right';
      const aC   = 'text-align:center';

      // KPI cards
      this._kpis([
        { label: 'TOTAL CONSUMERS',   value: parseInt(tot.total_consumers  || 0).toLocaleString('en-IN'), color: 'var(--accent)' },
        { label: 'TOTAL COST',        value: fmtA(tot.total_cost),         color: 'var(--accent)' },
        { label: 'TOTAL RECEIVED',    value: fmtA(tot.total_received),     color: '#198754' },
        { label: 'TOTAL OUTSTANDING', value: fmtA(tot.total_outstanding),  color: '#dc3545' },
      ]);
      const kpiEl = document.getElementById('rpt-kpis');
      if (kpiEl) kpiEl.style.gridTemplateColumns = 'repeat(4,1fr)';

      const totalCons = parseInt(tot.total_consumers || 1);

      // Bucket colors
      const bucketColors = {
        '0%':      '#ffebee',
        '0-10%':   '#fff3e0',
        '10-20%':  '#fff8e1',
        '20-30%':  '#f3e5f5',
        '30-40%':  '#e8eaf6',
        '40-50%':  '#e3f2fd',
        '50-60%':  '#e0f7fa',
        '60-70%':  '#e8f5e9',
        '70-80%':  '#f1f8e9',
        '80-90%':  '#e8f5e9',
        '90-100%': '#c8e6c9',
        '100%+':   '#a5d6a7',
      };

      const ALL_BUCKETS = ['0%','0-10%','10-20%','20-30%','30-40%','40-50%','50-60%','60-70%','70-80%','80-90%','90-100%','100%+'];
      const bucketMap = {};
      buckets.forEach(b => { bucketMap[b.pct_bucket] = b; });

      let tableHtml = '';
      ALL_BUCKETS.forEach((bk, i) => {
        const b     = bucketMap[bk] || { pct_bucket: bk, consumer_count: 0, total_cost: 0, total_received: 0, total_outstanding: 0, avg_pct: 0, min_pct: 0, max_pct: 0 };
        const cnt   = parseInt(b.consumer_count || 0);
        const bgCol = bucketColors[bk] || '#fff';
        const barW  = totalCons > 0 ? Math.round(cnt / totalCons * 100) : 0;
        const osAmt = parseFloat(b.total_outstanding || 0);
        const osStyle = osAmt > 0 ? `${aR};color:#dc3545;font-weight:600` : `${aR};color:#198754;font-weight:600`;

        const barHtml = `
          <div style="display:flex;align-items:center;gap:6px;min-width:120px">
            <div style="flex:1;background:#e9ecef;border-radius:3px;height:8px;overflow:hidden">
              <div style="background:#1a56db;width:${barW}%;height:100%;border-radius:3px"></div>
            </div>
            <span style="font-size:10px;color:var(--text-muted);white-space:nowrap">${barW}%</span>
          </div>`;

        const drillId = `pwd-drill-${i}`;
        tableHtml += `<tr style="background:${bgCol};cursor:pointer" onclick="ReportsPage._pwdToggleDrill('${drillId}','${bk}')">
          <td style="${aC}">${i + 1}</td>
          <td style="font-weight:700">${bk}</td>
          <td style="${aC}">${cnt}</td>
          <td style="padding:4px 8px">${barHtml}</td>
          <td style="${aR}">${fmtA(b.total_cost)}</td>
          <td style="${aR};color:#198754">${fmtA(b.total_received)}</td>
          <td style="${osStyle}">${fmtA(b.total_outstanding)}</td>
          <td style="${aC}">${b.avg_pct ? parseFloat(b.avg_pct).toFixed(1) + '%' : '—'}</td>
        </tr>
        <tr id="${drillId}" style="display:none">
          <td colspan="8" style="padding:0;background:#fafafa;border-bottom:2px solid #1a56db">
            <div style="padding:12px 20px">
              ${ReportsPage._pwdBuildDrill(cbb[bk] || [], fmtA, aR, aC)}
            </div>
          </td>
        </tr>`;
      });

      // Totals row
      const totOsStyle = parseFloat(tot.total_outstanding || 0) > 0 ? `${aR};color:#dc3545;font-weight:700` : `${aR};color:#198754;font-weight:700`;
      tableHtml += `<tr style="background:#fef3cd;font-weight:700">
        <td></td>
        <td>TOTAL</td>
        <td style="${aC}">${parseInt(tot.total_consumers || 0).toLocaleString('en-IN')}</td>
        <td></td>
        <td style="${aR}">${fmtA(tot.total_cost)}</td>
        <td style="${aR};color:#198754">${fmtA(tot.total_received)}</td>
        <td style="${totOsStyle}">${fmtA(tot.total_outstanding)}</td>
        <td></td>
      </tr>`;

      if (el) el.innerHTML = `
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead>
              <tr style="background:#1a56db;color:#fff">
                ${['S.NO.','% RANGE','NO. OF CONSUMERS','SHARE','TOTAL COST','TOTAL RECEIVED','OUTSTANDING','AVG %']
                  .map(h => `<th style="padding:7px 10px;text-align:center;white-space:nowrap;font-size:11px;font-weight:700;border:1px solid rgba(255,255,255,.2)">${h}</th>`).join('')}
              </tr>
            </thead>
            <tbody>${tableHtml}</tbody>
          </table>
        </div>
      `;

      // Store cbb for drill-down use
      ReportsPage._pwdCbb = cbb;
    } catch (err) { Utils.error(err.message); }
  },

  _pwdCbb: {},

  _pwdBuildDrill(consumers, fmtA, aR, aC) {
    if (!consumers || consumers.length === 0) {
      return '<div style="color:var(--text-muted);font-style:italic">No consumers in this bucket</div>';
    }
    const rows = consumers.map(c => `<tr>
      <td>${c.registration_no || '—'}</td>
      <td style="font-weight:600"><a href="/api/consumers/${c.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" style="color:var(--primary);text-decoration:underline;cursor:pointer" title="View Applicant File">${c.consumer_name}</a></td>
      <td>${c.tower_name || '—'}</td>
      <td>${c.unit_number}</td>
      <td>${c.bhk_type || '—'}</td>
      <td style="${aR}">${fmtA(c.total_cost)}</td>
      <td style="${aR};color:#198754">${fmtA(c.total_received)}</td>
      <td style="${aR};color:#dc3545;font-weight:600">${fmtA(c.outstanding)}</td>
      <td style="${aC};font-weight:600">${parseFloat(c.received_pct || 0).toFixed(1)}%</td>
    </tr>`).join('');
    return `<table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead>
        <tr style="background:#e3f2fd">
          ${['REG NO','NAME','TOWER','UNIT','TYPE','TOTAL COST','RECEIVED','OUTSTANDING','%']
            .map(h => `<th style="padding:5px 8px;text-align:center;font-weight:700;border:1px solid #ccc">${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  },

  _pwdToggleDrill(drillId, bucket) {
    const row = document.getElementById(drillId);
    if (!row) return;
    const isHidden = row.style.display === 'none';
    row.style.display = isHidden ? 'table-row' : 'none';
    // If opening and content is placeholder, render properly
    if (isHidden) {
      const fmtA = v => '₹' + parseFloat(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
      const aR = 'text-align:right';
      const aC = 'text-align:center';
      const cell = row.querySelector('td > div');
      if (cell) {
        cell.innerHTML = ReportsPage._pwdBuildDrill(ReportsPage._pwdCbb[bucket] || [], fmtA, aR, aC);
      }
    }
  },

  loadAgeingProject() {
    this._ageingView = 'project';
    this._main(`
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr" style="display:flex;justify-content:space-between;align-items:center">
          <div class="sp-title">Ageing Report</div>
          <div style="display:flex;gap:6px">
            <button id="ag-btn-project" class="btn btn-primary btn-sm" onclick="ReportsPage._ageingSwitch('project')">Project Wise</button>
            <button id="ag-btn-tower"   class="btn btn-ghost   btn-sm" onclick="ReportsPage._ageingSwitch('tower')">Tower Wise</button>
            <button id="ag-btn-plan"    class="btn btn-ghost   btn-sm" onclick="ReportsPage._ageingSwitch('plan')">Plan Wise</button>
          </div>
        </div>
        <div class="sp-body">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
            <div class="fg" style="flex:1;min-width:150px">
              <label class="fl">Project</label>
              <select class="fc" id="f-project">${this._projectOptions()}</select>
            </div>
            <div class="fg" style="min-width:130px">
              <label class="fl">As On Date</label>
              <input type="date" class="fc" id="f-asondate" value="${new Date().toISOString().slice(0,10)}">
            </div>
            <div style="margin-bottom:2px">
              <button class="btn btn-primary" onclick="ReportsPage.fetchAgeingReport()">FETCH</button>
            </div>
          </div>
        </div>
      </div>
      <div id="rpt-result"><div class="empty-state"><h3>Apply filters and click FETCH</h3></div></div>
    `);
  },

  _ageingView: 'project',

  _ageingSwitch(view) {
    this._ageingView = view;
    ['project','tower','plan'].forEach(v => {
      const btn = document.getElementById(`ag-btn-${v}`);
      if (btn) { btn.classList.toggle('btn-primary', v === view); btn.classList.toggle('btn-ghost', v !== view); }
    });
    this.fetchAgeingReport();
  },

  async fetchAgeingReport() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const view = this._ageingView || 'project';
      const endpoint = view === 'tower' ? '/reports/ageing-tower' : view === 'plan' ? '/reports/ageing-plan' : '/reports/ageing-project';
      const groupLabel = view === 'tower' ? 'TOWER' : view === 'plan' ? 'PLAN' : 'PROJECT';
      const params = {};
      const pid = document.getElementById('f-project')?.value;
      const aod = document.getElementById('f-asondate')?.value;
      if (pid) params.projectId = pid;
      if (aod) params.asOnDate  = aod;
      const res  = await Api.get(endpoint, { params });
      const rows = res.data   || [];
      const tot  = res.totals || {};
      const fmtA = v => '₹' + parseFloat(v||0).toLocaleString('en-IN',{maximumFractionDigits:0});
      const aR = 'text-align:right'; const aC = 'text-align:center';
      const thS = 'background:#1a56db;color:#fff;text-align:center;padding:6px 8px;font-size:11px;font-weight:700;border:1px solid rgba(255,255,255,.2)';
      const bColors = {'0-30':'#fff9c4','31-60':'#ffe0b2','61-90':'#ffccbc','91-180':'#ffcdd2','180+':'#b71c1c'};
      const bTC     = {'0-30':'#333','31-60':'#333','61-90':'#333','91-180':'#333','180+':'#fff'};
      if (!rows.length) { if(el) el.innerHTML='<div class="empty-state"><h3>No overdue records found</h3></div>'; return; }
      const getLabel = r => view === 'tower'
        ? `<span style="font-size:10px;color:#888">${r.project_name}</span><br>${r.tower_name}`
        : view === 'plan'
          ? `<span style="font-size:10px;color:#888">${r.project_name}</span><br>${r.plan_name}`
          : r.project_name;
      const bodyRows = rows.map((r,i) => {
        const mkB = (amt, cnt, key) => `<td style="${aR};background:${bColors[key]};color:${bTC[key]}">${fmtA(amt)}</td><td style="${aC};background:${bColors[key]};color:${bTC[key]}">${cnt}</td>`;
        return `<tr>
          <td style="${aC}">${i+1}</td><td style="font-weight:600">${getLabel(r)}</td>
          ${mkB(r.bucket_0_30,r.count_0_30,'0-30')}
          ${mkB(r.bucket_31_60,r.count_31_60,'31-60')}
          ${mkB(r.bucket_61_90,r.count_61_90,'61-90')}
          ${mkB(r.bucket_91_180,r.count_91_180,'91-180')}
          ${mkB(r.bucket_180_plus,r.count_180_plus,'180+')}
          <td style="${aR};font-weight:700;color:#dc3545">${fmtA(r.total_overdue)}</td>
        </tr>`;
      });
      const footRow = `<td></td><td style="font-weight:700">TOTAL</td>
        <td style="${aR};font-weight:700">${fmtA(tot.bucket_0_30)}</td><td></td>
        <td style="${aR};font-weight:700">${fmtA(tot.bucket_31_60)}</td><td></td>
        <td style="${aR};font-weight:700">${fmtA(tot.bucket_61_90)}</td><td></td>
        <td style="${aR};font-weight:700">${fmtA(tot.bucket_91_180)}</td><td></td>
        <td style="${aR};font-weight:700">${fmtA(tot.bucket_180_plus)}</td><td></td>
        <td style="${aR};font-weight:700;color:#dc3545">${fmtA(tot.total_overdue)}</td>`;
      if (el) el.innerHTML = `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr><th rowspan="2" style="${thS}">S.NO.</th><th rowspan="2" style="${thS}">${groupLabel}</th>
            <th colspan="2" style="${thS};background:#e65100">0-30 DAYS</th>
            <th colspan="2" style="${thS};background:#e64a19">31-60 DAYS</th>
            <th colspan="2" style="${thS};background:#d84315">61-90 DAYS</th>
            <th colspan="2" style="${thS};background:#c62828">91-180 DAYS</th>
            <th colspan="2" style="${thS};background:#7f0000">180+ DAYS</th>
            <th rowspan="2" style="${thS}">TOTAL OVERDUE</th>
          </tr>
          <tr>${['Amount','Count','Amount','Count','Amount','Count','Amount','Count','Amount','Count'].map(h=>`<th style="${thS}">${h}</th>`).join('')}</tr>
        </thead>
        <tbody>${bodyRows.join('')}</tbody>
        <tfoot class="tfoot-total"><tr>${footRow}</tr></tfoot>
      </table></div>`;
    } catch(err) { Utils.error(err.message); }
  },

  async fetchAgeingProject() { return this.fetchAgeingReport(); },

  loadAgeingInstallment() {
    this._main(`
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Ageing Report — Installment Wise</div></div>
        <div class="sp-body">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
            <div class="fg" style="flex:1;min-width:150px">
              <label class="fl">Project</label>
              <select class="fc" id="f-project">${this._projectOptions()}</select>
            </div>
            <div class="fg" style="min-width:130px">
              <label class="fl">As On Date</label>
              <input type="date" class="fc" id="f-asondate" value="${new Date().toISOString().slice(0,10)}">
            </div>
            <div style="margin-bottom:2px">
              <button class="btn btn-primary" onclick="ReportsPage.fetchAgeingInstallment()">FETCH</button>
            </div>
          </div>
        </div>
      </div>
      <div id="rpt-result"><div class="empty-state"><h3>Apply filters and click FETCH</h3></div></div>
    `);
  },

  async fetchAgeingInstallment() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const params = {};
      const pid = document.getElementById('f-project')?.value;
      const aod = document.getElementById('f-asondate')?.value;
      if (pid) params.projectId = pid;
      if (aod) params.asOnDate  = aod;
      const res  = await Api.get('/reports/ageing-installment', { params });
      const body = res;
      const rows = body.data   || [];
      const tot  = body.totals || {};
      const fmtA = v => '₹' + parseFloat(v||0).toLocaleString('en-IN',{maximumFractionDigits:0});
      const aR = 'text-align:right'; const aC = 'text-align:center';
      const thS = 'background:#1a56db;color:#fff;text-align:center;padding:6px 8px;font-size:11px;font-weight:700;border:1px solid rgba(255,255,255,.2)';
      const bColors = {'0-30':'#fff9c4','31-60':'#ffe0b2','61-90':'#ffccbc','91-180':'#ffcdd2','180+':'#b71c1c'};
      const bTC = {'0-30':'#333','31-60':'#333','61-90':'#333','91-180':'#333','180+':'#fff'};
      if (!rows.length) { if(el) el.innerHTML='<div class="empty-state"><h3>No overdue records found</h3></div>'; return; }
      const bodyRows = rows.map((r,i) => {
        const mkB = (amt,cnt,key) => `<td style="${aR};background:${bColors[key]};color:${bTC[key]}">${fmtA(amt)}</td><td style="${aC};background:${bColors[key]};color:${bTC[key]}">${cnt}</td>`;
        return `<tr>
          <td style="${aC}">${i+1}</td>
          <td style="font-weight:600">${r.installment_index}</td>
          <td>${r.demand_type || '—'}</td>
          ${mkB(r.bucket_0_30,r.count_0_30,'0-30')}
          ${mkB(r.bucket_31_60,r.count_31_60,'31-60')}
          ${mkB(r.bucket_61_90,r.count_61_90,'61-90')}
          ${mkB(r.bucket_91_180,r.count_91_180,'91-180')}
          ${mkB(r.bucket_180_plus,r.count_180_plus,'180+')}
          <td style="${aR};font-weight:700;color:#dc3545">${fmtA(r.total_overdue)}</td>
        </tr>`;
      });
      const footRow = `<td></td><td style="font-weight:700">TOTAL</td><td></td>
        <td style="${aR};font-weight:700">${fmtA(tot.bucket_0_30)}</td><td></td>
        <td style="${aR};font-weight:700">${fmtA(tot.bucket_31_60)}</td><td></td>
        <td style="${aR};font-weight:700">${fmtA(tot.bucket_61_90)}</td><td></td>
        <td style="${aR};font-weight:700">${fmtA(tot.bucket_91_180)}</td><td></td>
        <td style="${aR};font-weight:700">${fmtA(tot.bucket_180_plus)}</td><td></td>
        <td style="${aR};font-weight:700;color:#dc3545">${fmtA(tot.total_overdue)}</td>`;
      if (el) el.innerHTML = `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr><th rowspan="2" style="${thS}">S.NO.</th><th rowspan="2" style="${thS}">INST.</th><th rowspan="2" style="${thS}">TYPE</th>
            <th colspan="2" style="${thS};background:#e65100">0-30 DAYS</th>
            <th colspan="2" style="${thS};background:#e64a19">31-60 DAYS</th>
            <th colspan="2" style="${thS};background:#d84315">61-90 DAYS</th>
            <th colspan="2" style="${thS};background:#c62828">91-180 DAYS</th>
            <th colspan="2" style="${thS};background:#7f0000">180+ DAYS</th>
            <th rowspan="2" style="${thS}">TOTAL</th>
          </tr>
          <tr>${['Amt','Cnt','Amt','Cnt','Amt','Cnt','Amt','Cnt','Amt','Cnt'].map(h=>`<th style="${thS}">${h}</th>`).join('')}</tr>
        </thead>
        <tbody>${bodyRows.join('')}</tbody>
        <tfoot class="tfoot-total"><tr>${footRow}</tr></tfoot>
      </table></div>`;
    } catch(err) { Utils.error(err.message); }
  },

  loadMonthWiseDues() {
    this._main(`
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Month Wise Dues Report</div></div>
        <div class="sp-body">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
            <div class="fg" style="flex:1;min-width:150px">
              <label class="fl">*Project</label>
              <select class="fc" id="f-project">${this._projectOptions()}</select>
            </div>
            <div class="fg" style="min-width:100px">
              <label class="fl">Year</label>
              <input type="number" class="fc" id="f-year" value="${new Date().getFullYear()}" min="2020" max="2035">
            </div>
            <div style="margin-bottom:2px;display:flex;gap:8px">
              <button class="btn btn-primary" onclick="ReportsPage.fetchMonthWiseDues()">FETCH</button>
              <button class="btn btn-ghost" onclick="ReportsPage.exportCsv('Month_Wise_Dues.csv')">Export CSV</button>
            </div>
          </div>
        </div>
      </div>
      <div id="rpt-kpis" style="display:grid;gap:12px;margin-bottom:12px"></div>
      <div id="rpt-result"><div class="empty-state"><h3>Select a project and click FETCH</h3></div></div>
    `);
  },

  async fetchMonthWiseDues() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const pid = document.getElementById('f-project')?.value;
      const yr  = document.getElementById('f-year')?.value;
      const params = { projectId: pid || undefined };
      if (yr) params.year = yr;
      const res  = await Api.get('/reports/month-wise-dues', { params });
      const body = res;
      const rows = body.data   || [];
      const tot  = body.totals || {};
      this._lastData = rows.map(r => ({
        'Month': r.month_label,
        'Consumers': parseInt(r.consumer_count||0),
        'Demands': parseInt(r.demand_count||0),
        'Total Due': parseFloat(r.total_due||0),
        'GST': parseFloat(r.total_gst||0),
        'Total With GST': parseFloat(r.total_due_with_gst||0),
        'Received': parseFloat(r.total_received||0),
        'Outstanding': parseFloat(r.total_outstanding||0),
      }));
      const fmtA = v => '₹' + parseFloat(v||0).toLocaleString('en-IN',{maximumFractionDigits:0});
      const aR = 'text-align:right'; const aC = 'text-align:center';
      const today = new Date(); const thisMonth = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
      this._kpis([
        { label:'TOTAL MONTHS',   value: rows.length.toString(),      color:'var(--accent)' },
        { label:'TOTAL DUE',      value: fmtA(tot.total_due),         color:'var(--accent)' },
        { label:'TOTAL RECEIVED', value: fmtA(tot.total_received),    color:'#198754' },
        { label:'OUTSTANDING',    value: fmtA(tot.total_outstanding), color:'#dc3545' },
      ]);
      const kpiEl = document.getElementById('rpt-kpis');
      if (kpiEl) kpiEl.style.gridTemplateColumns = 'repeat(4,1fr)';
      if (!rows.length) { if(el) el.innerHTML='<div class="empty-state"><h3>No records found</h3></div>'; return; }
      const bodyRows = rows.map((r,i) => {
        const os = parseFloat(r.total_outstanding||0);
        const osStyle = os > 0 ? `${aR};color:#dc3545;font-weight:600` : `${aR};color:#198754;font-weight:600`;
        const mDate = r.month_date ? String(r.month_date).slice(0,7) : '';
        let rowBg = '';
        if (mDate && mDate < thisMonth) rowBg = 'background:#f5f5f5;color:#888';
        else if (mDate && mDate === thisMonth) rowBg = 'border-left:3px solid #1a56db';
        return `<tr style="${rowBg}">
          <td style="${aC}">${i+1}</td>
          <td style="font-weight:600">${r.month_label}</td>
          <td style="${aC}">${r.consumer_count}</td>
          <td style="${aC}">${r.demand_count}</td>
          <td style="${aR}">${fmtA(r.total_due)}</td>
          <td style="${aR}">${fmtA(r.total_gst)}</td>
          <td style="${aR};font-weight:600">${fmtA(r.total_due_with_gst)}</td>
          <td style="${aR};color:#198754">${fmtA(r.total_received)}</td>
          <td style="${osStyle}">${fmtA(r.total_outstanding)}</td>
        </tr>`;
      });
      const footRow = `<td></td><td style="font-weight:700">TOTAL</td>
        <td style="${aC}"></td><td style="${aC};font-weight:700">${tot.demand_count}</td>
        <td style="${aR};font-weight:700">${fmtA(tot.total_due)}</td>
        <td style="${aR};font-weight:700">${fmtA(tot.total_gst)}</td>
        <td style="${aR};font-weight:700">${fmtA(tot.total_due_with_gst)}</td>
        <td style="${aR};font-weight:700;color:#198754">${fmtA(tot.total_received)}</td>
        <td style="${aR};font-weight:700;color:#dc3545">${fmtA(tot.total_outstanding)}</td>`;
      this._table(['S.NO.','MONTH','CONSUMERS','DEMANDS','TOTAL DUE','GST','TOTAL WITH GST','RECEIVED','OUTSTANDING'], bodyRows, footRow);
    } catch(err) { Utils.error(err.message); }
  },

  loadCustomerForecasting() {
    this._main(`
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Customer Forecasting</div></div>
        <div class="sp-body">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
            <div class="fg" style="flex:1;min-width:160px">
              <label class="fl">Project</label>
              <select class="fc" id="f-project">${this._projectOptions()}</select>
            </div>
            <div style="margin-bottom:2px;display:flex;gap:8px">
              <button class="btn btn-primary" onclick="ReportsPage.fetchCustomerForecasting()">FETCH</button>
              <button class="btn btn-ghost"   onclick="ReportsPage.exportCsv('Customer_Forecasting.csv')">Export CSV</button>
            </div>
          </div>
        </div>
      </div>
      <div id="rpt-kpis" style="display:grid;gap:12px;margin-bottom:12px"></div>
      <div id="rpt-result"><div class="empty-state"><h3>Select a project and click FETCH</h3></div></div>
    `);
  },

  async fetchCustomerForecasting() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const pid = document.getElementById('f-project')?.value;
      const params = {};
      if (pid) params.projectId = pid;
      const res = await Api.get('/reports/customer-forecasting', { params });
      const t = res.totals || {};
      const fmtA = v => '₹' + parseFloat(v||0).toLocaleString('en-IN',{maximumFractionDigits:0});
      this._kpis([
        { label:'TOTAL PROJECTED', value: fmtA(t.projected), color:'#dc3545' },
        { label:'TOTAL DEMANDED',  value: fmtA(t.demanded),  color:'#e67e22' },
        { label:'TOTAL PENDING',   value: fmtA(t.pending),   color:'#198754' },
        { label:'MONTHS AHEAD',    value: String(t.months),  color:'var(--accent)' },
      ]);
      const kpiEl = document.getElementById('rpt-kpis');
      if (kpiEl) kpiEl.style.gridTemplateColumns = 'repeat(4,1fr)';
      this._lastData = res.detail || [];
      const rows = res.detail || [];
      if (!el) return;
      if (!rows.length) { el.innerHTML='<div class="empty-state"><h3>No upcoming dues found</h3></div>'; return; }
      const aR = 'text-align:right'; const aC = 'text-align:center';
      const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—';
      const badge = s => `<span class="badge ${s==='demanded'?'badge-warning':'badge-info'}">${s}</span>`;
      const bodyRows = rows.map((r,i) => `<tr>
        <td style="${aC}">${i+1}</td>
        <td style="font-weight:600">${r.consumer_name||'—'}</td>
        <td>${r.registration_no||'—'}</td>
        <td>${r.project_name||'—'}</td>
        <td>${r.tower_name||'—'}</td>
        <td>${r.unit_number||'—'}</td>
        <td>${r.installment_name||'—'}</td>
        <td>${fmtDate(r.due_date)}</td>
        <td style="${aR};font-weight:600">${fmtA(r.amount)}</td>
        <td style="${aC}">${badge(r.status)}</td>
      </tr>`);
      const totalAmount = rows.reduce((a,r) => a + parseFloat(r.amount||0), 0);
      const footRow = `<td></td><td colspan="7" style="font-weight:700">TOTAL (${rows.length} installments)</td>
        <td style="${aR};font-weight:700;color:#dc3545">${fmtA(totalAmount)}</td><td></td>`;
      el.innerHTML = `<div class="cb-wrap"><table>
        <thead><tr><th>S.NO.</th><th>CONSUMER</th><th>REG NO</th><th>PROJECT</th><th>TOWER</th><th>UNIT</th><th>INSTALLMENT</th><th>DUE DATE</th><th>AMOUNT</th><th>STATUS</th></tr></thead>
        <tbody>${bodyRows.join('')}</tbody>
        <tfoot class="tfoot-total"><tr>${footRow}</tr></tfoot>
      </table></div>`;
    } catch(err) { Utils.error(err.message); }
  },

  loadCustomerDuesDetail() {
    this._main(`
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Customer Dues Detail (Installment/Head Wise)</div></div>
        <div class="sp-body">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
            <div class="fg" style="flex:1;min-width:140px">
              <label class="fl">*Project</label>
              <select class="fc" id="f-project" onchange="ReportsPage._cddLoadTowers()">${this._projectOptions()}</select>
            </div>
            <div class="fg" style="flex:1;min-width:120px">
              <label class="fl">Tower</label>
              <select class="fc" id="f-tower"><option value="">&lt;--All--&gt;</option></select>
            </div>
            <div class="fg" style="min-width:80px">
              <label class="fl">Installment</label>
              <select class="fc" id="f-instalment">
                <option value="">All</option>
                ${[1,2,3,4,5,6,7,8].map(i=>`<option value="${i}">${i}</option>`).join('')}
              </select>
            </div>
            <div class="fg" style="min-width:110px">
              <label class="fl">Status</label>
              <select class="fc" id="f-status">
                <option value="">All</option>
                <option value="demanded">Demanded</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div style="margin-bottom:2px;display:flex;gap:8px">
              <button class="btn btn-primary" onclick="ReportsPage.fetchCustomerDuesDetail()">FETCH</button>
              <button class="btn btn-ghost" onclick="ReportsPage.exportCsv('Customer_Dues_Detail.csv')">Export CSV</button>
            </div>
          </div>
        </div>
      </div>
      <div id="rpt-result"><div class="empty-state"><h3>Select a project and click FETCH</h3></div></div>
    `);
  },

  async _cddLoadTowers() {
    const pid = document.getElementById('f-project')?.value;
    const sel = document.getElementById('f-tower');
    if (!sel) return;
    sel.innerHTML = '<option value="">&lt;--All--&gt;</option>';
    if (!pid) return;
    try {
      const res = await Api.get('/units/towers', { params: { projectId: pid } });
      const towers = res.data || res || [];
      towers.forEach(t => { const o=document.createElement('option'); o.value=t.id; o.textContent=t.tower_name; sel.appendChild(o); });
    } catch(_) {}
  },

  async fetchCustomerDuesDetail() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const pid = document.getElementById('f-project')?.value;
      const params = { projectId: pid || undefined };
      const tid  = document.getElementById('f-tower')?.value;
      const inst = document.getElementById('f-instalment')?.value;
      const st   = document.getElementById('f-status')?.value;
      if (tid)  params.towerId          = tid;
      if (inst) params.installmentIndex = inst;
      if (st)   params.status           = st;
      const res  = await Api.get('/reports/customer-dues-detail', { params });
      const body = res;
      const rows = body.data || [];
      this._lastData = rows.map(r => ({
        'Reg No': r.registration_no||'', 'Name': r.consumer_name, 'Mobile': r.mobile||'',
        'Project': r.project_name, 'Tower': r.tower_name||'', 'Unit': r.unit_number,
        'Installment': r.installment_index, 'Type': r.installment_name||'',
        'Due Date': r.due_date?String(r.due_date).slice(0,10):'',
        'Amount Due': parseFloat(r.amount_due_inr||0), 'CGST': parseFloat(r.cgst||0),
        'SGST': parseFloat(r.sgst||0), 'Total Due': parseFloat(r.total_due||0),
        'Paid': parseFloat(r.paid||0), 'Balance': parseFloat(r.balance||0),
        'Days Overdue': parseInt(r.days_overdue||0), 'Status': r.demand_status,
      }));
      const fmtA = v => '₹' + parseFloat(v||0).toLocaleString('en-IN',{maximumFractionDigits:0});
      const aR = 'text-align:right'; const aC = 'text-align:center';
      if (!rows.length) { if(el) el.innerHTML='<div class="empty-state"><h3>No records found</h3></div>'; return; }
      let tDue=0, tCgst=0, tSgst=0, tTot=0, tPaid=0, tBal=0;
      rows.forEach(r => { tDue+=parseFloat(r.amount_due_inr||0); tCgst+=parseFloat(r.cgst||0); tSgst+=parseFloat(r.sgst||0); tTot+=parseFloat(r.total_due||0); tPaid+=parseFloat(r.paid||0); tBal+=parseFloat(r.balance||0); });
      const statusBadge = s => s==='demanded'
        ? `<span style="background:#fff3cd;color:#856404;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:600">DEMANDED</span>`
        : `<span style="background:#e2e3e5;color:#41464b;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:600">PENDING</span>`;
      const bodyRows = rows.map((r,i) => {
        const bal = parseFloat(r.balance||0); const days = parseInt(r.days_overdue||0);
        const balStyle = bal>0?`${aR};color:#dc3545;font-weight:600`:`${aR};color:#198754;font-weight:600`;
        const dayStyle = days>0?`${aC};color:#dc3545;font-weight:600`:aC;
        const nameLink = `<a href="/api/consumers/${r.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" style="color:var(--primary);text-decoration:underline;font-weight:600;cursor:pointer" title="View Applicant File">${r.consumer_name}</a>`;
        return `<tr>
          <td style="${aC}">${i+1}</td><td>${r.registration_no||'—'}</td><td>${nameLink}</td><td>${r.mobile||'—'}</td>
          <td>${r.project_name}</td><td>${r.tower_name||'—'}</td><td>${r.unit_number}</td>
          <td style="${aC}">${r.installment_index}</td><td>${r.installment_name||'—'}</td>
          <td style="${aC}">${r.due_date?String(r.due_date).slice(0,10):'—'}</td>
          <td style="${aR}">${fmtA(r.amount_due_inr)}</td><td style="${aR}">${fmtA(r.cgst)}</td>
          <td style="${aR}">${fmtA(r.sgst)}</td><td style="${aR};font-weight:600">${fmtA(r.total_due)}</td>
          <td style="${aR};color:#198754">${fmtA(r.paid)}</td><td style="${balStyle}">${fmtA(r.balance)}</td>
          <td style="${dayStyle}">${days>0?days:'—'}</td><td style="${aC}">${statusBadge(r.demand_status)}</td>
        </tr>`;
      });
      const footRow = `<td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="font-weight:700">TOTAL</td>
        <td style="${aR};font-weight:700">${fmtA(tDue)}</td><td style="${aR};font-weight:700">${fmtA(tCgst)}</td>
        <td style="${aR};font-weight:700">${fmtA(tSgst)}</td><td style="${aR};font-weight:700">${fmtA(tTot)}</td>
        <td style="${aR};font-weight:700;color:#198754">${fmtA(tPaid)}</td>
        <td style="${aR};font-weight:700">${fmtA(tBal)}</td><td></td><td></td>`;
      this._table(['S.NO.','REG. NO.','NAME','MOBILE','PROJECT','TOWER','UNIT NO.','INST.','TYPE',
        'DUE DATE','AMOUNT DUE','CGST','SGST','TOTAL DUE','PAID','BALANCE','DAYS OVERDUE','STATUS'], bodyRows, footRow);
      const cddEl = document.getElementById('rpt-result');
      if (cddEl) cddEl.innerHTML = `<div class="cb-wrap">${cddEl.innerHTML}</div>`;
    } catch(err) { Utils.error(err.message); }
  },

  _pwdWithTax: false,

  _pwdSetTax(v) {
    this._pwdWithTax = v;
    const btnNo  = document.getElementById('pwd-tax-no');
    const btnYes = document.getElementById('pwd-tax-yes');
    if (btnNo)  { btnNo.classList.toggle('btn-primary', !v); btnNo.classList.toggle('btn-ghost', v); }
    if (btnYes) { btnYes.classList.toggle('btn-primary', v); btnYes.classList.toggle('btn-ghost', !v); }
  },

  loadProjectWiseDues() {
    this._pwdWithTax = false;
    this._main(`
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr" style="display:flex;justify-content:space-between;align-items:center">
          <div class="sp-title">Project Wise Dues Report</div>
          <div style="display:flex;gap:6px">
            <button id="pwd-tax-no"  class="btn btn-primary btn-sm" onclick="ReportsPage._pwdSetTax(false)">Without Tax</button>
            <button id="pwd-tax-yes" class="btn btn-ghost   btn-sm" onclick="ReportsPage._pwdSetTax(true)">With Tax</button>
          </div>
        </div>
        <div class="sp-body">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
            <div class="fg" style="flex:1;min-width:150px">
              <label class="fl">Project</label>
              <select class="fc" id="f-project">${this._projectOptions()}</select>
            </div>
            <div class="fg" style="min-width:130px">
              <label class="fl">Due Date</label>
              <input type="date" class="fc" id="f-duedate">
            </div>
            <div style="margin-bottom:2px;display:flex;gap:8px">
              <button class="btn btn-primary" onclick="ReportsPage.fetchProjectWiseDues()">FETCH</button>
              <button class="btn btn-ghost" onclick="ReportsPage.exportCsv('Project_Wise_Dues.csv')">Export CSV</button>
            </div>
          </div>
        </div>
      </div>
      <div id="rpt-kpis" style="display:grid;gap:12px;margin-bottom:12px"></div>
      <div id="rpt-result"><div class="empty-state"><h3>Apply filters and click FETCH</h3></div></div>
    `);
  },

  async fetchProjectWiseDues() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const params = {};
      const pid = document.getElementById('f-project')?.value;
      const dd  = document.getElementById('f-duedate')?.value;
      if (pid) params.projectId = pid;
      if (dd)  params.dueDate   = dd;
      const res  = await Api.get('/reports/project-wise-dues', { params });
      const body = res;
      const rows = body.data    || [];
      const tot  = body.totals  || {};
      const summ = body.summary || {};
      const wt   = this._pwdWithTax;

      const dem  = r => wt ? parseFloat(r.total_demanded_with_tax||0)   : parseFloat(r.total_demanded||0);
      const os   = r => wt ? parseFloat(r.outstanding_with_tax||0)      : parseFloat(r.outstanding||0);
      const duePct = r => wt ? parseFloat(r.due_pct_with_tax||0)        : parseFloat(r.due_pct||0);
      const osPct  = r => wt ? parseFloat(r.outstanding_pct_with_tax||0): parseFloat(r.outstanding_pct||0);

      this._lastData = rows.map(r => ({
        'Project': r.project_name,
        'Consumers': parseInt(r.consumer_count||0),
        'Units': parseInt(r.unit_count||0),
        'Total Cost': parseFloat(r.total_cost||0),
        'Total Demanded': dem(r),
        'Due %': duePct(r)+'%',
        'Received Pending': parseFloat(r.received_pending||0),
        'Received Clear': parseFloat(r.received_clear||0),
        'Total Received': parseFloat(r.total_received||0),
        'Received %': parseFloat(r.received_pct||0)+'%',
        'Outstanding': os(r),
        'Outstanding %': osPct(r)+'%',
      }));
      const fmtA = v => '₹' + parseFloat(v||0).toLocaleString('en-IN',{maximumFractionDigits:0});
      const aR = 'text-align:right'; const aC = 'text-align:center';
      this._kpis([
        { label:'TOTAL PROJECTS',    value: rows.length.toString(),     color:'var(--accent)' },
        { label:'TOTAL DEMANDED',    value: fmtA(wt ? tot.total_demanded_with_tax : tot.total_demanded), color:'var(--accent)' },
        { label:'TOTAL RECEIVED',    value: fmtA(tot.total_received),   color:'#198754' },
        { label:'TOTAL OUTSTANDING', value: fmtA(wt ? tot.outstanding_with_tax : tot.outstanding), color:'#dc3545' },
      ]);
      const kpiEl = document.getElementById('rpt-kpis');
      if (kpiEl) kpiEl.style.gridTemplateColumns = 'repeat(4,1fr)';
      if (!rows.length) { if(el) el.innerHTML='<div class="empty-state"><h3>No records found</h3></div>'; return; }
      const bodyRows = rows.map((r,i) => {
        const osV = os(r);
        const osStyle = osV > 0 ? `${aR};color:#dc3545;font-weight:600` : `${aR};color:#198754;font-weight:600`;
        return `<tr style="${i%2===1?'background:var(--bg-row-alt,rgba(0,0,0,.03))':''}">
          <td style="${aC}">${i+1}</td>
          <td style="font-weight:600">${r.project_name}</td>
          <td style="${aC}">${r.consumer_count}</td>
          <td style="${aC}">${r.unit_count}</td>
          <td style="${aR}">${fmtA(r.total_cost)}</td>
          <td style="${aR}">${fmtA(dem(r))}</td>
          <td style="${aC}">${duePct(r)}%</td>
          <td style="${aR}">${fmtA(r.received_pending)}</td>
          <td style="${aR};color:#198754">${fmtA(r.received_clear)}</td>
          <td style="${aR};color:#198754;font-weight:600">${fmtA(r.total_received)}</td>
          <td style="${aC}">${parseFloat(r.received_pct||0)}%</td>
          <td style="${osStyle}">${fmtA(osV)}</td>
          <td style="${osStyle}">${osPct(r)}%</td>
          <td style="${aC}"><button class="btn btn-ghost btn-sm" onclick="Router.navigate('/reports',{tab:'all-applicants',projectId:'${r.project_id}'})">DETAILS</button></td>
        </tr>`;
      });
      const demT = wt ? parseFloat(tot.total_demanded_with_tax||0) : parseFloat(tot.total_demanded||0);
      const osT  = wt ? parseFloat(tot.outstanding_with_tax||0)    : parseFloat(tot.outstanding||0);
      const duePctT = wt ? parseFloat(tot.due_pct_with_tax||0)        : parseFloat(tot.due_pct||0);
      const osPctT  = wt ? parseFloat(tot.outstanding_pct_with_tax||0): parseFloat(tot.outstanding_pct||0);
      const footRow = `<td></td><td style="font-weight:700">TOTAL</td>
        <td style="${aC};font-weight:700">${tot.consumer_count}</td><td style="${aC};font-weight:700">${tot.unit_count}</td>
        <td style="${aR};font-weight:700">${fmtA(tot.total_cost)}</td>
        <td style="${aR};font-weight:700">${fmtA(demT)}</td>
        <td style="${aC};font-weight:700">${duePctT}%</td>
        <td style="${aR};font-weight:700">${fmtA(tot.received_pending)}</td>
        <td style="${aR};font-weight:700;color:#198754">${fmtA(tot.received_clear)}</td>
        <td style="${aR};font-weight:700;color:#198754">${fmtA(tot.total_received)}</td>
        <td style="${aC};font-weight:700">${parseFloat(tot.received_pct||0)}%</td>
        <td style="${aR};font-weight:700;color:#dc3545">${fmtA(osT)}</td>
        <td style="${aR};font-weight:700;color:#dc3545">${osPctT}%</td>
        <td></td>`;
      this._table(['S.NO.','PROJECT','CONSUMERS','UNITS','TOTAL COST','TOTAL DEMANDED','DUE %','RECEIVED (PENDING)','RECEIVED (CLEAR)','TOTAL RECEIVED','RECEIVED %','OUTSTANDING','OUTSTANDING %','DETAILS'], bodyRows, footRow);

      const sm = summ;
      const sfmt = v => parseFloat(v||0).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2});
      const summaryHtml = `
        <div style="margin-top:20px;display:inline-block">
          <table style="border-collapse:collapse;font-size:12px;min-width:420px">
            <thead>
              <tr style="background:#1a56db;color:#fff">
                <th style="padding:6px 12px;border:1px solid #ddd"></th>
                <th style="padding:6px 12px;border:1px solid #ddd">PENDING</th>
                <th style="padding:6px 12px;border:1px solid #ddd">CLEAR</th>
                <th style="padding:6px 12px;border:1px solid #ddd">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${[
                ['Amount',   sm.pending?.amount,  sm.clear?.amount,  sm.total?.amount],
                ['CGST',     sm.pending?.cgst,    sm.clear?.cgst,    sm.total?.cgst],
                ['SGST',     sm.pending?.sgst,    sm.clear?.sgst,    sm.total?.sgst],
                ['Interest', sm.pending?.interest,sm.clear?.interest,sm.total?.interest],
              ].map(([lbl,p,c,t],idx) => `
                <tr style="background:${idx%2===0?'#f8f9fa':'#fff'}">
                  <td style="padding:5px 12px;border:1px solid #ddd;font-weight:600">${lbl}</td>
                  <td style="padding:5px 12px;border:1px solid #ddd;text-align:right">${sfmt(p)}</td>
                  <td style="padding:5px 12px;border:1px solid #ddd;text-align:right">${sfmt(c)}</td>
                  <td style="padding:5px 12px;border:1px solid #ddd;text-align:right">${sfmt(t)}</td>
                </tr>`).join('')}
              <tr style="background:#e3f2fd;font-weight:700">
                <td style="padding:5px 12px;border:1px solid #ddd">Total :</td>
                <td style="padding:5px 12px;border:1px solid #ddd;text-align:right">${sfmt(sm.pending?.total)}</td>
                <td style="padding:5px 12px;border:1px solid #ddd;text-align:right">${sfmt(sm.clear?.total)}</td>
                <td style="padding:5px 12px;border:1px solid #ddd;text-align:right">${sfmt(sm.total?.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
      const wrap = document.getElementById('rpt-result');
      if (wrap) wrap.innerHTML += `
        <div style="margin-top:16px">
          <div style="font-weight:700;font-size:12px;margin-bottom:6px;color:var(--accent)">AMOUNT RECEIVED AS ON DATE</div>
          ${summaryHtml}
        </div>`;
    } catch(err) { Utils.error(err.message); }
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
      const pid = this._f('project');
      const params = {};
      if (pid) params.projectId = pid;
      const res = await Api.get('/reports/conveyance-deed-date', { params });
      const rows = res.data || [];
      this._lastData = rows;
      if (!rows.length) { if (el) el.innerHTML = '<div class="empty-state"><h3>No records found</h3></div>'; return; }
      const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—';
      const fmtA = v => v != null && v !== '' ? '₹' + Number(v).toLocaleString('en-IN',{maximumFractionDigits:0}) : '—';
      const badge = s => {
        const cls = s === 'completed' ? 'badge-success' : s === 'scheduled' ? 'badge-warning' : 'badge-info';
        return `<span class="badge ${cls}">${s || '—'}</span>`;
      };
      const aC = 'text-align:center';
      const bodyRows = rows.map((r, i) => `<tr>
        <td style="${aC}">${i+1}</td>
        <td style="font-weight:600">${r.consumer_name || '—'}</td>
        <td>${r.registration_no || '—'}</td>
        <td>${r.project_name || '—'}</td>
        <td>${r.tower_name || '—'}</td>
        <td>${r.unit_number || '—'}</td>
        <td>${fmtDate(r.appointment_date)}</td>
        <td>${fmtDate(r.registry_date)}</td>
        <td>${r.deed_no || '—'}</td>
        <td style="text-align:right">${fmtA(r.stamp_duty_amount)}</td>
        <td style="${aC}">${badge(r.status)}</td>
        <td>${r.remarks || '—'}</td>
      </tr>`);
      this._table(
        ['#','CONSUMER','REG NO','PROJECT','TOWER','UNIT','APPT DATE','REGISTRY DATE','DEED NO','STAMP DUTY','STATUS','REMARKS'],
        bodyRows
      );
      const wrap = document.getElementById('rpt-result');
      if (wrap) wrap.innerHTML = `<div class="cb-wrap">${wrap.innerHTML}</div>`;
    } catch (err) { Utils.error(err.message); }
  },

  async loadPaymentFile() {
    // Load brokers for dropdown
    let brokerOptions = '<option value="">— All —</option>';
    try {
      const br = await Api.get('/brokers', { params: { pageSize: 200 } });
      const brokers = br.data || br || [];
      brokerOptions += brokers.map(b =>
        `<option value="${b.id}">${b.firm_name || b.name || '—'}</option>`
      ).join('');
    } catch {}

    const projOpts = '<option value="">— Select —</option>' +
      this._projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

    const bhkOpts = ['— All —','Studio','1BHK','2BHK','3BHK','4BHK']
      .map((v,i) => `<option value="${i===0?'':v}">${v}</option>`).join('');

    const floorOpts = ['— All —',...Array.from({length:20},(_,i)=>`${i+1}`)]
      .map((v,i) => `<option value="${i===0?'':v}">${i===0?v:v+'th Floor'}</option>`).join('');

    const classOpts = ['— All —','General','NRI','Investor','Corporate']
      .map((v,i) => `<option value="${i===0?'':v}">${v}</option>`).join('');

    const loanOpts = '<option value="">— All —</option><option value="self">Self</option><option value="loan">Loan</option>';

    const filterTypeOpts = '<option value="total_sale">Total Sale Value</option><option value="basic">Basic Price</option>';

    this._main(`
      <style>
        .apf-filters{background:var(--card-bg);border:1px solid var(--border);border-radius:6px;padding:14px 16px;margin-bottom:10px}
        .apf-filters .sp-title{font-size:13px;font-weight:700;color:var(--accent);letter-spacing:.5px;margin-bottom:12px;text-transform:uppercase}
        .apf-filter-row{display:grid;gap:8px;margin-bottom:8px}
        .apf-filter-row.r1{grid-template-columns:repeat(6,1fr)}
        .apf-filter-row.r2{grid-template-columns:repeat(6,1fr)}
        .apf-filter-row.r3{grid-template-columns:1fr 1fr 1fr 2fr 1.5fr 1.5fr}
        .apf-fg label{display:block;font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:3px;white-space:nowrap}
        .apf-fg input,.apf-fg select{width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:4px;font-size:12px;background:var(--input-bg);color:var(--text-primary)}
        .apf-date-range{display:flex;align-items:center;gap:4px}
        .apf-date-range input{flex:1}
        .apf-date-range span{color:var(--text-muted);font-size:12px;white-space:nowrap}
        .apf-action-bar{display:flex;align-items:center;gap:10px;margin-top:10px;flex-wrap:wrap}
        .apf-count-bar{display:flex;align-items:center;justify-content:space-between;margin:10px 0 6px;padding:6px 2px}
        .apf-count-text{font-size:13px;font-weight:700;color:var(--accent)}
        .apf-count-text span{color:#dc3545;font-weight:800;font-size:15px}
        .apf-icons{display:flex;gap:8px}
        .apf-icon-btn{background:none;border:none;cursor:pointer;font-size:18px;color:var(--text-primary);padding:4px;border-radius:4px;transition:background .15s}
        .apf-icon-btn:hover{background:var(--hover-bg)}
        #rpt-main{min-width:0;overflow-x:hidden}
        .apf-scroll-container{overflow-x:auto;overflow-y:auto;max-height:68vh;border:1px solid var(--border);border-radius:4px}
        .apf-table{width:100%;border-collapse:collapse;font-size:11px;min-width:3200px}
        .apf-table thead{position:sticky;top:0;z-index:10}
        .apf-table thead tr:first-child th{background:#1e3a5f;color:#fff;font-weight:700;font-size:12px;padding:7px 5px;text-align:center;border:1px solid #2d4d7a;white-space:nowrap}
        .apf-table thead tr:last-child th{background:#2d5282;color:#fff;font-weight:700;font-size:10px;padding:5px 4px;text-align:center;border:1px solid #3a6194;white-space:nowrap}
        .apf-table tbody tr:nth-child(even){background:#f8f9fa}
        .apf-table tbody tr:nth-child(odd){background:#fff}
        .apf-table tbody tr:hover{background:#e3f2fd}
        .apf-table tbody td{padding:4px 5px;border:1px solid #dee2e6;font-size:11px;white-space:nowrap;color:#333}
        .apf-table tfoot tr{background:#fef3cd;font-weight:700}
        .apf-table tfoot td{padding:5px 5px;border:1px solid #dee2e6;font-size:11px;white-space:nowrap}
        .apf-consumer-link{color:#1a56db;cursor:pointer;text-decoration:none}
        .apf-consumer-link:hover{text-decoration:underline}
        .apf-rec-btn{display:block;margin:3px auto 0;background:#1db5a0;color:#fff;border:none;padding:2px 7px;border-radius:3px;cursor:pointer;font-size:10px;font-weight:700;letter-spacing:.3px;white-space:nowrap}
        .apf-rec-btn:hover{background:#16a085}
        [data-theme="dark"] .apf-table tbody tr:nth-child(even){background:#1e2432}
        [data-theme="dark"] .apf-table tbody tr:nth-child(odd){background:#181e2c}
        [data-theme="dark"] .apf-table tbody tr:hover{background:#1a2a45}
        [data-theme="dark"] .apf-table tbody td{color:#d1d5db;border-color:#374151}
        [data-theme="dark"] .apf-table tfoot tr{background:#3b3009}
        [data-theme="dark"] .apf-table tfoot td{border-color:#374151}
        @media print{.apf-filters,.apf-action-bar,.apf-icon-btn{display:none!important}.apf-scroll-container{max-height:none!important;overflow:visible!important}}
      </style>

      <div class="apf-filters">
        <div class="sp-title">APPLICANT PAYMENT FILE</div>

        <!-- ROW 1 -->
        <div class="apf-filter-row r1">
          <div class="apf-fg">
            <label>*Project</label>
            <select id="apf-project" onchange="ReportsPage._apfLoadTowers()">${projOpts}</select>
          </div>
          <div class="apf-fg">
            <label>Unit Type</label>
            <select id="apf-bhk">${bhkOpts}</select>
          </div>
          <div class="apf-fg">
            <label>Plan</label>
            <input type="text" id="apf-plan" placeholder="— All —">
          </div>
          <div class="apf-fg">
            <label>Broker</label>
            <select id="apf-broker">${brokerOptions}</select>
          </div>
          <div class="apf-fg">
            <label>Tower</label>
            <select id="apf-tower"><option value="">— All —</option></select>
          </div>
          <div class="apf-fg">
            <label>Floor</label>
            <select id="apf-floor">${floorOpts}</select>
          </div>
        </div>

        <!-- ROW 2 -->
        <div class="apf-filter-row r2">
          <div class="apf-fg">
            <label>Customer Classification</label>
            <select id="apf-cust-class">${classOpts}</select>
          </div>
          <div class="apf-fg">
            <label>Employee</label>
            <input type="text" id="apf-employee" placeholder="— All —">
          </div>
          <div class="apf-fg">
            <label>Type</label>
            <select id="apf-loan-type">${loanOpts}</select>
          </div>
          <div class="apf-fg">
            <label>Location</label>
            <input type="text" id="apf-location" placeholder="— All —">
          </div>
          <div class="apf-fg">
            <label>Registry</label>
            <select id="apf-registry"><option value="">— All —</option></select>
          </div>
          <div class="apf-fg">
            <label>Registration No.</label>
            <input type="text" id="apf-reg-no" placeholder="Registration No.">
          </div>
        </div>

        <!-- ROW 3 -->
        <div class="apf-filter-row r3">
          <div class="apf-fg">
            <label>Name</label>
            <input type="text" id="apf-name" placeholder="Name">
          </div>
          <div class="apf-fg">
            <label>Unit No.</label>
            <input type="text" id="apf-unit-no" placeholder="Unit No.">
          </div>
          <div class="apf-fg">
            <label>Form No.</label>
            <input type="text" id="apf-form-no" placeholder="Form No.">
          </div>
          <div class="apf-fg">
            <label>Booking Date</label>
            <div class="apf-date-range">
              <input type="date" id="apf-booking-from" placeholder="From Date">
              <span>-</span>
              <input type="date" id="apf-booking-to" placeholder="To Date">
            </div>
          </div>
          <div class="apf-fg">
            <label>Filter Type</label>
            <select id="apf-filter-type">${filterTypeOpts}</select>
          </div>
          <div class="apf-fg">
            <label>Due As On Date</label>
            <input type="date" id="apf-due-as-on" placeholder="As On Date">
          </div>
        </div>

        <div class="apf-action-bar">
          <button class="btn btn-primary" onclick="ReportsPage.fetchPaymentFile()">FETCH</button>
        </div>
      </div>

      <!-- Count bar (hidden until fetch) -->
      <div id="apf-count-bar" class="apf-count-bar" style="display:none">
        <div class="apf-count-text">TOTAL NO. OF CUSTOMERS: <span id="apf-total-count">0</span></div>
        <div class="apf-icons">
          <button class="apf-icon-btn" title="Print" onclick="window.print()">🖨️</button>
          <button class="apf-icon-btn" title="Download CSV" onclick="ReportsPage.exportApfCsv()">⬇️</button>
        </div>
      </div>

      <div id="apf-result"><div class="empty-state"><h3>Select a project and click FETCH</h3></div></div>
    `);
  },

  async _apfLoadTowers() {
    const projectId = document.getElementById('apf-project')?.value;
    const sel = document.getElementById('apf-tower');
    if (!sel) return;
    sel.innerHTML = '<option value="">— All —</option>';
    if (!projectId) return;
    try {
      const res = await Api.get(`/projects/${projectId}/towers`);
      const towers = res.data || res || [];
      towers.forEach(t => {
        const o = document.createElement('option');
        o.value = t.id; o.textContent = t.tower_name;
        sel.appendChild(o);
      });
    } catch {}
  },

  async fetchPaymentFile() {
    const g = id => document.getElementById(id)?.value || '';
    const projectId   = g('apf-project');
    const towerId     = g('apf-tower');
    const bhkType     = g('apf-bhk');
    const planName    = g('apf-plan');
    const brokerId    = g('apf-broker');
    const floor       = g('apf-floor');
    const custClass   = g('apf-cust-class');
    const selfOrLoan  = g('apf-loan-type');
    const regNo       = g('apf-reg-no');
    const name        = g('apf-name');
    const unitNo      = g('apf-unit-no');
    const formNo      = g('apf-form-no');
    const bookFrom    = g('apf-booking-from');
    const bookTo      = g('apf-booking-to');
    const dueAsOn     = g('apf-due-as-on');

    const p = new URLSearchParams();
    if (projectId)  p.append('projectId',              projectId);
    if (towerId)    p.append('towerId',                towerId);
    if (bhkType)    p.append('bhkType',                bhkType);
    if (planName)   p.append('planName',               planName);
    if (brokerId)   p.append('brokerId',               brokerId);
    if (floor)      p.append('floor',                  floor);
    if (custClass)  p.append('customerClassification', custClass);
    if (selfOrLoan) p.append('selfOrLoan',             selfOrLoan);
    if (regNo)      p.append('registrationNo',         regNo);
    if (name)       p.append('name',                   name);
    if (unitNo)     p.append('unitNo',                 unitNo);
    if (formNo)     p.append('formNo',                 formNo);
    if (bookFrom)   p.append('bookingFromDate',        bookFrom);
    if (bookTo)     p.append('bookingToDate',          bookTo);
    if (dueAsOn)    p.append('dueAsOnDate',            dueAsOn);
    p.append('pageSize', '500');

    const result = document.getElementById('apf-result');
    if (result) result.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

    try {
      const res = await Api.get('/reports/applicant-payment-file?' + p.toString());
      const json = res.success !== undefined ? res : { data: res.data || res, total: (res.data||res||[]).length };
      const data = json.data || [];

      // Store for CSV export
      this._apfData = data;

      // Update count
      const countEl = document.getElementById('apf-total-count');
      if (countEl) countEl.textContent = json.total ?? data.length;
      const countBar = document.getElementById('apf-count-bar');
      if (countBar) countBar.style.display = 'flex';

      if (!data.length) {
        if (result) result.innerHTML = '<div class="empty-state"><h3>No records found</h3><p>Adjust filters and try again</p></div>';
        return;
      }

      // Compute totals
      const totals = data.reduce((acc, r) => {
        const n = f => parseFloat(r[f] || 0);
        acc.base_price_inr      += n('base_price_inr');
        acc.total_discount      += n('total_discount');
        acc.net_basic_price     += n('net_basic_price');
        acc.plc_amount          += n('plc_amount');
        acc.other_charge_amount += n('other_charge_amount');
        acc.total_unit_cost     += n('total_unit_cost');
        acc.cost_cgst_amount    += n('cost_cgst_amount');
        acc.cost_sgst_amount    += n('cost_sgst_amount');
        acc.total_cost_with_gst += n('total_cost_with_gst');
        acc.dues_amount         += n('dues_amount');
        acc.dues_cgst           += n('dues_cgst');
        acc.dues_sgst           += n('dues_sgst');
        acc.dues_total          += n('dues_total');
        acc.received_amount     += n('received_amount');
        acc.interest_received   += n('interest_received');
        acc.outstanding_amount  += n('outstanding_amount');
        acc.interest_charged    += n('interest_charged');
        acc.interest_waived     += n('interest_waived');
        acc.interest_outstanding += n('interest_outstanding');
        return acc;
      }, {
        base_price_inr:0, total_discount:0, net_basic_price:0,
        plc_amount:0, other_charge_amount:0, total_unit_cost:0,
        cost_cgst_amount:0, cost_sgst_amount:0, total_cost_with_gst:0,
        dues_amount:0, dues_cgst:0, dues_sgst:0, dues_total:0,
        received_amount:0, interest_received:0, outstanding_amount:0,
        interest_charged:0, interest_waived:0, interest_outstanding:0,
      });

      const rows  = data.map((row, i) => this._apfRow(row, i));
      const tfoot = this._apfTotalsRow(totals, data.length);

      if (result) result.innerHTML = `
        <div class="apf-scroll-container">
          <table class="apf-table">
            <thead>
              <tr>
                <th rowspan="2" style="min-width:42px">S.NO.</th>
                <th colspan="17" class="group-header">CUSTOMER DETAILS</th>
                <th colspan="11" class="group-header">COST</th>
                <th colspan="5"  class="group-header">DUES</th>
                <th colspan="6"  class="group-header">RECEIVED</th>
                <th colspan="5"  class="group-header">CREDIT</th>
                <th colspan="5"  class="group-header">OUTSTANDING</th>
                <th colspan="6"  class="group-header">INTEREST</th>
              </tr>
              <tr>
                <th>REG. NO.</th><th>NAME</th><th>BOOKING DATE</th><th>MOBILE NO.</th>
                <th>EMAIL</th><th>ALLOTMENT DATE</th><th>UNIT TYPE</th><th>TOWER</th>
                <th>FLOOR</th><th>UNIT NO.</th><th>PLAN</th><th>CUSTOMER CLASS.</th>
                <th>MAIN BROKER</th><th>LOAN</th><th>BANK</th>
                <th>SUPER AREA (SQ.FT.)</th><th>AREA (SQ.FT.)</th>
                <th>RATE</th><th>BASIC PRICE</th><th>DISCOUNT</th><th>NET BASIC PRICE</th>
                <th>PLC</th><th>OTHER CHARGE</th><th>TOTAL UNIT COST</th>
                <th>CGST</th><th>SGST</th><th>ITC</th><th>TOTAL</th>
                <th>AMOUNT</th><th>CGST</th><th>SGST</th><th>ITC</th><th>TOTAL</th>
                <th>AMOUNT</th><th>CGST</th><th>SGST</th><th>ITC</th><th>TOTAL</th><th>(%)</th>
                <th>AMOUNT</th><th>S.TAX</th><th>CGST</th><th>SGST</th><th>TOTAL</th>
                <th>AMOUNT</th><th>S.TAX</th><th>CGST</th><th>SGST</th><th>TOTAL</th>
                <th>INTEREST</th><th>WAIVED</th><th>NET INTEREST</th><th>RECEIVED</th><th>OUTSTANDING</th><th>RECEIVED GST</th>
              </tr>
            </thead>
            <tbody>${rows.join('')}</tbody>
            <tfoot>${tfoot}</tfoot>
          </table>
        </div>
      `;

    } catch (err) {
      if (result) result.innerHTML = `<div class="empty-state"><h3>Error loading data</h3><p>${err.message}</p></div>`;
      Utils.error('Failed to load payment file: ' + err.message);
    }
  },

  _apfFmt(n) {
    const v = parseFloat(n || 0);
    return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  _apfDate(d) {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }); }
    catch { return '—'; }
  },

  _apfRow(r, i) {
    const f  = v => this._apfFmt(v);
    const dt = v => this._apfDate(v);
    const n  = v => parseFloat(v || 0);

    const recTotal   = n(r.received_amount);
    const recCgst    = recTotal > 0 ? parseFloat((recTotal * 0.005 / 1.01).toFixed(2)) : 0;
    const recSgst    = recCgst;
    const recWithGst = recTotal;
    const recPct     = n(r.received_amount) > 0 && n(r.total_unit_cost) > 0
      ? (n(r.received_amount) / n(r.total_unit_cost) * 100) : 0;
    const outstanding = n(r.outstanding_amount);
    const outColor   = outstanding > 0 ? '#dc3545' : '#28a745';
    const pctColor   = recPct >= 100 ? '#28a745' : '#333';

    const loanStatus = r.self_or_loan === 'loan'
      ? (r.bank_name ? 'Loan Sanctioned' : 'Loan Pending')
      : (r.self_or_loan === 'self' ? 'Self' : '—');

    return `<tr>
      <td style="text-align:center">${i + 1}<button class="apf-rec-btn" onclick="ReportsPage.openReceiptForm('${r.consumer_id}')">REC</button></td>
      <td>${r.registration_no || '—'}</td>
      <td><a href="/api/consumers/${r.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" class="apf-consumer-link" style="color:var(--primary);text-decoration:underline;cursor:pointer" title="View Applicant File">${r.consumer_name || '—'}</a></td>
      <td>${dt(r.booking_date)}</td>
      <td>${r.mobile || '—'}</td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis">${r.email || '—'}</td>
      <td>${dt(r.allotment_date)}</td>
      <td>${r.bhk_type || '—'}</td>
      <td>${r.tower_name || '—'}</td>
      <td>${r.floor != null ? r.floor : '—'}</td>
      <td>${r.unit_number || '—'}</td>
      <td>${r.plan_name || '—'}</td>
      <td>${r.customer_classification || 'General'}</td>
      <td>${r.broker_name || 'Direct'}</td>
      <td>${loanStatus}</td>
      <td>${r.bank_name || '—'}</td>
      <td style="text-align:right">${f(r.super_area_sqft)}</td>
      <td style="text-align:right">${f(r.carpet_area_sqft)}</td>
      <td style="text-align:right">${f(r.rate_per_sqft)}</td>
      <td style="text-align:right">${f(r.base_price_inr)}</td>
      <td style="text-align:right">${f(r.total_discount)}</td>
      <td style="text-align:right">${f(r.net_basic_price)}</td>
      <td style="text-align:right">${f(r.plc_amount)}</td>
      <td style="text-align:right">${f(r.other_charge_amount)}</td>
      <td style="text-align:right">${f(r.total_unit_cost)}</td>
      <td style="text-align:right">${f(r.cost_cgst_amount)}</td>
      <td style="text-align:right">${f(r.cost_sgst_amount)}</td>
      <td style="text-align:right">0.00</td>
      <td style="text-align:right">${f(r.total_cost_with_gst)}</td>
      <td style="text-align:right">${f(r.dues_amount)}</td>
      <td style="text-align:right">${f(r.dues_cgst)}</td>
      <td style="text-align:right">${f(r.dues_sgst)}</td>
      <td style="text-align:right">0.00</td>
      <td style="text-align:right">${f(r.dues_total)}</td>
      <td style="text-align:right">${f(recTotal)}</td>
      <td style="text-align:right">${f(recCgst)}</td>
      <td style="text-align:right">${f(recSgst)}</td>
      <td style="text-align:right">0.00</td>
      <td style="text-align:right">${f(recWithGst)}</td>
      <td style="text-align:right;color:${pctColor}">${recPct.toFixed(2)}%</td>
      <td style="text-align:right">0.00</td>
      <td style="text-align:right">0.00</td>
      <td style="text-align:right">0.00</td>
      <td style="text-align:right">0.00</td>
      <td style="text-align:right">0.00</td>
      <td style="text-align:right;color:${outColor}">${f(outstanding)}</td>
      <td style="text-align:right">0.00</td>
      <td style="text-align:right">0.00</td>
      <td style="text-align:right">0.00</td>
      <td style="text-align:right;color:${outColor}">${f(outstanding)}</td>
      <td style="text-align:right">${f(r.interest_charged)}</td>
      <td style="text-align:right">${f(r.interest_waived)}</td>
      <td style="text-align:right">${f(r.interest_charged - r.interest_waived)}</td>
      <td style="text-align:right">${f(r.interest_received)}</td>
      <td style="text-align:right">${f(r.interest_outstanding)}</td>
      <td style="text-align:right">0.00</td>
    </tr>`;
  },

  _apfTotalsRow(t, count) {
    const f = v => this._apfFmt(v);
    const blank = '<td></td>';
    const B = n => `<td style="text-align:right;font-weight:700">${f(n)}</td>`;
    return `<tr>
      <td colspan="2" style="text-align:center;font-weight:700">TOTAL (${count})</td>
      ${blank.repeat(15)}
      <td></td><td></td>
      ${B(t.base_price_inr)}
      ${B(t.total_discount)}
      ${B(t.net_basic_price)}
      ${B(t.plc_amount)}
      ${B(t.other_charge_amount)}
      ${B(t.total_unit_cost)}
      ${B(t.cost_cgst_amount)}
      ${B(t.cost_sgst_amount)}
      <td style="text-align:right">0.00</td>
      ${B(t.total_cost_with_gst)}
      ${B(t.dues_amount)}
      ${B(t.dues_cgst)}
      ${B(t.dues_sgst)}
      <td style="text-align:right">0.00</td>
      ${B(t.dues_total)}
      ${B(t.received_amount)}
      <td style="text-align:right">0.00</td>
      <td style="text-align:right">0.00</td>
      <td style="text-align:right">0.00</td>
      ${B(t.received_amount)}
      <td style="text-align:right"></td>
      ${blank.repeat(5)}
      ${B(t.outstanding_amount)}
      <td style="text-align:right">0.00</td>
      <td style="text-align:right">0.00</td>
      <td style="text-align:right">0.00</td>
      ${B(t.outstanding_amount)}
      ${B(t.interest_charged)}
      ${B(t.interest_waived)}
      ${B(t.interest_charged - t.interest_waived)}
      ${B(t.interest_received)}
      ${B(t.interest_outstanding)}
      <td style="text-align:right">0.00</td>
    </tr>`;
  },

  exportApfCsv() {
    const data = this._apfData;
    if (!data || !data.length) { Utils.warn('No data to export'); return; }

    const cols = [
      'S.NO.','REG. NO.','NAME','BOOKING DATE','MOBILE NO.','EMAIL','ALLOTMENT DATE',
      'UNIT TYPE','TOWER','FLOOR','UNIT NO.','PLAN','CUSTOMER CLASS.','MAIN BROKER',
      'LOAN','BANK','SUPER AREA (SQ.FT.)','AREA (SQ.FT.)',
      'RATE','BASIC PRICE','DISCOUNT','NET BASIC PRICE','PLC','OTHER CHARGE',
      'TOTAL UNIT COST','CGST (COST)','SGST (COST)','ITC (COST)','TOTAL (COST)',
      'DUES AMOUNT','DUES CGST','DUES SGST','DUES ITC','DUES TOTAL',
      'RECEIVED AMOUNT','REC CGST','REC SGST','REC ITC','REC TOTAL','RECEIVED %',
      'CREDIT AMOUNT','CREDIT S.TAX','CREDIT CGST','CREDIT SGST','CREDIT TOTAL',
      'OUTSTANDING','OUT S.TAX','OUT CGST','OUT SGST','OUT TOTAL',
      'INTEREST','INT RECEIVED','INT OUTSTANDING','INT GST',
    ];

    const dt = v => v ? new Date(v).toLocaleDateString('en-GB') : '';
    const n  = v => parseFloat(v || 0);
    const pct = r => n(r.received_amount) > 0 && n(r.total_unit_cost) > 0
      ? (n(r.received_amount) / n(r.total_unit_cost) * 100).toFixed(2) : '0.00';

    const rows = data.map((r, i) => [
      i+1, r.registration_no, r.consumer_name, dt(r.booking_date), r.mobile, r.email,
      dt(r.allotment_date), r.bhk_type, r.tower_name, r.floor, r.unit_number, r.plan_name,
      r.customer_classification, r.broker_name,
      r.self_or_loan === 'loan' ? 'Loan' : 'Self', r.bank_name,
      n(r.super_area_sqft), n(r.carpet_area_sqft),
      n(r.rate_per_sqft), n(r.base_price_inr), n(r.total_discount), n(r.net_basic_price),
      n(r.plc_amount), n(r.other_charge_amount), n(r.total_unit_cost),
      n(r.cost_cgst_amount), n(r.cost_sgst_amount), 0, n(r.total_cost_with_gst),
      n(r.dues_amount), n(r.dues_cgst), n(r.dues_sgst), 0, n(r.dues_total),
      n(r.received_amount), 0, 0, 0, n(r.received_amount), pct(r),
      0, 0, 0, 0, 0,
      n(r.outstanding_amount), 0, 0, 0, n(r.outstanding_amount),
      0, n(r.interest_received), 0, 0,
    ]);

    let csv = cols.map(c => `"${c}"`).join(',') + '\n';
    rows.forEach(row => {
      csv += row.map(v => `"${String(v === null || v === undefined ? '' : v).replace(/"/g,'""')}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'Applicant_Payment_File.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  async openReceiptForm(consumerId) {
    const token = Auth.getToken() || localStorage.getItem('rof-jwt') || '';
    try {
      const res = await fetch(`/api/payments/receipt-form/${consumerId}?token=${encodeURIComponent(token)}`, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        Utils.error('Could not load receipt form: ' + (err.error || res.statusText));
        return;
      }
      const html = await res.text();
      const blob = new Blob([html], { type: 'text/html' });
      const url  = URL.createObjectURL(blob);
      const win  = window.open(url, '_blank', 'width=1200,height=720,resizable=yes,scrollbars=yes');
      if (win) {
        win.addEventListener('load', () => setTimeout(() => URL.revokeObjectURL(url), 60000));
      } else {
        URL.revokeObjectURL(url);
        Utils.warn('Popup blocked — please allow popups for this site.');
      }
    } catch (err) {
      Utils.error('Failed to open receipt form: ' + err.message);
    }
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
      const projectId = this._f('project');
      const res = await Api.get('/reports/opening-details', {
        params: projectId ? { projectId } : {},
      });
      const body = res.data || res || {};
      const rows = (body.data || body || []);
      this._lastData = rows;

      const fmtDate = (d) => {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      };
      const fmtAmt = (v) => v != null ? '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—';
      const fmtR = (a, r) => typeof a === 'function' ? a(r) : (r[a] || '—');

      this._table(
        ['#', 'Consumer Name', 'Reg. No.', 'Mobile', 'Project', 'Tower', 'Unit', 'Booking Date', 'Booking Amount'],
        rows.map((r, i) => `<tr>
          <td style="color:var(--text3)">${i + 1}</td>
          <td class="td-bold"><a href="/api/consumers/${r.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" onclick="event.stopPropagation()" style="color:var(--primary);text-decoration:underline;cursor:pointer" title="View Applicant File">${(r.consumer_name || '').trim() || '—'}</a></td>
          <td>${r.registration_no || '—'}</td>
          <td>${r.mobile || '—'}</td>
          <td>${r.project_name || '—'}</td>
          <td>${r.tower_name || '—'}</td>
          <td>${r.unit_number || '—'}</td>
          <td>${fmtDate(r.booking_date)}</td>
          <td style="text-align:right">${fmtAmt(r.booking_amount)}</td>
        </tr>`),
        `<td></td><td colspan="7"><strong>Total: ${rows.length} records</strong></td><td style="text-align:right"><strong>${fmtAmt(rows.reduce((s, r) => s + parseFloat(r.booking_amount || 0), 0))}</strong></td>`
      );
    } catch (err) { Utils.error(err.message); }
  },

  loadBookingAuth() {
    this._main(this._filters('Booking Authentication', [
      { id:'project', type:'select', label:'Project',   options: this._projectOptions() },
      { id:'from',    type:'date',   label:'From Date', value: Utils.monthStart() },
      { id:'to',      type:'date',   label:'To Date',   value: Utils.today() },
    ], 'fetchBookingAuth'));
  },

  async fetchBookingAuth() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const res = await Api.get('/reports/booking-authentication', { params: {
        projectId: this._f('project') || undefined,
        fromDate:  this._f('from')    || undefined,
        toDate:    this._f('to')      || undefined,
      }});
      const body = res.data || res || {};
      const rows = Array.isArray(body) ? body : (body.data || []);
      this._lastData = rows;

      const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';
      const fmtAmt  = (v) => v != null ? '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—';

      this._table(
        ['#', 'Booking Date', 'Consumer', 'Reg. No.', 'Mobile', 'Project', 'Tower', 'Unit', 'BHK', 'Booking Amt', 'Mode', 'Auth By', 'Status', 'Remarks'],
        rows.map((r, i) => `<tr>
          <td style="color:var(--text3)">${i + 1}</td>
          <td>${fmtDate(r.booking_date)}</td>
          <td class="td-bold"><a href="/api/consumers/${r.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" onclick="event.stopPropagation()" style="color:var(--primary);text-decoration:underline;cursor:pointer" title="View Applicant File">${(r.consumer_name || '').trim() || '—'}</a></td>
          <td>${r.registration_no || '—'}</td>
          <td>${r.mobile || '—'}</td>
          <td>${r.project_name || '—'}</td>
          <td>${r.tower_name || '—'}</td>
          <td>${r.unit_number || '—'}</td>
          <td>${r.bhk_type || '—'}</td>
          <td style="text-align:right">${fmtAmt(r.booking_amount)}</td>
          <td>${r.payment_mode || '—'}</td>
          <td>${r.authenticated_by || '—'}</td>
          <td>${Utils.chip(r.status || 'active')}</td>
          <td style="color:var(--text3);font-size:11px">${r.remarks || '—'}</td>
        </tr>`),
        `<td></td><td colspan="8"><strong>${rows.length} records</strong></td>
         <td style="text-align:right"><strong>${fmtAmt(rows.reduce((s, r) => s + parseFloat(r.booking_amount || 0), 0))}</strong></td>
         <td colspan="4"></td>`
      );
    } catch (err) { Utils.error(err.message); }
  },

  loadTdsStatus() {
    this._main(this._filters('TDS Status Report', [
      { id:'project',        type:'select', label:'Project',        options: this._projectOptions() },
      { id:'financial-year', type:'select', label:'Financial Year', options: '<option value="">All</option><option value="2024-25">2024-25</option><option value="2025-26" selected>2025-26</option><option value="2026-27">2026-27</option>' },
      { id:'quarter',        type:'select', label:'Quarter',        options: '<option value="">All</option><option value="Q1">Q1</option><option value="Q2">Q2</option><option value="Q3">Q3</option><option value="Q4">Q4</option>' },
      { id:'tds-status',     type:'select', label:'Status',         options: '<option value="">All</option><option value="filed">Filed</option><option value="pending">Pending</option>' },
    ], 'fetchTdsStatus'));
  },

  async fetchTdsStatus() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const res = await Api.get('/reports/tds-status', { params: {
        projectId:     this._f('project')        || undefined,
        financialYear: this._f('financial-year') || undefined,
        quarter:       this._f('quarter')        || undefined,
        status:        this._f('tds-status')     || undefined,
      }});
      const body = res.data || res || {};
      const rows = Array.isArray(body) ? body : (body.data || []);
      this._lastData = rows;

      const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';
      const fmtAmt  = (v) => v != null ? '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—';
      const statusChip = (s) => {
        const color = s === 'filed' ? 'var(--green)' : s === 'pending' ? 'var(--amber)' : 'var(--text3)';
        return `<span style="background:${color}20;color:${color};padding:2px 7px;border-radius:10px;font-size:11px;font-weight:600">${(s||'pending').toUpperCase()}</span>`;
      };

      this._table(
        ['#', 'Consumer', 'Reg. No.', 'Project', 'Tower', 'Unit', 'BHK', 'Booking Amt', 'TDS @1%', 'Challan No.', 'Challan Date', 'TDS Paid', 'FY', 'Qtr', 'Status'],
        rows.map((r, i) => `<tr>
          <td style="color:var(--text3)">${i + 1}</td>
          <td class="td-bold"><a href="/api/consumers/${r.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" onclick="event.stopPropagation()" style="color:var(--primary);text-decoration:underline;cursor:pointer" title="View Applicant File">${(r.consumer_name || '').trim() || '—'}</a></td>
          <td>${r.registration_no || '—'}</td>
          <td>${r.project_name || '—'}</td>
          <td>${r.tower_name || '—'}</td>
          <td>${r.unit_number || '—'}</td>
          <td>${r.bhk_type || '—'}</td>
          <td style="text-align:right">${fmtAmt(r.booking_amount)}</td>
          <td style="text-align:right">${fmtAmt(r.tds_applicable)}</td>
          <td style="font-size:11px">${r.challan_number || '<em style="color:var(--text3)">Not Filed</em>'}</td>
          <td>${fmtDate(r.challan_date)}</td>
          <td style="text-align:right">${fmtAmt(r.tds_paid)}</td>
          <td>${r.financial_year || '—'}</td>
          <td>${r.quarter || '—'}</td>
          <td>${statusChip(r.status)}</td>
        </tr>`),
        `<td></td><td colspan="6"><strong>${rows.length} records</strong></td>
         <td style="text-align:right"><strong>${fmtAmt(rows.reduce((s, r) => s + parseFloat(r.booking_amount || 0), 0))}</strong></td>
         <td style="text-align:right"><strong>${fmtAmt(rows.reduce((s, r) => s + parseFloat(r.tds_applicable || 0), 0))}</strong></td>
         <td colspan="2"></td>
         <td style="text-align:right"><strong>${fmtAmt(rows.reduce((s, r) => s + parseFloat(r.tds_paid || 0), 0))}</strong></td>
         <td colspan="3"></td>`
      );
    } catch (err) { Utils.error(err.message); }
  },

  loadOtherChargeReport() {
    this._main(`
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Other Charge Report</div></div>
        <div class="sp-body">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
            <div class="fg" style="flex:1;min-width:150px">
              <label class="fl">Project</label>
              <select class="fc" id="f-project" onchange="ReportsPage._ocLoadTowers()">${this._projectOptions()}</select>
            </div>
            <div class="fg" style="flex:1;min-width:130px">
              <label class="fl">Tower</label>
              <select class="fc" id="f-tower"><option value="">&lt;--All--&gt;</option></select>
            </div>
            <div class="fg" style="min-width:120px">
              <label class="fl">Charge Type</label>
              <select class="fc" id="f-chargetype">
                <option value="all">All</option>
                <option value="plc">PLC</option>
                <option value="edc">EDC</option>
                <option value="idc">IDC</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div style="margin-bottom:2px;display:flex;gap:8px">
              <button class="btn btn-primary" onclick="ReportsPage.fetchOtherChargeReport()">FETCH</button>
              <button class="btn btn-ghost" onclick="ReportsPage.exportCsv('Other_Charges.csv')">Export CSV</button>
            </div>
          </div>
        </div>
      </div>
      <div id="rpt-kpis" style="display:grid;gap:12px;margin-bottom:12px"></div>
      <div id="rpt-result"><div class="empty-state"><h3>Apply filters and click FETCH</h3></div></div>
    `);
  },

  async _ocLoadTowers() {
    const pid = document.getElementById('f-project')?.value;
    const sel = document.getElementById('f-tower');
    if (!sel) return;
    sel.innerHTML = '<option value="">&lt;--All--&gt;</option>';
    if (!pid) return;
    try {
      const res = await Api.get('/units/towers', { params: { projectId: pid } });
      const towers = res.data || res || [];
      towers.forEach(t => { const o=document.createElement('option'); o.value=t.id; o.textContent=t.tower_name; sel.appendChild(o); });
    } catch(_) {}
  },

  async fetchOtherChargeReport() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const params = {};
      const pid = document.getElementById('f-project')?.value;
      const tid = document.getElementById('f-tower')?.value;
      const ct  = document.getElementById('f-chargetype')?.value || 'all';
      if (pid) params.projectId  = pid;
      if (tid) params.towerId    = tid;
      if (ct)  params.chargeType = ct;
      const res  = await Api.get('/reports/other-charges', { params });
      const body = res;
      const rows = body.data   || [];
      const tot  = body.totals || {};
      this._lastData = rows.map(r => ({
        'Reg No': r.registration_no||'', 'Name': r.consumer_name, 'Project': r.project_name,
        'Tower': r.tower_name||'', 'Unit No': r.unit_number, 'Unit Type': r.bhk_type||'',
        'Booking PLC': parseFloat(r.booking_plc||0), 'Booking Other': parseFloat(r.booking_other||0),
        'Other Desc': r.other_charge_desc||'', 'Received PLC': parseFloat(r.received_plc||0),
        'Received EDC': parseFloat(r.received_edc||0), 'Received IDC': parseFloat(r.received_idc||0),
        'Received Other': parseFloat(r.received_other||0), 'Total Addon': parseFloat(r.total_addon_received||0),
      }));
      const fmtA = v => '₹' + parseFloat(v||0).toLocaleString('en-IN',{maximumFractionDigits:0});
      const aR = 'text-align:right'; const aC = 'text-align:center';
      this._kpis([
        { label:'BOOKING PLC',  value: fmtA(tot.booking_plc),          color:'var(--accent)' },
        { label:'RECEIVED PLC', value: fmtA(tot.received_plc),         color:'#198754' },
        { label:'TOTAL ADDONS', value: fmtA(tot.total_addon_received),  color:'var(--accent)' },
      ]);
      const kpiEl = document.getElementById('rpt-kpis');
      if (kpiEl) kpiEl.style.gridTemplateColumns = 'repeat(3,1fr)';
      if (!rows.length) { if(el) el.innerHTML='<div class="empty-state"><h3>No records found</h3></div>'; return; }
      const bodyRows = rows.map((r,i) => {
        const nameLink = `<a href="/api/consumers/${r.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" style="color:var(--primary);text-decoration:underline;font-weight:600;cursor:pointer" title="View Applicant File">${r.consumer_name}</a>`;
        return `<tr style="${i%2===1?'background:var(--bg-row-alt,rgba(0,0,0,.03))':''}">
          <td style="${aC}">${i+1}</td><td>${r.registration_no||'—'}</td><td>${nameLink}</td>
          <td>${r.project_name}</td><td>${r.tower_name||'—'}</td><td>${r.unit_number}</td><td>${r.bhk_type||'—'}</td>
          <td style="${aR}">${fmtA(r.booking_plc)}</td><td style="${aR}">${fmtA(r.booking_other)}</td>
          <td>${r.other_charge_desc||'—'}</td>
          <td style="${aR};color:#198754">${fmtA(r.received_plc)}</td><td style="${aR}">${fmtA(r.received_edc)}</td>
          <td style="${aR}">${fmtA(r.received_idc)}</td><td style="${aR}">${fmtA(r.received_other)}</td>
          <td style="${aR};font-weight:700;color:#1a56db">${fmtA(r.total_addon_received)}</td>
        </tr>`;
      });
      const footRow = `<td></td><td></td><td style="font-weight:700">TOTAL</td><td></td><td></td><td></td><td></td>
        <td style="${aR};font-weight:700">${fmtA(tot.booking_plc)}</td>
        <td style="${aR};font-weight:700">${fmtA(tot.booking_other)}</td><td></td>
        <td style="${aR};font-weight:700;color:#198754">${fmtA(tot.received_plc)}</td>
        <td style="${aR};font-weight:700">${fmtA(tot.received_edc)}</td>
        <td style="${aR};font-weight:700">${fmtA(tot.received_idc)}</td>
        <td style="${aR};font-weight:700">${fmtA(tot.received_other)}</td>
        <td style="${aR};font-weight:700;color:#1a56db">${fmtA(tot.total_addon_received)}</td>`;
      this._table(['S.NO.','REG. NO.','NAME','PROJECT','TOWER','UNIT NO.','UNIT TYPE',
        'BOOKING PLC','BOOKING OTHER','OTHER DESC','RECEIVED PLC','RECEIVED EDC','RECEIVED IDC','RECEIVED OTHER','TOTAL ADDON RECEIVED'], bodyRows, footRow);
      const acEl = document.getElementById('rpt-result');
      if (acEl) acEl.innerHTML = `<div class="cb-wrap">${acEl.innerHTML}</div>`;
    } catch(err) { Utils.error(err.message); }
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

  await ReportsPage.init(tab, params);
  ReportsPage.loadSavedReports();
};

// ─────────────────────────────────────────────────────────────
// Document Edits Audit Trail Page
// ─────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS = {
  buyer_builder_agreement: 'Agreement for Sale',
  conveyance_deed:  'Conveyance Deed',
  demand_letter:    'Demand Letter',
  payment_receipt:  'Payment Receipt',
  allotment_letter: 'Allotment Letter',
  applicant_file:   'Applicant File',
  booking_form:     'Booking Form',
};
const DOC_TYPE_COLORS = {
  buyer_builder_agreement: '#0277bd',
  conveyance_deed:  '#c62828',
  demand_letter:    '#1565c0',
  payment_receipt:  '#00796b',
  allotment_letter: '#6a1b9a',
  applicant_file:   '#e65100',
  booking_form:     '#4527a0',
};

const EditsPage = {
  _data:    [],
  _total:   0,
  _page:    1,
  _pageSize: 50,
  _totalPages: 1,

  _fmtDatetime(dt) {
    if (!dt) return '—';
    const d = new Date(dt);
    return d.toLocaleDateString('en-GB') + ' ' +
           d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  },

  _typeBadge(dtype) {
    const label = DOC_TYPE_LABELS[dtype] || dtype;
    const color = DOC_TYPE_COLORS[dtype] || '#555';
    return `<span style="background:${color};color:#fff;padding:2px 8px;border-radius:2px;font-size:11px;font-weight:600;white-space:nowrap;letter-spacing:0.3px">${label}</span>`;
  },

  _truncate(str, len = 40) {
    if (!str) return '—';
    return str.length > len ? str.slice(0, len) + '…' : str;
  },

  _timeAgo(dt) {
    if (!dt) return '—';
    const secs = Math.floor((Date.now() - new Date(dt)) / 1000);
    if (secs < 60)   return secs + 's ago';
    if (secs < 3600) return Math.floor(secs/60)   + 'm ago';
    if (secs < 86400)return Math.floor(secs/3600) + 'h ago';
    return Math.floor(secs/86400) + 'd ago';
  },

  renderSummary() {
    const el = document.getElementById('edits-summary');
    if (!el || !this._data.length) { if (el) el.innerHTML = ''; return; }
    const docIds  = new Set(this._data.map(r => r.document_id));
    const types   = {};
    this._data.forEach(r => { types[r.document_type] = (types[r.document_type]||0)+1; });
    const topType = Object.entries(types).sort((a,b) => b[1]-a[1])[0];
    const lastEdit = this._data[0]?.edited_at;
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--border);border-top:none;margin-bottom:0">
        <div style="padding:14px 20px;border-right:1px solid var(--border)">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--text2);margin-bottom:6px">Total Edits</div>
          <div style="font-size:26px;font-weight:700;color:var(--accent);line-height:1">${this._total}</div>
        </div>
        <div style="padding:14px 20px;border-right:1px solid var(--border)">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--text2);margin-bottom:6px">Documents Edited</div>
          <div style="font-size:26px;font-weight:700;color:#1565c0;line-height:1">${docIds.size}</div>
        </div>
        <div style="padding:14px 20px;border-right:1px solid var(--border)">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--text2);margin-bottom:6px">Most Edited Type</div>
          <div style="font-size:14px;font-weight:700;color:#6a1b9a;line-height:1.2">${topType ? (DOC_TYPE_LABELS[topType[0]]||topType[0]) : '—'}</div>
        </div>
        <div style="padding:14px 20px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--text2);margin-bottom:6px">Last Edit</div>
          <div style="font-size:14px;font-weight:700;color:#00796b;line-height:1.2">${this._timeAgo(lastEdit)}</div>
        </div>
      </div>
    `;
  },

  renderTable() {
    const el = document.getElementById('edits-result');
    if (!el) return;
    if (!this._data.length) {
      el.innerHTML = '<div class="empty-state"><h3>No edits found</h3><p>Adjust filters and try again</p></div>';
      return;
    }
    const offset = (this._page - 1) * this._pageSize;
    const cols = ['#','EDITED AT','DOCUMENT TYPE','CONSUMER NAME','FIELD CHANGED','OLD VALUE','NEW VALUE','REASON','EDITED BY','VERSION','STATUS','ACTION'];
    const rows = this._data.map((r, i) => {
      const sno  = offset + i + 1;
      const ver  = r.edit_version ? `v${r.edit_version - 1}&rarr;v${r.edit_version}` : `v${r.current_version}`;
      const status = r.is_active
        ? `<span style="display:inline-block;background:#e8f5e9;color:#2e7d32;padding:2px 8px;border-radius:2px;font-size:11px;font-weight:600;letter-spacing:0.3px;border:1px solid #c8e6c9">Active</span>`
        : `<span style="display:inline-block;background:#f5f5f5;color:#757575;padding:2px 8px;border-radius:2px;font-size:11px;font-weight:600;letter-spacing:0.3px;border:1px solid #e0e0e0">Reverted</span>`;
      const viewUrl = `/api/documents/${r.document_id}/html?token=${encodeURIComponent(Auth.getToken()||'')}`;
      const consumerLink = r.consumer_id
        ? `<a href="/api/consumers/${r.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" style="color:var(--primary);text-decoration:underline;font-weight:600;cursor:pointer" title="View Applicant File">${Utils.esc(r.consumer_name||'N/A')}</a>`
        : `<span style="color:var(--text)">${Utils.esc(r.consumer_name || 'N/A')}</span>`;
      const zebra = i % 2 === 1 ? 'background:var(--bg2)' : '';
      return `<tr style="${zebra}">
        <td style="text-align:center;color:var(--text2);font-size:11px;padding:8px 6px">${sno}</td>
        <td style="white-space:nowrap;font-size:12px;padding:8px 10px">${this._fmtDatetime(r.edited_at)}</td>
        <td style="padding:8px 10px">${this._typeBadge(r.document_type)}</td>
        <td style="padding:8px 10px;font-size:13px">${consumerLink}</td>
        <td style="padding:8px 10px;font-size:12px;font-weight:600;color:var(--text)">${Utils.esc(r.field_label || r.field_key)}</td>
        <td style="padding:8px 10px;color:#c62828;font-size:12px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${Utils.esc(r.original_value||'')}">${Utils.esc(this._truncate(r.original_value))}</td>
        <td style="padding:8px 10px;color:#2e7d32;font-size:12px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${Utils.esc(r.current_value||'')}">${Utils.esc(this._truncate(r.current_value))}</td>
        <td style="padding:8px 10px;font-size:12px;color:var(--text2);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${Utils.esc(r.edit_reason||'')}">${Utils.esc(this._truncate(r.edit_reason, 50))}</td>
        <td style="padding:8px 10px;font-size:12px">${Utils.esc(r.edited_by_name || '—')}</td>
        <td style="padding:8px 10px;white-space:nowrap;font-family:monospace;font-size:11px;color:var(--text2)">${ver}</td>
        <td style="padding:8px 10px">${status}</td>
        <td style="padding:8px 10px;text-align:center"><a href="${viewUrl}" target="_blank" style="font-size:11px;font-weight:700;color:var(--accent);text-decoration:none;letter-spacing:0.3px;text-transform:uppercase;border:1px solid var(--accent);padding:2px 8px;border-radius:2px;white-space:nowrap">View</a></td>
      </tr>`;
    });
    el.innerHTML = `
      <div style="border:1px solid var(--border);border-top:none;overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;min-width:1100px">
          <thead>
            <tr style="background:#1a3c5e;color:#fff">
              ${cols.map(c=>`<th style="padding:9px 10px;text-align:left;font-size:11px;font-weight:700;letter-spacing:0.6px;white-space:nowrap;border-right:1px solid rgba(255,255,255,0.08)">${c}</th>`).join('')}
            </tr>
          </thead>
          <tbody style="border-top:2px solid #1a3c5e">${rows.join('')}</tbody>
        </table>
      </div>
      ${this.renderPagination()}
    `;
  },

  renderPagination() {
    if (this._totalPages <= 1) return '';
    const start = (this._page - 1) * this._pageSize + 1;
    const end   = Math.min(this._page * this._pageSize, this._total);
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border:1px solid var(--border);border-top:1px solid var(--border);background:var(--bg2)">
        <span style="font-size:12px;color:var(--text2)">Showing <strong>${start}–${end}</strong> of <strong>${this._total}</strong> records</span>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn btn-ghost" style="font-size:12px;padding:4px 12px;border-radius:2px"
            ${this._page <= 1 ? 'disabled' : ''}
            onclick="EditsPage.goTo(${this._page - 1})">&larr; Previous</button>
          <span style="font-size:12px;padding:4px 10px;color:var(--text2);border:1px solid var(--border);background:var(--card)">Page ${this._page} / ${this._totalPages}</span>
          <button class="btn btn-ghost" style="font-size:12px;padding:4px 12px;border-radius:2px"
            ${this._page >= this._totalPages ? 'disabled' : ''}
            onclick="EditsPage.goTo(${this._page + 1})">Next &rarr;</button>
        </div>
      </div>
    `;
  },

  async goTo(pg) {
    this._page = pg;
    await this.fetch();
  },

  async fetch() {
    const params = new URLSearchParams();
    const fromDate = document.getElementById('ef-fromDate')?.value;
    const toDate   = document.getElementById('ef-toDate')?.value;
    const docType  = document.getElementById('ef-docType')?.value;
    const editedBy = document.getElementById('ef-editedBy')?.value;
    const consumer = document.getElementById('ef-consumer')?.value;
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate)   params.set('toDate',   toDate);
    if (docType)  params.set('documentType', docType);
    if (editedBy) params.set('editedBy', editedBy);
    if (consumer) params.set('consumerId', consumer);
    params.set('page',     String(this._page));
    params.set('pageSize', String(this._pageSize));

    const el = document.getElementById('edits-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

    try {
      const res = await Api.get(`/documents/edits-report?${params.toString()}`);
      const body = res.data || res;
      this._data       = body.edits      || [];
      this._total      = body.total      || 0;
      this._totalPages = body.totalPages || 1;
      this._page       = body.page       || 1;
      this.renderSummary();
      this.renderTable();
    } catch (err) {
      if (el) el.innerHTML = `<div class="empty-state"><h3>Error loading edits</h3><p>${err.message}</p></div>`;
    }
  },

  exportCsv() {
    if (!this._data.length) { Utils.warn('No data to export'); return; }
    const cols = ['edited_at','document_type','consumer_name','field_label','original_value','current_value','edit_reason','edited_by_name','edit_version','is_active','document_id'];
    let csv = cols.join(',') + '\n';
    this._data.forEach(r => {
      csv += cols.map(k => {
        let v = r[k] === null || r[k] === undefined ? '' : String(r[k]);
        return `"${v.replace(/"/g,'""')}"`;
      }).join(',') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'document-edits.csv'; a.click();
    URL.revokeObjectURL(url);
  },
};

Pages.documentEdits = async function(params = {}) {
  const content = document.getElementById('content');
  if (!content) return;

  content.innerHTML = `
    <div class="page-header" style="margin-bottom:0;padding-bottom:14px;border-bottom:2px solid var(--border)">
      <div>
        <h1 class="page-title" style="font-size:17px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase">Document Edits Audit Trail</h1>
        <p class="page-sub" style="color:var(--text2);margin-top:3px;font-size:12px">Complete log of all document field edits — who changed what, when</p>
      </div>
    </div>

    <div style="background:var(--card);border:1px solid var(--border);border-top:none;border-radius:0">
      <div style="padding:7px 16px;border-bottom:1px solid var(--border);background:var(--bg2);display:flex;align-items:center;gap:8px">
        <span style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--text2);text-transform:uppercase">Filters</span>
      </div>
      <div style="padding:12px 16px">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
          <div class="fg" style="min-width:140px">
            <label class="fl">From Date</label>
            <input type="date" class="fc" id="ef-fromDate" style="border-radius:2px">
          </div>
          <div class="fg" style="min-width:140px">
            <label class="fl">To Date</label>
            <input type="date" class="fc" id="ef-toDate" style="border-radius:2px">
          </div>
          <div class="fg" style="min-width:180px">
            <label class="fl">Document Type</label>
            <select class="fc" id="ef-docType" style="border-radius:2px">
              <option value="">All Types</option>
              <option value="buyer_builder_agreement">Agreement for Sale</option>
              <option value="conveyance_deed">Conveyance Deed</option>
              <option value="demand_letter">Demand Letter</option>
              <option value="payment_receipt">Payment Receipt</option>
              <option value="allotment_letter">Allotment Letter</option>
              <option value="applicant_file">Applicant File</option>
              <option value="booking_form">Booking Form</option>
            </select>
          </div>
          <div class="fg" style="min-width:160px">
            <label class="fl">Edited By</label>
            <input type="text" class="fc" id="ef-editedBy" placeholder="Search by name…" style="border-radius:2px">
          </div>
          <div class="fg" style="min-width:160px">
            <label class="fl">Consumer ID</label>
            <input type="text" class="fc" id="ef-consumer" placeholder="UUID (optional)" style="border-radius:2px">
          </div>
          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn-primary" style="border-radius:2px" onclick="EditsPage._page=1;EditsPage.fetch()">Fetch</button>
            <button class="btn btn-ghost" style="border-radius:2px" onclick="EditsPage.exportCsv()">Export CSV</button>
          </div>
        </div>
      </div>
    </div>

    <div id="edits-summary"></div>
    <div id="edits-result"><div class="empty-state"><h3>Apply filters and click Fetch</h3></div></div>
  `;

  EditsPage._data = [];
  EditsPage._total = 0;
  EditsPage._page  = 1;

  // Auto-fetch on load to show all recent edits
  await EditsPage.fetch();
};
