Pages.collectionSetup = function(p) {
  return CollectionSetupPage.render(p);
};

const CollectionSetupPage = {
  _projects: [],

  async render() {
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="page-header">
        <div class="header-content">
          <h1>Communication Infrastructure Setup</h1>
          <p>Configure project-specific SMTP and messaging gateways</p>
        </div>
      </div>

      <div class="card" style="max-width:900px; margin: 20px auto">
        <div class="card-header">
          <h3>Mail Setup Master</h3>
        </div>
        <div class="card-body">
          <div class="form-grid" style="grid-template-columns: 1fr 1fr">
            <div class="form-group">
              <label>Mapping Project</label>
              <select id="s-project" class="form-control"></select>
            </div>
            <div class="form-group">
              <label>SMTP Host</label>
              <input type="text" id="s-host" class="form-control" placeholder="e.g. smtp.gmail.com">
            </div>
            <div class="form-group">
              <label>Port</label>
              <input type="number" id="s-port" class="form-control" value="587">
            </div>
            <div class="form-group">
              <label>Username / Email ID</label>
              <input type="text" id="s-user" class="form-control">
            </div>
            <div class="form-group">
              <label>Password</label>
              <input type="password" id="s-pass" class="form-control">
            </div>
            <div class="form-group">
              <label>From Name</label>
              <input type="text" id="s-name" class="form-control">
            </div>
            <div class="form-group">
              <label>SSL / TLS</label>
              <div style="padding-top:10px">
                <label><input type="radio" name="s-ssl" value="true" checked> Yes</label> &nbsp;
                <label><input type="radio" name="s-ssl" value="false"> No</label>
              </div>
            </div>
          </div>
          <div style="margin-top:20px; display:flex; justify-content:flex-end">
            <button class="btn btn-primary" onclick="CollectionSetupPage.save()">Save Configuration</button>
          </div>
        </div>
      </div>

      <div id="smtp-list" class="table-container" style="max-width:900px; margin: 0 auto"></div>
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
            <button class="btn btn-sm" onclick="CollectionSetupPage.edit('${c.id}')">Edit</button>
          </td>
        </tr>
      `);

      list.innerHTML = `
        <h3>Existing Project Mappings</h3>
        <table class="table">
          <thead><tr><th>Project</th><th>SMTP</th><th>Sender</th><th>Encryption</th><th>Action</th></tr></thead>
          <tbody>${rows.join('')}</tbody>
        </table>
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
