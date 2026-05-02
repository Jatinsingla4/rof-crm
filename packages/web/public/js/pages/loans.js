// ROF CRM — Loan Process & TPA Page
Pages.loans = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="page-hdr">
      <h1>Loan Process (TPA)</h1>
      <div class="breadcrumb">Application / <b>Loan Process</b></div>
    </div>

    <div class="sp" style="margin-bottom:12px">
      <div class="sp-hdr"><div class="sp-title">Record New Bank Sanction</div></div>
      <div class="sp-body">
        <div class="sp-grid">
          <div class="fg"><label class="fl">Consumer</label>
            <select class="fc" id="loan-consumer">
              <option value="">— Select Consumer —</option>
            </select>
          </div>
          <div class="fg"><label class="fl">Bank Name</label>
            <input class="fc" id="loan-bank" placeholder="e.g. HDFC, ICICI, SBI">
          </div>
          <div class="fg"><label class="fl">Sanctioned Amount (₹)</label>
            <input type="number" class="fc" id="loan-amount" placeholder="0">
          </div>
          <div class="fg"><label class="fl">Sanction Letter Date</label>
            <input type="date" class="fc" id="loan-sanction-date" value="${Utils.today()}">
          </div>
          <div class="fg"><label class="fl">TPA Signed Date</label>
            <input type="date" class="fc" id="loan-tpa-date">
          </div>
        </div>
        <button class="btn btn-teal btn-lg" style="margin-top:15px" onclick="LoanPage.submit()">SAVE LOAN DETAILS</button>
      </div>
    </div>

    <div class="tbl-wrap">
      <div class="tbl-hdr"><div class="tbl-title">Active Loans & TPA Status</div></div>
      <div id="loan-list-body"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>
  `;

  await LoanPage.init();
};

const LoanPage = {
  async init() {
    await this.loadConsumers();
    await this.loadList();
  },

  async loadConsumers() {
    const res = await Api.get('/consumers', { params: { page:1, pageSize:500 } });
    const list = res.data || res || [];
    document.getElementById('loan-consumer').innerHTML = '<option value="">— Select Consumer —</option>' +
      list.map(c => `<option value="${c.id}">${c.name || `${c.first_name} ${c.last_name}`} · ${c.unit_number || 'Unit'}</option>`).join('');
  },

  async submit() {
    const body = {
      consumerId: document.getElementById('loan-consumer').value,
      bankName: document.getElementById('loan-bank').value,
      loanAmount: document.getElementById('loan-amount').value,
      sanctionLetterDate: document.getElementById('loan-sanction-date').value,
      tpaSignedDate: document.getElementById('loan-tpa-date').value,
      remarks: ''
    };

    if (!body.consumerId || !body.bankName) { Utils.warn('Consumer and Bank are required'); return; }

    try {
      await Api.post('/loans', body);
      Utils.success('Loan details saved successfully');
      this.loadList();
    } catch (err) { Utils.error(err.message); }
  },

  async loadList() {
    const el = document.getElementById('loan-list-body');
    // For now, listing all loans is global. 
    // Usually we would need a global GET /api/loans endpoint.
    // I'll assume it exists or we use consumer search.
    try {
      const res = await Api.get('/consumers', { params: { hasLoan: true } });
      const list = res.data || res || [];
      el.innerHTML = `<table>
        <thead><tr><th>Consumer</th><th>Bank</th><th>Amount</th><th>Status</th><th>TPA Signed</th></tr></thead>
        <tbody>
          ${list.filter(c => c.bank_name).map(l => `<tr>
            <td class="td-bold">${l.name}</td>
            <td>${l.bank_name}</td>
            <td>${Utils.currency(l.loan_amount)}</td>
            <td>${Utils.chip(l.loan_status)}</td>
            <td>${l.tpa_signed_date ? Utils.date(l.tpa_signed_date) : '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
    } catch { 
      el.innerHTML = '<div class="empty-state"><h3>No active loans found</h3></div>'; 
    }
  }
};
