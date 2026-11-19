// ROF CRM — Dashboard Page Module

Pages.dashboard = async function() {
  const content = document.getElementById('content');
  content.innerHTML = `
    <style>
      #content:has(.dbn) { margin-left:auto; margin-right:auto; width:100% }
      .dbn { max-width:1500px; margin-left:auto; margin-right:auto }
      .dbn .page-hdr { align-items:baseline }
      .dbn-date { margin-left:auto; font-size:12px; color:var(--text3) }
      .dbn .tbl-wrap { border:1px solid var(--border2); border-radius:10px }
      .dbn .tbl-hdr { padding:12px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border); flex-wrap:wrap }
      .dbn .tbl-title { font-size:12px; letter-spacing:.6px }
      .dbn .tbl-actions { margin-left:auto; display:flex; align-items:center; gap:8px }
      .dbn .btn-ghost.btn-sm { min-height:28px; padding:4px 12px; font-size:12px; border-radius:6px }
      .dbn .dash-tbl { font-size:12.5px }
      .dbn .dash-tbl th { padding:9px 12px; background:var(--surface2); color:var(--text3); font-size:11px; letter-spacing:.4px }
      .dbn .dash-tbl td { padding:8px 12px }
      .dbn .dash-tbl .grp-hdr, .dbn .dash-tbl .sub-hdr { background:var(--surface2); color:var(--text2) }
      .dbn .btn-teal.btn-sm { background:var(--teal); color:#fff; border:none; border-radius:6px; min-height:28px; padding:4px 12px; font-size:12px; font-weight:600 }
      .dbn .empty-state { padding:32px 18px }
      .dbn-kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:12px; margin-bottom:14px }
      .dbn-k { background:var(--surface); border:1px solid var(--border2); border-radius:10px; padding:14px 16px; cursor:pointer; transition:border-color .15s }
      .dbn-k:hover { border-color:var(--teal) }
      .dbn-k-lbl { font-size:11px; color:var(--text3); text-transform:uppercase; letter-spacing:.5px; font-weight:600 }
      .dbn-k-val { font-size:22px; font-weight:700; color:var(--text); margin-top:6px; font-variant-numeric:tabular-nums }
      .dbn-k-val.bad { color:var(--red) }
      .dbn-k-sub { font-size:11.5px; color:var(--text3); margin-top:4px }
      .dbn-row { display:grid; gap:14px; margin-bottom:14px }
      .dbn-row.r2 { grid-template-columns:3fr 2fr }
      .dbn-row.r3 { grid-template-columns:1.2fr 1fr 1fr }
      .dbn-body { padding:16px 18px }
      .dbn-bar-row { display:grid; grid-template-columns:130px 1fr auto; align-items:center; gap:12px; margin-bottom:12px }
      .dbn-bar-row:last-child { margin-bottom:0 }
      .dbn-bar-name { font-size:12.5px; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
      .dbn-bar-track { height:8px; background:var(--surface2); border-radius:4px; overflow:hidden }
      .dbn-bar-fill { height:100%; background:var(--teal); border-radius:4px }
      .dbn-bar-val { font-size:12.5px; font-weight:600; color:var(--text); text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap }
      .dbn-bar-val small { display:block; font-weight:400; color:var(--text3); font-size:11px }
      .dbn-cols { display:flex; align-items:flex-end; justify-content:space-between; gap:12px; height:150px }
      .dbn-col { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; height:100%; gap:6px }
      .dbn-col-bar { width:100%; max-width:42px; background:var(--teal); border-radius:3px 3px 0 0; min-height:3px }
      .dbn-col-bar.hot { background:var(--red) }
      .dbn-col-n { font-size:12.5px; font-weight:600; color:var(--text) }
      .dbn-col-l { font-size:11px; color:var(--text3) }
      .dbn-att { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:11px 18px; border-bottom:1px solid var(--border); cursor:pointer }
      .dbn-att:last-child { border-bottom:none }
      .dbn-att:hover { background:var(--surface2) }
      .dbn-att b { font-size:12.5px; font-weight:500; color:var(--text) }
      .dbn-att span { font-size:14px; font-weight:700; color:var(--text3); font-variant-numeric:tabular-nums }
      .dbn-att span.bad { color:var(--red) }
      .dbn-stack { display:flex; height:10px; border-radius:5px; overflow:hidden; background:var(--surface2); margin-bottom:14px }
      .dbn-stack i { display:block; height:100% }
      .dbn-leg div { display:flex; align-items:center; gap:8px; font-size:12.5px; color:var(--text2); padding:4px 0 }
      .dbn-leg em { width:9px; height:9px; border-radius:2px; flex-shrink:0 }
      .dbn-leg b { margin-left:auto; color:var(--text); font-weight:600; font-variant-numeric:tabular-nums }
      .dbn-big { font-size:22px; font-weight:700; color:var(--text); margin-bottom:10px }
      .dbn-big small { font-size:12px; font-weight:400; color:var(--text3); margin-left:6px }
      .dbn-hero { display:flex; justify-content:space-between; align-items:center; gap:20px; flex-wrap:wrap; padding:24px 28px; margin-bottom:16px; border-radius:16px; color:#fff;
        background:var(--teal); background:linear-gradient(135deg, var(--teal) 0%, color-mix(in srgb, var(--teal) 55%, #0b2a33) 100%); position:relative; overflow:hidden; box-shadow:0 8px 24px rgba(0,0,0,.12) }
      .dbn-hero::after { content:''; position:absolute; right:-60px; top:-80px; width:260px; height:260px; border-radius:50%; background:rgba(255,255,255,.08) }
      .dbn-hero::before { content:''; position:absolute; right:140px; bottom:-110px; width:200px; height:200px; border-radius:50%; background:rgba(255,255,255,.06) }
      .dbn-hero-l, .dbn-hero-r { position:relative; z-index:1 }
      .dbn-greet { font-size:22px; font-weight:700; letter-spacing:.2px }
      .dbn-hero .dbn-date { margin-left:0; font-size:12.5px; color:#fff; opacity:.85; margin-top:4px }
      .dbn-actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:16px }
      .dbn-act { background:rgba(255,255,255,.16); color:#fff; border:1px solid rgba(255,255,255,.28); border-radius:999px; padding:7px 16px; font-size:12px; font-weight:600; cursor:pointer; transition:.15s; backdrop-filter:blur(4px) }
      .dbn-act:hover { background:#fff; color:var(--teal) }
      .dbn-hero-r { text-align:right }
      .dbn-hero-lbl { font-size:11px; text-transform:uppercase; letter-spacing:1px; opacity:.85 }
      .dbn-hero-val { font-size:36px; font-weight:800; line-height:1.1; margin-top:4px; font-variant-numeric:tabular-nums }
      .dbn-hero-sub { font-size:12px; opacity:.85; margin-top:6px }
      .dbn-kpis { grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:14px; margin-bottom:16px }
      .dbn-k { border-radius:14px; padding:16px 18px; position:relative; overflow:hidden; transition:transform .15s, box-shadow .15s, border-color .15s }
      .dbn-k:hover { transform:translateY(-2px); box-shadow:0 8px 20px rgba(0,0,0,.10) }
      .dbn-k::before { content:''; position:absolute; left:0; top:0; bottom:0; width:4px; background:var(--c) }
      .dbn-k-ico { width:38px; height:38px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:18px; background:color-mix(in srgb, var(--c) 16%, transparent); margin-bottom:12px }
      .dbn-k-val { font-size:26px; font-weight:800; line-height:1.1 }
      @media (max-width:900px) { .dbn-hero-r { text-align:left } }
      @media (max-width:1100px) { .dbn-row.r3 { grid-template-columns:minmax(0,1fr) } }
      @media (max-width:900px) { .dbn-row.r2 { grid-template-columns:minmax(0,1fr) } .dbn .g2 { grid-template-columns:minmax(0,1fr) } .dbn-bar-row { grid-template-columns:90px 1fr auto } }
    </style>
    <div class="dbn">
    <div class="dbn-hero">
      <div class="dbn-hero-l">
        <div class="dbn-greet" id="dash-greet">Welcome</div>
        <div class="dbn-date" id="dash-date"></div>
        <div class="dbn-actions">
          <button class="dbn-act" onclick="Router.navigate('/booking')">＋ New Booking</button>
          <button class="dbn-act" onclick="Router.navigate('/receipts')">Receipts</button>
          <button class="dbn-act" onclick="Router.navigate('/demands')">Demands</button>
          <button class="dbn-act" onclick="Router.navigate('/unit-status')">Unit Status</button>
          <button class="dbn-act" onclick="Router.navigate('/reports')">Reports</button>
        </div>
      </div>
      <div class="dbn-hero-r">
        <div class="dbn-hero-lbl">Today's Collection</div>
        <div class="dbn-hero-val" id="dash-hero-coll">—</div>
        <div class="dbn-hero-sub" id="dash-hero-sub">Loading…</div>
      </div>
    </div>
    <div id="dash-alert"></div>

    <div id="dash-kpis" class="dbn-kpis">
      ${[...Array(6)].map(() => `<div class="dbn-k"><div class="page-loading"><div class="spinner"></div></div></div>`).join('')}
    </div>

    <div class="dbn-row r2">
      <div class="tbl-wrap" style="margin-bottom:0">
        <div class="tbl-hdr"><span class="tbl-icon">📈</span><div class="tbl-title">Collection by Project</div><div class="tbl-actions"><span style="font-size:11px;color:var(--text3)">This month</span></div></div>
        <div class="dbn-body" id="dash-chart-coll"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
      <div class="tbl-wrap" style="margin-bottom:0">
        <div class="tbl-hdr"><span class="tbl-icon">⏳</span><div class="tbl-title">Dues Ageing</div><div class="tbl-actions"><span style="font-size:11px;color:var(--text3)">Next 28 days</span></div></div>
        <div class="dbn-body" id="dash-chart-due"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
    </div>

    <div class="dbn-row r3">
      <div class="tbl-wrap" style="margin-bottom:0">
        <div class="tbl-hdr"><span class="tbl-icon">🔔</span><div class="tbl-title">Needs Attention</div></div>
        <div id="dash-attention"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
      <div class="tbl-wrap" style="margin-bottom:0">
        <div class="tbl-hdr"><span class="tbl-icon">📨</span><div class="tbl-title">Demand Letters</div><div class="tbl-actions"><button class="btn btn-ghost btn-sm" onclick="Router.navigate('/demands')">Open</button></div></div>
        <div class="dbn-body" id="dash-donut-demand"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
      <div class="tbl-wrap" style="margin-bottom:0">
        <div class="tbl-hdr"><span class="tbl-icon">🎫</span><div class="tbl-title">Task Status</div><div class="tbl-actions"><button class="btn btn-ghost btn-sm" onclick="Router.navigate('/tasks')">Open</button></div></div>
        <div class="dbn-body" id="dash-donut-tickets"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
    </div>

    <!-- Row 1: Pending Cheques + Demand Status -->
    <div class="g2" style="margin-top:20px">
      <div class="tbl-wrap">
        <div class="tbl-hdr">
          <span class="tbl-icon">📝</span><div class="tbl-title">Pending Cheques</div>
          <div class="tbl-actions"><button class="btn btn-ghost btn-sm" onclick="Router.navigate('/receipts')">View All</button></div>
        </div>
        <div id="dash-pending-cheques"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
      <div class="tbl-wrap">
        <div class="tbl-hdr">
          <span class="tbl-icon">📋</span><div class="tbl-title">Demand Status</div>
          <div class="tbl-actions"><button class="btn btn-ghost btn-sm" onclick="Router.navigate('/demands')">Details</button></div>
        </div>
        <div id="dash-demand-status"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
    </div>

    <!-- Row 2: Pending Approval + Employee Task Details -->
    <div class="g2" style="margin-top:14px">
      <div class="tbl-wrap">
        <div class="tbl-hdr"><span class="tbl-icon">✅</span><div class="tbl-title">Pending Approval</div></div>
        <div id="dash-pending-approval"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
      <div class="tbl-wrap">
        <div class="tbl-hdr">
          <span class="tbl-icon">👥</span><div class="tbl-title">Employee Wise Task Details</div>
          <div class="tbl-actions">
            <button class="collapse-toggle" onclick="DashboardPage.toggleCollapse('dash-employee-tickets')" aria-label="Collapse">▾</button>
            <button class="btn btn-ghost btn-sm" onclick="Router.navigate('/tasks')">View All</button>
          </div>
        </div>
        <div id="dash-employee-tickets" class="collapsible-body"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
    </div>

    <!-- Row 3: Daily Status (full width) -->
    <div class="tbl-wrap" style="margin-top:14px">
      <div class="tbl-hdr">
        <span class="tbl-icon">📊</span><div class="tbl-title">Daily Status</div>
        <div class="tbl-actions"><span style="font-size:11px;color:var(--text3)">T = Today &nbsp;·&nbsp; M = This Month &nbsp;·&nbsp; TIID = Total Till Date</span></div>
      </div>
      <div id="dash-daily-status"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>

    <!-- Row 4: Parking Detail + Forthcoming Due -->
    <div class="g2" style="margin-top:14px">
      <div class="tbl-wrap">
        <div class="tbl-hdr">
          <span class="tbl-icon">🅿</span><div class="tbl-title">Parking Detail</div>
          <div class="tbl-actions">
            <button class="collapse-toggle collapsed" onclick="DashboardPage.toggleCollapse('dash-parking-detail')" aria-label="Expand">▾</button>
            <button class="btn btn-ghost btn-sm" onclick="Router.navigate('/parking')">Manage</button>
          </div>
        </div>
        <div id="dash-parking-detail" class="collapsible-body collapsed"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
      <div class="tbl-wrap">
        <div class="tbl-hdr">
          <span class="tbl-icon">📅</span><div class="tbl-title">Forthcoming Due</div>
          <div class="tbl-actions"><button class="btn btn-ghost btn-sm" onclick="Router.navigate('/demands')">Schedule</button></div>
        </div>
        <div id="dash-forthcoming-due"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
    </div>
    </div>
  `;

  // Load all data in parallel — summary + dedicated endpoints
  const mine = document.getElementById('dash-kpis');
  const [summaryRes, dailyRes, parkingRes, ticketsRes] = await Promise.allSettled([
    Api.get('/dashboard/summary'),
    Api.get('/dashboard/daily-status'),
    Api.get('/dashboard/parking-detail'),
    Api.get('/dashboard/employee-tickets'),
  ]);

  // The user may have gone to another page while the numbers loaded; this dashboard is gone, so stop.
  if (!mine || !mine.isConnected) return;

  const summary   = summaryRes.status === 'fulfilled'  ? (summaryRes.value.data   || {}) : {};
  const dailyRows = dailyRes.status === 'fulfilled'    ? (dailyRes.value.data     || []) : [];
  const parkRows  = parkingRes.status === 'fulfilled'  ? (parkingRes.value.data   || []) : [];
  const tickRows  = ticketsRes.status === 'fulfilled'  ? (ticketsRes.value.data   || []) : [];

  const chequeRows   = summary.pendingCheques  || [];
  const demandRows   = summary.demandStatus    || [];
  const approvalRows = summary.pendingApproval || [];
  const forthRows    = summary.forthcomingDue  || [];

  // ── KPI CARDS ──────────────────────────────────────────────────────────────
  const totalPending    = chequeRows.reduce((s, r) => s + parseInt(r.pending    || 0), 0);
  const totalPDC        = chequeRows.reduce((s, r) => s + parseInt(r.pdc        || 0), 0);
  const totalAmount     = chequeRows.reduce((s, r) => s + parseFloat(r.amount   || 0), 0);
  const totalApproval   = summary.pendingApprovalCount ?? approvalRows.length;
  const totalToday      = forthRows.reduce((s, r)  => s + parseInt(r.today_dues || 0), 0);
  const total17Days     = forthRows.reduce((s, r)  => s + parseInt(r.days_1_7   || 0), 0);
  const totalTicketsOpen = tickRows.reduce((s, r) => s + parseInt(r.pending || 0), 0);
  const totalCollection = dailyRows.reduce((s, r) => s + parseFloat(r.coll_today || 0), 0);

  const kpi = (c, ico, lbl, val, sub, go, bad) => `
    <div class="dbn-k" style="--c:${c}" ${go ? `onclick="Router.navigate('${go}')"` : ''}>
      <div class="dbn-k-ico">${ico}</div>
      <div class="dbn-k-lbl">${lbl}</div>
      <div class="dbn-k-val${bad ? ' bad' : ''}">${val}</div>
      <div class="dbn-k-sub">${sub}</div>
    </div>`;
  document.getElementById('dash-kpis').innerHTML =
    kpi('var(--teal)',   '💰', "Today's Collection", Utils.currency(totalCollection), 'All projects today', '/receipts') +
    kpi('var(--warn)',   '📝', 'Pending Cheques', totalPending, Utils.currency(totalAmount), '/receipts') +
    kpi('var(--accent)', '🏦', 'PDC / Demand Draft', totalPDC, 'Post-dated instruments', '') +
    kpi('var(--blue)',   '✅', 'Pending Approval', totalApproval, 'Receipts awaiting approval', '/receipts') +
    kpi('var(--red)',    '⏰', "Today's Dues", totalToday, `${total17Days} due in next 7 days`, '/demands', totalToday > 0) +
    kpi('var(--green)',  '🎫', 'Open Tasks', totalTicketsOpen, 'Across all employees', '/tasks');

  // Hero
  const _u = (window.Auth && Auth.getUser && Auth.getUser()) || {};
  const _h = new Date().getHours();
  const _gr = _h < 12 ? 'Good morning' : _h < 17 ? 'Good afternoon' : 'Good evening';
  const _nm = (_u.name || '').split(' ')[0];
  const gEl = document.getElementById('dash-greet');
  if (gEl) gEl.textContent = _gr + (_nm ? ', ' + _nm : '') + ' 👋';
  const hc = document.getElementById('dash-hero-coll');
  if (hc) hc.textContent = Utils.currency(totalCollection);
  const hs = document.getElementById('dash-hero-sub');
  if (hs) hs.textContent = `${totalPending} cheque(s) pending · ${totalApproval} awaiting approval · ${totalToday} due today`;

  const dEl = document.getElementById('dash-date');
  if (dEl) dEl.textContent = new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric', timeZone:'Asia/Kolkata' });

  // Collection by project (this month)
  const collEl = document.getElementById('dash-chart-coll');
  if (collEl) {
    const top = [...dailyRows].sort((a, b) => parseFloat(b.coll_month || 0) - parseFloat(a.coll_month || 0)).slice(0, 8);
    const maxC = Math.max(1, ...top.map(r => parseFloat(r.coll_month || 0)));
    collEl.innerHTML = top.length === 0
      ? `<div class="empty-state"><div class="empty-icon">📈</div><div>No collection data</div></div>`
      : top.map(r => {
          const v = parseFloat(r.coll_month || 0);
          return `<div class="dbn-bar-row">
            <div class="dbn-bar-name" title="${Utils.esc(r.project || '')}">${Utils.esc(r.project || '—')}</div>
            <div class="dbn-bar-track"><div class="dbn-bar-fill" style="width:${Math.max(1, v / maxC * 100)}%"></div></div>
            <div class="dbn-bar-val">${Utils.currency(v)}<small>Today ${Utils.currency(r.coll_today)}</small></div>
          </div>`;
        }).join('');
  }

  // Dues ageing
  const dueEl = document.getElementById('dash-chart-due');
  if (dueEl) {
    const sum = k => forthRows.reduce((a, r) => a + parseInt(r[k] || 0), 0);
    const buckets = [
      { l:'Today', n:sum('today_dues'), hot:true }, { l:'1-7 d', n:sum('days_1_7') }, { l:'8-14 d', n:sum('days_8_14') },
      { l:'15-21 d', n:sum('days_15_21') }, { l:'22-28 d', n:sum('days_22_28') },
    ];
    const maxD = Math.max(1, ...buckets.map(b => b.n));
    dueEl.innerHTML = forthRows.length === 0
      ? `<div class="empty-state"><div class="empty-icon">📅</div><div>No upcoming dues</div></div>`
      : `<div class="dbn-cols">${buckets.map(b => `
          <div class="dbn-col">
            <div class="dbn-col-n">${b.n}</div>
            <div class="dbn-col-bar${b.hot ? ' hot' : ''}" style="height:${Math.max(2, b.n / maxD * 100)}%"></div>
            <div class="dbn-col-l">${b.l}</div>
          </div>`).join('')}</div>`;
  }

  // Stacked bar + legend (replaces donuts)
  const stack = (parts, big, bigLbl) => {
    const tot = parts.reduce((a, p) => a + p.n, 0);
    return `<div class="dbn-big">${big}<small>${bigLbl}</small></div>
      <div class="dbn-stack">${parts.filter(p => p.n > 0).map(p => `<i style="width:${p.n / tot * 100}%;background:${p.c}"></i>`).join('')}</div>
      <div class="dbn-leg">${parts.map(p => `<div><em style="background:${p.c}"></em>${p.l}<b>${p.n}</b></div>`).join('')}</div>`;
  };

  const dsum = k => demandRows.reduce((a, r) => a + parseInt(r[k] || 0), 0);
  const sentN = dsum('demand_send') + dsum('rem1_send') + dsum('rem2_send') + dsum('term_send');
  const unsentN = dsum('demand_unsend') + dsum('rem1_unsend') + dsum('rem2_unsend') + dsum('term_unsend');
  const dd = document.getElementById('dash-donut-demand');
  if (dd) dd.innerHTML = demandRows.length === 0
    ? `<div class="empty-state"><div class="empty-icon">📋</div><div>No demand data</div></div>`
    : stack([{ l:'Sent', n:sentN, c:'var(--teal)' }, { l:'Unsent', n:unsentN, c:'var(--warn)' }],
        (sentN + unsentN) ? Math.round(sentN / (sentN + unsentN) * 100) + '%' : '0%', 'sent');

  const tsum = k => tickRows.reduce((a, r) => a + parseInt(r[k] || 0), 0);
  const tOpen = tsum('pending'), tRes = tsum('completed'), tOver = tsum('overdue');
  const td = document.getElementById('dash-donut-tickets');
  if (td) td.innerHTML = tickRows.length === 0
    ? `<div class="empty-state"><div class="empty-icon">👥</div><div>No tasks assigned</div></div>`
    : stack([{ l:'Pending', n:tOpen, c:'var(--warn)' }, { l:'Completed', n:tRes, c:'var(--teal)' }, { l:'Overdue', n:tOver, c:'var(--red)' }],
        tsum('total'), 'tasks');

  // Needs attention
  const att = (t, n, go, bad) => `<div class="dbn-att" onclick="Router.navigate('${go}')"><b>${t}</b><span${bad && n ? ' class="bad"' : ''}>${n}</span></div>`;
  const ae = document.getElementById('dash-attention');
  if (ae) ae.innerHTML =
    att("Today's dues", totalToday, '/demands', true) +
    att('Pending cheques', totalPending, '/receipts') +
    att('Receipts to approve', totalApproval, '/receipts') +
    att('Unsent demand letters', unsentN, '/demands') +
    att('Overdue tasks', tOver, '/tasks', true);

  // Alert bar
  if (totalPending > 0 || totalApproval > 0) {
    document.getElementById('dash-alert').innerHTML = `
      <div class="alert alert-warn" style="margin-bottom:14px">
        ⚠
        ${totalPending  ? ` ${totalPending} cheque(s) pending` : ''}
        ${totalApproval ? ` · ${totalApproval} receipt(s) pending approval` : ''}
      </div>
    `;
  }

  // ── PENDING CHEQUES TABLE ──────────────────────────────────────────────────
  const chequeTotal = chequeRows.reduce((acc, r) => ({
    pending:    (acc.pending    || 0) + parseInt(r.pending    || 0),
    deposite:   (acc.deposite   || 0) + parseInt(r.deposite   || 0),
    total:      (acc.total      || 0) + parseInt(r.total      || 0),
    pdc:        (acc.pdc        || 0) + parseInt(r.pdc        || 0),
    amount:     (acc.amount     || 0) + parseFloat(r.amount   || 0),
    pdc_amount: (acc.pdc_amount || 0) + parseFloat(r.pdc_amount || 0),
  }), {});

  document.getElementById('dash-pending-cheques').innerHTML = chequeRows.length === 0
    ? `<div class="empty-state"><div class="empty-icon">✓</div><div>No pending cheques</div></div>`
    : `<div class="dash-scroll"><table class="dash-tbl">
        <thead><tr>
          <th>S.No.</th><th>Project</th>
          <th class="txt-right">Pending</th><th class="txt-right">Deposite</th><th class="txt-right">Total</th>
          <th class="txt-right">PDC</th><th class="txt-right">Amount</th><th class="txt-right">PDC Amt</th>
        </tr></thead>
        <tbody>
          ${chequeRows.map((r, i) => `<tr>
            <td>${i + 1}</td>
            <td class="td-bold">${Utils.esc(r.project || '—')}</td>
            <td class="txt-right" style="color:var(--warn)"><a href="/pending-cheques.html?project_id=${r.project_id}" style="color:var(--teal);font-weight:600;text-decoration:none;">${r.pending || 0}</a></td>
            <td class="txt-right" style="color:var(--teal)">${r.deposite || 0}</td>
            <td class="txt-right">${r.total || 0}</td>
            <td class="txt-right" style="color:var(--blue)">${r.pdc || 0}</td>
            <td class="txt-right">${Utils.currency(r.amount)}</td>
            <td class="txt-right">${Utils.currency(r.pdc_amount)}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr class="tfoot-total">
          <td colspan="2"><b>Total</b></td>
          <td class="txt-right"><b>${chequeTotal.pending || 0}</b></td>
          <td class="txt-right"><b>${chequeTotal.deposite || 0}</b></td>
          <td class="txt-right"><b>${chequeTotal.total || 0}</b></td>
          <td class="txt-right"><b>${chequeTotal.pdc || 0}</b></td>
          <td class="txt-right"><b>${Utils.currency(chequeTotal.amount)}</b></td>
          <td class="txt-right"><b>${Utils.currency(chequeTotal.pdc_amount)}</b></td>
        </tr></tfoot>
      </table></div>`;

  // ── DEMAND STATUS TABLE ────────────────────────────────────────────────────
  document.getElementById('dash-demand-status').innerHTML = demandRows.length === 0
    ? `<div class="empty-state"><div class="empty-icon">📋</div><div>No demand data</div></div>`
    : `<div class="dash-scroll"><table class="dash-tbl">
        <thead>
          <tr>
            <th rowspan="2">Project</th>
            <th colspan="2" class="txt-center grp-hdr">Demand</th>
            <th colspan="2" class="txt-center grp-hdr">Reminder 1</th>
            <th colspan="2" class="txt-center grp-hdr">Reminder 2</th>
            <th colspan="2" class="txt-center grp-hdr">Termination</th>
            <th rowspan="2" class="txt-right">Total</th>
            <th rowspan="2" class="txt-right" title="Due outstanding: raised instalments due up to today, less the cleared money applied to them. Not the contract balance.">DUE O/S</th>
          </tr>
          <tr>
            <th class="txt-right sub-hdr">UnSend</th><th class="txt-right sub-hdr">Send</th>
            <th class="txt-right sub-hdr">UnSend</th><th class="txt-right sub-hdr">Send</th>
            <th class="txt-right sub-hdr">UnSend</th><th class="txt-right sub-hdr">Send</th>
            <th class="txt-right sub-hdr">UnSend</th><th class="txt-right sub-hdr">Send</th>
          </tr>
        </thead>
        <tbody>
          ${demandRows.map(r => `<tr>
            <td class="td-bold">${Utils.esc(r.project || '—')}</td>
            <td class="txt-right" style="color:var(--warn)">${DashboardPage.numLink(r.demand_unsend, 'demand', r.project_id, 'demand', 'unsent')}</td>
            <td class="txt-right" style="color:var(--teal)">${DashboardPage.numLink(r.demand_send, 'demand', r.project_id, 'demand', 'sent')}</td>
            <td class="txt-right" style="color:var(--warn)">${DashboardPage.numLink(r.rem1_unsend, 'demand', r.project_id, 'rem1', 'unsent')}</td>
            <td class="txt-right" style="color:var(--teal)">${DashboardPage.numLink(r.rem1_send, 'demand', r.project_id, 'rem1', 'sent')}</td>
            <td class="txt-right" style="color:var(--warn)">${DashboardPage.numLink(r.rem2_unsend, 'demand', r.project_id, 'rem2', 'unsent')}</td>
            <td class="txt-right" style="color:var(--teal)">${DashboardPage.numLink(r.rem2_send, 'demand', r.project_id, 'rem2', 'sent')}</td>
            <td class="txt-right" style="color:var(--warn)">${DashboardPage.numLink(r.term_unsend, 'demand', r.project_id, 'term', 'unsent')}</td>
            <td class="txt-right" style="color:var(--teal)">${DashboardPage.numLink(r.term_send, 'demand', r.project_id, 'term', 'sent')}</td>
            <td class="txt-right">${r.total || 0}</td>
            <td class="txt-right" style="color:var(--red)">${Utils.currency(r.outstanding)}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;

  // ── PENDING APPROVAL TABLE ─────────────────────────────────────────────────
  document.getElementById('dash-pending-approval').innerHTML = approvalRows.length === 0
    ? `<div class="empty-state"><div class="empty-icon">✓</div><div>No pending approvals</div></div>`
    : `<div class="dash-scroll"><table class="dash-tbl">
        <thead><tr>
          <th>Consumer</th><th>Mobile</th><th>Project</th><th>Unit</th>
          <th class="txt-right">Amount</th><th>Mode</th><th>Date</th><th>Action</th>
        </tr></thead>
        <tbody>
          ${approvalRows.map(r => `<tr>
            <td class="td-bold">${Utils.esc(r.consumer_name || '—')}</td>
            <td class="td-mono">${Utils.esc(r.mobile || '—')}</td>
            <td>${Utils.esc(r.project_name || '—')}</td>
            <td>${Utils.esc(r.unit_number || '—')}</td>
            <td class="txt-right" style="color:var(--teal);font-weight:600">${Utils.currency(r.amount_received_inr)}</td>
            <td><span class="chip chip-blue">${Utils.esc(r.payment_method || '—')}</span></td>
            <td style="font-size:10.5px">${Utils.date(r.received_date)}</td>
            <td>${r.booking_cancelled ? '<span style="font-size:11px;color:var(--text-muted)" title="This booking is cancelled. The money is settled by refund, not approval.">Booking cancelled</span>' : (window.Permissions && !Permissions.canCheck('receipt') ? '<span style="font-size:11px;color:var(--text-muted)" title="You do not have checker access for receipts.">No checker access</span>' : `<button class="btn btn-teal btn-sm" data-action="approve-receipt" onclick="DashboardPage.approveReceipt('${r.id}', this)">Approve</button>`)}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;

  // ── EMPLOYEE TICKET DETAILS ────────────────────────────────────────────────
  document.getElementById('dash-employee-tickets').innerHTML = tickRows.length === 0
    ? `<div class="empty-state"><div class="empty-icon">👥</div><div>No tasks assigned</div></div>`
    : `<div class="dash-scroll"><table class="dash-tbl">
        <thead><tr>
          <th>Employee Name</th>
          <th class="txt-right">Total</th><th class="txt-right" style="color:var(--warn)">Pending</th>
          <th class="txt-right" style="color:var(--teal)">Completed</th>
          <th class="txt-right" style="color:var(--red)">Overdue</th>
        </tr></thead>
        <tbody>
          ${tickRows.map(r => `<tr>
            <td class="td-bold">${Utils.esc(r.employee_name || '—')}</td>
            <td class="txt-right">${r.total || 0}</td>
            <td class="txt-right" style="color:var(--warn)">${r.pending || 0}</td>
            <td class="txt-right" style="color:var(--teal)">${r.completed || 0}</td>
            <td class="txt-right" style="color:var(--red)">${r.overdue || 0}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;

  // ── DAILY STATUS TABLE ─────────────────────────────────────────────────────
  document.getElementById('dash-daily-status').innerHTML = dailyRows.length === 0
    ? `<div class="empty-state"><div class="empty-icon">📊</div><div>No project data</div></div>`
    : `<div class="dash-scroll"><table class="dash-tbl">
        <thead><tr>
          <th>Project</th>
          <th class="txt-right">Sales (T)</th><th class="txt-right">Coll. (T)</th>
          <th class="txt-right">Sales (M)</th><th class="txt-right">Coll. (M)</th>
          <th class="txt-right">Sales (TIID)</th><th class="txt-right">Coll. (TIID)</th>
        </tr></thead>
        <tbody>
          ${dailyRows.map(r => `<tr>
            <td class="td-bold">${Utils.esc(r.project || '—')}</td>
            <td class="txt-right">${DashboardPage.numLink(r.sales_today, 'daily', r.project_id, 'sales', 'today')}</td>
            <td class="txt-right" style="color:var(--teal)">${DashboardPage.numLink(r.coll_today, 'daily', r.project_id, 'collection', 'today', Utils.currency(r.coll_today))}</td>
            <td class="txt-right">${DashboardPage.numLink(r.sales_month, 'daily', r.project_id, 'sales', 'month')}</td>
            <td class="txt-right" style="color:var(--teal)">${DashboardPage.numLink(r.coll_month, 'daily', r.project_id, 'collection', 'month', Utils.currency(r.coll_month))}</td>
            <td class="txt-right">${DashboardPage.numLink(r.sales_total, 'daily', r.project_id, 'sales', 'total')}</td>
            <td class="txt-right" style="color:var(--teal)">${DashboardPage.numLink(r.coll_total, 'daily', r.project_id, 'collection', 'total', Utils.currency(r.coll_total))}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr class="tfoot-total">
          <td><b>Total</b></td>
          <td class="txt-right"><b>${DashboardPage.numLink(dailyRows.reduce((s,r)=>s+parseInt(r.sales_today||0),0), 'daily', 'all', 'sales', 'today')}</b></td>
          <td class="txt-right"><b>${DashboardPage.numLink(dailyRows.reduce((s,r)=>s+parseFloat(r.coll_today||0),0), 'daily', 'all', 'collection', 'today', Utils.currency(dailyRows.reduce((s,r)=>s+parseFloat(r.coll_today||0),0)))}</b></td>
          <td class="txt-right"><b>${DashboardPage.numLink(dailyRows.reduce((s,r)=>s+parseInt(r.sales_month||0),0), 'daily', 'all', 'sales', 'month')}</b></td>
          <td class="txt-right"><b>${DashboardPage.numLink(dailyRows.reduce((s,r)=>s+parseFloat(r.coll_month||0),0), 'daily', 'all', 'collection', 'month', Utils.currency(dailyRows.reduce((s,r)=>s+parseFloat(r.coll_month||0),0)))}</b></td>
          <td class="txt-right"><b>${DashboardPage.numLink(dailyRows.reduce((s,r)=>s+parseInt(r.sales_total||0),0), 'daily', 'all', 'sales', 'total')}</b></td>
          <td class="txt-right"><b>${DashboardPage.numLink(dailyRows.reduce((s,r)=>s+parseFloat(r.coll_total||0),0), 'daily', 'all', 'collection', 'total', Utils.currency(dailyRows.reduce((s,r)=>s+parseFloat(r.coll_total||0),0)))}</b></td>
        </tr></tfoot>
      </table></div>`;

  // ── PARKING DETAIL TABLE ───────────────────────────────────────────────────
  document.getElementById('dash-parking-detail').innerHTML = parkRows.length === 0
    ? `<div class="empty-state"><div class="empty-icon">🅿</div><div>No parking data</div></div>`
    : `<div class="dash-scroll"><table class="dash-tbl">
        <thead><tr>
          <th>Project</th><th>Parking Type</th>
          <th class="txt-right">Total</th><th class="txt-right" style="color:var(--teal)">Allotted</th>
          <th class="txt-right" style="color:var(--green)">Available</th>
        </tr></thead>
        <tbody>
          ${parkRows.map(r => `<tr>
            <td class="td-bold">${Utils.esc(r.project || '—')}</td>
            <td>${Utils.esc(r.parking_type || '—')}</td>
            <td class="txt-right">${r.total || 0}</td>
            <td class="txt-right" style="color:var(--teal)">${r.allotted || 0}</td>
            <td class="txt-right" style="color:var(--green)">${r.available || 0}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;

  // ── FORTHCOMING DUE TABLE ──────────────────────────────────────────────────
  document.getElementById('dash-forthcoming-due').innerHTML = forthRows.length === 0
    ? `<div class="empty-state"><div class="empty-icon">📅</div><div>No upcoming dues</div></div>`
    : `<div class="dash-scroll"><table class="dash-tbl">
        <thead><tr>
          <th>Project Name</th>
          <th class="txt-right" style="color:var(--red)">Today</th>
          <th class="txt-right" style="color:var(--warn)">1-7 Days</th>
          <th class="txt-right">8-14 Days</th>
          <th class="txt-right">15-21 Days</th>
          <th class="txt-right">22-28 Days</th>
        </tr></thead>
        <tbody>
          ${forthRows.map(r => `<tr>
            <td class="td-bold">${Utils.esc(r.project_name || '—')}</td>
            <td class="txt-right" style="color:var(--red)">${r.today_dues || 0}</td>
            <td class="txt-right" style="color:var(--warn)">${r.days_1_7 || 0}</td>
            <td class="txt-right">${r.days_8_14 || 0}</td>
            <td class="txt-right">${r.days_15_21 || 0}</td>
            <td class="txt-right">${r.days_22_28 || 0}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr class="tfoot-total">
          <td><b>Total</b></td>
          <td class="txt-right"><b>${forthRows.reduce((s,r)=>s+parseInt(r.today_dues||0),0)}</b></td>
          <td class="txt-right"><b>${forthRows.reduce((s,r)=>s+parseInt(r.days_1_7||0),0)}</b></td>
          <td class="txt-right"><b>${forthRows.reduce((s,r)=>s+parseInt(r.days_8_14||0),0)}</b></td>
          <td class="txt-right"><b>${forthRows.reduce((s,r)=>s+parseInt(r.days_15_21||0),0)}</b></td>
          <td class="txt-right"><b>${forthRows.reduce((s,r)=>s+parseInt(r.days_22_28||0),0)}</b></td>
        </tr></tfoot>
      </table></div>`;
};

const DashboardPage = {
  // A number on the Demand Status or Daily Status card: a link to the list it counts (a zero has no list, so it stays plain text)
  numLink(n, card, projectId, a, b, text) {
    const shown = text !== undefined ? text : (n || 0);
    if (!(Number(n) > 0) || !projectId) return shown;
    return `<a href="#" class="dash-num" title="Open the list" onclick="DashboardPage.openList('${card}','${Utils.esc(projectId)}','${a}','${b}');return false">${shown}</a>`;
  },

  async openList(card, projectId, a, b) {
    const LABEL = { demand: 'Demand', rem1: 'Reminder 1', rem2: 'Reminder 2', term: 'Termination', sales: 'Sales', collection: 'Collection', today: 'today', month: 'this month', total: 'in all', sent: 'Sent', unsent: 'UnSent' };
    const demand = card === 'demand';
    const title = demand ? `${LABEL[a]} letters, ${LABEL[b]}` : `${LABEL[a]}, ${LABEL[b]}`;
    const url = demand ? `/dashboard/demand-status/list?projectId=${projectId}&bucket=${a}&sent=${b}` : `/dashboard/daily-status/list?projectId=${projectId}&kind=${a}&period=${b}`;
    document.getElementById('dash-list-overlay')?.remove();
    const ov = document.createElement('div');
    ov.id = 'dash-list-overlay'; ov.className = 'overlay open';
    ov.innerHTML = `<div class="modal" style="width:980px"><div class="modal-hdr"><div class="modal-title" id="dash-list-title">${Utils.esc(title)}</div><button class="modal-close" aria-label="Close" onclick="DashboardPage.closeList()">✕</button></div><div class="modal-body" id="dash-list-body"><div class="page-loading"><div class="spinner"></div></div></div></div>`;
    ov.addEventListener('click', (e) => { if (e.target === ov) DashboardPage.closeList(); });
    document.body.appendChild(ov);
    DashboardPage._esc = (e) => { if (e.key === 'Escape') DashboardPage.closeList(); };
    document.addEventListener('keydown', DashboardPage._esc);
    try {
      const res = await Api.get(url);
      const rows = res.data || [];
      const dash = (v) => (v === null || v === undefined || v === '' ? '—' : Utils.esc(v));
      const who = (r) => `<a href="#" onclick="DashboardPage.closeList();Router.navigate('/consumer',{id:'${Utils.esc(r.consumer_id)}'});return false">${dash(r.name)}</a><div style="font-size:10.5px;color:var(--text3)">${dash(r.registration_no)}</div>`;
      const unit = (r) => `${dash(r.tower_name)} / ${dash(r.unit_number)}`;
      let head, line;
      if (demand) {
        head = ['Customer', 'Mobile', 'Project', 'Tower / Unit', 'Instalment', 'Due date', 'Status', 'Amount'];
        line = (r) => [who(r), dash(r.mobile), dash(r.project), unit(r), dash(r.demand_type ? `${r.demand_type} ${r.installment_index}` : `Installment ${r.installment_index}`), r.due_date ? Utils.date(r.due_date) : '—', dash(r.status === 'raised' ? 'demanded' : r.status), Utils.currency(r.amount)];
      } else if (a === 'sales') {
        head = ['Customer', 'Mobile', 'Project', 'Tower / Unit', 'Booking date', 'Booking amount', 'Status'];
        line = (r) => [who(r), dash(r.mobile), dash(r.project), unit(r), Utils.date(r.booking_date), Utils.currency(r.booking_amount), dash(r.status)];
      } else {
        head = ['Receipt', 'Date', 'Customer', 'Project', 'Tower / Unit', 'Mode', 'Amount'];
        line = (r) => [dash(r.receipt_number), Utils.date(r.received_date), who(r), dash(r.project), unit(r), dash(r.payment_method), Utils.currency(r.amount)];
      }
      const money = head[head.length - 1] === 'Amount';
      const summary = `${res.count} ${res.count === 1 ? 'row' : 'rows'}` + (res.amount !== null && res.amount !== undefined ? `, total ${Utils.currency(res.amount)}` : '') + (res.truncated ? ` (showing the first ${rows.length})` : '');
      document.getElementById('dash-list-body').innerHTML = rows.length === 0
        ? '<div class="empty-state"><div>No rows</div></div>'
        : `<div style="font-size:12px;color:var(--text2);margin-bottom:8px">${summary}</div><div class="dash-scroll" style="max-height:60vh"><table class="dash-tbl"><thead><tr>${head.map((h, i) => `<th${money && i === head.length - 1 ? ' class="txt-right"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${line(r).map((c, i, all) => `<td${money && i === all.length - 1 ? ' class="txt-right"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    } catch (err) {
      document.getElementById('dash-list-body').innerHTML = `<div class="empty-state"><div>Could not load the list: ${Utils.esc(err.message)}</div></div>`;
    }
  },

  closeList() {
    document.getElementById('dash-list-overlay')?.remove();
    if (DashboardPage._esc) { document.removeEventListener('keydown', DashboardPage._esc); DashboardPage._esc = null; }
  },

  async approveReceipt(id, btn) {
    btn.disabled = true;
    btn.textContent = '…';
    try {
      await Api.patch(`/payments/receipts/${id}/approve`, {});
      btn.closest('tr').style.opacity = '0.4';
      btn.textContent = 'Approved';
      Utils.success('Receipt approved');
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Approve';
      Utils.error(err.message);
    }
  },

  kpiScroll(dir) {
    const track = document.getElementById('dash-kpis');
    if (!track) return;
    const card = track.querySelector('.kpi');
    const step = card ? card.offsetWidth + 11 : 180;
    track.scrollBy({ left: dir * step, behavior: 'smooth' });
  },

  kpiInitDots() {
    const track = document.getElementById('dash-kpis');
    const dots = document.getElementById('dash-kpi-dots');
    if (!track || !dots) return;
    const cards = track.querySelectorAll('.kpi');
    dots.innerHTML = [...cards].map((_, i) => `<span class="kpi-dot${i === 0 ? ' active' : ''}"></span>`).join('');
    [...dots.children].forEach((dot, i) => {
      dot.onclick = () => cards[i] && cards[i].scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    });
    track.onscroll = () => {
      const idx = [...cards].findIndex(c => Math.abs(c.offsetLeft - track.scrollLeft) < c.offsetWidth / 2);
      [...dots.children].forEach((dot, i) => dot.classList.toggle('active', i === Math.max(idx, 0)));
    };
  },

  toggleCollapse(id) {
    const body = document.getElementById(id);
    if (!body) return;
    body.classList.toggle('collapsed');
    const btn = body.closest('.tbl-wrap').querySelector('.collapse-toggle');
    if (btn) btn.classList.toggle('collapsed', body.classList.contains('collapsed'));
  },
};
