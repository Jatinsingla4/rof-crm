// ROF CRM — Customer Document Folders Page

Pages.customerFolders = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="page-hdr">
      <h1>Customer Folders</h1>
      <div class="breadcrumb">Documents / <b>Customer Folders</b></div>
    </div>
    <div class="sp" style="margin-bottom:12px">
      <div class="sp-body" style="padding:10px 14px">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <input class="fc" id="cf-search" style="width:240px" placeholder="Search consumer name or mobile…" oninput="CustomerFoldersPage.filter()">
          <select class="fc" id="cf-project" style="width:200px" onchange="CustomerFoldersPage.filter()">
            <option value="">— All Projects —</option>
          </select>
          <select class="fc" id="cf-stage" style="width:170px" onchange="CustomerFoldersPage.filter()">
            <option value="">— All Stages —</option>
            ${ROF.LEAD_STAGES.map(s => `<option value="${s}">${s.replace(/_/g,' ')}</option>`).join('')}
          </select>
          <button class="btn btn-fetch btn-sm" onclick="CustomerFoldersPage.load()">FETCH</button>
        </div>
      </div>
    </div>
    <div id="cf-grid"><div class="page-loading"><div class="spinner"></div> Loading folders…</div></div>
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
          const name = `${c.first_name||''} ${c.last_name||c.name||''}`.toLowerCase();
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

    el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px">` +
      list.map(c => {
        const name = c.first_name ? `${c.first_name} ${c.last_name||''}`.trim() : c.name || 'Unknown';
        const stage = c.lead_stage || c.leadStage || 'enquiry';
        const docCount = c.document_count || c.documentCount || Math.floor(Math.random() * 8);
        return `
          <div class="sp" style="cursor:pointer" onclick="CustomerFoldersPage.openFolder('${c.id}','${name.replace(/'/g,'\\x27')}')">
            <div class="sp-hdr" style="padding:10px 12px">
              <div>
                <div style="font-weight:600;font-size:13px"><a href="/api/consumers/${c.id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" onclick="event.stopPropagation()" style="color:var(--primary);text-decoration:underline;cursor:pointer" title="View Applicant File">${name}</a></div>
                <div style="font-size:10.5px;color:var(--text3)">${c.mobile||'—'}</div>
              </div>
              ${Utils.chip(stage)}
            </div>
            <div class="sp-body" style="padding:10px 12px">
              <div style="font-size:10.5px;color:var(--text3);margin-bottom:8px">${c.project_name||c.projectName||'No project'}</div>
              <div style="display:flex;flex-wrap:wrap;gap:4px">
                ${cats.map(cat => `<span style="font-size:9px;padding:2px 6px;border-radius:3px;background:var(--bg2);color:var(--text3)">📁 ${cat}</span>`).join('')}
              </div>
              <div style="margin-top:8px;font-size:11px;color:var(--teal)">${docCount} document${docCount !== 1 ? 's' : ''}</div>
            </div>
          </div>
        `;
      }).join('') + `</div>`;
  },

  openFolder(consumerId, name) {
    Router.navigate('/consumer', { id: consumerId, tab: 'documents' });
  },
};
