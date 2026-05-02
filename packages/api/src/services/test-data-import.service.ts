/**
 * Test Data Import Service
 * Handles verification and logging of test document data import
 * Data is inserted via migration 040, this service provides validation endpoints
 */

import { db } from '../db/pool';

export interface ImportStats {
  projects: number;
  towers: number;
  units: number;
  paymentPlans: number;
  paymentStages: number;
  extraCharges: number;
  consumers: number;
  coApplicants: number;
  totalRecords: number;
  timestamp: string;
}

export class TestDataImportService {
  /**
   * Verify all test data has been imported correctly
   */
  async verifyImport(): Promise<ImportStats> {
    try {
      const stats: ImportStats = {
        projects: 0,
        towers: 0,
        units: 0,
        paymentPlans: 0,
        paymentStages: 0,
        extraCharges: 0,
        consumers: 0,
        coApplicants: 0,
        totalRecords: 0,
        timestamp: new Date().toISOString(),
      };

      // Count projects
      const projectsResult = await db.query(
        `SELECT COUNT(*) as count FROM projects WHERE name LIKE '%TEST%'`
      );
      stats.projects = parseInt(projectsResult.rows[0].count, 10);

      // Count towers
      const towersResult = await db.query(
        `SELECT COUNT(*) as count FROM towers WHERE project_id IN (SELECT id FROM projects WHERE name LIKE '%TEST%')`
      );
      stats.towers = parseInt(towersResult.rows[0].count, 10);

      // Count units
      const unitsResult = await db.query(
        `SELECT COUNT(*) as count FROM units WHERE project_id IN (SELECT id FROM projects WHERE name LIKE '%TEST%')`
      );
      stats.units = parseInt(unitsResult.rows[0].count, 10);

      // Count payment plans
      const plansResult = await db.query(
        `SELECT COUNT(*) as count FROM payment_plans WHERE project_id IN (SELECT id FROM projects WHERE name LIKE '%TEST%')`
      );
      stats.paymentPlans = parseInt(plansResult.rows[0].count, 10);

      // Count payment stages (plan_schedule_templates)
      const stagesResult = await db.query(
        `SELECT COUNT(*) as count FROM plan_schedule_templates WHERE project_id IN (SELECT id FROM projects WHERE name LIKE '%TEST%')`
      );
      stats.paymentStages = parseInt(stagesResult.rows[0].count, 10);

      // Count extra charges (not currently in schema)
      stats.extraCharges = 0;

      // Count consumers from test documents
      const consumersResult = await db.query(
        `SELECT COUNT(*) as count FROM consumers WHERE project_id IN (SELECT id FROM projects WHERE name LIKE '%TEST%')`
      );
      stats.consumers = parseInt(consumersResult.rows[0].count, 10);

      // Count co-applicants
      const coApplicantsResult = await db.query(
        `SELECT COUNT(*) as count FROM co_applicants`
      );
      stats.coApplicants = parseInt(coApplicantsResult.rows[0].count, 10);

      // Calculate total
      stats.totalRecords =
        stats.projects +
        stats.towers +
        stats.units +
        stats.paymentPlans +
        stats.paymentStages +
        stats.extraCharges +
        stats.consumers +
        stats.coApplicants;

      return stats;
    } catch (error) {
      console.error('Error verifying import:', error);
      throw error;
    }
  }

  /**
   * Get detailed project information for imported test projects
   */
  async getProjectDetails() {
    const result = await db.query(
      `SELECT id, name, location, land_area_sqft, total_units, rera_number, tcp_licence, created_at
       FROM projects
       WHERE name LIKE '%TEST%'
       ORDER BY created_at DESC`
    );
    return result.rows;
  }

  /**
   * Get units breakdown by project
   */
  async getUnitsBreakdown() {
    const result = await db.query(
      `SELECT
         p.name as project_name,
         COUNT(u.id) as total_units,
         COUNT(DISTINCT u.bhk_type) as bhk_types,
         ROUND(AVG(u.carpet_area_sqft)::numeric, 2) as avg_carpet_area,
         ROUND(AVG(u.super_area_sqft)::numeric, 2) as avg_super_area
       FROM projects p
       LEFT JOIN units u ON p.id = u.project_id
       WHERE p.name LIKE '%TEST%'
       GROUP BY p.id, p.name
       ORDER BY p.name`
    );
    return result.rows;
  }

  /**
   * Get payment plans breakdown
   */
  async getPaymentPlansBreakdown() {
    const result = await db.query(
      `SELECT
         p.name as project_name,
         pst.plan_name,
         COUNT(pst.id) as total_stages,
         ROUND(SUM(pst.percentage)::numeric, 2) as total_percentage
       FROM projects p
       INNER JOIN plan_schedule_templates pst ON p.id = pst.project_id
       WHERE p.name LIKE '%TEST%'
       GROUP BY p.id, p.name, pst.plan_name
       ORDER BY p.name, pst.plan_name`
    );
    return result.rows;
  }

  /**
   * Get consumers from test document import
   */
  async getImportedConsumers() {
    const result = await db.query(
      `SELECT
         id, name, mobile, email, lead_stage, income_category,
         source_of_enquiry, created_at
       FROM consumers
       WHERE project_id IN (SELECT id FROM projects WHERE name LIKE '%TEST%')
       ORDER BY created_at`
    );
    return result.rows;
  }

  /**
   * Get co-applicants linked to imported consumers
   */
  async getCoApplicants() {
    const result = await db.query(
      `SELECT
         ca.id, c.name as primary_consumer, ca.name as co_applicant_name,
         ca.relationship, ca.created_at
       FROM co_applicants ca
       INNER JOIN consumers c ON ca.consumer_id = c.id
       WHERE c.project_id IN (SELECT id FROM projects WHERE name LIKE '%TEST%')
       ORDER BY ca.created_at`
    );
    return result.rows;
  }

  /**
   * Validate data integrity - check for issues
   */
  async validateDataIntegrity(): Promise<{ issues: string[]; valid: boolean }> {
    const issues: string[] = [];

    try {
      // Check if projects exist
      const projectCount = await db.query(
        `SELECT COUNT(*) as count FROM projects WHERE name LIKE '%TEST%'`
      );
      if (parseInt(projectCount.rows[0].count, 10) !== 2) {
        issues.push('Expected 2 test projects, found ' + projectCount.rows[0].count);
      }

      // Check if units exist
      const unitCount = await db.query(
        `SELECT COUNT(*) as count FROM units WHERE project_id IN (SELECT id FROM projects WHERE name LIKE '%TEST%')`
      );
      if (parseInt(unitCount.rows[0].count, 10) !== 31) {
        issues.push('Expected 31 units, found ' + unitCount.rows[0].count);
      }

      // Check payment plan percentages
      const percentageCheck = await db.query(
        `SELECT pst.plan_name, ROUND(SUM(pst.percentage)::numeric, 2) as total_pct
         FROM plan_schedule_templates pst
         WHERE pst.project_id IN (SELECT id FROM projects WHERE name LIKE '%TEST%')
         GROUP BY pst.project_id, pst.plan_name
         HAVING ROUND(SUM(pst.percentage)::numeric, 2) != 100`
      );
      if (percentageCheck.rows.length > 0) {
        percentageCheck.rows.forEach((row: any) => {
          issues.push(`Payment plan "${row.plan_name}" has ${row.total_pct}% instead of 100%`);
        });
      }

      // Check consumers have aadhaar and pan hashed
      const unhashedConsumers = await db.query(
        `SELECT COUNT(*) as count FROM consumers
         WHERE project_id IN (SELECT id FROM projects WHERE name LIKE '%TEST%')
         AND (aadhaar_hash IS NULL OR pan_hash IS NULL)`
      );
      if (parseInt(unhashedConsumers.rows[0].count, 10) > 0) {
        issues.push(`${unhashedConsumers.rows[0].count} consumers missing Aadhaar or PAN hashes`);
      }

      // Check co-applicants
      const coAppCount = await db.query(
        `SELECT COUNT(*) as count FROM co_applicants`
      );
      if (parseInt(coAppCount.rows[0].count, 10) !== 1) {
        issues.push('Expected 1 co-applicant, found ' + coAppCount.rows[0].count);
      }

      return {
        issues,
        valid: issues.length === 0,
      };
    } catch (error) {
      issues.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { issues, valid: false };
    }
  }
}

export const importService = new TestDataImportService();

