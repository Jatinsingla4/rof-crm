import { Router, Response, NextFunction } from 'express';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';

const router = Router();

const VALID_CHARGE_TYPES = ['BASIC', 'PLC', 'OTHER CHARGE', 'IFMS', 'EXTRA ADD ON', 'OTHERS'];
const VALID_GST_TYPES    = ['INTER', 'INTRA', 'UT'];
const VALID_HSN_TYPES    = ['Goods', 'Service'];

// ── ADDITIONAL: GET /api/gst-configuration/projects ──────────────────────────
router.get('/projects', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT id, name FROM projects ORDER BY name ASC`,
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// ── ADDITIONAL: GET /api/gst-configuration/towers?projectId=uuid ─────────────
router.get('/towers', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    const result = await db.query(
      `SELECT id, tower_name FROM towers
       WHERE project_id = $1 AND deleted_at IS NULL
       ORDER BY tower_name ASC`,
      [projectId],
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// ── TAB 1: FINANCIAL YEARS ────────────────────────────────────────────────────

// GET /api/gst-configuration/financial-years
router.get('/financial-years', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT * FROM financial_years ORDER BY from_date DESC`,
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/gst-configuration/financial-years
router.post('/financial-years', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, fromDate, toDate, isActive } = req.body;
    if (!name || !fromDate || !toDate) {
      return res.status(400).json({ error: 'name, fromDate, and toDate are required' });
    }
    const result = await db.query(
      `INSERT INTO financial_years (name, from_date, to_date, is_active, created_by)
       VALUES ($1, $2::date, $3::date, $4, $5)
       RETURNING *`,
      [name, fromDate, toDate, isActive ?? true, req.userId || null],
    );
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/gst-configuration/financial-years/:id
router.patch('/financial-years/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, fromDate, toDate, isActive } = req.body;
    const result = await db.query(
      `UPDATE financial_years SET
         name       = COALESCE($2, name),
         from_date  = COALESCE($3::date, from_date),
         to_date    = COALESCE($4::date, to_date),
         is_active  = COALESCE($5, is_active),
         updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        name || null,
        fromDate || null,
        toDate || null,
        isActive != null ? isActive : null,
      ],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Financial year not found' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/gst-configuration/financial-years/:id
router.delete('/financial-years/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `DELETE FROM financial_years WHERE id = $1 RETURNING id`,
      [id],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Financial year not found' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ── TAB 2: HSN/SAC CODES ─────────────────────────────────────────────────────

// GET /api/gst-configuration/hsn-sac-codes
router.get('/hsn-sac-codes', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT * FROM hsn_sac_codes WHERE is_active = true ORDER BY code ASC`,
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/gst-configuration/hsn-sac-codes
router.post('/hsn-sac-codes', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { code, type } = req.body;
    if (!code || !type) {
      return res.status(400).json({ error: 'code and type are required' });
    }
    if (!VALID_HSN_TYPES.includes(type)) {
      return res.status(400).json({ error: "type must be 'Goods' or 'Service'" });
    }
    const result = await db.query(
      `INSERT INTO hsn_sac_codes (code, type, created_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [code, type, req.userId || null],
    );
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/gst-configuration/hsn-sac-codes/:id
router.patch('/hsn-sac-codes/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { code, type } = req.body;
    if (type && !VALID_HSN_TYPES.includes(type)) {
      return res.status(400).json({ error: "type must be 'Goods' or 'Service'" });
    }
    const result = await db.query(
      `UPDATE hsn_sac_codes SET
         code       = COALESCE($2, code),
         type       = COALESCE($3, type),
         updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id, code || null, type || null],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'HSN/SAC code not found' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/gst-configuration/hsn-sac-codes/:id (soft delete)
router.delete('/hsn-sac-codes/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `UPDATE hsn_sac_codes SET is_active = false, updated_at = now()
       WHERE id = $1
       RETURNING id`,
      [id],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'HSN/SAC code not found' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ── TAB 3: HSN/SAC CODE ASSIGN ───────────────────────────────────────────────

// GET /api/gst-configuration/hsn-sac-assign?projectId=uuid
router.get('/hsn-sac-assign', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;
    const result = await db.query(
      `SELECT
         hsa.id,
         hsa.project_id,
         hsa.hsn_sac_id,
         hsa.charge_type,
         hsa.created_at,
         h.code        AS hsn_code,
         h.type        AS hsn_type,
         p.name        AS project_name
       FROM hsn_sac_code_assign hsa
       JOIN hsn_sac_codes h ON h.id = hsa.hsn_sac_id
       JOIN projects p      ON p.id = hsa.project_id
       WHERE ($1::uuid IS NULL OR hsa.project_id = $1)
       ORDER BY p.name, hsa.charge_type`,
      [projectId || null],
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/gst-configuration/hsn-sac-assign
router.post('/hsn-sac-assign', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { hsnSacId, projectId, chargeType } = req.body;
    if (!hsnSacId || !projectId || !chargeType) {
      return res.status(400).json({ error: 'hsnSacId, projectId, and chargeType are required' });
    }
    if (!VALID_CHARGE_TYPES.includes(chargeType)) {
      return res.status(400).json({ error: `chargeType must be one of: ${VALID_CHARGE_TYPES.join(', ')}` });
    }
    const result = await db.query(
      `INSERT INTO hsn_sac_code_assign (hsn_sac_id, project_id, charge_type, created_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (project_id, charge_type) DO UPDATE SET
         hsn_sac_id = $1,
         updated_at = now()
       RETURNING *`,
      [hsnSacId, projectId, chargeType, req.userId || null],
    );
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/gst-configuration/hsn-sac-assign/:id
router.delete('/hsn-sac-assign/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `DELETE FROM hsn_sac_code_assign WHERE id = $1 RETURNING id`,
      [id],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ── TAB 4: GST SLABS ─────────────────────────────────────────────────────────

// GET /api/gst-configuration/gst-slabs
router.get('/gst-slabs', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT * FROM gst_slabs WHERE is_active = true ORDER BY from_date DESC`,
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/gst-configuration/gst-slabs
router.post('/gst-slabs', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { fromDate, toDate } = req.body;
    if (!fromDate || !toDate) {
      return res.status(400).json({ error: 'fromDate and toDate are required' });
    }
    const result = await db.query(
      `INSERT INTO gst_slabs (from_date, to_date, created_by)
       VALUES ($1::date, $2::date, $3)
       RETURNING *`,
      [fromDate, toDate, req.userId || null],
    );
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/gst-configuration/gst-slabs/:id
router.delete('/gst-slabs/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const check = await db.query(
      `SELECT COUNT(*) FROM gst_tax_setup WHERE slab_id = $1`,
      [id],
    );
    if (parseInt(check.rows[0].count, 10) > 0) {
      return res.status(409).json({ error: 'Cannot delete slab with existing tax setup entries.' });
    }
    const result = await db.query(
      `DELETE FROM gst_slabs WHERE id = $1 RETURNING id`,
      [id],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'GST slab not found' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ── TAB 5: GST TAX SETUP ─────────────────────────────────────────────────────

// GET /api/gst-configuration/gst-tax-setup?slabId=uuid
router.get('/gst-tax-setup', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { slabId } = req.query;
    const result = await db.query(
      `SELECT
         gts.*,
         gs.from_date,
         gs.to_date,
         TO_CHAR(gs.from_date,'DD Mon YYYY') || ' - ' || TO_CHAR(gs.to_date,'DD Mon YYYY') AS slab_label
       FROM gst_tax_setup gts
       JOIN gst_slabs gs ON gs.id = gts.slab_id
       WHERE ($1::uuid IS NULL OR gts.slab_id = $1)
       ORDER BY gs.from_date DESC, gts.gst_code ASC`,
      [slabId || null],
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/gst-configuration/gst-tax-setup
router.post('/gst-tax-setup', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { slabId, gstCode, type, cgstPct, sgstPct, utgstPct, igstPct } = req.body;
    if (!slabId || !gstCode || !type) {
      return res.status(400).json({ error: 'slabId, gstCode, and type are required' });
    }
    if (!VALID_GST_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${VALID_GST_TYPES.join(', ')}` });
    }
    const result = await db.query(
      `INSERT INTO gst_tax_setup
         (slab_id, gst_code, type, cgst_pct, sgst_pct, utgst_pct, igst_pct, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        slabId, gstCode, type,
        cgstPct  != null ? parseFloat(cgstPct)  : 0,
        sgstPct  != null ? parseFloat(sgstPct)  : 0,
        utgstPct != null ? parseFloat(utgstPct) : 0,
        igstPct  != null ? parseFloat(igstPct)  : 0,
        req.userId || null,
      ],
    );
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/gst-configuration/gst-tax-setup/:id
router.patch('/gst-tax-setup/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { gstCode, type, cgstPct, sgstPct, utgstPct, igstPct } = req.body;
    if (type && !VALID_GST_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${VALID_GST_TYPES.join(', ')}` });
    }
    const result = await db.query(
      `UPDATE gst_tax_setup SET
         gst_code   = COALESCE($2, gst_code),
         type       = COALESCE($3, type),
         cgst_pct   = COALESCE($4, cgst_pct),
         sgst_pct   = COALESCE($5, sgst_pct),
         utgst_pct  = COALESCE($6, utgst_pct),
         igst_pct   = COALESCE($7, igst_pct),
         updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        gstCode  || null,
        type     || null,
        cgstPct  != null ? parseFloat(cgstPct)  : null,
        sgstPct  != null ? parseFloat(sgstPct)  : null,
        utgstPct != null ? parseFloat(utgstPct) : null,
        igstPct  != null ? parseFloat(igstPct)  : null,
      ],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'GST tax setup not found' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/gst-configuration/gst-tax-setup/:id
router.delete('/gst-tax-setup/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `DELETE FROM gst_tax_setup WHERE id = $1 RETURNING id`,
      [id],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'GST tax setup not found' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ── TAB 6: GST TAX CHARGE MAPPING ────────────────────────────────────────────

// GET /api/gst-configuration/gst-charge-mapping?projectId=uuid&slabId=uuid
router.get('/gst-charge-mapping', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, slabId } = req.query;
    const result = await db.query(
      `SELECT
         gcm.*,
         p.name         AS project_name,
         gts.gst_code,
         gts.type       AS gst_type,
         gts.cgst_pct,
         gts.sgst_pct,
         gts.utgst_pct,
         gts.igst_pct,
         TO_CHAR(gs.from_date,'DD Mon YYYY') || ' - ' || TO_CHAR(gs.to_date,'DD Mon YYYY') AS slab_label
       FROM gst_tax_charge_mapping gcm
       JOIN projects p      ON p.id   = gcm.project_id
       JOIN gst_slabs gs    ON gs.id  = gcm.slab_id
       LEFT JOIN gst_tax_setup gts ON gts.id = gcm.gst_tax_id
       WHERE ($1::uuid IS NULL OR gcm.project_id = $1)
         AND ($2::uuid IS NULL OR gcm.slab_id    = $2)
       ORDER BY p.name, gcm.charge_type`,
      [projectId || null, slabId || null],
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/gst-configuration/gst-charge-mapping
router.post('/gst-charge-mapping', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, slabId, gstTaxId, chargeType } = req.body;
    if (!projectId || !slabId || !gstTaxId || !chargeType) {
      return res.status(400).json({ error: 'projectId, slabId, gstTaxId, and chargeType are required' });
    }
    if (!VALID_CHARGE_TYPES.includes(chargeType)) {
      return res.status(400).json({ error: `chargeType must be one of: ${VALID_CHARGE_TYPES.join(', ')}` });
    }
    const result = await db.query(
      `INSERT INTO gst_tax_charge_mapping
         (project_id, slab_id, gst_tax_id, charge_type, created_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (project_id, slab_id, charge_type) DO UPDATE SET
         gst_tax_id = $3,
         updated_at = now()
       RETURNING *`,
      [projectId, slabId, gstTaxId, chargeType, req.userId || null],
    );
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/gst-configuration/gst-charge-mapping/:id
router.delete('/gst-charge-mapping/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `DELETE FROM gst_tax_charge_mapping WHERE id = $1 RETURNING id`,
      [id],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Charge mapping not found' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/gst-configuration/resolve?projectId=X&chargeType=BASIC&date=Y
// Returns resolved GST rate for a specific project + charge type + date.
// Used by booking forms to show real rates instead of generic tax_slabs.
router.get('/resolve', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, chargeType, date } = req.query as {
      projectId: string;
      chargeType: string;
      date?: string;
    };

    if (!projectId || !chargeType) {
      return res.status(400).json({ success: false, error: 'projectId and chargeType required' });
    }

    const resolveDate = date || new Date().toISOString().split('T')[0];

    const projRes = await db.query(`SELECT name FROM projects WHERE id = $1`, [projectId]);
    const projectName = projRes.rows[0]?.name || projectId;

    const result = await db.query(
      `SELECT gts.cgst_pct, gts.sgst_pct
       FROM gst_tax_charge_mapping gcm
       JOIN gst_slabs gs ON gs.id = gcm.slab_id
        AND gs.from_date <= $3::date
        AND gs.to_date   >= $3::date
       JOIN gst_tax_setup gts ON gts.id = gcm.gst_tax_id
       WHERE gcm.project_id = $1
         AND gcm.charge_type = $2
       LIMIT 1`,
      [projectId, chargeType, resolveDate]
    );

    if (!result.rows.length) {
      // Fallback to BASIC if non-BASIC not configured (matches gst-resolver.ts behavior)
      if (chargeType !== 'BASIC') {
        const fallback = await db.query(
          `SELECT gts.cgst_pct, gts.sgst_pct
           FROM gst_tax_charge_mapping gcm
           JOIN gst_slabs gs ON gs.id = gcm.slab_id
            AND gs.from_date <= $2::date
            AND gs.to_date   >= $2::date
           JOIN gst_tax_setup gts ON gts.id = gcm.gst_tax_id
           WHERE gcm.project_id = $1
             AND gcm.charge_type = 'BASIC'
           LIMIT 1`,
          [projectId, resolveDate]
        );
        if (fallback.rows.length) {
          return res.json({
            success: true,
            data: {
              cgstPct: parseFloat(fallback.rows[0].cgst_pct),
              sgstPct: parseFloat(fallback.rows[0].sgst_pct),
              fallback: true,
            },
          });
        }
      }
      return res.status(404).json({ success: false, error: `No GST mapping for ${chargeType} on ${projectName}` });
    }

    return res.json({
      success: true,
      data: {
        cgstPct: parseFloat(result.rows[0].cgst_pct),
        sgstPct: parseFloat(result.rows[0].sgst_pct),
        fallback: false,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── TAB 7: PROJECT WISE GSTIN ─────────────────────────────────────────────────

// GET /api/gst-configuration/project-gstin
router.get('/project-gstin', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT
         pg.id, pg.project_id, pg.gstin, pg.is_active,
         p.name AS project_name
       FROM project_gstin pg
       JOIN projects p ON p.id = pg.project_id
       ORDER BY p.name ASC`,
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/gst-configuration/project-gstin
router.post('/project-gstin', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, gstin } = req.body;
    if (!projectId || !gstin) {
      return res.status(400).json({ error: 'projectId and gstin are required' });
    }
    if (!/^[A-Z0-9]{15}$/.test(gstin.toUpperCase())) {
      return res.status(400).json({ error: 'GSTIN must be 15 alphanumeric characters' });
    }
    const result = await db.query(
      `INSERT INTO project_gstin (project_id, gstin, created_by)
       VALUES ($1, UPPER($2), $3)
       ON CONFLICT (project_id) DO UPDATE SET
         gstin      = UPPER($2),
         updated_at = now()
       RETURNING *`,
      [projectId, gstin, req.userId || null],
    );
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/gst-configuration/project-gstin/:id
router.patch('/project-gstin/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { gstin } = req.body;
    if (!gstin) return res.status(400).json({ error: 'gstin is required' });
    if (!/^[A-Z0-9]{15}$/.test(gstin.toUpperCase())) {
      return res.status(400).json({ error: 'GSTIN must be 15 alphanumeric characters' });
    }
    const result = await db.query(
      `UPDATE project_gstin SET
         gstin      = UPPER($2),
         updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id, gstin],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Project GSTIN not found' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ── TAB 8: PROJECT WISE RERA NO. ─────────────────────────────────────────────

// GET /api/gst-configuration/project-rera?projectId=uuid
router.get('/project-rera', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;
    const result = await db.query(
      `SELECT
         prn.id,
         prn.project_id,
         prn.tower_id,
         prn.rera_number,
         p.name      AS project_name,
         t.tower_name
       FROM project_rera_numbers prn
       JOIN projects p       ON p.id = prn.project_id
       LEFT JOIN towers t    ON t.id = prn.tower_id
       WHERE ($1::uuid IS NULL OR prn.project_id = $1)
       ORDER BY p.name, t.tower_name`,
      [projectId || null],
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/gst-configuration/project-rera
router.post('/project-rera', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, towerId, reraNumber } = req.body;
    if (!projectId || !reraNumber) {
      return res.status(400).json({ error: 'projectId and reraNumber are required' });
    }
    const result = await db.query(
      `INSERT INTO project_rera_numbers (project_id, tower_id, rera_number, created_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (project_id, tower_id) DO UPDATE SET
         rera_number = $3,
         updated_at  = now()
       RETURNING *`,
      [projectId, towerId || null, reraNumber, req.userId || null],
    );
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/gst-configuration/project-rera/:id
router.patch('/project-rera/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { reraNumber } = req.body;
    if (!reraNumber) return res.status(400).json({ error: 'reraNumber is required' });
    const result = await db.query(
      `UPDATE project_rera_numbers SET
         rera_number = $2,
         updated_at  = now()
       WHERE id = $1
       RETURNING *`,
      [id, reraNumber],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'RERA number not found' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
