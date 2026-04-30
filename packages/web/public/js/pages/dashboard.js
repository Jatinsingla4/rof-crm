// ROF CRM — Dashboard Page Module

Pages.dashboard = async function() {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="page-hdr">
      <h1>Dashboard</h1>
      <div class="breadcrumb">Home / <b>Dashboard</b></div>
    </div>
    <div id="dash-alert"></div>

    <!-- KPI Cards -->
    <div id="dash-kpis" class="kpi-row">
      ${[...Array(6)].map(() => `<div class="kpi"><div class="page-loading"><div class="spinner"></div></div></div>`).join('')}
    </div>

    <!-- Row 1: Pending Cheques + Demand Status -->
    <div class="g2" style="margin-top:20px">
      <div class="tbl-wrap">
        <div class="tbl-hdr">
          <div class="tbl-title">Pending Cheques</div>
          <div class="tbl-actions"><button class="btn btn-ghost btn-sm" onclick="Router.navigate('/receipts')">View All</button></div>
        </div>
        <div id="dash-pending-cheques"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
      <div class="tbl-wrap">
        <div class="tbl-hdr">
          <div class="tbl-title">Demand Status</div>
          <div class="tbl-actions"><button class="btn btn-ghost btn-sm" onclick="Router.navigate('/demands')">Details</button></div>
        </div>
        <div id="dash-demand-status"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
    </div>

    <!-- Row 2: Pending Approval + Employee Ticket Details -->
    <div class="g2" style="margin-top:14px">
      <div class="tbl-wrap">
        <div class="tbl-hdr"><div class="tbl-title">Pending Approval</div></div>
        <div id="dash-pending-approval"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
      <div class="tbl-wrap">
        <div class="tbl-hdr">
          <div class="tbl-title">Employee Wise Ticket Details</div>
          <div class="tbl-actions"><button class="btn btn-ghost btn-sm" onclick="Router.navigate('/tasks')">View All</button></div>
        </div>
        <div id="dash-employee-tickets"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
    </div>

    <!-- Row 3: Daily Status (full width) -->
    <div class="tbl-wrap" style="margin-top:14px">
      <div class="tbl-hdr">
        <div class="tbl-title">Daily Status</div>
        <div class="tbl-actions"><span style="font-size:11px;color:var(--text3)">T = Today &nbsp;·&nbsp; M = This Month &nbsp;·&nbsp; TIID = Total Till Date</span></div>
      </div>
      <div id="dash-daily-status"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>

    <!-- Row 4: Parking Detail + Forthcoming Due -->
    <div class="g2" style="margin-top:14px">
      <div class="tbl-wrap">
        <div class="tbl-hdr">
          <div class="tbl-title">Parking Detail</div>
          <div class="tbl-actions"><button class="btn btn-ghost btn-sm" onclick="Router.navigate('/parking')">Manage</button></div>
        </div>
        <div id="dash-parking-detail"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
      <div class="tbl-wrap">
        <div class="tbl-hdr">
          <div class="tbl-title">Forthcoming Due</div>
          <div class="tbl-actions"><button class="btn btn-ghost btn-sm" onclick="Router.navigate('/demands')">Schedule</button></div>
        </div>
        <div id="dash-forthcoming-due"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
    </div>
  `;

  // Load all data in parallel — summary + dedicated endpoints
  const [summaryRes, dailyRes, parkingRes, ticketsRes] = await Promise.allSettled([
    Api.get('/dashboard/summary'),
    Api.get('/dashboard/daily-status'),
    Api.get('/dashboard/parking-detail'),
    Api.get('/dashboard/employee-tickets'),
  ]);

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
  const totalApproval   = approvalRows.length;
  const totalToday      = forthRows.reduce((s, r)  => s + parseInt(r.today_dues || 0), 0);
  const total17Days     = forthRows.reduce((s, r)  => s + parseInt(r.days_1_7   || 0), 0);
  const totalTicketsOpen = tickRows.reduce((s, r) => s + parseInt(r.open_tickets || 0), 0);
  const totalCollection = dailyRows.reduce((s, r) => s + parseFloat(r.coll_today || 0), 0);

  document.getElementById('dash-kpis').innerHTML = `
    <div class="kpi c-teal" onclick="Router.navigate('/receipts')">
      <div class="kpi-lbl">Today's Collection</div>
      <div class="kpi-val">${Utils.currency(totalCollection)}</div>
      <div class="kpi-sub">All projects today</div>
    </div>
    <div class="kpi c-warn" onclick="Router.navigate('/receipts')">
      <div class="kpi-lbl">Pending Cheques</div>
      <div class="kpi-val">${totalPending}</div>
      <div class="kpi-sub">${Utils.currency(totalAmount)}</div>
    </div>
    <div class="kpi c-gold">
      <div class="kpi-lbl">PDC / Demand Draft</div>
      <div class="kpi-val">${totalPDC}</div>
      <div class="kpi-sub">Post-dated instruments</div>
    </div>
    <div class="kpi c-blue" onclick="Router.navigate('/receipts')">
      <div class="kpi-lbl">Pending Approval</div>
      <div class="kpi-val">${totalApproval}</div>
      <div class="kpi-sub">Receipts awaiting approval</div>
    </div>
    <div class="kpi c-red" onclick="Router.navigate('/demands')">
      <div class="kpi-lbl">Today's Dues</div>
      <div class="kpi-val">${totalToday}</div>
      <div class="kpi-sub">${total17Days} due in next 7 days</div>
    </div>
    <div class="kpi c-accent" onclick="Router.navigate('/tasks')">
      <div class="kpi-lbl">Open Tickets</div>
      <div class="kpi-val">${totalTicketsOpen}</div>
      <div class="kpi-sub">Across all employees</div>
    </div>
  `;

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
    : `<div style="overflow-x:auto"><table class="dash-tbl">
        <thead><tr>
          <th>S.No.</th><th>Project</th>
          <th class="txt-right">Pending</th><th class="txt-right">Deposite</th><th class="txt-right">Total</th>
          <th class="txt-right">PDC</th><th class="txt-right">Amount</th><th class="txt-right">PDC Amt</th>
        </tr></thead>
        <tbody>
          ${chequeRows.map((r, i) => `<tr>
            <td>${i + 1}</td>
            <td class="td-bold">${r.project || '—'}</td>
            <td class="txt-right" style="color:var(--warn)">${r.pending || 0}</td>
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
    : `<div style="overflow-x:auto"><table class="dash-tbl">
        <thead>
          <tr>
            <th rowspan="2">Project</th>
            <th colspan="2" class="txt-center grp-hdr">Demand</th>
            <th colspan="2" class="txt-center grp-hdr">Reminder 1</th>
            <th colspan="2" class="txt-center grp-hdr">Reminder 2</th>
            <th colspan="2" class="txt-center grp-hdr">Termination</th>
            <th rowspan="2" class="txt-right">Total</th>
            <th rowspan="2" class="txt-right">O/S</th>
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
            <td class="td-bold">${r.project || '—'}</td>
            <td class="txt-right" style="color:var(--warn)">${r.demand_unsend || 0}</td>
            <td class="txt-right" style="color:var(--teal)">${r.demand_send || 0}</td>
            <td class="txt-right" style="color:var(--warn)">${r.rem1_unsend || 0}</td>
            <td class="txt-right" style="color:var(--teal)">${r.rem1_send || 0}</td>
            <td class="txt-right" style="color:var(--warn)">${r.rem2_unsend || 0}</td>
            <td class="txt-right" style="color:var(--teal)">${r.rem2_send || 0}</td>
            <td class="txt-right" style="color:var(--warn)">${r.term_unsend || 0}</td>
            <td class="txt-right" style="color:var(--teal)">${r.term_send || 0}</td>
            <td class="txt-right">${r.total || 0}</td>
            <td class="txt-right" style="color:var(--red)">${Utils.currency(r.outstanding)}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;

  // ── PENDING APPROVAL TABLE ─────────────────────────────────────────────────
  document.getElementById('dash-pending-approval').innerHTML = approvalRows.length === 0
    ? `<div class="empty-state"><div class="empty-icon">✓</div><div>No pending approvals</div></div>`
    : `<div style="overflow-x:auto"><table class="dash-tbl">
        <thead><tr>
          <th>Consumer</th><th>Mobile</th><th>Project</th><th>Unit</th>
          <th class="txt-right">Amount</th><th>Mode</th><th>Date</th><th>Action</th>
        </tr></thead>
        <tbody>
          ${approvalRows.map(r => `<tr>
            <td class="td-bold">${r.consumer_name || '—'}</td>
            <td class="td-mono">${r.mobile || '—'}</td>
            <td>${r.project_name || '—'}</td>
            <td>${r.unit_number || '—'}</td>
            <td class="txt-right" style="color:var(--teal);font-weight:600">${Utils.currency(r.amount_received_inr)}</td>
            <td><span class="chip chip-blue">${r.payment_method || '—'}</span></td>
            <td style="font-size:10.5px">${Utils.date(r.payment_date)}</td>
            <td><button class="btn btn-teal btn-sm" onclick="DashboardPage.approveReceipt('${r.id}', this)">Approve</button></td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;

  // ── EMPLOYEE TICKET DETAILS ────────────────────────────────────────────────
  document.getElementById('dash-employee-tickets').innerHTML = tickRows.length === 0
    ? `<div class="empty-state"><div class="empty-icon">👥</div><div>No active tickets</div></div>`
    : `<div style="overflow-x:auto"><table class="dash-tbl">
        <thead><tr>
          <th>Employee Name</th>
          <th class="txt-right">Total</th><th class="txt-right" style="color:var(--warn)">Open</th>
          <th class="txt-right" style="color:var(--blue)">In Progress</th>
          <th class="txt-right" style="color:var(--teal)">Resolved</th>
          <th class="txt-right" style="color:var(--red)">Overdue</th>
        </tr></thead>
        <tbody>
          ${tickRows.map(r => `<tr>
            <td class="td-bold">${r.employee_name || '—'}</td>
            <td class="txt-right">${r.total_tickets || 0}</td>
            <td class="txt-right" style="color:var(--warn)">${r.open_tickets || 0}</td>
            <td class="txt-right" style="color:var(--blue)">${r.in_progress || 0}</td>
            <td class="txt-right" style="color:var(--teal)">${r.resolved || 0}</td>
            <td class="txt-right" style="color:var(--red)">${r.overdue || 0}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;

  // ── DAILY STATUS TABLE ─────────────────────────────────────────────────────
  document.getElementById('dash-daily-status').innerHTML = dailyRows.length === 0
    ? `<div class="empty-state"><div class="empty-icon">📊</div><div>No project data</div></div>`
    : `<div style="overflow-x:auto"><table class="dash-tbl">
        <thead><tr>
          <th>Project</th>
          <th class="txt-right">Sales (T)</th><th class="txt-right">Coll. (T)</th>
          <th class="txt-right">Sales (M)</th><th class="txt-right">Coll. (M)</th>
          <th class="txt-right">Sales (TIID)</th><th class="txt-right">Coll. (TIID)</th>
        </tr></thead>
        <tbody>
          ${dailyRows.map(r => `<tr>
            <td class="td-bold">${r.project || '—'}</td>
            <td class="txt-right">${r.sales_today || 0}</td>
            <td class="txt-right" style="color:var(--teal)">${Utils.currency(r.coll_today)}</td>
            <td class="txt-right">${r.sales_month || 0}</td>
            <td class="txt-right" style="color:var(--teal)">${Utils.currency(r.coll_month)}</td>
            <td class="txt-right">${r.sales_total || 0}</td>
            <td class="txt-right" style="color:var(--teal)">${Utils.currency(r.coll_total)}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr class="tfoot-total">
          <td><b>Total</b></td>
          <td class="txt-right"><b>${dailyRows.reduce((s,r)=>s+parseInt(r.sales_today||0),0)}</b></td>
          <td class="txt-right"><b>${Utils.currency(dailyRows.reduce((s,r)=>s+parseFloat(r.coll_today||0),0))}</b></td>
          <td class="txt-right"><b>${dailyRows.reduce((s,r)=>s+parseInt(r.sales_month||0),0)}</b></td>
          <td class="txt-right"><b>${Utils.currency(dailyRows.reduce((s,r)=>s+parseFloat(r.coll_month||0),0))}</b></td>
          <td class="txt-right"><b>${dailyRows.reduce((s,r)=>s+parseInt(r.sales_total||0),0)}</b></td>
          <td class="txt-right"><b>${Utils.currency(dailyRows.reduce((s,r)=>s+parseFloat(r.coll_total||0),0))}</b></td>
        </tr></tfoot>
      </table></div>`;

  // ── PARKING DETAIL TABLE ───────────────────────────────────────────────────
  document.getElementById('dash-parking-detail').innerHTML = parkRows.length === 0
    ? `<div class="empty-state"><div class="empty-icon">🅿</div><div>No parking data</div></div>`
    : `<div style="overflow-x:auto"><table class="dash-tbl">
        <thead><tr>
          <th>Project</th><th>Parking Type</th>
          <th class="txt-right">Total</th><th class="txt-right" style="color:var(--teal)">Paid</th>
          <th class="txt-right" style="color:var(--green)">Free</th>
          <th class="txt-right">Total Issued</th><th class="txt-right" style="color:var(--blue)">Remaining</th>
        </tr></thead>
        <tbody>
          ${parkRows.map(r => `<tr>
            <td class="td-bold">${r.project || '—'}</td>
            <td>${r.parking_type || '—'}</td>
            <td class="txt-right">${r.total || 0}</td>
            <td class="txt-right" style="color:var(--teal)">${r.paid || 0}</td>
            <td class="txt-right" style="color:var(--green)">${r.free || 0}</td>
            <td class="txt-right">${r.total_issued || 0}</td>
            <td class="txt-right" style="color:var(--blue)">${r.remaining || 0}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;

  // ── FORTHCOMING DUE TABLE ──────────────────────────────────────────────────
  document.getElementById('dash-forthcoming-due').innerHTML = forthRows.length === 0
    ? `<div class="empty-state"><div class="empty-icon">📅</div><div>No upcoming dues</div></div>`
    : `<div style="overflow-x:auto"><table class="dash-tbl">
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
            <td class="td-bold">${r.project_name || '—'}</td>
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
};
