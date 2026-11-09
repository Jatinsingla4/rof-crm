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

  // Business calendar (policy): a timestamp is an instant and is shown on the Asia/Kolkata calendar; a calendar date (a DATE column, which the API
  // sends as YYYY-MM-DD or as midnight UTC) is shown as that same day and never shifted by the browser timezone.
  _bizOpts(v, opts) {
    const calendarDay = typeof v === 'string' && (/^\d{4}-\d{2}-\d{2}$/.test(v) || /^\d{4}-\d{2}-\d{2}T00:00:00(\.000)?Z$/.test(v));
    return { ...opts, timeZone: calendarDay ? 'UTC' : 'Asia/Kolkata' };
  },

  date(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-IN', this._bizOpts(iso, { day:'2-digit', month:'short', year:'numeric' }));
  },

  dateShort(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-IN', this._bizOpts(iso, { day:'2-digit', month:'2-digit', year:'numeric' }));
  },

  dateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', timeZone: 'Asia/Kolkata' });
  },

  percentage(value) {
    return (parseFloat(value) || 0).toFixed(1) + '%';
  },

  // ── STATUS CHIP ──────────────────────────────

  chip(status) {
    // one spelling on every screen: the lookup ignores case, and an unknown status is shown as words with a capital ("authorized" -> "Authorized")
    const words = String(status || '').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
    const map = ROF.STATUS_CHIP[status] || ROF.STATUS_CHIP[String(status || '').toLowerCase()] || { cls:'ch-gray', label: words || '—' };
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

  // An in-page question (never the browser's native confirm() box: some tools and phones cannot answer a native box, so the action
  // silently never ran). Utils.ask(message) answers true (OK) or false (Cancel, Escape or a click outside); Utils.confirm(message, fn) runs fn on OK.
  ask(message, opts = {}) {
    return new Promise((resolve) => {
      const old = document.getElementById('rof-ask');
      if (old) old.remove();   // a second question replaces the first one (which counts as Cancel)
      const host = document.createElement('div');
      host.id = 'rof-ask';
      host.setAttribute('role', 'alertdialog'); host.setAttribute('aria-modal', 'true'); host.setAttribute('aria-labelledby', 'rof-ask-msg');
      host.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px;';
      const box = document.createElement('div');
      box.style.cssText = 'background:var(--surface,#fff);color:var(--text,#222);border:1px solid var(--border2,#ccc);border-radius:10px;max-width:460px;width:100%;padding:20px 22px;box-shadow:0 12px 40px rgba(0,0,0,.3);font-size:14px;';
      const msg = document.createElement('div');
      msg.id = 'rof-ask-msg'; msg.setAttribute('data-ask-msg', ''); msg.style.cssText = 'white-space:pre-line;line-height:1.5;margin-bottom:18px;';
      msg.textContent = String(message);   // text, never markup
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';
      const cancel = document.createElement('button'); cancel.id = 'rof-ask-cancel'; cancel.type = 'button'; cancel.className = 'btn btn-ghost'; cancel.textContent = opts.cancelText || 'Cancel';
      const ok = document.createElement('button'); ok.id = 'rof-ask-ok'; ok.type = 'button'; ok.className = 'btn btn-teal'; ok.textContent = opts.okText || 'OK';
      row.append(cancel, ok); box.append(msg, row); host.append(box); document.body.append(host);
      let done = false;
      const finish = (answer) => { if (done) return; done = true; document.removeEventListener('keydown', onKey, true); host.remove(); resolve(answer); };
      // Only Escape is handled here; Enter acts on the button that has the focus (Cancel at first), so an Enter typed into a form cannot confirm a destructive action
      const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); finish(false); } };
      document.addEventListener('keydown', onKey, true);
      ok.addEventListener('click', () => finish(true));
      cancel.addEventListener('click', () => finish(false));
      const opened = Date.now();   // the second click of a double click lands on the backdrop: it must not dismiss the question it just opened
      host.addEventListener('mousedown', (e) => { if (e.target === host && Date.now() - opened > 600) finish(false); });
      new MutationObserver((_, obs) => { if (!document.body.contains(host)) { finish(false); obs.disconnect(); } }).observe(document.body, { childList: true });
      cancel.focus();   // the safe answer is the one that has the focus
    });
  },

  confirm(message, fn) {
    return this.ask(message).then((yes) => { if (yes) return fn(); });
  },

  // ── DATE INPUT ───────────────────────────────

  // A date as YYYY-MM-DD on the business calendar (Asia/Kolkata), whatever the browser timezone. toISOString() is UTC, so between midnight and
  // 5:30 in the morning in India it gave yesterday; every screen takes its default dates from here. With a Date argument the Date's own
  // calendar fields are used (callers build those from year, month, day).
  isoDate(d) {
    if (!d) return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  // The CSV template of the unit import is made in the browser (the columns the import reads)
  downloadUnitTemplate() {
    const csv = 'unitNumber,tower,floor,unitType,location,facing\nA-101,Tower A,1,2BHK Type A,Corner,East\nA-102,Tower A,1,2BHK Type A,,West\n';
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: 'units-template.csv' });
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
  },

  today() {
    return this.isoDate();
  },

  monthStart() {
    return this.isoDate().slice(0, 8) + '01';
  },

  displayDate() {
    return new Date().toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric', timeZone: 'Asia/Kolkata' });
  },
};
