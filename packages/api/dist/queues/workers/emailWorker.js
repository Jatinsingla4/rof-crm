/**
 * Email Queue Worker
 * Processes email jobs from the email queue
 */
import nodemailer from 'nodemailer';
import { db } from '../../index.js';
import { emailQueue } from '../index.js';
// Initialize transporter from environment variables
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
    },
});
// Process email jobs with retry strategy
emailQueue.process(3, async (job) => {
    const { to, subject, body, consumerId, emailId } = job.data;
    try {
        console.log(`Processing email job ${job.id} - to: ${to}`);
        // Send email
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || 'noreply@rofcrm.com',
            to,
            subject,
            html: body,
        });
        console.log(`Email sent successfully: ${info.messageId}`);
        // Update database: mark email as sent
        await db.query(`UPDATE emails SET delivery_status = 'sent', sent_at = NOW() WHERE id = $1`, [emailId]);
        return { success: true, messageId: info.messageId };
    }
    catch (error) {
        console.error(`Failed to send email ${emailId}:`, error);
        // Update database: mark email as failed
        try {
            await db.query(`UPDATE emails SET delivery_status = 'failed' WHERE id = $1`, [emailId]);
        }
        catch (dbError) {
            console.error(`Failed to update email status in DB:`, dbError);
        }
        // Throw error to trigger retry logic
        throw error;
    }
});
// Configure retry strategy
emailQueue.on('failed', async (job, err) => {
    const attempt = job.attemptsMade;
    const maxAttempts = 3;
    console.warn(`Email job ${job.id} failed (attempt ${attempt}/${maxAttempts}):`, err.message);
    if (attempt >= maxAttempts) {
        console.error(`Email job ${job.id} failed permanently after ${maxAttempts} attempts`);
        // Update database to mark as permanently failed
        try {
            const data = job.data;
            await db.query(`UPDATE emails SET delivery_status = 'failed' WHERE id = $1`, [data.emailId]);
        }
        catch (dbError) {
            console.error('Failed to update final failure status:', dbError);
        }
    }
});
console.log('Email worker initialized');
//# sourceMappingURL=emailWorker.js.map