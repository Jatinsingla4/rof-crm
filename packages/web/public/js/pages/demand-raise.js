// ROF CRM — Multi-View Demand Raise Page

Pages.demandRaise = async function(params = {}) {
  const view = params.view || 'customer';
  const content = document.getElementById('content');

  // Load projects once (shared by all views)
  let projects = [];
  try {
    // every project, not only those whose units fall in the first page of units
    projects = (await window.ProjectCache.load()).map(p => ({ id: p.id, name: p.name }));
  } catch {}

  const viewTitles = {
    stage:       'Stage Wise Demand Raise',
    tower:       'Tower Wise Demand Raise',
    customer:    'Customer Wise Demand Raise',
    installment: 'Installment Wise Demand Raise',
    unitstage:   'Unit / Stage Wise Demand Raise',
    unraise:     'Demand Unraise',
  };
  const title = viewTitles[view] || 'Demand Raise';

  const tabs = [
    { key: 'stage',       label: 'Stage Wise' },
    { key: 'tower',       label: 'Tower Wise' },
    { key: 'customer',    label: 'Customer Wise' },
    { key: 'installment', label: 'Installment Wise' },
    { key: 'unitstage',   label: 'Unit / Stage Wise' },
    { key: 'unraise',     label: 'Demand Unraise' },
  ];

  const tabBar = tabs.map(t => `
    <button class="dr-tab${t.key === view ? ' dr-tab-active' : ''}"
      onclick="Router.navigate('/demand-raise',{view:'${t.key}'})">${t.label}</button>
  `).join('');

  const projectOpts = projects.map(p => `<option value="${p.id}">${Utils.esc(p.name)}</option>`).join('');

  // ─── Filter panels per view ──────────────────────────────────────────────
  const filterPanels = {

    stage: `
      <div class="sp-grid" style="grid-template-columns:repeat(4,1fr)">
        <div class="fg">
          <label class="fl"><span class="r">*</span>Project:</label>
          <select class="fc" id="f-project"><option value="">— Select —</option>${projectOpts}</select>
        </div>
      </div>`,

    tower: `
      <div class="sp-grid" style="grid-template-columns:repeat(4,1fr)">
        <div class="fg">
          <label class="fl"><span class="r">*</span>Project:</label>
          <select class="fc" id="f-project"><option value="">— Select —</option>${projectOpts}</select>
        </div>
        <div class="fg">
          <label class="fl"><span class="r">*</span>Tower:</label>
          <select class="fc" id="f-tower" disabled><option value="">— Select Project First —</option></select>
        </div>
        <div class="fg">
          <label class="fl">Payment Plan:</label>
          <select class="fc" id="f-plan" disabled><option value="">— Select Project First —</option></select>
        </div>
        <div class="fg">
          <label class="fl">Stage / Installment:</label>
          <select class="fc" id="f-installment" disabled><option value="">— Select Plan —</option></select>
        </div>
        <div class="fg">
          <label class="fl">Floor:</label>
          <select class="fc" id="f-floor"><option value="">— All —</option></select>
        </div>
        <div class="fg">
          <label class="fl">Registration No.:</label>
          <input class="fc" id="f-reg-no" placeholder="Reg No.">
        </div>
      </div>`,

    customer: `
      <div class="sp-grid" style="grid-template-columns:repeat(6,1fr)">
        <div class="fg">
          <label class="fl"><span class="r">*</span>Project:</label>
          <select class="fc" id="f-project"><option value="">— Select —</option>${projectOpts}</select>
        </div>
        <div class="fg">
          <label class="fl"><span class="r">*</span>Payment Plan:</label>
          <select class="fc" id="f-plan" disabled><option value="">— Select Project First —</option></select>
        </div>
        <div class="fg">
          <label class="fl"><span class="r">*</span>Stage / Installment:</label>
          <select class="fc" id="f-installment" disabled><option value="">— Select Plan First —</option></select>
        </div>
        <div class="fg">
          <label class="fl">Tower:</label>
          <select class="fc" id="f-tower"><option value="">— All —</option></select>
        </div>
        <div class="fg">
          <label class="fl">Registration No.:</label>
          <input class="fc" id="f-reg-no" placeholder="Reg No.">
        </div>
        <div class="fg">
          <label class="fl">First Name:</label>
          <input class="fc" id="f-name" placeholder="First Name">
        </div>
        <div class="fg" style="grid-column:span 2">
          <label class="fl">Unit Address:</label>
          <input class="fc" id="f-unit-addr" placeholder="e.g. A-101">
        </div>
      </div>`,

    installment: `
      <div class="sp-grid" style="grid-template-columns:repeat(4,1fr)">
        <div class="fg">
          <label class="fl"><span class="r">*</span>Project:</label>
          <select class="fc" id="f-project"><option value="">— Select —</option>${projectOpts}</select>
        </div>
        <div class="fg">
          <label class="fl"><span class="r">*</span>Payment Plan:</label>
          <select class="fc" id="f-plan" disabled><option value="">— Select Project First —</option></select>
        </div>
        <div class="fg">
          <label class="fl"><span class="r">*</span>Installment:</label>
          <select class="fc" id="f-installment" disabled><option value="">— Select Plan First —</option></select>
        </div>
        <div class="fg">
          <label class="fl">Show:</label>
          <select class="fc" id="f-status-filter">
            <option value="pending">Pending Only</option>
            <option value="all">All (Pending + Raised)</option>
            <option value="demanded">Already Raised</option>
          </select>
        </div>
      </div>`,

    unitstage: `
      <div class="sp-grid" style="grid-template-columns:repeat(4,1fr)">
        <div class="fg">
          <label class="fl"><span class="r">*</span>Project:</label>
          <select class="fc" id="f-project"><option value="">— Select —</option>${projectOpts}</select>
        </div>
        <div class="fg">
          <label class="fl">Tower:</label>
          <select class="fc" id="f-tower" disabled><option value="">— All —</option></select>
        </div>
        <div class="fg">
          <label class="fl">Unit Address:</label>
          <input class="fc" id="f-unit-addr" placeholder="e.g. A-101">
        </div>
        <div class="fg">
          <label class="fl"><span class="r">*</span>Payment Plan:</label>
          <select class="fc" id="f-plan" disabled><option value="">— Select Project First —</option></select>
        </div>
        <div class="fg">
          <label class="fl"><span class="r">*</span>Stage / Installment:</label>
          <select class="fc" id="f-installment" disabled><option value="">— Select Plan First —</option></select>
        </div>
      </div>`,

    unraise: `
      <div class="sp-grid" style="grid-template-columns:repeat(4,1fr)">
        <div class="fg">
          <label class="fl">Project:</label>
          <select class="fc" id="f-project"><option value="">— All Projects —</option>${projectOpts}</select>
        </div>
        <div class="fg">
          <label class="fl">Consumer / Reg No.:</label>
          <input class="fc" id="f-name" placeholder="Name or Reg No.">
        </div>
        <div class="fg">
          <label class="fl">Payment Plan:</label>
          <select class="fc" id="f-plan" disabled><option value="">— Select Project —</option></select>
        </div>
        <div class="fg">
          <label class="fl">Stage / Installment:</label>
          <select class="fc" id="f-installment" disabled><option value="">— Select Plan —</option></select>
        </div>
        <div class="fg">
          <label class="fl">Raised From:</label>
          <input type="date" class="fc" id="f-raised-from">
        </div>
        <div class="fg">
          <label class="fl">Raised To:</label>
          <input type="date" class="fc" id="f-raised-to">
        </div>
      </div>`,
  };

  // ─── Results table headers per view ─────────────────────────────────────
  const tableHeaders = {
    stage:       '',  // stage wise uses custom nested renderer — no standard table header
    tower:       `<th>S.NO.</th><th>REG NO.</th><th>CONSUMER NAME</th><th>UNIT</th><th>FLOOR</th><th>STAGE</th><th>AMOUNT</th><th>DUE DATE</th><th style="width:40px"><input type="checkbox" id="chk-all" onclick="DemandRaisePage.toggleAll(this.checked)"></th>`,
    customer:    `<th>S.NO.</th><th>REG NO.</th><th>NAME</th><th>UNIT TYPE</th><th>UNIT ADDRESS</th><th>INSTALLMENT</th><th>DUE AMOUNT</th><th>TOTAL PAID</th><th>BALANCE</th><th>INST. DATE</th><th style="width:40px"><input type="checkbox" id="chk-all" onclick="DemandRaisePage.toggleAll(this.checked)"></th>`,
    installment: `<th>S.NO.</th><th>REG NO.</th><th>CONSUMER NAME</th><th>UNIT</th><th>TOWER</th><th>INSTALLMENT</th><th>%</th><th>AMOUNT</th><th>STATUS</th><th style="width:40px"><input type="checkbox" id="chk-all" onclick="DemandRaisePage.toggleAll(this.checked)"></th>`,
    unitstage:   `<th>S.NO.</th><th>REG NO.</th><th>CONSUMER NAME</th><th>UNIT</th><th>FLOOR</th><th>TOWER</th><th>STAGE</th><th>AMOUNT</th><th>DUE DATE</th><th style="width:40px"><input type="checkbox" id="chk-all" onclick="DemandRaisePage.toggleAll(this.checked)"></th>`,
    unraise:     `<th>S.NO.</th><th>REG NO.</th><th>CONSUMER NAME</th><th>UNIT</th><th>STAGE</th><th>AMOUNT</th><th>RAISED DATE</th><th>ACTION</th>`,
  };

  const colCount = { stage:9, tower:9, customer:11, installment:10, unitstage:10, unraise:8 };
  const isRaiseView = view !== 'unraise';
  const isStageView = view === 'stage';

  content.innerHTML = `
    <div class="page-hdr">
      <h1>${title}</h1>
      <div class="breadcrumb">Application / Demand Raise / <b>${title}</b></div>
    </div>

    <!-- TAB BAR -->
    <div class="dr-tabs">${tabBar}</div>

    <!-- FILTER PANEL -->
    <div class="sp legacy-search">
      <div class="sp-hdr"><div class="sp-title">${title.toUpperCase()}</div></div>
      <div class="sp-body">
        ${filterPanels[view] || filterPanels.customer}
        <div class="dr-fetch-row">
          <button class="btn btn-fetch" onclick="DemandRaisePage.fetch()">FETCH</button>
          ${(isRaiseView && !isStageView) ? `<span id="dr-sel-count" class="dr-count">0 demands selected</span>` : ''}
        </div>
      </div>
    </div>

    ${isStageView ? `
    <!-- STAGE WISE NESTED RESULTS -->
    <div id="sw-results" class="dr-sw-wrap">
      <div class="dr-sw-hdr">
        <span id="sw-project-label"></span>
        <span style="color:var(--text3);font-size:14px;cursor:pointer">&#128438;&nbsp;&nbsp;&#11123;</span>
      </div>
      <div id="sw-body"></div>
    </div>` : `
    <!-- STANDARD RESULTS TABLE -->
    <div class="tbl-wrap legacy-table" id="dr-results-wrap" style="display:none">
      <div class="tbl-hdr">
        <div class="tbl-title">${title.toUpperCase()}</div>
      </div>
      <div class="horizontal-scroll">
        <table id="dr-table">
          <thead><tr>${tableHeaders[view] || tableHeaders.customer}</tr></thead>
          <tbody id="dr-table-body"></tbody>
        </table>
      </div>
      ${isRaiseView ? `
      <div class="dr-foot">
        <button class="btn btn-proceed" onclick="DemandRaisePage.openModal()">PROCEED</button>
        <span id="dr-sel-count2" class="dr-count"></span>
      </div>` : ''}
    </div>`}

    <!-- RAISE MODAL -->
    <div id="dr-modal" class="dr-modal">
      <div class="dr-modal-box">
        <div class="dr-modal-hdr">
          <span style="font-weight:bold;font-size:12px">RAISE / SET DEMAND DATE</span>
          <span onclick="DemandRaisePage.closeModal()" class="dr-x">&times;</span>
        </div>
        <div class="dr-modal-body">
          <div class="fg">
            <label class="fl">Due Date</label>
            <input type="date" id="m-inst-date" class="fc" value="${Utils.today()}">
          </div>
          <div class="dr-modal-act">
            <button class="btn dr-btn dr-btn-primary" onclick="DemandRaisePage.submit()">UPDATE</button>
            <button class="btn dr-btn dr-btn-grey" onclick="DemandRaisePage.closeModal()">BACK</button>
          </div>
        </div>
      </div>
    </div>

    <!-- UNRAISE CONFIRM MODAL -->
    <div id="ur-modal" class="dr-modal">
      <div class="dr-modal-box">
        <div class="dr-modal-hdr dr-hdr-danger">
          <span style="font-weight:bold;font-size:12px">CONFIRM DEMAND UNRAISE</span>
          <span onclick="document.getElementById('ur-modal').style.display='none'" class="dr-x">&times;</span>
        </div>
        <div class="dr-modal-body">
          <p id="ur-confirm-text" style="font-size:13px;margin-bottom:16px;line-height:1.6"></p>
          <div class="dr-modal-act" style="margin-top:0">
            <button class="btn dr-btn dr-btn-danger" onclick="DemandRaisePage.confirmUnraise()">YES, UNRAISE</button>
            <button class="btn dr-btn dr-btn-grey" onclick="document.getElementById('ur-modal').style.display='none'">CANCEL</button>
          </div>
        </div>
      </div>
    </div>

    <!-- STAGE WISE RAISE DATE MODAL -->
    <div id="sw-raise-modal" class="dr-modal">
      <div class="dr-modal-box">
        <div class="dr-modal-hdr">
          <span style="font-weight:bold;font-size:12px">RAISE DEMAND</span>
          <span onclick="StageWisePage.closeRaiseModal()" class="dr-x">&times;</span>
        </div>
        <div class="dr-modal-body">
          <p id="sw-raise-label" style="font-size:13px;font-weight:600;margin-bottom:12px;color:var(--teal)"></p>
          <div class="fg">
            <label class="fl">Due Date</label>
            <input type="date" id="sw-inst-date" class="fc">
          </div>
          <p id="sw-raise-summary" style="font-size:11px;color:var(--text3);margin-top:8px"></p>
          <div class="dr-modal-act">
            <button class="btn dr-btn dr-btn-primary" onclick="StageWisePage.confirmRaise()">CONFIRM RAISE</button>
            <button class="btn dr-btn dr-btn-grey" onclick="StageWisePage.closeRaiseModal()">CANCEL</button>
          </div>
        </div>
      </div>
    </div>

    <!-- STAGE WISE CANCEL CONFIRM MODAL -->
    <div id="sw-cancel-modal" class="dr-modal">
      <div class="dr-modal-box">
        <div class="dr-modal-hdr dr-hdr-danger">
          <span style="font-weight:bold;font-size:12px">CONFIRM CANCEL DEMAND</span>
          <span onclick="StageWisePage.closeCancelModal()" class="dr-x">&times;</span>
        </div>
        <div class="dr-modal-body">
          <p id="sw-cancel-text" style="font-size:13px;margin-bottom:16px;line-height:1.6"></p>
          <div class="dr-modal-act" style="margin-top:0">
            <button class="btn dr-btn dr-btn-danger" onclick="StageWisePage.confirmCancel()">YES, CANCEL</button>
            <button class="btn dr-btn dr-btn-grey" onclick="StageWisePage.closeCancelModal()">BACK</button>
          </div>
        </div>
      </div>
    </div>

    <style>
      .dr-tabs { display:flex; gap:8px; margin-bottom:18px; flex-wrap:wrap; max-width:1180px; margin-left:auto; margin-right:auto }
      .dr-tab { padding:7px 16px; border:1px solid var(--border2); background:var(--surface); color:var(--text2); cursor:pointer; border-radius:999px; font-size:12px; font-weight:500; transition:.15s }
      .dr-tab:hover { border-color:var(--teal); color:var(--teal) }
      .dr-tab-active, .dr-tab-active:hover { background:var(--teal); color:#fff; border-color:var(--teal); font-weight:600 }
      #content > .sp, #content > .tbl-wrap, #content > #sw-results { max-width:1180px; margin-left:auto; margin-right:auto }
      #content > .sp, #content > .tbl-wrap { border-radius:10px; overflow:hidden; margin-bottom:16px }
      .legacy-search .sp-hdr, .legacy-table .tbl-hdr { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; padding:14px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border) }
      .legacy-search .sp-title, .legacy-table .tbl-title { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
      .legacy-search .sp-body { padding:18px }
      .legacy-search .sp-grid { gap:16px 18px }
      @media (max-width:900px) { .legacy-search .sp-grid { grid-template-columns:repeat(2,minmax(0,1fr)) !important } .legacy-search .fg { grid-column:auto !important } }
      @media (max-width:640px) { .legacy-search .sp-grid { grid-template-columns:minmax(0,1fr) !important } }
      .legacy-search .fg, .dr-modal .fg { gap:6px }
      .legacy-search .fl, .dr-modal .fl { font-size:11px; font-weight:500; text-transform:none; letter-spacing:.3px; color:var(--text2); margin-bottom:0 }
      .legacy-search .fc, .dr-modal .fc { padding:9px 12px; font-size:13px; border-radius:8px; min-height:38px }
      .legacy-search .fc:focus, .dr-modal .fc:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg) }
      .dr-fetch-row { margin-top:18px; display:flex; align-items:center; gap:14px }
      .legacy-search .btn-fetch, .legacy-search .btn-fetch:hover { background:var(--teal) !important; color:#fff !important; border:none; padding:9px 28px; font-size:12.5px; border-radius:8px; min-height:38px; font-weight:600 }
      .dr-count { font-size:12px; color:var(--text2) }
      .legacy-table table { font-size:12.5px; border-collapse:collapse; width:100%; min-width:900px }
      .legacy-table th { background:var(--surface2); border-bottom:1px solid var(--border2); padding:10px 14px; text-align:left; color:var(--text3); font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; white-space:nowrap }
      .legacy-table td { border-bottom:1px solid var(--border); padding:10px 14px; background:transparent; color:var(--text); vertical-align:middle }
      .legacy-table tbody tr:hover td { background:var(--surface2) }
      .legacy-table tbody tr:last-child td { border-bottom:none }
      .legacy-table .td-bold { font-weight:600 }
      .horizontal-scroll { overflow-x:auto }
      .dr-link { color:var(--teal); text-decoration:none; font-weight:500; cursor:pointer }
      .dr-link:hover { text-decoration:underline }
      .dr-foot { padding:14px 18px; background:var(--surface2); border-top:1px solid var(--border2); display:flex; align-items:center; gap:14px }
      .btn-proceed { background:var(--red); color:#fff; font-weight:600; border-radius:8px; padding:9px 24px; font-size:12.5px; border:none; cursor:pointer }
      .btn-proceed:hover { filter:brightness(.92) }
      .dr-modal { display:none; position:fixed; z-index:1000; left:0; top:0; width:100%; height:100%; background:rgba(0,0,0,0.45); }
      .dr-modal-box { position:relative; margin:10% auto; background:var(--surface); color:var(--text); border:1px solid var(--border2); border-radius:14px; box-shadow:0 20px 60px rgba(0,0,0,.4); max-width:440px; width:92vw; overflow:hidden }
      .dr-modal-hdr { background:var(--teal-bg); color:var(--text); padding:16px 20px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); letter-spacing:.5px; text-transform:uppercase }
      .dr-modal-hdr.dr-hdr-danger { background:var(--red-bg); color:var(--red) }
      .dr-modal-body { padding:20px }
      .dr-modal-body p { color:var(--text2) }
      .dr-x { cursor:pointer; font-size:22px; line-height:1; color:var(--text2) }
      .dr-x:hover { color:var(--text) }
      .dr-modal-act { margin-top:20px; display:flex; gap:10px }
      .dr-btn { flex:1; padding:9px 16px; font-size:12.5px; font-weight:600; border-radius:8px; border:1px solid transparent; cursor:pointer }
      .dr-btn-primary { background:var(--teal); color:#fff }
      .dr-btn-danger { background:var(--red); color:#fff }
      .dr-btn-grey { background:var(--surface); color:var(--text2); border-color:var(--border2) }
      .dr-btn:hover { filter:brightness(.94) }
      .row-greyed td { background:var(--surface2) !important; color:var(--text3) !important }
      .badge-raised { display:inline-block; background:#d97706; color:#fff; font-size:10.5px; font-weight:600; padding:2px 9px; border-radius:999px; }
      .badge-pending { display:inline-block; background:var(--teal-bg); color:var(--teal); font-size:10.5px; font-weight:600; padding:2px 9px; border-radius:999px; }
      .btn-unraise { background:transparent; color:var(--red); border:1px solid var(--red); padding:4px 12px; border-radius:6px; cursor:pointer; font-size:11.5px; font-weight:600 }
      .btn-unraise:hover { background:var(--red-bg) }
      /* Stage Wise nested grid */
      .dr-sw-wrap { display:none; border:1px solid var(--border2); border-radius:10px; overflow:hidden; background:var(--surface); margin-bottom:16px }
      .dr-sw-hdr { background:var(--teal-bg); border-bottom:1px solid var(--border); padding:14px 18px; display:flex; align-items:center; justify-content:space-between }
      .dr-sw-hdr span:first-child { color:var(--text); font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:.6px }
      #sw-body { overflow-x:auto }
      .sw-outer-table { width:100%; border-collapse:collapse }
      .sw-stage-row { border-bottom:1px solid var(--border2) }
      .sw-stage-no  { width:55px; background:var(--surface2) !important; border-right:1px solid var(--border2); font-weight:600; color:var(--text2); text-align:center; vertical-align:middle; padding:8px; }
      .sw-stage-name { min-width:180px; max-width:200px; padding:12px 16px; font-size:13px; font-weight:500; color:var(--text); vertical-align:middle; border-right:1px solid var(--border2); background:var(--surface); }
      .sw-tower-cell  { padding:0; vertical-align:top; }
      .sw-raise-cell  { width:130px; text-align:center; vertical-align:middle; padding:8px; border-left:1px solid var(--border2); background:var(--surface) }
      .sw-inner-table { width:100%; border-collapse:collapse; }
      .sw-inner-table thead th { background:var(--surface2); color:var(--text3); font-size:11px; font-weight:600; text-transform:uppercase; padding:9px 14px; text-align:left; letter-spacing:.4px; border-bottom:1px solid var(--border2) }
      .sw-inner-table tbody tr.sw-tower-row { border-bottom:1px solid var(--border); }
      .sw-inner-table tbody tr.sw-tower-row:hover td { background:var(--surface2); }
      .sw-inner-table tbody td { padding:9px 14px; font-size:12.5px; color:var(--text); background:var(--surface); }
      .sw-raise-link  { color:var(--teal); font-weight:600; font-size:12.5px; cursor:pointer; text-decoration:none; background:none; border:none; padding:4px 8px; }
      .sw-raise-link:hover { text-decoration:underline; }
      .sw-raised-badge { color:var(--teal); font-weight:600; font-size:12.5px; }
      .lnk-sw-cancel  { color:var(--red); text-decoration:none; font-size:12px; cursor:pointer; background:none; border:none; padding:2px 4px; }
      .lnk-sw-cancel:hover { text-decoration:underline; }
    </style>
  `;

  // Wire up cascades depending on which selects exist in this view
  const projSel = document.getElementById('f-project');
  const planSel = document.getElementById('f-plan');

  if (projSel) projSel.addEventListener('change', () => DemandRaisePage.onProjectChange());
  if (planSel) planSel.addEventListener('change', () => DemandRaisePage.onPlanChange());

  // Tower change → reload floors (tower view)
  const towerSel = document.getElementById('f-tower');
  if (towerSel && view === 'tower') {
    towerSel.addEventListener('change', () => DemandRaisePage.onTowerChange());
  }

  // Checkbox count listener
  document.addEventListener('change', DemandRaisePage._updateCount);
};

// ─── DEMAND RAISE RESULT MODAL ───────────────────────────────────────────────
function showDemandRaiseResultModal(raised, skipped, skippedIds) {
  // Remove any existing modal
  const existing = document.getElementById('demand-raise-result-modal');
  if (existing) existing.remove();

  // Build skipped reasons list
  const skippedList = skippedIds.map(s => `
    <li style="padding:8px 0;border-bottom:1px solid #fecaca;font-size:13px;color:#7f1d1d;">
      <strong>${s.reason || s.id}</strong>
    </li>
  `).join('');

  // Create modal
  const modal = document.createElement('div');
  modal.id = 'demand-raise-result-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.6);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: inherit;
  `;

  if (raised === 0 && skipped > 0) {
    // ALL SKIPPED (0 raised)
    modal.innerHTML = `
      <div style="background:var(--surface);color:var(--text);border:1px solid var(--border2);border-radius:14px;width:520px;max-width:90vw;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.4);">
        <div style="background:#dc2626;padding:20px 24px;display:flex;align-items:center;gap:12px;">
          <div style="width:36px;height:36px;background:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">⚠️</div>
          <div>
            <div style="color:white;font-weight:bold;font-size:16px;">Demand Could Not Be Raised</div>
            <div style="color:#fecaca;font-size:12px;margin-top:2px;">${skipped} demand(s) were skipped</div>
          </div>
        </div>
        <div style="padding:24px;">
          <p style="font-size:14px;color:var(--text2);margin-bottom:16px;line-height:1.6;">
            The selected demand(s) could <strong>not</strong> be raised because one or more <strong>prior installments</strong> have not been raised yet.
          </p>
          <p style="font-size:13px;color:var(--text3);margin-bottom:12px;">
            You must raise installments <strong>in order</strong>. Please raise the earlier installment(s) first, then come back to raise this one.
          </p>
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px 16px;margin-bottom:16px;">
            <div style="font-size:12px;font-weight:bold;color:#dc2626;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">❌ Skipped Reasons:</div>
            <ul style="margin:0;padding-left:16px;list-style:disc;">${skippedList}</ul>
          </div>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:12px 16px;margin-bottom:20px;">
            <div style="font-size:12px;font-weight:bold;color:#15803d;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">✅ What to do next:</div>
            <ol style="margin:0;padding-left:18px;font-size:13px;color:#166534;line-height:1.8;">
              <li>Go back to the demand raise screen</li>
              <li>Select the <strong>previous installment</strong> that is still pending</li>
              <li>Set its due date and raise it first</li>
              <li>Then come back and raise this installment</li>
            </ol>
          </div>
          <button onclick="document.getElementById('demand-raise-result-modal').remove()" style="width:100%;padding:12px;background:#dc2626;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:bold;letter-spacing:0.5px;">I UNDERSTAND — GO BACK</button>
        </div>
      </div>
    `;
  } else if (raised > 0 && skipped > 0) {
    // SOME RAISED, SOME SKIPPED
    modal.innerHTML = `
      <div style="background:var(--surface);color:var(--text);border:1px solid var(--border2);border-radius:14px;width:520px;max-width:90vw;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.4);">
        <div style="background:#d97706;padding:20px 24px;display:flex;align-items:center;gap:12px;">
          <div style="width:36px;height:36px;background:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">⚠️</div>
          <div>
            <div style="color:white;font-weight:bold;font-size:16px;">Partial Success</div>
            <div style="color:#fef3c7;font-size:12px;margin-top:2px;">${raised} raised, ${skipped} skipped</div>
          </div>
        </div>
        <div style="padding:24px;">
          <p style="font-size:14px;color:var(--text2);margin-bottom:16px;">
            <strong>${raised}</strong> demand(s) were raised successfully, but <strong>${skipped}</strong> could not be raised because prior installments are still pending.
          </p>
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px 16px;margin-bottom:20px;">
            <div style="font-size:12px;font-weight:bold;color:#dc2626;margin-bottom:8px;">❌ Could not raise:</div>
            <ul style="margin:0;padding-left:16px;list-style:disc;">${skippedList}</ul>
          </div>
          <button onclick="document.getElementById('demand-raise-result-modal').remove()" style="width:100%;padding:12px;background:#d97706;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:bold;">OK, I UNDERSTAND</button>
        </div>
      </div>
    `;
  }

  // Show modal only if there were skipped demands
  if (skipped > 0) {
    document.body.appendChild(modal);

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }
}

const DemandRaisePage = {
  _data: [],
  _templates: [],
  _pendingUnraiseId: null,
  _pendingUnraiseLabel: null,
  _view: () => {
    const h = window.location.hash;
    const m = h.match(/[?&]view=([^&]+)/);
    return m ? m[1] : (document.querySelector('.dr-tab-active')?.textContent?.toLowerCase().replace(/ \/ /g,'').replace(/ /g,'') || 'customer');
  },

  // Project changed → load towers + plan templates
  async onProjectChange() {
    const projectId = document.getElementById('f-project')?.value;
    const planSel   = document.getElementById('f-plan');
    const instSel   = document.getElementById('f-installment');
    const towerSel  = document.getElementById('f-tower');

    if (planSel) { planSel.innerHTML = '<option value="">— Loading… —</option>'; planSel.disabled = true; }
    if (instSel) { instSel.innerHTML = '<option value="">— Select Plan First —</option>'; instSel.disabled = true; }
    this._templates = [];

    if (!projectId) {
      if (planSel) planSel.innerHTML = '<option value="">— Select Project First —</option>';
      return;
    }

    // Load towers
    if (towerSel) {
      try {
        const tRes = await Api.get(`/projects/${projectId}/towers`);
        const towers = tRes.data || [];
        const allOpt = towerSel.options[0]?.value === '' ? towerSel.options[0].outerHTML : '<option value="">— All —</option>';
        towerSel.innerHTML = allOpt + towers.map(t => `<option value="${t.id}">${t.tower_name}</option>`).join('');
        towerSel.disabled = false;
      } catch {}
    }

    if (!planSel) return;

    try {
      const res = await Api.get(`/projects/${projectId}/plan-templates`);
      this._templates = res.data || [];

      if (this._templates.length === 0) {
        planSel.innerHTML = '<option value="">No payment plans configured</option>';
        return;
      }

      const planNames = [];
      const seen = new Set();
      for (const t of this._templates) {
        if (t.plan_name && !seen.has(t.plan_name)) { seen.add(t.plan_name); planNames.push(t.plan_name); }
      }

      planSel.innerHTML = '<option value="">— Select Plan —</option>' +
        planNames.map(p => `<option value="${p}">${p}</option>`).join('');
      planSel.disabled = false;

      if (planNames.length === 1) { planSel.value = planNames[0]; this.onPlanChange(); }
    } catch (err) {
      planSel.innerHTML = '<option value="">Failed to load plans</option>';
      Utils.error('Could not load payment plans: ' + err.message);
    }
  },

  // Plan changed → populate installment dropdown
  onPlanChange() {
    const planName = document.getElementById('f-plan')?.value;
    const instSel  = document.getElementById('f-installment');
    if (!instSel) return;

    if (!planName) {
      instSel.innerHTML = '<option value="">— Select Plan First —</option>';
      instSel.disabled = true;
      return;
    }

    const planTemplates = this._templates.filter(t => t.plan_name === planName);
    instSel.innerHTML = '<option value="">— Select Stage —</option>' +
      planTemplates.map(t => {
        const pct = t.percentage ? ` (${parseFloat(t.percentage).toFixed(2)}%)` : '';
        return `<option value="${t.installment_index}">${t.installment_index} — ${t.installment_name}${pct}</option>`;
      }).join('');
    instSel.disabled = false;
  },

  // Tower changed → reload floor dropdown (tower view)
  async onTowerChange() {
    const projectId = document.getElementById('f-project')?.value;
    const towerId   = document.getElementById('f-tower')?.value;
    const floorSel  = document.getElementById('f-floor');
    if (!floorSel) return;

    floorSel.innerHTML = '<option value="">— All —</option>';
    if (!projectId) return;

    try {
      const params = towerId ? { towerId } : {};
      const res = await Api.get(`/projects/${projectId}/floors`, { params });
      const floors = res.data || [];
      floorSel.innerHTML = '<option value="">— All —</option>' +
        floors.map(f => `<option value="${f}">${f === 0 ? 'Ground' : 'Floor ' + f}</option>`).join('');
    } catch {}
  },

  // ─── FETCH ───────────────────────────────────────────────────────────────
  async fetch() {
    const view = this._getView();

    // Stage Wise has its own fetch logic
    if (view === 'stage') return StageWisePage.fetch();

    const projectId   = document.getElementById('f-project')?.value || undefined;
    const instIdx     = document.getElementById('f-installment')?.value || undefined;
    const towerId     = document.getElementById('f-tower')?.value || undefined;
    const floor       = document.getElementById('f-floor')?.value || undefined;
    const regNo       = document.getElementById('f-reg-no')?.value || undefined;
    const nameVal     = document.getElementById('f-name')?.value || undefined;
    const unitAddr    = document.getElementById('f-unit-addr')?.value || undefined;
    const raisedFrom  = document.getElementById('f-raised-from')?.value || undefined;
    const raisedTo    = document.getElementById('f-raised-to')?.value || undefined;

    // Per-view required field validation
    if (view !== 'unraise') {
      if (!projectId)            return Utils.warn('Please select a Project');
      if (view === 'tower' && !towerId && !instIdx) {} // tower view: tower is required
      if ((view === 'customer' || view === 'installment' || view === 'unitstage') && !instIdx) {
        return Utils.warn('Please select a Stage / Installment');
      }
    }

    // Determine status filter
    let statusFilter;
    if (view === 'unraise') {
      statusFilter = 'demanded';
    } else if (view === 'installment') {
      statusFilter = document.getElementById('f-status-filter')?.value || 'pending';
    } else {
      statusFilter = 'pending';
    }

    const filters = {
      projectId:        projectId || undefined,
      installmentIndex: instIdx,
      towerId,
      floor,
      registrationNo:   (view === 'unraise' ? undefined : regNo),
      name:             nameVal,
      unitAddress:      unitAddr,
      raisedFrom,
      raisedTo,
      status:           statusFilter,
      scope:            (view === 'customer' ? 'customer' : undefined),
      pageSize:         200,
    };

    // For unraise: search by name or reg no in the same name param
    if (view === 'unraise' && nameVal) {
      filters.name = nameVal;
    }

    const cols = { stage:9, tower:9, customer:11, installment:10, unitstage:10, unraise:8 };
    const colspan = cols[view] || 11;

    Utils.showTable('dr-results-wrap');
    document.getElementById('dr-table-body').innerHTML =
      `<tr><td colspan="${colspan}" style="text-align:center;padding:20px"><div class="spinner"></div> Fetching data…</td></tr>`;

    try {
      const res = await Api.get('/payments/demands', { params: filters });
      this._data = res.data || res || [];
      this._renderTable(this._data, view);
    } catch (err) {
      document.getElementById('dr-table-body').innerHTML =
        `<tr><td colspan="${colspan}" style="text-align:center;padding:20px;color:var(--red)">Error: ${err.message}</td></tr>`;
      Utils.error(err.message);
    }
  },

  _getView() {
    const tab = document.querySelector('.dr-tab-active');
    if (!tab) return 'customer';
    const t = tab.textContent.trim().toLowerCase();
    if (t.includes('stage') && t.includes('unit')) return 'unitstage';
    if (t.includes('stage'))       return 'stage';
    if (t.includes('tower'))       return 'tower';
    if (t.includes('customer'))    return 'customer';
    if (t.includes('installment')) return 'installment';
    if (t.includes('unraise'))     return 'unraise';
    return 'customer';
  },

  _renderTable(list, view) {
    const cols = { stage:9, tower:9, customer:11, installment:10, unitstage:10, unraise:8 };
    const colspan = cols[view] || 11;

    if (list.length === 0) {
      document.getElementById('dr-table-body').innerHTML =
        `<tr><td colspan="${colspan}" style="text-align:center;padding:20px;color:var(--red)">No records found for selected criteria</td></tr>`;
      this._updateCount();
      return;
    }

    const instName = document.getElementById('f-installment')?.selectedOptions?.[0]?.text?.replace(/^\d+ — /,'') || '—';

    const rows = list.map((d, i) => {
      const netDue = parseFloat(d.amount_due_inr||0)
        + parseFloat(d.cgst_amount||0)
        + parseFloat(d.sgst_amount||0)
        + parseFloat(d.addon_charge_amount||0)
        + parseFloat(d.addon_cgst_amount||0)
        + parseFloat(d.addon_sgst_amount||0);
      const amt = Utils.currency(netDue);
      const isRaised = d.status === 'demanded';
      const raisedClass = (view === 'installment' && isRaised) ? ' class="row-greyed"' : '';
      const checkbox = (view !== 'unraise' && !(view === 'installment' && isRaised))
        ? `<td><input type="checkbox" class="row-sel" value="${d.id}" checked></td>`
        : (view === 'installment' && isRaised)
          ? `<td style="text-align:center">—</td>`
          : '';

      if (view === 'stage') return `
        <tr${raisedClass}>
          <td>${i+1}</td>
          <td class="td-mono">${d.registration_no || '—'}</td>
          <td class="td-bold"><a href="/api/consumers/${d.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" onclick="event.stopPropagation()" class="dr-link" title="View Applicant File">${d.consumer_name || '—'}</a></td>
          <td>${d.unit_address || '—'}</td>
          <td>${d.tower_name || '—'}</td>
          <td>${instName}</td>
          <td class="td-bold">${amt}</td>
          <td>${d.due_date ? Utils.date(d.due_date) : 'N/A'}</td>
          ${checkbox}
        </tr>`;

      if (view === 'tower') return `
        <tr${raisedClass}>
          <td>${i+1}</td>
          <td class="td-mono">${d.registration_no || '—'}</td>
          <td class="td-bold"><a href="/api/consumers/${d.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" onclick="event.stopPropagation()" class="dr-link" title="View Applicant File">${d.consumer_name || '—'}</a></td>
          <td>${d.unit_address || '—'}</td>
          <td>${d.floor !== null && d.floor !== undefined ? d.floor : '—'}</td>
          <td>${instName || d.demand_type || '—'}</td>
          <td class="td-bold">${amt}</td>
          <td>${d.due_date ? Utils.date(d.due_date) : 'N/A'}</td>
          ${checkbox}
        </tr>`;

      if (view === 'customer') return `
        <tr${raisedClass}>
          <td>${i+1}</td>
          <td class="td-mono">${d.registration_no || '—'}</td>
          <td class="td-bold"><a href="/api/consumers/${d.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" onclick="event.stopPropagation()" class="dr-link" title="View Applicant File">${d.consumer_name || '—'}</a></td>
          <td>${d.unit_type || '—'}</td>
          <td class="td-bold">${d.unit_address || '—'}</td>
          <td>${instName}</td>
          <td class="td-bold">${amt}</td>
          <td>${Utils.currency(d.total_paid || 0)}</td>
          <td class="td-bold" style="color:${d.status === 'paid' ? '#28a745' : '#dc3545'}">${d.status === 'paid' ? 'Paid' : Utils.currency(netDue - parseFloat(d.total_paid||0))}</td>
          <td>${isRaised ? Utils.date(d.due_date) : 'N/A'}</td>
          ${checkbox}
        </tr>`;

      if (view === 'installment') {
        const pct = this._templates.find(t => t.installment_index == d.installment_index)?.percentage;
        const statusBadge = isRaised
          ? `<span class="badge-raised">Raised</span>`
          : `<span class="badge-pending">Pending</span>`;
        return `
        <tr${raisedClass}>
          <td>${i+1}</td>
          <td class="td-mono">${d.registration_no || '—'}</td>
          <td class="td-bold"><a href="/api/consumers/${d.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" onclick="event.stopPropagation()" class="dr-link" title="View Applicant File">${d.consumer_name || '—'}</a></td>
          <td>${d.unit_address || '—'}</td>
          <td>${d.tower_name || '—'}</td>
          <td>${instName}</td>
          <td>${pct ? parseFloat(pct).toFixed(2)+'%' : '—'}</td>
          <td class="td-bold">${amt}</td>
          <td>${statusBadge}</td>
          ${checkbox}
        </tr>`;
      }

      if (view === 'unitstage') return `
        <tr${raisedClass}>
          <td>${i+1}</td>
          <td class="td-mono">${d.registration_no || '—'}</td>
          <td class="td-bold"><a href="/api/consumers/${d.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" onclick="event.stopPropagation()" class="dr-link" title="View Applicant File">${d.consumer_name || '—'}</a></td>
          <td>${d.unit_address || '—'}</td>
          <td>${d.floor !== null && d.floor !== undefined ? d.floor : '—'}</td>
          <td>${d.tower_name || '—'}</td>
          <td>${instName}</td>
          <td class="td-bold">${amt}</td>
          <td>${d.due_date ? Utils.date(d.due_date) : 'N/A'}</td>
          ${checkbox}
        </tr>`;

      if (view === 'unraise') {
        const raisedDate = d.generated_at ? Utils.date(d.generated_at) : '—';
        return `
        <tr>
          <td>${i+1}</td>
          <td class="td-mono">${d.registration_no || '—'}</td>
          <td class="td-bold"><a href="/api/consumers/${d.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" onclick="event.stopPropagation()" class="dr-link" title="View Applicant File">${d.consumer_name || '—'}</a></td>
          <td>${d.unit_address || '—'}</td>
          <td>${d.demand_type || ('Index ' + d.installment_index)}</td>
          <td class="td-bold">${amt}</td>
          <td>${raisedDate}</td>
          <td><button class="btn-unraise" onclick="DemandRaisePage.promptUnraise('${d.id}','${(d.consumer_name||'').replace(/'/g,"\\'")}','${d.demand_type||('Index '+d.installment_index)}')">Unraise</button></td>
        </tr>`;
      }

      return '';
    }).join('');

    document.getElementById('dr-table-body').innerHTML = rows;
    this._updateCount();
  },

  _updateCount() {
    const count = document.querySelectorAll('.row-sel:checked').length;
    const el1 = document.getElementById('dr-sel-count');
    const el2 = document.getElementById('dr-sel-count2');
    const text = `${count} demand${count !== 1 ? 's' : ''} selected`;
    if (el1) el1.textContent = text;
    if (el2) el2.textContent = text;
  },

  toggleAll(checked) {
    document.querySelectorAll('.row-sel').forEach(cb => cb.checked = checked);
    this._updateCount();
  },

  openModal() {
    const selected = Array.from(document.querySelectorAll('.row-sel:checked')).map(cb => cb.value);
    if (selected.length === 0) return Utils.warn('Please select at least one demand');
    document.getElementById('dr-modal').style.display = 'block';
  },

  closeModal() {
    document.getElementById('dr-modal').style.display = 'none';
  },

  async submit() {
    const selected = Array.from(document.querySelectorAll('.row-sel:checked')).map(cb => cb.value);
    const instDate = document.getElementById('m-inst-date').value;
    if (!instDate) return Utils.error('Please select a Due Date');

    try {
      const res = await Api.patch('/payments/demands/activate', {
        demandIds: selected,
        installmentDate: instDate,
      });

      const raised = res.raised ?? res.activatedCount ?? 0;
      const skipped = res.skipped ?? 0;
      const skippedIds = res.skippedIds || [];

      // Show big modal if anything was skipped
      if (skipped > 0) {
        showDemandRaiseResultModal(raised, skipped, skippedIds);
      }

      // Show success toast only if at least 1 was raised
      if (raised > 0) {
        Utils.success(`Successfully raised ${raised} demand${raised !== 1 ? 's' : ''}`);
      }

      // Show error toast if ALL were skipped (modal already shown above)
      if (raised === 0 && skipped === 0) {
        Utils.error('No demands were raised. Please try again.');
      }

      this.closeModal();
      this.fetch();
    } catch (err) {
      Utils.error(err.message);
    }
  },

  // Unraise flow
  promptUnraise(id, consumerName, stageName) {
    this._pendingUnraiseId    = id;
    this._pendingUnraiseLabel = `${consumerName} — ${stageName}`;
    document.getElementById('ur-confirm-text').textContent =
      `Are you sure you want to unraise this demand for ${this._pendingUnraiseLabel}? This will reset the demand back to pending.`;
    document.getElementById('ur-modal').style.display = 'block';
  },

  async confirmUnraise() {
    const id = this._pendingUnraiseId;
    if (!id) return;
    document.getElementById('ur-modal').style.display = 'none';

    try {
      await Api.patch(`/payments/demands/${id}/cancel`, {});
      Utils.success(`Demand for ${this._pendingUnraiseLabel} has been reset to pending.`);
      // Remove row from table
      const btn = document.querySelector(`.btn-unraise[onclick*="${id}"]`);
      if (btn) btn.closest('tr').remove();
    } catch (err) {
      Utils.error('Unraise failed: ' + err.message);
    }
    this._pendingUnraiseId    = null;
    this._pendingUnraiseLabel = null;
  },
};

// ─── Stage Wise Page Controller ───────────────────────────────────────────────
const StageWisePage = {
  _stages: [],             // last fetched stages array
  _projectName: '',
  _projectId: '',
  _pendingRaiseIds: [],    // demand IDs to raise
  _pendingStageName: '',
  _pendingTotalCount: 0,
  _pendingTowerCount: 0,
  _pendingCancelIds: [],   // demand IDs to cancel
  _pendingCancelLabel: '',
  _pendingCancelConsumerCount: 0,

  async fetch() {
    const projectId = document.getElementById('f-project')?.value;
    if (!projectId) return Utils.warn('Please select a Project');

    const projSel = document.getElementById('f-project');
    this._projectId   = projectId;
    this._projectName = projSel?.selectedOptions?.[0]?.text || projectId;

    const body = document.getElementById('sw-body');
    const wrap = document.getElementById('sw-results');
    if (!body || !wrap) return;

    const label = document.getElementById('sw-project-label');
    if (label) label.textContent = `DEMAND RAISE: ${this._projectName}`;

    wrap.style.display = 'block';
    body.innerHTML = '<div style="padding:20px;text-align:center"><div class="spinner"></div> Loading stage data…</div>';

    try {
      const res = await Api.get('/payments/demands/by-stage', { params: { projectId } });
      this._stages = res.stages || [];
      this._render();
    } catch (err) {
      body.innerHTML = `<div style="padding:20px;color:var(--red);text-align:center">Error: ${err.message}</div>`;
    }
  },

  _fmtDate(d) {
    if (!d) return '';
    const parts = String(d).split('T')[0].split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  },

  _render() {
    const body = document.getElementById('sw-body');
    if (!body) return;

    if (this._stages.length === 0) {
      body.innerHTML = '<div style="padding:20px;color:var(--red);text-align:center">No demand records found for this project.</div>';
      return;
    }

    const rows = this._stages.map((stage, si) => {
      // Aggregate pending across all towers in this stage
      const allPendingIds = stage.towers.flatMap(t => t.pending_demand_ids || []);
      const allRaisedIds  = stage.towers.flatMap(t => t.raised_demand_ids  || []);
      const totalPending  = stage.towers.reduce((s, t) => s + t.pending_count, 0);
      const totalRaised   = stage.towers.reduce((s, t) => s + t.raised_count,  0);
      const totalConsumers = stage.towers.reduce((s, t) => s + t.total_consumers, 0);

      let raiseCell;
      if (totalPending > 0 && totalRaised === 0) {
        raiseCell = `<button class="sw-raise-link"
          onclick="StageWisePage.openRaiseModal(${stage.installment_index})">Raise</button>`;
      } else if (totalPending > 0 && totalRaised > 0) {
        raiseCell = `<button class="sw-raise-link"
          onclick="StageWisePage.openRaiseModal(${stage.installment_index})">Raise / Edit</button>`;
      } else {
        raiseCell = `<span class="sw-raised-badge">Raised ✓</span>`;
      }

      const innerRows = stage.towers.map((t, ti) => {
        const instDate  = this._fmtDate(t.installment_date);
        const cancelLnk = t.raised_count > 0
          ? `<button class="lnk-sw-cancel" onclick="StageWisePage.openCancelModal(${stage.installment_index},'${t.tower_id}','${t.tower_name.replace(/'/g,"\\'")}')">Cancel</button>`
          : '';
        return `<tr class="sw-tower-row">
          <td>${ti + 1}</td>
          <td>${t.tower_name}</td>
          <td>${instDate}</td>
          <td></td>
          <td>${cancelLnk}</td>
        </tr>`;
      }).join('');

      return `<tr class="sw-stage-row">
        <td class="sw-stage-no">${stage.installment_index}</td>
        <td class="sw-stage-name">${stage.installment_name}</td>
        <td class="sw-tower-cell">
          <table class="sw-inner-table">
            <thead><tr>
              <th style="width:40px">S.NO.</th>
              <th>TOWER NAME</th>
              <th style="width:140px">INSTALLMENT DATE</th>
              <th style="width:140px">FORECASTING DATE</th>
              <th style="width:80px">DEMAND / FORECASTING</th>
            </tr></thead>
            <tbody>${innerRows}</tbody>
          </table>
        </td>
        <td class="sw-raise-cell">${raiseCell}</td>
      </tr>`;
    }).join('');

    body.innerHTML = `<table class="sw-outer-table"><tbody>${rows}</tbody></table>`;
  },

  openRaiseModal(installmentIndex) {
    const stage = this._stages.find(s => s.installment_index === installmentIndex);
    if (!stage) return;

    const allPendingIds = stage.towers.flatMap(t => t.pending_demand_ids || []);
    const totalConsumers = stage.towers.reduce((s, t) => s + t.pending_count, 0);
    const towerCount = stage.towers.filter(t => t.pending_count > 0).length;

    this._pendingRaiseIds  = allPendingIds;
    this._pendingStageName = stage.installment_name;
    this._pendingTotalCount  = totalConsumers;
    this._pendingTowerCount  = towerCount;

    const labelEl   = document.getElementById('sw-raise-label');
    const summaryEl = document.getElementById('sw-raise-summary');
    const dateEl    = document.getElementById('sw-inst-date');

    if (labelEl)   labelEl.textContent   = `Stage ${installmentIndex}: ${stage.installment_name}`;
    if (summaryEl) summaryEl.textContent = `This will raise demands for ${totalConsumers} consumer(s) across ${towerCount} tower(s).`;
    if (dateEl)    dateEl.value = Utils.today ? Utils.today() : new Date().toISOString().split('T')[0];

    document.getElementById('sw-raise-modal').style.display = 'block';
  },

  closeRaiseModal() {
    document.getElementById('sw-raise-modal').style.display = 'none';
  },

  async confirmRaise() {
    const instDate = document.getElementById('sw-inst-date')?.value;
    if (!instDate) return Utils.warn('Please select a Due Date');
    if (this._pendingRaiseIds.length === 0) return Utils.warn('No pending demands to raise');

    this.closeRaiseModal();
    try {
      const res = await Api.patch('/payments/demands/activate', {
        demandIds: this._pendingRaiseIds,
        installmentDate: instDate,
      });
      const raised  = res.raised  ?? res.activatedCount ?? this._pendingRaiseIds.length;
      const skipped = res.skipped ?? 0;
      Utils.success(`Raised ${raised} demand(s).${skipped > 0 ? ` Skipped ${skipped} (sequential check failed).` : ''}`);
      await this.fetch();
    } catch (err) {
      Utils.error('Raise failed: ' + err.message);
    }
  },

  openCancelModal(installmentIndex, towerId, towerName) {
    const stage = this._stages.find(s => s.installment_index === installmentIndex);
    const tower = stage?.towers.find(t => t.tower_id === towerId);
    if (!tower) return;

    this._pendingCancelIds          = tower.raised_demand_ids || [];
    this._pendingCancelLabel        = `${towerName} — Stage ${installmentIndex}`;
    this._pendingCancelConsumerCount = tower.raised_count;

    const textEl = document.getElementById('sw-cancel-text');
    if (textEl) textEl.textContent =
      `Cancel demand for ${towerName} at Stage ${installmentIndex} (${stage.installment_name})?\n` +
      `This will reset ${tower.raised_count} consumer demand(s) to pending.`;

    document.getElementById('sw-cancel-modal').style.display = 'block';
  },

  closeCancelModal() {
    document.getElementById('sw-cancel-modal').style.display = 'none';
  },

  async confirmCancel() {
    if (this._pendingCancelIds.length === 0) return;
    this.closeCancelModal();
    try {
      const res = await Api.patch('/payments/demands/bulk-cancel', {
        demandIds: this._pendingCancelIds,
      });
      Utils.success(`Demand cancelled for ${this._pendingCancelLabel}. Reset ${res.cancelled} record(s).`);
      await this.fetch();
    } catch (err) {
      Utils.error('Cancel failed: ' + err.message);
    }
  },
};
