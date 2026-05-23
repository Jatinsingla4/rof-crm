// Booking Payment Page — Step 2 of the two-step booking flow
// Loaded when navigating to /#/booking-payment?id=<uuid>&reg=<regNo>
Pages.bookingPayment = async function(params = {}) {
  const bookingId = params.id;
  const regNoParam = params.reg;

  // Nav guard
  if (!bookingId) {
    Router.navigate('/consumers');
    return;
  }

  // Load booking record
  let booking = null;
  try {
    const res = await Api.get(`/booking/${bookingId}`);
    booking = res.data || res;
  } catch (err) {
    Utils.error('Could not load booking: ' + err.message);
    Router.navigate('/consumers');
    return;
  }

  // Load banks, employees, tax slabs in parallel
  let banks = [], employees = [], taxSlabs = [];
  try {
    const [banksRes, empsRes, taxRes] = await Promise.all([
      Api.get('/master/banks'),
      Api.get('/employees'),
      Api.get('/master/tax-slabs'),
    ]);
    banks     = banksRes.data || [];
    employees = empsRes.data || [];
    taxSlabs  = (taxRes.data || []).filter(s => s.is_active !== false);
  } catch {}

  const bankOpts = banks.map(b => `<option value="${b.name}">${b.name}</option>`).join('');
  const empOpts  = employees.map(e => {
    const name = e.name || `${e.first_name||''} ${e.last_name||''}`.trim();
    return `<option value="${e.id}">${name}</option>`;
  }).join('');

  const regNo = booking.registration_no || regNoParam || '—';

  document.getElementById('content').innerHTML = `
    <div class="page-hdr">
      <h1 class="page-title">Payment Detail</h1>
      <div class="page-sub">Step 2 — Record payment for booking ${regNo}</div>
    </div>

    <!-- BOOKING SUMMARY -->
    <div class="sp" style="margin-bottom:14px">
      <div class="sp-hdr"><div class="sp-title">Booking Summary</div></div>
      <div class="sp-body">
        <div class="sp-grid">
          <div class="fg"><label class="fl">Registration No.</label>
            <div class="fc" style="padding:6px 10px;background:var(--surface2);border-radius:4px;font-weight:700;color:var(--teal)">${regNo}</div></div>
          <div class="fg"><label class="fl">Applicant Name</label>
            <div class="fc" style="padding:6px 10px;background:var(--surface2);border-radius:4px">${booking.consumer_name || '—'}</div></div>
          <div class="fg"><label class="fl">Project</label>
            <div class="fc" style="padding:6px 10px;background:var(--surface2);border-radius:4px">${booking.project_name || '—'}</div></div>
          <div class="fg"><label class="fl">Unit No.</label>
            <div class="fc" style="padding:6px 10px;background:var(--surface2);border-radius:4px">${booking.unit_number || '—'}</div></div>
          <div class="fg"><label class="fl">Booking Date</label>
            <div class="fc" style="padding:6px 10px;background:var(--surface2);border-radius:4px">${booking.booking_date ? new Date(booking.booking_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</div></div>
        </div>
      </div>
    </div>

    <!-- PAYMENT DETAIL -->
    <div class="sp" style="margin-bottom:14px">
      <div class="sp-hdr">
        <div class="sp-title">Payment Detail</div>
        <div class="btg">
          <button type="button" class="btg-item on" id="bkp-self-btn"
            onclick="BkPayPage.setToggleValue('self_or_loan','self',['bkp-self-btn','bkp-loan-btn'])">Self</button>
          <button type="button" class="btg-item" id="bkp-loan-btn"
            onclick="BkPayPage.setToggleValue('self_or_loan','loan',['bkp-self-btn','bkp-loan-btn'])">Bank Loan</button>
        </div>
      </div>
      <input type="hidden" id="bkp-self-or-loan" value="self">
      <div class="sp-body">

        <!-- BLOCK 1: Payment Header -->
        <div style="margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid var(--border)">
          <!-- Row 1 -->
          <div class="sp-grid" style="margin-bottom:10px">
            <div class="fg">
              <label class="fl"><span class="r">*</span>Receipt Date</label>
              <input type="date" class="fc" id="bkp-receipt-date">
            </div>
            <div class="fg">
              <label class="fl">Received For</label>
              <input class="fc" id="bkp-received-for" placeholder="Company / Person name">
            </div>
            <div class="fg">
              <label class="fl">Account Holder</label>
              <input class="fc" id="bkp-account-holder" placeholder="Account holder name">
            </div>
            <div class="fg">
              <label class="fl">Remark</label>
              <input class="fc" id="bkp-remark" placeholder="Booking remark">
            </div>
            <div class="fg">
              <label class="fl" style="margin-bottom:4px">Invoice Date By</label>
              <div class="btg">
                <button type="button" class="btg-item on" id="bkp-idb-receipt"
                  onclick="BkPayPage.setToggleValue('invoice_date_by','receipt_date',['bkp-idb-receipt','bkp-idb-posting'])">Receipt Date</button>
                <button type="button" class="btg-item" id="bkp-idb-posting"
                  onclick="BkPayPage.setToggleValue('invoice_date_by','posting_date',['bkp-idb-receipt','bkp-idb-posting'])">Posting Date</button>
              </div>
              <input type="hidden" id="bkp-invoice-date-by" value="receipt_date">
            </div>
          </div>
          <!-- Row 2 -->
          <div class="sp-grid">
            <div class="fg">
              <label class="fl">On Account Of</label>
              <select class="fc" id="bkp-on-account-of">
                <option value="Booking" selected>Booking</option>
                <option value="Installment">Installment</option>
                <option value="Interest">Interest</option>
                <option value="Advance">Advance</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div class="fg">
              <label class="fl" style="margin-bottom:4px">Interest</label>
              <div class="btg">
                <button type="button" class="btg-item" id="bkp-int-incl"
                  onclick="BkPayPage.setToggleValue('interest_type','inclusive',['bkp-int-incl','bkp-int-excl'])">Inclusive</button>
                <button type="button" class="btg-item on" id="bkp-int-excl"
                  onclick="BkPayPage.setToggleValue('interest_type','exclusive',['bkp-int-incl','bkp-int-excl'])">Exclusive</button>
              </div>
              <input type="hidden" id="bkp-interest-type" value="exclusive">
            </div>
            <div class="fg">
              <label class="fl" style="margin-bottom:4px">Extra Add On</label>
              <div class="btg">
                <button type="button" class="btg-item" id="bkp-eao-incl"
                  onclick="BkPayPage.setToggleValue('extra_add_on_type','inclusive',['bkp-eao-incl','bkp-eao-excl'])">Inclusive</button>
                <button type="button" class="btg-item on" id="bkp-eao-excl"
                  onclick="BkPayPage.setToggleValue('extra_add_on_type','exclusive',['bkp-eao-incl','bkp-eao-excl'])">Exclusive</button>
              </div>
              <input type="hidden" id="bkp-extra-add-on-type" value="exclusive">
            </div>
            <div class="fg">
              <label class="fl" style="margin-bottom:4px">TDS</label>
              <div class="btg">
                <button type="button" class="btg-item" id="bkp-tds-calc"
                  onclick="BkPayPage.setToggleValue('tds_type','calculate_exclusive',['bkp-tds-calc','bkp-tds-none'])">Calculate Exclusive</button>
                <button type="button" class="btg-item on" id="bkp-tds-none"
                  onclick="BkPayPage.setToggleValue('tds_type','not_calculate',['bkp-tds-calc','bkp-tds-none'])">Not Calculate</button>
              </div>
              <input type="hidden" id="bkp-tds-type" value="not_calculate">
            </div>
          </div>
        </div>

        <!-- BLOCK 2: Payment Method Tabs -->
        <div>
          <div style="display:flex;flex-wrap:wrap;border-bottom:1px solid var(--border)">
            ${['cheque','draft','online','cash','adjust','dealer_adjustment','tds_challan','card'].map((t,i) => {
              const labels = {cheque:'Cheque',draft:'Draft',online:'Online',cash:'Cash',adjust:'Adjust',dealer_adjustment:'Dealer Adjustment',tds_challan:'TDS Challan',card:'Card'};
              const activeStyle = 'background:var(--teal);color:#fff;border:1px solid var(--border);border-bottom:2px solid var(--surface);margin-bottom:-1px;font-weight:600;';
              const inactiveStyle = 'background:var(--bg);color:var(--text);border:1px solid var(--border);border-bottom:none;font-weight:400;';
              return `<button type="button" id="bkp-ptab-${t}" onclick="BkPayPage.switchPaymentTab('${t}')"
                style="padding:6px 14px;${i===0?activeStyle:inactiveStyle}border-radius:4px 4px 0 0;cursor:pointer;font-size:13px;margin-right:2px">${labels[t]}</button>`;
            }).join('')}
          </div>
          <input type="hidden" id="bkp-payment-mode" value="cheque">
          <input type="hidden" id="bkp-cgst-amount">
          <input type="hidden" id="bkp-sgst-amount">

          <div id="bkp-panel-container" style="border:1px solid var(--border);border-top:none;border-radius:0 0 6px 6px;padding:14px;background:var(--surface)">

          <!-- CHEQUE fields -->
          <div id="bkp-pfields-cheque">
            <div style="display:grid;grid-template-columns:2fr 1.5fr 1fr 2fr 1fr 1fr 1fr;gap:12px;margin-bottom:10px">
              <div class="fg">
                <label class="fl"><span class="r">*</span>Cheque Amount (₹)</label>
                <input type="number" class="fc" id="bkp-amt-cheque" placeholder="0" required oninput="BkPayPage.calculatePaymentTaxes()">
              </div>
              <div class="fg">
                <label class="fl">Interest (₹)</label>
                <input type="number" class="fc" id="bkp-interest-amt" placeholder="0" value="0" oninput="BkPayPage.calculatePaymentTaxes()">
              </div>
              <div class="fg">
                <label class="fl" id="bkp-lbl-gst-int">GST Interest(1.000%)</label>
                <input type="number" class="fc" id="bkp-gst-int-pct" value="1" readonly style="background:var(--surface2)">
              </div>
              <div class="fg">
                <label class="fl" id="bkp-lbl-stax">S.Tax(0.000%)</label>
                <input type="number" class="fc" id="bkp-stax-pct" value="0" readonly style="background:var(--surface2)">
              </div>
              <div class="fg">
                <label class="fl" id="bkp-lbl-cgst">CGST(0.500%)</label>
                <input type="number" class="fc" id="bkp-cgst-pct" value="0.5" readonly style="background:var(--surface2)">
              </div>
              <div class="fg">
                <label class="fl" id="bkp-lbl-sgst">SGST(0.500%)</label>
                <input type="number" class="fc" id="bkp-sgst-pct" value="0.5" readonly style="background:var(--surface2)">
              </div>
            </div>
            <div class="sp-grid">
              <div class="fg"><label class="fl">Cheque No.</label>
                <input class="fc" id="bkp-ref-cheque" placeholder="Cheque number"
                  oninput="BkPayPage._chequeWarningAcknowledged=false"
                  onblur="BkPayPage.validateChequeRef()"></div>
              <div class="fg"><label class="fl">Cheque Date</label>
                <input type="date" class="fc" id="bkp-chqdate-cheque"></div>
              <div class="fg"><label class="fl">Bank Name</label>
                <select class="fc" id="bkp-bank-sel"><option value="">— Select Bank —</option>${bankOpts}</select></div>
              <div class="fg"><label class="fl">Branch Name</label>
                <input class="fc" id="bkp-branch-cheque" placeholder="Branch name"></div>
              <div class="fg"><label class="fl">Employee</label>
                <select class="fc" id="bkp-pay-emp"><option value="">— Select —</option>${empOpts}</select></div>
            </div>
          </div>

          <!-- DRAFT fields -->
          <div id="bkp-pfields-draft" style="display:none">
            <div class="sp-grid" style="margin-bottom:10px">
              <div class="fg"><label class="fl"><span class="r">*</span>Draft Amount (₹)</label>
                <input type="number" class="fc" id="bkp-amt-draft" placeholder="0" oninput="BkPayPage._syncAmount(this.value);BkPayPage.calculatePaymentTaxes()"></div>
              <div class="fg"><label class="fl">Interest (₹)</label>
                <input type="number" class="fc" id="bkp-interest-amt-d" placeholder="0" value="0" oninput="BkPayPage.calculatePaymentTaxes()"></div>
              <div class="fg"><label class="fl">GST Interest (%)</label>
                <input type="number" class="fc" id="bkp-gst-int-pct-d" placeholder="1.0" step="0.01" value="1"></div>
              <div class="fg"><label class="fl">S.Tax (%)</label>
                <input type="number" class="fc" id="bkp-stax-pct-d" placeholder="1.0" step="0.01" oninput="BkPayPage.calculatePaymentTaxes()"></div>
              <div class="fg"><label class="fl">CGST (%)</label>
                <input type="number" class="fc" id="bkp-cgst-pct-d" placeholder="0.5" step="0.01" oninput="BkPayPage.calculatePaymentTaxes()"></div>
              <div class="fg"><label class="fl">SGST (%)</label>
                <input type="number" class="fc" id="bkp-sgst-pct-d" placeholder="0.5" step="0.01" oninput="BkPayPage.calculatePaymentTaxes()"></div>
            </div>
            <div class="sp-grid">
              <div class="fg"><label class="fl">Draft No.</label>
                <input class="fc" id="bkp-ref-draft" placeholder="Draft number"
                  oninput="BkPayPage._syncAmount_noop();BkPayPage._chequeWarningAcknowledged=false"
                  onblur="BkPayPage.validateChequeRef()"></div>
              <div class="fg"><label class="fl">Draft Date</label>
                <input type="date" class="fc" id="bkp-chqdate-draft"></div>
              <div class="fg"><label class="fl">Bank Name</label>
                <select class="fc" id="bkp-bank-draft"><option value="">— Select Bank —</option>${bankOpts}</select></div>
              <div class="fg"><label class="fl">Branch Name</label>
                <input class="fc" id="bkp-branch-draft" placeholder="Branch name"></div>
            </div>
          </div>

          <!-- ONLINE fields -->
          <div id="bkp-pfields-online" style="display:none">
            <div class="sp-grid" style="margin-bottom:10px">
              <div class="fg"><label class="fl"><span class="r">*</span>Amount (₹)</label>
                <input type="number" class="fc" id="bkp-amt-online" placeholder="0" oninput="BkPayPage._syncAmountFromOnline(this.value);BkPayPage.calculatePaymentTaxes()"></div>
              <div class="fg"><label class="fl">S.Tax (%)</label>
                <input type="number" class="fc" id="bkp-stax-pct-o" placeholder="1.0" step="0.01" oninput="BkPayPage.calculatePaymentTaxes()"></div>
              <div class="fg"><label class="fl">CGST (%)</label>
                <input type="number" class="fc" id="bkp-cgst-pct-o" placeholder="0.5" step="0.01" oninput="BkPayPage.calculatePaymentTaxes()"></div>
              <div class="fg"><label class="fl">SGST (%)</label>
                <input type="number" class="fc" id="bkp-sgst-pct-o" placeholder="0.5" step="0.01" oninput="BkPayPage.calculatePaymentTaxes()"></div>
            </div>
            <div class="sp-grid">
              <div class="fg"><label class="fl">Transaction Ref</label>
                <input class="fc" id="bkp-ref-online" placeholder="UTR / Ref No."
                  oninput="BkPayPage._chequeWarningAcknowledged=false"
                  onblur="BkPayPage.validateChequeRef()"></div>
              <div class="fg"><label class="fl">Transaction Date</label>
                <input type="date" class="fc" id="bkp-chqdate-online"></div>
              <div class="fg"><label class="fl">Bank Name</label>
                <select class="fc" id="bkp-bank-online"><option value="">— Select Bank —</option>${bankOpts}</select></div>
              <div class="fg"><label class="fl">Branch Name</label>
                <input class="fc" id="bkp-branch-online" placeholder="Branch name"></div>
            </div>
          </div>

          <!-- CASH fields -->
          <div id="bkp-pfields-cash" style="display:none">
            <div class="sp-grid">
              <div class="fg"><label class="fl"><span class="r">*</span>Cash Amount (₹)</label>
                <input type="number" class="fc" id="bkp-amt-cash" placeholder="0" oninput="BkPayPage._syncAmountFromCash(this.value);BkPayPage.calculatePaymentTaxes()"></div>
              <div class="fg"><label class="fl">S.Tax (%)</label>
                <input type="number" class="fc" id="bkp-stax-pct-c" placeholder="1.0" step="0.01" oninput="BkPayPage.calculatePaymentTaxes()"></div>
              <div class="fg"><label class="fl">CGST (%)</label>
                <input type="number" class="fc" id="bkp-cgst-pct-c" placeholder="0.5" step="0.01" oninput="BkPayPage.calculatePaymentTaxes()"></div>
              <div class="fg"><label class="fl">SGST (%)</label>
                <input type="number" class="fc" id="bkp-sgst-pct-c" placeholder="0.5" step="0.01" oninput="BkPayPage.calculatePaymentTaxes()"></div>
            </div>
          </div>

          <!-- ADJUST fields -->
          <div id="bkp-pfields-adjust" style="display:none">
            <div class="sp-grid">
              <div class="fg"><label class="fl"><span class="r">*</span>Adjust Amount (₹)</label>
                <input type="number" class="fc" id="bkp-amt-adjust" placeholder="0" oninput="BkPayPage._syncAmountFromAdjust(this.value)"></div>
              <div class="fg" style="grid-column:span 2"><label class="fl">Adjust Remark</label>
                <input class="fc" id="bkp-remark-adjust" placeholder="Reason for adjustment"></div>
            </div>
          </div>

          <!-- DEALER ADJUSTMENT fields -->
          <div id="bkp-pfields-dealer_adjustment" style="display:none">
            <div class="sp-grid">
              <div class="fg"><label class="fl"><span class="r">*</span>Dealer Adjustment Amount (₹)</label>
                <input type="number" class="fc" id="bkp-amt-dealer" placeholder="0"></div>
              <div class="fg" style="grid-column:span 2"><label class="fl">Remark</label>
                <input class="fc" id="bkp-remark-dealer" placeholder="Dealer adjustment remark"></div>
            </div>
          </div>

          <!-- TDS CHALLAN fields -->
          <div id="bkp-pfields-tds_challan" style="display:none">
            <div class="sp-grid">
              <div class="fg"><label class="fl">TDS Amount (₹)</label>
                <input type="number" class="fc" id="bkp-tds-amount" placeholder="0"></div>
              <div class="fg"><label class="fl">Challan Number</label>
                <input class="fc" id="bkp-tds-challan-no" placeholder="Challan No."></div>
              <div class="fg"><label class="fl">Challan Date</label>
                <input type="date" class="fc" id="bkp-tds-challan-date"></div>
              <div class="fg"><label class="fl">Bank Name</label>
                <select class="fc" id="bkp-bank-tds"><option value="">— Select Bank —</option>${bankOpts}</select></div>
              <div class="fg"><label class="fl">BSR Code</label>
                <input class="fc" id="bkp-tds-bsr" placeholder="BSR Code"></div>
            </div>
          </div>

          <!-- CARD fields -->
          <div id="bkp-pfields-card" style="display:none">
            <div class="sp-grid">
              <div class="fg"><label class="fl"><span class="r">*</span>Card Amount (₹)</label>
                <input type="number" class="fc" id="bkp-amt-card" placeholder="0" oninput="BkPayPage._syncAmountFromCard(this.value);BkPayPage.calculatePaymentTaxes()"></div>
              <div class="fg"><label class="fl">Card / Auth No.</label>
                <input class="fc" id="bkp-ref-card" placeholder="Auth / Approval No."
                  oninput="BkPayPage._chequeWarningAcknowledged=false"
                  onblur="BkPayPage.validateChequeRef()"></div>
              <div class="fg"><label class="fl">Transaction Date</label>
                <input type="date" class="fc" id="bkp-chqdate-card"></div>
              <div class="fg"><label class="fl">Bank Name</label>
                <select class="fc" id="bkp-bank-card"><option value="">— Select Bank —</option>${bankOpts}</select></div>
            </div>
          </div>

          </div><!-- end panel container -->
        </div><!-- end tabs -->
      </div>
    </div>

    <!-- ACTIONS -->
    <div style="display:flex;gap:10px;padding:14px 0;align-items:center">
      <button type="button" class="btn btn-teal btn-lg" id="bkp-confirm-btn" onclick="BkPayPage.confirmPayment()">CONFIRM PAYMENT</button>
      <button type="button" class="btn btn-ghost" onclick="Router.navigate('/consumers')">BACK</button>
    </div>
  `;

  BkPayPage._bookingId = bookingId;
  BkPayPage._regNo = regNo;
  BkPayPage._booking = booking;
  BkPayPage._chequeWarningAcknowledged = false;
  BkPayPage._taxSlabs = taxSlabs;

  // Seed tax slabs
  const defaultSlab = taxSlabs.find(s => s.cgst_percent <= 1) || taxSlabs[0];
  if (defaultSlab) {
    ['bkp-cgst-pct','bkp-cgst-pct-d','bkp-cgst-pct-o','bkp-cgst-pct-c'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = defaultSlab.cgst_percent;
    });
    ['bkp-sgst-pct','bkp-sgst-pct-d','bkp-sgst-pct-o','bkp-sgst-pct-c'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = defaultSlab.sgst_percent;
    });
    ['bkp-stax-pct','bkp-stax-pct-d','bkp-stax-pct-o','bkp-stax-pct-c'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = 0;
    });
  }

  // Override GST to 0 for NRI / OCI / PIO buyers
  const _buyerNat = (booking.nationality || '').toLowerCase();
  if (['nri','oci','pio'].includes(_buyerNat)) {
    ['bkp-cgst-pct','bkp-cgst-pct-d','bkp-cgst-pct-o','bkp-cgst-pct-c'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = 0;
    });
    ['bkp-sgst-pct','bkp-sgst-pct-d','bkp-sgst-pct-o','bkp-sgst-pct-c'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = 0;
    });
  }

  // Default receipt date to today
  const rdEl = document.getElementById('bkp-receipt-date');
  if (rdEl && !rdEl.value) rdEl.value = new Date().toISOString().split('T')[0];

  BkPayPage.calculatePaymentTaxes();
  BkPayPage.updateTaxLabels();

  // Pre-fill if booking already has payment data (status = 'complete' or re-editing)
  if (booking.status === 'complete' || booking.booking_amount > 0) {
    BkPayPage._prefillPayment(booking);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
const BkPayPage = {
  _bookingId: null,
  _regNo: null,
  _booking: null,
  _chequeWarningAcknowledged: false,
  _taxSlabs: [],

  setToggleValue(fieldId, value, buttonIds) {
    const inputEl = document.getElementById(`bkp-${fieldId.replace(/_/g,'-')}`);
    if (inputEl) inputEl.value = value;
    buttonIds.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        const isActive = btn.getAttribute('onclick')?.includes(`'${value}'`);
        btn.classList.toggle('on', !!isActive);
      }
    });
  },

  switchPaymentTab(tab) {
    const tabs = ['cheque','draft','online','cash','adjust','dealer_adjustment','tds_challan','card'];
    tabs.forEach(t => {
      const btn = document.getElementById(`bkp-ptab-${t}`);
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
    tabs.forEach(t => {
      const panel = document.getElementById(`bkp-pfields-${t}`);
      if (panel) panel.style.display = t === tab ? '' : 'none';
    });
    const modeEl = document.getElementById('bkp-payment-mode');
    if (modeEl) modeEl.value = tab;
    this.calculatePaymentTaxes();
  },

  _syncAmount(v)            { const el = document.getElementById('bkp-amt-cheque'); if (el) el.value = v; },
  _syncAmountFromOnline(v)  { const el = document.getElementById('bkp-amt-cheque'); if (el) el.value = v; },
  _syncAmountFromCash(v)    { const el = document.getElementById('bkp-amt-cheque'); if (el) el.value = v; },
  _syncAmountFromAdjust(v)  { const el = document.getElementById('bkp-amt-cheque'); if (el) el.value = v; },
  _syncAmountFromCard(v)    { /* no-op; card has own field */ },
  _syncAmount_noop() {},

  calculatePaymentTaxes() {
    const tab = document.getElementById('bkp-payment-mode')?.value || 'cheque';
    const amtEl = tab === 'cheque' ? document.getElementById('bkp-amt-cheque')
                : tab === 'draft'  ? document.getElementById('bkp-amt-draft')
                : tab === 'online' ? document.getElementById('bkp-amt-online')
                : tab === 'cash'   ? document.getElementById('bkp-amt-cash')
                : tab === 'card'   ? document.getElementById('bkp-amt-card')
                : null;
    const intEl = document.getElementById('bkp-interest-amt');
    const amt   = parseFloat(amtEl?.value || 0);
    const intr  = parseFloat(intEl?.value || 0);
    const base  = amt + intr;
    const sfxMap = { cheque:'', draft:'-d', online:'-o', cash:'-c', card:'' };
    const sfx   = sfxMap[tab] || '';
    const cgstPct = parseFloat(document.getElementById('bkp-cgst-pct' + sfx)?.value || 0);
    const sgstPct = parseFloat(document.getElementById('bkp-sgst-pct' + sfx)?.value || 0);
    const cgstAmt = base * cgstPct / 100;
    const sgstAmt = base * sgstPct / 100;
    const cgstH = document.getElementById('bkp-cgst-amount'); if (cgstH) cgstH.value = cgstAmt.toFixed(2);
    const sgstH = document.getElementById('bkp-sgst-amount'); if (sgstH) sgstH.value = sgstAmt.toFixed(2);
    this.updateTaxLabels();
  },

  updateTaxLabels() {
    const g = id => document.getElementById(id);
    const fmt = (id, fallback) => parseFloat(g(id)?.value ?? fallback).toFixed(3);
    if (g('bkp-lbl-gst-int')) g('bkp-lbl-gst-int').textContent = `GST Interest(${fmt('bkp-gst-int-pct', 1)}%)`;
    if (g('bkp-lbl-stax'))    g('bkp-lbl-stax').textContent    = `S.Tax(${fmt('bkp-stax-pct', 0)}%)`;
    if (g('bkp-lbl-cgst'))    g('bkp-lbl-cgst').textContent    = `CGST(${fmt('bkp-cgst-pct', 0.5)}%)`;
    if (g('bkp-lbl-sgst'))    g('bkp-lbl-sgst').textContent    = `SGST(${fmt('bkp-sgst-pct', 0.5)}%)`;
  },

  async validateChequeRef() {
    const mode = document.getElementById('bkp-payment-mode')?.value || 'cheque';
    if (['cash', 'adjust', 'dealer_adjustment'].includes(mode)) return true;
    const refIdMap = { cheque: 'bkp-ref-cheque', draft: 'bkp-ref-draft', online: 'bkp-ref-online', card: 'bkp-ref-card', tds_challan: 'bkp-tds-challan-no' };
    const refId = refIdMap[mode];
    const refEl = refId ? document.getElementById(refId) : null;
    const refVal = (refEl?.value || '').trim();
    if (!refVal || this._chequeWarningAcknowledged) return true;
    let data;
    try {
      const res = await Api.get(`/booking/check-cheque?ref=${encodeURIComponent(refVal)}&exclude_id=${encodeURIComponent(this._bookingId)}`);
      data = res.data ?? res;
    } catch { return true; }
    if (!data.exists) return true;
    const dateStr = data.detail?.date ? new Date(data.detail.date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';
    const foundIn = data.found_in === 'booking' ? 'booking record' : 'payment receipt';
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center';
      overlay.innerHTML = `
        <div style="background:var(--surface);border:1px solid var(--border2);border-radius:14px;padding:28px 28px 22px;max-width:440px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.25)">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
            <span style="font-size:22px">⚠️</span>
            <h3 style="font-size:15px;font-weight:700;color:var(--text);margin:0">Duplicate Reference Number</h3>
          </div>
          <p style="font-size:13px;color:var(--text2);line-height:1.6;margin-bottom:20px">
            Reference <strong>"${refVal}"</strong> already used in a <strong>${foundIn}</strong>
            (Reference: <strong>${data.detail?.reference||'—'}</strong>, Date: ${dateStr}).<br><br>Do you still want to proceed?
          </p>
          <div style="display:flex;gap:10px;justify-content:flex-end">
            <button id="bkp-chq-change" class="btn btn-teal" style="font-size:13px">Change Number</button>
            <button id="bkp-chq-proceed" class="btn btn-ghost" style="font-size:13px;border:1px solid var(--border2)">Proceed Anyway</button>
          </div>
        </div>`;
      const close = () => document.body.removeChild(overlay);
      overlay.querySelector('#bkp-chq-change').onclick = () => {
        close(); if (refEl) { refEl.value = ''; refEl.focus(); }
        this._chequeWarningAcknowledged = false; resolve(false);
      };
      overlay.querySelector('#bkp-chq-proceed').onclick = () => {
        close(); this._chequeWarningAcknowledged = true; resolve(true);
      };
      overlay.addEventListener('click', e => {
        if (e.target === overlay) { close(); if (refEl) refEl.focus(); this._chequeWarningAcknowledged = false; resolve(false); }
      });
      document.addEventListener('keydown', function esc(e) {
        if (e.key === 'Escape') { close(); BkPayPage._chequeWarningAcknowledged = false; document.removeEventListener('keydown', esc); resolve(false); }
      }, { once: true });
      document.body.appendChild(overlay);
    });
  },

  _getPaymentValue() {
    const mode = document.getElementById('bkp-payment-mode')?.value || 'cheque';
    const amtMap = { cheque: 'bkp-amt-cheque', draft: 'bkp-amt-draft', online: 'bkp-amt-online', cash: 'bkp-amt-cash', card: 'bkp-amt-card', adjust: 'bkp-amt-adjust', dealer_adjustment: 'bkp-amt-dealer', tds_challan: 'bkp-tds-amount' };
    return parseFloat(document.getElementById(amtMap[mode])?.value || 0);
  },

  _getPaymentRef() {
    const mode = document.getElementById('bkp-payment-mode')?.value || 'cheque';
    const refMap = { cheque: 'bkp-ref-cheque', draft: 'bkp-ref-draft', online: 'bkp-ref-online', card: 'bkp-ref-card', tds_challan: 'bkp-tds-challan-no' };
    return (document.getElementById(refMap[mode])?.value || '').trim();
  },

  _getPaymentRef_raw() {
    const mode = document.getElementById('bkp-payment-mode')?.value || 'cheque';
    const refMap = { cheque: 'bkp-ref-cheque', draft: 'bkp-ref-draft', online: 'bkp-ref-online', card: 'bkp-ref-card', tds_challan: 'bkp-tds-challan-no' };
    return document.getElementById(refMap[mode]) || null;
  },

  _prefillPayment(bk) {
    // Switch to the correct payment tab
    if (bk.payment_mode) this.switchPaymentTab(bk.payment_mode);
    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
    setVal('bkp-receipt-date',    bk.booking_date);
    setVal('bkp-received-for',    bk.received_for);
    setVal('bkp-account-holder',  bk.account_holder);
    setVal('bkp-remark',          bk.remarks);
    setVal('bkp-on-account-of',   bk.on_account_of);
    setVal('bkp-amt-cheque',      bk.booking_amount);
    setVal('bkp-amt-draft',       bk.booking_amount);
    setVal('bkp-amt-online',      bk.booking_amount);
    setVal('bkp-amt-cash',        bk.booking_amount);
    setVal('bkp-amt-card',        bk.booking_amount);
    setVal('bkp-interest-amt',    bk.interest_amount);
    if (bk.invoice_date_by) this.setToggleValue('invoice_date_by', bk.invoice_date_by, ['bkp-idb-receipt','bkp-idb-posting']);
    if (bk.interest_type)   this.setToggleValue('interest_type',   bk.interest_type,   ['bkp-int-incl','bkp-int-excl']);
    if (bk.extra_add_on_type) this.setToggleValue('extra_add_on_type', bk.extra_add_on_type, ['bkp-eao-incl','bkp-eao-excl']);
    if (bk.tds_type) this.setToggleValue('tds_type', bk.tds_type, ['bkp-tds-calc','bkp-tds-none']);
    if (bk.self_or_loan) this.setToggleValue('self_or_loan', bk.self_or_loan, ['bkp-self-btn','bkp-loan-btn']);
    // Reference
    const refMap = { cheque: 'bkp-ref-cheque', draft: 'bkp-ref-draft', online: 'bkp-ref-online', card: 'bkp-ref-card', tds_challan: 'bkp-tds-challan-no' };
    if (bk.payment_mode && refMap[bk.payment_mode]) setVal(refMap[bk.payment_mode], bk.payment_ref);
    // Taxes — always 0 for NRI/OCI/PIO regardless of stored value
    const _nat = (bk.nationality || '').toLowerCase();
    const _exempt = ['nri','oci','pio'].includes(_nat);
    if (bk.taxes) {
      setVal('bkp-cgst-pct', _exempt ? 0 : bk.taxes.cgst_pct);
      setVal('bkp-sgst-pct', _exempt ? 0 : bk.taxes.sgst_pct);
    } else if (_exempt) {
      setVal('bkp-cgst-pct', 0);
      setVal('bkp-sgst-pct', 0);
    }
    this.calculatePaymentTaxes();
    this.updateTaxLabels();
  },

  async confirmPayment() {
    const mode = document.getElementById('bkp-payment-mode')?.value || 'cheque';
    const amount = this._getPaymentValue();

    if (!amount || amount <= 0) {
      Utils.error('Booking amount must be greater than zero');
      return;
    }
    if (!mode) {
      Utils.error('Please select a payment mode');
      return;
    }

    const refOk = await this.validateChequeRef();
    if (!refOk) return;

    const btn = document.getElementById('bkp-confirm-btn');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
      const chequeDate = document.getElementById('bkp-chqdate-cheque')?.value
        || document.getElementById('bkp-chqdate-draft')?.value
        || document.getElementById('bkp-chqdate-online')?.value
        || document.getElementById('bkp-chqdate-card')?.value || null;
      const bankName = document.getElementById('bkp-bank-sel')?.value
        || document.getElementById('bkp-bank-draft')?.value
        || document.getElementById('bkp-bank-online')?.value
        || document.getElementById('bkp-bank-tds')?.value
        || document.getElementById('bkp-bank-card')?.value || null;
      const branchName = document.getElementById('bkp-branch-cheque')?.value
        || document.getElementById('bkp-branch-draft')?.value
        || document.getElementById('bkp-branch-online')?.value || null;

      await Api.patch(`/booking/${this._bookingId}`, {
        booking_amount:           amount,
        payment_mode:             mode,
        payment_ref:              this._getPaymentRef() || null,
        bank_name:                bankName,
        bank_branch:              branchName,
        cheque_date:              chequeDate,
        received_for:             document.getElementById('bkp-received-for')?.value || null,
        account_holder:           document.getElementById('bkp-account-holder')?.value || null,
        on_account_of:            document.getElementById('bkp-on-account-of')?.value || 'Booking',
        invoice_date_by:          document.getElementById('bkp-invoice-date-by')?.value || 'receipt_date',
        interest_type:            document.getElementById('bkp-interest-type')?.value || 'exclusive',
        extra_add_on_type:        document.getElementById('bkp-extra-add-on-type')?.value || 'exclusive',
        tds_type:                 document.getElementById('bkp-tds-type')?.value || 'not_calculate',
        self_or_loan:             document.getElementById('bkp-self-or-loan')?.value || 'self',
        interest_amount:          parseFloat(document.getElementById('bkp-interest-amt')?.value || 0),
        dealer_adjustment_amount: parseFloat(document.getElementById('bkp-amt-dealer')?.value || 0),
        // Tax values
        s_tax_pct:        parseFloat(document.getElementById('bkp-stax-pct')?.value || 0),
        cgst_pct:         parseFloat(document.getElementById('bkp-cgst-pct')?.value || 0),
        sgst_pct:         parseFloat(document.getElementById('bkp-sgst-pct')?.value || 0),
        gst_interest_pct: parseFloat(document.getElementById('bkp-gst-int-pct')?.value || 0),
        cgst_amount:      parseFloat(document.getElementById('bkp-cgst-amount')?.value || 0),
        sgst_amount:      parseFloat(document.getElementById('bkp-sgst-amount')?.value || 0),
        tds_amount:       parseFloat(document.getElementById('bkp-tds-amount')?.value || 0),
      });

      // Show confirmation
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999';
      overlay.innerHTML = `
        <div onclick="event.stopPropagation()" style="position:relative;background:var(--surface);border-radius:12px;padding:40px;max-width:480px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3)">
          <button id="bkp-modal-close" style="position:absolute;top:12px;right:12px;background:none;border:none;font-size:18px;cursor:pointer;color:#666;line-height:1">✕</button>
          <div style="width:60px;height:60px;background:#22c55e;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:28px;color:#fff">✓</div>
          <h2 style="color:var(--text);font-size:22px;margin-bottom:8px">Payment Confirmed!</h2>
          <p style="color:var(--text2);margin-bottom:24px">Payment has been successfully recorded</p>
          <div style="background:var(--surface2);border-radius:8px;padding:16px;margin-bottom:24px;text-align:left">
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
              <span style="color:var(--text2)">Registration No.</span>
              <span style="color:var(--teal);font-weight:700">${this._regNo}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
              <span style="color:var(--text2)">Amount</span>
              <span style="font-weight:600">${Utils.currency(amount)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:6px 0">
              <span style="color:var(--text2)">Mode</span>
              <span style="font-weight:600;text-transform:capitalize">${mode.replace(/_/g,' ')}</span>
            </div>
          </div>
          <div style="display:flex;gap:10px">
            <button id="bkp-print-btn" style="flex:1;padding:12px;background:#fff;border:1px solid #ccc;border-radius:6px;cursor:pointer;font-size:13px">🖨 Print Receipt</button>
            <button id="bkp-done-btn" class="btn btn-teal" style="flex:1;padding:12px">View Consumer Profile</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);

      // FIX B — ESC key closes modal
      const escHandler = (e) => {
        if (e.key === 'Escape') { closeModal(); }
      };
      document.addEventListener('keydown', escHandler);

      const closeModal = () => {
        btn.disabled = false;
        btn.textContent = 'CONFIRM PAYMENT';
        if (overlay.parentNode) document.body.removeChild(overlay);
        document.removeEventListener('keydown', escHandler);
      };

      // FIX A — ✕ button
      document.getElementById('bkp-modal-close').onclick = closeModal;

      // FIX C — backdrop click closes modal (inner card has stopPropagation)
      overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };

      document.getElementById('bkp-print-btn').onclick = () => {
        const token = localStorage.getItem('rof-jwt') || '';
        window.open(
          '/api/booking/' + this._bookingId + '/receipt-html?token=' + encodeURIComponent(token),
          '_blank',
          'width=960,height=720,scrollbars=yes,resizable=yes'
        );
      };
      // FIX D — View Consumer Profile cleans up ESC listener
      document.getElementById('bkp-done-btn').onclick = () => {
        closeModal();
        if (this._booking?.consumer_id) {
          Router.navigate('/consumer', { id: this._booking.consumer_id });
        } else {
          Router.navigate('/consumers');
        }
      };
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to save payment';
      Utils.error(msg);
      btn.disabled = false;
      btn.textContent = 'CONFIRM PAYMENT';
    }
  },
};

window.BkPayPage = BkPayPage;
