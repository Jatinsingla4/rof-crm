// ROF CRM — Users & Permissions Page

Pages.users = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="page-hdr">
      <h1>Users & Permissions</h1>
      <div class="breadcrumb">Settings / <b>Users</b></div>
    </div>
    <div class="tabs-line">
      <button class="tab-line active" data-group="usr" data-tab="team" onclick="switchTab('usr','team');UsersPage.loadTeam()">Team Members</button>
      <button class="tab-line" data-group="usr" data-tab="roles" onclick="switchTab('usr','roles');UsersPage.loadRoles()">Roles</button>
      <button class="tab-line" data-group="usr" data-tab="audit" onclick="switchTab('usr','audit');UsersPage.loadAudit()">Audit Logs</button>
    </div>

    <!-- TEAM TAB -->
    <div data-panel-group="usr" data-panel="team">
      <div class="tbl-hdr" style="margin-bottom:12px">
        <div class="tbl-title">Team Members</div>
        <div class="tbl-actions">
          <button class="btn btn-teal btn-sm" onclick="UsersPage.showInviteModal()">+ Invite User</button>
          <select class="fc" id="usr-role-filter" style="width:160px" onchange="UsersPage.loadTeam()">
            <option value="">— All Roles —</option>
            <option value="super_admin">Super Admin</option>
            <option value="project_manager">Project Manager</option>
            <option value="sales_executive">Sales Executive</option>
            <option value="accounts">Accounts</option>
            <option value="support_agent">Support Agent</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>
      </div>
      <div id="usr-team-body"><div class="page-loading"><div class="spinner"></div> Loading…</div></div>
    </div>

    <!-- ROLES TAB -->
    <div data-panel-group="usr" data-panel="roles" style="display:none">
      <div id="usr-roles-body"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>

    <!-- AUDIT LOGS TAB -->
    <div data-panel-group="usr" data-panel="audit" style="display:none">
      <div class="sp" style="margin-bottom:12px">
        <div class="sp-hdr"><div class="sp-title">Filter Audit Logs</div></div>
        <div class="sp-body">
          <div class="sp-grid">
            <div class="fg"><label class="fl">User</label>
              <select class="fc" id="audit-user">
                <option value="">— All Users —</option>
              </select>
            </div>
            <div class="fg"><label class="fl">Action</label>
              <select class="fc" id="audit-action">
                <option value="">— All Actions —</option>
                <option value="CREATE">Create</option>
                <option value="UPDATE">Update</option>
                <option value="DELETE">Delete</option>
                <option value="LOGIN">Login</option>
              </select>
            </div>
            <div class="fg"><label class="fl">From Date</label>
              <input type="date" class="fc" id="audit-from" value="${Utils.monthStart()}">
            </div>
            <div class="fg"><label class="fl">To Date</label>
              <input type="date" class="fc" id="audit-to" value="${Utils.today()}">
            </div>
          </div>
          <button class="btn btn-fetch" style="margin-top:10px" onclick="UsersPage.loadAudit()">FETCH</button>
        </div>
      </div>
      <div id="usr-audit-body"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>

    <!-- Invite Modal -->
    <div class="overlay" id="invite-overlay" onclick="closeOverlay('invite-overlay')"></div>
    <div class="modal" id="invite-modal">
      <div class="modal-hdr">
        <div class="modal-title">Invite Team Member</div>
        <button class="modal-close" onclick="closeOverlay('invite-overlay');document.getElementById('invite-modal').style.display='none'">✕</button>
      </div>
      <div class="modal-body">
        <div class="fg" style="margin-bottom:8px"><label class="fl"><span class="r">*</span>Name</label>
          <input class="fc" id="invite-name" placeholder="Full name">
        </div>
        <div class="fg" style="margin-bottom:8px"><label class="fl"><span class="r">*</span>Email</label>
          <input type="email" class="fc" id="invite-email" placeholder="email@company.com">
        </div>
        <div class="fg" style="margin-bottom:12px"><label class="fl"><span class="r">*</span>Role</label>
          <select class="fc" id="invite-role">
            <option value="sales_executive">Sales Executive</option>
            <option value="project_manager">Project Manager</option>
            <option value="accounts">Accounts</option>
            <option value="support_agent">Support Agent</option>
            <option value="viewer">Viewer</option>
            <option value="super_admin">Super Admin</option>
          </select>
        </div>
        <button class="btn btn-teal" style="width:100%" onclick="UsersPage.invite()">Send Invitation</button>
      </div>
    </div>
  `;

  await UsersPage.loadTeam();
};

const UsersPage = {
  async loadTeam() {
    const role = document.getElementById('usr-role-filter')?.value;
    const el = document.getElementById('usr-team-body');
    if (!el) return;
    try {
      const params = { pageSize: 100 };
      if (role) params.role = role;
      const res = await Api.get('/users', { params });
      const list = res.data || res || [];

      // Populate audit user dropdown
      const auditUserSel = document.getElementById('audit-user');
      if (auditUserSel) auditUserSel.innerHTML = '<option value="">— All Users —</option>' +
        list.map(u => `<option value="${u.id}">${u.name||u.email}</option>`).join('');

      el.innerHTML = list.length === 0
        ? '<div class="empty-state"><h3>No users found</h3></div>'
        : `<table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th><th>Action</th></tr></thead>
            <tbody>
              ${list.map(u => `<tr>
                <td class="td-bold">${u.name||'—'}</td>
                <td style="font-size:11px">${u.email||'—'}</td>
                <td>${Utils.chip(u.role||'viewer')}</td>
                <td><span class="chip ${u.is_active||u.isActive?'ch-green':'ch-red'}">${u.is_active||u.isActive?'Active':'Inactive'}</span></td>
                <td style="font-size:10.5px">${Utils.date(u.last_login||u.lastLogin||u.updated_at)}</td>
                <td><div style="display:flex;gap:4px">
                  <button class="btn btn-ghost btn-sm" onclick="UsersPage.editRole('${u.id}','${u.role||'viewer'}')">Edit Role</button>
                  <button class="btn btn-ghost btn-sm" style="color:var(--${u.is_active||u.isActive?'red':'green'})" onclick="UsersPage.toggleActive('${u.id}',${!(u.is_active||u.isActive)})">${u.is_active||u.isActive?'Disable':'Enable'}</button>
                </div></td>
              </tr>`).join('')}
            </tbody>
          </table>`;
    } catch (err) {
      el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`;
    }
  },

  async loadRoles() {
    const el = document.getElementById('usr-roles-body');
    if (!el) return;

    const roles = [
      { key: 'super_admin', label: 'Super Admin', desc: 'Full access to all modules, manage users and roles', perms: ['All permissions'] },
      { key: 'project_manager', label: 'Project Manager', desc: 'Full access to assigned projects', perms: ['Consumer CRUD', 'Payments', 'Documents', 'Reports', 'Communications'] },
      { key: 'sales_executive', label: 'Sales Executive', desc: 'Assigned leads only, limited allocation view', perms: ['Assigned consumers', 'Limited payment view', 'Communications'] },
      { key: 'accounts', label: 'Accounts / Finance', desc: 'Full payments, financial dashboard, demand/receipt letters', perms: ['Payments CRUD', 'Receipts', 'Demands', 'Financial Reports'] },
      { key: 'support_agent', label: 'Support Agent', desc: 'Communications, remarks, read-only consumer records', perms: ['Read consumers', 'Communications', 'Remarks log', 'Tasks'] },
      { key: 'viewer', label: 'Viewer', desc: 'Read-only access to dashboards and reports', perms: ['Read-only dashboards', 'Reports (view only)'] },
    ];

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
        ${roles.map(r => `
          <div class="sp">
            <div class="sp-hdr">
              <div class="sp-title">${r.label}</div>
              ${Utils.chip(r.key)}
            </div>
            <div class="sp-body">
              <p style="font-size:11px;color:var(--text3);margin:0 0 8px">${r.desc}</p>
              <div style="font-size:10.5px">
                ${r.perms.map(p => `<div style="padding:3px 0;border-bottom:1px solid var(--border)">✓ ${p}</div>`).join('')}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  async loadAudit() {
    const el = document.getElementById('usr-audit-body');
    if (!el) return;
    const userId = document.getElementById('audit-user')?.value;
    const action = document.getElementById('audit-action')?.value;
    const from = document.getElementById('audit-from')?.value;
    const to = document.getElementById('audit-to')?.value;

    try {
      const params = { pageSize: 200 };
      if (userId) params.userId = userId;
      if (action) params.action = action;
      if (from) params.fromDate = from;
      if (to) params.toDate = to;

      const res = await Api.get('/users/audit-logs', { params });
      const list = res.data || res || [];

      el.innerHTML = list.length === 0
        ? '<div class="empty-state"><h3>No audit logs found</h3></div>'
        : `<div class="tbl-wrap"><table>
            <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Resource</th><th>Details</th></tr></thead>
            <tbody>
              ${list.map(l => `<tr>
                <td style="font-size:10.5px">${Utils.date(l.created_at||l.createdAt||l.timestamp)}</td>
                <td class="td-bold">${l.user_name||l.userName||l.user_id||'—'}</td>
                <td><span class="chip ${l.action==='DELETE'?'ch-red':l.action==='CREATE'?'ch-green':'ch-blue'}">${l.action||'—'}</span></td>
                <td style="font-size:10.5px">${l.resource_type||l.resourceType||'—'}</td>
                <td style="font-size:10.5px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${l.details||l.description||'—'}</td>
              </tr>`).join('')}
            </tbody>
          </table></div>`;
    } catch (err) {
      el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`;
    }
  },

  showInviteModal() {
    showOverlay('invite-overlay');
    document.getElementById('invite-modal').style.display = 'block';
  },

  async invite() {
    const name = document.getElementById('invite-name')?.value?.trim();
    const email = document.getElementById('invite-email')?.value?.trim();
    const role = document.getElementById('invite-role')?.value;
    if (!name || !email) { Utils.warn('Please fill in name and email'); return; }
    try {
      const password = Math.random().toString(36).slice(2, 10);
      await Api.post('/users', { name, email, role, password });
      Utils.success(`User ${name} created with temporary password: ${password}`);
      closeOverlay('invite-overlay');
      document.getElementById('invite-modal').style.display = 'none';
      await this.loadTeam();
    } catch (err) { Utils.error(err.message); }
  },

  async editRole(userId, currentRole) {
    const newRole = prompt(`Change role for user (current: ${currentRole}):\nOptions: super_admin, project_manager, sales_executive, accounts, support_agent, viewer`, currentRole);
    if (!newRole || newRole === currentRole) return;
    try {
      await Api.patch(`/users/${userId}`, { role: newRole });
      Utils.success('Role updated');
      await this.loadTeam();
    } catch (err) { Utils.error(err.message); }
  },

  async toggleActive(userId, active) {
    try {
      await Api.patch(`/users/${userId}`, { isActive: active });
      Utils.success(active ? 'User enabled' : 'User disabled');
      await this.loadTeam();
    } catch (err) { Utils.error(err.message); }
  },
};
