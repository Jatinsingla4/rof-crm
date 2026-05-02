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
              <button class="btn btn-teal btn-lg" onclick="ReceiptsPage.submit()">Save Receipt</button>
              <button class="btn btn-ghost" onclick="ReceiptsPage.reset()">Clear</button>
            </div>
          </div>
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
    const base = parseFloat(document.getElementById('rec-amount')?.value || 0);
    const plc = parseFloat(document.getElementById('rec-plc')?.value || 0);
    const edc = parseFloat(document.getElementById('rec-edc')?.value || 0);
    const idc = parseFloat(document.getElementById('rec-idc')?.value || 0);
    const total = base + plc + edc + idc;
    const totalEl = document.getElementById('rec-total-amount');
    if (totalEl) totalEl.value = total > 0 ? total.toFixed(2) : '';
  },

  async submit() {
    const consumerId = document.getElementById('rec-consumer-id')?.value;
    const baseAmount = document.getElementById('rec-amount')?.value;
    const date = document.getElementById('rec-date')?.value;
    
    const plc = parseFloat(document.getElementById('rec-plc')?.value || 0);
    const edc = parseFloat(document.getElementById('rec-edc')?.value || 0);
    const idc = parseFloat(document.getElementById('rec-idc')?.value || 0);
    const totalAmount = (parseFloat(baseAmount || 0) + plc + edc + idc) || 0;

    if (!consumerId) { Utils.warn('Please select a consumer'); return; }
    if (totalAmount <= 0) { Utils.warn('Please enter an amount'); return; }
    if (!date) { Utils.warn('Please select receipt date'); return; }

    const body = {
      consumerId,
      amountReceivedInr: totalAmount,
      baseAmount: parseFloat(baseAmount || 0),
      plcAmount: plc,
      edcAmount: edc,
      idcAmount: idc,
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
    ['rec-amount','rec-plc','rec-edc','rec-idc','rec-total-amount','rec-txn','rec-bank','rec-branch','rec-remarks'].forEach(id => {
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
                const cgst = amt * 0.05;
                const sgst = amt * 0.05;
                const total = amt + cgst + sgst;
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
    window.open(`/api/payments/receipts/${id}/print`, '_blank');
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
      el.innerHTML = `
        <div class="tbl-wrap" style="margin-top:15px">
          <table>
            <thead><tr><th>Receipt No</th><th>Consumer</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              ${list.map(r => `<tr>
                <td class="td-mono">${r.receipt_number}</td>
                <td class="td-bold">${r.consumer_name}</td>
                <td class="td-bold">${Utils.currency(r.amount)}</td>
                <td>${Utils.chip(r.status)}</td>
                <td>
                  <button class="btn btn-sm ${mode==='edit'?'btn-teal':'btn-danger'}" onclick="ReceiptsPage.${mode}Receipt('${r.id}')">${mode==='edit'?'Edit':'Cancel'}</button>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    } catch (err) { el.innerHTML = err.message; }
  },

  async editReceipt(id) {
    Utils.info('Opening receipt editor for: ' + id);
    // Logic for loading receipt into the main form for editing
    switchTab('rec', 'entry');
    this._selectedReceiptId = id;
    this.loadReceiptForEdit(id);
  },

  async cancelReceipt(id) {
    if (!confirm('Are you sure you want to cancel this receipt? This will reverse the ledger impact.')) return;
    try {
      await Api.post(`/payments/receipts/${id}/cancel`, { reason: 'Cancelled by user' });
      Utils.success('Receipt cancelled');
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
  }
};
