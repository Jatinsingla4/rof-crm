/**
 * Demand Letter Queue Worker
 * Processes scheduled demand letter generation jobs
 * Triggered by the scheduler for 15/7/3 day before due date emails
 */

import { db } from '../../index.js';
import { demandLetterQueue, emailQueue } from '../index.js';

interface DemandLetterJob {
  demandId: string;
  consumerId: string;
  dueDate: string;
  amountInr: number;
  daysUntilDue: number;
}

// Process demand letter jobs
demandLetterQueue.process(5, async (job) => {
  const { demandId, consumerId, dueDate, amountInr, daysUntilDue } = job.data as DemandLetterJob;

  try {
    console.log(
      `Processing demand letter job ${job.id} - demand ${demandId}, due in ${daysUntilDue} days`
    );

    // Fetch consumer details
    const consumerResult = await db.query(
      `SELECT name, email, mobile FROM consumers WHERE id = $1`,
      [consumerId]
    );

    if (consumerResult.rows.length === 0) {
      throw new Error(`Consumer ${consumerId} not found`);
    }

    const consumer = consumerResult.rows[0];

    // Generate demand letter content
    const letterContent = generateDemandLetterHTML(
      consumer.name,
      dueDate,
      amountInr,
      daysUntilDue
    );

    // Create email record in database
    const emailResult = await db.query(
      `INSERT INTO emails (consumer_id, from_email, to_email, subject, body, sent_at)
       VALUES ($1, $2, $3, $4, $5, NULL)
       RETURNING id`,
      [
        consumerId,
        process.env.SMTP_FROM || 'noreply@rofcrm.com',
        consumer.email,
        `Payment Reminder: Amount ₹${amountInr} due on ${dueDate}`,
        letterContent,
      ]
    );

    const emailId = emailResult.rows[0].id;

    // Add to email queue for actual sending
    await emailQueue.add(
      {
        to: consumer.email,
        subject: `Payment Reminder: Amount ₹${amountInr} due on ${dueDate}`,
        body: letterContent,
        consumerId,
        emailId,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      }
    );

    console.log(`Demand letter job ${job.id} completed - email queued as ${emailId}`);

    return { success: true, emailId, emailSent: false };
  } catch (error) {
    console.error(`Failed to process demand letter ${demandId}:`, error);
    throw error;
  }
});

/**
 * Generate HTML for demand letter
 */
function generateDemandLetterHTML(
  consumerName: string,
  dueDate: string,
  amountInr: number,
  daysUntilDue: number
): string {
  const dueDateObj = new Date(dueDate);
  const formattedDate = dueDateObj.toLocaleDateString('en-IN');

  let reminderText = '';
  if (daysUntilDue === 15) {
    reminderText = 'This is a reminder that payment is due in 15 days.';
  } else if (daysUntilDue === 7) {
    reminderText = 'This is a reminder that payment is due in 7 days.';
  } else if (daysUntilDue === 3) {
    reminderText = 'This is an urgent reminder that payment is due in 3 days.';
  }

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f5f5f5; padding: 20px; border-bottom: 3px solid #007bff; }
        .content { padding: 20px; }
        .amount { font-size: 24px; font-weight: bold; color: #007bff; }
        .footer { font-size: 12px; color: #666; padding: 20px; border-top: 1px solid #ddd; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>ROF CRM - Payment Reminder</h1>
        </div>
        <div class="content">
            <p>Dear <strong>${consumerName}</strong>,</p>
            <p>${reminderText}</p>
            <p>Please pay the outstanding amount at your earliest convenience:</p>
            <p class="amount">₹${amountInr.toLocaleString('en-IN')}</p>
            <p><strong>Due Date:</strong> ${formattedDate}</p>
            <p>
                If you have already made this payment, please disregard this notice.
                For any queries, please contact our support team.
            </p>
            <p>Thank you,<br/>ROF CRM Team</p>
        </div>
        <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>
  `;
}

console.log('Demand letter worker initialized');
