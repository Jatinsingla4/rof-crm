// ROF CRM — GST Invoicing Page (Full Module)
// GST rates: Affordable Housing (AHP) = 5% (2.5% CGST + 2.5% SGST intrastate | 5% IGST interstate)

Pages.gstInvoicing = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="page-hdr">
      <h1>GST Invoicing</h1>
      <div class="breadcrumb">Application / <b>GST Invoicing</b></div>
    </div>
    <div class="tabs-line" style="flex-wrap:wrap;gap:2px">
      <button class="tab-line active" data-group="gst" data-tab="setup" onclick="switchTab('gst','setup')">Setup</button>
      <button class="tab-line" data-group="gst" data-tab="invoice-gen" onclick="switchTab('gst','invoice-gen')">Invoice Generation</button>
      <button class="tab-line" data-group="gst" data-tab="manual-invoice" onclick="switchTab('gst','manual-invoice')">Manual Invoice</button>
      <button class="tab-line" data-group="gst" data-tab="invoice-reversal" onclick="switchTab('gst','invoice-reversal')">Invoice Reversal</button>
      <button class="tab-line" data-group="gst" data-tab="invoice-cancel" onclick="switchTab('gst','invoice-cancel')">Invoice Cancellation</button>
      <button class="tab-line" data-group="gst" data-tab="invoice-advance" onclick="switchTab('gst','invoice-advance')">Invoice Against Advance</button>
      <button class="tab-line" data-group="gst" data-tab="credit-debit" onclick="switchTab('gst','credit-debit')">Credit/Debit Note</button>
      <button class="tab-line" data-group="gst" data-tab="pending-invoice" onclick="switchTab('gst','pending-invoice');GSTPage.loadPending()">Pending Invoice</button>
      <button class="tab-line" data-group="gst" data-tab="report" onclick="switchTab('gst','report');GSTPage.loadReport()">Report</button>
      <button class="tab-line" data-group="gst" data-tab="user-rights" onclick="switchTab('gst','user-rights')">User Rights</button>
    </div>

    <style>
      [data-panel-group="gst"] { max-width:1180px; margin-left:auto; margin-right:auto }
      [data-panel-group="gst"] .sp, [data-panel-group="gst"] .tbl-wrap { border-radius:10px; overflow:hidden; margin-bottom:16px !important }
      [data-panel-group="gst"] .sp-hdr, [data-panel-group="gst"] .tbl-hdr { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; padding:14px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border) }
      [data-panel-group="gst"] .sp-title, [data-panel-group="gst"] .tbl-title { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
      [data-panel-group="gst"] .sp-body { padding:18px }
      [data-panel-group="gst"] .sp-grid { gap:16px 18px }
      @media (max-width:900px) { [data-panel-group="gst"] .sp-grid { grid-template-columns:repeat(2,minmax(0,1fr)) !important } [data-panel-group="gst"] .fg { grid-column:auto !important } }
      @media (max-width:640px) { [data-panel-group="gst"] .sp-grid { grid-template-columns:minmax(0,1fr) !important } }
      [data-panel-group="gst"] .fg { gap:6px }
      [data-panel-group="gst"] .fl { font-size:11px; font-weight:500; text-transform:none; letter-spacing:.3px; color:var(--text2) }
      [data-panel-group="gst"] .fc { padding:9px 12px; font-size:13px; border-radius:8px; min-height:38px }
      [data-panel-group="gst"] .fc:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg) }
      [data-panel-group="gst"] .btn-lg, [data-panel-group="gst"] .btn-fetch { padding:9px 24px; font-size:12.5px; border-radius:8px; min-height:38px; font-weight:600 }
      [data-panel-group="gst"] .btn-fetch, [data-panel-group="gst"] .btn-fetch:hover { background:var(--teal) !important; color:#fff !important; border:none }
      [data-panel-group="gst"] .btg-item { padding:7px 16px; font-size:12px; border-radius:8px; border:1px solid var(--border2) }
      [data-panel-group="gst"] .alert { border-radius:8px; margin-bottom:16px !important }
      [data-panel-group="gst"] #gst-rate-preview, [data-panel-group="gst"] [id$="-calc"], [data-panel-group="gst"] #rev-invoice-detail .sp, [data-panel-group="gst"] #can-invoice-detail .sp { border-radius:10px !important; background:var(--surface2) !important }
      [data-panel-group="gst"] .kpi-row { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:14px; margin-bottom:16px }
      [data-panel-group="gst"] #pending-body, [data-panel-group="gst"] #gst-reports-body, [data-panel-group="gst"] #cdn-list, [data-panel-group="gst"] #gst-rights-body { overflow-x:auto }
      [data-panel-group="gst"] #pending-body, [data-panel-group="gst"] #gst-reports-body, [data-panel-group="gst"] #cdn-list:not(:empty) { background:var(--surface); border:1px solid var(--border2); border-radius:10px }
      [data-panel-group="gst"] table { width:100%; border-collapse:collapse; font-size:12.5px }
      [data-panel-group="gst"] table th { text-align:left; padding:10px 14px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; color:var(--text3); background:var(--surface2); border-bottom:1px solid var(--border2); white-space:nowrap }
      [data-panel-group="gst"] table td { padding:10px 14px; border-bottom:1px solid var(--border); color:var(--text); vertical-align:middle }
      [data-panel-group="gst"] table tbody tr:hover td { background:var(--surface2) }
      [data-panel-group="gst"] table tbody tr:last-child td { border-bottom:none }
      [data-panel-group="gst"] table .td-bold { font-weight:600 }
    </style>

    <!-- SETUP TAB -->
    <div data-panel-group="gst" data-panel="setup">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">GST Configuration</div></div>
        <div class="sp-body">
          <div class="sp-grid">
            <div class="fg"><label class="fl">GSTIN (Developer)</label>
              <input class="fc" id="gst-gstin-dev" placeholder="e.g. 06AXXXX0000X1Z5" maxlength="15">
            </div>
            <div class="fg"><label class="fl">Legal Name</label>
              <input class="fc" id="gst-legal-name" value="ROF Infratech & Housing Pvt. Ltd.">
            </div>
            <div class="fg"><label class="fl">State</label>
              <select class="fc" id="gst-state">
                <option value="haryana">Haryana (Intrastate)</option>
                <option value="other">Other State (Interstate)</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Default GST Rate</label>
              <select class="fc" id="gst-default-rate" onchange="GSTPage.updateRatePreview()">
                <option value="5" selected>5% — Affordable Housing (AHP/EWS/LIG/MIG)</option>
                <option value="12">12% — Regular Residential</option>
                <option value="18">18% — Commercial / Services</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Invoice Prefix</label>
              <input class="fc" id="gst-inv-prefix" value="ROF" maxlength="10">
            </div>
            <div class="fg"><label class="fl">Financial Year</label>
              <select class="fc" id="gst-fy">
                <option value="2025-26">2025-26</option>
                <option value="2026-27" selected>2026-27</option>
              </select>
            </div>
          </div>
          <div id="gst-rate-preview" style="margin-top:14px;padding:12px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;font-size:12px">
            <div style="font-weight:600;color:var(--text);margin-bottom:8px">Rate Breakdown Preview (on ₹10,00,000 base)</div>
            <div id="gst-rate-breakdown"></div>
          </div>
          <div style="margin-top:12px;display:flex;gap:8px">
            <button class="btn btn-teal btn-lg" onclick="GSTPage.saveSetup()">Save Configuration</button>
          </div>
          <div id="setup-result" style="margin-top:10px"></div>
        </div>
      </div>

      <div class="kpi-row" id="gst-kpis">
        ${[...Array(5)].map(() => `<div class="kpi"><div class="page-loading"><div class="spinner"></div></div></div>`).join('')}
      </div>
    </div>

    <!-- INVOICE GENERATION TAB -->
    <div data-panel-group="gst" data-panel="invoice-gen" style="display:none">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Generate GST Invoice</div></div>
        <div class="sp-body">
          <div class="sp-grid">
            <div class="fg"><label class="fl"><span class="r">*</span>Consumer</label>
              <select class="fc" id="gst-gen-consumer" onchange="GSTPage.onConsumerChange('gen')">
                <option value="">— Select Consumer —</option>
              </select>
            </div>
            <div class="fg"><label class="fl"><span class="r">*</span>Receipt / Payment Reference</label>
              <select class="fc" id="gst-gen-receipt" onchange="GSTPage.onReceiptChange()">
                <option value="">— Select Receipt —</option>
              </select>
            </div>
            <div class="fg"><label class="fl"><span class="r">*</span>Taxable Amount (₹)</label>
              <input type="number" class="fc" id="gst-gen-amount" placeholder="0" min="0" step="0.01" oninput="GSTPage.calcInvoice('gen')">
            </div>
            <div class="fg"><label class="fl">Invoice Type</label>
              <select class="fc" id="gst-gen-type">
                <option value="tax_invoice">Tax Invoice</option>
                <option value="proforma">Proforma Invoice</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Invoice Date</label>
              <input type="date" class="fc" id="gst-gen-date" value="${Utils.today()}">
            </div>
            <div class="fg"><label class="fl">GST Rate</label>
              <select class="fc" id="gst-gen-rate" onchange="GSTPage.calcInvoice('gen')">
                <option value="5" selected>5% (AHP)</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Supply Type</label>
              <select class="fc" id="gst-gen-supply" onchange="GSTPage.calcInvoice('gen')">
                <option value="intrastate">Intrastate (CGST+SGST)</option>
                <option value="interstate">Interstate (IGST)</option>
              </select>
            </div>
            <div class="fg" style="grid-column:span 2"><label class="fl">Description of Supply</label>
              <input class="fc" id="gst-gen-desc" placeholder="e.g. Payment towards allotment of Unit A-304, ROF Aalayas, Gurugram">
            </div>
          </div>
          <!-- GST Calculation Box -->
          <div id="gst-gen-calc" style="margin-top:14px;display:none;padding:12px;background:var(--bg2);border:1px solid var(--border);border-radius:8px">
            <div style="font-size:11px;font-weight:600;color:var(--teal);margin-bottom:8px">GST Calculation</div>
            <div id="gst-gen-calc-rows" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;font-size:11px"></div>
          </div>
          <div style="margin-top:12px;display:flex;gap:8px">
            <button class="btn btn-teal btn-lg" onclick="GSTPage.generateInvoice('gen')">Generate Invoice</button>

          </div>
          <div id="gst-gen-result" style="margin-top:12px"></div>
        </div>
      </div>
    </div>

    <!-- MANUAL INVOICE TAB -->
    <div data-panel-group="gst" data-panel="manual-invoice" style="display:none">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Manual Invoice Generation</div></div>
        <div class="sp-body">
          <div class="alert alert-info" style="margin-bottom:12px">
            Use for cases where payment was received outside the system or for advance tax invoices.
          </div>
          <div class="sp-grid">
            <div class="fg"><label class="fl"><span class="r">*</span>Consumer</label>
              <select class="fc" id="gst-man-consumer" onchange="GSTPage.onConsumerChange('man')">
                <option value="">— Select Consumer —</option>
              </select>
            </div>
            <div class="fg"><label class="fl"><span class="r">*</span>Base Amount (₹)</label>
              <input type="number" class="fc" id="gst-man-amount" placeholder="0" oninput="GSTPage.calcInvoice('man')">
            </div>
            <div class="fg"><label class="fl">GST Rate</label>
              <select class="fc" id="gst-man-rate" onchange="GSTPage.calcInvoice('man')">
                <option value="5" selected>5% (AHP)</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Supply Type</label>
              <select class="fc" id="gst-man-supply" onchange="GSTPage.calcInvoice('man')">
                <option value="intrastate">Intrastate (CGST+SGST)</option>
                <option value="interstate">Interstate (IGST)</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Invoice Date</label>
              <input type="date" class="fc" id="gst-man-date" value="${Utils.today()}">
            </div>
            <div class="fg"><label class="fl">Buyer GSTIN</label>
              <input class="fc" id="gst-man-gstin" placeholder="Leave blank for individuals" maxlength="15">
            </div>
            <div class="fg" style="grid-column:span 2"><label class="fl">Description</label>
              <input class="fc" id="gst-man-desc" placeholder="Description of supply">
            </div>
          </div>
          <div id="gst-man-calc" style="margin-top:14px;display:none;padding:12px;background:var(--bg2);border:1px solid var(--border);border-radius:8px">
            <div style="font-size:11px;font-weight:600;color:var(--teal);margin-bottom:8px">GST Calculation</div>
            <div id="gst-man-calc-rows" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;font-size:11px"></div>
          </div>
          <div style="margin-top:12px;display:flex;gap:8px">
            <button class="btn btn-teal btn-lg" onclick="GSTPage.generateInvoice('man')">Generate Manual Invoice</button>
          </div>
          <div id="gst-man-result" style="margin-top:12px"></div>
        </div>
      </div>
    </div>

    <!-- INVOICE REVERSAL TAB -->
    <div data-panel-group="gst" data-panel="invoice-reversal" style="display:none">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Invoice Reversal</div></div>
        <div class="sp-body">
          <div class="alert alert-warn" style="margin-bottom:12px">
            ⚠ Invoice reversal is used when a tax invoice needs to be reversed due to contractual changes. A credit note will be automatically issued.
          </div>
          <div class="sp-grid">
            <div class="fg"><label class="fl"><span class="r">*</span>Original Invoice No.</label>
              <input class="fc" id="rev-inv-no" placeholder="ROF/2026/XXXX">
            </div>
            <div class="fg"><label class="fl">Reversal Date</label>
              <input type="date" class="fc" id="rev-date" value="${Utils.today()}">
            </div>
            <div class="fg" style="grid-column:span 2"><label class="fl">Reason for Reversal</label>
              <input class="fc" id="rev-reason" placeholder="Reason for reversal">
            </div>
          </div>
          <div style="margin-top:10px;display:flex;gap:8px">
            <button class="btn btn-ghost" onclick="GSTPage.fetchInvoice('rev')">Fetch Invoice Details</button>
            <button class="btn btn-danger btn-lg" onclick="GSTPage.reverseInvoice()">Confirm Reversal</button>
          </div>
          <div id="rev-result" style="margin-top:12px"></div>
        </div>
      </div>
      <div id="rev-invoice-detail"></div>
    </div>

    <!-- INVOICE CANCELLATION TAB -->
    <div data-panel-group="gst" data-panel="invoice-cancel" style="display:none">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Invoice Cancellation</div></div>
        <div class="sp-body">
          <div class="alert alert-warn" style="margin-bottom:12px">
            ⚠ Cancellation is irreversible. Only invoices not yet filed in GSTR-1 can be cancelled. A credit note will be issued.
          </div>
          <div class="sp-grid">
            <div class="fg"><label class="fl"><span class="r">*</span>Invoice Number</label>
              <input class="fc" id="can-inv-no" placeholder="ROF/2026/XXXX">
            </div>
            <div class="fg"><label class="fl">Cancellation Reason</label>
              <select class="fc" id="can-reason">
                <option value="data_entry_error">Data Entry Error</option>
                <option value="duplicate">Duplicate Invoice</option>
                <option value="goods_returned">Transaction Cancelled</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div style="margin-top:10px;display:flex;gap:8px">
            <button class="btn btn-ghost" onclick="GSTPage.fetchInvoice('can')">Fetch Invoice</button>
            <button class="btn btn-danger btn-lg" onclick="GSTPage.cancelInvoice()">Cancel Invoice &amp; Issue Credit Note</button>
          </div>
          <div id="can-result" style="margin-top:12px"></div>
        </div>
      </div>
      <div id="can-invoice-detail"></div>
    </div>

    <!-- INVOICE AGAINST ADVANCE TAB -->
    <div data-panel-group="gst" data-panel="invoice-advance" style="display:none">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Invoice Against Advance</div></div>
        <div class="sp-body">
          <div class="alert alert-info" style="margin-bottom:12px">
            Under GST, tax must be paid on advance receipts. Generate a Receipt Voucher (RV) against advance payments, then adjust when final invoice is raised.
          </div>
          <div class="sp-grid">
            <div class="fg"><label class="fl"><span class="r">*</span>Consumer</label>
              <select class="fc" id="adv-consumer" onchange="GSTPage.loadAdvances(this.value)">
                <option value="">— Select Consumer —</option>
              </select>
            </div>
            <div class="fg"><label class="fl"><span class="r">*</span>Advance Amount (₹)</label>
              <input type="number" class="fc" id="adv-amount" placeholder="0" oninput="GSTPage.calcInvoice('adv')">
            </div>
            <div class="fg"><label class="fl">GST Rate</label>
              <select class="fc" id="gst-adv-rate" onchange="GSTPage.calcInvoice('adv')">
                <option value="5" selected>5% (AHP)</option>
                <option value="18">18%</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Receipt Date</label>
              <input type="date" class="fc" id="adv-date" value="${Utils.today()}">
            </div>
          </div>
          <div id="gst-adv-calc" style="margin-top:14px;display:none;padding:12px;background:var(--bg2);border:1px solid var(--border);border-radius:8px">
            <div style="font-size:11px;font-weight:600;color:var(--teal);margin-bottom:8px">GST on Advance</div>
            <div id="gst-adv-calc-rows" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;font-size:11px"></div>
          </div>
          <div style="margin-top:12px;display:flex;gap:8px">
            <button class="btn btn-teal btn-lg" onclick="GSTPage.generateInvoice('adv')">Generate Receipt Voucher</button>
          </div>
          <div id="gst-adv-result" style="margin-top:12px"></div>
        </div>
      </div>
    </div>

    <!-- CREDIT/DEBIT NOTE TAB -->
    <div data-panel-group="gst" data-panel="credit-debit" style="display:none">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Credit / Debit Note Against Invoice</div></div>
        <div class="sp-body">
          <div class="sp-grid">
            <div class="fg"><label class="fl">Note Type</label>
              <div style="display:flex;gap:6px" id="cdn-type-btg">
                <button type="button" class="btg-item on" onclick="GSTPage.selectNoteType(this,'credit')">Credit Note</button>
                <button type="button" class="btg-item" onclick="GSTPage.selectNoteType(this,'debit')">Debit Note</button>
              </div>
            </div>
            <div class="fg"><label class="fl"><span class="r">*</span>Original Invoice No.</label>
              <input class="fc" id="cdn-orig-inv" placeholder="ROF/2026/XXXX" oninput="GSTPage.fetchInvoice('cdn')">
            </div>
            <div class="fg"><label class="fl"><span class="r">*</span>Adjustment Amount (₹)</label>
              <input type="number" class="fc" id="cdn-amount" placeholder="0" oninput="GSTPage.calcInvoice('cdn')">
            </div>
            <div class="fg"><label class="fl">Note Date</label>
              <input type="date" class="fc" id="cdn-date" value="${Utils.today()}">
            </div>
            <div class="fg"><label class="fl">GST Rate</label>
              <select class="fc" id="gst-cdn-rate" onchange="GSTPage.calcInvoice('cdn')">
                <option value="5" selected>5%</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
              </select>
            </div>
            <div class="fg" style="grid-column:span 2"><label class="fl">Reason</label>
              <input class="fc" id="cdn-reason" placeholder="Reason for credit/debit note">
            </div>
          </div>
          <div id="gst-cdn-calc" style="margin-top:14px;display:none;padding:12px;background:var(--bg2);border:1px solid var(--border);border-radius:8px">
            <div style="font-size:11px;font-weight:600;color:var(--teal);margin-bottom:8px">Adjustment Calculation</div>
            <div id="gst-cdn-calc-rows" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;font-size:11px"></div>
          </div>
          <div style="margin-top:12px;display:flex;gap:8px">
            <button class="btn btn-teal btn-lg" onclick="GSTPage.generateCDN()">Issue Credit/Debit Note</button>
          </div>
          <div id="cdn-result" style="margin-top:12px"></div>
        </div>
      </div>
      <div id="cdn-list" style="margin-top:12px"></div>
    </div>

    <!-- PENDING INVOICE TAB -->
    <div data-panel-group="gst" data-panel="pending-invoice" style="display:none">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Receipts Pending Invoice Generation</div></div>
        <div class="sp-body">
          <div class="sp-grid">
            <div class="fg"><label class="fl">Project</label>
              <select class="fc" id="pi-proj">
                <option value="">— All Projects —</option>
              </select>
            </div>
            <div class="fg"><label class="fl">From Date</label>
              <input type="date" class="fc" id="pi-from" value="${Utils.monthStart()}">
            </div>
            <div class="fg"><label class="fl">To Date</label>
              <input type="date" class="fc" id="pi-to" value="${Utils.today()}">
            </div>
          </div>
          <button class="btn btn-fetch" style="margin-top:10px" onclick="GSTPage.loadPending()">FETCH</button>
        </div>
      </div>
      <div id="pending-kpis" class="kpi-row" style="margin-bottom:12px"></div>
      <div id="pending-body"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>

    <!-- REPORT TAB -->
    <div data-panel-group="gst" data-panel="report" style="display:none">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">GST Report</div></div>
        <div class="sp-body">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <input type="month" class="fc" id="gst-rpt-month" style="width:180px" value="${Utils.today().slice(0,7)}">
            <select class="fc" id="gst-rpt-project" style="width:200px">
              <option value="">— All Projects —</option>
            </select>
            <button class="btn btn-fetch btn-sm" onclick="GSTPage.loadReport()">FETCH</button>
            <button class="btn btn-ghost btn-sm" onclick="GSTPage.exportGstr('gstr1')">Export GSTR-1</button>
            <button class="btn btn-ghost btn-sm" onclick="GSTPage.exportGstr('gstr3b')">Export GSTR-3B</button>
          </div>
        </div>
      </div>
      <div id="gst-report-kpis" class="kpi-row" style="margin-bottom:12px"></div>
      <div id="gst-reports-body"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>

    <!-- USER RIGHTS TAB -->
    <div data-panel-group="gst" data-panel="user-rights" style="display:none">
      <div class="sp">
        <div class="sp-hdr"><div class="sp-title">GST Process User Rights</div></div>
        <div class="sp-body">
          <div class="alert alert-info" style="margin-bottom:12px">
            Control which users have access to GST invoice generation, cancellation, and reporting.
          </div>
          <div id="gst-rights-body">
            <table>
              <thead><tr><th>User</th><th>Role</th><th>Generate Invoice</th><th>Cancel Invoice</th><th>Issue Credit Note</th><th>View Reports</th></tr></thead>
              <tbody id="gst-rights-rows">
                <tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text3)"><div class="spinner" style="width:20px;height:20px;margin:0 auto"></div></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;

  await GSTPage.init(params);
};

const GSTPage = {
  _noteType: 'credit',

  async init(params) {
    await Promise.allSettled([
      this.loadConsumers(),
      this.loadProjects(),
      this.loadKpis(),
      this.updateRatePreview(),
      this.loadUserRights(),
    ]);

    if (params.tab && params.tab !== 'setup') {
      setTimeout(() => {
        const btn = document.querySelector(`[data-group="gst"][data-tab="${params.tab}"]`);
        if (btn) btn.click();
      }, 100);
    }
  },

  async loadConsumers() {
    try {
      const res = await Api.get('/consumers', { params: { pageSize: 300 } });
      const list = res.data || res || [];
      const opts = '<option value="">— Select Consumer —</option>' +
        list.map(c => `<option value="${c.id}">${c.name||`${c.first_name||''} ${c.last_name||''}`} · ${c.mobile||''}</option>`).join('');
      ['gst-gen-consumer','gst-man-consumer','adv-consumer'].forEach(id => {
        const el = document.getElementById(id); if (el) el.innerHTML = opts;
      });
    } catch {}
  },

  async loadProjects() {
    try {
      const res = await Api.get('/projects', { params: { pageSize: 100 } });
      const list = res.data || res || [];
      const opts = '<option value="">— All Projects —</option>' +
        list.map(p => `<option value="${p.id}">${Utils.esc(p.name)}</option>`).join('');
      ['pi-proj','gst-rpt-project'].forEach(id => {
        const el = document.getElementById(id); if (el) el.innerHTML = opts;
      });
    } catch {}
  },

  async loadKpis() {
    try {
      const res = await Api.get('/payments/gst-invoices', { params: { pageSize: 500 } });
      const list = res.data || res || [];
      const live = list.filter(i => i.status !== 'cancelled'); // a cancelled invoice is not turnover
      const totalBase = live.reduce((s,i) => s + parseFloat(i.base_amount||i.baseAmount||i.amount||0), 0);
      const totalGst  = live.reduce((s,i) => s + parseFloat(i.gst_amount||i.gstAmount||0), 0);
      const active    = list.filter(i => (i.status||'active') === 'active').length;
      const cancelled = list.filter(i => i.status === 'cancelled').length;

      const kpis = document.getElementById('gst-kpis');
      if (kpis) kpis.innerHTML = `
        <div class="kpi c-accent"><div class="kpi-lbl">Total Invoices</div><div class="kpi-val">${list.length}</div><div class="kpi-sub">${active} active · ${cancelled} cancelled</div></div>
        <div class="kpi c-teal"><div class="kpi-lbl">Taxable Amount</div><div class="kpi-val">${Utils.currency(totalBase)}</div><div class="kpi-sub">Base value</div></div>
        <div class="kpi c-blue"><div class="kpi-lbl">GST Collected</div><div class="kpi-val">${Utils.currency(totalGst)}</div><div class="kpi-sub">CGST: ${Utils.currency(totalGst/2)} + SGST: ${Utils.currency(totalGst/2)}</div></div>
        <div class="kpi c-green"><div class="kpi-lbl">Total (incl. GST)</div><div class="kpi-val">${Utils.currency(totalBase+totalGst)}</div><div class="kpi-sub">Gross turnover</div></div>
        <div class="kpi c-warn"><div class="kpi-lbl">Pending Invoices</div><div class="kpi-val">—</div><div class="kpi-sub">Awaiting generation</div></div>
      `;
    } catch {
      const kpis = document.getElementById('gst-kpis');
      if (kpis) kpis.innerHTML = `
        <div class="kpi c-accent"><div class="kpi-lbl">Total Invoices</div><div class="kpi-val">—</div></div>
        <div class="kpi c-teal"><div class="kpi-lbl">Taxable Amount</div><div class="kpi-val">—</div></div>
        <div class="kpi c-blue"><div class="kpi-lbl">GST Collected</div><div class="kpi-val">—</div></div>
        <div class="kpi c-green"><div class="kpi-lbl">Total</div><div class="kpi-val">—</div></div>
        <div class="kpi c-warn"><div class="kpi-lbl">Pending</div><div class="kpi-val">—</div></div>
      `;
    }
  },

  updateRatePreview() {
    const rate   = parseFloat(document.getElementById('gst-default-rate')?.value || '5');
    const state  = document.getElementById('gst-state')?.value || 'haryana';
    const base   = 1000000;
    const gst    = Math.round(base * rate / 100);
    const intra  = state === 'haryana';
    const el     = document.getElementById('gst-rate-breakdown');
    if (!el) return;

    el.innerHTML = intra
      ? `<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px">
          <div><div style="color:var(--text3)">Base Amount</div><div style="font-weight:600">${Utils.currency(base)}</div></div>
          <div><div style="color:var(--text3)">GST Rate</div><div style="font-weight:600">${rate}%</div></div>
          <div><div style="color:var(--teal)">CGST (${rate/2}%)</div><div style="font-weight:600;color:var(--teal)">${Utils.currency(gst/2)}</div></div>
          <div><div style="color:var(--blue)">SGST (${rate/2}%)</div><div style="font-weight:600;color:var(--blue)">${Utils.currency(gst/2)}</div></div>
          <div><div style="color:var(--text)">Total</div><div style="font-weight:700">${Utils.currency(base+gst)}</div></div>
        </div>`
      : `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
          <div><div style="color:var(--text3)">Base Amount</div><div style="font-weight:600">${Utils.currency(base)}</div></div>
          <div><div style="color:var(--text3)">GST Rate</div><div style="font-weight:600">${rate}%</div></div>
          <div><div style="color:var(--teal)">IGST (${rate}%)</div><div style="font-weight:600;color:var(--teal)">${Utils.currency(gst)}</div></div>
          <div><div style="color:var(--text)">Total</div><div style="font-weight:700">${Utils.currency(base+gst)}</div></div>
        </div>`;
  },

  calcInvoice(prefix) {
    const amountEl = document.getElementById(`gst-${prefix}-amount`) || document.getElementById(`${prefix}-amount`) || document.getElementById(`adv-amount`);
    const rateEl   = document.getElementById(`gst-${prefix}-rate`) || document.getElementById(`gst-adv-rate`) || document.getElementById(`gst-cdn-rate`);
    const supplyEl = document.getElementById(`gst-${prefix}-supply`);

    const base   = parseFloat(amountEl?.value || '0');
    const rate   = parseFloat(rateEl?.value || '5');
    const intra  = !supplyEl || supplyEl.value !== 'interstate';

    if (!base || base <= 0) {
      const calcBox = document.getElementById(`gst-${prefix}-calc`);
      if (calcBox) calcBox.style.display = 'none';
      return;
    }

    const gst    = Math.round(base * rate / 100);
    const total  = base + gst;
    const calcBox = document.getElementById(`gst-${prefix}-calc`);
    const rows    = document.getElementById(`gst-${prefix}-calc-rows`);
    if (!calcBox || !rows) return;

    calcBox.style.display = 'block';
    rows.innerHTML = intra
      ? `<div><div style="color:var(--text3)">Base</div><div style="font-weight:600">${Utils.currency(base)}</div></div>
         <div><div style="color:var(--teal)">CGST (${rate/2}%)</div><div style="font-weight:600;color:var(--teal)">${Utils.currency(gst/2)}</div></div>
         <div><div style="color:var(--blue)">SGST (${rate/2}%)</div><div style="font-weight:600;color:var(--blue)">${Utils.currency(gst/2)}</div></div>
         <div><div style="color:var(--text)">Total</div><div style="font-weight:700;font-size:14px">${Utils.currency(total)}</div></div>`
      : `<div><div style="color:var(--text3)">Base</div><div style="font-weight:600">${Utils.currency(base)}</div></div>
         <div><div style="color:var(--teal)">IGST (${rate}%)</div><div style="font-weight:600;color:var(--teal)">${Utils.currency(gst)}</div></div>
         <div></div>
         <div><div style="color:var(--text)">Total</div><div style="font-weight:700;font-size:14px">${Utils.currency(total)}</div></div>`;
  },

  async onConsumerChange(prefix) {
    const consumerId = document.getElementById(`gst-${prefix}-consumer`)?.value;
    if (prefix !== 'gen' || !consumerId) return;
    try {
      const res = await Api.get('/payments/receipts', { params: { consumerId, pageSize: 50 } });
      // a receipt that is cancelled or bounced, or already has a live invoice, is not offered
      const list = (res.data || res || []).filter(r => !r.invoice_number && !['cancelled', 'bounced'].includes(r.status));
      this._genReceipts = Object.fromEntries(list.map(r => [r.id, r]));
      const sel = document.getElementById('gst-gen-receipt');
      if (sel) sel.innerHTML = '<option value="">— Select Receipt —</option>' +
        list.map(r => `<option value="${r.id}">${r.receipt_number||r.id?.slice(0,8)} · ${Utils.currency(r.amount_received_inr)} · ${Utils.date(r.received_date||r.created_at)}</option>`).join('');
    } catch {}
  },

  // Picking a receipt fills the taxable amount and the rate from it (both can still be changed). A receipt already holds its GST
  // (Rs 2,82,800 = 2,80,000 + 1% GST), so the taxable part is the amount less that GST and the rate is what was collected;
  // taking the whole receipt at 5% made an invoice for more GST than the customer paid.
  onReceiptChange() {
    const r = (this._genReceipts || {})[document.getElementById('gst-gen-receipt')?.value];
    const amt = document.getElementById('gst-gen-amount'), rateSel = document.getElementById('gst-gen-rate');
    if (amt) {
      const gst = r ? (Number(r.cgst_amount) || 0) + (Number(r.sgst_amount) || 0) : 0;
      const taxable = r ? Math.round((Number(r.amount_received_inr) - gst) * 100) / 100 : '';
      amt.value = taxable;
      if (r && gst > 0 && taxable > 0 && rateSel) {
        const pct = Math.round(gst / taxable * 10000) / 100;
        let o = [...rateSel.options].find(x => Number(x.value) === pct);
        if (!o) { o = new Option(`${pct}% (as collected)`, String(pct)); rateSel.add(o); }
        rateSel.value = o.value;
      }
    }
    this.calcInvoice('gen');
  },

  async generateInvoice(prefix) {
    const consumerId  = document.getElementById(`gst-${prefix}-consumer`)?.value || document.getElementById('adv-consumer')?.value;
    const amountEl    = document.getElementById(`gst-${prefix}-amount`) || document.getElementById(`${prefix}-amount`) || document.getElementById('adv-amount');
    const rateEl      = document.getElementById(`gst-${prefix}-rate`) || document.getElementById('gst-adv-rate');
    const supplyEl    = document.getElementById(`gst-${prefix}-supply`);
    const dateEl      = document.getElementById(`gst-${prefix}-date`) || document.getElementById(`${prefix}-date`) || document.getElementById('adv-date');
    const descEl      = document.getElementById(`gst-${prefix}-desc`);
    const typeEl      = document.getElementById(`gst-${prefix}-type`);
    const result      = document.getElementById(`gst-${prefix}-result`);

    // The receipt belongs to the Generation tab and the GSTIN to the Manual tab; the other tabs must not pick up what was left there
    const receiptId   = prefix === 'gen' ? document.getElementById('gst-gen-receipt')?.value : '';
    const gstin       = prefix === 'man' ? document.getElementById('gst-man-gstin')?.value : '';

    if (!consumerId) { Utils.warn('Please select a consumer'); return; }

    let baseAmount = parseFloat(amountEl?.value || '0');

    if (!(baseAmount > 0)) { Utils.warn('Please enter the taxable amount'); return; }

    const rate    = parseFloat(rateEl?.value || '5');
    const intra   = !supplyEl || supplyEl.value !== 'interstate';
    const gstAmt  = Math.round(baseAmount * rate / 100);
    const total   = baseAmount + gstAmt;

    const body = {
      consumerId,
      baseAmount,
      gstRate: rate,
      gstAmount: gstAmt,
      totalAmount: total,
      supplyType: intra ? 'intrastate' : 'interstate',
      invoiceType: typeEl?.value || (prefix === 'adv' ? 'receipt_voucher' : 'tax_invoice'),
      description: descEl?.value || '',
      invoiceDate: dateEl?.value || Utils.today(),
      ...(receiptId && { receiptId }),
      ...(gstin && { buyerGstin: gstin }),
      cgstAmount: intra ? gstAmt/2 : 0,
      sgstAmount: intra ? gstAmt/2 : 0,
      igstAmount: intra ? 0 : gstAmt,
    };

    try {
      const res  = await Api.post('/payments/gst-invoices', body);
      const data = res.data || res;
      result.innerHTML = `
        <div class="alert alert-success">
          ✓ Invoice <strong>${data.invoice_number||data.invoiceNumber||'Generated'}</strong><br>
          Base: ${Utils.currency(baseAmount)} + GST (${rate}%): ${Utils.currency(gstAmt)} = <strong>${Utils.currency(total)}</strong>
          ${intra ? `(CGST: ${Utils.currency(gstAmt/2)} + SGST: ${Utils.currency(gstAmt/2)})` : `(IGST: ${Utils.currency(gstAmt)})`}
          ${data.id ? `<br><a href="#" onclick="event.preventDefault();GSTPage.printInvoice('${data.id}')" style="color:var(--teal)">Print invoice</a>` : ''}
        </div>`;
    } catch (err) {
      result.innerHTML = `<div class="alert alert-error">Error: ${err.message}</div>`;
    }
  },

  // The invoice as a printable page (print to PDF from the browser)
  async printInvoice(id) {
    try {
      const res = await fetch(`/api/payments/gst-invoices/${id}/html`, { headers: { Authorization: 'Bearer ' + (Auth.getToken() || '') } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not open the invoice');
      window.open(URL.createObjectURL(new Blob([await res.text()], { type: 'text/html' })), '_blank');
    } catch (err) { Utils.error(err.message); }
  },

  // GSTR-1 / GSTR-3B CSV of the month picked on the Report tab
  async exportGstr(type) {
    const month = document.getElementById('gst-rpt-month')?.value;
    if (!month) { Utils.warn('Pick a month first'); return; }
    const projId = document.getElementById('gst-rpt-project')?.value;
    try {
      const res = await fetch(`/api/payments/gst-invoices-export?type=${type}&month=${month}${projId ? '&projectId=' + projId : ''}`, { headers: { Authorization: 'Bearer ' + (Auth.getToken() || '') } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Export failed');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(await res.blob()); a.download = `${type}-${month}.csv`; a.click();
    } catch (err) { Utils.error(err.message); }
  },
  async fetchInvoice(prefix) {
    const invNo = document.getElementById(`${prefix}-inv-no`)?.value?.trim() || document.getElementById(`${prefix}-orig-inv`)?.value?.trim();
    if (!invNo) { Utils.warn('Please enter an invoice number'); return; }
    const detailEl = document.getElementById(`${prefix}-invoice-detail`);
    if (!detailEl) return;
    try {
      const res  = await Api.get('/payments/gst-invoices', { params: { invoiceNumber: invNo, pageSize: 5 } });
      const list = res.data || res || [];
      const inv  = list[0];
      if (!inv) { detailEl.innerHTML = '<div class="alert alert-warn">Invoice not found</div>'; return; }
      detailEl.innerHTML = `
        <div class="sp" style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px">
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;font-size:11px">
            <div><div style="color:var(--text3)">Invoice No.</div><div style="font-weight:600">${inv.invoice_number||'—'}</div></div>
            <div><div style="color:var(--text3)">Consumer</div><div style="font-weight:600"><a href="/api/consumers/${inv.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" style="color:var(--primary);text-decoration:underline;cursor:pointer" title="View Applicant File">${inv.consumer_name||inv.consumerName||'—'}</a></div></div>
            <div><div style="color:var(--teal)">Base</div><div style="font-weight:600">${Utils.currency(inv.base_amount||inv.amount||0)}</div></div>
            <div><div style="color:var(--blue)">GST</div><div style="font-weight:600">${Utils.currency(inv.gst_amount||0)} (${inv.gst_rate||5}%)</div></div>
            <div><div style="color:var(--text3)">Status</div><div>${Utils.chip(inv.status||'active')}</div></div>
            <div><div style="color:var(--text3)">Date</div><div>${Utils.date(inv.invoice_date||inv.created_at)}</div></div>
            <div><div style="color:var(--text)">Total</div><div style="font-weight:700">${Utils.currency((inv.base_amount||inv.amount||0)+(inv.gst_amount||0))}</div></div>
          </div>
        </div>`;
    } catch (err) { detailEl.innerHTML = `<div class="alert alert-error">${err.message}</div>`; }
  },

  async reverseInvoice() {
    const invNo  = document.getElementById('rev-inv-no')?.value?.trim();
    const reason = document.getElementById('rev-reason')?.value;
    const date   = document.getElementById('rev-date')?.value;
    if (!invNo)  { Utils.warn('Please enter an invoice number'); return; }
    const result = document.getElementById('rev-result');
    Utils.confirm(`Reverse invoice ${invNo}? A credit note will be issued.`, async () => {
      try {
        await Api.post('/payments/gst-invoices/reverse', { invoiceNumber: invNo, reason, reversalDate: date });
        result.innerHTML = `<div class="alert alert-success">✓ Invoice ${invNo} reversed. Credit note issued.</div>`;
      } catch (err) { result.innerHTML = `<div class="alert alert-error">Error: ${err.message}</div>`; }
    });
  },

  async cancelInvoice() {
    const invNo  = document.getElementById('can-inv-no')?.value?.trim();
    const reason = document.getElementById('can-reason')?.value;
    if (!invNo)  { Utils.warn('Please enter the invoice number'); return; }
    const result = document.getElementById('can-result');
    Utils.confirm(`Cancel invoice ${invNo}? A credit note will be issued. This is irreversible.`, async () => {
      try {
        await Api.post('/payments/gst-invoices/cancel', { invoiceNumber: invNo, reason });
        result.innerHTML = `<div class="alert alert-success">✓ Invoice ${invNo} cancelled. Credit note issued.</div>`;
      } catch (err) { result.innerHTML = `<div class="alert alert-error">Error: ${err.message}</div>`; }
    });
  },

  selectNoteType(btn, type) {
    btn.closest('#cdn-type-btg').querySelectorAll('.btg-item').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
    this._noteType = type;
  },

  async generateCDN() {
    const origInv  = document.getElementById('cdn-orig-inv')?.value?.trim();
    const amount   = parseFloat(document.getElementById('cdn-amount')?.value || '0');
    const date     = document.getElementById('cdn-date')?.value;
    const rate     = parseFloat(document.getElementById('gst-cdn-rate')?.value || '5');
    const reason   = document.getElementById('cdn-reason')?.value;
    const result   = document.getElementById('cdn-result');

    if (!origInv) { Utils.warn('Please enter the original invoice number'); return; }
    if (!amount || amount <= 0) { Utils.warn('Please enter adjustment amount'); return; }

    const gstAmt  = Math.round(amount * rate / 100);
    const total   = amount + gstAmt;

    try {
      await Api.post('/payments/gst-invoices/credit-debit-note', {
        noteType: this._noteType,
        originalInvoiceNumber: origInv,
        adjustmentAmount: amount,
        gstRate: rate,
        gstAmount: gstAmt,
        totalAmount: total,
        noteDate: date,
        reason,
      });
      result.innerHTML = `
        <div class="alert alert-success">
          ✓ ${this._noteType === 'credit' ? 'Credit' : 'Debit'} note raised against ${origInv}, it is issued once a checker approves it.
          Adjustment: ${Utils.currency(amount)} + GST: ${Utils.currency(gstAmt)} = ${Utils.currency(total)}
        </div>`;
    } catch (err) { result.innerHTML = `<div class="alert alert-error">Error: ${err.message}</div>`; }
  },

  async loadAdvances(consumerId) {
    if (!consumerId) return;
    // Would list unmatched advance receipts for the consumer
  },

  async loadPending() {
    const el    = document.getElementById('pending-body');
    const kpiEl = document.getElementById('pending-kpis');
    if (!el) return;
    el.innerHTML = '<div class="page-loading"><div class="spinner"></div> Loading…</div>';

    try {
      const params = { page: 1, pageSize: 300 };
      const projId = document.getElementById('pi-proj')?.value;
      const from   = document.getElementById('pi-from')?.value;
      const to     = document.getElementById('pi-to')?.value;
      if (projId) params.projectId = projId;
      if (from)   params.fromDate = from;
      if (to)     params.toDate   = to;

      // Receipts without an invoice
      const res  = await Api.get('/payments/receipts', { params });
      const list = (res.data || res || []).filter(r => !r.invoice_number && !['cancelled', 'bounced'].includes(r.status));

      const totalAmt = list.reduce((s,r) => s + parseFloat(r.amount_received_inr||0), 0);
      const estGst   = Math.round(totalAmt * 0.05);

      if (kpiEl) kpiEl.innerHTML = `
        <div class="kpi c-warn"><div class="kpi-lbl">Pending Receipts</div><div class="kpi-val">${list.length}</div><div class="kpi-sub">No invoice raised</div></div>
        <div class="kpi c-red"><div class="kpi-lbl">Taxable Amount</div><div class="kpi-val">${Utils.currency(totalAmt)}</div><div class="kpi-sub">Pending</div></div>
        <div class="kpi c-accent"><div class="kpi-lbl">Est. GST Liability (5%)</div><div class="kpi-val">${Utils.currency(estGst)}</div><div class="kpi-sub">CGST+SGST</div></div>
      `;

      el.innerHTML = list.length === 0
        ? '<div class="empty-state"><div class="empty-icon">✅</div><h3>All receipts have invoices generated</h3></div>'
        : `<table>
            <thead><tr><th>Receipt No.</th><th>Consumer</th><th>Amount (₹)</th><th>Mode</th><th>Date</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              ${list.map(r => `<tr>
                <td class="td-mono">${r.receipt_number||r.receiptNumber||'—'}</td>
                <td class="td-bold"><a href="/api/consumers/${r.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" onclick="event.stopPropagation()" style="color:var(--primary);text-decoration:underline;cursor:pointer" title="View Applicant File">${r.consumer_name||r.consumerName||'—'}</a></td>
                <td style="font-weight:600;color:var(--teal)">${Utils.currency(r.amount_received_inr)}</td>
                <td>${r.payment_method||'—'}</td>
                <td>${Utils.date(r.received_date||r.created_at)}</td>
                <td>${Utils.chip(r.status||r.approval_status||'pending')}</td>
                <td><button class="btn btn-teal btn-sm" onclick="GSTPage.quickGenerate('${r.id}','${r.consumer_id}',${Number(r.amount_received_inr)},this)">Gen Invoice</button></td>
              </tr>`).join('')}
            </tbody>
          </table>`;
    } catch (err) { el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`; }
  },

  async quickGenerate(receiptId, consumerId, amount, btn) {
    btn.disabled = true; btn.textContent = '…';
    try {
      // The server works the tax out from the receipt itself (the GST stored on it); the screen sends no rate or tax
      const res  = await Api.post('/payments/gst-invoices', { consumerId, receiptId, baseAmount: amount, supplyType: 'intrastate', invoiceType: 'tax_invoice' });
      const data = res.data || res;
      Utils.success(`Invoice ${data.invoice_number||'generated'} created`);
      btn.closest('tr').style.opacity = '0.4';
      btn.textContent = '✓';
    } catch (err) { Utils.error(err.message); btn.textContent = 'Gen Invoice'; btn.disabled = false; }
  },

  async loadReport() {
    const el    = document.getElementById('gst-reports-body');
    const kpiEl = document.getElementById('gst-report-kpis');
    if (!el) return;
    el.innerHTML = '<div class="page-loading"><div class="spinner"></div> Loading…</div>';

    try {
      const month   = document.getElementById('gst-rpt-month')?.value;
      const projId  = document.getElementById('gst-rpt-project')?.value;
      const params  = { pageSize: 500 };
      if (month) { const [y, m] = month.split('-').map(Number); params.from = `${month}-01`; params.to = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`; }
      if (projId) params.projectId = projId;

      const res  = await Api.get('/payments/gst-invoices', { params });
      const list = res.data || res || [];

      const live = list.filter(i => i.status !== 'cancelled'); // a cancelled invoice is not reported
      const totalBase = live.reduce((s,i) => s + parseFloat(i.base_amount||i.amount||0), 0);
      const totalGst  = live.reduce((s,i) => s + parseFloat(i.gst_amount||0), 0);
      const cgst      = live.reduce((s,i) => s + parseFloat(i.cgst_amount||i.cgstAmount||0), 0) || totalGst/2;
      const sgst      = live.reduce((s,i) => s + parseFloat(i.sgst_amount||i.sgstAmount||0), 0) || totalGst/2;
      const igst      = live.reduce((s,i) => s + parseFloat(i.igst_amount||i.igstAmount||0), 0);

      if (kpiEl) kpiEl.innerHTML = `
        <div class="kpi c-accent"><div class="kpi-lbl">Invoices</div><div class="kpi-val">${list.length}</div></div>
        <div class="kpi c-teal"><div class="kpi-lbl">Taxable Value</div><div class="kpi-val">${Utils.currency(totalBase)}</div></div>
        <div class="kpi c-blue"><div class="kpi-lbl">CGST</div><div class="kpi-val">${Utils.currency(cgst)}</div></div>
        <div class="kpi c-green"><div class="kpi-lbl">SGST</div><div class="kpi-val">${Utils.currency(sgst)}</div></div>
        <div class="kpi c-purple"><div class="kpi-lbl">IGST</div><div class="kpi-val">${Utils.currency(igst)}</div></div>
      `;

      const totalTax = totalGst;
      el.innerHTML = list.length === 0
        ? '<div class="empty-state"><div class="empty-icon">📊</div><h3>No invoices in selected period</h3></div>'
        : `<table>
            <thead><tr><th>Invoice No.</th><th>Consumer</th><th>Taxable (₹)</th><th>GST %</th><th>CGST (₹)</th><th>SGST (₹)</th><th>IGST (₹)</th><th>Total (₹)</th><th>Date</th><th>Status</th></tr></thead>
            <tbody>
              ${list.map(inv => {
                const base   = parseFloat(inv.base_amount||inv.amount||0);
                const rate   = inv.gst_rate||5;
                const gstAmt = parseFloat(inv.gst_amount||0);
                const cgstA  = parseFloat(inv.cgst_amount||inv.cgstAmount||0) || gstAmt/2;
                const sgstA  = parseFloat(inv.sgst_amount||inv.sgstAmount||0) || gstAmt/2;
                const igstA  = parseFloat(inv.igst_amount||inv.igstAmount||0);
                return `<tr>
                  <td class="td-mono">${inv.invoice_number||'—'}</td>
                  <td class="td-bold"><a href="/api/consumers/${inv.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" onclick="event.stopPropagation()" style="color:var(--primary);text-decoration:underline;cursor:pointer" title="View Applicant File">${inv.consumer_name||inv.consumerName||'—'}</a></td>
                  <td>${Utils.currency(base)}</td>
                  <td>${rate}%</td>
                  <td>${Utils.currency(cgstA)}</td>
                  <td>${Utils.currency(sgstA)}</td>
                  <td>${Utils.currency(igstA)}</td>
                  <td style="font-weight:700">${Utils.currency(base+gstAmt)}</td>
                  <td style="font-size:10.5px">${Utils.date(inv.invoice_date||inv.created_at)}</td>
                  <td>${Utils.chip(inv.status||'active')}</td>
                </tr>`;
              }).join('')}
            </tbody>
            <tfoot>
              <tr class="tfoot-total">
                <td colspan="2"><strong>Total</strong></td>
                <td><strong>${Utils.currency(totalBase)}</strong></td>
                <td></td>
                <td><strong>${Utils.currency(cgst)}</strong></td>
                <td><strong>${Utils.currency(sgst)}</strong></td>
                <td><strong>${Utils.currency(igst)}</strong></td>
                <td><strong>${Utils.currency(totalBase+totalTax)}</strong></td>
                <td colspan="2">${list.length} invoices</td>
              </tr>
            </tfoot>
          </table>`;
    } catch (err) { el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`; }
  },

  saveSetup() {
    const gstin = document.getElementById('gst-gstin-dev')?.value;
    const name  = document.getElementById('gst-legal-name')?.value;
    if (!gstin) { Utils.warn('Please enter GSTIN'); return; }
    const result = document.getElementById('setup-result');
    // Nothing is stored from this tab: the rates live in GST Configuration, and the invoice rate is chosen on each invoice
    result.innerHTML = '<div class="alert alert-warn">Nothing was saved here. GST rates and GSTIN are set in GST Configuration; the rate is chosen on each invoice.</div>';
    this.updateRatePreview();
  },

  async loadUserRights() {
    const tbody = document.getElementById('gst-rights-rows');
    if (!tbody) return;
    try {
      const res  = await Api.get('/users', { params: { pageSize: 50 } });
      const list = res.data || res || [];
      if (!list.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text3)">No users found</td></tr>'; return; }
      tbody.innerHTML = list.map(u => `<tr>
        <td class="td-bold">${u.name||u.username||'—'}</td>
        <td><span class="chip ch-blue">${u.role||'—'}</span></td>
        <td style="text-align:center">${this._rightToggle(u.id,'gen_invoice',['super_admin','accounts'].includes(u.role))}</td>
        <td style="text-align:center">${this._rightToggle(u.id,'cancel_invoice',u.role==='super_admin')}</td>
        <td style="text-align:center">${this._rightToggle(u.id,'issue_cdn',['super_admin','accounts'].includes(u.role))}</td>
        <td style="text-align:center">${this._rightToggle(u.id,'view_reports',true)}</td>
      </tr>`).join('');
    } catch { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text3)">No users found</td></tr>'; }
  },

  _rightToggle(userId, perm, enabled) {
    // Shown for information: who may do what follows the user's role and process access (Users screen), not these boxes
    return `<input type="checkbox" ${enabled?'checked':''} disabled title="Set in Users: role and process access" style="width:16px;height:16px">`;
  },

  toggleRight(userId, perm, val) {
    // Would call API to update user permission
    Utils.success(`Permission updated`);
  },
};
