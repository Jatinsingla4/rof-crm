// GSTIN check: 2-digit state code, PAN, entity number, Z, check character (the check character is verified). Kept in a file of its own so a module that only needs this test does not
// pull in the applicant rules (which are loaded with the rest of the app).
export const gstinOk = (g: string) => {
  const A = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (!/^(0[1-9]|[1-2][0-9]|3[0-8]|97|99)[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) { const p = A.indexOf(g[i]) * (i % 2 ? 2 : 1); sum += Math.floor(p / 36) + (p % 36); }
  return A[(36 - (sum % 36)) % 36] === g[14];
};
