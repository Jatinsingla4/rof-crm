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
          <select class="fc" id="usr-role-filter" style="width:180px" onchange="UsersPage.loadTeam()">
            <option value="">— All Roles —</option>
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
  `;

  await UsersPage.loadTeam();
};

const UsersPage = {

  // ── TEAM MEMBERS ─────────────────────────────────────────────────────────────

  async loadTeam() {
    const roleFilter = document.getElementById('usr-role-filter');
    const role = roleFilter?.value || '';
    const el = document.getElementById('usr-team-body');
    if (!el) return;

    // Populate role filter dropdown from DB (once, only if empty)
    if (roleFilter && roleFilter.options.length <= 1) {
      try {
        const rolesData = await Api.get('/roles');
        const roles = rolesData.data || rolesData || [];
        roles.forEach(r => {
          const opt = document.createElement('option');
          opt.value = r.name;
          opt.textContent = r.label || r.name;
          roleFilter.appendChild(opt);
        });
        if (role) roleFilter.value = role;
      } catch { /* silently skip */ }
    }

    try {
      const params = { pageSize: 100 };
      if (role) params.role = role;
      const res = await Api.get('/users', { params });
      const list = res.data || res || [];

      const auditUserSel = document.getElementById('audit-user');
      if (auditUserSel) auditUserSel.innerHTML = '<option value="">— All Users —</option>' +
        list.map(u => `<option value="${u.id}">${u.name || u.email}</option>`).join('');

      el.innerHTML = list.length === 0
        ? '<div class="empty-state"><h3>No users found</h3></div>'
        : `<table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th><th>Action</th></tr></thead>
            <tbody>
              ${list.map(u => `<tr>
                <td class="td-bold">${u.name || '—'}</td>
                <td style="font-size:11px">${u.email || '—'}</td>
                <td>${Utils.chip(u.role || 'viewer')}</td>
                <td><span class="chip ${u.is_active || u.isActive ? 'ch-green' : 'ch-red'}">${u.is_active || u.isActive ? 'Active' : 'Inactive'}</span></td>
                <td style="font-size:10.5px">${Utils.date(u.last_login || u.lastLogin || u.updated_at)}</td>
                <td><div style="display:flex;gap:4px">
                  <button class="btn btn-ghost btn-sm" onclick="UsersPage.editRole('${u.id}','${u.role || 'viewer'}')">Edit Role</button>
                  <button class="btn btn-ghost btn-sm" style="color:var(--${u.is_active || u.isActive ? 'red' : 'green'})" onclick="UsersPage.toggleActive('${u.id}',${!(u.is_active || u.isActive)})">${u.is_active || u.isActive ? 'Disable' : 'Enable'}</button>
                </div></td>
              </tr>`).join('')}
            </tbody>
          </table>`;
    } catch (err) {
      el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`;
    }
  },

  async editRole(userId, currentRole) {
    // Build options from DB roles
    let roles = [];
    try {
      const res = await Api.get('/roles');
      roles = res.data || res || [];
    } catch { roles = []; }

    const options = roles.map(r => r.name).join(', ');
    const newRole = prompt(`Change role for user (current: ${currentRole})\nAvailable: ${options}`, currentRole);
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

  // ── ROLES ────────────────────────────────────────────────────────────────────

  async loadRoles() {
    const el = document.getElementById('usr-roles-body');
    if (!el) return;
    el.innerHTML = '<div class="page-loading"><div class="spinner"></div> Loading…</div>';
    try {
      const res = await Api.get('/roles');
      const roles = res.data || res || [];

      el.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div style="font-weight:600;font-size:15px;color:var(--text1)">Roles & Permissions</div>
          <button class="btn btn-teal btn-sm" onclick="UsersPage.showCreateRole()">+ Create Role</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px">
          ${roles.map(r => `
            <div class="sp" style="position:relative">
              <div class="sp-hdr" style="display:flex;justify-content:space-between;align-items:start">
                <div>
                  <div class="sp-title">${r.label || r.name}</div>
                  <div style="font-size:10.5px;color:var(--text3);background:var(--bg2);padding:2px 6px;border-radius:4px;display:inline-block;margin-top:4px;font-family:monospace">${r.name}</div>
                </div>
                ${!r.is_system ? `<button class="btn btn-sm" style="background:var(--red-soft,#fee2e2);color:var(--red);border:none;padding:3px 8px;border-radius:4px;cursor:pointer;font-size:11px" onclick="UsersPage.deleteRole('${r.name}','${r.label || r.name}')">Delete</button>` : `<span class="chip ch-blue" style="font-size:10px">System</span>`}
              </div>
              <div class="sp-body">
                <p style="font-size:11px;color:var(--text3);margin:0 0 10px">${r.description || '—'}</p>
                <div style="display:flex;gap:16px;font-size:11px;color:var(--text3);margin-bottom:10px">
                  <span>👤 ${r.user_count || 0} users</span>
                  <span>📄 ${r.page_count || 0} pages</span>
                </div>
                <button class="btn btn-ghost btn-sm" style="width:100%" onclick="UsersPage.editRolePages('${r.name}','${r.label || r.name}')">Set Page Access</button>
              </div>
            </div>
          `).join('')}
        </div>`;
    } catch (err) {
      el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`;
    }
  },

  async _buildPageTree(accessMap = {}) {
    const res = await Api.get('/roles/nav-pages');
    const tree = res.data || res || {};
    return Object.entries(tree).map(([cat, pages]) => `
      <div style="margin-bottom:10px">
        <div class="sp-hdr" style="cursor:pointer;user-select:none;border-radius:4px" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none';this.querySelector('.cat-arrow').textContent=this.nextElementSibling.style.display==='none'?'▶':'▼'">
          <span class="cat-arrow">▼</span>&nbsp;<span style="font-weight:600;font-size:12px">${cat}</span>
          <span style="font-size:11px;color:var(--text3);margin-left:8px">(${pages.length} pages)</span>
        </div>
        <div style="padding-left:14px;padding-top:6px">
          <label style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:11.5px;cursor:pointer;color:var(--text3);font-style:italic">
            <input type="checkbox" class="cat-all-cb" data-cat="${cat}" style="width:13px;height:13px" onchange="UsersPage._toggleCat(this,'${cat}')"> Select all in ${cat}
          </label>
          ${pages.map(p => `
            <label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12.5px;cursor:pointer">
              <input type="checkbox" class="page-cb" value="${p.id}" ${accessMap[p.id] ? 'checked' : ''} style="width:13px;height:13px">
              <span>${p.label}</span>
              <span style="color:var(--text3);font-size:10.5px;font-family:monospace">${p.route}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `).join('');
  },

  _toggleCat(cb, cat) {
    const container = cb.closest('div').parentElement;
    container.querySelectorAll('.page-cb').forEach(pcb => { pcb.checked = cb.checked; });
  },

  selectAllPages(checked) {
    document.querySelectorAll('.page-cb').forEach(cb => { cb.checked = checked; });
    document.querySelectorAll('.cat-all-cb').forEach(cb => { cb.checked = checked; });
  },

  async showCreateRole() {
    const treeHtml = await this._buildPageTree({});
    this._showRoleModal({
      title: 'Create New Role',
      nameLocked: false,
      name: '', label: '', description: '',
      treeHtml,
      onSave: 'UsersPage.saveNewRole()',
      btnLabel: 'CREATE ROLE',
    });
  },

  async editRolePages(roleName, roleLabel) {
    let accessMap = {};
    try {
      const res = await Api.get(`/roles/${roleName}/pages`);
      (res.data || res || []).forEach(p => { accessMap[p.id] = p.has_access; });
    } catch { /* proceed with empty */ }
    const treeHtml = await this._buildPageTree(accessMap);
    this._showRoleModal({
      title: `Page Access — ${roleLabel}`,
      nameLocked: true,
      name: roleName, label: roleLabel, description: '',
      treeHtml,
      onSave: `UsersPage.saveRolePages('${roleName}')`,
      btnLabel: 'SAVE PAGE ACCESS',
    });
  },

  _showRoleModal({ title, nameLocked, name, label, description, treeHtml, onSave, btnLabel }) {
    document.getElementById('role-modal-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'role-modal-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box';
    overlay.innerHTML = `
      <div style="background:var(--card,#fff);border-radius:10px;width:640px;max-height:85vh;overflow-y:auto;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.3)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
          <h3 style="margin:0;font-size:16px;color:var(--text1)">${title}</h3>
          <button onclick="document.getElementById('role-modal-overlay').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--text3);line-height:1">×</button>
        </div>

        ${!nameLocked ? `
        <div style="margin-bottom:12px">
          <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:var(--text2)">* Role Name <span style="font-weight:400;color:var(--text3)">(slug — lowercase + underscores)</span></label>
          <input type="text" id="new-role-name" value="${name}" placeholder="e.g. collection_agent"
            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;background:var(--bg1,#fff);color:var(--text1)">
        </div>
        <div style="margin-bottom:12px">
          <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:var(--text2)">* Display Label</label>
          <input type="text" id="new-role-label" value="${label}" placeholder="e.g. Collection Agent"
            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;background:var(--bg1,#fff);color:var(--text1)">
        </div>
        <div style="margin-bottom:16px">
          <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:var(--text2)">Description</label>
          <textarea id="new-role-desc" rows="2" placeholder="What can this role do?"
            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;resize:vertical;background:var(--bg1,#fff);color:var(--text1)">${description}</textarea>
        </div>` : ''}

        <div style="margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span style="font-weight:600;font-size:13px;color:var(--text1)">Page Access</span>
            <div style="display:flex;gap:6px">
              <button onclick="UsersPage.selectAllPages(true)" class="btn btn-ghost btn-sm">Select All</button>
              <button onclick="UsersPage.selectAllPages(false)" class="btn btn-ghost btn-sm">Clear All</button>
            </div>
          </div>
          ${treeHtml}
        </div>

        <div id="role-modal-error" style="color:var(--red);font-size:12px;margin-bottom:8px;display:none"></div>
        <button onclick="${onSave}" class="btn btn-teal" style="width:100%;padding:10px;font-size:14px">${btnLabel}</button>
      </div>`;
    document.body.appendChild(overlay);
  },

  async saveNewRole() {
    const name  = document.getElementById('new-role-name')?.value.trim().toLowerCase();
    const label = document.getElementById('new-role-label')?.value.trim();
    const desc  = document.getElementById('new-role-desc')?.value.trim();
    const errEl = document.getElementById('role-modal-error');

    if (!name || !label) { errEl.textContent = 'Name and Label are required'; errEl.style.display = 'block'; return; }
    if (!/^[a-z_]+$/.test(name)) { errEl.textContent = 'Name must be lowercase letters and underscores only'; errEl.style.display = 'block'; return; }

    const pageIds = [];
    document.querySelectorAll('.page-cb:checked').forEach(cb => pageIds.push(cb.value));

    try {
      const res = await Api.post('/roles', { name, label, description: desc, pageIds });
      if (!res.success && !res.id) throw new Error(res.error || 'Failed');
      document.getElementById('role-modal-overlay')?.remove();
      Utils.success(`Role "${label}" created`);
      this.loadRoles();
    } catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; }
  },

  async saveRolePages(roleName) {
    const pageIds = [];
    document.querySelectorAll('.page-cb:checked').forEach(cb => pageIds.push(cb.value));
    try {
      await Api.put(`/roles/${roleName}/pages`, { pageIds });
      document.getElementById('role-modal-overlay')?.remove();
      Utils.success('Page access updated');
      this.loadRoles();
    } catch (err) {
      const errEl = document.getElementById('role-modal-error');
      if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; }
    }
  },

  async deleteRole(roleName, roleLabel) {
    if (!confirm(`Delete role "${roleLabel}"? This cannot be undone.`)) return;
    try {
      await Api.delete(`/roles/${roleName}`);
      Utils.success(`Role "${roleLabel}" deleted`);
      this.loadRoles();
    } catch (err) { Utils.error(err.message); }
  },

  // ── AUDIT LOGS ───────────────────────────────────────────────────────────────

  async loadAudit() {
    const el = document.getElementById('usr-audit-body');
    if (!el) return;
    const userId = document.getElementById('audit-user')?.value;
    const action = document.getElementById('audit-action')?.value;
    const from   = document.getElementById('audit-from')?.value;
    const to     = document.getElementById('audit-to')?.value;
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
                <td style="font-size:10.5px">${Utils.date(l.created_at || l.createdAt || l.timestamp)}</td>
                <td class="td-bold">${l.user_name || l.userName || l.user_id || '—'}</td>
                <td><span class="chip ${l.action === 'DELETE' ? 'ch-red' : l.action === 'CREATE' ? 'ch-green' : 'ch-blue'}">${l.action || '—'}</span></td>
                <td style="font-size:10.5px">${l.resource_type || l.resourceType || '—'}</td>
                <td style="font-size:10.5px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${l.details || l.description || '—'}</td>
              </tr>`).join('')}
            </tbody>
          </table></div>`;
    } catch (err) {
      el.innerHTML = `<div style="padding:20px;color:var(--red)">${err.message}</div>`;
    }
  },
};
