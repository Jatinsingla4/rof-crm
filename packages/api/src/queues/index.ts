/**
 * Bull/Redis Queue Setup
 * Async job queues for email, SMS, and document generation
 */

import Queue from 'bull';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Create named queues
export const emailQueue = new Queue('email-queue', REDIS_URL);
export const smsQueue = new Queue('sms-queue', REDIS_URL);
export const demandLetterQueue = new Queue('demand-letter-queue', REDIS_URL);

// Configure queues
const queues = [emailQueue, smsQueue, demandLetterQueue];

// Error handling for all queues
queues.forEach(queue => {
  queue.on('error', (error) => {
    console.error(`Queue ${queue.name} error:`, error.message);
  });

  queue.on('failed', (job, error) => {
    console.error(`Job ${job.id} in queue ${queue.name} failed:`, error.message);
  });

  queue.on('completed', (job) => {
    console.log(`Job ${job.id} in queue ${queue.name} completed successfully`);
  });
});

export { Queue };

// Graceful shutdown handler - call this on app termination
export async function closeQueues() {
  console.log('Closing queue connections...');
  for (const queue of queues) {
    await queue.close();
  }
  console.log('All queue connections closed');
}
