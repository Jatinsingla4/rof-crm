// ROF CRM — Surrender & Cancellation Page
Pages.surrender = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="page-hdr">
      <h1>Surrender / Cancellation</h1>
      <div class="breadcrumb">Application / <b>Surrender</b></div>
    </div>

    <div class="sp" style="margin-bottom:12px">
      <div class="sp-hdr"><div class="sp-title">Process Unit Surrender</div></div>
      <div class="sp-body">
        <div class="alert alert-warn">
          ⚠ Surrender will forfeit <b>₹25,000 + 18% GST (Total ₹29,500)</b> from the paid amount. The unit will be released back to inventory.
        </div>
        <div class="sp-grid" style="margin-top:12px">
          <div class="fg"><label class="fl">Consumer (Allotted)</label>
            <select class="fc" id="surr-consumer" onchange="SurrenderPage.onConsumerChange()">
              <option value="">— Select Consumer —</option>
            </select>
          </div>
          <div class="fg"><label class="fl">Total Paid Amount</label>
            <input class="fc" id="surr-paid" readonly placeholder="Auto-calculated">
          </div>
          <div class="fg"><label class="fl">Refundable Amount</label>
            <input class="fc" id="surr-refund" readonly style="color:var(--green);font-weight:700">
          </div>
          <div class="fg"><label class="fl">Reason</label>
            <select class="fc" id="surr-reason">
              <option value="financial_issues">Financial Issues</option>
              <option value="personal_reasons">Personal Reasons</option>
              <option value="location_change">Location Change</option>
              <option value="non_payment_cancellation">Non-Payment Cancellation</option>
            </select>
          </div>
        </div>
        <button class="btn btn-danger btn-lg" style="margin-top:15px" onclick="SurrenderPage.submit()">CONFIRM CANCELLATION</button>
      </div>
    </div>
  `;

  await SurrenderPage.init();
};

const SurrenderPage = {
  async init() {
    await this.loadConsumers();
  },

  async loadConsumers() {
    const res = await Api.get('/consumers', { params: { leadStage: 'allotted' } });
    const list = res.data || res || [];
    document.getElementById('surr-consumer').innerHTML = '<option value="">— Select Allotted Consumer —</option>' +
      list.map(c => `<option value="${c.id}" data-paid="${c.total_paid || 0}">${c.name} · ${c.unit_number || 'Unit'}</option>`).join('');
  },

  onConsumerChange() {
    const sel = document.getElementById('surr-consumer');
    const opt = sel.options[sel.selectedIndex];
    const paid = parseFloat(opt.dataset.paid || 0);
    const forfeiture = 29500;
    const refund = Math.max(0, paid - forfeiture);
    
    document.getElementById('surr-paid').value = Utils.currency(paid);
    document.getElementById('surr-refund').value = Utils.currency(refund);
  },

  async submit() {
    const cid = document.getElementById('surr-consumer').value;
    if (!cid) return;

    Utils.confirm('FINAL WARNING: This will cancel the allotment and release the unit. Are you sure?', async () => {
      try {
        // Reuse the allocations cancellation endpoint if it exists, or create a specific one
        await Api.post('/allocations/cancel-request', { 
          consumerId: cid,
          reason: document.getElementById('surr-reason').value
        });
        Utils.success('Cancellation processed. Unit released.');
        this.loadConsumers();
      } catch (err) { Utils.error(err.message); }
    });
  }
};
