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
    return _pageAccess[route] === true;
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

  return { load, loadPageAccess, clear, role, isSuperAdmin, can, canMake, canCheck, canApprove, canAccessPage, guard, guardDisable };
})();
