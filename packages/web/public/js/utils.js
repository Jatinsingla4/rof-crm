// ROF CRM — Utility Functions
// Formatting, UI helpers, modals, toasts, chips

const Utils = {
  // Floor text for screens: the name set in Set Projects, Floors when there is one, else Ground Floor / 1st Floor / 2nd Floor ...
  floorLabel(n, name) {
    if (name) return name;
    if (n === null || n === undefined || n === '') return '—';
    const num = Number(n);
    if (num === 0) return 'Ground Floor';
    if (num < 0) return 'Basement ' + (-num);
    const s = ['th', 'st', 'nd', 'rd'], v = num % 100;
    return num + (s[(v - 20) % 10] || s[v] || s[0]) + ' Floor';
  },

  // ── FORMATTING ──────────────────────────────

  toTitleCase(str) {
    if (!str) return '';
    return String(str).trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  },

  formatName(firstName, lastName, name) {
    const raw = (firstName || lastName)
      ? `${firstName || ''} ${lastName || ''}`.trim()
      : (name || '');
    return Utils.toTitleCase(raw) || 'Unknown';
  },

  // <option> list of the projects this login can see, the same everywhere (not built from units, so a project without units or with many units is never missing)
  async projectOptions(first = '— All Projects —') {
    const list = await window.ProjectCache.load();
    return `<option value="">${this.esc(first)}</option>` + list.map(p => `<option value="${this.esc(p.id)}">${this.esc(p.name)}</option>`).join('');
  },

  esc(str) {
    if (str == null) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  },

  // A CSV cell in quotes; a text that starts with = + - @ (or a tab / return) is prefixed with ' so a spreadsheet does not run it as a formula
  csvCell(v) {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  },

  currency(amount) {
    const n = parseFloat(amount) || 0;
    return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  },

  currencyFull(amount) {
    const n = parseFloat(amount) || 0;
    return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  date(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  },

  dateShort(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-IN', { day:'2-digit', month:'2-digit', year:'numeric' });
  },

  dateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
  },

  percentage(value) {
    return (parseFloat(value) || 0).toFixed(1) + '%';
  },

  // ── STATUS CHIP ──────────────────────────────

  chip(status) {
    const map = ROF.STATUS_CHIP[status] || { cls:'ch-gray', label: status || '—' };
    return `<span class="chip ${map.cls}">${map.label}</span>`;
  },

  progressBar(pct) {
    const p = Math.min(Math.max(parseFloat(pct) || 0, 0), 100);
    const cls = p >= 100 ? 'pf-green' : p < 30 ? 'pf-warn' : 'pf-teal';
    return `
      <div style="font-size:10.5px;font-weight:600">${p.toFixed(0)}%</div>
      <div class="progress"><div class="progress-fill ${cls}" style="width:${p}%"></div></div>
    `;
  },

  // ── TOAST NOTIFICATIONS ──────────────────────

  toast(message, type = 'info', duration = 3500) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.remove(), duration);
  },

  success(msg) { this.toast(msg, 'success'); },
  error(msg)   { this.toast(msg, 'error', 5000); },
  warn(msg)    { this.toast(msg, 'warn'); },
  info(msg)    { this.toast(msg, 'info'); },

  // ── MODAL HELPERS ────────────────────────────

  showOverlay(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('open');
  },

  closeOverlay(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
  },

  // ── TAB SYSTEM ───────────────────────────────

  switchTab(group, tabId) {
    document.querySelectorAll(`[data-group="${group}"]`).forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tabId);
    });
    document.querySelectorAll(`[data-panel-group="${group}"]`).forEach(p => {
      p.style.display = p.dataset.panel === tabId ? 'block' : 'none';
    });
  },

  initTabs(group, defaultTab) {
    const tabs = document.querySelectorAll(`[data-group="${group}"]`);
    tabs.forEach(t => {
      t.addEventListener('click', () => this.switchTab(group, t.dataset.tab));
    });
    if (defaultTab) this.switchTab(group, defaultTab);
    else if (tabs.length) this.switchTab(group, tabs[0].dataset.tab);
  },

  // ── TOGGLE BUTTON GROUPS ─────────────────────

  btgSelect(btn, mode = 'teal') {
    btn.closest('.btg').querySelectorAll('.btg-item').forEach(b => {
      b.classList.remove('on', 'on-acc');
    });
    btn.classList.add(mode === 'accent' ? 'on-acc' : 'on');
  },

  // ── TABLE SHOW ───────────────────────────────

  showTable(id) {
    const el = document.getElementById(id);
    if (el) { el.style.display = 'block'; el.style.animation = 'fadeUp .2s ease'; }
  },

  // ── FORM HELPERS ─────────────────────────────

  formData(formEl) {
    const data = {};
    const fd = new FormData(formEl);
    fd.forEach((v, k) => { data[k] = v; });
    return data;
  },

  serializeForm(formId) {
    const form = document.getElementById(formId);
    if (!form) return {};
    return this.formData(form);
  },

  setFormValues(formId, data) {
    const form = document.getElementById(formId);
    if (!form) return;
    Object.entries(data || {}).forEach(([key, val]) => {
      const el = form.querySelector(`[name="${key}"]`);
      if (el) el.value = val ?? '';
    });
  },

  // ── LOADING STATE ────────────────────────────

  setLoading(containerId, isLoading) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (isLoading) {
      el.innerHTML = `<div class="page-loading"><div class="spinner"></div> Loading…</div>`;
    }
  },

  setEmpty(containerId, message = 'No data found') {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `<div class="empty-state"><h3>${message}</h3></div>`;
  },

  // ── API ERROR HANDLER ────────────────────────

  handleError(err) {
    console.error(err);
    this.error(err.message || 'An error occurred');
  },

  // ── CONFIRM ──────────────────────────────────

  confirm(message, fn) {
    if (window.confirm(message)) fn();
  },

  // ── DATE INPUT ───────────────────────────────

  // A date as YYYY-MM-DD in the user's own calendar. toISOString() is UTC, so between midnight and 5:30 in the morning in India it gave yesterday
  // and the first of the month gave the last day of the month before; every screen takes its default dates from here.
  isoDate(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  // The CSV template of the unit import is made in the browser (the columns the import reads)
  downloadUnitTemplate() {
    const csv = 'unitNumber,tower,floor,unitType,location,facing\nA-101,Tower A,1,2BHK Type A,Corner,East\nA-102,Tower A,1,2BHK Type A,,West\n';
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: 'units-template.csv' });
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
  },

  today() {
    return this.isoDate(new Date());
  },

  monthStart() {
    const d = new Date();
    return this.isoDate(new Date(d.getFullYear(), d.getMonth(), 1));
  },

  displayDate() {
    return new Date().toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
  },
};
