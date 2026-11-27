"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reraLooksReal = exports.addDays = void 0;
exports.coverageGaps = coverageGaps;
exports.statutoryReadiness = statutoryReadiness;
// Statutory configuration readiness (QA-003, 029, 046, 049). READ ONLY: it looks at what finance has configured and says what is missing or contradictory for a date range.
// Nothing is invented and nothing is repaired. Every item says who has to act: the client's finance team (configuration), the software (a code path that reads another source), or a decision.
const gstin_js_1 = require("./gstin.js");
const MS = 86400000;
const t = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const addDays = (iso, n) => new Date(t(iso) + n * MS).toISOString().slice(0, 10);
exports.addDays = addDays;
// The stretches of [from, to] that no range covers (inclusive days). Ranges may overlap, touch or come in any order.
function coverageGaps(ranges, from, to) {
    const gaps = [];
    let cursor = from; // first day not yet covered
    for (const r of [...ranges].sort((a, b) => a.from.localeCompare(b.from))) {
        if (r.to < cursor)
            continue;
        if (r.from > to)
            break;
        if (r.from > cursor)
            gaps.push({ from: cursor, to: (0, exports.addDays)(r.from, -1) < to ? (0, exports.addDays)(r.from, -1) : to });
        if (r.to >= to)
            return gaps;
        cursor = (0, exports.addDays)(r.to, 1) > cursor ? (0, exports.addDays)(r.to, 1) : cursor;
    }
    if (cursor <= to)
        gaps.push({ from: cursor, to });
    return gaps;
}
const PLACEHOLDER = /^(n\/?a|na|tbd|tba|pending|xx+|0+|-+|test.*)$/i;
const reraLooksReal = (v) => typeof v === 'string' && v.trim().length >= 5 && !PLACEHOLDER.test(v.trim());
exports.reraLooksReal = reraLooksReal;
const item = (key, area, status, owner, message, detail) => ({ key, area, status, owner, message, detail });
async function statutoryReadiness(db, o) {
    const { from, to } = o;
    const [slabs, years, projects] = await Promise.all([
        db.query(`SELECT id, from_date::text AS f, to_date::text AS t FROM gst_slabs WHERE is_active IS NOT FALSE`),
        db.query(`SELECT name, from_date::text AS f, to_date::text AS t, is_active FROM financial_years`),
        db.query(`SELECT p.id, p.name, p.rera_number, c.gstin AS company_gstin, c.name AS company_name FROM projects p LEFT JOIN companies c ON c.id = p.company_id
               WHERE ($1::uuid IS NULL OR p.id = $1::uuid) ORDER BY p.name`, [o.projectId || null]),
    ]);
    // ---- global masters: slabs and financial years cover the range ----
    const globals = [];
    const slabGaps = coverageGaps(slabs.rows.map((r) => ({ from: r.f, to: r.t })), from, to);
    globals.push(slabGaps.length
        ? item('gst_slabs_cover_range', 'GST slabs', 'missing', 'client configuration', `No GST slab covers ${slabGaps.map((g) => `${g.from} to ${g.to}`).join('; ')}. A booking, demand or receipt dated there is refused (no rate is assumed).`, { gaps: slabGaps })
        : item('gst_slabs_cover_range', 'GST slabs', 'ok', null, `GST slabs cover every day from ${from} to ${to}.`));
    const fyGaps = coverageGaps(years.rows.map((r) => ({ from: r.f, to: r.t })), from, to);
    globals.push(fyGaps.length
        ? item('financial_years_cover_range', 'Financial years', 'missing', 'client configuration', `No financial year covers ${fyGaps.map((g) => `${g.from} to ${g.to}`).join('; ')}. A tax invoice dated there is refused.`, { gaps: fyGaps })
        : item('financial_years_cover_range', 'Financial years', 'ok', null, `Financial years cover every day from ${from} to ${to}.`));
    const touched = years.rows.filter((r) => r.t >= from && r.f <= to);
    const inactive = touched.filter((r) => r.is_active === false);
    if (inactive.length)
        globals.push(item('financial_year_active_rule', 'Financial years', 'decision', 'decision', `Tax invoice creation needs the financial year that holds the date to be ACTIVE, and activating a year deactivates the others, so an invoice dated in ${inactive.map((r) => r.name).join(', ')} is refused even though the year exists. Decide whether past years stay open for invoicing, and whether a closed period needs a lock.`, { years: inactive.map((r) => r.name) }));
    globals.push(item('invoice_number_series', 'Tax invoices', 'decision', 'decision', 'The invoice number series is INV/<calendar year>/NNNNN, not tied to the financial year. Decide the series format and whether it restarts each financial year.'));
    // ---- per project ----
    const ids = projects.rows.map((p) => p.id);
    const [pg, hsn, rera, maps] = ids.length ? await Promise.all([
        db.query(`SELECT project_id, gstin, is_active FROM project_gstin WHERE project_id = ANY($1::uuid[])`, [ids]),
        db.query(`SELECT a.project_id, a.charge_type, h.code FROM hsn_sac_code_assign a JOIN hsn_sac_codes h ON h.id = a.hsn_sac_id WHERE a.project_id = ANY($1::uuid[]) AND h.is_active IS NOT FALSE`, [ids]),
        db.query(`SELECT project_id, rera_number FROM project_rera_numbers WHERE project_id = ANY($1::uuid[])`, [ids]),
        db.query(`SELECT project_id, slab_id, charge_type FROM gst_tax_charge_mapping WHERE project_id = ANY($1::uuid[])`, [ids]),
    ]) : [{ rows: [] }, { rows: [] }, { rows: [] }, { rows: [] }];
    const slabsInRange = slabs.rows.filter((r) => r.t >= from && r.f <= to);
    const out = projects.rows.map((p) => {
        const items = [];
        const g = pg.rows.find((r) => r.project_id === p.id);
        if (!g || g.is_active === false)
            items.push(item('project_gstin', 'Seller GSTIN', 'missing', 'client configuration', 'No project GSTIN is configured. A tax invoice for this project is refused.'));
        else if (!(0, gstin_js_1.gstinOk)(String(g.gstin).toUpperCase()))
            items.push(item('project_gstin', 'Seller GSTIN', 'conflict', 'client configuration', `The project GSTIN ${g.gstin} fails the check-character test.`));
        else
            items.push(item('project_gstin', 'Seller GSTIN', 'ok', null, 'Project GSTIN is configured and valid.'));
        const cg = String(p.company_gstin || '').toUpperCase();
        if (!cg)
            items.push(item('company_gstin', 'Seller GSTIN', 'missing', 'client configuration', `The company (${p.company_name || 'none linked'}) has no GSTIN. Demand letters and the allotment documents print it.`));
        else if (!(0, gstin_js_1.gstinOk)(cg))
            items.push(item('company_gstin', 'Seller GSTIN', 'conflict', 'client configuration', `The company GSTIN ${p.company_gstin} fails the check-character test (company GSTINs are saved with a format check only).`));
        if (g && cg && String(g.gstin).slice(0, 2) !== cg.slice(0, 2))
            items.push(item('gstin_state_agree', 'Seller GSTIN', 'conflict', 'client configuration', `The project GSTIN is in state ${String(g.gstin).slice(0, 2)} and the company GSTIN in state ${cg.slice(0, 2)}. Invoices use the project one, letters the company one.`));
        else if (g && cg && String(g.gstin) !== cg)
            items.push(item('gstin_same_value', 'Seller GSTIN', 'note', null, 'The project and the company carry different GSTINs (the same state). Invoices use the project one, letters and receipts the company one.'));
        items.push(!(0, exports.reraLooksReal)(p.rera_number)
            ? item('rera_number', 'RERA', 'missing', 'client configuration', 'The project has no real RERA number (blank or a placeholder). Demand letters refuse to generate.')
            : item('rera_number', 'RERA', 'ok', null, 'The project RERA number is set.'));
        const rr = rera.rows.filter((r) => r.project_id === p.id);
        if (rr.length && !rr.some((r) => String(r.rera_number).trim().toLowerCase() === String(p.rera_number || '').trim().toLowerCase())) {
            items.push(item('rera_tab_unused', 'RERA', 'conflict', 'software', `The GST Configuration RERA tab holds ${rr.map((r) => r.rera_number).join(', ')} but no screen, letter or receipt reads it; they all use the project's own RERA number (${p.rera_number || 'blank'}). Changes made on that tab change nothing.`));
        }
        else if (rr.length)
            items.push(item('rera_tab_unused', 'RERA', 'note', 'software', 'The GST Configuration RERA tab agrees with the project RERA number, but nothing reads the tab itself.'));
        const hs = hsn.rows.filter((r) => r.project_id === p.id);
        items.push(hs.some((r) => r.charge_type === 'BASIC')
            ? item('hsn_sac', 'HSN/SAC', 'ok', null, `HSN/SAC ${hs.find((r) => r.charge_type === 'BASIC').code} is assigned to BASIC; a tax invoice uses it.`)
            : item('hsn_sac', 'HSN/SAC', 'missing', 'client configuration', hs.length ? 'HSN/SAC is assigned for other charge types but not BASIC; a tax invoice uses the first assigned code.' : 'No HSN/SAC is assigned. A tax invoice falls back to the old default 9972, which is not a configured master.'));
        // GST rate mapping for every slab inside the range
        const mine = maps.rows.filter((r) => r.project_id === p.id);
        const noBasic = slabsInRange.filter((s) => !mine.some((m) => m.slab_id === s.id && m.charge_type === 'BASIC'));
        items.push(noBasic.length
            ? item('gst_mapping_basic', 'GST rates', 'missing', 'client configuration', `No BASIC rate is mapped for this project in ${noBasic.map((s) => `${s.f} to ${s.t}`).join('; ')}. A booking, demand or receipt dated there is refused.`, { slabs: noBasic.map((s) => s.id) })
            : slabsInRange.length ? item('gst_mapping_basic', 'GST rates', 'ok', null, 'A BASIC rate is mapped for every slab in the range.') : item('gst_mapping_basic', 'GST rates', 'missing', 'client configuration', 'There is no slab in the range, so no rate can be mapped.'));
        const noOther = slabsInRange.filter((s) => mine.some((m) => m.slab_id === s.id && m.charge_type === 'BASIC') && !['PLC', 'OTHER CHARGE'].every((ct) => mine.some((m) => m.slab_id === s.id && m.charge_type === ct)));
        if (noOther.length)
            items.push(item('gst_mapping_other', 'GST rates', 'note', 'client configuration', `PLC and/or OTHER CHARGE have no own mapping in ${noOther.length} slab(s); they are taxed at the BASIC rate (a warning is logged). Map them if they carry a different rate.`));
        const summary = items.reduce((a, i) => { a[i.status] = (a[i.status] || 0) + 1; return a; }, { ok: 0, missing: 0, conflict: 0, decision: 0, note: 0 });
        return { project_id: p.id, project_name: p.name, items, summary };
    });
    const gsum = globals.reduce((a, i) => { a[i.status] = (a[i.status] || 0) + 1; return a; }, { ok: 0, missing: 0, conflict: 0, decision: 0, note: 0 });
    return { from, to, global: { items: globals, summary: gsum }, projects: out };
}
//# sourceMappingURL=statutory-readiness.js.map