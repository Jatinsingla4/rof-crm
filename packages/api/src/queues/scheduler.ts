/**
 * Demand Letter Scheduler
 * Schedules demand letter jobs for 15/7/3 days before due date
 * Also handles overdue payment escalation
 */

import cron from 'node-cron';
import { db } from '../index.js';
import { demandLetterQueue } from './index.js';
import { expireDueHolds } from '../utils/holds.js';
import { SQL_TODAY, businessDayStart, startOfBusinessDay } from '../utils/business-date.js';

interface Demand {
  id: string;
  consumer_id: string;
  due_date: string;
  amount_due_inr: number;
}

/**
 * Schedule demand letter generation for 15/7/3 days before due date
 * Runs daily at 8:00 AM
 */
export function scheduleDemandLetters() {
  const job1 = cron.schedule('0 8 * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running scheduled demand letter job...`);

    try {
      // Query for demands that are due in 15, 7, or 3 days
      const result = await db.query(`
        SELECT id, consumer_id, due_date, amount_due_inr,
               EXTRACT(DAY FROM (due_date::date - ${SQL_TODAY}))::int as days_until_due
        FROM demands
        WHERE delivery_status IN ('pending', 'queued')
        AND raised_at IS NOT NULL AND status IN ('demanded', 'raised', 'partial')   -- only formally raised demands get a reminder
          AND (EXTRACT(DAY FROM (due_date::date - ${SQL_TODAY}))::int = 15
               OR EXTRACT(DAY FROM (due_date::date - ${SQL_TODAY}))::int = 7
               OR EXTRACT(DAY FROM (due_date::date - ${SQL_TODAY}))::int = 3)
      `);

      const demands: Demand[] = result.rows;

      console.log(
        `Found ${demands.length} demands with upcoming payment reminders`
      );

      // Add each demand to the queue
      for (const demand of demands) {
        const daysUntilDue = Math.ceil(
          (startOfBusinessDay(demand.due_date).getTime() - businessDayStart().getTime()) / (1000 * 60 * 60 * 24)
        );

        await demandLetterQueue.add(
          {
            demandId: demand.id,
            consumerId: demand.consumer_id,
            dueDate: demand.due_date,
            amountInr: demand.amount_due_inr,
            daysUntilDue,
          },
          {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          }
        );

        console.log(`Added demand letter job for demand ${demand.id} (${daysUntilDue} days until due)`);
      }
    } catch (error) {
      console.error('Error in scheduled demand letter job:', error);
    }
  });

  console.log('Scheduled demand letter job initialized (runs daily at 8:00 AM)');
  return job1;
}

/**
 * Schedule overdue payment escalation check
 * Runs daily at 9:00 AM
 */
export function scheduleOverdueCheck() {
  const job2 = cron.schedule('0 9 * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running overdue payment check...`);

    try {
      // Query for overdue demands
      const result = await db.query(`
        SELECT d.id, d.consumer_id, d.due_date, d.amount_due_inr,
               EXTRACT(DAY FROM (${SQL_TODAY} - d.due_date::date))::int as days_overdue
        FROM demands d
        WHERE d.due_date < ${SQL_TODAY}
          AND d.delivery_status NOT IN ('paid', 'cancelled')
          AND d.raised_at IS NOT NULL AND d.status NOT IN ('pending', 'paid', 'cancelled')   -- only formally raised demands
      `);

      const overdues: Demand[] = result.rows;

      console.log(`Found ${overdues.length} overdue payments`);

      // Log overdue details and prepare for escalation
      for (const overdue of overdues) {
        console.warn(
          `OVERDUE: Demand ${overdue.id} for consumer ${overdue.consumer_id} - amount ₹${overdue.amount_due_inr} was due on ${overdue.due_date}`
        );

        // TODO: Implement escalation logic
        // - Send escalation email to project manager
        // - Update demand status to 'overdue'
        // - Create support ticket if overdue > 30 days
        // - Trigger penal interest calculation
      }
    } catch (error) {
      console.error('Error in overdue payment check:', error);
    }
  });

  console.log('Scheduled overdue payment check initialized (runs daily at 9:00 AM)');
  return job2;
}

/**
 * Schedule hold expiry check
 * Runs every 5 minutes (a hold is also released the moment someone lists holds or books the unit)
 */
export function scheduleHoldExpiryCheck() {
  const job3 = cron.schedule('*/5 * * * *', async () => {
    try {
      const n = await expireDueHolds();
      if (n) console.log(`[${new Date().toISOString()}] Expired ${n} unit hold(s)`);
    } catch (error) {
      console.error('Error in hold expiry check:', error);
    }
  });

  console.log('Scheduled hold expiry check initialized (runs every 5 minutes)');
  return job3;
}

/**
 * Initialize all scheduled tasks
 */
export function initializeScheduler() {
  console.log('Initializing demand scheduler...');
  const job1 = scheduleDemandLetters();
  const job2 = scheduleOverdueCheck();
  const job3 = scheduleHoldExpiryCheck();

  return {
    demandLetterJob: job1,
    overdueCheckJob: job2,
    holdExpiryJob: job3
  };
}

