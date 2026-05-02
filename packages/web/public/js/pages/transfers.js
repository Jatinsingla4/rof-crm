// ROF CRM — Ownership Transfer Page
Pages.transfers = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="page-hdr">
      <h1>Ownership Transfer</h1>
      <div class="breadcrumb">Application / <b>Transfer</b></div>
    </div>

    <div class="sp" style="margin-bottom:12px">
      <div class="sp-hdr"><div class="sp-title">Process Unit Transfer</div></div>
      <div class="sp-body">
        <div class="sp-grid">
          <div class="fg"><label class="fl">Project</label>
            <select class="fc" id="trans-project" onchange="TransferPage.onProjectChange()">
              <option value="">— Select Project —</option>
            </select>
          </div>
          <div class="fg"><label class="fl">Unit Address</label>
            <select class="fc" id="trans-unit" onchange="TransferPage.onUnitChange()">
              <option value="">— Select Allotted Unit —</option>
            </select>
          </div>
          <div class="fg"><label class="fl">Current Owner</label>
            <input class="fc" id="trans-old-owner-name" readonly placeholder="Auto-filled">
            <input type="hidden" id="trans-old-owner-id">
          </div>
          <div class="fg"><label class="fl">New Owner (Buyer)</label>
            <select class="fc" id="trans-new-owner">
              <option value="">— Select New Consumer —</option>
            </select>
          </div>
          <div class="fg"><label class="fl">Transfer Fee (₹)</label>
            <input type="number" class="fc" id="trans-fee" value="10000">
          </div>
          <div class="fg"><label class="fl">Admin Charges (₹)</label>
            <input type="number" class="fc" id="trans-admin" value="5000">
          </div>
          <div class="fg" style="grid-column:span 2"><label class="fl">Remarks</label>
            <input class="fc" id="trans-remarks" placeholder="Reason for transfer, legal ref, etc.">
          </div>
        </div>
        <button class="btn btn-teal btn-lg" style="margin-top:15px" onclick="TransferPage.submit()">CONFIRM TRANSFER</button>
      </div>
    </div>

    <div class="tbl-wrap">
      <div class="tbl-hdr"><div class="tbl-title">Ownership History</div></div>
      <div id="trans-history-body">
        <div class="empty-state"><h3>Select a unit to see history</h3></div>
      </div>
    </div>
  `;

  await TransferPage.init();
};

const TransferPage = {
  async init() {
    await this.loadProjects();
    await this.loadNewConsumers();
  },

  async loadProjects() {
    const res = await Api.get('/projects');
    const list = res.data || res || [];
    document.getElementById('trans-project').innerHTML = '<option value="">— Select Project —</option>' +
      list.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  },

  async onProjectChange() {
    const pid = document.getElementById('trans-project').value;
    const res = await Api.get('/units', { params: { projectId: pid, status: 'allotted' } });
    const list = res.data || res || [];
    document.getElementById('trans-unit').innerHTML = '<option value="">— Select Allotted Unit —</option>' +
      list.map(u => `<option value="${u.id}">${u.unit_number}</option>`).join('');
  },

  async onUnitChange() {
    const uid = document.getElementById('trans-unit').value;
    if (!uid) return;
    
    // Find current owner
    const res = await Api.get('/consumers', { params: { allocatedUnitId: uid } });
    const c = res.data?.[0] || res?.[0];
    if (c) {
      document.getElementById('trans-old-owner-name').value = c.name || `${c.first_name} ${c.last_name}`;
      document.getElementById('trans-old-owner-id').value = c.id;
    }
    
    this.loadHistory(uid);
  },

  async loadNewConsumers() {
    const res = await Api.get('/consumers', { params: { page: 1, pageSize: 500 } });
    const list = res.data || res || [];
    document.getElementById('trans-new-owner').innerHTML = '<option value="">— Select New Consumer —</option>' +
      list.map(c => `<option value="${c.id}">${c.name || `${c.first_name} ${c.last_name}`} · ${c.mobile}</option>`).join('');
  },

  async submit() {
    const body = {
      unitId: document.getElementById('trans-unit').value,
      oldConsumerId: document.getElementById('trans-old-owner-id').value,
      newConsumerId: document.getElementById('trans-new-owner').value,
      transferFee: document.getElementById('trans-fee').value,
      adminCharges: document.getElementById('trans-admin').value,
      remarks: document.getElementById('trans-remarks').value
    };

    if (!body.newConsumerId) { Utils.warn('Please select new owner'); return; }

    Utils.confirm('Are you sure? This will officially transfer ownership and modify the unit records.', async () => {
      try {
        await Api.post('/transfers', body);
        Utils.success('Ownership transferred successfully');
        this.onUnitChange();
      } catch (err) { Utils.error(err.message); }
    });
  },

  async loadHistory(unitId) {
    const el = document.getElementById('trans-history-body');
    try {
      const res = await Api.get(`/transfers/history/${unitId}`);
      const list = res.data || res || [];
      if (!list.length) { el.innerHTML = '<div class="empty-state"><h3>No previous transfers for this unit</h3></div>'; return; }
      
      el.innerHTML = `<table>
        <thead><tr><th>Date</th><th>From</th><th>To</th><th>Fee</th><th>Remarks</th></tr></thead>
        <tbody>
          ${list.map(h => `<tr>
            <td>${Utils.date(h.transfer_date)}</td>
            <td class="td-bold">${h.old_consumer_name}</td>
            <td class="td-bold">${h.new_consumer_name}</td>
            <td>${Utils.currency(h.transfer_fee_inr)}</td>
            <td style="font-size:10.5px">${h.transfer_remarks||'—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
    } catch { el.innerHTML = ''; }
  }
};
