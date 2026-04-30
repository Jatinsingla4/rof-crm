// ROF CRM — Demand Raise Page (generate payment demands)

Pages.demandRaise = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="page-hdr">
      <h1>Raise Demand</h1>
      <div class="breadcrumb">Application / <b>Raise Demand</b></div>
    </div>
    <div class="tabs-line">
      <button class="tab-line active" data-group="dr" data-tab="single" onclick="switchTab('dr','single')">Single Consumer</button>
      <button class="tab-line" data-group="dr" data-tab="bulk" onclick="switchTab('dr','bulk')">Bulk Raise</button>
      <button class="tab-line" data-group="dr" data-tab="schedule" onclick="switchTab('dr','schedule')">Schedule</button>
    </div>

    <!-- SINGLE CONSUMER TAB -->
    <div data-panel-group="dr" data-panel="single">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Raise Demand for Consumer</div></div>
        <div class="sp-body">
          <div class="sp-grid">
            <div class="fg"><label class="fl"><span class="r">*</span>Consumer</label>
              <select class="fc" id="dr-consumer" onchange="DemandRaisePage.loadConsumerSummary(this.value)">
                <option value="">— Select Consumer —</option>
              </select>
            </div>
            <div class="fg"><label class="fl"><span class="r">*</span>Instalment</label>
              <select class="fc" id="dr-instalment">
                <option value="">— Select Instalment —</option>
                <option value="booking">Booking Amount (5%)</option>
                <option value="allotment">On Allotment (20%)</option>
                <option value="installment_1">Instalment 1 (12.5%)</option>
                <option value="installment_2">Instalment 2 (12.5%)</option>
                <option value="installment_3">Instalment 3 (12.5%)</option>
                <option value="installment_4">Instalment 4 (12.5%)</option>
                <option value="installment_5">Instalment 5 (12.5%)</option>
                <option value="installment_6">Instalment 6 (12.5%)</option>
                <option value="possession">On Possession (5%)</option>
              </select>
            </div>
            <div class="fg"><label class="fl"><span class="r">*</span>Due Date</label>
              <input type="date" class="fc" id="dr-due-date" value="${Utils.today()}">
            </div>
            <div class="fg"><label class="fl">Amount (₹)</label>
              <input type="number" class="fc" id="dr-amount" placeholder="Auto-calculated">
            </div>
            <div class="fg"><label class="fl">Demand Type</label>
              <select class="fc" id="dr-type">
                <option value="main">Main Demand</option>
                <option value="reminder_1">Reminder 1</option>
                <option value="reminder_2">Reminder 2</option>
                <option value="termination">Termination Notice</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Send via</label>
              <select class="fc" id="dr-channel">
                <option value="none">Generate Only</option>
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email_whatsapp">Email + WhatsApp</option>
              </select>
            </div>
          </div>
          <!-- Consumer summary panel -->
          <div id="dr-consumer-summary" style="margin-top:12px"></div>
          <div style="margin-top:12px;display:flex;gap:8px">
            <button class="btn btn-teal btn-lg" onclick="DemandRaisePage.raise()">Raise Demand</button>
            <button class="btn btn-ghost" onclick="Router.navigate('/demands')">View All Demands</button>
          </div>
          <div id="dr-result" style="margin-top:12px"></div>
        </div>
      </div>
    </div>

    <!-- BULK RAISE TAB -->
    <div data-panel-group="dr" data-panel="bulk" style="display:none">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Bulk Demand Generation</div></div>
        <div class="sp-body">
          <div class="alert alert-info" style="margin-bottom:12px">
            Raise demands for all allotted consumers whose next instalment is due. System auto-calculates amounts based on payment plans.
          </div>
          <div class="sp-grid">
            <div class="fg"><label class="fl">Project</label>
              <select class="fc" id="dr-bulk-project">
                <option value="">— All Projects —</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Instalment</label>
              <select class="fc" id="dr-bulk-instalment">
                <option value="next_due">Next Due Instalment</option>
                <option value="allotment">On Allotment (20%)</option>
                <option value="installment_1">Instalment 1</option>
                <option value="installment_2">Instalment 2</option>
                <option value="installment_3">Instalment 3</option>
                <option value="installment_4">Instalment 4</option>
                <option value="installment_5">Instalment 5</option>
                <option value="installment_6">Instalment 6</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Due Date</label>
              <input type="date" class="fc" id="dr-bulk-due" value="${Utils.today()}">
            </div>
            <div class="fg"><label class="fl">Send via</label>
              <select class="fc" id="dr-bulk-channel">
                <option value="none">Generate Only</option>
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email_whatsapp">Email + WhatsApp</option>
              </select>
            </div>
          </div>
          <div style="margin-top:12px">
            <button class="btn btn-ghost btn-sm" onclick="DemandRaisePage.previewBulk()" style="margin-right:8px">Preview (${DemandRaisePage._bulkCount || 0} consumers)</button>
            <button class="btn btn-teal btn-lg" onclick="DemandRaisePage.raiseBulk()">Raise Bulk Demands</button>
          </div>
          <div id="dr-bulk-result" style="margin-top:12px"></div>
        </div>
      </div>
      <div id="dr-bulk-preview"></div>
    </div>

    <!-- SCHEDULE TAB -->
    <div data-panel-group="dr" data-panel="schedule" style="display:none">
      <div class="sp">
        <div class="sp-hdr"><div class="sp-title">Demand Schedule</div></div>
        <div class="sp-body">
          <div class="alert alert-info" style="margin-bottom:12px">
            Upcoming demand schedule based on AHP payment plan. Demands are auto-raised 15 days before due date.
          </div>
          <div id="dr-schedule-body"><div class="page-loading"><div class="spinner"></div></div></div>
        </div>
      </div>
    </div>
  `;

  await DemandRaisePage.init();
};

const DemandRaisePage = {
  _bulkCount: 0,

  async init() {
    await Promise.allSettled([
      this.loadConsumers(),
      this.loadProjects(),
      this.loadSchedule(),
    ]);
  },

  async loadConsumers() {
    try {
      const res = await Api.get('/consumers', { params: { leadStage: 'allotted', pageSize: 300 } });
      const list = res.data || res || [];
      this._bulkCount = list.length;
      const sel = document.getElementById('dr-consumer');
      if (sel) sel.innerHTML = '<option value="">— Select Consumer —</option>' +
        list.map(c => `<option value="${c.id}">${c.first_name||''} ${c.last_name||''} ${(!c.first_name&&c.name)?c.name:''} · ${c.mobile||''}</option>`).join('');
    } catch {}
  },

  async loadProjects() {
    try {
      const res = await Api.get('/units', { params: { pageSize: 300 } });
      const units = res.data || res || [];
      const projects = [...new Map(
        units.filter(u => u.project_id||u.projectId)
             .map(u => [u.project_id||u.projectId, { id: u.project_id||u.projectId, name: u.project_name||u.projectName }])
      ).values()];
      const sel = document.getElementById('dr-bulk-project');
      if (sel) sel.innerHTML = '<option value="">— All Projects —</option>' +
        projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    } catch {}
  },

  async loadConsumerSummary(consumerId) {
    const el = document.getElementById('dr-consumer-summary');
    if (!el || !consumerId) { if (el) el.innerHTML = ''; return; }
    try {
      const [consRes, payRes] = await Promise.allSettled([
        Api.get(`/consumers/${consumerId}`),
        Api.get('/payments/receipts', { params: { consumerId, pageSize: 50 } }),
      ]);
      const consumer = consRes.status === 'fulfilled' ? (consRes.value.data || consRes.value) : {};
      const receipts = payRes.status === 'fulfilled' ? (payRes.value.data || payRes.value || []) : [];
      const totalPaid = receipts.reduce((s,r) => s + parseFloat(r.amount||0), 0);
      const totalAmt = consumer.total_amount || consumer.totalAmount || 0;
      const outstanding = totalAmt - totalPaid;

      el.innerHTML = `
        <div class="sp" style="background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:12px">
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;font-size:11px">
            <div><div style="color:var(--text3)">Consumer</div><div style="font-weight:600">${consumer.first_name||''} ${consumer.last_name||consumer.name||'—'}</div></div>
            <div><div style="color:var(--text3)">Unit</div><div style="font-weight:600">${consumer.unit_number||consumer.unitNumber||'—'}</div></div>
            <div><div style="color:var(--text3)">Total Amount</div><div style="font-weight:600">${Utils.currency(totalAmt)}</div></div>
            <div><div style="color:var(--text3)">Outstanding</div><div style="font-weight:600;color:var(--red)">${Utils.currency(outstanding)}</div></div>
          </div>
        </div>
      `;
    } catch {}
  },

  async raise() {
    const consumerId = document.getElementById('dr-consumer')?.value;
    const instalment = document.getElementById('dr-instalment')?.value;
    const dueDate = document.getElementById('dr-due-date')?.value;
    const amount = document.getElementById('dr-amount')?.value;
    const demandType = document.getElementById('dr-type')?.value;
    const channel = document.getElementById('dr-channel')?.value;

    if (!consumerId) { Utils.warn('Please select a consumer'); return; }
    if (!instalment) { Utils.warn('Please select an instalment'); return; }
    if (!dueDate) { Utils.warn('Please select a due date'); return; }

    const result = document.getElementById('dr-result');
    try {
      const body = { consumerId, instalmentType: instalment, dueDate, demandType };
      if (amount) body.amount = parseFloat(amount);
      if (channel !== 'none') body.deliveryChannel = channel;

      const res = await Api.post('/payments/demands', body);
      const data = res.data || res;
      result.innerHTML = `
        <div class="alert alert-success">
          ✓ Demand raised successfully.
          Demand ID: <strong>${(data.id||'').slice(0,8)}</strong>
          · Amount: <strong>${Utils.currency(data.amount||data.amountDueInr||0)}</strong>
          · Due: <strong>${Utils.date(data.due_date||data.dueDate||dueDate)}</strong>
          ${channel !== 'none' ? `· Sent via ${channel}` : ''}
        </div>
      `;
    } catch (err) {
      result.innerHTML = `<div class="alert alert-error">Error: ${err.message}</div>`;
    }
  },

  async previewBulk() {
    const projectId = document.getElementById('dr-bulk-project')?.value;
    const params = { leadStage: 'allotted', pageSize: 300 };
    if (projectId) params.projectId = projectId;
    try {
      const res = await Api.get('/consumers', { params });
      const list = res.data || res || [];
      const el = document.getElementById('dr-bulk-preview');
      if (!el) return;
      el.innerHTML = `
        <div class="tbl-wrap" style="margin-top:12px">
          <div class="tbl-hdr"><div class="tbl-title">Bulk Preview (${list.length} consumers)</div></div>
          <table>
            <thead><tr><th>Consumer</th><th>Unit</th><th>Project</th><th>Outstanding</th></tr></thead>
            <tbody>
              ${list.slice(0,30).map(c => `<tr>
                <td class="td-bold">${c.first_name||''} ${c.last_name||c.name||'—'}</td>
                <td>${c.unit_number||c.unitNumber||'—'}</td>
                <td style="font-size:10.5px">${c.project_name||c.projectName||'—'}</td>
                <td>${Utils.currency(c.outstanding||c.balance||0)}</td>
              </tr>`).join('')}
              ${list.length > 30 ? `<tr><td colspan="4" style="text-align:center;color:var(--text3);font-size:11px">... and ${list.length-30} more</td></tr>` : ''}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) { Utils.error(err.message); }
  },

  async raiseBulk() {
    const projectId = document.getElementById('dr-bulk-project')?.value;
    const instalment = document.getElementById('dr-bulk-instalment')?.value;
    const dueDate = document.getElementById('dr-bulk-due')?.value;
    const channel = document.getElementById('dr-bulk-channel')?.value;

    Utils.confirm(`Raise bulk demands for all allotted consumers${projectId?'':' across all projects'}?`, async () => {
      const result = document.getElementById('dr-bulk-result');
      try {
        const body = { instalmentType: instalment, dueDate, bulk: true };
        if (projectId) body.projectId = projectId;
        if (channel !== 'none') body.deliveryChannel = channel;

        const res = await Api.post('/payments/demands/bulk', body);
        const data = res.data || res;
        result.innerHTML = `
          <div class="alert alert-success">
            ✓ Bulk demands raised: ${data.raised||data.count||'—'} demands generated.
            ${data.sent ? `· ${data.sent} sent via ${channel}.` : ''}
            ${data.errors ? `· ${data.errors} errors.` : ''}
          </div>
        `;
      } catch (err) {
        result.innerHTML = `<div class="alert alert-error">Error: ${err.message}</div>`;
      }
    });
  },

  async loadSchedule() {
    const el = document.getElementById('dr-schedule-body');
    if (!el) return;
    try {
      const res = await Api.get('/payments/demands', { params: { pageSize: 100 } });
      const list = res.data || res || [];
      const upcoming = list.filter(d => {
        const due = d.due_date || d.dueDate;
        return due && new Date(due) > new Date();
      }).sort((a,b) => new Date(a.due_date||a.dueDate) - new Date(b.due_date||b.dueDate));

      el.innerHTML = upcoming.length === 0
        ? '<div class="empty-state"><h3>No upcoming demands scheduled</h3></div>'
        : `<table>
            <thead><tr><th>Consumer</th><th>Unit</th><th>Instalment</th><th>Amount</th><th>Due Date</th><th>Status</th></tr></thead>
            <tbody>
              ${upcoming.slice(0,50).map(d => `<tr>
                <td class="td-bold">${d.consumer_name||d.consumerName||'—'}</td>
                <td>${d.unit_no||d.unitNo||'—'}</td>
                <td style="font-size:10.5px">${d.instalment_name||d.instalmentName||'—'}</td>
                <td style="font-weight:600">${Utils.currency(d.amount_due_inr||d.amountDueInr||d.amount||0)}</td>
                <td style="font-size:10.5px;color:var(--warn)">${Utils.date(d.due_date||d.dueDate)}</td>
                <td><span class="chip ${(d.sent_at||d.sentAt)?'ch-green':'ch-gray'}">${(d.sent_at||d.sentAt)?'Sent':'Pending'}</span></td>
              </tr>`).join('')}
            </tbody>
          </table>`;
    } catch (err) {
      el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`;
    }
  },
};
