// ROF CRM — Receipt Process Page

Pages.receipts = async function(params = {}) {
  const content = document.getElementById('content');

  content.innerHTML = `
    <div class="page-hdr">
      <h1>Receipt Process</h1>
      <div class="breadcrumb">Application / Receipt Process / <b>Receipt Entry</b></div>
    </div>
    <div class="tabs-line">
      <button class="tab-line active" data-group="rec" data-tab="entry" data-action="receipt-entry-tab" onclick="switchTab('rec','entry');ReceiptsPage.setFormMode('create')">Receipt Generation</button>
      <button class="tab-line" data-group="rec" data-tab="print" onclick="switchTab('rec','print');ReceiptsPage.initPrintTab()">Receipt Print</button>
      <button class="tab-line" data-group="rec" data-tab="list" onclick="switchTab('rec','list');ReceiptsPage.loadList()">Receipt List</button>
      <button class="tab-line" data-group="rec" data-tab="journal" data-action="journal-entry-tab" onclick="switchTab('rec','journal');ReceiptsPage.jeInit()">Journal Entry</button>
      <button class="tab-line" data-group="rec" data-tab="edit" onclick="switchTab('rec','edit');ReceiptsPage.loadEditSearch()">Edit Receipt</button>
      <button class="tab-line" data-group="rec" data-tab="cancel" onclick="switchTab('rec','cancel');ReceiptsPage.loadCancelSearch()">Cancel Receipt</button>
      <button class="tab-line" data-group="rec" data-tab="tds-report" onclick="switchTab('rec','tds-report');ReceiptsPage.loadTDSReport()">TDS Challan Report</button>
      <button class="tab-line" data-group="rec" data-tab="assign-tds" onclick="switchTab('rec','assign-tds');ReceiptsPage.loadAssignTDS()">Assign Receipt Challan</button>
      <button class="tab-line" data-group="rec" data-tab="upload-tds" onclick="switchTab('rec','upload-tds')">Upload Tds Challan</button>
    </div>

    <style>
      [data-panel-group="rec"] { max-width:1180px; margin-left:auto; margin-right:auto }
      [data-panel-group="rec"] .sp, [data-panel-group="rec"] .tbl-wrap { border-radius:10px; overflow:hidden; margin-bottom:16px !important }
      [data-panel-group="rec"] .sp-hdr, [data-panel-group="rec"] .tbl-hdr { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; padding:14px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border) }
      [data-panel-group="rec"] .sp-title, [data-panel-group="rec"] .tbl-title { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
      [data-panel-group="rec"] .sp-body { padding:18px }
      [data-panel-group="rec"] .sp-grid { gap:16px 18px }
      @media (max-width:900px) { [data-panel-group="rec"] .sp-grid { grid-template-columns:repeat(2,minmax(0,1fr)) !important } [data-panel-group="rec"] .fg { grid-column:auto !important } }
      @media (max-width:640px) { [data-panel-group="rec"] .sp-grid { grid-template-columns:minmax(0,1fr) !important } }
      [data-panel-group="rec"] .fg { gap:6px }
      [data-panel-group="rec"] .fl { font-size:11px; font-weight:500; text-transform:none; letter-spacing:.3px; color:var(--text2) }
      [data-panel-group="rec"] .fc { padding:9px 12px; font-size:13px; border-radius:8px; min-height:38px }
      [data-panel-group="rec"] .fc:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg) }
      [data-panel-group="rec"] .btn-lg, [data-panel-group="rec"] .btn-fetch { padding:9px 24px; font-size:12.5px; border-radius:8px; min-height:38px; font-weight:600 }
      [data-panel-group="rec"] .btn-fetch, [data-panel-group="rec"] .btn-fetch:hover { background:var(--teal) !important; color:#fff !important; border:none }
      [data-panel-group="rec"] .btg-item { padding:7px 16px; font-size:12px; border-radius:8px; border:1px solid var(--border2) }
      [data-panel-group="rec"] .alert { border-radius:8px; margin-bottom:16px !important }
      [data-panel-group="rec"] #hwc-body, [data-panel-group="rec"] #dup-body { background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow-x:auto }
      [data-panel-group="rec"] #hwc-body:empty, [data-panel-group="rec"] #dup-body:empty { display:none }
      [data-panel-group="rec"] .tbl-wrap, [data-panel-group="rec"] #rp-results-body, [data-panel-group="rec"] #receipt-list-body { overflow-x:auto }
      [data-panel-group="rec"] table { width:100%; border-collapse:collapse; font-size:12.5px }
      [data-panel-group="rec"] table th { text-align:left; padding:10px 14px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; color:var(--text3); background:var(--surface2); border-bottom:1px solid var(--border2); white-space:nowrap }
      [data-panel-group="rec"] table td { padding:10px 14px; border-bottom:1px solid var(--border); color:var(--text); vertical-align:middle }
      [data-panel-group="rec"] table tbody tr:hover td { background:var(--surface2) }
      [data-panel-group="rec"] table tbody tr:last-child td { border-bottom:none }
      [data-panel-group="rec"] table .td-bold { font-weight:600 }
    </style>

    <!-- RECEIPT ENTRY TAB -->
    <div data-panel-group="rec" data-panel="entry">
      <div class="sp" id="rec-search-block" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Search Consumer</div></div>
        <div class="sp-body">
          <div class="sp-grid">
            <div class="fg" style="grid-column:span 2">
              <label class="fl"><span class="r">*</span>Consumer</label>
              <select class="fc" id="rec-consumer-sel" onchange="ReceiptsPage.onConsumerChange()">
                <option value="">— Select Consumer —</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Search by Name</label>
              <input class="fc" id="rec-search-name" placeholder="Type to search…" oninput="ReceiptsPage.searchConsumers(this.value)">
            </div>
          </div>
          <button class="btn btn-fetch" style="margin-top:10px" onclick="ReceiptsPage.fetchConsumer()">FETCH CONSUMER</button>
        </div>
      </div>

      <!-- Consumer Financial Summary -->
      <div id="rec-fin-hdr" style="display:none;margin-bottom:12px">
        <div style="background:var(--surface2);border:1px solid var(--border2);border-radius:10px;padding:14px 18px">
          <div id="rec-consumer-title" style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:10px"></div>
          <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px" id="rec-fin-grid"></div>
        </div>
      </div>

      <!-- Receipt Form -->
      <div id="receipt-form" style="display:none">
        <input type="hidden" id="rec-consumer-id">
        <div class="sp" style="margin-bottom:12px">
          <div class="sp-hdr"><div class="sp-title">Payment Type</div></div>
          <div class="sp-body">
            <div style="display:flex;gap:6px;flex-wrap:wrap" id="rec-type-btg">
              ${['Cheque','NEFT/RTGS','UPI','Cash','Draft','Card'].map((t,i) =>
                `<button type="button" class="btg-item${i===0?' on':''}" onclick="ReceiptsPage.selectPayType(this,'${t.toLowerCase().replace('/','_')}')">${t}</button>`
              ).join('')}
            </div>
          </div>
        </div>

        <div class="sp" style="margin-bottom:12px">
          <div class="sp-hdr"><div class="sp-title">Instrument Details</div></div>
          <div class="sp-body">
            <div class="sp-grid">
              <div class="fg" id="rec-no-wrap" style="display:none"><label class="fl"><span class="r">*</span> Receipt No.</label>
                <input class="fc" id="rec-no" maxlength="40" placeholder="This project numbers receipts by hand">
              </div>
              <div class="fg"><label class="fl">Instrument / TXN No.</label>
                <input class="fc" id="rec-txn" placeholder="Cheque / TXN reference">
              </div>
              <div class="fg"><label class="fl">Instrument Date</label>
                <input type="date" class="fc" id="rec-cheque-date">
              </div>
              <div class="fg"><label class="fl">Bank Name</label>
                <input class="fc" id="rec-bank" placeholder="Bank name">
              </div>
              <div class="fg"><label class="fl">Branch</label>
                <input class="fc" id="rec-branch" placeholder="Branch">
              </div>
              <div class="fg"><label class="fl">Receipt Date <span class="r">*</span></label>
                <input type="date" class="fc" id="rec-date" value="${Utils.today()}">
              </div>
              <div class="fg"><label class="fl">Company Bank Account (Optional)</label>
                <select class="fc" id="rec-company-bank-account">
                  <option value="">— Select Bank Account —</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div class="sp" style="margin-bottom:12px">
          <div class="sp-hdr"><div class="sp-title">Payment Amount</div></div>
          <div class="sp-body">
            <div class="sp-grid">
              <div class="fg"><label class="fl">Base Amount <span class="r">*</span></label>
                <input type="number" class="fc rec-amt-input" id="rec-amount" placeholder="0.00" min="0" oninput="ReceiptsPage.calcTotal()">
              </div>
              <div class="fg"><label class="fl">PLC (Optional)</label>
                <input type="number" class="fc rec-amt-input" id="rec-plc" placeholder="0.00" min="0" oninput="ReceiptsPage.calcTotal()">
              </div>
              <div class="fg"><label class="fl">EDC (Optional)</label>
                <input type="number" class="fc rec-amt-input" id="rec-edc" placeholder="0.00" min="0" oninput="ReceiptsPage.calcTotal()">
              </div>
              <div class="fg"><label class="fl">IDC (Optional)</label>
                <input type="number" class="fc rec-amt-input" id="rec-idc" placeholder="0.00" min="0" oninput="ReceiptsPage.calcTotal()">
              </div>
              <div class="fg"><label class="fl">Interest (Optional)</label>
                <input type="number" class="fc rec-amt-input" id="rec-interest" placeholder="0.00" min="0" oninput="ReceiptsPage.calcTotal()">
              </div>
              <div class="fg"><label class="fl">Other Charges (Optional)</label>
                <input type="number" class="fc rec-amt-input" id="rec-other-charge" placeholder="0.00" min="0" oninput="ReceiptsPage.calcTotal()">
              </div>
              <div class="fg"><label class="fl">Other Charge Description</label>
                <input class="fc" id="rec-other-charge-desc" placeholder="e.g. Admin Fee, IFMS">
              </div>
              <div class="fg"><label class="fl">Total Amount</label>
                <input type="number" class="fc" id="rec-total-amount" placeholder="0.00" disabled style="background:var(--surface2);font-weight:bold;color:var(--teal)">
              </div>
              <div class="fg"><label class="fl">Instalment</label>
                <select class="fc" id="rec-instalment">
                  <option value="">— Select Instalment —</option>
                </select>
              </div>
              <div class="fg" style="grid-column: span 2"><label class="fl">Remarks</label>
                <input class="fc" id="rec-remarks" placeholder="Optional remarks">
              </div>
            </div>
            <div style="margin-top:10px;display:flex;gap:8px">
              <button class="btn btn-teal btn-lg" id="rec-submit-btn" onclick="ReceiptsPage.submit()">Save Receipt</button>
              <button class="btn btn-ghost" onclick="ReceiptsPage.reset()">Clear</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- RECEIPT PRINT TAB -->
    <div data-panel-group="rec" data-panel="print" style="display:none">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr">
          <div class="sp-title">SEARCH RECEIPTS FOR PRINTING</div>
          <div id="rp-project-label" style="font-size:13px;color:var(--text2);font-weight:500"></div>
        </div>
        <div class="sp-body">
          <div class="sp-grid" style="grid-template-columns:repeat(5,1fr)">
            <div class="fg"><label class="fl">Project</label>
              <select class="fc" id="rp-project" onchange="ReceiptsPage.loadPrintTowers(this.value)">
                <option value="">— All Projects —</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Tower</label>
              <select class="fc" id="rp-tower">
                <option value="">— All Towers —</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Registration No.</label>
              <input class="fc" id="rp-reg-no" placeholder="e.g. ALAN-2026-0001">
            </div>
            <div class="fg"><label class="fl">First Name</label>
              <input class="fc" id="rp-first-name" placeholder="Buyer first name">
            </div>
            <div class="fg"><label class="fl">Unit Address</label>
              <input class="fc" id="rp-unit-address" placeholder="Unit no. / address">
            </div>
            <div class="fg"><label class="fl">Receipt No.</label>
              <input class="fc" id="rp-receipt-no" placeholder="e.g. RCP/2026/0001">
            </div>
            <div class="fg"><label class="fl">Broker</label>
              <select class="fc" id="rp-broker">
                <option value="">— All Brokers —</option>
              </select>
            </div>
            <div class="fg"><label class="fl">From Date</label>
              <input type="date" class="fc" id="rp-from-date">
            </div>
            <div class="fg"><label class="fl">To Date</label>
              <input type="date" class="fc" id="rp-to-date">
            </div>
            <div class="fg"><label class="fl">Print Status</label>
              <select class="fc" id="rp-print-status">
                <option value="">— All —</option>
                <option value="not_printed">Not Printed</option>
                <option value="printed">Printed</option>
              </select>
            </div>
          </div>
          <button class="btn btn-fetch" style="margin-top:10px" id="rp-search-btn">FETCH</button>
        </div>
      </div>
      <div id="rp-results-wrap" style="display:none">
        <div class="tbl-wrap">
          <div class="tbl-hdr">
            <div class="tbl-title" id="rp-results-title">RECEIPTS</div>
            <div class="tbl-actions">
              <button class="btn btn-ghost btn-sm" id="rp-print-all-btn">🖨 Print All Visible</button>
            </div>
          </div>
          <div id="rp-results-body"></div>
        </div>
      </div>
    </div>

    <!-- RECEIPT LIST TAB -->
    <div data-panel-group="rec" data-panel="list" style="display:none">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Filters</div></div>
        <div class="sp-body">
          <div class="sp-grid">
            <div class="fg"><label class="fl">From Date</label>
              <input type="date" class="fc" id="list-from" value="${Utils.monthStart()}">
            </div>
            <div class="fg"><label class="fl">To Date</label>
              <input type="date" class="fc" id="list-to" value="${Utils.today()}">
            </div>
            <div class="fg"><label class="fl">Payment Mode</label>
              <select class="fc" id="list-mode">
                <option value="">— All Modes —</option>
                <option value="cheque">Cheque</option>
                <option value="neft_rtgs">NEFT/RTGS</option>
                <option value="upi">UPI</option>
                <option value="cash">Cash</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Status</label>
              <select class="fc" id="list-status">
                <option value="">— All Status —</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
          <button class="btn btn-fetch" style="margin-top:10px" onclick="ReceiptsPage.loadList()">FETCH</button>
        </div>
      </div>
      <div class="tbl-wrap">
        <div class="tbl-hdr">
          <div class="tbl-title">All Receipts</div>
          <div class="tbl-actions">
            
          </div>
        </div>
        <div id="receipt-list-body"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
    </div>

    <!-- PENDING APPROVAL TAB -->
    <div data-panel-group="rec" data-panel="approval" style="display:none">
      <div class="tbl-wrap">
        <div class="tbl-hdr">
          <div class="tbl-title">Pending Approval</div>
          <div class="tbl-actions">
            <button class="btn btn-ghost btn-sm" onclick="ReceiptsPage.loadApproval()">Refresh</button>
          </div>
        </div>
        <div id="approval-list-body"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
    </div>

    <!-- HEAD WISE COST TAB -->
    <div data-panel-group="rec" data-panel="head-wise-cost" style="display:none">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Head Wise Cost Report</div></div>
        <div class="sp-body">
          <div class="sp-grid">
            <div class="fg"><label class="fl">From Date</label>
              <input type="date" class="fc" id="hwc-from" value="${Utils.monthStart()}">
            </div>
            <div class="fg"><label class="fl">To Date</label>
              <input type="date" class="fc" id="hwc-to" value="${Utils.today()}">
            </div>
            <div class="fg"><label class="fl">Project</label>
              <select class="fc" id="hwc-project">
                <option value="">— All Projects —</option>
              </select>
            </div>
          </div>
          <button class="btn btn-fetch" style="margin-top:10px" onclick="ReceiptsPage.loadHeadWiseCost()">FETCH</button>
        </div>
      </div>
      <div id="hwc-kpis" class="kpi-row" style="margin-bottom:12px"></div>
      <div id="hwc-body"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>

    <!-- DUPLICATE RECEIPT TAB -->
    <div data-panel-group="rec" data-panel="duplicate" style="display:none">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Duplicate Receipt</div></div>
        <div class="sp-body">
          <div class="alert alert-info" style="margin-bottom:12px">
            Search for an existing approved receipt and generate a duplicate copy for the customer.
          </div>
          <div class="sp-grid">
            <div class="fg"><label class="fl">Receipt Number</label>
              <input class="fc" id="dup-receipt-no" placeholder="Enter receipt number">
            </div>
            <div class="fg"><label class="fl">Consumer</label>
              <select class="fc" id="dup-consumer">
                <option value="">— Select Consumer —</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Date Range (From)</label>
              <input type="date" class="fc" id="dup-from" value="${Utils.monthStart()}">
            </div>
            <div class="fg"><label class="fl">Date Range (To)</label>
              <input type="date" class="fc" id="dup-to" value="${Utils.today()}">
            </div>
          </div>
          <button class="btn btn-fetch" style="margin-top:10px" onclick="ReceiptsPage.searchForDuplicate()">SEARCH RECEIPT</button>
        </div>
      </div>
      <div id="dup-body"></div>
    </div>

    <!-- EDIT RECEIPT TAB -->
    <div data-panel-group="rec" data-panel="edit" style="display:none">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">EDIT RECEIPT</div></div>
        <div id="edit-receipt-body"></div>
      </div>
    </div>

    <!-- CANCEL RECEIPT TAB -->
    <div data-panel-group="rec" data-panel="cancel" style="display:none">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">CANCEL RECEIPT</div></div>
        <div id="cancel-receipt-body"></div>
      </div>
    </div>

    <!-- OVERDUE TAB -->
    <div data-panel-group="rec" data-panel="overdue" style="display:none">
      <div class="tbl-wrap">
        <div class="tbl-hdr"><div class="tbl-title">Overdue Payments</div></div>
        <div id="overdue-list-body"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
    </div>

    <!-- JOURNAL ENTRY TAB (with inner sub-tabs) -->
    <div data-panel-group="rec" data-panel="journal" style="display:none">

      <!-- Inner sub-tab bar -->
      <div style="display:flex;gap:0;border-bottom:2px solid var(--border2);margin-bottom:20px;overflow-x:auto;">
        <button id="je-tab-entry" onclick="ReceiptsPage.switchJeTab('entry')"
          style="padding:9px 18px;font-size:12.5px;font-weight:600;border:none;background:none;cursor:pointer;white-space:nowrap;color:var(--teal);border-bottom:2px solid var(--teal);margin-bottom:-2px;">
          Journal Entry
        </button>
        <button id="je-tab-dc" onclick="ReceiptsPage.switchJeTab('dc')"
          style="padding:9px 18px;font-size:12.5px;font-weight:600;border:none;background:none;cursor:pointer;white-space:nowrap;color:#6b7280;border-bottom:2px solid transparent;margin-bottom:-2px;">
          Debit / Credit
        </button>
        <button id="je-tab-report" onclick="ReceiptsPage.switchJeTab('report')"
          style="padding:9px 18px;font-size:12.5px;font-weight:600;border:none;background:none;cursor:pointer;white-space:nowrap;color:#6b7280;border-bottom:2px solid transparent;margin-bottom:-2px;">
          Journal Report
        </button>
        <button id="je-tab-reversal" onclick="ReceiptsPage.switchJeTab('reversal')"
          style="padding:9px 18px;font-size:12.5px;font-weight:600;border:none;background:none;cursor:pointer;white-space:nowrap;color:#6b7280;border-bottom:2px solid transparent;margin-bottom:-2px;">
          JV / Dr / Cr / Refund Reversal
        </button>
      </div>

      <!-- SUB-PANEL 1: Journal Entry (3-step flow) -->
      <div id="je-panel-entry">

        <!-- ── STEP 1: Consumer Search ── -->
        <div id="je-step-1">
          <div style="font-size:13px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid var(--border2);">
            JOURNAL ENTRY
          </div>
          <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:12px;margin-bottom:12px;padding:16px;background:var(--surface2);border-radius:8px;border:1px solid var(--border2);">
            <div>
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px;">*PROJECT:</label>
              <select id="je-project-filter" class="fc" style="width:100%;"><option value="">All Projects</option></select>
            </div>
            <div>
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px;">REGISTRATION NO.:</label>
              <input type="text" id="je-reg-filter" class="fc" placeholder="Registration No." style="width:100%;">
            </div>
            <div>
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px;">FIRST NAME:</label>
              <input type="text" id="je-name-filter" class="fc" placeholder="First Name" style="width:100%;">
            </div>
            <div>
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px;">UNIT ADDRESS:</label>
              <input type="text" id="je-unit-filter" class="fc" placeholder="Unit Address" style="width:100%;">
            </div>
          </div>
          <button id="je-fetch-btn" class="btn btn-fetch" style="margin-bottom:16px;" onclick="ReceiptsPage.jeFetch()">FETCH</button>
          <div id="je-results-container" style="display:none;">
            <div style="font-size:13px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">JOURNAL ENTRY</div>
            <div id="je-project-label" style="font-size:12px;color:var(--text2);margin-bottom:8px;"></div>
            <div class="tbl-wrap">
              <table>
                <thead><tr>
                  <th>S.NO</th><th>REGISTRATION NO.</th><th>NAME</th><th>UNIT TYPE</th><th>UNIT ADDRESS</th><th>PAID AMOUNT</th><th>SELECT</th>
                </tr></thead>
                <tbody id="je-results-body"></tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- ── STEP 2: Entry Form ── -->
        <div id="je-step-2" style="display:none;">
          <div style="font-size:12px;color:var(--text2);margin-bottom:10px;">
            <strong>Transfer From :</strong>&nbsp;Project: <span id="je-from-project" style="color:var(--text);font-weight:600;"></span>
          </div>
          <div class="tbl-wrap" style="margin-bottom:20px;">
            <table>
              <thead><tr><th>S.NO</th><th>REGISTRATION NO.</th><th>NAME</th><th>UNIT TYPE</th><th>UNIT ADDRESS</th><th>PAID AMOUNT</th><th>SELECT</th></tr></thead>
              <tbody id="je-from-body"></tbody>
            </table>
          </div>
          <div style="font-size:12px;color:var(--text2);margin-bottom:10px;">
            <strong>Transfer To :</strong>&nbsp;Project: <span id="je-to-project" style="color:var(--text);font-weight:600;"></span>
          </div>
          <div class="tbl-wrap" style="margin-bottom:20px;">
            <table>
              <thead><tr><th>REGISTRATION NO</th><th>NAME</th><th>UNIT TYPE</th><th>UNIT ADDRESS</th><th>PAID AMOUNT</th></tr></thead>
              <tbody id="je-to-body"></tbody>
            </table>
          </div>

          <!-- GST toggle + form fields -->
          <div style="display:grid;grid-template-columns:auto 1fr 1fr 1fr;gap:16px;align-items:end;margin-bottom:16px;">
            <div>
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px;">Service Tax / GST:</label>
              <div style="display:flex;">
                <button id="je-tax-none" onclick="ReceiptsPage.jeTaxToggle('none')"
                  style="padding:6px 11px;border:1px solid #0d9488;background:#0d9488;color:#fff;cursor:pointer;font-size:12px;font-weight:500;border-radius:4px 0 0 4px;">
                  Without Tax
                </button>
                <button id="je-tax-manual" onclick="ReceiptsPage.jeTaxToggle('manual')"
                  style="padding:6px 11px;border:1px solid #0d9488;border-left:none;background:#fff;color:#0d9488;cursor:pointer;font-size:12px;font-weight:500;border-radius:0;">
                  With Manual Tax
                </button>
                <button id="je-tax-auto" onclick="ReceiptsPage.jeTaxToggle('auto')"
                  style="padding:6px 11px;border:1px solid #0d9488;border-left:none;background:#fff;color:#0d9488;cursor:pointer;font-size:12px;font-weight:500;border-radius:0 4px 4px 0;">
                  With Auto Tax
                </button>
              </div>
            </div>
            <div>
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px;">Head Type</label>
              <select id="je-head-type" class="fc" style="width:100%;">
                <option value="">&lt;All&gt;</option>
                <option value="agreement_value">Agreement Value</option>
                <option value="basic">Basic</option>
                <option value="other_charge">Other Charge</option>
                <option value="plc">PLC</option>
                <option value="ifms">IFMS</option>
                <option value="interest">Interest</option>
                <option value="addon_charge">Addon Charge</option>
                <option value="excess">Excess</option>
              </select>
            </div>
            <div>
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px;">Amount:</label>
              <input type="number" id="je-amount" class="fc" placeholder="Amount" min="0" step="0.01" style="width:100%;">
            </div>
            <div>
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px;">Adjustment Date:</label>
              <input type="date" id="je-adj-date" class="fc" style="width:100%;">
            </div>
          </div>
          <div style="margin-bottom:16px;">
            <label style="display:block;font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px;">Remarks (Max 1000)</label>
            <textarea id="je-remarks" class="fc" maxlength="1000" rows="3" placeholder="Remarks" style="width:100%;box-sizing:border-box;resize:vertical;"></textarea>
          </div>
          <div style="display:flex;gap:8px;">
            <button id="je-continue-btn" class="btn btn-fetch" onclick="ReceiptsPage.jeContinue()">CONTINUE</button>
            <button id="je-clear-btn" class="btn" style="background:#6b7280;color:#fff;" onclick="ReceiptsPage.jeClear()">CLEAR</button>
          </div>
        </div>

        <!-- ── STEP 3: Debit/Credit Split ── -->
        <div id="je-step-3" style="display:none;">
          <div style="display:flex;flex-direction:column;gap:16px;margin-bottom:16px;">

            <!-- Debit panel -->
            <div>
              <div style="background:var(--surface2);color:var(--text);padding:12px 18px;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.6px;border:1px solid var(--border2);border-bottom:none;border-radius:10px 10px 0 0;">
                <span id="je-debit-title">PROJECT – NAME [REG] (DEBIT)</span>
              </div>
              <div style="border:1px solid var(--border2);border-top:none;border-radius:0 0 4px 4px;overflow:hidden;">
                <table style="width:100%;border-collapse:collapse;font-size:12px;">
                  <thead><tr><th style="padding:8px 10px;text-align:left;">S.No.</th><th style="padding:8px 10px;text-align:left;">Installment Name</th></tr></thead>
                  <tbody id="je-debit-body"></tbody>
                </table>
              </div>
              <div style="display:flex;justify-content:flex-end;gap:20px;padding:8px 12px;background:var(--surface2);font-size:12px;font-weight:600;border:1px solid var(--border2);border-top:none;border-radius:0 0 4px 4px;">
                <span>Balance: <span id="je-debit-balance" style="color:var(--text);">0/-</span></span>
                <span>Total: <span id="je-debit-total" style="color:var(--text);">0.00/-</span></span>
              </div>
            </div>

            <!-- Credit panel -->
            <div>
              <div style="background:var(--teal-bg);color:var(--teal);padding:12px 18px;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.6px;border:1px solid var(--border2);border-bottom:none;border-radius:10px 10px 0 0;">
                <span id="je-credit-title">PROJECT – NAME [REG] (CREDIT)</span>
              </div>
              <div style="border:1px solid var(--border2);border-top:none;border-radius:0 0 4px 4px;overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:700px;">
                  <thead><tr>
                    <th style="padding:8px 6px;">S.No.</th>
                    <th>Installment Name</th><th>Inst. Date</th><th>Head Name</th>
                    <th>Payable Amt</th><th>Payable CGST</th><th>Payable SGST</th>
                    <th>Total Payable</th><th>Total Amount</th><th>ST%</th><th>CGST%</th><th>SGST%</th>
                    <th>Select</th>
                  </tr></thead>
                  <tbody id="je-credit-body"></tbody>
                </table>
              </div>
              <div style="display:flex;justify-content:flex-end;gap:20px;padding:8px 12px;background:var(--surface2);font-size:12px;font-weight:600;border:1px solid var(--border2);border-top:none;border-radius:0 0 4px 4px;">
                <span>Balance: <span id="je-credit-balance" style="color:var(--text);">0/-</span></span>
                <span>Total: <span id="je-credit-total" style="color:var(--text);">0.00/-</span></span>
              </div>
            </div>
          </div>

          <div id="je-transfer-container" style="display:none;margin-top:4px;">
            <span style="color:var(--text3);font-size:12px;">Switched off until the owner approves the accounting rule for journal and debit/credit entries (Finance Part B).</span>
          </div>
          <button id="je-back-btn" onclick="ReceiptsPage.jeGoStep(2)"
            style="background:#6b7280;color:#fff;border:none;border-radius:6px;padding:8px 20px;font-weight:600;cursor:pointer;margin-top:12px;">
            ← Back
          </button>
        </div>

      </div>

      <!-- SUB-PANEL 2: Debit / Credit (placeholder) -->
      <div id="je-panel-dc" style="display:none">
        <div class="sp">
          <div class="sp-hdr"><div class="sp-title">DEBIT / CREDIT NOTE</div></div>
          <div class="sp-body">
            <div class="sp-grid">
              <div class="fg" style="grid-column:span 2">
                <label class="fl">Consumer</label>
                <select class="fc" id="dc-consumer"><option value="">— Select Consumer —</option></select>
              </div>
              <div class="fg">
                <label class="fl">Type</label>
                <div style="display:flex;gap:8px;margin-top:4px;">
                  <button id="dc-type-debit" onclick="ReceiptsPage.dcSetType('debit',this)"
                    style="flex:1;padding:8px;border-radius:6px;border:2px solid var(--teal);background:var(--teal);color:#fff;font-size:12px;font-weight:700;cursor:pointer;">
                    Debit
                  </button>
                  <button id="dc-type-credit" onclick="ReceiptsPage.dcSetType('credit',this)"
                    style="flex:1;padding:8px;border-radius:6px;border:2px solid #d1d5db;background:#fff;color:#6b7280;font-size:12px;font-weight:700;cursor:pointer;">
                    Credit
                  </button>
                </div>
              </div>
              <div class="fg">
                <label class="fl">Amount (₹)</label>
                <input type="number" class="fc" id="dc-amount" placeholder="0.00" min="0" step="0.01">
              </div>
              <div class="fg">
                <label class="fl">Reference No.</label>
                <input type="text" class="fc" id="dc-ref" placeholder="Reference number">
              </div>
              <div class="fg" style="grid-column:span 2">
                <label class="fl">Reason</label>
                <textarea class="fc" id="dc-reason" rows="2" placeholder="Reason for adjustment" style="resize:vertical;"></textarea>
              </div>
            </div>
            <span style="color:var(--text3);font-size:12px;">Switched off until the owner approves the accounting rule for journal and debit/credit entries (Finance Part B).</span>
          </div>
        </div>
        <div class="tbl-wrap" style="margin-top:20px">
          <div class="tbl-hdr"><div class="tbl-title">Debit / Credit History</div></div>
          <table>
            <thead><tr><th>REF NO.</th><th>DATE</th><th>CONSUMER</th><th>TYPE</th><th>AMOUNT</th><th>REASON</th><th>STATUS</th></tr></thead>
            <tbody id="dc-history-body">
              <tr><td colspan="7" style="text-align:center;color:var(--text3);padding:20px;">No records found</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- SUB-PANEL 3: Journal Report (placeholder) -->
      <div id="je-panel-report" style="display:none">
        <div class="sp">
          <div class="sp-hdr"><div class="sp-title">JOURNAL REPORT</div></div>
          <div class="sp-body">
            <div class="sp-grid" style="grid-template-columns:1fr 1fr 1fr 1fr;">
              <div class="fg">
                <label class="fl">From Date</label>
                <input type="date" class="fc" id="jr-from-date">
              </div>
              <div class="fg">
                <label class="fl">To Date</label>
                <input type="date" class="fc" id="jr-to-date">
              </div>
              <div class="fg">
                <label class="fl">Project</label>
                <select class="fc" id="jr-project"><option value="">All Projects</option></select>
              </div>
              <div class="fg">
                <label class="fl">Ledger Head</label>
                <select class="fc" id="jr-ledger-head">
                  <option value="">All Heads</option>
                  <option>Waiver</option><option>Discount</option><option>Transfer Fee</option><option>Admin Charge</option>
                </select>
              </div>
            </div>
            <div style="display:flex;gap:10px;margin-top:15px;">
              <span style="color:var(--text3);font-size:12px;">Switched off until the owner approves the accounting rule for journal and debit/credit entries (Finance Part B).</span>
            </div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:20px 0;">
          <div style="background:var(--surface);border:1px solid var(--border2);border-left:3px solid #16a34a;border-radius:10px;padding:16px;text-align:center;">
            <div style="font-size:11px;color:var(--text3);text-transform:uppercase;margin-bottom:4px;letter-spacing:.5px;">Total Debit</div>
            <div id="jr-total-debit" style="font-size:22px;font-weight:700;color:#16a34a;">₹0</div>
          </div>
          <div style="background:var(--surface);border:1px solid var(--border2);border-left:3px solid #dc2626;border-radius:10px;padding:16px;text-align:center;">
            <div style="font-size:11px;color:var(--text3);text-transform:uppercase;margin-bottom:4px;letter-spacing:.5px;">Total Credit</div>
            <div id="jr-total-credit" style="font-size:22px;font-weight:700;color:#dc2626;">₹0</div>
          </div>
          <div style="background:var(--surface);border:1px solid var(--border2);border-left:3px solid #1d4ed8;border-radius:10px;padding:16px;text-align:center;">
            <div style="font-size:11px;color:var(--text3);text-transform:uppercase;margin-bottom:4px;letter-spacing:.5px;">Net Balance</div>
            <div id="jr-net-balance" style="font-size:22px;font-weight:700;color:#1d4ed8;">₹0</div>
          </div>
        </div>
        <div class="tbl-wrap">
          <table id="jr-table">
            <thead><tr><th>S.NO.</th><th>ENTRY NO.</th><th>DATE</th><th>CONSUMER</th><th>LEDGER HEAD</th><th>DEBIT (₹)</th><th>CREDIT (₹)</th><th>REMARKS</th><th>STATUS</th></tr></thead>
            <tbody id="jr-body">
              <tr><td colspan="9" style="text-align:center;color:var(--text3);padding:20px;">Select filters and click FETCH</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- SUB-PANEL 4: JV/Dr/Cr/Refund Reversal (placeholder) -->
      <div id="je-panel-reversal" style="display:none">
        <div class="sp">
          <div class="sp-hdr"><div class="sp-title">JV / DR / CR / REFUND REVERSAL</div></div>
          <div class="sp-body">
            <div class="sp-grid" style="grid-template-columns:1fr 1fr 1fr;">
              <div class="fg">
                <label class="fl">Consumer</label>
                <select class="fc" id="rv-consumer"><option value="">— Select Consumer —</option></select>
              </div>
              <div class="fg">
                <label class="fl">Entry Type</label>
                <select class="fc" id="rv-type">
                  <option value="">All Types</option>
                  <option value="JV">Journal Entry (JV)</option>
                  <option value="DR">Debit Note (DR)</option>
                  <option value="CR">Credit Note (CR)</option>
                  <option value="REFUND">Refund</option>
                </select>
              </div>
              <div class="fg">
                <label class="fl">From Date</label>
                <input type="date" class="fc" id="rv-from-date">
              </div>
            </div>
            <span style="color:var(--text3);font-size:12px;">Switched off until the owner approves the accounting rule for journal and debit/credit entries (Finance Part B).</span>
          </div>
        </div>
        <div class="tbl-wrap" style="margin-top:20px">
          <table>
            <thead><tr><th>S.NO.</th><th>ENTRY NO.</th><th>DATE</th><th>TYPE</th><th>CONSUMER</th><th>DEBIT (₹)</th><th>CREDIT (₹)</th><th>REMARKS</th><th>STATUS</th><th>ACTION</th></tr></thead>
            <tbody id="rv-body">
              <tr><td colspan="10" style="text-align:center;color:var(--text3);padding:20px;">Select consumer and click FETCH ENTRIES</td></tr>
            </tbody>
          </table>
        </div>
        <div style="margin-top:16px;padding:12px 16px;background:var(--surface2);border:1px solid var(--border2);border-radius:10px;font-size:12px;color:var(--text2);">
          Only entries with status "Posted" can be reversed. Reversed entries cannot be reversed again.
        </div>
      </div>

    </div>

    <!-- TDS REPORT TAB -->
    <div data-panel-group="rec" data-panel="tds-report" style="display:none">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">TDS CHALLAN REPORT</div></div>
        <div class="sp-body">
          <div class="sp-grid">
            <div class="fg"><label class="fl">Status</label><select class="fc" id="tds-f-status"><option value="">All</option><option value="available">Available</option><option value="partially_assigned">Partially assigned</option><option value="fully_assigned">Fully assigned</option></select></div>
            <div class="fg"><label class="fl">Challan No. or Bank</label><input class="fc" id="tds-f-search" maxlength="100"></div>
          </div>
          <button class="btn btn-fetch" style="margin:12px 0" onclick="ReceiptsPage.loadTDSReport()">SEARCH</button>
        </div>
        <div id="tds-report-body"></div>
        <div id="tds-detail-body"></div>
      </div>
    </div>

    <!-- UPLOAD TDS TAB -->
    <div data-panel-group="rec" data-panel="upload-tds" style="display:none">
      <div class="sp">
        <div class="sp-hdr"><div class="sp-title">UPLOAD TDS CHALLAN</div></div>
        <div class="sp-body">
          <div class="sp-grid">
            <div class="fg"><label class="fl">Challan Number</label><input class="fc" id="tds-no" maxlength="50"></div>
            <div class="fg"><label class="fl">Challan Date</label><input type="date" class="fc" id="tds-date"></div>
            <div class="fg"><label class="fl">Amount</label><input type="number" class="fc" id="tds-amount" placeholder="0.00" min="0.01" step="0.01"></div>
            <div class="fg"><label class="fl">Bank Name</label><input class="fc" id="tds-bank" maxlength="255"></div>
            <div class="fg"><label class="fl">File (PDF/Image)</label><input type="file" class="fc" id="tds-file" accept="application/pdf,image/png,image/jpeg"></div>
          </div>
          <button class="btn btn-fetch" style="margin-top:15px" onclick="ReceiptsPage.uploadTDS()">UPLOAD CHALLAN</button>
        </div>
      </div>
    </div>

    <!-- ASSIGN TDS TAB -->
    <div data-panel-group="rec" data-panel="assign-tds" style="display:none">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">ASSIGN TDS TO RECEIPT</div></div>
        <div class="sp-body">
          <div class="sp-grid">
            <div class="fg"><label class="fl">Select Challan</label><select class="fc" id="ass-challan-sel"><option>— Select —</option></select></div>
            <div class="fg"><label class="fl">Receipt No. or Applicant</label><input class="fc" id="ass-receipt-no" placeholder="Type 2 letters to search" maxlength="100" oninput="ReceiptsPage.searchTDSReceipt()"></div>
            <div class="fg"><label class="fl">Receipt</label><select class="fc" id="ass-receipt-sel"><option value="">— Search first —</option></select></div>
            <div class="fg"><label class="fl">Amount</label><input type="number" class="fc" id="ass-amount" placeholder="0.00" min="0.01" step="0.01"></div>
          </div>
          <button class="btn btn-fetch" style="margin-top:15px" onclick="ReceiptsPage.assignTDS()">ASSIGN TDS</button>
        </div>
      </div>
    </div>
  `;

  await ReceiptsPage.init(params);
};

const ReceiptsPage = {
  _pendingConsumerId: null,
  _selectedConsumer: null,
  _payType: 'cheque',

  async init(params) {
    await Promise.allSettled([
      this.loadConsumers(),
      this.loadProjects(),
    ]);

    if (params.consumerId) {
      this._pendingConsumerId = params.consumerId;
    }

    if (params.tab && params.tab !== 'entry') {
      setTimeout(() => {
        const btn = document.querySelector(`[data-group="rec"][data-tab="${params.tab}"]`);
        if (btn) btn.click();
      }, 100);
    }
  },

  async loadConsumers() {
    try {
      const res = await Api.get('/consumers', { params: { page: 1, pageSize: 300 } });
      const list = res.data || res || [];
      ['rec-consumer-sel', 'dup-consumer', 'dc-consumer', 'rv-consumer'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = '<option value="">— Select Consumer —</option>' +
          list.map(c => `<option value="${c.id}">${c.name || (c.first_name + ' ' + (c.last_name || ''))} · ${c.mobile || ''}</option>`).join('');
      });

      if (this._pendingConsumerId) {
        const sel = document.getElementById('rec-consumer-sel');
        if (sel) { sel.value = this._pendingConsumerId; this.fetchConsumer(); }
        this._pendingConsumerId = null;
      }
    } catch (err) { console.error(err); }
  },

  async loadProjects() {
    try {
      const res = await Api.get('/projects', { params: { pageSize: 100 } });
      const list = res.data || res || [];
      ['hwc-project', 'jr-project'].forEach(id => {
        const sel = document.getElementById(id);
        if (sel) sel.innerHTML = '<option value="">— All Projects —</option>' +
          list.map(p => `<option value="${p.id}">${Utils.esc(p.name)}</option>`).join('');
      });
    } catch {}
  },

  searchConsumers(query) {
    const sel = document.getElementById('rec-consumer-sel');
    if (!sel) return;
    [...sel.options].forEach(o => {
      if (!o.value) return;
      o.hidden = !o.text.toLowerCase().includes(query.toLowerCase());
    });
  },

  async fetchConsumer() {
    const sel = document.getElementById('rec-consumer-sel');
    const id = sel?.value;
    if (!id) { Utils.warn('Please select a consumer'); return; }

    try {
      const [consRes, receiptsRes] = await Promise.allSettled([
        Api.get(`/consumers/${id}`),
        Api.get('/payments/receipts', { params: { consumerId: id, pageSize: 50 } }),
      ]);

      const c = consRes.status === 'fulfilled' ? (consRes.value.data || consRes.value) : {};
      const receipts = receiptsRes.status === 'fulfilled' ? (receiptsRes.value.data || receiptsRes.value || []) : [];
      this._selectedConsumer = c;
      // A project that numbers receipts by hand shows the Receipt No. box
      try {
        const st = c.project_id ? (await Api.get(`/projects/${c.project_id}/settings`)).data : null;
        const wrap = document.getElementById('rec-no-wrap'); if (wrap) wrap.style.display = st?.receipt_number_mode === 'Manual' ? '' : 'none';
      } catch {}

      // Receipts carry amount_received_inr and a status (pending / cleared / bounced / cancelled); this used to read r.amount and 'approved', so Paid was always 0
      const sumOf = (st) => receipts.filter(r => r.status === st).reduce((s,r) => s + (parseFloat(r.amount_received_inr) || 0), 0);
      const totalPaid = sumOf('cleared');
      const awaiting = sumOf('pending');
      // The unit's own price, from its allotment: the consumer record carries no price (this panel used to show Rs 0 and a made-up 5% GST)
      let unitCost = null;
      try { const al = (await Api.get('/allocations', { params: { consumerId: id, status: 'all', pageSize: 5 } })).data || []; const a = al.find(x => x.status === 'allotted') || al[0]; if (a && a.base_price_inr != null) unitCost = parseFloat(a.base_price_inr); } catch {}

      const name = c.name || `${c.first_name||''} ${c.last_name||''}`.trim() || '—';
      document.getElementById('rec-consumer-title').textContent =
        `${name} · ${c.unit_no||c.unit_number||'TBD'} · ${c.project_name||c.projectName||'—'}`;

      document.getElementById('rec-fin-grid').innerHTML = `
        <div style="text-align:center"><div style="font-size:10px;color:var(--text3);margin-bottom:2px">Unit Cost</div><div style="font-size:14px;font-weight:700">${unitCost == null ? '—' : Utils.currency(unitCost)}</div></div>
        <div style="text-align:center"><div style="font-size:10px;color:var(--teal);margin-bottom:2px">Paid (cleared)</div><div style="font-size:14px;font-weight:700;color:var(--teal)">${Utils.currency(totalPaid)}</div></div>
        <div style="text-align:center"><div style="font-size:10px;color:var(--warn);margin-bottom:2px">Awaiting clearance</div><div style="font-size:14px;font-weight:700;color:var(--warn)">${Utils.currency(awaiting)}</div></div>
        <div style="text-align:center"><div style="font-size:10px;color:var(--red);margin-bottom:2px">No. of Receipts</div><div style="font-size:14px;font-weight:700;color:var(--red)">${receipts.length}</div></div>
      `;

      document.getElementById('rec-fin-hdr').style.display = 'block';
      document.getElementById('receipt-form').style.display = 'block';
      document.getElementById('rec-consumer-id').value = id;

      const bankSel = document.getElementById('rec-company-bank-account');
      if (bankSel) {
        bankSel.innerHTML = '<option value="">— Select Bank Account —</option>';
        const projId = c.project_id || c.projectId;
        if (projId) {
          try {
            const baRes = await Api.get(`/payments/clearing-banks/${projId}`);
            bankSel.innerHTML += (baRes.data || []).map(a =>
              `<option value="${a.id}">${a.bank_name}${a.account_name ? ' — ' + a.account_name : ''} (${a.account_number})</option>`
            ).join('');
          } catch (e) { console.warn('Bank accounts fetch failed:', e.message); }
        }
      }
    } catch (err) { Utils.error(err.message); }
  },

  onConsumerChange() { /* triggered by fetchConsumer */ },

  selectPayType(btn, type) {
    btn.closest('#rec-type-btg').querySelectorAll('.btg-item').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
    this._payType = type;
  },

  calcTotal() {
    const base     = parseFloat(document.getElementById('rec-amount')?.value || 0);
    const plc      = parseFloat(document.getElementById('rec-plc')?.value || 0);
    const edc      = parseFloat(document.getElementById('rec-edc')?.value || 0);
    const idc      = parseFloat(document.getElementById('rec-idc')?.value || 0);
    const interest = parseFloat(document.getElementById('rec-interest')?.value || 0);
    const other    = parseFloat(document.getElementById('rec-other-charge')?.value || 0);
    const total = base + plc + edc + idc + interest + other;
    const totalEl = document.getElementById('rec-total-amount');
    if (totalEl) totalEl.value = total > 0 ? total.toFixed(2) : '';
  },

  async submit() {
    if (this._selectedReceiptId) {
      await this.updateReceipt(this._selectedReceiptId);
      return;
    }

    const consumerId = document.getElementById('rec-consumer-id')?.value;
    const baseAmount = document.getElementById('rec-amount')?.value;
    const date = document.getElementById('rec-date')?.value;

    const plc      = parseFloat(document.getElementById('rec-plc')?.value || 0);
    const edc      = parseFloat(document.getElementById('rec-edc')?.value || 0);
    const idc      = parseFloat(document.getElementById('rec-idc')?.value || 0);
    const interest = parseFloat(document.getElementById('rec-interest')?.value || 0);
    const other    = parseFloat(document.getElementById('rec-other-charge')?.value || 0);
    const totalAmount = (parseFloat(baseAmount || 0) + plc + edc + idc + interest + other) || 0;

    if (!consumerId) { Utils.warn('Please select a consumer'); return; }
    if (totalAmount <= 0) { Utils.warn('Please enter an amount'); return; }
    if (!date) { Utils.warn('Please select receipt date'); return; }

    const body = {
      consumerId,
      amountReceivedInr: totalAmount,
      baseAmount: parseFloat(baseAmount || 0),
      plcAmount:          plc,
      edcAmount:          edc,
      idcAmount:          idc,
      interestAmount:     interest || undefined,
      otherChargeAmount:  other    || undefined,
      otherChargeDesc:    document.getElementById('rec-other-charge-desc')?.value || undefined,
      paymentDate: date,
      receiptNumber: document.getElementById('rec-no-wrap')?.style.display === 'none' ? undefined : (document.getElementById('rec-no')?.value.trim() || undefined),
      paymentMode: this._payType,
      referenceNumber: document.getElementById('rec-txn')?.value || undefined,
      bankName: document.getElementById('rec-bank')?.value || undefined,
      companyBankAccountId: document.getElementById('rec-company-bank-account')?.value || undefined,
      remarks: document.getElementById('rec-remarks')?.value || undefined,
    };

    try {
      const saved = await Api.post('/payments/receipts', body);
      Utils.success('Receipt saved successfully');
      // an extra amount or a missing demand is said in a box that stays until it is read; the receipt itself is recorded
      if ((saved?.warnings || []).length) await Utils.ask('Receipt saved.\n\n' + saved.warnings.join('\n\n'), { okText: 'OK, understood', cancelText: 'Close' });
      this.reset();
    } catch (err) { Utils.error(err.message); }
  },

  reset() {
    document.getElementById('rec-consumer-sel').value = '';
    document.getElementById('rec-fin-hdr').style.display = 'none';
    document.getElementById('receipt-form').style.display = 'none';
    ['rec-amount','rec-plc','rec-edc','rec-idc','rec-interest','rec-other-charge','rec-other-charge-desc','rec-total-amount','rec-txn','rec-bank','rec-branch','rec-remarks'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('rec-date').value = Utils.today();
    this._selectedConsumer = null;
  },

  async loadList() {
    const el = document.getElementById('receipt-list-body');
    if (!el) return;
    el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const params = { page: 1, pageSize: 200 };
      const from = document.getElementById('list-from')?.value;
      const to = document.getElementById('list-to')?.value;
      const mode = document.getElementById('list-mode')?.value;
      const status = document.getElementById('list-status')?.value;
      if (from) params.from = from;
      if (to) params.to = to;
      if (mode) params.paymentMode = mode;
      if (status) params.status = status;

      const res = await Api.get('/payments/receipts', { params });
      const list = res.data || res || [];

      // the total is money that stands: cancelled, bounced and rejected receipts (still listed) and advance splits are left out of it
      const counts = r => !r.is_advance && !['cancelled', 'bounced', 'rejected'].includes(String(r.status || '').toLowerCase());
      const totalAmt = list.filter(counts).reduce((s,r) => s + parseFloat(r.amount_received_inr ?? r.amount ?? 0), 0);
      const leftOut = list.length - list.filter(counts).length;

      el.innerHTML = list.length === 0
        ? '<div class="empty-state"><div class="empty-icon">🧾</div><h3>No receipts found</h3></div>'
        : `<table>
            <thead>
              <tr><th>Receipt No.</th><th>Consumer</th><th>Amount</th><th>Mode</th><th>Ref No.</th><th>Date</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              ${list.map(r => {
                const amt = parseFloat(r.amount_received_inr ?? r.amount ?? 0);
                const cgst = parseFloat(r.cgst_amount || 0);
                const sgst = parseFloat(r.sgst_amount || 0);
                const total = amt;
                return `<tr>
                <td class="td-mono">${r.receipt_number||r.receiptNumber||'—'}</td>
                <td class="td-bold"><a href="/api/consumers/${r.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" onclick="event.stopPropagation()" style="color:var(--primary);text-decoration:underline;cursor:pointer" title="View Applicant File">${r.consumer_name||r.consumerName||r.name||'—'}</a></td>
                <td style="font-weight:600;color:var(--teal)">
                  ${Utils.currency(amt)} <br>
                  <span style="font-size:10px;color:var(--text3)">incl. CGST: ${Utils.currency(cgst)} | SGST: ${Utils.currency(sgst)}</span>
                </td>
                <td>${Utils.esc(Utils.toTitleCase(r.payment_method||r.payment_mode||r.paymentMode||'') || '—')}</td>
                <td class="td-mono">${Utils.esc(r.transaction_ref||r.reference_number||r.referenceNumber||'—')}</td>
                <td>${Utils.date(r.received_date||r.payment_date||r.paymentDate||r.created_at)}</td>
                <td>${Utils.chip(r.status||r.approval_status||'pending')}</td>
                <td style="display:flex;gap:4px">
                  <button class="btn btn-ghost btn-sm" onclick="ReceiptsPage.printReceipt('${r.id}')">Print</button>
                </td>
              </tr>`}).join('')}
            </tbody>
            <tfoot>
              <tr class="tfoot-total">
                <td colspan="2"><strong>Total</strong></td>
                <td style="font-weight:700;color:var(--teal)">${Utils.currency(totalAmt)}</td>
                <td colspan="5">${list.length - leftOut} receipts counted${leftOut ? ` (${leftOut} cancelled or bounced receipt(s) listed above are not in the total)` : ''}</td>
              </tr>
            </tfoot>
          </table>`;
    } catch (err) { el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`; }
  },

  async loadApproval() {
    const el = document.getElementById('approval-list-body');
    if (!el) return;
    el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const res = await Api.get('/payments/receipts', { params: { status: 'pending', page: 1, pageSize: 100 } });
      const list = (res.data || res || []).filter(r => (r.status||r.approval_status) === 'pending');
      el.innerHTML = list.length === 0
        ? '<div class="empty-state"><div class="empty-icon">✅</div><h3>No pending approvals</h3></div>'
        : `<table>
            <thead><tr><th>Receipt No.</th><th>Consumer</th><th>Amount</th><th>Mode</th><th>Ref No.</th><th>Bank</th><th>Date</th><th>Action</th></tr></thead>
            <tbody>
              ${list.map(r => `<tr>
                <td class="td-mono">${r.receipt_number||r.receiptNumber||'—'}</td>
                <td class="td-bold"><a href="/api/consumers/${r.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" onclick="event.stopPropagation()" style="color:var(--primary);text-decoration:underline;cursor:pointer" title="View Applicant File">${r.consumer_name||r.consumerName||r.name||'—'}</a></td>
                <td style="font-weight:600;color:var(--teal)">${Utils.currency(r.amount)}</td>
                <td>${Utils.esc(Utils.toTitleCase(r.payment_method||r.payment_mode||r.paymentMode||'') || '—')}</td>
                <td class="td-mono">${Utils.esc(r.transaction_ref||r.reference_number||r.referenceNumber||'—')}</td>
                <td>${r.bank_name||r.bankName||'—'}</td>
                <td>${Utils.date(r.payment_date||r.created_at)}</td>
                <td style="display:flex;gap:4px">
                  <button class="btn btn-teal btn-sm" data-action="approve-receipt" onclick="ReceiptsPage.approve('${r.id}',this)">Approve</button>
                  <button class="btn btn-danger btn-sm" data-action="approve-receipt" onclick="ReceiptsPage.reject('${r.id}',this)">Reject</button>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>`;
    } catch (err) { el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`; }
  },

  async approve(id, btn) {
    btn.disabled = true; btn.textContent = '…';
    try {
      await Api.patch(`/payments/receipts/${id}/approve`, {});
      Utils.success('Receipt approved');
      btn.closest('tr').style.opacity = '0.4';
      btn.textContent = '✓ Approved';
    } catch (err) { Utils.error(err.message); btn.disabled = false; btn.textContent = 'Approve'; }
  },

  async reject(id, btn) {
    btn.disabled = true; btn.textContent = '…';
    try {
      await Api.post(`/payments/receipts/${id}/cancel`, { reason: 'Rejected by approver' });
      Utils.warn('Receipt rejected');
      btn.closest('tr').style.opacity = '0.4';
    } catch (err) { Utils.error(err.message); btn.disabled = false; btn.textContent = 'Reject'; }
  },

  async loadHeadWiseCost() {
    const el = document.getElementById('hwc-body');
    const kpiEl = document.getElementById('hwc-kpis');
    if (!el) return;
    el.innerHTML = '<div class="page-loading"><div class="spinner"></div> Loading…</div>';
    try {
      const params = { page: 1, pageSize: 500 };
      const from = document.getElementById('hwc-from')?.value;
      const to = document.getElementById('hwc-to')?.value;
      const projectId = document.getElementById('hwc-project')?.value;
      if (from) params.from = from;
      if (to) params.to = to;
      if (projectId) params.projectId = projectId;

      const res = await Api.get('/payments/receipts', { params });
      const list = res.data || res || [];

      // Group by payment mode (head)
      const byHead = {};
      list.forEach(r => {
        const head = r.payment_mode || r.paymentMode || 'other';
        if (!byHead[head]) byHead[head] = { count: 0, total: 0, receipts: [] };
        byHead[head].count++;
        byHead[head].total += parseFloat(r.amount || 0);
        byHead[head].receipts.push(r);
      });

      // a cancelled, bounced or rejected receipt is not money collected, and an advance receipt only splits money another receipt already holds: the total and the counts leave them out
      const live = list.filter(r => !r.is_advance && !['cancelled', 'bounced', 'rejected'].includes(String(r.status || '').toLowerCase()) && String(r.approval_status || '').toLowerCase() !== 'rejected');
      const grandTotal = live.reduce((s,r) => s + parseFloat(r.amount_received_inr ?? r.amount ?? 0), 0);
      const approved = live.filter(r => String(r.approval_status || '').toLowerCase() === 'approved');
      const pending = live.filter(r => String(r.status || '').toLowerCase() === 'pending');

      if (kpiEl) kpiEl.innerHTML = `
        <div class="kpi c-teal"><div class="kpi-lbl">Total Collection</div><div class="kpi-val">${Utils.currency(grandTotal)}</div><div class="kpi-sub">${live.length} receipts${live.length !== list.length ? ` (${list.length - live.length} cancelled or rejected left out)` : ''}</div></div>
        <div class="kpi c-green"><div class="kpi-lbl">Approved</div><div class="kpi-val">${Utils.currency(approved.reduce((s,r)=>s+parseFloat(r.amount||0),0))}</div><div class="kpi-sub">${approved.length} receipts</div></div>
        <div class="kpi c-warn"><div class="kpi-lbl">Pending Approval</div><div class="kpi-val">${Utils.currency(pending.reduce((s,r)=>s+parseFloat(r.amount||0),0))}</div><div class="kpi-sub">${pending.length} receipts</div></div>
        <div class="kpi c-accent"><div class="kpi-lbl">Payment Heads</div><div class="kpi-val">${Object.keys(byHead).length}</div><div class="kpi-sub">Modes used</div></div>
      `;

      if (!Object.keys(byHead).length) {
        el.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><h3>No data for selected period</h3></div>';
        return;
      }

      el.innerHTML = `
        <table>
          <thead>
            <tr><th>Payment Head</th><th>No. of Receipts</th><th>Total Amount</th><th>% of Collection</th></tr>
          </thead>
          <tbody>
            ${Object.entries(byHead).map(([head, data]) => `<tr>
              <td style="text-transform:capitalize;font-weight:600">${head.replace(/_/g,' ')}</td>
              <td>${data.count}</td>
              <td style="font-weight:600;color:var(--teal)">${Utils.currency(data.total)}</td>
              <td>${grandTotal ? ((data.total/grandTotal)*100).toFixed(1)+'%' : '—'}</td>
            </tr>`).join('')}
          </tbody>
          <tfoot>
            <tr class="tfoot-total">
              <td><strong>Grand Total</strong></td>
              <td><strong>${list.length}</strong></td>
              <td style="font-weight:700;color:var(--teal)"><strong>${Utils.currency(grandTotal)}</strong></td>
              <td>100%</td>
            </tr>
          </tfoot>
        </table>`;
    } catch (err) { el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`; }
  },

  async searchForDuplicate() {
    const el = document.getElementById('dup-body');
    if (!el) return;
    const receiptNo = document.getElementById('dup-receipt-no')?.value?.trim();
    const consumerId = document.getElementById('dup-consumer')?.value;
    const from = document.getElementById('dup-from')?.value;
    const to = document.getElementById('dup-to')?.value;

    el.innerHTML = '<div class="page-loading"><div class="spinner"></div> Searching…</div>';
    try {
      const params = { page: 1, pageSize: 50 };
      if (consumerId) params.consumerId = consumerId;
      if (from) params.from = from;
      if (to) params.to = to;

      const res = await Api.get('/payments/receipts', { params });
      let list = res.data || res || [];

      if (receiptNo) {
        list = list.filter(r => (r.receipt_number||r.receiptNumber||'').toLowerCase().includes(receiptNo.toLowerCase()));
      }

      el.innerHTML = list.length === 0
        ? '<div class="empty-state"><div class="empty-icon">🔍</div><h3>No receipts found</h3></div>'
        : `<div class="tbl-wrap">
            <div class="tbl-hdr"><div class="tbl-title">Search Results (${list.length} receipts)</div></div>
            <table>
              <thead><tr><th>Receipt No.</th><th>Consumer</th><th>Amount</th><th>Mode</th><th>Date</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                ${list.map(r => `<tr>
                  <td class="td-mono">${r.receipt_number||r.receiptNumber||'—'}</td>
                  <td class="td-bold"><a href="/api/consumers/${r.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" onclick="event.stopPropagation()" style="color:var(--primary);text-decoration:underline;cursor:pointer" title="View Applicant File">${r.consumer_name||r.consumerName||r.name||'—'}</a></td>
                  <td style="font-weight:600;color:var(--teal)">${Utils.currency(r.amount)}</td>
                  <td>${Utils.esc(Utils.toTitleCase(r.payment_method||r.payment_mode||r.paymentMode||'') || '—')}</td>
                  <td>${Utils.date(r.payment_date||r.created_at)}</td>
                  <td>${Utils.chip(r.status||r.approval_status||'pending')}</td>
                  <td><button class="btn btn-teal btn-sm" onclick="ReceiptsPage.printReceipt('${r.id}')">Print Duplicate</button></td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>`;
    } catch (err) { el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`; }
  },

  async printReceipt(id) {
    Utils.info('Opening receipt for printing…');
    try {
      const token = Auth.getToken() || localStorage.getItem('rof-jwt') || '';
      const res = await fetch(`/api/payments/receipts/${id}/html`, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const html = await res.text();
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const tab = window.open(url, '_blank');
      if (tab) setTimeout(() => URL.revokeObjectURL(url), 60000);
      // Mark as printed in background — don't block or show error to user
      Api.patch(`/payments/receipts/${id}/mark-printed`, {}).then(() => {
        // Refresh print-tab row if it's currently visible
        const row = document.querySelector(`[data-rp-row="${id}"]`);
        if (row) {
          const printedCell = row.querySelector('.rp-printed-by');
          if (printedCell) printedCell.textContent = 'Me (just now)';
        }
      }).catch(() => {});
    } catch (err) {
      Utils.error('Failed to open receipt: ' + err.message);
    }
  },

  async loadOverdue() {
    const el = document.getElementById('overdue-list-body');
    if (!el) return;
    el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const res = await Api.get('/payments/overdue', { params: { page: 1, pageSize: 100 } });
      const list = res.data || res || [];
      const totalOverdue = list.reduce((s,r) => s + parseFloat(r.amount_due_inr||r.overdueAmount||0), 0);
      const totalPenal = list.reduce((s,r) => s + parseFloat(r.penal_interest_inr||r.penalInterestInr||0), 0);

      el.innerHTML = list.length === 0
        ? '<div class="empty-state"><div class="empty-icon">✅</div><h3>No overdue payments</h3></div>'
        : `<table>
            <thead><tr><th>Consumer</th><th>Unit</th><th>Project</th><th>Overdue Amount</th><th>Days Overdue</th><th>Penal Interest (11.10% p.a.)</th><th>Total Payable</th></tr></thead>
            <tbody>
              ${list.map(r => `<tr>
                <td class="td-bold"><a href="/api/consumers/${r.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" onclick="event.stopPropagation()" style="color:var(--primary);text-decoration:underline;cursor:pointer" title="View Applicant File">${r.consumer_name||r.consumerName||r.name||'—'}</a></td>
                <td>${r.unit_no||r.unitNo||'—'}</td>
                <td style="font-size:10.5px">${r.project_name||r.projectName||'—'}</td>
                <td style="font-weight:600;color:var(--red)">${Utils.currency(r.amount_due_inr||r.overdueAmount||0)}</td>
                <td style="color:var(--red);font-weight:600">${r.days_overdue||r.daysOverdue||0} days</td>
                <td style="color:var(--accent)">${Utils.currency(r.penal_interest_inr||r.penalInterestInr||0)}</td>
                <td style="font-weight:700">${Utils.currency((r.amount_due_inr||0) + (r.penal_interest_inr||0))}</td>
              </tr>`).join('')}
            </tbody>
            <tfoot>
              <tr class="tfoot-total">
                <td colspan="3"><strong>Total</strong></td>
                <td style="font-weight:700;color:var(--red)">${Utils.currency(totalOverdue)}</td>
                <td></td>
                <td style="font-weight:700;color:var(--accent)">${Utils.currency(totalPenal)}</td>
                <td style="font-weight:700">${Utils.currency(totalOverdue + totalPenal)}</td>
              </tr>
            </tfoot>
          </table>`;
    } catch (err) { el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`; }
  },
  // ── JOURNAL ENTRY STATE MACHINE ─────────────────────────────
  _jeStep: 1,
  _jeConsumer: null,
  _jeFormData: null,
  _jeInstallments: [],
  _jeTaxMode: 'none',

  jeInit() {
    this._jeStep = 1;
    this._jeConsumer = null;
    this._jeFormData = null;
    this._jeInstallments = [];
    this._jeTaxMode = 'none';
    this.jeGoStep(1);
    // Populate project filter
    const pSel = document.getElementById('je-project-filter');
    if (pSel && pSel.options.length <= 1) {
      Api.get('/projects', { params: { pageSize: 100 } }).then(res => {
        const list = res.data || res || [];
        pSel.innerHTML = '<option value="">All Projects</option>' +
          list.map(p => `<option value="${p.id}">${Utils.esc(p.name)}</option>`).join('');
      }).catch(() => {});
    }
  },

  jeGoStep(n) {
    [1, 2, 3].forEach(i => {
      const el = document.getElementById('je-step-' + i);
      if (el) el.style.display = i === n ? '' : 'none';
    });
    this._jeStep = n;
  },

  async jeFetch() {
    const projectId = document.getElementById('je-project-filter')?.value || '';
    const reg       = document.getElementById('je-reg-filter')?.value.trim() || '';
    const name      = document.getElementById('je-name-filter')?.value.trim() || '';
    const unit      = document.getElementById('je-unit-filter')?.value.trim() || '';
    const params    = { pageSize: 100 };
    if (projectId) params.project_id = projectId;
    if (reg)       params.search = reg;
    else if (name) params.search = name;

    const btn = document.getElementById('je-fetch-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }
    try {
      const res  = await Api.get('/consumers', { params });
      const list = res.data || res || [];
      const container = document.getElementById('je-results-container');
      const body      = document.getElementById('je-results-body');
      if (!body) return;

      const unitLower = unit.toLowerCase();
      const filtered  = unitLower
        ? list.filter(c => (c.unit_no || c.unit_number || '').toLowerCase().includes(unitLower))
        : list;

      // Build lookup map so onclick can pass just the UUID
      ReceiptsPage._jeConsumerMap = {};
      filtered.forEach(c => { ReceiptsPage._jeConsumerMap[c.id] = c; });

      if (!filtered.length) {
        body.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#888;padding:20px;">No consumers found</td></tr>';
      } else {
        body.innerHTML = filtered.map((c, i) => {
          const displayName = c.name || ((c.first_name || '') + ' ' + (c.last_name || '')).trim() || '—';
          const regNo       = c.registration_no || c.reg_no || '—';
          const unitType    = c.bhk_type || c.unit_type || '—';
          const unitAddr    = c.unit_no || c.unit_number || c.unit_address || '—';
          const paid        = c.total_paid != null ? Utils.currency(c.total_paid) : '—';
          return `<tr style="cursor:pointer;" onmouseover="this.style.background='#f0f9ff'" onmouseout="this.style.background=''">
            <td style="padding:8px 10px;text-align:center;">${i + 1}</td>
            <td style="padding:8px 10px;font-family:monospace;">${Utils.esc(regNo)}</td>
            <td style="padding:8px 10px;font-weight:600;">${Utils.esc(displayName)}</td>
            <td style="padding:8px 10px;">${Utils.esc(unitType)}</td>
            <td style="padding:8px 10px;">${Utils.esc(unitAddr)}</td>
            <td style="padding:8px 10px;">${paid}</td>
            <td style="padding:8px 10px;text-align:center;">
              <button style="background:none;border:none;color:var(--teal,#0d9488);font-weight:600;cursor:pointer;padding:0;font-size:inherit;"
                onclick="ReceiptsPage.jeSelectById('${c.id}')">Select</button>
            </td>
          </tr>`;
        }).join('');
      }

      const projSel = document.getElementById('je-project-filter');
      const projLabel = document.getElementById('je-project-label');
      if (projLabel && projSel) {
        const opt = projSel.options[projSel.selectedIndex];
        projLabel.textContent = opt && opt.value ? 'Project: ' + opt.text : '';
      }
      if (container) container.style.display = '';
    } catch (err) {
      Utils.error(err.message || 'Failed to fetch consumers');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'FETCH'; }
    }
  },

  jeSelectById(id) {
    const consumer = this._jeConsumerMap?.[id];
    if (!consumer) {
      Utils.error('Consumer not found. Please fetch again.');
      return;
    }
    this.jeSelectConsumer(consumer);
  },

  jeSelectConsumer(consumer) {
    console.log('jeSelectConsumer called:', consumer);
    const c = consumer;
    this._jeConsumer = c;

    const displayName = c.name || ((c.first_name || '') + ' ' + (c.last_name || '')).trim() || '—';
    const regNo       = c.registration_no || c.reg_no || '—';
    const unitType    = c.bhk_type || c.unit_type || '—';
    const unitAddr    = c.unit_no || c.unit_number || c.unit_address || '—';
    const paid        = c.total_paid != null ? Utils.currency(c.total_paid) : '—';

    // Populate project spans
    const projSel = document.getElementById('je-project-filter');
    const projName = projSel && projSel.value
      ? (projSel.options[projSel.selectedIndex]?.text || '')
      : (c.project_name || '—');
    const fromProj = document.getElementById('je-from-project');
    const toProj   = document.getElementById('je-to-project');
    if (fromProj) fromProj.textContent = projName;
    if (toProj)   toProj.textContent   = projName;

    const row = `<tr>
      <td style="padding:8px 10px;text-align:center;">1</td>
      <td style="padding:8px 10px;font-family:monospace;">${Utils.esc(regNo)}</td>
      <td style="padding:8px 10px;font-weight:600;">${Utils.esc(displayName)}</td>
      <td style="padding:8px 10px;">${Utils.esc(unitType)}</td>
      <td style="padding:8px 10px;">${Utils.esc(unitAddr)}</td>
      <td style="padding:8px 10px;">${paid}</td>
      <td style="padding:8px 10px;text-align:center;color:var(--teal);">✓ Selected</td>
    </tr>`;
    const fromBody = document.getElementById('je-from-body');
    if (fromBody) fromBody.innerHTML = row;

    const toRow = `<tr>
      <td style="padding:8px 10px;font-family:monospace;">${Utils.esc(regNo)}</td>
      <td style="padding:8px 10px;font-weight:600;">${Utils.esc(displayName)}</td>
      <td style="padding:8px 10px;">${Utils.esc(unitType)}</td>
      <td style="padding:8px 10px;">${Utils.esc(unitAddr)}</td>
      <td style="padding:8px 10px;">${paid}</td>
    </tr>`;
    const toBody = document.getElementById('je-to-body');
    if (toBody) toBody.innerHTML = toRow;

    // Default adjustment date to today
    const adjDate = document.getElementById('je-adj-date');
    if (adjDate) adjDate.value = Utils.today();

    this.jeGoStep(2);
  },

  async jeContinue() {
    const amount = document.getElementById('je-amount')?.value;
    if (!amount || parseFloat(amount) <= 0) return Utils.warn('Enter a valid amount');

    this._jeFormData = {
      headType:   document.getElementById('je-head-type')?.value || '',
      amount:     parseFloat(amount),
      adjDate:    document.getElementById('je-adj-date')?.value || '',
      remarks:    document.getElementById('je-remarks')?.value || '',
      taxMode:    this._jeTaxMode,
    };

    const c = this._jeConsumer;
    const displayName = c ? (c.name || ((c.first_name || '') + ' ' + (c.last_name || '')).trim()) : '—';
    const regNo       = c ? (c.registration_no || c.reg_no || '—') : '—';
    const projSel     = document.getElementById('je-project-filter');
    const projName    = projSel && projSel.value ? (projSel.options[projSel.selectedIndex]?.text || '') : (c?.project_name || '—');

    // Update panel titles
    const debitTitle  = document.getElementById('je-debit-title');
    const creditTitle = document.getElementById('je-credit-title');
    if (debitTitle)  debitTitle.textContent  = `${projName} – ${displayName} [${regNo}] (DEBIT)`;
    if (creditTitle) creditTitle.textContent = `${projName} – ${displayName} [${regNo}] (CREDIT)`;

    // Fetch installments
    let demands = [];
    try {
      if (c) {
        const res = await Api.get('/payments/demands', { params: { consumerId: c.id, pageSize: 50 } });
        demands = res.data || res || [];
      }
    } catch (_) {}
    this._jeInstallments = demands;

    // Build debit panel (simple name list)
    const debitBody = document.getElementById('je-debit-body');
    if (debitBody) {
      if (!demands.length) {
        debitBody.innerHTML = '<tr><td colspan="2" style="padding:10px;color:#888;text-align:center;">No installments found</td></tr>';
      } else {
        debitBody.innerHTML = demands.map((d, i) => `
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:7px 10px;text-align:center;">${i + 1}</td>
            <td style="padding:7px 10px;">${Utils.esc(d.installment_name || ('Instalment ' + (d.installment_index || (i + 1))))}</td>
          </tr>`).join('');
      }
    }

    // Build credit panel (with amounts + checkbox)
    const creditBody = document.getElementById('je-credit-body');
    if (creditBody) {
      if (!demands.length) {
        creditBody.innerHTML = '<tr><td colspan="13" style="padding:10px;color:#888;text-align:center;">No installments found</td></tr>';
      } else {
        creditBody.innerHTML = demands.map((d, i) => {
          const payable = parseFloat(d.amount_due_inr || d.amount_due || 0);
          const cgst    = parseFloat(d.cgst_amount || 0);
          const sgst    = parseFloat(d.sgst_amount || 0);
          const total   = payable + cgst + sgst;
          const date    = d.due_date ? Utils.date(d.due_date) : '—';
          const head    = d.demand_type || d.installment_name || '—';
          return `<tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:6px 6px;text-align:center;">${i + 1}</td>
            <td style="padding:6px 8px;">${Utils.esc(d.installment_name || ('Instalment ' + (d.installment_index || (i + 1))))}</td>
            <td style="padding:6px 8px;">${date}</td>
            <td style="padding:6px 8px;">${Utils.esc(head)}</td>
            <td style="padding:6px 8px;text-align:right;">${payable.toFixed(2)}</td>
            <td style="padding:6px 8px;text-align:right;">${cgst.toFixed(2)}</td>
            <td style="padding:6px 8px;text-align:right;">${sgst.toFixed(2)}</td>
            <td style="padding:6px 8px;text-align:right;font-weight:600;">${total.toFixed(2)}</td>
            <td style="padding:6px 8px;text-align:right;">${total.toFixed(2)}</td>
            <td style="padding:6px 8px;text-align:center;">—</td>
            <td style="padding:6px 8px;text-align:center;">—</td>
            <td style="padding:6px 8px;text-align:center;">—</td>
            <td style="padding:6px 8px;text-align:center;">
              <input type="checkbox" style="cursor:pointer;"
                onchange="ReceiptsPage.jeUpdateCreditTotals()">
            </td>
          </tr>`;
        }).join('');
      }
    }

    // Reset totals
    ['je-debit-balance','je-debit-total','je-credit-balance','je-credit-total'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = id.includes('balance') ? '0/-' : '0.00/-';
    });
    const tc = document.getElementById('je-transfer-container');
    if (tc) tc.style.display = 'none';

    this.jeGoStep(3);
  },

  jeUpdateCreditTotals() {
    const checkboxes = document.querySelectorAll('#je-credit-body input[type="checkbox"]');
    let checkedCount = 0;
    let total = 0;
    checkboxes.forEach((cb, i) => {
      if (cb.checked) {
        checkedCount++;
        const d = this._jeInstallments[i];
        if (d) {
          const payable = parseFloat(d.amount_due_inr || d.amount_due || 0);
          const cgst    = parseFloat(d.cgst_amount || 0);
          const sgst    = parseFloat(d.sgst_amount || 0);
          total += payable + cgst + sgst;
        }
      }
    });
    const creditTotal   = document.getElementById('je-credit-total');
    const creditBalance = document.getElementById('je-credit-balance');
    if (creditTotal)   creditTotal.textContent   = total.toFixed(2) + '/-';
    if (creditBalance) creditBalance.textContent = checkedCount + '/-';

    const tc = document.getElementById('je-transfer-container');
    if (tc) tc.style.display = checkedCount > 0 ? '' : 'none';
  },

  jeTaxToggle(mode) {
    this._jeTaxMode = mode;
    const map = {
      none:   'je-tax-none',
      manual: 'je-tax-manual',
      auto:   'je-tax-auto',
    };
    Object.entries(map).forEach(([key, id]) => {
      const el = document.getElementById(id);
      if (!el) return;
      const active = key === mode;
      el.style.background = active ? '#0d9488' : '#fff';
      el.style.color      = active ? '#fff'    : '#0d9488';
    });
  },

  jeClear() {
    this._jeConsumer     = null;
    this._jeFormData     = null;
    this._jeInstallments = [];
    this._jeTaxMode      = 'none';
    ['je-reg-filter','je-name-filter','je-unit-filter','je-amount','je-adj-date','je-remarks'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const pf = document.getElementById('je-project-filter');
    if (pf) pf.selectedIndex = 0;
    const rc = document.getElementById('je-results-container');
    if (rc) rc.style.display = 'none';
    this.jeTaxToggle('none');
    this.jeGoStep(1);
  },

  switchJeTab(tabId) {
    const panels = ['entry', 'dc', 'report', 'reversal'];
    panels.forEach(id => {
      const panel = document.getElementById('je-panel-' + id);
      const btn   = document.getElementById('je-tab-' + id);
      if (!panel || !btn) return;
      const active = id === tabId;
      panel.style.display = active ? '' : 'none';
      btn.style.color        = active ? 'var(--teal)' : '#6b7280';
      btn.style.borderBottom = active ? '2px solid var(--teal)' : '2px solid transparent';
    });
    if (tabId === 'entry') this.jeInit();
  },

  dcSetType(type, btn) {
    ['dc-type-debit', 'dc-type-credit'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const isActive = el.id === btn.id;
      el.style.background  = isActive ? 'var(--teal)' : '#fff';
      el.style.color       = isActive ? '#fff'        : '#6b7280';
      el.style.borderColor = isActive ? 'var(--teal)' : '#d1d5db';
    });
  },

  // challan money keeps its paise (Utils.currency rounds to whole rupees)
  inr(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },

  async loadTDSReport() {
    const el = document.getElementById('tds-report-body');
    if (!el) return;
    el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const res = await Api.get('/payments/tds/challans', { params: { status: document.getElementById('tds-f-status')?.value, search: document.getElementById('tds-f-search')?.value.trim() } });
      const list = res.data || [];
      const t = res.totals || { amount: 0, assigned: 0, balance: 0 };
      el.innerHTML = `
        <div style="margin:0 0 10px;font-size:12px;color:var(--text2)">${res.total || 0} challans. Total ${ReceiptsPage.inr(t.amount)}, assigned ${ReceiptsPage.inr(t.assigned)}, balance ${ReceiptsPage.inr(t.balance)}</div>
        <div class="tbl-wrap">
          <table>
            <thead><tr><th>Challan No</th><th>Date</th><th>Bank</th><th>Amount</th><th>Assigned</th><th>Balance</th><th>Status</th><th>File</th><th></th></tr></thead>
            <tbody>
              ${list.length ? list.map(c => `<tr>
                <td class="td-mono">${Utils.esc(c.challan_number)}</td>
                <td>${Utils.date(c.challan_date)}</td>
                <td>${Utils.esc(c.bank_name || '—')}</td>
                <td class="td-bold">${ReceiptsPage.inr(c.amount)}</td>
                <td>${ReceiptsPage.inr(c.assigned_amount)}</td>
                <td>${ReceiptsPage.inr(c.balance)}</td>
                <td>${Utils.chip(c.status.replace(/_/g, ' '))}</td>
                <td>${c.has_file ? `<button class="btn btn-ghost btn-sm" onclick="ReceiptsPage.openChallanFile('${c.id}')">View</button>` : '—'}</td>
                <td><button class="btn btn-ghost btn-sm" onclick="ReceiptsPage.showChallan('${c.id}')">Assignments</button></td>
              </tr>`).join('') : '<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:20px">No challans found</td></tr>'}
            </tbody>
          </table>
        </div>`;
    } catch (err) { el.innerHTML = Utils.esc(err.message); }
  },

  async openChallanFile(id) {
    try {
      const r = await fetch(`${ROF.API_BASE}/payments/tds/challans/${id}/file`, { headers: { Authorization: `Bearer ${Auth.getToken()}` } });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'File not found');
      window.open(URL.createObjectURL(await r.blob()), '_blank');
    } catch (err) { Utils.error(err.message); }
  },

  async showChallan(id) {
    const el = document.getElementById('tds-detail-body');
    if (!el) return;
    try {
      const c = (await Api.get(`/payments/tds/challans/${id}`)).data;
      el.innerHTML = `
        <div class="sp-hdr" style="margin-top:16px"><div class="sp-title">ASSIGNMENTS OF ${Utils.esc(c.challan_number)}</div></div>
        <div class="tbl-wrap"><table>
          <thead><tr><th>Receipt</th><th>Applicant</th><th>Amount</th><th>Assigned</th><th>Status</th><th></th></tr></thead>
          <tbody>${c.assignments.length ? c.assignments.map(a => `<tr>
            <td class="td-mono">${Utils.esc(a.receipt_number || '—')}</td>
            <td>${Utils.esc(a.consumer_name || '—')}</td>
            <td class="td-bold">${ReceiptsPage.inr(a.amount_assigned)}</td>
            <td>${Utils.date(a.assigned_at)}</td>
            <td>${a.released_at ? Utils.esc('Released: ' + (a.release_reason || '')) : 'Active'}</td>
            <td>${a.released_at ? '' : `<button class="btn btn-danger btn-sm" onclick="ReceiptsPage.releaseTDS('${a.id}','${c.id}')">Release</button>`}</td>
          </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:20px">Nothing assigned yet</td></tr>'}</tbody>
        </table></div>`;
    } catch (err) { Utils.error(err.message); }
  },

  async releaseTDS(assignmentId, challanId) {
    if (!await Utils.ask('Take this assignment back? The amount returns to the challan balance.')) return;
    try {
      await Api.post(`/payments/tds/assignments/${assignmentId}/release`, { reason: 'Released by user' });
      Utils.success('Assignment released');
      this.loadTDSReport();
      this.showChallan(challanId);
    } catch (err) { Utils.error(err.message); }
  },

  async uploadTDS() {
    const v = (id) => document.getElementById(id).value.trim();
    if (!v('tds-no') || !v('tds-date') || !v('tds-amount')) return Utils.error('Challan No, Date and Amount are required');
    const fd = new FormData();
    fd.append('challanNumber', v('tds-no'));
    fd.append('challanDate', v('tds-date'));
    fd.append('amount', v('tds-amount'));
    if (v('tds-bank')) fd.append('bankName', v('tds-bank'));
    const f = document.getElementById('tds-file').files[0];
    if (f) fd.append('file', f);
    try {
      await Api.uploadFile('/payments/tds/challans', fd);
      Utils.success('TDS Challan Uploaded');
      ['tds-no', 'tds-date', 'tds-amount', 'tds-bank', 'tds-file'].forEach(id => { document.getElementById(id).value = ''; });
      switchTab('rec', 'tds-report');
      this.loadTDSReport();
    } catch (err) { Utils.error(err.message); }
  },

  _tdsSearchTimer: null,
  searchTDSReceipt() {
    clearTimeout(this._tdsSearchTimer);
    this._tdsSearchTimer = setTimeout(async () => {
      const sel = document.getElementById('ass-receipt-sel');
      const q = document.getElementById('ass-receipt-no').value.trim();
      if (!sel) return;
      if (q.length < 2) { sel.innerHTML = '<option value="">— Search first —</option>'; return; }
      try {
        const rows = (await Api.get('/payments/tds/receipts', { params: { search: q } })).data || [];
        sel.innerHTML = rows.length
          ? rows.map(r => `<option value="${r.id}">${Utils.esc(r.receipt_number || '')} | ${Utils.esc(r.consumer_name || '')} | ${ReceiptsPage.inr(r.amount_received_inr)}, TDS ${ReceiptsPage.inr(r.tds_assigned)}</option>`).join('')
          : '<option value="">— No receipt found —</option>';
      } catch (err) { Utils.error(err.message); }
    }, 300);
  },

  async assignTDS() {
    const challanId = document.getElementById('ass-challan-sel').value;
    const receiptId = document.getElementById('ass-receipt-sel').value;
    const amount = document.getElementById('ass-amount').value.trim();
    if (!challanId) return Utils.error('Select a challan');
    if (!receiptId) return Utils.error('Search and select a receipt');
    if (!amount || !(Number(amount) > 0)) return Utils.error('Enter the amount to assign');
    try {
      await Api.post('/payments/tds/assign', { challanId, receiptId, amount });
      Utils.success('TDS assigned to the receipt');
      document.getElementById('ass-amount').value = '';
      this.loadAssignTDS();
    } catch (err) { Utils.error(err.message); }
  },

  async loadEditSearch() {
    const el = document.getElementById('edit-receipt-body');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    this.renderSearchList('edit', 'edit-receipt-body');
  },

  async loadCancelSearch() {
    const el = document.getElementById('cancel-receipt-body');
    if (el) el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    this.renderSearchList('cancel', 'cancel-receipt-body');
  },

  async renderSearchList(mode, targetId) {
    const el = document.getElementById(targetId);
    if (!el) return;
    try {
      const res = await Api.get('/payments/receipts', { params: { pageSize: 50 } });
      const list = res.data || res || [];

      const rows = list.map(r => {
        const amt = Utils.currency(r.amount_received_inr || r.amount || 0);
        const statusChip = Utils.chip(r.status || r.approval_status || 'pending');

        if (mode === 'edit') {
          return `<tr>
            <td class="td-mono">${r.receipt_number}</td>
            <td class="td-bold"><a href="/api/consumers/${r.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" onclick="event.stopPropagation()" style="color:var(--primary);text-decoration:underline;cursor:pointer" title="View Applicant File">${r.consumer_name||r.consumerName||r.name||'—'}</a></td>
            <td class="td-bold">${amt}</td>
            <td>${statusChip}</td>
            <td><button class="btn btn-teal btn-sm" onclick="ReceiptsPage.editReceipt('${r.id}')">Edit</button></td>
          </tr>`;
        }

        // Cancel mode — show status-aware rows
        const isCancelled = r.status === 'cancelled';
        const isApproved  = r.approval_status === 'approved';

        if (isCancelled) {
          return `<tr style="opacity:0.5">
            <td class="td-mono">${r.receipt_number}</td>
            <td class="td-bold"><a href="/api/consumers/${r.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" onclick="event.stopPropagation()" style="color:var(--primary);text-decoration:underline;cursor:pointer" title="View Applicant File">${r.consumer_name||r.consumerName||r.name||'—'}</a></td>
            <td class="td-bold">${amt}</td>
            <td>${Utils.chip('cancelled')}</td>
            <td><span style="font-size:11px;color:var(--text3)">Already cancelled</span></td>
          </tr>`;
        }
        if (isApproved) {
          return `<tr style="opacity:0.6">
            <td class="td-mono">${r.receipt_number}</td>
            <td class="td-bold"><a href="/api/consumers/${r.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" onclick="event.stopPropagation()" style="color:var(--primary);text-decoration:underline;cursor:pointer" title="View Applicant File">${r.consumer_name||r.consumerName||r.name||'—'}</a></td>
            <td class="td-bold">${amt}</td>
            <td>${Utils.chip('approved')}</td>
            <td><span style="font-size:11px;color:var(--text3)">Approved — cannot cancel</span></td>
          </tr>`;
        }

        return `<tr>
          <td class="td-mono">${r.receipt_number}</td>
          <td class="td-bold">${r.consumer_name}</td>
          <td class="td-bold">${amt}</td>
          <td>${statusChip}</td>
          <td><button class="btn btn-danger btn-sm" onclick="ReceiptsPage.cancelReceipt('${r.id}','${r.receipt_number}')">Cancel</button></td>
        </tr>`;
      }).join('');

      el.innerHTML = `
        <div class="tbl-wrap" style="margin-top:15px">
          <table>
            <thead><tr><th>Receipt No</th><th>Consumer</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    } catch (err) { el.innerHTML = err.message; }
  },

  async editReceipt(id) {
    switchTab('rec', 'entry');
    this._selectedReceiptId = id;
    this.setFormMode('edit');
    await this.loadReceiptForEdit(id);
    window.scrollTo(0, 0);
  },

  async loadReceiptForEdit(id) {
    try {
      const res = await Api.get('/payments/receipts/' + id);
      const receipt = res.data || res;
      if (!receipt || !receipt.id) { Utils.error('Receipt not found'); return; }

      if (receipt.approval_status === 'approved') {
        Utils.error('This receipt has been approved and cannot be edited.');
        this._selectedReceiptId = null;
        this.setFormMode('create');
        return;
      }
      if (receipt.status === 'cancelled') {
        Utils.error('This receipt has been cancelled and cannot be edited.');
        this._selectedReceiptId = null;
        this.setFormMode('create');
        return;
      }

      // Show consumer info banner
      document.getElementById('rec-consumer-title').textContent =
        `Editing: ${receipt.receipt_number} · ${receipt.consumer_name || '—'}`;
      document.getElementById('rec-fin-hdr').style.display = 'block';
      document.getElementById('receipt-form').style.display = 'block';
      document.getElementById('rec-consumer-id').value = receipt.consumer_id;

      // Payment type button
      this._payType = receipt.payment_method || 'cheque';
      const btg = document.getElementById('rec-type-btg');
      if (btg) {
        const methodMap = { cheque: 'cheque', neft: 'neft_rtgs', neft_rtgs: 'neft_rtgs',
          bank_transfer: 'neft_rtgs', upi: 'upi', cash: 'cash', draft: 'draft', card: 'card' };
        const btnVal = methodMap[receipt.payment_method] || receipt.payment_method;
        btg.querySelectorAll('.btg-item').forEach(b => {
          b.classList.toggle('on', b.textContent.toLowerCase().replace(/\//,'_') === btnVal ||
            b.onclick?.toString().includes(`'${btnVal}'`));
        });
      }

      // Instrument fields
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
      set('rec-txn',         receipt.transaction_ref);
      set('rec-cheque-date', receipt.cheque_date   ? receipt.cheque_date.split('T')[0]   : '');
      set('rec-bank',        receipt.bank_name);
      set('rec-branch',      receipt.branch);
      set('rec-date',        receipt.received_date ? receipt.received_date.split('T')[0] : '');

      // Amount fields — only if pending
      if (receipt.approval_status === 'pending') {
        set('rec-amount',            receipt.amount_received_inr);
        set('rec-plc',               receipt.plc_amount          || 0);
        set('rec-edc',               receipt.edc_amount          || 0);
        set('rec-idc',               receipt.idc_amount          || 0);
        set('rec-interest',          receipt.interest_amount     || 0);
        set('rec-other-charge',      receipt.other_charge_amount || 0);
        set('rec-other-charge-desc', receipt.other_charge_desc   || '');
        this.calcTotal();
      }

      Utils.success('Receipt loaded for editing — ' + receipt.receipt_number);
    } catch (err) {
      Utils.error('Failed to load receipt: ' + err.message);
    }
  },

  async updateReceipt(id) {
    const baseAmount = parseFloat(document.getElementById('rec-amount')?.value || 0);
    const plc      = parseFloat(document.getElementById('rec-plc')?.value      || 0);
    const edc      = parseFloat(document.getElementById('rec-edc')?.value      || 0);
    const idc      = parseFloat(document.getElementById('rec-idc')?.value      || 0);
    const interest = parseFloat(document.getElementById('rec-interest')?.value || 0);
    const other    = parseFloat(document.getElementById('rec-other-charge')?.value || 0);
    const date = document.getElementById('rec-date')?.value;
    if (!date) { Utils.warn('Please enter a receipt date'); return; }

    const payload = {
      paymentMethod:      this._payType || undefined,
      transactionRef:     document.getElementById('rec-txn')?.value    || undefined,
      bankName:           document.getElementById('rec-bank')?.value   || undefined,
      branch:             document.getElementById('rec-branch')?.value || undefined,
      chequeNo:           document.getElementById('rec-txn')?.value    || undefined,
      chequeDate:         document.getElementById('rec-cheque-date')?.value || undefined,
      receivedDate:       date,
      amountReceivedInr:  baseAmount > 0 ? baseAmount : undefined,
      plcAmount:          plc       >= 0 ? plc       : undefined,
      edcAmount:          edc       >= 0 ? edc       : undefined,
      idcAmount:          idc       >= 0 ? idc       : undefined,
      interestAmount:     interest  >= 0 ? interest  : undefined,
      otherChargeAmount:  other     >= 0 ? other     : undefined,
      otherChargeDesc:    document.getElementById('rec-other-charge-desc')?.value || undefined,
    };

    try {
      await Api.patch('/payments/receipts/' + id, payload);
      Utils.success('Receipt updated successfully');
      this._selectedReceiptId = null;
      this.setFormMode('create');
      this.reset();
      this.loadList();
      switchTab('rec', 'list');
    } catch (err) { Utils.error(err.message); }
  },

  setFormMode(mode) {
    const btn = document.getElementById('rec-submit-btn');
    const amtInput = document.getElementById('rec-amount');
    const searchBlock = document.getElementById('rec-search-block');
    const entryTabBtn = document.querySelector('[data-group="rec"][data-tab="entry"]');
    const editTabBtn  = document.querySelector('[data-group="rec"][data-tab="edit"]');
    let banner = document.getElementById('rec-edit-banner');

    if (mode === 'edit') {
      if (btn) { btn.textContent = 'Update Receipt'; btn.style.background = '#e67e22'; }
      if (amtInput) amtInput.disabled = true;
      if (searchBlock) searchBlock.style.display = 'none';
      if (entryTabBtn) entryTabBtn.classList.remove('active');
      if (editTabBtn) editTabBtn.classList.add('active');
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'rec-edit-banner';
        banner.style.cssText = 'background:#fff3e0;border:1px solid #e67e22;border-radius:6px;padding:8px 14px;margin-bottom:12px;font-size:12px;font-weight:600;color:#e65100';
        banner.textContent = '✏ EDIT MODE — Modify the fields below and click Update Receipt. Click Cancel Edit to discard changes.';
        const entryPanel = document.querySelector('[data-panel-group="rec"][data-panel="entry"]');
        if (entryPanel) entryPanel.insertBefore(banner, entryPanel.firstChild);
      }
      banner.style.display = 'block';
      this.showCancelEditButton();
    } else {
      if (btn) { btn.textContent = 'Save Receipt'; btn.style.background = ''; }
      if (amtInput) amtInput.disabled = false;
      if (searchBlock) searchBlock.style.display = '';
      if (editTabBtn) editTabBtn.classList.remove('active');
      if (entryTabBtn) entryTabBtn.classList.add('active');
      if (banner) banner.style.display = 'none';
      this._selectedReceiptId = null;
      this.hideCancelEditButton();
    }
  },

  showCancelEditButton() {
    let cancelBtn = document.getElementById('rec-cancel-edit-btn');
    if (!cancelBtn) {
      cancelBtn = document.createElement('button');
      cancelBtn.id = 'rec-cancel-edit-btn';
      cancelBtn.textContent = 'Cancel Edit';
      cancelBtn.className = 'btn btn-ghost';
      cancelBtn.style.cssText = 'background:#6c757d;color:#fff;border:none;margin-left:4px';
      cancelBtn.onclick = () => {
        this._selectedReceiptId = null;
        this.setFormMode('create');
        this.reset();
      };
      const submitBtn = document.getElementById('rec-submit-btn');
      if (submitBtn) submitBtn.parentNode.insertBefore(cancelBtn, submitBtn.nextSibling);
    }
    cancelBtn.style.display = 'inline-block';
  },

  hideCancelEditButton() {
    const btn = document.getElementById('rec-cancel-edit-btn');
    if (btn) btn.style.display = 'none';
  },

  async cancelReceipt(id, receiptNumber) {
    const label = receiptNumber ? `receipt ${receiptNumber}` : 'this receipt';
    if (!await Utils.ask(`Are you sure you want to cancel ${label}?\nThis will reverse the payment record and reopen the linked demand.`)) return;
    try {
      const res = await Api.post(`/payments/receipts/${id}/cancel`, { reason: 'Cancelled by user' });
      const data = res.data || res || {};
      const num = data.receiptNumber || receiptNumber || '';
      const demandMsg = data.demandReverted ? ' Linked demand reopened.' : '';
      Utils.success(`Receipt ${num} cancelled successfully.${demandMsg}`);
      this.loadCancelSearch();
    } catch (err) { Utils.error(err.message); }
  },

  async loadAssignTDS() {
    try {
      const res = await Api.get('/payments/tds/challans', { params: { pageSize: 500 } });
      const list = res.data || [];
      const sel = document.getElementById('ass-challan-sel');
      if (sel) {
        const keep = sel.value;
        sel.innerHTML = '<option value="">— Select Challan —</option>' + 
          list.filter(t => Number(t.balance) > 0).map(t => `<option value="${t.id}">${Utils.esc(t.challan_number)} (Bal: ${ReceiptsPage.inr(t.balance)})</option>`).join('');
        sel.value = keep;
      }
    } catch (err) { Utils.error(err.message); }
  },

  async init(params = {}) {
    const consumers = await Api.get('/consumers', { params: { pageSize: 1000 } });
    const cList = consumers.data || consumers || [];
    this._consumers = cList;
    
    const sels = ['rec-consumer-sel', 'dup-consumer'];
    sels.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.innerHTML = '<option value="">— Select Consumer —</option>' + 
          cList.map(c => `<option value="${c.id}">${c.name || (c.first_name + ' ' + c.last_name)} (${c.registration_no || 'No Reg'})</option>`).join('');
      }
    });

    if (params.tab) switchTab('rec', params.tab);
    if (params.tab === 'approval') this.loadApproval();
    if (params.tab === 'list') this.loadList();
    if (params.tab === 'journal') this.jeInit();
    if (params.tab === 'edit') this.loadEditSearch();
    if (params.tab === 'cancel') this.loadCancelSearch();
    if (params.tab === 'assign-tds') this.loadAssignTDS();
    if (params.tab === 'tds-report') this.loadTDSReport();
    if (params.tab === 'print') this.initPrintTab();
  },

  async initPrintTab() {
    // Load projects (once per page load)
    const sel = document.getElementById('rp-project');
    if (sel && sel.options.length <= 1) {
      try {
        const res = await Api.get('/projects', { params: { pageSize: 100 } });
        const list = res.data || res || [];
        list.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.textContent = p.name;
          sel.appendChild(opt);
        });
      } catch (err) { console.error('Failed to load projects for print tab:', err); }
    }

    // Load brokers (once per page load)
    await this.loadPrintBrokers();

    // Wire buttons (guard against double-wiring on re-visit)
    const searchBtn = document.getElementById('rp-search-btn');
    if (searchBtn && !searchBtn._wired) {
      searchBtn.addEventListener('click', () => this.searchReceiptsForPrint());
      searchBtn._wired = true;
    }
    const printAllBtn = document.getElementById('rp-print-all-btn');
    if (printAllBtn && !printAllBtn._wired) {
      printAllBtn.addEventListener('click', () => this.printAllVisible());
      printAllBtn._wired = true;
    }
  },

  async loadPrintTowers(projectId) {
    const sel = document.getElementById('rp-tower');
    const label = document.getElementById('rp-project-label');
    if (!sel) return;

    // Reset tower dropdown
    sel.innerHTML = '<option value="">— All Towers —</option>';

    // Update project label
    if (label) {
      const projectSel = document.getElementById('rp-project');
      const selected = projectSel?.options[projectSel.selectedIndex];
      label.textContent = selected?.value ? selected.textContent : '';
    }

    if (!projectId) return;

    try {
      const res = await Api.get(`/projects/${projectId}/towers`);
      const towers = res.data || res || [];
      towers.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.tower_name;
        sel.appendChild(opt);
      });
    } catch (err) { console.error('Failed to load towers:', err); }
  },

  async loadPrintBrokers() {
    const sel = document.getElementById('rp-broker');
    if (!sel || sel.options.length > 1) return;
    try {
      const res = await Api.get('/brokers', { params: { pageSize: 200 } });
      const list = res.data || res || [];
      list.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = b.firm_name || b.name || b.id;
        sel.appendChild(opt);
      });
    } catch (err) { console.error('Failed to load brokers:', err); }
  },

  async searchReceiptsForPrint() {
    const projectId   = document.getElementById('rp-project')?.value      || '';
    const towerId     = document.getElementById('rp-tower')?.value         || '';
    const regNo       = document.getElementById('rp-reg-no')?.value        || '';
    const firstName   = document.getElementById('rp-first-name')?.value    || '';
    const unitAddress = document.getElementById('rp-unit-address')?.value  || '';
    const receiptNo   = document.getElementById('rp-receipt-no')?.value    || '';
    const brokerId    = document.getElementById('rp-broker')?.value        || '';
    const fromDate    = document.getElementById('rp-from-date')?.value     || '';
    const toDate      = document.getElementById('rp-to-date')?.value       || '';
    const printStatus = document.getElementById('rp-print-status')?.value  || '';

    const params = { pageSize: 300 };
    if (projectId)   params.projectId      = projectId;
    if (towerId)     params.towerId        = towerId;
    if (regNo)       params.registrationNo = regNo;
    if (firstName)   params.firstName      = firstName;
    if (unitAddress) params.unitAddress    = unitAddress;
    if (receiptNo)   params.receiptNo      = receiptNo;
    if (brokerId)    params.brokerId       = brokerId;
    if (fromDate)    params.fromDate       = fromDate;
    if (toDate)      params.toDate         = toDate;
    if (printStatus) params.printStatus    = printStatus;

    const wrap = document.getElementById('rp-results-wrap');
    const body = document.getElementById('rp-results-body');
    if (body) body.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    if (wrap) wrap.style.display = 'block';

    try {
      const res = await Api.get('/payments/receipts', { params });
      const receipts = res.data || res || [];
      this.renderPrintResults(receipts);
    } catch (err) {
      if (body) body.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`;
    }
  },

  renderPrintResults(receipts) {
    const body = document.getElementById('rp-results-body');
    const title = document.getElementById('rp-results-title');
    if (!body) return;

    if (title) title.textContent = `RECEIPTS (${receipts.length})`;

    if (receipts.length === 0) {
      body.innerHTML = '<div class="empty-state"><div class="empty-icon">🧾</div><h3>No receipts found</h3></div>';
      return;
    }

    const rows = receipts.map((r, i) => {
      const receiptDate  = r.received_date ? new Date(r.received_date).toLocaleDateString('en-GB') : '—';
      const generatedDate = r.created_at   ? new Date(r.created_at).toLocaleDateString('en-GB')   : '—';
      const amount = parseFloat(r.amount_received_inr || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
      const isCancelled = r.status === 'cancelled';
      const printedBy = isCancelled
        ? `<span style="color:var(--red);font-size:11px;font-weight:600">Cancelled</span>`
        : r.printed_by_name
          ? `<span style="color:var(--teal);font-size:11px">${r.printed_by_name}</span>`
          : `<span style="color:var(--text3);font-size:11px">Not Printed</span>`;
      const consumerLink = r.consumer_id
        ? `<a href="/api/consumers/${r.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" style="color:var(--primary);text-decoration:underline;cursor:pointer" title="View Applicant File">${r.consumer_name || '—'}</a>`
        : (r.consumer_name || '—');
      const receiptLink = isCancelled
        ? `<span style="color:var(--red);font-size:11px;text-decoration:line-through">${r.receipt_number || '—'}</span>`
        : `<a href="#" onclick="ReceiptsPage.printReceipt('${r.id}')"
            style="color:#1a6fcf;font-weight:600;cursor:pointer;text-decoration:none"
            onmouseover="this.style.textDecoration='underline'"
            onmouseout="this.style.textDecoration='none'"
          >${r.receipt_number || '—'}</a>`;

      return `<tr data-rp-row="${r.id}"${!isCancelled ? ` data-receipt-id="${r.id}"` : ''}>
        <td style="text-align:center">${i + 1}</td>
        <td class="td-mono">${receiptLink}</td>
        <td class="td-mono">${r.registration_no || '—'}</td>
        <td>${consumerLink}</td>
        <td>${r.tower_name || '—'}</td>
        <td>${r.unit_number || '—'}</td>
        <td>${receiptDate}</td>
        <td class="td-mono">${r.receipt_number || '—'}</td>
        <td style="text-transform:capitalize">${(r.payment_method || '—').replace(/_/g,' ')}</td>
        <td style="text-align:right;font-weight:600;color:var(--teal)">₹${amount}</td>
        <td style="font-size:12px">${r.generated_by_name || '—'}</td>
        <td style="font-size:12px">${generatedDate}</td>
        <td class="rp-printed-by">${printedBy}</td>
      </tr>`;
    }).join('');

    body.innerHTML = `<table style="font-size:12px">
      <thead>
        <tr>
          <th style="text-align:center">S.NO.</th>
          <th>RECEIPT</th>
          <th>REG NO.</th>
          <th>NAME</th>
          <th>TOWER</th>
          <th>UNIT NO.</th>
          <th>RECEIPT DATE</th>
          <th>RECEIPT NO.</th>
          <th>MODE OF PAYMENT</th>
          <th>NET AMOUNT</th>
          <th>GENERATED BY</th>
          <th>GENERATED DATE</th>
          <th>PRINTED BY</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  },

  async printAllVisible() {
    const rows = document.querySelectorAll('#rp-results-body tr[data-receipt-id]');
    if (!rows.length) { Utils.error('No printable receipts visible'); return; }
    Utils.info(`Opening ${rows.length} receipt(s)…`);
    for (const row of rows) {
      const id = row.dataset.receiptId;
      if (id) {
        await this.printReceipt(id);
        await new Promise(r => setTimeout(r, 500));
      }
    }
  }
};
