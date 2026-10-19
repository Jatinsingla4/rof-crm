// ROF CRM - Set Master: companies and their bank accounts (screen of set-master.js)

(function () {
'use strict';
const SM = window.SM;
const esc = (s) => Utils.esc(s);

SM.co = { sel: null, banks: [], dirty: false };

const gaps = (c) => [
  !c.primary_accounts && 'No primary bank account',
  !c.gstin && 'No GSTIN',
  !c.pan_no && 'No PAN',
  !c.logo_url && 'No logo',
].filter(Boolean);

const mask = (n) => { n = String(n || ''); return n.length > 4 ? 'XXXX' + n.slice(-4) : n; };

SM.screens.companies = (root) => {
  const list = SM.d.companies || [];
  const co = SM.co;
  if (co.sel !== 'new' && !list.some((c) => c.id === co.sel)) co.sel = list[0]?.id || (SM.canCompany() ? 'new' : null);
  root.innerHTML = `<div class="sm-split">
    <div class="sm-panel"><div class="sm-panel-h"><div><div class="sm-panel-t">Companies</div><div class="sm-panel-s">${SM.plural(list.length, 'company', 'companies')}</div></div>
      ${SM.canCompany() ? '<button class="sm-btn sm-btn--primary" data-act="new" data-kind="co">New company</button>' : ''}</div>
      ${list.length ? list.map((c) => { const g = gaps(c); return `<div class="sm-co${c.id === co.sel ? ' on' : ''}" data-pick data-kind="co" data-id="${esc(c.id)}" tabindex="0">
        <b>${esc(c.name)}</b><span>${esc(c.code || '')}${c.code && c.gstin ? ' · ' : ''}${esc(c.gstin || '')}</span>
        <div>${g.length ? g.map((x) => `<span class="sm-tag sm-tag--warn">${esc(x)}</span>`).join('') : '<span class="sm-tag sm-tag--ok">Setup complete</span>'}</div></div>`; }).join('')
        : SM.empty('No companies yet', 'The company details print on every receipt and letter.')}
    </div>
    <div id="sm-co-detail"></div></div>`;
  SM.wire(root, SM.coAction);
  SM.coDetail();
};

SM.coAction = async (kind, id, act) => {
  const co = SM.co;
  if (act === 'pick' || act === 'new') {
    const target = act === 'new' ? 'new' : id;
    if (target === co.sel) return;
    if (co.dirty && !(await SM.ask({ title: 'Discard unsaved changes?', text: 'The company you are editing has changes that are not saved.', ok: 'Discard' }))) return;
    co.sel = target; co.dirty = false; co.banks = [];
    return SM.paint();
  }
};

SM.coDetail = async () => {
  const host = document.getElementById('sm-co-detail');
  const co = SM.co;
  if (!host) return;
  if (!co.sel) { host.innerHTML = `<div class="sm-panel">${SM.empty('No company', 'Only a super admin can add companies.')}</div>`; return; }
  const isNew = co.sel === 'new';
  const c = isNew ? { country: 'India', place_of_supply: 'Haryana' } : (SM.d.companies.find((x) => x.id === co.sel) || {});
  const can = SM.canCompany();
  const ro = can ? '' : 'disabled';
  const f = (name, label, o = {}) => `<div class="sm-field"><label class="sm-label" for="co-${name}">${label}${o.req ? ' <i>*</i>' : ''}</label>
    ${o.area ? `<textarea class="sm-input" id="co-${name}" name="${name}" rows="2" ${ro}>${esc(c[name] || '')}</textarea>`
      : `<input class="sm-input" id="co-${name}" name="${name}" value="${esc(c[name] || '')}" ${o.max ? `maxlength="${o.max}"` : ''} placeholder="${esc(o.ph || '')}" autocomplete="off" ${ro}>`}
    ${o.hint ? `<div class="sm-hint">${esc(o.hint)}</div>` : ''}</div>`;
  host.innerHTML = `<form class="sm-panel" id="sm-co-form" novalidate>
    <div class="sm-panel-h"><div><div class="sm-panel-t">${isNew ? 'New company' : esc(c.name)}</div>
      <div class="sm-panel-s">${isNew ? 'Save the company first, then add its bank accounts and logo.' : 'These details print on receipts, demand letters and invoices.'}</div></div></div>
    <div class="sm-section"><h3>Identity</h3>
      <div class="sm-grid3">${f('name', 'Company name', { req: true, max: 255 })}${f('code', 'Code', { max: 100 })}${f('group_name', 'Group', { max: 255 })}</div></div>
    <div class="sm-section"><h3>Registered address</h3>
      ${f('address1', 'Address line 1', { max: 500 })}
      <div class="sm-grid2">${f('address2', 'Address line 2')}${f('address3', 'Address line 3')}</div>
      <div class="sm-grid3">${f('city', 'City', { max: 100 })}${f('state', 'State', { max: 100 })}${f('country', 'Country', { max: 100 })}</div>
      <div class="sm-grid2">${f('pin_code', 'PIN code', { max: 20, ph: '122001' })}${f('reg_address', 'Registered office (if different)', { area: true })}</div></div>
    <div class="sm-section"><h3>Contact</h3>
      <div class="sm-grid2">${f('phone', 'Phone', { max: 20 })}${f('fax', 'Fax', { max: 20 })}${f('email', 'Email', { max: 255 })}${f('website', 'Website', { max: 255 })}</div></div>
    <div class="sm-section"><h3>Tax</h3>
      <div class="sm-grid3">${f('gstin', 'GSTIN', { max: 50, ph: '06ABCDE1234F1Z5', hint: '15 characters' })}${f('pan_no', 'PAN', { max: 50, ph: 'ABCDE1234F' })}${f('cin', 'CIN', { max: 50, hint: '21 characters' })}</div>
      <div class="sm-grid3">${f('place_of_supply', 'Place of supply', { max: 100 })}${f('service_tax_no', 'Service tax no.', { max: 50 })}${f('vat_no', 'VAT no.', { max: 50 })}</div>
      ${f('payable_at', 'Cheques payable at', { max: 100, ph: 'Gurugram' })}</div>
    ${isNew ? '' : `<div class="sm-section"><h3>Bank accounts</h3><div id="sm-co-banks"><div class="sm-muted">Loading...</div></div></div>
      <div class="sm-section"><h3>Logo</h3><div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
        <div class="sm-logo">${c.logo_url ? `<img src="${esc(c.logo_url)}" alt="Company logo">` : '<span class="sm-muted" style="font-size:11px">No logo</span>'}</div>
        ${can ? `<div><input type="file" id="co-logo" accept="image/png,image/jpeg,image/gif" aria-label="Logo file"> <button class="sm-btn" type="button" id="co-logo-up">Upload logo</button>
          <div class="sm-hint">PNG, JPG or GIF, up to 2 MB.</div></div>` : ''}</div></div>`}
    <div class="sm-err" id="co-err" role="alert" style="padding:0 16px"></div>
    ${can ? `<div class="sm-savebar"><span class="sm-muted" id="co-dirty"></span><span class="sm-tools">
      ${isNew ? '' : '<button class="sm-btn" type="button" id="co-active">Set as active company</button>'}
      <button class="sm-btn sm-btn--primary" type="submit">${isNew ? 'Create company' : 'Save changes'}</button></span></div>` : ''}
  </form>`;
  const form = host.querySelector('#sm-co-form');
  form.oninput = () => { co.dirty = true; host.querySelector('#co-dirty') && (host.querySelector('#co-dirty').textContent = 'Unsaved changes'); };
  form.onsubmit = (e) => { e.preventDefault(); SM.coSave(form, isNew); };
  if (!isNew) {
    host.querySelector('#co-active')?.addEventListener('click', () => SM.coActive(c));
    host.querySelector('#co-logo-up')?.addEventListener('click', () => SM.coLogo(c.id));
    SM.coBanks(c.id);
  }
};

SM.coSave = async (form, isNew) => {
  const err = form.querySelector('#co-err');
  const body = {};
  [...form.elements].forEach((el) => { if (el.name) body[el.name] = el.value.trim(); });
  if (!body.name) { err.textContent = 'Company name is required'; form.elements.name.focus(); return; }
  err.textContent = '';
  const btn = form.querySelector('[type=submit]');
  btn.disabled = true;
  try {
    const res = isNew ? await Api.post('/companies', body) : await Api.put(`/companies/${SM.co.sel}`, body);
    SM.co.dirty = false;
    if (isNew) SM.co.sel = res.data.id;
    Utils.success(isNew ? 'Company created. Add its bank accounts below.' : 'Saved');
    await SM.reload('companies');
  } catch (e) { err.textContent = e.message; btn.disabled = false; }
};

SM.coActive = async (c) => {
  const yes = await SM.ask({ title: `Make ${c.name} the active company?`, ok: 'Make active', danger: false,
    text: 'Demand letters, receipts and allotment letters will print this company. The change is recorded in the audit log.' });
  if (yes) await SM.run(() => Api.put(`/companies/${c.id}`, { write_to_global_settings: true }), `${c.name} is now the active company`);
};

SM.coLogo = async (id) => {
  const file = document.getElementById('co-logo')?.files[0];
  if (!file) { Utils.warn('Choose a file first'); return; }
  if (file.size > 2 * 1024 * 1024) { Utils.warn('File is too large. Maximum is 2 MB'); return; }
  const fd = new FormData();
  fd.append('logo', file);
  try {
    const res = await fetch(`${ROF.API_BASE}/companies/${id}/logo`, { method: 'POST', headers: { Authorization: `Bearer ${Auth.getToken()}` }, body: fd });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Upload failed');
    Utils.success('Logo uploaded');
    await SM.reload('companies');
  } catch (e) { Utils.error(e.message); }
};

// ---------------------------------------------------------------------------
// Bank accounts of the selected company
// ---------------------------------------------------------------------------
SM.coBanks = async (id) => {
  const host = document.getElementById('sm-co-banks');
  if (!host) return;
  const rows = (await SM.get(`/companies/${id}/bank-accounts`)) || [];
  if (SM.co.sel !== id || !document.getElementById('sm-co-banks')) return;
  SM.co.banks = rows;
  const can = SM.canCompany();
  host.innerHTML = `${rows.length ? `<table class="sm-tbl" style="margin:0 -16px;width:calc(100% + 32px)"><thead><tr><th>Bank</th><th>Account</th><th>IFSC</th><th>Branch</th><th></th></tr></thead><tbody>
    ${rows.map((b) => `<tr><td>${esc(b.bank_name)}${b.account_name ? `<div class="sm-muted" style="font-size:12px">${esc(b.account_name)}</div>` : ''}</td>
      <td class="mono">${esc(mask(b.account_number))}</td><td class="mono">${esc(b.ifsc_code || '-')}</td><td>${esc(b.branch || '-')}</td>
      <td class="act" style="white-space:nowrap">${b.is_primary ? '<span class="sm-tag sm-tag--ok">Primary</span>' : ''}
        ${can ? `<button type="button" class="sm-btn sm-btn--quiet" data-bank="edit" data-id="${esc(b.id)}" style="opacity:1">Edit</button>
        <button type="button" class="sm-btn sm-btn--quiet sm-btn--danger" data-bank="del" data-id="${esc(b.id)}" style="opacity:1">Delete</button>` : ''}</td></tr>`).join('')}
    </tbody></table>` : '<div class="sm-muted" style="margin-bottom:10px">No bank accounts yet. Receipts and demand letters need a primary account.</div>'}
    ${can ? '<div style="margin-top:10px"><button type="button" class="sm-btn" data-bank="add">Add bank account</button></div>' : ''}`;
  host.onclick = (e) => {
    const b = e.target.closest('[data-bank]');
    if (b) SM.coBankAction(id, b.dataset.bank, b.dataset.id);
  };
};

SM.coBankAction = async (companyId, act, id) => {
  const row = SM.co.banks.find((b) => b.id === id);
  const url = `/companies/${companyId}/bank-accounts`;
  if (act === 'del') {
    const yes = await SM.ask({ title: `Delete the ${row.bank_name} account?`, text: 'The change is recorded in the audit log.' });
    if (yes && await SM.run(() => Api.delete(`${url}/${id}`), 'Bank account removed')) { await SM.reload('companies'); }
    return;
  }
  const editing = act === 'edit';
  const v = editing ? { bank_name: row.bank_name, account_name: row.account_name, account_number: row.account_number, ifsc_code: row.ifsc_code,
    branch: row.branch, payable_at: row.payable_at, is_primary: row.is_primary ? 'yes' : 'no' } : { is_primary: SM.co.banks.length ? 'no' : 'yes' };
  SM.openForm({
    title: editing ? 'Edit bank account' : 'Add bank account', values: v, submit: editing ? 'Save changes' : 'Add account',
    fields: [
      { key: 'bank_name', label: 'Bank', required: true, maxlength: 200, placeholder: 'HDFC Bank' },
      { key: 'account_name', label: 'Account holder name', maxlength: 200 },
      { key: 'account_number', label: 'Account number', required: true, maxlength: 100 },
      { key: 'ifsc_code', label: 'IFSC', maxlength: 20, placeholder: 'HDFC0001234', hint: '11 characters: 4 letters, 0, then 6 letters or digits' },
      { key: 'branch', label: 'Branch', maxlength: 200 },
      { key: 'payable_at', label: 'Payable at', maxlength: 200 },
      { key: 'is_primary', label: 'Primary account', type: 'select', required: true, options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }],
        hint: 'A company has exactly one primary account. Receipts and letters use it.' },
    ],
    onSubmit: async (x) => {
      const body = { bankName: x.bank_name, accountName: x.account_name, accountNumber: x.account_number, ifscCode: x.ifsc_code,
        branch: x.branch, payableAt: x.payable_at, isPrimary: x.is_primary === 'yes' };
      if (editing) await Api.patch(`${url}/${id}`, body); else await Api.post(url, body);
      Utils.success(editing ? 'Saved' : 'Bank account added');
      await SM.reload('companies');
    },
  });
};

})();
