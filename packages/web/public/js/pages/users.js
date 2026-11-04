// ROF CRM — Security: logins and permissions, roles, role menu access, audit log.
// Reuses the Set Master pieces (SM.search, SM.filter, SM.empty, SM.ask, SM.run) and its stylesheet.

const SEC = { screen: 'permissions', form: null, ip: [] };
const sesc = (s) => Utils.esc(s);

SEC.NAV = [
  { id: 'permissions', label: 'Logins and Permissions' },
  { id: 'roles', label: 'Roles' },
  { id: 'role-menu', label: 'Role Menu Access' },
  { id: 'audit', label: 'Audit Log' },
];

// What each base role allows on the API, in words (see packages/api/src/middleware/rbac.ts)
SEC.BASE = {
  project_manager: 'View, add and edit nearly everything. Cannot delete. Can view users.',
  sales_executive: 'Add and edit applicants. View bookings, payments and reports.',
  accounts_finance: 'Receipts, payments, brokers and reports. View applicants.',
  support_agent: 'View applicants and units. Add communications.',
  read_only_viewer: 'View only: applicants, units, payments, documents, reports.',
};

Pages.users = async function (params = {}) {
  SEC.screen = SEC.NAV.some((n) => n.id === params.tab) ? params.tab : 'permissions';
  SEC.admin = Permissions.isSuperAdmin();
  const rail = SEC.NAV.map((n) => `<button class="sm-rail-item${n.id === SEC.screen ? ' on' : ''}" onclick="Router.navigate('/users',{tab:'${n.id}'})"><span>${sesc(n.label)}</span></button>`).join('');
  document.getElementById('content').innerHTML = `
    <div class="sm-head"><h1>Security</h1><p>Who can sign in, what they can do, and which screens they can open.</p></div>
    <div class="sm"><nav class="sm-rail" aria-label="Security sections">${rail}</nav><section id="sm-main"><div class="sm-empty">Loading...</div></section></div>`;
  SEC.closeDrawer();
  await SEC.screens[SEC.screen](document.getElementById('sm-main'));
  if (params.new && SEC.admin && SEC.screen === 'permissions') SEC.openLogin();
};

SEC.denied = (el, e) => {
  el.innerHTML = /403|permission|Forbidden/i.test(e.message)
    ? SM.empty('No access', 'Your role cannot open this screen. Ask a super admin.')
    : SM.empty('Could not load', e.message);
};

SEC.tag = (text, kind) => `<span class="sm-tag${kind ? ' sm-tag--' + kind : ''}">${sesc(text)}</span>`;
SEC.when = (v) => (v ? Utils.dateTime(v) : '');

// ---------------------------------------------------------------------------
// Drawer (same look as the Set Master drawer, wider, with free content)
// ---------------------------------------------------------------------------
SEC.openDrawer = ({ title, body, submit, onSubmit }) => {
  SEC.closeDrawer();
  SEC._back = document.activeElement;
  const host = document.createElement('div');
  host.id = 'sec-drawer-host';
  host.innerHTML = `<div class="sm-veil" data-close></div>
    <aside class="sm-drawer sec-wide" role="dialog" aria-modal="true" aria-label="${sesc(title)}">
      <div class="sm-drawer-h"><h2>${sesc(title)}</h2><button class="sm-btn sm-btn--quiet" type="button" data-close>Close</button></div>
      <form id="sec-form" novalidate style="display:flex;flex-direction:column;flex:1;min-height:0">
        <div class="sm-drawer-b">${body}<div class="sm-err" id="sec-form-err" role="alert"></div></div>
        <div class="sm-drawer-f"><button class="sm-btn" type="button" data-close>Cancel</button>${submit ? `<button class="sm-btn sm-btn--primary" type="submit">${sesc(submit)}</button>` : ''}</div>
      </form></aside>`;
  document.body.appendChild(host);
  host.querySelectorAll('[data-close]').forEach((b) => { b.onclick = SEC.closeDrawer; });
  SEC._onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.sm-dialog')) SEC.closeDrawer(); };
  document.addEventListener('keydown', SEC._onKey);
  const form = host.querySelector('#sec-form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const err = host.querySelector('#sec-form-err');
    const btn = form.querySelector('[type=submit]');
    err.textContent = '';
    if (btn) btn.disabled = true;
    try { await onSubmit(form); SEC.closeDrawer(); }
    catch (ex) { err.textContent = ex.message; if (btn) btn.disabled = false; err.scrollIntoView({ block: 'nearest' }); }
  };
  form.querySelector('input:not([disabled]), select:not([disabled]), textarea')?.focus();
  return form;
};

SEC.closeDrawer = () => {
  document.getElementById('sec-drawer-host')?.remove();
  if (SEC._onKey) { document.removeEventListener('keydown', SEC._onKey); SEC._onKey = null; }
  if (SEC._back && SEC._back.focus && document.contains(SEC._back)) SEC._back.focus();
  SEC._back = null;
};

SEC.field = (id, label, control, hint) =>
  `<div class="sm-field"><label class="sm-label" for="${id}">${label}</label>${control}${hint ? `<div class="sm-hint">${sesc(hint)}</div>` : ''}</div>`;

SEC.checks = (name, items, picked = []) => items.map((i) =>
  `<label class="sec-check"><input type="checkbox" name="${name}" value="${sesc(i.id)}"${picked.includes(i.id) ? ' checked' : ''}> ${sesc(i.label)}</label>`).join('');

// ---------------------------------------------------------------------------
// Logins and Permissions
// ---------------------------------------------------------------------------
SEC.screens = {};

SEC.screens.permissions = async (el) => {
  try {
    const res = await Api.get('/users/employee-login');
    SEC.users = res.data || [];
    if (!SEC.meta) SEC.meta = (await Api.get('/users/employee-login/form-data')).data;
  } catch (e) { return SEC.denied(el, e); }
  const roles = SEC.meta.roles;
  el.innerHTML = `
    <div class="sm-panel">
      <div class="sm-panel-h">
        <div><div class="sm-panel-t">Logins and Permissions</div><div class="sm-panel-s">${SM.plural(SEC.users.length, 'login')}. Maker and checker rights decide who can enter and who can approve.</div></div>
        <div class="sm-tools">
          ${SM.search('sec-users', 'Search name, user or email')}
          <select class="sm-input" id="sec-f-role" style="width:auto" aria-label="Filter by role" onchange="SEC.filterUsers()"><option value="">All roles</option>${roles.map((r) => `<option value="${sesc(r.value)}">${sesc(r.label)}</option>`).join('')}</select>
          <select class="sm-input" id="sec-f-status" style="width:auto" aria-label="Filter by status" onchange="SEC.filterUsers()"><option value="">Any status</option><option value="1">Active</option><option value="0">Inactive</option></select>
          ${SEC.admin ? '<button class="sm-btn sm-btn--primary" onclick="SEC.openLogin()">New login</button>' : ''}
        </div>
      </div>
      ${SEC.users.length ? `<div class="sm-scroll" style="max-height:none"><table class="sm-tbl">
        <thead><tr><th>Name</th><th>Role</th><th>Process rights</th><th>Projects</th><th>Last sign in</th><th>Status</th><th></th></tr></thead>
        <tbody>${SEC.users.map(SEC.userRow).join('')}</tbody></table></div>`
        : SM.empty('No logins yet', 'Create the first login for a team member.')}
    </div>`;
  const s = el.querySelector('.sm-search');
  s.oninput = () => SEC.filterUsers();
  el.onclick = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const u = SEC.users.find((x) => x.id === b.dataset.id);
    if (b.dataset.act === 'edit') SEC.openLogin(u);
    if (b.dataset.act === 'toggle') SEC.toggleActive(u);
  };
};

SEC.processText = (u) => {
  const names = Object.fromEntries((SEC.meta?.processes || []).map((p) => [p.name, p.label]));
  return (u.process_permissions || []).map((p) => `${names[p.process_name] || p.process_name} ${p.is_maker ? 'M' : ''}${p.is_checker ? 'C' : ''}`).join(', ');
};

SEC.userRow = (u) => `<tr data-row data-role="${sesc(u.role)}" data-active="${u.is_active ? 1 : 0}">
  <td><b>${sesc(u.name)}</b><div class="sm-muted" style="font-size:12px">${sesc(u.username || '')}${u.username ? ' · ' : ''}${sesc(u.email)}</div></td>
  <td>${sesc(u.role_label || u.role)}</td>
  <td class="sm-muted" style="max-width:260px">${sesc(SEC.processText(u)) || 'None'}</td>
  <td class="sm-muted" style="max-width:200px">${sesc(u.project_names) || 'All projects'}</td>
  <td class="sm-muted">${sesc(SEC.when(u.last_login_at)) || 'Never'}</td>
  <td>${u.is_active ? SEC.tag('Active', 'ok') : SEC.tag('Inactive', 'warn')}${u.ip_security_enabled ? ' ' + SEC.tag('IP locked', 'info') : ''}</td>
  <td class="act">${SEC.admin ? `<button class="sm-btn sm-btn--quiet" data-act="edit" data-id="${sesc(u.id)}">Edit</button>
    <button class="sm-btn sm-btn--quiet${u.is_active ? ' sm-btn--danger' : ''}" data-act="toggle" data-id="${sesc(u.id)}">${u.is_active ? 'Disable' : 'Enable'}</button>` : ''}</td></tr>`;

SEC.filterUsers = () => {
  const root = document.getElementById('sm-main');
  const q = root.querySelector('.sm-search').value.trim().toLowerCase();
  const role = document.getElementById('sec-f-role').value;
  const st = document.getElementById('sec-f-status').value;
  root.querySelectorAll('[data-row]').forEach((r) => {
    const ok = (!q || r.textContent.toLowerCase().includes(q)) && (!role || r.dataset.role === role) && (!st || r.dataset.active === st);
    r.style.display = ok ? '' : 'none';
  });
};

SEC.toggleActive = async (u) => {
  if (u.is_active && !(await SM.ask({ title: `Disable ${u.name}?`, text: 'They are signed out at once and cannot sign in until you enable the login again.', ok: 'Disable' }))) return;
  if (await SM.run(() => Api.patch(`/users/employee-login/${u.id}`, { isActive: !u.is_active }), u.is_active ? 'Login disabled' : 'Login enabled')) Pages.users({ tab: 'permissions' });
};

SEC.openLogin = (u) => {
  const m = SEC.meta;
  const edit = !!u;
  const have = Object.fromEntries((u?.process_permissions || []).map((p) => [p.process_name, p]));
  const picked = (u?.home_page_widgets && (Array.isArray(u.home_page_widgets) ? u.home_page_widgets : [])) || [];
  SEC.ip = [];
  const body = `
    <div class="sm-section"><h3 class="sec-h">Account</h3>
      <div class="sm-grid2">
        ${SEC.field('sf-name', edit ? 'Name <i>*</i>' : 'Name', `<input class="sm-input" id="sf-name" name="name" maxlength="255" value="${sesc(u?.name || '')}" ${edit ? '' : 'placeholder="Taken from the employee, or type it"'}>`)}
        ${SEC.field('sf-username', 'Username <i>*</i>', `<input class="sm-input" id="sf-username" name="username" maxlength="50" value="${sesc(u?.username || '')}" ${edit ? 'disabled' : ''} autocomplete="off">`, 'Letters, digits, dot, dash, underscore.')}
        ${SEC.field('sf-email', 'Email <i>*</i>', `<input class="sm-input" id="sf-email" name="email" maxlength="255" value="${sesc(u?.email || '')}" autocomplete="off">`, 'This is what the person types to sign in.')}
        ${SEC.field('sf-mobile', 'Mobile', `<input class="sm-input" id="sf-mobile" name="mobile" maxlength="20" value="${sesc(u?.mobile || '')}">`)}
      </div>
      ${SEC.field('sf-role', 'Role <i>*</i>', `<select class="sm-input" id="sf-role" name="role">${m.roles.map((r) => `<option value="${sesc(r.value)}"${(u?.role || 'sales_executive') === r.value ? ' selected' : ''}>${sesc(r.label)}</option>`).join('')}</select>`,
        edit ? 'Changing the role signs the person out; the menu is rebuilt when they sign in again.' : 'The role sets what the person can do. Which menu entries the person sees is set in Role Menu Access.')}
      ${edit && u?.id === (Auth.getUser() || {}).userId ? SEC.field('sf-pw0', 'Current password', '<input class="sm-input" type="password" id="sf-pw0" autocomplete="current-password" maxlength="72">', 'Needed only when you set a new password for your own login.') : ''}
      <div class="sm-grid2">
        ${SEC.field('sf-pw', edit ? 'New password' : 'Password <i>*</i>', `<input class="sm-input" type="password" id="sf-pw" name="password" autocomplete="new-password" maxlength="72">`, edit ? 'Leave empty to keep the password. Setting one signs the person out.' : '8 to 72 characters with a letter and a number.')}
        ${SEC.field('sf-pw2', edit ? 'Repeat new password' : 'Repeat password <i>*</i>', '<input class="sm-input" type="password" id="sf-pw2" autocomplete="new-password" maxlength="72">')}
      </div>
    </div>

    <div class="sm-section"><h3 class="sec-h">Process rights</h3>
      <div class="sm-hint" style="margin-bottom:8px">Maker enters the record. Checker approves it. A process a person has no right for is refused by the server.</div>
      <table class="sm-tbl sec-proc"><thead><tr><th>Process</th><th>Maker</th><th>Checker</th></tr></thead><tbody>
        ${m.processes.map((p) => `<tr><td>${sesc(p.label)}</td>
          <td>${p.has_maker ? `<input type="checkbox" name="mk" value="${p.name}" aria-label="${sesc(p.label)} maker"${have[p.name]?.is_maker ? ' checked' : ''}>` : '<span class="sm-muted">—</span>'}</td>
          <td>${p.has_checker ? `<input type="checkbox" name="ck" value="${p.name}" aria-label="${sesc(p.label)} checker"${have[p.name]?.is_checker ? ' checked' : ''}>` : '<span class="sm-muted">—</span>'}</td></tr>`).join('')}
      </tbody></table>
    </div>

    <div class="sm-section"><h3 class="sec-h">Access</h3>
      <div class="sm-grid2">
        ${SEC.field('sf-unit', 'Unit status the person sees', `<select class="sm-input" id="sf-unit" name="unitStatusAccess">${m.unitStatusOptions.map((o) => `<option value="${o}"${(u?.unit_status_access || 'all') === o ? ' selected' : ''}>${sesc(o.replace(/_/g, ' '))}</option>`).join('')}</select>`)}
        <div class="sm-field"><span class="sm-label">Print and download</span>
          <label class="sec-check"><input type="checkbox" name="print"${u?.authorized_print ? ' checked' : ''}> May print</label>
          <label class="sec-check"><input type="checkbox" name="download"${u?.authorized_download ? ' checked' : ''}> May download</label></div>
      </div>
      <div class="sm-field"><span class="sm-label">Projects</span><div class="sec-list">${SEC.checks('proj', m.projects.map((p) => ({ id: p.id, label: p.name })), u?.assigned_project_ids || []) || '<span class="sm-muted">No projects yet</span>'}</div>
        <div class="sm-hint">Leave empty for every project. With projects ticked, this login sees and changes only those projects: applicants, units, bookings, payments and reports.</div></div>
      <div class="sm-field"><span class="sm-label">Companies</span><div class="sec-list">${SEC.checks('comp', m.companies.map((c) => ({ id: c.id, label: c.name })), u?.company_ids || []) || '<span class="sm-muted">No companies yet</span>'}</div>
        <div class="sm-hint">Saved with the login. Data is not yet limited to these companies.</div></div>
      <div class="sm-field"><span class="sm-label">Home page widgets</span><div class="sec-list">${SEC.checks('wid', m.homePageWidgets.map((w) => ({ id: w.key, label: w.label })), picked)}</div></div>
    </div>

    ${edit ? `<div class="sm-section"><h3 class="sec-h">Sign in security</h3>
      <label class="sec-check"><input type="checkbox" name="ipOn"${u.ip_security_enabled ? ' checked' : ''}> Allow sign in only from the addresses below</label>
      <div class="sm-hint" style="margin:4px 0 8px">Needs at least one address. Applies to every request, not only the sign in.</div>
      <div id="sec-ips"></div>
      <div class="sm-addrow two" style="padding:8px 0;border:0;background:none"><input class="sm-input" id="sec-ip-new" placeholder="203.0.113.7" aria-label="IP address"><input class="sm-input" id="sec-ip-note" placeholder="Note, for example Sales office" aria-label="Note"><button class="sm-btn" type="button" onclick="SEC.addIp('${sesc(u.id)}')">Add</button></div>
      <button class="sm-btn sm-btn--danger" type="button" style="margin-top:8px" onclick="SEC.signOut('${sesc(u.id)}','${sesc(u.name)}')">Sign out of every device</button>
    </div>` : ''}`;

  const form = SEC.openDrawer({
    title: edit ? `Edit ${u.name}` : 'New login', body, submit: edit ? 'Save changes' : 'Create login',
    onSubmit: async (f) => {
      const all = (n) => [...f.querySelectorAll(`[name="${n}"]:checked`)].map((c) => c.value);
      const v = (n) => f.elements[n].value.trim();
      const pw = f.elements.password.value;
      if (pw !== f.querySelector('#sf-pw2').value) throw new Error('The two passwords do not match');
      const rights = m.processes.map((p) => ({ processName: p.name, isMaker: all('mk').includes(p.name), isChecker: all('ck').includes(p.name) }));
      const body = {
        role: v('role'), mobile: v('mobile'), email: v('email'), name: v('name') || undefined,
        unitStatusAccess: v('unitStatusAccess'), authorizedPrint: f.elements.print.checked, authorizedDownload: f.elements.download.checked,
        assignedProjectIds: all('proj'), companyIds: all('comp'), homePageWidgets: all('wid'), processPermissions: rights,
      };
      if (pw) body.password = pw;
      const cur = f.querySelector('#sf-pw0');
      if (pw && cur) body.currentPassword = cur.value;
      if (!edit) {
        Object.assign(body, { username: v('username'), confirmPassword: f.querySelector('#sf-pw2').value });
        if (!body.password) throw new Error('Enter a password');
        await Api.post('/users/employee-login', body);
      } else {
        if (!body.name) throw new Error('Name is required');
        body.ipSecurityEnabled = f.elements.ipOn.checked;
        await Api.patch(`/users/employee-login/${u.id}`, body);
      }
      Utils.success(edit ? 'Login updated' : 'Login created');
      Pages.users({ tab: 'permissions' });
    },
  });
  if (edit) SEC.loadIps(u.id);
  return form;
};

SEC.loadIps = async (id) => {
  const el = document.getElementById('sec-ips');
  if (!el) return;
  try { SEC.ip = (await Api.get(`/users/employee-login/${id}/ips`)).data || []; } catch (e) { el.textContent = e.message; return; }
  el.innerHTML = SEC.ip.length ? `<table class="sm-tbl"><tbody>${SEC.ip.map((r) => `<tr><td class="sm-mono">${sesc(r.ip_address)}</td><td class="sm-muted">${sesc(r.description || '')}</td>
    <td class="act"><button class="sm-btn sm-btn--quiet sm-btn--danger" type="button" style="opacity:1" onclick="SEC.removeIp('${sesc(id)}','${sesc(r.id)}')">Remove</button></td></tr>`).join('')}</tbody></table>`
    : '<div class="sm-muted" style="font-size:12.5px">No addresses yet.</div>';
};

SEC.addIp = async (id) => {
  const ip = document.getElementById('sec-ip-new');
  if (await SM.run(() => Api.post(`/users/employee-login/${id}/ips`, { ip_address: ip.value, description: document.getElementById('sec-ip-note').value }), 'Address added')) {
    ip.value = ''; document.getElementById('sec-ip-note').value = '';
    SEC.loadIps(id);
  }
};

SEC.removeIp = async (id, ipId) => {
  if (await SM.run(() => Api.delete(`/users/employee-login/${id}/ips/${ipId}`), 'Address removed')) SEC.loadIps(id);
};

SEC.signOut = async (id, name) => {
  if (!(await SM.ask({ title: `Sign ${name} out everywhere?`, text: 'Every open session of this person ends now. They can sign in again.', ok: 'Sign out', danger: true }))) return;
  await SM.run(() => Api.post(`/users/employee-login/${id}/sign-out`, {}), 'Signed out');
};

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------
SEC.screens.roles = async (el) => {
  let roles;
  try { roles = (await Api.get('/roles')).data || []; } catch (e) { return SEC.denied(el, e); }
  SEC.roles = roles;
  const label = (n) => roles.find((r) => r.name === n)?.label || n || '';
  el.innerHTML = `
    <div class="sm-panel">
      <div class="sm-panel-h">
        <div><div class="sm-panel-t">Roles</div><div class="sm-panel-s">A custom role is based on a system role, which decides what it may do. Menu visibility is set per role.</div></div>
        <div class="sm-tools">${SEC.admin ? '<button class="sm-btn sm-btn--primary" onclick="SEC.openRole()">New role</button>' : ''}</div>
      </div>
      <div class="sm-scroll" style="max-height:none"><table class="sm-tbl">
        <thead><tr><th>Role</th><th>Type</th><th>Based on</th><th class="num">Users</th><th class="num">Pages</th><th></th></tr></thead>
        <tbody>${roles.map((r) => `<tr>
          <td><b>${sesc(r.label)}</b><div class="sm-muted sm-mono">${sesc(r.name)}</div>${r.description ? `<div class="sm-muted" style="font-size:12px">${sesc(r.description)}</div>` : ''}</td>
          <td>${r.is_system ? SEC.tag('System', 'info') : SEC.tag('Custom')}</td>
          <td class="sm-muted">${r.is_system ? '—' : sesc(label(r.base_role))}</td>
          <td class="num">${r.user_count}</td>
          <td class="num">${r.name === 'super_admin' ? 'All' : r.page_count}</td>
          <td class="act"><button class="sm-btn sm-btn--quiet" data-act="pages" data-name="${sesc(r.name)}">Menu access</button>
            ${SEC.admin && !r.is_system ? `<button class="sm-btn sm-btn--quiet" data-act="edit" data-name="${sesc(r.name)}">Edit</button>
            <button class="sm-btn sm-btn--quiet sm-btn--danger" data-act="del" data-name="${sesc(r.name)}"${r.user_count ? ` disabled title="${r.user_count} user(s) still have this role"` : ''}>Delete</button>` : ''}</td></tr>`).join('')}</tbody></table></div>
    </div>`;
  el.onclick = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const r = roles.find((x) => x.name === b.dataset.name);
    if (b.dataset.act === 'pages') { SEC.pickRole = r.name; Router.navigate('/users', { tab: 'role-menu' }); }
    if (b.dataset.act === 'edit') SEC.openRole(r);
    if (b.dataset.act === 'del') SEC.deleteRole(r);
  };
};

SEC.openRole = (r) => {
  const edit = !!r;
  const bases = Object.keys(SEC.BASE);
  const body = `
    ${SEC.field('sr-name', edit ? 'Role name' : 'Role name <i>*</i>', `<input class="sm-input" id="sr-name" name="name" maxlength="50" value="${sesc(r?.name || '')}" ${edit ? 'disabled' : 'placeholder="collection_agent"'}>`, edit ? 'The name cannot change.' : '3 to 50 characters: lowercase letters, digits and underscores.')}
    ${SEC.field('sr-label', 'Label <i>*</i>', `<input class="sm-input" id="sr-label" name="label" maxlength="100" value="${sesc(r?.label || '')}" placeholder="Collection Agent">`)}
    ${SEC.field('sr-desc', 'Description', `<textarea class="sm-input" id="sr-desc" name="description" rows="2" maxlength="500">${sesc(r?.description || '')}</textarea>`)}
    ${SEC.field('sr-base', 'Based on <i>*</i>', `<select class="sm-input" id="sr-base" name="baseRole">${bases.map((b) => `<option value="${b}"${r?.base_role === b ? ' selected' : ''}>${sesc(SEC.roles.find((x) => x.name === b)?.label || b)}</option>`).join('')}</select>`)}
    <div class="sm-note" id="sr-base-note"></div>
    ${edit ? '' : SEC.field('sr-copy', 'Copy menu access from', `<select class="sm-input" id="sr-copy" name="copy"><option value="">Start with no pages</option>${SEC.roles.filter((x) => x.name !== 'super_admin').map((x) => `<option value="${sesc(x.name)}">${sesc(x.label)}</option>`).join('')}</select>`, 'You can change it later in Role Menu Access.')}`;
  const form = SEC.openDrawer({
    title: edit ? `Edit ${r.label}` : 'New role', body, submit: edit ? 'Save changes' : 'Create role',
    onSubmit: async (f) => {
      const v = (n) => f.elements[n].value.trim();
      if (!edit && !v('name')) throw new Error('Role name is required');
      if (!v('label')) throw new Error('Label is required');
      if (edit) await Api.patch(`/roles/${r.name}`, { label: v('label'), description: v('description'), baseRole: v('baseRole') });
      else {
        const pageIds = v('copy') ? (await Api.get(`/roles/${v('copy')}/pages`)).data.filter((p) => p.has_access).map((p) => p.id) : [];
        await Api.post('/roles', { name: v('name').toLowerCase(), label: v('label'), description: v('description'), baseRole: v('baseRole'), pageIds });
      }
      Utils.success(edit ? 'Role updated' : 'Role created');
      Pages.users({ tab: 'roles' });
    },
  });
  const note = () => { form.querySelector('#sr-base-note').textContent = SEC.BASE[form.elements.baseRole.value] || ''; };
  form.elements.baseRole.onchange = note;
  note();
};

SEC.deleteRole = async (r) => {
  if (!(await SM.ask({ title: `Delete ${r.label}?`, text: 'Its menu access is removed too. This cannot be undone.' }))) return;
  if (await SM.run(() => Api.delete(`/roles/${r.name}`), 'Role deleted')) Pages.users({ tab: 'roles' });
};

// ---------------------------------------------------------------------------
// Role Menu Access: one grid, pages down, roles across
// ---------------------------------------------------------------------------
SEC.screens['role-menu'] = async (el) => {
  let d;
  try { d = (await Api.get('/roles/matrix')).data; } catch (e) { return SEC.denied(el, e); }
  const roles = d.roles.filter((r) => r.name !== 'super_admin');
  const groups = {};
  d.pages.forEach((p) => (groups[p.category || 'Other'] ||= []).push(p));
  SEC.grid = { roles, original: {}, groups };
  roles.forEach((r) => { SEC.grid.original[r.name] = new Set(d.access[r.name] || []); });
  const cell = (role, p) => `<td class="sec-cell"><input type="checkbox" data-role="${sesc(role.name)}" data-page="${sesc(p.id)}" aria-label="${sesc(role.label)}: ${sesc(p.label)}"${SEC.grid.original[role.name].has(p.id) ? ' checked' : ''}${SEC.admin ? '' : ' disabled'}></td>`;
  el.innerHTML = `
    <div class="sm-panel">
      <div class="sm-panel-h">
        <div><div class="sm-panel-t">Role Menu Access</div><div class="sm-panel-s">This only shows or hides menu entries. It does not give or take away any permission: what a role may do comes from its base role. Super Admin always sees everything.</div></div>
        <div class="sm-tools">${SM.search('sec-pages', 'Search pages')}</div>
      </div>
      <div class="sm-scroll" style="max-height:none"><table class="sm-tbl sec-grid" id="sec-grid">
        <thead><tr><th>Page</th>${roles.map((r) => `<th class="sec-col${r.name === SEC.pickRole ? ' sec-pick' : ''}" title="${sesc(r.label)}"><div>${sesc(r.label)}</div>${SEC.admin ? `<button class="sm-btn sm-btn--quiet" type="button" data-all="${sesc(r.name)}">All</button><button class="sm-btn sm-btn--quiet" type="button" data-none="${sesc(r.name)}">None</button>` : ''}</th>`).join('')}</tr></thead>
        <tbody>${Object.entries(groups).map(([cat, pages]) => `
          <tr class="sec-cat" data-cat="${sesc(cat)}"><td><b>${sesc(cat)}</b> <span class="sm-muted">${pages.length}</span></td>${roles.map((r) => `<td class="sec-cell"><input type="checkbox" data-catbox="${sesc(cat)}" data-role="${sesc(r.name)}" aria-label="${sesc(r.label)}: all of ${sesc(cat)}"${SEC.admin ? '' : ' disabled'}></td>`).join('')}</tr>
          ${pages.map((p) => `<tr data-row data-cat="${sesc(cat)}"><td>${sesc(p.label)} <span class="sm-muted sm-mono">${sesc(p.route)}</span></td>${roles.map((r) => cell(r, p)).join('')}</tr>`).join('')}`).join('')}
        </tbody></table></div>
      ${SEC.admin ? `<div class="sm-savebar"><span id="sec-dirty" class="sm-muted">No changes</span><span><button class="sm-btn" id="sec-discard" disabled>Discard</button> <button class="sm-btn sm-btn--primary" id="sec-save" disabled>Save changes</button></span></div>` : ''}
    </div>`;
  const grid = el.querySelector('#sec-grid');
  const pageBoxes = (role, cat) => [...grid.querySelectorAll(`input[data-page][data-role="${CSS.escape(role)}"]`)].filter((c) => !cat || c.closest('tr').dataset.cat === cat);
  const refresh = () => {
    let changes = 0;
    const touched = new Set();
    roles.forEach((r) => {
      const now = new Set(pageBoxes(r.name).filter((c) => c.checked).map((c) => c.dataset.page));
      const was = SEC.grid.original[r.name];
      if (now.size !== was.size || [...now].some((x) => !was.has(x))) { touched.add(r.name); changes += [...now].filter((x) => !was.has(x)).length + [...was].filter((x) => !now.has(x)).length; }
    });
    SEC.grid.touched = touched;
    grid.querySelectorAll('input[data-catbox]').forEach((cb) => {
      const boxes = pageBoxes(cb.dataset.role, cb.dataset.catbox);
      const on = boxes.filter((b) => b.checked).length;
      cb.checked = on === boxes.length; cb.indeterminate = on > 0 && on < boxes.length;
    });
    const dirty = el.querySelector('#sec-dirty');
    if (dirty) {
      dirty.textContent = changes ? `${SM.plural(changes, 'change')} in ${SM.plural(touched.size, 'role')}` : 'No changes';
      el.querySelector('#sec-save').disabled = !changes; el.querySelector('#sec-discard').disabled = !changes;
    }
  };
  grid.onchange = (e) => {
    const c = e.target;
    if (c.dataset.catbox) pageBoxes(c.dataset.role, c.dataset.catbox).forEach((b) => { b.checked = c.checked; });
    refresh();
  };
  grid.onclick = (e) => {
    const b = e.target.closest('[data-all],[data-none]');
    if (!b) return;
    const role = b.dataset.all || b.dataset.none;
    pageBoxes(role).forEach((c) => { c.checked = !!b.dataset.all; });
    refresh();
  };
  const s = el.querySelector('.sm-search');
  s.oninput = () => {
    const q = s.value.trim().toLowerCase();
    grid.querySelectorAll('tr[data-row]').forEach((r) => { r.style.display = !q || r.textContent.toLowerCase().includes(q) ? '' : 'none'; });
    grid.querySelectorAll('tr.sec-cat').forEach((r) => { r.style.display = q ? 'none' : ''; });
  };
  el.querySelector('#sec-discard')?.addEventListener('click', () => Pages.users({ tab: 'role-menu' }));
  el.querySelector('#sec-save')?.addEventListener('click', async () => {
    const btn = el.querySelector('#sec-save');
    btn.disabled = true;
    try {
      for (const name of SEC.grid.touched) {
        await Api.put(`/roles/${name}/pages`, { pageIds: pageBoxes(name).filter((c) => c.checked).map((c) => c.dataset.page) });
      }
      Utils.success('Menu access saved. People see it the next time they sign in.');
      Pages.users({ tab: 'role-menu' });
    } catch (e) { Utils.error(e.message); btn.disabled = false; }
  });
  refresh();
  if (SEC.pickRole) { grid.querySelector('.sec-pick')?.scrollIntoView({ inline: 'center', block: 'nearest' }); SEC.pickRole = null; }
};

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------
SEC.audit = { page: 1, rows: [] };

SEC.screens.audit = async (el) => {
  let people = [];
  try { people = (await Api.get('/users/directory')).data || []; } catch { /* the filter then lists nobody */ }
  el.innerHTML = `
    <div class="sm-panel">
      <div class="sm-panel-h"><div><div class="sm-panel-t">Audit Log</div><div class="sm-panel-s">Every add, change, delete and sign in. Entries cannot be edited.</div></div></div>
      <div class="sm-addrow multi" style="grid-template-columns:repeat(5,1fr) auto;align-items:end">
        <div><label class="sm-label" for="au-user">User</label><select class="sm-input" id="au-user"><option value="">Everyone</option>${people.map((p) => `<option value="${sesc(p.id)}">${sesc(p.name)}</option>`).join('')}</select></div>
        <div><label class="sm-label" for="au-action">Action</label><select class="sm-input" id="au-action"><option value="">Any</option><option value="create">Create</option><option value="update">Update</option><option value="delete">Delete</option><option value="login">Sign in</option></select></div>
        <div><label class="sm-label" for="au-type">What</label><select class="sm-input" id="au-type"><option value="">Anything</option>${['user', 'role', 'auth', 'consumer', 'project', 'company', 'booking', 'receipt'].map((t) => `<option value="${t}">${t}</option>`).join('')}</select></div>
        <div><label class="sm-label" for="au-from">From</label><input class="sm-input" type="date" id="au-from" value="${Utils.monthStart()}"></div>
        <div><label class="sm-label" for="au-to">To</label><input class="sm-input" type="date" id="au-to" value="${Utils.today()}"></div>
        <button class="sm-btn sm-btn--primary" id="au-go">Show</button>
      </div>
      <div id="au-body"></div>
    </div>`;
  el.querySelector('#au-go').onclick = () => SEC.loadAudit(true);
  SEC.loadAudit(true);
};

SEC.summary = (l) => {
  const v = l.new_values || {};
  if (l.action === 'login') return v.ip ? `from ${v.ip}` : '';
  return Object.entries(v).filter(([k]) => !/^(id|password|password_hash)$/.test(k) && v[k] !== null && typeof v[k] !== 'object')
    .slice(0, 4).map(([k, x]) => `${k.replace(/_/g, ' ')}: ${x}`).join(' · ');
};

SEC.loadAudit = async (fresh) => {
  const body = document.getElementById('au-body');
  if (!body) return;
  if (fresh) SEC.audit = { page: 1, rows: [] };
  const q = (id) => document.getElementById(id).value;
  try {
    const res = await Api.get('/users/audit-logs', { params: { userId: q('au-user'), action: q('au-action'), resourceType: q('au-type'), fromDate: q('au-from'), toDate: q('au-to'), pageSize: 100, page: SEC.audit.page } });
    const rows = res.data || [];
    SEC.audit.rows = SEC.audit.rows.concat(rows);
    SEC.audit.more = rows.length === 100;
  } catch (e) { body.innerHTML = SM.empty('Could not load', e.message); return; }
  const tagKind = { create: 'ok', delete: 'warn', login: 'info' };
  body.innerHTML = SEC.audit.rows.length ? `<div class="sm-scroll" style="max-height:none"><table class="sm-tbl"><thead><tr><th>Time</th><th>User</th><th>Action</th><th>What</th><th>Details</th></tr></thead>
    <tbody>${SEC.audit.rows.map((l) => `<tr><td class="sm-muted">${sesc(SEC.when(l.timestamp))}</td><td>${sesc(l.user_name || 'System')}</td>
      <td>${SEC.tag(l.action === 'login' ? 'sign in' : l.action, tagKind[l.action])}</td><td>${sesc(l.resource_type)}</td>
      <td class="sm-muted" style="max-width:360px;overflow-wrap:anywhere">${sesc(SEC.summary(l))}</td></tr>`).join('')}</tbody></table></div>
    ${SEC.audit.more ? '<div style="padding:12px 16px"><button class="sm-btn" onclick="SEC.audit.page++;SEC.loadAudit()">Load more</button></div>' : ''}`
    : SM.empty('No entries', 'Nothing was recorded for these filters.');
};
