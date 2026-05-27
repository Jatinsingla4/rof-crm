"use strict";
/**
 * Email Queue Worker
 * Processes email jobs from the email queue
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const nodemailer_1 = __importDefault(require("nodemailer"));
const index_js_1 = require("../../index.js");
const index_js_2 = require("../index.js");
// Initialize transporter from environment variables
const transporter = nodemailer_1.default.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
    },
});
// Process email jobs with retry strategy
index_js_2.emailQueue.process(3, async (job) => {
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
        await index_js_1.db.query(`UPDATE emails SET delivery_status = 'sent', sent_at = NOW() WHERE id = $1`, [emailId]);
        return { success: true, messageId: info.messageId };
    }
    catch (error) {
        console.error(`Failed to send email ${emailId}:`, error);
        // Update database: mark email as failed
        try {
            await index_js_1.db.query(`UPDATE emails SET delivery_status = 'failed' WHERE id = $1`, [emailId]);
        }
        catch (dbError) {
            console.error(`Failed to update email status in DB:`, dbError);
        }
        // Throw error to trigger retry logic
        throw error;
    }
});
// Configure retry strategy
index_js_2.emailQueue.on('failed', async (job, err) => {
    const attempt = job.attemptsMade;
    const maxAttempts = 3;
    console.warn(`Email job ${job.id} failed (attempt ${attempt}/${maxAttempts}):`, err.message);
    if (attempt >= maxAttempts) {
        console.error(`Email job ${job.id} failed permanently after ${maxAttempts} attempts`);
        // Update database to mark as permanently failed
        try {
            const data = job.data;
            await index_js_1.db.query(`UPDATE emails SET delivery_status = 'failed' WHERE id = $1`, [data.emailId]);
        }
        catch (dbError) {
            console.error('Failed to update final failure status:', dbError);
        }
    }
});
console.log('Email worker initialized');
//# sourceMappingURL=emailWorker.js.map