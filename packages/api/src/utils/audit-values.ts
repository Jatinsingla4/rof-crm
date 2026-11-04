// Old and new values written to the audit log never carry secrets: passwords, hashes, tokens.
const SECRET_KEY = /^(password|currentpassword|confirmpassword|token|token_version)$|secret|_hash$|hash$|token$/i;

export const withoutSecrets = <T extends Record<string, unknown>>(o: T): Partial<T> => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (SECRET_KEY.test(k)) continue;
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? withoutSecrets(v as Record<string, unknown>) : v;
  }
  return out as Partial<T>;
};

export const pick = (o: Record<string, any>, keys: string[]): Record<string, unknown> =>
  Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));
