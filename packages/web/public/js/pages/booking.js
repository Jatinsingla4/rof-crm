// ROF CRM — Booking Form Page (9-section full form)

Pages.booking = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `<div class="page-loading"><div class="spinner"></div> Loading form data…</div>`;
  if (typeof BookingPage !== 'undefined') BookingPage._bookingData = null; // a new form never starts from the last booking's snapshot

  // Load all master data in parallel
  const [projectsRes, salutsRes, profsRes, natsRes, brokersRes, usersRes] = await Promise.allSettled([
    window.ProjectCache.load(),
    Api.get('/master/salutations'),
    Api.get('/master/professions'),
    Api.get('/master/nationalities'),
    Api.get('/brokers', { params: { status: 'active', pageSize: 500 } }),
    Api.get('/users/directory'),
  ]);

  const projects     = projectsRes.status==='fulfilled'  ? (projectsRes.value.data||projectsRes.value||[])  : [];
  const salutations  = salutsRes.status==='fulfilled'    ? (salutsRes.value.data||[])    : [{name:'Mr.'},{name:'Mrs.'},{name:'Ms.'},{name:'Dr.'}];
  const professions  = profsRes.status==='fulfilled'     ? (profsRes.value.data||[])     : [{name:'Business'},{name:'Homemaker'},{name:'Other'},{name:'Professional'},{name:'Retired'},{name:'Salaried'},{name:'Self Employed'},{name:'Service'},{name:'Student'}];
  const nationalities= natsRes.status==='fulfilled'      ? (natsRes.value.data||[])      : [{name:'Indian'},{name:'NRI'}];
  const brokers      = brokersRes.status==='fulfilled'   ? (brokersRes.value.data||[])   : [];
  const users        = usersRes.status==='fulfilled'     ? (usersRes.value.data||[])     : [];

  const salutOpts = salutations.map(s=>`<option>${s.name}</option>`).join('');
  const profOpts  = `<option value="">— Select —</option>` + professions.map(p=>`<option>${p.name}</option>`).join('');
  const natOpts   = `<option value="">— Select —</option>` + nationalities.map(n=>`<option>${n.name}</option>`).join('');
  const projOpts  = `<option value="">— Select Project —</option>` + projects.map(p=>`<option value="${p.id}">${Utils.esc(p.name)}</option>`).join('');
  const brokerOpts= `<option value="">— No Broker —</option>` + brokers.map(b=>`<option value="${b.id}">${b.firm_name||b.name||b.id}</option>`).join('');
  const empOpts   = `<option value="">— Select Employee —</option>` + users.map(u=>`<option value="${u.id}">${u.name}</option>`).join('');
  const stateOpts = ['Haryana','Delhi','Uttar Pradesh','Rajasthan','Punjab','Maharashtra','Karnataka','Tamil Nadu','Gujarat','Madhya Pradesh','West Bengal','Telangana','Himachal Pradesh','Uttarakhand']
    .map(s=>`<option>${s}</option>`).join('');

  content.innerHTML = `
    <div class="page-hdr">
      <h1>Booking Form</h1>
      <div class="breadcrumb">Application / Booking / <b>New Booking</b></div>
    </div>

    <style>
      .bkn { max-width:1100px; margin-left:auto; margin-right:auto; counter-reset:bks }
      .bkn > .sp { border-radius:10px; overflow:hidden; margin-bottom:16px !important }
      .bkn .sp-hdr { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; padding:14px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border) }
      .bkn .sp-title { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
      .bkn > .sp > .sp-hdr .sp-title::before { counter-increment:bks; content:counter(bks); display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; margin-right:10px; border-radius:50%; background:var(--surface); color:var(--teal); font-size:11px; font-weight:700; letter-spacing:0 }
      .bkn .sp-body { padding:18px }
      .bkn .sp-grid { gap:16px 18px }
      @media (max-width:900px) { .bkn .sp-grid { grid-template-columns:repeat(2,minmax(0,1fr)) !important } }
      @media (max-width:640px) { .bkn .sp-grid { grid-template-columns:minmax(0,1fr) !important } }
      .bkn .fg, #bk-addl-modal-overlay .fg { gap:6px }
      .bkn .fl, #bk-addl-modal-overlay .fl { font-size:11px; font-weight:500; text-transform:none; letter-spacing:.3px; color:var(--text2) }
      .bkn .fc, #bk-addl-modal-overlay .fc { padding:9px 12px; font-size:13px; border-radius:8px; min-height:38px }
      .bkn .fc:focus, #bk-addl-modal-overlay .fc:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg) }
      .bkn .btg { border-radius:8px }
      .bkn .btg-item { padding:7px 14px; font-size:12px }
      .bkn .btn-lg { padding:10px 26px; font-size:13px; border-radius:8px }
      #bk-addl-modal-overlay .modal { border-radius:14px; border:1px solid var(--border2); box-shadow:0 20px 60px rgba(0,0,0,.4) }
    </style>
    <form id="booking-form" class="bkn" data-warn-unsaved onsubmit="BookingPage.preview(event)">

    <!-- ── SECTION 1: UNIT INFORMATION ──────────────────────── -->
    <div class="sp" style="margin-bottom:14px">
      <div class="sp-hdr">
        <div class="sp-title">Unit Information</div>
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:11px;color:var(--text3)">Applicant Type:</span>
          <div class="btg">
            <button type="button" class="btg-item on" onclick="BookingPage.setApplicantType('individual')" id="bk-type-individual">Individual</button>
            <button type="button" class="btg-item" onclick="BookingPage.setApplicantType('multiple')" id="bk-type-multiple">Multiple</button>
            <button type="button" class="btg-item" onclick="BookingPage.setApplicantType('company')" id="bk-type-company">Company</button>
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
              <option value="any">Any</option>
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
            <select class="fc" name="floor" id="bk-floor" onchange="BookingPage.filterUnits()">
              <option value="">— Any —</option>
            </select>
          </div>
          <div class="fg">
            <label class="fl"><span class="r">*</span>Unit No.</label>
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
            <label class="fl">Form No.</label>
            <input class="fc" name="form_no" id="bk-form-no" placeholder="e.g. F-2026-001" maxlength="100"
              onblur="BookingPage._checkFormNo()">
            <span id="bk-form-no-err" style="color:#dc3545;font-size:11px;display:none"></span>
          </div>
          <div class="fg">
            <label class="fl"><span class="r">*</span>Payment Plan</label>
            <select class="fc" name="payment_plan" id="bk-payment-plan">
              <option value="">— Select Plan —</option>
            </select>
          </div>
          <div class="fg">
            <label class="fl">Basic Price (₹/sqft)</label>
            <input type="number" step="any" class="fc" name="basic_price" placeholder="0">
          </div>
          <div class="fg">
            <label class="fl">Carpet Area (sqft)</label>
            <input type="number" step="any" class="fc" id="bk-carpet-area" name="carpet_area_sqft" placeholder="0">
          </div>
          <div class="fg">
            <label class="fl">GSTIN</label>
            <input class="fc" name="gstin" placeholder="GSTIN (if applicable)">
          </div>
        </div>
      </div>
    </div>

    <!-- ── SECTION 2: COMPANY DISCOUNT ──────────────────────── -->
    <div class="sp" style="margin-bottom:14px">
      <div class="sp-hdr"><div class="sp-title">Company Discount</div></div>
      <div class="sp-body">
        <div class="sp-grid" style="grid-template-columns:repeat(5,1fr)">
          <div class="fg">
            <label class="fl">Inaugural Discount (₹)</label>
            <input type="number" step="0.01" class="fc" name="company_inaugural_disc" placeholder="0"
              oninput="BookingPage.updateInauguralPerSqft()">
          </div>
          <div class="fg">
            <label class="fl">Inaugural Disc / Sqft</label>
            <input type="number" step="0.0001" class="fc" name="company_inaugural_disc_sqft" placeholder="0" readonly>
          </div>
          <div class="fg">
            <label class="fl">Rebate (₹)</label>
            <input type="number" step="0.01" class="fc" name="company_rebate_rs" placeholder="0">
          </div>
          <div class="fg">
            <label class="fl">Rebate / Sqft</label>
            <input type="number" step="0.0001" class="fc" name="company_rebate_sqft" placeholder="0">
          </div>
          <div class="fg">
            <label class="fl">Rebate (%)</label>
            <input type="number" step="0.01" class="fc" name="company_rebate_pct" placeholder="0">
          </div>
          <div class="fg" style="grid-column:1/-1;font-size:11px;color:var(--text2)">
            Use only one rebate box (₹, per sq. ft. or %). A rebate is a request: it changes the price only after another authorised user approves it.
          </div>
        </div>
      </div>
    </div>

    <!-- ── SECTION 3: BROKER ────────────────────────────────── -->
    <div class="sp" style="margin-bottom:14px">
      <div class="sp-hdr"><div class="sp-title">Broker</div></div>
      <div class="sp-body">

        <!-- Sale Type toggle -->
        <div style="margin-bottom:14px">
          <label class="fl" style="margin-bottom:6px">SALE TYPE</label>
          <div class="btg">
            <button type="button" class="btg-item on" id="btn-sale-broker" onclick="BookingPage.setSaleType('broker')">Broker</button>
            <button type="button" class="btg-item" id="btn-sale-direct" onclick="BookingPage.setSaleType('direct')">Direct</button>
          </div>
          <input type="hidden" name="booking_type" id="bk-booking-type" value="broker">
        </div>

        <!-- Broker fields (hidden when Direct is selected) -->
        <div id="bk-broker-fields">
          <div class="sp-grid" style="grid-template-columns:repeat(2,1fr)">
            <div class="fg">
              <label class="fl">Broker Name</label>
              <select class="fc" name="broker_id" id="bk-broker-id">${brokerOpts}</select>
            </div>
            <div class="fg">
              <label class="fl">Main Broker</label>
              <select class="fc" name="main_broker_id" id="bk-main-broker-id">${brokerOpts.replace('— No Broker —','— Select Main Broker —')}</select>
            </div>
          </div>
          <div class="sp-grid" style="grid-template-columns:repeat(2,1fr);margin-top:10px">
            <div class="fg">
              <label class="fl">Broker Commission (₹)</label>
              <input type="number" class="fc" name="broker_commission" id="bk-broker-commission" value="0" min="0">
            </div>
            <div class="fg">
              <label class="fl">Commission Type</label>
              <select class="fc" name="broker_commission_type" id="bk-broker-commission-type">
                <option value="flat">Flat Amount</option>
                <option value="percent">Percentage</option>
              </select>
            </div>
          </div>

          <!-- Broker Discount subsection -->
          <div style="margin-top:14px;padding-top:10px;border-top:1px solid var(--border)">
            <div class="sp-title" style="font-size:12px;margin-bottom:8px;color:var(--text2)">BROKER DISCOUNT</div>
            <div class="sp-grid" style="grid-template-columns:repeat(3,1fr)">
              <div class="fg">
                <label class="fl">Rebate (Rs.)</label>
                <input type="number" class="fc" name="broker_rebate_rs" id="bk-broker-rebate-rs" value="0" min="0">
              </div>
              <div class="fg">
                <label class="fl">Per Sq.Ft (Rs.)</label>
                <input type="number" class="fc" name="broker_rebate_sqft" id="bk-broker-rebate-sqft" value="0" min="0">
              </div>
              <div class="fg">
                <label class="fl">In (%)</label>
                <input type="number" class="fc" name="broker_rebate_pct" id="bk-broker-rebate-pct" value="0" min="0" max="100" step="0.01">
              </div>
            </div>
          </div>
        </div>
        <!-- end bk-broker-fields -->

      </div>
    </div>

    <!-- ── SECTION 4: FIRST APPLICANT DETAILS ───────────────── -->
    <div class="sp" style="margin-bottom:14px">
      <div class="sp-hdr"><div class="sp-title">First Applicant Details</div></div>
      <div class="sp-body">

        <!-- Individual fields (shown for Individual + Multiple, hidden for Company) -->
        <div id="bk-indiv-fields">
          <div style="display:flex;gap:16px;align-items:flex-start">

            <!-- ── form fields ── -->
            <div style="flex:1;min-width:0">

              <!-- Full Name + S/O row -->
              <div style="margin-bottom:10px">
                <label class="fl"><span class="r">*</span>Full Name &amp; S/O</label>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                  <select class="fc" name="salutation" style="width:80px">${salutOpts}</select>
                  <input class="fc" style="flex:1;min-width:110px" placeholder="First Name" name="first_name" required>
                  <input class="fc" style="flex:1;min-width:90px"  placeholder="Middle Name" name="middle_name">
                  <input class="fc" style="flex:1;min-width:110px" placeholder="Last Name" name="last_name" required>
                  <input class="fc" style="flex:1;min-width:90px"  placeholder="S/O (Father's Name)" name="father_name">
                </div>
              </div>

              <!-- Row A: DOB + Anniversary Date (2 equal columns) -->
              <div class="sp-grid" style="grid-template-columns:repeat(2,1fr)">
                <div class="fg">
                  <label class="fl">Date of Birth</label>
                  <input type="date" class="fc" name="dob">
                </div>
                <div class="fg">
                  <label class="fl">Anniversary Date</label>
                  <input type="date" class="fc" name="anniversary_date">
                </div>
              </div>

              <!-- Row B: Gender + Marital Status (2 equal columns, each gets half width) -->
              <div class="sp-grid" style="grid-template-columns:repeat(2,1fr);margin-top:9px">
                <div class="fg">
                  <label class="fl">Gender</label>
                  <div class="btg">
                    <button type="button" class="btg-item on" id="bk-gender-male"
                      onclick="BookingPage.setToggleValue('gender','male',['bk-gender-male','bk-gender-female','bk-gender-trans'])">Male</button>
                    <button type="button" class="btg-item" id="bk-gender-female"
                      onclick="BookingPage.setToggleValue('gender','female',['bk-gender-male','bk-gender-female','bk-gender-trans'])">Female</button>
                    <button type="button" class="btg-item" id="bk-gender-trans"
                      onclick="BookingPage.setToggleValue('gender','transgender',['bk-gender-male','bk-gender-female','bk-gender-trans'])">Transgender</button>
                  </div>
                  <input type="hidden" id="bk-gender" name="gender" value="male">
                </div>
                <div class="fg">
                  <label class="fl">Marital Status</label>
                  <div class="btg">
                    <button type="button" class="btg-item" id="bk-marital-married"
                      onclick="BookingPage.setToggleValue('marital_status','married',['bk-marital-married','bk-marital-unmarried','bk-marital-ns'])">Married</button>
                    <button type="button" class="btg-item" id="bk-marital-unmarried"
                      onclick="BookingPage.setToggleValue('marital_status','unmarried',['bk-marital-married','bk-marital-unmarried','bk-marital-ns'])">UnMarried</button>
                    <button type="button" class="btg-item on" id="bk-marital-ns"
                      onclick="BookingPage.setToggleValue('marital_status','not_specified',['bk-marital-married','bk-marital-unmarried','bk-marital-ns'])">Not Specified</button>
                  </div>
                  <input type="hidden" id="bk-marital-status" name="marital_status" value="not_specified">
                </div>
              </div>

              <!-- Row C: Profession + PAN + Aadhaar + Passport (4 equal columns) -->
              <div class="sp-grid" style="grid-template-columns:repeat(4,1fr);margin-top:9px">
                <div class="fg">
                  <label class="fl">Profession</label>
                  <select class="fc" name="profession">${profOpts}</select>
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
                  <label class="fl">Passport No.</label>
                  <input class="fc" name="passport_no" placeholder="A1234567" maxlength="20">
                </div>
              </div>

              <!-- Row D: Nationality toggle — full row, all 4 buttons visible -->
              <div style="margin-top:9px">
                <div class="fg">
                  <label class="fl">Nationality</label>
                  <div class="btg">
                    <button type="button" class="btg-item on" id="bk-nat-resident"
                      onclick="BookingPage.setToggleValue('nationality','resident',['bk-nat-resident','bk-nat-pio','bk-nat-nri','bk-nat-oci'])">Resident</button>
                    <button type="button" class="btg-item" id="bk-nat-pio"
                      onclick="BookingPage.setToggleValue('nationality','pio',['bk-nat-resident','bk-nat-pio','bk-nat-nri','bk-nat-oci'])">PIO</button>
                    <button type="button" class="btg-item" id="bk-nat-nri"
                      onclick="BookingPage.setToggleValue('nationality','nri',['bk-nat-resident','bk-nat-pio','bk-nat-nri','bk-nat-oci'])">NRI</button>
                    <button type="button" class="btg-item" id="bk-nat-oci"
                      onclick="BookingPage.setToggleValue('nationality','oci',['bk-nat-resident','bk-nat-pio','bk-nat-nri','bk-nat-oci'])">OCI</button>
                  </div>
                  <input type="hidden" id="bk-nationality" name="nationality" value="resident">
                </div>
              </div>

              <!-- Row: Email, Email-2, Mobile, Designation, No. of Children, Company -->
              <div class="sp-grid" style="margin-top:9px">
                <div class="fg">
                  <label class="fl"><span class="r">*</span>Email ID</label>
                  <input type="email" class="fc" name="email" required placeholder="email@example.com">
                </div>
                <div class="fg">
                  <label class="fl">Email Id-2</label>
                  <input type="email" class="fc" name="email_2" placeholder="alternate@example.com">
                </div>
                <div class="fg">
                  <label class="fl"><span class="r">*</span>Mobile No.</label>
                  <input class="fc" name="mobile" required placeholder="9XXXXXXXXX" maxlength="10">
                </div>
                <div class="fg">
                  <label class="fl">Designation</label>
                  <input class="fc" name="designation" placeholder="e.g. Manager, Director">
                </div>
                <div class="fg">
                  <label class="fl">No. of Children</label>
                  <input type="number" class="fc" name="no_of_children" value="0" min="0" max="20">
                </div>
                <div class="fg">
                  <label class="fl">Company / Firm</label>
                  <input class="fc" name="company" placeholder="Employer / Company Name">
                </div>
              </div>

              <!-- Hidden fields (kept for payload compatibility) -->
              <input type="hidden" name="ppp_id" value="">
              <input type="hidden" name="alt_mobile" value="">
              <input type="hidden" name="annual_income" value="">
              <input type="hidden" name="education" value="">

              <!-- Power of Attorney -->
              <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border)">
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">
                  <input type="checkbox" id="bk-has-poa" onchange="BookingPage.togglePoa(this.checked)">
                  <span style="font-weight:500">Power of Attorney</span>
                </label>
                <input type="hidden" name="has_poa" id="bk-has-poa-hidden" value="false">
                <div id="bk-poa-details" style="display:none;margin-top:8px">
                  <label class="fl">POA Holder Details</label>
                  <textarea class="fc" rows="2" name="poa_details" placeholder="Enter POA holder name and details…"></textarea>
                </div>
              </div>

            </div><!-- end form fields -->

            <!-- ── Photo widget ── -->
            <div style="width:110px;flex-shrink:0;text-align:center">
              <label class="fl" style="display:block;text-align:center;margin-bottom:6px">Photo</label>
              <div id="bk-photo-preview"
                style="width:100px;height:120px;border:2px dashed var(--border);border-radius:8px;overflow:hidden;margin:0 auto 6px;display:flex;align-items:center;justify-content:center;background:var(--surface2);cursor:pointer"
                onclick="document.getElementById('bk-photo-file').click()">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="1.5">
                  <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                </svg>
              </div>
              <input type="file" id="bk-photo-file" accept="image/jpeg,image/jpg,image/png,image/gif"
                style="display:none" onchange="BookingPage.onPhotoSelected(this)">
              <button type="button" class="btn btn-sm"
                style="font-size:11px;padding:4px 8px;width:100%"
                onclick="document.getElementById('bk-photo-file').click()">Choose Photo</button>
              <div id="bk-photo-error" style="color:var(--danger,#e74c3c);font-size:10px;margin-top:4px;line-height:1.3"></div>
            </div>

          </div><!-- end outer flex -->
        </div><!-- end #bk-indiv-fields -->

        <!-- Company fields (shown only for Company type) -->
        <div id="bk-company-fields" style="display:none">
          <div class="sp-grid">
            <div class="fg">
              <label class="fl"><span class="r">*</span>Company Name</label>
              <input class="fc" name="company_name" placeholder="Registered company name">
            </div>
            <div class="fg">
              <label class="fl">Company Registration No.</label>
              <input class="fc" name="company_reg_no" placeholder="CIN / Registration No.">
            </div>
            <div class="fg">
              <label class="fl">GSTIN</label>
              <input class="fc" name="company_gstin" placeholder="GST Identification No." maxlength="15">
            </div>
            <div class="fg">
              <label class="fl"><span class="r">*</span>Authorized Person Name</label>
              <input class="fc" name="authorized_person" placeholder="Full name of authorized signatory">
            </div>
            <div class="fg">
              <label class="fl">Designation</label>
              <input class="fc" name="authorized_designation" placeholder="e.g. Director, MD">
            </div>
            <div class="fg">
              <label class="fl"><span class="r">*</span>Email ID</label>
              <input type="email" class="fc" name="email" placeholder="company@example.com">
            </div>
            <div class="fg">
              <label class="fl"><span class="r">*</span>Mobile No.</label>
              <input class="fc" name="mobile" placeholder="9XXXXXXXXX" maxlength="10">
            </div>
          </div>
        </div><!-- end #bk-company-fields -->

      </div>
    </div>

    <!-- ── SECTION 5: FIRST APPLICANT ADDRESS ───────────────── -->
    <div class="sp" style="margin-bottom:14px">
      <div class="sp-hdr"><div class="sp-title">First Applicant Address</div></div>
      <div class="sp-body" style="padding-bottom:4px">

        <!-- 5A: Present Address -->
        <div style="margin-bottom:14px">
          <div style="font-size:11.5px;font-weight:700;color:var(--text2);letter-spacing:.04em;margin-bottom:8px;text-transform:uppercase">Present Address</div>
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
              <input type="text" class="fc" name="present_state" placeholder="State / Province / Region" style="display:none" disabled data-state-text>
            </div>
            <div class="fg">
              <label class="fl">Country</label>
              <input class="fc" name="present_country" value="India" oninput="BookingPage._toggleStateForCountry('present_state', this.value)">
            </div>
            <div class="fg">
              <label class="fl">Mobile No.</label>
              <input class="fc" name="present_mobile_no" placeholder="9XXXXXXXXX" maxlength="10">
            </div>
            <div class="fg">
              <label class="fl">Phone No.</label>
              <input class="fc" name="present_phone_no" placeholder="011-XXXXXXXX">
            </div>
            <div class="fg">
              <label class="fl">Fax No.</label>
              <input class="fc" name="present_fax_no" placeholder="011-XXXXXXXX">
            </div>
          </div>
        </div>

        <!-- 5B: Office Address -->
        <div style="margin-bottom:14px;padding-top:12px;border-top:1px solid var(--border2)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div style="font-size:11.5px;font-weight:700;color:var(--text2);letter-spacing:.04em;text-transform:uppercase">Office Address</div>
            <label style="display:flex;align-items:center;gap:6px;font-size:11.5px;cursor:pointer">
              <input type="checkbox" id="bk-same-as-present" onchange="BookingPage.copyPresentToOffice(this.checked)">
              Same as Present
            </label>
          </div>
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
              <input type="text" class="fc" name="office_state" placeholder="State / Province / Region" style="display:none" disabled data-state-text>
            </div>
            <div class="fg">
              <label class="fl">Country</label>
              <input class="fc" name="office_country" value="India" oninput="BookingPage._toggleStateForCountry('office_state', this.value)">
            </div>
            <div class="fg">
              <label class="fl">Mobile No.</label>
              <input class="fc" name="office_mobile_no" placeholder="9XXXXXXXXX" maxlength="10">
            </div>
            <div class="fg">
              <label class="fl">Phone No.</label>
              <input class="fc" name="office_phone_no" placeholder="011-XXXXXXXX">
            </div>
            <div class="fg">
              <label class="fl">Fax No.</label>
              <input class="fc" name="office_fax_no" placeholder="011-XXXXXXXX">
            </div>
          </div>
        </div>

        <!-- 5C: Permanent Address -->
        <div style="margin-bottom:14px;padding-top:12px;border-top:1px solid var(--border2)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div style="font-size:11.5px;font-weight:700;color:var(--text2);letter-spacing:.04em;text-transform:uppercase">Permanent Address</div>
            <label style="display:flex;align-items:center;gap:6px;font-size:11.5px;cursor:pointer">
              <input type="checkbox" id="bk-perm-same" onchange="BookingPage.copyPresentToPermanent(this.checked)">
              Same as Present
            </label>
          </div>
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
              <input type="text" class="fc" name="perm_state" placeholder="State / Province / Region" style="display:none" disabled data-state-text>
            </div>
            <div class="fg">
              <label class="fl">Country</label>
              <input class="fc" name="perm_country" value="India" oninput="BookingPage._toggleStateForCountry('perm_state', this.value)">
            </div>
            <div class="fg">
              <label class="fl">Mobile No.</label>
              <input class="fc" name="perm_mobile_no" placeholder="9XXXXXXXXX" maxlength="10">
            </div>
            <div class="fg">
              <label class="fl">Phone No.</label>
              <input class="fc" name="perm_phone_no" placeholder="011-XXXXXXXX">
            </div>
            <div class="fg">
              <label class="fl">Fax No.</label>
              <input class="fc" name="perm_fax_no" placeholder="011-XXXXXXXX">
            </div>
          </div>
        </div>

        <!-- 5D: Communication Address -->
        <div style="padding-top:12px;border-top:1px solid var(--border2)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div style="font-size:11.5px;font-weight:700;color:var(--text2);letter-spacing:.04em;text-transform:uppercase">Communication Address</div>
            <label style="display:flex;align-items:center;gap:6px;font-size:11.5px;cursor:pointer">
              <input type="checkbox" id="bk-comm-same" onchange="BookingPage.copyPermanentToComm(this.checked)">
              Same as Permanent
            </label>
          </div>
          <div class="sp-grid">
            <div class="fg" style="grid-column:span 2">
              <label class="fl">Address Line 1</label>
              <textarea class="fc" rows="2" name="comm_address_line1" placeholder="Communication address…"></textarea>
            </div>
            <div class="fg">
              <label class="fl">Pin Code</label>
              <input class="fc" name="comm_pin" placeholder="110001" maxlength="6">
            </div>
            <div class="fg">
              <label class="fl">City</label>
              <input class="fc" name="comm_city" placeholder="City">
            </div>
            <div class="fg">
              <label class="fl">State</label>
              <select class="fc" name="comm_state"><option value="">— Select —</option>${stateOpts}</select>
              <input type="text" class="fc" name="comm_state" placeholder="State / Province / Region" style="display:none" disabled data-state-text>
            </div>
            <div class="fg">
              <label class="fl">Country</label>
              <input class="fc" name="comm_country" value="India" oninput="BookingPage._toggleStateForCountry('comm_state', this.value)">
            </div>
            <div class="fg">
              <label class="fl">Mobile No.</label>
              <input class="fc" name="comm_mobile_no" placeholder="9XXXXXXXXX" maxlength="10">
            </div>
            <div class="fg">
              <label class="fl">Phone No.</label>
              <input class="fc" name="comm_phone_no" placeholder="011-XXXXXXXX">
            </div>
            <div class="fg">
              <label class="fl">Fax No.</label>
              <input class="fc" name="comm_fax_no" placeholder="011-XXXXXXXX">
            </div>
          </div>

          <!-- Mailing Address + Communication Mode preferences -->
          <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border);display:flex;gap:32px;flex-wrap:wrap">
            <div>
              <label class="fl" style="margin-bottom:6px">MAILING ADDRESS</label>
              <div class="btg">
                <button type="button" class="btg-item on" id="bk-mail-present"   onclick="BookingPage.setToggleValue('mailing_address_type','present',      ['bk-mail-present','bk-mail-office','bk-mail-permanent','bk-mail-comm'])">Present</button>
                <button type="button" class="btg-item"    id="bk-mail-office"    onclick="BookingPage.setToggleValue('mailing_address_type','office',        ['bk-mail-present','bk-mail-office','bk-mail-permanent','bk-mail-comm'])">Office</button>
                <button type="button" class="btg-item"    id="bk-mail-permanent" onclick="BookingPage.setToggleValue('mailing_address_type','permanent',     ['bk-mail-present','bk-mail-office','bk-mail-permanent','bk-mail-comm'])">Permanent</button>
                <button type="button" class="btg-item"    id="bk-mail-comm"      onclick="BookingPage.setToggleValue('mailing_address_type','communication', ['bk-mail-present','bk-mail-office','bk-mail-permanent','bk-mail-comm'])">Communication</button>
              </div>
              <input type="hidden" name="mailing_address_type" id="bk-mailing-address-type" value="present">
            </div>
            <div>
              <label class="fl" style="margin-bottom:6px">PREFERRED MODE OF COMMUNICATION</label>
              <div class="btg">
                <button type="button" class="btg-item"    id="bk-comm-courier" onclick="BookingPage.setToggleValue('communication_mode','courier',         ['bk-comm-courier','bk-comm-email','bk-comm-sms','bk-comm-none','bk-comm-hand'])">Courier</button>
                <button type="button" class="btg-item on" id="bk-comm-email"   onclick="BookingPage.setToggleValue('communication_mode','email',           ['bk-comm-courier','bk-comm-email','bk-comm-sms','bk-comm-none','bk-comm-hand'])">Email</button>
                <button type="button" class="btg-item"    id="bk-comm-sms"     onclick="BookingPage.setToggleValue('communication_mode','sms',             ['bk-comm-courier','bk-comm-email','bk-comm-sms','bk-comm-none','bk-comm-hand'])">SMS</button>
                <button type="button" class="btg-item"    id="bk-comm-none"    onclick="BookingPage.setToggleValue('communication_mode','no_communication', ['bk-comm-courier','bk-comm-email','bk-comm-sms','bk-comm-none','bk-comm-hand'])">No Communication</button>
                <button type="button" class="btg-item"    id="bk-comm-hand"    onclick="BookingPage.setToggleValue('communication_mode','by_hand',         ['bk-comm-courier','bk-comm-email','bk-comm-sms','bk-comm-none','bk-comm-hand'])">By Hand</button>
              </div>
              <input type="hidden" name="communication_mode" id="bk-communication-mode" value="email">
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- ── SECTION 4B: CO-APPLICANT DETAILS ─────────────────── -->
    <div id="bk-coapplicant-section" class="sp" style="margin-bottom:14px;display:none">
      <div class="sp-hdr"><div class="sp-title">Second Applicant Details</div></div>
      <div class="sp-body">

        <!-- Type toggle: Co Applicant / Nominee -->
        <div style="margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border2)">
          <label class="fl" style="margin-bottom:6px">APPLICANT TYPE</label>
          <div class="btg" id="co-type-toggle">
            <button type="button" class="btg-item on" id="bk-co-type-co"
              onclick="BookingPage.setToggleValue('co_applicant_type','co_applicant',['bk-co-type-co','bk-co-type-nominee'])">Co Applicant</button>
            <button type="button" class="btg-item" id="bk-co-type-nominee"
              onclick="BookingPage.setToggleValue('co_applicant_type','nominee',['bk-co-type-co','bk-co-type-nominee'])">Nominee</button>
          </div>
          <input type="hidden" id="bk-co-applicant-type" name="co_applicant_type" value="co_applicant">
        </div>

        <div style="display:flex;gap:16px;align-items:flex-start">

          <!-- ── form fields ── -->
          <div style="flex:1;min-width:0">

            <!-- Full Name + S/O row -->
            <div style="margin-bottom:10px">
              <label class="fl">Full Name &amp; S/O</label>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                <select class="fc" name="co_salutation" style="width:80px">${salutOpts}</select>
                <input class="fc" style="flex:1;min-width:110px" placeholder="First Name" name="co_first_name">
                <input class="fc" style="flex:1;min-width:90px" placeholder="Middle Name" name="co_middle_name">
                <input class="fc" style="flex:1;min-width:110px" placeholder="Last Name" name="co_last_name">
                <input class="fc" style="flex:1;min-width:90px" placeholder="S/O (Father's Name)" name="co_father_name">
              </div>
            </div>

            <!-- Row A: DOB + Anniversary Date (2 equal columns) -->
            <div class="sp-grid" style="grid-template-columns:repeat(2,1fr)">
              <div class="fg">
                <label class="fl">Date of Birth</label>
                <input type="date" class="fc" name="co_dob">
              </div>
              <div class="fg">
                <label class="fl">Anniversary Date</label>
                <input type="date" class="fc" name="co_anniversary_date">
              </div>
            </div>

            <!-- Row B: Gender + Marital Status (2 equal columns) -->
            <div class="sp-grid" style="grid-template-columns:repeat(2,1fr);margin-top:9px">
              <div class="fg">
                <label class="fl">Gender</label>
                <div class="btg">
                  <button type="button" class="btg-item on" id="bk-co-gender-male"
                    onclick="BookingPage.setToggleValue('co_gender','male',['bk-co-gender-male','bk-co-gender-female','bk-co-gender-trans'])">Male</button>
                  <button type="button" class="btg-item" id="bk-co-gender-female"
                    onclick="BookingPage.setToggleValue('co_gender','female',['bk-co-gender-male','bk-co-gender-female','bk-co-gender-trans'])">Female</button>
                  <button type="button" class="btg-item" id="bk-co-gender-trans"
                    onclick="BookingPage.setToggleValue('co_gender','transgender',['bk-co-gender-male','bk-co-gender-female','bk-co-gender-trans'])">Transgender</button>
                </div>
                <input type="hidden" id="bk-co-gender" name="co_gender" value="male">
              </div>
              <div class="fg">
                <label class="fl">Marital Status</label>
                <div class="btg">
                  <button type="button" class="btg-item" id="bk-co-marital-married"
                    onclick="BookingPage.setToggleValue('co_marital_status','married',['bk-co-marital-married','bk-co-marital-unmarried','bk-co-marital-ns'])">Married</button>
                  <button type="button" class="btg-item" id="bk-co-marital-unmarried"
                    onclick="BookingPage.setToggleValue('co_marital_status','unmarried',['bk-co-marital-married','bk-co-marital-unmarried','bk-co-marital-ns'])">UnMarried</button>
                  <button type="button" class="btg-item on" id="bk-co-marital-ns"
                    onclick="BookingPage.setToggleValue('co_marital_status','not_specified',['bk-co-marital-married','bk-co-marital-unmarried','bk-co-marital-ns'])">Not Specified</button>
                </div>
                <input type="hidden" id="bk-co-marital-status" name="co_marital_status" value="not_specified">
              </div>
            </div>

            <!-- Row C: Profession + PAN + Aadhaar + Passport (4 equal columns) -->
            <div class="sp-grid" style="grid-template-columns:repeat(4,1fr);margin-top:9px">
              <div class="fg">
                <label class="fl">Profession</label>
                <select class="fc" name="co_profession">${profOpts}</select>
              </div>
              <div class="fg">
                <label class="fl">PAN No.</label>
                <input class="fc" name="co_pan_no" placeholder="ABCDE1234F" maxlength="10" style="text-transform:uppercase">
              </div>
              <div class="fg">
                <label class="fl">Aadhaar No.</label>
                <input class="fc" name="co_aadhaar_no" placeholder="XXXX XXXX XXXX" maxlength="14">
              </div>
              <div class="fg">
                <label class="fl">Passport No.</label>
                <input class="fc" name="co_passport_no" placeholder="A1234567" maxlength="20">
              </div>
            </div>

            <!-- Row D: Nationality toggle — full row -->
            <div style="margin-top:9px">
              <div class="fg">
                <label class="fl">Nationality</label>
                <div class="btg">
                  <button type="button" class="btg-item on" id="bk-co-nat-resident"
                    onclick="BookingPage.setToggleValue('co_nationality','resident',['bk-co-nat-resident','bk-co-nat-pio','bk-co-nat-nri','bk-co-nat-oci'])">Resident</button>
                  <button type="button" class="btg-item" id="bk-co-nat-pio"
                    onclick="BookingPage.setToggleValue('co_nationality','pio',['bk-co-nat-resident','bk-co-nat-pio','bk-co-nat-nri','bk-co-nat-oci'])">PIO</button>
                  <button type="button" class="btg-item" id="bk-co-nat-nri"
                    onclick="BookingPage.setToggleValue('co_nationality','nri',['bk-co-nat-resident','bk-co-nat-pio','bk-co-nat-nri','bk-co-nat-oci'])">NRI</button>
                  <button type="button" class="btg-item" id="bk-co-nat-oci"
                    onclick="BookingPage.setToggleValue('co_nationality','oci',['bk-co-nat-resident','bk-co-nat-pio','bk-co-nat-nri','bk-co-nat-oci'])">OCI</button>
                </div>
                <input type="hidden" id="bk-co-nationality" name="co_nationality" value="resident">
              </div>
            </div>

            <!-- Row E: Email + Email-2 + Mobile + Designation + No. of Children -->
            <div class="sp-grid" style="margin-top:9px">
              <div class="fg">
                <label class="fl">Email ID</label>
                <input type="email" class="fc" name="co_email" placeholder="email@example.com">
              </div>
              <div class="fg">
                <label class="fl">Email Id-2</label>
                <input type="email" class="fc" name="co_email_2" placeholder="alternate@example.com">
              </div>
              <div class="fg">
                <label class="fl">Mobile No.</label>
                <input class="fc" name="co_mobile" placeholder="9XXXXXXXXX" maxlength="10">
              </div>
              <div class="fg">
                <label class="fl">Designation</label>
                <input class="fc" name="co_designation" placeholder="e.g. Manager, Director">
              </div>
              <div class="fg">
                <label class="fl">No. of Children</label>
                <input type="number" class="fc" name="co_no_of_children" value="0" min="0" max="20">
              </div>
            </div>

            <!-- Power of Attorney -->
            <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border)">
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">
                <input type="checkbox" id="bk-co-has-poa" onchange="BookingPage.toggleCoPoa(this.checked)">
                <span style="font-weight:500">Power of Attorney</span>
              </label>
              <input type="hidden" name="co_has_poa" id="bk-co-has-poa-hidden" value="false">
              <div id="bk-co-poa-details" style="display:none;margin-top:8px">
                <label class="fl">POA Holder Details</label>
                <textarea class="fc" rows="2" name="co_poa_details" placeholder="Enter POA holder name and details…"></textarea>
              </div>
            </div>

            <!-- Relation to First Applicant (kept at bottom) -->
            <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border)">
              <div class="fg">
                <label class="fl">Relation to First Applicant</label>
                <select class="fc" name="co_relation">
                  <option value="">— Select —</option>
                  <option>Spouse</option><option>Parent</option><option>Child</option><option>Sibling</option><option>Other</option>
                </select>
              </div>
            </div>

            <!-- ── SECOND APPLICANT ADDRESS ── -->
            <div style="margin-top:16px;padding-top:14px;border-top:2px solid var(--border2)">
              <div style="font-size:12px;font-weight:700;color:var(--text2);letter-spacing:.05em;margin-bottom:12px;text-transform:uppercase">Second Applicant Address</div>

              <!-- Co-Present Address -->
              <div style="margin-bottom:14px">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                  <div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase">Present Address</div>
                  <label style="display:flex;align-items:center;gap:5px;font-size:11px;cursor:pointer">
                    <input type="checkbox" id="bk-co-fill-from-first" onchange="BookingPage.fillCoApplicantFromFirst(this.checked)">
                    Fill From First Applicant
                  </label>
                </div>
                <div class="sp-grid">
                  <div class="fg" style="grid-column:span 2">
                    <label class="fl">Address Line 1</label>
                    <textarea class="fc" rows="2" name="co_present_address" placeholder="House No., Street, Area…"></textarea>
                  </div>
                  <div class="fg"><label class="fl">Pin Code</label><input class="fc" name="co_present_pin" placeholder="110001" maxlength="6"></div>
                  <div class="fg"><label class="fl">City</label><input class="fc" name="co_present_city" placeholder="City"></div>
                  <div class="fg"><label class="fl">State</label><select class="fc" name="co_present_state"><option value="">— Select —</option>${stateOpts}</select><input type="text" class="fc" name="co_present_state" placeholder="State / Province / Region" style="display:none" disabled data-state-text></div>
                  <div class="fg"><label class="fl">Country</label><input class="fc" name="co_present_country" value="India" oninput="BookingPage._toggleStateForCountry('co_present_state', this.value)"></div>
                  <div class="fg"><label class="fl">Mobile No.</label><input class="fc" name="co_present_mobile_no" placeholder="9XXXXXXXXX" maxlength="10"></div>
                  <div class="fg"><label class="fl">Phone No.</label><input class="fc" name="co_present_phone_no" placeholder="011-XXXXXXXX"></div>
                  <div class="fg"><label class="fl">Fax No.</label><input class="fc" name="co_present_fax_no" placeholder="011-XXXXXXXX"></div>
                </div>
              </div>

              <!-- Co-Office Address -->
              <div style="margin-bottom:14px;padding-top:10px;border-top:1px solid var(--border2)">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                  <div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase">Office Address</div>
                  <label style="display:flex;align-items:center;gap:5px;font-size:11px;cursor:pointer">
                    <input type="checkbox" id="bk-co-office-same" onchange="BookingPage.copyCoApplicantPresentToOffice(this.checked)">
                    Same as Co-Applicant Present
                  </label>
                </div>
                <div class="sp-grid">
                  <div class="fg" style="grid-column:span 2">
                    <label class="fl">Address Line 1</label>
                    <textarea class="fc" rows="2" name="co_office_address" placeholder="Office address…"></textarea>
                  </div>
                  <div class="fg"><label class="fl">Pin Code</label><input class="fc" name="co_office_pin" placeholder="110001" maxlength="6"></div>
                  <div class="fg"><label class="fl">City</label><input class="fc" name="co_office_city" placeholder="City"></div>
                  <div class="fg"><label class="fl">State</label><select class="fc" name="co_office_state"><option value="">— Select —</option>${stateOpts}</select><input type="text" class="fc" name="co_office_state" placeholder="State / Province / Region" style="display:none" disabled data-state-text></div>
                  <div class="fg"><label class="fl">Country</label><input class="fc" name="co_office_country" value="India" oninput="BookingPage._toggleStateForCountry('co_office_state', this.value)"></div>
                  <div class="fg"><label class="fl">Mobile No.</label><input class="fc" name="co_office_mobile_no" placeholder="9XXXXXXXXX" maxlength="10"></div>
                  <div class="fg"><label class="fl">Phone No.</label><input class="fc" name="co_office_phone_no" placeholder="011-XXXXXXXX"></div>
                  <div class="fg"><label class="fl">Fax No.</label><input class="fc" name="co_office_fax_no" placeholder="011-XXXXXXXX"></div>
                </div>
              </div>

              <!-- Co-Permanent Address -->
              <div style="margin-bottom:14px;padding-top:10px;border-top:1px solid var(--border2)">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                  <div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase">Permanent Address</div>
                  <label style="display:flex;align-items:center;gap:5px;font-size:11px;cursor:pointer">
                    <input type="checkbox" id="bk-co-perm-same" onchange="BookingPage.copyCoApplicantPresentToPermanent(this.checked)">
                    Same as Co-Applicant Present
                  </label>
                </div>
                <div class="sp-grid">
                  <div class="fg" style="grid-column:span 2">
                    <label class="fl">Address Line 1</label>
                    <textarea class="fc" rows="2" name="co_perm_address" placeholder="Permanent address…"></textarea>
                  </div>
                  <div class="fg"><label class="fl">Pin Code</label><input class="fc" name="co_perm_pin" placeholder="110001" maxlength="6"></div>
                  <div class="fg"><label class="fl">City</label><input class="fc" name="co_perm_city" placeholder="City"></div>
                  <div class="fg"><label class="fl">State</label><select class="fc" name="co_perm_state"><option value="">— Select —</option>${stateOpts}</select><input type="text" class="fc" name="co_perm_state" placeholder="State / Province / Region" style="display:none" disabled data-state-text></div>
                  <div class="fg"><label class="fl">Country</label><input class="fc" name="co_perm_country" value="India" oninput="BookingPage._toggleStateForCountry('co_perm_state', this.value)"></div>
                  <div class="fg"><label class="fl">Mobile No.</label><input class="fc" name="co_perm_mobile_no" placeholder="9XXXXXXXXX" maxlength="10"></div>
                  <div class="fg"><label class="fl">Phone No.</label><input class="fc" name="co_perm_phone_no" placeholder="011-XXXXXXXX"></div>
                  <div class="fg"><label class="fl">Fax No.</label><input class="fc" name="co_perm_fax_no" placeholder="011-XXXXXXXX"></div>
                </div>
              </div>

              <!-- Co-Communication Address + Mailing + Comm Mode -->
              <div style="padding-top:10px;border-top:1px solid var(--border2)">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                  <div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase">Communication Address</div>
                  <label style="display:flex;align-items:center;gap:5px;font-size:11px;cursor:pointer">
                    <input type="checkbox" id="bk-co-comm-same" onchange="BookingPage.copyCoApplicantPermanentToComm(this.checked)">
                    Same as Co-Applicant Permanent
                  </label>
                </div>
                <div class="sp-grid">
                  <div class="fg" style="grid-column:span 2">
                    <label class="fl">Address Line 1</label>
                    <textarea class="fc" rows="2" name="co_comm_address" placeholder="Communication address…"></textarea>
                  </div>
                  <div class="fg"><label class="fl">Pin Code</label><input class="fc" name="co_comm_pin" placeholder="110001" maxlength="6"></div>
                  <div class="fg"><label class="fl">City</label><input class="fc" name="co_comm_city" placeholder="City"></div>
                  <div class="fg"><label class="fl">State</label><select class="fc" name="co_comm_state"><option value="">— Select —</option>${stateOpts}</select><input type="text" class="fc" name="co_comm_state" placeholder="State / Province / Region" style="display:none" disabled data-state-text></div>
                  <div class="fg"><label class="fl">Country</label><input class="fc" name="co_comm_country" value="India" oninput="BookingPage._toggleStateForCountry('co_comm_state', this.value)"></div>
                  <div class="fg"><label class="fl">Mobile No.</label><input class="fc" name="co_comm_mobile_no" placeholder="9XXXXXXXXX" maxlength="10"></div>
                  <div class="fg"><label class="fl">Phone No.</label><input class="fc" name="co_comm_phone_no" placeholder="011-XXXXXXXX"></div>
                  <div class="fg"><label class="fl">Fax No.</label><input class="fc" name="co_comm_fax_no" placeholder="011-XXXXXXXX"></div>
                </div>

                <!-- Co Mailing Address + Communication Mode -->
                <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border);display:flex;gap:24px;flex-wrap:wrap">
                  <div>
                    <label class="fl" style="margin-bottom:5px">MAILING ADDRESS</label>
                    <div class="btg">
                      <button type="button" class="btg-item on" id="bk-co-mail-present"   onclick="BookingPage.setToggleValue('co_mailing_address_type','present',      ['bk-co-mail-present','bk-co-mail-office','bk-co-mail-perm','bk-co-mail-comm'])">Present</button>
                      <button type="button" class="btg-item"    id="bk-co-mail-office"    onclick="BookingPage.setToggleValue('co_mailing_address_type','office',        ['bk-co-mail-present','bk-co-mail-office','bk-co-mail-perm','bk-co-mail-comm'])">Office</button>
                      <button type="button" class="btg-item"    id="bk-co-mail-perm"      onclick="BookingPage.setToggleValue('co_mailing_address_type','permanent',     ['bk-co-mail-present','bk-co-mail-office','bk-co-mail-perm','bk-co-mail-comm'])">Permanent</button>
                      <button type="button" class="btg-item"    id="bk-co-mail-comm"      onclick="BookingPage.setToggleValue('co_mailing_address_type','communication', ['bk-co-mail-present','bk-co-mail-office','bk-co-mail-perm','bk-co-mail-comm'])">Communication</button>
                    </div>
                    <input type="hidden" name="co_mailing_address_type" id="bk-co-mailing-address-type" value="present">
                  </div>
                  <div>
                    <label class="fl" style="margin-bottom:5px">PREFERRED MODE OF COMMUNICATION</label>
                    <div class="btg">
                      <button type="button" class="btg-item"    id="bk-co-comm-courier" onclick="BookingPage.setToggleValue('co_communication_mode','courier',         ['bk-co-comm-courier','bk-co-comm-email','bk-co-comm-sms','bk-co-comm-none','bk-co-comm-hand'])">Courier</button>
                      <button type="button" class="btg-item on" id="bk-co-comm-email"   onclick="BookingPage.setToggleValue('co_communication_mode','email',           ['bk-co-comm-courier','bk-co-comm-email','bk-co-comm-sms','bk-co-comm-none','bk-co-comm-hand'])">Email</button>
                      <button type="button" class="btg-item"    id="bk-co-comm-sms"     onclick="BookingPage.setToggleValue('co_communication_mode','sms',             ['bk-co-comm-courier','bk-co-comm-email','bk-co-comm-sms','bk-co-comm-none','bk-co-comm-hand'])">SMS</button>
                      <button type="button" class="btg-item"    id="bk-co-comm-none"    onclick="BookingPage.setToggleValue('co_communication_mode','no_communication', ['bk-co-comm-courier','bk-co-comm-email','bk-co-comm-sms','bk-co-comm-none','bk-co-comm-hand'])">No Communication</button>
                      <button type="button" class="btg-item"    id="bk-co-comm-hand"    onclick="BookingPage.setToggleValue('co_communication_mode','by_hand',         ['bk-co-comm-courier','bk-co-comm-email','bk-co-comm-sms','bk-co-comm-none','bk-co-comm-hand'])">By Hand</button>
                    </div>
                    <input type="hidden" name="co_communication_mode" id="bk-co-communication-mode" value="email">
                  </div>
                </div>
              </div>

            </div><!-- end second applicant address -->

          </div><!-- end form fields -->

          <!-- ── Co-Applicant Photo widget ── -->
          <div style="width:110px;flex-shrink:0;text-align:center">
            <label class="fl" style="display:block;text-align:center;margin-bottom:6px">Photo</label>
            <div id="bk-co-photo-preview"
              style="width:100px;height:120px;border:2px dashed var(--border);border-radius:8px;overflow:hidden;margin:0 auto 6px;display:flex;align-items:center;justify-content:center;background:var(--surface2);cursor:pointer"
              onclick="document.getElementById('bk-co-photo-file').click()">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="1.5">
                <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
              </svg>
            </div>
            <input type="file" id="bk-co-photo-file" accept="image/jpeg,image/jpg,image/png,image/gif"
              style="display:none" onchange="BookingPage.onCoPhotoSelected(this)">
            <button type="button" class="btn btn-sm"
              style="font-size:11px;padding:4px 8px;width:100%"
              onclick="document.getElementById('bk-co-photo-file').click()">Choose Photo</button>
            <div id="bk-co-photo-error" style="color:var(--danger,#e74c3c);font-size:10px;margin-top:4px;line-height:1.3"></div>
          </div>

        </div><!-- end outer flex -->

      </div>
    </div>

    <!-- ── SECTION 9: MULTI APPLICANTS ──────────────────────── -->
    <div class="sp" style="margin-bottom:14px">
      <div class="sp-hdr">
        <div class="sp-title">Multi Applicants</div>
        <button type="button" class="btn btn-ghost" style="font-size:12px;padding:4px 12px" onclick="BookingPage.openAddlApplicantModal()">+ Add Applicant</button>
      </div>
      <div class="sp-body">
        <div id="bk-addl-cards" style="display:flex;flex-direction:column;gap:10px">
          <div id="bk-addl-empty" style="font-size:12.5px;color:var(--text3);padding:8px 0">No multi applicants added. Click "Add Applicant" to add a third, fourth or fifth applicant.</div>
        </div>
      </div>
    </div>

    <!-- ── SECTION 10: OTHER COSTS ───────────────────────────── -->
    <div class="sp" style="margin-bottom:14px">
      <div class="sp-hdr"><div class="sp-title">Other Costs</div></div>
      <div class="sp-body">

        <!-- PLC Row -->
        <div style="display:flex;align-items:flex-start;gap:14px;padding:10px 0;border-bottom:1px solid var(--border2)">
          <label style="display:flex;align-items:center;gap:8px;min-width:160px;cursor:pointer;padding-top:2px">
            <input type="checkbox" id="bk-has-plc-chk" onchange="BookingPage.togglePlc(this.checked)" style="width:15px;height:15px;cursor:pointer">
            <input type="hidden" id="bk-has-plc" name="has_plc" value="false">
            <span style="font-size:13px;font-weight:600;color:var(--text)">PLC</span>
            <span style="font-size:11px;color:var(--text3)">(Preferential Location)</span>
          </label>
          <div id="bk-plc-fields" style="display:none;flex:1">
            <div class="fg" style="max-width:220px">
              <label class="fl">PLC Amount (₹)</label>
              <input type="number" class="fc" id="bk-plc-amount" name="plc_amount" value="0" min="0" placeholder="0.00">
            </div>
          </div>
        </div>

        <!-- Other Charges Row (opens popup: Balcony Charge display + Custom Charge) -->
        <div style="display:flex;align-items:center;gap:14px;padding:10px 0">
          <div style="min-width:160px">
            <span style="font-size:13px;font-weight:600;color:var(--text)">Other Charges</span>
          </div>
          <div style="flex:1;display:flex;align-items:center;gap:12px">
            <button type="button" class="btn btn-ghost" style="font-size:12px;padding:4px 12px" onclick="BookingPage.openOtherChargesModal()">Other Charges</button>
            <span id="bk-other-charges-summary" style="font-size:12.5px;color:var(--text3)">No other charges added.</span>
          </div>
          <input type="hidden" id="bk-has-other-charge" name="has_other_charge" value="false">
          <input type="hidden" id="bk-other-charge-amount" name="other_charge_amount" value="0">
          <input type="hidden" id="bk-other-charge-desc" name="other_charge_desc" value="">
        </div>

      </div>
    </div>

    <!-- ── SECTION 11: DOCUMENTS ──────────────────────────────── -->
    <div class="sp" style="margin-bottom:14px">
      <div class="sp-hdr"><div class="sp-title">Documents</div></div>
      <div class="sp-body" style="padding:0">
        <div style="overflow-x:auto">
          <table id="bk-doc-table" style="width:100%;border-collapse:collapse;font-size:12.5px">
            <thead>
              <tr style="background:var(--surface2);border-bottom:2px solid var(--border2)">
                <th style="padding:8px 10px;text-align:left;white-space:nowrap;color:var(--text2);font-weight:600">S.No.</th>
                <th style="padding:8px 10px;text-align:left;white-space:nowrap;color:var(--text2);font-weight:600">Document Type</th>
                <th style="padding:8px 10px;text-align:left;white-space:nowrap;color:var(--text2);font-weight:600">Document Name</th>
                <th style="padding:8px 10px;text-align:left;white-space:nowrap;color:var(--text2);font-weight:600">Bar Code No.</th>
                <th style="padding:8px 10px;text-align:left;white-space:nowrap;color:var(--text2);font-weight:600">Physical Storage No.</th>
                <th style="padding:8px 10px;text-align:left;white-space:nowrap;color:var(--text2);font-weight:600">Scan Reference No.</th>
                <th style="padding:8px 10px;text-align:left;white-space:nowrap;color:var(--text2);font-weight:600">Attach Document</th>
              </tr>
            </thead>
            <tbody id="bk-doc-tbody">
              <!-- rendered by renderDocumentTable() -->
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ── SECTION 12: SALES EMPLOYEE ────────────────────────── -->
    <div class="sp" style="margin-bottom:14px">
      <div class="sp-hdr"><div class="sp-title">Sales Employee</div></div>
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

    <!-- ── SECTION 13: NOMINEE & FINANCE ────────────────────── -->
    <div class="sp" style="margin-bottom:14px">
      <div class="sp-hdr"><div class="sp-title">Nominee & Finance Details</div></div>
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

    <!-- ── ACTIONS ───────────────────────────────────────────── -->
    <div style="display:flex;gap:10px;padding:14px 0;align-items:center">
      <button type="submit" class="btn btn-teal btn-lg" id="bk-submit-btn">👁 PREVIEW</button>
      <button type="button" class="btn btn-lg" id="bk-proceed-btn"
        style="border:2px solid var(--teal);color:var(--teal);background:transparent;padding:8px 20px;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600"
        onclick="BookingPage.saveAndProceed()">SAVE AND PROCEED</button>
      <button type="button" class="btn btn-ghost" onclick="Router.navigate('/consumers')">CLOSE</button>
    </div>
    </form>


    <!-- ── MULTI APPLICANT MODAL ─────────────────────────────── -->
    <div id="bk-addl-modal-overlay" class="overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1200;align-items:center;justify-content:center">
      <div class="modal" style="display:block;width:680px;max-width:96vw;max-height:88vh;overflow-y:auto;position:relative">
        <div class="modal-hdr" style="position:sticky;top:0;z-index:1">
          <div class="modal-title" id="bk-addl-modal-title">Add Multi Applicant</div>
          <button class="modal-close" onclick="BookingPage.closeAddlModal()">×</button>
        </div>
        <div class="modal-body">

          <!-- Photo -->
          <div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:16px">
            <div>
              <div id="bk-addl-photo-preview" style="width:90px;height:110px;border:1px dashed var(--border);border-radius:6px;overflow:hidden;background:var(--surface2);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:11px;color:var(--text3);text-align:center" onclick="document.getElementById('bk-addl-photo-input').click()">
                Click to upload photo
              </div>
              <input type="file" id="bk-addl-photo-input" accept="image/*" style="display:none" onchange="BookingPage.onAddlPhotoSelected(this)">
              <div id="bk-addl-photo-error" style="color:var(--danger);font-size:11px;margin-top:3px"></div>
            </div>
            <div style="flex:1">
              <div class="sp-grid" style="grid-template-columns:repeat(3,1fr)">
                <div class="fg">
                  <label class="fl">Salutation</label>
                  <select class="fc" id="bk-addl-salutation-sel" onchange="document.getElementById('bk-addl-salutation-val').value=this.value">
                    ${salutOpts}
                  </select>
                  <input type="hidden" id="bk-addl-salutation-val">
                </div>
                <div class="fg">
                  <label class="fl">First Name <span class="r">*</span></label>
                  <input class="fc" id="bk-addl-first-name" placeholder="First name">
                </div>
                <div class="fg">
                  <label class="fl">Middle Name</label>
                  <input class="fc" id="bk-addl-middle-name" placeholder="Middle name">
                </div>
              </div>
              <div class="sp-grid" style="grid-template-columns:repeat(2,1fr);margin-top:8px">
                <div class="fg">
                  <label class="fl">Last Name <span class="r">*</span></label>
                  <input class="fc" id="bk-addl-last-name" placeholder="Last name">
                </div>
                <div class="fg">
                  <label class="fl">Relation to Primary</label>
                  <select class="fc" id="bk-addl-relation-sel" onchange="document.getElementById('bk-addl-relation-val').value=this.value">
                    <option value="">— Select —</option>
                    <option>Spouse</option><option>Father</option><option>Mother</option>
                    <option>Son</option><option>Daughter</option><option>Brother</option><option>Sister</option><option>Other</option>
                  </select>
                  <input type="hidden" id="bk-addl-relation-val">
                </div>
              </div>
            </div>
          </div>

          <!-- Gender toggle -->
          <div class="fg" style="margin-bottom:12px">
            <label class="fl">Gender</label>
            <div class="btg">
              <button type="button" class="btg-item" id="bk-addl-gender-male"   onclick="BookingPage.setToggleValue('addl_gender','male',  ['bk-addl-gender-male','bk-addl-gender-female','bk-addl-gender-trans'])">Male</button>
              <button type="button" class="btg-item" id="bk-addl-gender-female" onclick="BookingPage.setToggleValue('addl_gender','female',['bk-addl-gender-male','bk-addl-gender-female','bk-addl-gender-trans'])">Female</button>
              <button type="button" class="btg-item" id="bk-addl-gender-trans"  onclick="BookingPage.setToggleValue('addl_gender','other', ['bk-addl-gender-male','bk-addl-gender-female','bk-addl-gender-trans'])">Other</button>
            </div>
            <input type="hidden" id="bk-addl-gender" value="">
          </div>

          <!-- Row: DOB / Mobile / Email -->
          <div class="sp-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:12px">
            <div class="fg">
              <label class="fl">Date of Birth</label>
              <input type="date" class="fc" id="bk-addl-dob">
            </div>
            <div class="fg">
              <label class="fl">Mobile</label>
              <input class="fc" id="bk-addl-mobile" placeholder="10-digit mobile">
            </div>
            <div class="fg">
              <label class="fl">Email</label>
              <input class="fc" id="bk-addl-email" placeholder="email@example.com">
            </div>
          </div>

          <!-- Row: Email 2 / PAN / Aadhaar -->
          <div class="sp-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:12px">
            <div class="fg">
              <label class="fl">Alternate Email</label>
              <input class="fc" id="bk-addl-email-2" placeholder="Secondary email">
            </div>
            <div class="fg">
              <label class="fl">PAN No.</label>
              <input class="fc" id="bk-addl-pan-no" placeholder="ABCDE1234F" style="text-transform:uppercase">
            </div>
            <div class="fg">
              <label class="fl">Aadhaar No.</label>
              <input class="fc" id="bk-addl-aadhaar-no" placeholder="12-digit Aadhaar">
            </div>
          </div>

          <!-- Row: Father / Passport / Designation -->
          <div class="sp-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:12px">
            <div class="fg">
              <label class="fl">Father's Name</label>
              <input class="fc" id="bk-addl-father-name" placeholder="Father's full name">
            </div>
            <div class="fg">
              <label class="fl">Passport No.</label>
              <input class="fc" id="bk-addl-passport-no" placeholder="Passport number">
            </div>
            <div class="fg">
              <label class="fl">Designation</label>
              <input class="fc" id="bk-addl-designation" placeholder="Job title">
            </div>
          </div>

          <!-- Row: Profession / Nationality -->
          <div class="sp-grid" style="grid-template-columns:repeat(2,1fr);margin-bottom:12px">
            <div class="fg">
              <label class="fl">Profession</label>
              <select class="fc" id="bk-addl-profession-sel" onchange="document.getElementById('bk-addl-profession-val').value=this.value">
                ${profOpts}
              </select>
              <input type="hidden" id="bk-addl-profession-val">
            </div>
            <div class="fg">
              <label class="fl">Nationality</label>
              <input class="fc" id="bk-addl-nationality" value="Indian" placeholder="Nationality" list="bk-addl-nat-list">
              <datalist id="bk-addl-nat-list">${nationalities.map(n=>`<option value="${Utils.esc(n.name)}">`).join('')}</datalist>
            </div>
          </div>

          <!-- Marital Status toggle -->
          <div class="fg" style="margin-bottom:12px">
            <label class="fl">Marital Status</label>
            <div class="btg">
              <button type="button" class="btg-item" id="bk-addl-marital-unmarried"     onclick="BookingPage.setToggleValue('addl_marital_status','unmarried',    ['bk-addl-marital-unmarried','bk-addl-marital-married','bk-addl-marital-not-specified'])">Unmarried</button>
              <button type="button" class="btg-item" id="bk-addl-marital-married"       onclick="BookingPage.setToggleValue('addl_marital_status','married',      ['bk-addl-marital-unmarried','bk-addl-marital-married','bk-addl-marital-not-specified'])">Married</button>
              <button type="button" class="btg-item on" id="bk-addl-marital-not-specified" onclick="BookingPage.setToggleValue('addl_marital_status','not_specified',['bk-addl-marital-unmarried','bk-addl-marital-married','bk-addl-marital-not-specified'])">Not Specified</button>
            </div>
            <input type="hidden" id="bk-addl-marital-status" value="not_specified">
          </div>

          <!-- Row: Anniversary / Children (shown when married) -->
          <div class="sp-grid" style="grid-template-columns:repeat(2,1fr);margin-bottom:12px">
            <div class="fg">
              <label class="fl">Anniversary Date</label>
              <input type="date" class="fc" id="bk-addl-anniversary-date">
            </div>
            <div class="fg">
              <label class="fl">No. of Children</label>
              <input type="number" class="fc" id="bk-addl-no-of-children" value="0" min="0" max="20">
            </div>
          </div>

          <!-- POA -->
          <div class="fg" style="margin-bottom:12px">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">
              <input type="checkbox" id="bk-addl-poa-chk" onchange="BookingPage.toggleAddlPoa(this.checked)">
              Has Power of Attorney (POA)
            </label>
            <input type="hidden" id="bk-addl-has-poa" value="false">
          </div>

        </div>
        <div class="modal-ftr" style="position:sticky;bottom:0">
          <button class="btn btn-ghost" onclick="BookingPage.closeAddlModal()">Cancel</button>
          <button class="btn btn-teal" onclick="BookingPage.saveAddlApplicant()">Save Applicant</button>
        </div>
      </div>
    </div>

    <!-- ── OTHER CHARGES MODAL ───────────────────────────────── -->
    <div id="bk-other-charges-modal-overlay" class="overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1200;align-items:center;justify-content:center">
      <div class="modal" style="display:block;width:560px;max-width:96vw;max-height:88vh;overflow-y:auto;position:relative">
        <div class="modal-hdr" style="position:sticky;top:0;z-index:1">
          <div class="modal-title">Other Charges</div>
          <button class="modal-close" onclick="BookingPage.closeOtherChargesModal()">×</button>
        </div>
        <div class="modal-body">

          <div id="bk-balcony-charge-row-wrap"></div>

          <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border2)">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:10px">
              <input type="checkbox" id="bk-modal-other-chk" onchange="BookingPage.toggleOtherCharge(this.checked)" style="width:15px;height:15px;cursor:pointer">
              <span style="font-size:13px;font-weight:600;color:var(--text)">Add a custom charge</span>
            </label>
            <div id="bk-other-charge-fields" style="display:none">
              <div style="display:flex;gap:12px;flex-wrap:wrap">
                <div class="fg" style="min-width:180px">
                  <label class="fl">Amount (₹)</label>
                  <input type="number" class="fc" id="bk-modal-other-charge-amount" value="0" min="0" placeholder="0.00">
                </div>
                <div class="fg" style="flex:1;min-width:200px">
                  <label class="fl">Description</label>
                  <input class="fc" id="bk-modal-other-charge-desc" placeholder="e.g. IFMS, Club Membership, etc.">
                </div>
              </div>
            </div>
          </div>

        </div>
        <div class="modal-ftr" style="position:sticky;bottom:0">
          <button class="btn btn-ghost" onclick="BookingPage.cancelOtherChargesModal()">Cancel</button>
          <button class="btn btn-teal" onclick="BookingPage.commitOtherChargesModal()">OK</button>
        </div>
      </div>
    </div>
  `;

  // Load sources and banks dynamically; render document table
  BookingPage._loadDynamicDropdowns();
  BookingPage._documentFiles = {};
  BookingPage.renderDocumentTable();
};

// ─────────────────────────────────────────────────────────────────────────────
const BookingPage = {
  _units: [],
  _selectedPhotoFile: null,
  _selectedCoPhotoFile: null,
  _additionalApplicants: [],
  _editingAddlIdx: null,
  _currentAddlPhotoFile: null,
  _chequeWarningAcknowledged: false,

  onPhotoSelected(input) {
    const file = input.files[0];
    const errEl = document.getElementById('bk-photo-error');
    if (errEl) errEl.textContent = '';
    if (!file) return;

    if (!/^image\/(jpeg|jpg|png|gif)$/.test(file.type)) {
      if (errEl) errEl.textContent = 'Only jpeg, jpg, png, gif allowed.';
      input.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      if (errEl) errEl.textContent = 'Max size is 5MB.';
      input.value = '';
      return;
    }

    this._selectedPhotoFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = document.getElementById('bk-photo-preview');
      if (preview) {
        preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover">`;
      }
    };
    reader.readAsDataURL(file);
  },

  togglePoa(checked) {
    const details = document.getElementById('bk-poa-details');
    const hidden = document.getElementById('bk-has-poa-hidden');
    if (details) details.style.display = checked ? 'block' : 'none';
    if (hidden) hidden.value = checked ? 'true' : 'false';
  },

  toggleCoPoa(checked) {
    const details = document.getElementById('bk-co-poa-details');
    const hidden = document.getElementById('bk-co-has-poa-hidden');
    if (details) details.style.display = checked ? 'block' : 'none';
    if (hidden) hidden.value = checked ? 'true' : 'false';
  },

  onCoPhotoSelected(input) {
    const file = input.files[0];
    const errEl = document.getElementById('bk-co-photo-error');
    if (errEl) errEl.textContent = '';
    if (!file) return;

    if (!/^image\/(jpeg|jpg|png|gif)$/.test(file.type)) {
      if (errEl) errEl.textContent = 'Only jpeg, jpg, png, gif allowed.';
      input.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      if (errEl) errEl.textContent = 'Max size is 5MB.';
      input.value = '';
      return;
    }

    this._selectedCoPhotoFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = document.getElementById('bk-co-photo-preview');
      if (preview) {
        preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover">`;
      }
    };
    reader.readAsDataURL(file);
  },

  updateInauguralPerSqft() {
    const discEl = document.querySelector('[name="company_inaugural_disc"]');
    const sqftEl = document.querySelector('[name="company_inaugural_disc_sqft"]');
    if (!discEl || !sqftEl) return;
    const unit = this._units.find(u => u.id === document.querySelector('[name="unit_id"]')?.value);
    const area = unit ? parseFloat(unit.carpet_area_sqft || 0) : 0;
    const disc = parseFloat(discEl.value || 0);
    sqftEl.value = area > 0 ? (disc / area).toFixed(4) : '';
  },

  setToggleValue(hiddenInputId, value, buttonIds) {
    const inputEl = document.getElementById(`bk-${hiddenInputId.replace(/_/g,'-')}`);
    if (inputEl) inputEl.value = value;
    buttonIds.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        const onclick = btn.getAttribute('onclick') || '';
        const isActive = onclick.includes(`'${value}'`);
        btn.classList.toggle('on', isActive);
      }
    });
  },

  setSaleType(type) {
    document.getElementById('bk-booking-type').value = type;
    const brokerFields = document.getElementById('bk-broker-fields');
    const btnBroker = document.getElementById('btn-sale-broker');
    const btnDirect = document.getElementById('btn-sale-direct');
    if (type === 'broker') {
      brokerFields.style.display = '';
      btnBroker.classList.add('on');
      btnDirect.classList.remove('on');
    } else {
      brokerFields.style.display = 'none';
      btnBroker.classList.remove('on');
      btnDirect.classList.add('on');
      document.getElementById('bk-broker-id').value = '';
      document.getElementById('bk-main-broker-id').value = '';
      document.getElementById('bk-broker-commission').value = '0';
      document.getElementById('bk-broker-rebate-rs').value = '0';
      document.getElementById('bk-broker-rebate-sqft').value = '0';
      document.getElementById('bk-broker-rebate-pct').value = '0';
    }
  },

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
    // Default receipt date to today
    const rdEl = document.getElementById('bk-receipt-date');
    if (rdEl && !rdEl.value) rdEl.value = Utils.today();
    // S.Tax is a legacy field — always defaults to 0
    ['bk-stax-pct','bk-stax-pct-d','bk-stax-pct-o','bk-stax-pct-c'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = 0;
    });
    this.calculatePaymentTaxes();
    this.updateTaxLabels();
  },

  async _applyProjectGstRate(projectId) {
    if (!projectId) return;
    try {
      const bookingDate = Utils.today();
      const gstRes = await Api.get(`/gst-configuration/resolve?projectId=${projectId}&chargeType=BASIC&date=${bookingDate}`);
      const { cgstPct, sgstPct } = gstRes.data || {};
      if (cgstPct !== undefined) {
        ['bk-cgst-pct','bk-cgst-pct-d','bk-cgst-pct-o','bk-cgst-pct-c'].forEach(id => {
          const el = document.getElementById(id); if (el) el.value = cgstPct;
        });
        ['bk-sgst-pct','bk-sgst-pct-d','bk-sgst-pct-o','bk-sgst-pct-c'].forEach(id => {
          const el = document.getElementById(id); if (el) el.value = sgstPct;
        });
        this.calculatePaymentTaxes();
        this.updateTaxLabels();
      }
    } catch (e) {
      console.warn('GST rate fetch failed:', e.message);
      // the form keeps its fallback percentages until a rate is set up; say so instead of letting them pass as the project's rate
      Utils.error('GST rate not found for this project, so the tax shown is only a placeholder. ' + e.message);
    }
  },

  // The project's own Customer Classification list (or the standard EWS / LIG / MIG)
  async fillClassifications(projectId) {
    const sel = document.querySelector('select[name="income_category"]'); if (!sel) return;
    let names = ['EWS', 'LIG', 'MIG'];
    if (projectId) try { const r = await Api.get(`/master/customer-classifications?projectId=${projectId}`); if (!r.using_defaults) names = r.data.map(x => x.name); } catch {}
    const cur = sel.value;
    sel.innerHTML = '<option value="">— Select —</option>' + names.map(n => `<option>${Utils.esc(n)}</option>`).join('');
    if (names.includes(cur)) sel.value = cur;
  },

  async onProjectChange(projectId) {
    this.fillClassifications(projectId);
    try {
      const st = projectId ? (await Api.get(`/projects/${projectId}/settings`)).data : null, reg = document.querySelector('input[name="reg_no"]');
      if (reg) { const manual = st?.registration_number_mode === 'Manual'; reg.readOnly = !manual; reg.required = manual; reg.style.opacity = manual ? '' : '.6'; reg.placeholder = manual ? 'Enter the registration no.' : 'Auto-generated'; if (!manual) reg.value = ''; }
    } catch {}
    const towSel = document.getElementById('bk-tower');
    const unitSel = document.getElementById('bk-unit-select');
    if (!projectId) {
      towSel.innerHTML = `<option value="">— Select —</option>`;
      unitSel.innerHTML = `<option value="">— Select project first —</option>`;
      this._units = [];
      this.loadPaymentPlans('');
      return;
    }
    try {
      // Load towers
      const towRes = await Api.get(`/projects/${projectId}/towers`);
      const towers = towRes.data || [];
      towSel.innerHTML = `<option value="">— Any Tower —</option>` + towers.map(t=>`<option value="${t.tower_name}">${t.tower_name}</option>`).join('');

      // Load all units (available + locked/booked shown grayed out)
      const unitRes = await Api.get('/units', { params: { projectId, pageSize: 500 } });
      this._units = unitRes.data || [];
      // Unit Type lists only what this project has (its units' types), not a fixed list that may not exist here
      const bhkSel = document.querySelector('[name="bhk_type"]');
      if (bhkSel) {
        const keep = bhkSel.value;
        const types = [...new Set(this._units.map(u => u.bhk_type).filter(Boolean))].sort();
        bhkSel.innerHTML = '<option value="">— Select —</option><option value="any">Any</option>' + types.map(t => `<option value="${Utils.esc(t)}">${Utils.esc(t)}</option>`).join('');
        if (keep && [...bhkSel.options].some(o => o.value === keep)) bhkSel.value = keep;
      }
      this._renderUnitOptions();

      // Load payment plans
      this.loadPaymentPlans(projectId);

      // Fetch real project GST rate (System A: gst_tax_charge_mapping)
      this._applyProjectGstRate(projectId);
    } catch {}
  },

  async loadPaymentPlans(projectId) {
    const planSelect = document.getElementById('bk-payment-plan');
    planSelect.innerHTML = '<option value="">— Select Plan —</option>';

    if (!projectId) return;

    try {
      const res = await Api.get(`/projects/${projectId}/plan-templates`);
      const plans = res.data || res;

      // Only plans that add up to 100% can be booked: each demand is price x the row's percentage
      const totals = {};
      plans.forEach(p => { totals[p.plan_name] = (totals[p.plan_name] || 0) + (parseFloat(p.percentage) || 0); });
      const planNames = Object.keys(totals).filter(n => Math.abs(totals[n] - 100) < 0.001);

      if (planNames.length === 0) {
        planSelect.innerHTML = Object.keys(totals).length
          ? '<option value="">No complete plan (a plan must add up to 100%)</option>'
          : '<option value="">No plans configured</option>';
        return;
      }

      planNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        planSelect.appendChild(option);
      });
    } catch (err) {
      console.error('Failed to load plans:', err);
      planSelect.innerHTML = '<option value="">Error loading plans</option>';
    }
  },

  filterUnits() {
    this._renderUnitOptions();
  },

  _renderUnitOptions() {
    const sel = document.getElementById('bk-unit-select');
    if (!sel) return;
    const bhk     = document.querySelector('[name="bhk_type"]')?.value || '';
    const showBhk = bhk === 'any';
    const tower   = document.getElementById('bk-tower')?.value || '';
    let filtered  = this._units;
    if (bhk && !showBhk) {
      filtered = filtered.filter(u => {
        if (!u.bhk_type) return false;
        // Exact match first (handles edge cases)
        if (u.bhk_type === bhk) return true;
        // Pattern match: "3BHK" matches "Type-A (3 BHK)"
        const spaced = bhk.replace(/(\d)(BHK)/i, '$1 $2');
        return u.bhk_type.toUpperCase().includes(spaced.toUpperCase());
      });
    }
    if (tower) filtered = filtered.filter(u => u.tower_name === tower);

    // Rebuild floor dropdown from filtered units (after tower+BHK narrowing)
    const floorSel = document.getElementById('bk-floor');
    if (floorSel) {
      const prevFloor = floorSel.value;
      const floors = [...new Set(filtered.map(u => u.floor).filter(v => v !== null && v !== undefined))].sort((a, b) => a - b);
      floorSel.innerHTML = `<option value="">— Any —</option>` +
        floors.map(f => `<option value="${f}">${f === 0 ? 'Ground' : f}</option>`).join('');
      floorSel.value = floors.includes(Number(prevFloor)) ? prevFloor : '';
    }

    // Apply floor filter after rebuilding options
    const floor = floorSel?.value ?? '';
    if (floor !== '') filtered = filtered.filter(u => u.floor === Number(floor));

    sel.innerHTML = `<option value="">— Select Unit —</option>` +
      filtered.map(u => {
        const label = [u.unit_number, u.tower_name&&`Tower ${u.tower_name}`, u.floor&&`Floor ${u.floor}`, showBhk&&u.bhk_type, (u.super_area_sqft||u.carpet_area_sqft)&&`${u.super_area_sqft||u.carpet_area_sqft} sqft`].filter(Boolean).join(' | ');
        const isAvailable = !u.status || u.status === 'available';
        if (isAvailable) {
          return `<option value="${u.id}" data-carpet="${u.carpet_area_sqft||0}" data-super="${u.super_area_sqft||0}" data-price="${u.base_price_inr||0}" data-bhk="${u.bhk_type||''}">${label}</option>`;
        }
        return `<option value="" disabled style="color:#999;background:#f5f5f5">${label} — ${u.status === 'held' ? 'Held' : 'Booked'}</option>`;
      }).join('');
    // Extract BHK code from full value (e.g., "Type-A (3 BHK)" → "3BHK")
    const extractBhk = (bhkType) => {
      if (!bhkType) return '';
      // Match "2BHK", "3BHK", "1BHK" directly
      const direct = bhkType.match(/\b(\dBHK)\b/i);
      if (direct) return direct[1].toUpperCase();
      // Match "3 BHK" with space → convert to "3BHK"
      const spaced = bhkType.match(/\b(\d+)\s*(BHK)\b/i);
      if (spaced) return (spaced[1] + spaced[2]).toUpperCase();
      // Fallback — non-BHK unit (e.g. Shop); don't force-set the dropdown
      return '';
    };

    sel.onchange = () => {
      const opt = sel.selectedOptions[0];
      const carpet    = parseFloat(opt?.dataset?.carpet || 0);
      const superArea = parseFloat(opt?.dataset?.super  || 0);
      const price     = parseFloat(opt?.dataset?.price  || 0);
      // The area and the rate per sqft must be on the same basis, or the total is not the unit's price
      // (it used to show the super area but divide the price by the carpet area: 7857 x 1000 for a 55 lakh unit).
      // The field is the carpet area; a unit with no carpet area (a shop priced on super area) falls back to the super area.
      const displayArea = carpet > 0 ? carpet : superArea;
      document.querySelector('[name="carpet_area_sqft"]').value = displayArea ? displayArea.toFixed(3) : '';
      if (price && displayArea) document.querySelector('[name="basic_price"]').value = Math.round(price * 10000 / displayArea) / 10000;
      // In "Any" mode, promote BHK dropdown only when the unit has a recognisable BHK type
      const actualBhk = opt?.dataset?.bhk;
      const extracted = actualBhk ? extractBhk(actualBhk) : '';
      if (extracted) {
        const bhkSel = document.querySelector('[name="bhk_type"]');
        if (bhkSel?.value === 'any') bhkSel.value = extracted;
      }
      BookingPage.updatePlcSuggestion(price);
    };
  },

  // The PLC to offer comes from the PLC master (Set Projects, Charge Master, PLC) for the unit's location; it can still be changed here.
  async updatePlcSuggestion() {
    const chk = document.getElementById('bk-has-plc-chk');
    const plcInput = document.getElementById('bk-plc-amount');
    if (!chk?.checked || !plcInput) return;
    const unitId = document.getElementById('bk-unit-select')?.value;
    let hint = document.getElementById('bk-plc-hint');
    if (!hint) { hint = document.createElement('div'); hint.id = 'bk-plc-hint'; hint.style.cssText = 'font-size:11.5px;color:var(--text3);margin-top:3px'; plcInput.parentNode.appendChild(hint); }
    hint.textContent = '';
    if (!unitId) return;
    try {
      const q = (await Api.get('/plc-charges/quote', { params: { unitId } })).data;
      if (q && q.amount > 0) { plcInput.value = q.amount; hint.textContent = `From the PLC master: ${q.location} (${q.basis}). You can change it.`; }
      else { plcInput.value = 0; hint.textContent = q && q.location ? `${q.location} has no PLC rate set. Enter the amount if one applies.` : 'This unit has no location in the PLC master. Enter the amount if one applies.'; }
    } catch (e) { hint.textContent = 'Could not read the PLC master. Enter the amount.'; }
  },

  togglePlc(checked) {
    const fields = document.getElementById('bk-plc-fields');
    const hidden = document.getElementById('bk-has-plc');
    if (!fields || !hidden) return;
    hidden.value = checked ? 'true' : 'false';
    fields.style.display = checked ? 'block' : 'none';
    if (checked) {
      BookingPage.updatePlcSuggestion();
    } else {
      const plcInput = document.getElementById('bk-plc-amount');
      if (plcInput) plcInput.value = 0;
      const hint = document.getElementById('bk-plc-hint');
      if (hint) hint.textContent = '';
    }
  },

  // Local-only: shows/hides the modal's own amount/description inputs.
  // Does NOT touch the real hidden fields -- those are only written by
  // commitOtherChargesModal() (OK).
  toggleOtherCharge(checked) {
    const fields = document.getElementById('bk-other-charge-fields');
    if (!fields) return;
    fields.style.display = checked ? 'block' : 'none';
    if (!checked) {
      const amtInput = document.getElementById('bk-modal-other-charge-amount');
      const descInput = document.getElementById('bk-modal-other-charge-desc');
      if (amtInput) amtInput.value = 0;
      if (descInput) descInput.value = '';
    }
  },

  _updateOtherChargesSummary() {
    const summary = document.getElementById('bk-other-charges-summary');
    if (!summary) return;
    const hasOther = document.getElementById('bk-has-other-charge')?.value === 'true';
    const amt = parseFloat(document.getElementById('bk-other-charge-amount')?.value || 0) || 0;
    const desc = document.getElementById('bk-other-charge-desc')?.value || '';
    summary.textContent = hasOther
      ? `Custom Charge: ₹${amt.toLocaleString('en-IN')}${desc ? ' (' + desc + ')' : ''}`
      : 'No other charges added.';
  },

  async openOtherChargesModal() {
    const overlay = document.getElementById('bk-other-charges-modal-overlay');
    if (!overlay) return;
    // Snapshot the real hidden fields so Cancel can restore them exactly.
    this._otherChargeSnapshot = {
      hasOther: document.getElementById('bk-has-other-charge')?.value || 'false',
      amount: document.getElementById('bk-other-charge-amount')?.value || '0',
      desc: document.getElementById('bk-other-charge-desc')?.value || '',
    };
    // Re-populate the modal's own inputs from the current committed state,
    // so re-opening after a prior OK shows what was actually committed.
    const checked = this._otherChargeSnapshot.hasOther === 'true';
    const chk = document.getElementById('bk-modal-other-chk');
    const amtInput = document.getElementById('bk-modal-other-charge-amount');
    const descInput = document.getElementById('bk-modal-other-charge-desc');
    if (chk) chk.checked = checked;
    if (amtInput) amtInput.value = checked ? this._otherChargeSnapshot.amount : 0;
    if (descInput) descInput.value = checked ? this._otherChargeSnapshot.desc : '';
    this.toggleOtherCharge(checked);
    await this._renderBalconyChargeRow();
    overlay.style.display = 'flex';
  },

  // OK: commits the modal's local inputs into the real hidden fields
  // (has_other_charge / other_charge_amount / other_charge_desc) that
  // booking.ts's POST /booking has always read -- the modal is purely a
  // relocated UI, the submitted data shape is unchanged.
  commitOtherChargesModal() {
    const checked = document.getElementById('bk-modal-other-chk')?.checked || false;
    const amt = parseFloat(document.getElementById('bk-modal-other-charge-amount')?.value || 0) || 0;
    const desc = document.getElementById('bk-modal-other-charge-desc')?.value || '';
    const hasOther = document.getElementById('bk-has-other-charge');
    const hiddenAmt = document.getElementById('bk-other-charge-amount');
    const hiddenDesc = document.getElementById('bk-other-charge-desc');
    if (hasOther) hasOther.value = checked ? 'true' : 'false';
    if (hiddenAmt) hiddenAmt.value = checked ? amt : 0;
    if (hiddenDesc) hiddenDesc.value = checked ? desc : '';
    this._updateOtherChargesSummary();
    this.closeOtherChargesModal();
  },

  // Cancel: discards the modal's local edits and restores the real hidden
  // fields from the snapshot taken when the popup opened. Summary line is
  // left untouched since the real fields never changed.
  cancelOtherChargesModal() {
    const snap = this._otherChargeSnapshot;
    if (snap) {
      const hasOther = document.getElementById('bk-has-other-charge');
      const hiddenAmt = document.getElementById('bk-other-charge-amount');
      const hiddenDesc = document.getElementById('bk-other-charge-desc');
      if (hasOther) hasOther.value = snap.hasOther;
      if (hiddenAmt) hiddenAmt.value = snap.amount;
      if (hiddenDesc) hiddenDesc.value = snap.desc;
    }
    this.closeOtherChargesModal();
  },

  closeOtherChargesModal() {
    const overlay = document.getElementById('bk-other-charges-modal-overlay');
    if (overlay) overlay.style.display = 'none';
  },

  // Display-only Balcony Charge row -- same data source as the price-
  // preview overlay (GET /charge-master/balcony-preview), shown here
  // purely for staff visibility. The checkbox is disabled/always-checked;
  // it has no effect on booking.ts's write-point, which computes and
  // stores this charge unconditionally whenever the unit has balcony area.
  async _renderBalconyChargeRow() {
    const wrap = document.getElementById('bk-balcony-charge-row-wrap');
    if (!wrap) return;

    const selectedUnitId = document.querySelector('[name="unit_id"]')?.value;
    const selectedUnit = this._units?.find(u => u.id === selectedUnitId);
    const balconyAreaSqft = parseFloat(selectedUnit?.balcony_area_sqft || '0') || 0;
    const projectId = document.querySelector('[name="project_id"]')?.value;
    const bookingDate = document.querySelector('[name="booking_date"]')?.value;

    if (!projectId || balconyAreaSqft <= 0) {
      wrap.innerHTML = '';
      return;
    }

    wrap.innerHTML = `<div style="font-size:12.5px;color:var(--text3)">Loading Balcony Charge…</div>`;
    try {
      const res = await Api.get('/charge-master/balcony-preview', {
        params: { projectId, balconyAreaSqft, bookingDate }
      });
      const d = res.data || {};
      const total = (parseFloat(d.balconyChargeAmount || 0) || 0)
        + (parseFloat(d.balconyCgstAmount || 0) || 0)
        + (parseFloat(d.balconySgstAmount || 0) || 0);
      const fmt = n => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      wrap.innerHTML = `
        <table style="width:100%;border-collapse:collapse;font-size:12.5px">
          <thead>
            <tr style="border-bottom:1px solid var(--border2);color:var(--text3);text-align:left">
              <th style="padding:6px 8px">S.NO</th><th style="padding:6px 8px">SEL</th>
              <th style="padding:6px 8px">NAME OF CHARGE</th><th style="padding:6px 8px">TYPE</th>
              <th style="padding:6px 8px">RATE</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding:6px 8px">1</td>
              <td style="padding:6px 8px"><input type="checkbox" checked disabled style="width:15px;height:15px"></td>
              <td style="padding:6px 8px;font-weight:600">Balcony Charge</td>
              <td style="padding:6px 8px">Fix</td>
              <td style="padding:6px 8px">${fmt(total)}</td>
            </tr>
          </tbody>
        </table>
      `;
    } catch (err) {
      wrap.innerHTML = '';
      console.warn('Balcony charge row fetch failed:', err.message);
    }
  },

  renderDocumentTable() {
    const tbody = document.getElementById('bk-doc-tbody');
    if (!tbody) return;

    const baseRows = [
      { type: 'physical_application_form', label: 'Physical Application Form', applicant: 0 },
      { type: 'invitation_letter',          label: 'Invitation Letter',          applicant: 0 },
      { type: 'reminder_letter',            label: 'Reminder Letter',            applicant: 0 },
    ];

    // Per-applicant rows: 1=Primary, 2=Co-applicant (Multiple only), 3+=Additional.
    // Position 2 is reserved for co-applicant regardless of type; additional always start at 3.
    const hasCoApplicant   = (this._applicantType === 'multiple');
    const applicantNumbers = [1];
    if (hasCoApplicant) applicantNumbers.push(2);
    const addlCount = this._additionalApplicants?.length || 0;
    for (let j = 0; j < addlCount; j++) applicantNumbers.push(3 + j);

    const ordinalNames = ['', 'Primary', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];
    const perApplicantRows = [];
    for (const num of applicantNumbers) {
      const label = ordinalNames[num] || `${num}th`;
      perApplicantRows.push({ type: 'pan_card',     label: `PAN Card (${label} Applicant)`,     applicant: num });
      perApplicantRows.push({ type: 'aadhaar_card', label: `Aadhaar Card (${label} Applicant)`, applicant: num });
    }

    const allRows = [...baseRows, ...perApplicantRows];
    let html = '';
    allRows.forEach((row, idx) => {
      const rowKey = `${row.applicant}_${row.type}`;
      html += `
        <tr style="border-bottom:1px solid var(--border2)">
          <td style="padding:8px 10px;color:var(--text3);white-space:nowrap">${idx + 1}</td>
          <td style="padding:8px 10px;white-space:nowrap;font-weight:500">${row.label}</td>
          <td style="padding:6px 10px"><input class="fc" style="min-width:140px" placeholder="Doc name" data-row="${rowKey}" data-field="document_name"></td>
          <td style="padding:6px 10px"><input class="fc" style="min-width:110px" placeholder="Barcode" data-row="${rowKey}" data-field="barcode_no"></td>
          <td style="padding:6px 10px"><input class="fc" style="min-width:110px" placeholder="Storage ref" data-row="${rowKey}" data-field="physical_storage_no"></td>
          <td style="padding:6px 10px"><input class="fc" style="min-width:110px" placeholder="Scan ref" data-row="${rowKey}" data-field="scan_reference_no"></td>
          <td style="padding:6px 10px">
            <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:var(--teal)">
              <input type="file" accept=".jpg,.jpeg,.png,.gif,.pdf" style="display:none"
                onchange="BookingPage._onDocFileChange('${rowKey}', ${row.applicant}, '${row.type}', this)">
              <span id="bk-doc-lbl-${rowKey.replace(/[^a-zA-Z0-9]/g, '_')}" style="white-space:nowrap">📎 Attach</span>
            </label>
          </td>
        </tr>`;
    });
    tbody.innerHTML = html;
  },

  _onDocFileChange(rowKey, applicantNumber, docType, input) {
    if (!this._documentFiles) this._documentFiles = {};
    if (input.files && input.files[0]) {
      this._documentFiles[rowKey] = { file: input.files[0], applicant_number: applicantNumber, document_type: docType };
      const labelId = 'bk-doc-lbl-' + rowKey.replace(/[^a-zA-Z0-9]/g, '_');
      const lbl = document.getElementById(labelId);
      if (lbl) lbl.textContent = '✅ ' + input.files[0].name.slice(0, 18);
    }
  },

  // ── Payment tab helpers ──────────────────────────────────────────────────

  _syncAmount(v) {
    const el = document.querySelector('[name="booking_amount"]');
    if (el) el.value = v;
  },
  _syncRef(v) {
    const el = document.querySelector('[name="payment_ref"]');
    if (el) el.value = v;
  },
  _syncDate(v) {
    const el = document.querySelector('[name="cheque_date"]');
    if (el) el.value = v;
  },
  _syncBank(v) {
    const el = document.querySelector('[name="bank_name"]');
    if (el) el.value = v;
  },
  _syncBranch(v) {
    const el = document.querySelector('[name="bank_branch"]');
    if (el) el.value = v;
  },
  _syncRemark(v) {
    const el = document.querySelector('[name="remarks"]');
    if (el) el.value = v;
  },

  calculatePaymentTaxes() {
    const tab = document.getElementById('bk-payment-mode')?.value || 'cheque';
    const suffixMap = { cheque:'', draft:'-d', online:'-o', cash:'-c', card:'' };
    const sfx = suffixMap[tab] || '';

    const amtEl  = tab === 'cheque' ? document.getElementById('bk-amt-cheque')
                 : tab === 'draft'  ? document.getElementById('bk-amt-draft')
                 : tab === 'online' ? document.getElementById('bk-amt-online')
                 : tab === 'cash'   ? document.getElementById('bk-amt-cash')
                 : tab === 'card'   ? document.getElementById('bk-amt-card')
                 : null;
    const intEl  = document.getElementById('bk-interest-amt');

    const amt  = parseFloat(amtEl?.value || 0);
    const intr = parseFloat(intEl?.value || 0);
    const base = amt + intr;

    const cgstPct = parseFloat(document.getElementById('bk-cgst-pct' + sfx)?.value || 0);
    const sgstPct = parseFloat(document.getElementById('bk-sgst-pct' + sfx)?.value || 0);

    const cgstAmt = base * cgstPct / 100;
    const sgstAmt = base * sgstPct / 100;
    const paid    = base + cgstAmt + sgstAmt;

    // Update paid display
    ['bk-paid-display','bk-paid-display-d','bk-paid-display-o','bk-paid-display-c'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = paid.toFixed(2);
    });
    // Store calculated amounts in hidden inputs
    const cgstH = document.getElementById('bk-cgst-amount'); if (cgstH) cgstH.value = cgstAmt.toFixed(2);
    const sgstH = document.getElementById('bk-sgst-amount'); if (sgstH) sgstH.value = sgstAmt.toFixed(2);
    this.updateTaxLabels();
  },

  updateTaxLabels() {
    const g = id => document.getElementById(id);
    const fmt = (id, fallback) => parseFloat(g(id)?.value ?? fallback).toFixed(3);
    if (g('bk-lbl-gst-int')) g('bk-lbl-gst-int').textContent = `GST Interest(${fmt('bk-gst-int-pct', 1)}%)`;
    if (g('bk-lbl-stax'))    g('bk-lbl-stax').textContent    = `S.Tax(${fmt('bk-stax-pct', 0)}%)`;
    if (g('bk-lbl-cgst'))    g('bk-lbl-cgst').textContent    = `CGST(${fmt('bk-cgst-pct', 0.5)}%)`;
    if (g('bk-lbl-sgst'))    g('bk-lbl-sgst').textContent    = `SGST(${fmt('bk-sgst-pct', 0.5)}%)`;
  },

  switchPaymentTab(tab) {
    const tabs = ['cheque','draft','online','cash','adjust','dealer_adjustment','tds_challan','card'];
    // Toggle tab button styles (open-tab effect)
    tabs.forEach(t => {
      const btn = document.getElementById(`bk-ptab-${t}`);
      if (!btn) return;
      if (t === tab) {
        btn.style.background = 'var(--teal)';
        btn.style.color = '#fff';
        btn.style.border = '1px solid var(--border)';
        btn.style.borderBottom = '2px solid var(--surface)';
        btn.style.marginBottom = '-1px';
        btn.style.fontWeight = '600';
      } else {
        btn.style.background = 'var(--bg)';
        btn.style.color = 'var(--text)';
        btn.style.border = '1px solid var(--border)';
        btn.style.borderBottom = 'none';
        btn.style.marginBottom = '';
        btn.style.fontWeight = '400';
      }
    });
    // Show/hide field panels
    tabs.forEach(t => {
      const panel = document.getElementById(`bk-pfields-${t}`);
      if (panel) panel.style.display = t === tab ? '' : 'none';
    });
    // Update hidden payment_mode
    const modeEl = document.getElementById('bk-payment-mode');
    if (modeEl) modeEl.value = tab;
    // Seed secondary bank dropdowns from primary (bk-bank-sel)
    const primaryOpts = document.getElementById('bk-bank-sel')?.innerHTML || '';
    ['bk-bank-draft','bk-bank-online','bk-bank-tds','bk-bank-card'].forEach(id => {
      const el = document.getElementById(id); if (el && el.innerHTML.length < 50) el.innerHTML = primaryOpts;
    });
    this.calculatePaymentTaxes();
  },

  _toggleStateForCountry(stateName, countryVal) {
    const isForeign = countryVal.trim() !== '' && countryVal.trim().toLowerCase() !== 'india';
    const sel = document.querySelector(`select[name="${stateName}"]`);
    const txt = document.querySelector(`input[data-state-text][name="${stateName}"]`);
    if (!sel || !txt) return;
    if (isForeign) {
      sel.style.display = 'none'; sel.disabled = true; sel.value = '';
      txt.style.display = ''; txt.disabled = false;
    } else {
      txt.style.display = 'none'; txt.disabled = true; txt.value = '';
      sel.style.display = ''; sel.disabled = false;
    }
  },

  copyPresentToOffice(checked) {
    if (!checked) return;
    ['address_line1','pin','city','country','mobile_no','phone_no','fax_no'].forEach(f => {
      const src = document.querySelector(`[name="present_${f}"]`);
      const dst = document.querySelector(`[name="office_${f}"]`);
      if (src && dst) dst.value = src.value;
    });
    const srcState = document.querySelector('[name="present_state"]');
    const dstState = document.querySelector('[name="office_state"]');
    if (srcState && dstState) dstState.value = srcState.value;
  },

  copyPermanentToComm(checked) {
    if (checked) {
      ['address_line1','pin','city','country','mobile_no','phone_no','fax_no'].forEach(f => {
        const src = document.querySelector(`[name="perm_${f}"]`);
        const dst = document.querySelector(`[name="comm_${f}"]`);
        if (src && dst) dst.value = src.value;
      });
      const srcState = document.querySelector('[name="perm_state"]');
      const dstState = document.querySelector('[name="comm_state"]');
      if (srcState && dstState) dstState.value = srcState.value;
    } else {
      ['address_line1','pin','city','mobile_no','phone_no','fax_no'].forEach(f => {
        const dst = document.querySelector(`[name="comm_${f}"]`);
        if (dst) dst.value = '';
      });
      const cDst = document.querySelector('[name="comm_country"]');
      if (cDst) cDst.value = 'India';
      const dstState = document.querySelector('[name="comm_state"]');
      if (dstState) dstState.value = '';
    }
  },

  copyPresentToPermanent(checked) {
    if (!checked) return;
    ['address_line1','pin','city','country','mobile_no','phone_no','fax_no'].forEach(f => {
      const src = document.querySelector(`[name="present_${f}"]`);
      const dst = document.querySelector(`[name="perm_${f}"]`);
      if (src && dst) dst.value = src.value;
    });
    const srcState = document.querySelector('[name="present_state"]');
    const dstState = document.querySelector('[name="perm_state"]');
    if (srcState && dstState) dstState.value = srcState.value;
  },

  fillCoApplicantFromFirst(checked) {
    const fields = ['pin','city','country','mobile_no','phone_no','fax_no'];
    if (checked) {
      // copy address (different field name suffix: address_line1 vs address)
      const srcAddr = document.querySelector('[name="present_address_line1"]');
      const dstAddr = document.querySelector('[name="co_present_address"]');
      if (srcAddr && dstAddr) dstAddr.value = srcAddr.value;
      fields.forEach(f => {
        const src = document.querySelector(`[name="present_${f}"]`);
        const dst = document.querySelector(`[name="co_present_${f}"]`);
        if (src && dst) dst.value = src.value;
      });
      const srcState = document.querySelector('[name="present_state"]');
      const dstState = document.querySelector('[name="co_present_state"]');
      if (srcState && dstState) dstState.value = srcState.value;
    } else {
      const dstAddr = document.querySelector('[name="co_present_address"]');
      if (dstAddr) dstAddr.value = '';
      fields.forEach(f => {
        const dst = document.querySelector(`[name="co_present_${f}"]`);
        if (dst) dst.value = f === 'country' ? 'India' : '';
      });
      const dstState = document.querySelector('[name="co_present_state"]');
      if (dstState) dstState.value = '';
    }
  },

  copyCoApplicantPresentToOffice(checked) {
    const fields = ['pin','city','country','mobile_no','phone_no','fax_no'];
    if (checked) {
      const srcAddr = document.querySelector('[name="co_present_address"]');
      const dstAddr = document.querySelector('[name="co_office_address"]');
      if (srcAddr && dstAddr) dstAddr.value = srcAddr.value;
      fields.forEach(f => {
        const src = document.querySelector(`[name="co_present_${f}"]`);
        const dst = document.querySelector(`[name="co_office_${f}"]`);
        if (src && dst) dst.value = src.value;
      });
      const srcState = document.querySelector('[name="co_present_state"]');
      const dstState = document.querySelector('[name="co_office_state"]');
      if (srcState && dstState) dstState.value = srcState.value;
    }
  },

  copyCoApplicantPresentToPermanent(checked) {
    const fields = ['pin','city','country','mobile_no','phone_no','fax_no'];
    if (checked) {
      const srcAddr = document.querySelector('[name="co_present_address"]');
      const dstAddr = document.querySelector('[name="co_perm_address"]');
      if (srcAddr && dstAddr) dstAddr.value = srcAddr.value;
      fields.forEach(f => {
        const src = document.querySelector(`[name="co_present_${f}"]`);
        const dst = document.querySelector(`[name="co_perm_${f}"]`);
        if (src && dst) dst.value = src.value;
      });
      const srcState = document.querySelector('[name="co_present_state"]');
      const dstState = document.querySelector('[name="co_perm_state"]');
      if (srcState && dstState) dstState.value = srcState.value;
    }
  },

  copyCoApplicantPermanentToComm(checked) {
    const fields = ['pin','city','country','mobile_no','phone_no','fax_no'];
    if (checked) {
      const srcAddr = document.querySelector('[name="co_perm_address"]');
      const dstAddr = document.querySelector('[name="co_comm_address"]');
      if (srcAddr && dstAddr) dstAddr.value = srcAddr.value;
      fields.forEach(f => {
        const src = document.querySelector(`[name="co_perm_${f}"]`);
        const dst = document.querySelector(`[name="co_comm_${f}"]`);
        if (src && dst) dst.value = src.value;
      });
      const srcState = document.querySelector('[name="co_perm_state"]');
      const dstState = document.querySelector('[name="co_comm_state"]');
      if (srcState && dstState) dstState.value = srcState.value;
    } else {
      const dstAddr = document.querySelector('[name="co_comm_address"]');
      if (dstAddr) dstAddr.value = '';
      fields.forEach(f => {
        const dst = document.querySelector(`[name="co_comm_${f}"]`);
        if (dst) dst.value = f === 'country' ? 'India' : '';
      });
      const dstState = document.querySelector('[name="co_comm_state"]');
      if (dstState) dstState.value = '';
    }
  },

  onReset() {
    this._units = [];
    this._applicantType = 'individual';
    this._additionalApplicants = [];
    this._currentAddlPhotoFile = null;
    this._editingAddlIdx = null;
    this._documentFiles = {};
    this._renderAddlApplicantCards();
    this.renderDocumentTable();
    // Reset other costs section
    const plcChk = document.getElementById('bk-has-plc-chk');
    if (plcChk) { plcChk.checked = false; this.togglePlc(false); }
    const otherChk = document.getElementById('bk-modal-other-chk');
    if (otherChk) { otherChk.checked = false; this.toggleOtherCharge(false); }
    const hasOtherHidden = document.getElementById('bk-has-other-charge');
    const hiddenAmt = document.getElementById('bk-other-charge-amount');
    const hiddenDesc = document.getElementById('bk-other-charge-desc');
    if (hasOtherHidden) hasOtherHidden.value = 'false';
    if (hiddenAmt) hiddenAmt.value = '0';
    if (hiddenDesc) hiddenDesc.value = '';
    this._updateOtherChargesSummary();
  },

  _ordinalName(n) {
    const names = ['', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];
    return names[n] || `${n}th`;
  },

  openAddlApplicantModal(editIdx) {
    this._editingAddlIdx = (editIdx !== undefined) ? editIdx : null;
    const overlay = document.getElementById('bk-addl-modal-overlay');
    const title = document.getElementById('bk-addl-modal-title');
    if (!overlay) return;
    if (this._editingAddlIdx !== null) {
      const idx = this._editingAddlIdx;
      title.textContent = `Edit ${this._ordinalName(idx + 3)} Applicant`;
      this._fillAddlModal(this._additionalApplicants[idx]);
    } else {
      const n = this._additionalApplicants.length + 3;
      title.textContent = `Add ${this._ordinalName(n)} Applicant`;
      this._resetAddlModal();
    }
    overlay.style.display = 'flex';
  },

  closeAddlModal() {
    const overlay = document.getElementById('bk-addl-modal-overlay');
    if (overlay) overlay.style.display = 'none';
  },

  _resetAddlModal() {
    const ids = ['bk-addl-first-name','bk-addl-middle-name','bk-addl-last-name',
      'bk-addl-mobile','bk-addl-email','bk-addl-email-2','bk-addl-pan-no',
      'bk-addl-aadhaar-no','bk-addl-father-name','bk-addl-passport-no',
      'bk-addl-designation','bk-addl-nationality','bk-addl-dob',
      'bk-addl-anniversary-date'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = el.id === 'bk-addl-nationality' ? 'Indian' : (el.type === 'number' ? '0' : ''); });
    document.getElementById('bk-addl-salutation-sel').value = '';
    document.getElementById('bk-addl-salutation-val').value = '';
    document.getElementById('bk-addl-relation-sel').value = '';
    document.getElementById('bk-addl-relation-val').value = '';
    document.getElementById('bk-addl-profession-sel').value = '';
    document.getElementById('bk-addl-profession-val').value = '';
    document.getElementById('bk-addl-gender').value = '';
    document.getElementById('bk-addl-marital-status').value = 'not_specified';
    document.getElementById('bk-addl-no-of-children').value = '0';
    document.getElementById('bk-addl-has-poa').value = 'false';
    const poaChk = document.getElementById('bk-addl-poa-chk');
    if (poaChk) poaChk.checked = false;
    document.getElementById('bk-addl-photo-preview').innerHTML = 'Click to upload photo';
    document.getElementById('bk-addl-photo-input').value = '';
    document.getElementById('bk-addl-photo-error').textContent = '';
    this._currentAddlPhotoFile = null;
    // Reset toggle buttons
    ['bk-addl-gender-male','bk-addl-gender-female','bk-addl-gender-trans'].forEach(id => {
      const btn = document.getElementById(id); if (btn) btn.classList.remove('on');
    });
    ['bk-addl-marital-unmarried','bk-addl-marital-married'].forEach(id => {
      const btn = document.getElementById(id); if (btn) btn.classList.remove('on');
    });
    const notSpec = document.getElementById('bk-addl-marital-not-specified');
    if (notSpec) notSpec.classList.add('on');
  },

  _fillAddlModal(a) {
    this._resetAddlModal();
    const set = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
    set('bk-addl-first-name', a.first_name);
    set('bk-addl-middle-name', a.middle_name);
    set('bk-addl-last-name', a.last_name);
    set('bk-addl-mobile', a.mobile);
    set('bk-addl-email', a.email);
    set('bk-addl-email-2', a.email_2);
    set('bk-addl-pan-no', a.pan_no);
    set('bk-addl-aadhaar-no', a.aadhaar_no);
    set('bk-addl-father-name', a.father_name);
    set('bk-addl-passport-no', a.passport_no);
    set('bk-addl-designation', a.designation);
    set('bk-addl-nationality', a.nationality || 'Indian');
    set('bk-addl-dob', a.dob);
    set('bk-addl-anniversary-date', a.anniversary_date);
    set('bk-addl-no-of-children', a.no_of_children || 0);
    document.getElementById('bk-addl-salutation-sel').value = a.salutation || '';
    document.getElementById('bk-addl-salutation-val').value = a.salutation || '';
    document.getElementById('bk-addl-relation-sel').value = a.relation || '';
    document.getElementById('bk-addl-relation-val').value = a.relation || '';
    document.getElementById('bk-addl-profession-sel').value = a.profession || '';
    document.getElementById('bk-addl-profession-val').value = a.profession || '';
    if (a.gender) this.setToggleValue('addl_gender', a.gender, ['bk-addl-gender-male','bk-addl-gender-female','bk-addl-gender-trans']);
    if (a.marital_status) this.setToggleValue('addl_marital_status', a.marital_status, ['bk-addl-marital-unmarried','bk-addl-marital-married','bk-addl-marital-not-specified']);
    const hasPoa = a.has_poa === true || a.has_poa === 'true';
    document.getElementById('bk-addl-has-poa').value = hasPoa ? 'true' : 'false';
    const poaChk = document.getElementById('bk-addl-poa-chk');
    if (poaChk) poaChk.checked = hasPoa;
    if (a._photoPreview) {
      const prev = document.getElementById('bk-addl-photo-preview');
      if (prev) prev.innerHTML = `<img src="${a._photoPreview}" style="width:100%;height:100%;object-fit:cover">`;
    }
  },

  saveAddlApplicant() {
    const firstName = document.getElementById('bk-addl-first-name').value.trim();
    const lastName  = document.getElementById('bk-addl-last-name').value.trim();
    if (!firstName) { alert('First name is required.'); return; }

    const applicant = {
      first_name:       firstName,
      last_name:        lastName,
      middle_name:      document.getElementById('bk-addl-middle-name').value.trim() || null,
      salutation:       document.getElementById('bk-addl-salutation-val').value || null,
      relation:         document.getElementById('bk-addl-relation-val').value || null,
      gender:           document.getElementById('bk-addl-gender').value || null,
      dob:              document.getElementById('bk-addl-dob').value || null,
      mobile:           document.getElementById('bk-addl-mobile').value.trim() || null,
      email:            document.getElementById('bk-addl-email').value.trim() || null,
      email_2:          document.getElementById('bk-addl-email-2').value.trim() || null,
      pan_no:           document.getElementById('bk-addl-pan-no').value.trim().toUpperCase() || null,
      aadhaar_no:       document.getElementById('bk-addl-aadhaar-no').value.trim() || null,
      father_name:      document.getElementById('bk-addl-father-name').value.trim() || null,
      passport_no:      document.getElementById('bk-addl-passport-no').value.trim() || null,
      designation:      document.getElementById('bk-addl-designation').value.trim() || null,
      profession:       document.getElementById('bk-addl-profession-val').value || null,
      nationality:      document.getElementById('bk-addl-nationality').value.trim() || 'Indian',
      marital_status:   document.getElementById('bk-addl-marital-status').value || 'not_specified',
      anniversary_date: document.getElementById('bk-addl-anniversary-date').value || null,
      no_of_children:   parseInt(document.getElementById('bk-addl-no-of-children').value || '0'),
      has_poa:          document.getElementById('bk-addl-has-poa').value === 'true',
      _photoFile:       this._currentAddlPhotoFile || null,
      _photoPreview:    this._currentAddlPhotoFile
        ? document.getElementById('bk-addl-photo-preview').querySelector('img')?.src || null
        : (this._editingAddlIdx !== null ? this._additionalApplicants[this._editingAddlIdx]?._photoPreview : null),
    };

    if (this._editingAddlIdx !== null) {
      this._additionalApplicants[this._editingAddlIdx] = applicant;
    } else {
      this._additionalApplicants.push(applicant);
    }

    this.closeAddlModal();
    this._renderAddlApplicantCards();
    this.renderDocumentTable();
  },

  _renderAddlApplicantCards() {
    const container = document.getElementById('bk-addl-cards');
    const emptyMsg  = document.getElementById('bk-addl-empty');
    if (!container) return;
    // Remove existing cards (not the empty message)
    Array.from(container.children).forEach(c => { if (c.id !== 'bk-addl-empty') c.remove(); });
    if (this._additionalApplicants.length === 0) {
      if (emptyMsg) emptyMsg.style.display = '';
    } else {
      if (emptyMsg) emptyMsg.style.display = 'none';
      this._additionalApplicants.forEach((a, idx) => {
        const card = document.createElement('div');
        card.style.cssText = 'display:flex;align-items:center;gap:12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 14px';
        const photoHtml = a._photoPreview
          ? `<img src="${a._photoPreview}" style="width:48px;height:56px;object-fit:cover;border-radius:4px;border:1px solid var(--border2)">`
          : `<div style="width:48px;height:56px;border-radius:4px;border:1px dashed var(--border2);background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--text3)">No Photo</div>`;
        card.innerHTML = `
          ${photoHtml}
          <div style="flex:1">
            <div style="font-weight:600;font-size:13px;color:var(--text)">${this._ordinalName(idx + 3)} Applicant — ${[a.salutation, a.first_name, a.middle_name, a.last_name].filter(Boolean).join(' ')}</div>
            <div style="font-size:11.5px;color:var(--text3);margin-top:2px">${[a.relation ? 'Relation: '+a.relation : null, a.mobile || null, a.pan_no || null].filter(Boolean).join(' · ')}</div>
          </div>
          <button type="button" class="btn btn-ghost" style="font-size:11px;padding:3px 10px" onclick="BookingPage.openAddlApplicantModal(${idx})">Edit</button>
          <button type="button" class="btn" style="font-size:11px;padding:3px 10px;background:var(--danger-light,#fee2e2);color:var(--danger,#dc2626)" onclick="BookingPage.removeAddlApplicant(${idx})">Remove</button>
        `;
        container.appendChild(card);
      });
    }
  },

  removeAddlApplicant(idx) {
    this._additionalApplicants.splice(idx, 1);
    this._renderAddlApplicantCards();
    this.renderDocumentTable();
  },

  onAddlPhotoSelected(input) {
    const file = input.files[0];
    const errEl = document.getElementById('bk-addl-photo-error');
    if (errEl) errEl.textContent = '';
    if (!file) return;
    if (!/^image\/(jpeg|jpg|png|gif)$/.test(file.type)) {
      if (errEl) errEl.textContent = 'Only jpeg, jpg, png, gif allowed.';
      input.value = ''; return;
    }
    if (file.size > 5 * 1024 * 1024) {
      if (errEl) errEl.textContent = 'Max size is 5MB.';
      input.value = ''; return;
    }
    this._currentAddlPhotoFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      const prev = document.getElementById('bk-addl-photo-preview');
      if (prev) prev.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover">`;
    };
    reader.readAsDataURL(file);
  },

  toggleAddlPoa(checked) {
    const hidden = document.getElementById('bk-addl-has-poa');
    if (hidden) hidden.value = checked ? 'true' : 'false';
  },

  setApplicantType(type) {
    // Update button visual state
    ['individual','multiple','company'].forEach(t => {
      const btn = document.getElementById(`bk-type-${t}`);
      if (btn) btn.classList.toggle('on', t === type);
    });
    // Toggle section visibility
    const indiv = document.getElementById('bk-indiv-fields');
    const company = document.getElementById('bk-company-fields');
    const coapp = document.getElementById('bk-coapplicant-section');
    if (indiv)   indiv.style.display   = (type === 'company') ? 'none' : '';
    if (company) company.style.display = (type === 'company') ? ''     : 'none';
    if (coapp)   coapp.style.display   = (type === 'multiple') ? ''    : 'none';
    // Toggle required attributes: first_name/last_name required only for individual/multiple
    const firstName = document.querySelector('[name="first_name"]');
    const lastName  = document.querySelector('[name="last_name"]');
    if (firstName) firstName.required = (type !== 'company');
    if (lastName)  lastName.required  = (type !== 'company');
    this._applicantType = type;
    this.renderDocumentTable();
  },

  async preview(e) {
    if (e) e.preventDefault();

    const _formNoErr = document.getElementById('bk-form-no-err');
    if (_formNoErr && _formNoErr.style.display !== 'none' && _formNoErr.textContent.trim()) {
      document.getElementById('bk-form-no')?.focus();
      return;
    }

    const { missing, firstEl } = this._collectMissing();
    if (missing.length > 0) {
      this._showValidationPopup(missing, firstEl);
      return;
    }

    // Preserve _bookingData for submit path compatibility
    const form = document.getElementById('booking-form');
    const fd = new FormData(form);
    this._bookingData = {};
    fd.forEach((v, k) => { if (v) this._bookingData[k] = v; });

    // Read helpers — use real field IDs / name selectors verified from the form
    const qval  = sel => (document.querySelector(sel)?.value || '').trim();
    const qtext = sel => { const el = document.querySelector(sel); return el ? (el.options?.[el.selectedIndex]?.text || el.value || '').trim() : ''; };
    const gval  = id  => (document.getElementById(id)?.value || '').trim();
    const gtext = id  => { const el = document.getElementById(id); return el ? (el.options?.[el.selectedIndex]?.text || el.value || '').trim() : ''; };
    const gchk  = id  => document.getElementById(id)?.checked || false;

    // ── Unit Information ────────────────────────────────────────
    const projectName  = qtext('[name="project_id"]');
    const unitNo       = gtext('bk-unit-select');
    // the tower, floor and type of the CHOSEN unit (the tower and floor boxes are only search filters and say "Any")
    const unitRow      = this._units?.find(u => u.id === document.querySelector('[name="unit_id"]')?.value);
    const anyOf       = s => (!s || /Any|^—/.test(s)) ? '' : s;
    const bhkType      = unitRow?.bhk_type || qtext('[name="bhk_type"]');
    const tower        = unitRow?.tower_name || anyOf(gtext('bk-tower')) || '—';
    const floor        = unitRow ? Utils.floorLabel(unitRow.floor, unitRow.floor_name) : (anyOf(gtext('bk-floor')) || '—');
    const carpetAreaNum = parseFloat(gval('bk-carpet-area') || '0') || 0;
    const bookingDate  = qval('[name="booking_date"]');
    const planName     = gtext('bk-payment-plan');
    const formNo       = gval('bk-form-no') || '—';

    // ── First Applicant ─────────────────────────────────────────
    const salutation = qtext('[name="salutation"]');
    const firstName  = qval('[name="first_name"]');
    const lastName   = qval('[name="last_name"]');
    const fullName   = [(salutation && salutation !== '— Select —' ? salutation : ''), firstName, lastName].filter(Boolean).join(' ') || '—';
    const mobile     = qval('[name="mobile"]');
    const email      = qval('[name="email"]');
    const pan        = qval('[name="pan_no"]') || '—';
    const address    = [qval('[name="present_address_line1"]'), qval('[name="present_address_line2"]'), qval('[name="present_city"]'), qval('[name="present_state"]'), qval('[name="present_pin"]')].filter(Boolean).join(', ') || '—';
    const nomineeName = qval('[name="nominee_name"]'), nomineeRel = qval('[name="nominee_relation"]'), nomineeShare = qval('[name="nominee_share"]');
    const nominee    = nomineeName ? [nomineeName, nomineeRel, nomineeShare ? nomineeShare + '%' : ''].filter(Boolean).join(' / ') : '—';

    // ── Payment ─────────────────────────────────────────────────
    const paymentMode = gval('bk-payment-mode') || 'cheque';
    const amtIdMap    = { cheque: 'bk-amt-cheque', draft: 'bk-amt-draft', online: 'bk-amt-online', cash: 'bk-amt-cash', card: 'bk-amt-card' };
    const bookingAmt  = parseFloat(gval(amtIdMap[paymentMode] || '') || qval('[name="booking_amount"]') || '0') || 0;
    const modeLabelMap = { cheque: 'Cheque', draft: 'Demand Draft', online: 'Online / NEFT', cash: 'Cash', card: 'Card', tds_challan: 'TDS Challan', adjust: 'Adjust' };
    const paymentModeLabel = modeLabelMap[paymentMode] || paymentMode;
    const refIdMap  = { cheque: 'bk-ref-cheque', draft: 'bk-ref-draft', online: 'bk-ref-online', card: 'bk-ref-card' };
    const refNo     = gval(refIdMap[paymentMode] || '') || qval('[name="payment_ref"]') || '—';
    const bankName  = qval('[name="bank_name"]') || '—';

    // ── Costs ────────────────────────────────────────────────────
    const basicPrice  = parseFloat(qval('[name="basic_price"]') || '0') || 0;
    const selectedUnitId     = document.querySelector('[name="unit_id"]')?.value;

    const hasPLC  = gchk('bk-has-plc-chk');
    const plcAmt  = hasPLC ? parseFloat(gval('bk-plc-amount') || '0') || 0 : 0;

    const hasOther  = document.getElementById('bk-has-other-charge')?.value === 'true';
    const otherAmt  = hasOther ? parseFloat(gval('bk-other-charge-amount') || '0') || 0 : 0;
    const otherDesc = hasOther ? (gval('bk-other-charge-desc') || 'Other Charges') : '';

    // The price, the GST per charge head and the balcony charge all come from the server (POST /booking/quote): no tax maths in the browser.
    const inauguralDisc = parseFloat(qval('[name="company_inaugural_disc"]') || '0') || 0;
    let quote;
    try {
      const qr = await Api.post('/booking/quote', {
        unit_id: selectedUnitId, basic_price: basicPrice, plc_amount: plcAmt, other_charge_amount: otherAmt,
        company_inaugural_disc: inauguralDisc, booking_date: bookingDate || undefined, nationality: qval('[name="nationality"]') || undefined,
      });
      quote = qr.data;
    } catch (err) { Utils.error('The price could not be worked out. ' + err.message); return; }
    const balLine = quote.tax_lines.find(l => l.charge_head === 'BALCONY');
    const basicCost = quote.basic_inr, balconyInclusiveTotal = quote.balcony_inr + (balLine ? balLine.cgst + balLine.sgst : 0);
    const subTotal = quote.basic_inr + quote.plc_inr + quote.other_charge_inr;
    const grandTotal = quote.total_with_gst_inr;
    // the server refuses a discount above the basic price when the booking is saved; say so here instead of offering Save on a negative total
    if (basicCost > 0 && inauguralDisc > basicCost) {
      Utils.error('The inaugural discount (' + inauguralDisc.toLocaleString('en-IN') + ') is more than the basic price (' + basicCost.toLocaleString('en-IN') + '). Reduce the discount to continue.');
      return;
    }

    // ── Broker / Sales ───────────────────────────────────────────
    const saleType  = document.getElementById('bk-booking-type')?.value === 'direct' ? 'Direct' : 'Broker';
    const brokerName = gtext('bk-broker-id') || '—';
    const salesExec  = qtext('[name="sales_employee_id"]') || '—';
    const sourceEnq  = gtext('bk-source-sel') || '—';

    // ── Format helpers ───────────────────────────────────────────
    const fmt = n => '₹' + parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const row = (label, value, isTotal = false) =>
      `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f1f5f9;font-size:13px;">
         <span style="color:#64748b;min-width:110px;flex-shrink:0">${label}</span>
         <span style="font-weight:${isTotal ? '700' : '500'};color:${isTotal ? '#1a3a5c' : '#1e293b'};text-align:right;word-break:break-word;max-width:220px">${value || '—'}</span>
       </div>`;
    const hdr = title =>
      `<div style="background:#f1f5f9;padding:8px 14px;font-size:11px;font-weight:700;color:#1a3a5c;text-transform:uppercase;letter-spacing:0.5px">${title}</div>`;
    const card = (title, body) =>
      `<div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">${hdr(title)}<div style="padding:10px 14px">${body}</div></div>`;

    // ── Build overlay HTML ────────────────────────────────────────
    const overlayHtml = `
<div id="bk-preview-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px">
  <div style="background:#fff;border-radius:12px;width:100%;max-width:860px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.2);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;flex-direction:column">

    <div style="background:#1a3a5c;color:#fff;padding:16px 24px;border-radius:12px 12px 0 0;display:flex;justify-content:space-between;align-items:center;flex-shrink:0">
      <div>
        <div style="font-size:16px;font-weight:700;letter-spacing:0.3px">BOOKING PREVIEW</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:2px">Please review all details before submitting</div>
      </div>
      <button onclick="document.getElementById('bk-preview-overlay').remove()" style="background:rgba(255,255,255,0.15);border:none;color:#fff;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:18px;line-height:1">✕</button>
    </div>

    <div style="padding:20px 24px;overflow-y:auto;flex:1">

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
        ${card('Unit Information',
          row('Project', projectName) +
          row('Unit No.', unitNo) +
          row('BHK Type', bhkType) +
          row('Tower', tower) +
          row('Floor', floor) +
          row('Carpet Area', carpetAreaNum > 0 ? carpetAreaNum + ' sq.ft.' : '—') +
          row('Booking Date', bookingDate) +
          row('Payment Plan', planName) +
          row('Form No.', formNo)
        )}
        ${card('First Applicant',
          row('Name', fullName) +
          row('Mobile', mobile) +
          row('Email', email) +
          row('PAN No.', pan) +
          row('Address', address) +
          row('Nominee', nominee)
        )}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
        ${card('Booking Payment',
          row('Booking Amount', bookingAmt > 0 ? fmt(bookingAmt) : 'None now (pending payment)') +
          (bookingAmt > 0 ? row('Payment Mode', paymentModeLabel) + row('Cheque / Ref No.', refNo) + row('Bank Name', bankName) : '')
        )}
        ${card('Broker / Sales',
          row('Sale Type', saleType) +
          row('Broker', brokerName) +
          row('Sales Executive', salesExec) +
          row('Source of Enquiry', sourceEnq)
        )}
      </div>

      <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:4px">
        ${hdr('Cost Summary')}
        <div style="padding:10px 14px">
          ${basicCost > 0 ? row('Basic Cost (' + fmt(basicPrice) + '/sqft × ' + carpetAreaNum + ' sqft)', fmt(basicCost)) : ''}
          ${hasPLC         ? row('PLC (Preferential Location)', fmt(plcAmt)) : ''}
          ${hasOther       ? row(otherDesc || 'Other Charges', fmt(otherAmt)) : ''}
          <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#94a3b8"><span>Sub Total</span><span>${fmt(subTotal)}</span></div>
          ${quote.tax_lines.filter(l => l.charge_head !== 'BALCONY').map(l => row(l.charge_head + ' CGST (' + l.cgst_pct + '%)', fmt(l.cgst)) + row(l.charge_head + ' SGST (' + l.sgst_pct + '%)', fmt(l.sgst))).join('')}
          ${balconyInclusiveTotal > 0 ? row('Balcony Charges (GST included)', fmt(balconyInclusiveTotal)) : ''}
          ${inauguralDisc > 0 ? row('Inaugural Discount', '− ' + fmt(inauguralDisc)) : ''}
          <div style="display:flex;justify-content:space-between;padding:10px 0 4px;font-size:15px;font-weight:700;color:#1a3a5c;border-top:2px solid #1a3a5c;margin-top:4px">
            <span>Total Consideration</span><span>${fmt(grandTotal)}</span>
          </div>
        </div>
      </div>

    </div>

    <div style="padding:16px 24px;border-top:1px solid #e2e8f0;display:flex;justify-content:flex-end;gap:12px;flex-shrink:0;border-radius:0 0 12px 12px;background:#fff">
      <button onclick="document.getElementById('bk-preview-overlay').remove()" style="background:#f1f5f9;border:1px solid #cbd5e1;color:#475569;border-radius:8px;padding:10px 28px;font-size:14px;font-weight:600;cursor:pointer">Close</button>
      <button id="bk-preview-save-btn" style="background:#1a3a5c;border:none;color:#fff;border-radius:8px;padding:10px 28px;font-size:14px;font-weight:600;cursor:pointer;letter-spacing:0.3px">Save and Proceed →</button>
    </div>

  </div>
</div>`;

    document.getElementById('bk-preview-overlay')?.remove();
    document.body.insertAdjacentHTML('beforeend', overlayHtml);

    document.getElementById('bk-preview-save-btn').addEventListener('click', async () => {
      document.getElementById('bk-preview-overlay')?.remove();
      await this.saveAndProceed();
    });
  },

  async _checkFormNo() {
    const input = document.getElementById('bk-form-no');
    const errEl = document.getElementById('bk-form-no-err');
    if (!input || !errEl) return;
    const val = input.value.trim();
    // Clear previous state
    errEl.textContent = '';
    errEl.style.display = 'none';
    input.style.borderColor = '';
    if (!val) return;
    const excludeId = this._editingBookingId || null;
    try {
      const params = [`formNo=${encodeURIComponent(val)}`];
      if (excludeId) params.push(`excludeId=${encodeURIComponent(excludeId)}`);
      const res = await Api.get(`/booking/check-form-no?${params.join('&')}`);
      const data = res.data ?? res;
      if (!data.available) {
        errEl.textContent = data.message || `Form No. "${val}" is already in use.`;
        errEl.style.display = 'block';
        input.style.borderColor = '#dc3545';
      }
    } catch { /* network error — allow submission; backend enforces uniqueness */ }
  },

  // Returns true if ref is clear, false if duplicate was found (and modal shown)
  async validateChequeRef() {
    const mode = document.getElementById('bk-payment-mode')?.value || 'cheque';
    // Modes with no reference number — skip validation
    if (['cash', 'adjust', 'dealer_adjustment'].includes(mode)) return true;

    // Read the active tab's reference input
    const refIdMap = { cheque: 'bk-ref-cheque', draft: 'bk-ref-draft', online: 'bk-ref-online', card: 'bk-ref-card', tds_challan: 'bk-tds-challan-no' };
    const refId = refIdMap[mode];
    const refEl = refId ? document.getElementById(refId) : null;
    const refVal = (refEl?.value || '').trim();

    if (!refVal) return true;
    if (this._chequeWarningAcknowledged) return true;

    let data;
    try {
      const res = await Api.get(`/booking/check-cheque?ref=${encodeURIComponent(refVal)}`);
      data = res.data ?? res;
    } catch { return true; } // Network error — allow submission to proceed; backend will enforce UNIQUE

    if (!data.exists) return true;

    // Build human-readable date
    const rawDate = data.detail?.date;
    const dateStr = rawDate ? new Date(rawDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    const foundIn = data.found_in === 'booking' ? 'booking record' : 'payment receipt';

    return new Promise(resolve => {
      // Create warning modal
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center';

      overlay.innerHTML = `
        <div style="background:var(--surface);border:1px solid var(--border2);border-radius:14px;padding:28px 28px 22px;max-width:440px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.25);position:relative">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
            <span style="font-size:22px">⚠️</span>
            <h3 style="font-size:15px;font-weight:700;color:var(--text);margin:0">Duplicate Reference Number</h3>
          </div>
          <p style="font-size:13px;color:var(--text2);line-height:1.6;margin-bottom:20px">
            Cheque/reference number <strong style="color:var(--text)">"${refVal}"</strong> has already been used in a
            <strong>${foundIn}</strong>
            (Reference: <strong>${data.detail?.reference || '—'}</strong>, Date: ${dateStr}).
            <br><br>Do you still want to proceed?
          </p>
          <div style="display:flex;gap:10px;justify-content:flex-end">
            <button id="bk-chq-change" class="btn btn-teal" style="font-size:13px">Change Number</button>
            <button id="bk-chq-proceed" class="btn btn-ghost" style="font-size:13px;border:1px solid var(--border2)">Proceed Anyway</button>
          </div>
        </div>`;

      const close = () => document.body.removeChild(overlay);

      overlay.querySelector('#bk-chq-change').onclick = () => {
        close();
        refEl.value = '';
        // Also clear the synced hidden payment_ref
        const prEl = document.querySelector('[name="payment_ref"]');
        if (prEl && prEl !== refEl) prEl.value = '';
        refEl.focus();
        this._chequeWarningAcknowledged = false;
        resolve(false);
      };

      overlay.querySelector('#bk-chq-proceed').onclick = () => {
        close();
        this._chequeWarningAcknowledged = true;
        resolve(true);
      };

      // ESC and backdrop close → treat as "Change Number"
      overlay.addEventListener('click', e => { if (e.target === overlay) { close(); refEl.focus(); this._chequeWarningAcknowledged = false; resolve(false); } });
      document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); refEl.focus(); BookingPage._chequeWarningAcknowledged = false; document.removeEventListener('keydown', esc); resolve(false); } }, { once: true });

      document.body.appendChild(overlay);
    });
  },

  // Required fields shared by preview() and saveAndProceed()
  _REQUIRED_FIELDS: [
    { sel: '[name="project_id"]',            label: 'Project'          },
    { sel: '[name="bhk_type"]',              label: 'Unit Type (BHK)'  },
    { sel: '[name="booking_date"]',          label: 'Booking Date'     },
    { sel: '#bk-unit-select',               label: 'Unit No.'         },
    { sel: '#bk-payment-plan',              label: 'Payment Plan'     },
    { sel: '[name="first_name"]',            label: 'First Name'       },
    { sel: '[name="last_name"]',             label: 'Last Name'        },
    { sel: '[name="email"]',                 label: 'Email'            },
    { sel: '[name="mobile"]',                label: 'Mobile No.'       },
    { sel: '[name="present_address_line1"]', label: 'Present Address'  },
  ],

  // Collect missing required fields; suppress Unit/Plan when Project is missing
  _collectMissing() {
    const projectEl = document.querySelector('[name="project_id"]');
    const projectMissing = !projectEl?.value;

    const missing = [];
    let firstEl = null;
    for (const { sel, label } of this._REQUIRED_FIELDS) {
      // Unit and Plan are impossible to fill when Project is not chosen — skip them
      if (projectMissing && (label === 'Unit No.' || label === 'Payment Plan')) continue;
      // First/Last Name not required for Company applicant type
      if ((label === 'First Name' || label === 'Last Name') && this._applicantType === 'company') continue;
      const el = document.querySelector(sel);
      if (!el) continue;
      if (!(el.value || '').trim()) {
        missing.push(label);
        if (!firstEl) firstEl = el;
      }
    }
    return { missing, firstEl };
  },

  // Show a validation summary popup listing all missing fields
  _showValidationPopup(missing, firstEl) {
    const existing = document.getElementById('bk-validation-popup');
    if (existing) existing.remove();

    const rows = missing.map((f, i) =>
      `<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;${i < missing.length - 1 ? 'border-bottom:1px solid #fecaca;' : ''}">
         <div style="width:6px;height:6px;background:#c0392b;border-radius:50%;flex-shrink:0"></div>
         <span style="font-size:13.5px;font-weight:500;color:#374151">${f}</span>
       </div>`
    ).join('');

    const overlay = document.createElement('div');
    overlay.id = 'bk-validation-popup';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:99999';
    overlay.innerHTML = `
      <div style="background:#ffffff;border-radius:16px;padding:0;min-width:360px;max-width:440px;width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.15),0 4px 16px rgba(0,0,0,0.08);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow:hidden">
        <div style="background:#c0392b;padding:20px 28px 18px;display:flex;align-items:center;gap:12px">
          <div style="width:32px;height:32px;background:rgba(255,255,255,0.2);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <h3 style="margin:0;font-size:15px;font-weight:700;color:#ffffff;letter-spacing:0.3px">Required Fields Missing</h3>
            <p style="margin:2px 0 0;font-size:12px;color:rgba(255,255,255,0.8);font-weight:400">Please complete all required fields</p>
          </div>
        </div>
        <div style="padding:24px 28px 0">
          <p style="margin:0 0 16px;font-size:13px;color:#6b7280;line-height:1.5">The following fields cannot be empty before proceeding:</p>
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:4px 0;margin-bottom:24px">${rows}</div>
        </div>
        <div style="padding:0 28px 24px;display:flex;justify-content:flex-end">
          <button id="bk-val-ok-btn" style="background:#1a3a5c;color:#ffffff;border:none;border-radius:8px;padding:11px 40px;font-size:14px;font-weight:600;cursor:pointer;letter-spacing:0.5px;transition:background 0.2s" onmouseover="this.style.background='#0f2744'" onmouseout="this.style.background='#1a3a5c'">OK</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const scrollToFirst = () => {
      if (!firstEl) return;
      firstEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => firstEl.focus(), 450);
    };
    document.getElementById('bk-val-ok-btn').addEventListener('click', () => { overlay.remove(); scrollToFirst(); });
    overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); scrollToFirst(); } });
  },

  // saveAndProceed — Step 1 submit: create consumer + booking (no payment), navigate to payment page
  async saveAndProceed() {
    // Close preview modal if open
    const previewModal = document.getElementById('bk-preview-modal');
    if (previewModal) previewModal.style.display = 'none';

    // Collect fresh form data (works whether called from modal or direct button)
    const form = document.getElementById('booking-form');

    // Collect all missing required fields and show summary popup if any
    const { missing, firstEl } = this._collectMissing();
    if (missing.length > 0) {
      this._showValidationPopup(missing, firstEl);
      return;
    }

    const fd = new FormData(form);
    const body = {};
    fd.forEach((v, k) => { if (v) body[k] = v; });
    // If "Any" BHK was selected, resolve to the unit's actual BHK type for submission
    if (body.bhk_type === 'any') {
      const selectedUnitId = document.getElementById('bk-unit-select')?.value;
      const unit = this._units.find(u => u.id === selectedUnitId);
      if (unit?.bhk_type) body.bhk_type = unit.bhk_type;
      else delete body.bhk_type;
    }
    // The form just read is the truth. The snapshot taken at Preview used to be laid over it, so a field changed after
    // Preview (or a whole new booking in the same session) was saved with the OLD applicant's details.
    this._bookingData = body;

    const btn = document.getElementById('bk-proceed-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    const submitBtn = document.getElementById('bk-submit-btn');
    if (submitBtn) { submitBtn.disabled = true; }

    try {
      const applicantType = this._applicantType || 'individual';

      // Step 1: Create consumer
      const consumerRes = await Api.post('/consumers', {
        applicant_type: applicantType,
        first_name: body.first_name, last_name: body.last_name,
        name: applicantType === 'company'
          ? (body.company_name || 'Company')
          : `${body.first_name||''} ${body.last_name||''}`.trim(),
        email: body.email, mobile: body.mobile,
        project_id: body.project_id || null,
        income_category: body.income_category || document.querySelector('select[name="income_category"] option:nth-child(2)')?.value || 'EWS',
        middle_name: body.middle_name || null, dob: body.dob || null,
        gender: body.gender || null, education: body.education || null,
        alt_mobile: body.alt_mobile || null, pan_no: body.pan_no,
        aadhaar_no: body.aadhaar_no, ppp_id: body.ppp_id || null,
        lead_stage: 'enquiry', source_of_enquiry: body.source_of_enquiry,
        nationality: body.nationality, profession: body.profession, salutation: body.salutation,
        annual_income: body.annual_income ? parseFloat(body.annual_income) : null,
        company: body.company, form_no: body.form_no || null,
        father_name: body.father_name || null, anniversary_date: body.anniversary_date || null,
        marital_status: body.marital_status || 'not_specified',
        no_of_children: body.no_of_children ? parseInt(body.no_of_children) : 0,
        passport_no: body.passport_no || null, email_2: body.email_2 || null,
        designation: body.designation || null, has_poa: body.has_poa === 'true',
        company_name: body.company_name || null, company_reg_no: body.company_reg_no || null,
        company_gstin: body.company_gstin || null,
        authorized_person: body.authorized_person || null,
        authorized_designation: body.authorized_designation || null,
        co_applicant_first_name: body.co_first_name || null, co_applicant_last_name: body.co_last_name || null,
        co_applicant_salutation: body.co_salutation || null, co_applicant_pan_no: body.co_pan_no || null,
        co_applicant_aadhaar_no: body.co_aadhaar_no || null, co_applicant_mobile: body.co_mobile || null,
        co_applicant_email: body.co_email || null, co_applicant_dob: body.co_dob || null,
        co_applicant_relation: body.co_relation || null,
        co_applicant_type: body.co_applicant_type || 'co_applicant',
        present_address_line1: body.present_address_line1 || null,
        present_city: body.present_city || null, present_state: body.present_state || null,
        present_pin: body.present_pin || null, present_country: body.present_country || 'India',
        perm_address_line1: body.perm_address_line1 || null,
        perm_city: body.perm_city || null, perm_state: body.perm_state || null,
        perm_pin: body.perm_pin || null, perm_country: body.perm_country || 'India',
        mailing_address_type: body.mailing_address_type || 'present',
        communication_mode: body.communication_mode || 'email',
        phone_no: body.phone_no || null, fax_no: body.fax_no || null,
      });
      const consumer = consumerRes.data || consumerRes;

      if (!consumer?.id) {
        Utils.error('Consumer record could not be created. Please try again.');
        if (btn) { btn.disabled = false; btn.textContent = 'SAVE AND PROCEED'; }
        if (submitBtn) { submitBtn.disabled = false; }
        return;
      }

      // Step 2: Create booking record (no payment fields — payment captured in Step 2 page)
      let registrationNo = 'TBD';
      let bookingRecordId = null;
      let bookingCreateError = null;
      try {
        const bookingRes = await Api.post('/booking', {
          consumer_id:    consumer.id,
          project_id:     body.project_id,
          unit_id:        body.unit_id || null,
          booking_date:   body.booking_date,
          booking_type:           body.booking_type || 'direct',
          broker_id:              body.broker_id || null,
          main_broker_id:         body.main_broker_id || null,
          broker_commission:      parseFloat(body.broker_commission || 0),
          broker_commission_type: body.broker_commission_type || 'flat',
          broker_rebate_rs:       parseFloat(body.broker_rebate_rs || 0),
          broker_rebate_sqft:     parseFloat(body.broker_rebate_sqft || 0),
          broker_rebate_pct:      parseFloat(body.broker_rebate_pct || 0),
          sales_employee_id:          body.sales_employee_id || null,
          company_inaugural_disc:     parseFloat(body.company_inaugural_disc || 0),
          company_rebate_rs:          parseFloat(body.company_rebate_rs || 0),
          company_rebate_sqft:        parseFloat(body.company_rebate_sqft || 0),
          company_rebate_pct:         parseFloat(body.company_rebate_pct || 0),
          nominee_name:       body.nominee_name, nominee_relation: body.nominee_relation,
          loan_amount:        parseFloat(body.loan_amount || 0),
          finance_bank:       body.finance_bank, remarks: body.booking_remarks,
          form_no:            body.form_no || null,
          registration_no:    body.reg_no || undefined,
          mailing_address_type: body.mailing_address_type || 'present',
          communication_mode:   body.communication_mode || 'email',
          comm_address_line1: body.comm_address_line1 || null,
          comm_pin: body.comm_pin || null, comm_city: body.comm_city || null,
          comm_state: body.comm_state || null, comm_country: body.comm_country || null,
          has_plc: body.has_plc === 'true', plc_amount: parseFloat(body.plc_amount || 0),
          has_other_charge: body.has_other_charge === 'true',
          other_charge_amount: parseFloat(body.other_charge_amount || 0),
          other_charge_desc: body.other_charge_desc || null,
          selected_plan_name: body.payment_plan || null,
          basic_price: parseFloat(body.basic_price || 0),
          carpet_area_sqft: parseFloat(body.carpet_area_sqft || 0),
          // booking_amount = 0 intentionally — signals pending_payment status
        });
        registrationNo  = bookingRes.data?.registration_no || bookingRes.registration_no || 'TBD';
        bookingRecordId = bookingRes.data?.id || bookingRes.id || null;
      } catch (err) {
        bookingCreateError = err.response?.data?.error || err.message || null;
        console.warn('Booking creation warning:', bookingCreateError);
      }

      if (!bookingRecordId) {
        Utils.error(bookingCreateError || 'Booking record could not be created. Please try again or contact support.');
        if (btn) { btn.disabled = false; btn.textContent = 'SAVE AND PROCEED'; }
        if (submitBtn) { submitBtn.disabled = false; }
        return;
      }

      // Upload primary applicant photo (non-fatal)
      if (this._selectedPhotoFile && consumer.id) {
        try {
          const fd2 = new FormData();
          fd2.append('photo', this._selectedPhotoFile);
          await Api.uploadFile(`/consumers/${consumer.id}/photo`, fd2);
        } catch (e) { console.warn('Photo upload failed (non-fatal):', e.message); }
      }

      // Upload co-applicant photo (non-fatal)
      if (this._selectedCoPhotoFile && consumer.id && applicantType === 'multiple') {
        try {
          const fd3 = new FormData();
          fd3.append('photo', this._selectedCoPhotoFile);
          await Api.uploadFile(`/consumers/${consumer.id}/co-applicant-photo`, fd3);
        } catch (e) { console.warn('Co-applicant photo upload failed (non-fatal):', e.message); }
      }

      // Save additional applicants (non-fatal)
      if (this._additionalApplicants.length > 0 && consumer.id) {
        try {
          const addlPayload = this._additionalApplicants.map(a => ({
            first_name: a.first_name, last_name: a.last_name, middle_name: a.middle_name,
            salutation: a.salutation, relation: a.relation, gender: a.gender, dob: a.dob,
            mobile: a.mobile, email: a.email, pan_no: a.pan_no, aadhaar_no: a.aadhaar_no,
          }));
          const addlRes = await Api.post(`/consumers/${consumer.id}/multi-applicants`, { applicants: addlPayload });
          const savedApplicants = addlRes.data || [];
          for (let i = 0; i < this._additionalApplicants.length; i++) {
            const photoFile = this._additionalApplicants[i]._photoFile;
            const savedRow  = savedApplicants[i];
            if (photoFile && savedRow?.id) {
              try {
                const aFd = new FormData();
                aFd.append('photo', photoFile);
                await Api.uploadFile(`/consumers/${consumer.id}/multi-applicant-photo/${savedRow.id}`, aFd);
              } catch (e) { console.warn(`Multi applicant ${i+1} photo failed:`, e.message); }
            }
          }
        } catch (e) { console.warn('Multi applicants save failed:', e.message); }
      }

      // Upload booking documents (non-fatal)
      if (bookingRecordId && consumer.id) {
        const tbody = document.getElementById('bk-doc-tbody');
        if (tbody) {
          for (const row of tbody.querySelectorAll('tr')) {
            try {
              const docNameInput = row.querySelector('[data-field="document_name"]');
              const barcodeInput = row.querySelector('[data-field="barcode_no"]');
              const storageInput = row.querySelector('[data-field="physical_storage_no"]');
              const scanInput    = row.querySelector('[data-field="scan_reference_no"]');
              const rowKey       = docNameInput?.dataset?.row;
              if (!rowKey) continue;
              const [applicantNum, ...typeParts] = rowKey.split('_');
              const docType = typeParts.join('_');
              const hasFile    = this._documentFiles?.[rowKey]?.file;
              const hasBarcode = barcodeInput?.value?.trim();
              const hasStorage = storageInput?.value?.trim();
              const hasScan    = scanInput?.value?.trim();
              const hasName    = docNameInput?.value?.trim();
              if (!hasFile && !hasBarcode && !hasStorage && !hasScan && !hasName) continue;
              const dfd = new FormData();
              dfd.append('booking_record_id', bookingRecordId);
              dfd.append('consumer_id', consumer.id);
              dfd.append('applicant_number', applicantNum || '0');
              dfd.append('document_type', docType);
              if (hasName)    dfd.append('document_name',       hasName);
              if (hasBarcode) dfd.append('barcode_no',          hasBarcode);
              if (hasStorage) dfd.append('physical_storage_no', hasStorage);
              if (hasScan)    dfd.append('scan_reference_no',   hasScan);
              if (hasFile)    dfd.append('file', this._documentFiles[rowKey].file);
              await Api.uploadFile('/booking-documents/upload', dfd);
            } catch (e) { console.warn('Document row upload failed:', e.message); Utils.warn('A booking document was not saved: ' + e.message); }
          }
        }
      }

      // Navigate to payment page (Step 2); the form is saved, so leaving it is not a loss
      const savedForm = document.getElementById('booking-form'); if (savedForm) savedForm.dataset.dirty = '';
      Router.navigate('/booking-payment', { id: bookingRecordId, reg: registrationNo });
    } catch (err) {
      const errCode = err.response?.data?.code || err.data?.code;
      if (errCode === 'DUPLICATE_CONSUMER') {
        Utils.error('A booking already exists for this mobile number in this project. Please verify the existing booking or use a different mobile number.');
      } else {
        Utils.error(err.message);
      }
      if (btn) { btn.disabled = false; btn.textContent = 'SAVE AND PROCEED'; }
      if (submitBtn) { submitBtn.disabled = false; }
    }
  },

  async confirmSubmit() {
    document.getElementById('bk-preview-overlay')?.remove();
    const body = this._bookingData;

    const formNoErr = document.getElementById('bk-form-no-err');
    if (formNoErr && formNoErr.style.display !== 'none' && formNoErr.textContent.trim()) {
      document.getElementById('bk-form-no')?.focus();
      return;
    }

    // Validate cheque/reference uniqueness before submitting
    const refOk = await this.validateChequeRef();
    if (!refOk) {
      return;
    }

    const btn = document.getElementById('bk-submit-btn');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
      const applicantType = this._applicantType || 'individual';

      // Step 1: Create consumer
      const consumerRes = await Api.post('/consumers', {
        applicant_type: applicantType,
        first_name: body.first_name,
        last_name: body.last_name,
        name: applicantType === 'company'
          ? (body.company_name || 'Company')
          : `${body.first_name||''} ${body.last_name||''}`.trim(),
        email: body.email,
        mobile: body.mobile,
        project_id: body.project_id || null,
        income_category: body.income_category || document.querySelector('select[name="income_category"] option:nth-child(2)')?.value || 'EWS',
        middle_name: body.middle_name || null,
        dob: body.dob || null,
        gender: body.gender || null,
        education: body.education || null,
        alt_mobile: body.alt_mobile || null,
        pan_no: body.pan_no,
        aadhaar_no: body.aadhaar_no,
        ppp_id: body.ppp_id || null,
        lead_stage: 'enquiry',
        source_of_enquiry: body.source_of_enquiry,
        nationality: body.nationality,
        profession: body.profession,
        salutation: body.salutation,
        annual_income: body.annual_income ? parseFloat(body.annual_income) : null,
        company: body.company,
        form_no: body.form_no || null,
        // New legacy applicant fields
        father_name:      body.father_name || null,
        anniversary_date: body.anniversary_date || null,
        marital_status:   body.marital_status || 'not_specified',
        no_of_children:   body.no_of_children ? parseInt(body.no_of_children) : 0,
        passport_no:      body.passport_no || null,
        email_2:          body.email_2 || null,
        designation:      body.designation || null,
        has_poa:          body.has_poa === 'true',
        // Company applicant fields
        company_name: body.company_name || null,
        company_reg_no: body.company_reg_no || null,
        company_gstin: body.company_gstin || null,
        authorized_person: body.authorized_person || null,
        authorized_designation: body.authorized_designation || null,
        // Co-applicant fields (for multiple type)
        co_applicant_first_name:       body.co_first_name || null,
        co_applicant_last_name:        body.co_last_name || null,
        co_applicant_salutation:       body.co_salutation || null,
        co_applicant_pan_no:           body.co_pan_no || null,
        co_applicant_aadhaar_no:       body.co_aadhaar_no || null,
        co_applicant_mobile:           body.co_mobile || null,
        co_applicant_email:            body.co_email || null,
        co_applicant_dob:              body.co_dob || null,
        co_applicant_relation:         body.co_relation || null,
        co_applicant_middle_name:      body.co_middle_name || null,
        co_applicant_gender:           body.co_gender || null,
        co_applicant_father_name:      body.co_father_name || null,
        co_applicant_anniversary_date: body.co_anniversary_date || null,
        co_applicant_marital_status:   body.co_marital_status || 'not_specified',
        co_applicant_no_of_children:   body.co_no_of_children ? parseInt(body.co_no_of_children) : 0,
        co_applicant_passport_no:      body.co_passport_no || null,
        co_applicant_email_2:          body.co_email_2 || null,
        co_applicant_designation:      body.co_designation || null,
        co_applicant_has_poa:          body.co_has_poa === 'true',
        co_applicant_nationality:      body.co_nationality || null,
        co_applicant_profession:       body.co_profession || null,
        // Co-applicant type + address (migration 041)
        co_applicant_type:             body.co_applicant_type || 'co_applicant',
        co_present_address:            body.co_present_address || null,
        co_present_city:               body.co_present_city || null,
        co_present_state:              body.co_present_state || null,
        co_present_pin:                body.co_present_pin || null,
        co_present_country:            body.co_present_country || 'India',
        co_present_phone_no:           body.co_present_phone_no || null,
        co_present_fax_no:             body.co_present_fax_no || null,
        co_present_mobile_no:          body.co_present_mobile_no || null,
        co_office_address:             body.co_office_address || null,
        co_office_city:                body.co_office_city || null,
        co_office_state:               body.co_office_state || null,
        co_office_pin:                 body.co_office_pin || null,
        co_office_country:             body.co_office_country || 'India',
        co_office_phone_no:            body.co_office_phone_no || null,
        co_office_fax_no:              body.co_office_fax_no || null,
        co_office_mobile_no:           body.co_office_mobile_no || null,
        co_perm_address:               body.co_perm_address || null,
        co_perm_city:                  body.co_perm_city || null,
        co_perm_state:                 body.co_perm_state || null,
        co_perm_pin:                   body.co_perm_pin || null,
        co_perm_country:               body.co_perm_country || 'India',
        co_perm_phone_no:              body.co_perm_phone_no || null,
        co_perm_fax_no:                body.co_perm_fax_no || null,
        co_perm_mobile_no:             body.co_perm_mobile_no || null,
        co_mailing_address_type:       body.co_mailing_address_type || 'present',
        co_communication_mode:         body.co_communication_mode || 'email',
        // First applicant address (migration 041)
        present_address_line1:         body.present_address_line1 || null,
        present_address_line2:         body.present_address_line2 || null,
        present_city:                  body.present_city || null,
        present_state:                 body.present_state || null,
        present_pin:                   body.present_pin || null,
        present_country:               body.present_country || 'India',
        present_phone_no:              body.present_phone_no || null,
        present_fax_no:                body.present_fax_no || null,
        present_mobile_no:             body.present_mobile_no || null,
        office_address_line1:          body.office_address_line1 || null,
        office_city:                   body.office_city || null,
        office_state:                  body.office_state || null,
        office_pin:                    body.office_pin || null,
        office_country:                body.office_country || 'India',
        office_phone_no:               body.office_phone_no || null,
        office_fax_no:                 body.office_fax_no || null,
        office_mobile_no:              body.office_mobile_no || null,
        perm_address_line1:            body.perm_address_line1 || null,
        perm_city:                     body.perm_city || null,
        perm_state:                    body.perm_state || null,
        perm_pin:                      body.perm_pin || null,
        perm_country:                  body.perm_country || 'India',
        perm_phone_no:                 body.perm_phone_no || null,
        perm_fax_no:                   body.perm_fax_no || null,
        perm_mobile_no:                body.perm_mobile_no || null,
        phone_no:                      body.phone_no || null,
        fax_no:                        body.fax_no || null,
      });
      const consumer = consumerRes.data || consumerRes;

      // Step 2: Create booking form record
      let registrationNo  = 'TBD';
      let bookingRecordId = null;
      let bookingCreateError = null;
      try {
        const bookingRes = await Api.post('/booking', {
          consumer_id:       consumer.id,
          project_id:        body.project_id,
          unit_id:           body.unit_id || null,
          booking_date:      body.booking_date,
          booking_amount:    parseFloat(body.booking_amount || 0),
          payment_mode:      body.payment_mode,
          payment_ref:       body.payment_ref,
          bank_name:         body.bank_name,
          cheque_date:       body.cheque_date || null,
          booking_type:          body.booking_type || 'direct',
          broker_id:             body.broker_id || null,
          main_broker_id:        body.main_broker_id || null,
          broker_commission:     parseFloat(body.broker_commission || 0),
          broker_commission_type:body.broker_commission_type || 'flat',
          broker_rebate_rs:      parseFloat(body.broker_rebate_rs || 0),
          broker_rebate_sqft:    parseFloat(body.broker_rebate_sqft || 0),
          broker_rebate_pct:     parseFloat(body.broker_rebate_pct || 0),
          sales_employee_id:         body.sales_employee_id || null,
          company_inaugural_disc:    parseFloat(body.company_inaugural_disc || 0),
          company_rebate_rs:         parseFloat(body.company_rebate_rs || 0),
          company_rebate_sqft:       parseFloat(body.company_rebate_sqft || 0),
          company_rebate_pct:        parseFloat(body.company_rebate_pct || 0),
          nominee_name:              body.nominee_name,
          nominee_relation:  body.nominee_relation,
          loan_amount:       parseFloat(body.loan_amount || 0),
          finance_bank:      body.finance_bank,
          remarks:           body.booking_remarks,
          form_no:           body.form_no || null,
          registration_no:   body.reg_no || undefined,
          mailing_address_type:  body.mailing_address_type || 'present',
          communication_mode:    body.communication_mode || 'email',
          comm_address_line1:    body.comm_address_line1 || null,
          comm_pin:              body.comm_pin || null,
          comm_city:             body.comm_city || null,
          comm_state:            body.comm_state || null,
          comm_country:          body.comm_country || null,
          has_plc:               body.has_plc === 'true',
          plc_amount:            parseFloat(body.plc_amount || 0),
          has_other_charge:      body.has_other_charge === 'true',
          other_charge_amount:   parseFloat(body.other_charge_amount || 0),
          other_charge_desc:     body.other_charge_desc || null,
          selected_plan_name:    body.payment_plan || null,
          // Payment detail fields (migration 042)
          bank_branch:              body.bank_branch || null,
          received_for:             body.received_for || null,
          account_holder:           body.account_holder || null,
          on_account_of:            body.on_account_of || 'Booking',
          invoice_date_by:          body.invoice_date_by || 'receipt_date',
          interest_type:            body.interest_type || 'exclusive',
          extra_add_on_type:        body.extra_add_on_type || 'exclusive',
          tds_type:                 body.tds_type || 'not_calculate',
          self_or_loan:             body.self_or_loan || 'self',
          interest_amount:          parseFloat(body.interest_amount || 0),
          dealer_adjustment_amount: parseFloat(body.dealer_adjustment_amount || 0),
          // Tax values
          s_tax_pct:   parseFloat(body.s_tax_pct || 0),
          cgst_pct:    parseFloat(body.cgst_pct || 0),
          sgst_pct:    parseFloat(body.sgst_pct || 0),
          gst_interest_pct: parseFloat(body.gst_interest_pct || 0),
          cgst_amount: parseFloat(body.cgst_amount || 0),
          sgst_amount: parseFloat(body.sgst_amount || 0),
          tds_amount:  parseFloat(body.tds_amount || 0),
          basic_price: parseFloat(body.basic_price || 0),
          carpet_area_sqft: parseFloat(body.carpet_area_sqft || 0),
        });
        registrationNo  = bookingRes.data?.registration_no || bookingRes.registration_no || 'TBD';
        bookingRecordId = bookingRes.data?.id || bookingRes.id || null;
      } catch (err) {
        bookingCreateError = err.response?.data?.error || err.message || null;
        console.warn('Booking creation warning:', bookingCreateError);
      }

      if (!bookingRecordId) {
        Utils.error(bookingCreateError || 'Booking record could not be created. Please try again or contact support.');
        if (btn) { btn.disabled = false; btn.textContent = 'Confirm & Submit'; }
        return;
      }

      // Upload primary applicant photo if one was selected
      if (this._selectedPhotoFile && consumer.id) {
        try {
          const fd = new FormData();
          fd.append('photo', this._selectedPhotoFile);
          await Api.uploadFile(`/consumers/${consumer.id}/photo`, fd);
        } catch (photoErr) {
          console.warn('Photo upload failed (non-fatal):', photoErr.message);
        }
      }

      // Upload co-applicant photo if one was selected
      if (this._selectedCoPhotoFile && consumer.id && (this._applicantType === 'multiple')) {
        try {
          const coFd = new FormData();
          coFd.append('photo', this._selectedCoPhotoFile);
          await Api.uploadFile(`/consumers/${consumer.id}/co-applicant-photo`, coFd);
        } catch (coPhotoErr) {
          console.warn('Co-applicant photo upload failed (non-fatal):', coPhotoErr.message);
        }
      }

      // Save multi applicants (applicant_number >= 2)
      if (this._additionalApplicants.length > 0 && consumer.id) {
        try {
          const addlPayload = this._additionalApplicants.map(a => ({
            first_name:       a.first_name,
            last_name:        a.last_name,
            middle_name:      a.middle_name,
            salutation:       a.salutation,
            relation:         a.relation,
            gender:           a.gender,
            dob:              a.dob,
            mobile:           a.mobile,
            email:            a.email,
            email_2:          a.email_2,
            pan_no:           a.pan_no,
            aadhaar_no:       a.aadhaar_no,
            father_name:      a.father_name,
            passport_no:      a.passport_no,
            designation:      a.designation,
            profession:       a.profession,
            nationality:      a.nationality,
            marital_status:   a.marital_status,
            anniversary_date: a.anniversary_date,
            no_of_children:   a.no_of_children,
            has_poa:          a.has_poa,
          }));
          const addlRes = await Api.post(`/consumers/${consumer.id}/multi-applicants`, { applicants: addlPayload });
          const savedApplicants = addlRes.data || [];
          // Upload photos for each multi applicant that has one
          for (let i = 0; i < this._additionalApplicants.length; i++) {
            const photoFile = this._additionalApplicants[i]._photoFile;
            const savedRow  = savedApplicants[i];
            if (photoFile && savedRow?.id) {
              try {
                const addlFd = new FormData();
                addlFd.append('photo', photoFile);
                await Api.uploadFile(`/consumers/${consumer.id}/multi-applicant-photo/${savedRow.id}`, addlFd);
              } catch (addlPhotoErr) {
                console.warn(`Multi applicant ${i+1} photo upload failed (non-fatal):`, addlPhotoErr.message);
              }
            }
          }
        } catch (addlErr) {
          console.warn('Multi applicants save failed:', addlErr.message);
          Utils.error('Multi applicants could not be saved. The main booking was recorded. Please re-add them from the consumer profile.');
        }
      }

      // Upload booking documents (non-fatal per row)
      if (bookingRecordId && consumer.id) {
        const tbody = document.getElementById('bk-doc-tbody');
        if (tbody) {
          const rows = tbody.querySelectorAll('tr');
          for (const row of rows) {
            try {
              const docNameInput  = row.querySelector('[data-field="document_name"]');
              const barcodeInput  = row.querySelector('[data-field="barcode_no"]');
              const storageInput  = row.querySelector('[data-field="physical_storage_no"]');
              const scanInput     = row.querySelector('[data-field="scan_reference_no"]');
              const rowKey        = docNameInput?.dataset?.row;
              if (!rowKey) continue;

              const [applicantNum, ...typeParts] = rowKey.split('_');
              const docType = typeParts.join('_');

              const hasFile    = this._documentFiles?.[rowKey]?.file;
              const hasBarcode = barcodeInput?.value?.trim();
              const hasStorage = storageInput?.value?.trim();
              const hasScan    = scanInput?.value?.trim();
              const hasName    = docNameInput?.value?.trim();
              if (!hasFile && !hasBarcode && !hasStorage && !hasScan && !hasName) continue;

              const fd = new FormData();
              fd.append('booking_record_id',   bookingRecordId);
              fd.append('consumer_id',         consumer.id);
              fd.append('applicant_number',    applicantNum || '0');
              fd.append('document_type',       docType);
              if (hasName)    fd.append('document_name',       hasName);
              if (hasBarcode) fd.append('barcode_no',          hasBarcode);
              if (hasStorage) fd.append('physical_storage_no', hasStorage);
              if (hasScan)    fd.append('scan_reference_no',   hasScan);
              if (hasFile)    fd.append('file', this._documentFiles[rowKey].file);

              await Api.uploadFile('/booking-documents/upload', fd);
            } catch (docErr) {
              console.warn('Document row upload failed:', docErr.message);
              Utils.warn('A booking document was not saved: ' + docErr.message);
            }
          }
        }
      }

      // Update the registration number field in the form
      const regNoField = document.querySelector('[name="reg_no"]');
      if (regNoField) regNoField.value = registrationNo;

      // Show confirmation modal with booking details
      BookingPage.showBookingConfirmation({
        registration_no: registrationNo,
        form_no: body.form_no || registrationNo,
        consumer_id: consumer.id,
        consumer_name: `${body.first_name || ''} ${body.last_name || ''}`.trim() || 'N/A',
        booking_date: body.booking_date || Utils.today()
      });
    } catch (err) {
      Utils.error(err.message);
      btn.disabled = false;
      btn.textContent = '💾 Save Booking';
    }
  },

  showBookingConfirmation(data) {
    const formatDate = (dateStr) => {
      if (!dateStr) return 'N/A';
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `;

    const consumerIdSafe = (data.consumer_id || '').replace(/'/g, '');

    modal.innerHTML = `
      <div style="
        background: white;
        border-radius: 12px;
        padding: 40px;
        max-width: 500px;
        width: 90%;
        text-align: center;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        position: relative;
      ">
        <button id="bk-confirm-close" style="
          position: absolute;
          top: 16px;
          right: 16px;
          background: none;
          border: none;
          font-size: 24px;
          color: #94a3b8;
          cursor: pointer;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: background 0.2s;
          line-height: 1;
        " onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='none'">&#x2715;</button>

        <div style="
          width: 60px; height: 60px;
          background: #22c55e;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          font-size: 28px;
          color: white;
        ">✓</div>

        <h2 style="
          color: #1e293b;
          font-size: 24px;
          margin-bottom: 8px;
        ">Booking Confirmed!</h2>

        <p style="
          color: #64748b;
          margin-bottom: 30px;
        ">Application has been successfully registered</p>

        <div style="
          background: #f8fafc;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 24px;
          text-align: left;
        ">
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0;">
            <span style="color:#64748b;font-weight:500">Registration No.</span>
            <span style="color:#2563eb;font-weight:700;font-size:18px;">${data.registration_no || 'N/A'}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0;">
            <span style="color:#64748b;font-weight:500">Form No.</span>
            <span style="color:#0f172a;font-weight:600;">${data.form_no || 'N/A'}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0;">
            <span style="color:#64748b;font-weight:500">Applicant Name</span>
            <span style="color:#0f172a;font-weight:600;">${data.consumer_name || 'N/A'}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0;">
            <span style="color:#64748b;font-weight:500">Booking Date</span>
            <span style="color:#0f172a;font-weight:600;">${formatDate(data.booking_date)}</span>
          </div>
        </div>

        <div style="display:flex;gap:12px;justify-content:center;">
          <button id="bk-view-profile-btn" data-id="${consumerIdSafe}" style="
            background: #2563eb;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
          ">View Consumer Profile</button>

          <button id="bk-new-booking-btn" style="
            background: #f1f5f9;
            color: #475569;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
          ">New Booking</button>
        </div>
      </div>
    `;

    const closeModal = () => {
      modal.remove();
      document.removeEventListener('keydown', escHandler);
    };

    const escHandler = (e) => {
      if (e.key === 'Escape') closeModal();
    };

    document.addEventListener('keydown', escHandler);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    document.body.appendChild(modal);

    document.getElementById('bk-confirm-close').addEventListener('click', closeModal);

    document.getElementById('bk-view-profile-btn').addEventListener('click', () => {
      closeModal();
      window.location.hash = `#/consumer?id=${consumerIdSafe}`;
    });

    document.getElementById('bk-new-booking-btn').addEventListener('click', () => {
      closeModal();
      window.location.hash = '#/booking';
    });
  },
};

window.BookingPage = BookingPage;
