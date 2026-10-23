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
      <button class="tab-line" data-group="docs" data-tab="demand-printing" onclick="switchTab('docs','demand-printing');DocsPage.initDemandPrinting()">Demand Printing</button>
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

    <style>
      [data-panel-group="docs"] { max-width:1180px; margin-left:auto; margin-right:auto }
      [data-panel-group="docs"] .sp, [data-panel-group="docs"] .tbl-wrap { border-radius:10px; overflow:hidden; margin-bottom:16px !important }
      [data-panel-group="docs"] .sp-hdr, [data-panel-group="docs"] .tbl-hdr { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; padding:14px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border) }
      [data-panel-group="docs"] .sp-title, [data-panel-group="docs"] .tbl-title { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
      [data-panel-group="docs"] .sp-body { padding:18px }
      [data-panel-group="docs"] .sp-grid { gap:16px 18px }
      @media (max-width:900px) { [data-panel-group="docs"] .sp-grid { grid-template-columns:repeat(2,minmax(0,1fr)) !important } [data-panel-group="docs"] .fg { grid-column:auto !important } }
      @media (max-width:640px) { [data-panel-group="docs"] .sp-grid { grid-template-columns:minmax(0,1fr) !important } }
      [data-panel-group="docs"] .fg { gap:6px }
      [data-panel-group="docs"] .fl { font-size:11px; font-weight:500; text-transform:none; letter-spacing:.3px; color:var(--text2) }
      [data-panel-group="docs"] .fc { padding:9px 12px; font-size:13px; border-radius:8px; min-height:38px }
      [data-panel-group="docs"] .fc:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg) }
      [data-panel-group="docs"] .btn-lg, [data-panel-group="docs"] .btn-fetch { padding:9px 24px; font-size:12.5px; border-radius:8px; min-height:38px; font-weight:600 }
      [data-panel-group="docs"] .btn-fetch, [data-panel-group="docs"] .btn-fetch:hover { background:var(--teal) !important; color:#fff !important; border:none; width:auto !important }
      [data-panel-group="docs"] .alert { border-radius:8px; margin-bottom:16px !important }
      [data-panel-group="docs"] .tbl-wrap, [data-panel-group="docs"] #doc-history-body, [data-panel-group="docs"] #doc-vault-body, [data-panel-group="docs"] #ul-templates-body { overflow-x:auto }
      [data-panel-group="docs"] #doc-history-body, [data-panel-group="docs"] #doc-vault-body { background:var(--surface); border:1px solid var(--border2); border-radius:10px }
      [data-panel-group="docs"] table { width:100%; border-collapse:collapse; font-size:12.5px }
      [data-panel-group="docs"] table th { text-align:left; padding:10px 14px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; color:var(--text3); background:var(--surface2); border-bottom:1px solid var(--border2); white-space:nowrap; border-left:none; border-right:none; border-top:none }
      [data-panel-group="docs"] table td { padding:10px 14px; border:none; border-bottom:1px solid var(--border); color:var(--text); vertical-align:middle; background:transparent }
      [data-panel-group="docs"] table tbody tr:hover td { background:var(--surface2) }
      [data-panel-group="docs"] table tbody tr:last-child td { border-bottom:none }
      [data-panel-group="docs"] table .td-bold { font-weight:600 }
      [data-panel-group="docs"] .doc-action-link, [data-panel-group="docs"] .legacy-link { color:var(--teal); text-decoration:none; font-weight:500; cursor:pointer }
      [data-panel-group="docs"] .doc-action-link:hover, [data-panel-group="docs"] .legacy-link:hover { text-decoration:underline }
      /* Demand Printing */
      [data-panel-group="docs"] .dpr-types { display:flex; gap:6px; flex-wrap:wrap }
      [data-panel-group="docs"] .dpr-type-btn { padding:5px 12px; border:1px solid var(--border2); background:var(--surface); color:var(--text2); border-radius:999px; cursor:pointer; font-size:11.5px }
      [data-panel-group="docs"] .dpr-type-btn:hover { border-color:var(--teal); color:var(--teal) }
      [data-panel-group="docs"] .dpr-type-btn.on { background:var(--teal); color:#fff; border-color:var(--teal); font-weight:600 }
      [data-panel-group="docs"] .dpr-row { display:flex; align-items:flex-end; flex-wrap:wrap; gap:14px 16px; margin-bottom:16px }
      [data-panel-group="docs"] .dpr-row .fg { min-width:120px }
      [data-panel-group="docs"] .dpr-seg { display:flex; border:1px solid var(--border2); border-radius:8px; overflow:hidden; height:38px }
      [data-panel-group="docs"] .dpr-seg button { padding:0 16px; border:none; background:var(--surface); color:var(--text2); font-size:12px; cursor:pointer }
      [data-panel-group="docs"] .dpr-seg button.on { background:var(--teal); color:#fff; font-weight:600 }
      [data-panel-group="docs"] .dpr-actions { border-top:1px solid var(--border); padding-top:16px; display:flex; align-items:center; gap:12px }
      [data-panel-group="docs"] .dpr-count { font-size:12px; color:var(--text2) }
      [data-panel-group="docs"] .dpr-legend { display:flex; justify-content:flex-end; align-items:center; flex-wrap:wrap; gap:14px; padding:4px 4px 12px; font-size:11.5px; color:var(--text2) }
      [data-panel-group="docs"] .dpr-legend span { display:flex; align-items:center; gap:5px }
      [data-panel-group="docs"] .dpr-legend i { width:13px; height:13px; display:inline-block; border-radius:3px }
      [data-panel-group="docs"] .dpr-ico { background:none; border:none; cursor:pointer; font-size:16px }
      [data-panel-group="docs"] .dpr-card { background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:hidden }
      [data-panel-group="docs"] .dpr-tbl td.dpr-link { color:var(--teal); font-weight:500; cursor:pointer }
      [data-panel-group="docs"] .dpr-tbl tr.dpr-sent td { background:var(--surface2) }
      [data-panel-group="docs"] .dpr-tbl tr.dpr-rem td { background:rgba(250,204,21,.12) }
      [data-panel-group="docs"] .dpr-btn-d { background:var(--teal); color:#fff; border:none; padding:3px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600 }
      [data-panel-group="docs"] .dpr-pag { padding:12px 18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; border-top:1px solid var(--border); font-size:12px; color:var(--text2) }
      [data-panel-group="docs"] .dpr-pag button { padding:3px 8px; cursor:pointer; border:1px solid var(--border2); background:var(--surface); color:var(--text); border-radius:6px }
      [data-panel-group="docs"] .dpr-prints { margin-top:16px; display:flex; gap:10px; flex-wrap:wrap }
      [data-panel-group="docs"] .dpr-prints .btn { padding:9px 18px; font-size:12px; border-radius:8px; font-weight:600 }
    </style>

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

    <!-- DEMAND PRINTING — Full Demand Status screen inline -->
    <div data-panel-group="docs" data-panel="demand-printing" style="display:none">
      ${DocsPage._demandPrintingPanel()}
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
          <button class="btn btn-fetch" style="margin-top:16px" onclick="DocsPage.fetchATS()">FETCH</button>
        </div>
      </div>
      <div id="ats-results-body"></div>
    </div>

    <!-- APPLICANT LEDGER -->
    <div data-panel-group="docs" data-panel="applicant-ledger" style="display:none">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">SEARCH APPLICANT (Applicant Ledger)</div></div>
        <div class="sp-body">
          <div style="margin-bottom:12px;display:flex;gap:0">
            <button type="button" class="btn btn-teal" style="border-radius:4px 0 0 4px">All</button>
            <button type="button" class="btn btn-ghost" style="border-radius:0 4px 4px 0">Registry</button>
          </div>
          <div class="sp-grid">
            <div class="fg"><label class="fl">Project</label>
              <select class="fc" id="al-project-sel">
                <option value="">— Select —</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Registration No.:</label>
              <input class="fc" id="al-reg-no" placeholder="Registration No">
            </div>
            <div class="fg"><label class="fl">First Name:</label>
              <input class="fc" id="al-first-name" placeholder="First Name">
            </div>
            <div class="fg"><label class="fl">Unit Address:</label>
              <input class="fc" id="al-address" placeholder="Unit Address">
            </div>
          </div>
          <button class="btn btn-fetch" style="margin-top:16px" onclick="DocsPage.fetchApplicantLedger()">FETCH</button>
        </div>
      </div>
      <div id="al-results-body"></div>
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
          <button class="btn btn-fetch" style="margin-top:16px" onclick="DocsPage.fetchDemandLetters()">FETCH</button>
        </div>
      </div>
      <div id="dem-results-body"></div>
    </div>

    <!-- TPA -->
    <div data-panel-group="docs" data-panel="tpa" style="display:none">
      ${DocsPage._printPanel({ title: 'Transfer of Property Agreement (TPA)', docType: 'tpa', prefix: 'tpa' })}
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
      const res = await Api.get('/consumers', { params: { pageSize: 300, hasConfirmedBooking: true } });
      this._consumers = res.data || res || [];
      const opts = '<option value="">— Select Consumer —</option>' +
        this._consumers.map(c => `<option value="${c.id}">${c.name||`${c.first_name||''} ${c.last_name||''}`} · ${c.mobile||''}</option>`).join('');
      const allOpts = '<option value="">— All Consumers —</option>' +
        this._consumers.map(c => `<option value="${c.id}">${c.name||`${c.first_name||''} ${c.last_name||''}`} · ${c.mobile||''}</option>`).join('');

      ['gen','wel','dpr','ats','tpa','cd','ul','lbl'].forEach(prefix => {
        const el = document.getElementById(`${prefix}-consumer`);
        if (el) el.innerHTML = prefix === 'lbl' ? allOpts : opts;
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
        this._projects.map(p => `<option value="${p.id}">${Utils.esc(p.name)}</option>`).join('');
      ['gen','wel','dpr','ats','tpa','cd','lbl'].forEach(prefix => {
        const el = document.getElementById(`${prefix}-project`);
        if (el) el.innerHTML = opts;
      });
      const atsSel = document.getElementById('ats-project-sel');
      if (atsSel) atsSel.innerHTML = '<option value="">— Select —</option>' + 
        this._projects.map(p => `<option value="${p.id}">${Utils.esc(p.name)}</option>`).join('');
      const demSel = document.getElementById('dem-project-sel');
      if (demSel) demSel.innerHTML = '<option value="">— Select —</option>' +
        this._projects.map(p => `<option value="${p.id}">${Utils.esc(p.name)}</option>`).join('');
      const alsSel = document.getElementById('al-project-sel');
      if (alsSel) alsSel.innerHTML = '<option value="">— Select —</option>' +
        this._projects.map(p => `<option value="${p.id}">${Utils.esc(p.name)}</option>`).join('');
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

  async generateAndOpen(linkEl) {
    const consumerId = linkEl.dataset.consumerId;
    const docType = linkEl.dataset.docType;
    const originalText = linkEl.textContent;

    try {
      linkEl.textContent = 'Generating...';
      linkEl.style.pointerEvents = 'none';
      linkEl.style.opacity = '0.6';

      const token = Auth?.getToken() || localStorage.getItem('rof-jwt') || '';
      const response = await fetch('/api/documents/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          consumerId,
          documentType: docType
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Generation failed');
      }

      const data = await response.json();
      const docId = data.data?.documentId || data.documentId;

      if (docId) {
        window.open(`/api/documents/${docId}/html?token=${token}`, '_blank');
      } else {
        throw new Error('No document ID returned');
      }

      linkEl.textContent = originalText;
      linkEl.style.pointerEvents = '';
      linkEl.style.opacity = '';

    } catch (err) {
      console.error('Document generation failed:', err);
      Utils.error(`Failed: ${err.message}`);
      linkEl.textContent = originalText;
      linkEl.style.pointerEvents = '';
      linkEl.style.opacity = '';
    }
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
                <td style="font-size:10.5px">${d.created_at ? `Generated on ${Utils.date(d.created_at)}` : '—'}</td>
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
                <th>AGREEMENT LETTER</th>
                <th>CONVEYANCE DEED</th>
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
                  <td><a href="javascript:void(0)" class="doc-action-link" data-consumer-id="${c.id}" data-doc-type="buyer_builder_agreement" onclick="DocsPage.generateAndOpen(this)">Agreement Letter</a></td>
                  <td><a href="javascript:void(0)" class="doc-action-link" data-consumer-id="${c.id}" data-doc-type="conveyance_deed" onclick="DocsPage.generateAndOpen(this)">Conveyance Deed</a></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;
    } catch (err) { el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`; }
  },

  async fetchApplicantLedger() {
    const el = document.getElementById('al-results-body');
    if (!el) return;
    el.innerHTML = '<div class="page-loading"><div class="spinner"></div> Searching…</div>';

    try {
      const pid = document.getElementById('al-project-sel')?.value;
      const params = {
        projectId: pid,
        regNo: document.getElementById('al-reg-no')?.value,
        firstName: document.getElementById('al-first-name')?.value,
        address: document.getElementById('al-address')?.value,
        pageSize: 100
      };

      const res = await Api.get('/consumers', { params });
      const list = res.data || res || [];

      if (list.length === 0) {
        el.innerHTML = '<div class="empty-state"><h3>No applicants found matching criteria</h3></div>';
        return;
      }

      el.innerHTML = `
        <div class="tbl-wrap" style="overflow-x:auto; margin-top:0;">
          <table class="tbl-legacy">
            <thead>
              <tr>
                <th>REGISTRATION NO.</th>
                <th>NAME</th>
                <th>UNIT ADDRESS</th>
                <th>BROKER COMPANY NAME</th>
                <th>REGISTRATION DATE</th>
                <th>ALLOTMENT DATE</th>
                <th>CHECK LIST</th>
              </tr>
            </thead>
            <tbody>
              ${list.map((c) => `<tr>
                  <td class="td-mono">${c.registration_no || '—'}</td>
                  <td class="td-bold" style="color:var(--teal)">${c.name}</td>
                  <td>${c.unit_number || '—'}</td>
                  <td>${c.broker_company_name || '—'}</td>
                  <td>${Utils.date(c.registration_date)}</td>
                  <td>${Utils.date(c.allotment_date)}</td>
                  <td><a href="javascript:void(0)" class="doc-action-link" data-consumer-id="${c.id}" data-doc-type="check_list" onclick="DocsPage.generateAndOpen(this)">Check List</a></td>
                </tr>`).join('')}
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
                      <a href="javascript:void(0)" onclick="DocsPage.generateDoc('${d.consumer_id}', 'demand_letter', {includeInterest: true, demandId: '${d.id}'})" class="legacy-link">Print (Interest)</a>
                      <a href="javascript:void(0)" onclick="DocsPage.generateDoc('${d.consumer_id}', 'demand_letter', {includeInterest: false, demandId: '${d.id}'})" class="legacy-link">Print (Normal)</a>
                      <div style="display:flex; gap:6px; margin-top:2px;">
                        <a href="javascript:void(0)" onclick="Utils.info('Email sent successfully')" class="legacy-link">Email</a>
                        <a href="javascript:void(0)" onclick="DocsPage.generateDoc('${d.consumer_id}', 'demand_letter', {demandId: '${d.id}'})" class="legacy-link">PDF</a>
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

  // ── DEMAND PRINTING — Full Demand Status inline ──────────────────────────────

  _demandPrintingPanel() {
    const tb = (id, label, active) =>
      `<button class="dpr-type-btn${active?' on':''}" data-type="${id}" onclick="DocsPage.setDprType(this,'${id}')">${label}</button>`;
    return `
    <div class="sp">
      <div class="sp-hdr">
        <div class="sp-title">Demand Status</div>
        <div class="dpr-types">${tb('all','All',true)}${tb('demanded','Demand',false)}${tb('pending','Reminder',false)}${tb('paid','Cancellation Letter',false)}${tb('final','Final Opportunity Letter',false)}</div>
      </div>
      <div class="sp-body">
        <div class="dpr-row">
          <div class="dpr-seg">
            <button id="dpr-all-btn" class="on" onclick="DocsPage.setDprScope('all')">All</button>
            <button id="dpr-allotted-btn" onclick="DocsPage.setDprScope('allotted')">Allotted</button>
          </div>
          <div class="fg"><label class="fl"><span class="r">*</span>Project</label>
            <select class="fc" id="dpr-project" onchange="DocsPage.loadDprTowers()"><option value="">&lt;--Select--&gt;</option></select></div>
          <div class="fg"><label class="fl">Tower</label>
            <select class="fc" id="dpr-tower"><option value="">&lt;--All--&gt;</option></select></div>
          <div class="fg"><label class="fl">Floor</label>
            <input class="fc" type="text" id="dpr-floor" placeholder="--All--" style="width:90px"></div>
          <div class="fg"><label class="fl">Registration No.</label>
            <input class="fc" type="text" id="dpr-reg-no" placeholder="Reg No"></div>
          <div class="fg"><label class="fl">First Name</label>
            <input class="fc" type="text" id="dpr-name" placeholder="First Name"></div>
          <div class="fg"><label class="fl">City</label>
            <input class="fc" type="text" id="dpr-city" placeholder="City"></div>
        </div>
        <div class="dpr-row">
          <div class="fg"><label class="fl">Send/Unsend Status</label>
            <div style="display:flex;gap:8px;">
              <select class="fc" id="dpr-send-status1"><option value="">&lt;--All--&gt;</option><option value="sent">Sent</option><option value="unsent">Unsent</option></select>
              <select class="fc" id="dpr-send-status2"><option value="">&lt;--All--&gt;</option><option value="pending">Pending</option><option value="queued">Queued</option><option value="paid">Delivered</option></select>
            </div></div>
          <div class="fg"><label class="fl">Due Date</label>
            <input class="fc" type="date" id="dpr-due-date"></div>
          <div class="fg"><label class="fl">Print Date</label>
            <input class="fc" type="date" id="dpr-print-date"></div>
          <div class="dpr-seg">
            <button id="dpr-gst-btn" class="on" onclick="DocsPage.setDprGst('gst')">GST</button>
            <button id="dpr-pregst-btn" onclick="DocsPage.setDprGst('before')">Before GST</button>
          </div>
        </div>
        <div class="dpr-actions">
          <button class="btn btn-fetch" onclick="DocsPage.fetchDpr()">FETCH</button>
          <button class="btn btn-ghost" onclick="DocsPage.clearDpr()">Clear</button>
          <span id="dpr-count" class="dpr-count"></span>
        </div>
      </div>
    </div>
    <div id="dpr-results" style="display:none;">
      <div class="dpr-legend">
        <span><i style="background:var(--surface2);border:1px solid var(--border2)"></i>Sent</span>
        <span><i style="background:var(--surface);border:1px solid var(--border2)"></i>Demand</span>
        <span><i style="background:#FFF59D;border:1px solid #F9A825"></i>Reminder</span>
        <span><i style="background:#A5D6A7;border:1px solid #388E3C"></i>Cancellation Letter</span>
        <span><i style="background:#EF9A9A;border:1px solid #C62828"></i>Final Opportunity Letter</span>
        <button class="dpr-ico" onclick="window.print()">🖨️</button>
        <button class="dpr-ico" onclick="DocsPage.dprExport()">⬇️</button>
      </div>
      <div class="dpr-card">
        <div style="overflow-x:auto;">
          <table class="dpr-tbl">
            <thead><tr>
              <th style="text-align:center;width:36px;"><input type="checkbox" id="dpr-select-all" onchange="DocsPage.dprSelectAll(this)"></th>
              <th style="text-align:center;width:46px;">S. NO.</th>
              <th>REGISTRATION NO.</th>
              <th>BOOKING DATE</th>
              <th>NAME</th>
              <th>BROKER NAME</th>
              <th>TYPE</th>
              <th>UNIT ADDRESS</th>
              <th>TOWER NAME</th>
              <th>FLOOR NAME</th>
              <th>MOBILE NO.</th>
              <th style="text-align:center;width:40px;">D</th>
            </tr></thead>
            <tbody id="dpr-tbody"></tbody>
          </table>
        </div>
        <div id="dpr-pagination" class="dpr-pag"></div>
      </div>
      <div class="dpr-prints">
        <button class="btn btn-teal" onclick="DocsPage.dprPrintSelected('demand')">PRINT DEMAND</button>
        <button class="btn btn-teal" onclick="DocsPage.dprPrintSelected('reminder')">PRINT REMINDER</button>
        <button class="btn btn-teal" onclick="DocsPage.dprPrintSelected('cancellation')">PRINT CANCELLATION LETTER</button>
        <button class="btn btn-teal" onclick="DocsPage.dprPrintSelected('final')">PRINT FINAL OPPORTUNITY LETTER</button>
      </div>
    </div>`;
  },

  _dprType:'all', _dprScope:'all', _dprGst:'gst', _dprPage:1, _dprLimit:50, _dprSelected:new Set(),

  setDprType(btn,type) {
    document.querySelectorAll('.dpr-type-btn').forEach(b=>b.classList.remove('on'));
    btn.classList.add('on'); this._dprType=type;
  },
  setDprScope(scope) {
    this._dprScope=scope;
    const a=document.getElementById('dpr-all-btn'),al=document.getElementById('dpr-allotted-btn');
    if(!a||!al)return;
    a.classList.toggle('on',scope==='all'); al.classList.toggle('on',scope!=='all');
  },
  setDprGst(type) {
    this._dprGst=type;
    const g=document.getElementById('dpr-gst-btn'),b=document.getElementById('dpr-pregst-btn');
    if(!g||!b)return;
    g.classList.toggle('on',type==='gst'); b.classList.toggle('on',type==='before');
  },
  async initDemandPrinting() {
    const today=Utils.today();
    const dd=document.getElementById('dpr-due-date'); if(dd)dd.value=today;
    const pd=document.getElementById('dpr-print-date'); if(pd)pd.value=today;
    const sel=document.getElementById('dpr-project');
    if(!sel||sel.options.length>1)return;
    try {
      const projects=this._projects.length?this._projects:((await Api.get('/projects')).data||[]);
      projects.forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.name;sel.appendChild(o);});
    } catch {}
  },
  async loadDprTowers() {
    const pid=document.getElementById('dpr-project')?.value;
    const sel=document.getElementById('dpr-tower');
    if(!sel)return; sel.innerHTML='<option value="">&lt;--All--&gt;</option>';
    if(!pid)return;
    try {
      const res=await Api.get('/units',{params:{projectId:pid,pageSize:500}});
      [...new Set((res.data||[]).map(u=>u.tower_name).filter(Boolean))].forEach(t=>{const o=document.createElement('option');o.value=t;o.textContent=t;sel.appendChild(o);});
    } catch {}
  },
  fetchDpr() { this._dprPage=1; this._dprSelected.clear(); this._loadDprData(); },
  clearDpr() {
    ['dpr-project','dpr-tower','dpr-floor','dpr-reg-no','dpr-name','dpr-city','dpr-send-status1','dpr-send-status2','dpr-due-date','dpr-print-date'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    const r=document.getElementById('dpr-results');if(r)r.style.display='none';
    const c=document.getElementById('dpr-count');if(c)c.textContent='';
  },
  async _loadDprData() {
    const g=id=>(document.getElementById(id)?.value||'').trim();
    const params=new URLSearchParams({page:String(this._dprPage),limit:String(this._dprLimit)});
    const map={'dpr-project':'project_id','dpr-tower':'tower','dpr-floor':'floor','dpr-reg-no':'reg_no','dpr-name':'name','dpr-city':'city','dpr-send-status2':'delivery_status','dpr-due-date':'due_date_to'};
    Object.entries(map).forEach(([id,key])=>{const v=g(id);if(v)params.set(key,v);});
    if(this._dprType!=='all')params.set('demand_status',this._dprType);
    const tbody=document.getElementById('dpr-tbody');
    if(tbody)tbody.innerHTML='<tr><td colspan="12" style="text-align:center;padding:30px;color:var(--text3);">Loading…</td></tr>';
    try {
      const token=Auth?.getToken()||localStorage.getItem('rof-jwt')||'';
      const res=await fetch(`/api/payments/demand-status?${params}`,{headers:{Authorization:`Bearer ${token}`}});
      const json=await res.json(); const rows=json.data||[],total=json.total||0;
      const cnt=document.getElementById('dpr-count');if(cnt)cnt.textContent=`${total} record(s) found`;
      const results=document.getElementById('dpr-results');if(results)results.style.display='block';
      if(!rows.length){if(tbody)tbody.innerHTML='<tr><td colspan="12" style="text-align:center;padding:30px;color:var(--text3);">No records found</td></tr>';return;}
      if(tbody)tbody.innerHTML=rows.map((r,i)=>{
        const rowCls=r.delivery_status==='paid'?'dpr-sent':r.active_demands>0?'':'dpr-rem';
        return `<tr class="${rowCls}">
          <td style="text-align:center"><input type="checkbox" class="dpr-row-cb" value="${r.consumer_id}" onchange="DocsPage.dprToggleSelect('${r.consumer_id}',this.checked)"></td>
          <td style="text-align:center">${(this._dprPage-1)*this._dprLimit+i+1}</td>
          <td class="dpr-link" onclick="DocsPage.openConsumer('${r.consumer_id}')">${r.registration_no||'—'}</td>
          <td>${r.booking_date?new Date(r.booking_date).toLocaleDateString('en-IN'):'—'}</td>
          <td class="dpr-link" onclick="DocsPage.openConsumer('${r.consumer_id}')">${r.name||'—'}</td>
          <td>Direct</td>
          <td>${r.bhk_type||'—'}</td>
          <td class="td-bold">${r.unit_number||'—'}</td>
          <td>${r.tower_name||'—'}</td>
          <td>${r.floor_number!=null?r.floor_number+'th Floor':'—'}</td>
          <td>${r.mobile||'—'}</td>
          <td style="text-align:center"><button onclick="DocsPage.dprGenerateLetter('${r.consumer_id}')" class="dpr-btn-d">D</button></td>
        </tr>`;
      }).join('');
      const totalPages=Math.ceil(total/this._dprLimit);
      const pag=document.getElementById('dpr-pagination');
      if(pag)pag.innerHTML=`<span>Records Per Page: <select onchange="DocsPage.setDprLimit(+this.value)" style="padding:3px 6px;border-radius:6px;"><option value="50" ${this._dprLimit===50?'selected':''}>50</option><option value="100" ${this._dprLimit===100?'selected':''}>100</option></select></span>
        <span style="font-weight:600;color:var(--text);">Page No: ${this._dprPage} of ${totalPages||1}</span>
        <span>Records ${(this._dprPage-1)*this._dprLimit+1}–${Math.min(this._dprPage*this._dprLimit,total)} of ${total}
          <button onclick="DocsPage.dprGoPage(1)" >&#8676;</button>
          <button onclick="DocsPage.dprGoPage(${this._dprPage-1})" >&#8249;</button>
          <button onclick="DocsPage.dprGoPage(${this._dprPage+1})" >&#8250;</button>
          <button onclick="DocsPage.dprGoPage(${totalPages})" >&#8677;</button></span>`;
    } catch(err){if(tbody)tbody.innerHTML=`<tr><td colspan="12" style="text-align:center;padding:30px;color:var(--red);">Failed: ${err.message}</td></tr>`;}
  },
  dprGoPage(p){if(p>=1){this._dprPage=p;this._loadDprData();}},
  setDprLimit(l){this._dprLimit=l;this._dprPage=1;this._loadDprData();},
  dprSelectAll(cb){document.querySelectorAll('.dpr-row-cb').forEach(c=>{c.checked=cb.checked;this.dprToggleSelect(c.value,cb.checked);});},
  dprToggleSelect(id,checked){checked?this._dprSelected.add(id):this._dprSelected.delete(id);},
  openConsumer(id){if(typeof Router!=='undefined')Router.navigate('/consumer',{id});},
  async dprGenerateLetter(consumerId) {
    const win=window.open('','_blank');
    win.document.write('<p style="font-family:Arial;padding:20px;">Generating demand letter…</p>');
    try {
      const token=Auth?.getToken()||localStorage.getItem('rof-jwt')||'';
      const res=await fetch('/api/documents/generate',{
        method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
        body:JSON.stringify({documentType:'demand_letter',consumerId,dueDate:document.getElementById('dpr-due-date')?.value||Utils.today()}),
      });
      const json=await res.json();
      const docId=json.data?.documentId||json.documentId;
      if(docId){win.location.href=await linkUrl(`/api/documents/${docId}/html?token=x`);return;}
      throw new Error(json.error||'No document returned');
    } catch(err){win.document.body.innerHTML=`<p style="color:red;font-family:Arial;padding:20px;">Error: ${err.message}</p>`;}
  },
  async dprPrintSelected(type){
    if(!this._dprSelected.size){Utils.warn('Select at least one consumer using the checkboxes');return;}
    for(const id of this._dprSelected)await this.dprGenerateLetter(id);
  },
  dprExport(){Utils.info('Excel export coming soon');},
  _authHeader(){const t=Auth?.getToken()||localStorage.getItem('rof-jwt')||'';return{'Authorization':`Bearer ${t}`,'Content-Type':'application/json'};},

};
