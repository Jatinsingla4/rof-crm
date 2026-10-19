// ROF CRM — Employee Organisation Page
// 8 tabs: Department, Employee Information, Report, Set Manager,
//         Team Master, Set Team Head, Team Head Detail, Employee Tree

Object.assign(EmpPage, {

  // ── State ──────────────────────────────────────
  _users: [],       // all users (for dropdowns)
  _depts: [],       // departments cache
  _teams: [],       // teams cache

  // ── Helpers ────────────────────────────────────
  async _fetchUsers() {
    if (this._users.length) return this._users;
    try {
      const r = await fetch('/api/users', { headers: Auth.headers() });
      const j = await r.json();
      this._users = j.data || [];
    } catch { this._users = []; }
    return this._users;
  },

  async _fetchDepts() {
    try {
      const r = await fetch('/api/employees/departments', { headers: Auth.headers() });
      const j = await r.json();
      this._depts = j.data || [];
    } catch { this._depts = []; }
    return this._depts;
  },

  async _fetchTeams() {
    try {
      const r = await fetch('/api/employees/teams', { headers: Auth.headers() });
      const j = await r.json();
      this._teams = j.data || [];
    } catch { this._teams = []; }
    return this._teams;
  },

  _userOptions(selected = '') {
    return this._users.map(u =>
      `<option value="${u.id}" ${u.id === selected ? 'selected' : ''}>${Utils.esc(u.name)} (${Utils.esc(u.email)})</option>`
    ).join('');
  },

  _deptOptions(selected = '') {
    return this._depts.map(d =>
      `<option value="${d.id}" ${d.id === selected ? 'selected' : ''}>${Utils.esc(d.name)}</option>`
    ).join('');
  },

  _teamOptions(selected = '') {
    return this._teams.map(t =>
      `<option value="${t.id}" ${t.id === selected ? 'selected' : ''}>${Utils.esc(t.name)}</option>`
    ).join('');
  },

  // ══════════════════════════════════════════════
  // TAB 1 — DEPARTMENTS
  // ══════════════════════════════════════════════

  async loadDepartments() {
    const body = document.getElementById('emp-dept-body');
    if (!body) return;
    body.innerHTML = '<div class="page-loading"><div class="spinner"></div> Loading…</div>';
    await Promise.all([this._fetchDepts(), this._fetchUsers()]);
    const depts = this._depts;

    if (!depts.length) {
      body.innerHTML = '<div class="empty-state"><h3>No departments found</h3></div>';
      return;
    }

    body.innerHTML = `
      <table class="tbl">
        <thead><tr>
          <th>Department</th><th>Description</th><th>Head</th><th>Status</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${depts.map(d => `
            <tr id="dept-row-${d.id}">
              <td><b>${Utils.esc(d.name)}</b></td>
              <td>${Utils.esc(d.description || '—')}</td>
              <td>${Utils.esc(d.head_name || '—')}</td>
              <td>${Utils.chip(d.is_active ? 'active' : 'inactive')}</td>
              <td>
                <button class="btn btn-xs btn-outline" onclick="EmpPage.editDept('${d.id}')">Edit</button>
                <button class="btn btn-xs btn-red" onclick="EmpPage.deleteDept('${d.id}','${Utils.esc(d.name)}')">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  },

  showDeptModal(dept = null) {
    const isEdit = !!dept;
    document.getElementById('dept-modal-title').textContent = isEdit ? 'Edit Department' : 'New Department';
    document.getElementById('dept-form-id').value = dept?.id || '';
    document.getElementById('dept-form-name').value = dept?.name || '';
    document.getElementById('dept-form-desc').value = dept?.description || '';
    document.getElementById('dept-form-head').innerHTML =
      `<option value="">— None —</option>${this._userOptions(dept?.head_user_id || '')}`;
    document.getElementById('dept-form-active').checked = dept ? dept.is_active : true;
    Utils.showOverlay('dept-overlay');
    document.getElementById('dept-modal').style.display = 'block';
  },

  async editDept(id) {
    const d = this._depts.find(x => x.id === id);
    if (d) this.showDeptModal(d);
  },

  async saveDept() {
    const id = document.getElementById('dept-form-id').value;
    const payload = {
      name:        document.getElementById('dept-form-name').value.trim(),
      description: document.getElementById('dept-form-desc').value.trim(),
      head_user_id: document.getElementById('dept-form-head').value || null,
      is_active:   document.getElementById('dept-form-active').checked,
    };
    if (!payload.name) return Utils.error('Department name is required');

    const url = id ? `/api/employees/departments/${id}` : '/api/employees/departments';
    const method = id ? 'PATCH' : 'POST';

    try {
      const r = await fetch(url, { method, headers: { ...Auth.headers(), 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (!r.ok) return Utils.error(j.error || 'Save failed');
      Utils.success(id ? 'Department updated' : 'Department created');
      Utils.closeOverlay('dept-overlay');
      document.getElementById('dept-modal').style.display = 'none';
      this._depts = [];
      this.loadDepartments();
    } catch { Utils.error('Network error'); }
  },

  deleteDept(id, name) {
    Utils.confirm(`Delete department "${name}"?`, async () => {
      try {
        const r = await fetch(`/api/employees/departments/${id}`, { method: 'DELETE', headers: Auth.headers() });
        const j = await r.json();
        if (!r.ok) return Utils.error(j.error || 'Delete failed');
        Utils.success('Department deleted');
        this._depts = [];
        this.loadDepartments();
      } catch { Utils.error('Network error'); }
    });
  },

  // ══════════════════════════════════════════════
  // TAB 2 — EMPLOYEE INFORMATION
  // ══════════════════════════════════════════════

  async loadEmployeeInfo() {
    const body = document.getElementById('emp-info-body');
    if (!body) return;
    body.innerHTML = '<div class="page-loading"><div class="spinner"></div> Loading…</div>';
    await Promise.all([this._fetchUsers(), this._fetchDepts()]);

    const deptFilter = document.getElementById('emp-dept-filter')?.value || '';
    const search = document.getElementById('emp-search')?.value || '';
    const params = new URLSearchParams();
    if (deptFilter) params.set('department_id', deptFilter);
    if (search)     params.set('search', search);

    try {
      const r = await fetch(`/api/employees?${params}`, { headers: Auth.headers() });
      const j = await r.json();
      const emps = j.data || [];

      if (!emps.length) {
        body.innerHTML = '<div class="empty-state"><h3>No employee profiles found</h3></div>';
        return;
      }

      body.innerHTML = `
        <table class="tbl">
          <thead><tr>
            <th>Code</th><th>Name</th><th>Department</th><th>Designation</th>
            <th>Manager</th><th>Mobile</th><th>Joined</th><th>Status</th><th>Actions</th>
          </tr></thead>
          <tbody>
            ${emps.map(e => `
              <tr>
                <td>${Utils.esc(e.employee_code || '—')}</td>
                <td><b>${Utils.esc(e.name)}</b><br><small>${Utils.esc(e.email)}</small></td>
                <td>${Utils.esc(e.department_name || '—')}</td>
                <td>${Utils.esc(e.designation || '—')}</td>
                <td>${Utils.esc(e.manager_name || '—')}</td>
                <td>${Utils.esc(e.mobile_office || e.mobile_personal || '—')}</td>
                <td>${Utils.date(e.joining_date)}</td>
                <td>${Utils.chip(e.is_active ? 'active' : 'inactive')}</td>
                <td>
                  <button class="btn btn-xs btn-outline" onclick="EmpPage.showEmpModal('${e.user_id}')">Edit</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>`;
    } catch { body.innerHTML = '<div class="empty-state"><h3>Failed to load employees</h3></div>'; }
  },

  showEmpModal(userId = null) {
    const emp = userId ? null : null; // For new, userId is null
    document.getElementById('emp-form-userid').innerHTML =
      `<option value="">— Select User —</option>${this._userOptions(userId || '')}`;
    document.getElementById('emp-form-dept').innerHTML =
      `<option value="">— None —</option>${this._deptOptions()}`;
    document.getElementById('emp-form-manager').innerHTML =
      `<option value="">— None —</option>${this._userOptions()}`;

    if (userId) {
      // Pre-fill by fetching profile
      fetch(`/api/employees/${userId}`, { headers: Auth.headers() })
        .then(r => r.json())
        .then(j => {
          const e = j.data;
          if (!e) return;
          document.getElementById('emp-form-userid').value = e.user_id;
          document.getElementById('emp-form-code').value = e.employee_code || '';
          document.getElementById('emp-form-desig').value = e.designation || '';
          document.getElementById('emp-form-joining').value = e.joining_date?.slice(0,10) || '';
          document.getElementById('emp-form-grade').value = e.salary_grade || '';
          document.getElementById('emp-form-dept').value = e.department_id || '';
          document.getElementById('emp-form-manager').value = e.manager_id || '';
          document.getElementById('emp-form-mob-office').value = e.mobile_office || '';
          document.getElementById('emp-form-mob-personal').value = e.mobile_personal || '';
          document.getElementById('emp-form-emergency').value = e.emergency_contact || '';
          document.getElementById('emp-form-address').value = e.address || '';
          document.getElementById('emp-form-city').value = e.city || '';
          document.getElementById('emp-form-state').value = e.state || '';
        }).catch(() => {});
    } else {
      document.getElementById('emp-info-form').reset();
    }

    document.getElementById('emp-modal-title').textContent = userId ? 'Edit Employee Profile' : 'New Employee Profile';
    Utils.showOverlay('emp-overlay');
    document.getElementById('emp-modal').style.display = 'block';
  },

  async saveEmpProfile() {
    const payload = {
      user_id:          document.getElementById('emp-form-userid').value,
      employee_code:    document.getElementById('emp-form-code').value.trim(),
      designation:      document.getElementById('emp-form-desig').value.trim(),
      joining_date:     document.getElementById('emp-form-joining').value || null,
      salary_grade:     document.getElementById('emp-form-grade').value.trim(),
      department_id:    document.getElementById('emp-form-dept').value || null,
      manager_id:       document.getElementById('emp-form-manager').value || null,
      mobile_office:    document.getElementById('emp-form-mob-office').value.trim(),
      mobile_personal:  document.getElementById('emp-form-mob-personal').value.trim(),
      emergency_contact: document.getElementById('emp-form-emergency').value.trim(),
      address:          document.getElementById('emp-form-address').value.trim(),
      city:             document.getElementById('emp-form-city').value.trim(),
      state:            document.getElementById('emp-form-state').value.trim(),
    };
    if (!payload.user_id) return Utils.error('Please select a user');

    try {
      const r = await fetch('/api/employees', {
        method: 'POST',
        headers: { ...Auth.headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) return Utils.error(j.error || 'Save failed');
      Utils.success('Employee profile saved');
      Utils.closeOverlay('emp-overlay');
      document.getElementById('emp-modal').style.display = 'none';
      this.loadEmployeeInfo();
    } catch { Utils.error('Network error'); }
  },

  // ══════════════════════════════════════════════
  // TAB 3 — REPORT
  // ══════════════════════════════════════════════

  async loadReport() {
    const body = document.getElementById('emp-report-body');
    if (!body) return;
    body.innerHTML = '<div class="page-loading"><div class="spinner"></div> Loading…</div>';
    try {
      const r = await fetch('/api/employees/report', { headers: Auth.headers() });
      const j = await r.json();
      const rows = j.data || [];

      if (!rows.length) { body.innerHTML = '<div class="empty-state"><h3>No data</h3></div>'; return; }

      const totalAll    = rows.reduce((a, r) => a + parseInt(r.total || 0), 0);
      const activeAll   = rows.reduce((a, r) => a + parseInt(r.active || 0), 0);
      const inactiveAll = rows.reduce((a, r) => a + parseInt(r.inactive || 0), 0);

      body.innerHTML = `
        <div class="kpi-row" style="margin-bottom:16px">
          <div class="kpi-card"><div class="kpi-val">${totalAll}</div><div class="kpi-lbl">Total Employees</div></div>
          <div class="kpi-card"><div class="kpi-val">${activeAll}</div><div class="kpi-lbl">Active</div></div>
          <div class="kpi-card"><div class="kpi-val">${inactiveAll}</div><div class="kpi-lbl">Inactive</div></div>
          <div class="kpi-card"><div class="kpi-val">${rows.length}</div><div class="kpi-lbl">Departments</div></div>
        </div>
        <table class="tbl">
          <thead><tr>
            <th>Department</th><th>Total</th><th>Active</th><th>Inactive</th>
          </tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td><b>${Utils.esc(r.department)}</b></td>
                <td>${r.total}</td>
                <td>${Utils.chip('active')} ${r.active}</td>
                <td>${r.inactive > 0 ? Utils.chip('inactive') + ' ' + r.inactive : '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>`;
    } catch { body.innerHTML = '<div class="empty-state"><h3>Failed to load report</h3></div>'; }
  },

  // ══════════════════════════════════════════════
  // TAB 4 — SET MANAGER
  // ══════════════════════════════════════════════

  async loadSetManager() {
    const body = document.getElementById('emp-manager-body');
    if (!body) return;
    body.innerHTML = '<div class="page-loading"><div class="spinner"></div> Loading…</div>';
    await this._fetchUsers();
    await this._fetchDepts();

    // fetch all employees
    try {
      const r = await fetch('/api/employees', { headers: Auth.headers() });
      const j = await r.json();
      const emps = j.data || [];

      body.innerHTML = `
        <div class="sp" style="margin-bottom:16px">
          <div class="sp-hdr"><div class="sp-title">Assign Manager to Employee</div></div>
          <div class="sp-body">
            <div class="sp-grid">
              <div class="fg"><label class="fl">Employee</label>
                <select class="fc" id="mgr-emp-sel">
                  <option value="">— Select Employee —</option>
                  ${emps.map(e => `<option value="${e.user_id}">${Utils.esc(e.name)} (${Utils.esc(e.department_name || 'No Dept')})</option>`).join('')}
                </select>
              </div>
              <div class="fg"><label class="fl">Manager</label>
                <select class="fc" id="mgr-manager-sel">
                  <option value="">— None —</option>
                  ${this._userOptions()}
                </select>
              </div>
            </div>
            <button class="btn btn-teal" style="margin-top:10px" onclick="EmpPage.saveManager()">Set Manager</button>
          </div>
        </div>
        <table class="tbl">
          <thead><tr><th>Employee</th><th>Department</th><th>Current Manager</th><th>Action</th></tr></thead>
          <tbody>
            ${emps.map(e => `
              <tr id="mgr-row-${e.user_id}">
                <td><b>${Utils.esc(e.name)}</b></td>
                <td>${Utils.esc(e.department_name || '—')}</td>
                <td id="mgr-val-${e.user_id}">${Utils.esc(e.manager_name || '—')}</td>
                <td>
                  <button class="btn btn-xs btn-outline" onclick="EmpPage.quickSetManager('${e.user_id}','${Utils.esc(e.name)}')">Change</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>`;
    } catch { body.innerHTML = '<div class="empty-state"><h3>Failed to load</h3></div>'; }
  },

  async saveManager() {
    const empId = document.getElementById('mgr-emp-sel').value;
    const managerId = document.getElementById('mgr-manager-sel').value;
    if (!empId) return Utils.error('Select an employee');
    try {
      const r = await fetch(`/api/employees/${empId}/set-manager`, {
        method: 'PATCH',
        headers: { ...Auth.headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_id: managerId || null }),
      });
      const j = await r.json();
      if (!r.ok) return Utils.error(j.error || 'Failed');
      Utils.success('Manager assigned');
      this.loadSetManager();
    } catch { Utils.error('Network error'); }
  },

  quickSetManager(empId, empName) {
    const sel = document.getElementById('mgr-emp-sel');
    if (sel) sel.value = empId;
  },

  // ══════════════════════════════════════════════
  // TAB 5 — TEAM MASTER
  // ══════════════════════════════════════════════

  async loadTeamMaster() {
    const body = document.getElementById('emp-teams-body');
    if (!body) return;
    body.innerHTML = '<div class="page-loading"><div class="spinner"></div> Loading…</div>';
    await Promise.all([this._fetchDepts(), this._fetchTeams(), this._fetchUsers()]);
    const teams = this._teams;

    if (!teams.length) {
      body.innerHTML = '<div class="empty-state"><h3>No teams found</h3></div>';
      return;
    }

    body.innerHTML = `
      <table class="tbl">
        <thead><tr>
          <th>Team</th><th>Department</th><th>Team Head</th><th>Members</th><th>Status</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${teams.map(t => `
            <tr>
              <td><b>${Utils.esc(t.name)}</b></td>
              <td>${Utils.esc(t.department_name || '—')}</td>
              <td>${Utils.esc(t.team_head_name || '—')}</td>
              <td>${t.member_count}</td>
              <td>${Utils.chip(t.is_active ? 'active' : 'inactive')}</td>
              <td>
                <button class="btn btn-xs btn-outline" onclick="EmpPage.editTeam('${t.id}')">Edit</button>
                <button class="btn btn-xs btn-outline" onclick="EmpPage.loadTeamMembers('${t.id}','${Utils.esc(t.name)}')">Members</button>
                <button class="btn btn-xs btn-red" onclick="EmpPage.deleteTeam('${t.id}','${Utils.esc(t.name)}')">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div id="emp-team-members-section" style="margin-top:20px"></div>`;
  },

  showTeamModal(team = null) {
    const isEdit = !!team;
    document.getElementById('team-modal-title').textContent = isEdit ? 'Edit Team' : 'New Team';
    document.getElementById('team-form-id').value = team?.id || '';
    document.getElementById('team-form-name').value = team?.name || '';
    document.getElementById('team-form-desc').value = team?.description || '';
    document.getElementById('team-form-dept').innerHTML =
      `<option value="">— None —</option>${this._deptOptions(team?.department_id || '')}`;
    document.getElementById('team-form-head').innerHTML =
      `<option value="">— None —</option>${this._userOptions(team?.team_head_id || '')}`;
    document.getElementById('team-form-active').checked = team ? team.is_active : true;
    Utils.showOverlay('team-overlay');
    document.getElementById('team-modal').style.display = 'block';
  },

  editTeam(id) {
    const t = this._teams.find(x => x.id === id);
    if (t) this.showTeamModal(t);
  },

  async saveTeam() {
    const id = document.getElementById('team-form-id').value;
    const payload = {
      name:         document.getElementById('team-form-name').value.trim(),
      description:  document.getElementById('team-form-desc').value.trim(),
      department_id: document.getElementById('team-form-dept').value || null,
      team_head_id:  document.getElementById('team-form-head').value || null,
      is_active:    document.getElementById('team-form-active').checked,
    };
    if (!payload.name) return Utils.error('Team name is required');

    const url = id ? `/api/employees/teams/${id}` : '/api/employees/teams';
    const method = id ? 'PATCH' : 'POST';

    try {
      const r = await fetch(url, { method, headers: { ...Auth.headers(), 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (!r.ok) return Utils.error(j.error || 'Save failed');
      Utils.success(id ? 'Team updated' : 'Team created');
      Utils.closeOverlay('team-overlay');
      document.getElementById('team-modal').style.display = 'none';
      this._teams = [];
      this.loadTeamMaster();
    } catch { Utils.error('Network error'); }
  },

  deleteTeam(id, name) {
    Utils.confirm(`Delete team "${name}"?`, async () => {
      try {
        const r = await fetch(`/api/employees/teams/${id}`, { method: 'DELETE', headers: Auth.headers() });
        const j = await r.json();
        if (!r.ok) return Utils.error(j.error || 'Delete failed');
        Utils.success('Team deleted');
        this._teams = [];
        this.loadTeamMaster();
      } catch { Utils.error('Network error'); }
    });
  },

  async loadTeamMembers(teamId, teamName) {
    const section = document.getElementById('emp-team-members-section');
    if (!section) return;
    section.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

    try {
      const r = await fetch(`/api/employees/teams/${teamId}/members`, { headers: Auth.headers() });
      const j = await r.json();
      const members = j.data || [];

      section.innerHTML = `
        <div class="sp">
          <div class="sp-hdr">
            <div class="sp-title">Members — ${Utils.esc(teamName)}</div>
            <button class="btn btn-sm btn-teal" onclick="EmpPage.showAddMemberModal('${teamId}')">+ Add Member</button>
          </div>
          <div class="sp-body">
            ${members.length ? `
              <table class="tbl">
                <thead><tr><th>Name</th><th>Role</th><th>Designation</th><th>Joined</th><th>Actions</th></tr></thead>
                <tbody>
                  ${members.map(m => `
                    <tr>
                      <td><b>${Utils.esc(m.name)}</b><br><small>${Utils.esc(m.email)}</small></td>
                      <td>${Utils.esc(m.role_in_team)}</td>
                      <td>${Utils.esc(m.designation || '—')}</td>
                      <td>${Utils.date(m.joined_at)}</td>
                      <td>
                        <button class="btn btn-xs btn-red" onclick="EmpPage.removeMember('${teamId}','${m.user_id}','${Utils.esc(m.name)}')">Remove</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>` : '<div class="empty-state"><h3>No members yet</h3></div>'}
          </div>
        </div>
        <div id="add-member-section"></div>`;
    } catch { section.innerHTML = '<div class="empty-state"><h3>Failed to load members</h3></div>'; }
  },

  showAddMemberModal(teamId) {
    const section = document.getElementById('add-member-section');
    if (!section) return;
    section.innerHTML = `
      <div class="sp" style="margin-top:12px">
        <div class="sp-hdr"><div class="sp-title">Add Member</div></div>
        <div class="sp-body">
          <div class="sp-grid">
            <div class="fg"><label class="fl">User</label>
              <select class="fc" id="add-member-user">
                <option value="">— Select User —</option>
                ${this._userOptions()}
              </select>
            </div>
            <div class="fg"><label class="fl">Role in Team</label>
              <select class="fc" id="add-member-role">
                <option value="member">Member</option>
                <option value="lead">Lead</option>
                <option value="co-lead">Co-Lead</option>
              </select>
            </div>
          </div>
          <button class="btn btn-teal" style="margin-top:10px" onclick="EmpPage.addMember('${teamId}')">Add</button>
          <button class="btn btn-outline" style="margin-top:10px;margin-left:8px" onclick="document.getElementById('add-member-section').innerHTML=''">Cancel</button>
        </div>
      </div>`;
  },

  async addMember(teamId) {
    const userId = document.getElementById('add-member-user').value;
    const role   = document.getElementById('add-member-role').value;
    if (!userId) return Utils.error('Select a user');
    try {
      const r = await fetch(`/api/employees/teams/${teamId}/members`, {
        method: 'POST',
        headers: { ...Auth.headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, role_in_team: role }),
      });
      const j = await r.json();
      if (!r.ok) return Utils.error(j.error || 'Failed');
      Utils.success('Member added');
      this._teams = [];
      this.loadTeamMembers(teamId, '');
    } catch { Utils.error('Network error'); }
  },

  removeMember(teamId, userId, name) {
    Utils.confirm(`Remove ${name} from team?`, async () => {
      try {
        await fetch(`/api/employees/teams/${teamId}/members/${userId}`, { method: 'DELETE', headers: Auth.headers() });
        Utils.success('Member removed');
        this._teams = [];
        this.loadTeamMembers(teamId, '');
      } catch { Utils.error('Network error'); }
    });
  },

  // ══════════════════════════════════════════════
  // TAB 6 — SET TEAM HEAD
  // ══════════════════════════════════════════════

  async loadSetTeamHead() {
    const body = document.getElementById('emp-teamhead-body');
    if (!body) return;
    body.innerHTML = '<div class="page-loading"><div class="spinner"></div> Loading…</div>';
    await Promise.all([this._fetchTeams(), this._fetchUsers()]);
    const teams = this._teams;

    body.innerHTML = `
      <div class="sp" style="margin-bottom:16px">
        <div class="sp-hdr"><div class="sp-title">Assign Team Head</div></div>
        <div class="sp-body">
          <div class="sp-grid">
            <div class="fg"><label class="fl">Team</label>
              <select class="fc" id="th-team-sel">
                <option value="">— Select Team —</option>
                ${teams.map(t => `<option value="${t.id}">${Utils.esc(t.name)}</option>`).join('')}
              </select>
            </div>
            <div class="fg"><label class="fl">Team Head</label>
              <select class="fc" id="th-head-sel">
                <option value="">— None —</option>
                ${this._userOptions()}
              </select>
            </div>
          </div>
          <button class="btn btn-teal" style="margin-top:10px" onclick="EmpPage.saveTeamHead()">Set Head</button>
        </div>
      </div>
      <table class="tbl">
        <thead><tr><th>Team</th><th>Department</th><th>Current Head</th><th>Members</th><th>Quick Set</th></tr></thead>
        <tbody>
          ${teams.map(t => `
            <tr>
              <td><b>${Utils.esc(t.name)}</b></td>
              <td>${Utils.esc(t.department_name || '—')}</td>
              <td>${Utils.esc(t.team_head_name || '—')}</td>
              <td>${t.member_count}</td>
              <td>
                <button class="btn btn-xs btn-outline" onclick="document.getElementById('th-team-sel').value='${t.id}'">Select</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  },

  async saveTeamHead() {
    const teamId = document.getElementById('th-team-sel').value;
    const headId = document.getElementById('th-head-sel').value;
    if (!teamId) return Utils.error('Select a team');
    try {
      const r = await fetch(`/api/employees/teams/${teamId}/set-head`, {
        method: 'PATCH',
        headers: { ...Auth.headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_head_id: headId || null }),
      });
      const j = await r.json();
      if (!r.ok) return Utils.error(j.error || 'Failed');
      Utils.success('Team head updated');
      this._teams = [];
      this.loadSetTeamHead();
    } catch { Utils.error('Network error'); }
  },

  // ══════════════════════════════════════════════
  // TAB 7 — TEAM HEAD DETAIL
  // ══════════════════════════════════════════════

  async loadTeamHeadDetail() {
    const body = document.getElementById('emp-thdetail-body');
    if (!body) return;
    body.innerHTML = '<div class="page-loading"><div class="spinner"></div> Loading…</div>';
    await this._fetchTeams();

    const heads = this._teams.filter(t => t.team_head_id);

    if (!heads.length) {
      body.innerHTML = '<div class="empty-state"><h3>No team heads assigned yet</h3></div>';
      return;
    }

    body.innerHTML = `
      <div class="card-grid">
        ${heads.map(t => `
          <div class="sp" style="margin-bottom:0">
            <div class="sp-hdr">
              <div class="sp-title">${Utils.esc(t.name)}</div>
              <span class="chip ch-teal">${Utils.esc(t.department_name || 'No Dept')}</span>
            </div>
            <div class="sp-body">
              <div style="margin-bottom:6px">
                <b>Team Head:</b> ${Utils.esc(t.team_head_name || '—')}
              </div>
              <div style="margin-bottom:6px">
                <b>Members:</b> ${t.member_count}
              </div>
              <div>
                ${Utils.chip(t.is_active ? 'active' : 'inactive')}
              </div>
              <button class="btn btn-xs btn-outline" style="margin-top:10px"
                onclick="EmpPage.loadTeamMembers('${t.id}','${Utils.esc(t.name)}');switchTab('emp','team-master')">
                View Members
              </button>
            </div>
          </div>
        `).join('')}
      </div>`;
  },

  // ══════════════════════════════════════════════
  // TAB 8 — EMPLOYEE TREE
  // ══════════════════════════════════════════════

  async loadTree() {
    const body = document.getElementById('emp-tree-body');
    if (!body) return;
    body.innerHTML = '<div class="page-loading"><div class="spinner"></div> Loading…</div>';

    try {
      const r = await fetch('/api/employees/tree', { headers: Auth.headers() });
      const j = await r.json();
      const roots = j.data || [];

      if (!roots.length) {
        body.innerHTML = '<div class="empty-state"><h3>No employees with profiles found</h3></div>';
        return;
      }

      body.innerHTML = `
        <div style="padding:8px">
          <p style="color:var(--text-muted);margin-bottom:16px">
            Showing reporting hierarchy. Employees without a manager appear at the top level.
          </p>
          <div class="org-tree">${this._renderTree(roots)}</div>
        </div>`;
    } catch { body.innerHTML = '<div class="empty-state"><h3>Failed to load org tree</h3></div>'; }
  },

  _renderTree(nodes) {
    if (!nodes.length) return '';
    return `<ul class="org-ul">
      ${nodes.map(n => `
        <li class="org-li">
          <div class="org-node">
            <div class="org-name">${Utils.esc(n.name)}</div>
            <div class="org-sub">${Utils.esc(n.designation || n.email || '')}</div>
            ${n.department_name ? `<span class="chip ch-blue" style="font-size:10px">${Utils.esc(n.department_name)}</span>` : ''}
          </div>
          ${n.children?.length ? this._renderTree(n.children) : ''}
        </li>
      `).join('')}
    </ul>`;
  },

});

// ══════════════════════════════════════════════
// PAGE ENTRY POINT
// ══════════════════════════════════════════════

Pages.employees = async function(params = {}) {
  const content = document.getElementById('content');
  const tab = params.tab || 'department';

  // Reset caches on fresh page load
  EmpPage._users = [];
  EmpPage._depts = [];
  EmpPage._teams = [];

  content.innerHTML = `
    <div class="page-hdr">
      <h1>Employee Organisation</h1>
      <div class="breadcrumb">Set Master / <b>Employees</b></div>
    </div>

    <div class="tabs-line">
      <button class="tab-line ${tab==='department'?'active':''}" data-group="emp" data-tab="department"
        onclick="switchTab('emp','department');EmpPage.loadDepartments()">Departments</button>
      <button class="tab-line ${tab==='info'?'active':''}" data-group="emp" data-tab="info"
        onclick="switchTab('emp','info');EmpPage.loadEmployeeInfo()">Employee Info</button>
      <button class="tab-line ${tab==='report'?'active':''}" data-group="emp" data-tab="report"
        onclick="switchTab('emp','report');EmpPage.loadReport()">Report</button>
      <button class="tab-line ${tab==='set-manager'?'active':''}" data-group="emp" data-tab="set-manager"
        onclick="switchTab('emp','set-manager');EmpPage.loadSetManager()">Set Manager</button>
      <button class="tab-line ${tab==='team-master'?'active':''}" data-group="emp" data-tab="team-master"
        onclick="switchTab('emp','team-master');EmpPage.loadTeamMaster()">Team Master</button>
      <button class="tab-line ${tab==='set-team-head'?'active':''}" data-group="emp" data-tab="set-team-head"
        onclick="switchTab('emp','set-team-head');EmpPage.loadSetTeamHead()">Set Team Head</button>
      <button class="tab-line ${tab==='team-head-detail'?'active':''}" data-group="emp" data-tab="team-head-detail"
        onclick="switchTab('emp','team-head-detail');EmpPage.loadTeamHeadDetail()">Team Head Detail</button>
      <button class="tab-line ${tab==='tree'?'active':''}" data-group="emp" data-tab="tree"
        onclick="switchTab('emp','tree');EmpPage.loadTree()">Org Tree</button>
    </div>

    <!-- DEPARTMENT TAB -->
    <div data-panel-group="emp" data-panel="department" ${tab!=='department'?'style="display:none"':''}>
      <div class="tbl-hdr" style="margin-bottom:12px">
        <div class="tbl-title">Departments</div>
        <button class="btn btn-teal btn-sm" onclick="EmpPage.showDeptModal()">+ New Department</button>
      </div>
      <div id="emp-dept-body"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>

    <!-- EMPLOYEE INFO TAB -->
    <div data-panel-group="emp" data-panel="info" ${tab!=='info'?'style="display:none"':''}>
      <div class="tbl-hdr" style="margin-bottom:12px">
        <div class="tbl-title">Employee Profiles</div>
        <div class="tbl-actions">
          <input class="fc" id="emp-search" placeholder="Search name / code…" style="width:200px"
            oninput="EmpPage.loadEmployeeInfo()">
          <select class="fc" id="emp-dept-filter" style="width:180px" onchange="EmpPage.loadEmployeeInfo()">
            <option value="">— All Departments —</option>
          </select>
          <button class="btn btn-teal btn-sm" onclick="EmpPage.showEmpModal()">+ New Profile</button>
        </div>
      </div>
      <div id="emp-info-body"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>

    <!-- REPORT TAB -->
    <div data-panel-group="emp" data-panel="report" ${tab!=='report'?'style="display:none"':''}>
      <div class="tbl-hdr" style="margin-bottom:12px">
        <div class="tbl-title">Employee Report by Department</div>
        <button class="btn btn-fetch btn-sm" onclick="EmpPage.loadReport()">Refresh</button>
      </div>
      <div id="emp-report-body"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>

    <!-- SET MANAGER TAB -->
    <div data-panel-group="emp" data-panel="set-manager" ${tab!=='set-manager'?'style="display:none"':''}>
      <div id="emp-manager-body"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>

    <!-- TEAM MASTER TAB -->
    <div data-panel-group="emp" data-panel="team-master" ${tab!=='team-master'?'style="display:none"':''}>
      <div class="tbl-hdr" style="margin-bottom:12px">
        <div class="tbl-title">Teams</div>
        <button class="btn btn-teal btn-sm" onclick="EmpPage.showTeamModal()">+ New Team</button>
      </div>
      <div id="emp-teams-body"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>

    <!-- SET TEAM HEAD TAB -->
    <div data-panel-group="emp" data-panel="set-team-head" ${tab!=='set-team-head'?'style="display:none"':''}>
      <div id="emp-teamhead-body"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>

    <!-- TEAM HEAD DETAIL TAB -->
    <div data-panel-group="emp" data-panel="team-head-detail" ${tab!=='team-head-detail'?'style="display:none"':''}>
      <div id="emp-thdetail-body"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>

    <!-- ORG TREE TAB -->
    <div data-panel-group="emp" data-panel="tree" ${tab!=='tree'?'style="display:none"':''}>
      <div id="emp-tree-body"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>

    <!-- ─── DEPARTMENT MODAL ─────────────────────── -->
    <div class="overlay" id="dept-overlay" onclick="closeOverlay('dept-overlay')"></div>
    <div class="modal" id="dept-modal" style="display:none;max-width:500px">
      <div class="modal-hdr">
        <div class="modal-title" id="dept-modal-title">Department</div>
        <button class="modal-close" onclick="closeOverlay('dept-overlay');document.getElementById('dept-modal').style.display='none'">✕</button>
      </div>
      <div class="modal-body">
        <input type="hidden" id="dept-form-id">
        <div class="fg"><label class="fl">Name *</label>
          <input class="fc" id="dept-form-name" placeholder="e.g. Sales">
        </div>
        <div class="fg"><label class="fl">Description</label>
          <textarea class="fc" id="dept-form-desc" rows="2"></textarea>
        </div>
        <div class="fg"><label class="fl">Department Head</label>
          <select class="fc" id="dept-form-head"><option value="">— None —</option></select>
        </div>
        <div class="fg" style="display:flex;align-items:center;gap:8px">
          <input type="checkbox" id="dept-form-active" checked>
          <label class="fl" style="margin:0">Active</label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-teal" onclick="EmpPage.saveDept()">Save</button>
        <button class="btn btn-outline" onclick="closeOverlay('dept-overlay');document.getElementById('dept-modal').style.display='none'">Cancel</button>
      </div>
    </div>

    <!-- ─── EMPLOYEE PROFILE MODAL ───────────────── -->
    <div class="overlay" id="emp-overlay" onclick="closeOverlay('emp-overlay')"></div>
    <div class="modal" id="emp-modal" style="display:none;max-width:640px">
      <div class="modal-hdr">
        <div class="modal-title" id="emp-modal-title">Employee Profile</div>
        <button class="modal-close" onclick="closeOverlay('emp-overlay');document.getElementById('emp-modal').style.display='none'">✕</button>
      </div>
      <div class="modal-body">
        <form id="emp-info-form">
          <div class="sp-grid">
            <div class="fg"><label class="fl">User *</label>
              <select class="fc" id="emp-form-userid"><option value="">— Select User —</option></select>
            </div>
            <div class="fg"><label class="fl">Employee Code</label>
              <input class="fc" id="emp-form-code" placeholder="e.g. ROF-001">
            </div>
            <div class="fg"><label class="fl">Designation</label>
              <input class="fc" id="emp-form-desig" placeholder="e.g. Sales Manager">
            </div>
            <div class="fg"><label class="fl">Department</label>
              <select class="fc" id="emp-form-dept"><option value="">— None —</option></select>
            </div>
            <div class="fg"><label class="fl">Manager</label>
              <select class="fc" id="emp-form-manager"><option value="">— None —</option></select>
            </div>
            <div class="fg"><label class="fl">Joining Date</label>
              <input type="date" class="fc" id="emp-form-joining">
            </div>
            <div class="fg"><label class="fl">Salary Grade</label>
              <input class="fc" id="emp-form-grade" placeholder="e.g. L3">
            </div>
            <div class="fg"><label class="fl">Office Mobile</label>
              <input class="fc" id="emp-form-mob-office" placeholder="+91-XXXXXXXXXX">
            </div>
            <div class="fg"><label class="fl">Personal Mobile</label>
              <input class="fc" id="emp-form-mob-personal" placeholder="+91-XXXXXXXXXX">
            </div>
            <div class="fg"><label class="fl">Emergency Contact</label>
              <input class="fc" id="emp-form-emergency" placeholder="+91-XXXXXXXXXX">
            </div>
            <div class="fg" style="grid-column:1/-1"><label class="fl">Address</label>
              <textarea class="fc" id="emp-form-address" rows="2"></textarea>
            </div>
            <div class="fg"><label class="fl">City</label>
              <input class="fc" id="emp-form-city">
            </div>
            <div class="fg"><label class="fl">State</label>
              <input class="fc" id="emp-form-state">
            </div>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-teal" onclick="EmpPage.saveEmpProfile()">Save Profile</button>
        <button class="btn btn-outline" onclick="closeOverlay('emp-overlay');document.getElementById('emp-modal').style.display='none'">Cancel</button>
      </div>
    </div>

    <!-- ─── TEAM MODAL ───────────────────────────── -->
    <div class="overlay" id="team-overlay" onclick="closeOverlay('team-overlay')"></div>
    <div class="modal" id="team-modal" style="display:none;max-width:500px">
      <div class="modal-hdr">
        <div class="modal-title" id="team-modal-title">Team</div>
        <button class="modal-close" onclick="closeOverlay('team-overlay');document.getElementById('team-modal').style.display='none'">✕</button>
      </div>
      <div class="modal-body">
        <input type="hidden" id="team-form-id">
        <div class="fg"><label class="fl">Team Name *</label>
          <input class="fc" id="team-form-name" placeholder="e.g. North Sales Team">
        </div>
        <div class="fg"><label class="fl">Description</label>
          <textarea class="fc" id="team-form-desc" rows="2"></textarea>
        </div>
        <div class="fg"><label class="fl">Department</label>
          <select class="fc" id="team-form-dept"><option value="">— None —</option></select>
        </div>
        <div class="fg"><label class="fl">Team Head</label>
          <select class="fc" id="team-form-head"><option value="">— None —</option></select>
        </div>
        <div class="fg" style="display:flex;align-items:center;gap:8px">
          <input type="checkbox" id="team-form-active" checked>
          <label class="fl" style="margin:0">Active</label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-teal" onclick="EmpPage.saveTeam()">Save</button>
        <button class="btn btn-outline" onclick="closeOverlay('team-overlay');document.getElementById('team-modal').style.display='none'">Cancel</button>
      </div>
    </div>
  `;

  // Populate dept filter dropdown in Employee Info tab
  await EmpPage._fetchDepts();
  const deptFilter = document.getElementById('emp-dept-filter');
  if (deptFilter) {
    deptFilter.innerHTML = `<option value="">— All Departments —</option>` +
      EmpPage._depts.map(d => `<option value="${d.id}">${Utils.esc(d.name)}</option>`).join('');
  }

  // Load the active tab's data
  const loaders = {
    'department':    () => EmpPage.loadDepartments(),
    'info':          () => EmpPage.loadEmployeeInfo(),
    'report':        () => EmpPage.loadReport(),
    'set-manager':   () => EmpPage.loadSetManager(),
    'team-master':   () => EmpPage.loadTeamMaster(),
    'set-team-head': () => EmpPage.loadSetTeamHead(),
    'team-head-detail': () => EmpPage.loadTeamHeadDetail(),
    'tree':          () => EmpPage.loadTree(),
  };

  if (loaders[tab]) loaders[tab]();
};
