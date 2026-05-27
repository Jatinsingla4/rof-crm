// ROF CRM — Application Entry Point
// Initializes theme, auth guard, navigation, and router

// ── GLOBAL PROJECT CACHE ─────────────────────────────────────────────────────
// Single source of truth for project list. All pages use this instead of
// making their own /projects API calls. Cached for 30s; force-refreshed
// after any project create/update so all dropdowns stay in sync.
window.ProjectCache = {
  _data: [],
  _lastFetched: null,
  _listeners: [],

  async load(force = false) {
    const now = Date.now();
    if (!force && this._lastFetched && (now - this._lastFetched) < 30000 && this._data.length > 0) {
      return this._data;
    }
    try {
      const res = await Api.get('/projects');
      this._data = res.data || res || [];
      this._lastFetched = now;
      this._notify();
    } catch (err) {
      console.error('[ProjectCache] load failed:', err);
    }
    return this._data;
  },

  subscribe(fn) { this._listeners.push(fn); },
  _notify() { this._listeners.forEach(fn => { try { fn(this._data); } catch(e) {} }); },
  refresh() { return this.load(true); },
};

document.addEventListener('DOMContentLoaded', async () => {

  // ── 1. THEME ─────────────────────────────────
  const savedTheme = localStorage.getItem(ROF.THEME_KEY) || 'dark';
  applyTheme(savedTheme);

  // ── 2. AUTH GUARD ─────────────────────────────
  const isLoginPage = window.location.pathname.includes('login');
  if (!isLoginPage && !Auth.isAuthenticated()) {
    window.location.href = '/pages/login.html';
    return;
  }

  // ── 3. TOPBAR ─────────────────────────────────
  const tbDate = document.getElementById('tb-date');
  if (tbDate) tbDate.textContent = Utils.displayDate();

  const tbUser = document.getElementById('tb-user');
  if (tbUser) {
    const user = Auth.getUser();
    tbUser.textContent = 'Welcome, ' + (user?.name || user?.email || 'Admin');
  }

  // ── 4. OVERLAY CLOSE ─────────────────────────
  document.querySelectorAll('.overlay').forEach(o => {
    o.addEventListener('click', e => {
      if (e.target === o) o.classList.remove('open');
    });
  });

  // ── 4b. NAV DROPDOWNS (click-toggle) ─────────
  initNavDropdowns();

  // ── 5. REGISTER PAGE ROUTES ──────────────────
  // Each page module self-registers via Router.register()
  // Pages are loaded dynamically when route matches

  // Core pages
  Router.register('/dashboard',         () => Pages.dashboard());
  Router.register('/consumers',         (p) => Pages.consumers(p));
  Router.register('/consumer',          (p) => Pages.consumerDetail(p));
  Router.register('/booking',           (p) => Pages.booking(p));
  Router.register('/booking-payment',   (p) => { if (!p.id) { Router.navigate('/consumers'); return; } Pages.bookingPayment(p); });
  Router.register('/allotment',         (p) => Pages.allotment(p));
  Router.register('/receipts',          (p) => Pages.receipts(p));
  Router.register('/demands',           (p) => Pages.demands(p));
  Router.register('/demand-raise',      (p) => Pages.demandRaise(p));
  Router.register('/documents',         (p) => Pages.documents(p));
  Router.register('/customer-folders',  (p) => Pages.customerFolders(p));
  Router.register('/unit-documents',    (p) => Pages.unitDocuments(p));
  Router.register('/unit-status',       (p) => Pages.unitStatus(p));
  Router.register('/communications',    (p) => Pages.communications(p));
  Router.register('/whatsapp-inbox',    (p) => Pages.whatsappInbox(p));
  Router.register('/email-templates',   (p) => Pages.emailTemplates(p));
  Router.register('/facebook-inbox',    (p) => Pages.facebookInbox(p));
  Router.register('/instagram-inbox',   (p) => Pages.instagramInbox(p));
  Router.register('/reports',           (p) => Pages.reports(p));
  Router.register('/reports/edits',     (p) => Pages.documentEdits(p));
  Router.register('/analytics',         (p) => Pages.analytics(p));
  Router.register('/leads',             (p) => Pages.leads(p));
  Router.register('/set-master',        (p) => Pages.setMaster(p));
  Router.register('/set-projects',      (p) => Pages.setProjects(p));
  Router.register('/automation',        (p) => Pages.automation(p));
  Router.register('/import',            (p) => Pages.importPage(p));
  Router.register('/users',             (p) => Pages.users(p));
  Router.register('/tasks',             (p) => Pages.tasks(p));
  Router.register('/help',              (p) => Pages.help(p));
  Router.register('/gst-invoicing',     (p) => Pages.gstInvoicing(p));
  Router.register('/surrender',         (p) => Pages.surrender(p));
  Router.register('/transfers',         (p) => Pages.transfers(p));
  Router.register('/registry',          (p) => Pages.registry(p));
  Router.register('/loans',             (p) => Pages.loans(p));
  Router.register('/parking',           (p) => Pages.parking(p));
  Router.register('/brokers',           (p) => Pages.brokers(p));
  Router.register('/broker-setup',      (p) => Pages.brokerSetup(p));
  Router.register('/inventory-hold',    (p) => Pages.inventoryHold(p));
  Router.register('/campaigns',         (p) => Pages.campaigns(p));
  Router.register('/employees',         (p) => Pages.employees(p));
  Router.register('/calling',           (p) => Pages.calling(p));
  Router.register('/collection-setup',  (p) => Pages.collectionSetup(p));

  // ── 6. START ROUTER ──────────────────────────
  Router.init();
});

// ── THEME FUNCTIONS (global, called by topbar button) ──
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(ROF.THEME_KEY, theme);
  const isDark = theme === 'dark';
  const icon = document.getElementById('theme-icon');
  const label = document.getElementById('theme-label');
  const track = document.getElementById('toggle-track');
  if (icon) icon.textContent = isDark ? '🌙' : '☀️';
  if (label) label.textContent = isDark ? 'Dark' : 'Light';
  if (track) {
    if (isDark) track.classList.add('on');
    else track.classList.remove('on');
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// ── GLOBAL HELPERS (used by inline HTML onclick attrs) ──
function showOverlay(id) { Utils.showOverlay(id); }
function closeOverlay(id) { Utils.closeOverlay(id); }
function switchTab(group, tabId) { Utils.switchTab(group, tabId); }
function btgSelect(btn, mode) { Utils.btgSelect(btn, mode); }
function showTable(id) { Utils.showTable(id); }
function confirmAction(msg, fn) { Utils.confirm(msg, fn); }

// Pages namespace declared in constants.js (loads before page modules)

// ── NAV DROPDOWN LOGIC (click-to-open, click-again-to-close, 3-level) ──────
function closeAllNavDropdowns() {
  document.querySelectorAll('.nav-item.open').forEach(el => el.classList.remove('open'));
  document.querySelectorAll('.dd-link.open').forEach(el => el.classList.remove('open'));
}

function initNavDropdowns() {
  // Click outside the navbar → close all
  document.addEventListener('click', closeAllNavDropdowns);

  // Clicks inside any .nav-item stop propagation so outside-click handler
  // doesn't immediately close the dropdown we just opened
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => e.stopPropagation());
  });

  // Top-level nav buttons toggle their dropdown
  document.querySelectorAll('.nav-item > .nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = btn.closest('.nav-item');
      const alreadyOpen = item.classList.contains('open');
      closeAllNavDropdowns();
      if (!alreadyOpen) item.classList.add('open');
    });
  });

  // Level-1 parent links (inside .dd, have .sub-dd inside)
  document.querySelectorAll('.dd > .dd-link.has-sub').forEach(link => {
    link.addEventListener('click', (e) => {
      e.stopPropagation();
      const alreadyOpen = link.classList.contains('open');
      // Close siblings at same level
      link.closest('.dd').querySelectorAll(':scope > .dd-link.open')
          .forEach(el => el.classList.remove('open'));
      if (!alreadyOpen) link.classList.add('open');
    });
  });

  // Level-2 parent links (inside .sub-dd, have .sub-sub-dd inside)
  document.querySelectorAll('.sub-dd > .dd-link.has-sub').forEach(link => {
    link.addEventListener('click', (e) => {
      e.stopPropagation();
      const alreadyOpen = link.classList.contains('open');
      link.closest('.sub-dd').querySelectorAll(':scope > .dd-link.open')
          .forEach(el => el.classList.remove('open'));
      if (!alreadyOpen) link.classList.add('open');
    });
  });

  // Leaf navigation links (a tags) → close all dropdowns then navigate
  document.querySelectorAll('.dd a.dd-link, .sub-dd a.dd-link, .sub-sub-dd a.dd-link').forEach(link => {
    link.addEventListener('click', closeAllNavDropdowns);
  });

  // Escape key closes everything
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAllNavDropdowns();
  });
}
