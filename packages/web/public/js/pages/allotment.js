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
      <button class="tab-line" data-group="allot" data-tab="shifting" onclick="switchTab('allot','shifting');AllotmentPage.loadShiftingList()">Unit Shifting</button>
      <button class="tab-line" data-group="allot" data-tab="cancel" onclick="switchTab('allot','cancel');AllotmentPage.loadCancellations()">Cancel Allotment</button>
      <button class="tab-line" data-group="allot" data-tab="waitlist" onclick="switchTab('allot','waitlist');AllotmentPage.loadWaitlist()">Waitlist</button>
      <button class="tab-line" data-group="allot" data-tab="edraw" onclick="switchTab('allot','edraw')">E-Draw Import</button>
    </div>

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
      <div style="background:#fff;border:1px solid #dde1e7;border-radius:4px;margin-bottom:12px">
        <div style="background:#e8f0fe;border-bottom:1px solid #dde1e7;padding:8px 14px;display:flex;align-items:center;justify-content:space-between">
          <span style="font-weight:700;font-size:13px;color:var(--primary,#1a73e8);letter-spacing:.5px">SEARCH ALLOTMENT</span>
        </div>
        <div style="padding:14px 16px 10px">
          <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">

            <div style="display:flex;flex-direction:column;gap:3px;min-width:160px;flex:1">
              <label style="font-size:11.5px;color:#555;font-weight:600"><span style="color:var(--red,#d32f2f)">*</span>Project:</label>
              <select class="fc" id="search-project" style="height:32px;font-size:12.5px;padding:0 8px">
                <option value="">--Select--</option>
              </select>
            </div>

            <div style="display:flex;flex-direction:column;gap:3px;min-width:140px;flex:1">
              <label style="font-size:11.5px;color:#555;font-weight:600">Registration No.:</label>
              <input class="fc" id="searchRegNo" placeholder="Registration No." style="height:32px;font-size:12.5px;padding:0 8px">
            </div>

            <div style="display:flex;flex-direction:column;gap:3px;min-width:130px;flex:1">
              <label style="font-size:11.5px;color:#555;font-weight:600">First Name:</label>
              <input class="fc" id="searchFirstName" placeholder="First Name" style="height:32px;font-size:12.5px;padding:0 8px">
            </div>

            <div style="display:flex;flex-direction:column;gap:3px;min-width:130px;flex:1">
              <label style="font-size:11.5px;color:#555;font-weight:600">Unit Address:</label>
              <input class="fc" id="searchUnitAddress" placeholder="Unit Address" style="height:32px;font-size:12.5px;padding:0 8px">
            </div>

            <div style="display:flex;flex-direction:column;gap:3px;min-width:220px;flex:1.4">
              <label style="font-size:11.5px;color:#555;font-weight:600">Allotment Date:</label>
              <div style="display:flex;align-items:center;gap:5px">
                <div style="position:relative;flex:1">
                  <span style="position:absolute;left:7px;top:50%;transform:translateY(-50%);color:#888;font-size:13px;pointer-events:none">📅</span>
                  <input type="date" class="fc" id="searchDateFrom" placeholder="From Date" style="height:32px;font-size:12px;padding:0 8px 0 26px">
                </div>
                <span style="color:#555;font-size:13px;flex-shrink:0">-</span>
                <div style="position:relative;flex:1">
                  <span style="position:absolute;left:7px;top:50%;transform:translateY(-50%);color:#888;font-size:13px;pointer-events:none">📅</span>
                  <input type="date" class="fc" id="searchDateTo" placeholder="To Date" style="height:32px;font-size:12px;padding:0 8px 0 26px">
                </div>
              </div>
            </div>

          </div>
          <div style="margin-top:12px">
            <button class="btn btn-fetch" style="background:#1a73e8;color:#fff;border:none;padding:6px 22px;border-radius:3px;font-size:13px;font-weight:600;cursor:pointer;letter-spacing:.3px" onclick="AllotmentPage.loadAllotmentList('allot-search-body')">FETCH</button>
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
              <select class="fc" id="edraw-project">
                <option value="">— Select Project —</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Draw Date</label>
              <input type="date" class="fc" id="edraw-date" value="${Utils.today()}">
            </div>
            <div class="fg"><label class="fl">E-Draw CSV File</label>
              <input type="file" class="fc" id="edraw-file" accept=".csv,.xlsx,.xls">
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
        if (btn) btn.click();
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
        allotted.map(c => `<option value="${c.id}" data-unit="${c.allocated_unit_id||''}">${c.name||`${c.first_name||''} ${c.last_name||''}`} · ${c.mobile||''}</option>`).join('');

      // For address edit — all consumers
      const addrSel = document.getElementById('addr-consumer');
      if (addrSel) addrSel.innerHTML = '<option value="">— Select Consumer —</option>' +
        list.map(c => `<option value="${c.id}">${c.name||`${c.first_name||''} ${c.last_name||''}`} · ${c.mobile||''}</option>`).join('');

      // For search tab project filter
      const searchProjSel = document.getElementById('search-project');
      if (searchProjSel) {
        const projects = [...new Map(list.filter(c=>c.project_id).map(c=>[c.project_id,{id:c.project_id,name:c.project_name||c.projectName||c.project_id}])).values()];
        searchProjSel.innerHTML = '<option value="">— All Projects —</option>' +
          projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
      }

    } catch (err) { console.error(err); }
  },

  async loadProjects() {
    try {
      const list = await window.ProjectCache.load();
      ['allot-project-sel','edraw-project','sr-project','letter-proj-sel'].forEach(id => {
        const sel = document.getElementById(id);
        if (sel) sel.innerHTML = '<option value="">— Select Project —</option>' +
          list.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
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
        setTimeout(() => {
          const unitSel = document.getElementById('allot-unit-sel');
          if (unitSel) unitSel.value = booking.unit_id;
        }, 500);
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

      // Also populate shift new unit
      const shiftSel = document.getElementById('shift-new-unit');
      if (shiftSel) shiftSel.innerHTML = '<option value="">— Select New Unit —</option>' +
        list.map(u => `<option value="${u.id}">${u.unit_number||u.unitNumber} · Tower ${u.tower||'—'} · ${u.bhk_type||u.bhkType||'—'}</option>`).join('');
    } catch {}
  },

  async loadAllotmentList(targetId = 'allot-list-body') {
    const el = document.getElementById(targetId);
    if (!el) return;
    try {
      const params = { page: 1, pageSize: 100 };
      const isSearchTab = targetId === 'allot-search-body';
      if (isSearchTab) {
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
      const projSel = document.getElementById('search-project');
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
          ? '<div style="padding:16px;color:#555">No allotments found.</div>'
          : `<div style="background:#e8f0fe;border:1px solid #c5cfe8;border-bottom:none;padding:7px 14px;display:flex;align-items:center;justify-content:space-between">
               <span style="font-weight:700;font-size:12.5px;color:#1a4a8a">${headerLabel}</span>
             </div>
             <div style="overflow-x:auto;border:1px solid #c5cfe8">
               <table style="width:100%;border-collapse:collapse;min-width:1100px;font-size:12px">
                 <thead>
                   <tr style="background:#1a5276;color:#fff">
                     <th style="padding:7px 6px;text-align:center;white-space:nowrap;font-weight:700;border:1px solid #154360">S.NO.</th>
                     <th style="padding:7px 6px;white-space:nowrap;font-weight:700;border:1px solid #154360">REGISTRATION NO</th>
                     <th style="padding:7px 6px;white-space:nowrap;font-weight:700;border:1px solid #154360">FIRST APPLICANT NAME</th>
                     <th style="padding:7px 6px;white-space:nowrap;font-weight:700;border:1px solid #154360">SECOND APPLICANT NAME</th>
                     <th style="padding:7px 6px;white-space:nowrap;font-weight:700;border:1px solid #154360">UNIT ADDRESS</th>
                     <th style="padding:7px 6px;white-space:nowrap;font-weight:700;border:1px solid #154360">BROKER COMPANY</th>
                     <th style="padding:7px 6px;white-space:nowrap;font-weight:700;border:1px solid #154360">UNIT TYPE</th>
                     <th style="padding:7px 6px;text-align:right;white-space:nowrap;font-weight:700;border:1px solid #154360">AREA</th>
                     <th style="padding:7px 6px;text-align:right;white-space:nowrap;font-weight:700;border:1px solid #154360">RATE</th>
                     <th style="padding:7px 6px;text-align:right;white-space:nowrap;font-weight:700;border:1px solid #154360">BASIC PRICE</th>
                     <th style="padding:7px 6px;white-space:nowrap;font-weight:700;border:1px solid #154360">ALLOTMENT DATE</th>
                     <th style="padding:7px 6px;white-space:nowrap;font-weight:700;border:1px solid #154360">ALLOTMENT LETTER TYPE1</th>
                   </tr>
                 </thead>
                 <tbody>
                   ${list.map((a, i) => `
                     <tr style="background:${i%2===0?'#fff':'#f4f8fc'}">
                       <td style="padding:6px;text-align:center;border:1px solid #dde4ee">${i+1}</td>
                       <td style="padding:6px;border:1px solid #dde4ee">${a.registration_no||'—'}</td>
                       <td style="padding:6px;border:1px solid #dde4ee">
                         <a href="javascript:void(0)"
                            onclick="Router.navigate('/consumer',{id:'${a.consumer_id}'})"
                            style="color:#1a6fc4;text-decoration:none;cursor:pointer"
                            onmouseover="this.style.textDecoration='underline'"
                            onmouseout="this.style.textDecoration='none'">
                           ${a.first_name||a.consumer_name||'—'}
                         </a>
                       </td>
                       <td style="padding:6px;border:1px solid #dde4ee;color:#555">${a.co_applicant_name||'N/A'}</td>
                       <td style="padding:6px;border:1px solid #dde4ee">${a.unit_number||'—'}</td>
                       <td style="padding:6px;border:1px solid #dde4ee">${a.broker_company||'Direct'}</td>
                       <td style="padding:6px;border:1px solid #dde4ee">${a.bhk_type||'N/A'}</td>
                       <td style="padding:6px;text-align:right;border:1px solid #dde4ee">${fmtDec(a.carpet_area_sqft||a.super_area_sqft)}</td>
                       <td style="padding:6px;text-align:right;border:1px solid #dde4ee">${fmtDec(a.base_price_inr)}</td>
                       <td style="padding:6px;text-align:right;border:1px solid #dde4ee">${fmt(a.total_price_inr)}</td>
                       <td style="padding:6px;white-space:nowrap;border:1px solid #dde4ee">${fmtDate(a.allotment_date||a.allocated_date)}</td>
                       <td style="padding:6px;text-align:center;border:1px solid #dde4ee">
                         <a href="javascript:void(0)"
                            onclick="AllotmentPage.openAllotmentLetter('${a.consumer_id}','${a.id}')"
                            style="color:#1a6fc4;text-decoration:none;cursor:pointer"
                            onmouseover="this.style.textDecoration='underline'"
                            onmouseout="this.style.textDecoration='none'">
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
                  <td class="td-bold">${a.consumer_name||a.consumerName||'—'}</td>
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

    try {
      await Api.post('/allocations', { consumerId, unitId, projectId, allotmentDate, remarks });
      Utils.success('Unit allotted successfully');
      await Promise.allSettled([this.loadAllotmentList('allot-list-body'), this.loadAvailableUnits()]);
      
      // Clear form
      document.getElementById('allot-remarks').value = '';
    } catch (err) { Utils.error(err.message); }
  },

  onShiftConsumerChange() {
    const sel = document.getElementById('shift-consumer');
    const opt = sel?.options[sel.selectedIndex];
    const unitInput = document.getElementById('shift-current-unit');
    if (unitInput) unitInput.value = opt?.dataset?.unit || '';
  },

  async shiftUnit() {
    const consumerId = document.getElementById('shift-consumer')?.value;
    const newUnitId = document.getElementById('shift-new-unit')?.value;
    const reason = document.getElementById('shift-reason')?.value;
    const shiftDate = document.getElementById('shift-date')?.value;

    if (!consumerId) { Utils.warn('Please select a consumer'); return; }
    if (!newUnitId) { Utils.warn('Please select the new unit'); return; }

    const result = document.getElementById('shift-result');
    try {
      const res = await Api.post('/allocations/shift', { consumerId, newUnitId, reason, shiftDate });
      const data = res.data || res;
      result.innerHTML = `<div class="alert alert-success">✓ Unit shifted successfully. New unit: <strong>${data.new_unit_number||newUnitId}</strong></div>`;
      await this.loadConsumers();
      await this.loadAvailableUnits();
    } catch (err) {
      result.innerHTML = `<div class="alert alert-error">Error: ${err.message}</div>`;
    }
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
                <td class="td-bold">${s.consumer_name||'—'}</td>
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
                <td class="td-bold">${s.consumer_name||'—'}</td>
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

    Utils.confirm('Cancel this allotment? ₹29,500 forfeiture will be deducted. This cannot be undone.', async () => {
      try {
        const reason = document.getElementById('cancel-reason')?.value;
        await Api.post(`/allocations/${allotId}/cancel`, { reason });
        Utils.success('Allotment cancelled. Forfeiture deducted and unit released.');
        await this.loadAllotmentList('allot-list-body');
      } catch (err) { Utils.error(err.message); }
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
                <td class="td-bold">${w.consumer_name||w.consumerName||'—'}</td>
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

  async importEdraw() {
    const file = document.getElementById('edraw-file')?.files[0];
    const projectId = document.getElementById('edraw-project')?.value;
    if (!file) { Utils.warn('Please select a CSV file'); return; }

    const fd = new FormData();
    fd.append('file', file);
    if (projectId) fd.append('projectId', projectId);
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
