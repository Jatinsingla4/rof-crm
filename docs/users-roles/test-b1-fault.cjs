// TEST-ONLY preload for a LOCAL / CI TEST API process started by docs/users-roles/_server-harness.mjs. Never load it in any real deployment.
// It patches pg.Pool.prototype.query (the one place every db.query of the API ends up in) in two narrow ways, and only when asked by environment:
//   B1_FORCE_LOCAL_THROTTLE=1   the "does table auth_throttle exist?" probe answers "no", so the sign-in throttle runs process-local whatever the database holds
//                               (this is exactly what a deployment without migration T2 does).
//   B1_FAULT_EMAIL=<address>    the sign-in user lookup for THAT ONE e-mail address fails with an error, as if the database had broken during the request.
// Nothing else is touched: every other query reaches the real database unchanged. No schema or data is changed by this file.
const apiDir = process.env.B1_API_DIR;
if (!apiDir) throw new Error('[test-b1-fault] B1_API_DIR is not set');
const pg = require(require.resolve('pg', { paths: [apiDir] }));
const original = pg.Pool.prototype.query;
const forceLocal = process.env.B1_FORCE_LOCAL_THROTTLE === '1';
const faultEmail = (process.env.B1_FAULT_EMAIL || '').toLowerCase();
let injected = 0;

pg.Pool.prototype.query = function (text, values) {
  const sql = typeof text === 'string' ? text : text && text.text;
  if (forceLocal && sql && sql.includes("to_regclass('public.auth_throttle')")) {
    return Promise.resolve({ command: 'SELECT', rowCount: 1, rows: [{ ok: false }], fields: [] });
  }
  if (faultEmail && sql && /lower\(email\) = \$1/.test(sql) && Array.isArray(values) && values[0] === faultEmail) {
    injected += 1;
    return Promise.reject(new Error('b1 injected database error (test-only)'));
  }
  return original.apply(this, arguments);
};
console.log(`[test-b1-fault] loaded: forceLocalThrottle=${forceLocal} faultEmail=${faultEmail ? 'set' : 'none'}`);
