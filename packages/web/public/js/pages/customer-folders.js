// ROF CRM — Customer Document Folders Page

Pages.customerFolders = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <style>
      #content:has(.cfn) { margin-left:auto; margin-right:auto; width:100% }
      .cfn { max-width:1400px; margin:0 auto; --bg2:var(--surface2) }
      .cfn .cfn-filter { background:var(--surface); border:1px solid var(--border2); border-radius:10px; margin-bottom:16px; overflow:hidden }
      .cfn .cfn-filter-hdr { padding:12px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border); font-size:12px; font-weight:600; letter-spacing:.6px; text-transform:uppercase; color:var(--text) }
      .cfn .cfn-filter-body { padding:16px 18px; display:flex; gap:12px; align-items:center; flex-wrap:wrap }
      .cfn .fc { padding:9px 12px; font-size:13px; border-radius:8px; min-height:38px }
      .cfn .fc:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg) }
      .cfn .btn-fetch { background:var(--teal); color:#fff; border:none; padding:9px 24px; min-height:38px; border-radius:8px; font-size:12.5px; font-weight:600; cursor:pointer }
      .cfn .btn-fetch:hover { filter:brightness(.92) }
      .cfn-count { margin-left:auto; font-size:12px; color:var(--text3) }
      .cfn-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(270px,1fr)); gap:14px }
      .cfn-card { background:var(--surface); border:1px solid var(--border2); border-radius:12px; padding:16px; cursor:pointer; transition:border-color .15s, box-shadow .15s }
      .cfn-card:hover { border-color:var(--teal); box-shadow:0 6px 16px rgba(0,0,0,.08) }
      .cfn-top { display:flex; align-items:center; gap:12px }
      .cfn-av { width:40px; height:40px; border-radius:50%; background:var(--teal-bg); color:var(--teal); font-weight:700; font-size:15px; display:flex; align-items:center; justify-content:center; flex-shrink:0 }
      .cfn-id { min-width:0; flex:1 }
      .cfn-name { font-weight:600; font-size:13.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
      .cfn-name a { color:var(--text); text-decoration:none }
      .cfn-name a:hover { color:var(--teal); text-decoration:underline }
      .cfn-mob { font-size:11.5px; color:var(--text3); margin-top:2px }
      .cfn-proj { font-size:12px; color:var(--text2); margin:12px 0 10px }
      .cfn-cats { display:flex; flex-wrap:wrap; gap:5px }
      .cfn-cat { font-size:10px; padding:3px 8px; border-radius:999px; background:var(--surface2); color:var(--text3); border:1px solid var(--border) }
      .cfn-foot { margin-top:12px; padding-top:10px; border-top:1px solid var(--border); font-size:12px; font-weight:600; color:var(--teal) }
      .cfn .empty-state { background:var(--surface); border:1px solid var(--border2); border-radius:10px; padding:44px 18px; text-align:center; color:var(--text3) }
      .cfn .empty-state h3 { font-size:14px; font-weight:600; color:var(--text2); margin:0 }
      @media (max-width:700px) { .cfn .fc { width:100% !important } }
    </style>
    <div class="cfn">
    <div class="page-hdr">
      <h1>Customer Folders</h1>
      <div class="breadcrumb">Documents / <b>Customer Folders</b></div>
    </div>
    <div class="cfn-filter">
      <div class="cfn-filter-hdr">Filters</div>
      <div class="cfn-filter-body">
        <div style="display:contents">
          <input class="fc" id="cf-search" style="width:240px" placeholder="Search consumer name or mobile…" oninput="CustomerFoldersPage.filter()">
          <select class="fc" id="cf-project" style="width:200px" onchange="CustomerFoldersPage.filter()">
            <option value="">— All Projects —</option>
          </select>
          <select class="fc" id="cf-stage" style="width:170px" onchange="CustomerFoldersPage.filter()">
            <option value="">— All Stages —</option>
            ${ROF.LEAD_STAGES.map(s => `<option value="${s}">${s.replace(/_/g,' ')}</option>`).join('')}
          </select>
          <button class="btn btn-fetch" onclick="CustomerFoldersPage.load()">FETCH</button>
          <span class="cfn-count" id="cf-count"></span>
        </div>
      </div>
    </div>
    <div id="cf-grid"><div class="page-loading"><div class="spinner"></div> Loading folders…</div></div>
    </div>
  `;

  await CustomerFoldersPage.init();
};

const CustomerFoldersPage = {
  _all: [],

  async init() {
    try {
      const [consRes, unitsRes] = await Promise.allSettled([
        Api.get('/consumers', { params: { pageSize: 300 } }),
        Api.get('/units', { params: { pageSize: 300 } }),
      ]);
      this._all = consRes.status === 'fulfilled' ? (consRes.value.data || consRes.value || []) : [];

      if (unitsRes.status === 'fulfilled') {
        const units = unitsRes.value.data || unitsRes.value || [];
        const projects = [...new Map(
          units.filter(u => u.project_id||u.projectId)
               .map(u => [u.project_id||u.projectId, { id: u.project_id||u.projectId, name: u.project_name||u.projectName }])
        ).values()];
        const sel = document.getElementById('cf-project');
        if (sel) sel.innerHTML = '<option value="">— All Projects —</option>' +
          projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
      }

      this.render(this._all);
    } catch (err) {
      document.getElementById('cf-grid').innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`;
    }
  },

  async load() {
    try {
      const projectId = document.getElementById('cf-project')?.value;
      const stage = document.getElementById('cf-stage')?.value;
      const params = { pageSize: 300 };
      if (projectId) params.projectId = projectId;
      if (stage) params.leadStage = stage;
      const res = await Api.get('/consumers', { params });
      this._all = res.data || res || [];
      this.filter();
    } catch (err) {
      document.getElementById('cf-grid').innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`;
    }
  },

  filter() {
    const search = document.getElementById('cf-search')?.value?.toLowerCase() || '';
    const filtered = search
      ? this._all.filter(c => {
          const name = Utils.formatName(c.first_name, c.last_name, c.name).toLowerCase();
          const mobile = (c.mobile||c.phone||'').toLowerCase();
          return name.includes(search) || mobile.includes(search);
        })
      : this._all;
    this.render(filtered);
  },

  render(list) {
    const el = document.getElementById('cf-grid');
    if (!el) return;
    if (list.length === 0) {
      el.innerHTML = '<div class="empty-state"><h3>No consumer folders found</h3></div>';
      return;
    }

    const cats = ['KYC', 'Application', 'Allotment', 'Payment Receipts', 'Agreements', 'NOC', 'Possession'];

    const cnt = document.getElementById('cf-count');
    if (cnt) cnt.textContent = list.length + ' folder' + (list.length !== 1 ? 's' : '');
    el.innerHTML = `<div class="cfn-grid">` +
      list.map(c => {
        const name = Utils.formatName(c.first_name, c.last_name, c.name);
        const stage = c.lead_stage || c.leadStage || 'enquiry';
        const docCount = Number(c.document_count ?? c.documentCount ?? 0);
        return `
          <div class="cfn-card" onclick="CustomerFoldersPage.openFolder('${c.id}','${name.replace(/'/g,'\\x27')}')">
            <div class="cfn-top">
              <div class="cfn-av">${(name.trim().charAt(0) || '?').toUpperCase()}</div>
              <div class="cfn-id">
                <div class="cfn-name"><a href="/api/consumers/${c.id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" onclick="event.stopPropagation()" title="View Applicant File">${name}</a></div>
                <div class="cfn-mob">${c.mobile||'—'}</div>
              </div>
              ${Utils.chip(stage)}
            </div>
            <div class="cfn-proj">${c.project_name||c.projectName||'No project'}</div>
            <div class="cfn-cats">
              ${cats.map(cat => `<span class="cfn-cat">📁 ${cat}</span>`).join('')}
            </div>
            <div class="cfn-foot">${docCount} document${docCount !== 1 ? 's' : ''}</div>
          </div>
        `;
      }).join('') + `</div>`;
  },

  openFolder(consumerId, name) {
    Router.navigate('/consumer', { id: consumerId, tab: 'documents' });
  },
};
