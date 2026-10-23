// ROF CRM — Analytics Dashboard Page

Pages.analytics = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="page-hdr">
      <h1>Analytics</h1>
      <div class="breadcrumb">Reports / <b>Analytics</b></div>
    </div>

    <style>
      .anl-sp { border-radius:10px; overflow:hidden }
      .anl-sp .sp-hdr { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:14px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border) }
      .anl-sp .sp-title { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
      .anl-sp .sp-body { padding:18px }
      .anl-sp .fc { padding:8px 12px; font-size:13px; border-radius:8px; min-height:38px }
      .anl-sp .fc:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg) }
      .anl-sp .btn-fetch, .anl-sp .btn-fetch:hover { background:var(--teal) !important; color:#fff !important; border:none; border-radius:8px; min-height:38px; padding:8px 22px; font-weight:600 }
      .anl-sp .btg { border-radius:8px }
      .anl-sp .btg-item { padding:7px 14px; font-size:12px }
      #an-kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:14px }
      @media (max-width:800px) { #content > div[style*="grid-template-columns:1fr 1fr"] { grid-template-columns:minmax(0,1fr) !important } }
    </style>

    <!-- Date range filter -->
    <div class="sp anl-sp" style="margin-bottom:16px">
      <div class="sp-body" style="padding:10px 14px">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <div class="btg">
            <button type="button" class="btg-item on" onclick="btgSelect(this);AnalyticsPage.setRange('month')">This Month</button>
            <button type="button" class="btg-item" onclick="btgSelect(this);AnalyticsPage.setRange('quarter')">This Quarter</button>
            <button type="button" class="btg-item" onclick="btgSelect(this);AnalyticsPage.setRange('year')">This Year</button>
          </div>
          <input type="date" class="fc" id="an-from" style="width:150px" value="${Utils.monthStart()}" onchange="AnalyticsPage.customRange()">
          <span style="color:var(--text3)">to</span>
          <input type="date" class="fc" id="an-to" style="width:150px" value="${Utils.today()}" onchange="AnalyticsPage.customRange()">
          <select class="fc" id="an-project" style="width:200px"><option value="">— All Projects —</option></select>
          <button class="btn btn-fetch btn-sm" onclick="AnalyticsPage.load()">APPLY</button>
          <span style="font-size:11px;color:var(--text3)">The dates apply to leads. Money, units and ageing are as of today.</span>
        </div>
      </div>
    </div>

    <!-- Top KPIs -->
    <div class="kpi-row" id="an-kpis">
      ${[...Array(6)].map(() => `<div class="kpi"><div class="page-loading"><div class="spinner"></div></div></div>`).join('')}
    </div>

    <!-- Charts row -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
      <div class="sp anl-sp">
        <div class="sp-hdr"><div class="sp-title">Leads by Stage</div></div>
        <div class="sp-body" id="an-stage-chart"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
      <div class="sp anl-sp">
        <div class="sp-hdr"><div class="sp-title">Collection Trend (last 12 months)</div></div>
        <div class="sp-body" id="an-collection-chart"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
    </div>

    <!-- Second row -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
      <div class="sp anl-sp">
        <div class="sp-hdr"><div class="sp-title">Lead Sources (all dates)</div></div>
        <div class="sp-body" id="an-source-chart"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
      <div class="sp anl-sp">
        <div class="sp-hdr"><div class="sp-title">Unit Status Distribution (now)</div></div>
        <div class="sp-body" id="an-unit-chart"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
    </div>

    <!-- Payment ageing -->
    <div class="sp anl-sp" style="margin-top:16px">
      <div class="sp-hdr"><div class="sp-title">Payment Ageing (as of today)</div></div>
      <div class="sp-body" id="an-ageing"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>
  `;

  const sel = document.getElementById('an-project');
  if (sel) sel.innerHTML = await Utils.projectOptions();
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
    const el = document.getElementById('an-from'), to = document.getElementById('an-to');
    if (el) el.value = Utils.isoDate(from);
    if (to) to.value = Utils.today();   // the range runs up to today
    this.load();
  },

  // a date typed by hand: no quick range is the current one any more
  customRange() { document.querySelectorAll('.anl-sp .btg-item').forEach(b => b.classList.remove('on')); },

  async load() {
    const from = document.getElementById('an-from')?.value;
    const to = document.getElementById('an-to')?.value;
    if ((from && !to) || (!from && to)) { Utils.warn('Choose both dates, or clear both'); return; }
    if (from && to && from > to) { Utils.warn('The first date must not be after the last date'); return; }
    const project = document.getElementById('an-project')?.value || '';
    const params = {}, pp = project ? { projectId: project } : {};
    if (from) { params.dateFrom = from; params.dateTo = to; }
    Object.assign(params, pp);
    this._pp = pp;
    this._sales = null;
    // a slow answer of an earlier Apply must not paint over a newer one
    const run = this._run = (this._run || 0) + 1;
    await Promise.allSettled([
      this.loadKpis(params, run),
      this.loadCollectionChart(run),
      this.loadUnitChart(run),
      this.loadAgeing(run),
    ]);
  },

  // the same numbers as the Reports screens: leads and stages by the lead date, money from the dues ledger
  async loadKpis(params, run) {
    try {
      const [salesRes, finRes] = await Promise.allSettled([
        Api.get('/reports/sales-dashboard', { params }),
        Api.get('/reports/financial-dashboard', { params: this._pp }),
      ]);
      if (run !== this._run) return;
      const sales = salesRes.status === 'fulfilled' ? ((salesRes.value.data || {}).metrics || {}) : {};
      const fin = finRes.status === 'fulfilled' ? ((finRes.value.data || {}).metrics || {}) : {};
      this._sales = sales;

      const el = document.getElementById('an-kpis');
      if (!el) return;
      el.innerHTML = `
        <div class="kpi c-accent"><div class="kpi-lbl">Total Leads</div><div class="kpi-val">${Number(sales.total_leads || 0)}</div><div class="kpi-sub">In the chosen dates</div></div>
        <div class="kpi c-blue"><div class="kpi-lbl">Applications</div><div class="kpi-val">${Number(sales.application_filed || 0)}</div><div class="kpi-sub">Filed, in the chosen dates</div></div>
        <div class="kpi c-green"><div class="kpi-lbl">Allotted</div><div class="kpi-val">${Number(sales.allotted || 0)}</div><div class="kpi-sub">Leads at allotted stage</div></div>
        <div class="kpi c-teal"><div class="kpi-lbl">Collection</div><div class="kpi-val">${Utils.currency(fin.total_collected || 0)}</div><div class="kpi-sub">Total cleared receipts</div></div>
        <div class="kpi c-warn"><div class="kpi-lbl">Outstanding</div><div class="kpi-val">${Utils.currency(fin.outstanding || 0)}</div><div class="kpi-sub">Pending collection, as of today</div></div>
        <div class="kpi c-red"><div class="kpi-lbl">Conversion Rate</div><div class="kpi-val">${Number(sales.conversion_rate || 0)}%</div><div class="kpi-sub">Lead to allotment, in the chosen dates</div></div>
      `;
      const stage = document.getElementById('an-stage-chart');
      if (stage) this._renderBarChart(stage, {
        enquiry: sales.enquiry_stage || 0, interested: sales.interested_stage || 0, 'application filed': sales.application_filed || 0,
        'draw entered': sales.draw_entered || 0, allotted: sales.allotted || 0, cancelled: sales.cancelled || 0,
      }, 'Lead Stage');
    } catch (err) {
      const el = document.getElementById('an-kpis');
      if (el) el.innerHTML = `<div style="padding:20px;color:var(--red)">Could not load KPIs: ${Utils.esc(err.message)}</div>`;
    }
    this.loadSourceChart(run);
  },

  async loadSourceChart(run) {
    const el = document.getElementById('an-source-chart');
    if (!el) return;
    try {
      const res = await Api.get('/reports/lead-source-analysis', { params: this._pp });
      if (run !== this._run) return;
      const counts = {};
      for (const r of (res.data || [])) counts[String(r.lead_source || 'unknown').replace(/_/g, ' ')] = Number(r.total_leads || 0);
      this._renderBarChart(el, counts, 'Lead Source');
    } catch { el.innerHTML = '<div class="empty-state" style="padding:20px"><p>No data</p></div>'; }
  },

  async loadCollectionChart(run) {
    const el = document.getElementById('an-collection-chart');
    if (!el) return;
    try {
      const res = await Api.get('/reports/monthly-collection', { params: this._pp });
      if (run !== this._run) return;
      const sorted = (res.data || []).map(r => [String(r.month).slice(0, 7), Number(r.amount_collected_inr || 0)]).sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
      if (sorted.length === 0) { el.innerHTML = '<div class="empty-state" style="padding:20px"><p>No receipts data</p></div>'; return; }
      const max = Math.max(...sorted.map(([, v]) => v), 1);
      el.innerHTML = `<div style="display:flex;align-items:flex-end;gap:8px;height:180px;padding-bottom:20px">` +
        sorted.map(([month, amt]) => `
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
            <div style="font-size:9px;color:var(--text3)">${Utils.currency(amt)}</div>
            <div style="background:var(--teal);border-radius:3px 3px 0 0;width:100%;height:${Math.max(4, Math.round(amt / max * 140))}px"></div>
            <div style="font-size:9px;color:var(--text3)">${month.slice(2).replace('-', '/')}</div>
          </div>`).join('') + `</div>`;
    } catch { el.innerHTML = '<div class="empty-state" style="padding:20px"><p>No data</p></div>'; }
  },

  async loadUnitChart(run) {
    const el = document.getElementById('an-unit-chart');
    if (!el) return;
    try {
      const res = await Api.get('/reports/inventory-details', { params: this._pp });
      if (run !== this._run) return;
      const t = (k) => (res.data || []).reduce((a, r) => a + Number(r[k] || 0), 0);
      this._renderBarChart(el, { available: t('unsold_units'), booked: t('booked_units'), allotted: t('allotted_units'), hold: t('hold_units'), 'temp surrender': t('temp_surrender_units') }, 'Unit Status');
    } catch { el.innerHTML = '<div class="empty-state" style="padding:20px"><p>No data</p></div>'; }
  },

  async loadAgeing(run) {
    const el = document.getElementById('an-ageing');
    if (!el) return;
    try {
      const res = await Api.get('/reports/payment-ageing', { params: this._pp });
      if (run !== this._run) return;
      const by = Object.fromEntries((res.data || []).map(r => [r.ageing_bucket, r]));
      const ranges = ['1-30 days', '31-90 days', '91-180 days', '180+ days'];
      el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">` +
        ranges.map((range) => `
          <div class="kpi" style="${range === '180+ days' ? 'background:rgba(220,53,69,.1)' : range === '91-180 days' ? 'background:rgba(220,120,0,.1)' : ''}">
            <div class="kpi-lbl">${range}</div>
            <div class="kpi-val">${Number(by[range]?.count_demands || 0)}</div>
            <div class="kpi-sub">${Utils.currency(by[range]?.total_due_inr || 0)}</div>
          </div>`).join('') + `</div>`;
    } catch { el.innerHTML = '<div class="empty-state" style="padding:20px"><p>No overdue data</p></div>'; }
  },

  _renderBarChart(el, counts, label) {
    const entries = Object.entries(counts).sort((a,b) => b[1]-a[1]);
    if (entries.length === 0) { el.innerHTML = '<div class="empty-state" style="padding:20px"><p>No data</p></div>'; return; }
    const max = Math.max(...entries.map(([,v]) => v));
    el.innerHTML = entries.map(([key, count]) => `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <div style="width:120px;font-size:11px;text-align:right;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Utils.esc(key)}</div>
        <div style="flex:1;background:var(--bg2);border-radius:3px;height:20px;position:relative">
          <div style="background:var(--accent);border-radius:3px;height:100%;width:${Math.max(4,Math.round(count/max*100))}%"></div>
        </div>
        <div style="width:30px;font-size:11px;font-weight:600">${count}</div>
      </div>`).join('');
  },
};
