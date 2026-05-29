// ROF CRM — Search Customer Page

const SearchCustomerPage = {

  TABS: [
    { id: 'regNo',             label: 'Reg. No.',            placeholder: 'Registration Number', type: 'text'  },
    { id: 'unitNo',            label: 'Unit No.',            placeholder: 'Unit Number',          type: 'text'  },
    { id: 'firstName',         label: 'First Name',          placeholder: 'First Name',           type: 'text'  },
    { id: 'middleName',        label: 'Middle Name',         placeholder: 'Middle Name',          type: 'text'  },
    { id: 'lastName',          label: 'Last Name',           placeholder: 'Last Name',            type: 'text'  },
    { id: 'dob',               label: 'Date Of Birth',       placeholder: '',                     type: 'date'  },
    { id: 'pan',               label: 'First Applicant PAN', placeholder: 'PAN Number',           type: 'text'  },
    { id: 'address',           label: 'Address',             placeholder: 'Address',              type: 'text'  },
    { id: 'city',              label: 'City',                placeholder: 'City',                 type: 'text'  },
    { id: 'state',             label: 'State',               placeholder: 'State',               type: 'text'  },
    { id: 'email',             label: 'Email',               placeholder: 'Email Address',        type: 'email' },
    { id: 'mobile',            label: 'Mobile No.',          placeholder: 'Mobile Number',        type: 'text'  },
    { id: 'secondApplicant',   label: 'Second Applicant',    placeholder: 'Second Applicant Name',type: 'text'  },
    { id: 'secondApplicantPan',label: 'Second Applicant PAN',placeholder: 'Second Applicant PAN', type: 'text'  },
  ],

  _activeTab: 'firstName',

  render() {
    const tabPills = this.TABS.map(t => `
      <button id="sc-tab-${t.id}" onclick="SearchCustomerPage.setTab('${t.id}')"
        style="padding:4px 9px;border:1px solid #0d9488;border-radius:3px;cursor:pointer;font-size:11px;white-space:nowrap;
               background:${t.id === this._activeTab ? '#0d9488' : 'white'};
               color:${t.id === this._activeTab ? 'white' : '#0d9488'};
               font-weight:${t.id === this._activeTab ? 'bold' : 'normal'};">
        ${t.label}
      </button>`).join('');

    return `
      <div style="font-family:Arial,sans-serif;font-size:13px;">

        <div style="background:white;border:1px solid #e0e0e0;border-radius:4px;margin-bottom:8px;">

          <!-- Header + tab pills -->
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#0d9488;border-left:4px solid #065f46;">
            <span style="font-weight:bold;color:white;font-size:14px;letter-spacing:0.5px;">SEARCH CUSTOMER</span>
            <span style="font-size:11px;color:#ffe0e0;">Press Alt+C to open anytime</span>
          </div>
          <div style="padding:8px 12px;background:#f8f9fa;border-bottom:1px solid #ddd;display:flex;flex-wrap:wrap;gap:3px;">
            ${tabPills}
          </div>

          <!-- Active tab input -->
          <div style="padding:12px 16px;background:#f0f8ff;border-bottom:1px solid #ddd;">
            <div id="sc-input-area">${this._renderInput()}</div>
          </div>

          <!-- Fetch bar -->
          <div style="padding:8px 16px;background:#e9ecef;display:flex;align-items:center;gap:10px;">
            <button id="sc-fetch-btn" onclick="SearchCustomerPage.fetch()"
              style="background:#1976D2;color:white;border:none;padding:6px 22px;border-radius:2px;cursor:pointer;font-size:13px;font-weight:bold;letter-spacing:0.5px;">
              FETCH
            </button>
            <button onclick="SearchCustomerPage.clearSearch()"
              style="background:#6b7280;color:white;border:none;padding:6px 14px;border-radius:2px;cursor:pointer;font-size:12px;">
              Clear
            </button>
            <span id="sc-result-count" style="font-size:12px;color:#555;margin-left:6px;"></span>
          </div>
        </div>

        <!-- Results -->
        <div id="sc-results" style="background:white;border:1px solid #e0e0e0;border-radius:4px;display:none;"></div>

      </div>`;
  },

  _renderInput() {
    const tab = this.TABS.find(t => t.id === this._activeTab);
    if (!tab) return '';
    return `
      <div style="display:flex;align-items:center;gap:12px;">
        <label style="font-size:12px;font-weight:600;color:#333;min-width:140px;white-space:nowrap;">${tab.label}:</label>
        <input type="${tab.type}" id="sc-search-input" placeholder="${tab.placeholder}"
          style="padding:6px 10px;border:1px solid #999;border-radius:2px;font-size:13px;min-width:280px;"
          onkeydown="if(event.key==='Enter') SearchCustomerPage.fetch()">
      </div>`;
  },

  setTab(tabId) {
    this._activeTab = tabId;
    this.TABS.forEach(t => {
      const btn = document.getElementById(`sc-tab-${t.id}`);
      if (!btn) return;
      const active = t.id === tabId;
      btn.style.background  = active ? '#0d9488' : 'white';
      btn.style.color       = active ? 'white' : '#0d9488';
      btn.style.fontWeight  = active ? 'bold' : 'normal';
    });
    const area = document.getElementById('sc-input-area');
    if (area) area.innerHTML = this._renderInput();
    setTimeout(() => document.getElementById('sc-search-input')?.focus(), 50);
    const res = document.getElementById('sc-results');
    if (res) { res.style.display = 'none'; res.innerHTML = ''; }
    const cnt = document.getElementById('sc-result-count');
    if (cnt) cnt.textContent = '';
  },

  async fetch() {
    const input = document.getElementById('sc-search-input');
    const value = (input?.value || '').trim();
    if (!value) { input?.focus(); return; }

    const btn = document.getElementById('sc-fetch-btn');
    if (btn) { btn.textContent = 'Searching…'; btn.disabled = true; }

    try {
      const params = new URLSearchParams();
      params.set(this._activeTab, value);
      params.set('pageSize', '200');

      const token = Auth?.getToken?.() || localStorage.getItem('rof-jwt') || '';
      const res = await fetch(`/api/consumers?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      const consumers = json.data || [];

      const cnt = document.getElementById('sc-result-count');
      if (cnt) cnt.textContent = consumers.length === 0
        ? 'No results found'
        : `${consumers.length} result${consumers.length !== 1 ? 's' : ''} found`;

      this._renderResults(consumers);
    } catch {
      const cnt = document.getElementById('sc-result-count');
      if (cnt) cnt.textContent = 'Search failed — check connection';
    } finally {
      if (btn) { btn.textContent = 'FETCH'; btn.disabled = false; }
    }
  },

  _renderResults(consumers) {
    const container = document.getElementById('sc-results');
    if (!container) return;
    container.style.display = 'block';

    if (!consumers.length) {
      container.innerHTML = `<div style="padding:30px;text-align:center;color:#999;font-size:13px;">No customers found matching your search criteria.</div>`;
      return;
    }

    const rows = consumers.map((c, i) => {
      const name = c.name || `${c.first_name||''} ${c.last_name||''}`.trim() || '—';
      const even = i % 2 === 0;
      return `<tr style="background:${even?'white':'#f9f9f9'};border-bottom:1px solid #e8e8e8;"
                onmouseover="this.style.background='#e8eaf6'" onmouseout="this.style.background='${even?'white':'#f9f9f9'}'">
        <td style="padding:7px 10px;">${i+1}</td>
        <td style="padding:7px 10px;font-weight:500;color:#1a237e;">${c.registration_no||'—'}</td>
        <td style="padding:7px 10px;">${name}</td>
        <td style="padding:7px 10px;">${c.mobile||'—'}</td>
        <td style="padding:7px 10px;font-size:11px;color:#555;">${c.email||'—'}</td>
        <td style="padding:7px 10px;font-weight:500;">${c.unit_number||'—'}</td>
        <td style="padding:7px 10px;font-size:11px;">${c.project_name||'—'}</td>
        <td style="padding:7px 10px;">
          <span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:bold;
                       background:${c.lead_stage==='allotted'?'#c8e6c9':c.lead_stage==='booked'?'#fff9c4':'#f3f4f6'};
                       color:${c.lead_stage==='allotted'?'#2e7d32':c.lead_stage==='booked'?'#f57f17':'#374151'};">
            ${(c.lead_stage||'—').toUpperCase()}
          </span>
        </td>
        <td style="padding:7px 10px;text-align:center;white-space:nowrap;">
          <button onclick="SearchCustomerPage.openConsumer('${c.id}')"
            style="background:#1976D2;color:white;border:none;padding:3px 10px;border-radius:2px;cursor:pointer;font-size:11px;margin-right:3px;">View</button>
          <button onclick="SearchCustomerPage.openApplicantFile('${c.id}')"
            style="background:#0d9488;color:white;border:none;padding:3px 10px;border-radius:2px;cursor:pointer;font-size:11px;">File</button>
        </td>
      </tr>`;
    }).join('');

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 14px;background:#1a237e;color:white;">
        <span style="font-weight:bold;font-size:13px;">Search Results (${consumers.length})</span>
        <button onclick="window.print()" style="background:white;color:#1a237e;border:none;padding:4px 12px;border-radius:2px;cursor:pointer;font-size:12px;">🖨️ Print</button>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="background:#e8eaf6;">
            <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #1a237e;">S.No</th>
            <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #1a237e;white-space:nowrap;">Reg. No.</th>
            <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #1a237e;">Name</th>
            <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #1a237e;white-space:nowrap;">Mobile</th>
            <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #1a237e;">Email</th>
            <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #1a237e;white-space:nowrap;">Unit No.</th>
            <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #1a237e;">Project</th>
            <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #1a237e;">Status</th>
            <th style="padding:8px 10px;text-align:center;border-bottom:2px solid #1a237e;">Action</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  openConsumer(id)         { if (typeof Router !== 'undefined') Router.navigate('/consumer', { id }); },
  openApplicantFile(id)    { const t = Auth?.getToken?.() || localStorage.getItem('rof-jwt') || ''; window.open(`/api/consumers/${id}/applicant-file?token=${t}`, '_blank'); },

  clearSearch() {
    const input = document.getElementById('sc-search-input');
    if (input) input.value = '';
    const res = document.getElementById('sc-results');
    if (res) { res.style.display = 'none'; res.innerHTML = ''; }
    const cnt = document.getElementById('sc-result-count');
    if (cnt) cnt.textContent = '';
    input?.focus();
  },

  init() {
    setTimeout(() => document.getElementById('sc-search-input')?.focus(), 100);
  }
};

if (typeof Pages !== 'undefined') {
  Pages.searchCustomer = (params = {}) => {
    const container = document.getElementById('content');
    if (!container) return;
    container.innerHTML = SearchCustomerPage.render();
    SearchCustomerPage.init();
  };
}
