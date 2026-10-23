// ROF CRM — Allotment of Unit Page

Pages.allotment = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="page-hdr">
      <h1>Allotment of Unit</h1>
      <div class="breadcrumb">Application / <b>Allotment</b></div>
    </div>
    <div class="tabs-line">
      <button class="tab-line active" data-group="allot" data-tab="allot" onclick="switchTab('allot','allot')">Allotment Form</button>
      <button class="tab-line" data-group="allot" data-tab="letter" onclick="switchTab('allot','letter');AllotmentPage.loadAllotmentList('letter-search-body')">Allotment Letter</button>
      <button class="tab-line" data-group="allot" data-tab="search" onclick="switchTab('allot','search');AllotmentPage.loadAllotmentList('allot-search-body')">Search Allotment</button>
      <button class="tab-line" data-group="allot" data-tab="shifting" data-action="unit-shifting-tab" onclick="switchTab('allot','shifting');AllotmentPage.loadShiftingList()">Unit Shifting</button>
      <button class="tab-line" data-group="allot" data-tab="cancel" onclick="switchTab('allot','cancel');AllotmentPage.loadCancellations()">Cancel Allotment</button>
      <button class="tab-line" data-group="allot" data-tab="waitlist" onclick="switchTab('allot','waitlist');AllotmentPage.loadWaitlist()">Waitlist</button>
      <button class="tab-line" data-group="allot" data-tab="edraw" onclick="switchTab('allot','edraw')">E-Draw Import</button>
    </div>

    <style>
      [data-panel-group="allot"] { max-width:1180px; margin-left:auto; margin-right:auto }
      [data-panel-group="allot"] .sp, [data-panel-group="allot"] .tbl-wrap { border-radius:10px; overflow:hidden; margin-bottom:16px !important }
      [data-panel-group="allot"] .sp-hdr, [data-panel-group="allot"] .tbl-hdr { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; padding:14px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border) }
      [data-panel-group="allot"] .sp-title, [data-panel-group="allot"] .tbl-title { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
      [data-panel-group="allot"] .sp-body { padding:18px }
      [data-panel-group="allot"] .sp-grid { gap:16px 18px }
      @media (max-width:900px) { [data-panel-group="allot"] .sp-grid { grid-template-columns:repeat(2,minmax(0,1fr)) !important } [data-panel-group="allot"] .fg { grid-column:auto !important } }
      @media (max-width:640px) { [data-panel-group="allot"] .sp-grid { grid-template-columns:minmax(0,1fr) !important } }
      [data-panel-group="allot"] .fg { gap:6px }
      [data-panel-group="allot"] .fl { font-size:11px; font-weight:500; text-transform:none; letter-spacing:.3px; color:var(--text2) }
      [data-panel-group="allot"] .fc { padding:9px 12px; font-size:13px; border-radius:8px; min-height:38px }
      [data-panel-group="allot"] .fc:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg) }
      [data-panel-group="allot"] .btn-lg, [data-panel-group="allot"] .btn-fetch { padding:9px 24px; font-size:12.5px; border-radius:8px; min-height:38px; font-weight:600 }
      [data-panel-group="allot"] .btn-fetch, [data-panel-group="allot"] .btn-fetch:hover { background:var(--teal) !important; color:#fff !important; border:none }
      [data-panel-group="allot"] .alert { border-radius:8px; margin-bottom:16px !important }
      [data-panel-group="allot"] #letter-search-body, [data-panel-group="allot"] #allot-search-body, [data-panel-group="allot"] #cancel-list-body,
      [data-panel-group="allot"] #shifting-report-body, [data-panel-group="allot"] #allot-list-body, [data-panel-group="allot"] #waitlist-body { overflow-x:auto }
      [data-panel-group="allot"] #letter-search-body, [data-panel-group="allot"] #allot-search-body, [data-panel-group="allot"] #cancel-list-body, [data-panel-group="allot"] #shifting-report-body { background:var(--surface); border:1px solid var(--border2); border-radius:10px }
      [data-panel-group="allot"] #letter-search-body:empty { display:none }
      [data-panel-group="allot"] table { width:100%; border-collapse:collapse; font-size:12.5px }
      [data-panel-group="allot"] table th { text-align:left; padding:10px 14px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; color:var(--text3); background:var(--surface2); border-bottom:1px solid var(--border2); white-space:nowrap }
      [data-panel-group="allot"] table td { padding:10px 14px; border-bottom:1px solid var(--border); color:var(--text); vertical-align:middle }
      [data-panel-group="allot"] table tbody tr:hover td { background:var(--surface2) }
      [data-panel-group="allot"] table tbody tr:last-child td { border-bottom:none }
      [data-panel-group="allot"] table .td-bold { font-weight:600 }
      [data-panel-group="allot"] .aln-sub { font-size:11px; font-weight:600; color:var(--teal); text-transform:uppercase; letter-spacing:.5px; margin:2px 0 12px }
      [data-panel-group="allot"] .aln-bar { display:flex; align-items:flex-end; flex-wrap:wrap; gap:16px 18px }
      [data-panel-group="allot"] .aln-bar .fg { flex:1 1 170px; min-width:150px }
      [data-panel-group="allot"] .aln-dates { display:flex; align-items:center; gap:8px }
      [data-panel-group="allot"] .aln-dates .fc { flex:1; min-width:130px }
      [data-panel-group="allot"] .aln-proj { display:flex; align-items:center; padding:10px 18px; background:var(--surface2); border-bottom:1px solid var(--border2); font-size:12px; font-weight:600; color:var(--text) }
      [data-panel-group="allot"] .aln-link { color:var(--teal); text-decoration:none; font-weight:500 }
      [data-panel-group="allot"] .aln-link:hover { text-decoration:underline }
      [data-panel-group="allot"] .aln-empty { padding:36px 18px; text-align:center; color:var(--text3); font-size:13px }
    </style>

    <!-- ALLOTMENT TAB -->
    <div data-panel-group="allot" data-panel="allot">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Allot Unit to Consumer</div></div>
        <div class="sp-body">
          <div class="sp-grid">
            <div class="fg"><label class="fl"><span class="r">*</span>Consumer</label>
              <select class="fc" id="allot-consumer-sel" onchange="AllotmentPage.onConsumerChange()">
                <option value="">— Select Consumer —</option>
              </select>
            </div>
            <div class="fg"><label class="fl"><span class="r">*</span>Project</label>
              <select class="fc" id="allot-project-sel" onchange="AllotmentPage.onProjectChange()">
                <option value="">— Select Project —</option>
              </select>
            </div>
            <div class="fg"><label class="fl"><span class="r">*</span>Unit</label>
              <select class="fc" id="allot-unit-sel">
                <option value="">— Select Unit —</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Allotment Date</label>
              <input type="date" class="fc" id="allot-date" value="${Utils.today()}">
            </div>
            <div class="fg" style="grid-column:span 4">
              <label class="fl">Remarks</label>
              <textarea class="fc" id="allot-remarks" placeholder="Add administrative notes or backdating reasons..." style="height:60px"></textarea>
            </div>
          </div>
          <div style="margin-top:10px;display:flex;gap:8px">
            <button class="btn btn-teal btn-lg" onclick="AllotmentPage.allot()">CREATE ALLOTMENT/AGREEMENT</button>
            <button class="btn btn-ghost" onclick="AllotmentPage.generateLetters()">Bulk Generate Letters</button>
          </div>
        </div>
      </div>
      <div class="tbl-wrap">
        <div class="tbl-hdr">
          <div class="tbl-title">Pending Allotments (Applied Consumers)</div>
        </div>
        <div id="allot-list-body"><div class="page-loading"><div class="spinner"></div> Loading…</div></div>
      </div>
    </div>

    <!-- ALLOTMENT LETTER TAB (Legacy Transaction Replica) -->
    <div data-panel-group="allot" data-panel="letter" style="display:none">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Search Unit for Allotment Letter</div></div>
        <div class="sp-body">
          <div class="sp-grid">
            <div class="fg"><label class="fl">Project</label><select class="fc" id="letter-proj-sel"><option value="">— All —</option></select></div>
            <div class="fg"><label class="fl">Unit Address</label><input class="fc" id="letter-unit-search" placeholder="e.g. B-706"></div>
            <div class="fg"><label class="fl">Registration No</label><input class="fc" id="letter-reg-search" placeholder="Search…"></div>
          </div>
          <button class="btn btn-fetch" style="margin-top:10px" onclick="AllotmentPage.loadAllotmentList('letter-search-body')">FETCH</button>
        </div>
      </div>
      <div id="letter-search-body"></div>
    </div>

    <!-- SEARCH ALLOTMENT TAB -->
    <div data-panel-group="allot" data-panel="search" style="display:none">
      <div class="sp">
        <div class="sp-hdr"><div class="sp-title">Search Allotment</div></div>
        <div class="sp-body">
          <div class="aln-bar">
            <div class="fg"><label class="fl"><span class="r">*</span>Project</label>
              <select class="fc" id="search-project">
                <option value="">--Select--</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Registration No.</label>
              <input class="fc" id="searchRegNo" placeholder="Registration No.">
            </div>
            <div class="fg"><label class="fl">First Name</label>
              <input class="fc" id="searchFirstName" placeholder="First Name">
            </div>
            <div class="fg"><label class="fl">Unit Address</label>
              <input class="fc" id="searchUnitAddress" placeholder="Unit Address">
            </div>
            <div class="fg" style="flex:1.6 1 300px"><label class="fl">Allotment Date</label>
              <div class="aln-dates">
                <input type="date" class="fc" id="searchDateFrom" placeholder="From Date">
                <span style="color:var(--text3)">–</span>
                <input type="date" class="fc" id="searchDateTo" placeholder="To Date">
              </div>
            </div>
            <button class="btn btn-fetch" onclick="AllotmentPage.loadAllotmentList('allot-search-body')">FETCH</button>
          </div>
        </div>
      </div>
      <div id="allot-search-body"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>

    <!-- UNIT SHIFTING TAB -->
    <div data-panel-group="allot" data-panel="shifting" style="display:none">
      <div class="alert alert-info" style="margin-bottom:12px">
        Unit shifting transfers a consumer from their currently allotted unit to a new available unit. Both unit statuses are updated atomically.
      </div>
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Unit Shifting Process</div></div>
        <div class="sp-body">
          <div class="sp-grid">
            <div class="fg"><label class="fl"><span class="r">*</span>Consumer (Allotted)</label>
              <select class="fc" id="shift-consumer" onchange="AllotmentPage.onShiftConsumerChange()">
                <option value="">— Select Allotted Consumer —</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Current Unit</label>
              <input class="fc" id="shift-current-unit" readonly placeholder="Auto-filled on consumer select">
            </div>
            <div class="fg"><label class="fl"><span class="r">*</span>New Unit</label>
              <select class="fc" id="shift-new-unit">
                <option value="">— Select New Unit —</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Shifting Date</label>
              <input type="date" class="fc" id="shift-date" value="${Utils.today()}">
            </div>
            <div class="fg" style="grid-column:span 2"><label class="fl">Reason for Shifting</label>
              <input class="fc" id="shift-reason" placeholder="Reason for unit shift">
            </div>
          </div>
          <div style="margin-top:12px;display:flex;gap:8px">
            <button class="btn btn-teal btn-lg" onclick="AllotmentPage.shiftUnit()">Confirm Shift</button>
            <button class="btn btn-ghost" onclick="AllotmentPage.clearShiftForm()">Clear</button>
          </div>
          <div id="shift-result" style="margin-top:12px"></div>
        </div>
      </div>
      <div id="shifting-list-body"></div>
    </div>

    <!-- SHIFTING REPORT TAB -->
    <div data-panel-group="allot" data-panel="shifting-report" style="display:none">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Customer Unit Shifting Report</div></div>
        <div class="sp-body">
          <div class="sp-grid">
            <div class="fg"><label class="fl">From Date</label>
              <input type="date" class="fc" id="sr-from" value="${Utils.monthStart()}">
            </div>
            <div class="fg"><label class="fl">To Date</label>
              <input type="date" class="fc" id="sr-to" value="${Utils.today()}">
            </div>
            <div class="fg"><label class="fl">Project</label>
              <select class="fc" id="sr-project">
                <option value="">— All Projects —</option>
              </select>
            </div>
          </div>
          <button class="btn btn-fetch" style="margin-top:10px" onclick="AllotmentPage.loadShiftingReport()">FETCH</button>
        </div>
      </div>
      <div id="shifting-report-body"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>

    <!-- CANCEL ALLOTMENT TAB -->
    <div data-panel-group="allot" data-panel="cancel" style="display:none">
      <div class="alert alert-warn" style="margin-bottom:12px">
        ⚠ Cancellation will deduct ₹29,500 forfeiture amount (₹25,000 + 18% GST). This action cannot be undone.
      </div>
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Cancel Allotment</div></div>
        <div class="sp-body">
          <div class="sp-grid">
            <div class="fg"><label class="fl"><span class="r">*</span>Allotment</label>
              <select class="fc" id="cancel-allot-sel">
                <option value="">— Select Allotment —</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Reason</label>
              <select class="fc" id="cancel-reason">
                <option value="voluntary_surrender">Voluntary Surrender</option>
                <option value="non_payment">Non-Payment</option>
                <option value="document_discrepancy">Document Discrepancy</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <button class="btn btn-danger btn-lg" style="margin-top:10px" onclick="AllotmentPage.cancel()">Confirm Cancellation</button>
        </div>
      </div>
      <div id="cancel-list-body"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>

    <!-- WAITLIST TAB -->
    <div data-panel-group="allot" data-panel="waitlist" style="display:none">
      <div class="tbl-wrap">
        <div class="tbl-hdr">
          <div class="tbl-title">Waitlist</div>
          <div class="tbl-actions">
            <button class="btn btn-ghost btn-sm" onclick="AllotmentPage.loadWaitlist()">Refresh</button>
          </div>
        </div>
        <div id="waitlist-body"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
    </div>

    <!-- EDIT CUSTOMER ADDRESS TAB -->
    <div data-panel-group="allot" data-panel="edit-address" style="display:none">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Edit Customer Address</div></div>
        <div class="sp-body">
          <div class="sp-grid">
            <div class="fg" style="grid-column:span 2"><label class="fl"><span class="r">*</span>Consumer</label>
              <select class="fc" id="addr-consumer" onchange="AllotmentPage.loadAddressForm(this.value)">
                <option value="">— Select Consumer —</option>
              </select>
            </div>
          </div>
          <div id="addr-form" style="margin-top:14px;display:none">
            <div style="font-size:11px;font-weight:600;color:var(--teal);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px">Present Address</div>
            <div class="sp-grid">
              <div class="fg" style="grid-column:span 2"><label class="fl">Address Line 1</label><input class="fc" id="addr-present-line1"></div>
              <div class="fg"><label class="fl">City</label><input class="fc" id="addr-present-city"></div>
              <div class="fg"><label class="fl">State</label><input class="fc" id="addr-present-state"></div>
              <div class="fg"><label class="fl">PIN</label><input class="fc" id="addr-present-pin" maxlength="6"></div>
              <div class="fg"><label class="fl">Country</label><input class="fc" id="addr-present-country" value="India"></div>
            </div>
            <div style="font-size:11px;font-weight:600;color:var(--teal);margin:14px 0 8px;text-transform:uppercase;letter-spacing:0.5px">Permanent Address</div>
            <div class="sp-grid">
              <div class="fg" style="grid-column:span 2"><label class="fl">Address Line 1</label><input class="fc" id="addr-perm-line1"></div>
              <div class="fg"><label class="fl">City</label><input class="fc" id="addr-perm-city"></div>
              <div class="fg"><label class="fl">State</label><input class="fc" id="addr-perm-state"></div>
              <div class="fg"><label class="fl">PIN</label><input class="fc" id="addr-perm-pin" maxlength="6"></div>
            </div>
            <div style="margin-top:12px;display:flex;gap:8px">
              <button class="btn btn-teal btn-lg" onclick="AllotmentPage.saveAddress()">Save Address</button>
              <button class="btn btn-ghost" onclick="AllotmentPage.clearAddressForm()">Clear</button>
            </div>
            <div id="addr-result" style="margin-top:12px"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- E-DRAW IMPORT TAB -->
    <div data-panel-group="allot" data-panel="edraw" style="display:none">
      <div class="sp">
        <div class="sp-hdr"><div class="sp-title">Import E-Draw Results from TCP Haryana</div></div>
        <div class="sp-body">
          <div class="alert alert-info" style="margin-bottom:12px">
            Upload the CSV/Excel file downloaded from <b>edraw.tcpharyana.gov.in</b>.
            The system will auto-match applicants by Aadhaar hash and update statuses.
          </div>
          <div class="sp-grid">
            <div class="fg"><label class="fl">Project</label>
              <select class="fc" id="edraw-project" onchange="AllotmentPage.loadEdrawBankAccounts()">
                <option value="">— Select Project —</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Draw Date</label>
              <input type="date" class="fc" id="edraw-date" value="${Utils.today()}">
            </div>
            <div class="fg"><label class="fl">E-Draw CSV File</label>
              <input type="file" class="fc" id="edraw-file" accept=".csv,.xlsx,.xls">
            </div>
            <div class="fg"><label class="fl">Company Bank Account</label>
              <select class="fc" id="edraw-bank-account">
                <option value="">— Select Bank Account —</option>
              </select>
            </div>
          </div>
          <button class="btn btn-teal btn-lg" style="margin-top:10px" onclick="AllotmentPage.importEdraw()">Import E-Draw Results</button>
          <div id="edraw-result" style="margin-top:12px"></div>
        </div>
      </div>
    </div>
  `;

  await AllotmentPage.init(params);
};

const AllotmentPage = {
  _allotments: [],
  _busy: {},   // a second click while the first is on its way would only show a wrong error
  _allottedConsumers: [],

  async init(params) {
    await Promise.allSettled([
      this.loadConsumers(),
      this.loadProjects(),
      this.loadAvailableUnits(),
      this.loadAllotmentList('allot-list-body'),
    ]);

    if (params.tab) {
      setTimeout(() => {
        const btn = document.querySelector(`[data-group="allot"][data-tab="${params.tab}"]`);
        if (btn) { btn.click(); return; }
        // the shifting report and the address edit are reached only from the menu and have no tab button
        if (document.querySelector(`[data-panel-group="allot"][data-panel="${params.tab}"]`)) {
          Utils.switchTab('allot', params.tab);
          if (params.tab === 'shifting-report') this.loadShiftingReport();
        }
      }, 100);
    }
  },

  async loadConsumers() {
    try {
      const res = await Api.get('/consumers', { params: { page: 1, pageSize: 300 } });
      const list = res.data || res || [];
      const allotted = list.filter(c => c.lead_stage === 'allotted');
      this._allottedConsumers = allotted;

      // For allotment form — non-allotted consumers
      const available = list.filter(c => !['allotted','cancelled','possession_handed_over'].includes(c.lead_stage));
      const sel = document.getElementById('allot-consumer-sel');
      if (sel) sel.innerHTML = '<option value="">— Select Consumer —</option>' +
        available.map(c => `<option value="${c.id}">${c.name||`${c.first_name||''} ${c.last_name||''}`} · ${c.mobile||''}</option>`).join('');

      // For shifting — allotted consumers only
      const shiftSel = document.getElementById('shift-consumer');
      if (shiftSel) shiftSel.innerHTML = '<option value="">— Select Allotted Consumer —</option>' +
        allotted.map(c => `<option value="${c.id}" data-unit="${c.allocated_unit_id||''}" data-unitno="${c.unit_number||''}" data-project="${c.project_id||''}">${c.name||`${c.first_name||''} ${c.last_name||''}`} · ${c.mobile||''}</option>`).join('');

      // For address edit — all consumers
      const addrSel = document.getElementById('addr-consumer');
      if (addrSel) addrSel.innerHTML = '<option value="">— Select Consumer —</option>' +
        list.map(c => `<option value="${c.id}">${c.name||`${c.first_name||''} ${c.last_name||''}`} · ${c.mobile||''}</option>`).join('');

      // For search tab project filter
      const searchProjSel = document.getElementById('search-project');
      if (searchProjSel) {
        const projects = [...new Map(list.filter(c=>c.project_id).map(c=>[c.project_id,{id:c.project_id,name:c.project_name||c.projectName||c.project_id}])).values()];
        searchProjSel.innerHTML = '<option value="">— All Projects —</option>' +
          projects.map(p => `<option value="${p.id}">${Utils.esc(p.name)}</option>`).join('');
      }

    } catch (err) { console.error(err); }
  },

  async loadProjects() {
    try {
      const list = await window.ProjectCache.load();
      ['allot-project-sel','edraw-project','sr-project','letter-proj-sel'].forEach(id => {
        const sel = document.getElementById(id);
        if (sel) sel.innerHTML = '<option value="">— Select Project —</option>' +
          list.map(p => `<option value="${p.id}">${Utils.esc(p.name)}</option>`).join('');
      });
    } catch {}
  },

  async onConsumerChange() {
    const consumerId = document.getElementById('allot-consumer-sel')?.value;
    if (!consumerId) {
      document.getElementById('allot-project-sel').value = '';
      document.getElementById('allot-unit-sel').value = '';
      return;
    }
    try {
      const res = await Api.get('/booking', { params: { consumer_id: consumerId, pageSize: 1 } });
      const bookings = res.data || [];
      if (!bookings.length) return;
      const booking = bookings[0];
      if (booking.project_id) {
        const projectSel = document.getElementById('allot-project-sel');
        projectSel.value = booking.project_id;
        await this.onProjectChange();
      }
      if (booking.unit_id) {
        // the unit list was awaited above, so the unit can be picked now (a fixed 500 ms wait lost the race on a slow machine)
        const unitSel = document.getElementById('allot-unit-sel');
        if (unitSel) unitSel.value = booking.unit_id;
      }
    } catch (err) {
      console.warn('Could not fetch booking for consumer:', err.message);
    }
  },

  async onProjectChange() {
    const projectId = document.getElementById('allot-project-sel')?.value;
    if (!projectId) { this.loadAvailableUnits(); return; }
    await this.loadAvailableUnits(projectId);
  },

  async loadAvailableUnits(projectId) {
    try {
      const params = { status: 'booked', pageSize: 300 };
      if (projectId) params.projectId = projectId;
      const res = await Api.get('/units', { params });
      const list = res.data || res || [];
      const sel = document.getElementById('allot-unit-sel');
      if (sel) sel.innerHTML = '<option value="">— Select Unit —</option>' +
        list.map(u => `<option value="${u.id}">${u.unit_number||u.unitNumber} · Tower ${u.tower||'—'} · ${u.bhk_type||u.bhkType||'—'}</option>`).join('');

    } catch {}
  },

  async loadAllotmentList(targetId = 'allot-list-body') {
    const el = document.getElementById(targetId);
    if (!el) return;
    try {
      const params = { page: 1, pageSize: 100 };
      const isLetterTab = targetId === 'letter-search-body';   // same table as Search Allotment (it has the letter link), with its own three filters
      const isSearchTab = targetId === 'allot-search-body' || isLetterTab;
      if (isLetterTab) {
        const reg = document.getElementById('letter-reg-search')?.value?.trim(); if (reg) params.registrationNo = reg;
        const unit = document.getElementById('letter-unit-search')?.value?.trim(); if (unit) params.unitAddress = unit;
      } else if (isSearchTab) {
        params.status = 'all';
        const regNo = document.getElementById('searchRegNo')?.value?.trim();
        if (regNo) params.registrationNo = regNo;
        const firstName = document.getElementById('searchFirstName')?.value?.trim();
        if (firstName) params.firstName = firstName;
        const unitAddr = document.getElementById('searchUnitAddress')?.value?.trim();
        if (unitAddr) params.unitAddress = unitAddr;
        const dateFrom = document.getElementById('searchDateFrom')?.value;
        if (dateFrom) params.dateFrom = dateFrom;
        const dateTo = document.getElementById('searchDateTo')?.value;
        if (dateTo) params.dateTo = dateTo;
      }
      const projSel = document.getElementById(isLetterTab ? 'letter-proj-sel' : 'search-project');
      if (projSel?.value) params.projectId = projSel.value;

      const res = await Api.get('/allocations', { params });
      const list = res.data || res || [];
      this._allotments = list;

      const cancelSel = document.getElementById('cancel-allot-sel');
      if (cancelSel) cancelSel.innerHTML = '<option value="">— Select Allotment —</option>' +
        list.filter(a => a.status === 'allotted').map(a =>
          `<option value="${a.id}">${a.consumer_name||a.consumerName||'—'} · ${a.unit_number||a.unitNumber||'Unit'}</option>`
        ).join('');

      if (isSearchTab) {
        // Legacy-style Search Allotment results
        const fmt = (n) => n != null ? Number(n).toLocaleString('en-IN') : 'N/A';
        const fmtDec = (n) => n != null ? Number(n).toFixed(2) : 'N/A';
        const fmtDate = (d) => {
          if (!d) return '—';
          const dt = new Date(d);
          return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
        };
        const projectName = list.length > 0 ? (list[0].project_name || '') : '';
        const allSameProject = list.every(r => r.project_name === projectName);
        const headerLabel = projectName && allSameProject ? `PROJECT: ${projectName}` : (list.length > 0 ? 'ALL PROJECTS' : '');

        el.innerHTML = list.length === 0
          ? '<div class="aln-empty">No allotments found.</div>'
          : `<div class="aln-proj">${headerLabel}</div>
             <div style="overflow-x:auto">
               <table style="min-width:1100px">
                 <thead>
                   <tr>
                     <th>S.NO.</th>
                     <th>REGISTRATION NO</th>
                     <th>FIRST APPLICANT NAME</th>
                     <th>SECOND APPLICANT NAME</th>
                     <th>UNIT ADDRESS</th>
                     <th>BROKER COMPANY</th>
                     <th>UNIT TYPE</th>
                     <th class="txt-right" style="text-align:right">AREA</th>
                     <th class="txt-right" style="text-align:right">RATE</th>
                     <th class="txt-right" style="text-align:right">BASIC PRICE</th>
                     <th>ALLOTMENT DATE</th>
                     <th>ALLOTMENT LETTER TYPE1</th>
                   </tr>
                 </thead>
                 <tbody>
                   ${list.map((a, i) => `
                     <tr>
                       <td>${i+1}</td>
                       <td>${a.registration_no||'—'}</td>
                       <td class="td-bold">
                         <a class="aln-link" href="/api/consumers/${a.consumer_id}/applicant-file?token=${Auth.getToken()||''}"
                            target="_blank"
                            title="View Applicant File">
                           ${a.first_name||a.consumer_name||'—'}
                         </a>
                       </td>
                       <td style="color:var(--text2)">${a.co_applicant_name||'N/A'}</td>
                       <td>${a.unit_number||'—'}</td>
                       <td>${a.broker_company||'Direct'}</td>
                       <td>${a.bhk_type||'N/A'}</td>
                       <td style="text-align:right">${fmtDec(a.carpet_area_sqft||a.super_area_sqft)}</td>
                       <td style="text-align:right">${fmtDec(a.base_price_inr)}</td>
                       <td style="text-align:right">${fmt(a.total_price_inr)}</td>
                       <td style="white-space:nowrap">${fmtDate(a.allotment_date||a.allocated_date)}</td>
                       <td>
                         <a class="aln-link" href="javascript:void(0)"
                            onclick="AllotmentPage.openAllotmentLetter('${a.consumer_id}','${a.id}')">
                           Allotment Letter
                         </a>
                       </td>
                     </tr>`).join('')}
                 </tbody>
               </table>
             </div>`;
      } else {
        // Simple table for allotment form / letter tabs
        el.innerHTML = list.length === 0
          ? '<div class="empty-state"><div class="empty-icon">📋</div><h3>No allotments found</h3></div>'
          : `<table>
              <thead><tr><th>S.No.</th><th>Consumer</th><th>Unit</th><th>Project</th><th>Allotment Date</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                ${list.map((a,i) => `<tr>
                  <td>${i+1}</td>
                  <td class="td-bold"><a href="/api/consumers/${a.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" onclick="event.stopPropagation()" class="aln-link" title="View Applicant File">${a.consumer_name||a.consumerName||'—'}</a></td>
                  <td>${a.unit_number||a.unitNumber||'—'}</td>
                  <td style="font-size:10.5px">${a.project_name||a.projectName||'—'}</td>
                  <td style="font-size:10.5px">${Utils.date(a.allotment_date||a.allocated_date||a.allotmentDate||a.created_at)}</td>
                  <td>${Utils.chip(a.status||'allotted')}</td>
                  <td><button class="btn btn-ghost btn-sm" onclick="Router.navigate('/consumer',{id:'${a.consumer_id||a.consumerId}'})">View</button></td>
                </tr>`).join('')}
              </tbody>
            </table>`;
      }
    } catch (err) { el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`; }
  },

  async allot() {
    const consumerId = document.getElementById('allot-consumer-sel')?.value;
    const unitId = document.getElementById('allot-unit-sel')?.value;
    const projectId = document.getElementById('allot-project-sel')?.value;
    const allotmentDate = document.getElementById('allot-date')?.value;
    const remarks = document.getElementById('allot-remarks')?.value;

    if (!consumerId) { Utils.warn('Please select a consumer'); return; }
    if (!unitId) { Utils.warn('Please select a unit'); return; }
    if (!projectId) { Utils.warn('Please select a project'); return; }

    if (this._busy.allot) return;
    this._busy.allot = true;
    try {
      await Api.post('/allocations', { consumerId, unitId, projectId, allotmentDate, remarks });
      Utils.success('Unit allotted successfully');
      await Promise.allSettled([this.loadAllotmentList('allot-list-body'), this.loadAvailableUnits(), this.loadConsumers()]);   // the consumer lists (form, shifting, address) change with every allotment
      
      // Clear form
      document.getElementById('allot-remarks').value = '';
    } catch (err) { Utils.error(err.message); }
    finally { this._busy.allot = false; }
  },

  async onShiftConsumerChange() {
    const sel = document.getElementById('shift-consumer');
    const opt = sel?.options[sel.selectedIndex];
    const unitInput = document.getElementById('shift-current-unit');
    if (unitInput) unitInput.value = opt?.dataset?.unitno || opt?.dataset?.unit || '';
    await this.loadShiftTargets(opt?.dataset?.project || '');
  },

  // A unit can be shifted to only when it is available, in the project the applicant is already in
  async loadShiftTargets(projectId) {
    const sel = document.getElementById('shift-new-unit');
    if (!sel) return;
    sel.innerHTML = '<option value="">— Select New Unit —</option>';
    if (!projectId) return;
    try {
      const res = await Api.get('/units', { params: { status: 'available', projectId, pageSize: 300 } });
      const list = res.data || res || [];
      sel.innerHTML += list.map(u => `<option value="${u.id}">${u.unit_number||u.unitNumber} · Tower ${u.tower||'—'} · ${u.bhk_type||u.bhkType||'—'}</option>`).join('');
    } catch {}
  },

  async shiftUnit() {
    const consumerId = document.getElementById('shift-consumer')?.value;
    const newUnitId = document.getElementById('shift-new-unit')?.value;
    const reason = document.getElementById('shift-reason')?.value;
    const shiftDate = document.getElementById('shift-date')?.value;

    if (!consumerId) { Utils.warn('Please select a consumer'); return; }
    if (!newUnitId) { Utils.warn('Please select the new unit'); return; }

    const result = document.getElementById('shift-result');
    if (this._busy.shift) return;
    this._busy.shift = true;
    try {
      const res = await Api.post('/allocations/shift', { consumerId, newUnitId, reason, shiftDate });
      const data = res.data || res;
      result.innerHTML = `<div class="alert alert-success">✓ Unit shifted successfully. New unit: <strong>${data.new_unit_number||newUnitId}</strong></div>`;
      await this.loadConsumers();
      await this.loadAvailableUnits();
      await this.loadShiftTargets('');
    } catch (err) {
      result.innerHTML = `<div class="alert alert-error">Error: ${err.message}</div>`;
    } finally { this._busy.shift = false; }
  },

  clearShiftForm() {
    ['shift-consumer','shift-new-unit'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const inp = document.getElementById('shift-current-unit'); if (inp) inp.value = '';
    const inp2 = document.getElementById('shift-reason'); if (inp2) inp2.value = '';
    const r = document.getElementById('shift-result'); if (r) r.innerHTML = '';
  },

  async loadShiftingList() {
    const el = document.getElementById('shifting-list-body');
    if (!el) return;
    await this.loadConsumers();   // applicants allotted or cancelled since the page opened
    // Show shifting history if endpoint exists
    try {
      const res = await Api.get('/allocations/shifts', { params: { pageSize: 50 } });
      const list = res.data || res || [];
      if (!list.length) { el.innerHTML = ''; return; }
      el.innerHTML = `
        <div class="tbl-wrap" style="margin-top:12px">
          <div class="tbl-hdr"><div class="tbl-title">Recent Shifts</div></div>
          <table>
            <thead><tr><th>Consumer</th><th>From Unit</th><th>To Unit</th><th>Date</th><th>Reason</th></tr></thead>
            <tbody>
              ${list.map(s => `<tr>
                <td class="td-bold"><a href="/api/consumers/${s.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" onclick="event.stopPropagation()" class="aln-link" title="View Applicant File">${s.consumer_name||'—'}</a></td>
                <td>${s.old_unit_number||'—'}</td>
                <td>${s.new_unit_number||'—'}</td>
                <td>${Utils.date(s.shift_date||s.created_at)}</td>
                <td style="font-size:10.5px">${s.reason||'—'}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    } catch { el.innerHTML = ''; }
  },

  async loadShiftingReport() {
    const el = document.getElementById('shifting-report-body');
    if (!el) return;
    const from = document.getElementById('sr-from')?.value;
    const to = document.getElementById('sr-to')?.value;
    const projectId = document.getElementById('sr-project')?.value;
    el.innerHTML = '<div class="page-loading"><div class="spinner"></div> Loading…</div>';
    try {
      const params = { pageSize: 200 };
      if (from) params.from = from;
      if (to) params.to = to;
      if (projectId) params.projectId = projectId;
      const res = await Api.get('/allocations/shifts', { params });
      const list = res.data || res || [];
      el.innerHTML = list.length === 0
        ? '<div class="empty-state"><div class="empty-icon">📊</div><h3>No shifting records found for selected period</h3></div>'
        : `<table>
            <thead><tr><th>S.No.</th><th>Consumer</th><th>Mobile</th><th>From Unit</th><th>To Unit</th><th>Project</th><th>Shift Date</th><th>Reason</th></tr></thead>
            <tbody>
              ${list.map((s,i) => `<tr>
                <td>${i+1}</td>
                <td class="td-bold"><a href="/api/consumers/${s.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" onclick="event.stopPropagation()" class="aln-link" title="View Applicant File">${s.consumer_name||'—'}</a></td>
                <td>${s.mobile||'—'}</td>
                <td>${s.old_unit_number||'—'}</td>
                <td>${s.new_unit_number||'—'}</td>
                <td style="font-size:10.5px">${s.project_name||'—'}</td>
                <td>${Utils.date(s.shift_date||s.created_at)}</td>
                <td style="font-size:10.5px">${s.reason||'—'}</td>
              </tr>`).join('')}
            </tbody>
          </table>`;
    } catch (err) { el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`; }
  },

  async cancel() {
    const allotId = document.getElementById('cancel-allot-sel')?.value;
    if (!allotId) { Utils.warn('Please select an allotment to cancel'); return; }

    if (this._busy.cancel) return;
    Utils.confirm('Cancel this allotment? ₹29,500 forfeiture will be deducted. This cannot be undone.', async () => {
      if (this._busy.cancel) return;
      this._busy.cancel = true;
      try {
        const reason = document.getElementById('cancel-reason')?.value;
        await Api.post(`/allocations/${allotId}/cancel`, { reason });
        Utils.success('Allotment cancelled. Forfeiture deducted and unit released.');
        await Promise.allSettled([this.loadAllotmentList('allot-list-body'), this.loadConsumers()]);
      } catch (err) { Utils.error(err.message); }
      finally { this._busy.cancel = false; }
    });
  },

  async loadCancellations() {
    await this.loadAllotmentList('cancel-list-body');
  },

  async loadWaitlist() {
    const el = document.getElementById('waitlist-body');
    if (!el) return;
    try {
      const res = await Api.get('/allocations/waitlist', { params: { page: 1, pageSize: 100 } });
      const list = res.data || res || [];
      el.innerHTML = list.length === 0
        ? '<div class="empty-state"><div class="empty-icon">⏳</div><h3>No waitlist entries</h3></div>'
        : `<table>
            <thead><tr><th>Position</th><th>Consumer</th><th>Mobile</th><th>Project</th><th>Applied Date</th><th>Status</th></tr></thead>
            <tbody>
              ${list.map(w => `<tr>
                <td style="font-weight:700;color:var(--teal)">#${w.position||w.waitlist_position||'—'}</td>
                <td class="td-bold"><a href="/api/consumers/${w.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" onclick="event.stopPropagation()" class="aln-link" title="View Applicant File">${w.consumer_name||w.consumerName||'—'}</a></td>
                <td>${w.consumer_mobile||w.mobile||'—'}</td>
                <td>${w.project_name||w.projectName||'—'}</td>
                <td>${Utils.date(w.applied_date||w.created_at)}</td>
                <td>${Utils.chip(w.status||'waiting')}</td>
              </tr>`).join('')}
            </tbody>
          </table>`;
    } catch (err) { el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`; }
  },

  async loadAddressForm(consumerId) {
    const form = document.getElementById('addr-form');
    if (!form) return;
    if (!consumerId) { form.style.display = 'none'; return; }
    try {
      const res = await Api.get(`/consumers/${consumerId}`);
      const c = res.data || res || {};
      form.style.display = 'block';
      const fields = {
        'addr-present-line1': c.present_address || c.presentAddress || '',
        'addr-present-city': c.present_city || c.presentCity || '',
        'addr-present-state': c.present_state || c.presentState || '',
        'addr-present-pin': c.present_pin || c.presentPin || '',
        'addr-present-country': c.present_country || c.presentCountry || 'India',
        'addr-perm-line1': c.perm_address || c.permAddress || '',
        'addr-perm-city': c.perm_city || c.permCity || '',
        'addr-perm-state': c.perm_state || c.permState || '',
        'addr-perm-pin': c.perm_pin || c.permPin || '',
      };
      Object.entries(fields).forEach(([id, val]) => {
        const el = document.getElementById(id); if (el) el.value = val;
      });
      document.getElementById('addr-result').innerHTML = '';
    } catch (err) { Utils.error(err.message); }
  },

  async saveAddress() {
    const consumerId = document.getElementById('addr-consumer')?.value;
    if (!consumerId) { Utils.warn('Please select a consumer'); return; }

    const body = {
      present_address_line1: document.getElementById('addr-present-line1')?.value,
      present_city: document.getElementById('addr-present-city')?.value,
      present_state: document.getElementById('addr-present-state')?.value,
      present_pin: document.getElementById('addr-present-pin')?.value,
      present_country: document.getElementById('addr-present-country')?.value,
      perm_address_line1: document.getElementById('addr-perm-line1')?.value,
      perm_city: document.getElementById('addr-perm-city')?.value,
      perm_state: document.getElementById('addr-perm-state')?.value,
      perm_pin: document.getElementById('addr-perm-pin')?.value,
    };

    try {
      await Api.patch(`/consumers/${consumerId}`, body);
      document.getElementById('addr-result').innerHTML = '<div class="alert alert-success">✓ Address updated successfully</div>';
    } catch (err) {
      document.getElementById('addr-result').innerHTML = `<div class="alert alert-error">Error: ${err.message}</div>`;
    }
  },

  clearAddressForm() {
    document.getElementById('addr-consumer').value = '';
    document.getElementById('addr-form').style.display = 'none';
    document.getElementById('addr-result').innerHTML = '';
  },

  async openAllotmentLetter(consumerId, allotmentId) {
    // Open blank tab synchronously (before any await) so popup blocker allows it
    const newTab = window.open('about:blank', '_blank');
    if (newTab) newTab.document.write('<p style="font-family:sans-serif;padding:20px">Generating allotment letter…</p>');
    try {
      Utils.info('Generating allotment letter…');
      const res = await Api.post('/documents/generate', {
        consumerId,
        allocationId: allotmentId,
        documentType: 'allotment_letter',
      });
      const docId = res.data?.documentId || res.documentId;
      if (!docId) throw new Error('No document ID returned');

      const token = Auth.getToken() || localStorage.getItem('rof-jwt') || '';
      const htmlRes = await fetch(`/api/documents/${docId}/html`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!htmlRes.ok) throw new Error(`Failed to load document: ${htmlRes.status}`);
      const rawText = await htmlRes.text();
      let html = rawText;
      try {
        const parsed = JSON.parse(rawText);
        if (parsed && parsed.data) html = parsed.data;
      } catch (_) { /* already raw HTML */ }

      if (newTab) {
        newTab.document.open();
        newTab.document.write(html);
        newTab.document.close();
      } else {
        const blob = new Blob([html], { type: 'text/html' });
        window.open(URL.createObjectURL(blob), '_blank');
      }
    } catch (err) {
      if (newTab) newTab.close();
      Utils.error('Failed to generate allotment letter: ' + err.message);
    }
  },

  async generateLetters() {
    Utils.confirm('Generate allotment letters for all allotted units?', async () => {
      try {
        const res = await Api.post('/allocations/generate-letters', {});
        const data = res.data || res;
        Utils.success(`${data.generated||0} allotment letter(s) generated and queued for delivery`);
      } catch (err) { Utils.error(err.message); }
    });
  },

  async loadEdrawBankAccounts() {
    const projectId = document.getElementById('edraw-project')?.value;
    const sel = document.getElementById('edraw-bank-account');
    if (!sel) return;
    sel.innerHTML = '<option value="">— Select Bank Account —</option>';
    if (!projectId) return;
    try {
      const res = await Api.get(`/payments/clearing-banks/${projectId}`);
      const accounts = res.data || [];
      sel.innerHTML = '<option value="">— Select Bank Account —</option>' +
        accounts.map(a => `<option value="${a.id}">${a.bank_name}${a.account_name ? ' — ' + a.account_name : ''} (${a.account_number})</option>`).join('');
    } catch (e) {
      console.warn('Company bank accounts fetch failed:', e.message);
    }
  },

  async importEdraw() {
    const file = document.getElementById('edraw-file')?.files[0];
    const projectId = document.getElementById('edraw-project')?.value;
    const companyBankAccountId = document.getElementById('edraw-bank-account')?.value;
    if (!file) { Utils.warn('Please select a CSV file'); return; }

    const fd = new FormData();
    fd.append('file', file);
    if (projectId) fd.append('projectId', projectId);
    if (companyBankAccountId) fd.append('companyBankAccountId', companyBankAccountId);
    fd.append('drawDate', document.getElementById('edraw-date')?.value || Utils.today());

    try {
      const res = await Api.uploadFile('/allocations/import-edraw', fd);
      const data = res.data || res;
      document.getElementById('edraw-result').innerHTML = `
        <div class="alert alert-success">
          ✓ E-Draw results imported:
          ${data.allotted || 0} allotted ·
          ${data.waitlisted || 0} waitlisted ·
          ${data.unsuccessful || 0} unsuccessful ·
          ${data.errors || 0} errors
        </div>`;
    } catch (err) {
      document.getElementById('edraw-result').innerHTML = `<div class="alert alert-error">Error: ${err.message}</div>`;
    }
  },
};
