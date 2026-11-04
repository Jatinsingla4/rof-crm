// ROF CRM — Employees: departments, employees, teams, org chart, report.
// Uses the Set Master pieces (SM.search, SM.filter, SM.empty, SM.ask, SM.run, SM.openForm) and its stylesheet.
// Changing things needs super_admin; project_manager can look.

const EMPX = { screen: 'departments', d: {} };
const ex = (s) => Utils.esc(s);

EMPX.NAV = [
  { id: 'departments', label: 'Departments' },
  { id: 'employees', label: 'Employees' },
  { id: 'teams', label: 'Teams' },
  { id: 'tree', label: 'Org Chart' },
  { id: 'report', label: 'Report' },
];
// Older links used these tab names
EMPX.OLD = { department: 'departments', info: 'employees', 'set-manager': 'employees', 'team-master': 'teams', 'set-team-head': 'teams', 'team-head-detail': 'teams' };

Pages.employees = async function (params = {}) {
  const want = EMPX.OLD[params.tab] || params.tab;
  EMPX.screen = EMPX.NAV.some((n) => n.id === want) ? want : 'departments';
  EMPX.admin = Permissions.isSuperAdmin();
  const rail = EMPX.NAV.map((n) => `<button class="sm-rail-item${n.id === EMPX.screen ? ' on' : ''}" onclick="Router.navigate('/employees',{tab:'${n.id}'})"><span>${ex(n.label)}</span></button>`).join('');
  document.getElementById('content').innerHTML = `
    <div class="sm-head"><h1>Employees</h1><p>Departments, who works where, who reports to whom, and the teams.</p></div>
    <div class="sm"><nav class="sm-rail" aria-label="Employees sections">${rail}</nav><section id="sm-main"><div class="sm-empty">Loading...</div></section></div>`;
  await EMPX.screens[EMPX.screen](document.getElementById('sm-main'));
};

EMPX.tag = (t, kind) => `<span class="sm-tag${kind ? ' sm-tag--' + kind : ''}">${ex(t)}</span>`;
EMPX.status = (on) => (on ? EMPX.tag('Active', 'ok') : EMPX.tag('Inactive', 'warn'));
EMPX.fail = (el, e) => {
  el.innerHTML = /403|permission|Forbidden|Only super_admin|no usable role/i.test(e.message) ? SM.empty('No access', 'Your role cannot open this screen. Ask a super admin.') : SM.empty('Could not load', e.message);
};
EMPX.get = async (path) => (await Api.get(path)).data || [];
// Logins that can be chosen as head, manager or member
EMPX.people = async () => (await EMPX.get('/users/directory'));
EMPX.opts = (list) => list.map((p) => ({ value: p.id, label: p.name }));
EMPX.refresh = () => Pages.employees({ tab: EMPX.screen });

EMPX.screens = {};

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------
EMPX.screens.departments = async (el) => {
  let list;
  try { list = await EMPX.get('/employees/departments'); } catch (e) { return EMPX.fail(el, e); }
  EMPX.d.departments = list;
  el.innerHTML = `<div class="sm-panel">
    <div class="sm-panel-h"><div><div class="sm-panel-t">Departments</div><div class="sm-panel-s">${SM.plural(list.length, 'department')}.</div></div>
      <div class="sm-tools">${SM.search('dept', 'Search departments')}${EMPX.admin ? '<button class="sm-btn sm-btn--primary" data-act="new">New department</button>' : ''}</div></div>
    ${list.length ? `<div class="sm-scroll" style="max-height:none"><table class="sm-tbl"><thead><tr><th>Department</th><th>Head</th><th class="num">Employees</th><th class="num">Teams</th><th>Status</th><th></th></tr></thead><tbody>
      ${list.map((d) => `<tr data-row><td><b>${ex(d.name)}</b>${d.description ? `<div class="sm-muted" style="font-size:12px">${ex(d.description)}</div>` : ''}</td>
        <td>${ex(d.head_name || '—')}</td><td class="num">${d.employee_count}</td><td class="num">${d.team_count}</td><td>${EMPX.status(d.is_active)}</td>
        <td class="act">${EMPX.admin ? `<button class="sm-btn sm-btn--quiet" data-act="edit" data-id="${ex(d.id)}">Edit</button>
          <button class="sm-btn sm-btn--quiet sm-btn--danger" data-act="del" data-id="${ex(d.id)}">Delete</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : SM.empty('No departments yet', 'Add the first department, for example Sales or Accounts.')}</div>`;
  el.querySelector('.sm-search').oninput = (e) => SM.filter(e.target);
  el.onclick = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const d = list.find((x) => x.id === b.dataset.id);
    if (b.dataset.act === 'new') EMPX.deptForm(null);
    if (b.dataset.act === 'edit') EMPX.deptForm(d);
    if (b.dataset.act === 'del') EMPX.deptDelete(d);
  };
};

EMPX.deptForm = async (d) => {
  const people = await EMPX.people();
  SM.openForm({
    title: d ? 'Edit department' : 'New department', submit: d ? 'Save changes' : 'Add department',
    values: d ? { ...d, head_user_id: d.head_user_id || '', is_active: d.is_active ? 'yes' : 'no' } : { is_active: 'yes' },
    fields: [
      { key: 'name', label: 'Department name', required: true, maxlength: 150, placeholder: 'Sales' },
      { key: 'description', label: 'Description', type: 'textarea', maxlength: 500 },
      { key: 'head_user_id', label: 'Head', type: 'select', options: EMPX.opts(people), hint: 'Leave blank for none.' },
      ...(d ? [{ key: 'is_active', label: 'Status', type: 'select', required: true, options: [{ value: 'yes', label: 'Active' }, { value: 'no', label: 'Inactive' }] }] : []),
    ],
    onSubmit: async (v) => {
      const body = { name: v.name, description: v.description || null, head_user_id: v.head_user_id || null };
      if (d) { body.is_active = v.is_active === 'yes'; await Api.patch(`/employees/departments/${d.id}`, body); } else await Api.post('/employees/departments', body);
      Utils.success(d ? 'Saved' : 'Department added');
      EMPX.refresh();
    },
  });
};

EMPX.deptDelete = async (d) => {
  if (await SM.ask({ title: `Delete ${d.name}?`, text: 'A department that employees or teams use cannot be deleted; mark it inactive instead. The change is recorded in the audit log.' })
    && await SM.run(() => Api.delete(`/employees/departments/${d.id}`), 'Deleted')) EMPX.refresh();
};

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------
EMPX.screens.employees = async (el) => {
  let list, depts;
  try { [list, depts] = await Promise.all([EMPX.get('/employees'), EMPX.get('/employees/departments')]); } catch (e) { return EMPX.fail(el, e); }
  EMPX.d.employees = list; EMPX.d.departments = depts;
  el.innerHTML = `<div class="sm-panel">
    <div class="sm-panel-h"><div><div class="sm-panel-t">Employees</div><div class="sm-panel-s">${SM.plural(list.length, 'employee')}. The manager column sets who reports to whom.</div></div>
      <div class="sm-tools">
        <select class="sm-input" id="ef-dept" style="width:auto" aria-label="Department"><option value="">All departments</option>${depts.map((d) => `<option value="${ex(d.id)}">${ex(d.name)}</option>`).join('')}</select>
        <select class="sm-input" id="ef-status" style="width:auto" aria-label="Status"><option value="">Any status</option><option value="1">Active</option><option value="0">Inactive</option></select>
        ${SM.search('emp', 'Search name, code or designation')}
        ${EMPX.admin ? '<button class="sm-btn sm-btn--primary" data-act="new">New employee</button>' : ''}</div></div>
    ${list.length ? `<div class="sm-scroll" style="max-height:none"><table class="sm-tbl"><thead><tr><th>Code</th><th>Name</th><th>Department</th><th>Designation</th><th>Manager</th><th>Mobile</th><th>Joined</th><th>Status</th><th></th></tr></thead><tbody>
      ${list.map((e) => `<tr data-row data-dept="${ex(e.department_id || '')}" data-active="${e.is_active ? 1 : 0}">
        <td class="sm-mono">${ex(e.employee_code || '—')}</td><td><b>${ex(e.name)}</b><div class="sm-muted" style="font-size:12px">${ex(e.email)}</div></td>
        <td>${ex(e.department_name || '—')}</td><td>${ex(e.designation || '—')}</td><td>${ex(e.manager_name || '—')}</td>
        <td>${ex(e.mobile_office || '—')}</td><td class="sm-muted">${e.joining_date ? ex(Utils.date(e.joining_date)) : '—'}</td><td>${EMPX.status(e.is_active)}</td>
        <td class="act">${EMPX.admin ? `<button class="sm-btn sm-btn--quiet" data-act="edit" data-id="${ex(e.id)}">Edit</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : SM.empty('No employees yet', EMPX.admin ? 'Add an employee profile for a login.' : '')}</div>`;
  const filter = () => {
    const q = el.querySelector('.sm-search').value.trim().toLowerCase(), dp = el.querySelector('#ef-dept').value, st = el.querySelector('#ef-status').value;
    el.querySelectorAll('tr[data-row]').forEach((r) => { r.style.display = (!q || r.textContent.toLowerCase().includes(q)) && (!dp || r.dataset.dept === dp) && (!st || r.dataset.active === st) ? '' : 'none'; });
  };
  el.querySelector('.sm-search').oninput = filter;
  el.querySelector('#ef-dept').onchange = filter; el.querySelector('#ef-status').onchange = filter;
  el.onclick = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'new') EMPX.empForm(null);
    if (b.dataset.act === 'edit') EMPX.empForm(list.find((x) => x.id === b.dataset.id));
  };
};

EMPX.empForm = async (e) => {
  const [people, depts, all] = await Promise.all([EMPX.people(), EMPX.get('/employees/departments'), EMPX.get('/employees')]);
  const have = new Set(all.map((x) => x.user_id));
  const candidates = people.filter((p) => !have.has(p.id));
  const managers = people.filter((p) => !e || p.id !== e.user_id);
  const f = (key, label, extra = {}) => ({ key, label, ...extra });
  SM.openForm({
    title: e ? `Edit ${e.name}` : 'New employee', submit: e ? 'Save changes' : 'Add employee',
    values: e ? { ...e, joining_date: e.joining_date ? String(e.joining_date).slice(0, 10) : '', department_id: e.department_id || '', manager_id: e.manager_id || '', is_active: e.is_active ? 'yes' : 'no' } : {},
    fields: [
      ...(e ? [] : [f('user_id', 'Login', { type: 'select', required: true, options: EMPX.opts(candidates), hint: candidates.length ? 'A person must have a login first (Security, Logins and Permissions).' : 'Every login already has a profile. Create a login first (Security).' })]),
      f('employee_code', 'Employee code', { maxlength: 50, placeholder: 'EMP-001', hint: 'Unique.' }),
      f('designation', 'Designation', { maxlength: 150 }),
      f('department_id', 'Department', { type: 'select', options: EMPX.opts(depts.filter((d) => d.is_active || (e && d.id === e.department_id))) }),
      f('manager_id', 'Manager (reports to)', { type: 'select', options: EMPX.opts(managers), hint: 'Cannot be the person themselves or someone who reports to them.' }),
      f('joining_date', 'Joining date', { type: 'date' }),
      f('mobile_office', 'Office mobile', { maxlength: 20 }),
      f('mobile_personal', 'Personal mobile', { maxlength: 20 }),
      f('emergency_contact', 'Emergency contact', { maxlength: 20 }),
      f('salary_grade', 'Salary grade', { maxlength: 50 }),
      f('address', 'Address', { type: 'textarea', maxlength: 500 }),
      f('city', 'City', { maxlength: 100 }),
      f('state', 'State', { maxlength: 100 }),
      ...(e ? [f('is_active', 'Status', { type: 'select', required: true, options: [{ value: 'yes', label: 'Active' }, { value: 'no', label: 'Inactive' }], hint: 'Inactive also switches off this person\'s login and signs them out.' })] : []),
    ],
    onSubmit: async (v) => {
      const body = {};
      ['employee_code', 'designation', 'department_id', 'manager_id', 'joining_date', 'mobile_office', 'mobile_personal', 'emergency_contact', 'salary_grade', 'address', 'city', 'state'].forEach((k) => { body[k] = v[k] || null; });
      if (e) { body.is_active = v.is_active === 'yes'; await Api.patch(`/employees/${e.id}`, body); } else { body.user_id = v.user_id; await Api.post('/employees', body); }
      Utils.success(e ? 'Saved' : 'Employee added');
      EMPX.refresh();
    },
  });
};

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------
EMPX.screens.teams = async (el) => {
  let list;
  try { list = await EMPX.get('/employees/teams'); } catch (e) { return EMPX.fail(el, e); }
  EMPX.d.teams = list;
  el.innerHTML = `<div class="sm-panel">
    <div class="sm-panel-h"><div><div class="sm-panel-t">Teams</div><div class="sm-panel-s">${SM.plural(list.length, 'team')}. The head is always a member.</div></div>
      <div class="sm-tools">${SM.search('team', 'Search teams')}${EMPX.admin ? '<button class="sm-btn sm-btn--primary" data-act="new">New team</button>' : ''}</div></div>
    ${list.length ? `<div class="sm-scroll" style="max-height:none"><table class="sm-tbl"><thead><tr><th>Team</th><th>Department</th><th>Head</th><th class="num">Members</th><th>Status</th><th></th></tr></thead><tbody>
      ${list.map((t) => `<tr data-row><td><b>${ex(t.name)}</b>${t.description ? `<div class="sm-muted" style="font-size:12px">${ex(t.description)}</div>` : ''}</td>
        <td>${ex(t.department_name || '—')}</td><td>${ex(t.team_head_name || '—')}</td><td class="num">${t.member_count}</td><td>${EMPX.status(t.is_active)}</td>
        <td class="act"><button class="sm-btn sm-btn--quiet" data-act="members" data-id="${ex(t.id)}">Members</button>
          ${EMPX.admin ? `<button class="sm-btn sm-btn--quiet" data-act="edit" data-id="${ex(t.id)}">Edit</button>
          <button class="sm-btn sm-btn--quiet sm-btn--danger" data-act="del" data-id="${ex(t.id)}">Delete</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : SM.empty('No teams yet', 'Add a team and put people in it.')}</div>`;
  el.querySelector('.sm-search').oninput = (e) => SM.filter(e.target);
  el.onclick = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const t = list.find((x) => x.id === b.dataset.id);
    if (b.dataset.act === 'new') EMPX.teamForm(null);
    if (b.dataset.act === 'edit') EMPX.teamForm(t);
    if (b.dataset.act === 'members') EMPX.members(t);
    if (b.dataset.act === 'del') EMPX.teamDelete(t);
  };
};

EMPX.teamForm = async (t) => {
  const [people, depts] = await Promise.all([EMPX.people(), EMPX.get('/employees/departments')]);
  SM.openForm({
    title: t ? 'Edit team' : 'New team', submit: t ? 'Save changes' : 'Add team',
    values: t ? { ...t, department_id: t.department_id || '', team_head_id: t.team_head_id || '', is_active: t.is_active ? 'yes' : 'no' } : { is_active: 'yes' },
    fields: [
      { key: 'name', label: 'Team name', required: true, maxlength: 150, hint: 'Unique inside a department.' },
      { key: 'department_id', label: 'Department', type: 'select', options: EMPX.opts(depts) },
      { key: 'team_head_id', label: 'Team head', type: 'select', options: EMPX.opts(people), hint: 'The head is added to the team as a member.' },
      { key: 'description', label: 'Description', type: 'textarea', maxlength: 500 },
      ...(t ? [{ key: 'is_active', label: 'Status', type: 'select', required: true, options: [{ value: 'yes', label: 'Active' }, { value: 'no', label: 'Inactive' }] }] : []),
    ],
    onSubmit: async (v) => {
      const body = { name: v.name, department_id: v.department_id || null, team_head_id: v.team_head_id || null, description: v.description || null };
      if (t) { body.is_active = v.is_active === 'yes'; await Api.patch(`/employees/teams/${t.id}`, body); } else await Api.post('/employees/teams', body);
      Utils.success(t ? 'Saved' : 'Team added');
      EMPX.refresh();
    },
  });
};

EMPX.teamDelete = async (t) => {
  if (await SM.ask({ title: `Delete ${t.name}?`, text: `${SM.plural(t.member_count, 'member')} will be removed from it. The people stay. The change is recorded in the audit log.` })
    && await SM.run(() => Api.delete(`/employees/teams/${t.id}`), 'Deleted')) EMPX.refresh();
};

// Members: list, add, remove, make head (a drawer that stays open while you work)
EMPX.members = async (t) => {
  const draw = async () => {
    const [rows, people, teams] = await Promise.all([EMPX.get(`/employees/teams/${t.id}/members`), EMPX.people(), EMPX.get('/employees/teams')]);
    const now = teams.find((x) => x.id === t.id) || t;
    const inTeam = new Set(rows.map((m) => m.user_id));
    const body = `
      <div class="sm-hint" style="margin-bottom:10px">${ex(now.department_name || 'No department')} · head: ${ex(now.team_head_name || 'none')}</div>
      ${rows.length ? `<table class="sm-tbl"><tbody>${rows.map((m) => `<tr><td><b>${ex(m.name)}</b><div class="sm-muted" style="font-size:12px">${ex(m.designation || m.email)}</div></td>
        <td>${m.role_in_team === 'head' ? EMPX.tag('Head', 'info') : '<span class="sm-muted">' + ex(m.role_in_team || 'member') + '</span>'}</td>
        <td class="act">${EMPX.admin ? `${m.role_in_team === 'head' ? '' : `<button class="sm-btn sm-btn--quiet" type="button" style="opacity:1" data-head="${ex(m.user_id)}">Make head</button>`}
          <button class="sm-btn sm-btn--quiet sm-btn--danger" type="button" style="opacity:1" data-rm="${ex(m.user_id)}">Remove</button>` : ''}</td></tr>`).join('')}</tbody></table>` : SM.empty('No members yet', '')}
      ${EMPX.admin ? `<div class="sm-addrow two" style="margin-top:12px"><select class="sm-input" id="mb-user" aria-label="Person"><option value="">Add a person</option>${people.filter((p) => !inTeam.has(p.id)).map((p) => `<option value="${ex(p.id)}">${ex(p.name)}</option>`).join('')}</select>
        <input class="sm-input" id="mb-role" maxlength="100" placeholder="Role in team (optional)" aria-label="Role in team"><button class="sm-btn" type="button" id="mb-add">Add</button></div>` : ''}`;
    const host = document.querySelector('#sec-drawer-host .sm-drawer-b');
    if (!host) return;
    const c = host.querySelector('#mb-content');
    c.innerHTML = body;
    c.onclick = async (e) => {
      const rm = e.target.closest('[data-rm]'), hd = e.target.closest('[data-head]');
      if (rm && await SM.run(() => Api.delete(`/employees/teams/${t.id}/members/${rm.dataset.rm}`), 'Removed')) draw();
      if (hd && await SM.run(() => Api.patch(`/employees/teams/${t.id}/set-head`, { team_head_id: hd.dataset.head }), 'Head set')) draw();
    };
    c.querySelector('#mb-add')?.addEventListener('click', async () => {
      const u = c.querySelector('#mb-user').value;
      if (!u) { Utils.error('Choose a person'); return; }
      if (await SM.run(() => Api.post(`/employees/teams/${t.id}/members`, { user_id: u, role_in_team: c.querySelector('#mb-role').value.trim() || undefined }), 'Added')) draw();
    });
  };
  SEC.openDrawer({ title: `${t.name}: members`, body: '<div id="mb-content"><div class="sm-empty">Loading...</div></div>', submit: null, onSubmit: async () => {} });
  draw();
};

// ---------------------------------------------------------------------------
// Org chart and report
// ---------------------------------------------------------------------------
EMPX.screens.tree = async (el) => {
  let roots;
  try { roots = await EMPX.get('/employees/tree'); } catch (e) { return EMPX.fail(el, e); }
  const draw = (nodes) => `<ul class="org-ul">${nodes.map((n) => `<li class="org-li"><div class="org-node"><div class="org-name">${ex(n.name)}</div>
    <div class="org-sub">${ex(n.designation || n.email || '')}</div>${n.department_name ? `<span class="chip ch-blue" style="font-size:10px">${ex(n.department_name)}</span>` : ''}</div>
    ${n.children?.length ? draw(n.children) : ''}</li>`).join('')}</ul>`;
  el.innerHTML = `<div class="sm-panel"><div class="sm-panel-h"><div><div class="sm-panel-t">Org chart</div><div class="sm-panel-s">Who reports to whom. Someone with no manager, or whose manager is no longer active, is at the top.</div></div></div>
    <div class="sm-panel-b">${roots.length ? `<div class="org-tree">${draw(roots)}</div>` : SM.empty('No active employees', 'Add employees first.')}</div></div>`;
};

EMPX.screens.report = async (el) => {
  let rows;
  try { rows = await EMPX.get('/employees/report'); } catch (e) { return EMPX.fail(el, e); }
  const sum = (k) => rows.reduce((a, r) => a + Number(r[k] || 0), 0);
  el.innerHTML = `<div class="sm-panel"><div class="sm-panel-h"><div><div class="sm-panel-t">Report</div><div class="sm-panel-s">People in each department.</div></div></div>
    <div class="sm-panel-b" style="display:flex;gap:28px;flex-wrap:wrap"><div><div class="sm-muted">Employees</div><b style="font-size:22px">${sum('total')}</b></div>
      <div><div class="sm-muted">Active</div><b style="font-size:22px">${sum('active')}</b></div><div><div class="sm-muted">Inactive</div><b style="font-size:22px">${sum('inactive')}</b></div></div>
    ${rows.length ? `<table class="sm-tbl"><thead><tr><th>Department</th><th class="num">Total</th><th class="num">Active</th><th class="num">Inactive</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td><b>${ex(r.department)}</b></td><td class="num">${r.total}</td><td class="num">${r.active}</td><td class="num">${r.inactive}</td></tr>`).join('')}</tbody></table>` : SM.empty('No data', '')}</div>`;
};
