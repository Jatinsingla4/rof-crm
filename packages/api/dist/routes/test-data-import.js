"use strict";
/**
 * Test Data Import Routes
 * Endpoints to verify and explore the imported test data
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const test_data_import_service_1 = require("../services/test-data-import.service");
const router = (0, express_1.Router)();
/**
 * GET /api/test-data/verify
 * Verify that test data has been imported correctly
 */
router.get('/verify', async (req, res, next) => {
    try {
        const stats = await test_data_import_service_1.importService.verifyImport();
        const validation = await test_data_import_service_1.importService.validateDataIntegrity();
        res.json({
            success: true,
            data: {
                importStats: stats,
                validation: validation,
                allValid: validation.valid && stats.totalRecords === 88,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/test-data/projects
 * Get details of imported test projects
 */
router.get('/projects', async (req, res, next) => {
    try {
        const projects = await test_data_import_service_1.importService.getProjectDetails();
        res.json({
            success: true,
            data: projects,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/test-data/units-breakdown
 * Get breakdown of units by project
 */
router.get('/units-breakdown', async (req, res, next) => {
    try {
        const breakdown = await test_data_import_service_1.importService.getUnitsBreakdown();
        res.json({
            success: true,
            data: breakdown,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/test-data/payment-plans
 * Get breakdown of payment plans
 */
router.get('/payment-plans', async (req, res, next) => {
    try {
        const plans = await test_data_import_service_1.importService.getPaymentPlansBreakdown();
        res.json({
            success: true,
            data: plans,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/test-data/consumers
 * Get consumers imported from test documents
 */
router.get('/consumers', async (req, res, next) => {
    try {
        const consumers = await test_data_import_service_1.importService.getImportedConsumers();
        res.json({
            success: true,
            data: consumers,
            count: consumers.length,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/test-data/co-applicants
 * Get co-applicants linked to consumers
 */
router.get('/co-applicants', async (req, res, next) => {
    try {
        const coApplicants = await test_data_import_service_1.importService.getCoApplicants();
        res.json({
            success: true,
            data: coApplicants,
            count: coApplicants.length,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/test-data/summary
 * Get complete summary of imported data
 */
router.get('/summary', async (req, res, next) => {
    try {
        const [stats, projects, unitsBreakdown, paymentPlans, consumers, coApplicants, validation] = await Promise.all([
            test_data_import_service_1.importService.verifyImport(),
            test_data_import_service_1.importService.getProjectDetails(),
            test_data_import_service_1.importService.getUnitsBreakdown(),
            test_data_import_service_1.importService.getPaymentPlansBreakdown(),
            test_data_import_service_1.importService.getImportedConsumers(),
            test_data_import_service_1.importService.getCoApplicants(),
            test_data_import_service_1.importService.validateDataIntegrity(),
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
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=test-data-import.js.map