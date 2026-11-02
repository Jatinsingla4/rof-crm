// ROF CRM — Payment Plans (Set Projects). A plan is a list of rows (booking, installments, PLC, other charge, possession).
// Booking turns each row into a demand: price x percentage, so the rows must add up to 100%.
// Uses the Set Master pieces (SM.ask, SM.run, SM.empty, SM.openForm) and its stylesheet.
// super_admin and project_manager add and change; only super_admin deletes. A plan that bookings use is read only.

const PLX = { projects: [], projectId: '', plans: [], plan: null, rows: [], addons: [], pcts: {} };
const px = (s) => Utils.esc(s);
const TYPES = [
  { value: 'booking', label: 'Booking amount' }, { value: 'installment', label: 'Installment' },
  { value: 'plc', label: 'PLC charge' }, { value: 'possession', label: 'On possession' }, { value: 'other_charge', label: 'Other charge (fixed amount)' },
];
const TYPE_LABEL = Object.fromEntries(TYPES.map((t) => [t.value, t.label.replace(' (fixed amount)', '')]));
const pct = (n) => `${Number(n.toFixed(3))}%`;
const inr = (n) => '₹ ' + Number(n).toLocaleString('en-IN');

Pages.paymentPlans = async function (params = {}) {
  PLX.can = Permissions.isSuperAdmin() || (Auth.getUser() || {}).role === 'project_manager';
  PLX.admin = Permissions.isSuperAdmin();
  document.getElementById('content').innerHTML = `
    <div class="sm-head"><h1>Payment Plans</h1><p>How a customer pays: the booking amount, the installments and when each is due. Pick the plan while booking.</p></div>
    <div class="sm"><section id="sm-main" style="grid-column:1/-1"><div class="sm-empty">Loading...</div></section></div>`;
  const el = document.getElementById('sm-main');
  try {
    PLX.projects = (await Api.get('/projects')).data || [];
  } catch (e) { return el.innerHTML = SM.empty('Could not load', e.message); }
  if (!PLX.projects.length) return el.innerHTML = SM.empty('No projects yet', 'Create a project first (Set Projects, Create Project). Plans belong to a project.');
  PLX.projectId = PLX.projects.some((p) => p.id === params.project) ? params.project : (PLX.projects.some((p) => p.id === PLX.projectId) ? PLX.projectId : PLX.projects[0].id);
  if (params.plan) await PLX.openPlan(el, params.plan); else { await PLX.list(el); if (params.new && PLX.can) PLX.newPlan(); }
};

PLX.projectPicker = () => `<select class="sm-input" id="plx-project" style="max-width:320px">${PLX.projects.map((p) =>
  `<option value="${px(p.id)}"${p.id === PLX.projectId ? ' selected' : ''}>${px(p.name)}</option>`).join('')}</select>`;
PLX.go = (plan) => {
  const params = plan ? { project: PLX.projectId, plan } : { project: PLX.projectId };
  // Setting the same hash fires no event, so a save on the page we are already on used to leave the old data showing
  if (window.location.hash === '#/payment-plans?' + new URLSearchParams(params).toString()) Router.dispatch();
  else Router.navigate('/payment-plans', params);
};
PLX.badge = (p) => (p.complete
  ? '<span class="sm-tag sm-tag--ok">Complete · 100%</span>'
  : `<span class="sm-tag sm-tag--warn">${pct(p.total_pct)} · ${p.rows ? 'cannot be booked yet' : 'empty'}</span>`);

// ---------------------------------------------------------------------------
// The plans of one project
// ---------------------------------------------------------------------------
PLX.list = async (el) => {
  try { PLX.plans = (await Api.get(`/projects/${PLX.projectId}/plans`)).data || []; } catch (e) { return el.innerHTML = SM.empty('Could not load', e.message); }
  el.innerHTML = `<div class="sm-panel">
    <div class="sm-panel-h"><div><div class="sm-panel-t">Plans</div><div class="sm-panel-s">${SM.plural(PLX.plans.length, 'plan')} in this project. Only a plan that adds up to 100% can be chosen while booking.</div></div>
      <div class="sm-tools">${PLX.projectPicker()}${PLX.can ? '<button class="sm-btn sm-btn--primary" data-act="new">New plan</button>' : ''}</div></div>
    ${PLX.plans.length ? `<div class="sm-scroll" style="max-height:none"><table class="sm-tbl"><thead><tr><th>Plan</th><th>Type</th><th class="num">Rows</th><th>Total</th><th class="num">Bookings</th><th></th></tr></thead><tbody>
      ${PLX.plans.map((p) => `<tr data-row><td><a href="javascript:void 0" data-act="open" data-plan="${px(p.plan_name)}" style="font-weight:700;color:inherit;text-decoration:none">${px(p.plan_name)}</a>${p.description ? `<div class="sm-panel-s">${px(p.description)}</div>` : ''}${p.timely_discount ? `<div class="sm-panel-s">${px(p.discount_pct)}% timely discount: off an installment paid in full by its due date</div>` : ''}</td><td>${px(p.plan_type || 'Time Linked')}</td><td class="num">${p.rows}</td><td>${PLX.badge(p)}</td><td class="num">${p.bookings}</td>
        <td class="act"><button class="sm-btn sm-btn--quiet" data-act="open" data-plan="${px(p.plan_name)}">${PLX.can && !p.bookings ? 'Open and edit' : 'Open'}</button>
        ${PLX.can ? `<button class="sm-btn sm-btn--quiet" data-act="details" data-plan="${px(p.plan_name)}">Type and note</button>` : ''}
        ${PLX.can ? `<button class="sm-btn sm-btn--quiet" data-act="copy" data-plan="${px(p.plan_name)}">Copy</button>` : ''}
        ${PLX.admin ? `<button class="sm-btn sm-btn--quiet sm-btn--danger" data-act="del" data-plan="${px(p.plan_name)}">Delete</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : SM.empty('No plans in this project', PLX.can ? 'Make the first plan. The usual 9-row schedule is one click.' : 'Ask a project manager to set one up.')}</div>`;
  el.querySelector('#plx-project').onchange = (e) => { PLX.projectId = e.target.value; PLX.go(); };
  el.onclick = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'new') PLX.newPlan();
    if (b.dataset.act === 'open') PLX.go(b.dataset.plan);
    if (b.dataset.act === 'copy') PLX.copyPlan(b.dataset.plan);
    if (b.dataset.act === 'details') PLX.planDetails(b.dataset.plan);
    if (b.dataset.act === 'del') PLX.deletePlan(b.dataset.plan);
  };
};

PLX.newPlan = () => {
  SM.openForm({
    title: 'New plan', submit: 'Create',
    fields: [
      { key: 'plan_name', label: 'Plan name', required: true, maxlength: 100, placeholder: 'e.g. CLP 30:70 or Standard AHP Plan' },
      { key: 'plan_type', label: 'Plan type', type: 'select', options: ['Time Linked', 'Construction Linked', 'Down Payment', 'Flexi'].map((x) => ({ value: x, label: x })), hint: 'Time Linked: dues by date. Construction Linked: dues by stage. Down Payment: most is paid up front. Flexi: mixed.' },
      { key: 'description', label: 'Note', maxlength: 500, placeholder: 'Optional, shown in the plan list' },
      { key: 'timely', label: 'Timely discount', type: 'select', options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes: a discount for paying an installment on time' }], hint: 'The customer gets the discount % off an installment paid in full by its due date, as a credit note. A customer can have his own % in Set Projects, Timely discount.' },
      { key: 'discount_pct', label: 'Discount %', placeholder: 'e.g. 2.5', hint: 'Needed when timely discount is Yes.' },
      { key: 'start', label: 'Start from', type: 'select', options: [{ value: 'empty', label: 'An empty plan (I add the rows)' }, { value: 'standard', label: 'The usual 9-row schedule (5 + 20 + 6 x 12.5 + possession)' }].concat(PLX.plans.filter((p) => p.rows).map((p) => ({ value: 'copy:' + p.plan_name, label: 'A copy of ' + p.plan_name }))), hint: 'You can change every row afterwards.' },
    ],
    values: { start: PLX.plans.length ? 'empty' : 'standard', plan_type: 'Time Linked', timely: 'no' },
    onSubmit: async (v) => {
      if (v.timely === 'yes' && !(Number(v.discount_pct) > 0 && Number(v.discount_pct) <= 100)) throw new Error('Enter a Discount % more than 0 and at most 100, or set Timely discount to No');
      const start = v.start || 'empty';
      if (start === 'standard') await Api.post(`/projects/${PLX.projectId}/plans/standard`, { plan_name: v.plan_name });
      else if (start.startsWith('copy:')) await Api.post(`/projects/${PLX.projectId}/plans/copy`, { from: start.slice(5), to: v.plan_name });
      else if (PLX.plans.some((p) => p.plan_name.toLowerCase() === v.plan_name.toLowerCase())) throw new Error('A plan with this name already exists');
      const timely = v.timely === 'yes', head = { plan_name: v.plan_name, plan_type: v.plan_type, description: v.description || null, ...(timely ? { timely_discount: true, discount_pct: v.discount_pct } : {}) };
      if (start === 'empty') { if (v.plan_type !== 'Time Linked' || v.description || timely) PLX.pendingHeader = head; }
      else if (v.plan_type !== 'Time Linked' || v.description || timely) await Api.put(`/projects/${PLX.projectId}/plans/header`, head);
      PLX.go(v.plan_name);
    },
  });
};

PLX.planDetails = (name) => {
  const p = PLX.plans.find((x) => x.plan_name === name) || {};
  SM.openForm({
    title: `Type and note: "${name}"`, submit: 'Save',
    fields: [{ key: 'plan_type', label: 'Plan type', type: 'select', options: ['Time Linked', 'Construction Linked', 'Down Payment', 'Flexi'].map((x) => ({ value: x, label: x })) }, { key: 'description', label: 'Note', maxlength: 500 },
      { key: 'timely', label: 'Timely discount', type: 'select', options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes: a discount for paying an installment on time' }] },
      { key: 'discount_pct', label: 'Discount %', placeholder: 'e.g. 2.5', hint: 'Off an installment paid in full by its due date. Needed when timely discount is Yes.' }],
    values: { plan_type: p.plan_type || 'Time Linked', description: p.description || '', timely: p.timely_discount ? 'yes' : 'no', discount_pct: p.discount_pct ? String(p.discount_pct) : '' },
    onSubmit: async (v) => { await Api.put(`/projects/${PLX.projectId}/plans/header`, { plan_name: name, plan_type: v.plan_type, description: v.description || null, timely_discount: v.timely === 'yes', discount_pct: v.timely === 'yes' ? v.discount_pct : (v.discount_pct || 0) }); Utils.success('Saved'); PLX.go(); },
  });
};

PLX.copyPlan = (name) => SM.openForm({
  title: `Copy "${name}"`, submit: 'Copy',
  fields: [
    { key: 'to', label: 'Name of the copy', required: true, maxlength: 100 },
    { key: 'toProjectId', label: 'Into project', type: 'select', options: PLX.projects.map((p) => ({ value: p.id, label: p.name })), hint: 'Add-on percentages are copied only inside the same project.' },
  ],
  values: { to: `${name} (copy)`, toProjectId: PLX.projectId },
  onSubmit: async (v) => {
    await Api.post(`/projects/${PLX.projectId}/plans/copy`, { from: name, to: v.to, toProjectId: v.toProjectId || PLX.projectId });
    Utils.success('Plan copied');
    PLX.projectId = v.toProjectId || PLX.projectId;
    PLX.go(v.to);
  },
});

PLX.deletePlan = async (name) => {
  if (!(await SM.ask({ title: `Delete "${name}"?`, text: 'All its rows and add-on percentages are removed. Plans that bookings use cannot be deleted.' }))) return;
  if (await SM.run(() => Api.delete(`/projects/${PLX.projectId}/plans?planName=${encodeURIComponent(name)}`), 'Plan deleted')) Pages.paymentPlans({ project: PLX.projectId });
};

// ---------------------------------------------------------------------------
// One plan
// ---------------------------------------------------------------------------
PLX.openPlan = async (el, name) => {
  try {
    const [rows, plans, addons] = await Promise.all([
      Api.get(`/projects/${PLX.projectId}/plan-templates?planName=${encodeURIComponent(name)}`),
      Api.get(`/projects/${PLX.projectId}/plans`),
      Api.get(`/addon-charges/master?projectId=${PLX.projectId}`).catch(() => ({ data: [] })),
    ]);
    PLX.rows = rows.data || [];
    PLX.plan = (plans.data || []).find((p) => p.plan_name === name) || { plan_name: name, rows: 0, total_pct: 0, complete: false, bookings: 0 };
    PLX.addons = (addons.data || []).filter((a) => a.is_active !== false);
  } catch (e) { return el.innerHTML = SM.empty('Could not load', e.message); }
  PLX.pcts = {};
  await Promise.all(PLX.rows.map(async (r) => {
    try { PLX.pcts[r.id] = (await Api.get(`/projects/${PLX.projectId}/plan-templates/${r.id}/addon-charges`)).data || []; } catch { PLX.pcts[r.id] = []; }
  }));
  PLX.paint(el);
};

PLX.paint = (el) => {
  const p = PLX.plan, frozen = p.bookings > 0, edit = PLX.can && !frozen;
  const total = PLX.rows.reduce((s, r) => s + (Number(r.percentage) || 0), 0);
  const flat = PLX.rows.reduce((s, r) => s + (Number(r.flat_amount_inr) || 0), 0);
  const left = 100 - total, ok = Math.abs(left) < 0.001;
  const proj = PLX.projects.find((x) => x.id === PLX.projectId);
  el.innerHTML = `<div class="sm-panel">
    <div class="sm-panel-h"><div><div class="sm-panel-t"><a href="javascript:void 0" data-act="back" style="text-decoration:none">Plans</a> / ${px(p.plan_name)}</div>
      <div class="sm-panel-s">${px(proj ? proj.name : '')}</div></div>
      <div class="sm-tools">${PLX.can ? '<button class="sm-btn" data-act="copy">Copy plan</button>' : ''}${edit ? '<button class="sm-btn sm-btn--primary" data-act="add">Add row</button>' : ''}</div></div>
    <div class="plx-total ${ok ? 'ok' : total > 100 ? 'over' : 'part'}" style="margin:0 0 14px;padding:12px 14px;border-radius:10px;border:1px solid var(--border,#ddd)">
      <b>${pct(total)}</b> of 100% ${ok ? '— complete, this plan can be chosen while booking.' : total > 100 ? '— over 100%.' : `— ${pct(left)} still to add. A plan must add up to 100% before it can be booked.`}
      ${flat ? `<span class="sm-muted"> · fixed charges ${inr(flat)}</span>` : ''}</div>
    ${frozen ? `<div class="sm-note" style="margin:0 0 14px;padding:10px 14px;border-radius:10px;border:1px solid var(--border,#ddd)"><b>${p.bookings} booking${p.bookings === 1 ? '' : 's'} use this plan</b>, so its numbers are fixed. To change them, make a copy and change the copy.</div>` : ''}
    ${PLX.rows.length ? `<div class="sm-scroll" style="max-height:none"><table class="sm-tbl"><thead><tr><th class="num">#</th><th>Name</th><th>Type</th><th class="num">Percentage / amount</th><th class="num">Due after booking</th><th>Add-on %</th><th>Notes</th><th></th></tr></thead><tbody>
      ${PLX.rows.map((r) => {
        const a = (PLX.pcts[r.id] || []).filter((x) => Number(x.pct) > 0);
        return `<tr><td class="num">${r.installment_index}</td><td><b>${px(r.installment_name)}</b></td><td>${px(TYPE_LABEL[r.installment_type] || r.installment_type)}</td>
        <td class="num">${r.installment_type === 'other_charge' ? inr(r.flat_amount_inr || 0) : pct(Number(r.percentage) || 0)}</td>
        <td class="num">${Number(r.due_date_offset_days) ? r.due_date_offset_days + ' days' : r.installment_type === 'possession' ? 'On possession' : 'On booking'}</td>
        <td>${a.length ? a.map((x) => `${px(x.charge_name)} ${pct(Number(x.pct))}`).join('<br>') : '<span class="sm-muted">—</span>'}</td>
        <td class="sm-muted">${px(r.notes || '')}</td>
        <td class="act">${edit ? `<button class="sm-btn sm-btn--quiet" data-act="edit" data-id="${px(r.id)}">Edit</button>
          ${PLX.addons.length && r.installment_type !== 'other_charge' ? `<button class="sm-btn sm-btn--quiet" data-act="addon" data-id="${px(r.id)}">Add-on %</button>` : ''}
          ${PLX.admin ? `<button class="sm-btn sm-btn--quiet sm-btn--danger" data-act="del" data-id="${px(r.id)}">Delete</button>` : ''}` : ''}</td></tr>`;
      }).join('')}</tbody></table></div>` : SM.empty('No rows yet', edit ? 'Add the booking amount first, then the installments.' : '')}</div>`;
  el.onclick = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const r = PLX.rows.find((x) => x.id === b.dataset.id);
    if (b.dataset.act === 'back') PLX.go();
    if (b.dataset.act === 'add') PLX.rowForm(null);
    if (b.dataset.act === 'edit') PLX.rowForm(r);
    if (b.dataset.act === 'addon') PLX.addonForm(r);
    if (b.dataset.act === 'copy') PLX.copyPlan(p.plan_name);
    if (b.dataset.act === 'del') PLX.deleteRow(r);
  };
};

PLX.reload = () => PLX.openPlan(document.getElementById('sm-main'), PLX.plan.plan_name);

PLX.rowForm = (r) => {
  const used = new Set(PLX.rows.map((x) => x.installment_index));
  let next = 1; while (used.has(next)) next++;
  SM.openForm({
    title: r ? `Edit "${r.installment_name}"` : 'Add row', submit: r ? 'Save' : 'Add',
    fields: [
      { key: 'installment_name', label: 'Name', required: true, maxlength: 100, placeholder: 'e.g. On Allotment' },
      { key: 'installment_type', label: 'Type', type: 'select', required: true, options: TYPES },
      { key: 'percentage', label: 'Percentage of the price', maxlength: 8, placeholder: 'e.g. 12.5', hint: 'For every type except Other charge. Up to 3 decimals.' },
      { key: 'flat_amount_inr', label: 'Fixed amount (₹)', maxlength: 12, hint: 'Only for Other charge.' },
      { key: 'due_date_offset_days', label: 'Due after booking (days)', maxlength: 4, placeholder: '0 = on booking' },
      { key: 'installment_index', label: 'Order number', maxlength: 3, hint: 'The rows run in this order. Each number is used once.' },
      { key: 'notes', label: 'Notes', type: 'textarea', maxlength: 500 },
    ],
    values: r ? { ...r, percentage: r.percentage ?? '', flat_amount_inr: r.flat_amount_inr ?? '', due_date_offset_days: r.due_date_offset_days ?? 0 } : { installment_type: 'installment', due_date_offset_days: 0, installment_index: next },
    onSubmit: async (v) => {
      const body = { ...v };
      if (v.installment_type === 'other_charge') delete body.percentage; else delete body.flat_amount_inr;
      for (const k of ['percentage', 'flat_amount_inr', 'due_date_offset_days', 'installment_index']) if (body[k] === '') body[k] = k === 'percentage' || k === 'flat_amount_inr' ? null : undefined;
      if (r) await Api.patch(`/projects/${PLX.projectId}/plan-templates/${r.id}`, body);
      else await Api.post(`/projects/${PLX.projectId}/plan-templates`, { ...body, plan_name: PLX.plan.plan_name });
      // A plan made empty has no rows to hang its type and note on; they are saved with its first row
      if (!r && PLX.pendingHeader && PLX.pendingHeader.plan_name.toLowerCase() === PLX.plan.plan_name.toLowerCase()) { await Api.put(`/projects/${PLX.projectId}/plans/header`, PLX.pendingHeader); PLX.pendingHeader = null; }
      Utils.success(r ? 'Row saved' : 'Row added');
      await PLX.reload();
    },
  });
};

PLX.deleteRow = async (r) => {
  if (!(await SM.ask({ title: `Delete "${r.installment_name}"?`, text: Number(r.percentage) > 0 || Number(r.flat_amount_inr) > 0 ? 'The plan will then add up to less than 100% until you add another row.' : 'This row takes no share of the price, so the plan total stays the same.' }))) return;
  if (await SM.run(() => Api.delete(`/projects/${PLX.projectId}/plan-templates/${r.id}`), 'Row deleted')) await PLX.reload();
};

// Add-on charges (Set Projects, Addon Charges) that are billed in parts along this row
PLX.addonForm = (r) => {
  const have = Object.fromEntries((PLX.pcts[r.id] || []).map((x) => [x.charge_master_id, x]));
  SM.openForm({
    title: `Add-on % on "${r.installment_name}"`, submit: 'Save',
    fields: PLX.addons.map((a) => ({ key: a.id, label: a.charge_name, maxlength: 8, hint: 'Share of this add-on charge billed with this row. Over all rows of the plan it can reach 100%.' })),
    values: Object.fromEntries(PLX.addons.map((a) => [a.id, have[a.id] ? Number(have[a.id].pct) : 0])),
    onSubmit: async (v) => {
      for (const a of PLX.addons) {
        const n = v[a.id] === '' ? 0 : v[a.id];
        const was = have[a.id] ? Number(have[a.id].pct) : 0;
        if (Number(n) === was) continue;
        await Api.post(`/projects/${PLX.projectId}/plan-templates/${r.id}/addon-charges`, { charge_master_id: a.id, pct: n });
      }
      Utils.success('Add-on percentages saved');
      await PLX.reload();
    },
  });
};
