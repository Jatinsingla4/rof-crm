// ROF CRM — Edit Booking Form Page

(() => {

  const EB_STATES = [
    'Haryana','Delhi','Uttar Pradesh','Rajasthan','Punjab','Maharashtra',
    'Karnataka','Tamil Nadu','Gujarat','Madhya Pradesh','West Bengal',
    'Telangana','Himachal Pradesh','Uttarakhand'
  ];

  let _view = 'search';
  let _bookings = [];
  let _bookingId = null;
  let _consumerId = null;
  let _bookingData = null;
  let _consumerData = null;
  let _brokers = [];
  let _users = [];

  const EB_STYLES = `<style id="eb-styles">
.eb-page { padding: 0; max-width: 1100px; margin: 0 auto; font-size: 13px; }
.eb-card { background: var(--surface); border: 1px solid var(--border2); border-radius: 10px; margin-bottom: 14px; overflow: hidden; }
.eb-hdr {
  display: flex; justify-content: space-between; align-items: center;
  background: var(--teal-bg); padding: 14px 18px; border-bottom: 1px solid var(--border);
}
.eb-hdr-title { color: var(--text); font-size: 12px; font-weight: 600; letter-spacing: .6px; text-transform: uppercase; }
.eb-body { padding: 18px; }
.eb-filter-row {
  display: flex; align-items: flex-end; gap: 16px;
  margin-bottom: 4px; flex-wrap: wrap;
}
.eb-field { display: flex; flex-direction: column; gap: 6px; }
.eb-lbl { font-size: 11px; color: var(--text2); letter-spacing: .3px; white-space: nowrap; }
.eb-field select,
.eb-field input[type="text"],
.eb-field input[type="date"],
.eb-field input[type="number"],
.eb-field textarea {
  padding: 9px 12px; border: 1px solid var(--border2); border-radius: 8px;
  font-size: 13px; box-sizing: border-box; min-height: 38px;
  background: var(--surface); color: var(--text);
}
.eb-field select:focus, .eb-field input:focus, .eb-field textarea:focus,
.eb-fc:focus { outline: none; border-color: var(--teal); box-shadow: 0 0 0 3px var(--teal-bg); }
.eb-field select           { min-width: 200px; }
.eb-field input[type="text"],
.eb-field input[type="date"] { min-width: 170px; }
.eb-btn {
  background: var(--teal); color: #fff; border: none;
  padding: 9px 26px; border-radius: 8px; font-size: 12.5px;
  font-weight: 600; cursor: pointer; align-self: flex-end; min-height: 38px;
}
.eb-btn:hover    { filter: brightness(.92); }
.eb-btn:disabled { opacity: .7; cursor: not-allowed; }
.eb-btn-sec {
  background: var(--surface); color: var(--text2); border: 1px solid var(--border2);
  padding: 9px 26px; border-radius: 8px; font-size: 12.5px;
  font-weight: 600; cursor: pointer; min-height: 38px;
}
.eb-btn-sec:hover { background: var(--surface2); }
.eb-msg { margin-top: 12px; font-size: 13px; padding: 8px 12px; border-radius: 8px; }
.eb-msg-err { background: var(--red-bg); color: var(--red); border: 1px solid var(--red); }
.eb-msg-ok  { background: var(--teal-bg); color: var(--teal); border: 1px solid var(--teal); }
.eb-table-wrap { overflow-x: auto; border: 1px solid var(--border2); border-radius: 10px; }
table.eb-tbl { width: 100%; border-collapse: collapse; font-size: 12.5px; }
table.eb-tbl th {
  background: var(--surface2); color: var(--text3); padding: 10px 14px; text-align: left;
  font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .4px;
  white-space: nowrap; border-bottom: 1px solid var(--border2);
}
table.eb-tbl td {
  padding: 10px 14px; border-bottom: 1px solid var(--border);
  color: var(--text); white-space: nowrap; vertical-align: middle;
}
table.eb-tbl tbody tr:last-child td { border-bottom: none; }
table.eb-tbl tbody tr:hover td { background: var(--surface2); }
.eb-edit-link {
  color: var(--teal); cursor: pointer; text-decoration: none;
  font-weight: 600; font-size: 12px; padding: 3px 10px; border-radius: 6px;
  border: 1px solid var(--teal); display: inline-block;
}
.eb-edit-link:hover { background: var(--teal-bg); }
.eb-back {
  color: var(--teal); cursor: pointer; font-size: 18px;
  font-weight: bold; margin-right: 10px; vertical-align: middle;
  text-decoration: none; display: inline-block; width: 28px; height: 28px; line-height: 26px;
  text-align: center; border-radius: 8px;
}
.eb-back:hover { background: var(--teal-bg); }
.eb-sec-hdr {
  background: var(--surface2); color: var(--text); padding: 12px 18px;
  font-size: 12px; font-weight: 600; letter-spacing: .6px; text-transform: uppercase;
  border: 1px solid var(--border2); border-bottom: 1px solid var(--border);
  border-radius: 10px 10px 0 0; margin: 0;
}
.eb-sec-body {
  background: var(--surface); border: 1px solid var(--border2); border-top: none;
  padding: 18px; border-radius: 0 0 10px 10px; margin-bottom: 14px;
}
.eb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px 18px;
}
.eb-fg { display: flex; flex-direction: column; gap: 6px; }
.eb-fl { font-size: 11px; color: var(--text2); letter-spacing: .3px; }
.eb-fc {
  padding: 9px 12px; border: 1px solid var(--border2); border-radius: 8px;
  font-size: 13px; box-sizing: border-box; width: 100%; min-height: 38px;
  background: var(--surface); color: var(--text);
}
.eb-fc-ro {
  padding: 9px 12px; border: 1px solid var(--border); border-radius: 8px;
  font-size: 13px; box-sizing: border-box; width: 100%; min-height: 38px;
  background: var(--surface2); color: var(--text2); cursor: default;
}
.eb-btn-row {
  display: flex; gap: 10px; margin-top: 18px;
  padding: 14px 0 0; border-top: 1px solid var(--border);
}
.eb-banner {
  border-radius: 8px; padding: 10px 14px; margin-bottom: 14px;
  font-size: 13px; font-weight: 600; display: none;
}
.eb-banner-ok  { background: var(--teal-bg); color: var(--teal); border: 1px solid var(--teal); display: block; }
.eb-banner-err { background: var(--red-bg); color: var(--red); border: 1px solid var(--red); display: block; }
.eb-btg { display: flex; border: 1px solid var(--border2); border-radius: 8px; overflow: hidden; width: 220px; }
.eb-btg-item {
  flex: 1; padding: 8px 10px; background: var(--surface); color: var(--text2);
  border: none; cursor: pointer; font-size: 12px;
}
.eb-btg-item.on { background: var(--teal); color: #fff; font-weight: 600; }
</style>`;

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _val(v) { return v == null ? '' : v; }

  function _toDateInput(val) {
    if (!val) return '';
    var d = new Date(val);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-'
      + String(d.getMonth() + 1).padStart(2, '0') + '-'
      + String(d.getDate()).padStart(2, '0');
  }

  function _renderSearchView() {
    return `
<div class="eb-page">
  <div class="eb-card">
    <div class="eb-hdr">
      <span class="eb-hdr-title">EDIT APPLICANT</span>
    </div>
    <div class="eb-body">
      <div class="eb-filter-row">
        <div class="eb-field">
          <span class="eb-lbl">* Project</span>
          <select id="eb-project">
            <option value="">&lt;--Select--&gt;</option>
          </select>
        </div>
        <div class="eb-field">
          <span class="eb-lbl">Registration No</span>
          <input type="text" id="eb-regno" placeholder="Search...">
        </div>
        <div class="eb-field">
          <span class="eb-lbl">First Name</span>
          <input type="text" id="eb-fname" placeholder="Search...">
        </div>
        <div class="eb-field">
          <span class="eb-lbl">Unit No</span>
          <input type="text" id="eb-unitno" placeholder="Search...">
        </div>
        <button class="eb-btn" id="eb-fetch-btn"
                onclick="EditBooking.fetch()">FETCH</button>
      </div>
      <div id="eb-msg"></div>
    </div>
  </div>

  <div class="eb-card" id="eb-results-card" style="display:none">
    <div class="eb-hdr">
      <span class="eb-hdr-title">RESULTS</span>
    </div>
    <div class="eb-body">
      <div id="eb-count"
           style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:12px;"></div>
      <div class="eb-table-wrap">
        <table class="eb-tbl">
          <thead>
            <tr>
              <th>S.NO</th>
              <th>REGISTRATION NO</th>
              <th>NAME</th>
              <th>UNIT NO</th>
              <th>BOOKING DATE</th>
              <th>STATUS</th>
              <th>EDIT</th>
            </tr>
          </thead>
          <tbody id="eb-tbody"></tbody>
        </table>
      </div>
    </div>
  </div>
</div>`;
  }

  function _renderEditView() {
    var b = _bookingData || {};
    var c = _consumerData || {};

    var stateOpts = '<option value="">— Select —</option>'
      + EB_STATES.map(function(s) {
          return '<option' + (c.present_state === s ? ' selected' : '') + '>'
            + s + '</option>';
        }).join('');

    var brokerOpts = '<option value="">— No Broker —</option>'
      + _brokers.map(function(br) {
          return '<option value="' + _esc(br.id) + '"'
            + (b.broker_id === br.id ? ' selected' : '') + '>'
            + _esc(br.firm_name || br.name || br.id) + '</option>';
        }).join('');

    var mainBrokerOpts = '<option value="">— None —</option>'
      + _brokers.map(function(br) {
          return '<option value="' + _esc(br.id) + '"'
            + (b.main_broker_id === br.id ? ' selected' : '') + '>'
            + _esc(br.firm_name || br.name || br.id) + '</option>';
        }).join('');

    var empOpts = '<option value="">— Select —</option>'
      + _users.map(function(u) {
          return '<option value="' + _esc(u.id) + '"'
            + (b.sales_employee_id === u.id ? ' selected' : '') + '>'
            + _esc(u.name) + '</option>';
        }).join('');

    var salutOpts = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'M/s'].map(function(s) {
      return '<option' + (c.salutation === s ? ' selected' : '') + '>' + s + '</option>';
    }).join('');

    var commStateOpts = '<option value="">— Select —</option>'
      + EB_STATES.map(function(s) {
          return '<option' + (c.comm_state === s ? ' selected' : '') + '>'
            + s + '</option>';
        }).join('');

    var isBroker = (b.booking_type === 'broker');

    return `
<div class="eb-page">
  <div id="eb-banner" class="eb-banner"></div>

  <!-- SECTION 1: UNIT INFORMATION -->
  <div>
    <div class="eb-sec-hdr">
      <span class="eb-back" onclick="EditBooking.back()" title="Back to search">&larr;</span>
      UNIT INFORMATION
    </div>
    <div class="eb-sec-body">
      <div class="eb-grid">
        <div class="eb-fg">
          <label class="eb-fl">Project</label>
          <input class="eb-fc-ro" value="${_esc(b.project_name || '')}" readonly>
        </div>
        <div class="eb-fg">
          <label class="eb-fl">Unit No</label>
          <input class="eb-fc-ro" value="${_esc(b.unit_number || '')}" readonly>
        </div>
        <div class="eb-fg">
          <label class="eb-fl">Registration No</label>
          <input class="eb-fc-ro" value="${_esc(b.registration_no || '')}" readonly>
        </div>
        <div class="eb-fg">
          <label class="eb-fl">Payment Plan</label>
          <input class="eb-fc-ro" value="${_esc(b.selected_plan_name || '')}" readonly>
        </div>
        <div class="eb-fg">
          <label class="eb-fl">Status</label>
          <input class="eb-fc-ro" value="${_esc(b.status || '')}" readonly>
        </div>
        <div class="eb-fg">
          <label class="eb-fl">Customer Classification</label>
          <select id="eb-customer-classification" class="eb-fc">
            <option value="">— Select —</option>
            <option${c.income_category === 'EWS' ? ' selected' : ''}>EWS</option>
            <option${c.income_category === 'LIG' ? ' selected' : ''}>LIG</option>
            <option${c.income_category === 'MIG' ? ' selected' : ''}>MIG</option>
          </select>
        </div>
        <div class="eb-fg">
          <label class="eb-fl">Booking Date</label>
          <input type="date" id="eb-booking-date" class="eb-fc"
                 value="${_toDateInput(b.booking_date)}">
        </div>
        <div class="eb-fg">
          <label class="eb-fl">Basic Price Rs./SqFt</label>
          <input type="number" id="eb-basic-rate" class="eb-fc"
                 value="${_val(b.basic_rate_inr_sqft)}" min="0" step="0.01"
                 readonly style="background:var(--surface2);color:var(--text2);">
          <small style="color:var(--text3);font-size:10px">Locked after booking. Contact admin for revision.</small>
        </div>
        <div class="eb-fg">
          <label class="eb-fl">Carpet Area (SqFt)</label>
          <input type="number" id="eb-carpet-area" class="eb-fc"
                 value="${_val(b.carpet_area_sqft)}" min="0" step="0.01"
                 readonly style="background:var(--surface2);color:var(--text2);">
          <small style="color:var(--text3);font-size:10px">Locked after booking. Contact admin for revision.</small>
        </div>
        <div class="eb-fg">
          <label class="eb-fl">Form No</label>
          <input type="text" id="eb-form-no" class="eb-fc"
                 value="${_esc(b.form_no || '')}">
        </div>
      </div>
    </div>
  </div>

  <!-- SECTION 2: COMPANY DISCOUNT -->
  <div>
    <div class="eb-sec-hdr">COMPANY DISCOUNT</div>
    <div class="eb-sec-body">
      <div class="eb-grid">
        <div class="eb-fg">
          <label class="eb-fl">Inaugural Discount (Rs.)</label>
          <input type="number" id="eb-inaugural-disc" class="eb-fc"
                 value="${_val(b.company_inaugural_disc)}" min="0" step="0.01">
        </div>
        <div class="eb-fg">
          <label class="eb-fl">Rebate Rs.</label>
          <input type="number" id="eb-rebate-rs" class="eb-fc"
                 value="${_val(b.company_rebate_rs)}" min="0" step="0.01">
        </div>
        <div class="eb-fg">
          <label class="eb-fl">Rebate Per SqFt</label>
          <input type="number" id="eb-rebate-sqft" class="eb-fc"
                 value="${_val(b.company_rebate_sqft)}" min="0" step="0.01">
        </div>
        <div class="eb-fg">
          <label class="eb-fl">Rebate %</label>
          <input type="number" id="eb-rebate-pct" class="eb-fc"
                 value="${_val(b.company_rebate_pct)}" min="0" step="0.01">
        </div>
      </div>
    </div>
  </div>

  <!-- SECTION 3: BROKER -->
  <div>
    <div class="eb-sec-hdr">BROKER</div>
    <div class="eb-sec-body">
      <div style="margin-bottom:10px">
        <span style="font-size:11px;color:var(--text2);margin-right:8px">Booking Type:</span>
        <div class="eb-btg" style="display:inline-flex">
          <button type="button" class="eb-btg-item${isBroker ? ' on' : ''}"
                  id="eb-type-broker"
                  onclick="EditBooking.setBookingType('broker')">Broker</button>
          <button type="button" class="eb-btg-item${!isBroker ? ' on' : ''}"
                  id="eb-type-direct"
                  onclick="EditBooking.setBookingType('direct')">Direct</button>
        </div>
        <input type="hidden" id="eb-booking-type"
               value="${_esc(b.booking_type || 'direct')}">
      </div>
      <div class="eb-grid" id="eb-broker-fields"
           style="${isBroker ? '' : 'display:none'}">
        <div class="eb-fg">
          <label class="eb-fl">Broker</label>
          <select id="eb-broker-id" class="eb-fc">${brokerOpts}</select>
        </div>
        <div class="eb-fg">
          <label class="eb-fl">Main Broker</label>
          <select id="eb-main-broker-id" class="eb-fc">${mainBrokerOpts}</select>
        </div>
        <div class="eb-fg">
          <label class="eb-fl">Commission</label>
          <input type="number" id="eb-broker-commission" class="eb-fc"
                 value="${_val(b.broker_commission)}" min="0" step="0.01">
        </div>
        <div class="eb-fg">
          <label class="eb-fl">Commission Type</label>
          <select id="eb-broker-commission-type" class="eb-fc">
            <option value="flat"${b.broker_commission_type === 'flat' ? ' selected' : ''}>Flat</option>
            <option value="percentage"${b.broker_commission_type === 'percentage' ? ' selected' : ''}>Percentage</option>
          </select>
        </div>
        <div class="eb-fg">
          <label class="eb-fl">Broker Rebate Rs.</label>
          <input type="number" id="eb-broker-rebate-rs" class="eb-fc"
                 value="${_val(b.broker_rebate_rs)}" min="0" step="0.01">
        </div>
        <div class="eb-fg">
          <label class="eb-fl">Broker Rebate SqFt</label>
          <input type="number" id="eb-broker-rebate-sqft" class="eb-fc"
                 value="${_val(b.broker_rebate_sqft)}" min="0" step="0.01">
        </div>
        <div class="eb-fg">
          <label class="eb-fl">Broker Rebate %</label>
          <input type="number" id="eb-broker-rebate-pct" class="eb-fc"
                 value="${_val(b.broker_rebate_pct)}" min="0" step="0.01">
        </div>
      </div>
    </div>
  </div>

  <!-- SECTION 4: EMPLOYEE -->
  <div>
    <div class="eb-sec-hdr">EMPLOYEE</div>
    <div class="eb-sec-body">
      <div class="eb-grid">
        <div class="eb-fg">
          <label class="eb-fl">Sales Person</label>
          <select id="eb-sales-emp" class="eb-fc">${empOpts}</select>
        </div>
        <div class="eb-fg" style="grid-column: span 2">
          <label class="eb-fl">Remarks</label>
          <textarea id="eb-remarks" class="eb-fc"
                    rows="2">${_esc(b.remarks || '')}</textarea>
        </div>
      </div>
    </div>
  </div>

  <!-- SECTION 5: FIRST APPLICANT DETAILS -->
  <div>
    <div class="eb-sec-hdr">FIRST APPLICANT DETAILS</div>
    <div class="eb-sec-body">
      <div class="eb-grid">
        <div class="eb-fg">
          <label class="eb-fl">Salutation</label>
          <select id="eb-salutation" class="eb-fc">
            <option value="">— Select —</option>
            ${salutOpts}
          </select>
        </div>
        <div class="eb-fg">
          <label class="eb-fl">* First Name</label>
          <input type="text" id="eb-first-name" class="eb-fc"
                 value="${_esc(c.first_name || '')}">
        </div>
        <div class="eb-fg">
          <label class="eb-fl">Middle Name</label>
          <input type="text" id="eb-middle-name" class="eb-fc"
                 value="${_esc(c.middle_name || '')}">
        </div>
        <div class="eb-fg">
          <label class="eb-fl">* Last Name</label>
          <input type="text" id="eb-last-name" class="eb-fc"
                 value="${_esc(c.last_name || '')}">
        </div>
        <div class="eb-fg">
          <label class="eb-fl">Father Name</label>
          <input type="text" id="eb-father-name" class="eb-fc"
                 value="${_esc(c.father_name || '')}">
        </div>
        <div class="eb-fg">
          <label class="eb-fl">Date of Birth</label>
          <input type="date" id="eb-dob" class="eb-fc"
                 value="${_toDateInput(c.dob)}">
        </div>
        <div class="eb-fg">
          <label class="eb-fl">Gender</label>
          <select id="eb-gender" class="eb-fc">
            <option value="">— Select —</option>
            <option${c.gender === 'Male'   ? ' selected' : ''}>Male</option>
            <option${c.gender === 'Female' ? ' selected' : ''}>Female</option>
          </select>
        </div>
        <div class="eb-fg">
          <label class="eb-fl">Nationality</label>
          <select id="eb-nationality" class="eb-fc">
            <option value="">— Select —</option>
            <option${c.nationality === 'Indian' ? ' selected' : ''}>Indian</option>
            <option${c.nationality === 'NRI'    ? ' selected' : ''}>NRI</option>
            <option${c.nationality === 'OCI'    ? ' selected' : ''}>OCI</option>
          </select>
        </div>
        <div class="eb-fg">
          <label class="eb-fl">Marital Status</label>
          <select id="eb-marital-status" class="eb-fc">
            <option value="">— Select —</option>
            <option${c.marital_status === 'Married'   ? ' selected' : ''}>Married</option>
            <option${c.marital_status === 'Unmarried' ? ' selected' : ''}>Unmarried</option>
          </select>
        </div>
        <div class="eb-fg">
          <label class="eb-fl">PAN No</label>
          <input type="text" id="eb-pan" class="eb-fc"
                 value="${_esc(c.pan_no || '')}"
                 oninput="this.value=this.value.toUpperCase()">
        </div>
        <div class="eb-fg">
          <label class="eb-fl">Aadhaar No</label>
          <input type="text" id="eb-aadhaar" class="eb-fc"
                 value="${_esc(c.aadhaar_no || '')}">
        </div>
        <div class="eb-fg">
          <label class="eb-fl">* Mobile</label>
          <input type="text" id="eb-mobile" class="eb-fc"
                 value="${_esc(c.mobile || '')}">
        </div>
        <div class="eb-fg">
          <label class="eb-fl">Email</label>
          <input type="text" id="eb-email" class="eb-fc"
                 value="${_esc(c.email || '')}">
        </div>
        <div class="eb-fg">
          <label class="eb-fl">Email 2</label>
          <input type="text" id="eb-email2" class="eb-fc"
                 value="${_esc(c.email_2 || '')}">
        </div>
        <div class="eb-fg">
          <label class="eb-fl">Passport No</label>
          <input type="text" id="eb-passport" class="eb-fc"
                 value="${_esc(c.passport_no || '')}">
        </div>
        <div class="eb-fg">
          <label class="eb-fl">Profession</label>
          <input type="text" id="eb-profession" class="eb-fc"
                 value="${_esc(c.profession || '')}">
        </div>
        <div class="eb-fg">
          <label class="eb-fl">Designation</label>
          <input type="text" id="eb-designation" class="eb-fc"
                 value="${_esc(c.designation || '')}">
        </div>
        <div class="eb-fg">
          <label class="eb-fl">Company/Firm</label>
          <input type="text" id="eb-company" class="eb-fc"
                 value="${_esc(c.company || '')}">
        </div>
      </div>
    </div>
  </div>

  <!-- SECTION 6: FIRST APPLICANT ADDRESS -->
  <div>
    <div class="eb-sec-hdr">FIRST APPLICANT ADDRESS</div>
    <div class="eb-sec-body">
      <div class="eb-grid">
        <div class="eb-fg" style="grid-column: span 2">
          <label class="eb-fl">Present Address</label>
          <textarea id="eb-present-address" class="eb-fc"
                    rows="2">${_esc(c.present_address || '')}</textarea>
        </div>
        <div class="eb-fg">
          <label class="eb-fl">Pin</label>
          <input type="text" id="eb-present-pin" class="eb-fc"
                 value="${_esc(c.present_pin || '')}">
        </div>
        <div class="eb-fg">
          <label class="eb-fl">City</label>
          <input type="text" id="eb-present-city" class="eb-fc"
                 value="${_esc(c.present_city || '')}">
        </div>
        <div class="eb-fg">
          <label class="eb-fl">State</label>
          <select id="eb-present-state" class="eb-fc">${stateOpts}</select>
        </div>
        <div class="eb-fg">
          <label class="eb-fl">Country</label>
          <input type="text" id="eb-present-country" class="eb-fc"
                 value="${_esc(c.present_country || 'India')}">
        </div>
      </div>
    </div>
  </div>

  <!-- SECTION 7: COMMUNICATION ADDRESS -->
  <div>
    <div class="eb-sec-hdr">COMMUNICATION ADDRESS</div>
    <div class="eb-sec-body">
      <div class="eb-grid">
        <div class="eb-fg" style="grid-column: span 2">
          <label class="eb-fl">Comm Address</label>
          <textarea id="eb-comm-addr" class="eb-fc"
                    rows="2">${_esc(c.comm_address_line1 || '')}</textarea>
        </div>
        <div class="eb-fg">
          <label class="eb-fl">Pin</label>
          <input type="text" id="eb-comm-pin" class="eb-fc"
                 value="${_esc(c.comm_pin || '')}">
        </div>
        <div class="eb-fg">
          <label class="eb-fl">City</label>
          <input type="text" id="eb-comm-city" class="eb-fc"
                 value="${_esc(c.comm_city || '')}">
        </div>
        <div class="eb-fg">
          <label class="eb-fl">State</label>
          <select id="eb-comm-state" class="eb-fc">${commStateOpts}</select>
        </div>
        <div class="eb-fg">
          <label class="eb-fl">Country</label>
          <input type="text" id="eb-comm-country" class="eb-fc"
                 value="${_esc(c.comm_country || 'India')}">
        </div>
      </div>
    </div>
  </div>

  <!-- SAVE / CLOSE -->
  <div class="eb-btn-row">
    <button class="eb-btn" onclick="EditBooking.save()">SAVE</button>
    <button class="eb-btn-sec" onclick="EditBooking.back()">CLOSE</button>
  </div>
</div>`;
  }

  function _renderPage() {
    return EB_STYLES + (_view === 'edit' ? _renderEditView() : _renderSearchView());
  }

  async function _initSearch() {
    var token = localStorage.getItem('rof-jwt') || '';
    try {
      var res  = await fetch('/api/projects', { headers: { Authorization: 'Bearer ' + token } });
      var data = await res.json();
      var sel  = document.getElementById('eb-project');
      if (!sel) return;
      (data.projects || data.data || data || []).forEach(function(p) {
        var o = document.createElement('option');
        o.value = p.id;
        o.textContent = p.name || p.project_name;
        sel.appendChild(o);
      });
    } catch(e) {
      console.error('EditBooking: failed to load projects', e);
    }
  }

  function _showMsg(text, isErr) {
    var el = document.getElementById('eb-msg');
    if (!el) return;
    el.textContent = text;
    el.className = 'eb-msg ' + (isErr ? 'eb-msg-err' : 'eb-msg-ok');
  }

  function _clearMsg() {
    var el = document.getElementById('eb-msg');
    if (el) { el.textContent = ''; el.className = 'eb-msg'; }
  }

  function _renderRows() {
    var tbody = document.getElementById('eb-tbody');
    if (!tbody) return;
    if (!_bookings.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:30px">No records found.</td></tr>';
      return;
    }
    tbody.innerHTML = _bookings.map(function(r, i) {
      var dateStr = r.booking_date ? String(r.booking_date).split('T')[0] : '';
      return '<tr>'
        + '<td>' + (i + 1) + '</td>'
        + '<td>' + _esc(r.registration_no || '') + '</td>'
        + '<td>' + _esc(r.consumer_name   || '') + '</td>'
        + '<td>' + _esc(r.unit_number     || '') + '</td>'
        + '<td>' + _esc(dateStr)                 + '</td>'
        + '<td>' + _esc(r.status          || '') + '</td>'
        + '<td><span class="eb-edit-link" '
          + 'onclick="EditBooking.loadEdit(\''
          + r.id + '\',\'' + r.consumer_id + '\')">'
          + 'EDIT</span></td>'
        + '</tr>';
    }).join('');
  }

  async function _fetch() {
    var token     = localStorage.getItem('rof-jwt') || '';
    var projectId = (document.getElementById('eb-project') ? document.getElementById('eb-project').value : '').trim();
    var regNo     = (document.getElementById('eb-regno')   ? document.getElementById('eb-regno').value   : '').trim().toLowerCase();
    var fname     = (document.getElementById('eb-fname')   ? document.getElementById('eb-fname').value   : '').trim().toLowerCase();
    var unitNo    = (document.getElementById('eb-unitno')  ? document.getElementById('eb-unitno').value  : '').trim().toLowerCase();

    var btn = document.getElementById('eb-fetch-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Fetching...'; }
    _clearMsg();

    try {
      var qs = new URLSearchParams();
      if (projectId) qs.set('project_id', projectId);
      qs.set('pageSize', '200');

      var res  = await fetch('/api/booking?' + qs.toString(), { headers: { Authorization: 'Bearer ' + token } });
      var data = await res.json();
      if (!res.ok) { _showMsg(data.message || data.error || 'Failed to fetch.', true); return; }

      var rows = data.data || [];
      if (regNo)  rows = rows.filter(function(r) { return (r.registration_no || '').toLowerCase().includes(regNo); });
      if (fname)  rows = rows.filter(function(r) { return (r.consumer_name   || '').toLowerCase().includes(fname); });
      if (unitNo) rows = rows.filter(function(r) { return (r.unit_number     || '').toLowerCase().includes(unitNo); });

      _bookings = rows;
      var card = document.getElementById('eb-results-card');
      if (card) card.style.display = '';
      var cnt = document.getElementById('eb-count');
      if (cnt) cnt.textContent = _bookings.length + ' record(s) found';
      _renderRows();
    } catch(e) {
      _showMsg('Error: ' + e.message, true);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'FETCH'; }
    }
  }

  async function _loadEdit(bookingId, consumerId) {
    _bookingId  = bookingId;
    _consumerId = consumerId;

    var container = document.getElementById('content') || document.body;
    container.innerHTML = EB_STYLES
      + '<div style="padding:20px;color:var(--text2);font-size:13px">Loading booking data...</div>';

    var token = localStorage.getItem('rof-jwt') || '';
    try {
      var results = await Promise.all([
        fetch('/api/booking/'   + bookingId,  { headers: { Authorization: 'Bearer ' + token } }),
        fetch('/api/consumers/' + consumerId, { headers: { Authorization: 'Bearer ' + token } }),
        fetch('/api/brokers',                 { headers: { Authorization: 'Bearer ' + token } }),
        fetch('/api/users',                   { headers: { Authorization: 'Bearer ' + token } }),
      ]);

      var bData  = await results[0].json();
      var cData  = await results[1].json();
      var brData = await results[2].json();
      var uData  = await results[3].json();

      if (!results[0].ok) throw new Error(bData.error  || 'Failed to load booking');
      if (!results[1].ok) throw new Error(cData.error  || 'Failed to load consumer');

      _bookingData  = bData.data;
      _consumerData = cData.data;
      _brokers      = brData.data || [];
      _users        = uData.data  || [];
      _view         = 'edit';

      container.innerHTML = _renderPage();
    } catch(e) {
      container.innerHTML = EB_STYLES
        + '<div style="padding:20px;color:var(--red);font-size:13px">Error loading data: '
        + _esc(e.message)
        + ' &mdash; <a href="#" onclick="EditBooking.back();return false">Go Back</a></div>';
    }
  }

  function _setBookingType(type) {
    var hid     = document.getElementById('eb-booking-type');
    var btnB    = document.getElementById('eb-type-broker');
    var btnD    = document.getElementById('eb-type-direct');
    var fields  = document.getElementById('eb-broker-fields');
    if (hid) hid.value = type;
    if (type === 'broker') {
      if (btnB)   btnB.classList.add('on');
      if (btnD)   btnD.classList.remove('on');
      if (fields) fields.style.display = '';
    } else {
      if (btnB)   btnB.classList.remove('on');
      if (btnD)   btnD.classList.add('on');
      if (fields) fields.style.display = 'none';
    }
  }

  function _gv(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  async function _save() {
    var firstName = _gv('eb-first-name');
    var lastName  = _gv('eb-last-name');
    var mobile    = _gv('eb-mobile');

    if (!firstName) { alert('First Name is required'); return; }
    if (!lastName)  { alert('Last Name is required');  return; }
    if (!mobile)    { alert('Mobile is required');     return; }

    var token  = localStorage.getItem('rof-jwt') || '';
    var banner = document.getElementById('eb-banner');

    var body = {
      // booking_records fields
      booking_date:           _gv('eb-booking-date')      || null,
      form_no:                _gv('eb-form-no')            || null,
      broker_id:              _gv('eb-broker-id')          || null,
      main_broker_id:         _gv('eb-main-broker-id')     || null,
      broker_commission:      _gv('eb-broker-commission') ? parseFloat(_gv('eb-broker-commission'))  : null,
      broker_commission_type: _gv('eb-broker-commission-type') || null,
      company_inaugural_disc: _gv('eb-inaugural-disc')    ? parseFloat(_gv('eb-inaugural-disc'))     : null,
      company_rebate_rs:      _gv('eb-rebate-rs')         ? parseFloat(_gv('eb-rebate-rs'))          : null,
      company_rebate_sqft:    _gv('eb-rebate-sqft')       ? parseFloat(_gv('eb-rebate-sqft'))        : null,
      company_rebate_pct:     _gv('eb-rebate-pct')        ? parseFloat(_gv('eb-rebate-pct'))         : null,
      broker_rebate_rs:       _gv('eb-broker-rebate-rs')  ? parseFloat(_gv('eb-broker-rebate-rs'))   : null,
      broker_rebate_sqft:     _gv('eb-broker-rebate-sqft')? parseFloat(_gv('eb-broker-rebate-sqft')) : null,
      broker_rebate_pct:      _gv('eb-broker-rebate-pct') ? parseFloat(_gv('eb-broker-rebate-pct'))  : null,
      sales_employee_id:      _gv('eb-sales-emp')          || null,
      remarks:                _gv('eb-remarks')             || null,
      booking_type:           _gv('eb-booking-type')        || null,
      // consumers fields
      salutation:             _gv('eb-salutation')          || null,
      first_name:             firstName,
      middle_name:            _gv('eb-middle-name')         || null,
      last_name:              lastName,
      mobile:                 mobile,
      email:                  _gv('eb-email')               || null,
      dob:                    _gv('eb-dob')                 || null,
      gender:                 _gv('eb-gender')              || null,
      nationality:            _gv('eb-nationality')         || null,
      marital_status:         _gv('eb-marital-status')      || null,
      pan_no:                 _gv('eb-pan')                 || null,
      aadhaar_no:             _gv('eb-aadhaar')             || null,
      father_name:            _gv('eb-father-name')         || null,
      present_address_line1:  _gv('eb-present-address')     || null,
      present_city:           _gv('eb-present-city')        || null,
      present_state:          _gv('eb-present-state')       || null,
      present_pin:            _gv('eb-present-pin')         || null,
      present_country:        _gv('eb-present-country')     || null,
      income_category:        _gv('eb-customer-classification') || null,
      email_2:                _gv('eb-email2')              || null,
      passport_no:            _gv('eb-passport')            || null,
      profession:             _gv('eb-profession')          || null,
      designation:            _gv('eb-designation')         || null,
      company:                _gv('eb-company')             || null,
      comm_address_line1:     _gv('eb-comm-addr')           || null,
      comm_city:              _gv('eb-comm-city')           || null,
      comm_state:             _gv('eb-comm-state')          || null,
      comm_pin:               _gv('eb-comm-pin')            || null,
      comm_country:           _gv('eb-comm-country')        || null,
    };

    try {
      var res  = await fetch('/api/booking/' + _bookingId + '/edit', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify(body)
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');

      if (banner) {
        banner.className   = 'eb-banner eb-banner-ok';
        banner.textContent = 'Changes saved successfully.';
        banner.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(function() {
          if (banner) { banner.className = 'eb-banner'; banner.textContent = ''; }
        }, 4000);
      }
      // Refresh local cache so re-render is current
      _bookingData  = data.data.booking;
      _consumerData = Object.assign({}, _consumerData, data.data.consumer);
    } catch(e) {
      if (banner) {
        banner.className   = 'eb-banner eb-banner-err';
        banner.textContent = 'Error: ' + e.message;
      }
    }
  }

  function _back() {
    _view         = 'search';
    _bookingId    = null;
    _consumerId   = null;
    _bookingData  = null;
    _consumerData = null;
    var container = document.getElementById('content') || document.body;
    container.innerHTML = _renderPage();
    _initSearch();
  }

  window.EditBooking = {
    fetch:          _fetch,
    loadEdit:       _loadEdit,
    save:           _save,
    back:           _back,
    setBookingType: _setBookingType
  };

  Pages.editBooking = function(params) {
    _view         = 'search';
    _bookings     = [];
    _bookingId    = null;
    _consumerId   = null;
    _bookingData  = null;
    _consumerData = null;
    var container = document.getElementById('content') || document.body;
    container.innerHTML = _renderPage();
    _initSearch();
  };

})();
