// ROF CRM — Analytics Dashboard Page

Pages.analytics = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="page-hdr">
      <h1>Analytics</h1>
      <div class="breadcrumb">Reports / <b>Analytics</b></div>
    </div>

    <!-- Date range filter -->
    <div class="sp" style="margin-bottom:16px">
      <div class="sp-body" style="padding:10px 14px">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <div class="btg">
            <button type="button" class="btg-item on" onclick="btgSelect(this);AnalyticsPage.setRange('month')">This Month</button>
            <button type="button" class="btg-item" onclick="btgSelect(this);AnalyticsPage.setRange('quarter')">This Quarter</button>
            <button type="button" class="btg-item" onclick="btgSelect(this);AnalyticsPage.setRange('year')">This Year</button>
          </div>
          <input type="date" class="fc" id="an-from" style="width:150px" value="${Utils.monthStart()}">
          <span style="color:var(--text3)">to</span>
          <input type="date" class="fc" id="an-to" style="width:150px" value="${Utils.today()}">
          <button class="btn btn-fetch btn-sm" onclick="AnalyticsPage.load()">APPLY</button>
        </div>
      </div>
    </div>

    <!-- Top KPIs -->
    <div class="kpi-row" id="an-kpis">
      ${[...Array(6)].map(() => `<div class="kpi"><div class="page-loading"><div class="spinner"></div></div></div>`).join('')}
    </div>

    <!-- Charts row -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
      <div class="sp">
        <div class="sp-hdr"><div class="sp-title">Leads by Stage</div></div>
        <div class="sp-body" id="an-stage-chart"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
      <div class="sp">
        <div class="sp-hdr"><div class="sp-title">Collection Trend</div></div>
        <div class="sp-body" id="an-collection-chart"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
    </div>

    <!-- Second row -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
      <div class="sp">
        <div class="sp-hdr"><div class="sp-title">Lead Sources</div></div>
        <div class="sp-body" id="an-source-chart"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
      <div class="sp">
        <div class="sp-hdr"><div class="sp-title">Unit Status Distribution</div></div>
        <div class="sp-body" id="an-unit-chart"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
    </div>

    <!-- Payment ageing -->
    <div class="sp" style="margin-top:16px">
      <div class="sp-hdr"><div class="sp-title">Payment Ageing</div></div>
      <div class="sp-body" id="an-ageing"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>
  `;

  await AnalyticsPage.load();
};

const AnalyticsPage = {
  setRange(range) {
    const today = new Date();
    let from;
    if (range === 'month') {
      from = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (range === 'quarter') {
      const q = Math.floor(today.getMonth() / 3);
      from = new Date(today.getFullYear(), q * 3, 1);
    } else {
      from = new Date(today.getFullYear(), 0, 1);
    }
    const el = document.getElementById('an-from');
    if (el) el.value = from.toISOString().split('T')[0];
    this.load();
  },

  async load() {
    const from = document.getElementById('an-from')?.value;
    const to = document.getElementById('an-to')?.value;
    const params = {};
    if (from) params.fromDate = from;
    if (to) params.toDate = to;

    await Promise.allSettled([
      this.loadKpis(params),
      this.loadStageChart(),
      this.loadSourceChart(),
      this.loadCollectionChart(),
      this.loadUnitChart(),
      this.loadAgeing(),
    ]);
  },

  async loadKpis(params) {
    try {
      const [salesRes, finRes, allotRes] = await Promise.allSettled([
        Api.get('/reports/sales-dashboard', { params }),
        Api.get('/reports/financial-dashboard', { params }),
        Api.get('/allocations', { params: { pageSize: 1 } }),
      ]);
      const sales = salesRes.status === 'fulfilled' ? (salesRes.value.data || salesRes.value || {}) : {};
      const fin = finRes.status === 'fulfilled' ? (finRes.value.data || finRes.value || {}) : {};

      const el = document.getElementById('an-kpis');
      if (!el) return;
      el.innerHTML = `
        <div class="kpi c-accent"><div class="kpi-lbl">Total Leads</div><div class="kpi-val">${sales.total_leads||sales.totalLeads||0}</div><div class="kpi-sub">This period</div></div>
        <div class="kpi c-blue"><div class="kpi-lbl">Applications</div><div class="kpi-val">${sales.applications||0}</div><div class="kpi-sub">Filed</div></div>
        <div class="kpi c-green"><div class="kpi-lbl">Allotted</div><div class="kpi-val">${sales.allotted||0}</div><div class="kpi-sub">Units allotted</div></div>
        <div class="kpi c-teal"><div class="kpi-lbl">Collection</div><div class="kpi-val">${Utils.currency(fin.total_collected||fin.totalCollected||0)}</div><div class="kpi-sub">Total collected</div></div>
        <div class="kpi c-warn"><div class="kpi-lbl">Outstanding</div><div class="kpi-val">${Utils.currency(fin.outstanding||0)}</div><div class="kpi-sub">Pending collection</div></div>
        <div class="kpi c-red"><div class="kpi-lbl">Conversion Rate</div><div class="kpi-val">${sales.conversion_rate||sales.conversionRate||0}%</div><div class="kpi-sub">Lead to allotment</div></div>
      `;
    } catch (err) {
      const el = document.getElementById('an-kpis');
      if (el) el.innerHTML = `<div style="padding:20px;color:var(--red)">Could not load KPIs: ${err.message}</div>`;
    }
  },

  async loadStageChart() {
    const el = document.getElementById('an-stage-chart');
    if (!el) return;
    try {
      const res = await Api.get('/consumers', { params: { pageSize: 500 } });
      const list = res.data || res || [];
      const counts = {};
      for (const c of list) {
        const stage = c.lead_stage || c.leadStage || 'enquiry';
        counts[stage] = (counts[stage] || 0) + 1;
      }
      this._renderBarChart(el, counts, 'Lead Stage');
    } catch { el.innerHTML = '<div class="empty-state" style="padding:20px"><p>No data</p></div>'; }
  },

  async loadSourceChart() {
    const el = document.getElementById('an-source-chart');
    if (!el) return;
    try {
      const res = await Api.get('/consumers', { params: { pageSize: 500 } });
      const list = res.data || res || [];
      const counts = {};
      for (const c of list) {
        const src = (c.lead_source || c.leadSource || 'unknown').replace(/_/g, ' ');
        counts[src] = (counts[src] || 0) + 1;
      }
      this._renderBarChart(el, counts, 'Lead Source');
    } catch { el.innerHTML = '<div class="empty-state" style="padding:20px"><p>No data</p></div>'; }
  },

  async loadCollectionChart() {
    const el = document.getElementById('an-collection-chart');
    if (!el) return;
    try {
      const res = await Api.get('/payments/receipts', { params: { pageSize: 300 } });
      const list = res.data || res || [];
      const monthly = {};
      for (const r of list) {
        const date = r.payment_date || r.paymentDate || r.created_at || r.createdAt;
        if (!date) continue;
        const month = date.slice(0, 7);
        monthly[month] = (monthly[month] || 0) + parseFloat(r.amount || 0);
      }
      const sorted = Object.entries(monthly).sort((a,b) => a[0].localeCompare(b[0]));
      if (sorted.length === 0) { el.innerHTML = '<div class="empty-state" style="padding:20px"><p>No receipts data</p></div>'; return; }
      const max = Math.max(...sorted.map(([,v]) => v));
      el.innerHTML = `<div style="display:flex;align-items:flex-end;gap:8px;height:180px;padding-bottom:20px">` +
        sorted.map(([month, amt]) => `
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
            <div style="font-size:9px;color:var(--text3)">${Utils.currency(amt)}</div>
            <div style="background:var(--teal);border-radius:3px 3px 0 0;width:100%;height:${Math.max(4, Math.round(amt/max*140))}px"></div>
            <div style="font-size:9px;color:var(--text3)">${month.slice(2).replace('-','/')}</div>
          </div>`).join('') + `</div>`;
    } catch { el.innerHTML = '<div class="empty-state" style="padding:20px"><p>No data</p></div>'; }
  },

  async loadUnitChart() {
    const el = document.getElementById('an-unit-chart');
    if (!el) return;
    try {
      const res = await Api.get('/units', { params: { pageSize: 500 } });
      const list = res.data || res || [];
      const counts = {};
      for (const u of list) {
        const st = u.status || 'available';
        counts[st] = (counts[st] || 0) + 1;
      }
      this._renderBarChart(el, counts, 'Unit Status');
    } catch { el.innerHTML = '<div class="empty-state" style="padding:20px"><p>No data</p></div>'; }
  },

  async loadAgeing() {
    const el = document.getElementById('an-ageing');
    if (!el) return;
    try {
      const res = await Api.get('/payments/overdue', { params: { pageSize: 300 } });
      const list = res.data || res || [];
      const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
      const bucketAmt = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
      const today = new Date();
      for (const r of list) {
        const dueDate = r.due_date || r.dueDate;
        if (!dueDate) continue;
        const days = Math.floor((today - new Date(dueDate)) / 86400000);
        const key = days <= 30 ? '0-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '90+';
        buckets[key]++;
        bucketAmt[key] += parseFloat(r.outstanding || r.balance || 0);
      }
      el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">` +
        Object.entries(buckets).map(([range, count]) => `
          <div class="kpi" style="${range==='90+'?'background:rgba(220,53,69,.1)':range==='61-90'?'background:rgba(220,120,0,.1)':''}">
            <div class="kpi-lbl">${range} days</div>
            <div class="kpi-val">${count}</div>
            <div class="kpi-sub">${Utils.currency(bucketAmt[range])}</div>
          </div>`).join('') + `</div>`;
    } catch { el.innerHTML = '<div class="empty-state" style="padding:20px"><p>No overdue data</p></div>'; }
  },

  _renderBarChart(el, counts, label) {
    const entries = Object.entries(counts).sort((a,b) => b[1]-a[1]);
    if (entries.length === 0) { el.innerHTML = '<div class="empty-state" style="padding:20px"><p>No data</p></div>'; return; }
    const max = Math.max(...entries.map(([,v]) => v));
    el.innerHTML = entries.map(([key, count]) => `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <div style="width:120px;font-size:11px;text-align:right;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${key}</div>
        <div style="flex:1;background:var(--bg2);border-radius:3px;height:20px;position:relative">
          <div style="background:var(--accent);border-radius:3px;height:100%;width:${Math.max(4,Math.round(count/max*100))}%"></div>
        </div>
        <div style="width:30px;font-size:11px;font-weight:600">${count}</div>
      </div>`).join('');
  },
};
