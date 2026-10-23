// Sending, search, the document list, the scanned-contract vault, delete.
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { db } from '../../index.js';
import { AuthRequest } from '../../index.js';
import { auditChange } from '../../middleware/auditLogger.js';
import { bad, failWith, uuid, has, text, body, qtext, day, paging, likeOf } from '../../utils/input.js';
import { encrypt, decrypt } from '../../utils/doc-crypto.js';

const router = Router();

// A stored link must be a web address or a path inside this site (a "javascript:" link would run when someone opens it)
const fileLink = (v: any) => {
  const t = text(v, 'File link', 2000, true)!;
  if (!/^(https?:\/\/[^\s]+|\/[^\s/][^\s]*)$/i.test(t) || t.startsWith('//')) throw bad('File link must be a web address (http or https) or a path on this site');
  return t;
};
const seen = (r: any) => ({ ...r, file_url: r.file_url ? decrypt(r.file_url) : null });

// A real file (the "file" part of a multipart request) is kept in the database; its type is read from its first bytes, not from the name or the browser
const SIGNATURES: [string, number[]][] = [['image/jpeg', [0xff, 0xd8, 0xff]], ['image/png', [0x89, 0x50, 0x4e, 0x47]], ['image/gif', [0x47, 0x49, 0x46, 0x38]], ['application/pdf', [0x25, 0x50, 0x44, 0x46]]];
const sniff = (b: Buffer) => SIGNATURES.find(([, sig]) => sig.every((x, i) => b[i] === x))?.[0] ?? null;
const memory = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
const maybeFile = (req: Request, res: Response, next: NextFunction) =>
  /^multipart\/form-data/i.test(req.headers['content-type'] || '')
    ? memory.single('file')(req, res, (err: any) => err ? res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File too large: 10 MB at most' : 'The upload could not be read' }) : next())
    : next();
const cleanName = (n: string) => n.replace(/^.*[\\/]/, '').replace(/[\u0000-\u001F\u007F<>"|?*]/g, '').trim().slice(0, 255);
// Rows of a unit are visible only when the unit is (units carry the project scope)
const UNIT_OK = `(dv.unit_id IS NULL OR EXISTS (SELECT 1 FROM units su WHERE su.id = dv.unit_id))`;
const LIST_COLS = `dv.id, dv.document_category, dv.document_category AS doc_category, dv.file_url, dv.file_name, dv.created_at, dv.consumer_id, dv.unit_id, dv.remarks,
  dv.content_type, dv.file_size_bytes, (dv.file_data IS NOT NULL) AS has_file`;

// POST /api/documents/:id/send - Mark a generated document for delivery. No mail or message sender is connected yet, so it is queued, never "sent".
router.post('/:id/send', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = uuid(req.params.id, 'Document');
    const b = body(req);
    if (has(b.recipientEmail) && !/^[^\s@<>]{1,64}@[^\s@<>]{1,255}\.[A-Za-z]{2,}$/.test(String(b.recipientEmail))) throw bad('Recipient email is not valid');
    if (has(b.recipientPhone) && !/^\+?[0-9 ()-]{6,20}$/.test(String(b.recipientPhone))) throw bad('Recipient phone is not valid');
    const cur = await db.query(`SELECT delivery_method FROM documents WHERE id = $1 AND deleted_at IS NULL`, [id]);
    if (!cur.rows[0]) throw bad('Document not found', 404);
    const result = await db.query(
      `UPDATE documents SET delivery_status = 'queued', sent_by_user_id = $1 WHERE id = $2 AND deleted_at IS NULL AND delivery_status IS DISTINCT FROM 'delivered'
       RETURNING id, document_type, delivery_status, sent_at`, [req.userId, id]);
    if (!result.rows[0]) throw bad('This document is already delivered', 409);
    res.json({ success: true, data: result.rows[0], message: `Document queued for delivery via ${cur.rows[0].delivery_method}` });
  } catch (error) { failWith(error, res, next); }
});

// GET /api/documents/search - Find documents by words in their text (MUST be before /:consumerId)
router.get('/search', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const term = qtext(req.query.query ?? req.query.q, 'Search', 100);
    if (!term || term.length < 2) throw bad('Search query required (at least 2 characters)');
    const params: any[] = [likeOf(term)];
    let more = '';
    if (has(req.query.projectId)) { params.push(uuid(req.query.projectId, 'Project')); more = `AND allocation_id IN (SELECT id FROM allocations WHERE project_id = $2)`; }
    const result = await db.query(
      `SELECT id, consumer_id, document_type, created_at FROM documents
       WHERE html_content ILIKE $1 ESCAPE '\\' AND deleted_at IS NULL ${more} ORDER BY created_at DESC LIMIT 50`, params);
    res.json({ success: true, data: result.rows });
  } catch (error) { failWith(error, res, next); }
});

// GET /api/documents/edits-report - Audit trail of all document field edits
router.get('/edits-report', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query as Record<string, any>;
    const { size: ps, offset } = paging(q, 50, 200), pg = offset / ps + 1;
    const params: unknown[] = [
      day(q.fromDate, 'From date'), day(q.toDate, 'To date'), qtext(q.documentType, 'Document type', 50),
      has(q.consumerId) ? uuid(q.consumerId, 'Applicant') : null,
      (() => { const e = qtext(q.editedBy, 'Edited by', 100); return e ? likeOf(e) : null; })(),
    ];
    const whereClause = `
      WHERE ($1::date IS NULL OR dfo.edited_at >= $1::date)
        AND ($2::date IS NULL OR dfo.edited_at <  ($2::date + INTERVAL '1 day'))
        AND ($3::text IS NULL OR d.document_type = $3)
        AND ($4::uuid IS NULL OR d.consumer_id   = $4::uuid)
        AND ($5::text IS NULL OR u.name ILIKE $5 ESCAPE '\\')`;
    const baseQuery = `
      FROM document_field_overrides dfo
      JOIN documents d ON d.id = dfo.document_id
      LEFT JOIN consumers c ON c.id = d.consumer_id
      LEFT JOIN users u ON u.id = dfo.edited_by_user_id
      LEFT JOIN LATERAL (
        SELECT dv.version_number, dv.fields_changed FROM document_versions dv
        WHERE dv.document_id = dfo.document_id AND dv.is_original = FALSE
          AND dv.created_at >= dfo.edited_at - INTERVAL '5 seconds' AND dv.created_at <= dfo.edited_at + INTERVAL '5 seconds'
        ORDER BY dv.created_at DESC LIMIT 1
      ) dv ON TRUE
      ${whereClause}`;
    const [countRes, dataRes] = await Promise.all([
      db.query(`SELECT COUNT(*) AS total ${baseQuery}`, params),
      db.query(
        `SELECT dfo.id AS override_id, dfo.document_id, dfo.field_key, dfo.field_label, dfo.section, dfo.original_value, dfo.current_value,
          dfo.value_type, dfo.edit_reason, dfo.edited_at, dfo.is_active, d.document_type, d.version_number AS current_version, d.reference_id, d.consumer_id,
          COALESCE(c.first_name || ' ' || c.last_name, 'N/A') AS consumer_name, c.registration_no, u.name AS edited_by_name, u.email AS edited_by_email,
          dv.version_number AS edit_version, dv.fields_changed
        ${baseQuery} ORDER BY dfo.edited_at DESC LIMIT $6 OFFSET $7`, [...params, ps, offset]),
    ]);
    const total = parseInt(countRes.rows[0].total) || 0;
    res.json({ success: true, edits: dataRes.rows, total, page: pg, pageSize: ps, totalPages: Math.ceil(total / ps) });
  } catch (error) { failWith(error, res, next); }
});

// GET /api/documents - List all documents (with filters)
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query as Record<string, any>;
    const { size, offset } = paging(q, 50, 200);
    const where = ['d.deleted_at IS NULL']; const params: any[] = [];
    const add = (sql: string, v: any) => { params.push(v); where.push(sql.replace('?', `$${params.length}`)); };
    if (has(q.consumerId)) add('d.consumer_id = ?', uuid(q.consumerId, 'Applicant'));
    const dt = qtext(q.documentType, 'Document type', 50); if (dt) add('d.document_type = ?', dt);
    const from = day(q.from, 'From'), to = day(q.to, 'To');
    if (from) add('d.created_at >= ?::date', from);
    if (to) add(`d.created_at < ?::date + interval '1 day'`, to);
    const result = await db.query(
      `SELECT d.id, d.document_type, d.delivery_method, d.delivery_status, d.created_at, d.sent_at, c.name as consumer_name
       FROM documents d LEFT JOIN consumers c ON d.consumer_id = c.id
       WHERE ${where.join(' AND ')} ORDER BY d.created_at DESC, d.id LIMIT ${size} OFFSET ${offset}`, params);
    res.json({ success: true, data: result.rows });
  } catch (error) { failWith(error, res, next); }
});

// POST /api/documents/vault - Save a document in the vault: a file (multipart, "file" part) or the link of a scan; for an applicant, a unit, or both
router.post('/vault', maybeFile, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = body(req);
    const consumerId = has(b.consumerId) ? uuid(b.consumerId, 'Applicant') : null;
    const unitId = has(b.unitId) ? uuid(b.unitId, 'Unit') : null;
    if (!consumerId && !unitId) throw bad('Applicant or unit is required');
    const allocationId = has(b.allocationId) ? uuid(b.allocationId, 'Allocation') : null;
    const category = text(b.documentCategory ?? b.docCategory ?? b.documentType, 'Document category', 100, true)!;
    const remarks = text(b.remarks, 'Remarks', 2000, false);
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file && !has(b.fileUrl)) throw bad('Send a file or the link of the scan');
    if (file && has(b.fileUrl)) throw bad('Send a file or a link, not both');
    let fileName = text(b.fileName, 'File name', 255, false), contentType: string | null = null, fileUrl: string | null = null;
    if (file) {
      contentType = sniff(file.buffer);
      if (!contentType) throw bad('Only jpeg, png, gif and pdf files are allowed');
      if (!file.size) throw bad('The file is empty');
      fileName = fileName || cleanName(file.originalname) || 'document';
    } else fileUrl = fileLink(b.fileUrl);
    if (consumerId && !(await db.query('SELECT 1 FROM consumers WHERE id = $1', [consumerId])).rows[0]) throw bad('Applicant not found', 404);
    if (unitId && !(await db.query('SELECT 1 FROM units WHERE id = $1', [unitId])).rows[0]) throw bad('Unit not found', 404);
    if (allocationId && !(await db.query('SELECT 1 FROM allocations WHERE id = $1 AND ($2::uuid IS NULL OR consumer_id = $2)', [allocationId, consumerId])).rows[0]) throw bad('That allocation does not belong to this applicant');
    const result = await db.query(
      `INSERT INTO document_vault (consumer_id, unit_id, allocation_id, document_category, file_url, file_name, file_data, content_type, file_size_bytes, remarks, uploaded_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, document_category, file_url, file_name, content_type, file_size_bytes, created_at`,
      [consumerId, unitId, allocationId, category, fileUrl ? encrypt(fileUrl) : null, fileName, file?.buffer ?? null, contentType, file?.size ?? null, remarks, req.userId]);
    await auditChange(db, req, res, 'create', 'document_vault', result.rows[0].id, undefined, { consumer_id: consumerId, unit_id: unitId, document_category: category, file_name: fileName, has_file: !!file });
    res.status(201).json({ success: true, data: seen(result.rows[0]) });
  } catch (error) { failWith(error, res, next); }
});

// GET /api/documents/vault/file/:id - The stored file (before /vault/:consumerId so "file" is not read as an id)
router.get('/vault/file/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const r = (await db.query(`SELECT dv.file_name, dv.content_type, dv.file_data FROM document_vault dv WHERE dv.id = $1 AND ${UNIT_OK}`, [uuid(req.params.id, 'Document')])).rows[0];
    if (!r?.file_data) throw bad('No file was stored for this document', 404);
    const ext = r.content_type === 'application/pdf' ? 'pdf' : r.content_type.split('/')[1];
    res.set({ 'Content-Type': r.content_type, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
      'Content-Disposition': `inline; filename="document.${ext}"` }).send(r.file_data);
  } catch (error) { failWith(error, res, next); }
});

// GET /api/documents/vault - List vault documents (filters: documentCategory, consumerId, unitId)
router.get('/vault', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { size, offset } = paging(req.query, 50, 200);
    const cat = qtext(req.query.documentCategory ?? req.query.docCategory, 'Document category', 100);
    const consumerId = has(req.query.consumerId) ? uuid(req.query.consumerId, 'Applicant') : null;
    const unitId = has(req.query.unitId) ? uuid(req.query.unitId, 'Unit') : null;
    const result = await db.query(
      `SELECT ${LIST_COLS}, c.name as consumer_name
       FROM document_vault dv LEFT JOIN consumers c ON dv.consumer_id = c.id
       WHERE ($1::text IS NULL OR dv.document_category = $1) AND ($2::uuid IS NULL OR dv.consumer_id = $2) AND ($3::uuid IS NULL OR dv.unit_id = $3) AND ${UNIT_OK}
       ORDER BY dv.created_at DESC, dv.id LIMIT ${size} OFFSET ${offset}`, [cat, consumerId, unitId]);
    res.json({ success: true, data: result.rows.map(seen) });
  } catch (error) { failWith(error, res, next); }
});

// GET /api/documents/vault/:consumerId - List documents in vault
router.get('/vault/:consumerId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const consumerId = uuid(req.params.consumerId, 'Applicant');
    const cat = qtext(req.query.documentCategory, 'Document category', 100);
    const result = await db.query(
      `SELECT ${LIST_COLS} FROM document_vault dv
       WHERE dv.consumer_id = $1 AND ($2::text IS NULL OR dv.document_category = $2) AND ${UNIT_OK} ORDER BY dv.document_category, dv.created_at DESC, dv.id`, [consumerId, cat]);
    res.json({ success: true, data: result.rows.map(seen) });
  } catch (error) { failWith(error, res, next); }
});

// GET /api/documents/:consumerId - Get documents for consumer
router.get('/:consumerId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const consumerId = uuid(req.params.consumerId, 'Applicant');
    const dt = qtext(req.query.documentType, 'Document type', 50);
    const result = await db.query(
      `SELECT id, document_type, delivery_method, delivery_status, created_at, sent_at FROM documents
       WHERE consumer_id = $1 AND deleted_at IS NULL AND ($2::text IS NULL OR document_type = $2) ORDER BY created_at DESC, id`, [consumerId, dt]);
    res.json({ success: true, data: result.rows });
  } catch (error) { failWith(error, res, next); }
});

// DELETE /api/documents/:id - Delete document (marks as deleted, not hard delete)
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = uuid(req.params.id, 'Document');
    const result = await db.query(
      `UPDATE documents SET deleted_at = NOW(), deleted_by_user_id = $1 WHERE id = $2 AND deleted_at IS NULL RETURNING id, document_type`, [req.userId, id]);
    if (!result.rows[0]) throw bad('Document not found', 404);
    await auditChange(db, req, res, 'delete', 'document', id, { document_type: result.rows[0].document_type });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) { failWith(error, res, next); }
});

export default router;
