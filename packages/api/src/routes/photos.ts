// Applicant photos for <img> tags. The address holds a random id, as the old /uploads files did; nothing else is readable here.
import { Router } from 'express';
import { db } from '../index.js';

const router = Router();
router.get('/:kind/:id', async (req, res, next) => {
  try {
    const { kind, id } = req.params;
    if (!['consumer', 'co', 'addl'].includes(kind) || !/^[0-9a-f-]{36}$/i.test(id)) return res.status(404).end();
    const r = (await db.query(`SELECT content_type, data FROM applicant_photos WHERE kind = $1 AND owner_id = $2`, [kind, id])).rows[0];
    if (!r) return res.status(404).end();
    res.set({ 'Content-Type': r.content_type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, max-age=300', 'Content-Security-Policy': "default-src 'none'" }).send(r.data);
  } catch (e) { next(e); }
});
export default router;
