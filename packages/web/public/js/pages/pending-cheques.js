// ROF CRM — Verify Pending Cheque Status

const PC = {
  _holdReceiptId: null,
  _banks: [],

  BOUNCE_REASONS: [
    'Fund Insufficient',
    'Drawer Signature Differ',
    'Payment Stopped By Drawer',
    'Image Not Cleared',
    'Kindly contact to drawer/drawee bank, plz present again',
    'Account Blocked/Closed/Freezed',
    'Present In improper zone',
    'Instrument Post Dated',
    'Stale Cheque (Cheque Validity Expired)',
    'Drawer Signature required',
    'Words & figure are mis-match',
    'Exceed arrangement',
    'Other Reason',
  ],

  // Returns a valid UUID project_id or null — never passes "undefined"/"null" string to the API
  _getProjectId() {
    const raw = new URLSearchParams(window.location.search).get('project_id');
    return (raw && raw !== 'undefined' && raw !== 'null' && raw.trim().length > 10) ? raw.trim() : null;
  },

  async init() {
    const projectId = this._getProjectId();
    const token     = pcGetToken();

    // Populate Tower dropdown — only if we have a real project_id
    if (projectId) {
      try {
        const res = await fetch('/api/units/tower/' + projectId, {
          headers: { Authorization: 'Bearer ' + token }
        });
        if (res.ok) {
          const json = await res.json();
          const sel  = document.getElementById('pc-tower');
          if (sel) {
            (json.data || json || []).forEach(t => {
              const o = document.createElement('option');
              o.value       = t.tower_id || t.id || t.tower_name;
              o.textContent = t.tower_name;
              sel.appendChild(o);
            });
          }
        }
      } catch (_) {}
    }

    // Load clearing banks from Bank Master — always, independent of project_id
    await this._loadBanks();

    // Auto-fetch on page load
    this.fetchCheques();

    // ALT+C = Clear
    document.addEventListener('keydown', e => {
      if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        PC.handleClear();
      }
    });
  },

  async _loadBanks() {
    try {
      const token = pcGetToken();
      const res   = await fetch('/api/master/banks', {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (res.ok) {
        const json  = await res.json();
        this._banks = json.data || json || [];
      }
    } catch (_) {}
  },

  async fetchCheques() {
    const projectId = this._getProjectId();
    const get       = id => (document.getElementById(id)?.value || '').trim();
    const params    = new URLSearchParams();

    // Only add project_id if it's a real UUID
    if (projectId)              params.set('project_id',  projectId);
    if (get('pc-tower'))        params.set('tower_id',    get('pc-tower'));
    if (get('pc-unit-address')) params.set('unit_address', get('pc-unit-address'));
    if (get('pc-date-from'))    params.set('from_date',   get('pc-date-from'));
    if (get('pc-date-to'))      params.set('to_date',     get('pc-date-to'));

    const tbody = document.getElementById('pc-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="21" style="text-align:center;padding:20px;color:var(--text3);">Loading…</td></tr>';
    document.getElementById('pc-results').style.display = 'block';

    // Load banks lazily on first fetch
    if (this._banks.length === 0) await this._loadBanks();

    try {
      const token = pcGetToken();
      const qs    = params.toString();
      const url   = '/api/payments/receipts/pending-cheques' + (qs ? '?' + qs : '');
      const res   = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || 'HTTP ' + res.status);
      }
      const json = await res.json();
      const rows = json.data || json || [];

      const totalAmt = rows.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
      const countBar = document.getElementById('count-bar');
      if (countBar) countBar.textContent = rows.length + ' record(s)';

      this.renderTable(rows, totalAmt);
    } catch (err) {
      if (tbody) tbody.innerHTML =
        '<tr><td colspan="21" style="text-align:center;padding:20px;color:var(--red);">Error: ' + err.message + '</td></tr>';
    }
  },

  _badgeClass(status) {
    return {
      pending:   'badge-pending',
      deposited: 'badge-deposited',
      cleared:   'badge-cleared',
      bounced:   'badge-bounced',
      on_hold:   'badge-on_hold',
    }[status] || 'badge-pending';
  },

  _badgeLabel(status) {
    return {
      pending:   'Pending',
      deposited: 'Deposited',
      cleared:   'Cleared',
      bounced:   'Bounced',
      on_hold:   'On Hold',
    }[status] || (status || 'Pending');
  },

  renderTable(rows, totalAmt) {
    const tbody = document.getElementById('pc-tbody');
    const tfoot = document.getElementById('pc-tfoot');

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="21" class="empty-state">No records found</td></tr>';
      if (tfoot) tfoot.style.display = 'none';
      return;
    }

    const bankOptions   = this._banks.map(b =>
      '<option value="' + b.id + '">' + (b.bank_name || b.account_name || b.name || b.id) + '</option>'
    ).join('');

    const bounceOptions = this.BOUNCE_REASONS.map(r =>
      '<option value="' + r + '">' + r + '</option>'
    ).join('');

    tbody.innerHTML = rows.map((r, i) => {
      const depositVal = r.deposit_date  ? r.deposit_date.split('T')[0]  : '';
      const clearVal   = r.clearing_date ? r.clearing_date.split('T')[0] : '';
      const amount     = r.amount || 0;
      const chequeNo   = r.cheque_no || r.receipt_number || '';
      const receiptNo  = r.receipt_number || '';
      const consId     = r.consumer_id || '';

      return '<tr data-id="' + r.id + '" data-status="' + r.status + '">' +
        '<td><input type="checkbox" class="pc-cb" value="' + r.id + '" onchange="PC._rowCheck(this)"></td>' +
        '<td>' + (i + 1) + '</td>' +
        '<td style="color:var(--text);font-weight:500;">' + (r.registration_number || '—') + '</td>' +
        '<td><a href="/api/consumers/' + consId + '/applicant-file?token=' + pcGetToken() + '" target="_blank" style="color:var(--teal);text-decoration:none;font-weight:600;cursor:pointer" title="View Applicant File">' + (r.consumer_name || '—') + '</a></td>' +
        '<td>' + (r.unit_address || '—') + '</td>' +
        '<td>' + (r.tower_name || '—') + '</td>' +
        '<td>' + (r.bank_name || '—') + '</td>' +
        '<td>' + (r.payment_method || '—') + '</td>' +
        '<td style="font-weight:500;">' + (chequeNo || '—') + '</td>' +
        '<td style="text-align:right;">' + pcFmtAmt(amount) + '</td>' +
        '<td>' + (receiptNo || '—') + '</td>' +
        '<td>' + pcFmtDate(r.receipt_date) + '</td>' +
        '<td>' + pcFmtDate(r.cheque_date) + '</td>' +
        '<td><input type="date" class="pc-deposit-date" data-id="' + r.id + '" value="' + depositVal + '"></td>' +
        '<td><input type="date" class="pc-clearing-date" data-id="' + r.id + '" value="' + clearVal + '"></td>' +
        '<td>' + (r.company_name || '—') + '</td>' +
        '<td><span class="badge ' + this._badgeClass(r.status) + '">' + this._badgeLabel(r.status) + '</span></td>' +
        '<td><select class="pc-clearing-bank" data-id="' + r.id + '"><option value="">-Select Bank-</option>' + bankOptions + '</select></td>' +
        '<td><select class="pc-bounce-reason" data-id="' + r.id + '"><option value="">--Select--</option>' + bounceOptions + '</select></td>' +
        '<td style="max-width:130px;white-space:normal;word-break:break-word;">' + (r.hold_remark || '—') + '</td>' +
        '<td>' + (r.status === 'on_hold'
          ? '<button class="btn-hold-link" style="color:var(--red);" onclick="PC.handleRelease(\'' + r.id + '\')">Release</button>'
          : ['cleared','bounced','cancelled'].includes(r.status)
            ? '—'
            : '<button class="btn-hold-link" onclick="PC.handleHold(\'' + r.id + '\')">Hold</button>') + '</td>' +
        '</tr>';
    }).join('');

    // Restore existing clearing_bank_id
    rows.forEach(r => {
      if (r.clearing_bank_id) {
        const sel = document.querySelector('.pc-clearing-bank[data-id="' + r.id + '"]');
        if (sel) sel.value = r.clearing_bank_id;
      }
    });

    // Total row
    if (tfoot) {
      tfoot.style.display = '';
      const totalCell = document.getElementById('pc-total-amt');
      if (totalCell) totalCell.textContent = pcFmtAmt(totalAmt);
    }
  },

  _rowCheck(cb) {
    const row = cb.closest('tr');
    if (row) row.classList.toggle('selected', cb.checked);
  },

  selectAll(cb) {
    document.querySelectorAll('.pc-cb').forEach(c => {
      c.checked = cb.checked;
      this._rowCheck(c);
    });
  },

  _getSelected() {
    return [...document.querySelectorAll('.pc-cb:checked')].map(c => c.value);
  },

  async handleClear() {
    const ids = this._getSelected();
    if (!ids.length) { alert('Please select at least one cheque to clear.'); return; }

    const token = pcGetToken();
    let success = 0, failed = 0, failMsgs = [];

    for (const id of ids) {
      const rowStatus = document.querySelector('tr[data-id="' + id + '"]')?.dataset?.status;
      if (['cleared','bounced','cancelled'].includes(rowStatus)) continue;

      const clearingDate   = document.querySelector('.pc-clearing-date[data-id="' + id + '"]')?.value || '';
      const clearingBankId = document.querySelector('.pc-clearing-bank[data-id="' + id + '"]')?.value || '';
      const body = {};
      if (clearingDate)   body.clearing_date    = clearingDate;
      if (clearingBankId) body.clearing_bank_id = clearingBankId;

      try {
        const res = await fetch('/api/payments/receipts/' + id + '/clear', {
          method: 'PATCH',
          headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.ok) { success++; } else {
          const j = await res.json().catch(() => ({}));
          failed++;
          failMsgs.push(j.message || j.error || 'HTTP ' + res.status);
        }
      } catch (err) { failed++; failMsgs.push(err.message); }
    }

    let msg = 'Clear complete. Success: ' + success + ', Failed: ' + failed + '.';
    if (failMsgs.length) msg += '\n\nErrors:\n' + failMsgs.join('\n');
    alert(msg);
    this.fetchCheques();
  },

  async handleBounce() {
    const ids = this._getSelected();
    if (!ids.length) { alert('Please select at least one cheque to bounce.'); return; }

    const token = pcGetToken();
    let success = 0, failed = 0, noReason = 0, failMsgs = [];

    for (const id of ids) {
      const rowStatus = document.querySelector('tr[data-id="' + id + '"]')?.dataset?.status;
      if (['cleared','bounced','cancelled'].includes(rowStatus)) continue;

      const reason = document.querySelector('.pc-bounce-reason[data-id="' + id + '"]')?.value || '';
      if (!reason) { noReason++; continue; }

      try {
        const res = await fetch('/api/payments/receipts/' + id + '/bounce', {
          method: 'PATCH',
          headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        });
        if (res.ok) { success++; } else {
          const j = await res.json().catch(() => ({}));
          failed++;
          failMsgs.push(j.message || j.error || 'HTTP ' + res.status);
        }
      } catch (err) { failed++; failMsgs.push(err.message); }
    }

    let msg = 'Bounce complete. Success: ' + success + ', Failed: ' + failed + '.';
    if (noReason) msg += '\n' + noReason + ' row(s) skipped — no bounce reason selected.';
    if (failMsgs.length) msg += '\n\nErrors:\n' + failMsgs.join('\n');
    alert(msg);
    this.fetchCheques();
  },

  handleHold(receiptId) {
    this._holdReceiptId = receiptId;
    const ta = document.getElementById('pc-hold-remark');
    if (ta) ta.value = '';
    document.getElementById('pc-hold-modal').classList.add('active');
    if (ta) setTimeout(() => ta.focus(), 50);
  },

  closeModal() {
    document.getElementById('pc-hold-modal').classList.remove('active');
    this._holdReceiptId = null;
  },

  async submitHold() {
    const remark = (document.getElementById('pc-hold-remark')?.value || '').trim();
    if (!remark) { alert('Hold remark is required.'); return; }

    const token = pcGetToken();
    try {
      const res = await fetch('/api/payments/receipts/' + this._holdReceiptId + '/hold', {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ hold_remark: remark }),
      });
      if (res.ok) {
        alert('Receipt hold successfully.');
        this.closeModal();
        this.fetchCheques();
      } else {
        const j = await res.json().catch(() => ({}));
        alert('Failed: ' + (j.message || j.error || 'HTTP ' + res.status));
      }
    } catch (err) { alert('Error: ' + err.message); }
  },

  async handleRelease(receiptId) {
    if (!receiptId) return;
    if (!confirm('Release this cheque from hold?\nStatus will return to Pending.')) return;

    const token = pcGetToken();
    try {
      const res = await fetch('/api/payments/receipts/' + receiptId + '/release-hold', {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        alert('Cheque released from hold. Status returned to Pending.');
        this.fetchCheques();
      } else {
        const j = await res.json().catch(() => ({}));
        alert('Failed: ' + (j.error || 'HTTP ' + res.status));
      }
    } catch (err) { alert('Error: ' + err.message); }
  },

  _openConsumer(consumerId) {
    if (!consumerId || consumerId === 'undefined' || consumerId === 'null') return;
    window.location.href = '/';
  },
};

document.addEventListener('DOMContentLoaded', () => PC.init());
