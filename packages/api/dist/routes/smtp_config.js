"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pool_1 = require("../db/pool");
const crypto_1 = __importDefault(require("crypto"));
const router = (0, express_1.Router)();
const ENCRYPTION_KEY = process.env.SMTP_SECRET || 'rof-crm-secure-key-32-chars-long!!'; // Must be 32 chars
const IV_LENGTH = 16;
function encrypt(text) {
    const iv = crypto_1.default.randomBytes(IV_LENGTH);
    const cipher = crypto_1.default.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}
// GET /api/smtp-configs - List all project SMTP configs
router.get('/', async (req, res, next) => {
    try {
        const result = await pool_1.db.query(`SELECT s.*, p.name as project_name 
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
        const result = await pool_1.db.query(`INSERT INTO project_smtp_configs (
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
exports.default = router;
//# sourceMappingURL=smtp_config.js.map