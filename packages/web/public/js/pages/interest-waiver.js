/**
 * Interest Waiver — Interest Waive Off
 * View 1: filter + consumer list
 * View 2: per-installment detail + waiver form
 */
const InterestWaiver = (() => {

  let _state = {
    view: 'list',           // 'list' | 'detail'
    projects: [],
    consumers: [],
    selectedProject: null,
    detail: null,           // { consumer, rows, penal_interest_ids, payment_plan_id, summary }
    autoScroll: false,      // true when opened via "Waive Off" link
  };

  // ── helpers ──────────────────────────────────────────────────────────────

  function fmt(n) {
    const num = parseFloat(n) || 0;
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtDate(d) {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yyyy = dt.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  async function loadProjects() {
    try {
      const res = await Api.get('/projects');
      _state.projects = res.data || res || [];
    } catch (e) {
      _state.projects = [];
    }
  }

  // ── VIEW 1: list ──────────────────────────────────────────────────────────

  function renderList() {
    const projOptions = _state.projects.map(p =>
      `<option value="${p.id}">${p.name || p.project_name || p.id}</option>`
    ).join('');

    return `
<div style="background:#fff;min-height:100vh;padding:16px;">

  <!-- Filter card -->
  <div style="border:1px solid #ccc;border-radius:4px;margin-bottom:16px;">
    <div style="background:#1d3a6e;color:#fff;padding:8px 14px;display:flex;justify-content:space-between;align-items:center;border-radius:4px 4px 0 0;">
      <strong style="font-size:14px;letter-spacing:.5px;">INTEREST WAIVE OFF</strong>
      <span id="iw-collapse-btn" style="cursor:pointer;font-size:18px;line-height:1;" onclick="InterestWaiver._toggleFilter()">&#8722;</span>
    </div>
    <div id="iw-filter-body" style="background:#f5f5f5;padding:12px 14px;">
      <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;">
        <div>
          <label style="font-size:12px;display:block;margin-bottom:3px;">*Project:</label>
          <select id="iw-proj" style="min-width:160px;padding:5px 8px;border:1px solid #ccc;border-radius:3px;font-size:13px;">
            <option value="">-- Select --</option>
            ${projOptions}
          </select>
        </div>
        <div>
          <label style="font-size:12px;display:block;margin-bottom:3px;">Type:</label>
          <select id="iw-type" style="min-width:140px;padding:5px 8px;border:1px solid #ccc;border-radius:3px;font-size:13px;">
            <option value="All">&lt;--All--&gt;</option>
            <option value="Self">Self</option>
            <option value="Pending">Pending</option>
            <option value="Loan Sanctioned">Loan Sanctioned</option>
          </select>
        </div>
        <div>
          <label style="font-size:12px;display:block;margin-bottom:3px;">Registration No.:</label>
          <input id="iw-regno" type="text" placeholder="Registration No." style="padding:5px 8px;border:1px solid #ccc;border-radius:3px;font-size:13px;width:140px;">
        </div>
        <div>
          <label style="font-size:12px;display:block;margin-bottom:3px;">First Name:</label>
          <input id="iw-name" type="text" placeholder="First Name" style="padding:5px 8px;border:1px solid #ccc;border-radius:3px;font-size:13px;width:130px;">
        </div>
        <div>
          <label style="font-size:12px;display:block;margin-bottom:3px;">Unit Address:</label>
          <input id="iw-addr" type="text" placeholder="Unit Address" style="padding:5px 8px;border:1px solid #ccc;border-radius:3px;font-size:13px;width:130px;">
        </div>
        <div>
          <button onclick="InterestWaiver._fetchList()" style="padding:6px 18px;background:#d9534f;color:#fff;border:none;border-radius:3px;font-size:13px;cursor:pointer;font-weight:600;">FETCH</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Results -->
  <div id="iw-results"></div>
</div>`;
  }

  function _toggleFilter() {
    const body = document.getElementById('iw-filter-body');
    const btn  = document.getElementById('iw-collapse-btn');
    if (!body) return;
    if (body.style.display === 'none') {
      body.style.display = '';
      btn.innerHTML = '&#8722;';
    } else {
      body.style.display = 'none';
      btn.innerHTML = '&#43;';
    }
  }

  async function _fetchList() {
    const projId   = document.getElementById('iw-proj').value;
    const typeVal  = document.getElementById('iw-type').value;
    const regno    = document.getElementById('iw-regno').value.trim();
    const name     = document.getElementById('iw-name').value.trim();
    const addr     = document.getElementById('iw-addr').value.trim();

    if (!projId) { alert('Please select a project.'); return; }

    const proj = _state.projects.find(p => p.id === projId);
    _state.selectedProject = proj;

    const resultsDiv = document.getElementById('iw-results');
    resultsDiv.innerHTML = '<div style="padding:16px;color:#555;font-size:13px;">Loading...</div>';

    try {
      const params = new URLSearchParams({ project_id: projId });
      if (typeVal && typeVal !== 'All') params.append('type', typeVal);
      if (regno) params.append('registration_no', regno);
      if (name)  params.append('first_name', name);
      if (addr)  params.append('unit_address', addr);

      const res = await Api.get(`/payments/interest-waiver-list?${params.toString()}`);
      const data = res.data || [];
      _state.consumers = data;
      renderConsumerTable(data, proj);
    } catch (e) {
      resultsDiv.innerHTML = `<div style="color:red;padding:12px;font-size:13px;">Error: ${e.message}</div>`;
    }
  }

  function renderConsumerTable(data, proj) {
    const resultsDiv = document.getElementById('iw-results');
    if (!data.length) {
      resultsDiv.innerHTML = '<div style="padding:16px;color:#555;font-size:13px;">No records found.</div>';
      return;
    }

    const projName = proj ? (proj.name || proj.project_name || proj.id) : '';

    const rows = data.map((r, i) => {
      const bg = i === 0 ? 'background:#f5f0dc;' : (i % 2 === 0 ? 'background:#fafafa;' : '');
      return `<tr style="${bg}">
        <td style="padding:6px 8px;text-align:center;font-size:12px;">${i + 1}</td>
        <td style="padding:6px 8px;font-size:12px;">${r.registration_no || ''}</td>
        <td style="padding:6px 8px;font-size:12px;color:#337ab7;cursor:pointer;" onclick="InterestWaiver._openDetail(${i},false)">${r.name || ''}</td>
        <td style="padding:6px 8px;font-size:12px;">${r.unit_address || ''}</td>
        <td style="padding:6px 8px;font-size:12px;">${r.type || ''}</td>
        <td style="padding:6px 8px;text-align:right;font-size:12px;">${fmt(r.total_interest_inr)}</td>
        <td style="padding:6px 8px;text-align:right;font-size:12px;">${fmt(r.total_waived_inr)}</td>
        <td style="padding:6px 8px;text-align:right;font-size:12px;">${fmt(r.paid_interest_inr)}</td>
        <td style="padding:6px 8px;text-align:right;font-size:12px;">${fmt(r.balance_interest_inr)}</td>
        <td style="padding:6px 8px;text-align:center;font-size:12px;"><a href="#" style="color:#337ab7;text-decoration:none;" onclick="event.preventDefault();InterestWaiver._openDetail(${i},false)">Detail</a></td>
        <td style="padding:6px 8px;text-align:center;font-size:12px;"><a href="#" style="color:#337ab7;text-decoration:none;" onclick="event.preventDefault();InterestWaiver._openDetail(${i},true)">Waive Off</a></td>
      </tr>`;
    }).join('');

    const thStyle = 'padding:8px;background:#1d3a6e;color:#fff;font-size:12px;font-weight:600;white-space:nowrap;';

    resultsDiv.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:center;background:#1d3a6e;color:#fff;padding:8px 14px;border-radius:4px 4px 0 0;margin-top:4px;">
  <strong style="font-size:13px;">PROJECT : ${projName.toUpperCase()}</strong>
  <div style="display:flex;gap:8px;">
    <span style="cursor:pointer;font-size:16px;" title="Print" onclick="window.print()">&#128438;</span>
    <span style="cursor:pointer;font-size:16px;" title="Download">&#8659;</span>
  </div>
</div>
<div style="overflow-x:auto;border:1px solid #ccc;border-top:none;">
  <table style="width:100%;border-collapse:collapse;">
    <thead>
      <tr>
        <th style="${thStyle}">S.NO.</th>
        <th style="${thStyle}">REGISTRATION NO.</th>
        <th style="${thStyle}">NAME</th>
        <th style="${thStyle}">ADDRESS</th>
        <th style="${thStyle}">TYPE</th>
        <th style="${thStyle}">INTEREST AMOUNT</th>
        <th style="${thStyle}">WAIVE OFF AMOUNT</th>
        <th style="${thStyle}">PAID INTEREST</th>
        <th style="${thStyle}">BALANCE INTEREST</th>
        <th style="${thStyle}">DETAIL</th>
        <th style="${thStyle}">WAIVE OFF</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</div>`;
  }

  // ── VIEW 2: detail ────────────────────────────────────────────────────────

  async function _openDetail(idx, autoScroll) {
    const consumer = _state.consumers[idx];
    if (!consumer) return;

    const content = document.getElementById('content') || document.body;
    content.innerHTML = '<div style="padding:24px;color:#555;font-size:13px;">Loading interest data...</div>';

    try {
      const token = localStorage.getItem('rof-jwt');
      const resp = await fetch(`/api/payments/consumer-interest-detail/${consumer.consumer_id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();

      _state.detail = {
        consumer,
        rows: json.rows || [],
        penal_interest_ids: json.penal_interest_ids || {},
        payment_plan_id: json.payment_plan_id || null,
        summary: json.summary || { total_interest: 0, total_waived: 0, balance_interest: 0 },
      };
      _state.view = 'detail';
      _state.autoScroll = !!autoScroll;

      renderDetailView(content);
    } catch (e) {
      content.innerHTML = `<div style="color:red;padding:16px;font-size:13px;">Error loading detail: ${e.message}</div>`;
    }
  }

  function renderDetailView(container) {
    const { consumer, rows, summary } = _state.detail;
    const proj = _state.selectedProject;
    const projName = proj ? (proj.name || proj.project_name || '') : '';

    const thS = 'padding:8px;background:#1d3a6e;color:#fff;font-size:12px;font-weight:600;text-align:center;white-space:nowrap;';
    const tdS = 'padding:6px 8px;font-size:12px;text-align:center;';
    const tdR = 'padding:6px 8px;font-size:12px;text-align:right;';

    let totalInterest = 0;
    const tableRows = rows.map((r, i) => {
      totalInterest += parseFloat(r.interest_amount) || 0;
      const bg = i % 2 === 0 ? '' : 'background:#f9f9f9;';
      return `<tr style="${bg}">
        <td style="${tdS}">${i + 1}</td>
        <td style="padding:6px 8px;font-size:12px;">${r.installment_name || ''}</td>
        <td style="${tdS}">${fmtDate(r.installment_date)}</td>
        <td style="${tdR}">${fmt(r.amount_received)}</td>
        <td style="${tdS}">${fmtDate(r.date_received)}</td>
        <td style="${tdR}">${fmt(r.delay_amount)}</td>
        <td style="${tdS}">${r.delay_days != null ? r.delay_days : ''}</td>
        <td style="${tdS}">${r.roi != null ? r.roi : ''}</td>
        <td style="${tdR}">${fmt(r.interest_amount)}</td>
      </tr>`;
    }).join('');

    // Build installment dropdown options
    const interestRows = rows.filter(r => parseFloat(r.interest_amount) > 0);
    const instOpts = `<option value="__all__">&lt;--All--&gt;</option>` +
      interestRows.map(r =>
        `<option value="${r.installment_index}">${r.installment_name}</option>`
      ).join('');

    const s = summary;

    container.innerHTML = `
<div style="background:#fff;min-height:100vh;padding:16px;">

  <div style="border:1px solid #ccc;border-radius:4px;">
    <div style="background:#1d3a6e;color:#fff;padding:8px 14px;border-radius:4px 4px 0 0;">
      <strong style="font-size:14px;letter-spacing:.5px;">INTEREST WAIVE OFF</strong>
    </div>
    <div style="padding:12px 14px;background:#fff;border-bottom:1px solid #eee;display:flex;flex-wrap:wrap;gap:24px;">
      <span style="font-size:13px;"><strong>Project:</strong> ${projName}</span>
      <span style="font-size:13px;"><strong>Customer Name:</strong> ${consumer.name || ''}</span>
      <span style="font-size:13px;"><strong>Registration No.:</strong> ${consumer.registration_no || ''}</span>
    </div>

    <!-- Interest breakdown table -->
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="${thS}">S.NO.</th>
            <th style="${thS};text-align:left;">INSTALLMENT NAME</th>
            <th style="${thS}">INSTALLMENT DATE</th>
            <th style="${thS}">AMOUNT REC.</th>
            <th style="${thS}">DATE OF REC.</th>
            <th style="${thS}">DELAY AMOUNT</th>
            <th style="${thS}">DELAY DAYS</th>
            <th style="${thS}">ROI</th>
            <th style="${thS}">INTEREST AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
          <tr style="font-weight:600;background:#f0f0f0;">
            <td colspan="8" style="padding:7px 8px;font-size:12px;text-align:right;">Total:</td>
            <td style="${tdR};font-weight:600;">${fmt(totalInterest)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Waiver form -->
    <div id="iw-waiver-form" style="padding:14px 16px;border-top:2px solid #ccc;background:#fdfdfd;">

      <!-- Row 1: labels + values -->
      <div style="display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start;margin-bottom:12px;">
        <div>
          <div style="font-size:12px;margin-bottom:3px;">Installment Name</div>
          <select id="iw-inst-select" onchange="InterestWaiver._onInstChange()" style="padding:5px 8px;border:1px solid #ccc;border-radius:3px;font-size:12px;min-width:160px;">
            ${instOpts}
          </select>
        </div>
        <div>
          <div style="font-size:12px;margin-bottom:3px;">Interest Amount : <strong id="iw-disp-interest">${fmt(s.total_interest)}</strong></div>
        </div>
        <div>
          <div style="font-size:12px;margin-bottom:3px;">Previous Waive Off Amount : <strong id="iw-disp-prev-waive">${fmt(s.total_waived)}</strong></div>
        </div>
        <div>
          <div style="font-size:12px;margin-bottom:3px;">Paid Interest : <strong id="iw-disp-paid">0.00</strong></div>
        </div>
        <div>
          <div style="font-size:12px;margin-bottom:3px;">Balance Interest : <strong id="iw-disp-balance">${fmt(s.balance_interest)}</strong></div>
        </div>
        <div>
          <div style="font-size:12px;margin-bottom:3px;">Waive Off Amount</div>
          <input id="iw-waive-amt" type="number" min="0" step="0.01" style="padding:5px 8px;border:1px solid #ccc;border-radius:3px;font-size:12px;width:120px;">
        </div>
      </div>

      <!-- Row 2: auth + document + remark -->
      <div style="display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start;margin-bottom:14px;">
        <div>
          <div style="font-size:12px;margin-bottom:3px;">Auth. By</div>
          <input id="iw-auth-by" type="text" style="padding:5px 8px;border:1px solid #ccc;border-radius:3px;font-size:12px;width:150px;">
        </div>
        <div>
          <div style="font-size:12px;margin-bottom:3px;">Attach Document</div>
          <input id="iw-doc" type="file" accept=".pdf,.jpg,.jpeg,.png" style="font-size:12px;">
        </div>
        <div>
          <div style="font-size:12px;margin-bottom:3px;">Remark</div>
          <textarea id="iw-remark" rows="3" style="padding:5px 8px;border:1px solid #ccc;border-radius:3px;font-size:12px;width:220px;resize:vertical;"></textarea>
        </div>
      </div>

      <!-- Buttons -->
      <div style="display:flex;gap:10px;">
        <button onclick="InterestWaiver._saveWaiver()" style="padding:7px 22px;background:#337ab7;color:#fff;border:none;border-radius:3px;font-size:13px;cursor:pointer;font-weight:600;">SAVE</button>
        <button onclick="InterestWaiver._backToList()" style="padding:7px 22px;background:#6c757d;color:#fff;border:none;border-radius:3px;font-size:13px;cursor:pointer;">BACK</button>
      </div>

      <div id="iw-save-msg" style="margin-top:10px;font-size:13px;"></div>
    </div>
  </div>
</div>`;

    if (_state.autoScroll) {
      setTimeout(() => {
        const form = document.getElementById('iw-waiver-form');
        if (form) form.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }

  function _onInstChange() {
    const sel = document.getElementById('iw-inst-select');
    if (!sel || !_state.detail) return;
    const val = sel.value;
    const { rows, summary } = _state.detail;

    let interest = 0;
    if (val === '__all__') {
      interest = summary.total_interest;
    } else {
      const idx = parseInt(val);
      const row = rows.find(r => r.installment_index === idx);
      interest = row ? (parseFloat(row.interest_amount) || 0) : 0;
    }

    const disp = document.getElementById('iw-disp-interest');
    const balance = document.getElementById('iw-disp-balance');
    const prevWaive = document.getElementById('iw-disp-prev-waive');
    if (disp)     disp.textContent = fmt(interest);
    if (prevWaive) prevWaive.textContent = fmt(0);
    if (balance)  balance.textContent = fmt(interest);
  }

  async function _saveWaiver() {
    const { consumer, penal_interest_ids, payment_plan_id, summary } = _state.detail;

    const sel        = document.getElementById('iw-inst-select');
    const amtInput   = document.getElementById('iw-waive-amt');
    const authInput  = document.getElementById('iw-auth-by');
    const remarkInput = document.getElementById('iw-remark');
    const msgDiv     = document.getElementById('iw-save-msg');

    const instVal  = sel ? sel.value : '__all__';
    const waiverAmt = parseFloat(amtInput ? amtInput.value : '0');
    const authBy   = authInput ? authInput.value.trim() : '';
    const remark   = remarkInput ? remarkInput.value.trim() : '';

    if (!waiverAmt || waiverAmt <= 0) {
      msgDiv.innerHTML = '<span style="color:red;">Waive Off Amount must be greater than 0.</span>';
      return;
    }
    if (!authBy) {
      msgDiv.innerHTML = '<span style="color:red;">Auth. By is required.</span>';
      return;
    }

    const installment_index = instVal === '__all__' ? null : parseInt(instVal);

    const body = {
      consumer_id:        consumer.consumer_id,
      payment_plan_id:    payment_plan_id || null,
      installment_index:  installment_index,
      waiver_amount_inr:  Math.round(waiverAmt),
      reason:             remark || null,
      authorized_by_name: authBy,
      document_path:      null,
    };

    msgDiv.innerHTML = '<span style="color:#555;">Saving...</span>';

    try {
      const token = localStorage.getItem('rof-jwt');
      const resp = await fetch('/api/payments/interest-waivers/direct', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const json = await resp.json();
      if (!resp.ok) {
        msgDiv.innerHTML = `<span style="color:red;">Error: ${json.error || resp.statusText}</span>`;
        return;
      }
      msgDiv.innerHTML = '<span style="color:green;">Waiver saved successfully.</span>';
      _backToList();
      setTimeout(() => _fetchList(), 300);
    } catch (e) {
      msgDiv.innerHTML = `<span style="color:red;">Error: ${e.message}</span>`;
    }
  }

  function _backToList() {
    _state.view = 'list';
    _state.detail = null;
    const content = document.getElementById('content') || document.body;
    content.innerHTML = renderList();
    _attachListEvents();

    // Re-populate project dropdown with current selection and re-render table
    setTimeout(() => {
      const projSel = document.getElementById('iw-proj');
      if (projSel && _state.selectedProject) {
        projSel.value = _state.selectedProject.id;
      }
      if (_state.consumers.length && _state.selectedProject) {
        renderConsumerTable(_state.consumers, _state.selectedProject);
      }
    }, 0);
  }

  function _attachListEvents() {
    // events are inline onclick — nothing extra needed
  }

  // ── VIEW 3: customer waiver report ───────────────────────────────────────

  function renderReport() {
    const projOptions = _state.projects.map(p =>
      `<option value="${p.id}">${p.name || p.project_name || p.id}</option>`
    ).join('');

    return `
<div style="padding:0 0 24px;">
  <!-- Filter card -->
  <div style="background:#fff;border:1px solid #ddd;border-radius:4px;margin-bottom:16px;overflow:hidden;">
    <div style="background:#1d3a6e;color:#fff;padding:8px 14px;font-size:13px;font-weight:600;display:flex;justify-content:space-between;align-items:center;">
      <span>CUSTOMER WAIVER REPORT</span>
    </div>
    <div style="padding:12px 14px;display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;">
      <div>
        <div style="font-size:11px;margin-bottom:3px;color:#555;">Project *</div>
        <select id="iwr-proj" style="padding:5px 8px;border:1px solid #ccc;border-radius:3px;font-size:12px;min-width:200px;">
          <option value="">-- Select --</option>
          ${projOptions}
        </select>
      </div>
      <button onclick="InterestWaiver._fetchReport()" style="padding:6px 18px;background:#337ab7;color:#fff;border:none;border-radius:3px;font-size:12px;font-weight:600;cursor:pointer;">FETCH</button>
    </div>
  </div>
  <!-- Results -->
  <div id="iwr-results"></div>
</div>`;
  }

  async function _fetchReport() {
    const projSel = document.getElementById('iwr-proj');
    if (!projSel || !projSel.value) { alert('Please select a project.'); return; }
    const projectId = projSel.value;
    const proj = _state.projects.find(p => p.id === projectId);

    const resultsDiv = document.getElementById('iwr-results');
    if (resultsDiv) resultsDiv.innerHTML = '<div style="padding:12px;font-size:12px;color:#555;">Loading...</div>';

    try {
      const token = localStorage.getItem('rof-jwt');
      const resp = await fetch(`/api/payments/consumer-waiver-report?project_id=${projectId}`, {
        headers: { 'Authorization': 'Bearer ' + token },
      });
      const json = await resp.json();
      if (!json.success) throw new Error(json.error || 'Failed');
      const data = json.data || [];

      if (!data.length) {
        if (resultsDiv) resultsDiv.innerHTML = '<div style="padding:12px;font-size:12px;color:#555;">No waiver records found for this project.</div>';
        return;
      }

      const projName = proj ? (proj.name || proj.project_name || '') : '';
      const thS = 'padding:8px;background:#1d3a6e;color:#fff;font-size:12px;font-weight:600;white-space:nowrap;';
      const tdR = 'padding:6px 8px;text-align:right;font-size:12px;';

      const rows = data.map((r, i) => {
        const bg = i === 0 ? 'background:#f5f0dc;' : (i % 2 === 0 ? 'background:#fafafa;' : '');
        const dt = r.last_waiver_date ? new Date(r.last_waiver_date) : null;
        const dtStr = dt ? `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}` : '';
        return `<tr style="${bg}">
          <td style="padding:6px 8px;text-align:center;font-size:12px;">${i+1}</td>
          <td style="padding:6px 8px;font-size:12px;">${r.registration_no || ''}</td>
          <td style="padding:6px 8px;font-size:12px;">${r.consumer_name || ''}</td>
          <td style="padding:6px 8px;font-size:12px;">${r.unit_address || ''}</td>
          <td style="${tdR}">${fmt(r.total_interest_inr)}</td>
          <td style="${tdR}">${fmt(r.total_waived_inr)}</td>
          <td style="${tdR}">${fmt(r.balance_interest_inr)}</td>
          <td style="padding:6px 8px;text-align:center;font-size:12px;">${r.waiver_count}</td>
          <td style="padding:6px 8px;text-align:center;font-size:12px;">${dtStr}</td>
        </tr>`;
      }).join('');

      if (resultsDiv) resultsDiv.innerHTML = `
        <div style="background:#fff;border:1px solid #ddd;border-radius:4px;overflow:hidden;">
          <div style="background:#1d3a6e;color:#fff;padding:8px 14px;font-size:13px;font-weight:600;">
            PROJECT: ${projName}
          </div>
          <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr>
                  <th style="${thS}">S.NO.</th>
                  <th style="${thS}">REGISTRATION NO.</th>
                  <th style="${thS}">NAME</th>
                  <th style="${thS}">UNIT ADDRESS</th>
                  <th style="${thS}">TOTAL INTEREST</th>
                  <th style="${thS}">WAIVED AMOUNT</th>
                  <th style="${thS}">BALANCE INTEREST</th>
                  <th style="${thS}">WAIVER COUNT</th>
                  <th style="${thS}">LAST WAIVER DATE</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>`;
    } catch (e) {
      if (resultsDiv) resultsDiv.innerHTML = `<div style="color:red;padding:12px;font-size:12px;">Error: ${e.message}</div>`;
    }
  }

  // ── public API ────────────────────────────────────────────────────────────

  async function init(params) {
    const p = params || {};
    _state.view = p.view === 'report' ? 'report' : 'list';
    _state.consumers = [];
    _state.detail = null;

    await loadProjects();

    const content = document.getElementById('content') || document.body;
    if (_state.view === 'report') {
      content.innerHTML = renderReport();
    } else {
      content.innerHTML = renderList();
    }
  }

  return {
    init,
    _toggleFilter,
    _fetchList,
    _openDetail,
    _onInstChange,
    _saveWaiver,
    _backToList,
    _fetchReport,
  };
})();

window.InterestWaiver = InterestWaiver;

Pages.interestWaiver = function(params) {
  const p = params || {};
  InterestWaiver.init(p);
};
