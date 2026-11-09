import { Router, Response, NextFunction } from 'express';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';
import { pgErrorHandler } from '../middleware/pg-errors.js';
import { auditChange } from '../middleware/auditLogger.js';
import { bad, failWith, uuid, has, text, day, body, inTx, paging, qtext } from '../utils/input.js';

const router = Router();
const fail = (e: any, res: Response, next: NextFunction) => failWith(e, res, next);

/**
 * GET /api/registry - List registry status (mounted with rbac('allocations'))
 */
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const params: any[] = []; let where = '';
    if (has(req.query.projectId)) where += ` AND u.project_id = $${params.push(uuid(req.query.projectId, 'projectId'))}`;
    const status = qtext(req.query.status, 'status', 50); if (status) where += ` AND rd.status = $${params.push(status)}`;
    const { size, offset } = paging(req.query, 500, 1000);
    const result = await db.query(
      `SELECT rd.*, c.name as consumer_name, u.unit_number, p.name as project_name
         FROM registry_details rd
         JOIN consumers c ON rd.consumer_id = c.id
         JOIN units u ON rd.unit_id = u.id
         JOIN projects p ON u.project_id = p.id
        WHERE 1=1 ${where} ORDER BY rd.created_at DESC LIMIT ${size} OFFSET ${offset}`, params);
    res.json({ success: true, data: result.rows });
  } catch (error) { fail(error, res, next); }
});

/**
 * POST /api/registry/schedule - Schedule Registry (only when every demand is paid; one open appointment per allocation)
 */
router.post('/schedule', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = body(req);
    if (!has(b.allocationId)) throw bad('allocationId is required');
    const allocationId = uuid(b.allocationId, 'allocationId'), appointmentDate = day(b.appointmentDate, 'appointmentDate'), remarks = text(b.remarks, 'remarks', 500, false);
    if (!appointmentDate) throw bad('appointmentDate is required');

    const row = await inTx(async (c) => {
      const al = (await c.query(`SELECT id, unit_id, consumer_id, status FROM allocations WHERE id = $1 FOR UPDATE`, [allocationId])).rows[0];
      if (!al) throw bad('Allocation not found', 404);
      if (['cancelled', 'transferred'].includes(al.status)) throw bad(`This allocation is ${al.status}`, 409);
      if ((await c.query(`SELECT 1 FROM registry_details WHERE allocation_id = $1 AND status = 'scheduled'`, [allocationId])).rows.length) throw bad('A registry appointment is already scheduled for this allocation', 409);
      // Ledger balance: every live demand (tax and add-on charges included) less every live receipt
      const balance = Number((await c.query(
        `SELECT COALESCE((SELECT SUM(amount_due_inr + COALESCE(cgst_amount,0) + COALESCE(sgst_amount,0) + COALESCE(addon_charge_amount,0) + COALESCE(addon_cgst_amount,0) + COALESCE(addon_sgst_amount,0))
                            FROM demands WHERE consumer_id = $1 AND status <> 'cancelled'), 0)
              - COALESCE((SELECT SUM(amount_received_inr) FROM receipts WHERE consumer_id = $1 AND status = 'cleared' AND NOT COALESCE(is_advance, false)), 0) AS balance`, [al.consumer_id])).rows[0].balance);
      if (balance > 0) throw bad('Registry cannot be scheduled until all dues are cleared. Current balance: ' + Math.round(balance * 100) / 100);
      return (await c.query(
        `INSERT INTO registry_details (allocation_id, unit_id, consumer_id, appointment_date, remarks, status) VALUES ($1, $2, $3, $4, $5, 'scheduled') RETURNING id, status`,
        [allocationId, al.unit_id, al.consumer_id, appointmentDate, remarks])).rows[0];
    });
    await auditChange(db, req, res, 'create', 'registry', row.id, undefined, { allocation_id: allocationId, appointment_date: appointmentDate });
    res.status(201).json({ success: true, data: row });
  } catch (error) { fail(error, res, next); }
});

router.use(pgErrorHandler);
export default router;
