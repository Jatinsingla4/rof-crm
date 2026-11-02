"use strict";
/**
 * Import Routes
 * Units from a CSV file: preview (read and check, nothing is saved), confirm (all rows are checked first; one bad row stops the whole file),
 * and the import history.
 * Applicants are made on the Booking screen and E-Draw results come in on Allotment > E-Draw Import, so only "units" is imported here.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sync_1 = require("csv-parse/sync");
const index_js_1 = require("../index.js");
const input_js_1 = require("../utils/input.js");
const units_js_1 = require("./units.js");
const router = (0, express_1.Router)();
const MAX_ROWS = 5000, MAX_CSV = 2000000;
// A unit needs its number, tower and floor; the type comes from a unitType column (the project's own unit type, which also gives areas and price) or from bhkType and totalPriceInr
const REQUIRED = ['unitNumber', 'tower', 'floor'];
const onlyUnits = (v) => {
    const t = (0, input_js_1.has)(v) ? (0, input_js_1.oneOf)(v, 'importType', ['units']) : 'units';
    return t;
};
// The client's own inventory sheet (S.No., Tower, Floor "1st Floor", Group, Unit Type, Area (Sq. Ft.), Balcony (Sq.Ft), Unit No.) is read as it is:
// its headers are matched to ours by name (case, spaces and punctuation do not matter), blank lines of the sheet are dropped and a floor can be written "Ground Floor" or "2nd Floor".
const aliasOf = (h) => {
    const k = h.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (['unitno', 'unitnumber', 'unitaddress', 'unit', 'unitnos'].includes(k))
        return 'unitNumber';
    if (['tower', 'towername', 'block', 'blockname'].includes(k))
        return 'tower';
    if (['floor', 'floorno', 'floorname', 'floornumber'].includes(k))
        return 'floor';
    if (['unittype', 'unittypename', 'typename'].includes(k))
        return 'unitType';
    if (['group', 'groupname', 'unitgroup', 'typegroup'].includes(k))
        return 'group';
    if (['area', 'areasqft', 'carpetarea', 'carpetareasqft', 'carpet'].includes(k))
        return 'carpetAreaSqft';
    if (['superarea', 'superareasqft', 'super'].includes(k))
        return 'superAreaSqft';
    if (k.startsWith('balcony'))
        return 'balconyAreaSqft';
    if (['sno', 'srno', 'slno', 'serialno', 'sr', 'no'].includes(k))
        return ''; // the running number of the sheet: not needed
    return null;
};
const normalize = (rows) => {
    const map = new Map(), taken = new Set(Object.keys(rows[0] || {}));
    for (const h of Object.keys(rows[0] || {})) {
        const a = aliasOf(h);
        if (a === '' || (a && !taken.has(a))) {
            map.set(h, a);
            if (a)
                taken.add(a);
        }
    }
    return rows.map((r) => { const o = {}; for (const [k, v] of Object.entries(r)) {
        if (map.has(k)) {
            const a = map.get(k);
            if (a)
                o[a] = v;
        }
        else
            o[k] = v;
    } return o; })
        .filter((r) => Object.values(r).some((v) => String(v ?? '').trim() !== ''));
};
const floorText = (v) => {
    if (typeof v !== 'string')
        return v;
    const t = v.trim();
    if (/^ground(\s+floor)?$/i.test(t))
        return 0;
    const bs = t.match(/^basement\s*(\d+)$/i);
    if (bs)
        return -Number(bs[1]);
    const o = t.match(/^(\d{1,3})\s*(?:st|nd|rd|th)?\s*(?:floor)?$/i);
    if (o)
        return Number(o[1]);
    return v;
};
// The CSV text to rows, or a clear 400
const readCsv = (v) => {
    if (typeof v !== 'string' || !v.trim())
        throw (0, input_js_1.bad)('csvText is required (the text of the CSV file)');
    if (v.length > MAX_CSV)
        throw (0, input_js_1.bad)('The file is too large (2 MB at most)');
    let rows;
    try {
        rows = (0, sync_1.parse)(v, { columns: true, skip_empty_lines: true, trim: true, bom: true });
    }
    catch (e) {
        throw (0, input_js_1.bad)('The file is not a valid CSV: ' + String(e.message).split('\n')[0]);
    }
    if (!rows.length)
        throw (0, input_js_1.bad)('The file has no rows');
    if (rows.length > MAX_ROWS)
        throw (0, input_js_1.bad)(`The file has ${rows.length} rows; ${MAX_ROWS} at most in one import`);
    rows = normalize(rows);
    if (!rows.length)
        throw (0, input_js_1.bad)('The file has no rows');
    const headers = Object.keys(rows[0]);
    const missing = REQUIRED.filter((c) => !headers.includes(c));
    if (!headers.includes('unitType') && !(headers.includes('bhkType') && headers.includes('totalPriceInr')))
        missing.push('unitType (or bhkType and totalPriceInr)');
    if (missing.length)
        throw (0, input_js_1.bad)(`Missing required columns: ${missing.join(', ')}`);
    return { rows, headers };
};
// The project's unit types and locations by name (lower case), so a row can name them
const lookupsOf = async (c, projectId) => ({
    types: new Map((await c.query('SELECT * FROM unit_types WHERE project_id = $1', [projectId])).rows.map((r) => [r.name.toLowerCase(), r])),
    locations: new Map((await c.query('SELECT id, name FROM unit_locations WHERE project_id = $1', [projectId])).rows.map((r) => [r.name.toLowerCase(), r.id])),
});
// Every row checked with the same rules as the Unit screen; the second copy of a unit inside the file is a problem too
const checkRows = (rows, look = null, createTypes = false) => {
    const ok = [], errors = [], seen = new Set();
    const newTypes = new Map();
    rows.forEach((r, i) => {
        const line = i + 2; // line 1 is the header
        try {
            const unit = (0, input_js_1.text)(r.unitNumber, 'Unit number', 50, true), tower = (0, input_js_1.text)(r.tower, 'Tower', 100, true);
            if (!(0, input_js_1.has)(r.floor))
                throw (0, input_js_1.bad)('Floor number is required for each unit');
            const floor = (0, units_js_1.floorNo)(floorText(r.floor)), facing = (0, input_js_1.text)(r.facing, 'Facing', 30, false);
            // unit type and location are names of the project's own masters
            const typeName = (0, input_js_1.text)(r.unitType, 'Unit type', 200, false), locName = (0, input_js_1.text)(r.location, 'Location', 200, false);
            const type = typeName && look ? look.types.get(typeName.toLowerCase()) : null;
            // a unit type the project does not have yet: with "create the missing unit types" it is made from the group and areas in the file (all rows of one type must agree)
            let newType = null;
            if (typeName && look && !type) {
                if (!createTypes)
                    throw (0, input_js_1.bad)(`Unit type "${typeName}" is not in this project`);
                const g = (0, input_js_1.text)(r.group, 'Group', 100, false), spec = (0, units_js_1.unitFields)({ carpetAreaSqft: r.carpetAreaSqft === '' ? undefined : r.carpetAreaSqft, superAreaSqft: r.superAreaSqft === '' ? undefined : r.superAreaSqft, balconyAreaSqft: r.balconyAreaSqft === '' ? undefined : r.balconyAreaSqft });
                const key = typeName.toLowerCase(), seenType = newTypes.get(key);
                if (seenType && (seenType.carpet !== spec.carpet || seenType.sup !== spec.sup || seenType.balcony !== spec.balcony || seenType.group !== g))
                    throw (0, input_js_1.bad)(`Unit type "${typeName}" has other areas or another group than in row ${seenType.line}`);
                if (!seenType)
                    newTypes.set(key, { name: typeName.slice(0, 100), group: g, carpet: spec.carpet, sup: spec.sup, balcony: spec.balcony, line, units: 0 });
                newTypes.get(key).units++;
                newType = key;
            }
            const locationId = locName && look ? look.locations.get(locName.toLowerCase()) ?? null : null;
            if (locName && look && !locationId)
                throw (0, input_js_1.bad)(`Location "${locName}" is not in this project`);
            const bhk = (0, input_js_1.has)(r.bhkType) ? (0, input_js_1.text)(r.bhkType, 'BHK type', 50, true) : type ? type.name : newType ? typeName.slice(0, 50) : (0, input_js_1.text)(r.bhkType, 'BHK type', 50, true);
            const area = type ? { 'Super Area': type.super_area_sqft, 'Carpet Area': type.carpet_area_sqft, 'Built Up Area': type.built_up_area_sqft, 'Plot Area': type.plot_area }[type.rate_basis] : null;
            const typePrice = type && type.base_rate_sqft != null && area ? Math.round(Number(type.base_rate_sqft) * Number(area)) : undefined;
            const f = (0, units_js_1.unitFields)({ carpetAreaSqft: type?.carpet_area_sqft, superAreaSqft: type?.super_area_sqft, balconyAreaSqft: type?.balcony_area_sqft, basePriceInr: typePrice, totalPriceInr: typePrice,
                ...Object.fromEntries(Object.entries(r).filter(([, v]) => v !== '' && v != null)) });
            // a unit type made from the file has no rate yet, so its units come in without a price (set the rate of the type, then "Update units")
            if (f.total === null && !(createTypes && typeName))
                throw (0, input_js_1.bad)('Total price is required');
            if (f.total !== null && !(f.total > 0))
                throw (0, input_js_1.bad)('Total price must be more than 0');
            const key = `${tower.toLowerCase()}|${unit.toLowerCase()}`;
            if (seen.has(key))
                throw (0, input_js_1.bad)('This unit is in the file more than once');
            seen.add(key);
            ok.push({ newType, line, unit, tower, floor, bhk, facing, f, typeId: type?.id ?? null, locationId });
        }
        catch (e) {
            errors.push({ row: line, unit: String(r.unitNumber ?? '').slice(0, 50), reason: e.http ? e.message : 'This row cannot be read' });
        }
    });
    return { ok, errors, newTypes };
};
const say = (errors) => errors.slice(0, 5).map((e) => `Row ${e.row} (${e.unit || 'no unit number'}): ${e.reason}`).join(' | ') + (errors.length > 5 ? ` | and ${errors.length - 5} more` : '');
// POST /api/import/preview — read the CSV and tell what would happen (no DB writes)
router.post('/preview', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        onlyUnits(b.importType);
        const projectId = (0, input_js_1.has)(b.projectId) ? (0, input_js_1.uuid)(b.projectId, 'projectId') : null;
        const { rows, headers } = readCsv(b.csvText);
        if (b.createTypes !== undefined && typeof b.createTypes !== 'boolean')
            throw (0, input_js_1.bad)('createTypes must be true or false');
        const { ok, errors, newTypes } = checkRows(rows, projectId ? await lookupsOf(index_js_1.db, projectId) : null, b.createTypes === true);
        let existing = null;
        if (projectId) {
            if (!(await index_js_1.db.query(`SELECT 1 FROM projects WHERE id = $1`, [projectId])).rows.length)
                throw (0, input_js_1.bad)('Project not found', 404);
            existing = (await index_js_1.db.query(`SELECT COUNT(*)::int AS n FROM units u JOIN towers t ON t.id = u.tower_id
          WHERE u.project_id = $1 AND (lower(t.tower_name), lower(u.unit_number)) IN (SELECT lower(tw), lower(un) FROM unnest($2::text[], $3::text[]) AS x(tw, un))`, [projectId, ok.map((r) => r.tower), ok.map((r) => r.unit)])).rows[0].n;
        }
        res.json({
            success: true,
            data: { importType: 'units', totalRows: rows.length, validRows: ok.length, errorRows: errors.length, alreadyInProject: existing, columns: headers, preview: rows.slice(0, 10), errors: errors.slice(0, 50), newUnitTypes: [...newTypes.values()].map((x) => ({ name: x.name, group: x.group, carpet_area_sqft: x.carpet, balcony_area_sqft: x.balcony, units: x.units })) },
        });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// POST /api/import — confirm: one bad row stops the whole file, nothing is saved; units that are already there are skipped
router.post('/', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        onlyUnits(b.importType);
        const projectId = (0, input_js_1.uuid)(b.projectId, 'projectId');
        const fileName = (0, input_js_1.text)(b.fileName, 'File name', 255, false) || 'import.csv';
        const { rows } = readCsv(b.csvText);
        if (!(await index_js_1.db.query(`SELECT 1 FROM projects WHERE id = $1`, [projectId])).rows.length)
            throw (0, input_js_1.bad)('Project not found', 404);
        if (b.createTypes !== undefined && typeof b.createTypes !== 'boolean')
            throw (0, input_js_1.bad)('createTypes must be true or false');
        const { ok, errors, newTypes } = checkRows(rows, await lookupsOf(index_js_1.db, projectId), b.createTypes === true);
        if (errors.length) {
            await index_js_1.db.query(`INSERT INTO import_history (file_name, import_type, total_rows, created_rows, skipped_rows, error_rows, status, errors, imported_by) VALUES ($1,'units',$2,0,0,$3,'failed',$4,$5)`, [fileName, rows.length, errors.length, JSON.stringify(errors.slice(0, 200)), req.userId]);
            return res.status(422).json({ error: `The file has ${errors.length} row(s) with problems, nothing was imported. ${say(errors)}`, errors: errors.slice(0, 50) });
        }
        const out = await (0, input_js_1.inTx)(async (c) => {
            if (!(await c.query(`SELECT 1 FROM projects WHERE id = $1`, [projectId])).rows.length)
                throw (0, input_js_1.bad)('Project not found', 404);
            await (0, input_js_1.lock)(c, `import-units:${projectId}`); // a double click or two files at once: one after the other, duplicates are skipped
            // the unit types the file brings (only with "create the missing unit types"); one that appeared meanwhile is used as it is
            const typeIds = new Map();
            for (const [key, t] of newTypes) {
                const basis = t.carpet ? 'Carpet Area' : 'Super Area', shown = [t.carpet ? 'Carpet Area' : null, t.sup && t.carpet ? 'Super Area' : t.sup ? 'Super Area' : null, t.balcony ? 'Balcony Area' : null].filter(Boolean);
                const made = (await c.query(`INSERT INTO unit_types (project_id, name, group_name, carpet_area_sqft, super_area_sqft, balcony_area_sqft, rate_basis, show_on_payment_file) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (project_id, lower(name::text)) DO NOTHING RETURNING id`, [projectId, t.name, t.group, t.carpet, t.sup, t.balcony, basis, shown])).rows[0];
                typeIds.set(key, made ? made.id : (await c.query('SELECT id FROM unit_types WHERE project_id = $1 AND lower(name) = $2', [projectId, key])).rows[0].id);
            }
            for (const r of ok)
                if (r.newType)
                    r.typeId = typeIds.get(r.newType) ?? null;
            const towers = new Map();
            let created = 0;
            const skipped = [];
            for (const r of ok) {
                const tk = r.tower.toLowerCase();
                if (!towers.has(tk)) {
                    const t = (await c.query(`SELECT id, deleted_at FROM towers WHERE project_id = $1 AND lower(tower_name) = $2`, [projectId, tk])).rows[0];
                    if (t?.deleted_at)
                        throw (0, input_js_1.bad)(`Tower "${r.tower}" was deleted from this project. Bring it back or use another tower name.`, 409);
                    towers.set(tk, t ? t.id : (await c.query(`INSERT INTO towers (project_id, tower_name) VALUES ($1, $2) RETURNING id`, [projectId, r.tower])).rows[0].id);
                }
                const towerId = towers.get(tk);
                const done = await c.query(`INSERT INTO units (project_id, tower_id, floor, unit_number, bhk_type, carpet_area_sqft, super_area_sqft, balcony_area_sqft, base_price_inr, total_price_inr, facing, status, created_by_user_id, unit_type_id, unit_location_id)
           SELECT $1::uuid,$2::uuid,$3::int,$4::text,$5::text,$6::numeric,$7::numeric,$8::numeric,$9::numeric,$10::numeric,$11::text,'available',$12::uuid,$13::uuid,$14::uuid
            WHERE NOT EXISTS (SELECT 1 FROM units WHERE tower_id = $2::uuid AND lower(unit_number) = lower($4::text))`, [projectId, towerId, r.floor, r.unit, r.bhk, r.f.carpet, r.f.sup, r.f.balcony, r.f.base, r.f.total, r.facing, req.userId, r.typeId, r.locationId]);
                if (done.rowCount)
                    created++;
                else
                    skipped.push({ row: r.line, unit: r.unit, reason: 'A unit with this number already exists in this tower' });
            }
            await c.query(`INSERT INTO import_history (file_name, import_type, total_rows, created_rows, skipped_rows, error_rows, status, errors, imported_by) VALUES ($1,'units',$2,$3,$4,0,'completed',$5,$6)`, [fileName, rows.length, created, skipped.length, JSON.stringify(skipped.slice(0, 200)), req.userId]);
            return { totalRows: rows.length, created, skipped: skipped.length, skippedRows: skipped.slice(0, 50), createdUnitTypes: newTypes.size };
        });
        res.json({ success: true, data: out });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// GET /api/import/history
router.get('/history', async (req, res, next) => {
    try {
        const importType = (0, input_js_1.oneOf)(req.query.importType, 'importType', ['units']);
        const { size, offset } = (0, input_js_1.paging)(req.query, 50, 200);
        const params = [];
        let where = '';
        if (importType) {
            params.push(importType);
            where = ` AND ih.import_type = $1`;
        }
        params.push(size, offset);
        const result = await index_js_1.db.query(`SELECT ih.id, ih.file_name, ih.import_type, ih.total_rows, ih.created_rows, ih.skipped_rows, ih.error_rows, ih.status, ih.errors, ih.created_at,
              u.name as imported_by_name
         FROM import_history ih LEFT JOIN users u ON ih.imported_by = u.id
        WHERE 1=1${where} ORDER BY ih.created_at DESC, ih.id LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
exports.default = router;
//# sourceMappingURL=import.js.map