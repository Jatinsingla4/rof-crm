// ROF CRM — Demand Status Page

const DS = {
  _type:  'all',
  _gst:   'gst',
  _page:  1,
  _limit: 50,
  _selected: new Set(),

  render() {
    const typeBtn = (id, label, active) =>
      `<button id="ds-type-${id}" onclick="DS.setType('${id}')"
        style="padding:4px 12px;border:1px solid #0d9488;cursor:pointer;font-size:12px;
               background:${active?'#0d9488':'white'};color:${active?'white':'#0d9488'};
               font-weight:${active?'bold':'normal'}">${label}</button>`;

    return `
      <div style="font-family:Arial,sans-serif;font-size:13px;">

        <!-- Filter Panel -->
        <div style="background:white;border:1px solid #e0e0e0;border-radius:4px;margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#0d9488;border-left:4px solid #065f46;">
            <span style="font-weight:bold;color:white;font-size:14px;letter-spacing:0.5px;">DEMAND STATUS</span>
            <div style="display:flex;gap:0;border-radius:4px;overflow:hidden;">
              ${typeBtn('all','All',true)}${typeBtn('demanded','Demanded',false)}${typeBtn('pending','Pending',false)}${typeBtn('paid','Paid',false)}
            </div>
          </div>

          <div style="padding:12px 14px;">
            <!-- Row 1 -->
            <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-bottom:8px;">
              ${this._fld('ds-project','*Project:','select')}
              ${this._fld('ds-tower','Tower:','select')}
              ${this._fld('ds-floor','Floor:','text','--All--')}
              ${this._fld('ds-reg-no','Registration No.:','text','Registration No.')}
              ${this._fld('ds-name','First Name:','text','First Name')}
              ${this._fld('ds-city','City:','text','City')}
            </div>
            <!-- Row 2 -->
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:8px;align-items:flex-end;margin-bottom:8px;">
              <div>
                <label style="display:block;font-size:11px;margin-bottom:3px;">Send/Unsend Status:</label>
                <select id="ds-delivery" style="width:100%;padding:5px;border:1px solid #999;border-radius:2px;font-size:12px;">
                  <option value="">&lt;--All--&gt;</option>
                  <option value="paid">Sent (Paid)</option>
                  <option value="queued">Queued</option>
                  <option value="pending">Unsent (Pending)</option>
                </select>
              </div>
              <div>
                <label style="display:block;font-size:11px;margin-bottom:3px;">Due Date From:</label>
                <input type="date" id="ds-due-from" style="width:100%;padding:5px;border:1px solid #999;border-radius:2px;font-size:12px;">
              </div>
              <div>
                <label style="display:block;font-size:11px;margin-bottom:3px;">Due Date To:</label>
                <input type="date" id="ds-due-to" style="width:100%;padding:5px;border:1px solid #999;border-radius:2px;font-size:12px;">
              </div>
              <div>
                <label style="display:block;font-size:11px;margin-bottom:3px;">GST:</label>
                <div style="display:flex;border-radius:4px;overflow:hidden;border:1px solid #0d9488;">
                  <button id="ds-gst-btn" onclick="DS.setGst('gst')" style="padding:5px 12px;border:none;background:#0d9488;color:white;font-size:12px;cursor:pointer;font-weight:bold;">GST</button>
                  <button id="ds-pregst-btn" onclick="DS.setGst('before')" style="padding:5px 12px;border:none;background:white;color:#0d9488;font-size:12px;cursor:pointer;">Before GST</button>
                </div>
              </div>
              <div></div>
            </div>
            <!-- Fetch -->
            <div style="border-top:1px solid #e0e0e0;padding-top:10px;display:flex;align-items:center;gap:12px;">
              <button onclick="DS.fetch()" style="background:#1976D2;color:white;border:none;padding:6px 22px;border-radius:2px;cursor:pointer;font-size:13px;font-weight:bold;letter-spacing:0.5px;">FETCH</button>
              <span id="ds-count" style="font-size:12px;color:#555;"></span>
            </div>
          </div>
        </div>

        <!-- Results -->
        <div id="ds-results" style="display:none;">
          <div style="display:flex;justify-content:flex-end;gap:10px;align-items:center;margin-bottom:6px;font-size:11px;">
            <span style="display:flex;align-items:center;gap:3px;"><span style="width:13px;height:13px;display:inline-block;background:#e0e0e0;border:1px solid #999;"></span>Sent</span>
            <span style="display:flex;align-items:center;gap:3px;"><span style="width:13px;height:13px;display:inline-block;background:white;border:1px solid #999;"></span>Demand</span>
            <span style="display:flex;align-items:center;gap:3px;"><span style="width:13px;height:13px;display:inline-block;background:#FFF59D;border:1px solid #F9A825;"></span>Reminder</span>
            <span style="display:flex;align-items:center;gap:3px;"><span style="width:13px;height:13px;display:inline-block;background:#C8E6C9;border:1px solid #388E3C;"></span>Cancellation Letter</span>
            <span style="display:flex;align-items:center;gap:3px;"><span style="width:13px;height:13px;display:inline-block;background:#FFCDD2;border:1px solid #C62828;"></span>Final Opp. Letter</span>
            <button onclick="window.print()" style="background:#1976D2;color:white;border:none;padding:4px 12px;border-radius:2px;cursor:pointer;font-size:12px;">🖨️ Print</button>
          </div>

          <div style="background:white;border:1px solid #e0e0e0;border-radius:4px;overflow:hidden;">
            <div style="overflow-x:auto;">
              <table style="width:100%;border-collapse:collapse;font-size:12px;">
                <thead><tr style="background:#1a237e;color:white;">
                  <th style="padding:8px 6px;text-align:center;width:38px;"><input type="checkbox" id="ds-select-all" onchange="DS.selectAll(this)"></th>
                  <th style="padding:8px 6px;text-align:left;width:45px;">S.NO</th>
                  <th style="padding:8px 6px;text-align:left;white-space:nowrap;">REG. NO.</th>
                  <th style="padding:8px 6px;text-align:left;white-space:nowrap;">BOOKING DATE</th>
                  <th style="padding:8px 6px;text-align:left;">NAME</th>
                  <th style="padding:8px 6px;text-align:left;">TYPE</th>
                  <th style="padding:8px 6px;text-align:left;white-space:nowrap;">UNIT ADDRESS</th>
                  <th style="padding:8px 6px;text-align:left;white-space:nowrap;">TOWER NAME</th>
                  <th style="padding:8px 6px;text-align:left;white-space:nowrap;">FLOOR NAME</th>
                  <th style="padding:8px 6px;text-align:left;white-space:nowrap;">MOBILE NO.</th>
                  <th style="padding:8px 6px;text-align:center;width:40px;">D</th>
                </tr></thead>
                <tbody id="ds-tbody"></tbody>
              </table>
            </div>
            <div id="ds-pagination" style="padding:8px 14px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #e0e0e0;font-size:12px;"></div>
          </div>

          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
            <button onclick="DS.printSelected('demand')" style="background:#1976D2;color:white;border:none;padding:7px 16px;border-radius:2px;cursor:pointer;font-size:12px;font-weight:bold;">PRINT DEMAND</button>
            <button onclick="DS.printSelected('reminder')" style="background:#1976D2;color:white;border:none;padding:7px 16px;border-radius:2px;cursor:pointer;font-size:12px;font-weight:bold;">PRINT REMINDER</button>
            <button onclick="DS.printSelected('cancellation')" style="background:#1976D2;color:white;border:none;padding:7px 16px;border-radius:2px;cursor:pointer;font-size:12px;font-weight:bold;">PRINT CANCELLATION LETTER</button>
            <button onclick="DS.printSelected('final')" style="background:#1976D2;color:white;border:none;padding:7px 16px;border-radius:2px;cursor:pointer;font-size:12px;font-weight:bold;">PRINT FINAL OPPORTUNITY LETTER</button>
          </div>
        </div>
      </div>`;
  },

  _fld(id, label, type, placeholder) {
    const style = 'width:100%;padding:5px;border:1px solid #999;border-radius:2px;font-size:12px;';
    const input = type === 'select'
      ? `<select id="${id}" style="${style}"><option value="">&lt;--All--&gt;</option></select>`
      : `<input type="text" id="${id}" placeholder="${placeholder||''}" style="${style}">`;
    return `<div><label style="display:block;font-size:11px;margin-bottom:3px;">${label}</label>${input}</div>`;
  },

  setType(type) {
    this._type = type;
    ['all','demanded','pending','paid'].forEach(t => {
      const btn = document.getElementById(`ds-type-${t}`);
      if (!btn) return;
      const active = t === type;
      btn.style.background  = active ? '#0d9488' : 'white';
      btn.style.color       = active ? 'white' : '#0d9488';
      btn.style.fontWeight  = active ? 'bold' : 'normal';
    });
  },

  setGst(type) {
    this._gst = type;
    const g = document.getElementById('ds-gst-btn');
    const b = document.getElementById('ds-pregst-btn');
    if (!g || !b) return;
    g.style.background = type === 'gst'    ? '#0d9488' : 'white'; g.style.color = type === 'gst'    ? 'white' : '#0d9488';
    b.style.background = type === 'before' ? '#0d9488' : 'white'; b.style.color = type === 'before' ? 'white' : '#0d9488';
  },

  async init() {
    const today = new Date().toISOString().split('T')[0];
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
    if (tbody) tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:20px;color:#999;">Loading…</td></tr>';

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
        if (tbody) tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:20px;color:#999;">No records found</td></tr>';
        return;
      }

      if (tbody) tbody.innerHTML = rows.map((r, i) => {
        const bg = r.delivery_status === 'paid' ? '#f5f5f5' : r.active_demands > 0 ? 'white' : '#FFFDE7';
        return `<tr style="background:${bg};border-bottom:1px solid #e8e8e8;">
          <td style="padding:7px 6px;text-align:center;"><input type="checkbox" class="ds-cb" value="${r.consumer_id}" onchange="DS.toggleSel('${r.consumer_id}',this.checked)"></td>
          <td style="padding:7px 6px;">${(this._page-1)*this._limit+i+1}</td>
          <td style="padding:7px 6px;color:#1a237e;font-weight:500;cursor:pointer;" onclick="DS.openConsumer('${r.consumer_id}')">${r.registration_no||'—'}</td>
          <td style="padding:7px 6px;font-size:11px;">${r.booking_date?new Date(r.booking_date).toLocaleDateString('en-IN'):'—'}</td>
          <td style="padding:7px 6px;"><a href="/api/consumers/${r.consumer_id}/applicant-file?token=${Auth.getToken()||''}" target="_blank" style="color:var(--primary);text-decoration:underline;cursor:pointer" title="View Applicant File">${r.name||'—'}</a></td>
          <td style="padding:7px 6px;">${r.bhk_type||'—'}</td>
          <td style="padding:7px 6px;font-weight:500;">${r.unit_number||'—'}</td>
          <td style="padding:7px 6px;">${r.tower_name||'—'}</td>
          <td style="padding:7px 6px;">${r.floor_number!=null?r.floor_number+'th Floor':'—'}</td>
          <td style="padding:7px 6px;">${r.mobile||'—'}</td>
          <td style="padding:7px 6px;text-align:center;">
            <button onclick="DS.openLetter('${r.consumer_id}')" style="background:#1976D2;color:white;border:none;padding:3px 10px;border-radius:2px;cursor:pointer;font-size:12px;font-weight:bold;">D</button>
          </td>
        </tr>`;
      }).join('');

      const totalPages = Math.ceil(total / this._limit);
      const pg = document.getElementById('ds-pagination');
      if (pg) pg.innerHTML = `
        <span>Records Per Page: <select onchange="DS._limit=+this.value;DS._page=1;DS._loadData()" style="padding:2px;font-size:12px;">
          <option value="50" ${this._limit===50?'selected':''}>50</option>
          <option value="100" ${this._limit===100?'selected':''}>100</option>
        </select></span>
        <span>Page No: ${this._page} of ${totalPages || 1}</span>
        <span>Records ${(this._page-1)*this._limit+1} - ${Math.min(this._page*this._limit,total)} of ${total}
          <button onclick="DS._page=1;DS._loadData()" style="padding:2px 6px;cursor:pointer;">&#8676;</button>
          <button onclick="DS._page=Math.max(1,DS._page-1);DS._loadData()" style="padding:2px 6px;cursor:pointer;">&#8249;</button>
          <button onclick="DS._page=Math.min(${totalPages},DS._page+1);DS._loadData()" style="padding:2px 6px;cursor:pointer;">&#8250;</button>
          <button onclick="DS._page=${totalPages};DS._loadData()" style="padding:2px 6px;cursor:pointer;">&#8677;</button>
        </span>`;
    } catch (err) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:20px;color:#c62828;">Failed to load — ${err.message}</td></tr>`;
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
    const today = new Date().toISOString().split('T')[0];
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
      if (docId) { win.location.href = `/api/documents/${docId}/html`; return; }
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
