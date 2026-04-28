/**
 * SMS Queue Worker
 * Processes SMS jobs from the SMS queue
 * For now: logs SMS details (real DLT-compliant gateway integration pending)
 */

import { db } from '../../index.js';
import { smsQueue } from '../index.js';

interface SMSJob {
  to: string;
  message: string;
  consumerId: string;
  notificationId: string;
}

// Process SMS jobs with retry strategy
smsQueue.process(3, async (job) => {
  const { to, message, consumerId, notificationId } = job.data as SMSJob;

  try {
    console.log(`Processing SMS job ${job.id} - to: ${to}`);
    console.log(`Message content: ${message.substring(0, 100)}...`);

    // TODO: Implement actual SMS gateway integration
    // For now, this is a stub that logs the SMS
    // Real implementation will use SMS provider (Twilio, AWS SNS, etc.)
    // and ensure DLT compliance for Indian SMS

    console.log(`SMS stub processed for ${to} - notification ${notificationId}`);

    // Update database: mark notification as sent
    await db.query(
      `UPDATE whatsapps SET delivery_status = 'sent', delivered_at = NOW() WHERE id = $1`,
      [notificationId]
    );

    return { success: true, phoneNumber: to };
  } catch (error) {
    console.error(`Failed to process SMS ${notificationId}:`, error);

    // Update database: mark notification as failed
    try {
      await db.query(
        `UPDATE whatsapps SET delivery_status = 'failed' WHERE id = $1`,
        [notificationId]
      );
    } catch (dbError) {
      console.error(`Failed to update SMS status in DB:`, dbError);
    }

    // Throw error to trigger retry logic
    throw error;
  }
});

// Configure retry strategy
smsQueue.on('failed', async (job, err) => {
  const attempt = job.attemptsMade;
  const maxAttempts = 3;

  console.warn(`SMS job ${job.id} failed (attempt ${attempt}/${maxAttempts}):`, err.message);

  if (attempt >= maxAttempts) {
    console.error(`SMS job ${job.id} failed permanently after ${maxAttempts} attempts`);
    // Update database to mark as permanently failed
    try {
      const data = job.data as SMSJob;
      await db.query(
        `UPDATE whatsapps SET delivery_status = 'failed' WHERE id = $1`,
        [data.notificationId]
      );
    } catch (dbError) {
      console.error('Failed to update final SMS failure status:', dbError);
    }
  }
});

console.log('SMS worker initialized');
