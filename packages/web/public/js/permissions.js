// ROF CRM — Process Permissions
// Loaded once after login; drives UI visibility for maker/checker workflows

const Permissions = (() => {
  let _data = null;       // { role, processPermissions: { processName: ['maker','checker'] } }
  let _pageAccess = null; // { '/route': true|false }

  async function load() {
    if (!Auth.isAuthenticated()) return;
    try {
      const res = await fetch(`${ROF.API_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${Auth.getToken()}` },
      });
      if (res.status === 401) { Auth.logout(); return; }
      if (!res.ok) return;
      const json = await res.json();
      _data = json.data;
    } catch {
      _data = null;
    }
  }

  async function loadPageAccess() {
    if (!_data?.role) return;
    if (isSuperAdmin()) { _pageAccess = null; return; } // super_admin: all pages
    try {
      const res = await fetch(`${ROF.API_BASE}/roles/${_data.role}/pages`, {
        headers: { Authorization: `Bearer ${Auth.getToken()}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      _pageAccess = {};
      (json.data || []).forEach(p => { _pageAccess[p.route] = p.has_access; });
    } catch {
      _pageAccess = null;
    }
  }

  function canAccessPage(route) {
    if (isSuperAdmin()) return true;
    // Not loaded, or no pages are configured yet (empty nav_pages): allow. The server still enforces every role.
    if (!_pageAccess || Object.keys(_pageAccess).length === 0) return true;
    // A screen that is not on the page list (for example an applicant detail) is not controlled here
    if (!(route in _pageAccess)) return true;
    return _pageAccess[route] === true;
  }

  // Hide menu links to screens the role cannot open, then groups and buttons left empty
  function applyMenu() {
    if (isSuperAdmin()) return;
    const hidden = (el) => el.style.display === 'none';
    document.querySelectorAll('#navbar .dd-link[onclick*="Router.navigate("]').forEach(a => {
      const m = a.getAttribute('onclick').match(/Router\.navigate\('([^']+)'/);
      if (m && !canAccessPage(m[1])) a.style.display = 'none';
    });
    document.querySelectorAll('#navbar .dd-link.has-sub').forEach(g => {
      const kids = [...g.querySelectorAll('.sub-dd > .dd-link')];
      if (kids.length && kids.every(hidden)) g.style.display = 'none';
    });
    document.querySelectorAll('#navbar .nav-item').forEach(n => {
      const kids = [...n.querySelectorAll('.dd > .dd-link')];
      if (kids.length && kids.every(hidden)) n.style.display = 'none';
    });
  }

  function clear() {
    _data = null;
    _pageAccess = null;
  }

  function role() {
    return _data?.role || null;
  }

  function isSuperAdmin() {
    return _data?.role === 'super_admin';
  }

  // Does the user have maker OR checker for the given process?
  function can(processName) {
    if (isSuperAdmin()) return true;
    const roles = _data?.processPermissions?.[processName] || [];
    return roles.length > 0;
  }

  function canMake(processName) {
    if (isSuperAdmin()) return true;
    const roles = _data?.processPermissions?.[processName] || [];
    return roles.includes('maker');
  }

  function canCheck(processName) {
    if (isSuperAdmin()) return true;
    const roles = _data?.processPermissions?.[processName] || [];
    return roles.includes('checker') || roles.includes('approver');
  }

  // Alias for checker/approver access
  function canApprove(processName) {
    return canCheck(processName);
  }

  // Hide element if user cannot make OR check for this process
  function guard(element, processName) {
    if (!can(processName)) {
      element.style.display = 'none';
    }
  }

  // Disable element if user cannot make for this process
  function guardDisable(element, processName) {
    if (!canMake(processName)) {
      element.disabled = true;
      element.title = 'You do not have maker access for this action';
      element.classList.add('disabled');
    }
  }

  return { load, loadPageAccess, clear, role, isSuperAdmin, can, canMake, canCheck, canApprove, canAccessPage, applyMenu, guard, guardDisable };
})();
