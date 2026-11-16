"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.throttleBackend = void 0;
exports.refreshThrottleBackend = refreshThrottleBackend;
exports.makeThrottle = makeThrottle;
// Failed-attempt throttles for the sign-in and the "current password" checks.
// A process-local Map is NOT enough on a serverless host: every instance counts on its own, so an attacker who is spread over instances (or whose
// instance restarts) gets many more tries than the limit says. The shared, atomic store is PostgreSQL (draft migration T2: table auth_throttle,
// one row per key, one INSERT ... ON CONFLICT per failure, so concurrent failures on different instances cannot lose a count).
// Until that table exists the throttle falls back to the process-local Map and says so: throttleBackend() is 'process-local' and the startup
// warning for APP_ENV=production names it. That is a production blocker (tracker), not a state to pretend away.
const pool_js_1 = require("../db/pool.js");
let backend = 'process-local';
let checkedAt = 0;
const throttleBackend = () => backend;
exports.throttleBackend = throttleBackend;
// The table is looked up at start and again every minute while it is missing, so the app switches to it after the migration without a restart
async function refreshThrottleBackend(force = false) {
    if (!force && (backend === 'shared' || Date.now() - checkedAt < 60000))
        return backend;
    checkedAt = Date.now();
    try {
        const r = await pool_js_1.db.query(`SELECT to_regclass('public.auth_throttle') IS NOT NULL AS ok`);
        backend = r.rows[0]?.ok ? 'shared' : 'process-local';
    }
    catch {
        backend = 'process-local';
    }
    return backend;
}
// The process-local map holds at most this many keys that are not locked. Past it the oldest unlocked keys go first; a key whose lock is
// still running is never evicted, so flooding the form with made-up e-mail addresses cannot release anyone's lock (the old code cleared the whole map).
// Active locks are few: a lock needs maxFails failures and every address is held to the sign-in rate limit.
const MAX_LOCAL_KEYS = 5000;
function makeThrottle(name, maxFails, windowMs, lockMs) {
    const local = new Map();
    const k = (key) => `${name}:${key}`;
    const iv = (ms) => `${Math.round(ms)} milliseconds`;
    const localBlocked = (key) => {
        const f = local.get(key);
        if (!f)
            return 0;
        const now = Date.now();
        if (f.until > now)
            return f.until - now;
        if (now - f.first > windowMs || f.until)
            local.delete(key);
        return 0;
    };
    // Stores a key as the newest entry (Map keeps insertion order) and trims the map; locked keys are skipped, never evicted
    const touch = (key, f) => {
        local.delete(key);
        local.set(key, f);
        if (local.size <= MAX_LOCAL_KEYS)
            return;
        const now = Date.now();
        for (const [other, v] of local) {
            if (local.size <= MAX_LOCAL_KEYS)
                break;
            if (v.until > now)
                continue;
            local.delete(other);
        }
    };
    const localFail = (key) => {
        const now = Date.now();
        const f = local.get(key);
        const cur = f && now - f.first <= windowMs && !f.until ? f : { count: 0, first: now, until: 0 };
        cur.count += 1;
        if (cur.count >= maxFails)
            cur.until = now + lockMs;
        touch(key, cur);
    };
    // Reserve / confirm / release (used by the sign-in): the attempt is counted BEFORE the slow password check, so a burst of parallel
    // attempts cannot all pass a check that only later sees the failures. These run without an await, so each is atomic in this process.
    const localReserve = (key) => {
        const now = Date.now();
        const f = local.get(key);
        if (f && f.until > now)
            return f.until - now;
        const cur = f && !f.until && now - f.first <= windowMs ? f : { count: 0, first: now, until: 0 };
        if (cur.count >= maxFails)
            return 1000; // maxFails attempts are already counted and still unresolved: no more until one resolves
        cur.count += 1;
        touch(key, cur);
        return 0;
    };
    const localConfirm = (key) => {
        const f = local.get(key);
        if (f && !f.until && f.count >= maxFails)
            f.until = Date.now() + lockMs;
    };
    const localRelease = (key) => {
        const f = local.get(key);
        if (f && !f.until && f.count > 0 && --f.count === 0)
            local.delete(key);
    };
    return {
        // Milliseconds this key must still wait (0 = free to try)
        async blockedFor(key) {
            if ((await refreshThrottleBackend()) === 'shared') {
                try {
                    const r = await pool_js_1.db.query(`SELECT (EXTRACT(EPOCH FROM (locked_until - now())) * 1000)::bigint AS ms FROM auth_throttle WHERE key = $1 AND locked_until > now()`, [k(key)]);
                    return Number(r.rows[0]?.ms || 0);
                }
                catch (e) {
                    console.error('throttle (shared) read failed, using the process-local count:', e);
                }
            }
            return localBlocked(key);
        },
        // One more failure, atomically: a new window starts when the window is over or a lock has expired; the lock starts at maxFails
        async fail(key) {
            if ((await refreshThrottleBackend()) === 'shared') {
                try {
                    await pool_js_1.db.query(`INSERT INTO auth_throttle (key, count, first_at, locked_until)
             VALUES ($1, 1, now(), CASE WHEN $2::int <= 1 THEN now() + $4::interval END)
             ON CONFLICT (key) DO UPDATE SET
               count = CASE WHEN auth_throttle.locked_until > now() THEN auth_throttle.count
                            WHEN auth_throttle.locked_until IS NOT NULL OR auth_throttle.first_at < now() - $3::interval THEN 1
                            ELSE auth_throttle.count + 1 END,
               first_at = CASE WHEN auth_throttle.locked_until > now() THEN auth_throttle.first_at
                               WHEN auth_throttle.locked_until IS NOT NULL OR auth_throttle.first_at < now() - $3::interval THEN now()
                               ELSE auth_throttle.first_at END,
               locked_until = CASE WHEN auth_throttle.locked_until > now() THEN auth_throttle.locked_until
                                   WHEN (CASE WHEN auth_throttle.locked_until IS NOT NULL OR auth_throttle.first_at < now() - $3::interval THEN 1 ELSE auth_throttle.count + 1 END) >= $2::int
                                        THEN now() + $4::interval
                                   ELSE NULL END`, [k(key), maxFails, iv(windowMs), iv(lockMs)]);
                    return;
                }
                catch (e) {
                    console.error('throttle (shared) write failed, counting process-locally:', e);
                }
            }
            localFail(key);
        },
        // Counts one attempt before it is checked. Returns the milliseconds to wait (0 = the attempt may go on). At most maxFails attempts are
        // counted-and-unresolved per key; a lock that is running refuses everything. Pair it with confirmFailure (wrong), clear (right) or release (error).
        async reserve(key) {
            if ((await refreshThrottleBackend()) === 'shared') {
                try {
                    const r = await pool_js_1.db.query(`INSERT INTO auth_throttle (key, count, first_at, locked_until) VALUES ($1, 1, now(), NULL)
             ON CONFLICT (key) DO UPDATE SET
               count = CASE WHEN auth_throttle.locked_until IS NOT NULL OR auth_throttle.first_at < now() - $2::interval THEN 1 ELSE auth_throttle.count + 1 END,
               first_at = CASE WHEN auth_throttle.locked_until IS NOT NULL OR auth_throttle.first_at < now() - $2::interval THEN now() ELSE auth_throttle.first_at END,
               locked_until = NULL
             WHERE auth_throttle.locked_until <= now()
                OR (auth_throttle.locked_until IS NULL AND (auth_throttle.first_at < now() - $2::interval OR auth_throttle.count < $3::int))
             RETURNING count`, [k(key), iv(windowMs), maxFails]);
                    if (r.rowCount)
                        return 0;
                    return (await this.blockedFor(key)) || 1000;
                }
                catch (e) {
                    console.error('throttle (shared) reserve failed, counting process-locally:', e);
                }
            }
            return localReserve(key);
        },
        // The reserved attempt failed: when maxFails attempts are counted the lock starts (a no-op while the count is lower or a lock already runs)
        async confirmFailure(key) {
            localConfirm(key);
            if (backend === 'shared') {
                await pool_js_1.db.query(`UPDATE auth_throttle SET locked_until = now() + $3::interval WHERE key = $1 AND locked_until IS NULL AND count >= $2::int`, [k(key), maxFails, iv(lockMs)])
                    .catch((e) => console.error('throttle (shared) confirm failed:', e));
            }
        },
        // The reserved attempt ended in a server error, not in a verdict on the password: give its count back (never from a running lock)
        async release(key) {
            localRelease(key);
            if (backend === 'shared') {
                await pool_js_1.db.query(`UPDATE auth_throttle SET count = GREATEST(count - 1, 0) WHERE key = $1 AND locked_until IS NULL`, [k(key)]).catch(() => { });
            }
        },
        async clear(key) {
            local.delete(key);
            if (backend === 'shared')
                await pool_js_1.db.query(`DELETE FROM auth_throttle WHERE key = $1`, [k(key)]).catch(() => { });
        },
    };
}
//# sourceMappingURL=throttle.js.map