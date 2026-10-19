"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.isScoped = exports.scopeStore = void 0;
const pg_1 = require("pg");
const node_async_hooks_1 = require("node:async_hooks");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const pool = new pg_1.Pool(process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
    }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'rof_crm',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
    });
// Project scope. A login that is assigned to projects may only see and change rows of those projects.
// The limit is applied by the database (row level security, migration 100), so every query of the request
// obeys it: lists, details, reports and writes, including queries nobody remembers to filter.
// The request sets its scope once (authenticateToken); every db.query / db.connect of that request then runs
// as the limited database role `rof_app` with the allowed project ids in `app.project_scope`.
// Without a scope (super admin, or no project assigned) nothing changes.
exports.scopeStore = new node_async_hooks_1.AsyncLocalStorage();
const SCOPE_RE = /^[0-9a-f-]{36}(,[0-9a-f-]{36})*$/;
const scopeOf = () => {
    const ids = exports.scopeStore.getStore()?.projectIds;
    if (ids && !SCOPE_RE.test(ids))
        throw new Error('Invalid project scope');
    return ids;
};
const isScoped = () => !!exports.scopeStore.getStore()?.projectIds;
exports.isScoped = isScoped;
async function scopedQuery(ids, args) {
    const client = await pool.connect();
    try {
        await client.query(`BEGIN; SET LOCAL ROLE rof_app; SELECT set_config('app.project_scope', '${ids}', true)`);
        const result = await client.query(...args);
        await client.query('COMMIT');
        return result;
    }
    catch (err) {
        await client.query('ROLLBACK').catch(() => { });
        throw err;
    }
    finally {
        client.release();
    }
}
async function scopedConnect(ids) {
    const client = await pool.connect();
    try {
        await client.query(`SET ROLE rof_app; SELECT set_config('app.project_scope', '${ids}', false)`);
    }
    catch (err) {
        client.release(err);
        throw err;
    }
    const release = client.release.bind(client);
    // The connection goes back to the pool only after the limit is removed; if that fails it is closed instead
    client.release = (err) => client.query('RESET ROLE; RESET app.project_scope').then(() => release(err), (e) => release(e));
    return client;
}
exports.db = new Proxy(pool, {
    get(target, prop) {
        if (prop === 'query') {
            return (...args) => {
                const ids = scopeOf();
                return ids ? scopedQuery(ids, args) : target.query(...args);
            };
        }
        if (prop === 'connect') {
            return (...args) => {
                const ids = scopeOf();
                return ids && !args.length ? scopedConnect(ids) : target.connect(...args);
            };
        }
        const v = Reflect.get(target, prop);
        return typeof v === 'function' ? v.bind(target) : v;
    },
});
//# sourceMappingURL=pool.js.map