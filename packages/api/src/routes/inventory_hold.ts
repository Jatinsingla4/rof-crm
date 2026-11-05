/**
 * Inventory Hold Routes (Governance)
 * A broker can hold an available unit for a few hours. Rules:
 *  - one active hold per unit (database index), the unit is locked while the hold is made
 *  - the broker has to be active; hold time is a whole number of hours, 1 to 72
 *  - only the person who made a hold, a project manager or a super admin can release it
 *  - a held unit can be booked only by the broker who holds it (the hold becomes 'converted'), or after the hold expired or was released
 */
import { Router, Response, NextFunction } from 'express';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';
import { bad, failWith, uuid, has, text, body, inTx, paging, oneOf } from '../utils/input.js';
import { mobileNo } from '../utils/applicant.js';
import { closeHold, expireDueHolds } from '../utils/holds.js';
import { mappedOk } from '../utils/broker.js';
import { auditChange } from '../middleware/auditLogger.js';
import { pgErrorHandler } from '../middleware/pg-errors.js';
import { applyUnitStatusFilter, assertUnitGrant } from '../middleware/unitStatusAccess.js';

const router = Router();
const fail = (e: any, res: Response, next: NextFunction) => failWith(e, res, next, 'This unit is already held');

// GET /api/inventory-hold?status=active|expired|converted|cancelled|all
router.get('/', applyUnitStatusFilter, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const status = oneOf(req.query.status, 'status', ['active', 'expired', 'converted', 'cancelled', 'all'] as const) || 'active';
    const { size, offset } = paging(req.query, 200, 500);
    await expireDueHolds();
    const params: any[] = [];
    let where = '';
    if (status !== 'all') { params.push(status); where = `WHERE uh.status = $1`; }
    // inventory view: only holds on units whose current status the login's unit-status grant covers (none: an empty list)
    const f = req.unitStatusFilter;
    if (f !== null) { params.push(f ?? []); where += `${where ? ' AND' : 'WHERE'} u.status::text = ANY($${params.length}::text[])`; }
    params.push(size, offset);
    const result = await db.query(
      `SELECT uh.*, u.unit_number, u.bhk_type, u.floor, t.tower_name, p.name AS project_name, u.project_id,
              b.firm_name AS broker_firm_name, b.name AS broker_name, cu.name AS held_by_name
         FROM unit_holds uh
         JOIN units u ON uh.unit_id = u.id
         JOIN towers t ON u.tower_id = t.id
         JOIN projects p ON u.project_id = p.id
         JOIN brokers b ON uh.broker_id = b.id
         LEFT JOIN users cu ON cu.id = uh.created_by
         ${where}
        ORDER BY uh.held_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    res.json({ success: true, data: result.rows });
  } catch (error) { fail(error, res, next); }
});

// POST /api/inventory-hold
router.post('/', applyUnitStatusFilter, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = body(req);
    const unitId = uuid(b.unitId, 'unitId'), brokerId = uuid(b.brokerId, 'brokerId');
    const clientName = text(b.clientName, 'Client name', 255, false);
    const clientMobile = has(b.clientMobile) ? mobileNo(b.clientMobile, 'Client mobile') : null;
    const notes = text(b.notes, 'Notes', 1000, false);
    let hours = 24;
    if (has(b.holdHours)) {
      const h = typeof b.holdHours === 'number' ? b.holdHours : typeof b.holdHours === 'string' && /^\d+$/.test(b.holdHours) ? Number(b.holdHours) : NaN;
      if (!Number.isInteger(h) || h < 1 || h > 72) throw bad('Hold time must be a whole number of hours from 1 to 72');
      hours = h;
    }
    await expireDueHolds();
    const hold = await inTx(async (c) => {
      const unit = (await c.query(`SELECT id, status, project_id FROM units WHERE id = $1 FOR UPDATE`, [unitId])).rows[0];
      if (!unit) throw bad('Unit not found', 404);
      assertUnitGrant(req, unit.status);   // a hold reserves available inventory: needs the inventory grant (checked first, against the unit's current status)
      const brk = (await c.query(`SELECT status FROM brokers WHERE id = $1`, [brokerId])).rows[0];
      if (!brk) throw bad('Broker not found', 404);
      // Broker authentication of the project: Automatic lets a broker nobody has approved yet hold units here; Manual (the default) needs an active broker
      const brokerMode = (await c.query(`SELECT broker_auth_mode FROM project_settings WHERE project_id = $1`, [unit.project_id])).rows[0]?.broker_auth_mode ?? 'Manual';
      if (brk.status !== 'active' && !(brokerMode === 'Automatic' && brk.status === 'pending')) throw bad(`This broker is ${brk.status}, only an active broker can hold a unit`);
      await mappedOk(c, brokerId, unit.project_id);
      if (unit.status !== 'available') throw bad(`Unit cannot be held. Current status: ${unit.status}`, 409);
      const h = (await c.query(
        `INSERT INTO unit_holds (unit_id, broker_id, client_name, client_mobile, expires_at, status, notes, created_by)
         VALUES ($1, $2, $3, $4, NOW() + interval '1 hour' * $5, 'active', $6, $7) RETURNING *`,
        [unitId, brokerId, clientName, clientMobile, hours, notes, req.userId])).rows[0];
      await c.query(`UPDATE units SET status = 'held', status_changed_at = NOW() WHERE id = $1`, [unitId]);
      await c.query(`INSERT INTO unit_status_history (unit_id, previous_status, new_status, changed_by_user_id, reason) VALUES ($1, 'available', 'held', $2, 'Unit held by broker')`, [unitId, req.userId]);
      return h;
    });
    await auditChange(db, req, res, 'create', 'unit_hold', hold.id, undefined, { unitId, brokerId, hours });
    res.status(201).json({ success: true, data: hold });
  } catch (error) { fail(error, res, next); }
});

// POST /api/inventory-hold/:id/unhold
router.post('/:id/unhold', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = uuid(req.params.id, 'Hold id');
    await inTx(async (c) => {
      const h = (await c.query(`SELECT unit_id, status, created_by FROM unit_holds WHERE id = $1`, [id])).rows[0];
      if (!h) throw bad('Hold record not found', 404);
      if (h.status !== 'active') throw bad('Hold is not active', 409);
      const own = h.created_by && h.created_by === req.userId;
      if (!own && !['super_admin', 'project_manager'].includes(req.userRole || '')) throw bad('Only the person who made this hold, a project manager or an admin can release it', 403);
      if (!(await closeHold(c, id, 'cancelled', req.userId || null, 'Hold manually cancelled'))) throw bad('Hold is not active', 409);
    });
    await auditChange(db, req, res, 'update', 'unit_hold', id, { status: 'active' }, { status: 'cancelled' });
    res.json({ success: true, message: 'Unit hold cancelled and unit is now available' });
  } catch (error) { fail(error, res, next); }
});

router.use(pgErrorHandler);
export default router;
