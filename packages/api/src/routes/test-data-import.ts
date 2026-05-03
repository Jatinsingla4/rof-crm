/**
 * Test Data Import Routes
 * Endpoints to verify and explore the imported test data
 */

import { Router, Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../index.js';
import { importService } from '../services/test-data-import.service';

const router = Router();

/**
 * GET /api/test-data/verify
 * Verify that test data has been imported correctly
 */
router.get('/verify', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const stats = await importService.verifyImport();
    const validation = await importService.validateDataIntegrity();

    res.json({
      success: true,
      data: {
        importStats: stats,
        validation: validation,
        allValid: validation.valid && stats.totalRecords === 88,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/test-data/projects
 * Get details of imported test projects
 */
router.get('/projects', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const projects = await importService.getProjectDetails();
    res.json({
      success: true,
      data: projects,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/test-data/units-breakdown
 * Get breakdown of units by project
 */
router.get('/units-breakdown', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const breakdown = await importService.getUnitsBreakdown();
    res.json({
      success: true,
      data: breakdown,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/test-data/payment-plans
 * Get breakdown of payment plans
 */
router.get('/payment-plans', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const plans = await importService.getPaymentPlansBreakdown();
    res.json({
      success: true,
      data: plans,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/test-data/consumers
 * Get consumers imported from test documents
 */
router.get('/consumers', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const consumers = await importService.getImportedConsumers();
    res.json({
      success: true,
      data: consumers,
      count: consumers.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/test-data/co-applicants
 * Get co-applicants linked to consumers
 */
router.get('/co-applicants', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const coApplicants = await importService.getCoApplicants();
    res.json({
      success: true,
      data: coApplicants,
      count: coApplicants.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/test-data/summary
 * Get complete summary of imported data
 */
router.get('/summary', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [stats, projects, unitsBreakdown, paymentPlans, consumers, coApplicants, validation] = await Promise.all([
      importService.verifyImport(),
      importService.getProjectDetails(),
      importService.getUnitsBreakdown(),
      importService.getPaymentPlansBreakdown(),
      importService.getImportedConsumers(),
      importService.getCoApplicants(),
      importService.validateDataIntegrity(),
    ]);

    res.json({
      success: true,
      data: {
        importStats: stats,
        projects: {
          count: projects.length,
          details: projects,
        },
        units: {
          breakdown: unitsBreakdown,
        },
        paymentPlans: {
          breakdown: paymentPlans,
        },
        consumers: {
          count: consumers.length,
          details: consumers,
        },
        coApplicants: {
          count: coApplicants.length,
          details: coApplicants,
        },
        validation: validation,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;

