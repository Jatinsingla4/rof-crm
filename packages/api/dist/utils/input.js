"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inTx = exports.r2 = exports.body = exports.flag = exports.day = exports.text = exports.num = exports.has = exports.uuid = exports.failWith = exports.bad = void 0;
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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (v, label) => { if (typeof v !== 'string' || !UUID.test(v))
    throw (0, exports.bad)(`${label} is not valid`); return v; };
exports.uuid = uuid;
const has = (v) => v !== undefined && v !== null && v !== '';
exports.has = has;
// A JSON number or a plain digit string only: "1e2", "0x10", " 5 ", [5], true are refused
const num = (v, label, max, decimals) => {
    const n = typeof v === 'number' ? v : typeof v === 'string' && new RegExp(`^[0-9]+(\\.[0-9]{1,${decimals}})?$`).test(v) ? Number(v) : NaN;
    if (!Number.isFinite(n) || n < 0 || n > max || Math.abs(n * 10 ** decimals - Math.round(n * 10 ** decimals)) > 1e-6) {
        throw (0, exports.bad)(`${label} must be a number from 0 to ${max.toLocaleString('en-IN')} with up to ${decimals} decimals`);
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
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v || v < '1990-01-01' || v > '2100-12-31') {
        throw (0, exports.bad)(`${label} must be a real date (YYYY-MM-DD)`);
    }
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
//# sourceMappingURL=input.js.map