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
      'year-month-collection': () => this.loadYearMonthCollection(),
      'receipt-wise-collection': () => this.loadReceiptWiseCollection(),
      'customer-balance':    () => this.loadCustomerBalance(),
      'customer-dues':       () => this.loadCustomerDues(),
      'due-report':          () => this.loadDueReport(),
      'date-wise-dues':      () => this.loadDateWiseDues(),
      'stage-wise-dues':     () => this.loadStageWiseDues(),
      'percentage-wise':     () => this.loadPercentageWise(),
      'ageing-project':      () => this.loadAgeingProject(),
      'ageing-installment':  () => this.loadAgeingInstallment(),
      'month-wise-dues':     () => this.loadMonthWiseDues(),
      'month-wise-dues-customer': () => this.loadMonthWiseDuesCustomer(),
      'tower-floor-sales':   () => this.loadTowerFloorSales(),
      'customer-payment-mismatch': () => this.loadCustomerPaymentMismatch(),
      'booking-record': () => this.loadBookingRecord(),
      'customer-forecasting':() => this.loadCustomerForecasting(),
      'customer-dues-detail':() => this.loadCustomerDuesDetail(),
      'customer-due-summary':() => this.loadCustomerDueSummary(),
      'project-wise-dues':   () => this.loadProjectWiseDues(),
      'tower-wise-dues':     () => this.loadTowerWiseDues(),
      'plan-wise-dues':      () => this.loadPlanWiseDues(),
      'broker-wise-dues':    () => this.loadBrokerWiseDues(),
      'ageing-summary-project':  () => this.loadAgeingSummaryProject(),
      'ageing-summary-tower':    () => this.loadAgeingSummaryTower(),
      'ageing-summary-plan':     () => this.loadAgeingSummaryPlan(),
      'ageing-summary-customer': () => this.loadAgeingSummaryCustomer(),
      'unit-type-wise-dues': () => this.loadUnitTypeWiseDues(),
      'conveyance-deed-date':() => this.loadConveyanceDeedDate(),
      'unit-wise-plc':       () => this.loadUnitWisePLC(),
      'unit-sold-area':      () => this.loadUnitSoldArea(),
      'unit-cost':           () => this.loadUnitCost(),
      'inventory-details':   () => this.loadInventoryDetails(),
      'other-charge-report': () => this.loadOtherChargeReport(),
      'addon-charge-report': () => this.loadAddonChargeReport(),
      'extra-addon-charge':  () => this.loadAddonChargeReport(),
      'all-applicants':      () => this.loadAllApplicants(params),
      'cash-bank-summary':   () => this.loadCashBankSummary(),
      'bank-ledger':         () => this.loadBankLedger(),
      'stock-report':        () => this.loadStockReport(),
      'summary-report':      () => this.loadSummaryReport(),
      'unit-type-status':    () => this.loadUnitTypeStatus(),
      'bank-wise-balance':   () => this.loadBankWiseBalance(),
    };
    (map[tab] || (() => this._notFound(tab)))();
  },

  async _loadLookups() {
    try {
      const [pr, cr, co] = await Promise.allSettled([
        window.ProjectCache.load(),
        Api.get('/consumers', { params: { pageSize: 500 } }),
        Api.get('/companies'),
      ]);
      this._projects = pr.status === 'fulfilled' ? (pr.value.data || pr.value || []) : [];
      this._consumers = cr.status === 'fulfilled' ? (cr.value.data || cr.value || []) : [];
      this._companies = co.status === 'fulfilled' ? (co.value.data || co.value || []) : [];
    } catch {}
  },

  _projectOptions() {
    return '<option value="">All Projects</option>' +
      this._projects.map(p => `<option value="${p.id}">${Utils.esc(p.name)}</option>`).join('');
  },

  _consumerOptions() {
    return '<option value="">All Consumers</option>' +
      this._consumers.map(c => {
        const nm = c.first_name ? `${Utils.esc(c.first_name)} ${Utils.esc(c.last_name||'')}`.trim() : (c.name||'—');
        return `<option value="${c.id}">${nm} · ${Utils.esc(c.mobile||'')}</option>`;
      }).join('');
  },

  _companyOptions() {
    return '<option value="">All Companies</option>' +
      (this._companies||[]).map(c => `<option value="${c.id}">${Utils.esc(c.name)}</option>`).join('');
  },

  _filters(title, fields, fetchFn) {
    const fHtml = fields.map(f => {
      if (f.type === 'date') return `<div class="fg" style="min-width:130px"><label class="fl">${Utils.esc(f.label)}</label><input type="date" class="fc" id="f-${f.id}" value="${f.value||''}"></div>`;
      if (f.type === 'select') return `<div class="fg" style="min-width:160px;flex:1"><label class="fl">${Utils.esc(f.label)}</label><select class="fc" id="f-${f.id}"${f.onchange ? ` onchange="${f.onchange}"` : ''}>${f.options}</select></div>`;
      if (f.type === 'text') return `<div class="fg" style="min-width:160px"><label class="fl">${Utils.esc(f.label)}</label><input type="text" class="fc" id="f-${f.id}" placeholder="${f.placeholder||''}"></div>`;
      if (f.type === 'checkbox-group') {
        return `<div class="fg" style="min-width:100%;margin-top:10px"><label class="fl">${Utils.esc(f.label)}</label><div style="display:flex;gap:10px;flex-wrap:wrap">
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
          if (f.type === 'date') return `<div class="fg" style="flex:1;min-width:120px"><label class="fl">${Utils.esc(f.label)}</label><input type="date" class="fc" id="f-${f.id}" value="${f.value||''}"></div>`;
          if (f.type === 'select') return `<div class="fg" style="flex:1;min-width:150px"><label class="fl">${Utils.esc(f.label)}</label><select class="fc" id="f-${f.id}">${f.options}</select></div>`;
          if (f.type === 'text') return `<div class="fg" style="flex:1;min-width:130px"><label class="fl">${Utils.esc(f.label)}</label><input type="text" class="fc" id="f-${f.id}" placeholder="${f.placeholder||''}"></div>`;
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
        <div class="kpi-label">${Utils.esc(k.label)}</div>
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
    if (this._noteTotal != null) { const t = this._noteTotal, n = this._noteShown; this._noteTotal = null; this._pageNote(t, n); }
  },

  // A list that has more rows than the screen asked for says so (the totals still cover all of them)
  _pageNote(total, shown) {
    const el = document.getElementById('rpt-result');
    if (!el || !(Number(total) > Number(shown))) return;
    el.insertAdjacentHTML('beforeend', `<div class="alert alert-info" style="margin-top:10px">Showing the first ${Number(shown)} of ${Number(total)} rows. Narrow the filters (project, tower) to see the rest. The totals at the top cover all ${Number(total)}.</div>`);
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
      csv += headers.map(h => Utils.csvCell(h)).join(',') + '\n';
      data.forEach(row => { csv += headers.map(h => Utils.csvCell(row[h])).join(',') + '\n'; });
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
      [...r.querySelectorAll('th,td')].map(c => Utils.csvCell(c.textContent.trim())).join(',')
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
            <td class="td-bold" style="color:var(--accent)">${Utils.esc(row.project_name)}</td>
            <td>Residential</td>
            <td style="font-size:11px">${Utils.esc(row.location || 'Gurugram')}</td>
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
          <td class="td-bold">${Utils.esc(u.unit_number)}</td>
          <td>${Utils.esc(u.tower_name)}</td>
          <td>${u.floor}</td>
          <td>${Utils.esc(u.bhk_type)}</td>
          <td>${u.super_area_sqft}</td>
          <td>${Utils.chip(u.status)}</td>
          <td>${u.consumer_id ? `<a href="/api/consumers/${u.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" style="color:var(--primary);text-decoration:underline;cursor:pointer" title="View Applicant File">${Utils.esc(u.consumer_name||'—')}</a>` : (u.consumer_name || '—')}</td>
          <td style="font-size:10px">${Utils.esc(u.broker_name || '—')}</td>
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
            <td>${Utils.esc(c.mobile||'—')}</td>
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
      const params = { pageSize: 1000 };   // the server allows up to 1000 rows; 200 cut a larger project short without saying so
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

      // Money that counts: a cancelled, bounced or rejected receipt is not collected, a cancelled demand is not due, and a due amount carries its GST like the receipt does.
      const liveReceipts = receipts.filter(r => !['cancelled','bounced','rejected'].includes(String(r.status||'').toLowerCase()) && String(r.approval_status||'').toLowerCase() !== 'rejected');
      const liveDemands  = demands.filter(d => String(d.status||'').toLowerCase() !== 'cancelled');
      const amtOf = r => parseFloat(r.amount_received_inr||r.amount||0);
      const dueOf = d => parseFloat(d.amount_due_inr||d.amount||0) + parseFloat(d.cgst_amount||0) + parseFloat(d.sgst_amount||0);
      const rowsOf = consumers.map(c => {
        const paid = liveReceipts.filter(r=>r.consumer_id===c.id||consumerId===c.id).reduce((s,r)=>s+amtOf(r),0);
        const due  = liveDemands.filter(d=>d.consumer_id===c.id||consumerId===c.id).reduce((s,d)=>s+dueOf(d),0);
        const cancelled = String(c.lead_stage||'').toLowerCase() === 'cancelled';   // a cancelled booking owes nothing
        return { c, paid, out: cancelled ? 0 : Math.max(0, due-paid) };
      });
      const totalPaid = rowsOf.reduce((s,x)=>s+x.paid,0);
      const totalOut  = rowsOf.reduce((s,x)=>s+x.out,0);   // the footer is the sum of the rows (an overpaid customer does not reduce what the others owe)

      this._kpis([
        { label:'Consumers',       value: consumers.length },
        { label:'Total Collected', value: Utils.currency(totalPaid), color:'var(--green)' },
        { label:'Total Outstanding',value: Utils.currency(totalOut), color:'var(--red)' },
      ]);

      this._table(
        ['#','Consumer','Mobile','Unit','Lead Stage','Total Paid','Outstanding','Action'],
        rowsOf.map(({c, paid, out}, i) => {
          return `<tr>
            <td style="color:var(--text3)">${i+1}</td>
            <td class="td-bold">${Utils.esc(c.name||c.first_name+' '+(c.last_name||'')||'—')}</td>
            <td>${Utils.esc(c.mobile||'—')}</td>
            <td>${Utils.esc(c.unit_number||c.unitNumber||'—')}</td>
            <td>${Utils.chip(c.lead_stage||'enquiry')}</td>
            <td style="color:var(--green);font-weight:600">${Utils.currency(paid)}</td>
            <td style="color:var(--red);font-weight:600">${Utils.currency(out)}</td>
            <td><button class="btn btn-ghost btn-sm" onclick="Router.navigate('/consumer',{id:'${c.id}'})">View</button></td>
          </tr>`;
        }),
        `<td colspan="5"><strong>TOTAL</strong></td>
         <td style="color:var(--green)"><strong>${Utils.currency(totalPaid)}</strong></td>
         <td style="color:var(--red)"><strong>${Utils.currency(totalOut)}</strong></td>
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
          <td>${Utils.esc(u.project_name||'—')}</td>
          <td>${Utils.esc(u.tower_name||'—')}</td>
          <td class="td-bold">${Utils.esc(u.unit_number)}</td>
          <td>${Utils.esc(u.bhk_type||'—')}</td>
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
            <td class="td-bold">${Utils.esc(r.area_range || '—')}</td>
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
          <td class="td-bold">${Utils.esc(u.unit_number)}</td>
          <td>${Utils.esc(u.tower_name||'—')}</td>
          <td>${Utils.esc(u.bhk_type||'—')}</td>
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
        const label = groupBy === 'tower' && r.project_name ? `${Utils.esc(r.group_name)} <span style="color:var(--text3);font-size:11px">(${Utils.esc(r.project_name)})</span>` : (r.group_name || '—');
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

  // Unit Type Wise Unit Status — reuses /inventory-details' project_bhk_type groupBy
  // branch (added for this report). Row grain is (project_id, bhk_type) compound key,
  // never bhk_type alone, since bhk_type strings are project-specific.
  loadUnitTypeStatus() {
    this._main(`
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Unit Type Wise Unit Status</div></div>
        <div class="sp-body">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
            <div class="fg" style="flex:1;min-width:200px">
              <label class="fl">Company</label>
              <select class="fc" id="f-utsCompany">${this._companyOptions()}</select>
            </div>
          </div>
          <div style="margin-top:12px;display:flex;gap:10px">
            <button class="btn btn-primary" onclick="ReportsPage.fetchUnitTypeStatus()">FETCH</button>
            <button class="btn btn-ghost"   onclick="ReportsPage.exportCsv('Unit_Type_Wise_Unit_Status.csv')">Export CSV</button>
          </div>
        </div>
      </div>
      <div id="rpt-kpis" style="display:grid;gap:12px;margin-bottom:12px"></div>
      <div id="rpt-result"><div class="empty-state"><h3>Apply filters and click FETCH</h3></div></div>
    `);
    this.fetchUnitTypeStatus();
  },

  async fetchUnitTypeStatus() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    const companyId = document.getElementById('f-utsCompany')?.value || '';

    const n = v => parseInt(v || 0);
    const f = v => parseFloat(v || 0);
    const pct = (part, total) => total ? ((part / total) * 100).toFixed(1) : '0.0';
    const ua = (u, a) => `${u} / ${f(a).toFixed(1)}`;

    try {
      const res = await Api.get('/reports/inventory-details', {
        params: { groupBy: 'project_bhk_type', view: 'details', companyId: companyId || undefined },
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

      if (!data.length) { if (el) el.innerHTML = '<div class="empty-state"><h3>No units found</h3></div>'; return; }

      const cols = ['#', 'Project', 'Unit Type', 'Total (Unit/Area)', 'Sold (Unit/Area)', 'Sold %',
        'Booked', 'Allotted', 'Hold', 'Temp Surrender', 'Unsold (Unit/Area)', 'Unsold %', 'Avg Rate (₹/sqft)'];

      const rows = data.map((r, i) => `
        <tr>
          <td style="color:var(--text3)">${i + 1}</td>
          <td class="td-bold">${Utils.esc(r.project_name || '—')}</td>
          <td>${Utils.esc(r.group_name || '—')}</td>
          <td style="text-align:center;font-weight:600">${ua(n(r.total_units), r.total_area)}</td>
          <td style="text-align:center;color:var(--accent);font-weight:600">${ua(n(r.sold_units), r.sold_area)}</td>
          <td style="text-align:center">${pct(n(r.sold_units), n(r.total_units))}%</td>
          <td style="text-align:center">${ua(n(r.booked_units), r.booked_area)}</td>
          <td style="text-align:center">${ua(n(r.allotted_units), r.allotted_area)}</td>
          <td style="text-align:center">${ua(n(r.hold_units), r.hold_area)}</td>
          <td style="text-align:center">${ua(n(r.temp_surrender_units), r.temp_surrender_area)}</td>
          <td style="text-align:center;color:var(--green);font-weight:600">${ua(n(r.unsold_units), r.unsold_area)}</td>
          <td style="text-align:center">${pct(n(r.unsold_units), n(r.total_units))}%</td>
          <td style="text-align:right">${r.avg_rate ? f(r.avg_rate).toFixed(2) : '—'}</td>
        </tr>
      `);

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
      cellMap[`${Utils.esc(r.tower_name)}||${Utils.esc(r.bhk_type)}`] = r;
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
      { id:'project',        type:'select', label:'Project',        options: this._projectOptions(), onchange: 'ReportsPage._aaLoadPlans()' },
      { id:'bhkType',        type:'text',   label:'Unit Type' },
      { id:'towerName',      type:'text',   label:'Tower' },
      { id:'registrationNo', type:'text',   label:'Registration No.' },
      { id:'firstName',      type:'text',   label:'First Name' },
      { id:'unitNumber',     type:'text',   label:'Unit Number' },
      { id:'plan',           type:'select', label:'Payment Plan',   options: '<option value="">&#60;--All--&#62;</option>' },
      { id:'broker',         type:'text',   label:'Broker' },
    ], 'fetchAllApplicants'));
    if (params && params.projectId) {
      const sel = document.getElementById('f-project');
      if (sel) sel.value = params.projectId;
      this._aaLoadPlans();
      this.fetchAllApplicants();
    }
  },

  async _aaLoadPlans() {
    const sel = document.getElementById('f-plan');
    if (!sel) return;
    sel.innerHTML = '<option value="">&#60;--All--&#62;</option>';
    const pid = document.getElementById('f-project')?.value;
    if (!pid) return;
    try {
      const res = await Api.get(`/payments/plan-names/${pid}`);
      const names = res.data || res || [];
      names.forEach(n => {
        const o = document.createElement('option');
        o.value = n; o.textContent = n;
        sel.appendChild(o);
      });
    } catch (_) {}
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
        plan:           this._f('plan')           || undefined,
        broker:         this._f('broker')         || undefined,
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
          <div>${p.salutation ? p.salutation + ' ' : ''}${Utils.esc(p.name || '—')}</div>
          <div style="color:var(--text3);font-size:11px">S/o ${p.father_name || '—'}</div>
          <div style="color:var(--text3);font-size:11px">${p.address || '—'}</div>
          <div style="font-size:11px">PAN: ${p.pan_no || '—'}</div>
          <div style="font-size:11px">${Utils.esc(p.email || '—')} · ${Utils.esc(p.mobile || '—')}</div>
          <div style="font-size:11px">Aadhaar: ${p.aadhaar_no || '—'}</div>
        `;
      };

      const rows = data.map((r, i) => {
        const primary = {
          name: `${Utils.esc(r.first_name || '')} ${Utils.esc(r.last_name || '')}`.trim(),
          salutation: r.salutation,
          father_name: r.father_name,
          address: r.present_address,
          pan_no: r.pan_no,
          email: r.email,
          mobile: r.mobile,
          aadhaar_no: r.aadhaar_no,
        };
        let cells = `<td>${i + 1}</td><td>${Utils.esc(r.registration_no || '—')}</td><td>${Utils.esc(r.unit_number || '—')}</td><td>${Utils.esc(r.bhk_type || '—')}</td><td>${Utils.esc(r.project_name || '—')}</td><td>${cell(primary)}</td>`;
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
          rowsWithBands.push(`<tr><td colspan="${cols.length}" style="font-weight:700;background:var(--bg2)">PROJECT: ${Utils.esc(r.project_name || '—')}</td></tr>`);
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

      params.pageSize = 5000;
      const res  = await Api.get('/reports/customer-balance', { params });
      const body = res;
      const rows = body.data    || [];
      const summ = body.summary || {};
      this._noteTotal = body.total; this._noteShown = rows.length;

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
          ? `<a href="/api/consumers/${r.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" style="color:var(--primary);text-decoration:underline;font-weight:600;cursor:pointer" title="View Applicant File">${Utils.esc(r.consumer_name)}</a>`
          : `<span style="font-weight:600">${Utils.esc(r.consumer_name)}</span>`;
        return `<tr>
          <td style="${aC}">${i+1}</td>
          <td>${Utils.esc(r.registration_no || '—')}</td>
          <td>${nameLink}</td>
          <td>${Utils.esc(r.project_name)}</td>
          <td>${Utils.esc(r.tower_name || '—')}</td>
          <td style="${aC}">${r.floor || '—'}</td>
          <td>${Utils.esc(r.unit_number)}</td>
          <td>${Utils.esc(r.bhk_type || '—')}</td>
          <td style="${aC}">${r.booking_date ? String(r.booking_date).slice(0,10) : '—'}</td>
          <td>${Utils.esc(r.plan_name || '—')}</td>
          <td>${Utils.esc(r.broker_name || 'Direct')}</td>
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
    if (document.querySelector('#rpt-result table')) this.fetchCustomerDues();
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

      params.pageSize = 5000;
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
        const nameLink = `<a href="/api/consumers/${r.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" style="color:var(--primary);text-decoration:underline;font-weight:600;cursor:pointer" title="View Applicant File">${Utils.esc(r.consumer_name)}</a>`;

        // CUSTOMER DETAILS cells (15)
        const custCells = [
          `<td>${Utils.esc(r.registration_no || '—')}</td>`,
          `<td style="${aC}">${fmtD(r.booking_date)}</td>`,
          `<td>${nameLink}</td>`,
          `<td>${Utils.esc(r.tower_name || '—')}</td>`,
          `<td>${Utils.esc(r.unit_number)}</td>`,
          `<td>${Utils.esc(r.bhk_type || '—')}</td>`,
          `<td style="${aR}">${r.area ? parseFloat(r.area).toFixed(4) : '—'}</td>`,
          `<td style="${aC}">${fmtD(r.allotment_date)}</td>`,
          `<td>${Utils.esc(r.broker_name || 'Direct')}</td>`,
          `<td>${Utils.esc(r.plan_name || '—')}</td>`,
          `<td>${Utils.esc(r.loan_type || '—')}</td>`,
          `<td>${Utils.esc(r.mobile || '—')}</td>`,
          `<td>${Utils.esc(r.email || '—')}</td>`,
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

        // CREDIT (money received beyond what has been demanded)
        const creditCell = `<td style="${aR}">${fmtA(r.credit_amount)}</td>`;

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
            `<td style="${osStyle}">${fmtA(r.outstanding_total)}</td>`,
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
                <th style="padding:6px 12px;border:1px solid var(--border2)"></th>
                <th style="padding:6px 12px;border:1px solid var(--border2)">PENDING</th>
                <th style="padding:6px 12px;border:1px solid var(--border2)">CLEAR</th>
                <th style="padding:6px 12px;border:1px solid var(--border2)">TOTAL</th>
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
                  <td style="padding:5px 12px;border:1px solid var(--border2);font-weight:600">${lbl}</td>
                  <td style="padding:5px 12px;border:1px solid var(--border2);text-align:right">${sfmt(p)}</td>
                  <td style="padding:5px 12px;border:1px solid var(--border2);text-align:right">${sfmt(c)}</td>
                  <td style="padding:5px 12px;border:1px solid var(--border2);text-align:right">${sfmt(t)}</td>
                </tr>`).join('')}
              <tr style="background:#e3f2fd;font-weight:700">
                <td style="padding:5px 12px;border:1px solid var(--border2)">Total :</td>
                <td style="padding:5px 12px;border:1px solid var(--border2);text-align:right">${sfmt(sm.pending?.total)}</td>
                <td style="padding:5px 12px;border:1px solid var(--border2);text-align:right">${sfmt(sm.clear?.total)}</td>
                <td style="padding:5px 12px;border:1px solid var(--border2);text-align:right">${sfmt(sm.total?.total)}</td>
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
        this._pageNote(body.total, rows.length);
      }
    } catch (err) { Utils.error(err.message); }
  },

  // ─── Customer Due Details (REPORT B) ───────────────────────────────────────
  // Single fetch returns all 5 base-value fields per row; the 5-way tab below
  // just picks which one drives "A" and re-renders client-side — no refetch.
  _cdsTab: 'total_unit_cost',
  _cdsData: [],

  _cdsSetTab(tab) {
    this._cdsTab = tab;
    ['net_basic_price','basic_with_plc','total_unit_cost','due_amount','due_amount_with_tax'].forEach(t => {
      const btn = document.getElementById(`cds-tab-${t}`);
      if (btn) { btn.classList.toggle('btn-primary', t === tab); btn.classList.toggle('btn-ghost', t !== tab); }
    });
    this._cdsRender();
  },

  loadCustomerDueSummary() {
    this._cdsTab = 'total_unit_cost';
    this._cdsData = [];
    this._main(`
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Customer Due Details</div></div>
        <div class="sp-body">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:8px">
            <div class="fg" style="flex:1;min-width:140px">
              <label class="fl">*Project</label>
              <select class="fc" id="f-project" onchange="ReportsPage._cdsLoadTowers();ReportsPage._cdsLoadPlans()">${this._projectOptions()}</select>
            </div>
            <div class="fg" style="flex:1;min-width:120px">
              <label class="fl">Tower</label>
              <select class="fc" id="f-tower"><option value="">&#60;--All--&#62;</option></select>
            </div>
            <div class="fg" style="min-width:110px">
              <label class="fl">Payment Plan</label>
              <select class="fc" id="f-plan"><option value="">&#60;--All--&#62;</option></select>
            </div>
            <div class="fg" style="min-width:110px">
              <label class="fl">Broker</label>
              <input type="text" class="fc" id="f-broker" placeholder="Search...">
            </div>
            <div class="fg" style="min-width:100px">
              <label class="fl">Unit No.</label>
              <input type="text" class="fc" id="f-unitno" placeholder="Search...">
            </div>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
            <div class="fg" style="min-width:110px">
              <label class="fl">Registration No.</label>
              <input type="text" class="fc" id="f-regno" placeholder="Search...">
            </div>
            <div class="fg" style="min-width:130px">
              <label class="fl">Name</label>
              <input type="text" class="fc" id="f-name" placeholder="Search...">
            </div>
            <div class="fg" style="min-width:120px">
              <label class="fl">Booking Date From</label>
              <input type="date" class="fc" id="f-bookfrom">
            </div>
            <div class="fg" style="min-width:120px">
              <label class="fl">Booking Date To</label>
              <input type="date" class="fc" id="f-bookto">
            </div>
            <div class="fg" style="min-width:100px">
              <label class="fl">Paid Clear %</label>
              <select class="fc" id="f-pctop">
                <option value="">&#60;--None--&#62;</option>
                <option value="gt">&#62;</option>
                <option value="gte">&#62;=</option>
                <option value="eq">=</option>
                <option value="lte">&#60;=</option>
                <option value="lt">&#60;</option>
              </select>
            </div>
            <div class="fg" style="min-width:80px">
              <label class="fl">%</label>
              <input type="number" class="fc" id="f-pctval" min="0" max="100" placeholder="%">
            </div>
            <div style="margin-bottom:2px">
              <button class="btn btn-primary" onclick="ReportsPage.fetchCustomerDueSummary()">FETCH</button>
            </div>
          </div>
          <div style="display:flex;gap:6px;margin-top:12px">
            <button id="cds-tab-net_basic_price"      class="btn btn-ghost btn-sm" onclick="ReportsPage._cdsSetTab('net_basic_price')">Net Basic Price</button>
            <button id="cds-tab-basic_with_plc"        class="btn btn-ghost btn-sm" onclick="ReportsPage._cdsSetTab('basic_with_plc')">Basic With PLC</button>
            <button id="cds-tab-total_unit_cost"       class="btn btn-primary btn-sm" onclick="ReportsPage._cdsSetTab('total_unit_cost')">Total Unit Cost</button>
            <button id="cds-tab-due_amount"            class="btn btn-ghost btn-sm" onclick="ReportsPage._cdsSetTab('due_amount')">Due Amount</button>
            <button id="cds-tab-due_amount_with_tax"   class="btn btn-ghost btn-sm" onclick="ReportsPage._cdsSetTab('due_amount_with_tax')">Due Amount With Tax</button>
          </div>
        </div>
      </div>
      <div id="rpt-result"><div class="empty-state"><h3>Select a project and click FETCH</h3></div></div>
    `);
  },

  async _cdsLoadTowers() {
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

  async _cdsLoadPlans() {
    const sel = document.getElementById('f-plan');
    if (!sel) return;
    sel.innerHTML = '<option value="">&#60;--All--&#62;</option>';
    const pid = document.getElementById('f-project')?.value;
    if (!pid) return;
    try {
      const res = await Api.get(`/payments/plan-names/${pid}`);
      const names = res.data || res || [];
      names.forEach(n => {
        const o = document.createElement('option');
        o.value = n; o.textContent = n;
        sel.appendChild(o);
      });
    } catch (_) {}
  },

  async fetchCustomerDueSummary() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const pid = document.getElementById('f-project')?.value;
      const params = { projectId: pid || undefined };
      const tid  = document.getElementById('f-tower')?.value;
      const plan = document.getElementById('f-plan')?.value;
      const brk  = document.getElementById('f-broker')?.value?.trim();
      const uno  = document.getElementById('f-unitno')?.value?.trim();
      const reg  = document.getElementById('f-regno')?.value?.trim();
      const nam  = document.getElementById('f-name')?.value?.trim();
      const bf   = document.getElementById('f-bookfrom')?.value;
      const bt   = document.getElementById('f-bookto')?.value;
      const pctop  = document.getElementById('f-pctop')?.value;
      const pctval = document.getElementById('f-pctval')?.value;
      if (tid)  params.towerId          = tid;
      if (plan) params.planName         = plan;
      if (brk)  params.broker           = brk;
      if (uno)  params.unitNo           = uno;
      if (reg)  params.registrationNo   = reg;
      if (nam)  params.name             = nam;
      if (bf)   params.bookingFromDate  = bf;
      if (bt)   params.bookingToDate    = bt;
      if (pctop && pctval) { params.pctOperator = pctop; params.pctValue = pctval; }

      const res = await Api.get('/reports/customer-due-summary', { params });
      this._cdsData = res.data || [];
      this._cdsRender();
    } catch (err) { Utils.error(err.message); }
  },

  _cdsRender() {
    const rows = this._cdsData;
    const tab  = this._cdsTab;
    const fmtA = v => parseFloat(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
    const fmtD = v => v ? String(v).slice(0,10) : '—';

    const cols = ['S.NO','REG. NO.','BOOKING DATE','NAME','TOWER','UNIT NO.','UNIT TYPE','AREA','BROKER','PAYMENT PLAN','LOAN','RATE',
      'A (' + ({net_basic_price:'Net Basic Price',basic_with_plc:'Basic With PLC',total_unit_cost:'Total Unit Cost',due_amount:'Due Amount',due_amount_with_tax:'Due Amount With Tax'})[tab] + ')',
      'DUE AMOUNT AS ON DATE (B)','DUE AMOUNT % (C)','10% DUE','PENDING','CLEAR','TOTAL (D)','% (E)','BALANCE (F)','AS ON DATE (G)'];

    const bodyRows = rows.map((r, i) => {
      const A = parseFloat(r[tab] || 0);
      const B = parseFloat(r.due_amount_with_tax || 0);
      const C = A > 0 ? (B * 100 / A) : 0;
      const pending = parseFloat(r.received_pending || 0);
      const clear   = parseFloat(r.received_clear   || 0);
      const D = parseFloat(r.received_total || 0);
      const E = A > 0 ? (D * 100 / A) : 0;
      const F = A - D;
      const G = B - D;
      return `<tr>
        <td>${i+1}</td>
        <td>${Utils.esc(r.registration_no || '—')}</td>
        <td>${fmtD(r.booking_date)}</td>
        <td>${Utils.esc(r.name || '—')}</td>
        <td>${Utils.esc(r.tower_name || '—')}</td>
        <td>${Utils.esc(r.unit_number || '—')}</td>
        <td>${Utils.esc(r.bhk_type || '—')}</td>
        <td style="text-align:right">${r.area ? parseFloat(r.area).toFixed(4) : '—'}</td>
        <td>${Utils.esc(r.broker_name || 'Direct')}</td>
        <td>${Utils.esc(r.plan_name || '—')}</td>
        <td>${Utils.esc(r.loan_type || '—')}</td>
        <td style="text-align:right">${fmtA(r.rate)}</td>
        <td style="text-align:right;font-weight:600">${fmtA(A)}</td>
        <td style="text-align:right">${fmtA(B)}</td>
        <td style="text-align:right">${C.toFixed(2)}%</td>
        <td style="text-align:right">${fmtA(r.ten_pct_due)}</td>
        <td style="text-align:right">${fmtA(pending)}</td>
        <td style="text-align:right;color:#198754">${fmtA(clear)}</td>
        <td style="text-align:right;font-weight:600">${fmtA(D)}</td>
        <td style="text-align:right">${E.toFixed(2)}%</td>
        <td style="text-align:right">${fmtA(F)}</td>
        <td style="text-align:right">${fmtA(G)}</td>
      </tr>`;
    });

    this._lastData = rows;
    this._table(cols, bodyRows);
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

      params.pageSize = 5000;
      const res  = await Api.get('/reports/due-report', { params });
      const rows = (Array.isArray(res.data) ? res.data : res) || [];
      const summ = res.summary || {};
      this._noteTotal = res.total; this._noteShown = rows.length;

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
        if (s === 'paid') return `<span style="background:#d1e7dd;color:#0f5132;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:600">PAID</span>`;
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
          <td>${Utils.esc(r.registration_no || '—')}</td>
          <td style="font-weight:600"><a href="/api/consumers/${r.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" onclick="event.stopPropagation()" style="color:var(--primary);text-decoration:underline;cursor:pointer" title="View Applicant File">${Utils.esc(r.consumer_name)}</a></td>
          <td>${Utils.esc(r.mobile || '—')}</td>
          <td>${Utils.esc(r.project_name)}</td>
          <td>${Utils.esc(r.tower_name || '—')}</td>
          <td style="${aC}">${r.floor || '—'}</td>
          <td>${Utils.esc(r.unit_number)}</td>
          <td>${Utils.esc(r.bhk_type || '—')}</td>
          <td>${Utils.esc(r.installment_name || ('Inst ' + r.installment_index))}</td>
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
    const today = Utils.today();
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
      <td>${Utils.esc(c.registration_no || '—')}</td>
      <td style="font-weight:600"><a href="/api/consumers/${c.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" style="color:var(--primary);text-decoration:underline;cursor:pointer" title="View Applicant File">${Utils.esc(c.consumer_name)}</a></td>
      <td>${Utils.esc(c.tower_name || '—')}</td>
      <td>${Utils.esc(c.unit_number)}</td>
      <td>${Utils.esc(c.bhk_type || '—')}</td>
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
              <input type="date" class="fc" id="f-asondate" value="${Utils.today()}">
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
        ? `<span style="font-size:10px;color:var(--text3)">${Utils.esc(r.project_name)}</span><br>${Utils.esc(r.tower_name)}`
        : view === 'plan'
          ? `<span style="font-size:10px;color:var(--text3)">${Utils.esc(r.project_name)}</span><br>${Utils.esc(r.plan_name)}`
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
              <input type="date" class="fc" id="f-asondate" value="${Utils.today()}">
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
          <td>${Utils.esc(r.demand_type || '—')}</td>
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
              <input type="number" class="fc" id="f-year" value="${Utils.today().slice(0, 4)}" min="2020" max="2035">
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
        if (mDate && mDate < thisMonth) rowBg = 'background:#f5f5f5;color:var(--text3)';
        else if (mDate && mDate === thisMonth) rowBg = 'border-left:3px solid #1a56db';
        return `<tr style="${rowBg}">
          <td style="${aC}">${i+1}</td>
          <td style="font-weight:600">${Utils.esc(r.month_label)}</td>
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

  loadMonthWiseDuesCustomer() {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth() + 1;
    this._main(`
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Month Wise Dues Report (Customer Wise)</div></div>
        <div class="sp-body">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
            <div class="fg" style="flex:1;min-width:150px">
              <label class="fl">Project</label>
              <select class="fc" id="f-project" onchange="ReportsPage._mwdcLoadTowers()">${this._projectOptions()}</select>
            </div>
            <div class="fg" style="min-width:130px">
              <label class="fl">Tower</label>
              <select class="fc" id="f-tower"><option value="">All Towers</option></select>
            </div>
            <div class="fg" style="min-width:90px">
              <label class="fl">From Month</label>
              <input type="number" class="fc" id="f-from-month" value="${m}" min="1" max="12">
            </div>
            <div class="fg" style="min-width:90px">
              <label class="fl">From Year</label>
              <input type="number" class="fc" id="f-from-year" value="${y}" min="2015" max="2035">
            </div>
            <div class="fg" style="min-width:90px">
              <label class="fl">To Month</label>
              <input type="number" class="fc" id="f-to-month" value="${m}" min="1" max="12">
            </div>
            <div class="fg" style="min-width:90px">
              <label class="fl">To Year</label>
              <input type="number" class="fc" id="f-to-year" value="${y}" min="2015" max="2035">
            </div>
            <div style="margin-bottom:2px;display:flex;gap:8px">
              <button class="btn btn-primary" onclick="ReportsPage.fetchMonthWiseDuesCustomer()">FETCH</button>
              <button class="btn btn-ghost" onclick="ReportsPage.exportCsv('Month_Wise_Dues_Customer.csv')">Export CSV</button>
            </div>
          </div>
        </div>
      </div>
      <div id="rpt-kpis" style="display:grid;gap:12px;margin-bottom:12px"></div>
      <div id="rpt-result"><div class="empty-state"><h3>Select a From-To range and click FETCH</h3></div></div>
    `);
  },

  async _mwdcLoadTowers() {
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
    } catch {}
  },

  async fetchMonthWiseDuesCustomer() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const pid = document.getElementById('f-project')?.value;
      const tid = document.getElementById('f-tower')?.value;
      const fromMonth = document.getElementById('f-from-month')?.value;
      const fromYear  = document.getElementById('f-from-year')?.value;
      const toMonth   = document.getElementById('f-to-month')?.value;
      const toYear    = document.getElementById('f-to-year')?.value;
      const params = { fromMonth, fromYear, toMonth, toYear };
      if (pid) params.projectId = pid;
      if (tid) params.towerId = tid;
      const res = await Api.get('/reports/month-wise-dues-customer', { params });
      const months = res.months || [];
      const rows   = res.data   || [];
      const tot    = res.totals || {};
      const fmtA = v => '₹' + parseFloat(v||0).toLocaleString('en-IN',{maximumFractionDigits:0});
      const aR = 'text-align:right'; const aC = 'text-align:center';

      this._lastData = rows.map(r => {
        const o = {
          'Reg No': r.registration_no, 'Name': r.consumer_name, 'Unit No': r.unit_no,
          'Booking Date': r.booking_date ? String(r.booking_date).slice(0,10) : '',
        };
        months.forEach(mo => {
          const mc = r.months[mo.key] || { dues:0, paid:0, os:0 };
          o[`${Utils.esc(mo.label)} DUES`] = parseFloat(mc.dues||0);
          o[`${Utils.esc(mo.label)} PAID`] = parseFloat(mc.paid||0);
          o[`${Utils.esc(mo.label)} O/S`]  = parseFloat(mc.os||0);
        });
        o['TOTAL DUES'] = parseFloat(r.total_dues||0);
        o['TOTAL PAID'] = parseFloat(r.total_paid||0);
        o['TOTAL O/S']  = parseFloat(r.total_os||0);
        return o;
      });

      this._kpis([
        { label:'CUSTOMERS',  value: rows.length.toString(),   color:'var(--accent)' },
        { label:'TOTAL DUES', value: fmtA(tot.total_dues),     color:'var(--accent)' },
        { label:'TOTAL PAID', value: fmtA(tot.total_paid),     color:'#198754' },
        { label:'TOTAL O/S',  value: fmtA(tot.total_os),       color:'#dc3545' },
      ]);
      const kpiEl = document.getElementById('rpt-kpis');
      if (kpiEl) kpiEl.style.gridTemplateColumns = 'repeat(4,1fr)';

      if (!rows.length) { if (el) el.innerHTML = '<div class="empty-state"><h3>No records found</h3></div>'; return; }

      const thS = 'padding:6px 8px;border:1px solid var(--border);white-space:nowrap';
      const monthHead = months.map(mo => `<th colspan="3" style="${thS};background:var(--accent-bg,#eef2ff)">${Utils.esc(mo.label)}</th>`).join('');
      const monthSubHead = months.map(() => `<th style="${thS}">DUES</th><th style="${thS}">PAID</th><th style="${thS}">O/S</th>`).join('');

      const bodyRows = rows.map((r, i) => {
        const monthCells = months.map(mo => {
          const mc = r.months[mo.key] || { dues:0, paid:0, os:0 };
          const osStyle = mc.os > 0 ? `${aR};color:#dc3545` : `${aR};color:#198754`;
          return `<td style="${aR}">${fmtA(mc.dues)}</td><td style="${aR};color:#198754">${fmtA(mc.paid)}</td><td style="${osStyle}">${fmtA(mc.os)}</td>`;
        }).join('');
        return `<tr>
          <td style="${aC}">${i+1}</td>
          <td>${Utils.esc(r.registration_no||'')}</td>
          <td>${Utils.esc(r.consumer_name||'')}</td>
          <td>${Utils.esc(r.unit_no||'')}</td>
          <td>${r.booking_date ? String(r.booking_date).slice(0,10) : ''}</td>
          ${monthCells}
          <td style="${aR};font-weight:600">${fmtA(r.total_dues)}</td>
          <td style="${aR};font-weight:600;color:#198754">${fmtA(r.total_paid)}</td>
          <td style="${aR};font-weight:600;color:${r.total_os>0?'#dc3545':'#198754'}">${fmtA(r.total_os)}</td>
        </tr>`;
      });

      const totMonthCells = months.map(mo => {
        const mc = (tot.months && tot.months[mo.key]) || { dues:0, paid:0, os:0 };
        return `<td style="${aR};font-weight:700">${fmtA(mc.dues)}</td><td style="${aR};font-weight:700">${fmtA(mc.paid)}</td><td style="${aR};font-weight:700">${fmtA(mc.os)}</td>`;
      }).join('');
      const footRow = `<td></td><td></td><td style="font-weight:700">TOTAL</td><td></td><td></td>
        ${totMonthCells}
        <td style="${aR};font-weight:700">${fmtA(tot.total_dues)}</td>
        <td style="${aR};font-weight:700;color:#198754">${fmtA(tot.total_paid)}</td>
        <td style="${aR};font-weight:700;color:#dc3545">${fmtA(tot.total_os)}</td>`;

      const el2 = document.getElementById('rpt-result');
      if (el2) el2.innerHTML = `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr><th rowspan="2" style="${thS}">S.NO.</th><th rowspan="2" style="${thS}">REG NO</th><th rowspan="2" style="${thS}">NAME</th>
            <th rowspan="2" style="${thS}">UNIT NO</th><th rowspan="2" style="${thS}">BOOKING DATE</th>
            ${monthHead}
            <th colspan="3" style="${thS};background:#e0e0e0">TOTAL</th>
          </tr>
          <tr>${monthSubHead}<th style="${thS}">DUES</th><th style="${thS}">PAID</th><th style="${thS}">O/S</th></tr>
        </thead>
        <tbody>${bodyRows.join('')}</tbody>
        <tfoot class="tfoot-total"><tr>${footRow}</tr></tfoot>
      </table></div>`;
    } catch (err) { Utils.error(err.message); }
  },

  loadTowerFloorSales() {
    this._main(`
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Tower Floor Sales</div></div>
        <div class="sp-body">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
            <div class="fg" style="flex:1;min-width:150px">
              <label class="fl">Project</label>
              <select class="fc" id="f-project">${this._projectOptions()}</select>
            </div>
            <div class="fg" style="min-width:150px">
              <label class="fl">Date</label>
              <input type="date" class="fc" id="f-date" value="${Utils.today()}">
            </div>
            <div style="margin-bottom:2px;display:flex;gap:8px">
              <button class="btn btn-primary" onclick="ReportsPage.fetchTowerFloorSales()">FETCH</button>
              <button class="btn btn-ghost" onclick="ReportsPage.exportCsv('Tower_Floor_Sales.csv')">Export CSV</button>
            </div>
          </div>
          <div style="margin-top:8px;font-size:11px;color:var(--text3)">
            Note: OPEN ON DATE reflects live unit status as of report generation time, not a true historical snapshot for the selected Date.
          </div>
        </div>
      </div>
      <div id="rpt-kpis" style="display:grid;gap:12px;margin-bottom:12px"></div>
      <div id="rpt-result"><div class="empty-state"><h3>Select a Project and click FETCH</h3></div></div>
    `);
  },

  async fetchTowerFloorSales() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const pid = document.getElementById('f-project')?.value;
      const asOnDate = document.getElementById('f-date')?.value;
      const params = {};
      if (pid) params.projectId = pid;
      if (asOnDate) params.asOnDate = asOnDate;
      const res = await Api.get('/reports/tower-floor-sales', { params });
      const rows = res.data   || [];
      const tot  = res.totals || {};
      const fmtA = v => '₹' + parseFloat(v||0).toLocaleString('en-IN',{maximumFractionDigits:0});
      const fmtL = v => parseFloat(v||0).toLocaleString('en-IN',{maximumFractionDigits:2});
      const fmtPct = v => parseFloat(v||0).toFixed(2) + '%';
      const aR = 'text-align:right'; const aC = 'text-align:center';

      this._lastData = rows.map(r => ({
        'Floor': r.floor,
        'Total Stock Units': r.total_stock_units, 'Total Stock Area': r.total_stock_area,
        'Stock Hold Units': r.stock_hold_units, 'Stock Hold Area': r.stock_hold_area,
        'Open On Date Units': r.open_on_date_units, 'Open On Date Area': r.open_on_date_area,
        'Temp Surrender Units': r.temp_surrender_units, 'Temp Surrender Area': r.temp_surrender_area,
        'Balance Units': r.balance_units, 'Balance Area': r.balance_area,
        '% Sold vs Total Stock': r.pct_sold_vs_total_stock, '% Sold vs Stock Hold': r.pct_sold_vs_stock_hold,
        'Total Sale Value (Lakhs)': r.total_sale_value_lakhs, 'Received Amount (Lakhs)': r.received_amount_lakhs,
      }));

      this._kpis([
        { label:'FLOORS',            value: rows.length.toString(),                 color:'var(--accent)' },
        { label:'TOTAL STOCK UNITS', value: String(tot.total_stock_units||0),       color:'var(--accent)' },
        { label:'BALANCE (SOLD) UNITS', value: String(tot.balance_units||0),        color:'#198754' },
        { label:'TOTAL SALE VALUE',  value: '₹' + fmtL(tot.total_sale_value_lakhs) + 'L', color:'#198754' },
      ]);
      const kpiEl = document.getElementById('rpt-kpis');
      if (kpiEl) kpiEl.style.gridTemplateColumns = 'repeat(4,1fr)';

      if (!rows.length) { if (el) el.innerHTML = '<div class="empty-state"><h3>No records found</h3></div>'; return; }

      const thS = 'padding:6px 8px;border:1px solid var(--border);white-space:nowrap';

      const bodyRows = rows.map((r, i) => `<tr>
          <td style="${aC}">${i+1}</td>
          <td style="${aC}">${r.floor}</td>
          <td style="${aR}">${r.total_stock_units}</td>
          <td style="${aR}">${fmtL(r.total_stock_area)}</td>
          <td style="${aR}">${r.stock_hold_units}</td>
          <td style="${aR}">${fmtL(r.stock_hold_area)}</td>
          <td style="${aR}">${r.open_on_date_units}</td>
          <td style="${aR}">${fmtL(r.open_on_date_area)}</td>
          <td style="${aR}">${r.temp_surrender_units}</td>
          <td style="${aR}">${fmtL(r.temp_surrender_area)}</td>
          <td style="${aR}">${r.balance_units}</td>
          <td style="${aR}">${fmtL(r.balance_area)}</td>
          <td style="${aR}">${fmtPct(r.pct_sold_vs_total_stock)}</td>
          <td style="${aR}">${fmtPct(r.pct_sold_vs_stock_hold)}</td>
          <td style="${aR};font-weight:600">${fmtL(r.total_sale_value_lakhs)}</td>
          <td style="${aR};font-weight:600;color:#198754">${fmtL(r.received_amount_lakhs)}</td>
        </tr>`);

      const footRow = `<td></td><td style="font-weight:700">TOTAL</td>
        <td style="${aR};font-weight:700">${tot.total_stock_units||0}</td>
        <td style="${aR};font-weight:700">${fmtL(tot.total_stock_area)}</td>
        <td style="${aR};font-weight:700">${tot.stock_hold_units||0}</td>
        <td style="${aR};font-weight:700">${fmtL(tot.stock_hold_area)}</td>
        <td style="${aR};font-weight:700">${tot.open_on_date_units||0}</td>
        <td style="${aR};font-weight:700">${fmtL(tot.open_on_date_area)}</td>
        <td style="${aR};font-weight:700">${tot.temp_surrender_units||0}</td>
        <td style="${aR};font-weight:700">${fmtL(tot.temp_surrender_area)}</td>
        <td style="${aR};font-weight:700">${tot.balance_units||0}</td>
        <td style="${aR};font-weight:700">${fmtL(tot.balance_area)}</td>
        <td style="${aR};font-weight:700">${fmtPct(tot.pct_sold_vs_total_stock)}</td>
        <td style="${aR};font-weight:700">${fmtPct(tot.pct_sold_vs_stock_hold)}</td>
        <td style="${aR};font-weight:700">${fmtL(tot.total_sale_value_lakhs)}</td>
        <td style="${aR};font-weight:700;color:#198754">${fmtL(tot.received_amount_lakhs)}</td>`;

      const el2 = document.getElementById('rpt-result');
      if (el2) el2.innerHTML = `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr>
            <th rowspan="2" style="${thS}">S.NO.</th>
            <th rowspan="2" style="${thS}">FLOOR</th>
            <th colspan="2" style="${thS};background:var(--accent-bg,#eef2ff)">TOTAL STOCK</th>
            <th colspan="2" style="${thS};background:var(--accent-bg,#eef2ff)">STOCK HOLD</th>
            <th colspan="2" style="${thS};background:var(--accent-bg,#eef2ff)">OPEN ON DATE</th>
            <th colspan="2" style="${thS};background:var(--accent-bg,#eef2ff)">TEMP SURRENDER</th>
            <th colspan="2" style="${thS};background:var(--accent-bg,#eef2ff)">BALANCE</th>
            <th colspan="2" style="${thS};background:#e0e0e0">%AGE REPORT</th>
            <th rowspan="2" style="${thS}">TOTAL SALE VALUE (₹L)</th>
            <th rowspan="2" style="${thS}">RECEIVED AMOUNT (₹L)</th>
          </tr>
          <tr>
            <th style="${thS}">Units</th><th style="${thS}">Area</th>
            <th style="${thS}">Units</th><th style="${thS}">Area</th>
            <th style="${thS}">Units</th><th style="${thS}">Area</th>
            <th style="${thS}">Units</th><th style="${thS}">Area</th>
            <th style="${thS}">Units</th><th style="${thS}">Area</th>
            <th style="${thS}">% vs Total</th><th style="${thS}">% vs Hold</th>
          </tr>
        </thead>
        <tbody>${bodyRows.join('')}</tbody>
        <tfoot class="tfoot-total"><tr>${footRow}</tr></tfoot>
      </table></div>`;
    } catch (err) { Utils.error(err.message); }
  },

  loadYearMonthCollection() {
    this._main(this._filters('Year Month Wise Collection Report', [
      { id:'project', type:'select', label:'Project', options: this._projectOptions() },
    ], 'fetchYearMonthCollection'));
  },

  async fetchYearMonthCollection() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const params = { projectId: this._f('project') || undefined };
      const res    = await Api.get('/reports/year-month-collection', { params });
      const grid   = res.data || [];
      const monthTotals = res.monthTotals || Array(12).fill(0);
      const grandTotal  = res.grandTotal || 0;
      const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

      this._lastData = grid.map(r => {
        const row = { 'Year': r.year };
        MONTH_ABBR.forEach((mo, i) => { row[mo] = r.months[i]; });
        row['Total'] = r.total;
        return row;
      });

      this._kpis([
        { label:'GRAND TOTAL', value: `₹${grandTotal.toLocaleString('en-IN')}`, color:'var(--accent)' },
      ]);
      const kpiEl = document.getElementById('rpt-kpis');
      if (kpiEl) kpiEl.style.gridTemplateColumns = 'repeat(1,1fr)';

      if (!grid.length) { if (el) el.innerHTML = '<div class="empty-state"><h3>No records found</h3></div>'; return; }

      const thS = 'padding:6px 8px;border:1px solid var(--border);white-space:nowrap;text-align:right';
      const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

      const bodyRows = grid.map(r => `<tr>
          <td style="padding:6px 8px;border:1px solid var(--border);font-weight:600">${r.year}</td>
          ${r.months.map(m => `<td style="${thS}">${fmt(m)}</td>`).join('')}
          <td style="${thS};font-weight:700">${fmt(r.total)}</td>
        </tr>`);

      const totalRow = `<tr style="font-weight:700;background:var(--bg2)">
          <td style="padding:6px 8px;border:1px solid var(--border)">Total</td>
          ${monthTotals.map(m => `<td style="${thS}">${fmt(m)}</td>`).join('')}
          <td style="${thS}">${fmt(grandTotal)}</td>
        </tr>`;

      const el2 = document.getElementById('rpt-result');
      if (el2) el2.innerHTML = `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr>
          <th style="padding:6px 8px;border:1px solid var(--border)">YEAR</th>
          ${MONTH_ABBR.map(mo => `<th style="${thS}">${mo.toUpperCase()}</th>`).join('')}
          <th style="${thS}">TOTAL</th>
        </tr></thead>
        <tbody>${bodyRows.join('')}${totalRow}</tbody>
      </table></div>`;
    } catch (err) { Utils.error(err.message); }
  },

  loadReceiptWiseCollection() {
    this._main(this._filters('Receipt Wise Collection Report', [
      { id:'project',  type:'select', label:'Project',  options: this._projectOptions() },
      { id:'fromDate', type:'date',   label:'From Date' },
      { id:'toDate',   type:'date',   label:'To Date' },
      { id:'status',   type:'select', label:'Status', options:
        '<option value="">All</option>'
        + '<option value="cleared">Cleared</option>'
        + '<option value="pending">Pending</option>'
        + '<option value="cancelled">Cancelled</option>'
      },
      { id:'paymentMethod', type:'select', label:'Payment Method', options:
        '<option value="">All</option>'
        + '<option value="bank_transfer">Bank Transfer</option>'
        + '<option value="cheque">Cheque</option>'
        + '<option value="neft">NEFT</option>'
        + '<option value="rtgs">RTGS</option>'
        + '<option value="upi">UPI</option>'
        + '<option value="demand_draft">Demand Draft</option>'
        + '<option value="cash">Cash</option>'
        + '<option value="card">Card</option>'
        + '<option value="tds_challan">TDS Challan</option>'
      },
    ], 'fetchReceiptWiseCollection'));
  },

  async fetchReceiptWiseCollection() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const params = {
        projectId:     this._f('project') || undefined,
        fromDate:      this._f('fromDate') || undefined,
        toDate:        this._f('toDate') || undefined,
        status:        this._f('status') || undefined,
        paymentMethod: this._f('paymentMethod') || undefined,
      };
      const res  = await Api.get('/reports/receipt-wise-collection', { params });
      const rows = res.data || [];

      this._lastData = rows.map(r => ({
        'Receipt No':    r.receipt_number,
        'Date':          r.received_date,
        'Consumer':      r.consumer_name,
        'Reg No':        r.registration_no,
        'Project':       r.project_name,
        'Tower':         r.tower_name,
        'Unit':          r.unit_number,
        'Payment Method':r.payment_method,
        'Amount':        r.amount_received_inr,
        'Status':        r.status,
        'Bank':          r.bank_name,
        'Reference':     r.reference,
      }));

      const totalAmount = rows.reduce((s, r) => s + Number(r.amount_received_inr || 0), 0);
      this._kpis([
        { label:'TOTAL RECEIPTS', value: rows.length, color:'var(--accent)' },
        { label:'TOTAL AMOUNT', value: `₹${totalAmount.toLocaleString('en-IN')}`, color:'var(--accent)' },
      ]);

      if (!rows.length) { if (el) el.innerHTML = '<div class="empty-state"><h3>No records found</h3></div>'; return; }

      const cols = ['Receipt No','Date','Consumer','Reg No','Project','Tower','Unit','Payment Method','Amount','Status','Bank','Reference'];
      const bodyRows = rows.map(r => `<tr>
          <td style="padding:6px 8px;border:1px solid var(--border)">${Utils.esc(r.receipt_number || '')}</td>
          <td style="padding:6px 8px;border:1px solid var(--border)">${r.received_date || ''}</td>
          <td style="padding:6px 8px;border:1px solid var(--border)">${Utils.esc(r.consumer_name || '')}</td>
          <td style="padding:6px 8px;border:1px solid var(--border)">${Utils.esc(r.registration_no || '')}</td>
          <td style="padding:6px 8px;border:1px solid var(--border)">${Utils.esc(r.project_name || '')}</td>
          <td style="padding:6px 8px;border:1px solid var(--border)">${Utils.esc(r.tower_name || '')}</td>
          <td style="padding:6px 8px;border:1px solid var(--border)">${Utils.esc(r.unit_number || '')}</td>
          <td style="padding:6px 8px;border:1px solid var(--border)">${Utils.esc(r.payment_method || '')}</td>
          <td style="padding:6px 8px;border:1px solid var(--border);text-align:right">₹${Number(r.amount_received_inr || 0).toLocaleString('en-IN')}</td>
          <td style="padding:6px 8px;border:1px solid var(--border)">${r.status || ''}</td>
          <td style="padding:6px 8px;border:1px solid var(--border)">${Utils.esc(r.bank_name || '')}</td>
          <td style="padding:6px 8px;border:1px solid var(--border)">${Utils.esc(r.reference || '')}</td>
        </tr>`).join('');

      const el2 = document.getElementById('rpt-result');
      if (el2) el2.innerHTML = `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr>${cols.map(c => `<th style="padding:6px 8px;border:1px solid var(--border);text-align:left">${c.toUpperCase()}</th>`).join('')}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table></div>`;
    } catch (err) { Utils.error(err.message); }
  },

  // Search-By toggle (All/Project/Broker/Team) is a UI-organizing concept only — it
  // shows/hides which single extra filter input is highlighted, it does not itself
  // change what gets sent to the backend. Whatever ID inputs are actually filled in
  // (project/broker/team/salesEmployee/date range) are sent regardless of which
  // toggle button is active. No existing toggle-button component to reuse (confirmed
  // via audit grep for Search-By/searchBy — zero matches), so this is new markup.
  loadBookingRecord() {
    this._bookingSearchBy = 'all';
    this._main(`
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Booking Record Report</div></div>
        <div class="sp-body">
          <div style="display:flex;gap:8px;margin-bottom:12px" id="br-searchby">
            ${['all','project','broker','team'].map(m => `
              <button type="button" class="btn ${m==='all'?'btn-primary':'btn-ghost'}" data-mode="${m}"
                onclick="ReportsPage.setBookingSearchBy('${m}')">${m.toUpperCase()}</button>
            `).join('')}
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
            <div class="fg" style="min-width:160px;flex:1">
              <label class="fl">Project</label>
              <select class="fc" id="f-project">${this._projectOptions()}</select>
            </div>
            <div class="fg" style="min-width:160px">
              <label class="fl">Broker</label>
              <input type="text" class="fc" id="f-brokerId" placeholder="Broker ID">
            </div>
            <div class="fg" style="min-width:160px">
              <label class="fl">Sales Employee</label>
              <input type="text" class="fc" id="f-salesEmployeeId" placeholder="Sales Employee ID">
            </div>
            <div class="fg" style="min-width:160px">
              <label class="fl">Team</label>
              <input type="text" class="fc" id="f-teamId" placeholder="Team ID">
            </div>
            <div class="fg" style="min-width:130px">
              <label class="fl">Booking Date From</label>
              <input type="date" class="fc" id="f-bookingFromDate">
            </div>
            <div class="fg" style="min-width:130px">
              <label class="fl">Booking Date To</label>
              <input type="date" class="fc" id="f-bookingToDate">
            </div>
            <div style="margin-top:10px;width:100%;display:flex;gap:10px">
              <button class="btn btn-primary" onclick="ReportsPage.fetchBookingRecord()">FETCH</button>
              <button class="btn btn-ghost" onclick="ReportsPage.exportCsv('Booking_Record.csv')">Export CSV</button>
            </div>
          </div>
        </div>
      </div>
      <div id="rpt-kpis" style="display:grid;gap:12px;margin-bottom:12px"></div>
      <div id="rpt-result"><div class="empty-state"><h3>Apply filters and click FETCH</h3></div></div>
    `);
  },

  setBookingSearchBy(mode) {
    this._bookingSearchBy = mode;
    const el = document.getElementById('br-searchby');
    if (!el) return;
    el.querySelectorAll('button[data-mode]').forEach(b => {
      b.className = `btn ${b.dataset.mode === mode ? 'btn-primary' : 'btn-ghost'}`;
    });
  },

  async fetchBookingRecord() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const params = {
        searchBy:        this._bookingSearchBy || 'all',
        projectId:       this._f('project')        || undefined,
        brokerId:        this._f('brokerId')        || undefined,
        salesEmployeeId: this._f('salesEmployeeId') || undefined,
        teamId:          this._f('teamId')          || undefined,
        bookingFromDate: this._f('bookingFromDate') || undefined,
        bookingToDate:   this._f('bookingToDate')   || undefined,
      };
      const res  = await Api.get('/reports/booking-record', { params });
      const rows = res.data || [];
      this._lastData = rows.map((r, i) => ({
        'S.No': i + 1,
        'Registration No': r.registration_no,
        'Name': r.name,
        'Unit': r.unit_number,
        'Tower': r.tower_name,
        'Project': r.project_name,
        'Booking Date': r.booking_date,
        'Booking Amount': r.booking_amount,
        'Broker Company': r.broker_company,
        'Sales Employee': r.sales_employee_name,
        'Status': r.status,
      }));

      this._kpis([
        { label:'TOTAL BOOKINGS', value: String(rows.length), color:'var(--accent)' },
      ]);
      const kpiEl = document.getElementById('rpt-kpis');
      if (kpiEl) kpiEl.style.gridTemplateColumns = 'repeat(1,1fr)';

      if (!rows.length) { if (el) el.innerHTML = '<div class="empty-state"><h3>No records found</h3></div>'; return; }

      const thS = 'padding:6px 8px;border:1px solid var(--border);white-space:nowrap';
      const fmtAmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
      const bodyRows = rows.map((r, i) => `<tr>
          <td style="text-align:center">${i+1}</td>
          <td>${Utils.esc(r.registration_no || '')}</td>
          <td>${Utils.esc(r.name || '')}</td>
          <td>${Utils.esc(r.unit_number || '')}</td>
          <td>${Utils.esc(r.tower_name || '')}</td>
          <td>${Utils.esc(r.project_name || '')}</td>
          <td>${r.booking_date ? new Date(r.booking_date).toLocaleDateString('en-IN') : ''}</td>
          <td style="text-align:right">${fmtAmt(r.booking_amount)}</td>
          <td>${Utils.esc(r.broker_company || '')}</td>
          <td>${Utils.esc(r.sales_employee_name || '—')}</td>
          <td>${r.status || ''}</td>
        </tr>`);

      const el2 = document.getElementById('rpt-result');
      if (el2) el2.innerHTML = `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr>
          <th style="${thS}">S.NO.</th>
          <th style="${thS}">REGISTRATION NO</th>
          <th style="${thS}">NAME</th>
          <th style="${thS}">UNIT</th>
          <th style="${thS}">TOWER</th>
          <th style="${thS}">PROJECT</th>
          <th style="${thS}">BOOKING DATE</th>
          <th style="${thS}">BOOKING AMOUNT</th>
          <th style="${thS}">BROKER COMPANY</th>
          <th style="${thS}">SALES EMPLOYEE</th>
          <th style="${thS}">STATUS</th>
        </tr></thead>
        <tbody>${bodyRows.join('')}</tbody>
      </table></div>`;
    } catch (err) { Utils.error(err.message); }
  },

  loadCustomerPaymentMismatch() {
    this._main(this._filters('Customer Payment Mismatch Report', [
      { id:'project',        type:'select', label:'Project',        options: this._projectOptions() },
      { id:'unitType',       type:'text',   label:'Unit Type' },
      { id:'towerId',        type:'text',   label:'Tower ID' },
      { id:'registrationNo', type:'text',   label:'Registration No.' },
      { id:'firstName',      type:'text',   label:'First Name' },
      { id:'unitAddress',    type:'text',   label:'Unit Address' },
    ], 'fetchCustomerPaymentMismatch'));
  },

  async fetchCustomerPaymentMismatch() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const params = {
        projectId:      this._f('project')        || undefined,
        unitType:       this._f('unitType')       || undefined,
        towerId:        this._f('towerId')        || undefined,
        registrationNo: this._f('registrationNo') || undefined,
        firstName:      this._f('firstName')      || undefined,
        unitAddress:    this._f('unitAddress')    || undefined,
      };
      const res  = await Api.get('/reports/customer-payment-mismatch', { params });
      const rows = res.data || [];
      this._lastData = rows.map((r, i) => ({
        'S.No': i + 1,
        'Registration No': r.registration_no,
        'Name': r.name,
        'Tower': r.tower_name,
        'Unit Address': r.unit_address,
        'Broker Company': r.broker_company,
        'Registration Date': r.registration_date,
      }));

      this._kpis([
        { label:'MISMATCHED CUSTOMERS', value: String(rows.length), color:'var(--accent)' },
      ]);
      const kpiEl = document.getElementById('rpt-kpis');
      if (kpiEl) kpiEl.style.gridTemplateColumns = 'repeat(1,1fr)';

      if (!rows.length) { if (el) el.innerHTML = '<div class="empty-state"><h3>No records found</h3></div>'; return; }

      const thS = 'padding:6px 8px;border:1px solid var(--border);white-space:nowrap';
      const bodyRows = rows.map((r, i) => `<tr>
          <td style="text-align:center">${i+1}</td>
          <td>${Utils.esc(r.registration_no || '')}</td>
          <td>${Utils.esc(r.name || '')}</td>
          <td>${Utils.esc(r.tower_name || '')}</td>
          <td>${Utils.esc(r.unit_address || '')}</td>
          <td>${Utils.esc(r.broker_company || '')}</td>
          <td>${r.registration_date ? new Date(r.registration_date).toLocaleDateString('en-IN') : ''}</td>
          <td><a href="#" data-v="${Utils.esc(r.registration_no || '')}" onclick="ReportsPage.goToApplicantDetail(this.dataset.v);return false;">DETAIL</a></td>
        </tr>`);

      const el2 = document.getElementById('rpt-result');
      if (el2) el2.innerHTML = `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr>
          <th style="${thS}">S.NO.</th>
          <th style="${thS}">REGISTRATION NO</th>
          <th style="${thS}">NAME</th>
          <th style="${thS}">TOWER</th>
          <th style="${thS}">UNIT ADDRESS</th>
          <th style="${thS}">BROKER COMPANY</th>
          <th style="${thS}">REGISTRATION DATE</th>
          <th style="${thS}">DETAIL</th>
        </tr></thead>
        <tbody>${bodyRows.join('')}</tbody>
      </table></div>`;
    } catch (err) { Utils.error(err.message); }
  },

  // Navigates to the existing All Applicants report, pre-filtered by registration
  // number, as the DETAIL target for a mismatched customer's row. Does not modify
  // loadAllApplicants/fetchAllApplicants — drives them from outside after activation.
  goToApplicantDetail(registrationNo) {
    this.activate('all-applicants');
    setTimeout(() => {
      const el = document.getElementById('f-registrationNo');
      if (el) el.value = registrationNo;
      this.fetchAllApplicants();
    }, 0);
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
        <td style="font-weight:600">${Utils.esc(r.consumer_name||'—')}</td>
        <td>${Utils.esc(r.registration_no||'—')}</td>
        <td>${Utils.esc(r.project_name||'—')}</td>
        <td>${Utils.esc(r.tower_name||'—')}</td>
        <td>${Utils.esc(r.unit_number||'—')}</td>
        <td>${Utils.esc(r.installment_name||'—')}</td>
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
        const nameLink = `<a href="/api/consumers/${r.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" style="color:var(--primary);text-decoration:underline;font-weight:600;cursor:pointer" title="View Applicant File">${Utils.esc(r.consumer_name)}</a>`;
        return `<tr>
          <td style="${aC}">${i+1}</td><td>${Utils.esc(r.registration_no||'—')}</td><td>${nameLink}</td><td>${Utils.esc(r.mobile||'—')}</td>
          <td>${Utils.esc(r.project_name)}</td><td>${Utils.esc(r.tower_name||'—')}</td><td>${Utils.esc(r.unit_number)}</td>
          <td style="${aC}">${r.installment_index}</td><td>${Utils.esc(r.installment_name||'—')}</td>
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
    // the figures on screen follow the switch (they used to change only after the next FETCH)
    if (document.querySelector('#rpt-result table') && this._pwdCfg) this._fetchDuesByGroup(this._pwdCfg);
  },

  loadProjectWiseDues() {
    this._loadDuesByGroup({ groupBy: 'project', headerLabel: 'PROJECT', detailsParamName: 'projectId', title: 'Project Wise Dues Report', csvName: 'Project_Wise_Dues.csv' });
  },
  fetchProjectWiseDues() {
    return this._fetchDuesByGroup({ groupBy: 'project', headerLabel: 'PROJECT', detailsParamName: 'projectId' });
  },

  loadTowerWiseDues() {
    this._loadDuesByGroup({ groupBy: 'tower', headerLabel: 'TOWER', detailsParamName: 'towerName', title: 'Tower Wise Dues Report', csvName: 'Tower_Wise_Dues.csv' });
  },
  fetchTowerWiseDues() {
    return this._fetchDuesByGroup({ groupBy: 'tower', headerLabel: 'TOWER', detailsParamName: 'towerName' });
  },

  loadUnitTypeWiseDues() {
    this._loadDuesByGroup({ groupBy: 'bhk_type', headerLabel: 'UNIT TYPE', detailsParamName: 'bhkType', title: 'Unit Type Wise Dues Report', csvName: 'Unit_Type_Wise_Dues.csv' });
  },
  fetchUnitTypeWiseDues() {
    return this._fetchDuesByGroup({ groupBy: 'bhk_type', headerLabel: 'UNIT TYPE', detailsParamName: 'bhkType' });
  },

  loadPlanWiseDues() {
    this._loadDuesByGroup({ groupBy: 'plan', headerLabel: 'PLAN', detailsParamName: 'plan', title: 'Plan Wise Dues Report', csvName: 'Plan_Wise_Dues.csv' });
  },
  fetchPlanWiseDues() {
    return this._fetchDuesByGroup({ groupBy: 'plan', headerLabel: 'PLAN', detailsParamName: 'plan' });
  },

  loadBrokerWiseDues() {
    this._loadDuesByGroup({ groupBy: 'broker', headerLabel: 'BROKER', detailsParamName: 'broker', title: 'Broker Wise Dues Report', csvName: 'Broker_Wise_Dues.csv' });
  },
  fetchBrokerWiseDues() {
    return this._fetchDuesByGroup({ groupBy: 'broker', headerLabel: 'BROKER', detailsParamName: 'broker' });
  },

  // ─── Ageing Summary Report (legacy due_ageing_common_report.aspx spec) ──────
  // A new, distinct report from Ageing (Project/Tower/Plan) / Installment Wise
  // Dues tabs above — those are overdue-only with a different bucket scheme.
  // This report shows the legacy DUE/RECEIVED/CREDIT/OUTSTANDING/OUTSTANDING%
  // summary columns plus legacy's exact age buckets (0-30/31-60/61-120/121-180/180+).
  loadAgeingSummaryProject() {
    this._loadAgeingSummary({ endpoint: 'ageing-summary-project', headerLabel: 'PROJECT', title: 'Project Wise Dues Ageing', csvName: 'Project_Wise_Dues_Ageing.csv' });
  },
  loadAgeingSummaryTower() {
    this._loadAgeingSummary({ endpoint: 'ageing-summary-tower', headerLabel: 'TOWER', title: 'Tower Wise Dues Ageing', csvName: 'Tower_Wise_Dues_Ageing.csv' });
  },
  loadAgeingSummaryPlan() {
    this._loadAgeingSummary({ endpoint: 'ageing-summary-plan', headerLabel: 'PLAN', title: 'Plan Wise Dues Ageing', csvName: 'Plan_Wise_Dues_Ageing.csv' });
  },
  loadAgeingSummaryCustomer() {
    this._loadAgeingSummary({ endpoint: 'ageing-summary-customer', headerLabel: 'CUSTOMER', title: 'Customer Wise Dues Ageing', csvName: 'Customer_Wise_Dues_Ageing.csv' });
  },

  _loadAgeingSummary(cfg) {
    this._agsCfg = cfg;
    this._main(`
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">${cfg.title}</div></div>
        <div class="sp-body">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
            <div class="fg" style="flex:1;min-width:150px">
              <label class="fl">Project</label>
              <select class="fc" id="f-project">${this._projectOptions()}</select>
            </div>
            <div class="fg" style="min-width:130px">
              <label class="fl">As On Date</label>
              <input type="date" class="fc" id="f-asondate">
            </div>
            <div style="margin-bottom:2px;display:flex;gap:8px">
              <button class="btn btn-primary" onclick="ReportsPage._fetchAgeingSummary()">FETCH</button>
              <button class="btn btn-ghost" onclick="ReportsPage.exportCsv('${cfg.csvName}')">Export CSV</button>
            </div>
          </div>
        </div>
      </div>
      <div id="rpt-kpis" style="display:grid;gap:12px;margin-bottom:12px"></div>
      <div id="rpt-result"><div class="empty-state"><h3>Apply filters and click FETCH</h3></div></div>
    `);
  },

  async _fetchAgeingSummary() {
    const cfg = this._agsCfg;
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const params = {};
      const pid = document.getElementById('f-project')?.value;
      const aod = document.getElementById('f-asondate')?.value;
      if (pid) params.projectId = pid;
      if (aod) params.asOnDate  = aod;
      const res  = await Api.get(`/reports/${cfg.endpoint}`, { params });
      const rows = res.data   || [];
      const tot  = res.totals || {};
      const fmtA = v => '₹' + parseFloat(v||0).toLocaleString('en-IN',{maximumFractionDigits:0});
      const aR = 'text-align:right'; const aC = 'text-align:center';

      this._lastData = rows.map(r => ({
        [cfg.headerLabel[0] + cfg.headerLabel.slice(1).toLowerCase()]: r.group_label,
        'Consumers': parseInt(r.consumer_count||0),
        'Due Amount (A)': parseFloat(r.due_amount||0),
        'Received Amount (B)': parseFloat(r.received_amount||0),
        'Credit Amount (C)': parseFloat(r.credit_amount||0),
        'Outstanding (D)': parseFloat(r.outstanding_amount||0),
        'Outstanding % (E)': parseFloat(r.outstanding_pct||0)+'%',
        '0-30 Days': parseFloat(r.bucket_0_30||0),
        '31-60 Days': parseFloat(r.bucket_31_60||0),
        '61-120 Days': parseFloat(r.bucket_61_120||0),
        '121-180 Days': parseFloat(r.bucket_121_180||0),
        '180+ Days': parseFloat(r.bucket_180_plus||0),
      }));

      this._kpis([
        { label:`TOTAL ${cfg.headerLabel}S`, value: rows.length.toString(),        color:'var(--accent)' },
        { label:'TOTAL DUE (A)',    value: fmtA(tot.due_amount),         color:'var(--accent)' },
        { label:'TOTAL RECEIVED (B)', value: fmtA(tot.received_amount),  color:'#198754' },
        { label:'TOTAL OUTSTANDING (D)', value: fmtA(tot.outstanding_amount), color:'#dc3545' },
      ]);
      const kpiEl = document.getElementById('rpt-kpis');
      if (kpiEl) kpiEl.style.gridTemplateColumns = 'repeat(4,1fr)';
      if (!rows.length) { if(el) el.innerHTML='<div class="empty-state"><h3>No records found</h3></div>'; return; }

      const bodyRows = rows.map((r,i) => {
        const osV = parseFloat(r.outstanding_amount||0);
        const osStyle = osV > 0 ? `${aR};color:#dc3545;font-weight:600` : `${aR};color:#198754;font-weight:600`;
        const label = (cfg.endpoint === 'ageing-summary-tower' || cfg.endpoint === 'ageing-summary-customer') && r.project_name ? `${Utils.esc(r.group_label)} <span style="color:var(--text3);font-size:11px">(${Utils.esc(r.project_name)})</span>` : r.group_label;
        const custExtra = cfg.endpoint === 'ageing-summary-customer'
          ? `<td>${Utils.esc(r.registration_no||'')}</td><td>${Utils.esc(r.unit_no||'')}</td>`
          : '';
        return `<tr style="${i%2===1?'background:var(--bg-row-alt,rgba(0,0,0,.03))':''}">
          <td style="${aC}">${i+1}</td>
          ${custExtra}
          <td style="font-weight:600">${label}</td>
          <td style="${aC}">${r.consumer_count}</td>
          <td style="${aR}">${fmtA(r.due_amount)}</td>
          <td style="${aR};color:#198754">${fmtA(r.received_amount)}</td>
          <td style="${aR}">${fmtA(r.credit_amount)}</td>
          <td style="${osStyle}">${fmtA(r.outstanding_amount)}</td>
          <td style="${osStyle}">${parseFloat(r.outstanding_pct||0)}%</td>
          <td style="${aR}">${fmtA(r.bucket_0_30)}</td>
          <td style="${aR}">${fmtA(r.bucket_31_60)}</td>
          <td style="${aR}">${fmtA(r.bucket_61_120)}</td>
          <td style="${aR}">${fmtA(r.bucket_121_180)}</td>
          <td style="${aR}">${fmtA(r.bucket_180_plus)}</td>
        </tr>`;
      });

      const footRow = `<td></td>${cfg.endpoint === 'ageing-summary-customer' ? '<td></td><td></td>' : ''}<td style="font-weight:700">TOTAL</td>
        <td style="${aC};font-weight:700">${tot.consumer_count}</td>
        <td style="${aR};font-weight:700">${fmtA(tot.due_amount)}</td>
        <td style="${aR};font-weight:700;color:#198754">${fmtA(tot.received_amount)}</td>
        <td style="${aR};font-weight:700">${fmtA(tot.credit_amount)}</td>
        <td style="${aR};font-weight:700;color:#dc3545">${fmtA(tot.outstanding_amount)}</td>
        <td style="${aR};font-weight:700;color:#dc3545">${parseFloat(tot.outstanding_pct||0)}%</td>
        <td style="${aR};font-weight:700">${fmtA(tot.bucket_0_30)}</td>
        <td style="${aR};font-weight:700">${fmtA(tot.bucket_31_60)}</td>
        <td style="${aR};font-weight:700">${fmtA(tot.bucket_61_120)}</td>
        <td style="${aR};font-weight:700">${fmtA(tot.bucket_121_180)}</td>
        <td style="${aR};font-weight:700">${fmtA(tot.bucket_180_plus)}</td>`;

      const cols = cfg.endpoint === 'ageing-summary-customer'
        ? ['S.NO.','REGISTRATION NO','UNIT NO',cfg.headerLabel,'CONSUMERS','DUE AMOUNT (A)','RECEIVED AMOUNT (B)','CREDIT AMOUNT (C)','OUTSTANDING (D)','OUTSTANDING % (E)','0-30 DAYS','31-60 DAYS','61-120 DAYS','121-180 DAYS','180+ DAYS']
        : ['S.NO.',cfg.headerLabel,'CONSUMERS','DUE AMOUNT (A)','RECEIVED AMOUNT (B)','CREDIT AMOUNT (C)','OUTSTANDING (D)','OUTSTANDING % (E)','0-30 DAYS','31-60 DAYS','61-120 DAYS','121-180 DAYS','180+ DAYS'];
      this._table(cols, bodyRows, footRow);
    } catch (err) {
      if (el) el.innerHTML = `<div class="empty-state"><h3>Error loading report</h3><p>${err.message||err}</p></div>`;
    }
  },

  _loadDuesByGroup(cfg) {
    this._pwdWithTax = false;
    this._pwdCfg = cfg;
    const fetchFn = { project: 'fetchProjectWiseDues', tower: 'fetchTowerWiseDues', bhk_type: 'fetchUnitTypeWiseDues', plan: 'fetchPlanWiseDues', broker: 'fetchBrokerWiseDues' }[cfg.groupBy];
    this._main(`
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr" style="display:flex;justify-content:space-between;align-items:center">
          <div class="sp-title">${cfg.title}</div>
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
              <button class="btn btn-primary" onclick="ReportsPage.${fetchFn}()">FETCH</button>
              <button class="btn btn-ghost" onclick="ReportsPage.exportCsv('${cfg.csvName}')">Export CSV</button>
            </div>
          </div>
        </div>
      </div>
      <div id="rpt-kpis" style="display:grid;gap:12px;margin-bottom:12px"></div>
      <div id="rpt-result"><div class="empty-state"><h3>Apply filters and click FETCH</h3></div></div>
    `);
  },

  async _fetchDuesByGroup(cfg) {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const params = { groupBy: cfg.groupBy };
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
        [cfg.headerLabel[0] + cfg.headerLabel.slice(1).toLowerCase()]: r.group_label,
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
        { label:`TOTAL ${cfg.headerLabel}S`, value: rows.length.toString(),     color:'var(--accent)' },
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
        const label = (cfg.groupBy === 'tower' && r.project_name) ? `${Utils.esc(r.group_label)} <span style="color:var(--text3);font-size:11px">(${Utils.esc(r.project_name)})</span>` : r.group_label;
        return `<tr style="${i%2===1?'background:var(--bg-row-alt,rgba(0,0,0,.03))':''}">
          <td style="${aC}">${i+1}</td>
          <td style="font-weight:600">${label}</td>
          <td style="${aC}">${r.consumer_count}</td>
          <td style="${aC}">${r.unit_count}</td>
          <td style="${aR}">${fmtA(r.total_cost)}</td>
          <td style="${aR}">${fmtA(dem(r))}</td>
          <td style="${aC}">${duePct(r)}%</td>
          <td style="${aR}">${fmtA(r.received_pending)}</td>
          <td style="${aR};color:#198754">${fmtA(r.received_clear)}</td>
          <td style="${aR};color:#198754;font-weight:600">${fmtA(r.total_received)}</td>
          <td style="${aC}">${parseFloat(r.received_pct||0)}%</td>
          <td style="${aR}">${fmtA(r.credit_amount)}</td>
          <td style="${osStyle}">${fmtA(osV)}</td>
          <td style="${osStyle}">${osPct(r)}%</td>
          <td style="${aC}"><button class="btn btn-ghost btn-sm" data-v="${Utils.esc(String(cfg.groupBy === 'plan' ? r.plan_name : (cfg.groupBy === 'project' ? r.group_id : r.group_label)))}" onclick="Router.navigate('/reports',{tab:'all-applicants',['${cfg.detailsParamName}']: this.dataset.v})">DETAILS</button></td>
        </tr>`;
      });
      const demT = wt ? parseFloat(tot.total_demanded_with_tax||0) : parseFloat(tot.total_demanded||0);
      const osT  = wt ? parseFloat(tot.outstanding_with_tax||0)    : parseFloat(tot.outstanding||0);
      const duePctT = wt ? parseFloat(tot.due_pct_with_tax||0)        : parseFloat(tot.due_pct||0);
      const osPctT  = wt ? parseFloat(tot.outstanding_pct_with_tax||0): parseFloat(tot.outstanding_pct||0);
      const creditT = rows.reduce((s,r) => s + parseFloat(r.credit_amount||0), 0);
      const footRow = `<td></td><td style="font-weight:700">TOTAL</td>
        <td style="${aC};font-weight:700">${tot.consumer_count}</td><td style="${aC};font-weight:700">${tot.unit_count}</td>
        <td style="${aR};font-weight:700">${fmtA(tot.total_cost)}</td>
        <td style="${aR};font-weight:700">${fmtA(demT)}</td>
        <td style="${aC};font-weight:700">${duePctT}%</td>
        <td style="${aR};font-weight:700">${fmtA(tot.received_pending)}</td>
        <td style="${aR};font-weight:700;color:#198754">${fmtA(tot.received_clear)}</td>
        <td style="${aR};font-weight:700;color:#198754">${fmtA(tot.total_received)}</td>
        <td style="${aC};font-weight:700">${parseFloat(tot.received_pct||0)}%</td>
        <td style="${aR};font-weight:700">${fmtA(creditT)}</td>
        <td style="${aR};font-weight:700;color:#dc3545">${fmtA(osT)}</td>
        <td style="${aR};font-weight:700;color:#dc3545">${osPctT}%</td>
        <td></td>`;
      this._table(['S.NO.',cfg.headerLabel,'CONSUMERS','UNITS','TOTAL COST','TOTAL DEMANDED','DUE %','RECEIVED (PENDING)','RECEIVED (CLEAR)','TOTAL RECEIVED','RECEIVED %','CREDIT AMOUNT','OUTSTANDING','OUTSTANDING %','DETAILS'], bodyRows, footRow);

      const sm = summ;
      const sfmt = v => parseFloat(v||0).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2});
      const summaryHtml = `
        <div style="margin-top:20px;display:inline-block">
          <table style="border-collapse:collapse;font-size:12px;min-width:420px">
            <thead>
              <tr style="background:#1a56db;color:#fff">
                <th style="padding:6px 12px;border:1px solid var(--border2)"></th>
                <th style="padding:6px 12px;border:1px solid var(--border2)">PENDING</th>
                <th style="padding:6px 12px;border:1px solid var(--border2)">CLEAR</th>
                <th style="padding:6px 12px;border:1px solid var(--border2)">TOTAL</th>
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
                  <td style="padding:5px 12px;border:1px solid var(--border2);font-weight:600">${lbl}</td>
                  <td style="padding:5px 12px;border:1px solid var(--border2);text-align:right">${sfmt(p)}</td>
                  <td style="padding:5px 12px;border:1px solid var(--border2);text-align:right">${sfmt(c)}</td>
                  <td style="padding:5px 12px;border:1px solid var(--border2);text-align:right">${sfmt(t)}</td>
                </tr>`).join('')}
              <tr style="background:#e3f2fd;font-weight:700">
                <td style="padding:5px 12px;border:1px solid var(--border2)">Total :</td>
                <td style="padding:5px 12px;border:1px solid var(--border2);text-align:right">${sfmt(sm.pending?.total)}</td>
                <td style="padding:5px 12px;border:1px solid var(--border2);text-align:right">${sfmt(sm.clear?.total)}</td>
                <td style="padding:5px 12px;border:1px solid var(--border2);text-align:right">${sfmt(sm.total?.total)}</td>
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
        <td style="font-weight:600">${Utils.esc(r.consumer_name || '—')}</td>
        <td>${Utils.esc(r.registration_no || '—')}</td>
        <td>${Utils.esc(r.project_name || '—')}</td>
        <td>${Utils.esc(r.tower_name || '—')}</td>
        <td>${Utils.esc(r.unit_number || '—')}</td>
        <td>${fmtDate(r.appointment_date)}</td>
        <td>${fmtDate(r.registry_date)}</td>
        <td>${Utils.esc(r.deed_no || '—')}</td>
        <td style="text-align:right">${fmtA(r.stamp_duty_amount)}</td>
        <td style="${aC}">${badge(r.status)}</td>
        <td>${Utils.esc(r.remarks || '—')}</td>
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
        `<option value="${b.id}">${Utils.esc(b.firm_name || b.name || '—')}</option>`
      ).join('');
    } catch {}

    const projOpts = '<option value="">— Select —</option>' +
      this._projects.map(p => `<option value="${p.id}">${Utils.esc(p.name)}</option>`).join('');

    const bhkOpts = ['— All —','Studio','1BHK','2BHK','3BHK','4BHK']
      .map((v,i) => `<option value="${i===0?'':v}">${v}</option>`).join('');

    const floorOpts = ['— All —',...Array.from({length:20},(_,i)=>`${i+1}`)]
      .map((v,i) => `<option value="${i===0?'':v}">${i===0?v:Utils.floorLabel(v)}</option>`).join('');

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
        .apf-table thead tr:first-child th{background:var(--surface2);color:var(--text);font-weight:700;font-size:12px;padding:7px 5px;text-align:center;border:1px solid var(--border2);white-space:nowrap}
        .apf-table thead tr:last-child th{background:var(--surface3,var(--surface2));color:var(--text2);font-weight:700;font-size:10px;padding:5px 4px;text-align:center;border:1px solid var(--border2);white-space:nowrap}
        .apf-table tbody tr:nth-child(even){background:var(--surface2)}
        .apf-table tbody tr:nth-child(odd){background:var(--surface)}
        .apf-table tbody tr:hover{background:var(--teal-bg)}
        .apf-table tbody td{padding:4px 5px;border:1px solid var(--border);font-size:11px;white-space:nowrap;color:var(--text)}
        .apf-table tfoot tr{background:var(--surface2);font-weight:700}
        .apf-table tfoot td{padding:5px 5px;border:1px solid var(--border);font-size:11px;white-space:nowrap}
        .apf-consumer-link{color:var(--teal);cursor:pointer;text-decoration:none}
        .apf-consumer-link:hover{text-decoration:underline}
        .apf-rec-btn{display:block;margin:3px auto 0;background:#1db5a0;color:#fff;border:none;padding:2px 7px;border-radius:3px;cursor:pointer;font-size:10px;font-weight:700;letter-spacing:.3px;white-space:nowrap}
        .apf-rec-btn:hover{background:#16a085}
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
    p.append('pageSize', '5000');

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
      if (countEl) countEl.textContent = (json.total ?? data.length) + (json.total > data.length ? ` (showing the first ${data.length}; the totals cover all)` : '');
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
        acc.outstanding_net     += n('outstanding_net');
        acc.outstanding_cgst    += n('outstanding_cgst');
        acc.outstanding_sgst    += n('outstanding_sgst');
        acc.received_cgst       += n('received_cgst');
        acc.received_sgst       += n('received_sgst');
        acc.credit_amount       += n('credit_amount');
        acc.interest_charged    += n('interest_charged');
        acc.interest_waived     += n('interest_waived');
        acc.interest_outstanding += n('interest_outstanding');
        return acc;
      }, {
        base_price_inr:0, total_discount:0, net_basic_price:0,
        plc_amount:0, other_charge_amount:0, total_unit_cost:0,
        cost_cgst_amount:0, cost_sgst_amount:0, total_cost_with_gst:0,
        dues_amount:0, dues_cgst:0, dues_sgst:0, dues_total:0,
        received_amount:0, interest_received:0, outstanding_amount:0, outstanding_net:0, outstanding_cgst:0, outstanding_sgst:0, received_cgst:0, received_sgst:0, credit_amount:0,
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
    const recCgst    = n(r.received_cgst);
    const recSgst    = n(r.received_sgst);
    const recWithGst = recTotal;
    const recPct     = n(r.received_pct);
    const outstanding = n(r.outstanding_amount);
    const outColor   = outstanding > 0 ? '#dc3545' : '#28a745';
    const pctColor   = recPct >= 100 ? '#28a745' : '#333';

    const loanStatus = r.self_or_loan === 'loan'
      ? (r.bank_name ? 'Loan Sanctioned' : 'Loan Pending')
      : (r.self_or_loan === 'self' ? 'Self' : '—');

    return `<tr>
      <td style="text-align:center">${i + 1}<button class="apf-rec-btn" onclick="ReportsPage.openReceiptForm('${r.consumer_id}')">REC</button></td>
      <td>${Utils.esc(r.registration_no || '—')}</td>
      <td><a href="/api/consumers/${r.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" class="apf-consumer-link" style="color:var(--primary);text-decoration:underline;cursor:pointer" title="View Applicant File">${Utils.esc(r.consumer_name || '—')}</a></td>
      <td>${dt(r.booking_date)}</td>
      <td>${Utils.esc(r.mobile || '—')}</td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis">${Utils.esc(r.email || '—')}</td>
      <td>${dt(r.allotment_date)}</td>
      <td>${Utils.esc(r.bhk_type || '—')}</td>
      <td>${Utils.esc(r.tower_name || '—')}</td>
      <td>${r.floor != null ? r.floor : '—'}</td>
      <td>${Utils.esc(r.unit_number || '—')}</td>
      <td>${Utils.esc(r.plan_name || '—')}</td>
      <td>${Utils.esc(r.customer_classification || 'General')}</td>
      <td>${Utils.esc(r.broker_name || 'Direct')}</td>
      <td>${loanStatus}</td>
      <td>${Utils.esc(r.bank_name || '—')}</td>
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
      <td style="text-align:right">${f(r.credit_amount)}</td>
      <td style="text-align:right">0.00</td>
      <td style="text-align:right">0.00</td>
      <td style="text-align:right">0.00</td>
      <td style="text-align:right">${f(r.credit_amount)}</td>
      <td style="text-align:right;color:${outColor}">${f(r.outstanding_net)}</td>
      <td style="text-align:right">0.00</td>
      <td style="text-align:right">${f(r.outstanding_cgst)}</td>
      <td style="text-align:right">${f(r.outstanding_sgst)}</td>
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
      ${B(t.received_cgst)}
      ${B(t.received_sgst)}
      <td style="text-align:right">0.00</td>
      ${B(t.received_amount)}
      <td style="text-align:right"></td>
      ${B(t.credit_amount)}${blank.repeat(3)}${B(t.credit_amount)}
      ${B(t.outstanding_net)}
      <td style="text-align:right">0.00</td>
      ${B(t.outstanding_cgst)}
      ${B(t.outstanding_sgst)}
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
    const pct = r => n(r.received_pct).toFixed(2);

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
      n(r.received_amount), n(r.received_cgst), n(r.received_sgst), 0, n(r.received_amount), pct(r),
      n(r.credit_amount), 0, 0, 0, n(r.credit_amount),
      n(r.outstanding_net), 0, n(r.outstanding_cgst), n(r.outstanding_sgst), n(r.outstanding_amount),
      0, n(r.interest_received), 0, 0,
    ]);

    let csv = cols.map(c => Utils.csvCell(c)).join(',') + '\n';
    rows.forEach(row => { csv += row.map(v => Utils.csvCell(v)).join(',') + '\n'; });

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
      const res = await fetch(`/api/payments/receipt-form/${consumerId}`, {
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
          <td class="td-bold"><a href="/api/consumers/${r.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" onclick="event.stopPropagation()" style="color:var(--primary);text-decoration:underline;cursor:pointer" title="View Applicant File">${Utils.esc((r.consumer_name || '').trim() || '—')}</a></td>
          <td>${Utils.esc(r.registration_no || '—')}</td>
          <td>${Utils.esc(r.mobile || '—')}</td>
          <td>${Utils.esc(r.project_name || '—')}</td>
          <td>${Utils.esc(r.tower_name || '—')}</td>
          <td>${Utils.esc(r.unit_number || '—')}</td>
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
          <td class="td-bold"><a href="/api/consumers/${r.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" onclick="event.stopPropagation()" style="color:var(--primary);text-decoration:underline;cursor:pointer" title="View Applicant File">${Utils.esc((r.consumer_name || '').trim() || '—')}</a></td>
          <td>${Utils.esc(r.registration_no || '—')}</td>
          <td>${Utils.esc(r.mobile || '—')}</td>
          <td>${Utils.esc(r.project_name || '—')}</td>
          <td>${Utils.esc(r.tower_name || '—')}</td>
          <td>${Utils.esc(r.unit_number || '—')}</td>
          <td>${Utils.esc(r.bhk_type || '—')}</td>
          <td style="text-align:right">${fmtAmt(r.booking_amount)}</td>
          <td>${Utils.esc(r.payment_mode || '—')}</td>
          <td>${Utils.esc(r.authenticated_by || '—')}</td>
          <td>${Utils.chip(r.status || 'active')}</td>
          <td style="color:var(--text3);font-size:11px">${Utils.esc(r.remarks || '—')}</td>
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
          <td class="td-bold"><a href="/api/consumers/${r.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" onclick="event.stopPropagation()" style="color:var(--primary);text-decoration:underline;cursor:pointer" title="View Applicant File">${Utils.esc((r.consumer_name || '').trim() || '—')}</a></td>
          <td>${Utils.esc(r.registration_no || '—')}</td>
          <td>${Utils.esc(r.project_name || '—')}</td>
          <td>${Utils.esc(r.tower_name || '—')}</td>
          <td>${Utils.esc(r.unit_number || '—')}</td>
          <td>${Utils.esc(r.bhk_type || '—')}</td>
          <td style="text-align:right">${fmtAmt(r.booking_amount)}</td>
          <td style="text-align:right">${fmtAmt(r.tds_applicable)}</td>
          <td style="font-size:11px">${Utils.esc(r.challan_number || '<em style="color:var(--text3)">Not Filed</em>')}</td>
          <td>${fmtDate(r.challan_date)}</td>
          <td style="text-align:right">${fmtAmt(r.tds_paid)}</td>
          <td>${Utils.esc(r.financial_year || '—')}</td>
          <td>${Utils.esc(r.quarter || '—')}</td>
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

  // Addon Charge Report (legacy OtherChargesReport.aspx / AdminFinalReport.aspx IFMS listing).
  // Distinct from Other Charge Report above (booking_records-based PLC/EDC/IDC summary) — this
  // reads addon_charge_master/consumer_addon_charges, one row per consumer per assigned charge.
  loadAddonChargeReport() {
    this._main(`
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Addon Charge Report</div></div>
        <div class="sp-body">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
            <div class="fg" style="flex:1;min-width:150px">
              <label class="fl">Project</label>
              <select class="fc" id="f-project" onchange="ReportsPage._acLoadTowers()">${this._projectOptions()}</select>
            </div>
            <div class="fg" style="flex:1;min-width:130px">
              <label class="fl">Tower</label>
              <select class="fc" id="f-tower"><option value="">&lt;--All--&gt;</option></select>
            </div>
            <div class="fg" style="flex:1;min-width:160px">
              <label class="fl">Other Charge</label>
              <select class="fc" id="f-chargename"><option value="">&lt;--All--&gt;</option></select>
            </div>
            <div class="fg" style="min-width:150px">
              <label class="fl">Registration No</label>
              <input type="text" class="fc" id="f-registrationNo">
            </div>
            <div class="fg" style="min-width:150px">
              <label class="fl">Unit Address</label>
              <input type="text" class="fc" id="f-unitAddress">
            </div>
            <div style="margin-bottom:2px;display:flex;gap:8px">
              <button class="btn btn-primary" onclick="ReportsPage.fetchAddonChargeReport()">FETCH</button>
              <button class="btn btn-ghost" onclick="ReportsPage.exportCsv('Addon_Charges.csv')">Export CSV</button>
            </div>
          </div>
        </div>
      </div>
      <div id="rpt-kpis" style="display:grid;gap:12px;margin-bottom:12px"></div>
      <div id="rpt-result"><div class="empty-state"><h3>Apply filters and click FETCH</h3></div></div>
    `);
    this._acLoadChargeNames();
  },

  async _acLoadTowers() {
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

  async _acLoadChargeNames() {
    const sel = document.getElementById('f-chargename');
    if (!sel) return;
    try {
      const res = await Api.get('/reports/addon-charge-names');
      const names = res.data || [];
      names.forEach(n => { const o=document.createElement('option'); o.value=n; o.textContent=n; sel.appendChild(o); });
    } catch(_) {}
  },

  async fetchAddonChargeReport() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const params = {
        projectId:      document.getElementById('f-project')?.value || undefined,
        towerId:        document.getElementById('f-tower')?.value || undefined,
        chargeName:     document.getElementById('f-chargename')?.value || undefined,
        registrationNo: this._f('registrationNo') || undefined,
        unitAddress:    this._f('unitAddress') || undefined,
      };
      const res  = await Api.get('/reports/addon-charges-report', { params });
      const rows = res.data || [];

      this._lastData = rows.map(r => ({
        'Registration No': r.registration_no,
        'Name':            r.name,
        'Unit Type':       r.unit_type,
        'Tower':           r.tower_name,
        'Floor':           r.floor,
        'Unit Address':    r.unit_address,
        'Charge Name':     r.charge_name,
        'Amount':          parseFloat(r.amount || 0),
      }));

      const totalAmount = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
      this._kpis([
        { label:'TOTAL RECORDS', value: rows.length, color:'var(--accent)' },
        { label:'TOTAL AMOUNT',  value: `₹${totalAmount.toLocaleString('en-IN')}`, color:'var(--accent)' },
      ]);

      if (!rows.length) { if (el) el.innerHTML = '<div class="empty-state"><h3>No records found</h3></div>'; return; }

      const cols = ['Registration No','Name','Unit Type','Tower','Floor','Unit Address','Amount'];
      const bodyRows = rows.map(r => `<tr>
          <td style="padding:6px 8px;border:1px solid var(--border)">${Utils.esc(r.registration_no || '')}</td>
          <td style="padding:6px 8px;border:1px solid var(--border)">${Utils.esc(r.name || '')}</td>
          <td style="padding:6px 8px;border:1px solid var(--border)">${Utils.esc(r.unit_type || '')}</td>
          <td style="padding:6px 8px;border:1px solid var(--border)">${Utils.esc(r.tower_name || '')}</td>
          <td style="padding:6px 8px;border:1px solid var(--border)">${r.floor ?? ''}</td>
          <td style="padding:6px 8px;border:1px solid var(--border)">${Utils.esc(r.unit_address || '')}</td>
          <td style="padding:6px 8px;border:1px solid var(--border);text-align:right">₹${Number(r.amount || 0).toLocaleString('en-IN')}</td>
        </tr>`).join('');

      const el2 = document.getElementById('rpt-result');
      if (el2) el2.innerHTML = `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr>${cols.map(c => `<th style="padding:6px 8px;border:1px solid var(--border);text-align:left">${c.toUpperCase()}</th>`).join('')}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table></div>`;
    } catch (err) { Utils.error(err.message); }
  },

  // Bank Ledger (legacy BankLeadger.aspx). Receipt-level cheque/clearing detail, distinct from
  // Cash/Bank Summary above (aggregate). Cheque Date/Clear Date toggle switches dateType param
  // between 'received' (receipts.received_date) and 'clearing' (receipts.clearing_date).
  loadBankLedger() {
    this._main(`
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Bank Ledger</div></div>
        <div class="sp-body">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
            <div class="fg" style="flex:1;min-width:150px">
              <label class="fl">Project</label>
              <select class="fc" id="f-project">${this._projectOptions()}</select>
            </div>
            <div class="fg" style="flex:1;min-width:180px">
              <label class="fl">Company Bank</label>
              <select class="fc" id="f-companybank"><option value="">&lt;--All--&gt;</option></select>
            </div>
            <div class="fg" style="min-width:150px">
              <label class="fl">Date Type</label>
              <select class="fc" id="f-datetype">
                <option value="received">Cheque Date</option>
                <option value="clearing">Clear Date</option>
              </select>
            </div>
            <div class="fg" style="min-width:130px">
              <label class="fl">From Date</label>
              <input type="date" class="fc" id="f-fromdate">
            </div>
            <div class="fg" style="min-width:130px">
              <label class="fl">To Date</label>
              <input type="date" class="fc" id="f-todate">
            </div>
            <div style="margin-bottom:2px;display:flex;gap:8px">
              <button class="btn btn-primary" onclick="ReportsPage.fetchBankLedger()">FETCH</button>
              <button class="btn btn-ghost" onclick="ReportsPage.exportCsv('Bank_Ledger.csv')">Export CSV</button>
            </div>
          </div>
        </div>
      </div>
      <div id="rpt-kpis" style="display:grid;gap:12px;margin-bottom:12px"></div>
      <div id="rpt-result"><div class="empty-state"><h3>Apply filters and click FETCH</h3></div></div>
    `);
    this._blLoadCompanyBanks();
  },

  async _blLoadCompanyBanks() {
    const sel = document.getElementById('f-companybank');
    if (!sel) return;
    try {
      const res = await Api.get('/reports/bank-ledger-company-banks');
      const banks = res.data || [];
      banks.forEach(b => {
        const o = document.createElement('option');
        o.value = b.id;
        o.textContent = b.account_name ? `${Utils.esc(b.bank_name)} — ${Utils.esc(b.account_name)}` : b.bank_name;
        sel.appendChild(o);
      });
    } catch (_) {}
  },

  async fetchBankLedger() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const params = {
        projectId:           document.getElementById('f-project')?.value || undefined,
        companyBankAccountId: document.getElementById('f-companybank')?.value || undefined,
        dateType:            document.getElementById('f-datetype')?.value || undefined,
        dateFrom:            document.getElementById('f-fromdate')?.value || undefined,
        dateTo:              document.getElementById('f-todate')?.value || undefined,
      };
      const res  = await Api.get('/reports/bank-ledger', { params });
      const rows = res.data || [];

      this._lastData = rows.map(r => ({
        'Registration No': r.registration_no,
        'Name':            r.name,
        'Unit Address':    r.unit_address,
        'Mode':            r.mode,
        'Receipt No':      r.receipt_number,
        'Receipt Date':    r.receipt_date,
        'Amount':          parseFloat(r.amount || 0),
        'Cheque/Draft No': r.cheque_no,
        'Cheque Date':     r.cheque_date,
        'Bank Name':       r.bank_name,
        'Branch':          r.branch,
        'Clearing Date':   r.clearing_date,
        'Status':          r.status,
      }));

      const totalAmount = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
      this._kpis([
        { label:'TOTAL RECEIPTS', value: rows.length, color:'var(--accent)' },
        { label:'TOTAL AMOUNT',   value: `₹${totalAmount.toLocaleString('en-IN')}`, color:'var(--accent)' },
      ]);

      if (!rows.length) { if (el) el.innerHTML = '<div class="empty-state"><h3>No records found</h3></div>'; return; }

      const cols = ['Registration No','Name','Unit Address','Mode','Receipt No','Receipt Date','Amount','Cheque/Draft No','Cheque Date','Bank Name','Branch','Clearing Date','Status'];
      const bodyRows = rows.map(r => `<tr>
          <td style="padding:6px 8px;border:1px solid var(--border)">${Utils.esc(r.registration_no || '')}</td>
          <td style="padding:6px 8px;border:1px solid var(--border)">${Utils.esc(r.name || '')}</td>
          <td style="padding:6px 8px;border:1px solid var(--border)">${Utils.esc(r.unit_address || '')}</td>
          <td style="padding:6px 8px;border:1px solid var(--border)">${Utils.esc(r.mode || '')}</td>
          <td style="padding:6px 8px;border:1px solid var(--border)">${Utils.esc(r.receipt_number || '')}</td>
          <td style="padding:6px 8px;border:1px solid var(--border)">${r.receipt_date || ''}</td>
          <td style="padding:6px 8px;border:1px solid var(--border);text-align:right">₹${Number(r.amount || 0).toLocaleString('en-IN')}</td>
          <td style="padding:6px 8px;border:1px solid var(--border)">${Utils.esc(r.cheque_no || '')}</td>
          <td style="padding:6px 8px;border:1px solid var(--border)">${r.cheque_date || ''}</td>
          <td style="padding:6px 8px;border:1px solid var(--border)">${Utils.esc(r.bank_name || '')}</td>
          <td style="padding:6px 8px;border:1px solid var(--border)">${Utils.esc(r.branch || '')}</td>
          <td style="padding:6px 8px;border:1px solid var(--border)">${r.clearing_date || ''}</td>
          <td style="padding:6px 8px;border:1px solid var(--border)">${r.status || ''}</td>
        </tr>`).join('');

      const el2 = document.getElementById('rpt-result');
      if (el2) el2.innerHTML = `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr>${cols.map(c => `<th style="padding:6px 8px;border:1px solid var(--border);text-align:left">${c.toUpperCase()}</th>`).join('')}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table></div>`;
    } catch (err) { Utils.error(err.message); }
  },

  loadStockReport() {
    this._main(`
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Stock Report</div></div>
        <div class="sp-body">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
            <div class="fg" style="flex:1;min-width:220px">
              <label class="fl">Company</label>
              <select class="fc" id="f-company"><option value="">&lt;--All--&gt;</option>${
                (this._companies || []).map(c => `<option value="${c.id}">${Utils.esc(c.name)}</option>`).join('')
              }</select>
            </div>
            <div style="margin-bottom:2px;display:flex;gap:8px">
              <button class="btn btn-primary" onclick="ReportsPage.fetchStockReport()">FETCH</button>
              <button class="btn btn-ghost" onclick="ReportsPage.exportCsv('Stock_Report.csv')">Export CSV</button>
            </div>
          </div>
          <div style="margin-top:8px;font-size:11px;color:var(--text3)">
            Note: Unsold Stock (Value) is unavailable — per-unit pricing is not yet entered for unbooked units.
          </div>
        </div>
      </div>
      <div id="rpt-kpis" style="display:grid;gap:12px;margin-bottom:12px"></div>
      <div id="rpt-result"><div class="empty-state"><h3>Apply filters and click FETCH</h3></div></div>
    `);
  },

  async fetchStockReport() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const params = { companyId: document.getElementById('f-company')?.value || undefined };
      const res  = await Api.get('/reports/stock-report', { params });
      const rows = res.data || [];

      const fmtA = v => '₹' + parseFloat(v||0).toLocaleString('en-IN',{maximumFractionDigits:0});
      const aR = 'text-align:right';

      this._lastData = rows.map(r => ({
        'Company':            r.company_name,
        'Project':            r.project_name,
        'UOM':                r.uom,
        'Stock (Unit)':       r.stock_unit,
        'Stock (Area)':       parseFloat(r.stock_area || 0),
        'Stock (Value)':      parseFloat(r.sold_stock_value || 0),
        'Sold Stock (Unit)':  r.sold_stock_unit,
        'Sold Stock (Area)':  parseFloat(r.sold_stock_area || 0),
        'Sold Stock (Value)': parseFloat(r.sold_stock_value || 0),
        'Unsold Stock (Unit)': r.unsold_stock_unit,
        'Unsold Stock (Area)': parseFloat(r.unsold_stock_area || 0),
        'Unsold Stock (Value)': 0,
      }));

      const totalUnits = rows.reduce((s, r) => s + Number(r.stock_unit || 0), 0);
      const soldValue  = rows.reduce((s, r) => s + Number(r.sold_stock_value || 0), 0);
      this._kpis([
        { label:'PROJECTS',          value: rows.length, color:'var(--accent)' },
        { label:'TOTAL UNITS',       value: totalUnits,  color:'var(--accent)' },
        { label:'SOLD STOCK VALUE',  value: fmtA(soldValue), color:'#198754' },
      ]);

      if (!rows.length) { if (el) el.innerHTML = '<div class="empty-state"><h3>No records found</h3></div>'; return; }

      const cols = ['COMPANY','PROJECT','UOM','STOCK (UNIT)','STOCK (AREA)','STOCK (VALUE)',
        'SOLD STOCK (UNIT)','SOLD STOCK (AREA)','SOLD STOCK (VALUE)',
        'UNSOLD STOCK (UNIT)','UNSOLD STOCK (AREA)','UNSOLD STOCK (VALUE)'];
      const bodyRows = rows.map(r => `<tr>
          <td style="padding:6px 8px;border:1px solid var(--border)">${Utils.esc(r.company_name || '')}</td>
          <td style="padding:6px 8px;border:1px solid var(--border)">${Utils.esc(r.project_name || '')}</td>
          <td style="padding:6px 8px;border:1px solid var(--border)">${Utils.esc(r.uom || '')}</td>
          <td style="padding:6px 8px;border:1px solid var(--border);${aR}">${r.stock_unit || 0}</td>
          <td style="padding:6px 8px;border:1px solid var(--border);${aR}">${Number(r.stock_area||0).toLocaleString('en-IN')}</td>
          <td style="padding:6px 8px;border:1px solid var(--border);${aR}">${fmtA(r.sold_stock_value)}</td>
          <td style="padding:6px 8px;border:1px solid var(--border);${aR}">${r.sold_stock_unit || 0}</td>
          <td style="padding:6px 8px;border:1px solid var(--border);${aR}">${Number(r.sold_stock_area||0).toLocaleString('en-IN')}</td>
          <td style="padding:6px 8px;border:1px solid var(--border);${aR};color:#198754">${fmtA(r.sold_stock_value)}</td>
          <td style="padding:6px 8px;border:1px solid var(--border);${aR}">${r.unsold_stock_unit || 0}</td>
          <td style="padding:6px 8px;border:1px solid var(--border);${aR}">${Number(r.unsold_stock_area||0).toLocaleString('en-IN')}</td>
          <td style="padding:6px 8px;border:1px solid var(--border);${aR}" title="Per-unit pricing not yet entered for unbooked units — Unsold Value unavailable">—</td>
        </tr>`).join('');

      const el2 = document.getElementById('rpt-result');
      if (el2) el2.innerHTML = `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr>${cols.map(c => `<th style="padding:6px 8px;border:1px solid var(--border);text-align:left">${c}</th>`).join('')}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table></div>`;
    } catch (err) { Utils.error(err.message); }
  },

  loadSummaryReport() {
    this._main(`
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Summary Report</div></div>
        <div class="sp-body">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
            <div class="fg" style="flex:1;min-width:220px">
              <label class="fl">Company</label>
              <select class="fc" id="f-company"><option value="">&lt;--All--&gt;</option>${
                (this._companies || []).map(c => `<option value="${c.id}">${Utils.esc(c.name)}</option>`).join('')
              }</select>
            </div>
            <div style="margin-bottom:2px;display:flex;gap:8px">
              <button class="btn btn-primary" onclick="ReportsPage.fetchSummaryReport()">FETCH</button>
              <button class="btn btn-ghost" onclick="ReportsPage.exportCsv('Summary_Report.csv')">Export CSV</button>
            </div>
          </div>
          <div style="margin-top:8px;font-size:11px;color:var(--text3)">
            Note: Balance (Value) is unavailable — per-unit pricing is not yet entered for unbooked units.
          </div>
        </div>
      </div>
      <div id="rpt-kpis" style="display:grid;gap:12px;margin-bottom:12px"></div>
      <div id="rpt-result"><div class="empty-state"><h3>Apply filters and click FETCH</h3></div></div>
    `);
  },

  async fetchSummaryReport() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const params = { companyId: document.getElementById('f-company')?.value || undefined };
      const res  = await Api.get('/reports/summary-report', { params });
      const rows = res.data || [];

      const fmtA = v => '₹' + parseFloat(v||0).toLocaleString('en-IN',{maximumFractionDigits:0});
      const aR = 'text-align:right';

      this._lastData = rows.map(r => ({
        'Company':               r.company_name,
        'Project':               r.project_name,
        'UOM':                   r.uom,
        'Total (Unit)':          r.total_unit,
        'Total (Area)':          parseFloat(r.total_area || 0),
        'Sold (Unit)':           r.sold_unit,
        'Sold (Area)':           parseFloat(r.sold_area || 0),
        'Balance (Unit)':        r.balance_unit,
        'Balance (Area)':        parseFloat(r.balance_area || 0),
        'Project Value':         parseFloat(r.sold_value || 0),
        'Sold Value':            parseFloat(r.sold_value || 0),
        'Upto Recd(+Pending)':   parseFloat(r.upto_received || 0),
        'Balance Recoverable':   parseFloat(r.balance_recoverable || 0),
        'Upto Demanded':         parseFloat(r.upto_demanded || 0),
        'Current O/S':           parseFloat(r.current_os || 0),
        'Due Interest':          parseFloat(r.due_interest || 0),
      }));

      const totalUnits    = rows.reduce((s, r) => s + Number(r.total_unit || 0), 0);
      const soldValue     = rows.reduce((s, r) => s + Number(r.sold_value || 0), 0);
      const dueInterest   = rows.reduce((s, r) => s + Number(r.due_interest || 0), 0);
      this._kpis([
        { label:'PROJECTS',      value: rows.length, color:'var(--accent)' },
        { label:'TOTAL UNITS',   value: totalUnits,  color:'var(--accent)' },
        { label:'SOLD VALUE',    value: fmtA(soldValue), color:'#198754' },
        { label:'DUE INTEREST',  value: fmtA(dueInterest), color:'#dc3545' },
      ]);

      if (!rows.length) { if (el) el.innerHTML = '<div class="empty-state"><h3>No records found</h3></div>'; return; }

      const cols = ['COMPANY','PROJECT','UOM','TOTAL (UNIT)','TOTAL (AREA)','SOLD (UNIT)','SOLD (AREA)',
        'BALANCE (UNIT)','BALANCE (AREA)','PROJECT VALUE','SOLD VALUE',
        'UPTO RECD(+PENDING)','BALANCE RECOVERABLE','UPTO DEMANDED','CURRENT O/S','DUE INTEREST'];
      const bodyRows = rows.map(r => `<tr>
          <td style="padding:6px 8px;border:1px solid var(--border)">${Utils.esc(r.company_name || '')}</td>
          <td style="padding:6px 8px;border:1px solid var(--border)">${Utils.esc(r.project_name || '')}</td>
          <td style="padding:6px 8px;border:1px solid var(--border)">${Utils.esc(r.uom || '')}</td>
          <td style="padding:6px 8px;border:1px solid var(--border);${aR}">${r.total_unit || 0}</td>
          <td style="padding:6px 8px;border:1px solid var(--border);${aR}">${Number(r.total_area||0).toLocaleString('en-IN')}</td>
          <td style="padding:6px 8px;border:1px solid var(--border);${aR}">${r.sold_unit || 0}</td>
          <td style="padding:6px 8px;border:1px solid var(--border);${aR}">${Number(r.sold_area||0).toLocaleString('en-IN')}</td>
          <td style="padding:6px 8px;border:1px solid var(--border);${aR}">${r.balance_unit || 0}</td>
          <td style="padding:6px 8px;border:1px solid var(--border);${aR}">${Number(r.balance_area||0).toLocaleString('en-IN')}</td>
          <td style="padding:6px 8px;border:1px solid var(--border);${aR}">${fmtA(r.sold_value)}</td>
          <td style="padding:6px 8px;border:1px solid var(--border);${aR};color:#198754">${fmtA(r.sold_value)}</td>
          <td style="padding:6px 8px;border:1px solid var(--border);${aR}">${fmtA(r.upto_received)}</td>
          <td style="padding:6px 8px;border:1px solid var(--border);${aR}">${fmtA(r.balance_recoverable)}</td>
          <td style="padding:6px 8px;border:1px solid var(--border);${aR}">${fmtA(r.upto_demanded)}</td>
          <td style="padding:6px 8px;border:1px solid var(--border);${aR}">${fmtA(r.current_os)}</td>
          <td style="padding:6px 8px;border:1px solid var(--border);${aR};color:#dc3545">${fmtA(r.due_interest)}</td>
        </tr>`).join('');

      const el2 = document.getElementById('rpt-result');
      if (el2) el2.innerHTML = `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr>${cols.map(c => `<th style="padding:6px 8px;border:1px solid var(--border);text-align:left">${c}</th>`).join('')}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table></div>`;
    } catch (err) { Utils.error(err.message); }
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
        const nameLink = `<a href="/api/consumers/${r.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" style="color:var(--primary);text-decoration:underline;font-weight:600;cursor:pointer" title="View Applicant File">${Utils.esc(r.consumer_name)}</a>`;
        return `<tr style="${i%2===1?'background:var(--bg-row-alt,rgba(0,0,0,.03))':''}">
          <td style="${aC}">${i+1}</td><td>${Utils.esc(r.registration_no||'—')}</td><td>${nameLink}</td>
          <td>${Utils.esc(r.project_name)}</td><td>${Utils.esc(r.tower_name||'—')}</td><td>${Utils.esc(r.unit_number)}</td><td>${Utils.esc(r.bhk_type||'—')}</td>
          <td style="${aR}">${fmtA(r.booking_plc)}</td><td style="${aR}">${fmtA(r.booking_other)}</td>
          <td>${Utils.esc(r.other_charge_desc||'—')}</td>
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
             data-v="${Utils.esc(r.name)}" onclick="Utils.info('Report: ' + this.dataset.v)">
          <div style="font-weight:600;color:var(--text1)">${Utils.esc(r.name)}</div>
          <div style="font-size:10px;color:var(--text3)">${Utils.esc(r.type||'custom')}</div>
        </div>
      `).join('');
    } catch (err) {
      const el = document.getElementById('saved-reports-list');
      if (el) el.innerHTML = '<div style="color:var(--red);font-size:10px;padding:8px">Error loading saved reports</div>';
    }
  },

  // ─────────────────────────────────────────────────────────────
  // GROUP: Financial Reports (Phase 6)
  // ─────────────────────────────────────────────────────────────

  // Drill-down is a simple in-place view swap inside #rpt-main (no modal component
  // exists elsewhere in this file to reuse — confirmed via audit grep), not a
  // separate NAV_GROUPS tab, since it is reached only from a summary row click.
  loadCashBankSummary() {
    this._cbsDrilldownId = null;
    this._main(this._filters('Cash/Bank Summary', [
      { id:'cbsCompany',   type:'select', label:'Company',    options: this._companyOptions() },
      { id:'cbsProject',   type:'select', label:'Project',    options: this._projectOptions() },
      { id:'cbsFromDate',  type:'date',   label:'From Date' },
      { id:'cbsToDate',    type:'date',   label:'To Date' },
    ], 'fetchCashBankSummary'));
  },

  async fetchCashBankSummary() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const params = {
        companyId: this._f('cbsCompany') || undefined,
        projectId: this._f('cbsProject') || undefined,
        fromDate:  this._f('cbsFromDate') || undefined,
        toDate:    this._f('cbsToDate') || undefined,
      };
      const res  = await Api.get('/reports/cash-bank-summary', { params });
      const rows_data = res.data || [];
      const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

      this._lastData = rows_data.map(r => ({
        'Bank Name': r.bank_name,
        'Account Name': r.account_name,
        'Account Number': r.account_number,
        'Debit': r.debit,
        'Credit': r.credit,
        'Closing Balance': r.closing_balance,
      }));

      if (!rows_data.length) { if (el) el.innerHTML = '<div class="empty-state"><h3>No bank accounts found</h3></div>'; return; }

      const rows = rows_data.map(r => `
        <tr>
          <td class="td-bold" style="color:var(--accent);cursor:pointer" onclick="ReportsPage.loadLedgerMonthlySummary('${r.id}')">
            ${Utils.esc(r.bank_name)}${Utils.esc(r.account_name ? ' — ' + r.account_name : '')} (${Utils.esc(r.account_number)})
          </td>
          <td style="text-align:right">${fmt(r.debit)}</td>
          <td style="text-align:right">${fmt(r.credit)}</td>
          <td style="text-align:right;font-weight:700">${fmt(r.closing_balance)}</td>
        </tr>
      `);

      this._table(['PARTICULARS', 'DEBIT', 'CREDIT', 'CLOSING BALANCE'], rows);
    } catch (err) {
      if (el) el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`;
    }
  },

  // Bank Wise Balance — reuses /cash-bank-summary verbatim with no date filter (all-time),
  // presentation-only tab: date picker and monthly drill-down link are hidden here.
  loadBankWiseBalance() {
    this._main(this._filters('Bank Wise Balance', [
      { id:'bwbCompany',   type:'select', label:'Company',    options: this._companyOptions() },
      { id:'bwbProject',   type:'select', label:'Project',    options: this._projectOptions() },
    ], 'fetchBankWiseBalance'));
  },

  async fetchBankWiseBalance() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const params = {
        companyId: this._f('bwbCompany') || undefined,
        projectId: this._f('bwbProject') || undefined,
      };
      const res  = await Api.get('/reports/cash-bank-summary', { params });
      const rows_data = res.data || [];
      const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

      this._lastData = rows_data.map(r => ({
        'Bank Name': r.bank_name,
        'Account Name': r.account_name,
        'Account Number': r.account_number,
        'Debit': r.debit,
        'Credit': r.credit,
        'Closing Balance': r.closing_balance,
      }));

      if (!rows_data.length) { if (el) el.innerHTML = '<div class="empty-state"><h3>No bank accounts found</h3></div>'; return; }

      const rows = rows_data.map(r => `
        <tr>
          <td class="td-bold">${Utils.esc(r.bank_name)}${Utils.esc(r.account_name ? ' — ' + r.account_name : '')} (${Utils.esc(r.account_number)})</td>
          <td style="text-align:right">${fmt(r.debit)}</td>
          <td style="text-align:right">${fmt(r.credit)}</td>
          <td style="text-align:right;font-weight:700">${fmt(r.closing_balance)}</td>
        </tr>
      `);

      this._table(['PARTICULARS', 'DEBIT', 'CREDIT', 'CLOSING BALANCE'], rows);
    } catch (err) {
      if (el) el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`;
    }
  },

  async loadLedgerMonthlySummary(companyBankAccountId) {
    this._cbsDrilldownId = companyBankAccountId;
    this._main(`
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Ledger Monthly Summary</div></div>
        <div class="sp-body">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
            <div class="fg" style="min-width:130px"><label class="fl">From Date</label><input type="date" class="fc" id="f-lmsFromDate"></div>
            <div class="fg" style="min-width:130px"><label class="fl">To Date</label><input type="date" class="fc" id="f-lmsToDate"></div>
            <div style="margin-top:10px;display:flex;gap:10px">
              <button class="btn btn-primary" onclick="ReportsPage.fetchLedgerMonthlySummary()">FETCH</button>
              <button class="btn btn-ghost" onclick="ReportsPage.loadCashBankSummary()">← Back to Summary</button>
            </div>
          </div>
        </div>
      </div>
      <div id="rpt-result"><div class="page-loading"><div class="spinner"></div></div></div>
    `);
    await this.fetchLedgerMonthlySummary();
  },

  async fetchLedgerMonthlySummary() {
    const el = document.getElementById('rpt-result');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const params = {
        fromDate: this._f('lmsFromDate') || undefined,
        toDate:   this._f('lmsToDate') || undefined,
      };
      const res  = await Api.get(`/reports/ledger-monthly-summary/${this._cbsDrilldownId}`, { params });
      const rows_data = res.data || [];
      const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

      this._lastData = rows_data.map(r => ({
        'Period': r.label,
        'Debit': r.debit,
        'Credit': r.credit,
        'Closing Balance': `${fmt(r.closing_balance)} ${Utils.esc(r.closing_notation)}`,
      }));

      const rows = rows_data.map(r => `
        <tr${r.month === null ? ' style="font-weight:700;background:var(--bg2)"' : ''}>
          <td>${Utils.esc(r.label)}</td>
          <td style="text-align:right">${fmt(r.debit)}</td>
          <td style="text-align:right">${fmt(r.credit)}</td>
          <td style="text-align:right;font-weight:700">${fmt(r.closing_balance)} ${Utils.esc(r.closing_notation)}</td>
        </tr>
      `);

      this._table(['PERIOD', 'DEBIT', 'CREDIT', 'CLOSING BALANCE'], rows);
    } catch (err) {
      if (el) el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`;
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
        { id: 'stock-report',       label: 'Stock Report' },
        { id: 'summary-report',     label: 'Summary Report' },
      ],
    },
    {
      label: 'Collection & Dues',
      items: [
        { id: 'project-collection',   label: 'Project Wise Collection' },
        { id: 'year-month-collection', label: 'Year Month Wise Collection' },
        { id: 'receipt-wise-collection', label: 'Receipt Wise Collection' },
        { id: 'customer-balance',     label: 'Customer Wise Balance' },
        { id: 'customer-dues',        label: 'Customer Wise Dues' },
        { id: 'due-report',           label: 'Due Report' },
        { id: 'date-wise-dues',       label: 'Date Wise Dues' },
        { id: 'stage-wise-dues',      label: 'Stage Wise Dues' },
        { id: 'percentage-wise',      label: 'Percentage Wise Report' },
        { id: 'ageing-project',       label: 'Ageing (Project/Tower/Plan)' },
        { id: 'ageing-installment',   label: 'Installment Wise Dues' },
        { id: 'month-wise-dues',      label: 'Month Wise Dues' },
        { id: 'month-wise-dues-customer', label: 'Month Wise Dues (Customer Wise)' },
        { id: 'customer-forecasting', label: 'Customer Forecasting' },
        { id: 'customer-dues-detail', label: 'Customer Dues Details' },
        { id: 'customer-due-summary', label: 'Customer Due Summary' },
        { id: 'project-wise-dues',    label: 'Project Wise Dues' },
        { id: 'tower-wise-dues',      label: 'Tower Wise Dues' },
        { id: 'unit-type-wise-dues',  label: 'Unit Type Wise Dues' },
        { id: 'plan-wise-dues',       label: 'Plan Wise Dues' },
        { id: 'broker-wise-dues',     label: 'Broker Wise Dues' },
        { id: 'ageing-summary-project',  label: 'Project Wise Dues Ageing' },
        { id: 'ageing-summary-tower',    label: 'Tower Wise Dues Ageing' },
        { id: 'ageing-summary-plan',     label: 'Plan Wise Dues Ageing' },
        { id: 'ageing-summary-customer', label: 'Customer Wise Dues Ageing' },
        { id: 'conveyance-deed-date', label: 'Conveyance Deed Date' },
      ],
    },
    {
      label: 'Charge Detail',
      items: [
        { id: 'other-charge-report', label: 'Other Charge Report' },
        { id: 'addon-charge-report', label: 'Addon Charge Report' },
      ],
    },
    {
      label: 'Sales Reports',
      items: [
        { id: 'tower-floor-sales', label: 'Tower Floor Sales' },
        { id: 'customer-payment-mismatch', label: 'Customer Payment Mismatch' },
        { id: 'booking-record', label: 'Booking Record' },
      ],
    },
    {
      label: 'Financial Details',
      items: [
        { id: 'cash-bank-summary', label: 'Cash/Bank Summary' },
        { id: 'bank-ledger', label: 'Bank Ledger' },
        { id: 'unit-type-status', label: 'Unit Type Wise Unit Status' },
        { id: 'bank-wise-balance', label: 'Bank Wise Balance' },
      ],
    },
  ];

  const sidebar = NAV_GROUPS.map(g => `
    <div style="margin-bottom:8px">
      <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;
                  letter-spacing:.06em;padding:4px 10px 2px">${Utils.esc(g.label)}</div>
      ${g.items.map(it => `
        <div id="rpt-nav-${it.id}" class="rpt-nav-item${it.id===tab?' active':''}"
             onclick="ReportsPage.activate('${it.id}')">${Utils.esc(it.label)}</div>
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
    <div class="rptn" style="display:grid;grid-template-columns:220px 1fr;gap:14px;align-items:start">
      <!-- Sidebar -->
      <div class="sp rpt-side" style="padding:8px 0;position:sticky;top:0">
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
      .rptn { --bg3:var(--surface2); --text1:var(--text); --text-muted:var(--text3); --text-primary:var(--text); --hover-bg:var(--surface2); }
      .rptn .rpt-side { border-radius:10px; overflow:hidden }
      .rpt-nav-item { padding:7px 14px; font-size:12px; cursor:pointer; border-radius:8px; margin:1px 8px; color:var(--text2); transition:background .15s }
      .rpt-nav-item:hover { background:var(--surface2); color:var(--text) }
      .rpt-nav-item.active { background:var(--teal-bg); color:var(--teal); font-weight:600 }
      @media (max-width:900px) { .rptn { grid-template-columns:minmax(0,1fr) !important } .rptn .rpt-side { position:static !important; max-height:230px; overflow-y:auto } }
      #rpt-main { min-width:0 }
      #rpt-main .sp { border-radius:10px; overflow:hidden }
      #rpt-main .sp-hdr { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; padding:14px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border) }
      #rpt-main .sp-title { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
      #rpt-main .sp-body { padding:18px }
      #rpt-main .fg { gap:6px }
      #rpt-main .fl { font-size:11px; font-weight:500; text-transform:none; letter-spacing:.3px; color:var(--text2) }
      #rpt-main .fc { padding:9px 12px; font-size:13px; border-radius:8px; min-height:38px }
      #rpt-main .fc:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg) }
      #rpt-main .cb-label { display:inline-flex; align-items:center; gap:6px; font-size:12.5px; color:var(--text); cursor:pointer }
      #rpt-main .btn-primary, #rpt-main .btn-fetch, #create-report-modal .btn-primary { background:var(--teal) !important; color:#fff !important; border:none; padding:9px 24px; font-size:12.5px; font-weight:600; border-radius:8px; min-height:38px; cursor:pointer }
      #rpt-main .btn-primary:hover, #create-report-modal .btn-primary:hover { filter:brightness(.92) }
      #rpt-main .btn-ghost, #create-report-modal .btn-ghost { border-radius:8px; min-height:38px; padding:9px 18px; font-size:12.5px }
      #rpt-main .btn-sm { min-height:30px; padding:5px 12px; font-size:12px; border-radius:6px }
      #rpt-main .kpi-card { background:var(--surface); border:1px solid var(--border2); border-left:3px solid var(--teal); border-radius:10px; padding:12px 16px }
      #rpt-main .kpi-label { font-size:10.5px; color:var(--text3); text-transform:uppercase; letter-spacing:.5px }
      #rpt-main .kpi-value { font-size:20px; font-weight:700; margin-top:4px }
      #rpt-main .kpi-sub { font-size:11px; color:var(--text3); margin-top:2px }
      #rpt-main #rpt-result { background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow-x:auto }
      #rpt-main #rpt-result:empty { display:none }
      #rpt-main table { border-collapse:collapse; font-size:12.5px }
      #rpt-main table th { padding:10px 14px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; white-space:nowrap }
      #rpt-main table td { padding:9px 14px; vertical-align:middle }
      #rpt-main table tbody tr:hover td { background:var(--surface2) }
      #rpt-main .tfoot-total td { background:var(--surface2); font-weight:700; border-top:1px solid var(--border2) }
      #rpt-main .empty-state { padding:40px 18px; text-align:center; color:var(--text3) }
      #rpt-main .empty-state h3 { font-size:14px; font-weight:600; color:var(--text2); margin:0 0 4px }
      #create-report-modal > .sp { border-radius:14px; background:var(--surface); border:1px solid var(--border2); box-shadow:0 20px 60px rgba(0,0,0,.4) }
      #create-report-modal h2 { font-size:15px; font-weight:600; color:var(--text) }
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
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
        <div style="padding:14px 20px;border-right:1px solid var(--border)">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--text2);margin-bottom:6px">Total Edits</div>
          <div style="font-size:26px;font-weight:700;color:var(--teal);line-height:1">${this._total}</div>
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
        ? `<span style="display:inline-block;background:#e8f5e9;color:#2e7d32;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:600;letter-spacing:0.3px;border:1px solid #c8e6c9">Active</span>`
        : `<span style="display:inline-block;background:var(--surface2);color:var(--text3);padding:2px 10px;border-radius:999px;font-size:11px;font-weight:600;letter-spacing:0.3px;border:1px solid var(--border2)">Reverted</span>`;
      const viewUrl = `/api/documents/${r.document_id}/html?token=${encodeURIComponent(Auth.getToken()||'')}`;
      const consumerLink = r.consumer_id
        ? `<a href="/api/consumers/${r.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" style="color:var(--teal);text-decoration:none;font-weight:600;cursor:pointer" title="View Applicant File">${Utils.esc(r.consumer_name||'N/A')}</a>`
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
        <td style="padding:8px 10px;text-align:center"><a href="${viewUrl}" target="_blank" style="font-size:11px;font-weight:700;color:var(--teal);text-decoration:none;letter-spacing:0.3px;text-transform:uppercase;border:1px solid var(--accent);padding:2px 8px;border-radius:2px;white-space:nowrap">View</a></td>
      </tr>`;
    });
    el.innerHTML = `
      <div style="border-top:1px solid var(--border);overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;min-width:1100px">
          <thead>
            <tr style="background:var(--surface2);color:var(--text3)">
              ${cols.map(c=>`<th style="padding:9px 10px;text-align:left;font-size:11px;font-weight:700;letter-spacing:0.6px;white-space:nowrap;border-bottom:1px solid var(--border2);text-transform:uppercase">${c}</th>`).join('')}
            </tr>
          </thead>
          <tbody>${rows.join('')}</tbody>
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
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-top:1px solid var(--border);background:var(--surface2)">
        <span style="font-size:12px;color:var(--text2)">Showing <strong>${start}–${end}</strong> of <strong>${this._total}</strong> records</span>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn btn-ghost" style="font-size:12px;padding:4px 12px;border-radius:6px"
            ${this._page <= 1 ? 'disabled' : ''}
            onclick="EditsPage.goTo(${this._page - 1})">&larr; Previous</button>
          <span style="font-size:12px;padding:4px 10px;color:var(--text2);border:1px solid var(--border2);background:var(--surface);border-radius:6px">Page ${this._page} / ${this._totalPages}</span>
          <button class="btn btn-ghost" style="font-size:12px;padding:4px 12px;border-radius:6px"
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
      csv += cols.map(k => Utils.csvCell(r[k])).join(',') + '\n';
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
    <style>
      .edn { max-width:1280px; margin-left:auto; margin-right:auto }
      .edn-card { background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:hidden; margin-bottom:16px }
      .edn .fg { gap:6px }
      .edn .fl { font-size:11px; font-weight:500; text-transform:none; letter-spacing:.3px; color:var(--text2) }
      .edn .fc { padding:9px 12px; font-size:13px; border-radius:8px; min-height:38px }
      .edn .fc:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg) }
      .edn .btn-teal { background:var(--teal); color:#fff; border:none; padding:9px 24px; border-radius:8px; font-size:12.5px; font-weight:600; min-height:38px; cursor:pointer }
      .edn .btn-ghost { border-radius:8px; min-height:38px; padding:9px 18px; font-size:12.5px }
      #edits-summary, #edits-result { background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:hidden; margin-bottom:16px }
      #edits-summary:empty { display:none }
    </style>
    <div class="page-hdr">
      <h1>Document Edits Audit Trail</h1>
      <div class="breadcrumb">Reports / <b>Edits</b></div>
    </div>
    <div class="edn">
    <div class="edn-card">
      <div style="padding:14px 18px;border-bottom:1px solid var(--border);background:var(--teal-bg);display:flex;align-items:center;gap:8px">
        <span style="font-size:12px;font-weight:600;letter-spacing:.6px;color:var(--text);text-transform:uppercase">Filters</span>
        <span style="font-size:11px;color:var(--text3)">Complete log of all document field edits — who changed what, when</span>
      </div>
      <div style="padding:18px">
        <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end">
          <div class="fg" style="min-width:140px">
            <label class="fl">From Date</label>
            <input type="date" class="fc" id="ef-fromDate" >
          </div>
          <div class="fg" style="min-width:140px">
            <label class="fl">To Date</label>
            <input type="date" class="fc" id="ef-toDate" >
          </div>
          <div class="fg" style="min-width:180px">
            <label class="fl">Document Type</label>
            <select class="fc" id="ef-docType" >
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
            <input type="text" class="fc" id="ef-editedBy" placeholder="Search by name…" >
          </div>
          <div class="fg" style="min-width:160px">
            <label class="fl">Consumer ID</label>
            <input type="text" class="fc" id="ef-consumer" placeholder="UUID (optional)" >
          </div>
          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn-teal" onclick="EditsPage._page=1;EditsPage.fetch()">Fetch</button>
            <button class="btn btn-ghost"  onclick="EditsPage.exportCsv()">Export CSV</button>
          </div>
        </div>
      </div>
    </div>

    <div id="edits-summary"></div>
    <div id="edits-result"><div class="empty-state"><h3>Apply filters and click Fetch</h3></div></div>
    </div>
  `;

  EditsPage._data = [];
  EditsPage._total = 0;
  EditsPage._page  = 1;

  // Auto-fetch on load to show all recent edits
  await EditsPage.fetch();
};
