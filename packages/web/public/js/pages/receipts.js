// ROF CRM — Receipt Process Page

Pages.receipts = async function(params = {}) {
  const content = document.getElementById('content');

  content.innerHTML = `
    <div class="page-hdr">
      <h1>Receipt Process</h1>
      <div class="breadcrumb">Application / Receipt Process / <b>Receipt Entry</b></div>
    </div>
    <div class="tabs-line">
      <button class="tab-line active" data-group="rec" data-tab="entry" onclick="switchTab('rec','entry')">Receipt Generation</button>
      <button class="tab-line" data-group="rec" data-tab="print" onclick="switchTab('rec','print');ReceiptsPage.initPrintTab()">Receipt Print</button>
      <button class="tab-line" data-group="rec" data-tab="list" onclick="switchTab('rec','list');ReceiptsPage.loadList()">Receipt List</button>
      <button class="tab-line" data-group="rec" data-tab="journal" onclick="switchTab('rec','journal');ReceiptsPage.loadJournals()">Journal Entry</button>
      <button class="tab-line" data-group="rec" data-tab="edit" onclick="switchTab('rec','edit');ReceiptsPage.loadEditSearch()">Edit Receipt</button>
      <button class="tab-line" data-group="rec" data-tab="cancel" onclick="switchTab('rec','cancel');ReceiptsPage.loadCancelSearch()">Cancel Receipt</button>
      <button class="tab-line" data-group="rec" data-tab="tds-report" onclick="switchTab('rec','tds-report');ReceiptsPage.loadTDSReport()">TDS Challan Report</button>
      <button class="tab-line" data-group="rec" data-tab="assign-tds" onclick="switchTab('rec','assign-tds');ReceiptsPage.loadAssignTDS()">Assign Receipt Challan</button>
      <button class="tab-line" data-group="rec" data-tab="upload-tds" onclick="switchTab('rec','upload-tds')">Upload Tds Challan</button>
    </div>

    <!-- RECEIPT ENTRY TAB -->
    <div data-panel-group="rec" data-panel="entry">
      <div class="sp" style="margin-bottom:12px">
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
            <button class="btn btn-ghost btn-sm" onclick="Utils.info('Export coming soon')">Export Excel</button>
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

    <!-- JOURNAL ENTRY TAB -->
    <div data-panel-group="rec" data-panel="journal" style="display:none">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">NEW JOURNAL ENTRY</div></div>
        <div class="sp-body">
          <div class="sp-grid">
            <div class="fg" style="grid-column:span 2"><label class="fl">Consumer</label>
              <select class="fc" id="jou-consumer-sel"><option value="">— Select —</option></select>
            </div>
            <div class="fg"><label class="fl">Entry Date</label><input type="date" class="fc" id="jou-date" value="${Utils.today()}"></div>
            <div class="fg"><label class="fl">Ledger Head</label>
              <select class="fc" id="jou-head">
                <option>Waiver</option><option>Discount</option><option>Transfer Fee</option><option>Admin Charge</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Debit Amount</label><input type="number" class="fc" id="jou-debit" placeholder="0.00"></div>
            <div class="fg"><label class="fl">Credit Amount</label><input type="number" class="fc" id="jou-credit" placeholder="0.00"></div>
            <div class="fg" style="grid-column:span 2"><label class="fl">Remarks</label><input class="fc" id="jou-remarks"></div>
          </div>
          <button class="btn btn-fetch" style="margin-top:15px" onclick="ReceiptsPage.submitJournal()">POST ENTRY</button>
        </div>
      </div>
      <div id="jou-list"></div>
    </div>

    <!-- TDS REPORT TAB -->
    <div data-panel-group="rec" data-panel="tds-report" style="display:none">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">TDS CHALLAN REPORT</div></div>
        <div id="tds-report-body"></div>
      </div>
    </div>

    <!-- UPLOAD TDS TAB -->
    <div data-panel-group="rec" data-panel="upload-tds" style="display:none">
      <div class="sp">
        <div class="sp-hdr"><div class="sp-title">UPLOAD TDS CHALLAN</div></div>
        <div class="sp-body">
          <div class="sp-grid">
            <div class="fg"><label class="fl">Challan Number</label><input class="fc" id="tds-no"></div>
            <div class="fg"><label class="fl">Challan Date</label><input type="date" class="fc" id="tds-date"></div>
            <div class="fg"><label class="fl">Amount</label><input type="number" class="fc" id="tds-amount" placeholder="0.00"></div>
            <div class="fg"><label class="fl">Bank Name</label><input class="fc" id="tds-bank"></div>
            <div class="fg"><label class="fl">File (PDF/Image)</label><input type="file" class="fc" id="tds-file"></div>
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
            <div class="fg"><label class="fl">Receipt No.</label><input class="fc" id="ass-receipt-no" placeholder="Search Receipt"></div>
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
      ['rec-consumer-sel', 'dup-consumer', 'jou-consumer-sel'].forEach(id => {
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
      ['hwc-project'].forEach(id => {
        const sel = document.getElementById(id);
        if (sel) sel.innerHTML = '<option value="">— All Projects —</option>' +
          list.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
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

      const totalPaid = receipts.filter(r => (r.status||r.approval_status)==='approved')
        .reduce((s,r) => s + parseFloat(r.amount||0), 0);
      const totalAmount = parseFloat(c.total_amount || c.totalAmount || 0);
      const balance = Math.max(0, totalAmount - totalPaid);

      const name = c.name || `${c.first_name||''} ${c.last_name||''}`.trim() || '—';
      document.getElementById('rec-consumer-title').textContent =
        `${name} · ${c.unit_no||c.unit_number||'TBD'} · ${c.project_name||c.projectName||'—'}`;

      document.getElementById('rec-fin-grid').innerHTML = `
        <div style="text-align:center"><div style="font-size:10px;color:var(--text3);margin-bottom:2px">Unit Cost</div><div style="font-size:14px;font-weight:700">${Utils.currency(totalAmount)}</div></div>
        <div style="text-align:center"><div style="font-size:10px;color:var(--text3);margin-bottom:2px">GST (5%)</div><div style="font-size:14px;font-weight:700">${Utils.currency(totalAmount * 0.05)}</div></div>
        <div style="text-align:center"><div style="font-size:10px;color:var(--text3);margin-bottom:2px">Total Cost</div><div style="font-size:14px;font-weight:700">${Utils.currency(totalAmount * 1.05)}</div></div>
        <div style="text-align:center"><div style="font-size:10px;color:var(--teal);margin-bottom:2px">Paid</div><div style="font-size:14px;font-weight:700;color:var(--teal)">${Utils.currency(totalPaid)}</div></div>
        <div style="text-align:center"><div style="font-size:10px;color:var(--warn);margin-bottom:2px">Balance</div><div style="font-size:14px;font-weight:700;color:var(--warn)">${Utils.currency(balance)}</div></div>
        <div style="text-align:center"><div style="font-size:10px;color:var(--red);margin-bottom:2px">No. of Receipts</div><div style="font-size:14px;font-weight:700;color:var(--red)">${receipts.length}</div></div>
      `;

      document.getElementById('rec-fin-hdr').style.display = 'block';
      document.getElementById('receipt-form').style.display = 'block';
      document.getElementById('rec-consumer-id').value = id;
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
      paymentMode: this._payType,
      referenceNumber: document.getElementById('rec-txn')?.value || undefined,
      bankName: document.getElementById('rec-bank')?.value || undefined,
      remarks: document.getElementById('rec-remarks')?.value || undefined,
    };

    try {
      await Api.post('/payments/receipts', body);
      Utils.success('Receipt saved successfully');
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

      const totalAmt = list.reduce((s,r) => s + parseFloat(r.amount||0), 0);

      el.innerHTML = list.length === 0
        ? '<div class="empty-state"><div class="empty-icon">🧾</div><h3>No receipts found</h3></div>'
        : `<table>
            <thead>
              <tr><th>Receipt No.</th><th>Consumer</th><th>Amount</th><th>Mode</th><th>Ref No.</th><th>Date</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              ${list.map(r => {
                const amt = parseFloat(r.amount || 0);
                const cgst = amt * 0.005;
                const sgst = amt * 0.005;
                const total = amt;
                return `<tr>
                <td class="td-mono">${r.receipt_number||r.receiptNumber||'—'}</td>
                <td class="td-bold">${r.consumer_name||r.consumerName||'—'}</td>
                <td style="font-weight:600;color:var(--teal)">
                  ${Utils.currency(amt)} <br>
                  <span style="font-size:10px;color:var(--text3)">+ CGST: ${Utils.currency(cgst)} | SGST: ${Utils.currency(sgst)}</span>
                </td>
                <td>${r.payment_mode||r.paymentMode||'—'}</td>
                <td class="td-mono">${r.reference_number||r.referenceNumber||'—'}</td>
                <td>${Utils.date(r.payment_date||r.paymentDate||r.created_at)}</td>
                <td>${Utils.chip(r.status||r.approval_status||'pending')}</td>
                <td style="display:flex;gap:4px">
                  <button class="btn btn-ghost btn-sm" onclick="ReceiptsPage.printReceipt('${r.id}')">Print</button>
                  <button class="btn btn-ghost btn-sm" onclick="Utils.info('SMS Triggered')">SMS</button>
                </td>
              </tr>`}).join('')}
            </tbody>
            <tfoot>
              <tr class="tfoot-total">
                <td colspan="2"><strong>Total</strong></td>
                <td style="font-weight:700;color:var(--teal)">${Utils.currency(totalAmt)}</td>
                <td colspan="5">${list.length} receipts</td>
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
                <td class="td-bold">${r.consumer_name||r.consumerName||'—'}</td>
                <td style="font-weight:600;color:var(--teal)">${Utils.currency(r.amount)}</td>
                <td>${r.payment_mode||r.paymentMode||'—'}</td>
                <td class="td-mono">${r.reference_number||r.referenceNumber||'—'}</td>
                <td>${r.bank_name||r.bankName||'—'}</td>
                <td>${Utils.date(r.payment_date||r.created_at)}</td>
                <td style="display:flex;gap:4px">
                  <button class="btn btn-teal btn-sm" onclick="ReceiptsPage.approve('${r.id}',this)">Approve</button>
                  <button class="btn btn-danger btn-sm" onclick="ReceiptsPage.reject('${r.id}',this)">Reject</button>
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
      await Api.patch(`/payments/receipts/${id}/reject`, { reason: 'Rejected by approver' });
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

      const grandTotal = list.reduce((s,r) => s + parseFloat(r.amount||0), 0);
      const approved = list.filter(r => (r.status||r.approval_status) === 'approved');
      const pending = list.filter(r => (r.status||r.approval_status) === 'pending');

      if (kpiEl) kpiEl.innerHTML = `
        <div class="kpi c-teal"><div class="kpi-lbl">Total Collection</div><div class="kpi-val">${Utils.currency(grandTotal)}</div><div class="kpi-sub">${list.length} receipts</div></div>
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
                  <td class="td-bold">${r.consumer_name||r.consumerName||'—'}</td>
                  <td style="font-weight:600;color:var(--teal)">${Utils.currency(r.amount)}</td>
                  <td>${r.payment_mode||r.paymentMode||'—'}</td>
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
                <td class="td-bold">${r.consumer_name||r.name||'—'}</td>
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
  async loadJournals() {
    const el = document.getElementById('jou-list');
    if (!el) return;
    el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const res = await Api.get('/payments/journals');
      const list = res.data || res || [];
      el.innerHTML = `
        <div class="tbl-wrap" style="margin-top:20px">
          <div class="tbl-hdr"><div class="tbl-title">Journal History</div></div>
          <table>
            <thead><tr><th>Ref No.</th><th>Date</th><th>Consumer</th><th>Head</th><th>Debit</th><th>Credit</th></tr></thead>
            <tbody>
              ${list.map(j => `<tr>
                <td class="td-mono">${j.entry_number}</td>
                <td>${Utils.date(j.entry_date)}</td>
                <td class="td-bold">${j.consumer_name}</td>
                <td>${j.ledger_head}</td>
                <td style="color:var(--red)">${Utils.currency(j.debit_amount)}</td>
                <td style="color:var(--teal)">${Utils.currency(j.credit_amount)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    } catch (err) { el.innerHTML = err.message; }
  },

  async submitJournal() {
    const data = {
      consumerId: document.getElementById('jou-consumer-sel').value,
      entryDate: document.getElementById('jou-date').value,
      ledgerHead: document.getElementById('jou-head').value,
      debitAmount: document.getElementById('jou-debit').value || 0,
      creditAmount: document.getElementById('jou-credit').value || 0,
      remarks: document.getElementById('jou-remarks').value
    };
    if (!data.consumerId) return Utils.warn('Select consumer');
    try {
      await Api.post('/payments/journals', data);
      Utils.success('Journal entry posted');
      this.loadJournals();
    } catch (err) { Utils.error(err.message); }
  },

  async loadTDSReport() {
    const el = document.getElementById('tds-report-body');
    if (!el) return;
    el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const res = await Api.get('/payments/tds/challans');
      const list = res.data || res || [];
      el.innerHTML = `
        <div class="tbl-wrap">
          <table>
            <thead><tr><th>Challan No</th><th>Date</th><th>Bank</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              ${list.map(t => `<tr>
                <td class="td-mono">${t.challan_number}</td>
                <td>${Utils.date(t.challan_date)}</td>
                <td>${t.bank_name || '—'}</td>
                <td class="td-bold">${Utils.currency(t.amount)}</td>
                <td>${Utils.chip(t.status)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    } catch (err) { el.innerHTML = err.message; }
  },

  async uploadTDS() {
    const data = {
      challanNumber: document.getElementById('tds-no').value,
      challanDate: document.getElementById('tds-date').value,
      amount: document.getElementById('tds-amount').value,
      bankName: document.getElementById('tds-bank').value
    };
    if (!data.challanNumber || !data.amount) return Utils.error('Challan No and Amount required');
    try {
      await Api.post('/payments/tds/challans', data);
      Utils.success('TDS Challan Uploaded');
      switchTab('rec', 'tds-report');
      this.loadTDSReport();
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
            <td class="td-bold">${r.consumer_name}</td>
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
            <td class="td-bold">${r.consumer_name}</td>
            <td class="td-bold">${amt}</td>
            <td>${Utils.chip('cancelled')}</td>
            <td><span style="font-size:11px;color:var(--text3)">Already cancelled</span></td>
          </tr>`;
        }
        if (isApproved) {
          return `<tr style="opacity:0.6">
            <td class="td-mono">${r.receipt_number}</td>
            <td class="td-bold">${r.consumer_name}</td>
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
    let banner = document.getElementById('rec-edit-banner');

    if (mode === 'edit') {
      if (btn) { btn.textContent = 'Update Receipt'; btn.style.background = '#e67e22'; }
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
      if (banner) banner.style.display = 'none';
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
    if (!confirm(`Are you sure you want to cancel ${label}?\nThis will reverse the payment record and reopen the linked demand.`)) return;
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
      const res = await Api.get('/payments/tds/challans');
      const list = res.data || res || [];
      const sel = document.getElementById('ass-challan-sel');
      if (sel) {
        sel.innerHTML = '<option value="">— Select Challan —</option>' + 
          list.filter(t => t.status === 'available').map(t => `<option value="${t.id}">${t.challan_number} (Bal: ${Utils.currency(t.amount)})</option>`).join('');
      }
    } catch {}
  },

  async init(params = {}) {
    const consumers = await Api.get('/consumers', { params: { pageSize: 1000 } });
    const cList = consumers.data || consumers || [];
    this._consumers = cList;
    
    const sels = ['rec-consumer-sel', 'dup-consumer', 'jou-consumer-sel'];
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
    if (params.tab === 'journal') this.loadJournals();
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
        ? `<a href="#" onclick="Pages.navigate('consumer-detail',{id:'${r.consumer_id}'})" style="color:var(--teal)">${r.consumer_name || '—'}</a>`
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
