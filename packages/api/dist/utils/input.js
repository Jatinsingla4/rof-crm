"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.countOf = exports.realRera = exports.isPlaceholderRera = exports.escHtml = exports.likeOf = exports.pos = exports.financeOnly = exports.lock = exports.oneOf = exports.qtext = exports.paging = exports.inTx = exports.r2 = exports.body = exports.flag = exports.day = exports.text = exports.num = exports.has = exports.uuid = exports.BIDI = exports.failWith = exports.bad = void 0;
const index_js_1 = require("../index.js");
const bad = (message, http = 400) => Object.assign(new Error(message), { http });
exports.bad = bad;
// Sends our own client errors; a unique-violation (a race the pre-check missed) becomes a 400 as well
const failWith = (err, res, next, duplicate = 'This already exists') => {
    if (err?.http)
        return res.status(err.http).json({ error: err.message });
    if (err?.code === '23505')
        return res.status(400).json({ error: duplicate });
    next(err);
};
exports.failWith = failWith;
// Embedding, override and isolate characters (U+202A to U+202E, U+2066 to U+2069) can make one name read as another.
// Letters of Arabic, Hebrew, Hindi and other scripts, and the left-to-right and right-to-left marks, are not touched.
exports.BIDI = /[\u202A-\u202E\u2066-\u2069]/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (v, label) => { if (typeof v !== 'string' || !UUID.test(v))
    throw (0, exports.bad)(`${label} is not valid`); return v; };
exports.uuid = uuid;
const has = (v) => v !== undefined && v !== null && v !== '';
exports.has = has;
// A JSON number or a plain digit string only: "1e2", "0x10", " 5 ", [5], true are refused
const num = (v, label, max, decimals) => {
    const n = typeof v === 'number' ? v : typeof v === 'string' && new RegExp(decimals ? `^[0-9]+(\\.[0-9]{1,${decimals}})?$` : '^[0-9]+$').test(v) ? Number(v) : NaN;
    if (!Number.isFinite(n) || n < 0 || n > max || Math.abs(n * 10 ** decimals - Math.round(n * 10 ** decimals)) > 1e-6) {
        throw (0, exports.bad)(decimals
            ? `${label} must be a number from 0 to ${max.toLocaleString('en-IN')} with up to ${decimals} decimals`
            : `${label} must be a whole number from 0 to ${max.toLocaleString('en-IN')}`);
    }
    return n;
};
exports.num = num;
const text = (v, label, max, required) => {
    if (!(0, exports.has)(v)) {
        if (required)
            throw (0, exports.bad)(`${label} is required`);
        return null;
    }
    if (typeof v !== 'string')
        throw (0, exports.bad)(`${label} must be text`);
    const t = v.replace(/[​-‍﻿]/g, '').trim();
    if (!t) {
        if (required)
            throw (0, exports.bad)(`${label} is required`);
        return null;
    }
    if (t.length > max)
        throw (0, exports.bad)(`${label} can be at most ${max} characters`);
    if (/[\u0000-\u001F\u007F‪-‮⁦-⁩<>]/.test(t))
        throw (0, exports.bad)(`${label} contains characters that are not allowed`);
    return t;
};
exports.text = text;
// A real calendar date as YYYY-MM-DD between 1990 and 2100
const day = (v, label = 'Date') => {
    if (!(0, exports.has)(v))
        return null;
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v) {
        throw (0, exports.bad)(`${label} must be a real date (YYYY-MM-DD)`);
    }
    if (v < '1990-01-01' || v > '2100-12-31')
        throw (0, exports.bad)(`${label} is out of range: it must be between 1990-01-01 and 2100-12-31`);
    return v;
};
exports.day = day;
const flag = (v, label) => { if (v === undefined)
    return undefined; if (typeof v !== 'boolean')
    throw (0, exports.bad)(`${label} must be true or false`); return v; };
exports.flag = flag;
const body = (req) => (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {});
exports.body = body;
const r2 = (n) => Math.round(n * 100) / 100;
exports.r2 = r2;
const inTx = async (fn) => {
    const client = await index_js_1.db.connect();
    try {
        await client.query('BEGIN');
        const out = await fn(client);
        await client.query('COMMIT');
        return out;
    }
    catch (e) {
        await client.query('ROLLBACK').catch(() => { });
        throw e;
    }
    finally {
        client.release();
    }
};
exports.inTx = inTx;
// ?page= and ?pageSize= as whole numbers (they used to be pasted into the SQL as text)
const paging = (q, defSize, maxSize) => {
    const whole = (v, label, max, d) => { if (!(0, exports.has)(v))
        return d; if (typeof v !== 'string' || !/^\d+$/.test(v) || +v < 1 || +v > max)
        throw (0, exports.bad)(`${label} must be a whole number from 1 to ${max}`); return +v; };
    const size = whole(q.pageSize, 'pageSize', maxSize, defSize), page = whole(q.page, 'page', 100000, 1);
    return { size, offset: (page - 1) * size };
};
exports.paging = paging;
// A query string value that must be one plain text (not ?x=a&x=b, not ?x[a]=b)
const qtext = (v, label, max = 100) => { if (v !== undefined && typeof v !== 'string')
    throw (0, exports.bad)(`${label} is not valid`); return (0, exports.text)(v, label, max, false); };
exports.qtext = qtext;
const oneOf = (v, label, allowed) => {
    const t = (0, exports.qtext)(v, label, 50);
    if (t === null)
        return null;
    if (!allowed.includes(t))
        throw (0, exports.bad)(`${label} must be one of: ${allowed.join(', ')}`);
    return t;
};
exports.oneOf = oneOf;
// One writer at a time per key (applicant, number series) for the rest of the transaction
const lock = (c, key) => c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
exports.lock = lock;
const financeOnly = (req, res, next) => ['super_admin', 'accounts_finance'].includes(req.userRole || '') ? next() : res.status(403).json({ error: 'Only accounts and finance can do this' });
exports.financeOnly = financeOnly;
// A money amount that is more than 0 (up to 1,000,000,000, paise allowed unless decimals is 0)
const pos = (v, label, decimals = 2) => { const n = (0, exports.num)(v, label, 1000000000, decimals); if (!(n > 0))
    throw (0, exports.bad)(`${label} must be more than 0`); return n; };
exports.pos = pos;
// A search word as a LIKE pattern where % _ and \ in the word are plain letters (use with ESCAPE '\')
const likeOf = (s) => '%' + s.replace(/[\\%_]/g, '\\$&') + '%';
exports.likeOf = likeOf;
// A text value that will be put into HTML as page text
const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
exports.escHtml = escHtml;
// A placeholder such as RERA-X-NONE or RERA/GGM/2024/XXXX is never a real registration number. Print the fallback instead.
const isPlaceholderRera = (v) => typeof v === 'string' && /(^|[-\s/])(X{3,}|NONE|TBD|NIL)([-\s/]|$)|(^|[-\s/])X([-\s/]|$)|^\s*(N\/?A|NOT AVAILABLE|X+)\s*$/i.test(v.trim());
exports.isPlaceholderRera = isPlaceholderRera;
const realRera = (v, fallback = 'N/A') => ((0, exports.has)(v) && !(0, exports.isPlaceholderRera)(v) ? String(v) : fallback);
exports.realRera = realRera;
// The number of rows a paged list query matches, whatever page was asked for. The query must end with LIMIT $a OFFSET $b, the last two parameters (the paged lists all do).
const countOf = async (q, sql, params) => {
    const m = /\s+LIMIT\s+\$\d+\s+OFFSET\s+\$\d+\s*$/i.exec(sql);
    if (!m)
        throw new Error('countOf: the query must end with LIMIT $n OFFSET $m');
    return Number((await q.query(`SELECT COUNT(*)::int AS n FROM (${sql.slice(0, m.index)}) _c`, params.slice(0, -2))).rows[0].n);
};
exports.countOf = countOf;
//# sourceMappingURL=input.js.map