// ROF CRM — Surrender / Cancellation Page

Pages.surrender = async function(params = {}) {
  const tab = params.tab || 'initiate';
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="page-hdr">
      <h1>Surrender / Cancellation</h1>
      <div class="breadcrumb">Application / <b>Surrender</b></div>
    </div>
    <div class="tabs-line">
      <button class="tab-line${tab==='initiate'?' active':''}" data-group="surr" data-tab="initiate"
        onclick="switchTab('surr','initiate')">Surrender Applicant</button>
      <button class="tab-line${tab==='report'?' active':''}" data-group="surr" data-tab="report"
        onclick="switchTab('surr','report');SurrenderPage.loadReport()">Surrender Report</button>
    </div>

    <!-- INITIATE TAB -->
    <div data-panel-group="surr" data-panel="initiate"${tab!=='initiate'?' style="display:none"':''}>
      <div class="alert alert-warn" style="margin-bottom:12px">
        ⚠ Surrender is <strong>irreversible</strong>. A forfeiture of <strong>₹29,500</strong>
        (₹25,000 base + 18% GST) will be deducted from the amount paid. The unit will be released
        back to available inventory and the waitlist will be cascaded automatically.
      </div>
      <div class="sp">
        <div class="sp-hdr"><div class="sp-title">Surrender Request</div></div>
        <div class="sp-body">
          <div class="sp-grid" style="grid-template-columns:1fr 1fr">
            <div class="fg">
              <label class="fl"><span class="r">*</span>Allotted Consumer</label>
              <select class="fc" id="surr-consumer" onchange="SurrenderPage.loadConsumerInfo(this.value)">
                <option value="">— Select Consumer —</option>
              </select>
            </div>
            <div class="fg">
              <label class="fl"><span class="r">*</span>Reason for Surrender</label>
              <select class="fc" id="surr-reason">
                <option value="voluntary_surrender">Voluntary Surrender</option>
                <option value="non_payment">Non-Payment of Instalments</option>
                <option value="document_discrepancy">Document Discrepancy</option>
                <option value="death_of_applicant">Death of Applicant</option>
                <option value="financial_constraints">Financial Constraints</option>
                <option value="legal_dispute">Legal / Court Order</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div class="fg" style="grid-column:span 2">
              <label class="fl">Additional Remarks</label>
              <textarea class="fc" id="surr-remarks" rows="2" placeholder="Enter any additional remarks…"></textarea>
            </div>
          </div>

          <!-- Consumer summary card -->
          <div id="surr-consumer-info" style="margin-top:12px"></div>

          <!-- Forfeiture calculation card -->
          <div id="surr-calc" style="display:none;margin-top:12px">
            <div class="sp" style="background:rgba(220,53,69,.07);border:1px solid rgba(220,53,69,.3)">
              <div class="sp-hdr"><div class="sp-title" style="color:var(--red)">Forfeiture Calculation</div></div>
              <div class="sp-body">
                <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;font-size:11px">
                  <div>
                    <div style="color:var(--text3);margin-bottom:2px">Total Amount Paid</div>
                    <div id="surr-total-paid" style="font-weight:700;font-size:13px"></div>
                  </div>
                  <div>
                    <div style="color:var(--text3);margin-bottom:2px">Forfeiture Base</div>
                    <div style="font-weight:600;color:var(--red)">₹25,000</div>
                  </div>
                  <div>
                    <div style="color:var(--text3);margin-bottom:2px">GST on Forfeiture (18%)</div>
                    <div style="font-weight:600;color:var(--red)">₹4,500</div>
                  </div>
                  <div>
                    <div style="color:var(--text3);margin-bottom:2px">Total Forfeiture</div>
                    <div style="font-weight:700;color:var(--red);font-size:13px">₹29,500</div>
                  </div>
                  <div>
                    <div style="color:var(--text3);margin-bottom:2px">Net Refundable Amount</div>
                    <div id="surr-refund-amt" style="font-weight:700;color:var(--green);font-size:13px"></div>
                  </div>
                </div>
                <div style="margin-top:10px;padding:8px;background:var(--bg1);border-radius:6px;font-size:11px;color:var(--text3)">
                  Unit will be released → <strong>Available</strong> &nbsp;|&nbsp;
                  Waitlist cascade will be triggered automatically &nbsp;|&nbsp;
                  Refund to be processed within <strong>30 working days</strong>
                </div>
              </div>
            </div>
          </div>

          <div style="margin-top:14px;display:flex;gap:8px">
            <button class="btn btn-ghost btn-lg" onclick="SurrenderPage.calculateForfeiture()">
              Calculate Refund
            </button>
            <button class="btn btn-danger btn-lg" onclick="SurrenderPage.initiate()">
              Confirm Surrender
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- REPORT TAB -->
    <div data-panel-group="surr" data-panel="report"${tab!=='report'?' style="display:none"':''}>
      <!-- Filters -->
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-body" style="padding:10px 14px">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
            <div class="fg" style="min-width:160px;flex:1">
              <label class="fl">Project</label>
              <select class="fc" id="rpt-project-filter">
                <option value="">All Projects</option>
              </select>
            </div>
            <div class="fg" style="min-width:120px">
              <label class="fl">From Date</label>
              <input type="date" class="fc" id="rpt-from">
            </div>
            <div class="fg" style="min-width:120px">
              <label class="fl">To Date</label>
              <input type="date" class="fc" id="rpt-to">
            </div>
            <div class="fg" style="min-width:130px">
              <label class="fl">Refund Status</label>
              <select class="fc" id="rpt-refund-filter">
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="processed">Processed</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            <button class="btn btn-primary" onclick="SurrenderPage.loadReport()">Fetch</button>
            <button class="btn btn-ghost" onclick="SurrenderPage.exportReport()">Export</button>
          </div>
        </div>
      </div>

      <!-- KPI Cards -->
      <div id="surr-kpis" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px"></div>

      <!-- Table -->
      <div id="surr-report-body"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>
  `;

  await SurrenderPage.init(tab);
};

const SurrenderPage = {
  _consumerData: null,  // { allocationId, totalPaid, consumer }
  _reportData: [],
  _projects: [],

  async init(tab) {
    await SurrenderPage._loadProjects();
    try {
      const res = await Api.get('/consumers', { params: { leadStage: 'allotted', pageSize: 500 } });
      const list = (res.data || res || []);
      const sel = document.getElementById('surr-consumer');
      if (sel) {
        sel.innerHTML = '<option value="">— Select Consumer —</option>' +
          list.map(c => {
            const nm = c.first_name ? `${c.first_name} ${c.last_name||''}`.trim() : (c.name||'—');
            return `<option value="${c.id}">${nm} · ${c.mobile||''}</option>`;
          }).join('');
      }
    } catch {}

    if (tab === 'report') SurrenderPage.loadReport();
  },

  async _loadProjects() {
    try {
      const res = await Api.get('/units/projects');
      this._projects = res.data || res || [];
      ['rpt-project-filter'].forEach(id => {
        const el = document.getElementById(id);
        if (el && this._projects.length) {
          this._projects.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id; opt.textContent = p.name;
            el.appendChild(opt);
          });
        }
      });
    } catch {}
  },

  async loadConsumerInfo(consumerId) {
    const infoEl = document.getElementById('surr-consumer-info');
    const calcEl = document.getElementById('surr-calc');
    if (!infoEl) return;
    this._consumerData = null;
    if (calcEl) calcEl.style.display = 'none';

    if (!consumerId) { infoEl.innerHTML = ''; return; }

    infoEl.innerHTML = '<div class="page-loading" style="padding:20px"><div class="spinner"></div></div>';

    try {
      const [consRes, allocRes, payRes] = await Promise.allSettled([
        Api.get(`/consumers/${consumerId}`),
        Api.get('/allocations', { params: { consumerId, pageSize: 1 } }),
        Api.get('/payments/receipts', { params: { consumerId, pageSize: 500 } }),
      ]);

      const consumer = consRes.status === 'fulfilled'
        ? (consRes.value.data || consRes.value) : {};
      const allocations = allocRes.status === 'fulfilled'
        ? (allocRes.value.data || allocRes.value || []) : [];
      const allocation = Array.isArray(allocations) ? allocations[0] : null;
      const receipts = payRes.status === 'fulfilled'
        ? (payRes.value.data || payRes.value || []) : [];

      const totalPaid = receipts.reduce((s, r) =>
        s + parseFloat(r.amount_received_inr || r.amount || 0), 0);

      this._consumerData = {
        allocationId: allocation?.id || null,
        totalPaid,
        consumer,
      };

      const name = consumer.first_name
        ? `${consumer.first_name} ${consumer.last_name||''}`.trim()
        : (consumer.name || '—');

      infoEl.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;padding:12px;
                    background:var(--bg2);border-radius:8px;font-size:11px">
          <div>
            <div style="color:var(--text3);margin-bottom:2px">Consumer</div>
            <div style="font-weight:600">${name}</div>
          </div>
          <div>
            <div style="color:var(--text3);margin-bottom:2px">Mobile</div>
            <div>${consumer.mobile||'—'}</div>
          </div>
          <div>
            <div style="color:var(--text3);margin-bottom:2px">Allocated Unit</div>
            <div style="font-weight:600">${allocation?.unit_number || consumer.unit_number || '—'}</div>
          </div>
          <div>
            <div style="color:var(--text3);margin-bottom:2px">Project</div>
            <div>${consumer.project_name || allocation?.project_name || '—'}</div>
          </div>
          <div>
            <div style="color:var(--text3);margin-bottom:2px">Total Amount Paid</div>
            <div style="font-weight:700;color:var(--accent)">${Utils.currency(totalPaid)}</div>
          </div>
        </div>
        ${!allocation ? '<div style="color:var(--red);font-size:11px;margin-top:6px">⚠ No active allocation found for this consumer.</div>' : ''}
      `;
    } catch (err) {
      infoEl.innerHTML = `<div style="color:var(--red);padding:8px">${err.message}</div>`;
    }
  },

  calculateForfeiture() {
    if (!this._consumerData) {
      Utils.warn('Please select a consumer first');
      return;
    }
    const totalPaid = this._consumerData.totalPaid;
    const forfeiture = 29500;
    const refundable = Math.max(0, totalPaid - forfeiture);

    const calcEl = document.getElementById('surr-calc');
    if (calcEl) calcEl.style.display = 'block';
    const tpEl = document.getElementById('surr-total-paid');
    const raEl = document.getElementById('surr-refund-amt');
    if (tpEl) tpEl.textContent = Utils.currency(totalPaid);
    if (raEl) raEl.textContent = Utils.currency(refundable);
  },

  async initiate() {
    if (!this._consumerData) {
      Utils.warn('Please select a consumer first');
      return;
    }
    if (!this._consumerData.allocationId) {
      Utils.warn('No active allocation found for this consumer');
      return;
    }

    this.calculateForfeiture();

    const refundEl = document.getElementById('surr-refund-amt');
    const refundAmt = refundEl?.textContent || '₹0';
    const reason = document.getElementById('surr-reason')?.value;
    const remarks = document.getElementById('surr-remarks')?.value;
    const allocationId = this._consumerData.allocationId;
    const consumer = this._consumerData.consumer;
    const name = consumer.first_name
      ? `${consumer.first_name} ${consumer.last_name||''}`.trim()
      : (consumer.name || '—');

    Utils.confirm(
      `Confirm surrender for ${name}?\n\nForfeiture: ₹29,500 will be deducted.\nNet Refund: ${refundAmt}\n\nThis action is IRREVERSIBLE.`,
      async () => {
        try {
          await Api.post(`/allocations/${allocationId}/cancel`, { reason, remarks });
          Utils.success('Surrender processed successfully. Unit released to inventory. Refund will be initiated within 30 working days.');
          // Reset form
          const sel = document.getElementById('surr-consumer');
          if (sel) sel.value = '';
          document.getElementById('surr-consumer-info').innerHTML = '';
          const calcEl = document.getElementById('surr-calc');
          if (calcEl) calcEl.style.display = 'none';
          this._consumerData = null;
          // Refresh consumer list
          await this.init('initiate');
        } catch (err) {
          Utils.error('Surrender failed: ' + err.message);
        }
      }
    );
  },

  async loadReport() {
    const el = document.getElementById('surr-report-body');
    const kpiEl = document.getElementById('surr-kpis');
    if (!el) return;
    el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

    const projectId = document.getElementById('rpt-project-filter')?.value || '';
    const from = document.getElementById('rpt-from')?.value || '';
    const to = document.getElementById('rpt-to')?.value || '';
    const refundStatus = document.getElementById('rpt-refund-filter')?.value || '';

    try {
      const params = { status: 'cancelled', pageSize: 200 };
      if (projectId) params.projectId = projectId;

      const res = await Api.get('/allocations', { params });
      let list = res.data || res || [];

      // Client-side date filter
      if (from) list = list.filter(a => (a.cancelled_at||a.updated_at||'') >= from);
      if (to)   list = list.filter(a => (a.cancelled_at||a.updated_at||'') <= to + 'T23:59:59');

      this._reportData = list;

      // KPIs
      const totalCount = list.length;
      const totalForfeited = totalCount * 29500;
      const totalRefundPending = list.filter(a =>
        !a.refund_status || a.refund_status === 'pending').length;
      const totalRefundAmt = list.reduce((s,a) =>
        s + parseFloat(a.refund_amount || a.refund_amount_inr || 0), 0);

      if (kpiEl) {
        kpiEl.innerHTML = [
          { label: 'Total Surrenders', value: totalCount, color: 'var(--text1)' },
          { label: 'Total Forfeiture Collected', value: Utils.currency(totalForfeited), color: 'var(--red)' },
          { label: 'Refunds Pending', value: totalRefundPending, color: 'var(--amber)' },
          { label: 'Total Refund Amount', value: Utils.currency(totalRefundAmt), color: 'var(--green)' },
        ].map(k => `
          <div class="kpi-card">
            <div class="kpi-label">${k.label}</div>
            <div class="kpi-value" style="color:${k.color}">${k.value}</div>
          </div>
        `).join('');
      }

      if (list.length === 0) {
        el.innerHTML = '<div class="empty-state"><h3>No surrender records found</h3><p>Adjust filters and try again</p></div>';
        return;
      }

      el.innerHTML = `
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Consumer</th>
              <th>Mobile</th>
              <th>Unit</th>
              <th>Reason</th>
              <th>Total Paid</th>
              <th>Forfeiture</th>
              <th>Refund Amount</th>
              <th>Surrender Date</th>
              <th>Refund Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${list.map((a, i) => {
              const totalPaid = parseFloat(a.total_paid || 0);
              const forfeiture = 29500;
              const refundAmt = Math.max(0, (totalPaid || 0) - forfeiture);
              const rStatus = a.refund_status || 'pending';
              return `<tr>
                <td style="color:var(--text3)">${i+1}</td>
                <td class="td-bold">${a.consumer_name||'—'}</td>
                <td>${a.mobile||'—'}</td>
                <td>${a.unit_number||'—'}</td>
                <td style="font-size:10.5px">${(a.cancellation_reason||a.reason||'—').replace(/_/g,' ')}</td>
                <td>${totalPaid ? Utils.currency(totalPaid) : '—'}</td>
                <td style="color:var(--red);font-weight:600">${Utils.currency(forfeiture)}</td>
                <td style="color:var(--green);font-weight:600">${Utils.currency(refundAmt)}</td>
                <td style="font-size:10.5px">${Utils.date(a.cancelled_at||a.updated_at)}</td>
                <td>${Utils.chip(rStatus)}</td>
                <td>
                  ${rStatus === 'pending' ? `<button class="btn btn-ghost btn-sm" onclick="SurrenderPage.markRefundPaid('${a.id}',this)">Mark Refunded</button>` : ''}
                  <button class="btn btn-ghost btn-sm" onclick="Router.navigate('/consumer',{id:'${a.consumer_id}'})">View</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
          <tfoot class="tfoot-total">
            <tr>
              <td colspan="5"><strong>TOTAL</strong></td>
              <td><strong>—</strong></td>
              <td style="color:var(--red)"><strong>${Utils.currency(totalForfeited)}</strong></td>
              <td style="color:var(--green)"><strong>${Utils.currency(totalRefundAmt)}</strong></td>
              <td colspan="3"></td>
            </tr>
          </tfoot>
        </table>
      `;
    } catch (err) {
      el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`;
    }
  },

  async markRefundPaid(allocationId, btn) {
    Utils.confirm('Mark this refund as paid/processed?', async () => {
      try {
        await Api.patch(`/allocations/${allocationId}`, { refund_status: 'paid' });
        Utils.success('Refund status updated');
        await this.loadReport();
      } catch (err) {
        Utils.error(err.message);
      }
    });
  },

  exportReport() {
    if (!this._reportData || this._reportData.length === 0) {
      Utils.warn('No data to export');
      return;
    }
    const rows = [
      ['Consumer', 'Mobile', 'Unit', 'Reason', 'Total Paid', 'Forfeiture', 'Refund Amt', 'Date', 'Refund Status'],
      ...this._reportData.map(a => [
        a.consumer_name||'—',
        a.mobile||'—',
        a.unit_number||'—',
        (a.cancellation_reason||a.reason||'—').replace(/_/g,' '),
        Math.max(0, parseFloat(a.total_paid||0)),
        29500,
        Math.max(0, parseFloat(a.total_paid||0) - 29500),
        Utils.date(a.cancelled_at||a.updated_at),
        a.refund_status||'pending',
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'surrender_report.csv'; a.click();
    URL.revokeObjectURL(url);
  },
};
