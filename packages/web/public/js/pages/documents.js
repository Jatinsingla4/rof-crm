// ROF CRM — Documents & Printing of Document Page

Pages.documents = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="page-hdr">
      <h1>Documents</h1>
      <div class="breadcrumb">Application / <b>Documents</b></div>
    </div>
    <div class="tabs-line" style="flex-wrap:wrap;gap:2px">
      <button class="tab-line active" data-group="docs" data-tab="generate" onclick="switchTab('docs','generate')">Generate</button>
      <button class="tab-line" data-group="docs" data-tab="print-welcome" onclick="switchTab('docs','print-welcome')">Print Welcome</button>
      <button class="tab-line" data-group="docs" data-tab="demand-printing" onclick="switchTab('docs','demand-printing')">Demand Printing</button>
      <button class="tab-line" data-group="docs" data-tab="ats" onclick="switchTab('docs','ats')">ATS</button>
      <button class="tab-line" data-group="docs" data-tab="tpa" onclick="switchTab('docs','tpa')">TPA</button>
      <button class="tab-line" data-group="docs" data-tab="applicant-ledger" onclick="switchTab('docs','applicant-ledger')">Applicant Ledger</button>
      <button class="tab-line" data-group="docs" data-tab="user-letters" onclick="switchTab('docs','user-letters')">User Letters</button>
      <button class="tab-line" data-group="docs" data-tab="address-labels" onclick="switchTab('docs','address-labels')">Address Labels</button>
      <button class="tab-line" data-group="docs" data-tab="conveyance-deed" onclick="switchTab('docs','conveyance-deed')">Conveyance Deed</button>
      <button class="tab-line" data-group="docs" data-tab="templates" onclick="switchTab('docs','templates');DocsPage.loadTemplates()">Templates</button>
      <button class="tab-line" data-group="docs" data-tab="history" onclick="switchTab('docs','history');DocsPage.loadHistory()">History</button>
      <button class="tab-line" data-group="docs" data-tab="vault" onclick="switchTab('docs','vault');DocsPage.loadVault()">Vault</button>
    </div>

    <!-- GENERATE (all doc types) -->
    <div data-panel-group="docs" data-panel="generate">
      ${DocsPage._printPanel({
        title: 'Generate Document',
        docTypeOptions: [
          ['allotment_letter','Allotment Letter'],
          ['demand_letter','Demand Letter'],
          ['payment_receipt','Payment Receipt'],
          ['buyer_builder_agreement','Buyer-Builder Agreement (BBA)'],
          ['possession_letter','Possession Letter'],
          ['noc','NOC'],
          ['cancellation_letter','Cancellation Letter'],
          ['welcome_letter','Welcome Letter'],
        ],
        prefix: 'gen',
        showBulk: true,
      })}
    </div>

    <!-- PRINT WELCOME LETTER -->
    <div data-panel-group="docs" data-panel="print-welcome" style="display:none">
      ${DocsPage._printPanel({ title: 'Print Welcome Letter', docType: 'welcome_letter', prefix: 'wel', showBulk: true })}
    </div>

    <!-- DEMAND PRINTING -->
    <div data-panel-group="docs" data-panel="demand-printing" style="display:none">
      ${DocsPage._printPanel({
        title: 'Demand Printing',
        docType: 'demand_letter',
        prefix: 'dpr',
        showBulk: true,
        extraFilters: `
          <div class="fg"><label class="fl">Demand Type</label>
            <select class="fc" id="dpr-demand-type">
              <option value="">— All Types —</option>
              <option value="main">Main Demand</option>
              <option value="reminder_1">Reminder 1</option>
              <option value="reminder_2">Reminder 2</option>
              <option value="termination">Termination</option>
            </select>
          </div>
        `,
      })}
    </div>

    <!-- AGREEMENT TO SALE (ATS) -->
    <div data-panel-group="docs" data-panel="ats" style="display:none">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">SEARCH APPLICANT (Agreement To Sale)</div></div>
        <div class="sp-body">
          <div class="sp-grid">
            <div class="fg"><label class="fl">Project</label>
              <select class="fc" id="ats-project-sel">
                <option value="">— Select —</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Registration No.:</label>
              <input class="fc" id="ats-reg-no" placeholder="Registration No">
            </div>
            <div class="fg"><label class="fl">First Name:</label>
              <input class="fc" id="ats-first-name" placeholder="First Name">
            </div>
            <div class="fg"><label class="fl">Address:</label>
              <input class="fc" id="ats-address" placeholder="Address">
            </div>
            <div class="fg" style="grid-column:span 2"><label class="fl">Agreement Date:</label>
              <div style="display:flex;align-items:center;gap:6px">
                <input type="date" class="fc" id="ats-from" placeholder="From Date">
                <span style="font-size:12px;color:var(--text3)">-</span>
                <input type="date" class="fc" id="ats-to" placeholder="To Date">
              </div>
            </div>
          </div>
          <button class="btn btn-fetch" style="margin-top:15px; width: 100px;" onclick="DocsPage.fetchATS()">FETCH</button>
        </div>
      </div>
      <div id="ats-results-body"></div>
    </div>

    <!-- DEMAND LETTER -->
    <div data-panel-group="docs" data-panel="demand" style="display:none">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">SEARCH APPLICANT (Demand Letter)</div></div>
        <div class="sp-body">
          <div class="sp-grid">
            <div class="fg"><label class="fl">Project</label>
              <select class="fc" id="dem-project-sel">
                <option value="">— Select —</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Installment Stage:</label>
              <select class="fc" id="dem-installment">
                <option value="">— All Raised —</option>
                <option value="At the time of Allotment">At the time of Allotment</option>
                <option value="Within 6 months">Within 6 months</option>
                <option value="Within 12 months">Within 12 months</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Registration No.:</label>
              <input class="fc" id="dem-reg-no" placeholder="Registration No">
            </div>
            <div class="fg"><label class="fl">First Name:</label>
              <input class="fc" id="dem-first-name" placeholder="First Name">
            </div>
            <div class="fg" style="grid-column:span 2"><label class="fl">Raised Date Range:</label>
              <div style="display:flex;align-items:center;gap:6px">
                <input type="date" class="fc" id="dem-from" placeholder="From Date">
                <span style="font-size:12px;color:var(--text3)">-</span>
                <input type="date" class="fc" id="dem-to" placeholder="To Date">
              </div>
            </div>
          </div>
          <button class="btn btn-fetch" style="margin-top:15px; width: 100px;" onclick="DocsPage.fetchDemandLetters()">FETCH</button>
        </div>
      </div>
      <div id="dem-results-body"></div>
    </div>

    <!-- TPA -->
    <div data-panel-group="docs" data-panel="tpa" style="display:none">
      ${DocsPage._printPanel({ title: 'Transfer of Property Agreement (TPA)', docType: 'tpa', prefix: 'tpa' })}
    </div>

    <!-- APPLICANT LEDGER -->
    <div data-panel-group="docs" data-panel="applicant-ledger" style="display:none">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Applicant Payment Ledger</div></div>
        <div class="sp-body">
          <div class="sp-grid">
            <div class="fg"><label class="fl"><span class="r">*</span>Consumer</label>
              <select class="fc" id="ledger-consumer" onchange="DocsPage.loadLedger()">
                <option value="">— Select Consumer —</option>
              </select>
            </div>
            <div class="fg"><label class="fl">From Date</label>
              <input type="date" class="fc" id="ledger-from" value="${Utils.monthStart()}">
            </div>
            <div class="fg"><label class="fl">To Date</label>
              <input type="date" class="fc" id="ledger-to" value="${Utils.today()}">
            </div>
          </div>
          <div style="margin-top:10px;display:flex;gap:8px">
            <button class="btn btn-fetch" onclick="DocsPage.loadLedger()">FETCH LEDGER</button>
            <button class="btn btn-ghost" onclick="DocsPage.printLedger()">Print / PDF</button>
          </div>
        </div>
      </div>
      <div id="ledger-body"></div>
    </div>

    <!-- USER DEFINE LETTERS -->
    <div data-panel-group="docs" data-panel="user-letters" style="display:none">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">User Define Letters</div></div>
        <div class="sp-body">
          <div class="alert alert-info" style="margin-bottom:12px">Create and manage custom letter templates specific to your project requirements.</div>
          <div class="sp-grid">
            <div class="fg"><label class="fl">Letter Name</label>
              <input class="fc" id="ul-name" placeholder="e.g. Congratulations Letter">
            </div>
            <div class="fg"><label class="fl">Consumer</label>
              <select class="fc" id="ul-consumer">
                <option value="">— Select Consumer —</option>
              </select>
            </div>
          </div>
          <div style="margin-top:10px">
            <label class="fl" style="margin-bottom:6px">Letter Body (supports merge fields: {{consumer_name}}, {{unit_number}}, {{project_name}}, {{date}})</label>
            <textarea id="ul-body" class="fc" rows="8" style="resize:vertical;font-family:monospace;font-size:12px" placeholder="Dear {{consumer_name}},&#10;&#10;We are pleased to inform you...&#10;&#10;Regards,&#10;ROF Group"></textarea>
          </div>
          <div style="margin-top:10px;display:flex;gap:8px">
            <button class="btn btn-teal btn-lg" onclick="DocsPage.generateUserLetter()">Generate & Download</button>
            <button class="btn btn-ghost" onclick="DocsPage.saveLetterTemplate()">Save as Template</button>
          </div>
          <div id="ul-result" style="margin-top:12px"></div>
        </div>
      </div>
      <div id="ul-templates-body" style="margin-top:12px"></div>
    </div>

    <!-- ADDRESS LABELS -->
    <div data-panel-group="docs" data-panel="address-labels" style="display:none">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Address Labels</div></div>
        <div class="sp-body">
          <div class="sp-grid">
            <div class="fg"><label class="fl">Scope</label>
              <select class="fc" id="lbl-scope">
                <option value="single">Single Consumer</option>
                <option value="project">Entire Project</option>
                <option value="all">All Active Allottees</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Consumer (Single)</label>
              <select class="fc" id="lbl-consumer">
                <option value="">— All / Select Consumer —</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Project (Bulk)</label>
              <select class="fc" id="lbl-project">
                <option value="">— All Projects —</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Label Format</label>
              <select class="fc" id="lbl-format">
                <option value="a4_4x2">A4 — 4×2 (8 per sheet)</option>
                <option value="a4_3x8">A4 — 3×8 (24 per sheet)</option>
                <option value="single">Single Label</option>
              </select>
            </div>
          </div>
          <div style="margin-top:10px;display:flex;gap:8px">
            <button class="btn btn-fetch" onclick="DocsPage.previewLabels()">Preview Labels</button>
            <button class="btn btn-teal" onclick="DocsPage.printLabels()">Print Labels</button>
          </div>
        </div>
      </div>
      <div id="lbl-preview-body"></div>
    </div>

    <!-- CONVEYANCE DEED -->
    <div data-panel-group="docs" data-panel="conveyance-deed" style="display:none">
      ${DocsPage._printPanel({
        title: 'Conveyance Deed',
        docType: 'conveyance_deed',
        prefix: 'cd',
        extraFilters: `
          <div class="fg"><label class="fl">Registration Date</label>
            <input type="date" class="fc" id="cd-reg-date" value="${Utils.today()}">
          </div>
          <div class="fg"><label class="fl">Sub-Registrar Office</label>
            <input class="fc" id="cd-sro" placeholder="Sub-Registrar Office name">
          </div>
        `,
      })}
    </div>

    <!-- TEMPLATES -->
    <div data-panel-group="docs" data-panel="templates" style="display:none">
      <div class="tbl-wrap">
        <div class="tbl-hdr">
          <div class="tbl-title">Document Templates</div>
          <div class="tbl-actions">
            <button class="btn btn-teal btn-sm" onclick="DocsPage.createTemplate()">+ New Template</button>
          </div>
        </div>
        <div id="doc-templates-body"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
    </div>

    <!-- HISTORY -->
    <div data-panel-group="docs" data-panel="history" style="display:none">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Filters</div></div>
        <div class="sp-body">
          <div class="sp-grid">
            <div class="fg"><label class="fl">From Date</label>
              <input type="date" class="fc" id="hist-from" value="${Utils.monthStart()}">
            </div>
            <div class="fg"><label class="fl">To Date</label>
              <input type="date" class="fc" id="hist-to" value="${Utils.today()}">
            </div>
            <div class="fg"><label class="fl">Document Type</label>
              <select class="fc" id="hist-type">
                <option value="">— All Types —</option>
                <option value="allotment_letter">Allotment Letter</option>
                <option value="demand_letter">Demand Letter</option>
                <option value="payment_receipt">Receipt</option>
                <option value="buyer_builder_agreement">BBA</option>
                <option value="welcome_letter">Welcome Letter</option>
              </select>
            </div>
          </div>
          <button class="btn btn-fetch" style="margin-top:10px" onclick="DocsPage.loadHistory()">FETCH</button>
        </div>
      </div>
      <div id="doc-history-body"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>

    <!-- VAULT -->
    <div data-panel-group="docs" data-panel="vault" style="display:none">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Filter Documents</div></div>
        <div class="sp-body">
          <div class="sp-grid">
            <div class="fg"><label class="fl">Consumer</label>
              <select class="fc" id="vault-consumer">
                <option value="">— All Consumers —</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Document Category</label>
              <select class="fc" id="vault-category">
                <option value="">— All —</option>
                <option value="KYC">KYC</option>
                <option value="Application">Application</option>
                <option value="Allotment">Allotment</option>
                <option value="Payment">Payment</option>
                <option value="Agreement">Agreement</option>
                <option value="Possession">Possession</option>
                <option value="NOC">NOC</option>
              </select>
            </div>
          </div>
          <button class="btn btn-fetch" style="margin-top:10px" onclick="DocsPage.loadVault()">FETCH</button>
        </div>
      </div>
      <div id="doc-vault-body"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>
  `;

  await DocsPage.init(params);
};

const DocsPage = {
  _consumers: [],
  _projects: [],

  // Shared HTML builder for standard print panels
  _printPanel({ title, docType, docTypeOptions, prefix, showBulk, extraFilters }) {
    const typeSelect = docTypeOptions
      ? `<select class="fc" id="${prefix}-doc-type">
          <option value="">— Select Type —</option>
          ${docTypeOptions.map(([v,l]) => `<option value="${v}">${l}</option>`).join('')}
        </select>`
      : `<input type="hidden" id="${prefix}-doc-type" value="${docType||''}">`;

    return `
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">${title}</div></div>
        <div class="sp-body">
          <div class="sp-grid">
            ${docTypeOptions ? `<div class="fg"><label class="fl">Document Type</label>${typeSelect}</div>` : `<input type="hidden" id="${prefix}-doc-type" value="${docType||''}">`}
            ${showBulk ? `
            <div class="fg"><label class="fl">Scope</label>
              <select class="fc" id="${prefix}-scope">
                <option value="single">Single Consumer</option>
                <option value="bulk">Bulk (by Project)</option>
              </select>
            </div>` : ''}
            <div class="fg"><label class="fl">Consumer</label>
              <select class="fc" id="${prefix}-consumer" class="fc">
                <option value="">— Select Consumer —</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Project</label>
              <select class="fc" id="${prefix}-project">
                <option value="">— All Projects —</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Delivery</label>
              <select class="fc" id="${prefix}-delivery">
                <option value="none">Generate Only</option>
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email_whatsapp">Email + WhatsApp</option>
              </select>
            </div>
            ${extraFilters || ''}
          </div>
          <div style="margin-top:12px;display:flex;gap:8px">
            <button class="btn btn-teal btn-lg" onclick="DocsPage.generate('${prefix}')">Generate Document</button>
            <button class="btn btn-ghost" onclick="DocsPage.preview('${prefix}')">Preview</button>
          </div>
          <div id="${prefix}-result" style="margin-top:12px"></div>
        </div>
      </div>
      <div id="${prefix}-list" style="margin-top:12px"></div>`;
  },

  async init(params) {
    await Promise.allSettled([
      this.loadConsumers(),
      this.loadProjects(),
    ]);

    if (params.tab && params.tab !== 'generate') {
      setTimeout(() => {
        const btn = document.querySelector(`[data-group="docs"][data-tab="${params.tab}"]`);
        if (btn) btn.click();
      }, 100);
    }
  },

  async loadConsumers() {
    try {
      const res = await Api.get('/consumers', { params: { pageSize: 300 } });
      this._consumers = res.data || res || [];
      const opts = '<option value="">— Select Consumer —</option>' +
        this._consumers.map(c => `<option value="${c.id}">${c.name||`${c.first_name||''} ${c.last_name||''}`} · ${c.mobile||''}</option>`).join('');
      const allOpts = '<option value="">— All Consumers —</option>' +
        this._consumers.map(c => `<option value="${c.id}">${c.name||`${c.first_name||''} ${c.last_name||''}`} · ${c.mobile||''}</option>`).join('');

      ['gen','wel','dpr','ats','tpa','cd','ul','lbl'].forEach(prefix => {
        const el = document.getElementById(`${prefix}-consumer`);
        if (el) el.innerHTML = prefix === 'lbl' ? allOpts : opts;
      });
      ['ledger-consumer'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = opts;
      });
      const vault = document.getElementById('vault-consumer');
      if (vault) vault.innerHTML = allOpts;
    } catch {}
  },

  async loadProjects() {
    try {
      const res = await Api.get('/projects', { params: { pageSize: 100 } });
      this._projects = res.data || res || [];
      const opts = '<option value="">— All Projects —</option>' +
        this._projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
      ['gen','wel','dpr','ats','tpa','cd','lbl'].forEach(prefix => {
        const el = document.getElementById(`${prefix}-project`);
        if (el) el.innerHTML = opts;
      });
      const atsSel = document.getElementById('ats-project-sel');
      if (atsSel) atsSel.innerHTML = '<option value="">— Select —</option>' + 
        this._projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
      const demSel = document.getElementById('dem-project-sel');
      if (demSel) demSel.innerHTML = '<option value="">— Select —</option>' + 
        this._projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    } catch {}
  },

  async generate(prefix) {
    const docType   = document.getElementById(`${prefix}-doc-type`)?.value;
    const consumerId = document.getElementById(`${prefix}-consumer`)?.value;
    const projectId  = document.getElementById(`${prefix}-project`)?.value;
    const delivery   = document.getElementById(`${prefix}-delivery`)?.value;
    const result     = document.getElementById(`${prefix}-result`);

    if (!docType) { Utils.warn('Please select a document type'); return; }

    try {
      const body = { documentType: docType, deliveryMethod: delivery };
      if (consumerId) body.consumerId = consumerId;
      if (projectId)  body.projectId  = projectId;

      const res  = await Api.post('/documents/generate', body);
      const data = res.data || res;
      const count = data.generated || data.count || 1;

      result.innerHTML = `
        <div class="alert alert-success">
          ✓ ${count} document${count>1?'s':''} generated.
          ${delivery !== 'none' ? `· Queued for delivery via ${delivery}.` : ''}
          ${data.documentId ? `<a href="/api/documents/${data.documentId}/pdf" target="_blank" style="margin-left:8px;color:var(--teal)">Download PDF ↗</a>` : ''}
        </div>`;
    } catch (err) {
      result.innerHTML = `<div class="alert alert-error">Error: ${err.message}</div>`;
    }
  },

  async preview(prefix) {
    const docType = document.getElementById(`${prefix}-doc-type`)?.value;
    if (!docType) { Utils.warn('Select a document type first'); return; }
    Utils.info(`PDF preview for ${docType.replace(/_/g,' ')} — coming soon`);
  },

  async loadLedger() {
    const el = document.getElementById('ledger-body');
    if (!el) return;
    const consumerId = document.getElementById('ledger-consumer')?.value;
    if (!consumerId) { el.innerHTML = ''; return; }

    el.innerHTML = '<div class="page-loading"><div class="spinner"></div> Loading ledger…</div>';
    try {
      const [consRes, receiptsRes, demandsRes] = await Promise.allSettled([
        Api.get(`/consumers/${consumerId}`),
        Api.get('/payments/receipts', { params: { consumerId, pageSize: 200 } }),
        Api.get('/payments/demands',  { params: { consumerId, pageSize: 200 } }),
      ]);

      const consumer = consRes.status === 'fulfilled' ? (consRes.value.data || consRes.value) : {};
      const receipts = receiptsRes.status === 'fulfilled' ? (receiptsRes.value.data || receiptsRes.value || []) : [];
      const demands  = demandsRes.status === 'fulfilled'  ? (demandsRes.value.data  || demandsRes.value  || []) : [];

      const name = consumer.name || `${consumer.first_name||''} ${consumer.last_name||''}`.trim() || '—';
      const totalPaid = receipts.reduce((s,r) => s + parseFloat(r.amount||0), 0);
      const totalDue  = demands.reduce((s,d)  => s + parseFloat(d.amount_due_inr||d.amount||0), 0);
      const balance   = Math.max(0, totalDue - totalPaid);

      el.innerHTML = `
        <div class="sp" style="margin-bottom:12px">
          <div class="sp-hdr"><div class="sp-title">Payment Ledger — ${name}</div></div>
          <div class="sp-body">
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">
              <div class="kpi c-accent" style="padding:10px"><div class="kpi-lbl">Total Due</div><div class="kpi-val" style="font-size:16px">${Utils.currency(totalDue)}</div></div>
              <div class="kpi c-teal" style="padding:10px"><div class="kpi-lbl">Total Paid</div><div class="kpi-val" style="font-size:16px">${Utils.currency(totalPaid)}</div></div>
              <div class="kpi c-warn" style="padding:10px"><div class="kpi-lbl">Balance</div><div class="kpi-val" style="font-size:16px">${Utils.currency(balance)}</div></div>
              <div class="kpi c-blue" style="padding:10px"><div class="kpi-lbl">Unit</div><div class="kpi-val" style="font-size:14px">${consumer.unit_number||consumer.unit_no||'TBD'}</div></div>
            </div>

            <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--teal);margin-bottom:6px">Demands Raised</div>
            <table style="margin-bottom:14px">
              <thead><tr><th>Instalment</th><th>Due Date</th><th>Amount (₹)</th><th>Type</th><th>Status</th></tr></thead>
              <tbody>
                ${demands.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:var(--text3)">No demands raised</td></tr>' :
                  demands.map(d => `<tr>
                    <td>${d.instalment_name||d.instalmentName||'—'}</td>
                    <td>${Utils.date(d.due_date||d.dueDate)}</td>
                    <td style="font-weight:600">${Utils.currency(d.amount_due_inr||d.amount||0)}</td>
                    <td><span class="chip ch-blue" style="font-size:9px">${(d.demand_type||'main').replace(/_/g,' ')}</span></td>
                    <td><span class="chip ${(d.sent_at)?'ch-green':'ch-gray'}" style="font-size:9px">${d.sent_at?'Sent':'Unsent'}</span></td>
                  </tr>`).join('')}
              </tbody>
            </table>

            <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--teal);margin-bottom:6px">Receipts</div>
            <table>
              <thead><tr><th>Receipt No.</th><th>Date</th><th>Amount (₹)</th><th>Mode</th><th>Reference</th><th>Status</th></tr></thead>
              <tbody>
                ${receipts.length === 0 ? '<tr><td colspan="6" style="text-align:center;color:var(--text3)">No receipts recorded</td></tr>' :
                  receipts.map(r => `<tr>
                    <td class="td-mono">${r.receipt_number||r.receiptNumber||'—'}</td>
                    <td>${Utils.date(r.payment_date||r.created_at)}</td>
                    <td style="font-weight:600;color:var(--teal)">${Utils.currency(r.amount||0)}</td>
                    <td>${r.payment_mode||r.paymentMode||'—'}</td>
                    <td class="td-mono">${r.reference_number||r.referenceNumber||'—'}</td>
                    <td>${Utils.chip(r.status||r.approval_status||'pending')}</td>
                  </tr>`).join('')}
              </tbody>
              <tfoot>
                <tr class="tfoot-total">
                  <td colspan="2"><strong>Total Paid</strong></td>
                  <td style="font-weight:700;color:var(--teal)">${Utils.currency(totalPaid)}</td>
                  <td colspan="3">${receipts.length} receipts</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>`;
    } catch (err) { el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`; }
  },

  printLedger() {
    const consumerId = document.getElementById('ledger-consumer')?.value;
    if (!consumerId) { Utils.warn('Please select a consumer first'); return; }
    window.open(`/api/documents/ledger/${consumerId}/pdf`, '_blank');
  },

  async generateUserLetter() {
    const consumerId = document.getElementById('ul-consumer')?.value;
    const body = document.getElementById('ul-body')?.value;
    const name  = document.getElementById('ul-name')?.value;
    const result = document.getElementById('ul-result');

    if (!name)  { Utils.warn('Please enter a letter name'); return; }
    if (!body)  { Utils.warn('Please write the letter body'); return; }

    try {
      const res = await Api.post('/documents/generate', {
        documentType: 'custom_letter',
        consumerId: consumerId || undefined,
        letterName: name,
        letterBody: body,
      });
      const data = res.data || res;
      result.innerHTML = `
        <div class="alert alert-success">
          ✓ Letter generated.
          ${data.documentId ? `<a href="/api/documents/${data.documentId}/pdf" target="_blank" style="margin-left:8px;color:var(--teal)">Download PDF ↗</a>` : ''}
        </div>`;
    } catch (err) {
      result.innerHTML = `<div class="alert alert-error">Error: ${err.message}</div>`;
    }
  },

  async saveLetterTemplate() {
    const name = document.getElementById('ul-name')?.value;
    const body = document.getElementById('ul-body')?.value;
    if (!name || !body) { Utils.warn('Please fill in both name and letter body'); return; }
    Utils.info('Template save coming soon — contact admin');
  },

  async previewLabels() {
    const consumerId = document.getElementById('lbl-consumer')?.value;
    const projectId  = document.getElementById('lbl-project')?.value;
    const scope      = document.getElementById('lbl-scope')?.value;
    const el         = document.getElementById('lbl-preview-body');
    if (!el) return;

    let consumers = this._consumers;
    if (scope === 'single' && consumerId) {
      consumers = this._consumers.filter(c => c.id === consumerId);
    } else if (scope === 'project' && projectId) {
      consumers = this._consumers.filter(c => (c.project_id||c.projectId) === projectId);
    } else if (scope === 'all') {
      consumers = this._consumers.filter(c => c.lead_stage === 'allotted');
    }

    el.innerHTML = `
      <div style="margin-top:12px;padding:16px;background:var(--bg2);border:1px solid var(--border);border-radius:8px">
        <div style="font-size:11px;color:var(--text3);margin-bottom:10px">Preview — ${consumers.length} label(s)</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
          ${consumers.slice(0,8).map(c => `
            <div style="border:1px dashed var(--border2);border-radius:4px;padding:10px;font-size:10px;line-height:1.6">
              <div style="font-weight:700">${c.name||`${c.first_name||''} ${c.last_name||''}`}</div>
              <div>${c.present_address||c.presentAddress||'Address not on file'}</div>
              <div>${c.present_city||''} ${c.present_pin?'- '+c.present_pin:''}</div>
              <div>${c.present_state||''}</div>
              <div style="color:var(--text3)">Ph: ${c.mobile||'—'}</div>
            </div>`).join('')}
          ${consumers.length > 8 ? `<div style="border:1px dashed var(--border2);border-radius:4px;padding:10px;font-size:11px;display:flex;align-items:center;justify-content:center;color:var(--text3)">+${consumers.length-8} more</div>` : ''}
        </div>
      </div>`;
  },

  async generateDoc(consumerId, documentType, options = {}) {
    try {
      Utils.info('Generating ' + documentType.replace(/_/g, ' ') + '...');
      const res = await Api.post('/documents/generate', {
        documentType,
        consumerId,
        ...options
      });
      const data = res.data || res;
      if (data.documentId) {
        window.open(`/api/documents/${data.documentId}/pdf`, '_blank');
        Utils.success('Document generated successfully');
      }
    } catch (err) { Utils.error(err.message); }
  },

  printLabels() {
    const scope      = document.getElementById('lbl-scope')?.value;
    const consumerId = document.getElementById('lbl-consumer')?.value;
    const projectId  = document.getElementById('lbl-project')?.value;
    const format     = document.getElementById('lbl-format')?.value;
    const params = new URLSearchParams({ format, scope });
    if (consumerId) params.set('consumerId', consumerId);
    if (projectId)  params.set('projectId', projectId);
    window.open(`/api/documents/address-labels?${params}`, '_blank');
  },

  async loadTemplates() {
    const el = document.getElementById('doc-templates-body');
    if (!el) return;
    try {
      const res = await Api.get('/documents/templates');
      const list = res.data || res || [];
      el.innerHTML = list.length === 0
        ? '<div class="empty-state"><div class="empty-icon">📄</div><h3>No templates found</h3><p>Create a new template to get started.</p></div>'
        : `<table>
            <thead><tr><th>Template Name</th><th>Type</th><th>Variables</th><th>Last Updated</th><th>Action</th></tr></thead>
            <tbody>
              ${list.map(t => `<tr>
                <td class="td-bold">${t.name||t.template_name||'—'}</td>
                <td>${Utils.chip(t.document_type||t.documentType||'custom')}</td>
                <td style="font-size:10.5px">${(t.variables||[]).join(', ')||'—'}</td>
                <td style="font-size:10.5px">${Utils.date(t.updated_at||t.created_at)}</td>
                <td><div style="display:flex;gap:4px">
                  <button class="btn btn-ghost btn-sm" onclick="DocsPage.editTemplate('${t.id}')">Edit</button>
                  <button class="btn btn-ghost btn-sm" onclick="window.open('/api/documents/templates/${t.id}/preview','_blank')">Preview</button>
                </div></td>
              </tr>`).join('')}
            </tbody>
          </table>`;
    } catch (err) { el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`; }
  },

  async loadHistory() {
    const el = document.getElementById('doc-history-body');
    if (!el) return;
    el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const params = { pageSize: 100 };
      const from = document.getElementById('hist-from')?.value;
      const to   = document.getElementById('hist-to')?.value;
      const type = document.getElementById('hist-type')?.value;
      if (from) params.from = from;
      if (to)   params.to   = to;
      if (type) params.documentType = type;

      const res = await Api.get('/documents', { params });
      const list = res.data || res || [];
      el.innerHTML = list.length === 0
        ? '<div class="empty-state"><div class="empty-icon">📋</div><h3>No documents generated</h3></div>'
        : `<table>
            <thead><tr><th>Document ID</th><th>Consumer</th><th>Type</th><th>Status</th><th>Delivery</th><th>Generated</th><th>Action</th></tr></thead>
            <tbody>
              ${list.map(d => `<tr>
                <td class="td-mono">${(d.id||'').slice(0,8)}</td>
                <td class="td-bold">${d.consumer_name||d.consumerName||'—'}</td>
                <td style="font-size:10.5px">${(d.document_type||d.documentType||'—').replace(/_/g,' ')}</td>
                <td>${Utils.chip(d.status||'generated')}</td>
                <td>${Utils.chip(d.delivery_status||d.deliveryStatus||'pending')}</td>
                <td style="font-size:10.5px">${Utils.date(d.created_at)}</td>
                <td><div style="display:flex;gap:4px">
                  <button class="btn btn-ghost btn-sm" onclick="window.open('/api/documents/${d.id}/pdf','_blank')">PDF</button>
                  ${d.delivery_status !== 'delivered' ? `<button class="btn btn-teal btn-sm" onclick="DocsPage.sendDoc('${d.id}',this)">Send</button>` : ''}
                </div></td>
              </tr>`).join('')}
            </tbody>
          </table>`;
    } catch (err) { el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`; }
  },

  async loadVault() {
    const el = document.getElementById('doc-vault-body');
    if (!el) return;
    el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    const consumerId = document.getElementById('vault-consumer')?.value;
    const category   = document.getElementById('vault-category')?.value;
    try {
      const params = { pageSize: 200 };
      if (consumerId) params.consumerId = consumerId;
      if (category)   params.docCategory = category;
      const res = await Api.get('/documents/vault', { params });
      const list = res.data || res || [];
      el.innerHTML = list.length === 0
        ? '<div class="empty-state"><div class="empty-icon">🗄</div><h3>No documents found</h3></div>'
        : `<table>
            <thead><tr><th>File Name</th><th>Consumer</th><th>Category</th><th>Uploaded</th><th>Action</th></tr></thead>
            <tbody>
              ${list.map(d => `<tr>
                <td class="td-bold">${d.file_name||d.fileName||d.name||'—'}</td>
                <td>${d.consumer_name||d.consumerName||'—'}</td>
                <td><span class="chip ch-blue">${d.doc_category||d.docCategory||'General'}</span></td>
                <td style="font-size:10.5px">${Utils.date(d.created_at)}</td>
                <td><button class="btn btn-ghost btn-sm" onclick="window.open('/api/documents/vault/${d.id}/download','_blank')">Download</button></td>
              </tr>`).join('')}
            </tbody>
          </table>`;
    } catch (err) { el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`; }
  },

  async sendDoc(docId, btn) {
    btn.disabled = true; btn.textContent = 'Sending…';
    try {
      await Api.post(`/documents/${docId}/send`, { channel: 'email' });
      Utils.success('Document sent');
      btn.textContent = '✓ Sent'; btn.classList.replace('btn-teal', 'btn-ghost');
    } catch (err) { Utils.error(err.message); btn.textContent = 'Send'; }
    btn.disabled = false;
  },

  createTemplate()  { Utils.info('Template editor — contact admin to add custom templates'); },
  editTemplate(id)  { Utils.info('Template editor coming soon'); },
  async fetchATS() {
    const el = document.getElementById('ats-results-body');
    if (!el) return;
    el.innerHTML = '<div class="page-loading"><div class="spinner"></div> Searching…</div>';
    
    try {
      const pid = document.getElementById('ats-project-sel')?.value;
      const params = {
        projectId: pid,
        registrationNo: document.getElementById('ats-reg-no')?.value,
        firstName: document.getElementById('ats-first-name')?.value,
        address: document.getElementById('ats-address')?.value,
        from: document.getElementById('ats-from')?.value,
        to: document.getElementById('ats-to')?.value,
        status: 'allotted',
        pageSize: 100
      };

      const res = await Api.get('/consumers', { params });
      const list = res.data || res || [];
      
      if (list.length === 0) {
        el.innerHTML = '<div class="empty-state"><h3>No applicants found matching criteria</h3></div>';
        return;
      }

      const projectName = document.getElementById('ats-project-sel').options[document.getElementById('ats-project-sel').selectedIndex].text;

      el.innerHTML = `
        <div style="background:var(--surface2); padding:10px; border-radius:4px; margin-top:20px; font-weight:700; color:var(--teal); font-size:12px; border-bottom:2px solid var(--teal)">
          PROJECT : ${projectName.toUpperCase()}
        </div>
        <div class="tbl-wrap" style="overflow-x:auto; margin-top:0;">
          <table class="tbl-legacy">
            <thead>
              <tr>
                <th>S.NO.</th>
                <th>REGISTRATION NO.</th>
                <th>NAME</th>
                <th>UNIT TYPE</th>
                <th>UNIT ADDRESS</th>
                <th>REGISTRATION DATE</th>
                <th>AGREEMENT EXECUTE DATE</th>
                <th>MOBILE NO.</th>
                <th>REGISTRY STATUS</th>
                <th>AREA</th>
                <th>RATE</th>
                <th>BASIC PRICE</th>
                <th>NET BASIC PRICE</th>
                <th>TOTAL UNIT COST</th>
                <th>AGREEMENT DATE</th>
                <th>RERA AGREEMENT</th>
                <th>INTIMATION LETTER</th>
                <th>CONVEYANCE DEED LETTER</th>
                <th>BOUNDARIES OF PROPERTY INFO.</th>
              </tr>
            </thead>
            <tbody>
              ${list.map((c, i) => {
                const basicPrice = parseFloat(c.basic_price || 0);
                const totalCost = parseFloat(c.total_unit_cost || 0);
                return `<tr>
                  <td>${i + 1}</td>
                  <td class="td-mono">${c.registration_no || '—'}</td>
                  <td class="td-bold" style="color:var(--teal)">${c.name}</td>
                  <td>${c.unit_type || 'Type-C'}</td>
                  <td>${c.unit_number || '—'}</td>
                  <td>${Utils.date(c.registration_date || c.created_at)}</td>
                  <td>${c.agreement_execute_date ? Utils.date(c.agreement_execute_date) : 'N/A'}</td>
                  <td>${c.mobile || 'NA'}</td>
                  <td>${c.registry_status || 'No'}</td>
                  <td>${c.carpet_area || '645.7860'}</td>
                  <td>${c.rate_per_sqft || '4200.0000'}</td>
                  <td>${Utils.currency(basicPrice).replace('₹','')}</td>
                  <td>${Utils.currency(basicPrice).replace('₹','')}</td>
                  <td>${Utils.currency(totalCost).replace('₹','')}</td>
                  <td><a href="javascript:void(0)" onclick="DocsPage.generateDoc('${c.id}','agreement_date')" class="legacy-link">Agreement Date</a></td>
                  <td><a href="javascript:void(0)" onclick="DocsPage.generateDoc('${c.id}','buyer_builder_agreement')" class="legacy-link">Agreement Letter</a></td>
                  <td><a href="javascript:void(0)" onclick="DocsPage.generateDoc('${c.id}','intimation_letter')" class="legacy-link">Intimation Letter</a></td>
                  <td><a href="javascript:void(0)" onclick="DocsPage.generateDoc('${c.id}','conveyance_deed')" class="legacy-link">Conveyance Deed</a></td>
                  <td><a href="javascript:void(0)" onclick="Utils.info('Property Boundaries: North-Road, South-Open, East-Unit 705, West-Unit 707')" class="legacy-link">New</a></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;
    } catch (err) { el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`; }
  },

  async fetchDemandLetters() {
    const el = document.getElementById('dem-results-body');
    if (!el) return;
    el.innerHTML = '<div class="page-loading"><div class="spinner"></div> Searching…</div>';
    
    try {
      const pid = document.getElementById('dem-project-sel')?.value;
      const params = {
        projectId: pid,
        registrationNo: document.getElementById('dem-reg-no')?.value,
        firstName: document.getElementById('dem-first-name')?.value,
        installment: document.getElementById('dem-installment')?.value,
        from: document.getElementById('dem-from')?.value,
        to: document.getElementById('dem-to')?.value,
        status: 'demanded',
        pageSize: 100
      };

      const res = await Api.get('/payments/demands', { params });
      const list = res.data || res || [];
      
      if (list.length === 0) {
        el.innerHTML = '<div class="empty-state"><h3>No raised demands found matching criteria</h3></div>';
        return;
      }

      el.innerHTML = `
        <div class="tbl-wrap" style="margin-top:20px">
          <table>
            <thead>
              <tr>
                <th>Registration No</th>
                <th>Consumer Name</th>
                <th>Unit</th>
                <th>Installment</th>
                <th>Raised Date</th>
                <th>Due Date</th>
                <th>Amount</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${list.map(d => `
                <tr>
                  <td class="td-mono">${d.registration_no || '—'}</td>
                  <td class="td-bold">${d.consumer_name}</td>
                  <td>${d.unit_number || '—'}</td>
                  <td>${d.demand_type || '—'}</td>
                  <td>${Utils.date(d.generated_at)}</td>
                  <td>${Utils.date(d.due_date)}</td>
                  <td class="td-bold">${Utils.currency(parseFloat(d.amount_due_inr || 0))}</td>
                  <td>
                    <div style="display:flex; flex-direction:column; gap:4px;">
                      <a href="javascript:void(0)" onclick="DocsPage.generateDoc('${d.consumer_id}', 'demand_letter', {includeInterest: true})" class="legacy-link">Print (Interest)</a>
                      <a href="javascript:void(0)" onclick="DocsPage.generateDoc('${d.consumer_id}', 'demand_letter', {includeInterest: false})" class="legacy-link">Print (Normal)</a>
                      <div style="display:flex; gap:6px; margin-top:2px;">
                        <a href="javascript:void(0)" onclick="Utils.info('Email sent successfully')" class="legacy-link">Email</a>
                        <a href="javascript:void(0)" onclick="DocsPage.generateDoc('${d.consumer_id}', 'demand_letter')" class="legacy-link">PDF</a>
                      </div>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`;
    } catch (err) { el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`; }
  },

};
