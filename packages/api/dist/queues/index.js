"use strict";
/**
 * Bull/Redis Queue Setup
 * Async job queues for email, SMS, and document generation
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Queue = exports.demandLetterQueue = exports.smsQueue = exports.emailQueue = void 0;
exports.closeQueues = closeQueues;
const bull_1 = __importDefault(require("bull"));
exports.Queue = bull_1.default;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
// Create named queues
exports.emailQueue = new bull_1.default('email-queue', REDIS_URL);
exports.smsQueue = new bull_1.default('sms-queue', REDIS_URL);
exports.demandLetterQueue = new bull_1.default('demand-letter-queue', REDIS_URL);
// Configure queues
const queues = [exports.emailQueue, exports.smsQueue, exports.demandLetterQueue];
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
// Graceful shutdown handler - call this on app termination
async function closeQueues() {
    console.log('Closing queue connections...');
    for (const queue of queues) {
        await queue.close();
    }
    console.log('All queue connections closed');
}
//# sourceMappingURL=index.js.map