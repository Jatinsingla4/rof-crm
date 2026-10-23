/**
 * Documents Routes - Module E
 * Template engine, PDF generation, scanned contract vault, document management.
 * Split by job: templates.ts (letter templates), generate.ts (+ merge-demand.ts for demand letters and interest, merge-letters.ts for the other letters),
 * vault.ts (send, search, list, scanned vault, delete), edit.ts (field edits, recalculation, versions, HTML page). Routes keep their old order.
 */
import { Router } from 'express';
import templates from './documents/templates.js';
import generate from './documents/generate.js';
import vault from './documents/vault.js';
import edit from './documents/edit.js';

const router = Router();
router.use(templates);
router.use(generate);
router.use(vault);
router.use(edit);
export default router;
