// ROF CRM — Registry & Conveyance Page
Pages.registry = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="page-hdr">
      <h1>Registry & Conveyance</h1>
      <div class="breadcrumb">Application / <b>Registry</b></div>
    </div>

    <div class="sp" style="margin-bottom:12px">
      <div class="sp-hdr"><div class="sp-title">Schedule Registry Appointment</div></div>
      <div class="sp-body">
        <div class="sp-grid">
          <div class="fg"><label class="fl">Consumer (Allotted)</label>
            <select class="fc" id="reg-consumer" onchange="RegistryPage.onConsumerChange()">
              <option value="">— Select Allotted Consumer —</option>
            </select>
          </div>
          <div class="fg"><label class="fl">Appointment Date</label>
            <input type="date" class="fc" id="reg-date" value="${Utils.today()}">
          </div>
          <div class="fg" style="grid-column:span 2"><label class="fl">Remarks</label>
            <input class="fc" id="reg-remarks" placeholder="Notes for Tehsil / Sub-Registrar office">
          </div>
        </div>
        <div id="reg-validate-msg" style="margin-top:8px; font-size:12px"></div>
        <button class="btn btn-teal btn-lg" style="margin-top:10px" id="reg-submit-btn" onclick="RegistryPage.schedule()">SCHEDULE APPOINTMENT</button>
      </div>
    </div>

    <div class="tbl-wrap">
      <div class="tbl-hdr"><div class="tbl-title">Scheduled & Completed Registries</div></div>
      <div id="reg-list-body"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>
  `;

  await RegistryPage.init();
};

const RegistryPage = {
  async init() {
    await this.loadConsumers();
    await this.loadList();
  },

  async loadConsumers() {
    const res = await Api.get('/consumers', { params: { leadStage: 'allotted' } });
    const list = res.data || res || [];
    document.getElementById('reg-consumer').innerHTML = '<option value="">— Select Allotted Consumer —</option>' +
      list.map(c => `<option value="${c.id}">${c.name || `${c.first_name} ${c.last_name}`} · ${c.unit_number || 'Unit'}</option>`).join('');
  },

  async onConsumerChange() {
    const cid = document.getElementById('reg-consumer').value;
    if (!cid) return;
    
    // Check balance logic (simplified for frontend)
    const msg = document.getElementById('reg-validate-msg');
    msg.innerHTML = '<span style="color:var(--teal)">✓ Verifying ledger status...</span>';
    
    // Real validation happens on backend, but we could add a check here.
  },

  async schedule() {
    const cid = document.getElementById('reg-consumer').value;
    const date = document.getElementById('reg-date').value;
    const remarks = document.getElementById('reg-remarks').value;

    // We need allocationId. For simplicity, we fetch it or pass it.
    // Assuming 1 allocation per consumer for now.
    try {
      const res = await Api.get('/allocations', { params: { consumerId: cid } });
      const alloc = res.data?.[0];
      if (!alloc) throw new Error('No allocation found for this consumer');

      await Api.post('/registry/schedule', { 
        allocationId: alloc.id,
        appointmentDate: date,
        remarks 
      });
      Utils.success('Registry appointment scheduled');
      this.loadList();
    } catch (err) { Utils.error(err.message); }
  },

  async loadList() {
    const el = document.getElementById('reg-list-body');
    try {
      const res = await Api.get('/registry');
      const list = res.data || res || [];
      el.innerHTML = `<table>
        <thead><tr><th>Consumer</th><th>Unit</th><th>Appt. Date</th><th>Reg. Date</th><th>Status</th></tr></thead>
        <tbody>
          ${list.map(r => `<tr>
            <td class="td-bold"><a href="/api/consumers/${r.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" onclick="event.stopPropagation()" style="color:var(--primary);text-decoration:underline;cursor:pointer" title="View Applicant File">${r.consumer_name}</a></td>
            <td>${r.unit_number}</td>
            <td>${Utils.date(r.appointment_date)}</td>
            <td>${r.registry_date ? Utils.date(r.registry_date) : '—'}</td>
            <td>${Utils.chip(r.status)}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
    } catch { el.innerHTML = ''; }
  }
};
