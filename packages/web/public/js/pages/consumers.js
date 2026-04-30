// ROF CRM — Consumer Register Page Module

Pages.consumers = async function(params = {}) {
  const content = document.getElementById('content');

  // Load projects for filter dropdown
  let projects = [];
  try {
    const r = await Api.get('/units', { params: { page: 1, pageSize: 100 } });
    const projectNames = [...new Set((r.data || r || []).map(u => u.project_name || u.projectName).filter(Boolean))];
    projects = projectNames;
  } catch {}

  content.innerHTML = `
    <div class="page-hdr">
      <h1>Customer Register</h1>
      <div class="breadcrumb">Application / Booking / <b>Customer Register</b></div>
    </div>
    <div class="sp">
      <div class="sp-hdr"><div class="sp-title">Search Customers</div></div>
      <div class="sp-body">
        <div class="sp-grid">
          <div class="fg">
            <label class="fl"><span class="r">*</span>Project</label>
            <select class="fc" id="f-proj">
              <option value="">— Select —</option>
              ${projects.map(p => `<option${params.project===p?' selected':''}>${p}</option>`).join('')}
            </select>
          </div>
          <div class="fg">
            <label class="fl">Unit Type</label>
            <select class="fc" id="f-bhk">
              <option value="">— All —</option>
              <option>Studio</option><option>1BHK</option><option>2BHK</option><option>3BHK</option>
            </select>
          </div>
          <div class="fg">
            <label class="fl">Status</label>
            <select class="fc" id="f-status">
              <option value="">— All —</option>
              <option>Booked</option><option>Allotted</option><option>Agreement Signed</option>
              <option>Possession</option><option>Overdue</option><option>Draw Pending</option><option>Cancelled</option>
            </select>
          </div>
          <div class="fg">
            <label class="fl">Category</label>
            <select class="fc" id="f-category">
              <option value="">— All —</option>
              <option>EWS</option><option>LIG</option><option>MIG</option>
            </select>
          </div>
          <div class="fg">
            <label class="fl">Lead Stage</label>
            <select class="fc" id="f-stage">
              <option value="">— All —</option>
              ${ROF.LEAD_STAGES.map(s => `<option value="${s}">${s.replace(/_/g,' ')}</option>`).join('')}
            </select>
          </div>
          <div class="fg">
            <label class="fl">First Name</label>
            <input class="fc" id="f-name" placeholder="First Name" value="${params.search || ''}">
          </div>
          <div class="fg">
            <label class="fl">Mobile</label>
            <input class="fc" id="f-mobile" placeholder="Mobile No.">
          </div>
          <div class="fg">
            <label class="fl">Booking Date</label>
            <div class="date-range">
              <input type="date" class="fc" id="f-date-from">
              <span class="sep">—</span>
              <input type="date" class="fc" id="f-date-to">
            </div>
          </div>
        </div>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-fetch" onclick="ConsumersPage.fetch()">FETCH</button>
          <button class="btn btn-accent" onclick="Router.navigate('/booking')">+ New Booking</button>
          <button class="btn btn-ghost" onclick="ConsumersPage.exportExcel()">Export Excel</button>
          <button class="btn btn-ghost" onclick="window.print()">Print</button>
        </div>
      </div>
    </div>
    <div class="tbl-wrap" id="cons-tbl" style="display:none">
      <div class="tbl-hdr">
        <div class="tbl-title">Customer Register <span id="cons-count" style="font-weight:400;font-size:10px;color:var(--text3)"></span></div>
        <div class="tbl-actions">
          <button class="btn btn-ghost btn-sm" onclick="ConsumersPage.exportExcel()">Export</button>
          <button class="btn btn-ghost btn-sm" onclick="window.print()">Print</button>
        </div>
      </div>
      <div id="cons-table-body"></div>
    </div>
  `;

  // Auto-fetch if params provided
  if (params.search || params.status || params.leadStage) {
    ConsumersPage.fetch();
  }
};

const ConsumersPage = {
  async fetch() {
    const filters = {
      search: document.getElementById('f-name')?.value || undefined,
      leadStage: document.getElementById('f-stage')?.value || undefined,
      status: document.getElementById('f-status')?.value || undefined,
      page: 1,
      pageSize: 100,
    };

    Utils.showTable('cons-tbl');
    document.getElementById('cons-table-body').innerHTML = `<div class="page-loading"><div class="spinner"></div> Loading…</div>`;

    try {
      const res = await Api.get('/consumers', { params: filters });
      const list = res.data || res || [];
      document.getElementById('cons-count').textContent = `(${list.length} records)`;
      this.renderTable(list);
    } catch (err) {
      document.getElementById('cons-table-body').innerHTML = `<div style="padding:20px;text-align:center;color:var(--red)">${err.message}</div>`;
      Utils.error(err.message);
    }
  },

  renderTable(list) {
    if (list.length === 0) {
      document.getElementById('cons-table-body').innerHTML = `<div class="empty-state"><h3>No customers found</h3><p>Try adjusting your search filters</p></div>`;
      return;
    }

    const rows = list.map((c, i) => {
      const payPct = c.payment_pct || c.paymentPct || 0;
      const pctNum = parseFloat(payPct) || 0;
      const pctCls = pctNum >= 100 ? 'pf-green' : pctNum < 30 ? 'pf-warn' : 'pf-teal';
      const totalPaid = c.total_paid || c.totalPaid || 0;

      return `
        <tr onclick="Router.navigate('/consumer',{id:'${c.id}'})">
          <td>${i+1}</td>
          <td class="td-mono">${c.id || '—'}</td>
          <td><div class="td-bold">${c.first_name || ''} ${c.last_name || ''}</div></td>
          <td style="font-size:10.5px">${c.mobile1 || c.mobile || '—'}</td>
          <td>
            <div class="td-bold">${c.project_name || c.projectName || '—'}</div>
            <div class="td-sub">${c.bhk_type || c.bhkType || c.bhk || '1BHK'}${c.unit_no || c.unitNo ? ' · ' + (c.unit_no || c.unitNo) : ''}</div>
          </td>
          <td>${c.bhk_type || c.bhkType || c.bhk || '—'}</td>
          <td>${Utils.chip(c.income_category || c.incomeCategory || c.category || 'EWS')}</td>
          <td style="font-size:10.5px">${Utils.date(c.booking_date || c.bookingDate || c.created_at)}</td>
          <td style="min-width:90px">
            <div style="font-size:10.5px;font-weight:600">${pctNum.toFixed(0)}%</div>
            <div class="progress"><div class="progress-fill ${pctCls}" style="width:${Math.min(pctNum,100)}%"></div></div>
            <div style="font-size:9px;color:var(--text3)">${Utils.currency(totalPaid)}</div>
          </td>
          <td>${Utils.chip(c.lead_stage || c.leadStage || c.status || 'enquiry')}</td>
          <td onclick="event.stopPropagation()">
            <div style="display:flex;gap:3px">
              <button class="btn btn-ghost btn-sm" onclick="Router.navigate('/consumer',{id:'${c.id}'})">View</button>
              <button class="btn btn-ghost btn-sm" onclick="Router.navigate('/receipts',{consumerId:'${c.id}'})">Rcpt</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    document.getElementById('cons-table-body').innerHTML = `
      <table>
        <thead>
          <tr>
            <th>S.No.</th><th>ID</th><th>Applicant</th><th>Mobile</th>
            <th>Project / Unit</th><th>Type</th><th>Category</th>
            <th>Booking Date</th><th>Payment</th><th>Stage</th><th>Action</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  },

  exportExcel() {
    Utils.info('Excel export coming soon');
  },
};
