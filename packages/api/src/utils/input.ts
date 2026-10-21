// Input rules shared by the set-up routes. Each helper returns a clean value or throws a 400 with a message for the user.
import { Response, NextFunction } from 'express';
import { db, AuthRequest } from '../index.js';

export const bad = (message: string, http = 400) => Object.assign(new Error(message), { http });
// Sends our own client errors; a unique-violation (a race the pre-check missed) becomes a 400 as well
export const failWith = (err: any, res: Response, next: NextFunction, duplicate = 'This already exists') => {
  if (err?.http) return res.status(err.http).json({ error: err.message });
  if (err?.code === '23505') return res.status(400).json({ error: duplicate });
  next(err);
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const uuid = (v: any, label: string): string => { if (typeof v !== 'string' || !UUID.test(v)) throw bad(`${label} is not valid`); return v; };
export const has = (v: any) => v !== undefined && v !== null && v !== '';
// A JSON number or a plain digit string only: "1e2", "0x10", " 5 ", [5], true are refused
export const num = (v: any, label: string, max: number, decimals: number): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && new RegExp(decimals ? `^[0-9]+(\\.[0-9]{1,${decimals}})?$` : '^[0-9]+$').test(v) ? Number(v) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > max || Math.abs(n * 10 ** decimals - Math.round(n * 10 ** decimals)) > 1e-6) {
    throw bad(`${label} must be a number from 0 to ${max.toLocaleString('en-IN')} with up to ${decimals} decimals`);
  }
  return n;
};
export const text = (v: any, label: string, max: number, required: boolean): string | null => {
  if (!has(v)) { if (required) throw bad(`${label} is required`); return null; }
  if (typeof v !== 'string') throw bad(`${label} must be text`);
  const t = v.replace(/[​-‍﻿]/g, '').trim();
  if (!t) { if (required) throw bad(`${label} is required`); return null; }
  if (t.length > max) throw bad(`${label} can be at most ${max} characters`);
  if (/[\u0000-\u001F\u007F‪-‮⁦-⁩<>]/.test(t)) throw bad(`${label} contains characters that are not allowed`);
  return t;
};
// A real calendar date as YYYY-MM-DD between 1990 and 2100
export const day = (v: any, label = 'Date'): string | null => {
  if (!has(v)) return null;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v || v < '1990-01-01' || v > '2100-12-31') {
    throw bad(`${label} must be a real date (YYYY-MM-DD)`);
  }
  return v;
};
export const flag = (v: any, label: string): boolean | undefined => { if (v === undefined) return undefined; if (typeof v !== 'boolean') throw bad(`${label} must be true or false`); return v; };
export const body = (req: AuthRequest) => (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {});
export const r2 = (n: number) => Math.round(n * 100) / 100;
export const inTx = async <T>(fn: (c: any) => Promise<T>): Promise<T> => {
  const client = await db.connect();
  try { await client.query('BEGIN'); const out = await fn(client); await client.query('COMMIT'); return out; }
  catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; }
  finally { client.release(); }
};
