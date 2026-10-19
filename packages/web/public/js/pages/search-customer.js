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
      <button id="sc-tab-${t.id}" class="scn-pill${t.id === this._activeTab ? ' on' : ''}" onclick="SearchCustomerPage.setTab('${t.id}')">
        ${t.label}
      </button>`).join('');

    return `
      <style>
        .scn { max-width:1180px; margin-left:auto; margin-right:auto; font-size:13px }
        .scn-card { background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:hidden; margin-bottom:16px }
        .scn-hdr { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; padding:14px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border) }
        .scn-title { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
        .scn-hint { font-size:11px; color:var(--text3) }
        .scn-pills { padding:16px 18px 4px; display:flex; flex-wrap:wrap; gap:8px }
        .scn-pill { padding:6px 14px; border:1px solid var(--border2); border-radius:999px; cursor:pointer; font-size:12px; white-space:nowrap; background:var(--surface); color:var(--text2); transition:.15s }
        .scn-pill:hover { border-color:var(--teal); color:var(--teal) }
        .scn-pill.on { background:var(--teal); color:#fff; border-color:var(--teal); font-weight:600 }
        .scn-input { padding:12px 18px 18px }
        .scn-row { display:flex; align-items:center; gap:14px; flex-wrap:wrap }
        .scn-lbl { font-size:12px; font-weight:500; color:var(--text2); min-width:140px; white-space:nowrap }
        .scn-fc { padding:9px 12px; border:1px solid var(--border2); border-radius:8px; font-size:13px; min-width:300px; min-height:38px; background:var(--surface); color:var(--text); box-sizing:border-box }
        .scn-fc:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg); outline:none }
        .scn-bar { padding:14px 18px; background:var(--surface2); border-top:1px solid var(--border2); display:flex; align-items:center; gap:12px; flex-wrap:wrap }
        .scn-btn { background:var(--teal); color:#fff; border:none; padding:9px 26px; border-radius:8px; cursor:pointer; font-size:12.5px; font-weight:600; min-height:38px }
        .scn-btn:hover { filter:brightness(.92) }
        .scn-btn:disabled { opacity:.65; cursor:default }
        .scn-btn-ghost { background:var(--surface); color:var(--text2); border:1px solid var(--border2); padding:9px 18px; border-radius:8px; cursor:pointer; font-size:12.5px; min-height:38px }
        .scn-btn-ghost:hover { background:var(--surface2) }
        .scn-count { font-size:12px; color:var(--text2) }
        .scn-res-hdr { display:flex; justify-content:space-between; align-items:center; padding:14px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border) }
        .scn-scroll { overflow-x:auto }
        .scn-tbl { width:100%; border-collapse:collapse; font-size:12.5px }
        .scn-tbl th { text-align:left; padding:10px 14px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; color:var(--text3); background:var(--surface2); border-bottom:1px solid var(--border2); white-space:nowrap }
        .scn-tbl td { padding:10px 14px; border-bottom:1px solid var(--border); color:var(--text); vertical-align:middle }
        .scn-tbl tbody tr:hover td { background:var(--surface2) }
        .scn-tbl tbody tr:last-child td { border-bottom:none }
        .scn-tbl td.scn-reg { font-weight:600; color:var(--teal) }
        .scn-tbl td.scn-sub { font-size:11px; color:var(--text2) }
        .scn-badge { display:inline-block; padding:2px 10px; border-radius:999px; font-size:10px; font-weight:700 }
        .scn-badge.allotted { background:#c8e6c9; color:#2e7d32 }
        .scn-badge.booked { background:#fff9c4; color:#f57f17 }
        .scn-badge.other { background:var(--surface2); color:var(--text2); border:1px solid var(--border2) }
        .scn-act { border:none; padding:4px 12px; border-radius:6px; cursor:pointer; font-size:11.5px; font-weight:600; margin-right:4px }
        .scn-act.view { background:var(--teal); color:#fff }
        .scn-act.file { background:var(--surface); color:var(--teal); border:1px solid var(--teal) }
        .scn-empty { padding:36px 18px; text-align:center; color:var(--text3); font-size:13px }
      </style>
      <div class="scn">

        <div class="scn-card">

          <!-- Header + tab pills -->
          <div class="scn-hdr">
            <span class="scn-title">Search Customer</span>
            <span class="scn-hint">Press Alt+C to open anytime</span>
          </div>
          <div class="scn-pills">
            ${tabPills}
          </div>

          <!-- Active tab input -->
          <div class="scn-input">
            <div id="sc-input-area">${this._renderInput()}</div>
          </div>

          <!-- Fetch bar -->
          <div class="scn-bar">
            <button id="sc-fetch-btn" class="scn-btn" onclick="SearchCustomerPage.fetch()">FETCH</button>
            <button class="scn-btn-ghost" onclick="SearchCustomerPage.clearSearch()">Clear</button>
            <span id="sc-result-count" class="scn-count"></span>
          </div>
        </div>

        <!-- Results -->
        <div id="sc-results" class="scn-card" style="display:none;"></div>

      </div>`;
  },

  _renderInput() {
    const tab = this.TABS.find(t => t.id === this._activeTab);
    if (!tab) return '';
    return `
      <div class="scn-row">
        <label class="scn-lbl">${tab.label}:</label>
        <input type="${tab.type}" id="sc-search-input" class="scn-fc" placeholder="${tab.placeholder}"
          onkeydown="if(event.key==='Enter') SearchCustomerPage.fetch()">
      </div>`;
  },

  setTab(tabId) {
    this._activeTab = tabId;
    this.TABS.forEach(t => {
      const btn = document.getElementById(`sc-tab-${t.id}`);
      if (btn) btn.classList.toggle('on', t.id === tabId);
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
      container.innerHTML = `<div class="scn-empty">No customers found matching your search criteria.</div>`;
      return;
    }

    const rows = consumers.map((c, i) => {
      const name = c.name || `${c.first_name||''} ${c.last_name||''}`.trim() || '—';
      const badge = c.lead_stage === 'allotted' ? 'allotted' : c.lead_stage === 'booked' ? 'booked' : 'other';
      return `<tr>
        <td>${i+1}</td>
        <td class="scn-reg">${c.registration_no||'—'}</td>
        <td>${name}</td>
        <td>${c.mobile||'—'}</td>
        <td class="scn-sub">${c.email||'—'}</td>
        <td style="font-weight:600">${c.unit_number||'—'}</td>
        <td class="scn-sub">${c.project_name||'—'}</td>
        <td><span class="scn-badge ${badge}">${(c.lead_stage||'—').toUpperCase()}</span></td>
        <td style="text-align:center;white-space:nowrap;">
          <button class="scn-act view" onclick="SearchCustomerPage.openConsumer('${c.id}')">View</button>
          <button class="scn-act file" onclick="SearchCustomerPage.openApplicantFile('${c.id}')">File</button>
        </td>
      </tr>`;
    }).join('');

    container.innerHTML = `
      <div class="scn-res-hdr">
        <span class="scn-title">Search Results (${consumers.length})</span>
        <button class="scn-btn-ghost" onclick="window.print()">🖨️ Print</button>
      </div>
      <div class="scn-scroll">
        <table class="scn-tbl">
          <thead><tr>
            <th>S.No</th>
            <th>Reg. No.</th>
            <th>Name</th>
            <th>Mobile</th>
            <th>Email</th>
            <th>Unit No.</th>
            <th>Project</th>
            <th>Status</th>
            <th style="text-align:center">Action</th>
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
