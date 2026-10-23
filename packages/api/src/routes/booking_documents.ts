/**
 * Booking Documents Routes
 * Handles document uploads and metadata for booking records.
 * Each document is linked to a booking_record and optionally an applicant_number.
 * Files are kept in the database and opened through /:id/file (login or a 2-minute link token).
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';
import { pgErrorHandler } from '../middleware/pg-errors.js';
import { hasPermission } from '../middleware/rbac.js';
import { auditChange } from '../middleware/auditLogger.js';
import { bad, uuid, has, num, text, body, qtext } from '../utils/input.js';

// Type of the file is read from its first bytes; the name and the declared type from the browser are not trusted
const SIGNATURES: [string, number[]][] = [['image/jpeg', [0xff, 0xd8, 0xff]], ['image/png', [0x89, 0x50, 0x4e, 0x47]], ['image/gif', [0x47, 0x49, 0x46, 0x38]], ['application/pdf', [0x25, 0x50, 0x44, 0x46]]];
const sniff = (b: Buffer) => SIGNATURES.find(([, sig]) => sig.every((x, i) => b[i] === x))?.[0] ?? null;
const memory = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const oneFile = (req: Request, res: Response, next: NextFunction) =>
  memory.single('file')(req, res, (err: any) => err
    ? res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File too large — maximum size is 10MB' : err.message })
    : next());
const fail = (err: any, res: Response, next: NextFunction) => (err?.http ? res.status(err.http).json({ error: err.message }) : next(err));
const LIST = `id, booking_record_id, consumer_id, applicant_number, document_type, document_name, barcode_no, physical_storage_no,
  scan_reference_no, file_url, file_original_name, file_mime_type, file_size_bytes, remarks, created_by, created_at, updated_at`;

const router = Router();

// Reading is open to every signed-in role; changing needs the sales (consumers) rights
router.use((req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.method === 'GET') return next();
  if (hasPermission(req.userRole, 'consumers', req.method === 'POST' ? 'create' : 'edit')) return next();
  res.status(403).json({ error: 'Your role cannot change booking documents' });
});
router.param('id', (req, res, next, id) => { try { uuid(id, 'Document id'); next(); } catch (e) { fail(e, res, next); } });

// POST /api/booking-documents/upload
router.post('/upload', oneFile, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = body(req);
    const bookingId = uuid(b.booking_record_id, 'booking_record_id'), consumerId = uuid(b.consumer_id, 'consumer_id');
    const documentType = text(b.document_type, 'document_type', 100, true)!;
    const applicantNo = has(b.applicant_number) ? num(b.applicant_number, 'applicant_number', 12, 0) : 0;
    const documentName = text(b.document_name, 'document_name', 255, false), barcode = text(b.barcode_no, 'barcode_no', 100, false);
    const storage = text(b.physical_storage_no, 'physical_storage_no', 100, false), scanRef = text(b.scan_reference_no, 'scan_reference_no', 100, false), remarks = text(b.remarks, 'remarks', 2000, false);
    let type: string | null = null;
    if (req.file) {
      type = sniff(req.file.buffer);
      if (!type) throw bad('Only jpeg, jpg, png, gif, and pdf files are allowed');
    }
    const bk = (await db.query(`SELECT consumer_id, status FROM booking_records WHERE id = $1`, [bookingId])).rows[0];
    if (!bk) throw bad('Booking not found', 404);
    if (bk.consumer_id !== consumerId) throw bad('This booking belongs to a different applicant');
    if (bk.status === 'cancelled') throw bad('This booking is cancelled', 409);

    const row = (await db.query(
      `INSERT INTO booking_documents
         (booking_record_id, consumer_id, applicant_number, document_type, document_name,
          barcode_no, physical_storage_no, scan_reference_no, file_original_name, file_mime_type, file_size_bytes, file_data, remarks, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id`,
      [bookingId, consumerId, applicantNo, documentType, documentName, barcode, storage, scanRef,
       req.file ? text(req.file.originalname, 'file name', 255, false) ?? 'file' : null, type, req.file ? req.file.size : null, req.file ? req.file.buffer : null, remarks, req.userId])).rows[0];
    if (req.file) await db.query(`UPDATE booking_documents SET file_url = $2 WHERE id = $1`, [row.id, `/api/booking-documents/${row.id}/file?token=`]);
    const data = (await db.query(`SELECT ${LIST} FROM booking_documents WHERE id = $1`, [row.id])).rows[0];
    await auditChange(db, req, res, 'create', 'booking_document', row.id, {}, { booking_record_id: bookingId, document_type: documentType, applicant_number: applicantNo });
    res.status(201).json({ success: true, data });
  } catch (err) { fail(err, res, next); }
});

// GET /api/booking-documents/:id/file — the stored file (page address carries a link token when opened in a tab)
router.get('/:id/file', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const d = (await db.query(`SELECT file_data, file_mime_type, file_original_name FROM booking_documents WHERE id = $1 AND deleted_at IS NULL AND EXISTS (SELECT 1 FROM booking_records br WHERE br.id = booking_record_id)`, [req.params.id])).rows[0];
    if (!d?.file_data) return res.status(404).json({ error: 'File not found' });
    const name = String(d.file_original_name || 'document').replace(/[^\w.\- ]/g, '_');
    res.set({ 'Content-Type': d.file_mime_type, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Content-Disposition': `inline; filename="${name}"`, 'Cache-Control': 'private, no-store' }).send(d.file_data);
  } catch (err) { fail(err, res, next); }
});

// GET /api/booking-documents?booking_record_id=&consumer_id=&applicant_number=&document_type=
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query as Record<string, any>;
    for (const [k, v] of Object.entries(q)) if (typeof v !== 'string') throw bad(`${k} must be given once`);
    if (!q.booking_record_id) throw bad('booking_record_id is required');
    const params: any[] = [uuid(q.booking_record_id, 'booking_record_id')];
    let where = 'WHERE bd.booking_record_id = $1 AND bd.deleted_at IS NULL AND EXISTS (SELECT 1 FROM booking_records br WHERE br.id = bd.booking_record_id)'; // the booking decides the project scope, whatever the applicant's own project is
    if (q.consumer_id) { where += ` AND bd.consumer_id = $${params.length + 1}`; params.push(uuid(q.consumer_id, 'consumer_id')); }
    if (q.applicant_number !== undefined) { where += ` AND bd.applicant_number = $${params.length + 1}`; params.push(num(q.applicant_number, 'applicant_number', 12, 0)); }
    const dt = qtext(q.document_type, 'document_type', 100);
    if (dt) { where += ` AND bd.document_type = $${params.length + 1}`; params.push(dt); }
    const result = await db.query(
      `SELECT ${LIST.split(',').map(c => 'bd.' + c.trim()).join(', ')}, u.name as created_by_name
       FROM booking_documents bd
       LEFT JOIN users u ON u.id = bd.created_by
       ${where}
       ORDER BY bd.applicant_number ASC, bd.created_at ASC`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { fail(err, res, next); }
});

// PATCH /api/booking-documents/:id
router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = body(req);
    // A field that is sent changes (an empty value or null clears it); a field that is left out stays as it is
    const rules: [string, number][] = [['document_name', 255], ['barcode_no', 100], ['physical_storage_no', 100], ['scan_reference_no', 100], ['remarks', 2000]];
    const sent = rules.filter(([k]) => k in b);
    if (!sent.length) throw bad('Send at least one of: ' + rules.map(([k]) => k).join(', '));
    const f: Record<string, string | null> = Object.fromEntries(sent.map(([k, max]) => [k, text(b[k], k, max, false)]));
    const result = await db.query(
      `UPDATE booking_documents SET ${sent.map(([k], i) => `${k} = $${i + 1}`).join(', ')}, updated_at = NOW()
       WHERE id = $${sent.length + 1} AND deleted_at IS NULL AND EXISTS (SELECT 1 FROM booking_records br WHERE br.id = booking_record_id)
       RETURNING ${LIST}`,
      [...Object.values(f), req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Document not found' });
    await auditChange(db, req, res, 'update', 'booking_document', req.params.id, {}, f);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { fail(err, res, next); }
});

// DELETE /api/booking-documents/:id
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const r = await db.query(
      `UPDATE booking_documents SET deleted_at = NOW(), deleted_by = $1, file_data = NULL, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL AND EXISTS (SELECT 1 FROM booking_records br WHERE br.id = booking_record_id) RETURNING id, document_type`,
      [req.userId, req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Document not found' });
    await auditChange(db, req, res, 'delete', 'booking_document', req.params.id, { document_type: r.rows[0].document_type }, {});
    res.json({ success: true });
  } catch (err) { fail(err, res, next); }
});

router.use(pgErrorHandler);
export default router;
