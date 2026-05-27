import { Router } from 'express';
import { db } from '../db/pool';
import crypto from 'crypto';
const router = Router();
const ENCRYPTION_KEY = process.env.SMTP_SECRET || 'rof-crm-secure-key-32-chars-long!!'; // Must be 32 chars
const IV_LENGTH = 16;
function encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}
// GET /api/smtp-configs - List all project SMTP configs
router.get('/', async (req, res, next) => {
    try {
        const result = await db.query(`SELECT s.*, p.name as project_name 
       FROM project_smtp_configs s 
       JOIN projects p ON s.project_id = p.id`);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/smtp-configs - Create or update config
router.post('/', async (req, res, next) => {
    try {
        const { projectId, host, port, username, password, fromName, fromEmail, useSsl, ccEmails, bccEmails } = req.body;
        const passEnc = password ? encrypt(password) : undefined;
        const result = await db.query(`INSERT INTO project_smtp_configs (
        project_id, host, port, username, password_encrypted, from_name, from_email, use_ssl, cc_emails, bcc_emails
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (project_id) DO UPDATE SET
        host = EXCLUDED.host,
        port = EXCLUDED.port,
        username = EXCLUDED.username,
        password_encrypted = COALESCE($5, project_smtp_configs.password_encrypted),
        from_name = EXCLUDED.from_name,
        from_email = EXCLUDED.from_email,
        use_ssl = EXCLUDED.use_ssl,
        cc_emails = EXCLUDED.cc_emails,
        bcc_emails = EXCLUDED.bcc_emails,
        updated_at = NOW()
      RETURNING id`, [projectId, host, port, username, passEnc, fromName, fromEmail, useSsl, ccEmails, bccEmails]);
        res.json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        next(error);
    }
});
export default router;
//# sourceMappingURL=smtp_config.js.map