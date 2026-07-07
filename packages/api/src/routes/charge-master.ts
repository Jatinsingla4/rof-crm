import { Router, Response, NextFunction } from 'express';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';

const router = Router();

// GET /api/charge-master/config - list all charge master config rows
router.get('/config', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT id, charge_key, charge_name, rate_value, rate_unit, cap_value,
              is_cap_configurable, updated_at, updated_by
       FROM charge_master_config
       ORDER BY charge_name`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) { next(error); }
});

// PATCH /api/charge-master/config/:chargeKey - update rate_value for a charge
router.patch('/config/:chargeKey', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { chargeKey } = req.params;
    const { rate_value, cap_value } = req.body;

    if (rate_value === undefined || rate_value === null || isNaN(parseFloat(rate_value))) {
      return res.status(400).json({ error: 'rate_value is required and must be a number' });
    }

    const existing = await db.query(
      `SELECT is_cap_configurable FROM charge_master_config WHERE charge_key = $1`,
      [chargeKey]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Charge config not found' });
    }
    if (cap_value !== undefined && !existing.rows[0].is_cap_configurable) {
      return res.status(400).json({ error: 'cap_value is not configurable for this charge' });
    }

    const result = await db.query(
      `UPDATE charge_master_config
       SET rate_value = $1, updated_at = NOW(), updated_by = $2
       WHERE charge_key = $3
       RETURNING id, charge_key, charge_name, rate_value, rate_unit, cap_value,
                 is_cap_configurable, updated_at, updated_by`,
      [parseFloat(rate_value), req.userId, chargeKey]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) { next(error); }
});

export default router;
