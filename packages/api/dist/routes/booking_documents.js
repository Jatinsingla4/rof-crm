/**
 * Booking Documents Routes
 * Handles document uploads and metadata for booking records.
 * Each document is linked to a booking_record and optionally an applicant_number.
 */
import { Router } from 'express';
import { existsSync, unlinkSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { db } from '../index.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const docStorage = multer.diskStorage({
    destination(_req, _file, cb) {
        cb(null, path.join(__dirname, '../../uploads/booking-documents'));
    },
    filename(_req, file, cb) {
        const ext = path.extname(file.originalname).toLowerCase();
        const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        cb(null, `${uid}${ext}`);
    },
});
const docUpload = multer({
    storage: docStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter(_req, file, cb) {
        if (/^(image\/(jpeg|jpg|png|gif)|application\/pdf)$/.test(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Only jpeg, jpg, png, gif, and pdf files are allowed'));
        }
    },
});
const router = Router();
// POST /api/booking-documents/upload
router.post('/upload', docUpload.single('file'), async (req, res, next) => {
    try {
        const { booking_record_id, consumer_id, applicant_number = 0, document_type, document_name, barcode_no, physical_storage_no, scan_reference_no, remarks, } = req.body;
        if (!booking_record_id)
            return res.status(400).json({ error: 'booking_record_id is required' });
        if (!consumer_id)
            return res.status(400).json({ error: 'consumer_id is required' });
        if (!document_type)
            return res.status(400).json({ error: 'document_type is required' });
        let file_url = null;
        let file_original_name = null;
        let file_mime_type = null;
        let file_size_bytes = null;
        if (req.file) {
            file_url = `/uploads/booking-documents/${req.file.filename}`;
            file_original_name = req.file.originalname;
            file_mime_type = req.file.mimetype;
            file_size_bytes = req.file.size;
        }
        const result = await db.query(`INSERT INTO booking_documents
         (booking_record_id, consumer_id, applicant_number, document_type, document_name,
          barcode_no, physical_storage_no, scan_reference_no, file_url,
          file_original_name, file_mime_type, file_size_bytes, remarks, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`, [
            booking_record_id,
            consumer_id,
            parseInt(applicant_number) || 0,
            document_type,
            document_name || null,
            barcode_no || null,
            physical_storage_no || null,
            scan_reference_no || null,
            file_url,
            file_original_name,
            file_mime_type,
            file_size_bytes,
            remarks || null,
            req.userId,
        ]);
        res.status(201).json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/booking-documents?booking_record_id=&consumer_id=&applicant_number=&document_type=
router.get('/', async (req, res, next) => {
    try {
        const { booking_record_id, consumer_id, applicant_number, document_type } = req.query;
        if (!booking_record_id)
            return res.status(400).json({ error: 'booking_record_id is required' });
        const params = [booking_record_id];
        let where = 'WHERE bd.booking_record_id = $1 AND bd.deleted_at IS NULL';
        if (consumer_id) {
            where += ` AND bd.consumer_id = $${params.length + 1}`;
            params.push(consumer_id);
        }
        if (applicant_number !== undefined) {
            where += ` AND bd.applicant_number = $${params.length + 1}`;
            params.push(parseInt(applicant_number));
        }
        if (document_type) {
            where += ` AND bd.document_type = $${params.length + 1}`;
            params.push(document_type);
        }
        const result = await db.query(`SELECT bd.*, u.name as created_by_name
       FROM booking_documents bd
       LEFT JOIN users u ON u.id = bd.created_by
       ${where}
       ORDER BY bd.applicant_number ASC, bd.created_at ASC`, params);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
// PATCH /api/booking-documents/:id
router.patch('/:id', async (req, res, next) => {
    try {
        const { document_name, barcode_no, physical_storage_no, scan_reference_no, remarks } = req.body;
        const result = await db.query(`UPDATE booking_documents
       SET document_name        = COALESCE($1, document_name),
           barcode_no           = COALESCE($2, barcode_no),
           physical_storage_no  = COALESCE($3, physical_storage_no),
           scan_reference_no    = COALESCE($4, scan_reference_no),
           remarks              = COALESCE($5, remarks),
           updated_at           = NOW()
       WHERE id = $6 AND deleted_at IS NULL
       RETURNING *`, [document_name || null, barcode_no || null, physical_storage_no || null,
            scan_reference_no || null, remarks || null, req.params.id]);
        if (!result.rows[0])
            return res.status(404).json({ error: 'Document not found' });
        res.json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/booking-documents/:id
router.delete('/:id', async (req, res, next) => {
    try {
        const doc = await db.query(`SELECT file_url FROM booking_documents WHERE id = $1 AND deleted_at IS NULL`, [req.params.id]);
        if (!doc.rows[0])
            return res.status(404).json({ error: 'Document not found' });
        await db.query(`UPDATE booking_documents SET deleted_at = NOW(), deleted_by = $1, updated_at = NOW() WHERE id = $2`, [req.userId, req.params.id]);
        if (doc.rows[0].file_url) {
            const filePath = path.join(__dirname, '../../', doc.rows[0].file_url);
            if (existsSync(filePath)) {
                try {
                    unlinkSync(filePath);
                }
                catch (_) { /* non-fatal */ }
            }
        }
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
export default router;
//# sourceMappingURL=booking_documents.js.map