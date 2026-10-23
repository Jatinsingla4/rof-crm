import { Router, Response, NextFunction } from 'express';
import { AuthRequest } from '../index.js';
import { db } from '../db/pool';
import crypto from 'crypto';
import { bad, failWith, uuid, has, text, body, flag } from '../utils/input.js';
import { auditChange } from '../middleware/auditLogger.js';

const router = Router();

// The mail password is sealed with SMTP_SECRET (any length). There is no built-in key: without the secret a password cannot be saved
// (development builds use a fixed local key so tests run). A stored password is never sent back to any screen.
const secret = () => {
  const s = process.env.SMTP_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-only-smtp-secret');
  if (!s) throw bad('SMTP_SECRET is not set on the server, so a mail password cannot be saved', 503);
  return crypto.createHash('sha256').update(s).digest();
};
const seal = (plain: string) => {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', secret(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v2', iv.toString('hex'), c.getAuthTag().toString('hex'), enc.toString('hex')].join(':');
};
// For the mail sender when one is connected
export const openSealed = (stored: string) => {
  const [v, iv, tag, enc] = stored.split(':');
  if (v !== 'v2') throw new Error('Old mail password format: save the password again');
  const d = crypto.createDecipheriv('aes-256-gcm', secret(), Buffer.from(iv, 'hex'));
  d.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([d.update(Buffer.from(enc, 'hex')), d.final()]).toString('utf8');
};

const EMAIL = /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const HOST = /^(?=.{1,253}$)([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/;
// The server must not be pointed at this machine or the cloud's internal address
const INTERNAL = /^(localhost|.*\.localhost|.*\.local|.*\.internal|0+|127\..*|10\..*|192\.168\..*|169\.254\..*|172\.(1[6-9]|2\d|3[01])\..*|0\..*)$/i;
const email = (v: any, label: string, required: boolean) => {
  const t = text(v, label, 255, required); if (t === null) return null;
  if (!EMAIL.test(t)) throw bad(`${label} is not a valid email address`); return t.toLowerCase();
};
const emailList = (v: any, label: string) => {
  if (!has(v)) return null;
  if (typeof v !== 'string') throw bad(`${label} must be text`);
  const parts = v.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
  if (!parts.length) return null;
  if (parts.length > 10) throw bad(`${label} can have at most 10 addresses`);
  return [...new Set(parts.map((p) => email(p, label, true)!))].join(', ');
};
const safe = `s.id, s.project_id, p.name AS project_name, s.host, s.port, s.username, s.from_name, s.from_email, s.use_ssl,
  s.cc_emails, s.bcc_emails, s.is_active, s.updated_at, (s.password_encrypted IS NOT NULL AND s.password_encrypted <> '') AS has_password`;

// GET /api/smtp-configs - List project SMTP configs (the project scope applies; the password is never returned)
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(`SELECT ${safe} FROM project_smtp_configs s JOIN projects p ON s.project_id = p.id ORDER BY p.name`);
    res.json({ success: true, data: result.rows });
  } catch (error) { next(error); }
});

// POST /api/smtp-configs - Create or update a project's config (mail credentials: super admin only)
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.userRole !== 'super_admin') throw bad('Only a super admin can change the mail server settings', 403);
    const b = body(req);
    const projectId = uuid(b.projectId, 'Project');
    if (!(await db.query('SELECT 1 FROM projects WHERE id = $1', [projectId])).rows[0]) throw bad('Project not found', 404);

    const host = text(b.host, 'Host', 253, true)!;
    if (!HOST.test(host) || !/[A-Za-z0-9]/.test(host)) throw bad('Host must be a server name like smtp.example.com');
    if (INTERNAL.test(host)) throw bad('Host cannot be this machine or a private network address');
    let port = 587;
    if (has(b.port)) {
      port = typeof b.port === 'number' ? b.port : typeof b.port === 'string' && /^\d{1,5}$/.test(b.port) ? Number(b.port) : NaN;
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw bad('Port must be a whole number from 1 to 65535');
    }
    const username = text(b.username, 'Username', 255, false);
    const fromName = text(b.fromName, 'Sender name', 100, false);
    const fromEmail = email(b.fromEmail, 'Sender email', true);
    const useSsl = flag(b.useSsl, 'Use SSL') ?? true;
    const isActive = flag(b.isActive, 'Active') ?? true;
    const cc = emailList(b.ccEmails, 'CC'), bcc = emailList(b.bccEmails, 'BCC');

    let sealed: string | null = null;
    if (has(b.password)) {
      if (typeof b.password !== 'string' || b.password.length > 256 || /[\u0000-\u001F\u007F]/.test(b.password)) throw bad('Password must be text up to 256 characters without control characters');
      sealed = seal(b.password);
    }

    const before = (await db.query('SELECT host, port, username, from_name, from_email, use_ssl, is_active, (password_encrypted IS NOT NULL) AS has_password FROM project_smtp_configs WHERE project_id = $1', [projectId])).rows[0];
    if (!before && !sealed) throw bad('Password is required for a new mail setup');

    const r = await db.query(
      `INSERT INTO project_smtp_configs (project_id, host, port, username, password_encrypted, from_name, from_email, use_ssl, cc_emails, bcc_emails, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (project_id) DO UPDATE SET host = EXCLUDED.host, port = EXCLUDED.port, username = EXCLUDED.username,
         password_encrypted = COALESCE($5, project_smtp_configs.password_encrypted), from_name = EXCLUDED.from_name, from_email = EXCLUDED.from_email,
         use_ssl = EXCLUDED.use_ssl, cc_emails = EXCLUDED.cc_emails, bcc_emails = EXCLUDED.bcc_emails, is_active = EXCLUDED.is_active, updated_at = NOW()
       RETURNING id`,
      [projectId, host, port, username, sealed, fromName, fromEmail, useSsl, cc, bcc, isActive]);
    await auditChange(db, req, res, before ? 'update' : 'create', 'project_smtp_config', r.rows[0].id, before,
      { host, port, username, from_name: fromName, from_email: fromEmail, use_ssl: useSsl, is_active: isActive, password_changed: !!sealed });
    res.json({ success: true, data: r.rows[0] });
  } catch (error) { failWith(error, res, next); }
});

export default router;
