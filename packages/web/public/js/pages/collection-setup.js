Pages.collectionSetup = function(p) {
  return CollectionSetupPage.render(p);
};

const CollectionSetupPage = {
  _projects: [],

  async render() {
    const content = document.getElementById('content');
    content.innerHTML = `
      <style>
        .csn { max-width:900px; margin-left:auto; margin-right:auto }
        .csn .sp { border-radius:10px; overflow:hidden; margin-bottom:16px }
        .csn-intro { display:flex; align-items:center; gap:12px; padding:14px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border) }
        .csn-intro-ico { width:36px; height:36px; border-radius:10px; background:var(--teal); color:#fff; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0 }
        .csn-intro-t { font-size:14px; font-weight:600; color:var(--text) }
        .csn-intro-s { font-size:12px; color:var(--text2); margin-top:2px }
        .csn-body { padding:18px }
        .csn-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px 18px }
        @media (max-width:640px) { .csn-grid { grid-template-columns:minmax(0,1fr) } }
        .csn .fg { display:flex; flex-direction:column; gap:6px }
        .csn .fl { font-size:11px; font-weight:500; text-transform:none; letter-spacing:.3px; color:var(--text2) }
        .csn .fc { padding:9px 12px; font-size:13px; border-radius:8px; min-height:38px; width:100% }
        .csn .fc:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg) }
        .csn-radio { display:flex; gap:20px; align-items:center; min-height:38px; font-size:13px; color:var(--text) }
        .csn-radio label { display:flex; align-items:center; gap:6px; cursor:pointer; font-size:13px; text-transform:none; letter-spacing:0; color:var(--text) }
        .csn-foot { display:flex; justify-content:flex-end; padding:14px 18px; background:var(--surface2); border-top:1px solid var(--border2) }
        .csn-btn { background:var(--teal); color:#fff; border:none; padding:9px 26px; border-radius:8px; font-size:12.5px; font-weight:600; cursor:pointer; min-height:38px }
        .csn-btn:hover { filter:brightness(.92) }
        .csn-list { background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:hidden }
        .csn-list-h { padding:14px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border); font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
        .csn-scroll { overflow-x:auto }
        .csn-tbl { width:100%; border-collapse:collapse; font-size:12.5px }
        .csn-tbl th { text-align:left; padding:10px 14px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; color:var(--text3); background:var(--surface2); border-bottom:1px solid var(--border2); white-space:nowrap }
        .csn-tbl td { padding:10px 14px; border-bottom:1px solid var(--border); color:var(--text); vertical-align:middle }
        .csn-tbl tbody tr:hover td { background:var(--surface2) }
        .csn-tbl tbody tr:last-child td { border-bottom:none }
        .csn-edit { background:var(--surface); color:var(--teal); border:1px solid var(--teal); padding:4px 12px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer }
        .csn-edit:hover { background:var(--teal-bg) }
        .csn-empty { padding:36px 18px; text-align:center; color:var(--text3); font-size:13px }
      </style>

      <div class="page-hdr">
        <h1>Communication Infrastructure Setup</h1>
        <div class="breadcrumb">Application / Collection Process / <b>Collection Setup</b></div>
      </div>

      <div class="csn">
        <div class="sp">
          <div class="csn-intro">
            <div class="csn-intro-ico">✉️</div>
            <div>
              <div class="csn-intro-t">Mail Setup Master</div>
              <div class="csn-intro-s">Configure project-specific SMTP and messaging gateways</div>
            </div>
          </div>
          <div class="csn-body">
            <div class="csn-grid">
              <div class="fg">
                <label class="fl">Mapping Project</label>
                <select id="s-project" class="fc"></select>
              </div>
              <div class="fg">
                <label class="fl">SMTP Host</label>
                <input type="text" id="s-host" class="fc" placeholder="e.g. smtp.gmail.com">
              </div>
              <div class="fg">
                <label class="fl">Port</label>
                <input type="number" id="s-port" class="fc" value="587">
              </div>
              <div class="fg">
                <label class="fl">Username / Email ID</label>
                <input type="text" id="s-user" class="fc">
              </div>
              <div class="fg">
                <label class="fl">Password</label>
                <input type="password" id="s-pass" class="fc">
              </div>
              <div class="fg">
                <label class="fl">From Name</label>
                <input type="text" id="s-name" class="fc">
              </div>
              <div class="fg">
                <label class="fl">SSL / TLS</label>
                <div class="csn-radio">
                  <label><input type="radio" name="s-ssl" value="true" checked> Yes</label>
                  <label><input type="radio" name="s-ssl" value="false"> No</label>
                </div>
              </div>
            </div>
          </div>
          <div class="csn-foot">
            <button class="csn-btn" onclick="CollectionSetupPage.save()">Save Configuration</button>
          </div>
        </div>

        <div id="smtp-list"></div>
      </div>
    `;

    await this.loadProjects();
    this.fetchConfigs();
  },

  async loadProjects() {
    try {
      const res = await Api.get('/projects');
      this._projects = res.data || [];
      const sel = document.getElementById('s-project');
      sel.innerHTML = this._projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    } catch (err) { Utils.error(err.message); }
  },

  async fetchConfigs() {
    const list = document.getElementById('smtp-list');
    try {
      const res = await Api.get('/smtp-configs');
      const data = res.data || [];

      const rows = data.map(c => `
        <tr>
          <td><strong>${c.project_name}</strong></td>
          <td>${c.host}:${c.port}</td>
          <td>${c.from_email}</td>
          <td>${c.use_ssl ? 'SSL' : 'Plain'}</td>
          <td>
            <button class="csn-edit" onclick="CollectionSetupPage.edit('${c.id}')">Edit</button>
          </td>
        </tr>
      `);

      list.innerHTML = `
        <div class="csn-list">
          <div class="csn-list-h">Existing Project Mappings</div>
          ${data.length === 0 ? '<div class="csn-empty">No project mappings yet</div>' : `
          <div class="csn-scroll">
            <table class="csn-tbl">
              <thead><tr><th>Project</th><th>SMTP</th><th>Sender</th><th>Encryption</th><th>Action</th></tr></thead>
              <tbody>${rows.join('')}</tbody>
            </table>
          </div>`}
        </div>
      `;
      this._configs = data;
    } catch (err) { Utils.error(err.message); }
  },

  async save() {
    const payload = {
      projectId: document.getElementById('s-project').value,
      host: document.getElementById('s-host').value,
      port: document.getElementById('s-port').value,
      username: document.getElementById('s-user').value,
      password: document.getElementById('s-pass').value,
      fromName: document.getElementById('s-name').value,
      fromEmail: document.getElementById('s-user').value, // default same as username
      useSsl: document.querySelector('input[name="s-ssl"]:checked').value === 'true'
    };

    try {
      await Api.post('/smtp-configs', payload);
      Utils.success('Configuration saved');
      this.fetchConfigs();
    } catch (err) { Utils.error(err.message); }
  },

  edit(id) {
    const c = this._configs.find(x => x.id === id);
    if (!c) return;
    document.getElementById('s-project').value = c.project_id;
    document.getElementById('s-host').value = c.host;
    document.getElementById('s-port').value = c.port;
    document.getElementById('s-user').value = c.username;
    document.getElementById('s-name').value = c.from_name;
    document.querySelector(`input[name="s-ssl"][value="${c.use_ssl}"]`).checked = true;
  }
};
