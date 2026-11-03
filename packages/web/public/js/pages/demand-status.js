// ROF CRM — Demand Status Page

const DS = {
  _type:  'all',
  _gst:   'gst',
  _page:  1,
  _limit: 50,
  _selected: new Set(),

  render() {
    const typeBtn = (id, label, active) =>
      `<button id="ds-type-${id}" class="ds-type-btn${active?' on':''}" onclick="DS.setType('${id}')">${label}</button>`;

    return `
      <style>
        .dsn { max-width:1180px; margin-left:auto; margin-right:auto }
        .dsn .sp { border-radius:10px; overflow:hidden; margin-bottom:16px }
        .dsn .sp-hdr { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; padding:14px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border) }
        .dsn .sp-title { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
        .dsn .sp-body { padding:18px }
        .ds-types { display:flex; gap:6px; flex-wrap:wrap }
        .ds-type-btn { padding:5px 14px; border:1px solid var(--border2); background:var(--surface); color:var(--text2); border-radius:999px; cursor:pointer; font-size:11.5px }
        .ds-type-btn:hover { border-color:var(--teal); color:var(--teal) }
        .ds-type-btn.on { background:var(--teal); color:#fff; border-color:var(--teal); font-weight:600 }
        .ds-grid { display:grid; gap:16px 18px; margin-bottom:16px }
        .ds-grid-6 { grid-template-columns:repeat(6,minmax(0,1fr)) }
        .ds-grid-5 { grid-template-columns:repeat(4,minmax(0,1fr)) auto; align-items:flex-end }
        @media (max-width:900px) { .ds-grid-6, .ds-grid-5 { grid-template-columns:repeat(2,minmax(0,1fr)) } }
        @media (max-width:640px) { .ds-grid-6, .ds-grid-5 { grid-template-columns:minmax(0,1fr) } }
        .dsn .fg { display:flex; flex-direction:column; gap:6px }
        .dsn .fl { font-size:11px; font-weight:500; text-transform:none; letter-spacing:.3px; color:var(--text2) }
        .dsn .fc { width:100%; padding:9px 12px; font-size:13px; border-radius:8px; min-height:38px }
        .dsn .fc:focus { border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-bg) }
        .ds-seg { display:flex; border:1px solid var(--border2); border-radius:8px; overflow:hidden; height:38px }
        .ds-seg button { padding:0 16px; border:none; background:var(--surface); color:var(--text2); font-size:12px; cursor:pointer }
        .ds-seg button.on { background:var(--teal); color:#fff; font-weight:600 }
        .ds-actions { border-top:1px solid var(--border); padding-top:16px; display:flex; align-items:center; gap:12px }
        .ds-fetch { background:var(--teal); color:#fff; border:none; padding:9px 26px; border-radius:8px; cursor:pointer; font-size:12.5px; font-weight:600; min-height:38px }
        .ds-fetch:hover { filter:brightness(.92) }
        .ds-count { font-size:12px; color:var(--text2) }
        .ds-legend { display:flex; justify-content:flex-end; align-items:center; flex-wrap:wrap; gap:14px; padding:0 4px 12px; font-size:11.5px; color:var(--text2) }
        .ds-legend span { display:flex; align-items:center; gap:5px }
        .ds-legend i { width:13px; height:13px; display:inline-block; border-radius:3px }
        .ds-print-btn { background:var(--surface); color:var(--text2); border:1px solid var(--border2); padding:5px 14px; border-radius:8px; cursor:pointer; font-size:12px }
        .ds-card { background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:hidden }
        .ds-tbl { width:100%; border-collapse:collapse; font-size:12.5px }
        .ds-tbl th { text-align:left; padding:10px 14px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; color:var(--text3); background:var(--surface2); border-bottom:1px solid var(--border2); white-space:nowrap }
        .ds-tbl td { padding:10px 14px; border-bottom:1px solid var(--border); color:var(--text); vertical-align:middle }
        .ds-tbl tbody tr:hover td { background:var(--surface2) }
        .ds-tbl tbody tr:last-child td { border-bottom:none }
        .ds-tbl tr.ds-sent td { background:var(--surface2) }
        .ds-tbl tr.ds-rem td { background:rgba(250,204,21,.12) }
        .ds-tbl td.ds-link { color:var(--teal); font-weight:500; cursor:pointer }
        .ds-tbl a { color:var(--teal); text-decoration:none; font-weight:500 }
        .ds-tbl a:hover { text-decoration:underline }
        .ds-btn-d { background:var(--teal); color:#fff; border:none; padding:3px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600 }
        .ds-pag { padding:12px 18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; border-top:1px solid var(--border); font-size:12px; color:var(--text2) }
        .ds-pag button { padding:3px 8px; cursor:pointer; border:1px solid var(--border2); background:var(--surface); color:var(--text); border-radius:6px }
        .ds-prints { margin-top:16px; display:flex; gap:10px; flex-wrap:wrap }
        .ds-prints button { background:var(--teal); color:#fff; border:none; padding:9px 18px; border-radius:8px; cursor:pointer; font-size:12px; font-weight:600 }
        .ds-prints button:hover { filter:brightness(.92) }
      </style>
      <div class="dsn">

        <!-- Filter Panel -->
        <div class="sp">
          <div class="sp-hdr">
            <div class="sp-title">Demand Status</div>
            <div class="ds-types">
              ${typeBtn('all','All',true)}${typeBtn('demanded','Demanded',false)}${typeBtn('pending','Pending',false)}${typeBtn('paid','Paid',false)}
            </div>
          </div>

          <div class="sp-body">
            <div class="ds-grid ds-grid-6">
              ${this._fld('ds-project','*Project','select')}
              ${this._fld('ds-tower','Tower','select')}
              ${this._fld('ds-floor','Floor','text','--All--')}
              ${this._fld('ds-reg-no','Registration No.','text','Registration No.')}
              ${this._fld('ds-name','First Name','text','First Name')}
              ${this._fld('ds-city','City','text','City')}
            </div>
            <div class="ds-grid ds-grid-5">
              <div class="fg">
                <label class="fl">Send/Unsend Status</label>
                <select id="ds-delivery" class="fc">
                  <option value="">&lt;--All--&gt;</option>
                  <option value="paid">Sent (Paid)</option>
                  <option value="queued">Queued</option>
                  <option value="pending">Unsent (Pending)</option>
                </select>
              </div>
              <div class="fg">
                <label class="fl">Due Date From</label>
                <input type="date" id="ds-due-from" class="fc">
              </div>
              <div class="fg">
                <label class="fl">Due Date To</label>
                <input type="date" id="ds-due-to" class="fc">
              </div>
              <div class="fg">
                <label class="fl">GST</label>
                <div class="ds-seg">
                  <button id="ds-gst-btn" class="on" onclick="DS.setGst('gst')">GST</button>
                  <button id="ds-pregst-btn" onclick="DS.setGst('before')">Before GST</button>
                </div>
              </div>
              <div></div>
            </div>
            <div class="ds-actions">
              <button class="ds-fetch" onclick="DS.fetch()">FETCH</button>
              <span id="ds-count" class="ds-count"></span>
            </div>
          </div>
        </div>

        <!-- Results -->
        <div id="ds-results" style="display:none;">
          <div class="ds-legend">
            <span><i style="background:var(--surface2);border:1px solid var(--border2)"></i>Sent</span>
            <span><i style="background:var(--surface);border:1px solid var(--border2)"></i>Demand</span>
            <span><i style="background:#FFF59D;border:1px solid #F9A825"></i>Reminder</span>
            <span><i style="background:#C8E6C9;border:1px solid #388E3C"></i>Cancellation Letter</span>
            <span><i style="background:#FFCDD2;border:1px solid #C62828"></i>Final Opp. Letter</span>
            <button class="ds-print-btn" onclick="window.print()">🖨️ Print</button>
          </div>

          <div class="ds-card">
            <div style="overflow-x:auto;">
              <table class="ds-tbl">
                <thead><tr>
                  <th style="text-align:center;width:38px;"><input type="checkbox" id="ds-select-all" onchange="DS.selectAll(this)"></th>
                  <th style="width:45px;">S.NO</th>
                  <th>REG. NO.</th>
                  <th>BOOKING DATE</th>
                  <th>NAME</th>
                  <th>TYPE</th>
                  <th>UNIT ADDRESS</th>
                  <th>TOWER NAME</th>
                  <th>FLOOR NAME</th>
                  <th>MOBILE NO.</th>
                  <th style="text-align:right;">PAID</th>
                  <th style="text-align:right;">BALANCE</th>
                  <th style="text-align:center;width:40px;">D</th>
                </tr></thead>
                <tbody id="ds-tbody"></tbody>
              </table>
            </div>
            <div id="ds-pagination" class="ds-pag"></div>
          </div>

          <div class="ds-prints">
            <button onclick="DS.printSelected('demand')">PRINT DEMAND</button>
            <button onclick="DS.printSelected('reminder')">PRINT REMINDER</button>
            <button onclick="DS.printSelected('cancellation')">PRINT CANCELLATION LETTER</button>
            <button onclick="DS.printSelected('final')">PRINT FINAL OPPORTUNITY LETTER</button>
          </div>
        </div>
      </div>`;
  },

  _fld(id, label, type, placeholder) {
    const input = type === 'select'
      ? `<select id="${id}" class="fc"><option value="">&lt;--All--&gt;</option></select>`
      : `<input type="text" id="${id}" class="fc" placeholder="${placeholder||''}">`;
    return `<div class="fg"><label class="fl">${label}</label>${input}</div>`;
  },

  setType(type) {
    this._type = type;
    ['all','demanded','pending','paid'].forEach(t => {
      const btn = document.getElementById(`ds-type-${t}`);
      if (btn) btn.classList.toggle('on', t === type);
    });
  },

  setGst(type) {
    this._gst = type;
    const g = document.getElementById('ds-gst-btn');
    const b = document.getElementById('ds-pregst-btn');
    if (!g || !b) return;
    g.classList.toggle('on', type === 'gst');
    b.classList.toggle('on', type === 'before');
  },

  async init() {
    const today = Utils.today();
    const dueTo = document.getElementById('ds-due-to');
    if (dueTo) dueTo.value = today;

    try {
      const token = Auth?.getToken?.() || localStorage.getItem('rof-jwt') || '';
      const [prRes, twRes] = await Promise.all([
        fetch('/api/projects', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/units/towers', { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
      ]);
      const pj = await prRes.json();
      const projSel = document.getElementById('ds-project');
      if (projSel) {
        (pj.data || pj || []).forEach(p => {
          const o = document.createElement('option'); o.value = p.id; o.textContent = p.name; projSel.appendChild(o);
        });
      }
      if (twRes) {
        const tw = await twRes.json();
        const twSel = document.getElementById('ds-tower');
        if (twSel) {
          (tw.data || tw || []).forEach(t => {
            const o = document.createElement('option'); o.value = t.tower_name; o.textContent = t.tower_name; twSel.appendChild(o);
          });
        }
      }
    } catch {}
  },

  fetch() { this._page = 1; this._loadData(); },

  async _loadData() {
    const get = id => (document.getElementById(id)?.value || '').trim();
    const params = new URLSearchParams({ page: String(this._page), limit: String(this._limit) });
    const map = { 'ds-project': 'project_id', 'ds-tower': 'tower', 'ds-floor': 'floor',
                  'ds-reg-no': 'reg_no', 'ds-name': 'name', 'ds-city': 'city',
                  'ds-delivery': 'delivery_status', 'ds-due-from': 'due_date_from', 'ds-due-to': 'due_date_to' };
    Object.entries(map).forEach(([id, key]) => { const v = get(id); if (v) params.set(key, v); });
    if (this._type !== 'all') params.set('demand_status', this._type);

    const tbody = document.getElementById('ds-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="13" style="text-align:center;padding:30px;color:var(--text3);">Loading…</td></tr>';

    try {
      const token = Auth?.getToken?.() || localStorage.getItem('rof-jwt') || '';
      const res = await fetch(`/api/payments/demand-status?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      const rows = json.data || [];
      const total = json.total || 0;

      const cnt = document.getElementById('ds-count');
      if (cnt) cnt.textContent = `${total} consumer(s) found`;
      const results = document.getElementById('ds-results');
      if (results) results.style.display = 'block';

      if (!rows.length) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="13" style="text-align:center;padding:30px;color:var(--text3);">No records found</td></tr>';
        return;
      }

      if (tbody) tbody.innerHTML = rows.map((r, i) => {
        const rowCls = r.delivery_status === 'paid' ? 'ds-sent' : r.active_demands > 0 ? '' : 'ds-rem';
        return `<tr class="${rowCls}">
          <td style="text-align:center"><input type="checkbox" class="ds-cb" value="${r.consumer_id}" onchange="DS.toggleSel('${r.consumer_id}',this.checked)"></td>
          <td>${(this._page-1)*this._limit+i+1}</td>
          <td class="ds-link" onclick="DS.openConsumer('${r.consumer_id}')">${r.registration_no||'—'}</td>
          <td>${r.booking_date?new Date(r.booking_date).toLocaleDateString('en-IN'):'—'}</td>
          <td><a href="/api/consumers/${r.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" title="View Applicant File">${r.name||'—'}</a></td>
          <td>${r.bhk_type||'—'}</td>
          <td style="font-weight:600">${r.unit_number||'—'}</td>
          <td>${r.tower_name||'—'}</td>
          <td>${Utils.esc(Utils.floorLabel(r.floor_number, r.floor_name))}</td>
          <td>${r.mobile||'—'}</td>
          <td style="text-align:right">${Utils.currency(r.paid_amount||0)}${r.unadjusted_credit>0?`<div style="font-size:10px;color:var(--teal)">+ ${Utils.currency(r.unadjusted_credit)} paid beyond the plan</div>`:''}</td>
          <td style="text-align:right;font-weight:600">${Utils.currency(r.balance_amount||0)}</td>
          <td style="text-align:center">
            <button onclick="DS.openLetter('${r.consumer_id}')" class="ds-btn-d">D</button>
          </td>
        </tr>`;
      }).join('');

      const totalPages = Math.ceil(total / this._limit);
      const pg = document.getElementById('ds-pagination');
      if (pg) pg.innerHTML = `
        <span>Records Per Page: <select onchange="DS._limit=+this.value;DS._page=1;DS._loadData()" style="padding:3px 6px;border-radius:6px;">
          <option value="50" ${this._limit===50?'selected':''}>50</option>
          <option value="100" ${this._limit===100?'selected':''}>100</option>
        </select></span>
        <span>Page No: ${this._page} of ${totalPages || 1}</span>
        <span>Records ${(this._page-1)*this._limit+1} - ${Math.min(this._page*this._limit,total)} of ${total}
          <button onclick="DS._page=1;DS._loadData()" >&#8676;</button>
          <button onclick="DS._page=Math.max(1,DS._page-1);DS._loadData()" >&#8249;</button>
          <button onclick="DS._page=Math.min(${totalPages},DS._page+1);DS._loadData()" >&#8250;</button>
          <button onclick="DS._page=${totalPages};DS._loadData()" >&#8677;</button>
        </span>`;
    } catch (err) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="13" style="text-align:center;padding:30px;color:var(--red);">Failed to load — ${err.message}</td></tr>`;
    }
  },

  goPage(p) { if (p >= 1) { this._page = p; this._loadData(); } },

  selectAll(cb) {
    document.querySelectorAll('.ds-cb').forEach(c => { c.checked = cb.checked; this.toggleSel(c.value, cb.checked); });
  },
  toggleSel(id, checked) { checked ? this._selected.add(id) : this._selected.delete(id); },

  openConsumer(id) { if (typeof Router !== 'undefined') Router.navigate('/consumer', { id }); },

  async openLetter(consumerId) {
    const token = Auth?.getToken?.() || localStorage.getItem('rof-jwt') || '';
    const today = Utils.today();
    const win = window.open('', '_blank');
    win.document.write('<p style="font-family:Arial;padding:20px;">Generating demand letter…</p>');
    try {
      const res = await fetch('/api/documents/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ consumerId, documentType: 'demand_letter', dueDate: document.getElementById('ds-due-to')?.value || today }),
      });
      const json = await res.json();
      if (!json.success && !json.documentId && !json.data?.html) throw new Error(json.error || 'Generation failed');

      // If we got an HTML document back:
      const html = json.data?.html || json.html;
      if (html) {
        win.document.open();
        win.document.write(html);
        win.document.close();
        return;
      }
      // Otherwise open PDF link:
      const docId = json.data?.documentId || json.documentId;
      if (docId) { win.location.href = await window.linkUrl(`/api/documents/${docId}/html`); return; }
      throw new Error('No content returned');
    } catch (err) { win.document.body.innerHTML = `<p style="color:red;font-family:Arial;padding:20px;">Error: ${err.message}</p>`; }
  },

  async printSelected(type) {
    if (!this._selected.size) { Utils.warn('Select at least one consumer using the checkboxes'); return; }
    for (const id of this._selected) await this.openLetter(id);
  },
};

if (typeof Pages !== 'undefined') {
  Pages.demandStatus = (params = {}) => {
    const container = document.getElementById('content');
    if (!container) return;
    container.innerHTML = DS.render();
    DS._selected = new Set();
    DS._page = 1;
    DS.init();
  };
}
