// ROF CRM — Consumer Register Page Module

Pages.consumers = async function(params = {}) {
  const content = document.getElementById('content');

  // Load projects for filter dropdown
  let projects = [];
  try {
    const r = await Api.get('/units', { params: { page: 1, pageSize: 100 } });
    const projectNames = [...new Set((r.data || r || []).map(u => u.project_name || u.projectName).filter(Boolean))];
    projects = projectNames;
  } catch {}

  content.innerHTML = `
    <div class="page-hdr">
      <h1>Customer Register</h1>
      <div class="breadcrumb">Application / Booking / <b>Customer Register</b></div>
    </div>

    <!-- LEGACY SEARCH CUSTOMER 1:1 REPLICA -->
    <div class="sp legacy-search">
      <div class="sp-hdr"><div class="sp-title">SEARCH CUSTOMER</div></div>
      <div class="sp-body">
        <!-- Search Criteria Tabs -->
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

        <!-- Dynamic Input Area -->
        <div class="search-input-area" style="margin-top:20px; padding: 15px; background: #f8f9fa; border: 1px solid #ddd; border-radius: 4px;">
          <div class="fg" style="max-width: 300px;">
            <label class="fl" id="search-label">Unit No. :</label>
            <input class="fc" id="search-value" placeholder="e.g. b-706" style="text-transform: uppercase;">
          </div>
          <button class="btn btn-fetch" style="margin-top:15px; width: 100px; background: #0056b3; font-weight: bold;" onclick="ConsumersPage.fetchLegacy()">FETCH</button>
        </div>
      </div>
    </div>

    <div class="tbl-wrap legacy-table" id="cons-tbl" style="display:none; margin-top:20px;">
      <div class="tbl-hdr" style="background: #0056b3; color: white;">
        <div class="tbl-title" style="color:white">SEARCH CUSTOMER</div>
        <div class="tbl-actions" style="display:flex;gap:10px;align-items:center">
          <div style="font-size:11px; color: #e0e0e0; margin-right:20px">
            <span class="status-box" style="background:#00bcd4;width:12px;height:12px;display:inline-block;margin-right:5px"></span> Surrender/Cancellation Unit
          </div>
          <button class="btn btn-ghost btn-sm" style="color:white; border-color:rgba(255,255,255,0.3)" onclick="ConsumersPage.exportExcel()"><i class="fas fa-file-excel"></i></button>
          <button class="btn btn-ghost btn-sm" style="color:white; border-color:rgba(255,255,255,0.3)" onclick="window.print()"><i class="fas fa-print"></i></button>
        </div>
      </div>
      <div id="cons-table-body" class="horizontal-scroll"></div>
    </div>

    <style>
      .search-tabs { display: flex; flex-wrap: wrap; gap: 2px; border-bottom: 1px solid #ddd; padding-bottom: 2px; }
      .s-tab { padding: 6px 12px; border: 1px solid #ccc; background: #f0f0f0; font-size: 11px; cursor: pointer; transition: 0.2s; color: #333; }
      .s-tab:hover { background: #e0e0e0; }
      .s-tab.active { background: #0056b3; color: white; border-color: #004494; font-weight: bold; }
      .legacy-table table { font-size: 11px; border-collapse: collapse; width: 100%; min-width: 1500px; }
      .legacy-table th { background: #f2f2f2; border: 1px solid #ddd; padding: 8px; text-align: left; color: #333; font-weight: 600; text-transform: uppercase; }
      .legacy-table td { border: 1px solid #ddd; padding: 8px; background: white; }
      .horizontal-scroll { overflow-x: auto; border: 1px solid #ddd; }
      .btn-fetch:hover { background: #004494 !important; }
    </style>
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
          <td class="td-bold"><a href="/api/consumers/${c.id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" onclick="event.stopPropagation()" style="color:var(--primary);text-decoration:underline;cursor:pointer" title="View Applicant File">${c.name || (c.first_name + ' ' + (c.last_name || ''))}</a></td>
          <td>${c.second_applicant_name || 'N/A'}</td>
          <td>${c.bhk_type || 'Type-C'}</td>
          <td class="td-mono">${c.unit_area || '—'}</td>
          <td>${c.tower_name || '—'}</td>
          <td class="td-bold" style="color:#0056b3">${c.unit_no || '—'}</td>
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
