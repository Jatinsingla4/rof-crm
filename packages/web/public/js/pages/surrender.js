(() => {

  // ── STATE ──────────────────────────────────────────────────────────────────
  let _view = 'search';
  let _type = 'surrender';
  let _tab = 'surrender';
  let _projects = [];
  let _consumers = [];
  let _detail = null;
  let _selectedConsumer = null;
  let _reportRows = [];
  let _reportProjects = [];
  let _restoreRows = [];
  let _restoreProjects = [];
  let _restoreType = 'surrender';

  // ── STYLES ─────────────────────────────────────────────────────────────────
  const SUR_STYLES = `<style id="sur-styles">
#content:has(.sur-tab-btn) { max-width: 1180px; margin-left: auto; margin-right: auto; width: 100%; }
.sur-page { padding: 0; font-size: 13px; max-width: 1180px; margin: 0 auto; }
.sur-card { background: var(--surface); border: 1px solid var(--border2); border-radius: 10px; margin-bottom: 16px; overflow: hidden; }
.sur-hdr {
  display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;
  background: var(--teal-bg); padding: 14px 18px; border-bottom: 1px solid var(--border);
}
.sur-hdr-title { color: var(--text); font-size: 12px; font-weight: 600; letter-spacing: .6px; text-transform: uppercase; }
.sur-body { padding: 18px; }
.sur-filter-grid {
  display: flex; flex-wrap: wrap; align-items: flex-end; gap: 16px 18px;
  margin-bottom: 10px;
}
#sur-project { min-width: 220px; }
#sur-regno, #sur-name, #sur-unit { min-width: 160px; }
.sur-field { display: flex; flex-direction: column; gap: 6px; }
.sur-lbl { font-size: 11px; color: var(--text2); letter-spacing: .3px; white-space: nowrap; }
.sur-field select, .sur-field input {
  padding: 9px 12px; border: 1px solid var(--border2); border-radius: 8px; min-height: 38px;
  font-size: 13px; width: 100%; box-sizing: border-box; background: var(--surface); color: var(--text);
}
.sur-field select:focus, .sur-field input:focus { outline: none; border-color: var(--teal); box-shadow: 0 0 0 3px var(--teal-bg); }
.sur-btn-fetch {
  background: var(--teal); color: #fff; border: none; min-height: 38px;
  padding: 9px 26px; border-radius: 8px; font-size: 12.5px; font-weight: 600; cursor: pointer;
}
.sur-btn-fetch:hover { filter: brightness(.92); }
.sur-btn-fetch:disabled { opacity: .7; cursor: not-allowed; }
.sur-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.sur-table th { background: var(--surface2); color: var(--text3); padding: 10px 14px; text-align: center; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .4px; white-space: nowrap; border-bottom: 1px solid var(--border2); }
.sur-table td { padding: 10px 14px; border-bottom: 1px solid var(--border); vertical-align: middle; text-align: center; color: var(--text); }
.sur-table tbody tr:hover td { background: var(--surface2); }
.sur-table tbody tr:last-child td { border-bottom: none; }
.sur-table td.sur-left { text-align: left; }
.sur-table td.sur-right { text-align: right; }
.sur-link { color: var(--teal); cursor: pointer; text-decoration: none; font-weight: 500; font-size: 12.5px; }
.sur-link:hover { text-decoration: underline; }
/* FORM */
.sur-form-page { padding: 0; font-size: 13px; max-width: 1180px; margin: 0 auto; }
.sur-form-topbar {
  display: flex; align-items: center; justify-content: space-between;
  background: var(--surface); padding: 12px 18px; border: 1px solid var(--border2); border-radius: 10px; margin-bottom: 16px;
}
.sur-back-btn {
  background: none; border: none; cursor: pointer; font-size: 20px; color: var(--teal);
  display: flex; align-items: center; gap: 6px; font-weight: bold; border-radius: 8px; padding: 0 8px;
}
.sur-back-btn:hover { background: var(--teal-bg); }
.sur-form-title { font-size: 14px; font-weight: 600; color: var(--text); }
.sur-type-toggle { display: flex; gap: 0; }
.sur-type-btn {
  padding: 7px 20px; border: 1px solid var(--border2); border-radius: 0; font-size: 12.5px;
  font-weight: 600; cursor: pointer; background: var(--surface); color: var(--text2); transition: all .15s;
}
.sur-type-btn:first-child { border-radius: 8px 0 0 8px; }
.sur-type-btn:last-child { border-radius: 0 8px 8px 0; border-left: none; }
.sur-type-btn.sur-active { background: var(--teal); color: #fff; border-color: var(--teal); }
.sur-type-btn:hover:not(.sur-active) { background: var(--surface2); }
.sur-section { background: var(--surface); border: 1px solid var(--border2); border-radius: 10px; margin-bottom: 16px; overflow: hidden; }
.sur-section-title {
  font-size: 12px; font-weight: 600; color: var(--text); padding: 12px 18px; letter-spacing: .6px;
  border-bottom: 1px solid var(--border); background: var(--surface2); text-transform: uppercase;
}
.sur-section-body { padding: 14px 18px; }
.sur-info-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.sur-info-table td { padding: 6px 10px; border: 1px solid var(--border); vertical-align: top; color: var(--text); }
.sur-info-table td.sur-info-lbl { color: var(--text2); width: 130px; white-space: nowrap; }
.sur-info-table td.sur-info-val { font-weight: 600; color: var(--text); }
.sur-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
@media (max-width: 760px) { .sur-two-col { grid-template-columns: 1fr; } }
.sur-two-col .sur-info-table td { border-color: var(--border); }
.sur-col-head {
  background: var(--surface2); color: var(--text); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px;
  padding: 8px 10px; border: 1px solid var(--border);
}
.sur-dates-table { border-collapse: collapse; }
.sur-dates-table th { background: var(--surface2); color: var(--text3); padding: 8px 20px; text-align: center; font-size: 11px; text-transform: uppercase; border: 1px solid var(--border); }
.sur-dates-table td { padding: 8px 20px; text-align: center; font-size: 12.5px; border: 1px solid var(--border); color: var(--text); }
/* Financial section */
.sur-fin-row { display: flex; justify-content: space-between; align-items: center; padding: 3px 0; font-size: 12.5px; color: var(--text); }
.sur-fin-lbl { color: var(--text); }
.sur-fin-amt { text-align: right; min-width: 100px; font-weight: 500; }
.sur-fin-indent { padding-left: 20px; }
.sur-fin-sep { border: none; border-top: 1px solid var(--border2); margin: 4px 0; }
.sur-fin-total { font-weight: bold; font-size: 13px; }
.sur-fin-balance { font-weight: bold; font-size: 14px; color: var(--teal); }
.sur-fin-words { font-size: 11px; color: var(--text3); font-style: italic; margin: 2px 0 4px; }
.sur-interest-box { border: 1px solid var(--border2); border-radius: 10px; margin-top: 10px; overflow: hidden; }
.sur-interest-box table { width: 100%; border-collapse: collapse; }
.sur-interest-box table th { background: var(--surface2); color: var(--text3); padding: 8px 10px; text-align: center; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid var(--border2); }
.sur-interest-box table td { padding: 8px 10px; text-align: center; font-size: 12.5px; border-bottom: 1px solid var(--border); color: var(--text); }
.sur-addon-table { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-top: 8px; }
.sur-addon-table th { background: var(--surface2); color: var(--text3); padding: 8px; text-align: center; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid var(--border2); }
.sur-addon-table td { padding: 7px 8px; text-align: center; border-bottom: 1px solid var(--border); color: var(--text); }
/* Action form */
.sur-action-section { background: var(--surface); border: 1px solid var(--teal); border-radius: 10px; margin-bottom: 16px; overflow: hidden; }
.sur-action-hdr { background: var(--teal-bg); color: var(--text); padding: 14px 18px; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: .6px; border-bottom: 1px solid var(--border); }
.sur-action-body { padding: 18px; }
.sur-action-row { display: flex; flex-wrap: wrap; gap: 16px 24px; margin-bottom: 14px; align-items: flex-end; }
.sur-toggle-group { display: flex; flex-direction: column; gap: 6px; }
.sur-toggle-lbl { font-size: 11px; color: var(--text2); }
.sur-toggle-btns { display: flex; }
.sur-tbtn {
  padding: 7px 14px; border: 1px solid var(--border2); font-size: 12px; cursor: pointer;
  background: var(--surface); color: var(--text2); transition: all .15s;
}
.sur-tbtn:first-child { border-radius: 8px 0 0 8px; }
.sur-tbtn:last-child { border-radius: 0 8px 8px 0; border-left: none; }
.sur-tbtn.sur-ton { background: var(--teal); color: #fff; border-color: var(--teal); }
.sur-action-field { display: flex; flex-direction: column; gap: 6px; min-width: 130px; }
.sur-action-field label { font-size: 11px; color: var(--text2); letter-spacing: .3px; }
.sur-action-field input, .sur-action-field select, .sur-action-field textarea {
  padding: 9px 12px; border: 1px solid var(--border2); border-radius: 8px; font-size: 13px; min-height: 38px;
  background: var(--surface); color: var(--text); box-sizing: border-box;
}
.sur-action-field input:focus, .sur-action-field select:focus, .sur-action-field textarea:focus { outline: none; border-color: var(--teal); box-shadow: 0 0 0 3px var(--teal-bg); }
.sur-action-field textarea { min-height: 70px; resize: vertical; }
.sur-action-field input[readonly] { background: var(--surface2); color: var(--text2); }
.sur-mode-btns { display: flex; }
.sur-mode-btn {
  padding: 7px 14px; border: 1px solid var(--border2); font-size: 12px; cursor: pointer;
  background: var(--surface); color: var(--text2); transition: all .15s;
}
.sur-mode-btn:first-child { border-radius: 8px 0 0 8px; }
.sur-mode-btn:last-child { border-radius: 0 8px 8px 0; }
.sur-mode-btn.sur-mactive { background: var(--teal); color: #fff; border-color: var(--teal); }
.sur-submit-row { display: flex; gap: 10px; margin-top: 16px; }
.sur-btn-surrender {
  background: var(--red); color: #fff; border: none; padding: 9px 28px; min-height: 38px;
  border-radius: 8px; font-size: 12.5px; font-weight: 600; cursor: pointer;
}
.sur-btn-surrender:hover { filter: brightness(.92); }
.sur-btn-close {
  background: var(--surface); color: var(--text2); border: 1px solid var(--border2); padding: 9px 22px; min-height: 38px;
  border-radius: 8px; font-size: 12.5px; cursor: pointer;
}
.sur-btn-close:hover { background: var(--surface2); }
.sur-success-msg { background: var(--teal-bg); border: 1px solid var(--teal); color: var(--teal); padding: 10px 14px; border-radius: 8px; margin-bottom: 12px; font-weight: 600; }
.sur-error-msg { background: var(--red-bg); border: 1px solid var(--red); color: var(--red); padding: 10px 14px; border-radius: 8px; margin-bottom: 12px; }
.sur-spinner { text-align: center; padding: 40px; color: var(--text3); font-size: 13px; }
.sur-customer-row { display: flex; gap: 0; margin-bottom: 2px; }
.sur-cust-id { font-size: 12px; color: var(--text2); }
.sur-cust-date { font-size: 12px; color: var(--text2); }
.sur-topinfo { display: flex; justify-content: space-between; padding: 8px 0; font-size: 12px; border-bottom: 1px solid var(--border); margin-bottom: 10px; color: var(--text2); }
.sur-tab-btn {
  padding: 8px 22px; border: 1px solid var(--border2); background: var(--surface);
  color: var(--text2); font-size: 12.5px; font-weight: 600; cursor: pointer; transition: all .15s;
}
.sur-tab-btn:first-child { border-radius: 8px 0 0 8px; }
.sur-tab-btn:last-child { border-radius: 0 8px 8px 0; border-left: none; }
.sur-tab-btn.sur-tab-active { background: var(--teal); color: #fff; border-color: var(--teal); }
.sur-tab-btn:hover:not(.sur-tab-active) { background: var(--surface2); }
</style>`;

  // ── HELPERS ────────────────────────────────────────────────────────────────
  function _fmt(n) {
    const v = parseFloat(n || 0);
    return v.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  function _fmtDate(d) {
    if (!d) return 'N/A';
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/');
  }
  function _v(v) { return v || 'N/A'; }
  function _tok() { return (window.Auth && Auth.getToken && Auth.getToken()) || localStorage.getItem('rof-jwt') || ''; }

  const _ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
    'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const _tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function _wordsBelow100(n) {
    if (n < 20) return _ones[n];
    return _tens[Math.floor(n/10)] + (n % 10 ? ' ' + _ones[n % 10] : '');
  }
  function _amtWords(num) {
    num = Math.round(Math.abs(num));
    if (num === 0) return 'Zero';
    let str = '';
    const cr = Math.floor(num / 10000000); num %= 10000000;
    const lac = Math.floor(num / 100000);  num %= 100000;
    const th = Math.floor(num / 1000);     num %= 1000;
    const hu = Math.floor(num / 100);      num %= 100;
    if (cr)  str += _wordsBelow100(cr) + ' Crore ';
    if (lac) str += _wordsBelow100(lac) + ' Lakh ';
    if (th)  str += _wordsBelow100(th) + ' Thousand ';
    if (hu)  str += _ones[hu] + ' Hundred ';
    if (num) str += _wordsBelow100(num);
    return str.trim() + ' only.';
  }

  // ── VIEW 1: SEARCH ─────────────────────────────────────────────────────────
  function _renderSearch() {
    const opts = _projects.map(p =>
      `<option value="${p.id}" ${_selectedConsumer && _selectedConsumer.project_id === p.id ? 'selected' : ''}>${p.name}</option>`
    ).join('');
    const rows = _consumers.map((c, i) => `
      <tr>
        <td>${i+1}</td>
        <td>${_v(c.registration_no)}</td>
        <td class="sur-left">${_v(c.full_name)}</td>
        <td>${_v(c.unit_number)}</td>
        <td>${_v(c.broker_company) === 'N/A' ? 'Direct' : _v(c.broker_company)}</td>
        <td>${_fmtDate(c.booking_date)}</td>
        <td>${_fmtDate(c.allotment_date)}</td>
        <td><span class="sur-link" onclick="SurrenderApp.showForm(${i})">Surrender</span></td>
      </tr>`).join('');

    return `
      <div class="sur-page">
        <div class="sur-card">
          <div class="sur-hdr">
            <span class="sur-hdr-title">SURRENDER APPLICANT</span>
            <span style="color:var(--text3);font-size:18px;cursor:pointer">&#8722;</span>
          </div>
          <div class="sur-body">
            <div class="sur-filter-grid">
              <div class="sur-field">
                <span class="sur-lbl">Project*</span>
                <select id="sur-project">
                  <option value="">--Select--</option>
                  ${opts}
                </select>
              </div>
              <div class="sur-field">
                <span class="sur-lbl">Registration No.:</span>
                <input id="sur-regno" type="text" placeholder="Registration No.">
              </div>
              <div class="sur-field">
                <span class="sur-lbl">First Name :</span>
                <input id="sur-name" type="text" placeholder="First Name">
              </div>
              <div class="sur-field">
                <span class="sur-lbl">Unit Address:</span>
                <input id="sur-unit" type="text" placeholder="Unit Address">
              </div>
              <div class="sur-field">
                <span class="sur-lbl">&nbsp;</span>
                <button class="sur-btn-fetch" style="width:auto;padding:6px 20px" onclick="SurrenderApp.search()">FETCH</button>
              </div>
            </div>
          </div>
        </div>

        ${_consumers.length > 0 ? `
        <div class="sur-card">
          <div class="sur-hdr"><span class="sur-hdr-title">SURRENDER APPLICANT</span></div>
          <div style="overflow-x:auto">
            <table class="sur-table">
              <thead>
                <tr>
                  <th>S.NO</th><th>REGISTRATION NO</th><th>NAME</th>
                  <th>UNIT ADDRESS</th><th>BROKER COMPANY</th>
                  <th>REGISTRATION DATE</th><th>ALLOTMENT DATE</th><th>SURRENDER</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>` : ''}
      </div>`;
  }

  // ── TAB BAR ───────────────────────────────────────────────────────────────
  function _renderTabBar() {
    return `
      <div style="display:flex;gap:0;margin-bottom:14px">
        <button class="sur-tab-btn${_tab==='surrender'?' sur-tab-active':''}"
          onclick="SurrenderApp.switchTab('surrender')">
          Surrender / Cancellation
        </button>
        <button class="sur-tab-btn${_tab==='report'?' sur-tab-active':''}"
          onclick="SurrenderApp.switchTab('report')">
          Detailed Report
        </button>
        <button class="sur-tab-btn${_tab==='restore'?' sur-tab-active':''}"
          onclick="SurrenderApp.switchTab('restore')">
          Cancel Surrender
        </button>
      </div>`;
  }

  function _switchTab(tab) {
    _tab = tab;
    _kept = {};
    _view = 'search';
    _consumers = [];
    _detail = null;
    _selectedConsumer = null;
    _reportRows = [];
    _restoreRows = [];
    const container = document.getElementById('content') || document.body;
    container.innerHTML = SUR_STYLES + _renderTabBar()
      + (tab === 'surrender' ? _renderSearch()
       : tab === 'report'   ? _renderReport()
       :                      _renderRestore());
    if (tab === 'surrender') _loadProjects();
    if (tab === 'report')    _loadReportProjects();
    if (tab === 'restore')   _loadRestoreProjects();
  }

  // The screens are drawn again after every FETCH; the filters the user chose must survive that
  let _kept = {};
  const _save = (...ids) => ids.forEach(id => { const el = document.getElementById(id); if (el) _kept[id] = el.value; });
  const _reapply = (...ids) => Object.entries(_kept).forEach(([id, v]) => { const el = document.getElementById(id); if (el && (!ids.length || ids.includes(id))) el.value = v; });   // the project lists arrive later, and put back only their own select

  // ── SEARCH ACTION ──────────────────────────────────────────────────────────
  async function _search() {
    const projectId = document.getElementById('sur-project').value;
    if (!projectId) { alert('Please select a project.'); return; }
    const registrationNo = document.getElementById('sur-regno').value.trim();
    const firstName = document.getElementById('sur-name').value.trim();
    const unitAddress = document.getElementById('sur-unit').value.trim();

    const btn = document.querySelector('.sur-btn-fetch');
    if (btn) { btn.disabled = true; btn.textContent = 'Loading...'; }

    try {
      const params = new URLSearchParams({ projectId });
      if (registrationNo) params.append('registrationNo', registrationNo);
      if (firstName) params.append('firstName', firstName);
      if (unitAddress) params.append('unitAddress', unitAddress);

      const res = await fetch(`/api/surrender/consumers?${params}`, {
        headers: { 'Authorization': 'Bearer ' + _tok() }
      });
      const data = await res.json();
      _consumers = data.data || [];
      _save('sur-project', 'sur-regno', 'sur-name', 'sur-unit');
      _render();
      _reapply();
    } catch (e) {
      alert('Error fetching consumers: ' + e.message);
    } finally {
      const b = document.querySelector('.sur-btn-fetch');
      if (b) { b.disabled = false; b.textContent = 'FETCH'; }
    }
  }

  // ── SHOW FORM ──────────────────────────────────────────────────────────────
  async function _showForm(idx) {
    _selectedConsumer = _consumers[idx];
    _busy = false;
    _view = 'form';
    _render();

    const container = document.getElementById('content') || document.body;
    const spinner = document.getElementById('sur-spinner');
    if (spinner) spinner.innerHTML = '<div class="sur-spinner">Loading details...</div>';

    try {
      const res = await fetch(`/api/surrender/detail/${_selectedConsumer.consumer_id}`, {
        headers: { 'Authorization': 'Bearer ' + _tok() }
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load detail');
      _detail = data.data;
      _renderFormContent();
    } catch (e) {
      const sp = document.getElementById('sur-spinner');
      if (sp) sp.innerHTML = `<div class="sur-error-msg">Error: ${e.message}</div>`;
    }
  }

  function _back() {
    _busy = false;
    _view = 'search';
    _detail = null;
    _render();
  }

  function _toggleType(t) {
    _type = t;
    const btns = document.querySelectorAll('.sur-type-btn');
    btns.forEach(b => b.classList.toggle('sur-active', b.dataset.type === t));
  }

  // ── RENDER FORM SHELL ──────────────────────────────────────────────────────
  function _renderFormShell() {
    return `
      <div class="sur-form-page">
        <div class="sur-section">
          <div class="sur-section-body">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
              <div style="display:flex;align-items:center;gap:10px">
                <button class="sur-back-btn" onclick="SurrenderApp.back()">&#8592;</button>
                <span style="font-size:14px;font-weight:600;color:var(--text)">Surrender/Cancellation</span>
              </div>
              <div class="sur-type-toggle">
                <button class="sur-type-btn sur-active" data-type="surrender" onclick="SurrenderApp.toggleType('surrender')">Surrender</button>
                <button class="sur-type-btn" data-type="cancellation" onclick="SurrenderApp.toggleType('cancellation')">Cancellation</button>
              </div>
            </div>
          </div>
        </div>
        <div id="sur-spinner"><div class="sur-spinner">Loading...</div></div>
      </div>`;
  }

  // ── RENDER FULL FORM CONTENT ───────────────────────────────────────────────
  function _renderFormContent() {
    const spinner = document.getElementById('sur-spinner');
    if (!spinner || !_detail) return;

    const d = _detail;
    const c = d.consumer || {};
    const co = d.coApplicant || {};
    const bk = d.booking || {};
    const u = d.unit || {};
    const t = d.tower || {};
    const p = d.project || {};
    const br = d.broker || {};
    const al = d.allocation || {};
    const fin = d.financials || {};
    const receipts = d.receipts || [];
    const demands = d.demands || [];
    const sched = d.scheduleTemplates || [];
    const addons = d.addonCharges || [];
    const dispatches = d.documentDispatches || [];

    const interestBalance = (fin.totalInterest||0) - (fin.totalWaived||0) - (fin.totalInterestPaid||0);

    spinner.innerHTML = `
      ${_renderCustomerSection(c, co, bk, p)}
      ${_renderProjectSection(u, t, p, br, bk, al, addons)}
      ${_renderFinancialSection(fin, interestBalance)}
      ${_renderPaymentSchedule(demands, sched, fin, receipts)}
      ${_renderReceiptSection(receipts)}
      ${_renderInterestCalcSection(demands, receipts)}
      ${_renderRemarksSection(dispatches)}
      ${_renderActionForm(fin, addons)}
    `;

    _initActionForm(fin, addons);
  }

  // ── SECTION 1: CUSTOMER ────────────────────────────────────────────────────
  function _renderCustomerSection(c, co, bk, p) {
    const today = new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric', timeZone:'Asia/Kolkata' });
    const nameStr = [c.salutation, c.first_name, c.last_name].filter(Boolean).join(' ');
    const fatherStr = c.father_name ? `S/o ${c.father_name}` : '';
    const addrStr = [c.present_address, c.present_city, c.present_state, c.present_pin ? `- ${c.present_pin}` : ''].filter(Boolean).join(', ');

    const coNameStr = [co.salutation, co.first_name, co.last_name].filter(Boolean).join(' ') || _v(null);
    const coFatherStr = co.father_name ? `W/o ${co.father_name}` : '';
    const coAddrStr = [co.present_address, co.present_city, co.present_state, co.present_pin ? `- ${co.present_pin}` : ''].filter(Boolean).join(', ') || 'N/A';

    return `
      <div class="sur-section">
        <div class="sur-section-body">
          <div class="sur-topinfo">
            <span class="sur-cust-id">Customer ID: ${_v(c.registration_no)}</span>
            <span class="sur-cust-date">Date: ${today}</span>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <tr>
              <td style="width:50%;border:1px solid var(--border2);padding:0;vertical-align:top">
                <div class="sur-col-head">First Applicant</div>
                <table style="width:100%;border-collapse:collapse">
                  ${_infoRow('Name:', nameStr + (fatherStr ? '<br><span style="font-weight:normal;color:var(--text2)">' + fatherStr + '</span>' : ''))}
                  ${_infoRow('Address:', addrStr || 'N/A')}
                  ${_infoRow('Contact No.:', _v(c.mobile))}
                  ${_infoRow('LandLine No.:', 'N/A')}
                  ${_infoRow('Email Id:', _v(c.email))}
                  ${_infoRow('PAN No.:', _v(c.pan_no))}
                  ${_infoRow('Aadhar No.:', _v(c.aadhaar_no))}
                </table>
              </td>
              <td style="width:50%;border:1px solid var(--border2);padding:0;vertical-align:top">
                <div class="sur-col-head">Co Applicant</div>
                <table style="width:100%;border-collapse:collapse">
                  ${_infoRow('Name:', coNameStr + (coFatherStr ? '<br><span style="font-weight:normal;color:var(--text2)">' + coFatherStr + '</span>' : ''))}
                  ${_infoRow('Address:', coAddrStr)}
                  ${_infoRow('Contact No.:', _v(co.mobile))}
                  ${_infoRow('LandLine No.:', 'N/A')}
                  ${_infoRow('Email Id:', _v(co.email))}
                  ${_infoRow('PAN No.:', _v(co.pan_no))}
                  ${_infoRow('Aadhar No.:', _v(co.aadhaar_no))}
                </table>
              </td>
            </tr>
          </table>
        </div>
      </div>`;
  }

  function _infoRow(lbl, val) {
    return `<tr>
      <td style="padding:4px 8px;border:1px solid var(--border2);color:var(--text2);width:130px;white-space:nowrap;font-size:12px">${lbl}</td>
      <td style="padding:4px 8px;border:1px solid var(--border2);font-weight:600;color:var(--text);font-size:12px">${val || 'N/A'}</td>
    </tr>`;
  }

  // ── SECTION 2: PROJECT/UNIT ────────────────────────────────────────────────
  function _renderProjectSection(u, t, p, br, bk, al, addons) {
    const addonRows = addons.map((a, i) => `
      <tr>
        <td>${i+1}</td>
        <td class="sur-left">${_v(a.charge_name)}</td>
        <td>1.00</td><td>0.00</td><td>1.00</td>
        <td class="sur-right">${_fmt(a.total_amount)}</td>
        <td>—</td>
      </tr>`).join('') || `<tr><td colspan="7" style="text-align:center;color:var(--text3)">No addon charges</td></tr>`;

    const addonTotal = addons.reduce((s, a) => s + parseFloat(a.total_amount || 0), 0);

    return `
      <div class="sur-section">
        <div class="sur-section-body">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <tr>
              <td style="width:50%;border:1px solid var(--border2);padding:0;vertical-align:top">
                <table style="width:100%;border-collapse:collapse">
                  ${_infoRow('Project:', _v(p.name))}
                  ${_infoRow('Tower:', _v(t.tower_name))}
                  ${_infoRow('Floor:', _v(u.floor))}
                  ${_infoRow('Unit Address:', _v(u.unit_number))}
                  ${_infoRow('Unit Type:', _v(u.bhk_type))}
                  ${_infoRow('Location:', 'N/A')}
                  ${_infoRow('Loan Information:', 'N/A')}
                </table>
              </td>
              <td style="width:50%;border:1px solid var(--border2);padding:0;vertical-align:top">
                <table style="width:100%;border-collapse:collapse">
                  ${_infoRow('Payment Plan:', _v(bk.selected_plan_name))}
                  ${_infoRow('Broker Code:', _v(br.firm_name))}
                  ${_infoRow('Main Broker Name:', _v(br.name) === 'N/A' ? 'Direct' : _v(br.name))}
                  ${_infoRow('Customer Classification:', 'N/A')}
                  ${_infoRow('Employee Name:', 'N/A')}
                  ${_infoRow('Preferable Comm. Mode:', 'Courier')}
                  ${_infoRow('Document Status:', '<span style="display:inline-block;background:#c00;color:#fff;padding:2px 18px;border-radius:2px">&nbsp;</span>')}
                </table>
              </td>
            </tr>
          </table>

          <div style="display:flex;gap:20px;margin-top:10px;align-items:flex-start">
            <div>
              <table class="sur-dates-table">
                <thead><tr><th>BOOKING</th><th>ALLOTMENT</th><th>AGREEMENT</th></tr></thead>
                <tbody><tr>
                  <td>${_fmtDate(bk.booking_date)}</td>
                  <td>${_fmtDate(al.allotment_date)}</td>
                  <td>${_fmtDate(al.agreement_execute_date)}</td>
                </tr></tbody>
              </table>
            </div>
            <div style="flex:1">
              <div style="font-size:12px;font-weight:bold;text-align:center;margin-bottom:4px;text-decoration:underline">OTHER CHARGES INFORMATION</div>
              <table class="sur-addon-table">
                <thead><tr><th>S.NO</th><th>OTHER CHARGE</th><th>PAID QTY</th><th>FREE QTY</th><th>TOTAL QTY</th><th>AMOUNT</th><th>DESCRIPTION</th></tr></thead>
                <tbody>
                  ${addonRows}
                  <tr style="font-weight:bold;background:var(--surface2)">
                    <td colspan="5" style="text-align:right;padding-right:8px">Total:</td>
                    <td style="text-align:right">${_fmt(addonTotal)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>`;
  }

  // ── SECTION 3: FINANCIALS ──────────────────────────────────────────────────
  function _renderFinancialSection(fin, interestBalance) {
    const pct = fin.totalReceivables > 0 ? ((fin.totalReceived / fin.totalReceivables) * 100).toFixed(2) : '0.00';
    const pctI = fin.totalReceivables > 0 ? ((fin.totalInterestPaid / fin.totalReceivables) * 100).toFixed(2) : '0.00';

    return `
      <div class="sur-section">
        <div class="sur-section-body">
          <div style="display:flex;gap:20px">
            <div style="flex:1;font-size:12px">
              <div class="sur-fin-row"><span class="sur-fin-lbl">Carpet Area (Sq. Ft.):</span><span class="sur-fin-amt">${_fmt(fin.carpetArea)}</span></div>
              <div class="sur-fin-row"><span class="sur-fin-lbl">Rate (Rs./Sq. Ft.):</span><span class="sur-fin-amt">${_fmt(fin.basicRate)}</span></div>
              <div style="margin:4px 0 2px;font-size:11px;color:var(--text2)">Less:</div>
              <div class="sur-fin-row sur-fin-indent"><span class="sur-fin-lbl">Dis. by Company (0.00%):</span><span class="sur-fin-amt">0</span></div>
              <div class="sur-fin-row sur-fin-indent"><span class="sur-fin-lbl">Dis. by Broker:</span><span class="sur-fin-amt">0</span></div>
              <div class="sur-fin-row sur-fin-indent"><span class="sur-fin-lbl">Rebate by Company (Rs.):</span><span class="sur-fin-amt">0</span></div>
              <div class="sur-fin-row sur-fin-indent"><span class="sur-fin-lbl">Rebate by Broker (Rs.):</span><span class="sur-fin-amt">0</span></div>
              <div class="sur-fin-row sur-fin-indent"><span class="sur-fin-lbl">Inaugural Discount (Rs.):</span><span style="display:flex;gap:30px"><span>0</span><span style="border-top:1px solid var(--text2);min-width:80px;text-align:right">0</span></span></div>
              <div class="sur-fin-row sur-fin-total"><span class="sur-fin-lbl">Net Basic Price (Carpet Area×Rate):</span><span class="sur-fin-amt">${_fmt(fin.netBasicPrice)}</span></div>
              <div style="margin:4px 0 2px;font-size:11px;color:var(--text2)">Add:</div>
              <div class="sur-fin-row sur-fin-indent"><span class="sur-fin-lbl">PLC (Rs.):</span><span class="sur-fin-amt">${_fmt(fin.plcAmount)}</span></div>
              <div class="sur-fin-row sur-fin-indent"><span class="sur-fin-lbl">Other Charges (Rs.):</span><span class="sur-fin-amt">${_fmt(fin.otherCharge)}</span></div>
              <div class="sur-fin-row sur-fin-indent"><span class="sur-fin-lbl">(Rs.):</span><span style="display:flex;gap:30px"><span></span><span style="border-top:1px solid var(--text2);min-width:80px;text-align:right">${_fmt((fin.plcAmount||0)+(fin.otherCharge||0))}</span></span></div>
              <div class="sur-fin-row sur-fin-total"><span class="sur-fin-lbl">Total Consideration (Rs.):</span><span class="sur-fin-amt">${_fmt(fin.totalConsideration)}</span></div>
              <div class="sur-fin-words">(In words: ${_amtWords(fin.totalConsideration)})</div>
              <hr class="sur-fin-sep">
              <div class="sur-fin-row"><span class="sur-fin-lbl">Interest (Rs.):</span><span class="sur-fin-amt">${_fmt(fin.totalInterest)}</span></div>
              <div class="sur-fin-row"><span class="sur-fin-lbl">Interest Waive off (Rs.):</span><span class="sur-fin-amt">${_fmt(fin.totalWaived)}</span></div>
              <hr class="sur-fin-sep">
              <div class="sur-fin-row sur-fin-total"><span class="sur-fin-lbl">Total Receivables (Rs.):</span><span class="sur-fin-amt">${_fmt(fin.totalReceivables)}</span></div>
              <hr class="sur-fin-sep">
              <div class="sur-fin-row"><span class="sur-fin-lbl">Less Receipt (Rs.):</span><span class="sur-fin-amt">${_fmt(fin.totalReceived)}</span></div>
              <div class="sur-fin-row sur-fin-indent" style="font-size:11px;color:var(--text3)"><span>(Paid Amount ${pct} %)</span></div>
              <div class="sur-fin-row"><span class="sur-fin-lbl">Less Interest (Rs.):</span><span class="sur-fin-amt">${_fmt(fin.totalInterestPaid)}</span></div>
              <div class="sur-fin-row sur-fin-indent" style="font-size:11px;color:var(--text3)"><span>(Paid Interest)</span></div>
              <div class="sur-fin-row"><span class="sur-fin-lbl">Credit Note (Rs.):</span><span class="sur-fin-amt">0</span></div>
              <div class="sur-fin-row"><span class="sur-fin-lbl">Debit Note (Rs.):</span><span class="sur-fin-amt">0</span></div>
              <div class="sur-fin-row"><span class="sur-fin-lbl">Payment Refund (Rs.):</span><span style="display:flex;gap:30px"><span>0</span><span style="border-top:1px solid var(--text2);min-width:80px;text-align:right">${_fmt((fin.totalReceived||0)+(fin.totalInterestPaid||0))}</span></span></div>
              <hr class="sur-fin-sep">
              <div class="sur-fin-row sur-fin-balance"><span>Balance (Rs.):</span><span class="sur-fin-amt">${_fmt(fin.balance)}</span></div>
              <div style="font-size:11px;color:var(--text2)">(To be Paid)</div>
            </div>
            <div style="width:340px">
              <div class="sur-interest-box">
                <table>
                  <thead><tr><th>TOTAL INTEREST</th><th>WAIVE OFF</th><th>PAID</th><th>BALANCE</th></tr></thead>
                  <tbody><tr>
                    <td>${_fmt(fin.totalInterest)}</td>
                    <td>${_fmt(fin.totalWaived)}</td>
                    <td>${_fmt(fin.totalInterestPaid)}</td>
                    <td>${_fmt(interestBalance)}</td>
                  </tr></tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  // ── SECTION 4: PAYMENT SCHEDULE ────────────────────────────────────────────
  function _renderPaymentSchedule(demands, sched, fin, receipts) {
    const np = fin.netBasicPrice || 0;
    const oc = fin.otherCharge || 0;
    const plc = fin.plcAmount || 0;

    let totalBP = 0, totalOC = 0, totalPLC = 0, totalInst = 0, totalNetInst = 0, totalRecd = 0, totalOS = 0;

    const rows = demands.map((d, i) => {
      const tmpl = sched[i] || {};
      const pct = parseFloat(tmpl.percentage || 0) / 100;
      const bp = Math.round(pct * np);
      const ocAmt = Math.round(pct * oc);
      const plcAmt = Math.round(pct * plc);
      const instAmt = parseFloat(d.amount_due_inr || 0);
      const netInst = instAmt;
      const amtRecd = 0;
      const amtOS = netInst - amtRecd;

      totalBP += bp; totalOC += ocAmt; totalPLC += plcAmt;
      totalInst += instAmt; totalNetInst += netInst; totalRecd += amtRecd; totalOS += amtOS;

      return `<tr>
        <td>${i+1}</td>
        <td class="sur-left">${_v(tmpl.installment_name || d.installment_index)}</td>
        <td>${_fmtDate(d.due_date)}</td>
        <td class="sur-right">${_fmt(bp)}</td>
        <td class="sur-right">${_fmt(ocAmt)}</td>
        <td class="sur-right">${_fmt(plcAmt)}</td>
        <td class="sur-right">${_fmt(instAmt)}</td>
        <td class="sur-right">0</td>
        <td class="sur-right">0</td>
        <td class="sur-right">${_fmt(netInst)}</td>
        <td class="sur-right">${_fmt(amtRecd)}</td>
        <td class="sur-right">${_fmt(amtOS)}</td>
      </tr>`;
    }).join('') || `<tr><td colspan="12" style="text-align:center;color:var(--text3)">No schedule data</td></tr>`;

    return `
      <div class="sur-section">
        <div class="sur-section-title">PAYMENTS SCHEDULE</div>
        <div style="overflow-x:auto;padding:0">
          <table class="sur-table">
            <thead><tr>
              <th>S.NO</th><th>INSTALLMENT NAME</th><th>INSTALLMENT DATE</th>
              <th>TOTAL B.P.</th><th>OTHER CHARGES</th><th>PLC</th>
              <th>INST. AMT</th><th>DR</th><th>CR</th>
              <th>NET INST. AMT</th><th>AMT. RECD</th><th>AMT. O/S</th>
            </tr></thead>
            <tbody>
              ${rows}
              <tr style="font-weight:bold;background:var(--surface2)">
                <td colspan="3" style="text-align:right;padding-right:10px">Total</td>
                <td class="sur-right">${_fmt(totalBP)}</td>
                <td class="sur-right">${_fmt(totalOC)}</td>
                <td class="sur-right">${_fmt(totalPLC)}</td>
                <td class="sur-right">${_fmt(totalInst)}</td>
                <td class="sur-right">0</td>
                <td class="sur-right">0</td>
                <td class="sur-right">${_fmt(totalNetInst)}</td>
                <td class="sur-right">${_fmt(totalRecd)}</td>
                <td class="sur-right">${_fmt(totalOS)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>`;
  }

  // ── SECTION 5: RECEIPT INFORMATION ────────────────────────────────────────
  function _renderReceiptSection(receipts) {
    let totAmt = 0, totST = 0, totCGST = 0, totSGST = 0, totITC = 0, totInt = 0, totNet = 0;

    const rows = receipts.map((r, i) => {
      const amt = parseFloat(r.amount_received_inr || 0);
      const cgst = parseFloat(r.cgst_amount || 0);
      const sgst = parseFloat(r.sgst_amount || 0);
      const interest = parseFloat(r.interest_amount || 0);
      const net = amt + cgst + sgst;
      totAmt += amt; totCGST += cgst; totSGST += sgst; totInt += interest; totNet += net;

      const bounced = r.status === 'bounced';
      const pending = r.status === 'pending';
      const rowStyle = bounced ? 'background:#ffe4e4' : pending ? 'background:#fffbe6' : '';

      return `<tr style="${rowStyle}">
        <td>${i+1}</td>
        <td class="sur-left">${_v(r.receipt_number)}</td>
        <td>${_fmtDate(r.received_date)}</td>
        <td>${_v(r.payment_method)}</td>
        <td>${_v(r.cheque_no)}</td>
        <td>${_fmtDate(r.clearing_date)}</td>
        <td>${_v(r.bank_name)}</td>
        <td>${_v(r.bank_name)}</td>
        <td>${_fmtDate(r.clearing_date)}</td>
        <td class="sur-right">${_fmt(amt)}</td>
        <td class="sur-right">0</td>
        <td class="sur-right">${_fmt(cgst)}</td>
        <td class="sur-right">${_fmt(sgst)}</td>
        <td class="sur-right">0</td>
        <td class="sur-right">${_fmt(interest)}</td>
        <td class="sur-right">${_fmt(net)}</td>
        <td>${bounced ? 'Bounced' : pending ? 'Pending' : 'Cleared'}</td>
      </tr>`;
    }).join('') || `<tr><td colspan="17" style="text-align:center;color:var(--text3)">No receipts</td></tr>`;

    return `
      <div class="sur-section">
        <div class="sur-section-title">RECEIPT INFORMATION</div>
        <div style="text-align:right;padding:4px 14px;font-size:11px">
          <span style="display:inline-flex;align-items:center;gap:4px;margin-right:14px"><span style="display:inline-block;width:14px;height:14px;background:#c00;border:1px solid #aaa"></span> Bounce cheque</span>
          <span style="display:inline-flex;align-items:center;gap:4px"><span style="display:inline-block;width:14px;height:14px;background:#fffbe6;border:1px solid #aaa"></span> Pending cheque</span>
        </div>
        <div style="overflow-x:auto">
          <table class="sur-table" style="font-size:11px">
            <thead><tr>
              <th>S.NO</th><th>RECEIPT NO</th><th>RECEIPT DATE</th><th>MODE</th>
              <th>CHEQUE/DRAFT/REF NO</th><th>CHEQUE/DRAFT/REF DATE</th>
              <th>DRAWN ON</th><th>CLEARING BANK</th><th>CLEAR/BOUNCE DATE</th>
              <th>AMOUNT</th><th>SERVICE TAX</th><th>CGST</th><th>SGST</th><th>ITC</th>
              <th>INTEREST</th><th>NET AMOUNT</th><th>PAYMENT STATUS</th>
            </tr></thead>
            <tbody>
              ${rows}
              <tr style="font-weight:bold;background:var(--surface2);font-size:11px">
                <td colspan="9" style="text-align:right;padding-right:8px">Received Amt.</td>
                <td class="sur-right">${_fmt(totAmt)}</td>
                <td class="sur-right">${_fmt(totST)}</td>
                <td class="sur-right">${_fmt(totCGST)}</td>
                <td class="sur-right">${_fmt(totSGST)}</td>
                <td class="sur-right">${_fmt(totITC)}</td>
                <td class="sur-right">${_fmt(totInt)}</td>
                <td class="sur-right">${_fmt(totNet)}</td>
                <td></td>
              </tr>
              <tr style="font-weight:bold;background:var(--surface2);font-size:11px">
                <td colspan="9" style="text-align:right;padding-right:8px">Pending Amt.</td>
                <td colspan="7" class="sur-right">0</td><td></td>
              </tr>
              <tr style="font-weight:bold;background:var(--surface2);font-size:11px">
                <td colspan="9" style="text-align:right;padding-right:8px">Cleared Amt.</td>
                <td class="sur-right">${_fmt(totAmt)}</td>
                <td class="sur-right">${_fmt(totST)}</td>
                <td class="sur-right">${_fmt(totCGST)}</td>
                <td class="sur-right">${_fmt(totSGST)}</td>
                <td class="sur-right">${_fmt(totITC)}</td>
                <td class="sur-right">${_fmt(totInt)}</td>
                <td class="sur-right">${_fmt(totNet)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>`;
  }

  // ── SECTION 6: INTEREST CALCULATION ───────────────────────────────────────
  function _renderInterestCalcSection(demands, receipts) {
    const rows = demands.map((d, i) => {
      const dueAmt = parseFloat(d.amount_due_inr || 0);
      const recd = receipts[i] ? parseFloat(receipts[i].amount_received_inr || 0) : 0;
      const delay = Math.max(0, dueAmt - recd);
      const roi = 15;
      return `<tr>
        <td>${i+1}</td>
        <td class="sur-left">${_v(d.installment_index)}</td>
        <td>${_fmtDate(d.due_date)}</td>
        <td class="sur-right">${_fmt(dueAmt)}</td>
        <td class="sur-right">${_fmt(recd)}</td>
        <td>${receipts[i] ? _fmtDate(receipts[i].received_date) : 'N/A'}</td>
        <td class="sur-right">${_fmt(delay)}</td>
        <td class="sur-right">0</td>
        <td class="sur-right">0</td>
        <td>—</td>
        <td class="sur-right">${roi}%</td>
        <td class="sur-right">0</td>
      </tr>`;
    }).join('') || `<tr><td colspan="12" style="text-align:center;color:var(--text3)">No data</td></tr>`;

    return `
      <div class="sur-section">
        <div class="sur-section-title">INTEREST CALCULATION</div>
        <div style="overflow-x:auto">
          <table class="sur-table" style="font-size:11px">
            <thead><tr>
              <th>S.NO</th><th>INSTALLMENT NAME</th><th>DUE DATE</th>
              <th>DUE AMOUNT</th><th>AMT RECEIVED</th><th>DATE OF RECEIVED</th>
              <th>DELAY AMOUNT</th><th>DELAY DAYS</th><th>GRACE PERIOD</th>
              <th>INTEREST PERIOD</th><th>ROI</th><th>INTEREST AMOUNT</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  // ── SECTION 7: REMARKS + DISPATCH ─────────────────────────────────────────
  function _renderRemarksSection(dispatches) {
    const drows = dispatches.map((d, i) => `
      <tr>
        <td>${i+1}</td>
        <td class="sur-left">${_v(d.document_type)}</td>
        <td>${_v(d.dispatch_mode)}</td>
        <td>${_v(d.tracking_no)}</td>
        <td>${_fmtDate(d.dispatched_at)}</td>
        <td>—</td>
      </tr>`).join('') || `<tr><td colspan="6" style="text-align:center;color:var(--text3)">No document dispatches</td></tr>`;

    return `
      <div class="sur-section">
        <div class="sur-section-title">REMARKS &amp; DOCUMENT DISPATCH</div>
        <div class="sur-section-body">
          <div style="font-size:12px;margin-bottom:8px">
            <b>Registration Remarks:</b> N/A &nbsp;&nbsp;
            <b>Allotment Remarks:</b> N/A
          </div>
          <table class="sur-table">
            <thead><tr>
              <th>S.NO</th><th>DOCUMENT NAME</th><th>DISPATCH TYPE</th>
              <th>DISPATCH NO./NAME</th><th>DISPATCH DATE</th><th>REMARKS</th>
            </tr></thead>
            <tbody>${drows}</tbody>
          </table>
        </div>
      </div>`;
  }

  // ── SECTION 8: ACTION FORM ─────────────────────────────────────────────────
  function _renderActionForm(fin, addons) {
    const addonSum = addons.reduce((s, a) => s + parseFloat(a.total_amount || 0), 0);
    return `
      <div class="sur-action-section">
        <div class="sur-action-hdr">SURRENDER / CANCELLATION ACTION</div>
        <div class="sur-action-body">
          <div id="sur-form-msg"></div>

          <div class="sur-action-row">
            <div class="sur-toggle-group">
              <span class="sur-toggle-lbl">GST Included:</span>
              <div class="sur-toggle-btns">
                <button class="sur-tbtn sur-ton" data-tog="gst" data-val="yes" onclick="SurrenderApp._tog(this,'gst','yes')">Yes</button>
                <button class="sur-tbtn" data-tog="gst" data-val="no" onclick="SurrenderApp._tog(this,'gst','no')">No</button>
              </div>
            </div>
            <div class="sur-toggle-group">
              <span class="sur-toggle-lbl">Service Tax Included:</span>
              <div class="sur-toggle-btns">
                <button class="sur-tbtn" data-tog="st" data-val="yes" onclick="SurrenderApp._tog(this,'st','yes')">Yes</button>
                <button class="sur-tbtn sur-ton" data-tog="st" data-val="no" onclick="SurrenderApp._tog(this,'st','no')">No</button>
              </div>
            </div>
            <div class="sur-toggle-group">
              <span class="sur-toggle-lbl">VAT Included:</span>
              <div class="sur-toggle-btns">
                <button class="sur-tbtn" data-tog="vat" data-val="yes" onclick="SurrenderApp._tog(this,'vat','yes')">Yes</button>
                <button class="sur-tbtn sur-ton" data-tog="vat" data-val="no" onclick="SurrenderApp._tog(this,'vat','no')">No</button>
              </div>
            </div>
            <div class="sur-toggle-group">
              <span class="sur-toggle-lbl">Interest Included:</span>
              <div class="sur-toggle-btns">
                <button class="sur-tbtn sur-ton" data-tog="int" data-val="yes" onclick="SurrenderApp._tog(this,'int','yes')">Yes</button>
                <button class="sur-tbtn" data-tog="int" data-val="no" onclick="SurrenderApp._tog(this,'int','no')">No</button>
              </div>
            </div>
            <div class="sur-action-field" style="min-width:120px">
              <label>Premium (Rs.):</label>
              <input type="number" id="sur-premium" value="0" min="0" oninput="SurrenderApp._calcTotal()">
            </div>
            <div class="sur-action-field" style="min-width:120px">
              <label>Penalty (Rs.):</label>
              <input type="number" id="sur-penalty" value="0" min="0" oninput="SurrenderApp._calcTotal()">
            </div>
          </div>

          <div class="sur-action-row">
            <div class="sur-action-field" style="min-width:160px">
              <label>Extra Addon Charges (Rs.):</label>
              <input type="number" id="sur-addon-charges" value="${addonSum.toFixed(2)}" oninput="SurrenderApp._calcTotal()">
            </div>
            <div class="sur-action-field" style="min-width:160px">
              <label>Total Amount (Rs.):</label>
              <input type="number" id="sur-total-amt" readonly value="${(fin.balance||0).toFixed(2)}" style="background:var(--surface2);font-weight:bold">
            </div>
            <div class="sur-toggle-group">
              <span class="sur-toggle-lbl">Bank NOC:</span>
              <div class="sur-toggle-btns">
                <button class="sur-tbtn" data-tog="banknoc" data-val="yes" onclick="SurrenderApp._tog(this,'banknoc','yes')">Yes</button>
                <button class="sur-tbtn sur-ton" data-tog="banknoc" data-val="no" onclick="SurrenderApp._tog(this,'banknoc','no')">No</button>
              </div>
            </div>
            <div class="sur-action-field">
              <label>Attach NOC (Bank):</label>
              <input type="file" id="sur-bank-noc-file" accept=".pdf,.jpg,.png">
            </div>
            <div class="sur-toggle-group">
              <span class="sur-toggle-lbl">Broker NOC:</span>
              <div class="sur-toggle-btns">
                <button class="sur-tbtn" data-tog="brokernoc" data-val="yes" onclick="SurrenderApp._tog(this,'brokernoc','yes')">Yes</button>
                <button class="sur-tbtn sur-ton" data-tog="brokernoc" data-val="no" onclick="SurrenderApp._tog(this,'brokernoc','no')">No</button>
              </div>
            </div>
            <div class="sur-action-field">
              <label>Attach NOC (Broker):</label>
              <input type="file" id="sur-broker-noc-file" accept=".pdf,.jpg,.png">
            </div>
          </div>

          <div class="sur-action-row">
            <div class="sur-action-field" style="min-width:160px">
              <label>Type:</label>
              <select id="sur-refund-type">
                <option value="refund_case">Refund Case</option>
                <option value="non_refund">Non-Refund</option>
                <option value="partial_refund">Partial Refund</option>
              </select>
            </div>
            <div class="sur-action-field" style="min-width:140px">
              <label>Surrender Date:</label>
              <input type="date" id="sur-date" value="${Utils.today()}">
            </div>
            <div class="sur-toggle-group">
              <span class="sur-toggle-lbl">Mode of Payment:</span>
              <div class="sur-mode-btns">
                <button class="sur-mode-btn" data-mode="cash" onclick="SurrenderApp._setMode(this)">Cash</button>
                <button class="sur-mode-btn" data-mode="draft" onclick="SurrenderApp._setMode(this)">Draft</button>
                <button class="sur-mode-btn" data-mode="cheque" onclick="SurrenderApp._setMode(this)">Cheque</button>
                <button class="sur-mode-btn sur-mactive" data-mode="online" onclick="SurrenderApp._setMode(this)">Online</button>
              </div>
            </div>
          </div>

          <div class="sur-action-row">
            <div class="sur-action-field" style="min-width:320px">
              <label>Remark:</label>
              <textarea id="sur-remark" placeholder="Enter remark..."></textarea>
            </div>
            <div class="sur-action-field">
              <label>Document:</label>
              <span style="color:var(--teal);cursor:pointer;text-decoration:underline;font-size:12px">Document required</span>
            </div>
          </div>

          <div class="sur-submit-row">
            <button class="sur-btn-surrender" onclick="SurrenderApp.submitSurrender()">SURRENDER</button>
            <button class="sur-btn-close" onclick="SurrenderApp.back()">CLOSE</button>
          </div>
        </div>
      </div>`;
  }

  // ── ACTION FORM HELPERS ────────────────────────────────────────────────────
  function _initActionForm(fin, addons) {
    window.SurrenderApp._fin = fin;
    window.SurrenderApp._addons = addons;
  }

  function _tog(btn, group, val) {
    document.querySelectorAll(`[data-tog="${group}"]`).forEach(b => b.classList.remove('sur-ton'));
    btn.classList.add('sur-ton');
  }

  function _setMode(btn) {
    document.querySelectorAll('.sur-mode-btn').forEach(b => b.classList.remove('sur-mactive'));
    btn.classList.add('sur-mactive');
  }

  function _calcTotal() {
    const fin = window.SurrenderApp._fin || {};
    const penalty = parseFloat(document.getElementById('sur-penalty')?.value || 0);
    const premium = parseFloat(document.getElementById('sur-premium')?.value || 0);
    const addonCharges = parseFloat(document.getElementById('sur-addon-charges')?.value || 0);
    const total = (fin.totalReceivables || 0) - (fin.totalReceived || 0) + penalty + premium - addonCharges;
    const el = document.getElementById('sur-total-amt');
    if (el) el.value = total.toFixed(2);
  }

  // ── SUBMIT ─────────────────────────────────────────────────────────────────
  let _busy = false;   // a second click while the first is on its way would only show a wrong 'already surrendered' error
  async function _submitSurrender() {
    if (!_detail || !_selectedConsumer || _busy) return;

    const d = _detail;
    const surrenderDate = document.getElementById('sur-date')?.value;
    if (!surrenderDate) { alert('Please select a surrender date.'); return; }

    const fin = d.financials || {};
    const penalty = parseFloat(document.getElementById('sur-penalty')?.value || 0);
    const premium = parseFloat(document.getElementById('sur-premium')?.value || 0);
    const extraAddonCharges = parseFloat(document.getElementById('sur-addon-charges')?.value || 0);
    const totalAmount = parseFloat(document.getElementById('sur-total-amt')?.value || 0);
    const remark = document.getElementById('sur-remark')?.value || '';
    const refundType = document.getElementById('sur-refund-type')?.value || 'refund_case';
    const mode = document.querySelector('.sur-mode-btn.sur-mactive')?.dataset.mode || 'online';

    const gstIncluded = document.querySelector('[data-tog="gst"].sur-ton')?.dataset.val === 'yes';
    const stIncluded = document.querySelector('[data-tog="st"].sur-ton')?.dataset.val === 'yes';
    const vatIncluded = document.querySelector('[data-tog="vat"].sur-ton')?.dataset.val === 'yes';
    const intIncluded = document.querySelector('[data-tog="int"].sur-ton')?.dataset.val === 'yes';
    const bankNoc = document.querySelector('[data-tog="banknoc"].sur-ton')?.dataset.val === 'yes';
    const brokerNoc = document.querySelector('[data-tog="brokernoc"].sur-ton')?.dataset.val === 'yes';

    const msgEl = document.getElementById('sur-form-msg');

    _busy = true;
    try {
      const res = await fetch('/api/surrender', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + _tok(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consumerId: d.consumer.id,
          allocationId: d.allocation.id,
          bookingId: d.booking.id,
          unitId: d.unit.id,
          projectId: d.project.id,
          type: _type,
          surrenderDate,
          surrenderType: refundType,
          forfeitureAmount: penalty,
          refundAmount: Math.max(0, (fin.totalReceived || 0) - penalty),
          penaltyBaseAmount: penalty,
          penaltyGstAmount: 0,
          penaltyTotalAmount: penalty,
          extraAddonCharges,
          totalAmount,
          gstIncluded,
          serviceTaxIncluded: stIncluded,
          vatIncluded,
          interestIncluded: intIncluded,
          premiumAmount: premium,
          bankNoc,
          brokerNoc,
          refundMode: mode,
          remark,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Submission failed');

      if (msgEl) msgEl.innerHTML = `<div class="sur-success-msg">Surrender processed successfully.</div>`;
      _consumers = _consumers.filter(c => c.consumer_id !== d.consumer.id);   // no longer a unit holder
      setTimeout(() => _back(), 2000);
    } catch (e) {
      _busy = false;
      if (msgEl) msgEl.innerHTML = `<div class="sur-error-msg">Error: ${e.message}</div>`;
    }
  }

  // ── RENDER ROUTER ──────────────────────────────────────────────────────────
  function _render() {
    const container = document.getElementById('content') || document.body;
    if (_tab === 'report') {
      container.innerHTML = SUR_STYLES + _renderTabBar() + _renderReport();
      return;
    }
    if (_tab === 'restore') {
      container.innerHTML = SUR_STYLES + _renderTabBar() + _renderRestore();
      return;
    }
    if (_view === 'search') {
      container.innerHTML = SUR_STYLES + _renderTabBar() + _renderSearch();
      _loadProjects();
    } else {
      container.innerHTML = SUR_STYLES + _renderTabBar() + _renderFormShell();
    }
  }

  async function _loadProjects() {
    try {
      const res = await fetch('/api/projects', {
        headers: { 'Authorization': 'Bearer ' + _tok() }
      });
      const data = await res.json();
      _projects = data.data || data || [];
      const sel = document.getElementById('sur-project');
      if (sel) {
        sel.innerHTML = '<option value="">--Select--</option>' +
          _projects.map(p => `<option value="${p.id}">${Utils.esc(p.name)}</option>`).join('');
        _reapply('sur-project');
      }
    } catch(e) {}
  }

  // ── TAB 2: REPORT ─────────────────────────────────────────────────────────
  function _renderReport() {
    const projOpts = _reportProjects.map(p =>
      `<option value="${p.id}">${Utils.esc(p.name)}</option>`
    ).join('');

    const rows = _reportRows.map((r, i) => `
      <tr>
        <td>${i+1}</td>
        <td>${r.registration_no || '—'}</td>
        <td class="sur-left">${r.full_name || r.name || '—'}</td>
        <td>${r.unit_number || '—'}</td>
        <td>${r.tower_name || '—'}</td>
        <td>${_fmtDate(r.surrender_date || r.cancellation_date)}</td>
        <td>
          <span style="padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600;
            background:${r.type==='cancellation' ? 'var(--warn-bg);color:var(--warn)' : 'var(--teal-bg);color:var(--teal)'}">
            ${r.type === 'cancellation' ? 'Cancellation' : 'Surrender'}
          </span>
        </td>
        <td class="sur-right">${_fmt(r.refund_amount_inr || 0)}</td>
        <td>
          <span style="padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600;background:
            ${(r.status||r.refund_status)==='restored' ? 'var(--teal-bg);color:var(--teal)'
              : (r.status||r.refund_status)==='approved' ? 'var(--blue-bg);color:var(--blue)'
              : 'var(--surface2);color:var(--text2)'}">
            ${r.status || r.refund_status || 'pending'}
          </span>
        </td>
        <td>${_fmtDate(r.created_at)}</td>
      </tr>`).join('')
      || `<tr><td colspan="10" style="text-align:center;color:var(--text3);padding:20px">No records found.</td></tr>`;

    return `
      <div class="sur-card">
        <div class="sur-hdr">
          <span class="sur-hdr-title">SURRENDER / CANCELLATION REPORT</span>
        </div>
        <div class="sur-body">
          <div class="sur-filter-grid">
            <div class="sur-field">
              <span class="sur-lbl">Project</span>
              <select id="rep-project" style="min-width:180px">
                <option value="">-- All Projects --</option>
                ${projOpts}
              </select>
            </div>
            <div class="sur-field">
              <span class="sur-lbl">Type</span>
              <select id="rep-type" style="min-width:140px">
                <option value="">-- All --</option>
                <option value="surrender">Surrender</option>
                <option value="cancellation">Cancellation</option>
              </select>
            </div>
            <div class="sur-field">
              <span class="sur-lbl">From Date</span>
              <input type="date" id="rep-from">
            </div>
            <div class="sur-field">
              <span class="sur-lbl">To Date</span>
              <input type="date" id="rep-to">
            </div>
            <div class="sur-field">
              <span class="sur-lbl">&nbsp;</span>
              <button class="sur-btn-fetch" style="width:auto;padding:6px 20px"
                onclick="SurrenderApp.fetchReport()">FETCH</button>
            </div>
          </div>
        </div>
      </div>
      <div class="sur-card">
        <div class="sur-hdr"><span class="sur-hdr-title">REPORT DETAILS</span></div>
        <div style="overflow-x:auto">
          <table class="sur-table">
            <thead><tr>
              <th>S.NO</th><th>REGISTRATION NO</th><th>NAME</th>
              <th>UNIT</th><th>TOWER</th><th>SURRENDER DATE</th>
              <th>TYPE</th><th>REFUND AMOUNT</th><th>STATUS</th><th>DATE</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  async function _loadReportProjects() {
    try {
      const res = await fetch('/api/projects', {
        headers: { 'Authorization': 'Bearer ' + _tok() }
      });
      const data = await res.json();
      _reportProjects = data.data || data || [];
      const sel = document.getElementById('rep-project');
      if (sel) {
        sel.innerHTML = '<option value="">-- All Projects --</option>'
          + _reportProjects.map(p => `<option value="${p.id}">${Utils.esc(p.name)}</option>`).join('');
        _reapply('rep-project');
      }
    } catch(e) {}
  }

  async function _fetchReport() {
    const projectId = document.getElementById('rep-project')?.value || '';
    const type = document.getElementById('rep-type')?.value || '';
    const fromDate = document.getElementById('rep-from')?.value || '';
    const toDate = document.getElementById('rep-to')?.value || '';

    const btn = document.querySelector('.sur-btn-fetch');
    if (btn) { btn.disabled = true; btn.textContent = 'Loading...'; }

    try {
      const params = new URLSearchParams();
      if (projectId) params.append('projectId', projectId);

      const [sRes, cRes] = await Promise.all([
        fetch(`/api/surrender/list?${params}&type=surrender`, {
          headers: { 'Authorization': 'Bearer ' + _tok() }
        }),
        fetch(`/api/surrender/list?${params}&type=cancellation`, {
          headers: { 'Authorization': 'Bearer ' + _tok() }
        })
      ]);

      const sData = await sRes.json();
      const cData = await cRes.json();

      let rows = [
        ...(sData.data || []).map(r => ({ ...r, type: 'surrender' })),
        ...(cData.data || []).map(r => ({ ...r, type: 'cancellation' }))
      ];

      if (type) rows = rows.filter(r => r.type === type);

      if (fromDate) rows = rows.filter(r => {
        const d = r.surrender_date || r.cancellation_date;
        return d && d >= fromDate;
      });
      if (toDate) rows = rows.filter(r => {
        const d = r.surrender_date || r.cancellation_date;
        return d && d <= toDate;
      });

      rows.sort((a, b) => {
        const da = a.surrender_date || a.cancellation_date || '';
        const db = b.surrender_date || b.cancellation_date || '';
        return db.localeCompare(da);
      });

      _reportRows = rows;
      _save('rep-project', 'rep-type', 'rep-from', 'rep-to');
      const container = document.getElementById('content') || document.body;
      container.innerHTML = SUR_STYLES + _renderTabBar() + _renderReport();
      _reapply();
      _loadReportProjects();

    } catch(e) {
      alert('Error: ' + e.message);
    } finally {
      const b = document.querySelector('.sur-btn-fetch');
      if (b) { b.disabled = false; b.textContent = 'FETCH'; }
    }
  }

  // ── TAB 3: RESTORE ────────────────────────────────────────────────────────
  function _renderRestore() {
    const projOpts = _restoreProjects.map(p =>
      `<option value="${p.id}">${Utils.esc(p.name)}</option>`
    ).join('');

    const rows = _restoreRows.map((r, i) => {
      const state = r.status || r.refund_status;   // a cancellation keeps its state in refund_status
      const canRestore = state !== 'restored';
      return `<tr>
        <td>${i+1}</td>
        <td>${r.registration_no || '—'}</td>
        <td class="sur-left">${r.full_name || r.name || '—'}</td>
        <td>${r.unit_number || '—'}</td>
        <td>${r.tower_name || '—'}</td>
        <td>${_fmtDate(r.surrender_date || r.cancellation_date)}</td>
        <td>
          <span style="padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600;
            background:${state==='restored' ? 'var(--teal-bg);color:var(--teal)' : 'var(--red-bg);color:var(--red)'}">
            ${state || 'pending'}
          </span>
        </td>
        <td>
          ${canRestore
            ? `<button onclick="SurrenderApp.restore('${r.id}','${_restoreType}','${r.consumer_id}','${r.allocation_id}','${r.unit_id||''}','${r.booking_record_id||''}')"
                style="background:var(--teal);color:#fff;border:none;padding:5px 16px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">
                Restore
               </button>`
            : '<span style="color:var(--text3);font-size:12px">Restored</span>'
          }
        </td>
      </tr>`;
    }).join('')
    || `<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:20px">No surrendered/cancelled records found.</td></tr>`;

    return `
      <div class="sur-card">
        <div class="sur-hdr">
          <span class="sur-hdr-title">CANCEL SURRENDER / RESTORE</span>
          <div class="sur-type-toggle">
            <button class="sur-type-btn${_restoreType==='surrender'?' sur-active':''}"
              onclick="SurrenderApp.setRestoreType('surrender')">Surrender</button>
            <button class="sur-type-btn${_restoreType==='cancellation'?' sur-active':''}"
              onclick="SurrenderApp.setRestoreType('cancellation')">Cancellation</button>
          </div>
        </div>
        <div class="sur-body">
          <div class="sur-filter-grid">
            <div class="sur-field">
              <span class="sur-lbl">Project*</span>
              <select id="res-project" style="min-width:180px">
                <option value="">-- Select --</option>
                ${projOpts}
              </select>
            </div>
            <div class="sur-field">
              <span class="sur-lbl">Registration No.</span>
              <input id="res-regno" type="text" placeholder="Registration No." style="min-width:140px">
            </div>
            <div class="sur-field">
              <span class="sur-lbl">First Name</span>
              <input id="res-name" type="text" placeholder="First Name" style="min-width:130px">
            </div>
            <div class="sur-field">
              <span class="sur-lbl">&nbsp;</span>
              <button class="sur-btn-fetch" style="width:auto;padding:6px 20px"
                onclick="SurrenderApp.fetchRestore()">FETCH</button>
            </div>
          </div>
        </div>
      </div>
      <div id="sur-restore-msg"></div>
      <div class="sur-card">
        <div class="sur-hdr"><span class="sur-hdr-title">SURRENDERED / CANCELLED APPLICANTS</span></div>
        <div style="overflow-x:auto">
          <table class="sur-table">
            <thead><tr>
              <th>S.NO</th><th>REGISTRATION NO</th><th>NAME</th>
              <th>UNIT</th><th>TOWER</th><th>SURRENDER DATE</th>
              <th>STATUS</th><th>ACTION</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  async function _loadRestoreProjects() {
    try {
      const res = await fetch('/api/projects', {
        headers: { 'Authorization': 'Bearer ' + _tok() }
      });
      const data = await res.json();
      _restoreProjects = data.data || data || [];
      const sel = document.getElementById('res-project');
      if (sel) {
        sel.innerHTML = '<option value="">-- Select --</option>'
          + _restoreProjects.map(p => `<option value="${p.id}">${Utils.esc(p.name)}</option>`).join('');
        _reapply('res-project');
      }
    } catch(e) {}
  }

  async function _fetchRestore() {
    const projectId = document.getElementById('res-project')?.value || '';
    const params = new URLSearchParams({ type: _restoreType });
    if (projectId) params.append('projectId', projectId);

    const btn = document.querySelector('.sur-btn-fetch');
    if (btn) { btn.disabled = true; btn.textContent = 'Loading...'; }

    try {
      const res = await fetch(`/api/surrender/list?${params}`, {
        headers: { 'Authorization': 'Bearer ' + _tok() }
      });
      const data = await res.json();
      const rn = (document.getElementById('res-regno')?.value || '').trim().toLowerCase(), nm = (document.getElementById('res-name')?.value || '').trim().toLowerCase();
      _restoreRows = (data.data || []).filter(r => (!rn || (r.registration_no || '').toLowerCase().includes(rn)) && (!nm || (r.full_name || r.name || '').toLowerCase().includes(nm)));
      _save('res-project', 'res-regno', 'res-name');
      const container = document.getElementById('content') || document.body;
      container.innerHTML = SUR_STYLES + _renderTabBar() + _renderRestore();
      _reapply();
      _loadRestoreProjects();
    } catch(e) {
      alert('Error: ' + e.message);
    } finally {
      const b = document.querySelector('.sur-btn-fetch');
      if (b) { b.disabled = false; b.textContent = 'FETCH'; }
    }
  }

  function _setRestoreType(type) {
    _restoreType = type;
    _restoreRows = [];
    const container = document.getElementById('content') || document.body;
    container.innerHTML = SUR_STYLES + _renderTabBar() + _renderRestore();
    _loadRestoreProjects();
  }

  async function _restore(surrenderId, type, consumerId, allocationId, unitId, bookingId) {
    if (!await Utils.ask('Restore this applicant? This will reactivate their booking and lock the unit again.')) return;

    const msgEl = document.getElementById('sur-restore-msg');

    try {
      const res = await fetch('/api/surrender/restore', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + _tok(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ surrenderId, type, consumerId, allocationId, unitId, bookingId })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Restore failed');

      await _fetchRestore();   // draws the screen again, so the message goes in after it
      const done = document.getElementById('sur-restore-msg');
      if (done) done.innerHTML = `<div class="sur-success-msg">Applicant restored successfully.</div>`;

    } catch(e) {
      if (msgEl) msgEl.innerHTML = `<div class="sur-error-msg">Error: ${e.message}</div>`;
    }
  }

  function _init() {
    _view = 'search';
    _tab = 'surrender';
    _consumers = [];
    _detail = null;
    _selectedConsumer = null;
    _reportRows = [];
    _restoreRows = [];
    _restoreType = 'surrender';
    _loadProjects();
  }

  function _renderPage() {
    return SUR_STYLES + _renderTabBar() + _renderSearch();
  }

  // ── PUBLIC API ─────────────────────────────────────────────────────────────
  window.SurrenderApp = {
    search: _search,
    showForm: _showForm,
    back: _back,
    submitSurrender: _submitSurrender,
    toggleType: _toggleType,
    switchTab: _switchTab,
    fetchReport: _fetchReport,
    fetchRestore: _fetchRestore,
    setRestoreType: _setRestoreType,
    restore: _restore,
    _tog: _tog,
    _setMode: _setMode,
    _calcTotal: _calcTotal,
    _fin: null,
    _addons: null,
  };

  Pages.surrender = function(params) {
    const container = document.getElementById('content') || document.body;
    container.innerHTML = _renderPage();
    _init();
  };

})();
