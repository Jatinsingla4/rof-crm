// ROF CRM — Consumer Detail Page (5 tabs: Overview, Payments, Documents, Communications, History)

Pages.consumerDetail = async function(params = {}) {
  const id = params.id;
  if (!id) { Router.navigate('/consumers'); return; }

  const content = document.getElementById('content');
  content.innerHTML = `<div class="page-loading"><div class="spinner"></div> Loading consumer…</div>`;

  try {
    const [consRes, remarksRes, bookingRes] = await Promise.allSettled([
      Api.get(`/consumers/${id}`),
      Api.get(`/consumers/${id}/remarks`),
      Api.get(`/booking?consumer_id=${id}`),
    ]);

    const c = consRes.status === 'fulfilled' ? (consRes.value.data || consRes.value) : {};
    const remarks = remarksRes.status === 'fulfilled' ? (remarksRes.value.data || remarksRes.value || []) : [];
    const bookings = bookingRes.status === 'fulfilled' ? (bookingRes.value.data || []) : [];
    const latestBooking = Array.isArray(bookings) ? bookings[0] : null;
    const bookingPlcAmount = parseFloat(latestBooking?.plc_amount || 0);

    const initials = (((c.first_name || c.name || '?')[0]) + ((c.last_name || '')[0] || '')).toUpperCase();
    const fullName = c.first_name ? `${c.first_name} ${c.last_name || ''}`.trim() : (c.name || 'Unknown');

    content.innerHTML = `
      <style>
        #content:has(.cdn) { margin-left:auto; margin-right:auto; width:100% }
        .cdn { max-width:1400px; margin:0 auto; --bg2:var(--surface2) }
        .cdn .tabs-line { display:flex; gap:8px; flex-wrap:wrap; border-bottom:none; margin-bottom:16px }
        .cdn .tab-line { padding:7px 16px; font-size:12.5px; border:1px solid var(--border2); border-radius:999px; background:var(--surface); color:var(--text2); cursor:pointer; transition:.15s }
        .cdn .tab-line:hover { border-color:var(--teal); color:var(--teal) }
        .cdn .tab-line.active { background:var(--teal); color:#fff; border-color:var(--teal); font-weight:600 }
        .cdn .card { background:var(--surface); border:1px solid var(--border2); border-radius:12px; padding:18px }
        .cdn .card-hdr { margin:-18px -18px 16px; padding:13px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border); border-radius:12px 12px 0 0 }
        .cdn .card-title { font-size:12px; letter-spacing:.6px }
        .cdn .stat-line { padding:9px 0 }
        .cdn .sl-l { font-size:12px }
        .cdn .sl-v { font-size:12.5px; font-weight:600 }
        .cdn .sp { background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:hidden }
        .cdn .sp-hdr { padding:14px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border) }
        .cdn .sp-title { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
        .cdn .sp-body { padding:18px }
        .cdn .fg { gap:6px }
        .cdn .fl { font-size:11px; font-weight:500; text-transform:none; letter-spacing:.3px; color:var(--text2) }
        .cdn .fc { padding:9px 12px; font-size:13px; border-radius:8px; min-height:38px }
        .cdn .fc:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg) }
        .cdn .btn-teal { background:var(--teal); color:#fff; border:none; padding:9px 22px; border-radius:8px; font-size:12.5px; font-weight:600; min-height:38px; cursor:pointer }
        .cdn .btn-teal.btn-sm { min-height:30px; padding:5px 14px; font-size:12px; border-radius:6px }
        .cdn .btn-teal:hover { filter:brightness(.92) }
        .cdn .btn-ghost.btn-sm { min-height:30px; padding:5px 12px; font-size:12px; border-radius:6px }
        .cdn .tbl-wrap { background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:hidden }
        .cdn .tbl-hdr { padding:12px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border); flex-wrap:wrap }
        .cdn .tbl-title { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
        .cdn .tbl-actions { margin-left:auto; display:flex; gap:8px }
        .cdn table { width:100%; border-collapse:collapse; font-size:12.5px }
        .cdn table th { background:var(--surface2); color:var(--text3); font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; padding:10px 14px; text-align:left; white-space:nowrap; border-bottom:1px solid var(--border2) }
        .cdn table td { padding:9px 14px; border-bottom:1px solid var(--border); color:var(--text) }
        .cdn table tbody tr:hover td { background:var(--surface2) }
        .cdn .empty-state { padding:36px 18px; text-align:center; color:var(--text3) }
        .cdn .empty-state h3 { font-size:14px; font-weight:600; color:var(--text2); margin:0 0 4px }
        .cdn .tl-item { padding:10px 0 }
        .cdn-av { width:52px; height:52px; border-radius:50%; background:var(--teal-bg); color:var(--teal); border:1px solid var(--teal); display:flex; align-items:center; justify-content:center; font-size:17px; font-weight:700; flex-shrink:0 }
      </style>
      <div class="cdn">
      <div class="page-hdr">
        <h1>${fullName}</h1>
        <div class="breadcrumb">Consumers / <b>${(c.registration_no || c.id) + ' — ' + fullName}</b></div>
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
              <div class="cdn-av">${initials}</div>
              <div style="flex:1">
                <div style="font-size:15px;font-weight:700;color:var(--text)"><a href="/api/consumers/${c.id}/applicant-file?token=1" target="_blank" style="color:var(--teal);text-decoration:none;font-weight:700;cursor:pointer" title="View Applicant File">${fullName}</a></div>
                <div style="font-size:10px;color:var(--text3)">${c.registration_no || c.id || ''} · ${c.project_name || c.projectName || '—'}</div>
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
            <div class="stat-line"><span class="sl-l">Unit</span><span class="sl-v" style="color:var(--teal);font-weight:600">${c.unit_number || c.unit_no || c.unitNo || 'TBD'}</span></div>
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
                  <input id="base-rate-input" type="number" value="${c.basic_price || 0}" class="fc" style="width:100px;padding:4px;font-size:11px;text-align:right" data-plc="${bookingPlcAmount}" oninput="ConsumerDetailPage.recalcPricing(${c.carpet_area_sqft || 0})">
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                  <span style="color:var(--text3)">Basic Cost</span>
                  <span id="basic-cost-val" style="font-weight:600">₹0</span>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                  <span style="color:var(--text3)">PLC (Preferential Location)</span>
                  <span id="plc-val" style="font-weight:600">₹0</span>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                  <span style="color:var(--text3)">Balcony, add-ons and discount (net)</span>
                  <span id="other-val" style="font-weight:600">—</span>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid var(--border2)">
                  <span id="gst-label" style="color:var(--text3)">CGST + SGST</span>
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
          <div class="card-hdr"><div class="card-title">Payment Schedule</div></div>
          <div id="schedule-grid-${id}"><div class="page-loading"><div class="spinner"></div></div></div>
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
                  <option value="other">Internal Note</option><option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option><option value="sms">SMS</option><option value="call">Phone Call</option><option value="meeting">Meeting</option><option value="site_visit">Site Visit</option>
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
    const plc = parseFloat(baseInput.dataset.plc || 0);
    const cgst = (basic + plc) * 0.005;
    const sgst = (basic + plc) * 0.005;
    const total = basic + plc;

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

  async loadPaymentData(id) {
    try {
      const [receiptRes, demandRes] = await Promise.allSettled([
        Api.get(`/payments/receipts`, { params: { consumerId: id, pageSize: 50 } }),
        Api.get(`/payments/demands`, { params: { consumerId: id, pageSize: 50 } }),
      ]);

      const receipts = receiptRes.status === 'fulfilled' ? (receiptRes.value.data || receiptRes.value || []) : [];
      const demands = demandRes.status === 'fulfilled' ? (demandRes.value.data || demandRes.value || []) : [];

      const amt = r => parseFloat(r.amount_received_inr || 0);
      const cleared = receipts.filter(r => r.status === 'cleared');
      const totalPaid = cleared.reduce((s, r) => s + amt(r), 0);
      // what the plan asks for in all: every installment with its GST and add-on charges
      const totalAmount = demands.reduce((s, d) => s + ['amount_due_inr', 'cgst_amount', 'sgst_amount', 'addon_charge_amount', 'addon_cgst_amount', 'addon_sgst_amount'].reduce((t, k) => t + parseFloat(d[k] || 0), 0), 0);
      const balance = Math.max(0, totalAmount - totalPaid);
      // the pricing card shows the same total as this summary: what the instalments ask for, with the GST as billed, the balcony and add-ons in and the discount out
      { const gstBilled = demands.reduce((s, d) => s + ['cgst_amount', 'sgst_amount', 'addon_cgst_amount', 'addon_sgst_amount'].reduce((t, k) => t + (parseFloat(d[k]) || 0), 0), 0);
        const baseOf = (k) => parseFloat(document.getElementById(k)?.dataset?.v || 0);
        const g = document.getElementById('gst-val'), tc = document.getElementById('total-cons-val'), gl = document.getElementById('gst-label'), ov = document.getElementById('other-val');
        if (g && totalAmount > 0) { g.textContent = Utils.currency(gstBilled); if (gl) gl.textContent = 'GST (CGST + SGST, as billed on the instalments)'; }
        if (tc && totalAmount > 0) tc.textContent = Utils.currency(totalAmount);
        const basicNow = parseFloat((document.getElementById('basic-cost-val')?.textContent || '0').replace(/[^0-9.]/g, '')) || 0, plcNow = parseFloat((document.getElementById('plc-val')?.textContent || '0').replace(/[^0-9.]/g, '')) || 0;
        if (ov && totalAmount > 0) { const net = totalAmount - gstBilled - basicNow - plcNow; ov.textContent = (net < 0 ? '− ' : '') + Utils.currency(Math.abs(net)); } }
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
          ${pct.toFixed(1)}% collected · ${cleared.length} receipt(s) cleared
        </div>
        <table style="width:100%;font-size:10.5px">
          <thead><tr><th>Receipt No.</th><th>Amount</th><th>Mode</th><th>Date</th><th>Status</th></tr></thead>
          <tbody>
            ${receipts.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:16px">No receipts recorded</td></tr>'
              : receipts.slice(0,5).map(r => `
                <tr>
                  <td class="td-mono">${r.receipt_number || r.receiptNumber || '—'}</td>
                  <td style="font-weight:600;color:var(--green)">${Utils.currency(amt(r))}</td>
                  <td>${r.payment_method || '—'}</td>
                  <td>${Utils.date(r.received_date || r.created_at)}</td>
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
                  <td style="color:var(--green);font-weight:600">${Utils.currency(amt(r))}</td>
                  <td>${r.payment_method || '—'}</td>
                  <td class="td-mono">${r.transaction_ref || '—'}</td>
                  <td>${Utils.date(r.received_date || r.created_at)}</td>
                  <td>${Utils.chip(r.status || r.approval_status || 'pending')}</td>
                  <td><button class="btn btn-ghost btn-sm" onclick="ReceiptsPage.printReceipt('${r.id}')">Print</button></td>
                </tr>`).join('')}
          </tbody>
        </table>`;

      // paid per installment is its share of the cleared receipts: an overpayment runs into the next installment
      const rows = demands.map(d => {
        const principal = parseFloat(d.amount_due_inr || 0);
        const total = ['amount_due_inr', 'cgst_amount', 'sgst_amount', 'addon_charge_amount', 'addon_cgst_amount', 'addon_sgst_amount'].reduce((t, k) => t + parseFloat(d[k] || 0), 0);
        const paid = Math.min(parseFloat(d.installment_paid ?? d.total_paid ?? 0), total);
        const balance = Math.max(0, total - paid);
        const state = total > 0 && balance < 0.005 ? ['Paid', 'ch-green'] : paid > 0 ? ['Part paid', 'ch-warn'] : d.status === 'demanded' ? ['Raised', 'ch-blue'] : ['Not raised', 'ch-gray'];
        return { d, principal, total, paid, balance, state };
      });

      const dTbl = document.getElementById(`demands-tbl-${id}`);
      if (dTbl) dTbl.innerHTML = `
        <table>
          <thead><tr><th>Installment</th><th>Principal</th><th>Total with GST</th><th>Paid</th><th>Balance</th><th>Due Date</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            ${rows.length === 0 ? '<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:20px">No demands raised</td></tr>'
              : rows.map(({ d, principal, total, paid, balance, state }) => `<tr>
                    <td>${Utils.esc(d.installment_name || '—')}</td>
                    <td style="font-weight:600">${Utils.currency(principal)}</td>
                    <td style="font-weight:700">${Utils.currency(total)}</td>
                    <td style="color:var(--green)">${Utils.currency(paid)}</td>
                    <td style="font-weight:600">${Utils.currency(balance)}</td>
                    <td style="color:var(--warn)">${['demanded', 'partial', 'paid'].includes(d.status) ? Utils.date(d.due_date) : '—'}</td>
                    <td><span class="chip ${state[1]}">${state[0]}</span></td>
                    <td><button class="btn btn-ghost btn-sm" onclick="DemandsPage.printDemandLetter('${id}','${d.id}',this,'${d.due_date || ''}')">Print</button></td>
                  </tr>`).join('')}
          </tbody>
        </table>`;

      const sGrid = document.getElementById(`schedule-grid-${id}`);
      if (sGrid) sGrid.innerHTML = rows.length === 0 ? '<div class="empty-state">No payment plan on this booking yet</div>' : `
        <table style="width:100%;font-size:12px">
          <thead><tr><th>S.No</th><th>Installment</th><th>Due Date</th><th>Total with GST</th><th>Paid</th><th>Balance</th></tr></thead>
          <tbody>${rows.map(({ d, total, paid, balance }, i) => `<tr>
            <td>${i + 1}</td><td>${Utils.esc(d.installment_name || '—')}</td>
            <td>${['demanded', 'partial', 'paid'].includes(d.status) ? Utils.date(d.due_date) : 'Not raised'}</td>
            <td style="font-weight:600">${Utils.currency(total)}</td><td style="color:var(--green)">${Utils.currency(paid)}</td><td>${Utils.currency(balance)}</td></tr>`).join('')}
          </tbody>
          <tfoot><tr style="font-weight:700"><td colspan="3">Total</td><td>${Utils.currency(rows.reduce((t, r) => t + r.total, 0))}</td><td>${Utils.currency(rows.reduce((t, r) => t + r.paid, 0))}</td><td>${Utils.currency(rows.reduce((t, r) => t + r.balance, 0))}</td></tr></tfoot>
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
        <p style="color:var(--text3);font-size:13px;margin-bottom:16px;">Document Compliance Verification Grid</p>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:var(--surface2);border-bottom:2px solid var(--border2);">
              <th style="width:50px;padding:12px 16px;text-align:center;font-size:12px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;">VERIFIED</th>
              <th style="padding:12px 16px;text-align:left;font-size:12px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;">DOCUMENT TYPE</th>
              <th style="padding:12px 16px;text-align:left;font-size:12px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;">DOCUMENT NUMBER</th>
            </tr>
          </thead>
          <tbody id="kyc-checklist-body">
            ${kycItems.map(item => {
              const uploaded = docs.some(d => (d.title||d.name||d.document_category||'').toLowerCase().includes(item.split(' ')[0].toLowerCase()));
              let isPopulated = false;
              let docNumber = '';
              if (item === 'Aadhaar Card' && consumer.aadhaar_no) { isPopulated = true; docNumber = consumer.aadhaar_no; }
              if (item === 'PAN Card' && consumer.pan_no) { isPopulated = true; docNumber = consumer.pan_no; }
              const isVerified = uploaded || isPopulated;
              return `<tr style="border-bottom:1px solid var(--border);transition:background 0.15s;" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
                <td style="padding:14px 16px;text-align:center;">
                  <input type="checkbox" data-doc-type="${item}" ${isVerified ? 'checked' : ''} aria-readonly="true" onclick="return false" style="width:18px;height:18px;cursor:default;accent-color:var(--teal);">
                </td>
                <td style="padding:14px 16px;">
                  <span style="font-weight:${isVerified?'600':'400'};color:${isVerified?'var(--teal)':'var(--text)'};font-size:14px;">${item}</span>
                </td>
                <td style="padding:14px 16px;">
                  <span style="font-size:14px;color:${docNumber?'var(--text)':'var(--text3)'};font-family:${docNumber?'monospace':'inherit'};">${docNumber || '—'}</span>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>`;

      const el = document.getElementById(`docs-vault-${id}`);
      if (el) el.innerHTML = docs.length === 0
        ? '<div class="empty-state"><h3>No documents uploaded</h3></div>'
        : `<div class="tbl-wrap">
            <div class="tbl-hdr"><div class="tbl-title">Uploaded Documents</div></div>
            <table>
              <thead><tr><th>Document</th><th>Category</th><th>Type</th><th>Uploaded</th><th>Action</th></tr></thead>
              <tbody>
                ${docs.map(d => `<tr>
                  <td class="td-bold">${Utils.esc(d.title||d.name||d.file_name||'—')}</td>
                  <td>${Utils.esc(d.document_category||d.documentCategory||'—')}</td>
                  <td>${Utils.esc(d.document_type||d.documentType||'—')}</td>
                  <td>${Utils.date(d.created_at)}</td>
                  <td><button class="btn btn-ghost btn-sm" data-id="${Utils.esc(d.id)}" data-has-file="${d.has_file ? 'true' : 'false'}" data-url="${Utils.esc(d.file_url || '')}" onclick="openStored(this)">Download</button></td>
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
        channel: document.getElementById('remark-channel')?.value || 'other',
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
