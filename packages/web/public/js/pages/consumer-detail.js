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
    ConsumerDetailPage.loadDocuments(id);

  } catch (err) {
    content.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
  }
};

const ConsumerDetailPage = {
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
          <thead><tr><th>Demand ID</th><th>Amount</th><th>Due Date</th><th>Type</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            ${demands.length === 0 ? '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:20px">No demands raised</td></tr>'
              : demands.map(d => {
                  const sent = d.sent_at || d.sentAt;
                  const dtype = d.demand_type || d.demandType || 'main';
                  const chipCls = dtype.includes('1') ? 'ch-warn' : dtype.includes('2') ? 'ch-red' : 'ch-blue';
                  return `<tr>
                    <td class="td-mono">${(d.id||'').slice(0,8)}</td>
                    <td style="font-weight:600">${Utils.currency(d.amount_due_inr||d.amount||0)}</td>
                    <td style="color:var(--warn)">${Utils.date(d.due_date||d.dueDate)}</td>
                    <td><span class="chip ${chipCls}">${dtype}</span></td>
                    <td><span class="chip ${sent?'ch-green':'ch-gray'}">${sent?'Sent':'Unsent'}</span></td>
                    <td><button class="btn btn-ghost btn-sm" onclick="Utils.info('PDF coming soon')">Print</button></td>
                  </tr>`;}).join('')}
          </tbody>
        </table>`;
    } catch (err) { console.error('Payment data error:', err); }
  },

  async loadDocuments(id) {
    try {
      const res = await Api.get(`/documents/vault/${id}`);
      const docs = res.data || res || [];

      const kycEl = document.getElementById(`kyc-list-${id}`);
      const kycItems = ['Aadhaar Card','PAN Card','Income Certificate','Affidavit','Passport Photo','Bank Statement'];
      if (kycEl) kycEl.innerHTML = `
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${kycItems.map(item => {
            const uploaded = docs.some(d => (d.title||d.name||'').toLowerCase().includes(item.split(' ')[0].toLowerCase()));
            return `<div style="padding:6px 12px;border-radius:6px;font-size:10.5px;font-weight:500;${uploaded?'background:var(--green-bg);color:var(--green)':'background:var(--surface2);color:var(--text3)'}">
              ${uploaded?'✓':'○'} ${item}
            </div>`;
          }).join('')}
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
