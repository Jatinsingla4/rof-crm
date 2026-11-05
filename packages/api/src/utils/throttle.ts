// Failed-attempt throttles for the sign-in and the "current password" checks.
// A process-local Map is NOT enough on a serverless host: every instance counts on its own, so an attacker who is spread over instances (or whose
// instance restarts) gets many more tries than the limit says. The shared, atomic store is PostgreSQL (draft migration T2: table auth_throttle,
// one row per key, one INSERT ... ON CONFLICT per failure, so concurrent failures on different instances cannot lose a count).
// Until that table exists the throttle falls back to the process-local Map and says so: throttleBackend() is 'process-local' and the startup
// warning for APP_ENV=production names it. That is a production blocker (tracker), not a state to pretend away.
import { db } from '../db/pool.js';

export type Backend = 'shared' | 'process-local';
let backend: Backend = 'process-local';
let checkedAt = 0;
export const throttleBackend = (): Backend => backend;

// The table is looked up at start and again every minute while it is missing, so the app switches to it after the migration without a restart
export async function refreshThrottleBackend(force = false): Promise<Backend> {
  if (!force && (backend === 'shared' || Date.now() - checkedAt < 60_000)) return backend;
  checkedAt = Date.now();
  try {
    const r = await db.query(`SELECT to_regclass('public.auth_throttle') IS NOT NULL AS ok`);
    backend = r.rows[0]?.ok ? 'shared' : 'process-local';
  } catch { backend = 'process-local'; }
  return backend;
}

type Local = { count: number; first: number; until: number };

export function makeThrottle(name: string, maxFails: number, windowMs: number, lockMs: number) {
  const local = new Map<string, Local>();
  const k = (key: string) => `${name}:${key}`;
  const iv = (ms: number) => `${Math.round(ms)} milliseconds`;

  const localBlocked = (key: string): number => {
    const f = local.get(key); if (!f) return 0;
    const now = Date.now();
    if (f.until > now) return f.until - now;
    if (now - f.first > windowMs || f.until) local.delete(key);
    return 0;
  };
  const localFail = (key: string) => {
    const now = Date.now(); const f = local.get(key);
    const cur = f && now - f.first <= windowMs && !f.until ? f : { count: 0, first: now, until: 0 };
    cur.count += 1; if (cur.count >= maxFails) cur.until = now + lockMs;
    local.set(key, cur); if (local.size > 5000) local.clear();
  };

  return {
    // Milliseconds this key must still wait (0 = free to try)
    async blockedFor(key: string): Promise<number> {
      if ((await refreshThrottleBackend()) === 'shared') {
        try {
          const r = await db.query(`SELECT (EXTRACT(EPOCH FROM (locked_until - now())) * 1000)::bigint AS ms FROM auth_throttle WHERE key = $1 AND locked_until > now()`, [k(key)]);
          return Number(r.rows[0]?.ms || 0);
        } catch (e) { console.error('throttle (shared) read failed, using the process-local count:', e); }
      }
      return localBlocked(key);
    },
    // One more failure, atomically: a new window starts when the window is over or a lock has expired; the lock starts at maxFails
    async fail(key: string): Promise<void> {
      if ((await refreshThrottleBackend()) === 'shared') {
        try {
          await db.query(
            `INSERT INTO auth_throttle (key, count, first_at, locked_until)
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
                                   ELSE NULL END`,
            [k(key), maxFails, iv(windowMs), iv(lockMs)]);
          return;
        } catch (e) { console.error('throttle (shared) write failed, counting process-locally:', e); }
      }
      localFail(key);
    },
    async clear(key: string): Promise<void> {
      local.delete(key);
      if (backend === 'shared') await db.query(`DELETE FROM auth_throttle WHERE key = $1`, [k(key)]).catch(() => {});
    },
  };
}
