// Small checks shared by the users and roles routes.
import { isIP } from 'node:net';

export const isUuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

// Returns the lowercase email, or null when it is not a usable address
export const cleanEmail = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const e = v.trim().toLowerCase();
  return e.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null;
};

// Returns the reason a password is not acceptable, or null. bcrypt only reads the first 72 bytes.
export const passwordProblem = (p: unknown): string | null => {
  if (typeof p !== 'string' || p.length < 8) return 'Password must be at least 8 characters';
  if (Buffer.byteLength(p) > 72) return 'Password must be at most 72 bytes';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Password must contain at least one letter and one number';
  return null;
};

// Returns the normalised IPv4 or IPv6 address, or null
export const cleanIp = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const ip = v.trim().replace(/^::ffff:/i, '');
  return isIP(ip) ? ip.toLowerCase() : null;
};

// Clamp a paging value coming from the query string to a whole number in [min, max]
export const intParam = (v: unknown, dflt: number, min: number, max: number): number => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : dflt;
};
