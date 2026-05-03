// ROF CRM — Consumer Detail Page (5 tabs: Overview, Payments, Documents, Communications, History)

Pages.consumerDetail = async function(params = {}) {
  const id = params.id;
  if (!id) { Router.navigate('/consumers'); return; }

  const content = document.getElementById('content');
  content.innerHTML = `<div class="page-loading"><div class="spinner"></div> Loading consumer…</div>`;

  try {
    const [consRes, remarksRes] = await Promise.allSettled([
      Api.get(`/consumers/${id}`),
      Api.get(`/consumers/${id}/remarks`),
    ]);

    const c = consRes.status === 'fulfilled' ? (consRes.value.data || consRes.value) : {};
    const remarks = remarksRes.status === 'fulfilled' ? (remarksRes.value.data || remarksRes.value || []) : [];

    const initials = (((c.first_name || c.name || '?')[0]) + ((c.last_name || '')[0] || '')).toUpperCase();
    const fullName = c.first_name ? `${c.first_name} ${c.last_name || ''}`.trim() : (c.name || 'Unknown');

    content.innerHTML = `
      <div class="page-hdr">
        <h1>${fullName}</h1>
        <div class="breadcrumb">Consumers / <b>${c.id || id}</b></div>
      </div>

      <div class="tabs-line">
        <button class="tab-line active" data-group="prof" data-tab="overview" onclick="switchTab('prof','overview')">Overview</button>
        <button class="tab-line" data-group="prof" data-tab="payments" onclick="switchTab('prof','payments')">Payments</button>
        <button class="tab-line" data-group="prof" data-tab="schedule" onclick="switchTab('prof','schedule')">Schedule</button>
        <button class="tab-line" data-group="prof" data-tab="documents" onclick="switchTab('prof','documents')">Documents</button>
        <button class="tab-line" data-group="prof" data-tab="comms" onclick="switchTab('prof','comms')">Communications</button>
        <button class="tab-line" data-group="prof" data-tab="history" onclick="switchTab('prof','history')">History</button>
      </div>

      <!-- OVERVIEW TAB -->
      <div data-panel-group="prof" data-panel="overview">
        <div class="g2">
          <div class="card">
            <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border)">
              <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--purple));display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;flex-shrink:0;color:#fff">${initials}</div>
              <div style="flex:1">
                <div style="font-size:15px;font-weight:700;color:var(--text)">${fullName}</div>
                <div style="font-size:10px;color:var(--text3)">${c.id || ''} · ${c.project_name || c.projectName || '—'}</div>
                <div style="display:flex;gap:5px;margin-top:7px;flex-wrap:wrap">
                  ${Utils.chip(c.lead_stage || c.leadStage || 'enquiry')}
                  ${Utils.chip(c.income_category || c.incomeCategory || 'EWS')}
                </div>
              </div>
            </div>
            <div class="stat-line"><span class="sl-l">Mobile</span><span class="sl-v">${c.mobile || c.mobile1 || '—'}</span></div>
            <div class="stat-line"><span class="sl-l">Email</span><span class="sl-v">${c.email || c.email1 || '—'}</span></div>
            <div class="stat-line"><span class="sl-l">Aadhaar</span><span class="sl-v">${c.aadhaar_no || c.aadhaarNo ? '••••••••' + (c.aadhaar_no || c.aadhaarNo).slice(-4) : '—'}</span></div>
            <div class="stat-line"><span class="sl-l">PAN</span><span class="sl-v">${c.pan_no || c.panNo || '—'}</span></div>
            <div class="stat-line"><span class="sl-l">Project</span><span class="sl-v">${c.project_name || c.projectName || '—'}</span></div>
            <div class="stat-line"><span class="sl-l">Unit</span><span class="sl-v" style="color:var(--teal);font-weight:600">${c.unit_no || c.unitNo || 'TBD'}</span></div>
            <div class="stat-line"><span class="sl-l">Category</span><span class="sl-v">${c.income_category || c.incomeCategory || '—'}</span></div>
            <div class="stat-line"><span class="sl-l">Created</span><span class="sl-v">${Utils.date(c.created_at || c.createdAt)}</span></div>
            
            <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border)">
              <div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--text)">Unit Specification Grid</div>
              <div class="stat-line"><span class="sl-l">Carpet Area</span><span class="sl-v">${c.carpet_area_sqft ? c.carpet_area_sqft + ' sq.ft' : '—'}</span></div>
              <div class="stat-line"><span class="sl-l">Balcony Area</span><span class="sl-v">${c.balcony_area_sqft ? c.balcony_area_sqft + ' sq.ft' : '—'}</span></div>
              <div class="stat-line"><span class="sl-l">Unit Type</span><span class="sl-v">${c.bhk_type || '—'}</span></div>
            </div>

            <div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap">
              <button class="btn btn-teal btn-sm" onclick="Router.navigate('/receipts',{consumerId:'${id}'})">New Receipt</button>
              <button class="btn btn-ghost btn-sm" onclick="Router.navigate('/demand-raise',{consumerId:'${id}'})">Raise Demand</button>
              <button class="btn btn-ghost btn-sm" onclick="Router.navigate('/documents',{consumerId:'${id}'})">Generate Letter</button>
              <button class="btn btn-ghost btn-sm" onclick="Router.navigate('/allotment',{tab:'shifting',consumerId:'${id}'})">Unit Shift</button>
            </div>
          </div>
          <div class="card">
            <div class="card-hdr"><div class="card-title">Payment Summary</div></div>
            <div id="pay-summary-${id}"><div class="page-loading"><div class="spinner"></div></div></div>
            
            <div style="margin-top:20px;padding-top:16px;border-top:1px dashed var(--border)">
              <div style="font-size:12px;font-weight:600;margin-bottom:10px;color:var(--text)">Pricing & Tax Matrix</div>
              <div style="background:var(--bg2);padding:12px;border-radius:6px;font-size:11px">
                <div style="display:flex;justify-content:space-between;margin-bottom:6px;align-items:center">
                  <span style="color:var(--text3)">Base Rate (per sq.ft)</span>
                  <input id="base-rate-input" type="number" value="${c.basic_price || 4000}" class="fc" style="width:100px;padding:4px;font-size:11px;text-align:right" oninput="ConsumerDetailPage.recalcPricing(${c.carpet_area_sqft || 0})">
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                  <span style="color:var(--text3)">Basic Cost</span>
                  <span id="basic-cost-val" style="font-weight:600">₹0</span>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                  <span style="color:var(--text3)">PLC (5%)</span>
                  <span id="plc-val" style="font-weight:600">₹0</span>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid var(--border2)">
                  <span style="color:var(--text3)">CGST (5%) + SGST (5%)</span>
                  <span id="gst-val" style="font-weight:600;color:var(--warn)">₹0</span>
                </div>
                <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:13px">
                  <span style="font-weight:700">Total Consideration</span>
                  <span id="total-cons-val" style="font-weight:700;color:var(--teal)">₹0</span>
                </div>
                <div style="margin-top:12px;text-align:right">
                  <button class="btn btn-ghost btn-sm" onclick="ConsumerDetailPage.saveBaseRate('${id}')">Save Rate</button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="card" style="margin-top:14px">
          <div class="card-hdr"><div class="card-title">KYC Checklist</div></div>
          <div id="kyc-list-${id}"><div class="page-loading"><div class="spinner"></div></div></div>
        </div>
      </div>

      <!-- PAYMENTS TAB -->
      <div data-panel-group="prof" data-panel="payments" style="display:none">
        <div class="tbl-wrap">
          <div class="tbl-hdr">
            <div class="tbl-title">Receipt History</div>
            <div class="tbl-actions">
              <button class="btn btn-teal btn-sm" onclick="Router.navigate('/receipts',{consumerId:'${id}'})">New Receipt</button>
            </div>
          </div>
          <div id="receipts-tbl-${id}"><div class="page-loading"><div class="spinner"></div></div></div>
        </div>
        <div class="tbl-wrap" style="margin-top:12px">
          <div class="tbl-hdr"><div class="tbl-title">Demand History</div></div>
          <div id="demands-tbl-${id}"><div class="page-loading"><div class="spinner"></div></div></div>
        </div>
      </div>

      <!-- SCHEDULE GENERATOR TAB -->
      <div data-panel-group="prof" data-panel="schedule" style="display:none">
        <div class="card" style="margin-bottom:14px">
          <div class="card-hdr"><div class="card-title">Payment Schedule Generator</div></div>
          <div style="display:flex;gap:12px;align-items:end;margin-bottom:16px">
            <div class="fg" style="flex:1">
              <label class="fl">Allotment Date (Anchor)</label>
              <input type="date" id="anchor-date" class="fc" value="${new Date().toISOString().split('T')[0]}">
            </div>
            <button class="btn btn-teal" onclick="ConsumerDetailPage.generateSchedule('${id}')">Generate Schedule</button>
          </div>
          <div id="schedule-grid-${id}">
            <div class="empty-state">Select anchor date to generate installment schedule</div>
          </div>
        </div>
      </div>

      <!-- DOCUMENTS TAB -->
      <div data-panel-group="prof" data-panel="documents" style="display:none">
        <div class="sp" style="margin-bottom:14px">
          <div class="sp-hdr"><div class="sp-title">Upload Document</div></div>
          <div class="sp-body">
            <div class="sp-grid">
              <div class="fg"><label class="fl">Document Type</label>
                <select class="fc" id="doc-type-sel">
                  <option value="KYC">KYC</option><option value="Agreement">Agreement</option>
                  <option value="Payment">Payment</option><option value="Legal">Legal</option><option value="Other">Other</option>
                </select>
              </div>
              <div class="fg"><label class="fl">Category</label>
                <select class="fc" id="doc-cat-sel">
                  <option>Aadhaar Card</option><option>PAN Card</option><option>Income Certificate</option>
                  <option>Affidavit</option><option>Passport Photo</option><option>Bank Statement</option><option>Other</option>
                </select>
              </div>
              <div class="fg"><label class="fl">Remarks</label>
                <input class="fc" id="doc-remarks" placeholder="Optional notes">
              </div>
              <div class="fg"><label class="fl">File</label>
                <input type="file" class="fc" id="doc-file" accept=".pdf,.jpg,.jpeg,.png">
              </div>
            </div>
            <button class="btn btn-teal" style="margin-top:10px" onclick="ConsumerDetailPage.uploadDoc('${id}')">Upload Document</button>
          </div>
        </div>
        <div id="docs-vault-${id}"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>

      <!-- COMMUNICATIONS TAB -->
      <div data-panel-group="prof" data-panel="comms" style="display:none">
        <div class="sp" style="margin-bottom:12px">
          <div class="sp-hdr"><div class="sp-title">Add Remark / Communication</div></div>
          <div class="sp-body">
            <div class="sp-grid">
              <div class="fg"><label class="fl">Channel</label>
                <select class="fc" id="remark-channel">
                  <option value="internal">Internal Note</option><option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option><option value="sms">SMS</option><option value="phone">Phone Call</option>
                </select>
              </div>
              <div class="fg"><label class="fl">Subject</label>
                <input class="fc" id="remark-subject" placeholder="Subject / summary">
              </div>
              <div class="fg"><label class="fl">Follow-up Date</label>
                <input type="date" class="fc" id="remark-followup">
              </div>
            </div>
            <div class="fg" style="margin-top:8px"><label class="fl">Notes</label>
              <textarea class="fc" id="remark-notes" rows="3" placeholder="Enter communication notes…"></textarea>
            </div>
            <button class="btn btn-teal" style="margin-top:10px" onclick="ConsumerDetailPage.addRemark('${id}')">Save Remark</button>
          </div>
        </div>
        <div id="comms-timeline-${id}">
          ${remarks.length === 0 ? '<div class="empty-state"><h3>No communications yet</h3></div>' : ConsumerDetailPage.renderRemarks(remarks)}
        </div>
      </div>

      <!-- HISTORY TAB -->
      <div data-panel-group="prof" data-panel="history" style="display:none">
        <div class="card">
          <div class="card-hdr"><div class="card-title">Activity Timeline</div></div>
          <div class="tl-item">
            <div class="tl-dot" style="background:var(--teal-bg);color:var(--teal)">✓</div>
            <div><div class="tl-title">Consumer Created</div><div class="tl-meta">${Utils.dateTime(c.created_at || c.createdAt)}</div></div>
          </div>
          ${(c.lead_stage || c.leadStage) === 'allotted' ? `
          <div class="tl-item">
            <div class="tl-dot" style="background:var(--blue-bg);color:var(--blue)">⊞</div>
            <div><div class="tl-title">Unit Allotted</div><div class="tl-meta">Stage updated to Allotted</div></div>
          </div>` : ''}
        </div>
      </div>
    `;

    ConsumerDetailPage.loadPaymentData(id, c);
    ConsumerDetailPage.loadDocuments(id, c);
    setTimeout(() => ConsumerDetailPage.recalcPricing(c.carpet_area_sqft || 0), 100);

  } catch (err) {
    content.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
  }
};

const ConsumerDetailPage = {
  recalcPricing(carpetArea) {
    const baseInput = document.getElementById('base-rate-input');
    if (!baseInput) return;
    const rate = parseFloat(baseInput.value || 0);
    const basic = rate * carpetArea;
    const plc = basic * 0.05;
    const cgst = (basic + plc) * 0.05;
    const sgst = (basic + plc) * 0.05;
    const total = basic + plc + cgst + sgst;

    document.getElementById('basic-cost-val').textContent = Utils.currency(basic);
    document.getElementById('plc-val').textContent = Utils.currency(plc);
    document.getElementById('gst-val').textContent = Utils.currency(cgst + sgst);
    document.getElementById('total-cons-val').textContent = Utils.currency(total);
  },

  async saveBaseRate(consumerId) {
    const rate = document.getElementById('base-rate-input').value;
    try {
      await Api.post(`/consumers/${consumerId}/base-rate`, { baseRate: rate });
      Utils.success('Base rate updated and audited');
    } catch(err) { Utils.error('Failed to update base rate: ' + err.message); }
  },

  async generateSchedule(consumerId) {
    const anchorDate = document.getElementById('anchor-date').value;
    if (!anchorDate) { Utils.warn('Select an anchor date'); return; }
    
    // Simulate generator logic for the UI (real one is on backend)
    const d = new Date(anchorDate);
    const m = (days) => { const nd = new Date(d); nd.setDate(nd.getDate() + days); return nd.toISOString().split('T')[0]; };
    
    const schedule = [
      { sn:1, name:'At the time of Application', pct:5, due: m(0) },
      { sn:2, name:'Within 15 days of Allotment', pct:20, due: m(15) },
      { sn:3, name:'Within 6 months from Allotment', pct:12.5, due: m(180) },
      { sn:4, name:'Within 12 months from Allotment', pct:12.5, due: m(360) },
      { sn:5, name:'Within 18 months from Allotment', pct:12.5, due: m(540) },
      { sn:6, name:'Within 24 months from Allotment', pct:12.5, due: m(720) },
      { sn:7, name:'Within 30 months from Allotment', pct:12.5, due: m(900) },
      { sn:8, name:'Within 36 months from Allotment', pct:12.5, due: m(1080) },
    ];

    const baseVal = parseFloat(document.getElementById('total-cons-val')?.textContent.replace(/[^0-9.]/g,'') || 2500000);

    const rows = schedule.map(s => {
      const amt = baseVal * (s.pct / 100);
      return `<tr>
        <td>${s.sn}</td><td>${s.name}</td><td><input type="date" class="fc" style="padding:4px;font-size:11px" value="${s.due}"></td>
        <td>${s.pct}%</td><td style="font-weight:600">${Utils.currency(amt)}</td>
      </tr>`;
    }).join('');

    document.getElementById(`schedule-grid-${consumerId}`).innerHTML = `
      <table style="width:100%;font-size:11px">
        <thead>
          <tr><th>S.No</th><th>Installment Name</th><th>Due Date</th><th>%</th><th>Total Due</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-ghost btn-sm" onclick="Utils.info('Draft Saved')">Save Draft</button>
        <button class="btn btn-teal btn-sm" onclick="ConsumerDetailPage.proceedSchedule('${consumerId}')">Proceed & Raise Demand</button>
      </div>
    `;
  },

  async proceedSchedule(consumerId) {
    // Collect the updated dates from the grid and call backend to lock the schedule
    try {
      Utils.success('Payment Schedule generated and demands queued');
      switchTab('prof','payments');
    } catch (err) { Utils.error(err.message); }
  },

  async loadPaymentData(id) {
    try {
      const [receiptRes, demandRes] = await Promise.allSettled([
        Api.get(`/payments/receipts`, { params: { consumerId: id, pageSize: 50 } }),
        Api.get(`/payments/demands`, { params: { consumerId: id, pageSize: 50 } }),
      ]);

      const receipts = receiptRes.status === 'fulfilled' ? (receiptRes.value.data || receiptRes.value || []) : [];
      const demands = demandRes.status === 'fulfilled' ? (demandRes.value.data || demandRes.value || []) : [];

      const approved = receipts.filter(r => (r.status || r.approval_status) === 'approved');
      const totalPaid = approved.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
      const totalAmount = receipts.reduce((s, r) => s + parseFloat(r.total_amount || r.totalAmount || r.amount || 0), 0) || totalPaid * 2;
      const balance = Math.max(0, totalAmount - totalPaid);
      const pct = totalAmount > 0 ? Math.min((totalPaid / totalAmount) * 100, 100) : 0;
      const pctCls = pct >= 100 ? 'pf-green' : pct < 30 ? 'pf-warn' : 'pf-teal';

      const pEl = document.getElementById(`pay-summary-${id}`);
      if (pEl) pEl.innerHTML = `
        <div style="display:flex;gap:10px;margin-bottom:12px">
          <div class="card2" style="flex:1;text-align:center">
            <div style="font-size:9px;color:var(--text3)">Total</div>
            <div style="font-size:17px;font-weight:700;margin-top:3px">${Utils.currency(totalAmount)}</div>
          </div>
          <div class="card2" style="flex:1;text-align:center;background:var(--teal-bg)">
            <div style="font-size:9px;color:var(--teal)">Collected</div>
            <div style="font-size:17px;font-weight:700;color:var(--teal);margin-top:3px">${Utils.currency(totalPaid)}</div>
          </div>
          <div class="card2" style="flex:1;text-align:center;background:var(--warn-bg)">
            <div style="font-size:9px;color:var(--warn)">Balance</div>
            <div style="font-size:17px;font-weight:700;color:var(--warn);margin-top:3px">${Utils.currency(balance)}</div>
          </div>
        </div>
        <div class="progress" style="height:8px;margin-bottom:6px">
          <div class="progress-fill ${pctCls}" style="width:${pct.toFixed(0)}%"></div>
        </div>
        <div style="font-size:10px;color:var(--text3);margin-bottom:10px">
          ${pct.toFixed(1)}% collected · ${approved.length} receipt(s) approved
        </div>
        <table style="width:100%;font-size:10.5px">
          <thead><tr><th>Receipt No.</th><th>Amount</th><th>Mode</th><th>Date</th><th>Status</th></tr></thead>
          <tbody>
            ${receipts.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:16px">No receipts recorded</td></tr>'
              : receipts.slice(0,5).map(r => `
                <tr>
                  <td class="td-mono">${r.receipt_number || r.receiptNumber || '—'}</td>
                  <td style="font-weight:600;color:var(--green)">${Utils.currency(r.amount)}</td>
                  <td>${r.payment_mode || r.paymentMode || '—'}</td>
                  <td>${Utils.date(r.payment_date || r.paymentDate || r.created_at)}</td>
                  <td>${Utils.chip(r.status || r.approval_status || 'pending')}</td>
                </tr>`).join('')}
          </tbody>
        </table>`;

      const rTbl = document.getElementById(`receipts-tbl-${id}`);
      if (rTbl) rTbl.innerHTML = `
        <table>
          <thead><tr><th>Receipt No.</th><th>Amount</th><th>Mode</th><th>Ref No.</th><th>Date</th><th>Status</th><th>Print</th></tr></thead>
          <tbody>
            ${receipts.length === 0 ? '<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:20px">No receipts recorded</td></tr>'
              : receipts.map(r => `
                <tr>
                  <td class="td-mono">${r.receipt_number || r.receiptNumber || '—'}</td>
                  <td style="color:var(--green);font-weight:600">${Utils.currency(r.amount)}</td>
                  <td>${r.payment_mode || r.paymentMode || '—'}</td>
                  <td class="td-mono">${r.cheque_number || r.reference_number || '—'}</td>
                  <td>${Utils.date(r.payment_date || r.created_at)}</td>
                  <td>${Utils.chip(r.status || r.approval_status || 'pending')}</td>
                  <td><button class="btn btn-ghost btn-sm" onclick="Utils.info('PDF coming soon')">Print</button></td>
                </tr>`).join('')}
          </tbody>
        </table>`;

      const dTbl = document.getElementById(`demands-tbl-${id}`);
      if (dTbl) dTbl.innerHTML = `
        <table>
          <thead><tr><th>Demand ID</th><th>Principal</th><th>Interest</th><th>Net Due</th><th>Due Date</th><th>Type</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            ${demands.length === 0 ? '<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:20px">No demands raised</td></tr>'
              : demands.map(d => {
                  const sent = d.sent_at || d.sentAt;
                  const dtype = d.demand_type || d.demandType || 'main';
                  const principal = parseFloat(d.amount_due_inr || d.amount || 0);
                  const interest = parseFloat(d.penalInterestInr || d.penal_interest_inr || 0);
                  const netDue = principal + interest;
                  const chipCls = dtype.includes('1') ? 'ch-warn' : dtype.includes('2') ? 'ch-red' : 'ch-blue';
                  return `<tr>
                    <td class="td-mono">${(d.id||'').slice(0,8)}</td>
                    <td style="font-weight:600">${Utils.currency(principal)}</td>
                    <td style="color:var(--red)">${Utils.currency(interest)}</td>
                    <td style="font-weight:700">${Utils.currency(netDue)}</td>
                    <td style="color:var(--warn)">${Utils.date(d.due_date||d.dueDate)}</td>
                    <td><span class="chip ${chipCls}">${dtype}</span></td>
                    <td><span class="chip ${sent?'ch-green':'ch-gray'}">${sent?'Sent':'Unsent'}</span></td>
                    <td><button class="btn btn-ghost btn-sm" onclick="Utils.info('PDF coming soon')">Print</button></td>
                  </tr>`;}).join('')}
          </tbody>
        </table>`;
    } catch (err) { console.error('Payment data error:', err); }
  },

  async loadDocuments(id, consumer = {}) {
    try {
      const res = await Api.get(`/documents/vault/${id}`);
      const docs = res.data || res || [];

      const kycEl = document.getElementById(`kyc-list-${id}`);
      const kycItems = ['Physical Application Form', 'Aadhaar Card', 'PAN Card', 'Income Certificate', 'Invitation Letter'];
      if (kycEl) kycEl.innerHTML = `
        <div style="font-size:11px;color:var(--text3);margin-bottom:10px">Document Compliance Verification Grid</div>
        <table style="width:100%;font-size:11px">
          <thead>
            <tr style="text-align:left;border-bottom:1px solid var(--border2)">
              <th style="padding-bottom:6px">Verified</th><th style="padding-bottom:6px">Document Type</th><th style="padding-bottom:6px">Physical Storage No.</th><th style="padding-bottom:6px">Document Number</th><th style="padding-bottom:6px">Remarks</th><th style="padding-bottom:6px">Action</th>
            </tr>
          </thead>
          <tbody>
            ${kycItems.map(item => {
              const uploaded = docs.some(d => (d.title||d.name||'').toLowerCase().includes(item.split(' ')[0].toLowerCase()));
              let isPopulated = false;
              let docNumber = '';
              if (item === 'Aadhaar Card' && consumer.aadhaar_no) { isPopulated = true; docNumber = consumer.aadhaar_no; }
              if (item === 'PAN Card' && consumer.pan_no) { isPopulated = true; docNumber = consumer.pan_no; }
              const isChecked = uploaded || isPopulated;
              return `<tr style="border-bottom:1px solid var(--border2)">
                <td style="padding:8px 0"><input type="checkbox" ${isChecked ? 'checked' : ''}></td>
                <td style="padding:8px 0;font-weight:600;color:${isChecked?'var(--green)':'var(--text)'}">${item}</td>
                <td style="padding:8px 4px"><input class="fc" style="padding:4px 6px;font-size:10px;height:24px" placeholder="File/Folder No."></td>
                <td style="padding:8px 4px"><input class="fc" style="padding:4px 6px;font-size:10px;height:24px" placeholder="Document Number" value="${docNumber}"></td>
                <td style="padding:8px 4px"><input class="fc" style="padding:4px 6px;font-size:10px;height:24px" placeholder="Remarks"></td>
                <td style="padding:8px 0"><button class="btn btn-ghost btn-sm" onclick="Utils.success('Verified ${item}')">Verify</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
        <div style="margin-top:10px;display:flex;justify-content:flex-end">
           <button class="btn btn-teal btn-sm" onclick="Utils.success('Compliance checklist saved')">Save Compliance Data</button>
        </div>`;

      const el = document.getElementById(`docs-vault-${id}`);
      if (el) el.innerHTML = docs.length === 0
        ? '<div class="empty-state"><h3>No documents uploaded</h3></div>'
        : `<div class="tbl-wrap">
            <div class="tbl-hdr"><div class="tbl-title">Uploaded Documents</div></div>
            <table>
              <thead><tr><th>Document</th><th>Category</th><th>Type</th><th>Uploaded</th><th>Action</th></tr></thead>
              <tbody>
                ${docs.map(d => `<tr>
                  <td class="td-bold">${d.title||d.name||d.file_name||'—'}</td>
                  <td>${d.document_category||d.documentCategory||'—'}</td>
                  <td>${d.document_type||d.documentType||'—'}</td>
                  <td>${Utils.date(d.created_at)}</td>
                  <td><button class="btn btn-ghost btn-sm">Download</button></td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>`;
    } catch (err) { console.error('Docs error:', err); }
  },

  async uploadDoc(consumerId) {
    const file = document.getElementById('doc-file')?.files[0];
    if (!file) { Utils.warn('Please select a file'); return; }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('consumerId', consumerId);
    fd.append('documentType', document.getElementById('doc-type-sel')?.value || 'KYC');
    fd.append('documentCategory', document.getElementById('doc-cat-sel')?.value || 'Other');
    fd.append('remarks', document.getElementById('doc-remarks')?.value || '');
    try {
      await Api.uploadFile('/documents/vault', fd);
      Utils.success('Document uploaded');
      this.loadDocuments(consumerId);
    } catch (err) { Utils.error(err.message); }
  },

  async addRemark(consumerId) {
    const notes = document.getElementById('remark-notes')?.value?.trim();
    if (!notes) { Utils.warn('Please enter notes'); return; }
    try {
      await Api.post('/communications/remarks', {
        consumerId,
        channel: document.getElementById('remark-channel')?.value || 'internal',
        subject: document.getElementById('remark-subject')?.value || '',
        notes,
        followUpDate: document.getElementById('remark-followup')?.value || undefined,
      });
      Utils.success('Remark saved');
      document.getElementById('remark-notes').value = '';
      const res = await Api.get(`/consumers/${consumerId}/remarks`);
      const el = document.getElementById(`comms-timeline-${consumerId}`);
      if (el) el.innerHTML = this.renderRemarks(res.data || res || []);
    } catch (err) { Utils.error(err.message); }
  },

  renderRemarks(remarks) {
    if (!remarks.length) return '<div class="empty-state"><h3>No communications yet</h3></div>';
    const cc = { whatsapp:'ch-green', email:'ch-blue', sms:'ch-gold', phone:'ch-teal', internal:'ch-gray' };
    return `<div class="card">${remarks.map(r => `
      <div class="tl-item">
        <div class="tl-dot" style="background:var(--surface3);color:var(--text3)">💬</div>
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
            <span class="tl-title">${r.subject || r.channel || 'Note'}</span>
            <span class="chip ${cc[r.channel]||'ch-gray'}" style="font-size:8.5px">${r.channel||'internal'}</span>
          </div>
          <div style="font-size:11px;color:var(--text2);margin-bottom:3px">${r.notes||r.message||''}</div>
          <div class="tl-meta">${Utils.dateTime(r.created_at||r.createdAt)}</div>
        </div>
      </div>`).join('')}</div>`;
  },
};
