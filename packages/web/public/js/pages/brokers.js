// ROF CRM — Brokers Management Page

Pages.brokers = async function(params = {}) {
  const tab = params.tab || 'list';
  const content = document.getElementById('content');

  const tabBtn = (key, label, active) =>
    `<button class="tab-line${active?' active':''}" data-group="brk" data-tab="${key}"
       onclick="switchTab('brk','${key}');BrkPage.load('${key}')">${label}</button>`;

  content.innerHTML = `
    <div class="page-hdr">
      <h1>Broker Management</h1>
      <div class="breadcrumb">Broker / <b>Management</b></div>
    </div>
    <div class="tabs-line">
      ${tabBtn('form',             'Application Form',    tab==='form')}
      ${tabBtn('list',             'Broker List',         tab==='list')}
      ${tabBtn('commission',       'Commission Setup',    tab==='commission')}
      ${tabBtn('sold-unit-report', 'Sold-Unit Report',   tab==='sold-unit-report')}
    </div>

    <!-- ── BROKER APPLICATION FORM ─────────────────────────── -->
    <div data-panel-group="brk" data-panel="form" ${tab!=='form'?'style="display:none"':''}>
      <form id="brk-app-form" onsubmit="BrkPage.submitApplication(event)">

        <div class="sp" style="margin-bottom:14px">
          <div class="sp-hdr"><div class="sp-title">1. Broker / Firm Details</div></div>
          <div class="sp-body">
            <div class="sp-grid">
              <div class="fg"><label class="fl"><span class="r">*</span>Firm / Agency Name</label>
                <input class="fc" name="firm_name" placeholder="e.g. Shree Properties" required>
              </div>
              <div class="fg"><label class="fl">Contact Person Name</label>
                <input class="fc" name="contact_person" placeholder="Primary contact">
              </div>
              <div class="fg"><label class="fl"><span class="r">*</span>Mobile</label>
                <input class="fc" name="mobile" placeholder="9XXXXXXXXX" maxlength="10" required>
              </div>
              <div class="fg"><label class="fl">Alternate Mobile</label>
                <input class="fc" name="alt_mobile" placeholder="Alternate No.">
              </div>
              <div class="fg"><label class="fl">Email</label>
                <input type="email" class="fc" name="email" placeholder="broker@email.com">
              </div>
              <div class="fg"><label class="fl">RERA Registration No.</label>
                <input class="fc" name="rera_no" placeholder="RERA-AGENT-XXXX">
              </div>
              <div class="fg"><label class="fl">GST No.</label>
                <input class="fc" name="gst_no" placeholder="GSTIN">
              </div>
              <div class="fg"><label class="fl">PAN No.</label>
                <input class="fc" name="pan_no" placeholder="ABCDE1234F" maxlength="10" style="text-transform:uppercase">
              </div>
            </div>
          </div>
        </div>

        <div class="sp" style="margin-bottom:14px">
          <div class="sp-hdr"><div class="sp-title">2. Address</div></div>
          <div class="sp-body">
            <div class="sp-grid">
              <div class="fg" style="grid-column:span 2">
                <label class="fl">Address</label>
                <textarea class="fc" rows="2" name="address" placeholder="Office address…"></textarea>
              </div>
              <div class="fg"><label class="fl">City</label>
                <input class="fc" name="city" placeholder="City">
              </div>
              <div class="fg"><label class="fl">State</label>
                <select class="fc" name="state">
                  <option value="">— Select —</option>
                  ${['Haryana','Delhi','Uttar Pradesh','Rajasthan','Punjab','Maharashtra','Karnataka','Tamil Nadu'].map(s=>`<option>${s}</option>`).join('')}
                </select>
              </div>
              <div class="fg"><label class="fl">Pin Code</label>
                <input class="fc" name="pin_code" placeholder="110001" maxlength="6">
              </div>
            </div>
          </div>
        </div>

        <div class="sp" style="margin-bottom:14px">
          <div class="sp-hdr"><div class="sp-title">3. Bank Details (for Commission Payment)</div></div>
          <div class="sp-body">
            <div class="sp-grid">
              <div class="fg"><label class="fl">Account Holder Name</label>
                <input class="fc" name="bank_account_name" placeholder="Name as per bank">
              </div>
              <div class="fg"><label class="fl">Account Number</label>
                <input class="fc" name="bank_account_no" placeholder="Account number">
              </div>
              <div class="fg"><label class="fl">IFSC Code</label>
                <input class="fc" name="bank_ifsc" placeholder="HDFC0000XXX">
              </div>
              <div class="fg"><label class="fl">Bank Name</label>
                <select class="fc" id="brk-bank-sel">
                  <option value="">— Select Bank —</option>
                </select>
              </div>
              <div class="fg"><label class="fl">Branch</label>
                <input class="fc" name="bank_branch" placeholder="Branch name">
              </div>
            </div>
          </div>
        </div>

        <div class="sp" style="margin-bottom:14px">
          <div class="sp-hdr"><div class="sp-title">4. Commission Setup</div></div>
          <div class="sp-body">
            <div class="sp-grid">
              <div class="fg"><label class="fl">Commission Rate (%)</label>
                <input type="number" step="0.25" min="0" max="10" class="fc" name="commission_rate" placeholder="e.g. 1.5">
              </div>
              <div class="fg"><label class="fl">Commission Type</label>
                <select class="fc" name="commission_type">
                  <option value="percent">Percentage of Booking Amount</option>
                  <option value="flat">Flat Amount per Unit</option>
                </select>
              </div>
              <div class="fg"><label class="fl">GST on Commission</label>
                <div class="btg">
                  <button type="button" class="btg-item on" onclick="btgSelect(this)">Yes (18%)</button>
                  <button type="button" class="btg-item" onclick="btgSelect(this)">No</button>
                </div>
                <input type="hidden" name="gst_on_commission" value="yes">
              </div>
              <div class="fg"><label class="fl">Payment Terms</label>
                <select class="fc" name="payment_terms">
                  <option value="on_allotment">On Allotment</option>
                  <option value="on_receipt">On First Receipt</option>
                  <option value="on_possession">On Possession</option>
                  <option value="milestone">Milestone Based</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div class="sp" style="margin-bottom:14px">
          <div class="sp-hdr"><div class="sp-title">5. Remarks</div></div>
          <div class="sp-body">
            <textarea class="fc" rows="3" name="remarks" placeholder="Any remarks about this broker…" style="width:100%"></textarea>
          </div>
        </div>

        <div style="display:flex;gap:10px;padding:14px 0">
          <button type="submit" class="btn btn-teal btn-lg">Register Broker</button>
          <button type="reset" class="btn btn-ghost btn-lg">Clear</button>
        </div>
        <div id="brk-form-result"></div>
      </form>
    </div>

    <!-- ── BROKER LIST ────────────────────────────────────────── -->
    <div data-panel-group="brk" data-panel="list" ${tab!=='list'?'style="display:none"':''}>
      <div class="tbl-hdr mb8">
        <div class="tbl-title">Registered Brokers</div>
        <div class="tbl-actions">
          <input class="form-control form-control-sm" id="brk-search" placeholder="Search…" oninput="BrkPage.filterList(this.value)" style="width:180px">
          <button class="btn btn-teal btn-sm" onclick="switchTab('brk','form');BrkPage.load('form')">+ Register Broker</button>
        </div>
      </div>
      <div id="brk-list-body"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>

    <!-- ── COMMISSION SETUP / RECORDS ───────────────────────── -->
    <div data-panel-group="brk" data-panel="commission" ${tab!=='commission'?'style="display:none"':''}>
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-body" style="padding:10px 14px">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <select class="fc" id="brk-comm-broker" style="max-width:250px">
              <option value="">— All Brokers —</option>
            </select>
            <select class="fc" id="brk-comm-status" style="max-width:160px">
              <option value="">— All Status —</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="on_hold">On Hold</option>
            </select>
            <button class="btn btn-fetch btn-sm" onclick="BrkPage.loadCommission()">FETCH</button>
          </div>
        </div>
      </div>
      <div class="kpi-row" id="brk-comm-kpis">
        <div class="kpi"><div class="page-loading"><div class="spinner"></div></div></div>
        <div class="kpi"><div class="page-loading"><div class="spinner"></div></div></div>
        <div class="kpi"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
      <div id="brk-comm-body" style="margin-top:12px"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>

    <!-- ── SOLD-UNIT REPORT ──────────────────────────────────── -->
    <div data-panel-group="brk" data-panel="sold-unit-report" ${tab!=='sold-unit-report'?'style="display:none"':''}>
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-body" style="padding:10px 14px">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <select class="fc" id="brk-rpt-broker" style="max-width:250px">
              <option value="">— All Brokers —</option>
            </select>
            <select class="fc" id="brk-rpt-project" style="max-width:220px">
              <option value="">— All Projects —</option>
            </select>
            <input type="date" class="fc" id="brk-rpt-from" style="max-width:160px">
            <input type="date" class="fc" id="brk-rpt-to" style="max-width:160px">
            <button class="btn btn-fetch btn-sm" onclick="BrkPage.loadSoldUnitReport()">FETCH</button>
            <button class="btn btn-ghost btn-sm">Export Excel</button>
          </div>
        </div>
      </div>
      <div class="kpi-row" id="brk-rpt-kpis" style="margin-bottom:14px">
        <div class="kpi c-blue"><div class="kpi-lbl">Total Broker Sales</div><div class="kpi-val" id="brk-rpt-total">—</div></div>
        <div class="kpi c-teal"><div class="kpi-lbl">Total Commission Due</div><div class="kpi-val" id="brk-rpt-comm">—</div></div>
        <div class="kpi c-warn"><div class="kpi-lbl">Commission Pending</div><div class="kpi-val" id="brk-rpt-pending">—</div></div>
        <div class="kpi c-green"><div class="kpi-lbl">Commission Paid</div><div class="kpi-val" id="brk-rpt-paid">—</div></div>
      </div>
      <div id="brk-rpt-body"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>
  `;

  // Load banks for form and list data
  await BrkPage._initDropdowns();
  await BrkPage.load(tab);
};

// ─────────────────────────────────────────────────────────────────────────────
const BrkPage = {
  _list: [],
  _projects: [],

  async _initDropdowns() {
    // Load banks for form
    try {
      const res = await Api.get('/master/banks');
      const sel = document.getElementById('brk-bank-sel');
      if (sel) sel.innerHTML += (res.data||[]).map(b=>`<option>${b.name}</option>`).join('');
    } catch {}
    // Load projects for sold-unit report
    try {
      const res = await Api.get('/projects');
      this._projects = res.data || [];
      const sel = document.getElementById('brk-rpt-project');
      if (sel) sel.innerHTML += this._projects.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
    } catch {}
  },

  async load(tab) {
    if (tab === 'list')             await this.loadList();
    if (tab === 'commission')       await this.loadCommission();
    if (tab === 'sold-unit-report') await this.loadSoldUnitReport();
  },

  // ── Application Form submit
  async submitApplication(e) {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const body = Object.fromEntries(fd.entries());
    try {
      await Api.post('/brokers', body);
      document.getElementById('brk-form-result').innerHTML =
        `<div class="alert alert-success" style="margin-top:10px">✓ Broker "${body.firm_name}" registered successfully</div>`;
      form.reset();
      await this.loadList();
    } catch (err) {
      document.getElementById('brk-form-result').innerHTML =
        `<div class="alert alert-danger" style="margin-top:10px">Error: ${err.message}</div>`;
    }
  },

  // ── Broker List
  async loadList() {
    const el = document.getElementById('brk-list-body');
    if (!el) return;
    try {
      const res = await Api.get('/brokers', { params: { pageSize: 200 } });
      this._list = res.data || [];

      // Populate broker dropdowns elsewhere
      const brkOpts = `<option value="">— All Brokers —</option>` +
        this._list.map(b=>`<option value="${b.id}">${b.firm_name||b.name||'—'}</option>`).join('');
      ['brk-comm-broker','brk-rpt-broker'].forEach(id => {
        const s = document.getElementById(id);
        if (s) s.innerHTML = brkOpts;
      });

      el.innerHTML = this._list.length === 0
        ? `<div class="empty-state"><div class="empty-icon">🤝</div><div>No brokers registered yet</div></div>`
        : `<table class="dash-tbl">
            <thead><tr>
              <th>Firm / Name</th><th>Contact</th><th>Mobile</th><th>RERA No.</th>
              <th>City</th><th class="txt-right">Commission%</th><th>Status</th><th>Action</th>
            </tr></thead>
            <tbody>
              ${this._list.map(b=>`<tr>
                <td class="td-bold">${b.firm_name||b.name||'—'}</td>
                <td>${b.contact_person||'—'}</td>
                <td class="td-mono">${b.mobile||'—'}</td>
                <td class="td-mono" style="font-size:10.5px">${b.rera_no||b.rera_number||'—'}</td>
                <td>${b.city||'—'}</td>
                <td class="txt-right">${b.commission_rate||b.commission||0}%</td>
                <td>${Utils.chip(b.status||'active')}</td>
                <td>
                  ${b.status==='pending' ? `<button class="btn btn-teal btn-sm" onclick="BrkPage.approve('${b.id}')">Approve</button>
                                          <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="BrkPage.reject('${b.id}')">Reject</button>` : ''}
                  ${b.status==='active' ? `<button class="btn btn-ghost btn-sm" onclick="BrkPage.viewBroker('${b.id}')">View</button>
                                           <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="BrkPage.deactivate('${b.id}',this)">Deact</button>` : ''}
                </td>
              </tr>`).join('')}
            </tbody>
          </table>`;
    } catch (err) { el.innerHTML = `<div class="alert alert-danger">${err.message}</div>`; }
  },

  filterList(q) {
    const filtered = q
      ? this._list.filter(b => (b.firm_name||b.name||'').toLowerCase().includes(q.toLowerCase()) || (b.mobile||'').includes(q))
      : this._list;
    const el = document.getElementById('brk-list-body');
    if (!el) return;
    if (!filtered.length) { el.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><div>No brokers match</div></div>`; return; }
    el.innerHTML = `<table class="dash-tbl"><thead><tr><th>Firm/Name</th><th>Mobile</th><th>City</th><th class="txt-right">Commission%</th><th>Status</th><th>Action</th></tr></thead>
      <tbody>${filtered.map(b=>`<tr>
        <td class="td-bold">${b.firm_name||b.name||'—'}</td>
        <td class="td-mono">${b.mobile||'—'}</td>
        <td>${b.city||'—'}</td>
        <td class="txt-right">${b.commission_rate||0}%</td>
        <td>${Utils.chip(b.status||'active')}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="BrkPage.viewBroker('${b.id}')">View</button></td>
      </tr>`).join('')}</tbody></table>`;
  },

  viewBroker(id) {
    const broker = this._list.find(b => b.id === id);
    if (!broker) return;
    Utils.confirm(
      `<b>${broker.firm_name||broker.name}</b><br>Mobile: ${broker.mobile||'—'}<br>RERA: ${broker.rera_no||'—'}<br>Commission: ${broker.commission_rate||0}%<br><br>View full detail?`,
      () => {}
    );
  },

  async deactivate(id, btn) {
    if (!confirm('Deactivate this broker?')) return;
    try {
      await Api.patch(`/brokers/${id}`, { status: 'inactive' });
      Utils.success('Broker deactivated');
      await this.loadList();
    } catch (err) { Utils.error(err.message); }
  },

  async approve(id) {
    if (!confirm('Approve this broker application?')) return;
    try {
      await Api.patch(`/brokers/${id}/approve`);
      Utils.success('Broker approved');
      await this.loadList();
    } catch (err) { Utils.error(err.message); }
  },

  async reject(id) {
    if (!confirm('Reject this broker application?')) return;
    try {
      await Api.patch(`/brokers/${id}/reject`);
      Utils.success('Broker rejected');
      await this.loadList();
    } catch (err) { Utils.error(err.message); }
  },

  // ── Commission
  async loadCommission() {
    const el = document.getElementById('brk-comm-body');
    if (!el) return;
    const brokerId = document.getElementById('brk-comm-broker')?.value;
    const status   = document.getElementById('brk-comm-status')?.value;
    try {
      const params = { pageSize: 200 };
      if (brokerId) params.brokerId = brokerId;
      if (status)   params.status   = status;
      const res  = await Api.get('/brokers/commission', { params });
      const list = res.data || [];

      const totalPending = list.filter(c=>c.status!=='paid').reduce((s,c)=>s+parseFloat(c.amount||0),0);
      const totalPaid    = list.filter(c=>c.status==='paid') .reduce((s,c)=>s+parseFloat(c.amount||0),0);
      const total        = list.reduce((s,c)=>s+parseFloat(c.amount||0),0);

      const kpis = document.getElementById('brk-comm-kpis');
      if (kpis) kpis.innerHTML = `
        <div class="kpi c-blue"><div class="kpi-lbl">Total Commissions</div><div class="kpi-val">${list.length}</div></div>
        <div class="kpi c-teal"><div class="kpi-lbl">Total Amount</div><div class="kpi-val">${Utils.currency(total)}</div></div>
        <div class="kpi c-warn"><div class="kpi-lbl">Pending Payout</div><div class="kpi-val">${Utils.currency(totalPending)}</div></div>
        <div class="kpi c-green"><div class="kpi-lbl">Total Paid</div><div class="kpi-val">${Utils.currency(totalPaid)}</div></div>
      `;

      el.innerHTML = list.length === 0
        ? `<div class="empty-state"><div class="empty-icon">💰</div><div>No commission records</div></div>`
        : `<table class="dash-tbl">
            <thead><tr>
              <th>Broker</th><th>Consumer</th><th>Unit</th><th>Project</th>
              <th class="txt-right">Rate%</th><th class="txt-right">Amount</th><th>Status</th><th>Action</th>
            </tr></thead>
            <tbody>
              ${list.map(c=>`<tr>
                <td class="td-bold">${c.broker_name||'—'}</td>
                <td>${c.consumer_name||'—'}</td>
                <td>${c.unit_number||'—'}</td>
                <td style="font-size:10.5px">${c.project_name||'—'}</td>
                <td class="txt-right">${c.commission_rate||0}%</td>
                <td class="txt-right" style="font-weight:700">${Utils.currency(c.amount)}</td>
                <td>${Utils.chip(c.status||'pending')}</td>
                <td>${c.status!=='paid'?`<button class="btn btn-teal btn-sm" onclick="BrkPage.markPaid('${c.id}')">Mark Paid</button>`:'—'}</td>
              </tr>`).join('')}
            </tbody>
          </table>`;
    } catch (err) { el.innerHTML = `<div class="alert alert-danger">${err.message}</div>`; }
  },

  async markPaid(id) {
    try {
      await Api.patch(`/brokers/commission/${id}`, { status: 'paid' });
      Utils.success('Commission marked as paid');
      await this.loadCommission();
    } catch (err) { Utils.error(err.message); }
  },

  // ── Sold-Unit Report
  async loadSoldUnitReport() {
    const el = document.getElementById('brk-rpt-body');
    if (!el) return;
    const brokerId  = document.getElementById('brk-rpt-broker')?.value;
    const projectId = document.getElementById('brk-rpt-project')?.value;
    const dateFrom  = document.getElementById('brk-rpt-from')?.value;
    const dateTo    = document.getElementById('brk-rpt-to')?.value;

    try {
      const params = { pageSize: 300 };
      if (brokerId)  params.brokerId  = brokerId;
      if (projectId) params.projectId = projectId;
      if (dateFrom)  params.dateFrom  = dateFrom;
      if (dateTo)    params.dateTo    = dateTo;

      // Fetch broker commissions which represent sold units
      const res  = await Api.get('/brokers/commission', { params });
      const list = res.data || [];

      const totalSales   = list.length;
      const totalCommDue = list.reduce((s,c)=>s+parseFloat(c.amount||0),0);
      const commPending  = list.filter(c=>c.status!=='paid').reduce((s,c)=>s+parseFloat(c.amount||0),0);
      const commPaid     = list.filter(c=>c.status==='paid').reduce((s,c)=>s+parseFloat(c.amount||0),0);

      // Update KPIs
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      set('brk-rpt-total',   totalSales);
      set('brk-rpt-comm',    Utils.currency(totalCommDue));
      set('brk-rpt-pending', Utils.currency(commPending));
      set('brk-rpt-paid',    Utils.currency(commPaid));

      el.innerHTML = list.length === 0
        ? `<div class="empty-state"><div class="empty-icon">📊</div><div>No broker-sold units found for the selected filters</div></div>`
        : `<table class="dash-tbl">
            <thead><tr>
              <th>S.No.</th><th>Broker Firm</th><th>Consumer Name</th>
              <th>Project</th><th>Unit</th>
              <th class="txt-right">Booking Amt</th><th class="txt-right">Commission</th>
              <th>Comm Status</th><th>Booking Date</th>
            </tr></thead>
            <tbody>
              ${list.map((c,i)=>`<tr>
                <td>${i+1}</td>
                <td class="td-bold">${c.broker_name||'—'}</td>
                <td>${c.consumer_name||'—'}</td>
                <td style="font-size:10.5px">${c.project_name||'—'}</td>
                <td>${c.unit_number||'—'}</td>
                <td class="txt-right">${Utils.currency(c.booking_amount)}</td>
                <td class="txt-right" style="font-weight:700;color:var(--teal)">${Utils.currency(c.amount)}</td>
                <td>${Utils.chip(c.status||'pending')}</td>
                <td style="font-size:10.5px">${Utils.date(c.created_at)}</td>
              </tr>`).join('')}
            </tbody>
          </table>`;
    } catch (err) { el.innerHTML = `<div class="alert alert-danger">${err.message}</div>`; }
  },
};
