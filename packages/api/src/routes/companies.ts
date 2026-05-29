import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';

const router = Router();

const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), 'uploads/company-logos');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req: any, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.params.id}${ext}`);
  },
});

const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
    cb(null, allowed.includes(file.mimetype) as any);
  },
});

// GET /api/companies
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(`
      SELECT c.*, COUNT(DISTINCT p.id)::int AS project_count
      FROM companies c
      LEFT JOIN projects p ON p.company_id = c.id
      WHERE c.is_active = true
      GROUP BY c.id
      ORDER BY c.name
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});

// GET /api/companies/:id
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(`
      SELECT c.*,
        json_agg(json_build_object('id', p.id, 'name', p.name))
          FILTER (WHERE p.id IS NOT NULL) AS projects
      FROM companies c
      LEFT JOIN projects p ON p.company_id = c.id
      WHERE c.id = $1
      GROUP BY c.id
    `, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Company not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// POST /api/companies
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.userRole !== 'super_admin') return res.status(403).json({ error: 'Only super_admin can create companies' });
  try {
    const {
      name, code, group_name, address1, address2, address3,
      city, state, country, pin_code, phone, fax, email, website,
      gstin, cin, pan_no, service_tax_no, vat_no, reg_address,
      place_of_supply, bank_company_name, bank_account_no,
      bank_ifsc, bank_name, bank_branch, payable_at,
    } = req.body;
    if (!name) return res.status(400).json({ error: 'Company name required' });

    const result = await db.query(`
      INSERT INTO companies (
        name, code, group_name, address1, address2, address3,
        city, state, country, pin_code, phone, fax, email, website,
        gstin, cin, pan_no, service_tax_no, vat_no, reg_address,
        place_of_supply, bank_company_name, bank_account_no,
        bank_ifsc, bank_name, bank_branch, payable_at,
        is_active, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9,'India'),$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        COALESCE($21,'Haryana'),$22,$23,$24,$25,$26,$27,
        true, NOW()
      ) RETURNING *`,
      [name, code||null, group_name||null, address1||null, address2||null,
       address3||null, city||null, state||null, country||null, pin_code||null,
       phone||null, fax||null, email||null, website||null, gstin||null,
       cin||null, pan_no||null, service_tax_no||null, vat_no||null,
       reg_address||null, place_of_supply||null, bank_company_name||null,
       bank_account_no||null, bank_ifsc||null, bank_name||null,
       bank_branch||null, payable_at||null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// PUT /api/companies/:id
router.put('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.userRole !== 'super_admin') return res.status(403).json({ error: 'Only super_admin can update companies' });
  try {
    const { id } = req.params;
    const {
      name, code, group_name, address1, address2, address3,
      city, state, country, pin_code, phone, fax, email, website,
      gstin, cin, pan_no, service_tax_no, vat_no, reg_address,
      place_of_supply, bank_company_name, bank_account_no,
      bank_ifsc, bank_name, bank_branch, payable_at,
      write_to_global_settings,
    } = req.body;

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(`
        UPDATE companies SET
          name              = COALESCE($1, name),
          code              = COALESCE($2, code),
          group_name        = COALESCE($3, group_name),
          address1          = COALESCE($4, address1),
          address2          = COALESCE($5, address2),
          address3          = COALESCE($6, address3),
          city              = COALESCE($7, city),
          state             = COALESCE($8, state),
          country           = COALESCE($9, country),
          pin_code          = COALESCE($10, pin_code),
          phone             = COALESCE($11, phone),
          fax               = COALESCE($12, fax),
          email             = COALESCE($13, email),
          website           = COALESCE($14, website),
          gstin             = COALESCE($15, gstin),
          cin               = COALESCE($16, cin),
          pan_no            = COALESCE($17, pan_no),
          service_tax_no    = COALESCE($18, service_tax_no),
          vat_no            = COALESCE($19, vat_no),
          reg_address       = COALESCE($20, reg_address),
          place_of_supply   = COALESCE($21, place_of_supply),
          bank_company_name = COALESCE($22, bank_company_name),
          bank_account_no   = COALESCE($23, bank_account_no),
          bank_ifsc         = COALESCE($24, bank_ifsc),
          bank_name         = COALESCE($25, bank_name),
          bank_branch       = COALESCE($26, bank_branch),
          payable_at        = COALESCE($27, payable_at),
          updated_at        = NOW()
        WHERE id = $28
        RETURNING *`,
        [name||null, code||null, group_name||null, address1||null, address2||null,
         address3||null, city||null, state||null, country||null, pin_code||null,
         phone||null, fax||null, email||null, website||null, gstin||null,
         cin||null, pan_no||null, service_tax_no||null, vat_no||null,
         reg_address||null, place_of_supply||null, bank_company_name||null,
         bank_account_no||null, bank_ifsc||null, bank_name||null,
         bank_branch||null, payable_at||null, id]
      );

      if (!result.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Company not found' });
      }

      const co = result.rows[0];

      if (write_to_global_settings) {
        const settings: [string, string][] = [
          ['company_name',        co.name || ''],
          ['company_cin',         co.cin || ''],
          ['company_gstin',       co.gstin || ''],
          ['company_address',     co.address1 || ''],
          ['company_reg_addr',    co.reg_address || ''],
          ['company_phone',       co.phone || ''],
          ['company_website',     co.website || ''],
          ['company_email',       co.email || ''],
          ['place_of_supply',     co.place_of_supply || 'Haryana'],
          ['bank_company_name',   co.bank_company_name || co.name || ''],
          ['bank_account_no',     co.bank_account_no || ''],
          ['bank_ifsc',           co.bank_ifsc || ''],
          ['bank_name',           co.bank_name || ''],
          ['bank_branch',         co.bank_branch || ''],
          ['company_logo_url',    co.logo_url || ''],
        ];
        for (const [key, value] of settings) {
          await client.query(`
            INSERT INTO global_settings (key, value, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
            [key, value]
          );
        }
      }

      await client.query('COMMIT');
      res.json({ success: true, data: co });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
});

// POST /api/companies/:id/logo
router.post('/:id/logo', uploadLogo.single('logo'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.userRole !== 'super_admin') return res.status(403).json({ error: 'Only super_admin can upload logos' });
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const logoUrl = `/uploads/company-logos/${req.file.filename}`;
    await db.query(`UPDATE companies SET logo_url = $1, updated_at = NOW() WHERE id = $2`, [logoUrl, req.params.id]);
    await db.query(`
      INSERT INTO global_settings (key, value, updated_at) VALUES ('company_logo_url', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`, [logoUrl]);
    res.json({ success: true, logo_url: logoUrl });
  } catch (err) { next(err); }
});

export default router;
