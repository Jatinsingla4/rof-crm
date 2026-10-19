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

  const IW_STYLE = `<style>
.iwn { max-width:1180px; margin:0 auto; font-size:13px }
.iwn-card { background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:hidden; margin-bottom:16px }
.iwn-hdr { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; background:var(--teal-bg); padding:14px 18px; border-bottom:1px solid var(--border) }
.iwn-title { color:var(--text); font-size:12px; font-weight:600; letter-spacing:.6px; text-transform:uppercase }
.iwn-ico { cursor:pointer; font-size:16px; color:var(--text2); margin-left:10px }
.iwn-body { padding:18px }
.iwn-row { display:flex; flex-wrap:wrap; gap:16px 18px; align-items:flex-end; margin-bottom:16px }
.iwn-row:last-child { margin-bottom:0 }
.iwn-fg { display:flex; flex-direction:column; gap:6px }
.iwn-fl { font-size:11px; color:var(--text2); letter-spacing:.3px }
.iwn-fc { padding:9px 12px; border:1px solid var(--border2); border-radius:8px; font-size:13px; background:var(--surface); color:var(--text); min-height:38px; box-sizing:border-box }
.iwn-fc:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg); outline:none }
.iwn-btns { display:flex; gap:10px; margin-top:4px }
.iwn-btn { background:var(--teal); color:#fff; border:none; padding:9px 24px; border-radius:8px; font-size:12.5px; font-weight:600; cursor:pointer; min-height:38px }
.iwn-btn:hover { filter:brightness(.92) }
.iwn-btn-grey { background:var(--surface); color:var(--text2); border:1px solid var(--border2) }
.iwn-btn-grey:hover { background:var(--surface2); filter:none }
.iwn-scroll { overflow-x:auto }
.iwn-tbl { width:100%; border-collapse:collapse; font-size:12.5px }
.iwn-tbl th { background:var(--surface2); color:var(--text3); padding:10px 14px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; text-align:left; border-bottom:1px solid var(--border2); white-space:nowrap }
.iwn-tbl td { padding:10px 14px; border-bottom:1px solid var(--border); color:var(--text) }
.iwn-tbl tbody tr:hover td { background:var(--surface2) }
.iwn-tbl tbody tr:last-child td { border-bottom:none }
.iwn-tbl .c { text-align:center } .iwn-tbl .r { text-align:right }
.iwn-tbl tr.iwn-first td { background:var(--teal-bg) }
.iwn-tbl tr.iwn-total td { font-weight:600; background:var(--surface2) }
.iwn-link { color:var(--teal); text-decoration:none; font-weight:500; cursor:pointer }
.iwn-link:hover { text-decoration:underline }
.iwn-info { display:flex; flex-wrap:wrap; gap:8px 28px; padding:14px 18px; border-bottom:1px solid var(--border); font-size:13px; color:var(--text2) }
.iwn-info strong { color:var(--text) }
.iwn-form { padding:18px; border-top:1px solid var(--border2); background:var(--surface2) }
.iwn-stats { display:flex; flex-wrap:wrap; gap:8px 28px; margin-bottom:18px; padding-bottom:14px; border-bottom:1px solid var(--border) }
.iwn-stat { font-size:12px; color:var(--text2) }
.iwn-stat strong { color:var(--text); font-size:13px }
.iwn-msg { padding:30px 18px; color:var(--text3); font-size:13px; text-align:center }
.iwn-err { color:var(--red) }
.iwn-ok { color:var(--teal) }
</style>`;

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

    return `${IW_STYLE}
<div class="iwn">

  <!-- Filter card -->
  <div class="iwn-card">
    <div class="iwn-hdr">
      <div class="iwn-title">Interest Waive Off</div>
      <span id="iw-collapse-btn" class="iwn-ico" onclick="InterestWaiver._toggleFilter()">&#8722;</span>
    </div>
    <div id="iw-filter-body" class="iwn-body">
      <div class="iwn-row">
        <div class="iwn-fg">
          <label class="iwn-fl">*Project</label>
          <select id="iw-proj" class="iwn-fc" style="min-width:200px;">
            <option value="">-- Select --</option>
            ${projOptions}
          </select>
        </div>
        <div class="iwn-fg">
          <label class="iwn-fl">Type</label>
          <select id="iw-type" class="iwn-fc" style="min-width:160px;">
            <option value="All">&lt;--All--&gt;</option>
            <option value="Self">Self</option>
            <option value="Pending">Pending</option>
            <option value="Loan Sanctioned">Loan Sanctioned</option>
          </select>
        </div>
        <div class="iwn-fg">
          <label class="iwn-fl">Registration No.</label>
          <input id="iw-regno" type="text" placeholder="Registration No." class="iwn-fc" style="width:160px;">
        </div>
        <div class="iwn-fg">
          <label class="iwn-fl">First Name</label>
          <input id="iw-name" type="text" placeholder="First Name" class="iwn-fc" style="width:150px;">
        </div>
        <div class="iwn-fg">
          <label class="iwn-fl">Unit Address</label>
          <input id="iw-addr" type="text" placeholder="Unit Address" class="iwn-fc" style="width:150px;">
        </div>
        <div>
          <button class="iwn-btn" onclick="InterestWaiver._fetchList()">FETCH</button>
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
    resultsDiv.innerHTML = '<div class="iwn-msg">Loading...</div>';

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
      resultsDiv.innerHTML = `<div class="iwn-msg iwn-err">Error: ${e.message}</div>`;
    }
  }

  function renderConsumerTable(data, proj) {
    const resultsDiv = document.getElementById('iw-results');
    if (!data.length) {
      resultsDiv.innerHTML = '<div class="iwn-msg">No records found.</div>';
      return;
    }

    const projName = proj ? (proj.name || proj.project_name || proj.id) : '';

    const rows = data.map((r, i) => {
      return `<tr class="${i === 0 ? 'iwn-first' : ''}">
        <td class="c">${i + 1}</td>
        <td>${r.registration_no || ''}</td>
        <td><a class="iwn-link" href="/api/consumers/${r.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" title="View Applicant File">${r.name || ''}</a></td>
        <td>${r.unit_address || ''}</td>
        <td>${r.type || ''}</td>
        <td class="r">${fmt(r.total_interest_inr)}</td>
        <td class="r">${fmt(r.total_waived_inr)}</td>
        <td class="r">${fmt(r.paid_interest_inr)}</td>
        <td class="r">${fmt(r.balance_interest_inr)}</td>
        <td class="c"><a href="#" class="iwn-link" onclick="event.preventDefault();InterestWaiver._openDetail(${i},false)">Detail</a></td>
        <td class="c"><a href="#" class="iwn-link" onclick="event.preventDefault();InterestWaiver._openDetail(${i},true)">Waive Off</a></td>
      </tr>`;
    }).join('');

    resultsDiv.innerHTML = `
<div class="iwn-card">
  <div class="iwn-hdr">
    <div class="iwn-title">Project : ${projName}</div>
    <div>
      <span class="iwn-ico" title="Print" onclick="window.print()">&#128438;</span>
      <span class="iwn-ico" title="Download">&#8659;</span>
    </div>
  </div>
  <div class="iwn-scroll">
    <table class="iwn-tbl">
      <thead>
        <tr>
          <th>S.NO.</th>
          <th>REGISTRATION NO.</th>
          <th>NAME</th>
          <th>ADDRESS</th>
          <th>TYPE</th>
          <th>INTEREST AMOUNT</th>
          <th>WAIVE OFF AMOUNT</th>
          <th>PAID INTEREST</th>
          <th>BALANCE INTEREST</th>
          <th>DETAIL</th>
          <th>WAIVE OFF</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</div>`;
  }

  // ── VIEW 2: detail ────────────────────────────────────────────────────────

  async function _openDetail(idx, autoScroll) {
    const consumer = _state.consumers[idx];
    if (!consumer) return;

    const content = document.getElementById('content') || document.body;
    content.innerHTML = '<div class="iwn-msg">Loading interest data...</div>';

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
      content.innerHTML = `<div class="iwn-msg iwn-err">Error loading detail: ${e.message}</div>`;
    }
  }

  function renderDetailView(container) {
    const { consumer, rows, summary } = _state.detail;
    const proj = _state.selectedProject;
    const projName = proj ? (proj.name || proj.project_name || '') : '';

    let totalInterest = 0;
    const tableRows = rows.map((r, i) => {
      totalInterest += parseFloat(r.interest_amount) || 0;
      return `<tr>
        <td class="c">${i + 1}</td>
        <td>${r.installment_name || ''}</td>
        <td class="c">${fmtDate(r.installment_date)}</td>
        <td class="r">${fmt(r.amount_received)}</td>
        <td class="c">${fmtDate(r.date_received)}</td>
        <td class="r">${(r.amount_received === 0 && r.is_first_receipt === true) ? '--' : fmt(r.delay_amount)}</td>
        <td class="c">${r.delay_days != null ? r.delay_days : ''}</td>
        <td class="c">${r.roi != null ? r.roi : ''}</td>
        <td class="r">${fmt(r.interest_amount)}</td>
      </tr>`;
    }).join('');

    // Build installment dropdown options
    const interestRows = rows.filter(r => parseFloat(r.interest_amount) > 0);
    const instOpts = `<option value="__all__">&lt;--All--&gt;</option>` +
      interestRows.map(r =>
        `<option value="${r.installment_index}">${r.installment_name}</option>`
      ).join('');

    const s = summary;

    container.innerHTML = `${IW_STYLE}
<div class="iwn">

  <div class="iwn-card">
    <div class="iwn-hdr">
      <div class="iwn-title">Interest Waive Off</div>
    </div>
    <div class="iwn-info">
      <span><strong>Project:</strong> ${projName}</span>
      <span><strong>Customer Name:</strong> ${consumer.name || ''}</span>
      <span><strong>Registration No.:</strong> ${consumer.registration_no || ''}</span>
    </div>

    <!-- Interest breakdown table -->
    <div class="iwn-scroll">
      <table class="iwn-tbl">
        <thead>
          <tr>
            <th class="c">S.NO.</th>
            <th>INSTALLMENT NAME</th>
            <th class="c">INSTALLMENT DATE</th>
            <th class="c">AMOUNT REC.</th>
            <th class="c">DATE OF REC.</th>
            <th class="c">DELAY AMOUNT</th>
            <th class="c">DELAY DAYS</th>
            <th class="c">ROI</th>
            <th class="c">INTEREST AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
          <tr class="iwn-total">
            <td colspan="8" class="r">Total:</td>
            <td class="r">${fmt(totalInterest)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Waiver form -->
    <div id="iw-waiver-form" class="iwn-form">

      <!-- Summary of selected installment -->
      <div class="iwn-stats">
        <div class="iwn-stat">Interest Amount : <strong id="iw-disp-interest">${fmt(s.total_interest)}</strong></div>
        <div class="iwn-stat">Previous Waive Off Amount : <strong id="iw-disp-prev-waive">${fmt(s.total_waived)}</strong></div>
        <div class="iwn-stat">Paid Interest : <strong id="iw-disp-paid">0.00</strong></div>
        <div class="iwn-stat">Balance Interest : <strong id="iw-disp-balance">${fmt(s.balance_interest)}</strong></div>
      </div>

      <!-- Row 1 -->
      <div class="iwn-row">
        <div class="iwn-fg">
          <label class="iwn-fl">Installment Name</label>
          <select id="iw-inst-select" class="iwn-fc" onchange="InterestWaiver._onInstChange()" style="min-width:180px;">
            ${instOpts}
          </select>
        </div>
        <div class="iwn-fg">
          <label class="iwn-fl">Waive Off Amount</label>
          <input id="iw-waive-amt" class="iwn-fc" type="number" min="0" step="0.01" style="width:140px;">
        </div>
      </div>

      <!-- Row 2: auth + document + remark -->
      <div class="iwn-row">
        <div class="iwn-fg">
          <label class="iwn-fl">Auth. By</label>
          <input id="iw-auth-by" class="iwn-fc" type="text" style="width:180px;">
        </div>
        <div class="iwn-fg">
          <label class="iwn-fl">Attach Document</label>
          <input id="iw-doc" type="file" accept=".pdf,.jpg,.jpeg,.png" style="font-size:12px;color:var(--text2);">
        </div>
        <div class="iwn-fg">
          <label class="iwn-fl">Remark</label>
          <textarea id="iw-remark" class="iwn-fc" rows="3" style="width:260px;resize:vertical;"></textarea>
        </div>
      </div>

      <!-- Buttons -->
      <div class="iwn-btns">
        <button class="iwn-btn" onclick="InterestWaiver._saveWaiver()">SAVE</button>
        <button class="iwn-btn iwn-btn-grey" onclick="InterestWaiver._backToList()">BACK</button>
      </div>

      <div id="iw-save-msg" style="margin-top:12px;font-size:13px;"></div>
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
      msgDiv.innerHTML = '<span class="iwn-err">Waive Off Amount must be greater than 0.</span>';
      return;
    }
    if (!authBy) {
      msgDiv.innerHTML = '<span class="iwn-err">Auth. By is required.</span>';
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

    msgDiv.innerHTML = '<span style="color:var(--text2);">Saving...</span>';

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
        msgDiv.innerHTML = `<span class="iwn-err">Error: ${json.error || resp.statusText}</span>`;
        return;
      }
      msgDiv.innerHTML = '<span class="iwn-ok">Waiver saved successfully.</span>';
      _backToList();
      setTimeout(() => _fetchList(), 300);
    } catch (e) {
      msgDiv.innerHTML = `<span class="iwn-err">Error: ${e.message}</span>`;
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

    return `${IW_STYLE}
<div class="iwn">
  <!-- Filter card -->
  <div class="iwn-card">
    <div class="iwn-hdr">
      <div class="iwn-title">Customer Waiver Report</div>
    </div>
    <div class="iwn-body">
      <div class="iwn-row">
        <div class="iwn-fg">
          <label class="iwn-fl">Project *</label>
          <select id="iwr-proj" class="iwn-fc" style="min-width:240px;">
            <option value="">-- Select --</option>
            ${projOptions}
          </select>
        </div>
        <button class="iwn-btn" onclick="InterestWaiver._fetchReport()">FETCH</button>
      </div>
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
    if (resultsDiv) resultsDiv.innerHTML = '<div class="iwn-msg">Loading...</div>';

    try {
      const token = localStorage.getItem('rof-jwt');
      const resp = await fetch(`/api/payments/consumer-waiver-report?project_id=${projectId}`, {
        headers: { 'Authorization': 'Bearer ' + token },
      });
      const json = await resp.json();
      if (!json.success) throw new Error(json.error || 'Failed');
      const data = json.data || [];

      if (!data.length) {
        if (resultsDiv) resultsDiv.innerHTML = '<div class="iwn-msg">No waiver records found for this project.</div>';
        return;
      }

      const projName = proj ? (proj.name || proj.project_name || '') : '';

      const rows = data.map((r, i) => {
        const dt = r.last_waiver_date ? new Date(r.last_waiver_date) : null;
        const dtStr = dt ? `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}` : '';
        return `<tr class="${i === 0 ? 'iwn-first' : ''}">
          <td class="c">${i+1}</td>
          <td>${r.registration_no || ''}</td>
          <td><a class="iwn-link" href="/api/consumers/${r.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" title="View Applicant File">${r.consumer_name || ''}</a></td>
          <td>${r.unit_address || ''}</td>
          <td class="r">${fmt(r.total_interest_inr)}</td>
          <td class="r">${fmt(r.total_waived_inr)}</td>
          <td class="r">${fmt(r.balance_interest_inr)}</td>
          <td class="c">${r.waiver_count}</td>
          <td class="c">${dtStr}</td>
        </tr>`;
      }).join('');

      if (resultsDiv) resultsDiv.innerHTML = `
        <div class="iwn-card">
          <div class="iwn-hdr">
            <div class="iwn-title">Project: ${projName}</div>
          </div>
          <div class="iwn-scroll">
            <table class="iwn-tbl">
              <thead>
                <tr>
                  <th>S.NO.</th>
                  <th>REGISTRATION NO.</th>
                  <th>NAME</th>
                  <th>UNIT ADDRESS</th>
                  <th>TOTAL INTEREST</th>
                  <th>WAIVED AMOUNT</th>
                  <th>BALANCE INTEREST</th>
                  <th>WAIVER COUNT</th>
                  <th>LAST WAIVER DATE</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>`;
    } catch (e) {
      if (resultsDiv) resultsDiv.innerHTML = `<div class="iwn-msg iwn-err">Error: ${e.message}</div>`;
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
