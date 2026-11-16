// Helper for the Module 1 / B1 login tests (not a test: its name does not match api-test-*.mjs, so the CI script discovery does not run it).
// Starts ONE extra API process (node <api root>/dist/index.js) on a free local port for a test that needs a mode the shared CI server is not in
// (production mode, a fault injected into one e-mail's lookup, a shifted clock). The extra process uses the SAME test database as the rest of the run.
//   B1_API_ROOT  folder that holds dist/ (default: packages/api next to this file; the validation run points it at a scratch build)
// Safety: refuses to start unless the database is local and its name looks like a test database; DATABASE_URL is removed from the child's environment.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const apiRoot = () => path.resolve(process.env.B1_API_ROOT || path.join(here, '../../packages/api'));
export const preload = (name) => path.join(here, name);

export const LOCAL_HOSTS = ['127.0.0.1', 'localhost', '::1'];
// Refuses anything that is not a local test API (the BASE the tests talk to)
export function assertLocalBase(base) {
  const host = new URL(base).hostname.replace(/^\[|\]$/g, '');
  if (!LOCAL_HOSTS.includes(host)) throw new Error(`refusing to run: BASE host "${host}" is not local`);
}

const freePort = () => new Promise((resolve, reject) => {
  const s = createServer(); s.unref();
  s.on('error', reject);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});
export const closedPort = freePort;   // a port nothing listens on (just released)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// opts: { production, preloads: ['test-b1-fault.cjs', ...], env: {...extra child environment} }
export async function startServer(opts = {}) {
  const { production = false, preloads = [], env = {} } = opts;
  const host = process.env.DB_HOST || 'localhost';
  const dbName = process.env.DB_NAME || '';
  if (!LOCAL_HOSTS.includes(host)) throw new Error(`refusing to start a server: DB_HOST "${host}" is not local`);
  if (!/^rof_(ci|b1[a-z0-9_]*)$/.test(dbName)) throw new Error(`refusing to start a server: DB_NAME "${dbName}" is not a known test database`);
  const root = apiRoot();
  const port = await freePort();
  const childEnv = {
    ...process.env, ...env,
    PORT: String(port),
    NODE_ENV: production ? 'production' : 'development',
    JWT_SECRET: randomBytes(24).toString('hex'),      // a secret of its own, never printed
    B1_API_DIR: root,
    API_RATE_MAX: process.env.API_RATE_MAX || '500000',
  };
  delete childEnv.DATABASE_URL;
  if (production) childEnv.APP_ENV = 'staging'; else delete childEnv.APP_ENV;
  const args = [...preloads.flatMap((p) => ['--require', preload(p)]), path.join(root, 'dist/index.js')];
  const child = spawn(process.execPath, args, { cwd: root, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  const onData = (d) => { log += d.toString(); if (log.length > 400_000) log = log.slice(-200_000); };
  child.stdout.on('data', onData); child.stderr.on('data', onData);
  let exited = false; child.on('exit', () => { exited = true; });
  const killSync = () => { if (!exited) try { child.kill('SIGKILL'); } catch {} };
  process.on('exit', killSync);

  const base = `http://127.0.0.1:${port}`;
  let up = false;
  for (let i = 0; i < 60 && !up && !exited; i++) {
    try { up = (await fetch(base + '/api/health')).ok; } catch {}
    if (!up) await sleep(500);
  }
  if (!up) { killSync(); throw new Error('the extra API process did not start:\n' + log.slice(-1500)); }
  return {
    port, base, api: base + '/api', pid: child.pid, production,
    log: () => log,
    signal: (sig) => child.kill(sig),
    stop: async () => { if (exited) return; child.kill('SIGTERM'); for (let i = 0; i < 20 && !exited; i++) await sleep(100); killSync(); },
  };
}

// small client used by the tests: returns { s: status, j: json body, t0, t1 } with performance timestamps
export const makeCall = (api) => (tok, headers = {}) => async (m, p, b) => {
  const t0 = performance.now();
  const r = await fetch(api + p, { method: m, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}), ...headers }, body: b === undefined ? undefined : (typeof b === 'string' ? b : JSON.stringify(b)) })
    .catch((e) => ({ status: 0, json: async () => ({ networkError: String(e?.cause?.code || e?.message || e) }) }));
  let j = null; try { j = await r.json(); } catch {}
  // rem = the limiter's own RateLimit-Remaining header: what the SERVER counted for this address when it received this request
  return { s: r.status, j, t0, t1: performance.now(), rem: r.headers?.get?.('ratelimit-remaining') ?? null };
};

// Runs fn() n times at once; "overlap observed" is what the CLIENT saw: every request had been started before the first answer came back,
// with at least minGapMs between the last start and the first end. It is NOT a proof of what the server did at the same moment: the server is one
// thread and bcryptjs works in 100 ms slices, so a request can reach the server long after the client started it. Evidence of server-side
// overlap has to come from the server's own answers (a reservation-cap 429, or the limiter's RateLimit-Remaining header).
export async function burst(n, fn, minGapMs = 200) {
  const res = await Promise.all(Array.from({ length: n }, () => fn()));
  const maxStart = Math.max(...res.map((x) => x.t0)), minEnd = Math.min(...res.map((x) => x.t1));
  return { res, overlapMs: Math.round(minEnd - maxStart), overlapObserved: minEnd - maxStart >= minGapMs };
}

export const LOCKOUT_TEXT = /Too many failed attempts/;      // sign-in lockout / reservation cap (index.ts login handler)
export const LIMITER_TEXT = /Too many login attempts/;       // authLimiter (express-rate-limit)
