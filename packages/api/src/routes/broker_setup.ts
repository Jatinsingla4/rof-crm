/**
 * Broker Setup Routes (Compliance & Tax)
 * TDS and GST rates used when a broker's commission is paid. There are no default rates: a broker without a row cannot be paid a commission until its setup is saved.
 * Only super_admin and accounts_finance reach these routes (rbac 'broker_setup').
 */
import { Router, Response, NextFunction } from 'express';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';
import { bad, failWith, uuid, has, num, flag, body, inTx, paging, qtext, lock } from '../utils/input.js';
import { auditChange } from '../middleware/auditLogger.js';
import { pgErrorHandler } from '../middleware/pg-errors.js';

const router = Router();
const fail = (e: any, res: Response, next: NextFunction) => failWith(e, res, next);

// GET /api/broker-setup  every broker with its effective TDS / GST setup ('configured' says whether it has its own row)
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { size, offset } = paging(req.query, 200, 500);
    const search = qtext(req.query.search, 'search', 100);
    const params: any[] = [];
    let w = `WHERE b.status NOT IN ('rejected')`;
    if (search) { params.push(`%${search.replace(/[\\%_]/g, '\\$&')}%`); w += ` AND (b.name ILIKE $1 OR b.firm_name ILIKE $1)`; }
    const result = await db.query(
      `SELECT b.id AS broker_id, b.name AS broker_name, b.firm_name, b.status AS broker_status,
              btc.tds_rate_pct, btc.gst_rate_pct,
              COALESCE(btc.is_gst_exempt, false) AS is_gst_exempt, (btc.id IS NOT NULL) AS configured, btc.updated_at
         FROM brokers b LEFT JOIN broker_tax_config btc ON btc.broker_id = b.id
         ${w} ORDER BY b.firm_name NULLS LAST, b.name LIMIT ${size} OFFSET ${offset}`, params);
    res.json({ success: true, data: result.rows });
  } catch (error) { fail(error, res, next); }
});

// GET /api/broker-setup/:brokerId
router.get('/:brokerId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const brokerId = uuid(req.params.brokerId, 'Broker id');
    if (!(await db.query(`SELECT 1 FROM brokers WHERE id = $1`, [brokerId])).rows.length) return res.status(404).json({ error: 'Broker not found' });
    const result = await db.query(`SELECT * FROM broker_tax_config WHERE broker_id = $1`, [brokerId]);
    if (result.rows.length === 0) {
      return res.json({ success: true, data: { broker_id: brokerId, tds_rate_pct: null, gst_rate_pct: null, is_gst_exempt: false, configured: false } });
    }
    res.json({ success: true, data: { ...result.rows[0], configured: true } });
  } catch (error) { fail(error, res, next); }
});

// POST /api/broker-setup/:brokerId   a rate left out keeps its current value; the first time both rates are needed (there are no defaults)
router.post('/:brokerId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const brokerId = uuid(req.params.brokerId, 'Broker id');
    const b = body(req);
    const tds = has(b.tdsRatePct) ? num(b.tdsRatePct, 'TDS rate', 100, 2) : null;
    const gst = has(b.gstRatePct) ? num(b.gstRatePct, 'GST rate', 100, 2) : null;
    const exempt = flag(b.isGstExempt, 'isGstExempt') ?? null;
    if (tds === null && gst === null && exempt === null) throw bad('Send tdsRatePct, gstRatePct or isGstExempt');
    const out = await inTx(async (c) => {
      const brk = (await c.query(`SELECT status FROM brokers WHERE id = $1`, [brokerId])).rows[0];
      if (!brk) throw bad('Broker not found', 404);
      await lock(c, 'broker-tax:' + brokerId); // two first saves together: the second sees the first and is logged as an update
      const before = (await c.query(`SELECT tds_rate_pct, gst_rate_pct, is_gst_exempt FROM broker_tax_config WHERE broker_id = $1 FOR UPDATE`, [brokerId])).rows[0];
      if (!before && (tds === null || gst === null)) throw bad('This broker has no tax setup yet: send both tdsRatePct and gstRatePct');
      const row = (await c.query(
        `INSERT INTO broker_tax_config (broker_id, tds_rate_pct, gst_rate_pct, is_gst_exempt, updated_by)
         VALUES ($1, $2, $3, COALESCE($4, false), $5)
         ON CONFLICT (broker_id) DO UPDATE SET
           tds_rate_pct = COALESCE($2, broker_tax_config.tds_rate_pct),
           gst_rate_pct = COALESCE($3, broker_tax_config.gst_rate_pct),
           is_gst_exempt = COALESCE($4, broker_tax_config.is_gst_exempt),
           updated_at = NOW(), updated_by = $5
         RETURNING *`, [brokerId, tds, gst, exempt, req.userId])).rows[0];
      return { before, row };
    });
    await auditChange(db, req, res, out.before ? 'update' : 'create', 'broker_tax_config', out.row.id, out.before, { tds_rate_pct: out.row.tds_rate_pct, gst_rate_pct: out.row.gst_rate_pct, is_gst_exempt: out.row.is_gst_exempt });
    res.json({ success: true, data: out.row });
  } catch (error) { fail(error, res, next); }
});

router.use(pgErrorHandler);
export default router;
