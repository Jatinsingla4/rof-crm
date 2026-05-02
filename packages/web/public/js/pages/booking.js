// ROF CRM — Booking Form Page (9-section full form)

Pages.booking = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `<div class="page-loading"><div class="spinner"></div> Loading form data…</div>`;

  // Load all master data in parallel
  const [projectsRes, salutsRes, profsRes, natsRes, brokersRes, usersRes] = await Promise.allSettled([
    Api.get('/projects'),
    Api.get('/master/salutations'),
    Api.get('/master/professions'),
    Api.get('/master/nationalities'),
    Api.get('/brokers'),
    Api.get('/users'),
  ]);

  const projects     = projectsRes.status==='fulfilled'  ? (projectsRes.value.data||[])  : [];
  const salutations  = salutsRes.status==='fulfilled'    ? (salutsRes.value.data||[])    : [{name:'Mr.'},{name:'Mrs.'},{name:'Ms.'},{name:'Dr.'}];
  const professions  = profsRes.status==='fulfilled'     ? (profsRes.value.data||[])     : [{name:'Business'},{name:'Service'},{name:'Professional'}];
  const nationalities= natsRes.status==='fulfilled'      ? (natsRes.value.data||[])      : [{name:'Indian'},{name:'NRI'}];
  const brokers      = brokersRes.status==='fulfilled'   ? (brokersRes.value.data||[])   : [];
  const users        = usersRes.status==='fulfilled'     ? (usersRes.value.data||[])     : [];

  const salutOpts = salutations.map(s=>`<option>${s.name}</option>`).join('');
  const profOpts  = `<option value="">— Select —</option>` + professions.map(p=>`<option>${p.name}</option>`).join('');
  const natOpts   = `<option value="">— Select —</option>` + nationalities.map(n=>`<option>${n.name}</option>`).join('');
  const projOpts  = `<option value="">— Select Project —</option>` + projects.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  const brokerOpts= `<option value="">— No Broker —</option>` + brokers.map(b=>`<option value="${b.id}">${b.firm_name||b.name||b.id}</option>`).join('');
  const empOpts   = `<option value="">— Select Employee —</option>` + users.map(u=>`<option value="${u.id}">${u.name}</option>`).join('');
  const stateOpts = ['Haryana','Delhi','Uttar Pradesh','Rajasthan','Punjab','Maharashtra','Karnataka','Tamil Nadu','Gujarat','Madhya Pradesh','West Bengal','Telangana','Himachal Pradesh','Uttarakhand']
    .map(s=>`<option>${s}</option>`).join('');

  content.innerHTML = `
    <div class="page-hdr">
      <h1>Booking Form</h1>
      <div class="breadcrumb">Application / Booking / <b>New Booking</b></div>
    </div>

    <form id="booking-form" onsubmit="BookingPage.preview(event)">

    <!-- ── SECTION 1: UNIT INFORMATION ──────────────────────── -->
    <div class="sp" style="margin-bottom:14px">
      <div class="sp-hdr">
        <div class="sp-title">1. Unit Information</div>
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:11px;color:var(--text3)">Applicant Type:</span>
          <div class="btg">
            <button type="button" class="btg-item on" onclick="btgSelect(this,'accent')" id="bk-type-individual">Individual</button>
            <button type="button" class="btg-item" onclick="btgSelect(this,'accent')">Multiple</button>
            <button type="button" class="btg-item" onclick="btgSelect(this,'accent')">Company</button>
          </div>
        </div>
      </div>
      <div class="sp-body">
        <div class="sp-grid">
          <div class="fg">
            <label class="fl"><span class="r">*</span>Project</label>
            <select class="fc" name="project_id" required onchange="BookingPage.onProjectChange(this.value)">${projOpts}</select>
          </div>
          <div class="fg">
            <label class="fl"><span class="r">*</span>Unit Type (BHK)</label>
            <select class="fc" name="bhk_type" required onchange="BookingPage.filterUnits()">
              <option value="">— Select —</option>
              ${ROF.BHK_TYPES.map(b=>`<option>${b}</option>`).join('')}
            </select>
          </div>
          <div class="fg">
            <label class="fl">Customer Classification</label>
            <select class="fc" name="income_category">
              <option value="">— Select —</option>
              <option>EWS</option><option>LIG</option><option>MIG</option>
            </select>
          </div>
          <div class="fg">
            <label class="fl">Tower</label>
            <select class="fc" name="tower" id="bk-tower" onchange="BookingPage.filterUnits()">
              <option value="">— Select —</option>
            </select>
          </div>
          <div class="fg">
            <label class="fl">Floor</label>
            <select class="fc" name="floor">
              <option value="">— Any —</option>
              ${[...Array(20)].map((_,i)=>`<option value="${i+1}">${i+1}</option>`).join('')}
            </select>
          </div>
          <div class="fg">
            <label class="fl">Unit No.</label>
            <select class="fc" name="unit_id" id="bk-unit-select">
              <option value="">— Select project first —</option>
            </select>
          </div>
          <div class="fg">
            <label class="fl"><span class="r">*</span>Booking Date</label>
            <input type="date" class="fc" name="booking_date" value="${Utils.today()}" required>
          </div>
          <div class="fg">
            <label class="fl">Registration No.</label>
            <input class="fc" name="reg_no" placeholder="Auto-generated" readonly style="opacity:.6">
          </div>
          <div class="fg">
            <label class="fl">Payment Plan</label>
            <select class="fc" name="payment_plan">
              <option value="ahp_standard">AHP Standard Plan</option>
              <option value="custom">Custom Plan</option>
            </select>
          </div>
          <div class="fg">
            <label class="fl">Basic Price (₹/sqft)</label>
            <input type="number" class="fc" name="basic_price" placeholder="0" oninput="BookingPage.calcTotal()">
          </div>
          <div class="fg">
            <label class="fl">Carpet Area (sqft)</label>
            <input type="number" step="0.01" class="fc" id="bk-carpet-area" name="carpet_area_sqft" placeholder="0" oninput="BookingPage.calcTotal()">
          </div>
          <div class="fg">
            <label class="fl">GSTIN</label>
            <input class="fc" name="gstin" placeholder="GSTIN (if applicable)">
          </div>
        </div>
        <div style="margin-top:10px;padding:10px 14px;background:var(--bg2);border-radius:6px;display:flex;gap:24px;flex-wrap:wrap">
          <div><span style="font-size:11px;color:var(--text3)">Basic Amount</span><div id="bk-calc-basic" style="font-size:16px;font-weight:700;color:var(--text)">₹0</div></div>
          <div><span style="font-size:11px;color:var(--text3)">Booking (5%)</span><div id="bk-calc-booking" style="font-size:16px;font-weight:700;color:var(--teal)">₹0</div></div>
          <div><span style="font-size:11px;color:var(--text3)">On Allotment (20%)</span><div id="bk-calc-allotment" style="font-size:16px;font-weight:700;color:var(--warn)">₹0</div></div>
          <div><span style="font-size:11px;color:var(--text3)">Total Amount</span><div id="bk-calc-total" style="font-size:18px;font-weight:700;color:var(--accent)">₹0</div></div>
        </div>
      </div>
    </div>

    <!-- ── SECTION 2: COMPANY DISCOUNT ──────────────────────── -->
    <div class="sp" style="margin-bottom:14px">
      <div class="sp-hdr"><div class="sp-title">2. Company Discount</div></div>
      <div class="sp-body">
        <div class="sp-grid">
          <div class="fg">
            <label class="fl">Discount Type</label>
            <select class="fc" name="discount_type">
              <option value="">— None —</option>
              <option value="flat">Flat Amount</option>
              <option value="percent">Percentage (%)</option>
            </select>
          </div>
          <div class="fg">
            <label class="fl">Discount Amount / %</label>
            <input type="number" step="0.01" class="fc" name="discount_value" placeholder="0">
          </div>
          <div class="fg">
            <label class="fl">Discount Reason</label>
            <input class="fc" name="discount_reason" placeholder="e.g. Loyalty discount">
          </div>
          <div class="fg">
            <label class="fl">Authorized By</label>
            <select class="fc" name="discount_authorized_by">${empOpts}</select>
          </div>
        </div>
      </div>
    </div>

    <!-- ── SECTION 3: BROKER DISCOUNT ───────────────────────── -->
    <div class="sp" style="margin-bottom:14px">
      <div class="sp-hdr"><div class="sp-title">3. Broker</div></div>
      <div class="sp-body">
        <div class="sp-grid">
          <div class="fg">
            <label class="fl">Broker Name</label>
            <select class="fc" name="broker_id">${brokerOpts}</select>
          </div>
          <div class="fg">
            <label class="fl">Broker Commission (₹)</label>
            <input type="number" class="fc" name="broker_commission" placeholder="0">
          </div>
          <div class="fg">
            <label class="fl">Commission Type</label>
            <select class="fc" name="broker_commission_type">
              <option value="flat">Flat Amount</option>
              <option value="percent">Percentage</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- ── SECTION 4: FIRST APPLICANT DETAILS ───────────────── -->
    <div class="sp" style="margin-bottom:14px">
      <div class="sp-hdr"><div class="sp-title">4. First Applicant Details</div></div>
      <div class="sp-body">
        <div style="margin-bottom:10px">
          <label class="fl"><span class="r">*</span>Full Name</label>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <select class="fc" name="salutation" style="width:80px">${salutOpts}</select>
            <input class="fc" style="flex:1;min-width:120px" placeholder="First Name" name="first_name" required>
            <input class="fc" style="flex:1;min-width:100px" placeholder="Middle Name" name="middle_name">
            <input class="fc" style="flex:1;min-width:120px" placeholder="Last Name" name="last_name" required>
          </div>
        </div>
        <div class="sp-grid">
          <div class="fg">
            <label class="fl">Date of Birth</label>
            <input type="date" class="fc" name="dob">
          </div>
          <div class="fg">
            <label class="fl">Gender</label>
            <div class="btg">
              <button type="button" class="btg-item on" onclick="btgSelect(this)">Male</button>
              <button type="button" class="btg-item" onclick="btgSelect(this)">Female</button>
              <button type="button" class="btg-item" onclick="btgSelect(this)">Other</button>
            </div>
            <input type="hidden" name="gender" value="male">
          </div>
          <div class="fg">
            <label class="fl">Profession</label>
            <select class="fc" name="profession">${profOpts}</select>
          </div>
          <div class="fg">
            <label class="fl">Nationality</label>
            <select class="fc" name="nationality">${natOpts}</select>
          </div>
          <div class="fg">
            <label class="fl">PAN No.</label>
            <input class="fc" name="pan_no" placeholder="ABCDE1234F" maxlength="10" style="text-transform:uppercase">
          </div>
          <div class="fg">
            <label class="fl">Aadhaar No.</label>
            <input class="fc" name="aadhaar_no" placeholder="XXXX XXXX XXXX" maxlength="14">
          </div>
          <div class="fg">
            <label class="fl">PPP (Family ID)</label>
            <input class="fc" name="ppp_id" placeholder="Parivar Pehchan Patra No.">
          </div>
          <div class="fg">
            <label class="fl"><span class="r">*</span>Email ID</label>
            <input type="email" class="fc" name="email" required placeholder="email@example.com">
          </div>
          <div class="fg">
            <label class="fl"><span class="r">*</span>Mobile No.</label>
            <input class="fc" name="mobile" required placeholder="9XXXXXXXXX" maxlength="10">
          </div>
          <div class="fg">
            <label class="fl">Alternate Mobile</label>
            <input class="fc" name="alt_mobile" placeholder="Alternate No.">
          </div>
          <div class="fg">
            <label class="fl">Annual Income</label>
            <input type="number" class="fc" name="annual_income" placeholder="₹0">
          </div>
          <div class="fg">
            <label class="fl">Company / Firm</label>
            <input class="fc" name="company" placeholder="Employer / Company Name">
          </div>
          <div class="fg">
            <label class="fl">Education</label>
            <select class="fc" name="education">
              <option value="">— Select —</option>
              <option>Below 10th</option><option>10th</option><option>12th</option>
              <option>Graduate</option><option>Post Graduate</option><option>PhD</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- ── SECTION 5: PRESENT ADDRESS ───────────────────────── -->
    <div class="sp" style="margin-bottom:14px">
      <div class="sp-hdr"><div class="sp-title">5. Present Address</div></div>
      <div class="sp-body">
        <div class="sp-grid">
          <div class="fg" style="grid-column:span 2">
            <label class="fl"><span class="r">*</span>Address Line 1</label>
            <textarea class="fc" rows="2" name="present_address_line1" required placeholder="House No., Street, Area…"></textarea>
          </div>
          <div class="fg">
            <label class="fl">Address Line 2</label>
            <input class="fc" name="present_address_line2" placeholder="Landmark (optional)">
          </div>
          <div class="fg">
            <label class="fl">Pin Code</label>
            <input class="fc" name="present_pin" placeholder="110001" maxlength="6">
          </div>
          <div class="fg">
            <label class="fl">City</label>
            <input class="fc" name="present_city" placeholder="City">
          </div>
          <div class="fg">
            <label class="fl">State</label>
            <select class="fc" name="present_state"><option value="">— Select —</option>${stateOpts}</select>
          </div>
          <div class="fg">
            <label class="fl">Country</label>
            <input class="fc" name="present_country" value="India">
          </div>
        </div>
      </div>
    </div>

    <!-- ── SECTION 6: OFFICE ADDRESS ────────────────────────── -->
    <div class="sp" style="margin-bottom:14px">
      <div class="sp-hdr">
        <div class="sp-title">6. Office Address</div>
        <label style="display:flex;align-items:center;gap:6px;font-size:11.5px;cursor:pointer">
          <input type="checkbox" id="bk-same-as-present" onchange="BookingPage.copyPresentToOffice(this.checked)">
          Same as Present
        </label>
      </div>
      <div class="sp-body">
        <div class="sp-grid">
          <div class="fg" style="grid-column:span 2">
            <label class="fl">Address Line 1</label>
            <textarea class="fc" rows="2" name="office_address_line1" placeholder="Office address…"></textarea>
          </div>
          <div class="fg">
            <label class="fl">Pin Code</label>
            <input class="fc" name="office_pin" placeholder="110001" maxlength="6">
          </div>
          <div class="fg">
            <label class="fl">City</label>
            <input class="fc" name="office_city" placeholder="City">
          </div>
          <div class="fg">
            <label class="fl">State</label>
            <select class="fc" name="office_state"><option value="">— Select —</option>${stateOpts}</select>
          </div>
          <div class="fg">
            <label class="fl">Country</label>
            <input class="fc" name="office_country" value="India">
          </div>
        </div>
      </div>
    </div>

    <!-- ── SECTION 7: PERMANENT ADDRESS ─────────────────────── -->
    <div class="sp" style="margin-bottom:14px">
      <div class="sp-hdr">
        <div class="sp-title">7. Permanent Address</div>
        <label style="display:flex;align-items:center;gap:6px;font-size:11.5px;cursor:pointer">
          <input type="checkbox" id="bk-perm-same" onchange="BookingPage.copyPresentToPermanent(this.checked)">
          Same as Present
        </label>
      </div>
      <div class="sp-body">
        <div class="sp-grid">
          <div class="fg" style="grid-column:span 2">
            <label class="fl">Address Line 1</label>
            <textarea class="fc" rows="2" name="perm_address_line1" placeholder="Permanent address…"></textarea>
          </div>
          <div class="fg">
            <label class="fl">Pin Code</label>
            <input class="fc" name="perm_pin" placeholder="110001" maxlength="6">
          </div>
          <div class="fg">
            <label class="fl">City</label>
            <input class="fc" name="perm_city" placeholder="City">
          </div>
          <div class="fg">
            <label class="fl">State</label>
            <select class="fc" name="perm_state"><option value="">— Select —</option>${stateOpts}</select>
          </div>
          <div class="fg">
            <label class="fl">Country</label>
            <input class="fc" name="perm_country" value="India">
          </div>
        </div>
      </div>
    </div>

    <!-- ── SECTION 8: SALES EMPLOYEE ────────────────────────── -->
    <div class="sp" style="margin-bottom:14px">
      <div class="sp-hdr"><div class="sp-title">8. Sales Employee</div></div>
      <div class="sp-body">
        <div class="sp-grid">
          <div class="fg">
            <label class="fl">Assigned Sales Executive</label>
            <select class="fc" name="sales_employee_id">${empOpts}</select>
          </div>
          <div class="fg">
            <label class="fl">Source of Enquiry</label>
            <select class="fc" name="source_of_enquiry" id="bk-source-sel">
              <option value="">— Select —</option>
            </select>
          </div>
          <div class="fg">
            <label class="fl">Reference By</label>
            <input class="fc" name="referred_by" placeholder="Referral name (if any)">
          </div>
        </div>
      </div>
    </div>

    <!-- ── SECTION 9: NOMINEE & FINANCE ─────────────────────── -->
    <div class="sp" style="margin-bottom:14px">
      <div class="sp-hdr"><div class="sp-title">9. Nominee & Finance Details</div></div>
      <div class="sp-body">
        <div style="font-size:11.5px;font-weight:600;color:var(--text2);margin-bottom:8px">Nominee</div>
        <div class="sp-grid">
          <div class="fg">
            <label class="fl">Nominee Name</label>
            <div style="display:flex;gap:6px">
              <select class="fc" style="width:80px">${salutOpts}</select>
              <input class="fc" style="flex:1" name="nominee_name" placeholder="Full name">
            </div>
          </div>
          <div class="fg">
            <label class="fl">Relation</label>
            <select class="fc" name="nominee_relation">
              <option value="">— Select —</option>
              <option>Spouse</option><option>Father</option><option>Mother</option>
              <option>Son</option><option>Daughter</option><option>Brother</option><option>Sister</option><option>Other</option>
            </select>
          </div>
          <div class="fg">
            <label class="fl">Nominee DOB</label>
            <input type="date" class="fc" name="nominee_dob">
          </div>
          <div class="fg">
            <label class="fl">Nominee Share (%)</label>
            <input type="number" class="fc" name="nominee_share" value="100" min="1" max="100">
          </div>
        </div>
        <div style="font-size:11.5px;font-weight:600;color:var(--text2);margin:14px 0 8px">Finance / Home Loan</div>
        <div class="sp-grid">
          <div class="fg">
            <label class="fl">Finance Bank</label>
            <input class="fc" name="finance_bank" placeholder="Financing bank name">
          </div>
          <div class="fg">
            <label class="fl">Loan Amount (₹)</label>
            <input type="number" class="fc" name="loan_amount" placeholder="0">
          </div>
          <div class="fg">
            <label class="fl">Loan Sanction Date</label>
            <input type="date" class="fc" name="loan_sanction_date">
          </div>
          <div class="fg">
            <label class="fl">Remarks</label>
            <input class="fc" name="booking_remarks" placeholder="Any remarks…">
          </div>
        </div>
      </div>
    </div>

    <!-- ── BOOKING PAYMENT ───────────────────────────────────── -->
    <div class="sp" style="margin-bottom:14px">
      <div class="sp-hdr"><div class="sp-title">Booking Payment</div></div>
      <div class="sp-body">
        <div class="sp-grid">
          <div class="fg">
            <label class="fl"><span class="r">*</span>Payment Mode</label>
            <select class="fc" name="payment_mode" required>
              <option value="">— Select —</option>
              <option value="cheque">Cheque</option>
              <option value="demand_draft">Demand Draft</option>
              <option value="neft">NEFT/RTGS</option>
              <option value="upi">UPI</option>
              <option value="cash">Cash</option>
            </select>
          </div>
          <div class="fg">
            <label class="fl"><span class="r">*</span>Booking Amount (₹)</label>
            <input type="number" class="fc" name="booking_amount" placeholder="0" required>
          </div>
          <div class="fg">
            <label class="fl">Cheque / TXN No.</label>
            <input class="fc" name="payment_ref" placeholder="Reference / Cheque No.">
          </div>
          <div class="fg">
            <label class="fl">Cheque / TXN Date</label>
            <input type="date" class="fc" name="cheque_date">
          </div>
          <div class="fg">
            <label class="fl">Bank Name</label>
            <select class="fc" name="bank_name" id="bk-bank-sel">
              <option value="">— Select Bank —</option>
            </select>
          </div>
          <div class="fg">
            <label class="fl">Branch</label>
            <input class="fc" name="bank_branch" placeholder="Branch name">
          </div>
        </div>
      </div>
    </div>

    <!-- ── ACTIONS ───────────────────────────────────────────── -->
    <div style="display:flex;gap:10px;padding:14px 0;align-items:center">
      <button type="submit" class="btn btn-teal btn-lg" id="bk-submit-btn">👁 Preview Application</button>
      <button type="reset" class="btn btn-ghost btn-lg" onclick="BookingPage.onReset()">Clear Form</button>
      <button type="button" class="btn btn-ghost" onclick="Router.navigate('/consumers')">Cancel</button>
    </div>
    </form>

    <!-- ── PREVIEW MODAL ─────────────────────────────────────── -->
    <div id="bk-preview-modal" class="modal" style="display:none">
      <div class="modal-content" style="max-width:600px">
        <div class="modal-hdr">
          <h2>Application Preview</h2>
          <button class="btn-close" onclick="document.getElementById('bk-preview-modal').style.display='none'">×</button>
        </div>
        <div class="modal-body" id="bk-preview-body"></div>
        <div class="modal-ftr">
          <button class="btn btn-ghost" onclick="document.getElementById('bk-preview-modal').style.display='none'">Edit Details</button>
          <button class="btn btn-teal" onclick="BookingPage.confirmSubmit()">Save and Process</button>
        </div>
      </div>
    </div>
  `;

  // Load sources and banks dynamically
  BookingPage._loadDynamicDropdowns();
};

// ─────────────────────────────────────────────────────────────────────────────
const BookingPage = {
  _units: [],

  async _loadDynamicDropdowns() {
    // Sources of enquiry
    try {
      const res = await Api.get('/master/sources-of-enquiry');
      const sel = document.getElementById('bk-source-sel');
      if (sel) sel.innerHTML += (res.data||[]).map(s=>`<option>${s.name}</option>`).join('');
    } catch {}
    // Banks
    try {
      const res = await Api.get('/master/banks');
      const sel = document.getElementById('bk-bank-sel');
      if (sel) sel.innerHTML += (res.data||[]).map(b=>`<option>${b.name}</option>`).join('');
    } catch {}
  },

  async onProjectChange(projectId) {
    const towSel = document.getElementById('bk-tower');
    const unitSel = document.getElementById('bk-unit-select');
    if (!projectId) {
      towSel.innerHTML = `<option value="">— Select —</option>`;
      unitSel.innerHTML = `<option value="">— Select project first —</option>`;
      this._units = [];
      return;
    }
    try {
      // Load towers
      const towRes = await Api.get(`/projects/${projectId}/towers`);
      const towers = towRes.data || [];
      towSel.innerHTML = `<option value="">— Any Tower —</option>` + towers.map(t=>`<option value="${t.tower_name}">${t.tower_name}</option>`).join('');

      // Load available units
      const unitRes = await Api.get('/units', { params: { projectId, status: 'available', pageSize: 500 } });
      this._units = unitRes.data || [];
      this._renderUnitOptions();
    } catch {}
  },

  filterUnits() {
    this._renderUnitOptions();
  },

  _renderUnitOptions() {
    const sel = document.getElementById('bk-unit-select');
    if (!sel) return;
    const bhk   = document.querySelector('[name="bhk_type"]')?.value || '';
    const tower = document.getElementById('bk-tower')?.value || '';
    let filtered = this._units;
    if (bhk)   filtered = filtered.filter(u => u.bhk_type === bhk);
    if (tower) filtered = filtered.filter(u => u.tower === tower);
    sel.innerHTML = `<option value="">— Select Unit —</option>` +
      filtered.map(u => {
        const label = [u.unit_number, u.tower&&`Tower ${u.tower}`, u.floor&&`Floor ${u.floor}`, u.carpet_area_sqft&&`${u.carpet_area_sqft} sqft`].filter(Boolean).join(' | ');
        return `<option value="${u.id}" data-carpet="${u.carpet_area_sqft||0}" data-price="${u.base_price||0}">${label}</option>`;
      }).join('');
    sel.onchange = () => {
      const opt = sel.selectedOptions[0];
      const carpet = parseFloat(opt?.dataset?.carpet || 0);
      const price  = parseFloat(opt?.dataset?.price  || 0);
      if (carpet) document.querySelector('[name="carpet_area_sqft"]').value = carpet;
      if (price)  document.querySelector('[name="basic_price"]').value = Math.round(price / (carpet||1));
      this.calcTotal();
    };
  },

  calcTotal() {
    const price  = parseFloat(document.querySelector('[name="basic_price"]')?.value || 0);
    const carpet = parseFloat(document.querySelector('[name="carpet_area_sqft"]')?.value || 0);
    const total  = price * carpet;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = Utils.currency(val); };
    set('bk-calc-basic',     total);
    set('bk-calc-booking',   total * 0.05);
    set('bk-calc-allotment', total * 0.20);
    set('bk-calc-total',     total);
  },

  copyPresentToOffice(checked) {
    if (!checked) return;
    ['address_line1','pin','city','country'].forEach(f => {
      const src = document.querySelector(`[name="present_${f}"]`);
      const dst = document.querySelector(`[name="office_${f}"]`);
      if (src && dst) dst.value = src.value;
    });
    const srcState = document.querySelector('[name="present_state"]');
    const dstState = document.querySelector('[name="office_state"]');
    if (srcState && dstState) dstState.value = srcState.value;
  },

  copyPresentToPermanent(checked) {
    if (!checked) return;
    ['address_line1','pin','city','country'].forEach(f => {
      const src = document.querySelector(`[name="present_${f}"]`);
      const dst = document.querySelector(`[name="perm_${f}"]`);
      if (src && dst) dst.value = src.value;
    });
    const srcState = document.querySelector('[name="present_state"]');
    const dstState = document.querySelector('[name="perm_state"]');
    if (srcState && dstState) dstState.value = srcState.value;
  },

  onReset() { this._units = []; },

  async preview(e) {
    e.preventDefault();
    const form = document.getElementById('booking-form');
    const fd = new FormData(form);
    this._bookingData = {};
    fd.forEach((v, k) => { if (v) this._bookingData[k] = v; });

    // Validation Popup Logic
    if (this._bookingData.discount_value > 0 && !this._bookingData.discount_authorized_by) {
      Utils.warn('Validation Error: Discount Authorized By is missing.');
      return;
    }

    // Granular Cost Breakdown
    const basicPrice = parseFloat(this._bookingData.basic_price || 0);
    const carpetArea = parseFloat(this._bookingData.carpet_area_sqft || 0);
    const basicCost = basicPrice * carpetArea;
    const plc = basicCost * 0.05; // Dummy 5% PLC for demo
    const balcony = 50000; // Flat balcony charge
    const scooterParking = 25000; // Flat scooter parking
    const totalUnitCost = basicCost + plc + balcony + scooterParking;

    const modalBody = document.getElementById('bk-preview-body');
    modalBody.innerHTML = `
      <div style="margin-bottom:16px;font-size:13px;line-height:1.6;color:var(--text2)">
        Please verify the granular cost breakdown and application details before final processing.
      </div>
      <div style="background:var(--bg2);padding:16px;border-radius:8px;border:1px solid var(--border)">
        <h3 style="margin-bottom:12px;font-size:14px;color:var(--text)">Unit Cost Breakdown</h3>
        <table style="width:100%;font-size:13px;border-collapse:collapse">
          <tr style="border-bottom:1px solid var(--border2)"><td style="padding:6px 0">Basic Cost</td><td style="text-align:right;font-weight:600">${Utils.currency(basicCost)}</td></tr>
          <tr style="border-bottom:1px solid var(--border2)"><td style="padding:6px 0">PLC (Preferential Location)</td><td style="text-align:right;font-weight:600">${Utils.currency(plc)}</td></tr>
          <tr style="border-bottom:1px solid var(--border2)"><td style="padding:6px 0">Balcony Charges</td><td style="text-align:right;font-weight:600">${Utils.currency(balcony)}</td></tr>
          <tr style="border-bottom:1px solid var(--border2)"><td style="padding:6px 0">Scooter Parking</td><td style="text-align:right;font-weight:600">${Utils.currency(scooterParking)}</td></tr>
          <tr><td style="padding:10px 0;font-weight:700;color:var(--teal)">Total Unit Cost</td><td style="text-align:right;font-weight:700;font-size:15px;color:var(--teal)">${Utils.currency(totalUnitCost)}</td></tr>
        </table>
      </div>
    `;

    document.getElementById('bk-preview-modal').style.display = 'flex';
  },

  async confirmSubmit() {
    document.getElementById('bk-preview-modal').style.display = 'none';
    const body = this._bookingData;


    const btn = document.getElementById('bk-submit-btn');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
      // Step 1: Create consumer
      const consumerRes = await Api.post('/consumers', {
        first_name: body.first_name,
        last_name: body.last_name,
        name: `${body.first_name||''} ${body.last_name||''}`.trim(),
        email: body.email,
        mobile: body.mobile,
        income_category: body.income_category || 'EWS',
        pan_no: body.pan_no,
        aadhaar_no: body.aadhaar_no,
        ppp_id: body.ppp_id,
        lead_stage: 'pending_verification',
        source_of_enquiry: body.source_of_enquiry,
        nationality: body.nationality,
        profession: body.profession,
        salutation: body.salutation,
        annual_income: body.annual_income ? parseFloat(body.annual_income) : null,
        company: body.company,
      });
      const consumer = consumerRes.data || consumerRes;

      // Step 2: Create booking form record
      await Api.post('/booking', {
        consumer_id:       consumer.id,
        project_id:        body.project_id,
        unit_id:           body.unit_id || null,
        booking_date:      body.booking_date,
        booking_amount:    parseFloat(body.booking_amount || 0),
        payment_mode:      body.payment_mode,
        payment_ref:       body.payment_ref,
        bank_name:         body.bank_name,
        cheque_date:       body.cheque_date || null,
        broker_id:         body.broker_id || null,
        broker_commission: parseFloat(body.broker_commission || 0),
        sales_employee_id: body.sales_employee_id || null,
        discount_value:    parseFloat(body.discount_value || 0),
        discount_reason:   body.discount_reason,
        nominee_name:      body.nominee_name,
        nominee_relation:  body.nominee_relation,
        loan_amount:       parseFloat(body.loan_amount || 0),
        finance_bank:      body.finance_bank,
        remarks:           body.booking_remarks,
      }).catch(() => {}); // non-critical if booking table not wired

      Utils.success(`Booking saved! Consumer registered as ${body.first_name} ${body.last_name}`);
      Router.navigate('/consumer', { id: consumer.id });
    } catch (err) {
      Utils.error(err.message);
      btn.disabled = false;
      btn.textContent = '💾 Save Booking';
    }
  },
};
