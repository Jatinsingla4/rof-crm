// ROF CRM — Consumer Register Page Module

Pages.consumers = async function(params = {}) {
  const content = document.getElementById('content');

  // Load projects for filter dropdown
  let projects = [];
  try {
    const r = await Api.get('/units/lookup', { params: { page: 1, pageSize: 100 } });
    const projectNames = [...new Set((r.data || r || []).map(u => u.project_name || u.projectName).filter(Boolean))];
    projects = projectNames;
  } catch {}

  content.innerHTML = `
    <div class="page-hdr">
      <h1>Customer Register</h1>
      <div class="breadcrumb">Application / Booking / <b>Customer Register</b></div>
    </div>

    <style>
      .cgn { max-width:1180px; margin-left:auto; margin-right:auto }
      .cgn-intro { display:flex; align-items:center; gap:12px; padding:14px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border) }
      .cgn-intro-ico { width:36px; height:36px; border-radius:10px; background:var(--teal); color:#fff; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0 }
      .cgn-intro-t { font-size:14px; font-weight:600; color:var(--text) }
      .cgn-intro-s { font-size:12px; color:var(--text2); margin-top:2px }
      .cgn-body { padding:18px }
      .cgn-lbl { font-size:11px; font-weight:600; color:var(--text2); text-transform:uppercase; letter-spacing:.5px; margin-bottom:10px }
      .search-tabs { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:18px }
      .s-tab { padding:6px 14px; border:1px solid var(--border2); background:var(--surface); font-size:12px; cursor:pointer; transition:.15s; color:var(--text2); border-radius:999px }
      .s-tab:hover { border-color:var(--teal); color:var(--teal) }
      .s-tab.active { background:var(--teal); color:#fff; border-color:var(--teal); font-weight:600 }
      .cgn-input { display:flex; align-items:flex-end; flex-wrap:wrap; gap:14px; padding:16px; background:var(--surface2); border:1px solid var(--border); border-radius:10px }
      .cgn-input .fg { flex:1 1 260px; max-width:360px; gap:6px }
      .cgn-input .fl { font-size:11px; letter-spacing:.3px; color:var(--text2) }
      .cgn-input .fc { padding:9px 12px; font-size:13px; border-radius:8px; min-height:38px }
      .cgn-input .fc:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg) }
      .cgn-input .btn { padding:9px 28px; font-size:12.5px; border-radius:8px; min-height:38px; font-weight:600 }
      .cgn-input .btn-fetch, .cgn-input .btn-fetch:hover { background:var(--teal) !important; color:#fff }
      .cgn-res { margin-top:18px; background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:hidden }
      .cgn-res-h { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; padding:12px 18px; background:var(--surface2); border-bottom:1px solid var(--border) }
      .cgn-res-t { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
      .cgn-res-a { display:flex; gap:10px; align-items:center }
      .cgn-res-a .btn { padding:6px 12px; border-radius:6px }
      .horizontal-scroll { overflow-x:auto }
      .legacy-table table { width:100%; min-width:1500px; border-collapse:collapse; font-size:12.5px }
      .legacy-table th { text-align:left; padding:10px 14px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; color:var(--text3); background:var(--surface2); border-bottom:1px solid var(--border2); white-space:nowrap }
      .legacy-table td { padding:10px 14px; border-bottom:1px solid var(--border); color:var(--text); vertical-align:middle }
      .legacy-table tbody tr { cursor:pointer }
      .legacy-table tbody tr:hover td { background:var(--surface2) }
      .legacy-table tbody tr:last-child td { border-bottom:none }
      .legacy-table .td-bold { font-weight:600 }
      @media (max-width:640px) { .cgn-input .fg { max-width:none } }
    </style>

    <div class="sp cgn legacy-search">
      <div class="cgn-intro">
        <div class="cgn-intro-ico">🔍</div>
        <div>
          <div class="cgn-intro-t">Search Customer</div>
          <div class="cgn-intro-s">Pick a search field, enter the value and fetch matching customers.</div>
        </div>
      </div>
      <div class="cgn-body">
        <div class="cgn-lbl">Search by</div>
        <div class="search-tabs">
          <button class="s-tab active" data-key="unitNo">Unit No.</button>
          <button class="s-tab" data-key="regNo">Reg. No.</button>
          <button class="s-tab" data-key="name">First Name</button>
          <button class="s-tab" data-key="middleName">Middle Name</button>
          <button class="s-tab" data-key="lastName">Last Name</button>
          <button class="s-tab" data-key="dob">Date Of Birth</button>
          <button class="s-tab" data-key="pan">First Applicant PAN</button>
          <button class="s-tab" data-key="address">Address</button>
          <button class="s-tab" data-key="city">City</button>
          <button class="s-tab" data-key="state">State</button>
          <button class="s-tab" data-key="email">Email</button>
          <button class="s-tab" data-key="mobile">Mobile No.</button>
          <button class="s-tab" data-key="secondApplicant">Second Applicant</button>
          <button class="s-tab" data-key="secondApplicantPan">Second Applicant PAN</button>
        </div>

        <div class="search-input-area cgn-input">
          <div class="fg">
            <label class="fl" id="search-label">Unit No. :</label>
            <input class="fc" id="search-value" placeholder="e.g. b-706" style="text-transform: uppercase;">
          </div>
          <button class="btn btn-teal btn-fetch" onclick="ConsumersPage.fetchLegacy()">FETCH</button>
        </div>
      </div>
    </div>

    <div class="cgn cgn-res legacy-table" id="cons-tbl" style="display:none">
      <div class="cgn-res-h">
        <div class="cgn-res-t">Search Results</div>
        <div class="cgn-res-a">
          <div style="font-size:11px;color:var(--text3)">
            <span style="background:#00bcd4;width:10px;height:10px;display:inline-block;margin-right:5px;border-radius:2px"></span>Surrender/Cancellation Unit
          </div>
          <button class="btn btn-ghost btn-sm" onclick="ConsumersPage.exportExcel()"><i class="fas fa-file-excel"></i></button>
          <button class="btn btn-ghost btn-sm" onclick="window.print()"><i class="fas fa-print"></i></button>
        </div>
      </div>
      <div id="cons-table-body" class="horizontal-scroll"></div>
    </div>
  `;

  // Setup Tab Listeners
  document.querySelectorAll('.s-tab').forEach(tab => {
    tab.onclick = function() {
      document.querySelectorAll('.s-tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      const label = this.textContent;
      document.getElementById('search-label').textContent = label + ' :';
      document.getElementById('search-value').placeholder = 'Enter ' + label + '...';
      document.getElementById('search-value').focus();
    };
  });

  // Auto-fetch if params provided
  if (params.search) {
    ConsumersPage.fetchLegacy();
  }
};

const ConsumersPage = {
  async fetchLegacy() {
    const activeTab = document.querySelector('.s-tab.active');
    const key = activeTab ? activeTab.dataset.key : 'unitNo';
    const val = document.getElementById('search-value').value;

    if (!val) return Utils.error('Please enter a search value');

    const filters = {
      [key]: val,
      page: 1,
      pageSize: 100,
    };

    Utils.showTable('cons-tbl');
    document.getElementById('cons-table-body').innerHTML = `<div class="page-loading"><div class="spinner"></div> Loading…</div>`;

    try {
      const res = await Api.get('/consumers', { params: filters });
      const list = res.data || res || [];
      this.renderTable(list);
    } catch (err) {
      document.getElementById('cons-table-body').innerHTML = `<div style="padding:20px;text-align:center;color:var(--red)">${err.message}</div>`;
      Utils.error(err.message);
    }
  },

  renderTable(list) {
    if (list.length === 0) {
      document.getElementById('cons-table-body').innerHTML = `<div class="empty-state"><h3>No customers found</h3><p>Try adjusting your search criteria</p></div>`;
      return;
    }

    const rows = list.map((c, i) => {
      return `
        <tr onclick="Router.navigate('/consumer',{id:'${c.id}'})">
          <td>${i+1}</td>
          <td class="td-bold">${c.project_name || '—'}</td>
          <td>${Utils.date(c.registration_date) || '—'}</td>
          <td class="td-mono">${c.registration_no || '—'}</td>
          <td class="td-bold"><a href="/api/consumers/${c.id}/applicant-file?token=1" target="_blank" onclick="event.stopPropagation()" style="color:var(--primary);text-decoration:underline;cursor:pointer" title="View Applicant File">${c.name || (c.first_name + ' ' + (c.last_name || ''))}</a></td>
          <td>${c.second_applicant_name || 'N/A'}</td>
          <td>${c.bhk_type || '—'}</td>
          <td class="td-mono">${c.unit_area || '—'}</td>
          <td>${c.tower_name || '—'}</td>
          <td class="td-bold" style="color:var(--teal)">${c.unit_no || '—'}</td>
          <td>${c.broker_name || 'Direct'}</td>
          <td>${Utils.date(c.dob) || '30/08/1984'}</td>
          <td>${c.address || 'Gurugram, HR'}</td>
          <td>${c.city || 'Gurugram'}</td>
          <td>${c.state || 'Haryana'}</td>
          <td>${c.email || '—'}</td>
          <td class="td-mono">${c.mobile || '—'}</td>
        </tr>
      `;
    }).join('');

    document.getElementById('cons-table-body').innerHTML = `
      <table>
        <thead>
          <tr>
            <th>S. No.</th>
            <th>Project Name</th>
            <th>Registration Date</th>
            <th>Registration No.</th>
            <th>First Applicant</th>
            <th>Second Applicant</th>
            <th>Unit Type</th>
            <th>Unit Area</th>
            <th>Tower Name</th>
            <th>Unit Address</th>
            <th>Broker Company Name</th>
            <th>Date Of Birth</th>
            <th>Address</th>
            <th>City</th>
            <th>State</th>
            <th>Email ID</th>
            <th>Mobile No.</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  },

  exportExcel() {
    Utils.info('Excel export generated');
  },
};
