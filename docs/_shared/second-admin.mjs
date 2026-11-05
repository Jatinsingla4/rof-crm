// Strict maker-checker (plan 5.4): nobody, super_admin included, approves what they created. A test that creates a record as the seeded
// super_admin therefore needs a SECOND person to approve it. This makes one: a new super_admin login made through the API by the first
// one (no seed or CI change), returned as a bearer token. Wrap it with the script's own caller:  const A2 = call(await secondAdminToken(B, A));
export async function secondAdminToken(B, A) {
  const u = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const email = `checker.${u}@test.local`, password = 'Chk#Pass' + u.replace(/\D/g, '') + '1x';
  const r = await A('POST', '/users/employee-login', { username: 'chk' + u, email, password, confirmPassword: password, role: 'super_admin' });
  if (r.s !== 201) throw new Error('could not create the second admin: ' + JSON.stringify(r));
  const login = await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const j = await login.json();
  if (!j.token) throw new Error('second admin cannot sign in: ' + JSON.stringify(j));
  return j.token;
}
