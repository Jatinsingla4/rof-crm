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

    <style>
      .brkn { max-width:980px; margin-left:auto; margin-right:auto }
      .brkn-wide { max-width:1180px; margin-left:auto; margin-right:auto }
      .brkn-intro { display:flex; align-items:center; gap:12px; padding:14px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border) }
      .brkn-intro-ico { width:36px; height:36px; border-radius:10px; background:var(--teal); color:#fff; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0 }
      .brkn-intro-t { font-size:14px; font-weight:600; color:var(--text) }
      .brkn-intro-s { font-size:12px; color:var(--text2); margin-top:2px }
      .brkn-sec { padding:18px 18px 4px; border-bottom:1px solid var(--border) }
      .brkn-sec:last-of-type { border-bottom:none }
      .brkn-sec-h { display:flex; align-items:center; gap:10px; margin-bottom:14px }
      .brkn-num { width:22px; height:22px; border-radius:50%; background:var(--teal-bg); color:var(--teal); font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0 }
      .brkn-sec-t { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
      .brkn-sec-s { font-size:11px; color:var(--text3); margin-left:2px }
      .brkn-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px 18px; margin-bottom:18px }
      .brkn-grid-3 { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:16px 18px; margin-bottom:18px }
      .brkn-full { grid-column:1/-1 }
      @media (max-width:900px) { .brkn-grid-3 { grid-template-columns:repeat(2,minmax(0,1fr)) } }
      @media (max-width:640px) { .brkn-grid, .brkn-grid-3 { grid-template-columns:minmax(0,1fr) } }
      .brkn .fg { gap:6px }
      .brkn .fl { font-size:11px; letter-spacing:.3px; color:var(--text2) }
      .brkn .fc { padding:9px 12px; font-size:13px; border-radius:8px; min-height:38px }
      .brkn .fc:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg) }
      .brkn-suf { position:relative }
      .brkn-suf .fc { padding-right:40px }
      .brkn-suf > span { position:absolute; right:12px; top:50%; transform:translateY(-50%); font-size:11px; color:var(--text3); pointer-events:none }
      .brkn-foot { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; padding:14px 18px; background:var(--surface2); border-top:1px solid var(--border2) }
      .brkn-note { font-size:11.5px; color:var(--text3) }
      .brkn-note b { color:var(--red) }
      .brkn-foot .btn { padding:8px 20px; font-size:12.5px; border-radius:8px }
      .brkn-bar { display:flex; align-items:flex-end; flex-wrap:wrap; gap:14px; padding:14px 18px; margin-bottom:14px }
      .brkn-bar .fg { flex:1 1 180px; max-width:260px }
      .brkn-bar .btn { padding:9px 20px; font-size:12.5px; border-radius:8px; min-height:38px }
      .brkn-list { background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:hidden }
      .brkn-list-h { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; padding:12px 18px; background:var(--surface2); border-bottom:1px solid var(--border) }
      .brkn-list-t { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
      .brkn-list-a { display:flex; align-items:center; gap:10px; flex-wrap:wrap }
      .brkn-list-a .fc { width:220px; padding:8px 12px; font-size:13px; border-radius:8px }
      .brkn-list-a .btn { padding:8px 16px; font-size:12.5px; border-radius:8px }
      .brkn-list-b { overflow-x:auto }
      .brkn-tbl { width:100%; border-collapse:collapse; font-size:12.5px }
      .brkn-tbl th { text-align:left; padding:10px 14px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; color:var(--text3); background:var(--surface2); border-bottom:1px solid var(--border2); white-space:nowrap }
      .brkn-tbl td { padding:10px 14px; border-bottom:1px solid var(--border); color:var(--text); vertical-align:middle }
      .brkn-tbl th.txt-right, .brkn-tbl td.txt-right { text-align:right }
      .brkn-tbl tbody tr:hover td { background:var(--surface2) }
      .brkn-tbl tbody tr:last-child td { border-bottom:none }
      .brkn-tbl .td-bold { font-weight:600 }
      .brkn-tbl .btn { padding:4px 11px; border-radius:6px }
      .brkn-del { color:var(--red) !important }
      .brkn-acts { display:flex; gap:6px; flex-wrap:wrap }
      .brkn-kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:14px; margin-bottom:14px }
      .brkn-kpi { background:var(--surface); border:1px solid var(--border2); border-left:3px solid var(--teal); border-radius:10px; padding:12px 16px }
      .brkn-kpi.c-blue { border-left-color:var(--blue, var(--teal)) }
      .brkn-kpi.c-warn { border-left-color:var(--amber, #d97706) }
      .brkn-kpi.c-green { border-left-color:var(--green, #16a34a) }
      .brkn-kpi-l { font-size:10.5px; color:var(--text3); text-transform:uppercase; letter-spacing:.5px }
      .brkn-kpi-v { font-size:20px; font-weight:700; color:var(--text); margin-top:4px }
      .brkn-empty { padding:40px 18px; text-align:center; color:var(--text3); font-size:13px }
      .brkn-empty-i { font-size:28px; margin-bottom:6px }
      .brkn-load { padding:30px; text-align:center }
    </style>

    <!-- ── BROKER APPLICATION FORM ─────────────────────────── -->
    <div data-panel-group="brk" data-panel="form" ${tab!=='form'?'style="display:none"':''}>
      <div class="sp brkn">
        <div class="brkn-intro">
          <div class="brkn-intro-ico">🤝</div>
          <div>
            <div class="brkn-intro-t">Broker Application Form</div>
            <div class="brkn-intro-s">Register a broker or agency with contact, bank and commission details.</div>
          </div>
        </div>
        <form id="brk-app-form" onsubmit="BrkPage.submitApplication(event)">

          <div class="brkn-sec">
            <div class="brkn-sec-h"><span class="brkn-num">1</span><span class="brkn-sec-t">Broker / Firm Details</span><span class="brkn-sec-s">Identity and registration</span></div>
            <div class="brkn-grid">
              <div class="fg"><label class="fl"><span class="r">*</span> Firm / Agency Name</label>
                <input class="fc" name="firm_name" placeholder="e.g. Shree Properties" required>
              </div>
              <div class="fg"><label class="fl">Contact Person Name</label>
                <input class="fc" name="contact_person" placeholder="Primary contact">
              </div>
              <div class="fg"><label class="fl"><span class="r">*</span> Mobile</label>
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

          <div class="brkn-sec">
            <div class="brkn-sec-h"><span class="brkn-num">2</span><span class="brkn-sec-t">Address</span><span class="brkn-sec-s">Office location</span></div>
            <div class="brkn-grid">
              <div class="fg brkn-full">
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

          <div class="brkn-sec">
            <div class="brkn-sec-h"><span class="brkn-num">3</span><span class="brkn-sec-t">Bank Details</span><span class="brkn-sec-s">For commission payment</span></div>
            <div class="brkn-grid">
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

          <div class="brkn-sec">
            <div class="brkn-sec-h"><span class="brkn-num">4</span><span class="brkn-sec-t">Commission Setup</span><span class="brkn-sec-s">Rate and payment terms</span></div>
            <div class="brkn-grid">
              <div class="fg"><label class="fl">Commission Rate (%)</label>
                <div class="brkn-suf"><input type="number" step="0.25" min="0" max="10" class="fc" name="commission_rate" placeholder="e.g. 1.5"><span>%</span></div>
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

          <div class="brkn-sec">
            <div class="brkn-sec-h"><span class="brkn-num">5</span><span class="brkn-sec-t">Remarks</span><span class="brkn-sec-s">Optional</span></div>
            <div class="brkn-grid">
              <div class="fg brkn-full">
                <textarea class="fc" rows="3" name="remarks" placeholder="Any remarks about this broker…"></textarea>
              </div>
            </div>
          </div>

          <div class="brkn-foot">
            <span class="brkn-note"><b>*</b> Required fields</span>
            <div style="display:flex;gap:10px">
              <button type="reset" class="btn btn-ghost">Clear</button>
              <button type="submit" class="btn btn-teal">Register Broker</button>
            </div>
          </div>
        </form>
      </div>
      <div id="brk-form-result" class="brkn" style="margin-top:12px"></div>
    </div>

    <!-- ── BROKER LIST ────────────────────────────────────────── -->
    <div data-panel-group="brk" data-panel="list" ${tab!=='list'?'style="display:none"':''}>
      <div class="brkn-wide">
        <div class="brkn-list">
          <div class="brkn-list-h">
            <div class="brkn-list-t">Registered Brokers</div>
            <div class="brkn-list-a">
              <input class="fc" id="brk-search" placeholder="Search by name or mobile…" oninput="BrkPage.filterList(this.value)">
              <button class="btn btn-teal" onclick="switchTab('brk','form');BrkPage.load('form')">+ Register Broker</button>
            </div>
          </div>
          <div class="brkn-list-b" id="brk-list-body"><div class="brkn-load"><div class="spinner"></div></div></div>
        </div>
      </div>
    </div>

    <!-- ── COMMISSION SETUP / RECORDS ───────────────────────── -->
    <div data-panel-group="brk" data-panel="commission" ${tab!=='commission'?'style="display:none"':''}>
      <div class="brkn-wide">
        <div class="sp brkn-bar">
          <div class="fg"><label class="fl">Broker</label>
            <select class="fc" id="brk-comm-broker">
              <option value="">— All Brokers —</option>
            </select>
          </div>
          <div class="fg"><label class="fl">Status</label>
            <select class="fc" id="brk-comm-status">
              <option value="">— All Status —</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="on_hold">On Hold</option>
            </select>
          </div>
          <button class="btn btn-teal" onclick="BrkPage.loadCommission()">FETCH</button>
        </div>
        <div class="brkn-kpis" id="brk-comm-kpis">
          <div class="brkn-kpi"><div class="brkn-load"><div class="spinner"></div></div></div>
        </div>
        <div class="brkn-list">
          <div class="brkn-list-h"><div class="brkn-list-t">Commission Records</div></div>
          <div class="brkn-list-b" id="brk-comm-body"><div class="brkn-load"><div class="spinner"></div></div></div>
        </div>
      </div>
    </div>

    <!-- ── SOLD-UNIT REPORT ──────────────────────────────────── -->
    <div data-panel-group="brk" data-panel="sold-unit-report" ${tab!=='sold-unit-report'?'style="display:none"':''}>
      <div class="brkn-wide">
        <div class="sp brkn-bar">
          <div class="fg"><label class="fl">Broker</label>
            <select class="fc" id="brk-rpt-broker">
              <option value="">— All Brokers —</option>
            </select>
          </div>
          <div class="fg"><label class="fl">Project</label>
            <select class="fc" id="brk-rpt-project">
              <option value="">— All Projects —</option>
            </select>
          </div>
          <div class="fg"><label class="fl">From</label>
            <input type="date" class="fc" id="brk-rpt-from">
          </div>
          <div class="fg"><label class="fl">To</label>
            <input type="date" class="fc" id="brk-rpt-to">
          </div>
          <button class="btn btn-teal" onclick="BrkPage.loadSoldUnitReport()">FETCH</button>
          <button class="btn btn-ghost">Export Excel</button>
        </div>
        <div class="brkn-kpis" id="brk-rpt-kpis">
          <div class="brkn-kpi c-blue"><div class="brkn-kpi-l">Total Broker Sales</div><div class="brkn-kpi-v" id="brk-rpt-total">—</div></div>
          <div class="brkn-kpi"><div class="brkn-kpi-l">Total Commission Due</div><div class="brkn-kpi-v" id="brk-rpt-comm">—</div></div>
          <div class="brkn-kpi c-warn"><div class="brkn-kpi-l">Commission Pending</div><div class="brkn-kpi-v" id="brk-rpt-pending">—</div></div>
          <div class="brkn-kpi c-green"><div class="brkn-kpi-l">Commission Paid</div><div class="brkn-kpi-v" id="brk-rpt-paid">—</div></div>
        </div>
        <div class="brkn-list">
          <div class="brkn-list-h"><div class="brkn-list-t">Broker Sold Units</div></div>
          <div class="brkn-list-b" id="brk-rpt-body"><div class="brkn-load"><div class="spinner"></div></div></div>
        </div>
      </div>
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
        ? `<div class="brkn-empty"><div class="brkn-empty-i">🤝</div><div>No brokers registered yet</div></div>`
        : `<table class="brkn-tbl">
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
                <td><div class="brkn-acts">
                  ${b.status==='pending' ? `<button class="btn btn-teal btn-sm" data-action="approve-broker" onclick="BrkPage.approve('${b.id}')">Approve</button>
                                          <button class="btn btn-ghost btn-sm brkn-del" data-action="approve-broker" onclick="BrkPage.reject('${b.id}')">Reject</button>` : ''}
                  ${b.status==='active' ? `<button class="btn btn-ghost btn-sm" onclick="BrkPage.viewBroker('${b.id}')">View</button>
                                           <button class="btn btn-ghost btn-sm brkn-del" onclick="BrkPage.deactivate('${b.id}',this)">Deact</button>` : ''}
                </div></td>
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
    if (!filtered.length) { el.innerHTML = `<div class="brkn-empty"><div class="brkn-empty-i">🔍</div><div>No brokers match</div></div>`; return; }
    el.innerHTML = `<table class="brkn-tbl"><thead><tr><th>Firm/Name</th><th>Mobile</th><th>City</th><th class="txt-right">Commission%</th><th>Status</th><th>Action</th></tr></thead>
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
        <div class="brkn-kpi c-blue"><div class="brkn-kpi-l">Total Commissions</div><div class="brkn-kpi-v">${list.length}</div></div>
        <div class="brkn-kpi"><div class="brkn-kpi-l">Total Amount</div><div class="brkn-kpi-v">${Utils.currency(total)}</div></div>
        <div class="brkn-kpi c-warn"><div class="brkn-kpi-l">Pending Payout</div><div class="brkn-kpi-v">${Utils.currency(totalPending)}</div></div>
        <div class="brkn-kpi c-green"><div class="brkn-kpi-l">Total Paid</div><div class="brkn-kpi-v">${Utils.currency(totalPaid)}</div></div>
      `;

      el.innerHTML = list.length === 0
        ? `<div class="brkn-empty"><div class="brkn-empty-i">💰</div><div>No commission records</div></div>`
        : `<table class="brkn-tbl">
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
        ? `<div class="brkn-empty"><div class="brkn-empty-i">📊</div><div>No broker-sold units found for the selected filters</div></div>`
        : `<table class="brkn-tbl">
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
